import type { PresentationDescriptor } from "../registry";
import type { TileRef } from "../types";

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
};
