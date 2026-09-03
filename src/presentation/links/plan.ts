import { effectiveBinding, evaluatePort, valueToHold } from "./evaluate";
import { candidateTermOf, type TermVerb } from "./candidate";
import { canFlow } from "./compatibility";
import { checkBinding } from "./check";
import { cellOf, checkIdentityCompatibility, type MergePolicy, type SplitPolicy } from "./identity";
import { labelOf, reaches, titleOfPort, type LinkDeps, type LinkSnapshot } from "./snapshot";
import { sourcePortOf, terms, type Binding, type SerializableReference } from "./terms";
import type { PortId } from "./types";
import { linkVerbs, type LinkVerb, type UnlinkPolicy } from "./verbs";

/*
 * Planning (design §8.2): every instrument asks the same question the same
 * way — "may this port follow that one?" — and gets a verb, a refusal with
 * a code and a sentence, or an ambiguity. Menus render the refusal; a drop
 * highlights on `kind !== "unavailable"`; the handler re-plans on a fresh
 * snapshot before writing (report §8.10). Registration order never decides.
 *
 * Since PBUI-KERNEL-2 the planners keep only OPERATION policy — existence,
 * direction, self, document slots, held, shared, already-linked, which
 * relations are legal — and hand the term they would persist to the static
 * checker (`check.ts`) for what is STRUCTURAL: sources, contexts, cells and
 * relations exist, domains and destination types reach, no cycle.
 */

export type LinkPlan =
  | { readonly kind: "available"; readonly verb: LinkVerb; readonly explanation: string }
  | { readonly kind: "unavailable"; readonly because: string; readonly code: string; readonly alternatives?: readonly LinkVerb[] }
  | { readonly kind: "ambiguous"; readonly options: readonly { verb: LinkVerb; label: string }[] };

const unavailable = (because: string, code: string, alternatives?: LinkVerb[]): LinkPlan => ({ kind: "unavailable", because, code, ...(alternatives ? { alternatives } : {}) });
const available = (verb: LinkVerb, explanation: string): LinkPlan => ({ kind: "available", verb, explanation });

/** The checker's verdict on THE term `verb` would persist (§12.7), as a refusal, or null when it is admissible. */
function checkedCandidate(verb: TermVerb, destination: PortId, s: LinkSnapshot, deps: LinkDeps): LinkPlan | null {
  const result = checkBinding(candidateTermOf(verb), s, deps, destination);
  return result.kind === "invalid" ? unavailable(result.diagnostic.message, result.diagnostic.code) : null;
}

export function planFollow(source: PortId, destination: PortId, s: LinkSnapshot, deps: LinkDeps): LinkPlan {
  const S = s.ports.get(source);
  const D = s.ports.get(destination);
  if (!S || !D) return unavailable("that port no longer exists", "port-missing");
  if (source === destination) return unavailable("a port cannot follow itself", "self");
  if (S.declaration.direction === "in") return unavailable(`${titleOfPort(S)} is an input; only outputs can be followed`, "direction");
  if (D.declaration.direction === "out") return unavailable(`${titleOfPort(D)} is an output; it cannot follow anything`, "direction");
  const current = s.bindings.get(destination);
  if (current?.kind === "hold") return unavailable(`${titleOfPort(D)} is held; resume or detach it first`, "held");
  if (cellOf(destination, s)) return unavailable(`${titleOfPort(D)} shares the ${cellOf(destination, s)!.id} cell; leave the cell first`, "shared");
  if (current?.kind === "follow" && current.source === source) return unavailable(`${titleOfPort(D)} already follows ${titleOfPort(S)}`, "already");
  const replacing = current && sourcePortOf(current) ? ` (replacing ${current.kind === "follow" ? titleOfPort(s.ports.get(current.source) ?? S) : "its current source"})` : "";
  const verb = linkVerbs.follow(source, destination) as TermVerb;
  const checked = checkedCandidate(verb, destination, s, deps);
  if (checked) return checked;
  return available(verb, `${titleOfPort(D)} will follow ${titleOfPort(S)}${replacing}`);
}

