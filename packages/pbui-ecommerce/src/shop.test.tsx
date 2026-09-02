import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { describeWorkbench, split, tile } from "@hyperslop-systems/pbui-workbench";
import { APP_IDS, createShopApps } from "./apps";
import { createShop, createShopWorkbench } from "./createShop";
import { listPlotDocuments, readTableName, tableDocumentId } from "./document";
import { TABLES } from "./host";
import { seedShopDocument } from "./seed";
import { ShopShell } from "./ShopShell";

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

describe("the seeded document", () => {
  it("holds four scenes, three plots and every table as payloads", () => {
    const doc = seedShopDocument();
    expect(doc.workspaces.map((workspace) => workspace.name)).toEqual(["orders", "customers", "sales", "catalog"]);
    expect(listPlotDocuments(doc).map((plot) => plot.id)).toEqual(["revenue-by-day", "revenue-by-category", "orders-by-status"]);
    for (const table of TABLES) expect(readTableName(doc, tableDocumentId(table))).toBe(table);
  });

  it("round-trips through serialize/restore with the payloads intact", () => {
    const shop = createShop();
    const wb = createShopWorkbench(shop);
    const json = wb.serialize();
    const again = createShopWorkbench(shop);
    expect(again.restore(json)).toBe(true);
    expect(listPlotDocuments(again.store.getState().document)).toHaveLength(3);
  });
});

describe("the applications", () => {
  it("declare their ports, and describeWorkbench reports them", () => {
    const shop = createShop();
    const apps = createShopApps(shop);
    expect(apps.map((app) => app.id)).toEqual(Object.values(APP_IDS));
    const wb = createShopWorkbench(shop);
    const description = describeWorkbench(wb);
    const byId = new Map(description.apps.map((app) => [app.id, app]));
    expect(byId.get("orders")?.ports?.map((port) => `${port.direction} ${port.name}:${port.valueType}`)).toEqual(["out order:order", "inout selection:datum", "in filter:category"]);
    expect(byId.get("order-detail")?.ports?.[0]).toMatchObject({ name: "order", direction: "in", valueType: "order", role: "order.detail", fallbackContext: "workspace.order" });
    expect(byId.get("inspector")?.ports?.[0]?.valueType).toBe("inspectable");
    // Only the plot is doc-bound; the two slots are its first two ports.
    expect(description.apps.filter((app) => app.docBound).map((app) => app.id)).toEqual(["plot"]);
    expect(byId.get("plot")?.bindings).toEqual(["plot", "table"]);
    // The description is JSON, like everything an agent reads.
    expect(JSON.parse(JSON.stringify(description))).toEqual(description);
  });
});

describe("the shell renders the seeded workbench", () => {
  it("shows the orders table with every order as a presentation, and the details waiting", () => {
    const shop = createShop();
    const wb = createShopWorkbench(shop);
    render(<ShopShell shop={shop} workbench={wb} />);
    expect(document.querySelectorAll('[data-part="orders-table"] tbody tr')).toHaveLength(65);
    expect(document.querySelectorAll('[data-part="orders-table"] [data-ptype="order"]')).toHaveLength(65);
    expect(screen.getByText("no order yet")).toBeTruthy();
    expect(screen.getByText("nothing inspected yet")).toBeTruthy();
  });

  it("draws a plot tile over its table document", async () => {
    const shop = createShop();
    const wb = createShopWorkbench(shop, {
      initial: seedShopDocument({ spec: split("row", 0.5, tile(APP_IDS.products), tile(APP_IDS.plot, { documents: { plot: "orders-by-status", table: tableDocumentId("orders") } })) }),
    });
    render(<ShopShell shop={shop} workbench={wb} />);
    expect(await screen.findByText("65 rows of orders")).toBeTruthy();
    expect(document.querySelectorAll('[data-part="product-catalog"] [data-ptype="product"]')).toHaveLength(8);
    expect(document.querySelectorAll('[data-part="product-catalog"] [data-ptype="category"]')).toHaveLength(8);
  });
});
