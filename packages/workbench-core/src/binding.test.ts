import { describe, expect, it } from "vitest";
import { create } from "@bufbuild/protobuf";
import { documentSlotPort } from "@hyperslop-systems/pbui/link-kernel";
import { DocumentPayloadSchema, MutationSchema } from "@hyperslop-systems/workbench-protocol";
import { applyMutations } from "@hyperslop-systems/workbench-protocol/client";
import { defineAppManifest } from "./apps";
import { bindRequestedOnly, followTheCrowd, resolveInitialDocuments } from "./binding";
import { layout, split, tile } from "./document";
import { buildWorkbenchIndex } from "./graph";
import { sequentialIds } from "./testing";

const put = (id: string, format: string) => create(MutationSchema, { body: { case: "documentPut", value: { document: create(DocumentPayloadSchema, { id, format, schemaVersion: 1, body: {} }) } } });
const sku = defineAppManifest({ id: "sku", ports: [documentSlotPort("product")] });
const plot = defineAppManifest({ id: "plot", ports: [documentSlotPort("table"), documentSlotPort("product")] });
const counter = defineAppManifest({ id: "counter" });

const doc = () =>
  applyMutations(layout(split("row", 0.5, tile("counter"), tile("sku", { documents: { product: "p2" } })), { ids: sequentialIds() }), [put("t1", "table"), put("p1", "product"), put("p2", "product")]);

describe("initial document policy", () => {
  it("bindRequestedOnly binds exactly the request; an app without slots gets {}", () => {
    const d = doc();
    const index = buildWorkbenchIndex(d);
    expect(resolveInitialDocuments(bindRequestedOnly(), sku, { product: "p1" }, d, index)).toEqual({ kind: "bound", documents: { product: "p1" } });
    expect(resolveInitialDocuments(bindRequestedOnly(), sku, {}, d, index)).toEqual({ kind: "bound", documents: {} });
    expect(resolveInitialDocuments(bindRequestedOnly(), counter, {}, d, index)).toEqual({ kind: "bound", documents: {} });
  });

  it("refuses an undeclared slot and a document that does not exist before any view is minted", () => {
    const d = doc();
    const index = buildWorkbenchIndex(d);
    expect(resolveInitialDocuments(bindRequestedOnly(), counter, { product: "p1" }, d, index)).toMatchObject({ kind: "refused", code: "unknown_binding" });
    expect(resolveInitialDocuments(bindRequestedOnly(), sku, { product: "nope" }, d, index)).toMatchObject({ kind: "refused", code: "unknown_document", missing: ["product"] });
  });

  it("followTheCrowd fills every declared slot: requested wins, then the crowd, then the first bindable document", () => {
    const d = doc();
    const index = buildWorkbenchIndex(d);
    const crowd = followTheCrowd();
    // sku's product slot: another view binds p2 under `product`, so follow it.
    expect(resolveInitialDocuments(crowd, sku, {}, d, index)).toEqual({ kind: "bound", documents: { product: "p2" } });
    // plot: table has no crowd, first document in map order is t1; product follows the crowd.
    expect(resolveInitialDocuments(crowd, plot, {}, d, index)).toEqual({ kind: "bound", documents: { table: "t1", product: "p2" } });
    // requested wins per slot.
    expect(resolveInitialDocuments(crowd, plot, { product: "p1" }, d, index)).toEqual({ kind: "bound", documents: { product: "p1", table: "t1" } });
    // an app without slots is never bound
    expect(resolveInitialDocuments(crowd, counter, {}, d, index)).toEqual({ kind: "bound", documents: {} });
  });

  it("followTheCrowd honours isBindable and unbound", () => {
    const d = doc();
    const index = buildWorkbenchIndex(d);
    const onlyTables = followTheCrowd({ isBindable: (payload) => payload.format === "table" });
    // product slot: crowd binds p2 (crowd beats bindability, as today); table: t1 is bindable.
    expect(resolveInitialDocuments(onlyTables, plot, {}, d, index)).toEqual({ kind: "bound", documents: { table: "t1", product: "p2" } });
    expect(resolveInitialDocuments(followTheCrowd({ unbound: ["sku"] }), sku, {}, d, index)).toEqual({ kind: "bound", documents: {} });
  });
});
