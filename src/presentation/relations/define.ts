import type { PresentationValues } from "../types";
import type {
  ComposedPresentationRelation,
  PresentationRelation,
} from "./types";

/** Pre-typed factories. Composition is explicit and therefore bounded. */
export function defineRelations<
  Values extends PresentationValues,
  ProductFacts,
>() {
  return {
    direct(
      relation: PresentationRelation<Values, ProductFacts>,
    ): PresentationRelation<Values, ProductFacts> {
      return relation;
    },
    compose(
      relation: ComposedPresentationRelation,
    ): ComposedPresentationRelation {
      return relation;
    },
  };
}
