import { createPbui, type PresentationReference } from "@hyperslop-systems/pbui";
import { registry } from "./registry";
import { DEFAULT_ENVIRONMENT, type Environment, type RowValue, type Values } from "./types";
import type { Verb } from "./verbs";

/**
 * A table row that carries a product id may stand in for the product during
 * accept mode — the conversion the vocabulary declares as `row → product`.
 */
function rowToProduct(reference: PresentationReference<Values>): PresentationReference<Values> | undefined {
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

export const pbui = createPbui<Values, Environment, Verb>({
  registry,
  defaultEnvironment: DEFAULT_ENVIRONMENT,
  conversions: [rowToProduct],
  renderMenuHeader: (reference, _environment, label) => (
    <>
      &lt;{reference.type}&gt; {label}
      <span data-part="menu-target"> · {reference.value.id}</span>
    </>
  ),
});

export const PbuiProvider = pbui.Provider;
export const Presentation = pbui.Presentation;
export const ObjectMenu = pbui.ObjectMenu;
export const MouseDocLine = pbui.MouseDocLine;
export const AcceptBanner = pbui.AcceptBanner;
export const usePbui = pbui.usePbui;
