import type { PresentationDescriptor } from "../registry";
import { TONES } from "../types";

export const metalDescriptor: PresentationDescriptor<"metal"> = {
  ptype: "metal",
  tone: TONES.metal,

  label: (ref) => ref.value?.name ?? ref.id,

  describe: (ref) => ({ presentationType: "metal", id: ref.id, ...ref.value }),

  actions: (ref) => [
    { label: "Inspect", verb: { kind: "inspect", ref } },
    {
      label: "Keep only this metal",
      verb: { kind: "addFilter", tableId: ref.value?.tableId ?? "", field: "metal", op: "=", value: ref.id },
      disabledBecause: ref.value?.tableId ? undefined : "the metal is not shown in a table",
    },
    {
      label: "Ask about the spot price",
      verb: { kind: "askAgent", template: "how has the {0} spot price moved this month?", refs: [ref] },
    },
  ],
};
