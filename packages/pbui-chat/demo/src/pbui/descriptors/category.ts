import type { PresentationDescriptor } from "../registry";
import { TONES } from "../types";

export const categoryDescriptor: PresentationDescriptor<"category"> = {
  ptype: "category",
  tone: TONES.category,

  label: (ref) => ref.value?.name ?? `category ${ref.id}`,

  describe: (ref) => ({ presentationType: "category", id: ref.id, ...ref.value }),

  actions: (ref) => [
    { label: "Inspect", verb: { kind: "inspect", ref } },
    {
      label: "Ask what sells here",
      verb: { kind: "askAgent", template: "what sells best in {0}?", refs: [ref] },
    },
    {
      label: "Keep only this category",
      verb: {
        kind: "addFilter",
        tableId: ref.value?.tableId ?? "",
        field: "category",
        op: "=",
        value: ref.value?.name ?? ref.id,
      },
      disabledBecause: ref.value?.tableId ? undefined : "the category is not shown in a table",
    },
  ],
};
