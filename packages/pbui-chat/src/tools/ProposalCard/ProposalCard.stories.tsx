import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { DemoChat, transcript } from "../../stories/DemoChat";
import { ProposalCard, type ProposalDecision } from "./ProposalCard";

const meta: Meta<typeof ProposalCard> = {
  title: "pbui-chat/ProposalCard",
  component: ProposalCard,
  decorators: [
    (Story) => (
      <DemoChat entities={transcript}>
        <Story />
      </DemoChat>
    ),
  ],
  args: {
    id: "p-reorder-2049",
    toolCallId: "tc_40",
    title: "Reorder 40 × 1oz American Gold Eagle 2024",
    body: "Stock for [[product:2049|the Eagle]] is 12, below the reorder point of 20. Per [[source:E2|pricing policy §3]] I propose ordering **40 units** from the US Mint at spot + 3.2%.",
    danger: true,
    fields: [
      { label: "supplier", value: "US Mint" },
      { label: "quantity", value: "40" },
      { label: "est. cost", value: "$103,120" },
      { label: "lead time", value: "9 days" },
    ],
  },
};
export default meta;

type Story = StoryObj<typeof ProposalCard>;

/** Pending: Approve/Reject are live; deciding disables them and records the decision on the card. */
export const Pending: Story = {
  render: (args) => {
    const [decision, setDecision] = useState<ProposalDecision | undefined>(undefined);
    return <ProposalCard {...args} decision={decision} onDecide={setDecision} />;
  },
};

export const Approved: Story = { args: { decision: "approve" } };

export const Rejected: Story = { args: { decision: "reject", danger: false } };
