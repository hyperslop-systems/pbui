import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { linkVerbs, planIdentityAdd, portId } from "@hyperslop-systems/pbui";
import { LINKS_DOC_ID, bindingsOf, commands, split, tile } from "@hyperslop-systems/workbench-core";
import { ORDERS_BY_STATUS, REVENUE_BY_CATEGORY } from "./plots/documents";
import { plotTile } from "./seed";
import { APP_IDS } from "./apps";
import { createShop, createShopWorkbench } from "./createShop";
import { seedShopDocument } from "./seed";
import { ShopShell } from "./ShopShell";
import { viewsByApp } from "./stories/harness";

/*
 * Scenes 1 and 2 (design §11.1) as visible postconditions (audit §15): the
 * detail's CONTENT and the badge's TEXT, never a store field alone.
 */

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

function scene(spec = split("row", 0.55, tile(APP_IDS.orders), split("col", 0.5, tile(APP_IDS.orderDetail), tile(APP_IDS.inspector)))) {
  const shop = createShop();
  const workbench = createShopWorkbench(shop, { initial: seedShopDocument({ spec }) });
  render(<ShopShell shop={shop} workbench={workbench} strip={false} />);
  return { shop, workbench, views: viewsByApp(workbench) };
}

/** Run a state change inside act and hand back its result. */
function performed<T>(run: () => T): T {
  let result!: T;
  act(() => {
    result = run();
  });
  return result;
}

/** The badges of one view's ports (the inspector beside the detail has a badge of its own). */
const badges = (viewId?: string) =>
  [...document.querySelectorAll('[data-part="port-badge"]')]
    .filter((el) => !viewId || el.getAttribute("data-port")?.startsWith(`${viewId}/`))
    .map((el) => `${el.getAttribute("data-state")}:${el.textContent}`);
const badgeEl = (viewId: string) => document.querySelector(`[data-ptype="port"]:has([data-port^="${viewId}/"])`) as HTMLElement;
const row = (orderId: string) => document.querySelector(`tr[data-order-id="${orderId}"]`) as HTMLElement;
const detailTitle = () => document.querySelector('[data-part="order-detail"] [data-part="toolbar"], [data-part="order-detail"]')?.textContent ?? "";

describe("scene 1 · ambient", () => {
  it("clicking a row drives the workspace's order; the unlinked detail follows it, badge ○", () => {
    const { views } = scene();
    const detail = views["order-detail"]![0]!;
    expect(screen.getByText("no order yet")).toBeTruthy();
    expect(badges(detail)).toEqual(["empty:○order · none"]);
    expect(badges(views.inspector![0]!)).toEqual(["empty:○subject · none"]);
    fireEvent.click(row("88213"));
    expect(detailTitle()).toContain("order #88213");
    expect(document.querySelector('[data-part="order-detail"]')?.textContent).toContain("J. Alvarez");
    expect(badges(detail)).toEqual(["ambient:○order · order"]);
    fireEvent.click(row("88214"));
    expect(detailTitle()).toContain("order #88214");
    // Nothing was written: ambient is the absence of a term.
    expect(document.querySelectorAll('[data-part="port-badge"][data-state="ambient"]')).toHaveLength(1);
  });
});

describe("scene 3 · show with routing", () => {
  it("“Show details…” on an order goes to the free detail, leaving the held one alone", async () => {
    const { workbench, views } = scene(split("row", 0.5, tile(APP_IDS.orders), split("col", 0.5, tile(APP_IDS.orderDetail, { title: "detail A" }), tile(APP_IDS.orderDetail, { title: "detail B" }))));
    const [a, b] = views["order-detail"]!;
    const orders = views.orders![0]!;
    act(() => void workbench.perform(linkVerbs.follow(portId(orders, "order"), portId(a!, "order"))));
    fireEvent.click(row("88213"));
    act(() => void workbench.perform(linkVerbs.pin(portId(a!, "order"))));
    fireEvent.pointerEnter(row("88214"));
    fireEvent.contextMenu(row("88214").querySelector('[data-ptype="order"]')!);
    fireEvent.click(await screen.findByText("Show details…"));
    expect(bindingsOf(workbench.core.getState().document).get(portId(b!, "order"))).toMatchObject({ kind: "follow", source: portId(orders, "order") });
    expect(bindingsOf(workbench.core.getState().document).get(portId(a!, "order"))?.kind).toBe("hold");
    expect(badges(b!)).toEqual(["following:→orders"]);
  });

  it("with no detail open, “Show details…” spawns one beside the table and links it", async () => {
    const { workbench, views } = scene(tile(APP_IDS.orders));
    const before = document.querySelectorAll("[data-placement-id]").length;
    fireEvent.pointerEnter(row("88214"));
    fireEvent.contextMenu(row("88214").querySelector('[data-ptype="order"]')!);
    fireEvent.click(await screen.findByText("Show details…"));
    expect(document.querySelectorAll("[data-placement-id]").length).toBe(before + 1);
    expect(detailTitle()).toContain("order #88214");
    const detail = Object.values(workbench.core.getState().document.views).find((view) => view.appId === APP_IDS.orderDetail);
    expect(detail).toBeTruthy();
    expect(bindingsOf(workbench.core.getState().document).get(portId(detail!.id, "order"))).toMatchObject({ kind: "follow", source: portId(views.orders![0]!, "order") });
  });
});

