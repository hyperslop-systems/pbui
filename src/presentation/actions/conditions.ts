import type { PresentationValues } from "../types";
import { available } from "./availability";
import type { Availability, Failure } from "./availability";
import type { ModeId, PredicateId } from "./ids";
import type { InheritedRuleContext } from "./types";

/**
 * The minimal condition algebra (PBUI-ACTIONS-2, source guide §11).
 *
 * Deliberately four operations and no more: `all`, `mode`, `capability`,
 * `predicate`. No generic `not`, no arbitrary `any`, no expressions, no
 * embedded syntax — named product predicates are the escape hatch, and every
 * new operation must be justified by a real repository interaction (invariant
 * 18). `all` short-circuits to the FIRST non-available child, which enforces
 * one dominating, actionable reason instead of a condition dump; authors
 * place the most actionable reason first.
 *
 * Everything fails closed: an unknown predicate id or condition operation
 * throws — it never defaults to available.
 */

export type Condition =
  | { op: "all"; conditions: readonly Condition[] }
  | { op: "mode"; id: ModeId; active: boolean; onFail: Failure }
  | { op: "capability"; id: string; onFail: Failure }
  | { op: "predicate"; id: PredicateId };

/* ------------------------------------------------------------- factories --- */

export function all(...conditions: readonly Condition[]): Condition {
  return { op: "all", conditions };
}

/** Requires the mode to be ON. */
export function modeOn(id: ModeId, onFail: Failure): Condition {
  return { op: "mode", id, active: true, onFail };
}

/** Requires the mode to be OFF. */
export function modeOff(id: ModeId, onFail: Failure): Condition {
  return { op: "mode", id, active: false, onFail };
}

export function capability(id: string, onFail: Failure): Condition {
  return { op: "capability", id, onFail };
}

export function predicate(id: PredicateId): Condition {
  return { op: "predicate", id };
}

/* ------------------------------------------------------------ predicates --- */

/**
 * Named predicates are pure, registered by stable id, return full
 * `Availability` (not boolean), and are the ONLY condition nodes that read
 * `snapshot.product`.
 */
export type ProductPredicate<Values extends PresentationValues, ProductFacts> = (
  context: InheritedRuleContext<Values, ProductFacts>,
) => Availability;

export interface PredicateDefinition<Values extends PresentationValues, ProductFacts> {
  id: PredicateId;
  evaluate: ProductPredicate<Values, ProductFacts>;
}

export function definePredicate<Values extends PresentationValues, ProductFacts>(
  id: PredicateId,
  evaluate: ProductPredicate<Values, ProductFacts>,
): PredicateDefinition<Values, ProductFacts> {
  return { id, evaluate };
}

/* ------------------------------------------------------------- validation -- */

/** Every predicate id a condition tree references, for registration checks. */
export function referencedPredicates(condition: Condition): readonly PredicateId[] {
  switch (condition.op) {
    case "all":
      return condition.conditions.flatMap(referencedPredicates);
    case "predicate":
      return [condition.id];
    case "mode":
    case "capability":
      return [];
  }
}

/* ------------------------------------------------------------- evaluation -- */

export function evaluateCondition<Values extends PresentationValues, ProductFacts>(
  condition: Condition,
  context: InheritedRuleContext<Values, ProductFacts>,
  predicates: ReadonlyMap<PredicateId, ProductPredicate<Values, ProductFacts>>,
): Availability {
  switch (condition.op) {
    case "all": {
      for (const child of condition.conditions) {
        const result = evaluateCondition(child, context, predicates);
        if (result.kind !== "available") return result;
      }
      return available();
    }
    case "mode": {
      const active = context.snapshot.modes.has(condition.id);
      return active === condition.active ? available() : condition.onFail;
    }
    case "capability": {
      return context.snapshot.capabilities.has(condition.id)
        ? available()
        : condition.onFail;
    }
    case "predicate": {
      const found = predicates.get(condition.id);
      if (!found) {
        // Fail closed. Registration validates predicate references, so this
        // is defense in depth against a registry assembled by hand.
        throw new Error(
          `unknown predicate "${condition.id}" — conditions never default to available`,
        );
      }
      return found(context);
    }
  }
}
