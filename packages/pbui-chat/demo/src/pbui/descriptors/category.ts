import type { PresentationDescriptor } from "../registry";
import { TONES } from "../types";

export const categoryDescriptor: PresentationDescriptor<"category"> = {
  ptype: "category",
  tone: TONES.category,

  label: (ref) => ref.value?.name ?? `category ${ref.id}`,

  describe: (ref) => ({ presentationType: "category", id: ref.id, ...ref.value }),

};
