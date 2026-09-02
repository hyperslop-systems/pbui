import { afterEach, describe, expect, it, vi } from "vitest";
import { documentSlotPort } from "@hyperslop-systems/pbui";
import { leaves, workspaceTree } from "@hyperslop-systems/workbench-protocol/client";
import { defineApp } from "./apps";
import { createWorkbench } from "./createWorkbench";
import { describeWorkbench } from "./describe";
import { layout, singleTile, specOf, split, tile, workspaces, type LayoutSpec } from "./document";
import { demoApps } from "./stories/demoApps";

/*
 * The contract these tests defend is the round trip: a description an agent
 * reads must go back into `layout()` unchanged, or "make the right column
 * narrower" becomes "rebuild the workspace from memory".
 */

// A doc-bound application, which the demo pair has none of: a document-slot
// port is exactly what tells a caller a tile needs a document before it is
// worth placing (`bindings`/`docBound` are derived from it since PBUI-LINK-1).
const skuApp = defineApp({
  id: "sku",
  title: "SKU",
  tone: "var(--pbui-cat-1)",
  singleton: false,
  ports: [documentSlotPort("product", "the product this tile details")],
  blurb: "one product, in detail",
  group: "shop",
  titleFor: (view) => `SKU ${view.documents["product"] ?? "?"}`,
  Component: () => null,
});

const apps = [...demoApps, skuApp];

function placements(wb: ReturnType<typeof createWorkbench>): string[] {
  return leaves(workspaceTree(wb.store.getState().document, wb.store.getState().workspaceId)).map((leaf) => leaf.id);
}

function fakeRect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({}),
  } as DOMRect;
}

/** A root of `[data-placement-id]` boxes, so geometry can be tested without a renderer. */
function mountFakeSurface(wb: ReturnType<typeof createWorkbench>, boxes: Record<string, DOMRect>, rootRect: DOMRect) {
  const root = window.document.createElement("div");
  root.getBoundingClientRect = () => rootRect;
  for (const [placementId, rect] of Object.entries(boxes)) {
    const cell = window.document.createElement("div");
    cell.dataset["placementId"] = placementId;
    cell.getBoundingClientRect = () => rect;
    root.appendChild(cell);
  }
  window.document.body.appendChild(root);
  wb.setRoot(root);
  return root;
}

