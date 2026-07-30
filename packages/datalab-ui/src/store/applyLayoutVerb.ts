import type { Verb } from "../pbui/verbs";
import { beginImport, exportStage, exportTile, exportWorkspace, storeTemplate } from "./effects";
import { layoutActions, type LayoutState } from "./layout";
import type { VerbResult } from "./applyVerb";

/**
 * The layout half of the verb seam.
 *
 * `applyVerb.ts` keeps ownership of the switch and delegates here, which
 * preserves the property that file was written for — **one place maps a verb to
 * a consequence**, so adding a verb means adding one case rather than threading
 * a dispatch through fourteen descriptors — while keeping neither file a
 * 400-line switch.
 *
 * Returns `null` for a verb it does not own, so the caller can fall through to
 * the world cases without a second list of verb kinds to keep in step.
 *
 * Half of these are plain actions and half are thunks. The function stays pure
 * either way: it *returns* a thunk, it never runs one (DR-68).
 */
export function actionsForLayoutVerb(verb: Verb, layout: LayoutState): VerbResult[] | null {
  const a = layoutActions;

  switch (verb.kind) {
    case "beginRenameView":
      return [a.beginRename(verb.placementId)];

    case "renameView":
      return [a.renameView({ viewId: verb.viewId, title: verb.title })];

    case "openReplaceView":
      return [a.beginReplace(verb.placementId)];

    case "createLinkedDuplicate":
      return [a.createLinkedDuplicate(verb.placementId)];

    case "duplicateView":
      return [a.duplicateView(verb.placementId)];

    case "splitTile":
      return [a.splitLeaf({ nodeId: verb.nodeId, dir: verb.dir })];

    case "removePlacement":
      return [a.closeLeaf(verb.placementId)];

    case "closeView":
      return [a.closeView(verb.viewId)];

    case "exportTile":
      return [exportTile(verb.nodeId)];

    case "importIntoTile":
      return [beginImport({ kind: "tile", nodeId: verb.nodeId })];

    case "beginRenameWorkspace":
      return [a.beginRename(verb.spaceId)];

    case "renameWorkspace":
      return [a.renameSpace({ spaceId: verb.spaceId, name: verb.name })];

    case "duplicateWorkspace":
      return [a.cloneSpace(verb.spaceId)];

    case "deleteWorkspace":
      return [a.removeSpace(verb.spaceId)];

    case "exportWorkspace":
      return [exportWorkspace(verb.spaceId)];

    case "importWorkspace":
      return [beginImport({ kind: "workspace", stageId: verb.stageId })];

    case "switchStage":
      // A workspace's "switch to it" and a stage's are the same verb, because a
      // workspace names its stage and `setCurrentStage` restores that stage's
      // remembered workspace. Switching to a workspace in ANOTHER stage is
      // `setCurrentSpace`, which switches the stage too.
      return [a.setCurrentStage(verb.stageId)];

    case "exportStage":
      return [exportStage(verb.stageId)];

    case "importStage":
      return [beginImport({ kind: "stage" })];

    case "storeTemplate":
      return [storeTemplate(verb.source, verb.name)];

    default:
      // Not a layout verb. `layout` is unused in that case and is taken anyway,
      // because a verb that needs to consult the current arrangement — "is this
      // the last workspace" — belongs here rather than in the descriptor, and
      // the parameter being present is what will keep it here.
      void layout;
      return null;
  }
}
