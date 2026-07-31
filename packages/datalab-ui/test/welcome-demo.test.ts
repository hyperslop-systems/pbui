import { describe, expect, test } from "vitest";
import type { Me } from "../src/api/client";
import {
  shouldActivateWelcomeDemo,
  welcomeDemoDocuments,
  welcomeDemoInstallation,
  WELCOME_DOC_IDS,
} from "../src/demo/welcome";
import { compileEnvironmentForTable, rootSource, rootView } from "../src/model/graphicAuthoring";
import { compileGraphicDocument } from "../src/model/graphic";
import type { Field, Table } from "../src/model/table";

const welcome: NonNullable<Me["welcome"]> = {
  drop: "welcome",
  dataset: "regional-census",
  version: 1,
  path: "regional-census.csv",
  datasets: [
    { dataset: "regional-census", version: 1, path: "regional-census.csv" },
    { dataset: "climate-readings", version: 1, path: "climate-readings.csv" },
    { dataset: "production-batches", version: 1, path: "production-batches.csv" },
  ],
};

const fields = (items: Array<[string, Field["type"]]>): Field[] =>
  items.map(([name, type]) => ({ name, type, inferred_from: "schema" }));

const table = (dataset: string, columns: Array<[string, Field["type"]]>): Table => ({
  source: {
    kind: "dataset",
    drop: "welcome",
    dataset,
    version: 1,
    path: `${dataset}.csv`,
  },
  fields: fields(columns),
  rows: [],
  row_count: 0,
  truncated: false,
  strategy: "head",
});

const tables: Record<string, Table> = {
  "regional-census": table("regional-census", [
    ["station_id", "n"],
    ["region", "n"],
    ["population", "q"],
    ["area_km2", "q"],
  ]),
  "climate-readings": table("climate-readings", [
    ["time", "t"],
    ["station", "n"],
    ["temp_c", "q"],
    ["humidity", "q"],
    ["ok", "n"],
  ]),
  "production-batches": table("production-batches", [
    ["batch", "n"],
    ["line", "n"],
    ["yield_pct", "q"],
    ["mass_kg", "q"],
    ["defects", "q"],
  ]),
};

describe("the anonymous welcome documents", () => {
  test("the complete catalog produces seven named authored documents", () => {
    const documents = welcomeDemoDocuments(welcome);
    expect(Object.keys(documents).sort()).toEqual(Object.values(WELCOME_DOC_IDS).sort());
    expect(new Set(Object.values(documents).map((document) => document.name)).size).toBe(7);
  });

  test("every document compiles against its advertised source schema", () => {
    const documents = welcomeDemoDocuments(welcome);
    for (const document of Object.values(documents)) {
      const source = rootSource(document);
      expect(source?.kind).toBe("dataset");
      const data = source?.dataset ? tables[source.dataset] : undefined;
      expect(data, `${document.name} names a known demo dataset`).toBeDefined();
      if (!data) continue;
      const result = compileGraphicDocument(document, compileEnvironmentForTable(document, data));
      expect(result.diagnostics, document.name).toEqual([]);
      expect(result.logical, document.name).not.toBeNull();
      expect(Object.keys(rootView(document).encodings).length).toBeGreaterThanOrEqual(2);
    }
  });

  test("aggregate and target examples are authored rather than precomputed", () => {
    const documents = welcomeDemoDocuments(welcome);
    const population = documents[WELCOME_DOC_IDS.populationBars]!;
    const yieldByLine = documents[WELCOME_DOC_IDS.yieldByLine]!;
    expect(Object.values(population.transforms).map((item) => item.kind)).toEqual([
      "core:aggregate",
    ]);
    expect(Object.values(yieldByLine.transforms).map((item) => item.kind)).toEqual([
      "core:aggregate",
    ]);
    expect(rootView(yieldByLine).references).toEqual([
      { on: "y", value: 85, label: "85% target", intent: "target" },
    ]);
  });

  test("a partial catalog produces no misleading partial demo", () => {
    expect(welcomeDemoDocuments({ ...welcome, datasets: welcome.datasets?.slice(0, 1) })).toEqual(
      {},
    );
  });

  test("installation activates a demo only for an uninitialized anonymous world", () => {
    expect(shouldActivateWelcomeDemo(false, null, "")).toBe(true);
    expect(shouldActivateWelcomeDemo(false, "blank", "")).toBe(true);
    expect(shouldActivateWelcomeDemo(false, "restored", "my-drop")).toBe(false);
    expect(shouldActivateWelcomeDemo(false, WELCOME_DOC_IDS.populationBars, "welcome")).toBe(false);
    expect(shouldActivateWelcomeDemo(true, "blank", "")).toBe(false);
  });

  test("authenticated visitors receive every shared-stage document without losing their active one", () => {
    const installation = welcomeDemoInstallation(welcome, true, "my-analysis", "my-drop");
    expect(Object.keys(installation.documents).sort()).toEqual(
      Object.values(WELCOME_DOC_IDS).sort(),
    );
    expect(installation.activateDocId).toBeNull();
  });

  test("anonymous restoration receives documents without redirecting ambient actions", () => {
    const installation = welcomeDemoInstallation(welcome, false, "my-analysis", "my-drop");
    expect(Object.keys(installation.documents)).toHaveLength(7);
    expect(installation.activateDocId).toBeNull();
  });
});
