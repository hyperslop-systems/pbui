import type { PresentationDescriptor } from "../registry";
import { TONES } from "../types";

export const widgetDescriptor: PresentationDescriptor<"widget"> = {
  ptype: "widget",
  tone: TONES.widget,

  label: (ref) => ref.value?.title ?? `widget ${ref.id}`,

  describe: (ref) => ({ presentationType: "widget", id: ref.id, ...ref.value }),

};
