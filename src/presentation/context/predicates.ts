import { referencedPredicates } from "../actions/conditions";
import type {
  Condition,
  PredicateDefinition,
  ProductPredicate,
} from "../actions/conditions";
import type { PredicateId } from "../actions/ids";
import type { PresentationValues } from "../types";

/** The canonical predicate table shared by every contextual interpreter. */
export type PredicateRegistry<
  Values extends PresentationValues,
  ProductFacts,
> = ReadonlyMap<PredicateId, ProductPredicate<Values, ProductFacts>>;

export function createPredicateRegistry<
  Values extends PresentationValues,
  ProductFacts,
>(
  definitions: readonly PredicateDefinition<Values, ProductFacts>[] = [],
): PredicateRegistry<Values, ProductFacts> {
  const predicates = new Map<
    PredicateId,
    ProductPredicate<Values, ProductFacts>
  >();
  for (const definition of definitions) {
    if (predicates.has(definition.id)) {
      throw new Error(`duplicate predicate id "${definition.id}"`);
    }
    predicates.set(definition.id, definition.evaluate);
  }
  return predicates;
}

/** Registration-time validation with an owner-specific diagnostic. */
export function validateConditionPredicates<
  Values extends PresentationValues,
  ProductFacts,
>(
  owner: string,
  condition: Condition | undefined,
  predicates: PredicateRegistry<Values, ProductFacts>,
): void {
  for (const id of condition ? referencedPredicates(condition) : []) {
    if (!predicates.has(id)) {
      throw new Error(`${owner} references unknown predicate "${id}"`);
    }
  }
}
