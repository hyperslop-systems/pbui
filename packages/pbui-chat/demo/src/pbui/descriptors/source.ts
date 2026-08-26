import type { PresentationDescriptor } from "../registry";
import { TONES } from "../types";

export const sourceDescriptor: PresentationDescriptor<"source"> = {
  ptype: "source",
  tone: TONES.source,

  label: (ref) => ref.value?.title ?? ref.id,

  describe: (ref) => ({ presentationType: "source", id: ref.id, ...ref.value }),

};
