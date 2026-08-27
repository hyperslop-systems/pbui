import { describe, expect, test } from "vitest";
import { createWorkbench } from "./createWorkbench";
import { layout, singleTile, split, tile } from "./document";
import { demoApps } from "./stories/demoApps";
import { createTileDescriptor, tileRefOf, type TileRef } from "./tileDescriptor";
import { leaves } from "@hyperslop-systems/workbench-protocol/client";

const descriptor = createTileDescriptor();

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

describe("createTileDescriptor — representation only since PBUI-ACTIONS-2 P7", () => {
  test("labels a tile by its title; verbs live in workbenchTileContributions", () => {
    expect(descriptor.label(ref({ title: "inventory" }), undefined)).toBe("inventory");
    expect(descriptor.describe?.(ref({ title: "inventory" }), undefined)).toBe(
      "tile showing inventory",
    );
    // The tombstoned callback is absent — the kernel fragment is the one
    // source of tile verbs (see actions.test.ts for the row spec).
    expect((descriptor as { actions?: unknown }).actions).toBeUndefined();
  });

  test("the descriptor is pure: no workbench, no document, no DOM", () => {
    expect(createTileDescriptor.length).toBeLessThanOrEqual(1);
  });
});

describe("tileRefOf", () => {
  test("reads the tile's state out of the workbench", () => {
    const wb = createWorkbench({ apps: demoApps, initial: layout(split("row", 0.5, tile("counter"), tile("notes"))) });
    const [first] = leaves(wb.store.getState().document.workspaces[0]?.tree).map((leaf) => leaf.id);
    const value = tileRefOf(wb, first!)!;
    expect(value).toMatchObject({ placementId: first, appId: "counter", title: "counter", placementCount: 1, canClose: true, duplicable: true });
    expect(value.customTitle).toBeUndefined();
  });

  test("a singleton is not duplicable, and the last tile cannot close", () => {
    const wb = createWorkbench({ apps: demoApps, initial: singleTile("notes") });
    const [only] = leaves(wb.store.getState().document.workspaces[0]?.tree).map((leaf) => leaf.id);
    expect(tileRefOf(wb, only!)).toMatchObject({ duplicable: false, canClose: false });
  });

  test("a linked view reports its placement count and a named tile its custom title", () => {
    const wb = createWorkbench({ apps: demoApps, initial: layout(split("row", 0.5, tile("notes"), tile("counter"))) });
    const [notes] = leaves(wb.store.getState().document.workspaces[0]?.tree).map((leaf) => leaf.id);
    wb.verbs.split(notes!, "col");
    const value = tileRefOf(wb, notes!)!;
    expect(value.placementCount).toBe(2);
    wb.verbs.setTitle(value.viewId, "left");
    expect(tileRefOf(wb, notes!)).toMatchObject({ customTitle: "left", title: "left" });
  });

  test("an unknown placement is null, not a throw", () => {
    const wb = createWorkbench({ apps: demoApps, initial: singleTile("counter") });
    expect(tileRefOf(wb, "n-nope")).toBeNull();
  });
});
