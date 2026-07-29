import { describe, expect, test } from "vitest";
import {
  appendTransform,
  cloneGraphicDocument,
  compileEnvironmentForTable,
  createGraphicDocument,
  documentLimit,
  moveTransform,
  orderedTransformIds,
  physicalTypeForField,
  removeTransform,
  replaceDocumentSource,
  rootSource,
  rootView,
  setDocumentLimit,
  sourceFieldId,
} from "../src/model/graphicAuthoring";
import type { Table } from "../src/model/table";

const table: Table = {
  source: { kind: "dataset", drop: "lab", dataset: "birds", version: 3, path: "rows.ndjson" },
  fields: [
    { name: "mass_g", type: "q", inferred_from: "values", null_count: 1 },
    { name: "observed_at", type: "t", inferred_from: "schema" },
    { name: "active", type: "n", inferred_from: "values" },
    { name: "code", type: "n", inferred_from: "schema" },
  ],
  rows: [
    { mass_g: 12, observed_at: "2026-01-01T00:00:00Z", active: true, code: "001" },
    { mass_g: null, observed_at: "2026-01-02T00:00:00Z", active: false, code: "002" },
  ],
  row_count: 2,
  truncated: true,
  strategy: "head",
};

describe("canonical graphic authoring helpers", () => {
  test("creates one bounded source and one root view without legacy spec fields", () => {
    const graphic = createGraphicDocument("doc-1", "birds", table.source, 2_000);
    expect(graphic).toMatchObject({
      format: "datadrop.gog.document",
      version: 1,
      id: "doc-1",
      name: "birds",
      transforms: {},
      parameters: {},
    });
    expect(rootSource(graphic)).toEqual(table.source);
    expect(rootView(graphic).relation).toEqual({ kind: "source", sourceId: "source:root" });
    expect("spec" in graphic).toBe(false);
    expect("steps" in graphic).toBe(false);
  });

  test("derives deterministic physical source fields without coercing identifiers", () => {
    const graphic = createGraphicDocument("doc-1", "birds", table.source, 2_000);
    const environment = compileEnvironmentForTable(graphic, table);
    const fields = environment.sources["source:root"]!.fields;
    expect(fields.map((field) => [field.name, field.valueType.physical.kind])).toEqual([
      ["mass_g", "float64"],
      ["observed_at", "timestamp"],
      ["active", "boolean"],
      ["code", "string"],
    ]);
    expect(fields[0]?.valueType.nullable).toBe(true);
    expect(fields[1]?.valueType.nullable).toBe(false);
    expect(fields[3]?.id).toBe(sourceFieldId("source:root", "code"));
    expect(physicalTypeForField(table.fields[3]!, table.rows)).toEqual({ kind: "string" });
    expect(environment.sources["source:root"]?.coverage).toEqual({
      kind: "bounded",
      strategy: "head",
      rows: 2,
      hasMore: true,
    });
  });

  test("orders transforms from relation edges rather than map insertion order", () => {
    const graphic = createGraphicDocument("doc-1", "birds", table.source, 2_000);
    graphic.transforms = {
      second: {
        id: "second",
        kind: "core:limit",
        input: { kind: "transform", transformId: "first" },
        enabled: true,
        state: "complete",
        count: 10,
      },
      first: {
        id: "first",
        kind: "core:sort",
        input: { kind: "source", sourceId: "source:root" },
        enabled: true,
        state: "complete",
        fields: [],
      },
    };
    rootView(graphic).relation = { kind: "transform", transformId: "second" };
    expect(orderedTransformIds(graphic)).toEqual(["first", "second"]);
  });

  test("rewires append, move, and removal through canonical relation edges", () => {
    const graphic = createGraphicDocument("doc-1", "birds", table.source, 2_000);
    appendTransform(graphic, {
      id: "first",
      kind: "core:limit",
      input: { kind: "source", sourceId: "ignored" },
      enabled: true,
      state: "complete",
      count: 100,
    });
    appendTransform(graphic, {
      id: "second",
      kind: "core:sort",
      input: { kind: "source", sourceId: "ignored" },
      enabled: true,
      state: "complete",
      fields: [],
    });
    expect(orderedTransformIds(graphic)).toEqual(["first", "second"]);
    moveTransform(graphic, "second", -1);
    expect(orderedTransformIds(graphic)).toEqual(["second", "first"]);
    removeTransform(graphic, "second");
    expect(orderedTransformIds(graphic)).toEqual(["first"]);
    expect(graphic.transforms.first?.input).toEqual({
      kind: "source",
      sourceId: "source:root",
    });
  });

  test("owns source window changes and cloning inside the canonical document", () => {
    const graphic = createGraphicDocument("doc-1", "birds", table.source, 2_000);
    setDocumentLimit(graphic, 50_000);
    expect(documentLimit(graphic)).toBe(50_000);
    appendTransform(graphic, {
      id: "old",
      kind: "core:limit",
      input: { kind: "source", sourceId: "ignored" },
      enabled: true,
      state: "complete",
      count: 10,
    });
    replaceDocumentSource(graphic, { kind: "stream", drop: "other", stream: "events" });
    expect(rootSource(graphic)).toEqual({ kind: "stream", drop: "other", stream: "events" });
    expect(documentLimit(graphic)).toBe(50_000);
    expect(orderedTransformIds(graphic)).toEqual([]);

    const clone = cloneGraphicDocument(graphic, "doc-2");
    setDocumentLimit(clone, 10);
    expect(clone.id).toBe("doc-2");
    expect(documentLimit(graphic)).toBe(50_000);
  });

  test("rejects broken and cyclic relation chains instead of inventing order", () => {
    const missing = createGraphicDocument("doc-1", "birds", table.source, 2_000);
    rootView(missing).relation = { kind: "transform", transformId: "gone" };
    expect(() => orderedTransformIds(missing)).toThrow("missing transform gone");

    const cyclic = createGraphicDocument("doc-2", "birds", table.source, 2_000);
    cyclic.transforms.a = {
      id: "a",
      kind: "core:limit",
      input: { kind: "transform", transformId: "b" },
      enabled: true,
      state: "complete",
      count: 1,
    };
    cyclic.transforms.b = {
      id: "b",
      kind: "core:limit",
      input: { kind: "transform", transformId: "a" },
      enabled: true,
      state: "complete",
      count: 1,
    };
    rootView(cyclic).relation = { kind: "transform", transformId: "a" };
    expect(() => orderedTransformIds(cyclic)).toThrow("transform cycle");
  });
});
