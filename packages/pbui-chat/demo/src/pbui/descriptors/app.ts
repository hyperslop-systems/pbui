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

  actions: (ref) => [
    {
      label: "Open it in a tile",
      verb: { kind: "app.place", appId: ref.id },
      // A doc-bound application placed with nothing bound opens empty; it has
      // to arrive through `view.open` with its bindings instead.
      ...(ref.value?.docBound
        ? { disabledBecause: "this application is a view OF something; open it from the object it shows" }
        : {}),
    },
    {
      label: "Ask the agent to place it",
      verb: { kind: "askAgent", template: "put {0} somewhere sensible on my screen", refs: [ref] },
    },
  ],
};
