import type { PresentationDescriptor } from "../registry";
import { TONES } from "../types";

export const rowDescriptor: PresentationDescriptor<"row"> = {
  ptype: "row",
  tone: TONES.row,

  label: (ref) => {
    const cells = ref.value?.cells ?? {};
    const name = cells.name ?? cells.title ?? cells.sku;
    return typeof name === "string" ? name : `row ${ref.value?.index ?? ref.id}`;
  },

  describe: (ref) => ({ presentationType: "row", id: ref.id, ...ref.value }),

};
