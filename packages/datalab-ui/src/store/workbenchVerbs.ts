import type { Verb } from "../pbui/verbs";
import type { AppThunk } from "./index";
import type { ControllerResult, DatalabController } from "./controller";
import { navigationActions } from "./navigation";

/**
 * The spatial and navigation half of the verb seam, over the controller
 * (PBUI-DATALAB-WORKBENCH-1 Phase 2; the successor to the reducer-dispatching
 * half of `applyLayoutVerb.ts`).
 *
 * Each case RETURNS a thunk rather than running one, which keeps
 * `actionsForVerb` a pure function of (verb, state) — the property
 * DATADROP-8 DR-68 established — and the thunk reaches the controller
 * through the store's extra argument, so nothing here imports React or a
 * workbench instance. Returns `null` for a verb it does not own (export,
 * import, templates), so the caller falls through without a second list of
 * verb kinds to keep in step.
 */
export type WorkbenchVerbThunk = AppThunk<ControllerResult | void>;

const withController =
  (run: (controller: () => DatalabController) => ControllerResult): WorkbenchVerbThunk =>
  (_dispatch, _getState, extra) =>
    run(extra.controller);

export function actionsForWorkbenchVerb(verb: Verb): WorkbenchVerbThunk[] | null {
  switch (verb.kind) {
    case "beginRenameView":
      return [(dispatch) => void dispatch(navigationActions.beginRename(verb.placementId))];

    case "renameView":
      return [
        (dispatch, _getState, extra) => {
          dispatch(navigationActions.beginRename(null));
          return extra.controller().renameView(verb.viewId, verb.title);
        },
      ];

    // The verb is unchanged from DATADROP-8; the modal reads the invocation
    // from the navigation slice, which is what lets a serialisable tile verb
    // open it (see `LauncherInvocation`).
    case "openReplaceView":
      return [
        (dispatch) =>
          void dispatch(
            navigationActions.openLauncher({ kind: "replace", placementId: verb.placementId }),
          ),
      ];

    case "createLinkedDuplicate":
      return [withController((controller) => controller().createLinkedDuplicate(verb.placementId))];

    case "duplicateView":
      return [withController((controller) => controller().duplicateView(verb.placementId))];

    case "splitTile":
      return [withController((controller) => controller().splitTile(verb.nodeId, verb.dir))];

    case "removePlacement":
      return [withController((controller) => controller().removePlacement(verb.placementId))];

    case "closeView":
      return [withController((controller) => controller().closeView(verb.viewId))];

    case "beginRenameWorkspace":
      return [(dispatch) => void dispatch(navigationActions.beginRename(verb.spaceId))];

    case "renameWorkspace":
      return [
        (dispatch, _getState, extra) => {
          dispatch(navigationActions.beginRename(null));
          return extra.controller().renameWorkspace(verb.spaceId, verb.name);
        },
      ];

    case "duplicateWorkspace":
      return [withController((controller) => controller().cloneWorkspace(verb.spaceId))];

    case "deleteWorkspace":
      return [withController((controller) => controller().removeWorkspace(verb.spaceId))];

    // A workspace's "switch to it" and a stage's are the same verb: a
    // workspace names its stage and `selectStage` restores that stage's
    // remembered workspace.
    case "switchStage":
      return [withController((controller) => controller().selectStage(verb.stageId))];

    default:
      return null;
  }
}