export function planBind(port: PortId, reference: SerializableReference, s: LinkSnapshot, deps: LinkDeps): LinkPlan {
  const D = s.ports.get(port);
  if (!D) return unavailable("that port no longer exists", "port-missing");
  if (D.declaration.direction === "out") return unavailable(`${titleOfPort(D)} is an output`, "direction");
  if (D.declaration.documentSlot) return unavailable(`${titleOfPort(D)} is a document slot; rebind the view instead`, "document-slot");
  const current = s.bindings.get(port);
  if (current?.kind === "hold") return unavailable(`${titleOfPort(D)} is held; resume or detach it first`, "held");
  if (cellOf(port, s)) return unavailable(`${titleOfPort(D)} shares the ${cellOf(port, s)!.id} cell; leave the cell first`, "shared");
  const verb = linkVerbs.bind(port, reference) as TermVerb;
  const checked = checkedCandidate(verb, port, s, deps);
  if (checked) return checked;
  return available(verb, `${titleOfPort(D)} will show ${labelOf(reference, deps)}`);
}

export function planAmbient(port: PortId, context: string, s: LinkSnapshot, deps: LinkDeps): LinkPlan {
  const D = s.ports.get(port);
  if (!D) return unavailable("that port no longer exists", "port-missing");
  if (D.declaration.direction === "out") return unavailable(`${titleOfPort(D)} is an output`, "direction");
  const current = s.bindings.get(port);
  if (current?.kind === "hold") return unavailable(`${titleOfPort(D)} is held; resume or detach it first`, "held");
  const verb = linkVerbs.ambient(port, context) as TermVerb;
  const checked = checkedCandidate(verb, port, s, deps);
  if (checked) return checked;
  return available(verb, `${titleOfPort(D)} will read the ${context} context`);
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

/**
 * May `left` and `right` share one cell (Phase 5)? Both must exist, be
 * readable, carry no explicit term, and agree on every contract field; the
 * refusal names the field. `cellsDiffer` tells the instrument to ask for a
 * merge policy rather than guess.
 */
export function planIdentityAdd(left: PortId, right: PortId, mergePolicy: MergePolicy, s: LinkSnapshot, deps: LinkDeps): LinkPlan & { cellsDiffer?: boolean } {
  const L = s.ports.get(left);
  const R = s.ports.get(right);
  if (!L || !R) return unavailable("that port no longer exists", "port-missing");
  if (left === right) return unavailable("a port cannot share a cell with itself", "self");
  if (L.declaration.direction === "out" || R.declaration.direction === "out") return unavailable("an output-only port cannot share a cell", "direction");
  const already = s.aliases.get(left);
  if (already && already === s.aliases.get(right)) return unavailable(`${titleOfPort(L)} and ${titleOfPort(R)} already share ${already}`, "already");
  for (const [port, definition] of [[left, L], [right, R]] as const) {
    const term = s.bindings.get(port);
    if (term) return unavailable(`${titleOfPort(definition)} is ${term.kind === "hold" ? "held" : term.kind === "follow" ? "following a source" : "bound"}; unlink it first`, "bound");
  }
  const compatibility = checkIdentityCompatibility(left, right, s);
  if (!compatibility.ok) return unavailable(`${titleOfPort(L)} and ${titleOfPort(R)} cannot be identified: ${compatibility.because}`, "incompatible");
  const a = evaluatePort(left, s, deps);
  const b = evaluatePort(right, s, deps);
  const va = a.kind === "value" ? JSON.stringify(a.reference) : null;
  const vb = b.kind === "value" ? JSON.stringify(b.reference) : null;
  const cellsDiffer = va !== vb && va !== null && vb !== null;
  if (cellsDiffer && mergePolicy === "require-equal") {
    return { ...unavailable(`${titleOfPort(L)} and ${titleOfPort(R)} show different values; choose which one wins`, "cells-differ"), cellsDiffer };
  }
  const seed = mergePolicy === "prefer-right" ? (b.kind === "value" ? "the right value" : "the left value") : a.kind === "value" ? "the left value" : b.kind === "value" ? "the right value" : "an empty cell";
  return { ...available({ kind: "identity.add", left, right, mergePolicy }, `${titleOfPort(L)} ≡ ${titleOfPort(R)}, starting from ${seed}`), cellsDiffer };
}

export function planIdentityRemove(linkId: string, splitPolicy: SplitPolicy, s: LinkSnapshot): LinkPlan {
  const declaration = s.identity.find((entry) => entry.linkId === linkId);
  if (!declaration) return unavailable("that identity link no longer exists", "link-missing");
  const L = s.ports.get(declaration.left);
  const R = s.ports.get(declaration.right);
  const names = `${L ? titleOfPort(L) : declaration.left} and ${R ? titleOfPort(R) : declaration.right}`;
  if (splitPolicy === "history" && !s.history.has(declaration.left) && !s.history.has(declaration.right)) {
    return unavailable(`${names} have no private history to restore`, "no-history");
  }
  const outcome = splitPolicy === "copy" ? "each keeps the shared value" : splitPolicy === "history" ? "each gets its pre-merge value back" : "both are cleared";
  return available({ kind: "identity.remove", linkId, splitPolicy }, `${names} part ways; ${outcome}`);
}

/** The relations legal from a source port's type into a destination port's type. */
export function legalRelations(source: PortId, destination: PortId, s: LinkSnapshot, deps: LinkDeps) {
  const S = s.ports.get(source);
  const D = s.ports.get(destination);
  if (!S || !D) return [];
  return (deps.relations ?? []).filter((relation) => {
    const sourceMatches =
      relation.match === "exact"
        ? S.declaration.contract.valueType === relation.from
        : reaches(S.declaration.contract.valueType, relation.from, deps.graph);
    return sourceMatches && canFlow(relation.to, D.declaration.contract, deps.graph).ok;
  });
}

/**
 * May `destination` derive from `source` through a relation (Phase 6)? With
 * `relationId` absent, one legal relation is chosen and several are an
 * ambiguity the palette resolves; none is a refusal that says so.
 */
export function planDerive(source: PortId, destination: PortId, relationId: string | undefined, s: LinkSnapshot, deps: LinkDeps): LinkPlan {
  const S = s.ports.get(source);
  const D = s.ports.get(destination);
  if (!S || !D) return unavailable("that port no longer exists", "port-missing");
  if (source === destination) return unavailable("a port cannot derive from itself", "self");
  if (S.declaration.direction === "in") return unavailable(`${titleOfPort(S)} is an input; only outputs can be derived from`, "direction");
  if (D.declaration.direction === "out") return unavailable(`${titleOfPort(D)} is an output`, "direction");
  const current = s.bindings.get(destination);
  if (current?.kind === "hold") return unavailable(`${titleOfPort(D)} is held; resume or detach it first`, "held");
  if (cellOf(destination, s)) return unavailable(`${titleOfPort(D)} shares the ${cellOf(destination, s)!.id} cell; leave the cell first`, "shared");
  const legal = legalRelations(source, destination, s, deps);
  if (legal.length === 0) {
    return unavailable(`no relation turns a <${S.declaration.contract.valueType}> into a <${D.declaration.contract.valueType}>`, "no-relation");
  }
  if (relationId) {
    const relation = legal.find((entry) => entry.id === relationId);
    if (!relation) return unavailable(`${relationId} does not relate <${S.declaration.contract.valueType}> to <${D.declaration.contract.valueType}>`, "relation");
    if (current?.kind === "derived" && current.relationId === relationId && sourcePortOf(current) === source) {
      return unavailable(`${titleOfPort(D)} already derives through ${relation.label ?? relation.id} from ${titleOfPort(S)}`, "already");
    }
    const verb = linkVerbs.derive(source, destination, relationId) as TermVerb;
    const checked = checkedCandidate(verb, destination, s, deps);
    if (checked) return checked;
    return available(verb, `${titleOfPort(D)} will derive through ${relation.label ?? relation.id} from ${titleOfPort(S)}`);
  }
  if (legal.length === 1) return planDerive(source, destination, legal[0]!.id, s, deps);
  return { kind: "ambiguous", options: legal.map((relation) => ({ verb: { kind: "port.derive", source, destination, relation: relation.id }, label: relation.label ?? relation.id })) };
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
