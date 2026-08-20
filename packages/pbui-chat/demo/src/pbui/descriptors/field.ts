import type { PresentationDescriptor } from "../registry";
import { TONES } from "../types";

export const fieldDescriptor: PresentationDescriptor<"field"> = {
  ptype: "field",
  tone: TONES.field,

  label: (ref) => ref.value?.name ?? ref.id,

  describe: (ref) => ({ presentationType: "field", id: ref.id, ...ref.value }),

  actions: (ref) => {
    const tableId = ref.value?.tableId ?? ref.id.split(".")[0] ?? "";
    const field = ref.value?.name ?? ref.id.split(".").slice(1).join(".");
    return [
      { label: "Inspect", verb: { kind: "inspect", ref } },
      { label: "Sort ascending", verb: { kind: "sortBy", tableId, field, dir: "asc" } },
      { label: "Sort descending", verb: { kind: "sortBy", tableId, field, dir: "desc" } },
      { label: "Hide empty values", verb: { kind: "addFilter", tableId, field, op: "!=", value: "" } },
      {
        label: "Ask what it means",
        verb: { kind: "askAgent", template: "what does the {0} column mean, and how is it computed?", refs: [ref] },
      },
    ];
  },
};