afterEach(() => {
  window.document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("specOf", () => {
  it("round-trips a single tile, with and without its optional fields", () => {
    const bare: LayoutSpec = tile("counter");
    const doc = layout(bare);
    expect(specOf(doc, doc.workspaces[0]!.tree!)).toEqual(bare);

    const full: LayoutSpec = tile("sku", { documents: { product: "2051" }, title: "Gold 1oz" });
    const richDoc = layout(full);
    expect(specOf(richDoc, richDoc.workspaces[0]!.tree!)).toEqual(full);
  });

  it("omits documents and title rather than emitting empty ones", () => {
    const doc = layout(tile("counter"));
    const spec = specOf(doc, doc.workspaces[0]!.tree!);
    expect(Object.keys(spec)).toEqual(["kind", "appId"]);
  });

  it("round-trips a nested split tree with its directions and ratios", () => {
    const spec = split(
      "row",
      0.6,
      tile("counter"),
      split("col", 0.34, tile("notes"), split("col", 0.5, tile("counter", { title: "second" }), tile("sku", { documents: { product: "1" } }))),
    );
    const doc = layout(spec);
    expect(specOf(doc, doc.workspaces[0]!.tree!)).toEqual(spec);
  });

  it("survives a document whose view has been deleted out from under a leaf", () => {
    const doc = layout(split("row", 0.5, tile("counter"), tile("notes")));
    const leaf = leaves(doc.workspaces[0]!.tree)[0]!;
    const viewId = leaf.body.case === "leaf" ? leaf.body.value.viewId : "";
    delete doc.views[viewId];
    const spec = specOf(doc, doc.workspaces[0]!.tree!);
    expect(spec).toEqual({
      kind: "split",
      direction: "row",
      ratio: 0.5,
      // Empty appId: anything that validates against the registry refuses it
      // loudly instead of re-creating a broken tile as a real one.
      a: { kind: "tile", appId: "", title: `missing view ${viewId}` },
      b: { kind: "tile", appId: "notes" },
    });
  });
});

describe("describeWorkbench", () => {
  it("names every registered application, with the fields a chooser needs", () => {
    const wb = createWorkbench({ apps, initial: singleTile("counter") });
    const description = describeWorkbench(wb);
    expect(description.apps.map((app) => app.id)).toEqual(["counter", "notes", "sku"]);
    expect(description.apps[2]).toEqual({
      id: "sku",
      title: "SKU",
      singleton: false,
      // Derived from the document-slot port (PBUI-LINK-1), so the reader who
      // only asks "what must I bind" keeps its two fields…
      docBound: true,
      bindings: ["product"],
      // …and the reader who links learns the port itself.
      ports: [{ name: "product", direction: "in", valueType: "document", role: "document.product", doc: "the product this tile details", documentSlot: true }],
      blurb: "one product, in detail",
      group: "shop",
    });
    // Absent fields stay absent rather than reading as `undefined`; a value port is not a binding.
    expect(description.apps[0]).toEqual({
      id: "counter",
      title: "counter",
      singleton: false,
      docBound: false,
      ports: [{ name: "count", direction: "out", valueType: "number", role: "number", doc: "the count, each time the button is pressed" }],
    });
  });

  it("names every tile with the id its verbs take and the title its chrome shows", () => {
    const wb = createWorkbench({
      apps,
      initial: layout(split("row", 0.6, tile("counter"), tile("sku", { documents: { product: "2051" } }))),
    });
    const [first, second] = placements(wb);
    wb.verbs.activate(second!);

    const description = describeWorkbench(wb);
    expect(description.activePlacementId).toBe(second);
    expect(description.activeWorkspaceId).toBe(wb.store.getState().workspaceId);
    expect(description.workspaces).toHaveLength(1);

    const workspace = description.workspaces[0]!;
    expect(workspace.active).toBe(true);
    expect(workspace.tiles.map((item) => item.placementId)).toEqual([first, second]);
    expect(workspace.tiles[0]!.appId).toBe("counter");
    expect(workspace.tiles[0]!.title).toBe("counter");
    // titleFor wins over the application's own title, exactly as the tile bar
    // resolves it; a fourth spelling would make "close the SKU 2051 tile" miss.
    expect(workspace.tiles[1]!.title).toBe("SKU 2051");
    expect(workspace.tiles[1]!.documents).toEqual({ product: "2051" });
    expect(workspace.tiles.every((item) => item.linkedPlacements === 1)).toBe(true);
  });

  it("describes the tree in the dialect layout() accepts, and the splits by id", () => {
    const spec = split("row", 0.6, tile("counter"), split("col", 0.34, tile("notes"), tile("counter")));
    const wb = createWorkbench({ apps, initial: layout(spec) });
    const description = describeWorkbench(wb);
    const workspace = description.workspaces[0]!;
    expect(workspace.tree).toEqual(spec);

    // Re-creating from the description gives the same shape with fresh ids.
    const recreated = layout(workspace.tree);
    expect(specOf(recreated, recreated.workspaces[0]!.tree!)).toEqual(spec);

    expect(workspace.splits.map((item) => ({ direction: item.direction, ratio: item.ratio }))).toEqual([
      { direction: "row", ratio: 0.6 },
      { direction: "col", ratio: 0.34 },
    ]);
    // The splitIds are the node ids `split.resize` takes.
    const resized = wb.verbs.resize(workspace.splits[1]!.splitId, 0.7, { snap: false });
    expect(resized).toBe(0.7);
    expect(describeWorkbench(wb).workspaces[0]!.splits[1]!.ratio).toBeCloseTo(0.7);
  });

  it("counts a linked view as two placements", () => {
    const wb = createWorkbench({ apps, initial: layout(split("row", 0.5, tile("notes"), tile("counter"))) });
    const [notesPlacement] = placements(wb);
    // notes is a singleton: splitting it links a second placement of one view.
    const linked = wb.verbs.split(notesPlacement!, "col")!;
    const tiles = describeWorkbench(wb).workspaces[0]!.tiles;
    const notesTiles = tiles.filter((item) => item.appId === "notes");
    expect(notesTiles).toHaveLength(2);
    expect(new Set(notesTiles.map((item) => item.viewId)).size).toBe(1);
    expect(notesTiles.map((item) => item.linkedPlacements)).toEqual([2, 2]);
    expect(tiles.find((item) => item.placementId === linked)?.linkedPlacements).toBe(2);
    expect(tiles.find((item) => item.appId === "counter")?.linkedPlacements).toBe(1);
  });

  it("describes every workspace, and marks the one on screen", () => {
    const wb = createWorkbench({
      apps,
      initial: workspaces([
        { id: "ws-a", name: "one", spec: tile("counter") },
        { id: "ws-b", name: "two", spec: split("row", 0.5, tile("counter"), tile("sku")) },
      ]),
    });
    expect(describeWorkbench(wb).workspaces.map((item) => [item.id, item.name, item.active])).toEqual([
      ["ws-a", "one", true],
      ["ws-b", "two", false],
    ]);
    wb.verbs.selectWorkspace("ws-b");
    const after = describeWorkbench(wb);
    expect(after.activeWorkspaceId).toBe("ws-b");
    expect(after.workspaces.map((item) => item.active)).toEqual([false, true]);
  });

  it("narrows to one workspace, and describes none for an id nothing has", () => {
    const wb = createWorkbench({
      apps,
      initial: workspaces([
        { id: "ws-a", name: "one", spec: tile("counter") },
        { id: "ws-b", name: "two", spec: tile("notes") },
      ]),
    });
    expect(describeWorkbench(wb, { workspaceId: "ws-b" }).workspaces.map((item) => item.id)).toEqual(["ws-b"]);

    // Not a silent widening to all of them: an empty list is what lets a
    // caller answer `unknown workspace "ws-nope"`.
    const missing = describeWorkbench(wb, { workspaceId: "ws-nope" });
    expect(missing.workspaces).toEqual([]);
    expect(missing.activeWorkspaceId).toBe("ws-a");
    expect(missing.apps).toHaveLength(3);
  });

  it("keeps a placement whose view vanished addressable", () => {
    const wb = createWorkbench({ apps, initial: layout(split("row", 0.5, tile("counter"), tile("notes"))) });
    const doc = wb.store.getState().document;
    const leaf = leaves(doc.workspaces[0]!.tree)[0]!;
    const viewId = leaf.body.case === "leaf" ? leaf.body.value.viewId : "";
    delete doc.views[viewId];
    const broken = describeWorkbench(wb).workspaces[0]!.tiles[0]!;
    expect(broken.placementId).toBe(leaf.id);
    expect(broken.appId).toBe("");
    expect(broken.title).toBe(`missing view ${viewId}`);
    expect(broken.linkedPlacements).toBe(0);
  });

  it("omits the document unless it is asked for", () => {
    const wb = createWorkbench({ apps, initial: singleTile("counter") });
    expect("document" in describeWorkbench(wb)).toBe(false);
    const withDocument = describeWorkbench(wb, { document: true }).document as { format: string; workspaces: unknown[] };
    expect(withDocument.format).toBe("pbui.workbench");
    expect(withDocument.workspaces).toHaveLength(1);
  });
});

describe("describeWorkbench geometry", () => {
  it("touches no DOM at all unless geometry was asked for", () => {
    const wb = createWorkbench({ apps, initial: layout(split("row", 0.5, tile("counter"), tile("notes"))) });
    const root = vi.spyOn(wb, "root");
    const description = describeWorkbench(wb);
    expect(root).not.toHaveBeenCalled();
    expect(description.workspaces[0]!.tiles.every((item) => !("rect" in item))).toBe(true);
  });

  it("reports each mounted tile as a fraction of the Surface root box", () => {
    const wb = createWorkbench({ apps, initial: layout(split("row", 0.6, tile("counter"), tile("notes"))) });
    const [first, second] = placements(wb);
    mountFakeSurface(
      wb,
      { [first!]: fakeRect(100, 50, 480, 400), [second!]: fakeRect(580, 50, 320, 400) },
      fakeRect(100, 50, 800, 400),
    );

    const tiles = describeWorkbench(wb, { geometry: true }).workspaces[0]!.tiles;
    expect(tiles[0]!.rect).toEqual({ x: 0, y: 0, w: 0.6, h: 1 });
    expect(tiles[1]!.rect).toEqual({ x: 0.6, y: 0, w: 0.4, h: 1 });
  });

  it("reports no geometry rather than Infinity when nothing is laid out", () => {
    const wb = createWorkbench({ apps, initial: singleTile("counter") });
    // The jsdom case: an element with no layout measures 0×0, and normalising
    // against it would fill the description with Infinity and NaN.
    mountFakeSurface(wb, { [placements(wb)[0]!]: fakeRect(0, 0, 0, 0) }, fakeRect(0, 0, 0, 0));
    expect(describeWorkbench(wb, { geometry: true }).workspaces[0]!.tiles[0]!.rect).toBeUndefined();

    wb.setRoot(null);
    expect(describeWorkbench(wb, { geometry: true }).workspaces[0]!.tiles[0]!.rect).toBeUndefined();
  });

  it("leaves an unmounted workspace's tiles without geometry", () => {
    const wb = createWorkbench({
      apps,
      initial: workspaces([
        { id: "ws-a", name: "one", spec: tile("counter") },
        { id: "ws-b", name: "two", spec: tile("notes") },
      ]),
    });
    const onScreen = placements(wb)[0]!;
    mountFakeSurface(wb, { [onScreen]: fakeRect(0, 0, 800, 400) }, fakeRect(0, 0, 800, 400));
    const description = describeWorkbench(wb, { geometry: true });
    expect(description.workspaces[0]!.tiles[0]!.rect).toEqual({ x: 0, y: 0, w: 1, h: 1 });
    // Only one tree is drawn, so only its placements have boxes.
    expect(description.workspaces[1]!.tiles[0]!.rect).toBeUndefined();
  });
});
