import type { PresentationDescriptor } from "../registry";
import { TONES } from "../types";

export const orderDescriptor: PresentationDescriptor<"order"> = {
  ptype: "order",
  tone: TONES.order,

  label: (ref) => (ref.value?.customer ? `order ${ref.id} · ${ref.value.customer}` : `order ${ref.id}`),

  describe: (ref) => ({ presentationType: "order", id: ref.id, ...ref.value }),

};
