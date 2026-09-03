import type { Meta, StoryObj } from "@storybook/react-vite";
import { split, tile } from "@hyperslop-systems/pbui-workbench";
import { APP_IDS } from "../../apps";
import { followOrders, holdOrders, presentOrder, ShopStory } from "../../stories/harness";

const meta: Meta = { title: "Shop/Tiles/OrderDetail" };
export default meta;

const beside = split("row", 0.55, tile(APP_IDS.orders), tile(APP_IDS.orderDetail));

export const Ambient: StoryObj = {
  name: "ambient: an unlinked detail shows the workspace's current order (#88213, J. Alvarez); badge ○",
  render: () => <ShopStory spec={beside} setup={presentOrder("88213")} height={460} />,
};

export const Following: StoryObj = {
  name: "following the orders table (#88214, Northgate Capital); badge →",
  render: () => <ShopStory spec={beside} setup={followOrders("88214")} height={460} />,
};

export const Held: StoryObj = {
  name: "held on #88213 while the table has moved on to #88201; badge ⏸",
  render: () => <ShopStory spec={beside} setup={holdOrders("88213", "88201")} height={460} />,
};

export const Waiting: StoryObj = {
  name: "nothing presented yet: the empty state names the port and its fallback",
  render: () => <ShopStory spec={beside} height={300} />,
};
