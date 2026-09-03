import { describe, expect, it } from "vitest";
import { create } from "@bufbuild/protobuf";
import { MutationSchema, type Node, type WorkbenchDocument } from "@hyperslop-systems/workbench-protocol";
import { applyMutations, findNode, leaves, placementCount as slowPlacementCount, viewsOfApp, workspaceOfPlacement, workspaceTree } from "@hyperslop-systems/workbench-protocol/client";
import { layout, split, tile, workspaces } from "./document";
import { buildWorkbenchIndex } from "./graph";
import { sequentialIds } from "./testing";

function fixture(): WorkbenchDocument {
  const ids = sequentialIds();
  const doc = workspaces(
    [
      { id: "one", name: "one", spec: split("row", 0.6, tile("counter"), split("col", 0.5, tile("notes"), tile("counter", { title: "second" }))) },
      { id: "two", name: "two", spec: tile("chart") },
    ],
    { ids, id: "wb" },
  );
  // Link the notes view into workspace two as well, so one view has two placements across workspaces.
  const notes = doc.viewOrder[1]!;
  const twoLeaf = leaves(workspaceTree(doc, "two"))[0]!;
  return applyMutations(doc, [
    create(MutationSchema, { body: { case: "placementSplit", value: { workspaceId: "two", placementId: twoLeaf.id, direction: 1, ratio: 0.5, splitId: "n-split-two", newPlacement: { id: "n-notes-two", body: { case: "leaf", value: { viewId: notes } } }, place: 2 } } }),
  ]);
}

describe("buildWorkbenchIndex", () => {
  it("matches the slow traversal reference for every join", () => {
    const doc = fixture();
    const index = buildWorkbenchIndex(doc);
    for (const workspace of doc.workspaces) {
      expect(index.workspaceById.get(workspace.id)).toBe(workspace);
      const walk = (node: Node | undefined) => {
        if (!node) return;
        expect(index.nodeById.get(node.id)).toBe(node);
        expect(index.workspaceByNodeId.get(node.id)).toBe(workspaceOfPlacement(doc, node.id));
        expect(findNode(workspace.tree, node.id)).toBe(node);
        if (node.body.case === "leaf") expect(index.viewByPlacementId.get(node.id)).toBe(node.body.value.viewId);
        if (node.body.case === "split") {
          walk(node.body.value.a);
          walk(node.body.value.b);
        }
      };
      walk(workspace.tree);
    }
    for (const viewId of doc.viewOrder) {
      expect(index.placementsByViewId.get(viewId)?.length ?? 0).toBe(slowPlacementCount(doc, viewId));
    }
    for (const appId of ["counter", "notes", "chart", "nothing"]) {
      expect(index.viewsByAppId.get(appId) ?? []).toEqual(viewsOfApp(doc, appId).map((view) => view.id));
    }
    expect(index.placementsByViewId.get(doc.viewOrder[1]!)).toEqual([
      { placementId: "n-00000004-0000", workspaceId: "one" },
      { placementId: "n-notes-two", workspaceId: "two" },
    ]);
  });

  it("refuses a duplicate node id with the Go code", () => {
    const doc = layout(split("row", 0.5, tile("a"), tile("b")), { ids: sequentialIds() });
    const tree = doc.workspaces[0]!.tree!;
    if (tree.body.case === "split") tree.body.value.b!.id = tree.body.value.a!.id;
    expect(() => buildWorkbenchIndex(doc)).toThrowError(/duplicate_id at workspaces\[0\]\.tree\.split\.b\.id/);
  });

  it("leaves an unplaced view out of placementsByViewId but in viewsByAppId", () => {
    const doc = layout(tile("a"), { ids: sequentialIds() });
    const orphan = applyMutations(doc, [create(MutationSchema, { body: { case: "viewCreate", value: { view: { id: "v-orphan", appId: "a", documents: {} } } } })]);
    const index = buildWorkbenchIndex(orphan);
    expect(index.placementsByViewId.has("v-orphan")).toBe(false);
    expect(index.viewsByAppId.get("a")).toEqual(["v-00000001-0000", "v-orphan"]);
  });
});
