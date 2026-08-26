import type { PresentationDescriptor } from "../registry";
import { TONES } from "../types";

/**
 * An application, as an object — so "open the inventory" has something to
 * point at, and the launcher's rows and a chat mention name the same thing.
 */
export const appDescriptor: PresentationDescriptor<"app"> = {
  ptype: "app",
  tone: TONES.app,

  label: (ref) => ref.value?.title ?? ref.id,

  describe: (ref) => ({ presentationType: "app", id: ref.id, ...ref.value }),

};
