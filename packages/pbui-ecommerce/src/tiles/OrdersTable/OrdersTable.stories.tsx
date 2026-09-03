import type { Meta, StoryObj } from "@storybook/react-vite";
import { tile } from "@hyperslop-systems/workbench-core";
import { APP_IDS } from "../../apps";
import { ShopStory } from "../../stories/harness";

const meta: Meta = { title: "Shop/Tiles/OrdersTable" };
export default meta;

export const Alone: StoryObj = {
  name: "the order book, sixty-five orders; every id is an <order> presentation",
  render: () => <ShopStory spec={tile(APP_IDS.orders)} />,
};
