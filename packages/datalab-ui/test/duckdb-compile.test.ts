import { describe, expect, test } from "vitest";
import { compileDuckDBRelation } from "../src/analysis/compile";
import { duckDBType, fieldAlias, quoteIdentifier } from "../src/analysis/quote";
import {
  compileGraphicDocument,
  type CompileEnvironment,
  type GraphicDocument,
  type LogicalGraphic,
} from "../src/model/graphic";

const massId = 'field:source:mass "g"';
const speciesId = "field:source:species";

const environment: CompileEnvironment = {
  sources: {
    source: {
      coverage: { kind: "bounded", strategy: "head", rows: 100, hasMore: true },
      fields: [
        {
          id: speciesId,
          name: "species",
          path: "species",
          semanticType: "nominal",
          valueType: { physical: { kind: "string" }, nullable: false },
        },
        {
          id: massId,
          name: 'mass "g"',
          path: 'mass "g"',
          semanticType: "quantitative",
          valueType: { physical: { kind: "float64" }, nullable: true },
        },
      ],
    },
  },
};

function document(filterValue: number | string = 4_000): GraphicDocument {
  return {
    format: "datadrop.gog.document",
    version: 2,
    id: "doc",
    name: "compiler",
    sources: {
      source: {
        id: "source",
        source: { kind: "dataset", drop: "lab", dataset: "birds", version: 1, path: "rows.ndjson" },
        scope: { kind: "bounded-window", limit: 2_000, strategy: "head" },
      },
    },
    transforms: {
      filter: {
        id: "filter",
        kind: "core:filter",
        input: { kind: "source", sourceId: "source" },
        enabled: true,
        state: "complete",
        predicate: {
          kind: "call",
          function: typeof filterValue === "number" ? "gt" : "eq",
          arguments: [
            {
              kind: "field",
              field:
                typeof filterValue === "number"
                  ? { fieldId: massId, name: 'mass "g"' }
                  : { fieldId: speciesId, name: "species" },
            },
            { kind: "literal", value: filterValue },
          ],
        },
      },
      extend: {
        id: "extend",
        kind: "core:extend",
        input: { kind: "transform", transformId: "filter" },
        enabled: true,
        state: "complete",
        name: "mass_kg",
        semanticType: "quantitative",
        expression: {
          kind: "call",
          function: "divide",
          arguments: [
            { kind: "field", field: { fieldId: massId, name: 'mass "g"' } },
            { kind: "literal", value: 1_000 },
          ],
        },
      },
      aggregate: {
        id: "aggregate",
        kind: "core:aggregate",
        input: { kind: "transform", transformId: "extend" },
        enabled: true,
        state: "complete",
        groupBy: [{ fieldId: speciesId, name: "species" }],
        measures: [
          {
            name: 'mean "mass"',
            function: "mean",
            field: { fieldId: "field:extend:mass_kg", name: "mass_kg" },
          },
          { name: "rows", function: "count_rows" },
        ],
      },
      sort: {
        id: "sort",
        kind: "core:sort",
        input: { kind: "transform", transformId: "aggregate" },
        enabled: true,
        state: "complete",
        fields: [
          {
            field: { fieldId: "field:aggregate:mean%20%22mass%22", name: 'mean "mass"' },
            direction: "desc",
            nulls: "last",
          },
        ],
      },
      limit: {
        id: "limit",
        kind: "core:limit",
        input: { kind: "transform", transformId: "sort" },
        enabled: true,
        state: "complete",
        count: 10,
      },
    },
    views: {
      view: {
        id: "view",
        relation: { kind: "transform", transformId: "limit" },
        mark: "bar",
        encodings: {
          x: { fieldId: speciesId, name: "species" },
          y: { fieldId: "field:aggregate:mean%20%22mass%22", name: 'mean "mass"' },
        },
        yScale: "linear",
        analysis: { kind: "identity" },
        facetScales: "fixed",
      },
    },
    rootView: "view",
    parameters: {},
  };
}

function logical(input: GraphicDocument = document()): LogicalGraphic {
  const result = compileGraphicDocument(input, environment);
  expect(result.diagnostics).toEqual([]);
  return result.logical as LogicalGraphic;
}

describe("DuckDB identifier and type lowering", () => {
  test("quotes every identifier and maps only supported physical types", () => {
    expect(quoteIdentifier('a"b')).toBe('"a""b"');
    expect(fieldAlias(massId)).toMatch(/^field_[0-9a-f]{8}$/);
    expect(duckDBType({ kind: "timestamp", unit: "ms", timezone: "UTC" })).toBe("TIMESTAMPTZ");
    expect(duckDBType({ kind: "unknown" })).toBeNull();
  });
});

