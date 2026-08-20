import type { PresentationDescriptor } from "../registry";
import { TONES } from "../types";

export const widgetDescriptor: PresentationDescriptor<"widget"> = {
  ptype: "widget",
  tone: TONES.widget,

  label: (ref) => ref.value?.title ?? `widget ${ref.id}`,

  describe: (ref) => ({ presentationType: "widget", id: ref.id, ...ref.value }),

  actions: (ref) => [
    { label: "Inspect", verb: { kind: "inspect", ref } },
    { label: "Open in tile", verb: { kind: "openInTile", widgetId: ref.id } },
    {
      label: "Ask the agent to explain it",
      verb: { kind: "askAgent", template: "explain what {0} shows", refs: [ref] },
    },
  ],
};
