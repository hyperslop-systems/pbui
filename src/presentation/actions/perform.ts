import type { PresentationValues } from "../types";
import type { PerformResult, ResolutionResult, ResolvedAction } from "./types";

/**
 * Fresh revalidation (PBUI-ACTIONS-2, source guide §18).
 *
 * A rendered menu is not durable authority: between render and click, modes
 * flip, capabilities change, generated actions come and go. Perform therefore
 * re-resolves against a fresh snapshot and delegates ONLY the fresh verb —
 * and only when the SAME candidate still wins its action partition. Matching
 * the action id alone would let a newly loaded, more-specific rule change
 * semantics after the user chose a row; that is refused instead.
 *
 * This module is the pure half: given the stale selection and the fresh
 * resolution, decide. The React glue (createPbui) builds the fresh snapshot,
 * calls the resolver, and delegates. Revalidation is NOT authorization —
 * state can change after it, agents may bypass menus, and product routers
 * and gateways stay the security boundary.
 */

export type FreshDecision<Values extends PresentationValues, Verb> =
  | { kind: "proceed"; verb: Verb; action: ResolvedAction<Values, Verb> }
  | Extract<PerformResult, { kind: "refused" }>;

export function evaluateFresh<Values extends PresentationValues, Verb>(
  stale: ResolvedAction<Values, Verb>,
  fresh: ResolutionResult<Values, Verb>,
): FreshDecision<Values, Verb> {
  if (fresh.ambiguities.some((ambiguity) => ambiguity.action === stale.action)) {
    return { kind: "refused", code: "action-became-ambiguous" };
  }
  const current = fresh.actions.find((candidate) => candidate.action === stale.action);
  if (!current) {
    return { kind: "refused", code: "action-no-longer-resolves" };
  }
  if (current.candidateId !== stale.candidateId) {
    return { kind: "refused", code: "action-implementation-changed" };
  }
  if (current.status.kind !== "available" || current.verb === undefined) {
    return {
      kind: "refused",
      code: "action-no-longer-available",
      ...(current.status.kind === "unavailable" ? { because: current.status.because } : {}),
    };
  }
  return { kind: "proceed", verb: current.verb, action: current };
}
