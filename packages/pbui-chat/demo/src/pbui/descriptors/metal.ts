import type { PresentationDescriptor } from "../registry";
import { TONES } from "../types";

export const metalDescriptor: PresentationDescriptor<"metal"> = {
  ptype: "metal",
  tone: TONES.metal,

  label: (ref) => ref.value?.name ?? ref.id,

  describe: (ref) => ({ presentationType: "metal", id: ref.id, ...ref.value }),

};
