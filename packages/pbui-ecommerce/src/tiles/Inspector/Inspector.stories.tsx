import type { Meta, StoryObj } from "@storybook/react-vite";
import { orderValue, productValue } from "../../presentation/values";
import { DirectStory } from "../../stories/harness";
import { Inspector } from "./Inspector";

const meta: Meta = { title: "Shop/Tiles/Inspector" };
export default meta;

export const AnOrder: StoryObj = {
  name: "inspecting an order",
  render: () => (
    <DirectStory height={320}>
      {(shop, view) => {
        const order = shop.host.order("88213")!;
        return <Inspector shop={shop} view={view} placementId="story" preview={{ type: "order", value: orderValue(order) }} />;
      }}
    </DirectStory>
  ),
};

export const AProduct: StoryObj = {
  name: "inspecting a SKU",
  render: () => (
    <DirectStory height={320}>
      {(shop, view) => {
        const product = shop.host.product("2077")!;
        return <Inspector shop={shop} view={view} placementId="story" preview={{ type: "product", value: productValue(product, shop.host) }} />;
      }}
    </DirectStory>
  ),
};

export const Waiting: StoryObj = {
  name: "nothing inspected yet",
  render: () => <DirectStory height={240}>{(shop, view) => <Inspector shop={shop} view={view} placementId="story" />}</DirectStory>,
};
