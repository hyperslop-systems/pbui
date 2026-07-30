import type { PresentationDescriptor } from "../registry";
import type { TileRef } from "../types";
import type { Action } from "../verbs";

/**
 * `<tile>` — one leaf of a workspace: an application, an optional document, an
 * optional name.
 *
 * `tile` has been a declared presentation type since DATADROP-4, and `Tile.tsx`
 * has been wrapping its title in a real `<Presentation ptype="tile">` for just
 * as long. What was missing was this file and one line in the registry, so
 * right-clicking a tile produced "no verbs for this object yet" — the empty
 * menu `ObjectMenu.tsx` renders when `actionsFor` returns nothing.
 *
 * **No buttons were added to the tile title bar, and that was the point.** It
 * already holds a drag grip, a title and three buttons; duplicate, rename,
 * export and import would make seven controls on a bar 22
 * pixels tall in a tile that may be 200 pixels wide. They are verbs of the
 * tile, the tile is already a presentation, and the object menu is where verbs
 * go.
 *
 * Everything it needs to decide is on the value (see `TileRef`), so this stays
 * a pure function testable with a literal and no store.
 */
export const tileDescriptor: PresentationDescriptor<TileRef> = {
  ptype: "tile",
  tone: "var(--pbui-tone-neutral)",

  label: (tile) => tile.title,

  describe: (tile) => ({
    presentationType: "tile",
    title: tile.title,
    application: tile.app,
    named: tile.customTitle !== undefined,
    document: tile.docId,
    duplicable: tile.duplicable,
  }),

  actions: (tile) => {
    const actions: Action[] = [];

    actions.push({
      label: "Replace …",
      verb: { kind: "openReplaceView", placementId: tile.placementId },
    });

    actions.push({
      label: "Rename …",
      verb: { kind: "beginRenameView", viewId: tile.viewId },
    });

    actions.push({
      label: "Create linked duplicate",
      verb: { kind: "createLinkedDuplicate", placementId: tile.placementId },
    });

    actions.push({
      label: "Duplicate",
      verb: { kind: "duplicateView", placementId: tile.placementId },
      // Shown greyed with the reason rather than hidden: a user who never sees
      // Duplicate on a trace tile does not learn that the trace is the same in
      // every tile, they conclude the feature is missing.
      ...(tile.duplicable
        ? {}
        : { disabledBecause: `a second ${tile.app} tile would show the same thing` }),
    });

    actions.push({
      label: "Split right",
      verb: { kind: "splitTile", nodeId: tile.placementId, dir: "row" },
    });
    actions.push({
      label: "Split below",
      verb: { kind: "splitTile", nodeId: tile.placementId, dir: "col" },
    });

    actions.push({
      label: "Copy view to clipboard",
      verb: { kind: "exportTile", nodeId: tile.placementId },
    });
    actions.push({
      label: "Replace from clipboard …",
      verb: { kind: "importIntoTile", nodeId: tile.placementId },
    });
    actions.push({
      label: "Save as a template …",
      verb: {
        kind: "storeTemplate",
        source: { kind: "tile", nodeId: tile.placementId },
        name: tile.title,
      },
    });

    actions.push({ label: "Inspect", verb: { kind: "inspect", ptype: "tile", value: tile } });

    actions.push({
      label: "Remove from this workspace",
      verb: { kind: "removePlacement", placementId: tile.placementId },
      ...(tile.canClose ? {} : { disabledBecause: "the last tile in a workspace cannot close" }),
    });

    actions.push({
      label: tile.placementCount > 1 ? "Close view everywhere" : "Close view",
      verb: { kind: "closeView", viewId: tile.viewId },
    });

    return actions;
  },
};
