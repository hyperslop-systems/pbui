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

function actionIds(value: TileRef): string[] {
  return [...(descriptor.actions?.(value, undefined) ?? [])].map((action) => action.id);
}

function actionOf(value: TileRef, id: string) {
  return descriptor.actions?.(value, undefined).find((action) => action.id === id);
}

describe("createTileDescriptor (5.G)", () => {
  test("labels a tile by its title and offers the layout verbs", () => {
    expect(descriptor.label(ref({ title: "inventory" }), undefined)).toBe("inventory");
    expect(actionIds(ref())).toEqual(["split-row", "split-col", "replace", "duplicate", "rename", "close"]);
  });

  test("every action's verb is a workbench verb aimed at this tile", () => {
    const actions = descriptor.actions?.(ref(), undefined) ?? [];
    expect(actions.map((a) => a.verb.kind)).toEqual([
      "tile.split",
      "tile.split",
      "launcher.open",
      "tile.split",
      "view.setTitle",
      "tile.close",
    ]);
    expect(actionOf(ref(), "close")?.verb).toEqual({ kind: "tile.close", placementId: "n-1" });
  });

  test("the last tile's close says why, and is the only danger", () => {
    expect(actionOf(ref(), "close")?.disabledBecause).toBeUndefined();
    expect(actionOf(ref({ canClose: false }), "close")?.disabledBecause).toBe("a workspace keeps at least one tile");
    const dangerous = (descriptor.actions?.(ref(), undefined) ?? []).filter((a) => a.danger);
    expect(dangerous.map((a) => a.id)).toEqual(["close"]);
  });

  test("a non-duplicable application says the split will link instead", () => {
    expect(actionOf(ref(), "duplicate")?.disabledBecause).toBeUndefined();
    expect(actionOf(ref({ duplicable: false }), "duplicate")?.disabledBecause).toMatch(/splitting links/);
  });

  test("a linked view gains a row naming how many tiles show it", () => {
    expect(actionIds(ref())).not.toContain("linked");
    const linked = actionOf(ref({ placementCount: 3 }), "linked");
    expect(linked?.label).toBe("Shown in 3 tiles");
  });

  test("rename offers to name an unnamed tile and to rename a named one", () => {
    expect(actionOf(ref(), "rename")?.label).toBe("Name this tile…");
    expect(actionOf(ref({ customTitle: "left" }), "rename")?.label).toBe("Rename…");
  });

  test("the launcher action can be turned off", () => {
    const bare = createTileDescriptor({ launcher: false });
    expect(bare.actions?.(ref(), undefined).map((a) => a.id)).not.toContain("replace");
  });

  test("extra appends the product's own verbs, last", () => {
    const withExtra = createTileDescriptor({
      extra: (t) => [{ id: "ask", label: "Ask the agent", verb: { kind: "view.goTo", viewId: t.viewId } }],
    });
    const ids = withExtra.actions?.(ref(), undefined).map((a) => a.id) ?? [];
    expect(ids[ids.length - 1]).toBe("ask");
  });

  test("the descriptor is pure: no workbench, no document, no DOM", () => {
    // The whole suite above proves it; this pins the signature so a future
    // change that needs live state has to be deliberate.
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
