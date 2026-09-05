import { describe, expect, it } from "vitest";
import { create } from "@bufbuild/protobuf";
import { documentSlotPort } from "@hyperslop-systems/pbui/link-kernel";
import { DocumentPayloadSchema, MutationSchema, type WorkbenchDocument } from "@hyperslop-systems/workbench-protocol";
import { applyMutations } from "@hyperslop-systems/workbench-protocol/client";
import { createManifestCatalog, defineAppManifest } from "./apps";
import { layout, parseWorkbenchDocument, serializeDocument, split, tile } from "./document";
import { sequentialIds } from "./testing";
import { validateWorkbenchDocument } from "./validation";

const apps = createManifestCatalog([
  defineAppManifest({ id: "counter" }),
  defineAppManifest({ id: "notes", viewCardinality: "one" }),
  defineAppManifest({ id: "sku", ports: [documentSlotPort("product")] }),
]);

const codes = (doc: WorkbenchDocument, withApps = true) => {
  const result = validateWorkbenchDocument(doc, withApps ? { apps } : {});
  return result.ok ? [] : result.diagnostics.map((d) => `${d.code}@${d.path}`);
};

const base = () => layout(split("row", 0.5, tile("counter"), tile("notes")), { ids: sequentialIds() });

describe("essential validation", () => {
  it("accepts a layout() document with and without a catalog", () => {
    expect(codes(base())).toEqual([]);
    expect(codes(base(), false)).toEqual([]);
  });

  it("reports format, version, and an empty workspace list", () => {
    const doc = base();
    doc.format = "other";
    doc.schemaVersion = 2;
    doc.workspaces = [];
    expect(codes(doc)).toEqual(["unsupported_format@format", "unsupported_version@schemaVersion", "workspace_required@workspaces"]);
  });

  it.each(["", " \t\n"])("rejects blank workbench identities (%j) at validation and parsing", (value) => {
    for (const field of ["id", "name"] as const) {
      const doc = base();
      doc[field] = value;
      expect(codes(doc)).toEqual([`required@${field}`]);
      expect(codes(doc, false)).toEqual([`required@${field}`]);
      expect(parseWorkbenchDocument(serializeDocument(doc))).toEqual({
        ok: false,
        diagnostics: [{ code: "required", path: field, detail: "value is required" }],
      });
    }
  });

  it("reports tree shape: bad ratio, bad direction, missing child, unknown view, duplicate node id", () => {
    const doc = base();
    const tree = doc.workspaces[0]!.tree!;
    if (tree.body.case !== "split") throw new Error("fixture");
    tree.body.value.ratio = 0.02;
    tree.body.value.direction = 0;
    expect(codes(doc)).toEqual(["invalid_split@workspaces[0].tree.split.direction", "invalid_split@workspaces[0].tree.split.ratio"]);

    const dup = base();
    const t2 = dup.workspaces[0]!.tree!;
    if (t2.body.case === "split") t2.body.value.b!.id = t2.body.value.a!.id;
    expect(codes(dup)).toEqual(["duplicate_id@workspaces[0].tree.split.b.id"]);

    const unknown = base();
    const t3 = unknown.workspaces[0]!.tree!;
    if (t3.body.case === "split" && t3.body.value.a!.body.case === "leaf") t3.body.value.a!.body.value.viewId = "v-gone";
    expect(codes(unknown)).toEqual(["unknown_view@workspaces[0].tree.split.a.leaf.viewId"]);

    const missing = base();
    const t4 = missing.workspaces[0]!.tree!;
    if (t4.body.case === "split") t4.body.value.b = undefined;
    expect(codes(missing)).toEqual(["invalid_split@workspaces[0].tree.split"]);
  });

  it("reports the view map / viewOrder bijection and key mismatches", () => {
    const doc = base();
    doc.viewOrder = [doc.viewOrder[0]!];
    expect(codes(doc)).toEqual(["view_order_mismatch@viewOrder", 'view_order_mismatch@views["v-00000003-0000"]']);

    const mismatch = base();
    mismatch.views["v-00000001-0000"]!.id = "v-else";
    expect(codes(mismatch)).toEqual(['id_mismatch@views["v-00000001-0000"].id']);
  });

  it("reports catalog rules only when a catalog is given", () => {
    const doc = applyMutations(base(), [
      create(MutationSchema, { body: { case: "viewCreate", value: { view: { id: "v-x", appId: "mystery", documents: {} } } } }),
      create(MutationSchema, { body: { case: "viewCreate", value: { view: { id: "v-y", appId: "notes", documents: {} } } } }),
      create(MutationSchema, { body: { case: "viewCreate", value: { view: { id: "v-z", appId: "sku", documents: { product: "p-missing", other: "p1" } } } } }),
      create(MutationSchema, { body: { case: "documentPut", value: { document: create(DocumentPayloadSchema, { id: "p1", format: "shop.product", schemaVersion: 1, body: {} }) } } }),
    ]);
    expect(codes(doc, false)).toEqual([]);
    expect(codes(doc)).toEqual([
      'unknown_application@views["v-x"].appId',
      'duplicate_singleton@views["v-y"].appId',
      'unknown_document@views["v-z"].documents["product"]',
      'unknown_binding@views["v-z"].documents["other"]',
    ]);
  });

  it("reports a document key mismatch and an untrimmed title", () => {
    const doc = applyMutations(base(), [create(MutationSchema, { body: { case: "documentPut", value: { document: create(DocumentPayloadSchema, { id: "p1", format: "x", schemaVersion: 1, body: {} }) } } })]);
    doc.documents["p1"]!.id = "p2";
    doc.views["v-00000001-0000"]!.title = " padded ";
    expect(codes(doc)).toEqual(['noncanonical_title@views["v-00000001-0000"].title', 'id_mismatch@documents["p1"].id']);
  });

  it("applies count limits", () => {
    const doc = base();
    const result = validateWorkbenchDocument(doc, { limits: { nodes: 2 } });
    expect(result.ok ? [] : result.diagnostics.map((d) => d.code)).toEqual(["limit_exceeded"]);
  });
});

describe("parseWorkbenchDocument", () => {
  it("round-trips serializeDocument and refuses what it cannot use, with a reason", () => {
    const doc = base();
    const parsed = parseWorkbenchDocument(serializeDocument(doc), { apps });
    expect(parsed.ok && serializeDocument(parsed.document)).toBe(serializeDocument(doc));
    expect(parseWorkbenchDocument(null)).toEqual({ ok: false, diagnostics: [{ code: "empty", path: "", detail: "no document text" }] });
    expect(parseWorkbenchDocument("{not json").ok).toBe(false);
    const empty = parseWorkbenchDocument(JSON.stringify({ format: "pbui.workbench", schemaVersion: 1, id: "x", name: "x" }));
    expect(!empty.ok && empty.diagnostics.map((d) => d.code)).toEqual(["workspace_required"]);
  });
});
