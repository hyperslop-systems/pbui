import type { PresentationValues } from "../types";
import type { PresentationTranslator } from "../translators/types";
import type { PresentationRelation } from "./types";

/** Compatibility adapter for the pre-kernel translator declaration. */
export function relationFromTranslator<
  Values extends PresentationValues,
  ProductFacts,
>(
  translator: PresentationTranslator<Values, ProductFacts>,
): PresentationRelation<Values, ProductFacts> {
  return {
    id: translator.id,
    from: translator.from,
    to: translator.to,
    match: translator.match,
    ...(translator.scopes ? { scopes: translator.scopes } : {}),
    ...(translator.when ? { when: translator.when } : {}),
    ...(translator.priority !== undefined
      ? { priority: translator.priority }
      : {}),
    // A translator was only ever an acceptance edge.
    exposure: { acceptance: true },
    apply: translator.translate,
  };
}
