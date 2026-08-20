import { createTileDescriptor, type TileRef } from "@hyperslop-systems/pbui-workbench";
import type { PresentationDescriptor } from "../registry";
import { TONES, type Values } from "../types";
import type { Action, Verb } from "../verbs";

/**
 * The package's tile descriptor, wearing this product's clothes.
 *
 * `createTileDescriptor` owns the verb list and — more importantly — the
 * `disabledBecause` strings, so "the last tile cannot close" is worded the
 * same in every PBUI product and the chrome buttons and the object menu can
 * never disagree about what is possible. This file only bridges two value
 * conventions: the helper speaks `TileRef`, the chat layer's descriptors
 * receive the wire `Reference` whose id IS the placement.
 */
const helper = createTileDescriptor({
  extra: (tile) => [
    {
      id: "ask",
      label: "Ask the agent about this tile",
      verb: { kind: "view.goTo", viewId: tile.viewId },
    },
  ],
});

function toTileRef(ref: Values["tile"]): TileRef {
  const value = ref.value;
  return {
    placementId: ref.id,
    viewId: value?.viewId ?? "",
    appId: value?.appId ?? "",
    title: value?.title ?? ref.id,
    ...(value?.customTitle ? { customTitle: value.customTitle } : {}),
    placementCount: value?.placementCount ?? 1,
    canClose: value?.canClose ?? false,
    duplicable: value?.duplicable ?? false,
  };
}

export const tileDescriptor: PresentationDescriptor<"tile"> = {
  ptype: "tile",
  tone: TONES.tile,

  label: (ref) => ref.value?.title ?? ref.id,

  describe: (ref) => ({ presentationType: "tile", id: ref.id, ...ref.value }),

  actions: (ref) => {
    const tile = toTileRef(ref);
    const fromHelper: Action[] = (helper.actions?.(tile, undefined) ?? []).map((action) => ({
      label: action.label,
      verb: action.verb as Verb,
      ...(action.danger ? { danger: action.danger } : {}),
      ...(action.description ? { description: action.description } : {}),
      ...(action.disabledBecause ? { disabledBecause: action.disabledBecause } : {}),
    }));
    return [
      ...fromHelper,
      {
        label: "Ask the agent to rearrange this",
        verb: {
          kind: "askAgent",
          template: "the tile showing {0} is in the wrong place — where would you put it?",
          refs: [ref],
        },
      },
    ];
  },
};
