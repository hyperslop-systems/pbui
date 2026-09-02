import { effectiveBinding, evaluatePort, valueToHold } from "./evaluate";
import { compileIdentity, type IdentityDeclaration } from "./identity";
import { findLink, planAmbient, planBind, planClear, planDetach, planFollow, planIdentityAdd, planIdentityRemove, planPin, planResume, planUnlink, type LinkPlan } from "./plan";
import type { LinkDeps, LinkSnapshot, LinkState } from "./snapshot";
import { terms, type Binding, type SerializableReference } from "./terms";
import type { PortId } from "./types";
import type { LinkVerb } from "./verbs";

/*
 * The one semantic core (toy invariant #3): every link verb is a transition
 * on the link STATE (terms; and since Phase 5 identity declarations, their
 * compiled classes and the pre-merge history), planned first and applied
 * second. The shell's handler builds a fresh snapshot, calls this, writes the
 * state as one `documentPut` and applies the runtime EFFECTS (class cells
 * seeded on merge, private values restored on split). Tests call it
 * directly, which is how the laws of §6.3 are checked without a document.
 */

export type RuntimeEffect =
  | { readonly kind: "seed-class"; readonly classId: string; readonly reference: SerializableReference | null }
  | { readonly kind: "set-emitted"; readonly port: PortId; readonly reference: SerializableReference | null }
  | { readonly kind: "forget-class"; readonly classId: string };

export type ApplyResult =
  | {
      readonly kind: "ok";
      /** The next explicit terms — `state.bindings`, kept here for the callers that only read terms. */
      readonly bindings: ReadonlyMap<PortId, Binding>;
      readonly state: LinkState;
      readonly effects: readonly RuntimeEffect[];
      readonly explanation: string;
    }
  | { readonly kind: "refused"; readonly plan: Exclude<LinkPlan, { kind: "available" }> }
  | { readonly kind: "browser-local" };

export interface ApplyOptions {
  /** Mint a link id; the shell passes its `newId`, tests a counter. */
  newLinkId?(): string;
}

let counter = 0;
const defaultLinkId = () => `link-${(counter += 1)}`;

function ok(s: LinkSnapshot, bindings: Map<PortId, Binding>, explanation: string, patch: Partial<LinkState> = {}, effects: RuntimeEffect[] = []): ApplyResult {
  const state: LinkState = { identity: s.identity, classes: [...s.classes.values()], history: s.history, ...patch, bindings };
  return { kind: "ok", bindings, state, effects, explanation };
}

