import { effectiveBinding, valueToHold } from "./evaluate";
import { findLink, planAmbient, planBind, planClear, planDetach, planFollow, planPin, planResume, planUnlink, type LinkPlan } from "./plan";
import type { LinkDeps, LinkSnapshot } from "./snapshot";
import { terms, type Binding } from "./terms";
import type { PortId } from "./types";
import type { LinkVerb } from "./verbs";

/*
 * The one semantic core (toy invariant #3): every link verb is a transition
 * on the explicit-bindings map, planned first and applied second. The shell's
 * handler builds a fresh snapshot, calls this, and writes the result as one
 * `documentPut`. Tests call it directly, which is how the laws of §6.3 are
 * checked without a document or a store.
 */

export type ApplyResult =
  | { readonly kind: "ok"; readonly bindings: ReadonlyMap<PortId, Binding>; readonly explanation: string }
  | { readonly kind: "refused"; readonly plan: Exclude<LinkPlan, { kind: "available" }> }
  | { readonly kind: "browser-local" };

export interface ApplyOptions {
  /** Mint a link id; the shell passes its `newId`, tests a counter. */
  newLinkId?(): string;
}

let counter = 0;
const defaultLinkId = () => `link-${(counter += 1)}`;

export function applyLinkVerb(verb: LinkVerb, s: LinkSnapshot, deps: LinkDeps, options: ApplyOptions = {}): ApplyResult {
  const next = new Map(s.bindings);
  const newLinkId = options.newLinkId ?? defaultLinkId;
  const refuse = (plan: LinkPlan): ApplyResult => (plan.kind === "available" ? { kind: "ok", bindings: next, explanation: plan.explanation } : { kind: "refused", plan });

  switch (verb.kind) {
    case "port.follow": {
      const plan = planFollow(verb.source, verb.destination, s, deps);
      if (plan.kind !== "available") return refuse(plan);
      next.set(verb.destination, terms.follow(verb.source, verb.linkId ?? newLinkId()));
      return { kind: "ok", bindings: next, explanation: plan.explanation };
    }
    case "port.bind": {
      const plan = planBind(verb.port, verb.reference, s, deps);
      if (plan.kind !== "available") return refuse(plan);
      next.set(verb.port, terms.constant(verb.reference));
      return { kind: "ok", bindings: next, explanation: plan.explanation };
    }
    case "port.ambient": {
      const plan = planAmbient(verb.port, verb.context, s, deps);
      if (plan.kind !== "available") return refuse(plan);
      const declared = s.ports.get(verb.port)?.declaration.fallbackContext;
      // The declared fallback is the absence of a term, not a term: writing
      // it would make "clear" and "ambient" two states that read the same.
      if (declared === verb.context) next.delete(verb.port);
      else next.set(verb.port, terms.ambient(verb.context));
      return { kind: "ok", bindings: next, explanation: plan.explanation };
    }
    case "port.pin": {
      const plan = planPin(verb.port, s, deps);
      if (plan.kind !== "available") return refuse(plan);
      const value = valueToHold(verb.port, s, deps);
      if (!value) return { kind: "refused", plan: { kind: "unavailable", because: "nothing to hold", code: "empty" } };
      next.set(verb.port, terms.hold(value, effectiveBinding(verb.port, s)));
      return { kind: "ok", bindings: next, explanation: plan.explanation };
    }
    case "port.resume": {
      const plan = planResume(verb.port, s);
      if (plan.kind !== "available") return refuse(plan);
      const held = s.bindings.get(verb.port);
      if (held?.kind !== "hold") return { kind: "refused", plan: { kind: "unavailable", because: "not held", code: "not-held" } };
      restore(next, verb.port, held.suspended, s);
      return { kind: "ok", bindings: next, explanation: plan.explanation };
    }
    case "port.detach": {
      const plan = planDetach(verb.port, s, deps);
      if (plan.kind !== "available") return refuse(plan);
      const held = s.bindings.get(verb.port);
      if (held?.kind !== "hold") return { kind: "refused", plan: { kind: "unavailable", because: "not held", code: "not-held" } };
      next.set(verb.port, terms.constant(held.reference));
      return { kind: "ok", bindings: next, explanation: plan.explanation };
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
      return { kind: "ok", bindings: next, explanation: plan.explanation };
    }
    case "port.clear": {
      const plan = planClear(verb.port, s);
      if (plan.kind !== "available") return refuse(plan);
      next.delete(verb.port);
      return { kind: "ok", bindings: next, explanation: plan.explanation };
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
 * read with no term at all (its declared fallback, or its document slot) is
 * restored as the ABSENCE of a term, so `resume(pin(port))` leaves the link
 * document exactly as it was.
 */
function restore(next: Map<PortId, Binding>, port: PortId, suspended: Binding, s: LinkSnapshot): void {
  const fallback = s.ports.get(port)?.declaration.fallbackContext;
  const slot = s.documentSlots.get(port);
  const redundant =
    suspended.kind === "ambient"
      ? suspended.key === fallback
      : suspended.kind === "constant"
        ? slot !== undefined && JSON.stringify(suspended.reference) === JSON.stringify(slot)
        : suspended.kind === "unresolved" && suspended.diagnostic.code === "unbound";
  if (redundant) next.delete(port);
  else next.set(port, suspended);
}