describe("LogicalGraphic to parameterized DuckDB SQL", () => {
  test("lowers the requested dependency chain and binds every value", () => {
    const graph = logical();
    const relation = graph.views.view!.relation;
    const result = compileDuckDBRelation(graph, relation, [
      { sourceId: "source", relationName: 'source "private"; DROP TABLE x' },
    ]);

    expect(result.diagnostics).toEqual([]);
    expect(result.compiled?.params).toEqual([4_000, 1_000, 10]);
    expect(result.compiled?.operations.map((item) => item.operationId)).toEqual([
      "operation:source",
      "operation:filter",
      "operation:extend",
      "operation:aggregate",
      "operation:sort",
      "operation:limit",
    ]);
    const sql = result.compiled!.sql;
    expect(sql).toContain('FROM "source ""private""; DROP TABLE x"');
    expect(sql).toContain(
      `${quoteIdentifier('mass "g"')} AS ${quoteIdentifier(fieldAlias(massId))}`,
    );
    expect(sql).toContain("NULLIF(");
    expect(sql).toContain("count(*) AS");
    expect(sql).toContain(" DESC NULLS LAST");
    expect(sql).toContain("LIMIT ?");
    expect(sql).toContain('AS "mean ""mass""');
    expect(sql).not.toContain("4000");
    expect(sql).not.toContain("1000");
  });

  test("compiles only the requested dependency subgraph", () => {
    const graph = logical();
    const unusedRelation = {
      fields: [],
      coverage: { kind: "bounded", strategy: "head", rows: 0, hasMore: false } as const,
    };
    graph.relations["value:unused"] = unusedRelation;
    graph.operations.splice(1, 0, {
      id: "operation:unused",
      kind: "core:scan",
      sourceId: "unused",
      output: "value:unused",
      relation: unusedRelation,
      origin: "unused",
    });

    const result = compileDuckDBRelation(graph, graph.views.view!.relation, [
      { sourceId: "source", relationName: "registered_source" },
    ]);
    expect(result.diagnostics).toEqual([]);
    expect(result.compiled?.operations.map((item) => item.operationId)).not.toContain(
      "operation:unused",
    );
  });

  test("hostile literal text is a parameter, never SQL text", () => {
    const attack = "x'; DROP TABLE secrets; --";
    const graph = logical(document(attack));
    const result = compileDuckDBRelation(graph, graph.views.view!.relation, [
      { sourceId: "source", relationName: "registered_source" },
    ]);

    expect(result.compiled?.params[0]).toBe(attack);
    expect(result.compiled?.sql).not.toContain(attack);
  });

  test("returns diagnostics for missing sources and relations instead of throwing", () => {
    const graph = logical();
    const missingSource = compileDuckDBRelation(graph, graph.views.view!.relation, []);
    expect(missingSource.compiled).toBeNull();
    expect(missingSource.diagnostics.map((item) => item.code)).toContain("duckdb.source");

    const missingRelation = compileDuckDBRelation(graph, "value:missing", [
      { sourceId: "source", relationName: "registered_source" },
    ]);
    expect(missingRelation.compiled).toBeNull();
    expect(missingRelation.diagnostics.map((item) => item.code)).toContain("duckdb.relation");
  });

  test("rejects unbound logical parameters and non-scalar literals", () => {
    const graph = logical();
    const filter = graph.operations.find((operation) => operation.kind === "core:filter");
    if (filter?.kind !== "core:filter") throw new Error("fixture filter missing");

    filter.predicate = {
      kind: "parameter",
      parameterId: "minimum",
      valueType: { physical: { kind: "float64" }, nullable: false },
    };
    let result = compileDuckDBRelation(graph, graph.views.view!.relation, [
      { sourceId: "source", relationName: "registered_source" },
    ]);
    expect(result.compiled).toBeNull();
    expect(result.diagnostics.map((item) => item.code)).toContain("duckdb.parameter.unbound");

    filter.predicate = {
      kind: "literal",
      value: [true],
      valueType: { physical: { kind: "unknown" }, nullable: false },
    };
    result = compileDuckDBRelation(graph, graph.views.view!.relation, [
      { sourceId: "source", relationName: "registered_source" },
    ]);
    expect(result.compiled).toBeNull();
    expect(result.diagnostics.map((item) => item.code)).toContain("duckdb.parameter");
  });
});