describe("scene 4 · derived", () => {
  it("the customer detail derives through order.customer: badge ←, the customer of the presented order, live as the table moves", async () => {
    const { workbench, views } = scene(split("row", 0.5, tile(APP_IDS.orders), tile(APP_IDS.customerDetail)));
    const orders = views.orders![0]!;
    const detail = views["customer-detail"]![0]!;
    fireEvent.click(row("88213"));
    expect(screen.getByText("no customer yet")).toBeTruthy();
    // The badge menu opens the palette; the palette's row derives.
    fireEvent.click(badgeEl(detail));
    fireEvent.click(await screen.findByText("Derive through…"));
    expect(await screen.findByText(/^DERIVE customer detail · customer THROUGH/)).toBeTruthy();
    fireEvent.click(screen.getByText("its customer"));
    expect(bindingsOf(workbench.core.getState().document).get(portId(detail, "customer"))).toMatchObject({ kind: "derived", relationId: "order.customer", source: { kind: "follow", source: portId(orders, "order") } });
    expect(badges(detail)).toEqual(["derived:←customer ← its customer"]);
    expect(document.querySelector('[data-part="customer-detail"]')?.textContent).toContain("J. Alvarez");
    fireEvent.click(row("88214"));
    expect(document.querySelector('[data-part="customer-detail"]')?.textContent).toContain("Northgate Capital");
  });
});

describe("scenes 5 and 6 · identity and follow", () => {
  it("Shift-click selects rows; sharing the selection with the orders plot puts both on one cell; the sales plot is refused with the field named", () => {
    const { workbench, views } = scene(split("row", 0.5, tile(APP_IDS.orders), split("col", 0.5, plotTile(ORDERS_BY_STATUS), plotTile(REVENUE_BY_CATEGORY))));
    const orders = views.orders![0]!;
    const [byStatus, byCategory] = views.plot!;
    fireEvent.click(row("88213"), { shiftKey: true });
    fireEvent.click(row("88214"), { shiftKey: true });
    expect(document.querySelectorAll('[data-part="orders-table"] tr[data-selected]')).toHaveLength(2);
    // Incompatible: different authority domain — refused, nothing written.
    expect(performed(() => workbench.perform(linkVerbs.identityAdd(portId(orders, "selection"), portId(byCategory!, "selection"))))).toBe(false);
    const refusal = planIdentityAdd(portId(orders, "selection"), portId(byCategory!, "selection"), "prefer-left", workbench.linkSnapshot(), workbench.links.deps);
    expect(refusal).toMatchObject({ kind: "unavailable", code: "incompatible", because: expect.stringContaining("different authority domain: orders vs daily_sales") });
    // Compatible: one cell for both.
    expect(performed(() => workbench.perform(linkVerbs.identityAdd(portId(orders, "selection"), portId(byStatus!, "selection"))))).toBe(true);
    expect(badges(orders)).toEqual(["shared:≡selection · σ1"]);
    expect(badges(byStatus!)).toEqual(["shared:≡selection · σ1"]);
    expect(workbench.links.runtime.getState().classes.get("σ1")).toMatchObject({ type: "datum", value: [{ identity: { id: "88213" } }, { identity: { id: "88214" } }] });
    // A third row toggled in the table writes the shared cell; the plot reads it as its own selection.
    fireEvent.click(row("88160"), { shiftKey: true });
    expect(workbench.links.runtime.getState().classes.get("σ1")).toMatchObject({ value: [{ identity: { id: "88160" } }, { identity: { id: "88213" } }, { identity: { id: "88214" } }] });
    expect(document.querySelector('[data-part="shop-plot"]')?.getAttribute("data-selected-count")).toBe("3");
  });

  it("the orders filter follows the catalog's category port: a category click narrows the rows, badge → catalog", () => {
    const { workbench, views } = scene(split("row", 0.5, tile(APP_IDS.products), tile(APP_IDS.orders)));
    const orders = views.orders![0]!;
    const catalog = views.products![0]!;
    const all = document.querySelectorAll('[data-part="orders-table"] tbody tr').length;
    // Link through the verb (the menu path is covered by scene 2) and click a category cell.
    act(() => void workbench.perform(linkVerbs.follow(portId(catalog, "cat"), portId(orders, "filter"))));
    const cell = document.querySelector('[data-part="product-catalog"] tr[data-product-id="2049"] [data-ptype="category"]')!.closest("td") as HTMLElement;
    fireEvent.click(cell);
    expect(badges(orders)).toEqual(["following:→catalog"]);
    const narrowed = document.querySelectorAll('[data-part="orders-table"] tbody tr').length;
    expect(narrowed).toBeGreaterThan(0);
    expect(narrowed).toBeLessThan(all);
    expect(document.querySelector('[data-part="orders-table"]')?.textContent).toContain("in American Gold Eagles");
  });
});

