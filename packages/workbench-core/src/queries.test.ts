import { describe, expect, it } from "vitest";
import { create } from "@bufbuild/protobuf";
import { DocumentPayloadSchema, MutationSchema } from "@hyperslop-systems/workbench-protocol";
import { applyMutations, leaves } from "@hyperslop-systems/workbench-protocol/client";
import { layout, split, tile, workspaces } from "./document";
import { buildWorkbenchIndex } from "./graph";
import { canClose, documentsWithFormat, firstPlacementOfView, orphanViewIds, placementCount, sameBindings, viewsUsingDocument, workspaceOfView } from "./queries";
import { sequentialIds } from "./testing";

const put = (id: string, format: string) => create(MutationSchema, { body: { case: "documentPut", value: { document: create(DocumentPayloadSchema, { id, format, schemaVersion: 1, body: {} }) } } });

describe("on-demand queries", () => {
  it("viewsUsingDocument and documentsWithFormat scan the document directly", () => {
    const doc = applyMutations(
      layout(split("row", 0.5, tile("sku", { documents: { product: "p1" } }), tile("plot", { documents: { table: "t1", product: "p1" } })), { ids: sequentialIds() }),
      [put("p1", "shop.product"), put("t1", "shop.table"), put("p2", "shop.product")],
    );
    expect(viewsUsingDocument(doc, "p1")).toEqual([
      { viewId: "v-00000001-0000", slot: "product" },
      { viewId: "v-00000003-0000", slot: "product" },
    ]);
    expect(viewsUsingDocument(doc, "nothing")).toEqual([]);
    expect(documentsWithFormat(doc, "shop.product")).toEqual(["p1", "p2"]);
  });

  it("orphanViewIds equals the direct scan and follows viewOrder", () => {
    const doc = applyMutations(layout(tile("a"), { ids: sequentialIds() }), [
      create(MutationSchema, { body: { case: "viewCreate", value: { view: { id: "v-orphan-1", appId: "a", documents: {} } } } }),
      create(MutationSchema, { body: { case: "viewCreate", value: { view: { id: "v-orphan-2", appId: "b", documents: {} } } } }),
    ]);
    const index = buildWorkbenchIndex(doc);
    const placed = new Set(doc.workspaces.flatMap((ws) => leaves(ws.tree).map((leaf) => (leaf.body.case === "leaf" ? leaf.body.value.viewId : ""))));
    expect(orphanViewIds(doc, index)).toEqual(doc.viewOrder.filter((id) => !placed.has(id)));
    expect(orphanViewIds(doc, index)).toEqual(["v-orphan-1", "v-orphan-2"]);
  });

  it("placement queries answer per workspace and anywhere", () => {
    const doc = workspaces(
      [
        { id: "one", name: "one", spec: split("row", 0.5, tile("a"), tile("b")) },
        { id: "two", name: "two", spec: tile("c") },
      ],
      { ids: sequentialIds() },
    );
    const index = buildWorkbenchIndex(doc);
    const [a, b] = doc.viewOrder;
    expect(placementCount(index, a!)).toBe(1);
    expect(firstPlacementOfView(index, b!, "one")).toBe("n-00000004-0000");
    expect(firstPlacementOfView(index, b!, "two")).toBeNull();
    expect(firstPlacementOfView(index, b!)).toBe("n-00000004-0000");
    expect(workspaceOfView(index, doc.viewOrder[2]!)).toBe("two");
    expect(workspaceOfView(index, "nothing")).toBeNull();
    expect(canClose(index, "n-00000002-0000")).toBe(true);
    expect(canClose(index, "n-00000007-0000")).toBe(false);
    expect(canClose(index, "n-00000005-0000")).toBe(false); // the split node, not a placement
  });

  it("sameBindings compares maps by key set and value", () => {
    expect(sameBindings({ a: "1" }, { a: "1" })).toBe(true);
    expect(sameBindings({ a: "1" }, { a: "2" })).toBe(false);
    expect(sameBindings({ a: "1" }, { a: "1", b: "2" })).toBe(false);
    expect(sameBindings({}, {})).toBe(true);
  });
});
