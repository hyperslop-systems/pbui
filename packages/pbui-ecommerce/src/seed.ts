import { layout, split, tile, workspaces, type LayoutSpec } from "@hyperslop-systems/workbench-core";
import type { WorkbenchDocument } from "@hyperslop-systems/workbench-protocol";
import { applyMutations } from "@hyperslop-systems/workbench-protocol/client";
import { APP_IDS } from "./apps";
import { PLOT_SLOT, TABLE_SLOT, plotDocumentMutation, tableDocumentId, tableDocumentMutation } from "./document";
import { TABLES } from "./host";
import { ORDERS_BY_STATUS, REVENUE_BY_CATEGORY, REVENUE_BY_DAY, SEEDED_PLOTS, type SeededPlot } from "./plots/documents";

/*
 * The seeded workbench: four workspaces that are the demo's scenes in the
 * order the guide's §11.1 lists them, plus every plot and every table as a
 * DocumentPayload. `serialize()` round-trips all of it.
 */

export const SEED_DOCUMENT_ID = "pbui-ecommerce";
export const SEED_DOCUMENT_NAME = "Gold Coin Shop";

/** A plot tile spec over one seeded plot. */
export function plotTile(seeded: SeededPlot): LayoutSpec {
  return tile(APP_IDS.plot, { documents: { [PLOT_SLOT]: seeded.document.id, [TABLE_SLOT]: tableDocumentId(seeded.table) } });
}

export interface SeedOptions {
  /** One workspace with this layout instead of the four scenes. */
  spec?: LayoutSpec;
}

export function seedShopDocument(options: SeedOptions = {}): WorkbenchDocument {
  const doc = options.spec
    ? layout(options.spec, { id: SEED_DOCUMENT_ID, name: SEED_DOCUMENT_NAME, workspaceId: "ws-story", workspaceName: "story" })
    : workspaces(
        [
          {
            id: "ws-orders",
            name: "orders",
            spec: split("row", 0.58, tile(APP_IDS.orders), split("col", 0.55, tile(APP_IDS.orderDetail), tile(APP_IDS.inspector))),
          },
          {
            id: "ws-customers",
            name: "customers",
            spec: split("row", 0.5, tile(APP_IDS.customers), split("col", 0.5, tile(APP_IDS.customerDetail), tile(APP_IDS.orders))),
          },
          {
            id: "ws-sales",
            name: "sales",
            spec: split("row", 0.5, plotTile(REVENUE_BY_DAY), split("col", 0.5, plotTile(REVENUE_BY_CATEGORY), plotTile(ORDERS_BY_STATUS))),
          },
          {
            id: "ws-catalog",
            name: "catalog",
            spec: split("row", 0.55, tile(APP_IDS.products), tile(APP_IDS.orders)),
          },
        ],
        { id: SEED_DOCUMENT_ID, name: SEED_DOCUMENT_NAME },
      );
  return applyMutations(doc, [...SEEDED_PLOTS.map((seeded) => plotDocumentMutation(seeded.document)), ...TABLES.map(tableDocumentMutation)]);
}
