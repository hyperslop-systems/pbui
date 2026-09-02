import type { Meta, StoryObj } from "@storybook/react-vite";
import { DirectStory } from "../../stories/harness";
import { OrderDetail } from "./OrderDetail";

const meta: Meta = { title: "Shop/Tiles/OrderDetail" };
export default meta;

export const Alvarez: StoryObj = {
  name: "order #88213 (J. Alvarez, three Gold Eagles): facts, customer, line items",
  render: () => <DirectStory height={360}>{(shop, view) => <OrderDetail shop={shop} view={view} placementId="story" preview="88213" />}</DirectStory>,
};

export const Northgate: StoryObj = {
  name: "order #88214 (Northgate Capital, four hundred Silver Eagles)",
  render: () => <DirectStory height={360}>{(shop, view) => <OrderDetail shop={shop} view={view} placementId="story" preview="88214" />}</DirectStory>,
};

export const Waiting: StoryObj = {
  name: "nothing bound yet: the empty state names the port",
  render: () => <DirectStory height={240}>{(shop, view) => <OrderDetail shop={shop} view={view} placementId="story" />}</DirectStory>,
};
