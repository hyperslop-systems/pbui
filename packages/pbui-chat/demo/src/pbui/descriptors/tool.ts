import type { PresentationDescriptor } from "../registry";
import { TONES } from "../types";

export const toolDescriptor: PresentationDescriptor<"tool"> = {
  ptype: "tool",
  tone: TONES.tool,

  label: (ref) => ref.value?.name ?? `tool ${ref.id}`,

  describe: (ref) => ({ presentationType: "tool", id: ref.id, ...ref.value }),

  actions: (ref) => [
    { label: "Inspect", verb: { kind: "inspect", ref } },
    {
      label: "Re-run",
      verb: { kind: "rerunTool", toolCallId: ref.id },
      disabledBecause:
        ref.value?.status && !["success", "finished", "failed"].includes(ref.value.status)
          ? "the tool is still running"
          : undefined,
    },
    {
      label: "Ask why it was called",
      verb: { kind: "askAgent", template: "why did you call {0}, and what did it return?", refs: [ref] },
    },
  ],
};
