import type { Meta, StoryObj } from "@storybook/react-vite";
import { tile } from "@hyperslop-systems/pbui-workbench";
import { APP_IDS } from "../../apps";
import { ShopStory } from "../../stories/harness";

const meta: Meta = { title: "Shop/Tiles/ProductCatalog" };
export default meta;

export const Alone: StoryObj = {
  name: "the eight SKUs; product, category and metal are three presentation types in one row",
  render: () => <ShopStory spec={tile(APP_IDS.products)} height={360} />,
};
