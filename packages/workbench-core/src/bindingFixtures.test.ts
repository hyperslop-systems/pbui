import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fromJson } from "@bufbuild/protobuf";
import { WorkbenchDocumentSchema } from "@hyperslop-systems/workbench-protocol";
import { describe, expect, it } from "vitest";
import { createManifestCatalog, defineAppManifest, type WorkbenchAppManifestInput } from "./apps";
import { validateWorkbenchDocument } from "./validation";

/**
 * The shared binding/catalog fixtures (design doc 04 §9.8, §12.5): the same
 * catalogs and documents pkg/workbench/binding_fixtures_test.go validates.
 * The two validators may differ in prose; they may not differ in the first
 * diagnostic's code and path.
 */
const root = resolve(import.meta.dirname, "../../../contracts/workbench/v1");
const readJson = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const catalogOf = (name: string) => {
  const raw = readJson(resolve(root, "catalogs", `${name}.json`)) as { apps: Array<WorkbenchAppManifestInput & { singleton?: boolean }> };
  return createManifestCatalog(raw.apps.map(({ singleton, ...app }) => defineAppManifest({ ...app, ...(singleton ? { viewCardinality: "one" } : {}) })));
};
const cases = (dir: string) =>
  readdirSync(resolve(root, dir))
    .filter((name) => name.endsWith(".json"))
    .map((name) => readJson(resolve(root, dir, name)) as { name: string; catalog: string; document: unknown; expected: { ok: boolean; code?: string; path?: string } });

describe("binding fixtures shared with Go", () => {
  it("has fixtures", () => {
    expect(cases("binding-valid").length).toBeGreaterThan(0);
    expect(cases("binding-invalid").length).toBeGreaterThan(0);
  });
  for (const fixture of cases("binding-valid")) {
    it(`valid: ${fixture.name}`, () => {
      const document = fromJson(WorkbenchDocumentSchema, fixture.document as never);
      const result = validateWorkbenchDocument(document, { apps: catalogOf(fixture.catalog) });
      expect(result.ok ? [] : result.diagnostics).toEqual([]);
    });
  }
  for (const fixture of cases("binding-invalid")) {
    it(`invalid: ${fixture.name}`, () => {
      const document = fromJson(WorkbenchDocumentSchema, fixture.document as never);
      const result = validateWorkbenchDocument(document, { apps: catalogOf(fixture.catalog) });
      if (result.ok) throw new Error("expected a refusal");
      expect(result.diagnostics[0]).toMatchObject({ code: fixture.expected.code, path: fixture.expected.path });
    });
  }
});
