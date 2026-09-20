import type { Meta, StoryObj } from "@storybook/react-vite";
import { DemoChat, eagle } from "../../stories/DemoChat";
import { RefPresentation } from "./RefPresentation";

const meta: Meta<typeof RefPresentation> = {
  title: "pbui-chat/RefPresentation",
  component: RefPresentation,
  decorators: [(Story) => <DemoChat><Story /></DemoChat>],
  args: { reference: eagle },
};
export default meta;
type Story = StoryObj<typeof RefPresentation>;
export const Default: Story = {};
export const WithBadge: Story = { args: { badge: "product" } };
export const CustomBody: Story = { args: { children: <strong>Product-specific content</strong> } };
export const Block: Story = { args: { block: true } };
