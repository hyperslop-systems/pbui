import type { Meta, StoryObj } from "@storybook/react-vite";
import { linkVerbs, portId } from "@hyperslop-systems/pbui";
import { split, tile } from "@hyperslop-systems/workbench-core";
import { APP_IDS } from "../../apps";
import { productValue } from "../../presentation/values";
import { followOrders, ShopStory } from "../../stories/harness";

const meta: Meta = { title: "Shop/Tiles/Inspector" };
export default meta;

export const AnOrder: StoryObj = {
  name: "inspecting an order the table presented: subject follows orders.order through <inspectable>",
  render: () => <ShopStory spec={split("row", 0.55, tile(APP_IDS.orders), tile(APP_IDS.inspector))} setup={followOrders("88213", "inspector", "subject")} height={460} />,
};

export const AProduct: StoryObj = {
  name: "inspecting a SKU, fixed on the value (port.bind)",
  render: () => (
    <ShopStory
      spec={split("row", 0.55, tile(APP_IDS.products), tile(APP_IDS.inspector))}
      height={400}
      setup={(shop, workbench, views) => {
        const inspector = views.inspector?.[0];
        const product = shop.host.product("2077");
        if (inspector && product) workbench.perform(linkVerbs.bind(portId(inspector, "subject"), { type: "product", value: productValue(product, shop.host) }));
      }}
    />
  ),
};

export const Waiting: StoryObj = {
  name: "nothing inspected yet",
  render: () => <ShopStory spec={tile(APP_IDS.inspector)} height={240} />,
};
