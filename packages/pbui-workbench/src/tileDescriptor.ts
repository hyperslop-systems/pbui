import type { PresentationDescriptor } from "@hyperslop-systems/pbui";
import type { Node } from "@hyperslop-systems/workbench-protocol";
import { canClose as canClosePlacement } from "./verbs";
import type { Workbench } from "./types";

/**
 * The value a `<tile>` presentation carries.
 *
 * It carries what its menu needs to DECIDE, resolved by the component that
 * already knows it (the datalab `TileRef` rule): the descriptor recomputes
 * availability from these fields on every render, so `disabledBecause` is
 * always current and nothing about a verb's availability is ever stored.
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
  duplicable: boolean;
}

/**
 * The `<tile>` descriptor — REPRESENTATION ONLY since PBUI-ACTIONS-2 P7.
 *
 * The tile's verbs, and the shared `disabledBecause` wording every product
 * repeats ("a workspace keeps at least one tile"), live in
 * `workbenchTileContributions()` (`./actions.ts`), which products spread into
 * their action registries — with a `project` option when their tile value is
 * not a `TileRef`. The old options (`extra`, `launcher`) moved with them:
 * `extra` is replaced by product rules for subject "tile"; `launcher` is a
 * fragment option.
 */
export function createTileDescriptor(): PresentationDescriptor<TileRef, unknown> {
  return {
    label: (tile) => tile.title,
    describe: (tile) => `tile showing ${tile.title}`,
    tone: "neutral",
  };
}

/** The `TileRef` for one placement, read out of the workbench's current document. */
export function tileRefOf(workbench: Workbench, placementId: string): TileRef | null {
  const document = workbench.store.getState().document;
  const workspaceId = workbench.store.getState().workspaceId;
  const workspace = document.workspaces.find((item) => item.id === workspaceId);
  if (!workspace) return null;
  const viewId = findViewId(workspace.tree, placementId);
  if (!viewId) return null;
  const view = document.views[viewId];
  if (!view) return null;
  const app = workbench.apps.get(view.appId);
  let placements = 0;
  for (const item of document.workspaces) countView(item.tree, viewId, () => (placements += 1));
  return {
    placementId,
    viewId,
    appId: view.appId,
    title: view.title || app?.titleFor?.(view) || app?.title || view.appId,
    ...(view.title ? { customTitle: view.title } : {}),
    placementCount: placements,
    canClose: canClosePlacement(document, placementId),
    duplicable: app ? app.duplicable !== false && !app.singleton : true,
  };
}

function findViewId(node: Node | undefined, placementId: string): string | null {
  if (!node) return null;
  if (node.id === placementId) return node.body.case === "leaf" ? node.body.value.viewId : null;
  if (node.body.case !== "split") return null;
  return findViewId(node.body.value.a, placementId) ?? findViewId(node.body.value.b, placementId);
}

function countView(node: Node | undefined, viewId: string, hit: () => void): void {
  if (!node) return;
  if (node.body.case === "leaf") {
    if (node.body.value.viewId === viewId) hit();
    return;
  }
  if (node.body.case !== "split") return;
  countView(node.body.value.a, viewId, hit);
  countView(node.body.value.b, viewId, hit);
}
