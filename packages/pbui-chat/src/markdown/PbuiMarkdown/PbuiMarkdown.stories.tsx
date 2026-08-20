import type { Meta, StoryObj } from "@storybook/react-vite";
import { DemoChat, transcript } from "../../stories/DemoChat";
import { PbuiMarkdown } from "./PbuiMarkdown";

const meta: Meta<typeof PbuiMarkdown> = {
  title: "pbui-chat/PbuiMarkdown",
  component: PbuiMarkdown,
  decorators: [
    (Story) => (
      <DemoChat entities={transcript}>
        <Story />
      </DemoChat>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof PbuiMarkdown>;

/** Mentions resolved through the `pbui.refs` index render as live presentations with the product's tone. */
export const Resolved: Story = {
  args: {
    text: "[[product:2049|The Eagle]] sold **41** units this week, ahead of [[product:2051|the Buffalo]].\nIt sits in [[category:7|American Gold Eagles]] and is priced off [[metal:gold|gold]] spot — see [[source:E2|pricing policy §3]] and `reorder_point = 20`.",
  },
};

/** A mention the index cannot answer still renders — as `<unresolved>`, neutral, with one verb. */
export const Unresolved: Story = {
  args: {
    text: "I looked at [[order:99999|an order that does not exist]] and [[spaceship:1]] — neither resolves, but both are presentations.",
  },
};

/** Paragraphs, bullets, a heading and a code fence. */
export const Blocks: Story = {
  args: {
    text: "# weekly summary\n\nTwo things stand out:\n\n- [[product:2049|the Eagle]] is low on stock\n- [[metal:gold|gold]] moved +0.4%\n\n```\nSELECT sku, qty FROM stock WHERE qty < reorder_point\n```\n\nThat is all.",
  },
};
