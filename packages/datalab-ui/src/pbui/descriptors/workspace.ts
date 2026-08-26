import type { PresentationDescriptor } from "../registry";
import type { WorkspaceRef } from "../types";

/**
 * `<workspace>` — a named binary split tree of tiles, belonging to one stage.
 *
 * The workspace strip has ended its help text with "R for duplicate / delete"
 * since DATADROP-4, describing a feature that did not exist: `workspace` was a
 * declared presentation type with no descriptor, so right-clicking a chip
 * produced the empty menu. This file is what makes that sentence true.
 *
 * The strip's `biome-ignore` comment says the same thing from the other side —
 * double-click-to-rename "genuinely has NO keyboard route today … DATADROP-8
 * adds one". `Rename this workspace …` is that route.
 */
export const workspaceDescriptor: PresentationDescriptor<WorkspaceRef> = {
  ptype: "workspace",
  tone: "var(--pbui-tone-source)",

  label: (space) => space.name,

  describe: (space) => ({
    presentationType: "workspace",
    name: space.name,
    stage: space.stageId,
    definedInCode: space.pinned,
  }),

};
