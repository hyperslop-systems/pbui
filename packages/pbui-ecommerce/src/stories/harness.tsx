import { linkVerbs, portId } from "@hyperslop-systems/pbui";
import type { LayoutSpec, Workbench } from "@hyperslop-systems/pbui-workbench";
import { leaves, workspaceTree } from "@hyperslop-systems/workbench-protocol/client";
import { useMemo } from "react";
import { createShop, createShopWorkbench, type Shop } from "../createShop";
import { orderValue } from "../presentation/values";
import { seedShopDocument } from "../seed";
import { ShopShell } from "../ShopShell";

/*
 * Story harness: the whole shell over a layout (the seeded four workspaces,
 * or one spec), with an optional `setup` that puts the workbench into a
 * scene's starting state — a link performed, a value emitted — so a story
 * opens on the postcondition it is named after rather than on a blank.
 */

export interface ShopStoryProps {
  spec?: LayoutSpec;
  height?: number;
  strip?: boolean;
  setup?(shop: Shop, workbench: Workbench, views: ViewsByApp): void;
}

/** The view ids of the current workspace, grouped by app id in tree order. */
export type ViewsByApp = Record<string, string[]>;

export function viewsByApp(workbench: Workbench): ViewsByApp {
  const state = workbench.store.getState();
  const out: ViewsByApp = {};
  for (const leaf of leaves(workspaceTree(state.document, state.workspaceId))) {
    if (leaf.body.case !== "leaf") continue;
    const view = state.document.views[leaf.body.value.viewId];
    if (!view) continue;
    (out[view.appId] ??= []).push(view.id);
  }
  return out;
}

export function ShopStory({ spec, height = 520, strip = false, setup }: ShopStoryProps) {
  const { shop, workbench } = useMemo(() => {
    const shop = createShop();
    const workbench = createShopWorkbench(shop, { initial: seedShopDocument(spec ? { spec } : {}) });
    setup?.(shop, workbench, viewsByApp(workbench));
    return { shop, workbench };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec]);
  return (
    <div style={{ height, display: "grid", gridTemplateRows: "minmax(0, 1fr)" }}>
      <ShopShell shop={shop} workbench={workbench} strip={strip} />
    </div>
  );
}

/* ---- reusable setups ------------------------------------------------------ */

/** The orders table presents an order (as a click would), driving the workspace's order context. */
export function presentOrder(orderId: string): ShopStoryProps["setup"] {
  return (shop, workbench, views) => {
    const order = shop.host.order(orderId);
    const orders = views.orders?.[0];
    if (!order || !orders) return;
    workbench.links.runtime.emit(portId(orders, "order"), { type: "order", value: orderValue(order) }, { drives: ["workspace.order"] });
  };
}

/** The first detail follows the first orders table, which then presents an order. */
export function followOrders(orderId: string, detailApp = "order-detail", portName = "order"): ShopStoryProps["setup"] {
  return (shop, workbench, views) => {
    const orders = views.orders?.[0];
    const detail = views[detailApp]?.[0];
    if (orders && detail) workbench.perform(linkVerbs.follow(portId(orders, "order"), portId(detail, portName)));
    presentOrder(orderId)?.(shop, workbench, views);
  };
}

/** The customer detail DERIVES through order.customer from the orders table's order port; an order is presented. */
export function deriveCustomer(orderId = "88213"): ShopStoryProps["setup"] {
  return (shop, workbench, views) => {
    const orders = views.orders?.[0];
    const detail = views["customer-detail"]?.[0];
    if (orders && detail) workbench.perform(linkVerbs.derive(portId(orders, "order"), portId(detail, "customer"), "order.customer"));
    presentOrder(orderId)?.(shop, workbench, views);
  };
}

/** The orders table and the orders-by-status plot share one selection (identity.add), with two rows selected. */
export function shareSelection(orderIds: string[] = ["88213", "88214"]): ShopStoryProps["setup"] {
  return (_shop, workbench, views) => {
    const orders = views.orders?.[0];
    const plot = views.plot?.[0];
    if (!orders || !plot) return;
    workbench.links.runtime.emit(portId(orders, "selection"), { type: "datum", value: orderIds.map((id) => ({ relation: "orders", identity: { id } })) });
    workbench.perform(linkVerbs.identityAdd(portId(orders, "selection"), portId(plot, "selection"), "prefer-left"));
  };
}

/** The orders table's filter follows the plot's (or catalog's) category port; a category is presented. */
export function followCategory(categoryId = "7", sourceApp = "plot"): ShopStoryProps["setup"] {
  return (shop, workbench, views) => {
    const source = views[sourceApp]?.[0];
    const orders = views.orders?.[0];
    const category = shop.host.category(categoryId);
    if (!source || !orders || !category) return;
    workbench.perform(linkVerbs.follow(portId(source, "cat"), portId(orders, "filter")));
    workbench.links.runtime.emit(portId(source, "cat"), { type: "category", value: { id: category.id, name: category.name } });
  };
}

/** Follow, present, then pin — the held state, with a later order presented that the detail ignores. */
export function holdOrders(heldId: string, laterId: string): ShopStoryProps["setup"] {
  return (shop, workbench, views) => {
    followOrders(heldId)?.(shop, workbench, views);
    const detail = views["order-detail"]?.[0];
    if (detail) workbench.perform(linkVerbs.pin(portId(detail, "order")));
    presentOrder(laterId)?.(shop, workbench, views);
  };
}
