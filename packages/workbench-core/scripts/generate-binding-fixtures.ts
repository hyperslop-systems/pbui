/**
 * Generate the shared binding/catalog fixtures (design doc 04 §9.8) under
 * contracts/workbench/v1. Run from packages/workbench-core:
 *   npx tsx scripts/generate-binding-fixtures.ts
 * Both `bindingFixtures.test.ts` (TypeScript) and
 * pkg/workbench/binding_fixtures_test.go (Go) load what this writes.
 */
import { create, toJson } from "@bufbuild/protobuf";
import { DocumentPayloadSchema, MutationSchema, WorkbenchDocumentSchema, type WorkbenchDocument } from "@hyperslop-systems/workbench-protocol";
import { applyMutations } from "@hyperslop-systems/workbench-protocol/client";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { layout, tile } from "../src/document";
import { sequentialIds } from "../src/testing";

const out = resolve(import.meta.dirname, "../../../contracts/workbench/v1");
const write = (path: string, value: unknown) => {
  mkdirSync(resolve(out, path, ".."), { recursive: true });
  writeFileSync(resolve(out, path), JSON.stringify(value, null, 2) + "\n");
};

const catalogs = {
  basic: {
    apps: [
      { id: "notes" },
      { id: "chat", bindings: { conversation: { required: false, formats: ["chat.conversation"] } } },
      { id: "sku", bindings: { product: { required: true, formats: ["shop.product"] } } },
      { id: "any", bindings: { thing: { required: false } } },
    ],
  },
  "open-context": {
    apps: [{ id: "session", bindings: { transcript: { required: false, formats: ["agentlogic.transcript-ref"], role: "context" } }, launch: "unbound" }],
  },
  additional: {
    apps: [
      { id: "script", bindings: { program: { required: false, formats: ["sandbox.program"] } }, additionalBindings: { formats: ["shop.product"] } },
      { id: "script-any", bindings: { program: { required: false, formats: ["sandbox.program"] } }, additionalBindings: {} },
    ],
  },
};
for (const [name, catalog] of Object.entries(catalogs)) write(`catalogs/${name}.json`, catalog);

const put = (id: string, format: string) => create(MutationSchema, { body: { case: "documentPut", value: { document: create(DocumentPayloadSchema, { id, format, schemaVersion: 1, body: {} }) } } });
const doc = (appId: string, documents: Record<string, string>, payloads: Array<[string, string]>): WorkbenchDocument => {
  const ids = sequentialIds();
  const base = layout(tile(appId, { documents }), { ids, id: "w1", name: "fixture" });
  return applyMutations(base, payloads.map(([id, format]) => put(id, format)));
};
const json = (document: WorkbenchDocument) => toJson(WorkbenchDocumentSchema, document);
const viewOf = (document: WorkbenchDocument) => document.viewOrder[0]!;

const valid: Array<{ name: string; catalog: string; document: WorkbenchDocument }> = [
  { name: "unbound application with no bindings", catalog: "basic", document: doc("notes", {}, []) },
  { name: "known optional binding filled with the right format", catalog: "basic", document: doc("chat", { conversation: "c-1" }, [["c-1", "chat.conversation"]]) },
  { name: "known optional binding left empty", catalog: "basic", document: doc("chat", {}, []) },
  { name: "required binding filled", catalog: "basic", document: doc("sku", { product: "2049" }, [["2049", "shop.product"]]) },
  { name: "binding with no format constraint takes any document", catalog: "basic", document: doc("any", { thing: "x" }, [["x", "whatever.v9"]]) },
  { name: "optional transcript context absent", catalog: "open-context", document: doc("session", {}, []) },
  { name: "optional transcript context present", catalog: "open-context", document: doc("session", { transcript: "t-1" }, [["t-1", "agentlogic.transcript-ref"]]) },
  { name: "additional binding of an allowed format", catalog: "additional", document: doc("script", { program: "prg-1", product: "2049" }, [["prg-1", "sandbox.program"], ["2049", "shop.product"]]) },
  { name: "additional binding with unconstrained formats", catalog: "additional", document: doc("script-any", { program: "prg-1", order: "o-7" }, [["prg-1", "sandbox.program"], ["o-7", "shop.order"]]) },
];
const invalid: Array<{ name: string; catalog: string; document: WorkbenchDocument; code: string; path: (view: string) => string }> = [
  { name: "unknown key", catalog: "basic", document: doc("chat", { typo: "c-1" }, [["c-1", "chat.conversation"]]), code: "unknown_binding", path: (v) => `views["${v}"].documents["typo"]` },
  { name: "missing required binding", catalog: "basic", document: doc("sku", {}, []), code: "required_binding", path: (v) => `views["${v}"].documents` },
  { name: "wrong format", catalog: "basic", document: doc("chat", { conversation: "2049" }, [["2049", "shop.product"]]), code: "invalid_binding_format", path: (v) => `views["${v}"].documents["conversation"]` },
  { name: "missing document", catalog: "basic", document: doc("chat", { conversation: "c-gone" }, []), code: "unknown_document", path: (v) => `views["${v}"].documents["conversation"]` },
  { name: "additional binding of a refused format", catalog: "additional", document: doc("script", { program: "prg-1", order: "o-7" }, [["prg-1", "sandbox.program"], ["o-7", "shop.order"]]), code: "invalid_binding_format", path: (v) => `views["${v}"].documents["order"]` },
  { name: "unknown key where additional bindings are not admitted", catalog: "open-context", document: doc("session", { extra: "t-1" }, [["t-1", "agentlogic.transcript-ref"]]), code: "unknown_binding", path: (v) => `views["${v}"].documents["extra"]` },
];
const slug = (name: string) => name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
for (const item of valid) write(`binding-valid/${slug(item.name)}.json`, { name: item.name, catalog: item.catalog, document: json(item.document), expected: { ok: true } });
for (const item of invalid) write(`binding-invalid/${slug(item.name)}.json`, { name: item.name, catalog: item.catalog, document: json(item.document), expected: { ok: false, code: item.code, path: item.path(viewOf(item.document)) } });
console.log(`wrote ${Object.keys(catalogs).length} catalogs, ${valid.length} valid, ${invalid.length} invalid fixtures to ${out}`);
