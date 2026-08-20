import type { PresentationAction, PresentationDescriptor } from "@hyperslop-systems/pbui";
import type { Node } from "@hyperslop-systems/workbench-protocol";
import { canClose as canClosePlacement, workbenchVerbs, type WorkbenchVerb } from "./verbs";
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

export interface TileDescriptorOptions {
  /** Product verbs to append — the chat's `askAgent`, a product's `inspect`. */
  extra?(tile: TileRef): readonly PresentationAction<WorkbenchVerb>[];
  /** Offer "Replace application…" and "Link here…" through the per-pane launcher. Default true. */
  launcher?: boolean;
}

/**
 * The `<tile>` descriptor, so a tile's title bar and its object menu are two
 * doors to one set of verbs.
 *
 * Every product in the family minted this by hand and three of them got a
 * different subset; putting it in the package makes the tile a first-class
 * object everywhere, with the same verbs and the same reasons when a verb is
 * unavailable. A product adds its own through `extra` and changes nothing
 * else.
 *
 * It takes no workbench, which is the point: a `TileRef` already carries
 * everything its menu needs to decide (the datalab rule), so the descriptor
 * is a pure function of the value and can be tested without a store, a
 * document or a DOM. `tileRefOf` is where a workbench is read.
 */
export function createTileDescriptor(
  options: TileDescriptorOptions = {},
): PresentationDescriptor<TileRef, unknown, WorkbenchVerb> {
  const useLauncher = options.launcher ?? true;
  return {
    label: (tile) => tile.title,
    describe: (tile) => `tile showing ${tile.title}`,
    tone: "neutral",
    actions: (tile) => {
      const actions: PresentationAction<WorkbenchVerb>[] = [
        {
          id: "split-row",
          label: "Split beside",
          verb: workbenchVerbs.split(tile.placementId, "row"),
          group: "layout",
        },
        {
          id: "split-col",
          label: "Split below",
          verb: workbenchVerbs.split(tile.placementId, "col"),
          group: "layout",
        },
      ];

      if (useLauncher) {
        actions.push({
          id: "replace",
          label: "Show something else here…",
          description: "opens the launcher aimed at this tile",
          verb: workbenchVerbs.openLauncher(tile.placementId),
          group: "layout",
        });
      }

      actions.push({
        id: "duplicate",
        label: "Duplicate",
        description: "a second tile with its own state",
        verb: workbenchVerbs.split(tile.placementId, "row"),
        group: "view",
        // A singleton or a non-duplicable application LINKS instead — the
        // split verb is the same, so say which one it will be rather than
        // offering a duplicate that silently links.
        ...(tile.duplicable ? {} : { disabledBecause: "this application shows one view; splitting links a second tile to it" }),
      });

      actions.push({
        id: "rename",
        label: tile.customTitle ? "Rename…" : "Name this tile…",
        // The empty title is the CLEAR: a product's inline rename supplies
        // the real one, and the verb is the same either way.
        verb: workbenchVerbs.setTitle(tile.viewId, tile.customTitle ?? ""),
        group: "view",
      });

      if (tile.placementCount > 1) {
        actions.push({
          id: "linked",
          label: `Shown in ${tile.placementCount} tiles`,
          description: "the same view; changes appear in both",
          verb: workbenchVerbs.goTo(tile.viewId),
          group: "view",
          disabledBecause: "this is a description, not an action",
        });
      }

      actions.push({
        id: "close",
        label: "Close tile",
        verb: workbenchVerbs.close(tile.placementId),
        group: "layout",
        danger: true,
        ...(tile.canClose ? {} : { disabledBecause: "a workspace keeps at least one tile" }),
      });

      return [...actions, ...(options.extra?.(tile) ?? [])];
    },
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