export function applyLinkVerb(verb: LinkVerb, s: LinkSnapshot, deps: LinkDeps, options: ApplyOptions = {}): ApplyResult {
  const next = new Map(s.bindings);
  const newLinkId = options.newLinkId ?? defaultLinkId;
  const refuse = (plan: LinkPlan): ApplyResult => (plan.kind === "available" ? ok(s, next, plan.explanation) : { kind: "refused", plan });

  switch (verb.kind) {
    case "port.follow": {
      const plan = planFollow(verb.source, verb.destination, s, deps);
      if (plan.kind !== "available") return refuse(plan);
      next.set(verb.destination, terms.follow(verb.source, verb.linkId ?? newLinkId()));
      return ok(s, next, plan.explanation);
    }
    case "port.bind": {
      const plan = planBind(verb.port, verb.reference, s, deps);
      if (plan.kind !== "available") return refuse(plan);
      next.set(verb.port, terms.constant(verb.reference));
      return ok(s, next, plan.explanation);
    }
    case "port.ambient": {
      const plan = planAmbient(verb.port, verb.context, s, deps);
      if (plan.kind !== "available") return refuse(plan);
      const declared = s.ports.get(verb.port)?.declaration.fallbackContext;
      // The declared fallback is the absence of a term, not a term: writing
      // it would make "clear" and "ambient" two states that read the same.
      if (declared === verb.context) next.delete(verb.port);
      else next.set(verb.port, terms.ambient(verb.context));
      return ok(s, next, plan.explanation);
    }
    case "port.pin": {
      const plan = planPin(verb.port, s, deps);
      if (plan.kind !== "available") return refuse(plan);
      const value = valueToHold(verb.port, s, deps);
      if (!value) return { kind: "refused", plan: { kind: "unavailable", because: "nothing to hold", code: "empty" } };
      next.set(verb.port, terms.hold(value, effectiveBinding(verb.port, s)));
      return ok(s, next, plan.explanation);
    }
    case "port.resume": {
      const plan = planResume(verb.port, s);
      if (plan.kind !== "available") return refuse(plan);
      const held = s.bindings.get(verb.port);
      if (held?.kind !== "hold") return { kind: "refused", plan: { kind: "unavailable", because: "not held", code: "not-held" } };
      restore(next, verb.port, held.suspended, s);
      return ok(s, next, plan.explanation);
    }
    case "port.detach": {
      const plan = planDetach(verb.port, s, deps);
      if (plan.kind !== "available") return refuse(plan);
      const held = s.bindings.get(verb.port);
      if (held?.kind !== "hold") return { kind: "refused", plan: { kind: "unavailable", because: "not held", code: "not-held" } };
      next.set(verb.port, terms.constant(held.reference));
      return ok(s, next, plan.explanation);
    }
    case "port.unlink": {
      const plan = planUnlink(verb.linkId, verb.policy, s, deps);
      if (plan.kind !== "available") return refuse(plan);
      const found = findLink(verb.linkId, s);
      if (!found) return { kind: "refused", plan: { kind: "unavailable", because: "no such link", code: "link-missing" } };
      switch (verb.policy) {
        case "freeze": {
          const value = valueToHold(found.port, s, deps);
          if (!value) return { kind: "refused", plan: { kind: "unavailable", because: "nothing to keep", code: "empty" } };
          next.set(found.port, terms.hold(value, terms.unresolved("unlinked", "the link was cut; there is no source to resume")));
          break;
        }
        case "clear":
          next.set(found.port, terms.unresolved("unlinked", "the link was cut"));
          break;
        case "ambient":
          next.delete(found.port);
          break;
      }
      return ok(s, next, plan.explanation);
    }
    case "port.clear": {
      const plan = planClear(verb.port, s);
      if (plan.kind !== "available") return refuse(plan);
      next.delete(verb.port);
      return ok(s, next, plan.explanation);
    }
    case "identity.add": {
      const plan = planIdentityAdd(verb.left, verb.right, verb.mergePolicy, s, deps);
      if (plan.kind !== "available") return refuse(plan);
      const declaration: IdentityDeclaration = { linkId: verb.linkId ?? newLinkId(), left: verb.left, right: verb.right, mergePolicy: verb.mergePolicy };
      const identity = [...s.identity, declaration];
      const compiled = compileIdentity(identity, s.ports, [...s.classes.values()]);
      // The merged class starts from the value the policy prefers; each NEW member's private value is kept for "history".
      const a = evaluatePort(verb.left, s, deps);
      const b = evaluatePort(verb.right, s, deps);
      const preferRight = verb.mergePolicy === "prefer-right";
      const seed = preferRight ? (b.kind === "value" ? b.reference : a.kind === "value" ? a.reference : null) : a.kind === "value" ? a.reference : b.kind === "value" ? b.reference : null;
      const history = new Map(s.history);
      for (const [port, evaluation] of [[verb.left, a], [verb.right, b]] as const) {
        if (!s.aliases.has(port) && !history.has(port)) history.set(port, evaluation.kind === "value" ? evaluation.reference : null);
      }
      const classId = compiled.aliases.get(verb.left) ?? compiled.aliases.get(verb.right);
      const effects: RuntimeEffect[] = classId ? [{ kind: "seed-class", classId, reference: seed }] : [];
      return ok(s, next, plan.explanation, { identity, classes: compiled.classes, history }, effects);
    }
    case "identity.remove": {
      const plan = planIdentityRemove(verb.linkId, verb.splitPolicy, s);
      if (plan.kind !== "available") return refuse(plan);
      const identity = s.identity.filter((entry) => entry.linkId !== verb.linkId);
      const compiled = compileIdentity(identity, s.ports, [...s.classes.values()]);
      const history = new Map(s.history);
      const effects: RuntimeEffect[] = [];
      // Every port that left its class is a fragment to initialise by the split policy.
      for (const [port, before] of s.aliases) {
        if (compiled.aliases.get(port) === before) continue;
        const shared = s.values.classCell?.(before) ?? null;
        if (!compiled.aliases.has(port)) {
          const value = verb.splitPolicy === "copy" ? shared : verb.splitPolicy === "history" ? (history.get(port) ?? null) : null;
          effects.push({ kind: "set-emitted", port, reference: value });
          history.delete(port);
        }
      }
      for (const cls of s.classes.values()) {
        if (!compiled.classes.some((c) => c.id === cls.id)) effects.push({ kind: "forget-class", classId: cls.id });
      }
      // A class that survives under a new id keeps the shared value.
      for (const cls of compiled.classes) {
        if (!s.classes.has(cls.id)) {
          const from = [...s.classes.values()].find((old) => old.members.some((m) => cls.members.includes(m)));
          effects.push({ kind: "seed-class", classId: cls.id, reference: from ? (s.values.classCell?.(from.id) ?? null) : null });
        }
      }
      return ok(s, next, plan.explanation, { identity, classes: compiled.classes, history }, effects);
    }
    case "link.mode.open":
    case "link.mode.close":
      return { kind: "browser-local" };
    case "show":
      // Resolved by the shell (it needs placements and the app registry); never a bare transition.
      return { kind: "refused", plan: { kind: "unavailable", because: "show is resolved by the workbench, not applied as a term", code: "shell-handled" } };
  }
}

/**
 * Put a suspended term back. A suspended term equal to what the port would
 * read with no term at all (its declared fallback, its document slot, or its
 * class) is restored as the ABSENCE of a term, so `resume(pin(port))` leaves
 * the link document exactly as it was.
 */
function restore(next: Map<PortId, Binding>, port: PortId, suspended: Binding, s: LinkSnapshot): void {
  const fallback = s.ports.get(port)?.declaration.fallbackContext;
  const slot = s.documentSlots.get(port);
  const redundant =
    suspended.kind === "ambient"
      ? suspended.key === fallback
      : suspended.kind === "constant"
        ? slot !== undefined && JSON.stringify(suspended.reference) === JSON.stringify(slot)
        : suspended.kind === "alias"
          ? s.aliases.get(port) === suspended.classId
          : suspended.kind === "unresolved" && suspended.diagnostic.code === "unbound";
  if (redundant) next.delete(port);
  else next.set(port, suspended);
}
