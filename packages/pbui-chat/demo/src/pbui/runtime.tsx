import { createPbui, type PresentationReference } from "@hyperslop-systems/pbui";
import { demoActionRegistry, snapshotForDemo } from "./actions";
import type { DemoFacts } from "./actions";
import { registry } from "./registry";
import { DEFAULT_ENVIRONMENT, type Environment, type RowValue, type Values } from "./types";
import type { Verb } from "./verbs";

/**
 * A table row that carries a product id may stand in for the product during
 * accept mode — the conversion the vocabulary declares as `row → product`.
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

/** Frozen by tests (PBUI-ACTIONS-2 P0) before typed translators replace this. */
export const demoConversions = [rowToProduct] as const;

/** PBUI-ACTIONS-2 P6: the same conversion as a typed translator. */
export const demoTranslators = [
  {
    id: "demo.row-to-product",
    from: "row",
    to: "product",
    match: "exact",
    translate: (reference: PresentationReference<Values>) => rowToProduct(reference),
  },
] as const;

export const pbui = createPbui<Values, Environment, Verb, DemoFacts>({
  registry,
  defaultEnvironment: DEFAULT_ENVIRONMENT,
  // PBUI-ACTIONS-2 P4: all nineteen types resolve through the kernel.
  actions: demoActionRegistry,
  snapshotFor: snapshotForDemo,
  translators: demoTranslators,
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
