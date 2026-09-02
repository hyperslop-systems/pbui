import { definePredicate } from "../actions/conditions";
import type { PredicateDefinition, ProductPredicate } from "../actions/conditions";
import { defineActions } from "../actions/define";
import type { PredicateId } from "../actions/ids";
import { defineHelp } from "../help/define";
import type {
  ComposedPresentationRelation,
  PresentationRelation,
} from "../relations/types";
import type { PresentationValues } from "../types";
import { compilePresentation } from "./compile";
import type {
  CompiledPresentation,
  PresentationDeclaration,
  PresentationFragment,
} from "./types";

/**
 * The typed authoring entry point (PBUI-KERNEL-1 §7.1). Thread the product's
 * four generic parameters once and receive typed helpers plus exactly one
 * compiler method:
 *
 *     const p = definePresentation<Values, Environment, Facts, Verb>();
 *     const shop = p.fragment({ id: "shop", types, descriptors, actions });
 *     export const presentation = p.create({
 *       id: "shop.presentation",
 *       include: [workbenchFragment, shop],
 *       defaultActiveScopes: ["shop", "global"],
 *       revision: facts => facts.revision,
 *     });
 *
 * `create` is the only public construction path; `compilePresentation` is
 * the lower-level function it calls.
 */
export interface PresentationDefinitionTools<
  Values extends PresentationValues,
  Environment,
  ProductFacts,
  Verb,
> {
  readonly actions: ReturnType<typeof defineActions<Values, ProductFacts, Verb>>;
  readonly help: ReturnType<typeof defineHelp<Values, ProductFacts>>;
  predicate(
    id: PredicateId,
    evaluate: ProductPredicate<Values, ProductFacts>,
  ): PredicateDefinition<Values, ProductFacts>;
  relation(
    input: PresentationRelation<Values, ProductFacts>,
  ): PresentationRelation<Values, ProductFacts>;
  composition(input: ComposedPresentationRelation): ComposedPresentationRelation;
  fragment(
    input: PresentationFragment<Values, Environment, ProductFacts, Verb>,
  ): PresentationFragment<Values, Environment, ProductFacts, Verb>;
  create(
    input: PresentationDeclaration<Values, Environment, ProductFacts, Verb>,
  ): CompiledPresentation<Values, Environment, ProductFacts, Verb>;
}

export function definePresentation<
  Values extends PresentationValues,
  Environment,
  ProductFacts,
  Verb,
>(): PresentationDefinitionTools<Values, Environment, ProductFacts, Verb> {
  return {
    actions: defineActions<Values, ProductFacts, Verb>(),
    help: defineHelp<Values, ProductFacts>(),
    predicate: (id, evaluate) => definePredicate(id, evaluate),
    relation: (input) => input,
    composition: (input) => input,
    fragment: (input) => input,
    create: (input) => compilePresentation(input),
  };
}
