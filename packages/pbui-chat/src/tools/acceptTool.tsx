import type { HumanTool } from "@go-go-golems/chat-provider";
import { useEffect, useRef } from "react";
import { z } from "zod";
import { usePbuiChat } from "../context";
import type { Reference } from "../types";
import { fromPresentationReference } from "../types";
import { ReferenceSchema } from "../vocabulary/schemas";
import { AcceptStatus } from "./AcceptStatus";

export const ACCEPT_TOOL_NAME = "pbui_accept";

export const AcceptInputSchema = z.object({
  types: z.array(z.string()).min(1).describe("presentation types the agent will accept"),
  prompt: z.string().describe("what to ask the user to pick"),
});
export type AcceptInput = z.infer<typeof AcceptInputSchema>;

export const AcceptResultSchema = z.union([
  z.object({ reference: ReferenceSchema }),
  z.object({ cancelled: z.literal(true) }),
]);
export type AcceptResult = { reference: Reference } | { cancelled: true };

function AcceptToolCard({ input, respond }: { input: AcceptInput; respond(result: AcceptResult): void }) {
  const chat = usePbuiChat();
  const pbui = chat.pbui.usePbui();
  const started = useRef(false);
  const respondRef = useRef(respond);
  respondRef.current = respond;

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void pbui
      .accept({ types: input.types, prompt: input.prompt })
      .then((picked) => {
        if (picked) respondRef.current({ reference: fromPresentationReference(picked) });
        else respondRef.current({ cancelled: true });
      });
    // The request is issued once per tool call; `input` is fixed for its lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <AcceptStatus types={input.types} prompt={input.prompt} />;
}

/**
 * `pbui_accept`: the agent asks the user to point at something. On mount the
 * card enters pbui's accept mode (conversions come from the product's
 * `createPbui`), and the tool result is the picked wire reference or
 * `{ cancelled: true }` when the user pressed Escape.
 */
export const pbuiAcceptTool: HumanTool<AcceptInput, AcceptResult> = {
  name: ACCEPT_TOOL_NAME,
  mode: "human",
  description:
    "Ask the user to pick an object of one of the given presentation types by clicking it. Returns the picked reference, or {cancelled: true}.",
  parameters: AcceptInputSchema,
  resultSchema: AcceptResultSchema as unknown as z.ZodType<AcceptResult>,
  render: ({ toolCallId, input, respond }) => <AcceptToolCard key={toolCallId} input={input} respond={respond} />,
};
