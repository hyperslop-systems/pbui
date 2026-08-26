import type { PresentationDescriptor } from "../registry";
import { TONES } from "../types";

/**
 * `<tile>` — representation only since PBUI-ACTIONS-2 P4.
 *
 * The tile's verbs — and, more importantly, the shared `disabledBecause`
 * wording ("a workspace keeps at least one tile") — come from
 * `workbenchTileContributions()` in the action registry (`../actions.ts`),
 * consumed through a `project` mapping from this product's wire reference to
 * the canonical `TileRef`. The chrome buttons and the object menu still
 * cannot disagree about what is possible; the single source just moved from
 * `createTileDescriptor` to the shared contribution fragment.
 */
export const tileDescriptor: PresentationDescriptor<"tile"> = {
  ptype: "tile",
  tone: TONES.tile,

  label: (ref) => ref.value?.title ?? ref.id,

  describe: (ref) => ({ presentationType: "tile", id: ref.id, ...ref.value }),
};
