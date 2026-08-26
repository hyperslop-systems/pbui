import type { PresentationDescriptor } from "../registry";
import { TONES } from "../types";

export const productDescriptor: PresentationDescriptor<"product"> = {
  ptype: "product",
  tone: TONES.product,

  label: (ref) => ref.value?.name ?? `product ${ref.id}`,

  describe: (ref) => ({
    presentationType: "product",
    id: ref.id,
    ...ref.value,
  }),

};
