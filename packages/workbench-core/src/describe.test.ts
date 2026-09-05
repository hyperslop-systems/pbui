import { describe, expect, it } from "vitest";
import { create } from "@bufbuild/protobuf";
import { documentSlotPort } from "@hyperslop-systems/pbui/link-kernel";
import { DocumentPayloadSchema, MutationSchema } from "@hyperslop-systems/workbench-protocol";
import { applyMutations, leaves, workspaceTree } from "@hyperslop-systems/workbench-protocol/client";
import { defineAppManifest } from "./apps";
import { commands } from "./commands";
import { createWorkbenchCore } from "./createWorkbenchCore";
import { describeWorkbench, type DescribePresentation } from "./describe";
import { layout, singleTile, specOf, split, tile, workspaces, type LayoutSpec } from "./document";
import type { GeometrySnapshot } from "./geometry";
import { sequentialIds } from "./testing";

/*
 * The contract these tests defend is the round trip: a description an agent
 * reads must go back into `layout()` unchanged, or "make the right column
 * narrower" becomes "rebuild the workspace from memory".
 */

const apps = [
  defineAppManifest({ id: "counter", ports: [{ name: "count", direction: "out", contract: "number", doc: "the count, each time the button is pressed" }] }),
  defineAppManifest({ id: "notes", viewCardinality: "one" }),
  defineAppManifest({ id: "sku", ports: [documentSlotPort("product", "the product this tile details")] }),
];
const presentations: Record<string, DescribePresentation> = {
  counter: { title: "counter" },
  notes: { title: "notes" },
  sku: { title: "SKU", blurb: "one product, in detail", group: "shop", titleFor: (view) => `SKU ${view.documents["product"] ?? "?"}` },
};
const presentation = (appId: string) => presentations[appId] ?? null;

const core = (initial: ReturnType<typeof layout>) => createWorkbenchCore({ initial, apps, ids: sequentialIds() });
const placements = (c: ReturnType<typeof core>) => leaves(workspaceTree(c.getState().document, c.getState().session.workspaceId)).map((leaf) => leaf.id);

describe("specOf", () => {
  it("round-trips a single tile, with and without its optional fields", () => {
    const bare: LayoutSpec = tile("counter");
    const doc = layout(bare);
    expect(specOf(doc, doc.workspaces[0]!.tree!)).toEqual(bare);
    const full: LayoutSpec = tile("sku", { documents: { product: "2051" }, title: "Gold 1oz" });
    const richDoc = layout(full);
    expect(specOf(richDoc, richDoc.workspaces[0]!.tree!)).toEqual(full);
    expect(Object.keys(specOf(doc, doc.workspaces[0]!.tree!))).toEqual(["kind", "appId"]);
  });

  it("round-trips a nested split tree and survives a deleted view", () => {
    const spec = split("row", 0.6, tile("counter"), split("col", 0.34, tile("notes"), split("col", 0.5, tile("counter", { title: "second" }), tile("sku", { documents: { product: "1" } }))));
    const doc = layout(spec);
    expect(specOf(doc, doc.workspaces[0]!.tree!)).toEqual(spec);
    const broken = layout(split("row", 0.5, tile("counter"), tile("notes")));
    const leaf = leaves(broken.workspaces[0]!.tree)[0]!;
    const viewId = leaf.body.case === "leaf" ? leaf.body.value.viewId : "";
    delete broken.views[viewId];
    expect(specOf(broken, broken.workspaces[0]!.tree!)).toEqual({ kind: "split", direction: "row", ratio: 0.5, a: { kind: "tile", appId: "", title: `missing view ${viewId}` }, b: { kind: "tile", appId: "notes" } });
  });
});

