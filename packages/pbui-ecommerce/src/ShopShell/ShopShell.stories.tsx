import type { Meta, StoryObj } from "@storybook/react-vite";
import { split, tile } from "@hyperslop-systems/pbui-workbench";
import { APP_IDS } from "../apps";
import { ORDERS_BY_STATUS, REVENUE_BY_CATEGORY } from "../plots/documents";
import { plotTile } from "../seed";
import { ShopStory } from "../stories/harness";

/*
 * THE SCENES (PBUI-LINK-1 §11.1), in the order the phases land. Phase 1
 * shows the layouts; each later phase makes its scene do what its name
 * says and adds the Playwright scenario beside it.
 */

const meta: Meta = { title: "Shop/Scenes" };
export default meta;

export const Seeded: StoryObj = {
  name: "the seeded workbench: four workspaces (orders, customers, sales, catalog)",
  render: () => <ShopStory height={640} strip />,
};

export const Scene1Ambient: StoryObj = {
  name: "1 · ambient: an unlinked detail follows the workspace's current order (Phase 2)",
  render: () => <ShopStory spec={split("row", 0.6, tile(APP_IDS.orders), tile(APP_IDS.orderDetail))} height={520} />,
};

export const Scene2FollowHold: StoryObj = {
  name: "2 · follow and hold: right-click an order → Link to order detail; pin; resume (Phase 2)",
  render: () => <ShopStory spec={split("row", 0.55, tile(APP_IDS.orders), split("col", 0.5, tile(APP_IDS.orderDetail), tile(APP_IDS.inspector)))} height={560} />,
};

export const Scene3Show: StoryObj = {
  name: "3 · show with routing: two details, one held; “Show details…” picks the free one (Phase 4)",
  render: () => <ShopStory spec={split("row", 0.5, tile(APP_IDS.orders), split("col", 0.5, tile(APP_IDS.orderDetail, { title: "detail A" }), tile(APP_IDS.orderDetail, { title: "detail B" })))} height={560} />,
};

export const Scene4Derived: StoryObj = {
  name: "4 · derived: the customer detail derives through order.customer (Phase 6)",
  render: () => <ShopStory spec={split("row", 0.5, tile(APP_IDS.orders), split("col", 0.5, tile(APP_IDS.orderDetail), tile(APP_IDS.customerDetail)))} height={560} />,
};

export const Scene5Identity: StoryObj = {
  name: "5 · identity: the orders table and the orders-by-status plot share a selection (Phase 5)",
  render: () => <ShopStory spec={split("row", 0.55, tile(APP_IDS.orders), plotTile(ORDERS_BY_STATUS))} height={520} />,
};

export const Scene6FollowVsIdentity: StoryObj = {
  name: "6 · follow versus identity: a category bar drives the orders filter (Phase 5)",
  render: () => <ShopStory spec={split("row", 0.5, plotTile(REVENUE_BY_CATEGORY), tile(APP_IDS.orders))} height={520} />,
};

export const Scene7ConnectMode: StoryObj = {
  name: "7 · connect mode: Mod+Shift+L over the seeded workspace shows every wire (Phase 3)",
  render: () => <ShopStory height={640} strip />,
};
