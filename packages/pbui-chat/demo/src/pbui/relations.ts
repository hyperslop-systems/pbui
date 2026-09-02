import type { PresentationReference, PresentationRelation } from "@hyperslop-systems/pbui";
import type { DemoFacts } from "./actions";
import type { RowValue, Values } from "./types";

/**
 * A table row that carries a product id may stand in for the product during
 * accept mode — the conversion the vocabulary declares as `row → product`.
 * Exported as the pure mapping the relation and the golden tests share.
 */
export function rowToProduct(reference: PresentationReference<Values>): PresentationReference<Values> | undefined {
  if (reference.type !== "row") return undefined;
  const row = reference.value.value as RowValue | undefined;
  const cells = row?.cells ?? {};
  const id = cells.productId ?? cells.product_id ?? cells.id;
  if (id === undefined || id === null || id === "") return undefined;
  const name = typeof cells.name === "string" ? cells.name : `product ${String(id)}`;
  return {
    type: "product",
    value: {
      type: "product",
      id: String(id),
      value: { name, ...(typeof cells.sku === "string" ? { sku: cells.sku } : {}) },
      provenance: reference.value.provenance,
    },
  };
}

/** Frozen by tests (PBUI-ACTIONS-2 P0). */
export const demoConversions = [rowToProduct] as const;

/** The same conversion as the canonical relation the compiled presentation declares (PBUI-KERNEL-1 C5). */
export const demoRelations: readonly PresentationRelation<Values, DemoFacts>[] = [
  {
    id: "demo.row-to-product",
    from: "row",
    to: "product",
    match: "exact",
    exposure: { acceptance: true },
    apply: (reference) => rowToProduct(reference),
  },
];
