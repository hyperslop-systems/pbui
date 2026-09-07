import type { Meta, StoryObj } from "@storybook/react-vite";
import { DemoChat } from "../../stories/DemoChat";
import { ToolCard } from "./ToolCard";

const meta: Meta<typeof ToolCard> = {
  title: "pbui-chat/ToolCard",
  component: ToolCard,
  decorators: [(Story) => <DemoChat><Story /></DemoChat>],
  args: { toolCallId: "local-tool", toolName: "sales_report", status: "finished", input: { productId: "2049" }, result: { amount: "9007199254740993.00" } },
};
export default meta;
type Story = StoryObj<typeof ToolCard>;
export const Finished: Story = {};
export const Failed: Story = { args: { status: "failed", result: undefined, error: "The local fixture could not produce a report." } };
export const NarrowLongContent: Story = {
  args: { toolName: "report_" + "long_identifier_".repeat(8), status: "failed", error: "Unavailable receipt: " + "abcdef0123456789".repeat(8) },
  decorators: [(Story) => <div style={{ width: 280 }}><Story /></div>],
};
