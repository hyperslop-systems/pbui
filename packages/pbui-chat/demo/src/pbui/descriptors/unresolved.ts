import type { PresentationDescriptor } from "../registry";
import { TONES } from "../types";

/**
 * A mention the server could not resolve STILL renders as a presentation:
 * neutral tone, the label the model wrote, and one verb — ask the agent
 * what it meant. Nothing the model says can break the page.
 */
export const unresolvedDescriptor: PresentationDescriptor<"unresolved"> = {
  ptype: "unresolved",
  tone: TONES.unresolved,

  label: (ref) => ref.value?.label ?? `${ref.value?.type ?? "?"}:${ref.value?.id ?? ref.id}`,

  describe: (ref) => ({ presentationType: "unresolved", ...ref.value, note: "the server could not resolve this mention" }),

};
