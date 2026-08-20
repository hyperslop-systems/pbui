import type { HumanTool } from "@go-go-golems/chat-provider";
import { z } from "zod";
import { usePbuiChat } from "../context";
import { ProposalCard, type ProposalDecision } from "./ProposalCard";

export const PROPOSE_TOOL_NAME = "pbui_propose";

export const ProposeInputSchema = z.object({
  id: z.string().describe("stable proposal id"),
  title: z.string(),
  body: z.string().describe("markdown; may contain mentions"),
  danger: z.boolean().optional(),
  fields: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
});
export type ProposeInput = z.infer<typeof ProposeInputSchema>;

export const ProposeResultSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  id: z.string(),
});
export type ProposeResult = z.infer<typeof ProposeResultSchema>;

function ProposeToolCard({
  toolCallId,
  input,
  respond,
}: {
  toolCallId: string;
  input: ProposeInput;
  respond(result: ProposeResult): void;
}) {
  const chat = usePbuiChat();
  const decide = (decision: ProposalDecision) => {
    // The card performs the verb itself so the trace records the decision
    // with the human as actor; the product's `tool` family handler is a
    // no-op for it, the answer to the parked tool is the respond() below.
    void chat.router.perform({ kind: "resolveProposal", id: input.id, decision });
    respond({ decision, id: input.id });
  };
  return (
    <ProposalCard
      id={input.id}
      toolCallId={toolCallId}
      title={input.title}
      body={input.body}
      danger={input.danger}
      fields={input.fields}
      onDecide={decide}
    />
  );
}

/**
 * `pbui_propose`: a consequential action the agent will not take on its own.
 * Renders a `<proposal>` card whose Approve/Reject answer the parked tool.
 */
export const pbuiProposeTool: HumanTool<ProposeInput, ProposeResult> = {
  name: PROPOSE_TOOL_NAME,
  mode: "human",
  description:
    "Propose a consequential action and wait for the user to approve or reject it. Returns {decision: 'approve' | 'reject', id}.",
  parameters: ProposeInputSchema,
  resultSchema: ProposeResultSchema,
  render: ({ toolCallId, input, respond }) => (
    <ProposeToolCard key={toolCallId} toolCallId={toolCallId} input={input} respond={respond} />
  ),
};
