import type { PresentationDescriptor } from "../registry";
import { TONES } from "../types";

export const toolDescriptor: PresentationDescriptor<"tool"> = {
  ptype: "tool",
  tone: TONES.tool,

  label: (ref) => ref.value?.name ?? `tool ${ref.id}`,

  describe: (ref) => ({ presentationType: "tool", id: ref.id, ...ref.value }),

};
