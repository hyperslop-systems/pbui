import { defineApp, type AppDescriptor } from "@hyperslop-systems/pbui-workbench";
import { InventoryApp } from "./InventoryApp";
import { MetalsApp } from "./MetalsApp";
import { NOTE_BINDING, NotesApp, noteTitle } from "./NotesApp";
import { SKU_BINDING, SkuApp, skuTitle } from "./SkuApp";

/** The launcher group these four sit in, apart from the chat's agent machinery. */
export const SHOP_GROUP = "GOLD COIN SHOP";

/**
 * The gold-coin shop's own applications.
 *
 * They live here rather than in `@hyperslop-systems/pbui-chat` because they
 * are PRODUCT code: they know about SKUs, metals and reorder floors, and the
 * package stays domain-neutral (its README: no dependency on any product's
 * model types). A second product wanting an inventory tile wants a different
 * one.
 *
 * The four exist to exercise four DIFFERENT mechanisms, not to look busy.
 * Without them the agent's only placeable tiles are the chat's own debugger
 * panels, and "create a workspace with tiles X" degenerates into rearranging
 * the inspector:
 *
 *   inventory  duplicable data tile; rows are <product> presentations, so a
 *              tile the AGENT placed joins accept mode for free
 *   sku        doc-bound: openView with bindings, "identical bindings → go
 *              to the existing tile", titleFor(view)
 *   metals     singleton: the launcher offers "go to", and a split makes a
 *              LINKED placement rather than a second board
 *   notes      documentPut / documentDelete — the WorkbenchDocument.documents
 *              map, which nothing else in this product touches
 */
export function createDemoApps(): AppDescriptor[] {
  return [
    defineApp({
      id: "inventory",
      title: "inventory",
      tone: "var(--pbui-tone-product)",
      singleton: false,
      group: SHOP_GROUP,
      blurb: "the eight SKUs, filterable by metal and category",
      Component: InventoryApp,
    }),
    defineApp({
      id: "sku",
      title: "SKU",
      tone: "var(--pbui-tone-product)",
      singleton: false,
      docBound: true,
      // Declared so a caller can refuse `open a sku tile` with nothing bound
      // BEFORE placing it; an unbound doc-bound tile opens empty, which reads
      // as a broken tile rather than as a mistake in the request.
      bindings: [SKU_BINDING],
      // `false` because a split must LINK a second placement of this view
      // rather than mint a second detail tile for the same SKU — the same
      // rule `openView` enforces when the bindings are identical.
      duplicable: false,
      group: SHOP_GROUP,
      blurb: "one SKU: stock against its floor, 30-day sales, metal and category",
      titleFor: skuTitle,
      Component: SkuApp,
    }),
    defineApp({
      id: "metals",
      title: "metals",
      tone: "var(--pbui-tone-metal)",
      singleton: true,
      group: SHOP_GROUP,
      blurb: "spot prices and share of stock value",
      Component: MetalsApp,
    }),
    defineApp({
      id: "notes",
      title: "notes",
      tone: "var(--pbui-tone-neutral)",
      singleton: false,
      docBound: true,
      bindings: [NOTE_BINDING],
      duplicable: false,
      group: SHOP_GROUP,
      blurb: "a scratchpad kept in the workbench document itself",
      titleFor: noteTitle,
      Component: NotesApp,
    }),
  ];
}

export { NOTE_BINDING, SKU_BINDING };
