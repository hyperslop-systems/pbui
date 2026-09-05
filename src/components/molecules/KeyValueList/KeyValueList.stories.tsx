import type { Meta, StoryObj } from "@storybook/react-vite";
import { Chip } from "../../atoms";
import { KeyValueList } from "./KeyValueList";

const meta = {
  title: "Component Library/Molecules/KeyValueList",
  component: KeyValueList,
} satisfies Meta<typeof KeyValueList>;
export default meta;
type Story = StoryObj<typeof meta>;

const items = [
  { key: "customer", value: <Chip label="Castellano Family Trust" tone="var(--pbui-tone-row)" /> },
  { key: "placed", value: "2026-06-02" },
  { key: "status", value: "shipped" },
  { key: "units", value: "2" },
];

export const Default: Story = { args: { items } };
export const Dense: Story = { args: { items, dense: true } };