describe("describeWorkbench", () => {
  it("names every registered application, with the fields a chooser needs", () => {
    const c = core(singleTile("counter"));
    const description = describeWorkbench(c, { presentations: presentation });
    expect(description.apps.map((app) => app.id)).toEqual(["counter", "notes", "sku"]);
    expect(description.apps[2]).toEqual({
      id: "sku",
      title: "SKU",
      singleton: false,
      viewCardinality: "many",
      duplicatePlacement: "clone",
      docBound: true,
      launch: "requires-bindings",
      bindings: ["product"],
      ports: [{ name: "product", direction: "in", valueType: "document", role: "document.product", doc: "the product this tile details", documentSlot: true }],
      blurb: "one product, in detail",
      group: "shop",
    });
    expect(description.apps[0]).toEqual({
      id: "counter",
      title: "counter",
      singleton: false,
      viewCardinality: "many",
      duplicatePlacement: "clone",
      docBound: false,
      launch: "unbound",
      ports: [{ name: "count", direction: "out", valueType: "number", role: "number", doc: "the count, each time the button is pressed" }],
    });
    // Headless: without presentations the id is the title, and the description still answers.
    expect(describeWorkbench(c).apps[2]?.title).toBe("sku");
  });

  it("names every tile with the id its commands take and the title its chrome shows", () => {
    // The seed must hold the document the sku tile binds: the core validates bindings at its door.
    const seed = applyMutations(layout(split("row", 0.6, tile("counter"), tile("sku", { documents: { product: "2051" } }))), [
      create(MutationSchema, { body: { case: "documentPut", value: { document: create(DocumentPayloadSchema, { id: "2051", format: "shop.product", schemaVersion: 1, body: {} }) } } }),
    ]);
    const c = createWorkbenchCore({ initial: seed, apps, ids: sequentialIds() });
    const [first, second] = placements(c);
    c.execute(commands.activate(second!));
    const description = describeWorkbench(c, { presentations: presentation });
    expect(description.activePlacementId).toBe(second);
    expect(description.activeWorkspaceId).toBe(c.getState().session.workspaceId);
    expect(description.revision).toBe(1);
    const workspace = description.workspaces[0]!;
    expect(workspace.active).toBe(true);
    expect(workspace.tiles.map((item) => item.placementId)).toEqual([first, second]);
    expect(workspace.tiles[0]!.title).toBe("counter");
    expect(workspace.tiles[1]!.title).toBe("SKU 2051");
    expect(workspace.tiles[1]!.documents).toEqual({ product: "2051" });
    expect(workspace.tiles.every((item) => item.linkedPlacements === 1)).toBe(true);
  });

  it("describes the tree in the dialect layout() accepts, and the splits by id", () => {
    const spec = split("row", 0.6, tile("counter"), split("col", 0.34, tile("notes"), tile("counter")));
    const c = core(layout(spec));
    const description = describeWorkbench(c);
    const workspace = description.workspaces[0]!;
    expect(workspace.tree).toEqual(spec);
    const recreated = layout(workspace.tree);
    expect(specOf(recreated, recreated.workspaces[0]!.tree!)).toEqual(spec);
    expect(workspace.splits.map((item) => ({ direction: item.direction, ratio: item.ratio }))).toEqual([{ direction: "row", ratio: 0.6 }, { direction: "col", ratio: 0.34 }]);
    expect(c.execute(commands.resize(workspace.splits[1]!.splitId, 0.7, { snap: false })).ok).toBe(true);
    expect(describeWorkbench(c).workspaces[0]!.splits[1]!.ratio).toBeCloseTo(0.7);
  });

  it("counts a linked view as two placements, describes every workspace, narrows, and keeps a vanished view addressable", () => {
    const c = core(layout(split("row", 0.5, tile("notes"), tile("counter"))));
    const [notesPlacement] = placements(c);
    const linked = c.execute(commands.duplicate(notesPlacement!, "col"));
    const tiles = describeWorkbench(c).workspaces[0]!.tiles;
    expect(tiles.filter((item) => item.appId === "notes").map((item) => item.linkedPlacements)).toEqual([2, 2]);
    expect(tiles.find((item) => item.placementId === (linked.ok ? linked.placementId : ""))?.linkedPlacements).toBe(2);

    const many = core(workspaces([{ id: "ws-a", name: "one", spec: tile("counter") }, { id: "ws-b", name: "two", spec: tile("notes") }]));
    expect(describeWorkbench(many).workspaces.map((item) => [item.id, item.name, item.active])).toEqual([["ws-a", "one", true], ["ws-b", "two", false]]);
    many.execute(commands.selectWorkspace("ws-b"));
    expect(describeWorkbench(many).workspaces.map((item) => item.active)).toEqual([false, true]);
    expect(describeWorkbench(many, { workspaceId: "ws-b" }).workspaces.map((item) => item.id)).toEqual(["ws-b"]);
    const missing = describeWorkbench(many, { workspaceId: "ws-nope" });
    expect(missing.workspaces).toEqual([]);
    expect(missing.apps).toHaveLength(3);
    expect("document" in describeWorkbench(many)).toBe(false);
    expect((describeWorkbench(many, { document: true }).document as { format: string }).format).toBe("pbui.workbench");
  });

  it("reports geometry only from a supplied snapshot, as fractions of the viewport, never Infinity", () => {
    const c = core(layout(split("row", 0.6, tile("counter"), tile("notes"))));
    const [first, second] = placements(c);
    expect(describeWorkbench(c).workspaces[0]!.tiles.every((item) => !("rect" in item))).toBe(true);
    const geometry: GeometrySnapshot = {
      viewport: { x: 0, y: 0, width: 800, height: 400 },
      divider: { inline: 10, block: 10 },
      placements: new Map([
        [first!, { x: 0, y: 0, width: 480, height: 400 }],
        [second!, { x: 480, y: 0, width: 320, height: 400 }],
      ]),
      splits: new Map(),
    };
    const tiles = describeWorkbench(c, { geometry }).workspaces[0]!.tiles;
    expect(tiles[0]!.rect).toEqual({ x: 0, y: 0, w: 0.6, h: 1 });
    expect(tiles[1]!.rect).toEqual({ x: 0.6, y: 0, w: 0.4, h: 1 });
    const flat = describeWorkbench(c, { geometry: { ...geometry, viewport: { x: 0, y: 0, width: 0, height: 0 } } }).workspaces[0]!.tiles;
    expect(flat[0]!.rect).toBeUndefined();
  });
});
