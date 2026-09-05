import type { Meta, StoryObj } from "@storybook/react-vite";
import { linkVerbs, portId } from "@hyperslop-systems/pbui";
import { split, tile } from "@hyperslop-systems/workbench-core";
import { APP_IDS } from "../apps";
import { ORDERS_BY_STATUS, REVENUE_BY_CATEGORY } from "../plots/documents";
import { plotTile } from "../seed";
import { deriveCustomer, followCategory, followOrders, holdOrders, presentOrder, shareSelection, ShopStory } from "../stories/harness";

/*
 * THE SCENES (PBUI-LINK-1 §11.1), in the order the phases land. Each opens
 * on the postcondition its name promises; the later phases make the rest
 * of the scene do what its name says and add the Playwright scenario.
 */

const meta: Meta = { title: "Shop/Scenes" };
export default meta;

export const Seeded: StoryObj = {
  name: "the seeded workbench: four workspaces (orders, customers, sales, catalog)",
  render: () => <ShopStory height={640} strip />,
};

export const Scene1Ambient: StoryObj = {
  name: "1 · ambient: an unlinked detail follows the workspace's current order; click rows to move it (Phase 2)",
  render: () => <ShopStory spec={split("row", 0.6, tile(APP_IDS.orders), tile(APP_IDS.orderDetail))} setup={presentOrder("88213")} height={520} />,
};

export const Scene2Follow: StoryObj = {
  name: "2a · follow: right-click an order → Link to order detail · order; the badge reads → orders (Phase 2)",
  render: () => <ShopStory spec={split("row", 0.55, tile(APP_IDS.orders), split("col", 0.5, tile(APP_IDS.orderDetail), tile(APP_IDS.inspector)))} setup={followOrders("88214")} height={560} />,
};

export const Scene2Hold: StoryObj = {
  name: "2b · hold: the detail is pinned on #88213; click the badge for Resume / Detach (Phase 2)",
  render: () => <ShopStory spec={split("row", 0.55, tile(APP_IDS.orders), split("col", 0.5, tile(APP_IDS.orderDetail), tile(APP_IDS.inspector)))} setup={holdOrders("88213", "88201")} height={560} />,
};

export const Scene3Show: StoryObj = {
  name: "3 · show with routing: detail A is held; right-click an order → “Show details…” goes to detail B; with no detail open it spawns one (Phase 4)",
  render: () => (
    <ShopStory
      spec={split("row", 0.5, tile(APP_IDS.orders), split("col", 0.5, tile(APP_IDS.orderDetail, { title: "detail A" }), tile(APP_IDS.orderDetail, { title: "detail B" })))}
      height={560}
      setup={(shop, workbench, views) => {
        holdOrders("88213", "88201")?.(shop, workbench, views);
      }}
    />
  ),
};

export const Scene3Spawn: StoryObj = {
  name: "3b · show with nothing to take it: “Show details…” opens a detail beside the table and links it in one plan (Phase 4)",
  render: () => <ShopStory spec={tile(APP_IDS.orders)} height={520} setup={presentOrder("88214")} />,
};

export const Scene4Derived: StoryObj = {
  name: "4 · derived: the customer detail derives through order.customer from the orders table (badge customer ← its customer); the order detail follows (Phase 6)",
  render: () => (
    <ShopStory
      spec={split("row", 0.5, tile(APP_IDS.orders), split("col", 0.5, tile(APP_IDS.orderDetail), tile(APP_IDS.customerDetail)))}
      height={560}
      setup={(shop, workbench, views) => {
        followOrders("88213")?.(shop, workbench, views);
        deriveCustomer("88213")?.(shop, workbench, views);
      }}
    />
  ),
};

export const Scene4Palette: StoryObj = {
  name: "4b · the relation palette: click the customer detail's badge → “Derive through…”, or open it here (Phase 6)",
  render: () => (
    <ShopStory
      spec={split("row", 0.5, tile(APP_IDS.orders), tile(APP_IDS.customerDetail))}
      height={520}
      setup={(shop, workbench, views) => {
        presentOrder("88214")?.(shop, workbench, views);
        const detail = views["customer-detail"]?.[0];
        if (detail) workbench.perform(linkVerbs.openPalette(portId(detail, "customer")));
      }}
    />
  ),
};

export const Scene5Identity: StoryObj = {
  name: "5 · identity: the orders table and the orders-by-status plot share a selection ≡ σ1 — Shift-click rows, brush the plot (Phase 5)",
  render: () => <ShopStory spec={split("row", 0.55, tile(APP_IDS.orders), plotTile(ORDERS_BY_STATUS))} height={520} setup={shareSelection()} />,
};

export const Scene5Incompatible: StoryObj = {
  name: "5b · not identity-compatible: the revenue-by-category plot selects daily_sales cells, not orders — Ctrl-drag in connect mode says why (Phase 5)",
  render: () => <ShopStory spec={split("row", 0.55, tile(APP_IDS.orders), plotTile(REVENUE_BY_CATEGORY))} height={520} setup={(_s, wb) => wb.perform(linkVerbs.openMode())} />,
};

export const Scene6FollowVsIdentity: StoryObj = {
  name: "6 · follow versus identity: the orders filter FOLLOWS the plot's category (badge → plot), a follow rather than a shared cell (Phase 5)",
  render: () => <ShopStory spec={split("row", 0.5, plotTile(REVENUE_BY_CATEGORY), tile(APP_IDS.orders))} height={520} setup={followCategory("7")} />,
};

export const Scene8Inspector: StoryObj = {
  name: "8 · the coordination inspector beside a linked pair: what an agent reads through workbench_describe, for a person (Phase 7)",
  render: () => (
    <ShopStory
      spec={split("row", 0.5, split("col", 0.5, tile(APP_IDS.orders), tile(APP_IDS.orderDetail)), tile("coordination"))}
      height={600}
      setup={(shop, workbench, views) => {
        followOrders("88213")?.(shop, workbench, views);
      }}
    />
  ),
};

export const Scene7ConnectMode: StoryObj = {
  name: "7 · connect mode: every tile flips to its rail, every link is a wire; drag ▸ onto ◂, Shift to hold, Esc to leave (Phase 3)",
  render: () => (
    <ShopStory
      spec={split("row", 0.5, tile(APP_IDS.orders), split("col", 0.5, tile(APP_IDS.orderDetail), tile(APP_IDS.inspector)))}
      height={600}
      strip
      setup={(shop, workbench, views) => {
        followOrders("88213")?.(shop, workbench, views);
        const orders = views.orders?.[0];
        const inspector = views.inspector?.[0];
        if (orders && inspector) workbench.perform(linkVerbs.follow(portId(orders, "order"), portId(inspector, "subject")));
        workbench.perform(linkVerbs.openMode());
      }}
    />
  ),
};
