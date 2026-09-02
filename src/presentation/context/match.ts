import { evaluateCondition } from "../actions/conditions";
import type { ProductPredicate } from "../actions/conditions";
import type { PredicateId, ScopeId } from "../actions/ids";
import type { PresentationTypeGraph } from "../actions/typeGraph";
import type { PresentationReference, PresentationValues } from "../types";
import type { RuntimeTypeId } from "../actions/ids";
import type { SelectionSnapshot } from "../actions/types";
import type { ContextMatchResult, PresentationSelector } from "./types";

/**
 * The shared contextual matcher (PBUI-HELP-001, design doc §6.1) — the front
 * half of `resolveActions`, extracted so the help kernel can reuse type
 * reachability, scope nearness, and condition evaluation without duplicating
 * them. Pure: one target, one subject, one snapshot in; a match with
 * provenance or a staged rejection out. No React, no effects, no trace —
 * emitting trace entries stays with each caller, because the two kernels
 * trace differently.
 *
 * Stage order is type → scope → condition, and it is load-bearing for the
 * action caller, which interleaves its invocation filter between the type and
 * scope stages by inspecting the rejection stage (see resolve.ts).
 */

/**
 * The nearest ACTIVE declared scope: lowest index in the snapshot's
 * inner-to-outer stack among the target's declared scopes, or null when none
 * is active. Exported for the action resolver's `"*"` family targets, which
 * bypass type matching entirely and are not expressible as a ContextTarget.
 */
export function activeScope(
  declared: readonly ScopeId[],
  stack: readonly ScopeId[],
): { scope: ScopeId; index: number } | null {
  let best: { scope: ScopeId; index: number } | null = null;
  for (const scope of declared) {
    const index = stack.indexOf(scope);
    if (index >= 0 && (best === null || index < best.index)) best = { scope, index };
  }
  return best;
}

export function matchSelector<Values extends PresentationValues, ProductFacts>(
  target: PresentationSelector,
  subject: PresentationReference<Values>,
  snapshot: SelectionSnapshot<ProductFacts>,
  graph: PresentationTypeGraph,
  predicates: ReadonlyMap<PredicateId, ProductPredicate<Values, ProductFacts>>,
): ContextMatchResult {
  const concreteType = subject.type as RuntimeTypeId;

  /* type ------------------------------------------------------------------ */

  let typeDistance: number;
  if (target.match === "exact") {
    if (target.subject !== concreteType) {
      return {
        kind: "rejected",
        stage: "type",
        reason: `exact target "${target.subject}" does not match concrete type "${concreteType}"`,
      };
    }
    typeDistance = 0;
  } else {
    const distance = graph.distance(concreteType, target.subject);
    if (!Number.isFinite(distance)) {
      return {
        kind: "rejected",
        stage: "type",
        reason: `"${target.subject}" is not an ancestor of concrete type "${concreteType}"`,
      };
    }
    typeDistance = distance;
  }

  /* scope ----------------------------------------------------------------- */

  const scope =
    target.scopes.length === 0
      ? { scope: snapshot.scopes[0] ?? "__unscoped__", index: 0 }
      : activeScope(target.scopes, snapshot.scopes);
  if (scope === null) {
    return { kind: "rejected", stage: "scope", reason: "no-active-scope" };
  }

  /* condition ------------------------------------------------------------- */

  if (target.when) {
    const status = evaluateCondition(
      target.when,
      { subject, snapshot },
      predicates,
    );
    if (status.kind !== "available") {
      return {
        kind: "rejected",
        stage: "condition",
        reason: status.kind === "unavailable" ? status.because : status.kind,
      };
    }
  }

  return {
    kind: "matched",
    match: {
      declaredType: target.subject,
      concreteType,
      typeDistance,
      scope: scope.scope,
      scopeIndex: scope.index,
      priority: target.priority ?? 0,
    },
  };
}

/** Compatibility name retained for existing action/help integrations. */
export const matchContext = matchSelector;
