import { effectiveBinding, valueToHold } from "./evaluate";
import { labelOf, reaches, type LinkDeps, type LinkSnapshot, type PortDefinition } from "./snapshot";
import { sourcePortOf, terms, type Binding, type SerializableReference } from "./terms";
import type { PortId } from "./types";
import { linkVerbs, type LinkVerb, type UnlinkPolicy } from "./verbs";

/*
 * Planning (design §8.2): every instrument asks the same question the same
 * way — "may this port follow that one?" — and gets a verb, a refusal with
 * a code and a sentence, or an ambiguity. Menus render the refusal; a drop
 * highlights on `kind !== "unavailable"`; the handler re-plans on a fresh
 * snapshot before writing (report §8.10). Registration order never decides.
 */

export type LinkPlan =
  | { readonly kind: "available"; readonly verb: LinkVerb; readonly explanation: string }
  | { readonly kind: "unavailable"; readonly because: string; readonly code: string; readonly alternatives?: readonly LinkVerb[] }
  | { readonly kind: "ambiguous"; readonly options: readonly { verb: LinkVerb; label: string }[] };

const unavailable = (because: string, code: string, alternatives?: LinkVerb[]): LinkPlan => ({ kind: "unavailable", because, code, ...(alternatives ? { alternatives } : {}) });
const available = (verb: LinkVerb, explanation: string): LinkPlan => ({ kind: "available", verb, explanation });

export function titleOfPort(definition: PortDefinition): string {
  return `${definition.tileTitle} · ${definition.declaration.name}`;
}

/** Does `port`'s explicit chain read (transitively) from `target`? The check `port.follow` runs before adding an edge. */
export function dependsOn(port: PortId, target: PortId, s: LinkSnapshot, seen: Set<PortId> = new Set()): boolean {
  if (port === target) return true;
  if (seen.has(port)) return false;
  seen.add(port);
  const binding = s.bindings.get(port);
  const source = binding ? sourcePortOf(binding) : null;
  return source ? dependsOn(source, target, s, seen) : false;
}

export function planFollow(source: PortId, destination: PortId, s: LinkSnapshot, deps: LinkDeps): LinkPlan {
  const S = s.ports.get(source);
  const D = s.ports.get(destination);
  if (!S || !D) return unavailable("that port no longer exists", "port-missing");
  if (source === destination) return unavailable("a port cannot follow itself", "self");
  if (S.declaration.direction === "in") return unavailable(`${titleOfPort(S)} is an input; only outputs can be followed`, "direction");
  if (D.declaration.direction === "out") return unavailable(`${titleOfPort(D)} is an output; it cannot follow anything`, "direction");
  if (!reaches(S.declaration.contract.valueType, D.declaration.contract.valueType, deps.graph)) {
    return unavailable(`<${S.declaration.contract.valueType}> does not reach <${D.declaration.contract.valueType}>`, "type");
  }
  const current = s.bindings.get(destination);
  if (current?.kind === "hold") return unavailable(`${titleOfPort(D)} is held; resume or detach it first`, "held");
  if (current?.kind === "follow" && current.source === source) return unavailable(`${titleOfPort(D)} already follows ${titleOfPort(S)}`, "already");
  if (dependsOn(source, destination, s)) {
    return unavailable(`${titleOfPort(S)} already reads from ${titleOfPort(D)}; that would be a cycle`, "cycle");
  }
  const replacing = current && sourcePortOf(current) ? ` (replacing ${current.kind === "follow" ? titleOfPort(s.ports.get(current.source) ?? S) : "its current source"})` : "";
  return available(linkVerbs.follow(source, destination), `${titleOfPort(D)} will follow ${titleOfPort(S)}${replacing}`);
}

export function planBind(port: PortId, reference: SerializableReference, s: LinkSnapshot, deps: LinkDeps): LinkPlan {
  const D = s.ports.get(port);
  if (!D) return unavailable("that port no longer exists", "port-missing");
  if (D.declaration.direction === "out") return unavailable(`${titleOfPort(D)} is an output`, "direction");
  if (D.declaration.documentSlot) return unavailable(`${titleOfPort(D)} is a document slot; rebind the view instead`, "document-slot");
  if (!reaches(reference.type, D.declaration.contract.valueType, deps.graph)) {
    return unavailable(`<${reference.type}> does not reach <${D.declaration.contract.valueType}>`, "type");
  }
  const current = s.bindings.get(port);
  if (current?.kind === "hold") return unavailable(`${titleOfPort(D)} is held; resume or detach it first`, "held");
  return available(linkVerbs.bind(port, reference), `${titleOfPort(D)} will show ${labelOf(reference, deps)}`);
}

export function planAmbient(port: PortId, context: string, s: LinkSnapshot, deps: LinkDeps): LinkPlan {
  const D = s.ports.get(port);
  if (!D) return unavailable("that port no longer exists", "port-missing");
  if (D.declaration.direction === "out") return unavailable(`${titleOfPort(D)} is an output`, "direction");
  const definition = s.contexts.get(context);
  if (!definition) return unavailable(`no context called ${context}`, "context-missing");
  if (!reaches(definition.valueType, D.declaration.contract.valueType, deps.graph)) {
    return unavailable(`${context} holds <${definition.valueType}>, which does not reach <${D.declaration.contract.valueType}>`, "type");
  }
  const current = s.bindings.get(port);
  if (current?.kind === "hold") return unavailable(`${titleOfPort(D)} is held; resume or detach it first`, "held");
  return available(linkVerbs.ambient(port, context), `${titleOfPort(D)} will read the ${context} context`);
}

