import { library } from "../../sandbox";
import type { PresentationDescriptor } from "../registry";
import { TONES } from "../types";

/** A generated action, as an object, so it too has a menu: inspect, remove, ask. */
export const actionDescriptor: PresentationDescriptor<"action"> = {
  ptype: "action",
  tone: TONES.action,

  label: (ref) => ref.value?.label ?? `action ${ref.id}`,

  describe: (ref) => {
    const record = library.getState().actions[ref.id];
    return { presentationType: "action", ...ref.value, ...(record ?? { missing: "not in this browser's library" }), id: ref.id };
  },

};
