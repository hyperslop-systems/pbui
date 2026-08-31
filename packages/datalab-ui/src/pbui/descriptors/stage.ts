import type { PresentationDescriptor } from "../registry";
import type { StageRef } from "../types";

/**
 * `<stage>` — a named set of workspaces, an application allow-list and chrome.
 *
 * New in DATADROP-8, and the reason the switcher in the masthead is not a
 * second mechanism: the `▾` button opens *this* menu programmatically, so the
 * same list is reachable by right-click and there is exactly one place stage
 * verbs are defined.
 *
 * The menu does not list the other stages. Switching is what the `<select>`
 * beside it is for, and duplicating the stage list into a menu would give two
 * places to keep in step — the failure the whole descriptor mechanism exists to
 * avoid.
 */
export const stageDescriptor: PresentationDescriptor<StageRef> = {
  ptype: "stage",
  tone: "var(--pbui-tone-doc)",

  label: (stage) => stage.name,

  describe: (stage) => ({
    presentationType: "stage",
    name: stage.name,
    definedInCode: stage.pinned,
    current: stage.current,
  }),
};
