import type { PresentationDescriptor } from "../registry";
import { TONES } from "../types";

export const proposalDescriptor: PresentationDescriptor<"proposal"> = {
  ptype: "proposal",
  tone: TONES.proposal,

  label: (ref) => ref.value?.title ?? `proposal ${ref.id}`,

  describe: (ref) => ({ presentationType: "proposal", id: ref.id, ...ref.value }),

};
