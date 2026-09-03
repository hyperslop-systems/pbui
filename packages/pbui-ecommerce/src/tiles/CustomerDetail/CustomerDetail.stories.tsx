import type { Meta, StoryObj } from "@storybook/react-vite";
import { linkVerbs, portId } from "@hyperslop-systems/pbui";
import { split, tile } from "@hyperslop-systems/workbench-core";
import { APP_IDS } from "../../apps";
import { customerValue } from "../../presentation/values";
import { ShopStory } from "../../stories/harness";

const meta: Meta = { title: "Shop/Tiles/CustomerDetail" };
export default meta;

const beside = split("row", 0.5, tile(APP_IDS.customers), tile(APP_IDS.customerDetail));

export const Following: StoryObj = {
  name: "following the customers table: Northgate Capital, a fund",
  render: () => (
    <ShopStory
      spec={beside}
      height={460}
      setup={(shop, workbench, views) => {
        const customers = views.customers?.[0];
        const detail = views["customer-detail"]?.[0];
        const customer = shop.host.customer("c-northgate");
        if (!customers || !detail || !customer) return;
        workbench.perform(linkVerbs.follow(portId(customers, "customer"), portId(detail, "customer")));
        workbench.links.runtime.emit(portId(customers, "customer"), { type: "customer", value: customerValue(customer) });
      }}
    />
  ),
};

export const Waiting: StoryObj = {
  name: "nothing bound yet",
  render: () => <ShopStory spec={beside} height={300} />,
};
