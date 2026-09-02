import type { Meta, StoryObj } from "@storybook/react-vite";
import { DirectStory } from "../../stories/harness";
import { CustomerDetail } from "./CustomerDetail";

const meta: Meta = { title: "Shop/Tiles/CustomerDetail" };
export default meta;

export const Northgate: StoryObj = {
  name: "Northgate Capital, a fund: its orders and spend",
  render: () => <DirectStory height={360}>{(shop, view) => <CustomerDetail shop={shop} view={view} placementId="story" preview="c-northgate" />}</DirectStory>,
};

export const Waiting: StoryObj = {
  name: "nothing bound yet",
  render: () => <DirectStory height={240}>{(shop, view) => <CustomerDetail shop={shop} view={view} placementId="story" />}</DirectStory>,
};
