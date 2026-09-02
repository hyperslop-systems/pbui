import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { linkVerbs, portId } from "@hyperslop-systems/pbui";
import { LINKS_DOC_ID, bindingsOf, split, tile } from "@hyperslop-systems/pbui-workbench";
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
    expect(bindingsOf(workbench.store.getState().document).get(portId(detail, "order"))).toMatchObject({ kind: "follow", source: portId(orders, "order") });
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
    expect(bindingsOf(workbench.store.getState().document).get(portId(detail, "order"))).toMatchObject({ kind: "constant" });
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
    expect(bindingsOf(again.store.getState().document).get(portId(detail, "order"))).toMatchObject({ kind: "follow" });

    const placement = document.querySelector('[data-part="orders-table"]')?.closest("[data-placement-id]")?.getAttribute("data-placement-id");
    act(() => void workbench.verbs.close(placement!));
    expect(badges(detail)).toEqual(["held:⏸#88213"]);
    expect(detailTitle()).toContain("order #88213");
  });
});
