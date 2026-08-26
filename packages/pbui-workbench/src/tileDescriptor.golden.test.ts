import { describe, expect, test } from "vitest";
import { createTileDescriptor, type TileRef } from "./tileDescriptor";

/**
 * PBUI-ACTIONS-2 P0 — golden menus for the shared workbench tile descriptor.
 *
 * These freeze the exact rows (id, label, verb, danger, disabledBecause) the
 * tile menu produces today, including the informational "Shown in N tiles"
 * row and the `extra` composition seam, so the PR 3 migration to action
 * rules is reviewed as equivalence. Behavioral rules stay in
 * tileDescriptor.test.ts; this file only freezes.
 */

function ref(over: Partial<TileRef> = {}): TileRef {
  return {
    placementId: "n-1",
    viewId: "v-1",
    appId: "counter",
    title: "counter",
    placementCount: 1,
    canClose: true,
    duplicable: true,
    ...over,
  };
}

function rows(descriptor = createTileDescriptor(), value = ref()) {
  return (descriptor.actions?.(value, undefined) ?? []).map((action) => ({
    id: action.id,
    label: action.label,
    verb: action.verb,
    ...(action.danger ? { danger: true } : {}),
    ...(action.disabledBecause !== undefined ? { disabledBecause: action.disabledBecause } : {}),
  }));
}

describe("golden tile menus (PBUI-ACTIONS-2 P0)", () => {
  test("a plain tile", () => {
    expect(rows()).toMatchSnapshot();
  });

  test("a linked view (informational row included)", () => {
    expect(rows(createTileDescriptor(), ref({ placementCount: 3 }))).toMatchSnapshot();
  });

  test("the last tile (close disabled with its reason)", () => {
    expect(rows(createTileDescriptor(), ref({ canClose: false }))).toMatchSnapshot();
  });

  test("product extras append last, in the product's order", () => {
    const descriptor = createTileDescriptor({
      extra: (tile) => [
        { id: "ask", label: "Ask the agent", verb: { kind: "view.goTo", viewId: tile.viewId } },
        { id: "export", label: "Export", verb: { kind: "view.goTo", viewId: tile.viewId } },
      ],
    });
    expect(rows(descriptor)).toMatchSnapshot();
  });
});