export function planPin(port: PortId, s: LinkSnapshot, deps: LinkDeps): LinkPlan {
  const D = s.ports.get(port);
  if (!D) return unavailable("that port no longer exists", "port-missing");
  if (D.declaration.direction === "out") return unavailable(`${titleOfPort(D)} is an output`, "direction");
  const binding = effectiveBinding(port, s);
  if (binding.kind === "hold") return unavailable(`${titleOfPort(D)} is already held`, "held");
  if (binding.kind === "constant") return unavailable(`${titleOfPort(D)} is fixed already`, "fixed");
  const value = valueToHold(port, s, deps);
  if (!value) return unavailable(`${titleOfPort(D)} shows nothing to hold`, "empty");
  return available(linkVerbs.pin(port), `${titleOfPort(D)} will stay on ${labelOf(value, deps)}`);
}

export function planResume(port: PortId, s: LinkSnapshot): LinkPlan {
  const D = s.ports.get(port);
  if (!D) return unavailable("that port no longer exists", "port-missing");
  const binding = s.bindings.get(port);
  if (binding?.kind !== "hold") return unavailable(`${titleOfPort(D)} is not held`, "not-held");
  if (binding.suspended.kind === "unresolved") return unavailable(`nothing to resume: ${binding.suspended.diagnostic.message}`, "nothing-to-resume");
  const source = sourcePortOf(binding.suspended);
  const sourceDefinition = source ? s.ports.get(source) : undefined;
  if (source && !sourceDefinition) return unavailable(`nothing to resume: ${source} is gone`, "source-missing");
  const what = sourceDefinition ? `following ${titleOfPort(sourceDefinition)}` : binding.suspended.kind === "ambient" ? `reading ${binding.suspended.key}` : "its source";
  return available(linkVerbs.resume(port), `${titleOfPort(D)} will resume ${what}`);
}

export function planDetach(port: PortId, s: LinkSnapshot, deps: LinkDeps): LinkPlan {
  const D = s.ports.get(port);
  if (!D) return unavailable("that port no longer exists", "port-missing");
  const binding = s.bindings.get(port);
  if (binding?.kind !== "hold") return unavailable(`${titleOfPort(D)} is not held`, "not-held");
  return available(linkVerbs.detach(port), `${titleOfPort(D)} stays fixed on ${labelOf(binding.reference, deps)} and forgets its source`);
}

export function planClear(port: PortId, s: LinkSnapshot): LinkPlan {
  const D = s.ports.get(port);
  if (!D) return unavailable("that port no longer exists", "port-missing");
  if (!s.bindings.has(port)) return unavailable(`${titleOfPort(D)} is already at its declared fallback`, "already");
  const fallback = D.declaration.fallbackContext ? `read the ${D.declaration.fallbackContext} context` : "be unbound";
  return available(linkVerbs.clear(port), `${titleOfPort(D)} will ${fallback}`);
}

/** The port whose explicit term carries this link id, with the term. */
export function findLink(linkId: string, s: LinkSnapshot): { port: PortId; binding: Binding } | null {
  for (const [port, binding] of s.bindings) {
    const inner = binding.kind === "hold" ? binding.suspended : binding;
    if ((inner.kind === "follow" || inner.kind === "derived") && inner.linkId === linkId) return { port, binding };
  }
  return null;
}

export function planUnlink(linkId: string, policy: UnlinkPolicy, s: LinkSnapshot, deps: LinkDeps): LinkPlan {
  const found = findLink(linkId, s);
  if (!found) return unavailable("that link no longer exists", "link-missing");
  const D = s.ports.get(found.port);
  if (!D) return unavailable("that port no longer exists", "port-missing");
  if (policy === "freeze" && !valueToHold(found.port, s, deps)) {
    return unavailable(`${titleOfPort(D)} shows nothing to keep; clear it or fall back instead`, "empty");
  }
  if (policy === "ambient" && !D.declaration.fallbackContext) {
    return unavailable(`${titleOfPort(D)} declares no ambient fallback`, "no-fallback");
  }
  const outcome = policy === "freeze" ? "keeps its last value" : policy === "clear" ? "is cleared" : `falls back to ${D.declaration.fallbackContext}`;
  return available(linkVerbs.unlink(linkId, policy), `${titleOfPort(D)} ${outcome}`);
}

/** Every plan a badge menu shows for one port, in menu order. */
export function plansForPort(port: PortId, s: LinkSnapshot, deps: LinkDeps): { pin: LinkPlan; resume: LinkPlan; detach: LinkPlan; clear: LinkPlan } {
  return { pin: planPin(port, s, deps), resume: planResume(port, s), detach: planDetach(port, s, deps), clear: planClear(port, s) };
}

/** Laws the tests hold the planner to: `resume(pin(b)) = b` for every term except a hold. */
export function suspendedAfterPin(binding: Binding): Binding {
  return binding.kind === "hold" ? binding.suspended : binding;
}

export { terms };
