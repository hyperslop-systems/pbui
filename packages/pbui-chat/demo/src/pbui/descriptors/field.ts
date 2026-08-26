import type { PresentationDescriptor } from "../registry";
import { TONES } from "../types";

export const fieldDescriptor: PresentationDescriptor<"field"> = {
  ptype: "field",
  tone: TONES.field,

  label: (ref) => ref.value?.name ?? ref.id,

  describe: (ref) => ({ presentationType: "field", id: ref.id, ...ref.value }),

};
