import type { PresentationDescriptor } from "../registry";
import { TONES } from "../types";

export const orderDescriptor: PresentationDescriptor<"order"> = {
  ptype: "order",
  tone: TONES.order,

  label: (ref) => (ref.value?.customer ? `order ${ref.id} · ${ref.value.customer}` : `order ${ref.id}`),

  describe: (ref) => ({ presentationType: "order", id: ref.id, ...ref.value }),

  actions: (ref) => [
    { label: "Inspect", verb: { kind: "inspect", ref } },
    { label: "Add to watchlist", verb: { kind: "watch", ref } },
    {
      label: "Ask where it is",
      verb: { kind: "askAgent", template: "what is the status of {0}?", refs: [ref] },
    },
  ],
};
