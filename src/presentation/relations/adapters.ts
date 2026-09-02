import type { Condition } from "../actions/conditions";
import type { RuntimeTypeId, ScopeId } from "../actions/ids";
import type { SelectionSnapshot } from "../actions/types";
import type { PresentationReference, PresentationValues } from "../types";
import type { PresentationRelation } from "./types";

/**
 * The pre-KERNEL-1 translator declaration (PBUI-ACTIONS-2 P6). Retained
 * ONLY for the legacy `createPbui` option bag until Phase 5 deletes both;
 * the canonical arrow is `PresentationRelation` with `exposure`.
 */
export interface PresentationTranslator<Values extends PresentationValues, ProductFacts> {
  id: string;
  from: RuntimeTypeId;
  to: RuntimeTypeId;
  match: "exact" | "subtypes";
  scopes?: readonly ScopeId[];
  when?: Condition;
  priority?: number;
  translate(
    reference: PresentationReference<Values>,
    snapshot: SelectionSnapshot<ProductFacts>,
  ): PresentationReference<Values> | undefined;
}

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
