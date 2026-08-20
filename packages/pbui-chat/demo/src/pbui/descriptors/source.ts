import type { PresentationDescriptor } from "../registry";
import { TONES } from "../types";

export const sourceDescriptor: PresentationDescriptor<"source"> = {
  ptype: "source",
  tone: TONES.source,

  label: (ref) => ref.value?.title ?? ref.id,

  describe: (ref) => ({ presentationType: "source", id: ref.id, ...ref.value }),

  actions: (ref) => [
    { label: "Inspect", verb: { kind: "inspect", ref } },
    {
      label: "Ask what it says",
      verb: { kind: "askAgent", template: "quote the relevant part of {0}", refs: [ref] },
    },
  ],
};
