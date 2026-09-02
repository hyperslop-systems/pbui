import type { Meta, StoryObj } from "@storybook/react-vite";
import { split } from "@hyperslop-systems/pbui-workbench";
import { ORDERS_BY_STATUS, REVENUE_BY_CATEGORY, REVENUE_BY_DAY } from "../../plots/documents";
import { plotTile } from "../../seed";
import { ShopStory } from "../../stories/harness";

const meta: Meta = { title: "Shop/Tiles/ShopPlot" };
export default meta;

export const RevenueByDay: StoryObj = {
  name: "revenue by day over daily_sales, coloured by metal",
  render: () => <ShopStory spec={plotTile(REVENUE_BY_DAY)} height={420} />,
};

export const RevenueByCategory: StoryObj = {
  name: "revenue by category, stacked from the daily cells",
  render: () => <ShopStory spec={plotTile(REVENUE_BY_CATEGORY)} height={420} />,
};

export const OrdersByStatus: StoryObj = {
  name: "orders by status over the orders table; every segment is one order",
  render: () => <ShopStory spec={plotTile(ORDERS_BY_STATUS)} height={420} />,
};

export const ThreeUp: StoryObj = {
  name: "the sales workspace: all three",
  render: () => <ShopStory spec={split("row", 0.5, plotTile(REVENUE_BY_DAY), split("col", 0.5, plotTile(REVENUE_BY_CATEGORY), plotTile(ORDERS_BY_STATUS)))} height={620} />,
};
