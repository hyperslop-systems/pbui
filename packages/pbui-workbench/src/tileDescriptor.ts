import type { PresentationDescriptor } from "@hyperslop-systems/pbui";
import { canClose, placementCount } from "@hyperslop-systems/workbench-core";
import { labelOfView } from "./app";
import type { WorkbenchShell } from "./types";

/**
 * The value a `<tile>` presentation carries: what its menu needs to DECIDE,
 * resolved from the current state on every render, so `disabledBecause` is
 * always current and nothing about a command's availability is ever stored.
 */
export interface TileRef {
  placementId: string;
  viewId: string;
  appId: string;
  /** The derived label: the view's own title, else the application's. */
  title: string;
  /** Set only when the user named this tile, so "Rename" can offer to clear it. */
  customTitle?: string;
  /** How many tiles show this view. Greater than one ⇒ a linked view. */
  placementCount: number;
  canClose: boolean;
  /** May a bare duplicate clone this view (else it links)? */
  duplicable: boolean;
}

/** The `<tile>` descriptor — REPRESENTATION ONLY; the verbs live in `workbenchTileContributions()`. */
export function createTileDescriptor(): PresentationDescriptor<TileRef, unknown> {
  return {
    label: (tile) => tile.title,
    describe: (tile) => `tile showing ${tile.title}`,
    tone: "neutral",
  };
}

/** The `TileRef` for one placement, read out of the core's current state. */
export function tileRefOf(workbench: WorkbenchShell, placementId: string): TileRef | null {
  const state = workbench.core.getState();
  if (state.index.workspaceByNodeId.get(placementId) !== state.session.workspaceId) return null;
  const viewId = state.index.viewByPlacementId.get(placementId);
  if (!viewId) return null;
  const view = state.document.views[viewId];
  if (!view) return null;
  const manifest = workbench.core.apps.get(view.appId);
  return {
    placementId,
    viewId,
    appId: view.appId,
    title: labelOfView(view, workbench.apps.get(view.appId)),
    ...(view.title ? { customTitle: view.title } : {}),
    placementCount: placementCount(state.index, viewId),
    canClose: canClose(state.index, placementId),
    duplicable: manifest ? manifest.viewCardinality === "many" && manifest.duplicatePlacement === "clone" : true,
  };
}