describe("scene 2 · follow and hold", () => {
  it("right-click an order → “Link to order detail · order” makes the detail follow the table, badge →", async () => {
    const { workbench, views } = scene();
    // Hover then right-click: the hover is what tells the family which port the order came from.
    fireEvent.pointerEnter(row("88213"));
    fireEvent.contextMenu(row("88213").querySelector('[data-ptype="order"]')!);
    const linkRow = await screen.findByText("Link to order detail · order");
    expect(screen.getByText("Link to inspector · subject")).toBeTruthy();
    fireEvent.click(linkRow);
    const detail = views["order-detail"]![0]!;
    const orders = views.orders![0]!;
    expect(bindingsOf(workbench.core.getState().document).get(portId(detail, "order"))).toMatchObject({ kind: "follow", source: portId(orders, "order") });
    expect(badges(detail)).toEqual(["following:→orders"]);
    fireEvent.click(row("88214"));
    expect(detailTitle()).toContain("order #88214");
  });

  it("Pin from the badge menu holds the order; Resume catches up; Detach fixes it", async () => {
    const { workbench, views } = scene();
    const detail = views["order-detail"]![0]!;
    const orders = views.orders![0]!;
    act(() => void workbench.perform(linkVerbs.follow(portId(orders, "order"), portId(detail, "order"))));
    fireEvent.click(row("88213"));
    expect(badges(detail)).toEqual(["following:→orders"]);

    fireEvent.click(badgeEl(detail));
    fireEvent.click(await screen.findByText("Pin"));
    expect(badges(detail)).toEqual(["held:⏸#88213"]);
    fireEvent.click(row("88214"));
    expect(detailTitle()).toContain("order #88213");

    fireEvent.click(badgeEl(detail));
    fireEvent.click(await screen.findByText("Resume"));
    expect(badges(detail)).toEqual(["following:→orders"]);
    expect(detailTitle()).toContain("order #88214");

    fireEvent.click(badgeEl(detail));
    fireEvent.click(await screen.findByText("Pin"));
    fireEvent.click(badgeEl(detail));
    fireEvent.click(await screen.findByText("Detach as a fixed value"));
    expect(badges(detail)).toEqual(["fixed:•#88214"]);
    expect(bindingsOf(workbench.core.getState().document).get(portId(detail, "order"))).toMatchObject({ kind: "constant" });
  });

  it("an unavailable row stays visible with its reason: Resume on a port that is not held", async () => {
    const { workbench, views } = scene();
    act(() => void workbench.perform(linkVerbs.follow(portId(views.orders![0]!, "order"), portId(views["order-detail"]![0]!, "order"))));
    fireEvent.click(badgeEl(views["order-detail"]![0]!));
    const resume = await screen.findByText("Resume");
    const rowEl = resume.closest("[aria-disabled], [data-disabled], button, [role=menuitem]") as HTMLElement | null;
    expect(rowEl).toBeTruthy();
    expect(document.body.textContent).toContain("is not held");
  });

  it("the link survives serialize/restore, and closing the table freezes the detail", () => {
    const { shop, workbench, views } = scene();
    const detail = views["order-detail"]![0]!;
    const orders = views.orders![0]!;
    act(() => void workbench.perform(linkVerbs.follow(portId(orders, "order"), portId(detail, "order"))));
    fireEvent.click(row("88213"));
    const json = workbench.serialize();
    expect(JSON.parse(json).documents[LINKS_DOC_ID]).toBeTruthy();
    const again = createShopWorkbench(shop);
    expect(again.restore(json)).toBe(true);
    expect(bindingsOf(again.core.getState().document).get(portId(detail, "order"))).toMatchObject({ kind: "follow" });

    const placement = document.querySelector('[data-part="orders-table"]')?.closest("[data-placement-id]")?.getAttribute("data-placement-id");
    act(() => void workbench.execute(commands.close(placement!)));
    expect(badges(detail)).toEqual(["held:⏸#88213"]);
    expect(detailTitle()).toContain("order #88213");
  });
});
