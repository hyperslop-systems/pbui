import { describe, expect, it } from "vitest";
import { leaves } from "@hyperslop-systems/workbench-protocol/client";
import { buildLayout, layout, singleTile, specOf, split, tile, workspaces } from "./document";
import { sequentialIds } from "./testing";

describe("layout builders", () => {
  it("layout() builds a protocol document through the applier with deterministic ids", () => {
    const doc = layout(split("row", 0.6, tile("a", { title: "left" }), tile("b", { documents: { source: "d1" } })), { ids: sequentialIds(), id: "wb" });
    expect(doc.id).toBe("wb");
    expect(doc.viewOrder).toEqual(["v-00000001-0000", "v-00000003-0000"]);
    expect(leaves(doc.workspaces[0]!.tree).map((leaf) => leaf.id)).toEqual(["n-00000002-0000", "n-00000004-0000"]);
    expect(doc.workspaces[0]!.tree!.id).toBe("n-00000005-0000");
    expect(specOf(doc, doc.workspaces[0]!.tree!)).toEqual(split("row", 0.6, tile("a", { title: "left" }), tile("b", { documents: { source: "d1" } })));
  });

  it("singleTile() is a one-leaf workspace; workspaces() seeds several in order and refuses a repeated id", () => {
    const one = singleTile("a", { ids: sequentialIds() });
    expect(leaves(one.workspaces[0]!.tree)).toHaveLength(1);
    const many = workspaces([{ id: "x", name: "x", spec: tile("a") }, { name: "y", spec: tile("b") }], { ids: sequentialIds() });
    expect(many.workspaces.map((ws) => ws.id)).toEqual(["x", "ws-00000005-0000"]);
    expect(() => workspaces([{ id: "x", name: "x", spec: tile("a") }, { id: "x", name: "y", spec: tile("b") }])).toThrow(/used twice/);
  });

  it("buildLayout shares singletons within a spec and with an existing view", () => {
    const built = buildLayout(split("row", 0.5, tile("notes"), split("col", 0.5, tile("notes"), tile("chart"))), {
      ids: sequentialIds(),
      singletonAppIds: new Set(["notes", "chart"]),
      existingViewsByAppId: new Map([["chart", "v-existing"]]),
    });
    expect(built.mutations).toHaveLength(1);
    expect(built.views.map((view) => view.viewId)).toEqual(["v-00000001-0000", "v-00000001-0000", "v-existing"]);
  });
});
