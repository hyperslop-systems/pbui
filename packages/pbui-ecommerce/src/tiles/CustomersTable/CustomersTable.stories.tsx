import type { Meta, StoryObj } from "@storybook/react-vite";
import { tile } from "@hyperslop-systems/pbui-workbench";
import { APP_IDS } from "../../apps";
import { ShopStory } from "../../stories/harness";

const meta: Meta = { title: "Shop/Tiles/CustomersTable" };
export default meta;

export const Alone: StoryObj = {
  name: "twelve customers with their summer spend",
  render: () => <ShopStory spec={tile(APP_IDS.customers)} />,
};
