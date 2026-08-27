import type { PresentationDescriptor } from "../registry";
import { TONES } from "../types";

export const traceEntryDescriptor: PresentationDescriptor<"traceEntry"> = {
  ptype: "traceEntry",
  tone: TONES.traceEntry,

  label: (ref) => `#${ref.value?.seq ?? ref.id} ${String(ref.value?.verb?.kind ?? "")}`.trim(),

  describe: (ref) => ({ presentationType: "traceEntry", id: ref.id, ...ref.value }),

};
