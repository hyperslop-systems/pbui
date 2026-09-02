import {
  definePredicate,
  type ProductPredicate,
} from "../actions/conditions";
import { defineActions } from "../actions/define";
import type { PredicateId } from "../actions/ids";
import { defineHelp } from "../help/define";
import { defineRelations } from "../relations/define";
import type { PresentationValues } from "../types";
import { createPresentationKernel } from "./create";
import { SNAPSHOT_INPUT } from "./types";
import type {
  PresentationKernelDeclaration,
  SnapshotInput,
  SnapshotOptions,
} from "./types";

/** Thread the product's four generic parameters once. */
export function definePresentation<
  Values extends PresentationValues,
  Environment,
  ProductFacts,
  Verb,
>() {
  return {
    actions: defineActions<Values, ProductFacts, Verb>(),
    help: defineHelp<Values, ProductFacts>(),
    relations: defineRelations<Values, ProductFacts>(),
    predicate(
      id: PredicateId,
      evaluate: ProductPredicate<Values, ProductFacts>,
    ) {
      return definePredicate(id, evaluate);
    },
    snapshotInput(
      facts: ProductFacts,
      options?: SnapshotOptions,
    ): SnapshotInput<ProductFacts> {
      return {
        [SNAPSHOT_INPUT]: true,
        facts,
        options: options ?? {},
      };
    },
    kernel(
      declaration: PresentationKernelDeclaration<
        Values,
        Environment,
        ProductFacts,
        Verb
      >,
    ) {
      return createPresentationKernel(declaration);
    },
  };
}
