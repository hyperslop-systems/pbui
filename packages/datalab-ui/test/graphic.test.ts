import { describe, expect, test } from "vitest";
import {
  compileGraphicDocument,
  compileSources,
  type AuthoringTransform,
  type CompileEnvironment,
  type GraphicDocument,
  type SourceField,
} from "../src/model/graphic";

const fields: SourceField[] = [
  {
    id: "field:source:species",
    name: "species",
    path: "species",
    valueType: { physical: { kind: "string" }, nullable: false },
    semanticType: "nominal",
  },
  {
    id: "field:source:mass",
    name: "mass_g",
    path: "mass_g",
    valueType: { physical: { kind: "float64" }, nullable: true },
    semanticType: "quantitative",
  },
];

const environment: CompileEnvironment = {
  sources: {
    source: {
      fields,
      coverage: { kind: "bounded", strategy: "head", rows: 4, hasMore: false },
    },
  },
};

function document(
  transforms: AuthoringTransform[],
  relation = transforms.at(-1)?.id,
): GraphicDocument {
  return {
    format: "datadrop.gog.document",
    version: 1,
    id: "doc",
    name: "test",
    sources: {
      source: {
        id: "source",
        source: { kind: "dataset", drop: "lab", dataset: "birds", version: 1, path: "rows.ndjson" },
        scope: { kind: "bounded-window", limit: 2_000, strategy: "head" },
      },
    },
    transforms: Object.fromEntries(transforms.map((transform) => [transform.id, transform])),
    views: {
      view: {
        id: "view",
        relation: relation
          ? { kind: "transform", transformId: relation }
          : { kind: "source", sourceId: "source" },
        mark: "point",
        encodings: {
          x: { fieldId: "field:source:species", name: "species" },
          y:
            relation === "aggregate"
              ? { name: "mean_mass" }
              : { fieldId: "field:source:mass", name: "mass_g" },
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

const input = (id?: string) =>
  id
    ? ({ kind: "transform", transformId: id } as const)
    : ({ kind: "source", sourceId: "source" } as const);

const field = (id: string, name: string) => ({ fieldId: id, name });

describe("GraphicDocument compilation", () => {
  test("the source pass seeds scans and rejects unresolved schemas independently", () => {
    const inputDocument = document([]);
    const compiled = compileSources(inputDocument, environment);
    expect(compiled.operations.map((operation) => operation.kind)).toEqual(["core:scan"]);
    expect(compiled.diagnostics).toEqual([]);

    const unresolved = compileSources(inputDocument, { sources: {} });
    expect(unresolved.operations).toEqual([]);
    expect(unresolved.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(["source.schema"]);
  });

  test("compiles a dependency-ordered relation graph with stable field symbols", () => {
    const result = compileGraphicDocument(
      document([
        {
          id: "filter",
          kind: "core:filter",
          input: input(),
          enabled: true,
          state: "complete",
          predicate: {
            kind: "call",
            function: "gt",
            arguments: [
              { kind: "field", field: field("field:source:mass", "mass_g") },
              { kind: "literal", value: 4_000 },
            ],
          },
        },
        {
          id: "extend",
          kind: "core:extend",
          input: input("filter"),
          enabled: true,
          state: "complete",
          name: "mass_kg",
          semanticType: "quantitative",
          expression: {
            kind: "call",
            function: "divide",
            arguments: [
              { kind: "field", field: field("field:source:mass", "mass_g") },
              { kind: "literal", value: 1_000 },
            ],
          },
        },
        {
          id: "aggregate",
          kind: "core:aggregate",
          input: input("extend"),
          enabled: true,
          state: "complete",
          groupBy: [field("field:source:species", "species")],
          measures: [{ name: "mean_mass", function: "mean", field: { name: "mass_kg" } }],
        },
      ]),
      environment,
    );

    expect(result.diagnostics).toEqual([]);
    expect(result.logical?.operations.map((operation) => operation.kind)).toEqual([
      "core:scan",
      "core:filter",
      "core:extend",
      "core:aggregate",
    ]);
    const aggregate = result.logical?.operations.at(-1);
    expect(aggregate?.relation.fields.map((symbol) => symbol.name)).toEqual([
      "species",
      "mean_mass",
    ]);
    expect(result.logical?.views.view?.encodings.y).toBe("field:aggregate:mean_mass");
    expect(aggregate?.relation.coverage).toEqual(environment.sources.source?.coverage);
  });

  test("disabled transforms resolve directly to their input", () => {
    const result = compileGraphicDocument(
      document([
        {
          id: "disabled",
          kind: "core:limit",
          input: input(),
          enabled: false,
          state: "draft",
          count: -1,
        },
      ]),
      environment,
    );

    expect(result.diagnostics).toEqual([]);
    expect(result.logical?.operations).toHaveLength(1);
    expect(result.logical?.views.view?.relation).toBe("value:source");
  });

  test("rejects draft, cyclic, missing, and invalid documents with diagnostics instead of throwing", () => {
    const draft = document([
      {
        id: "draft",
        kind: "core:filter",
        input: input(),
        enabled: true,
        state: "draft",
        predicate: null,
      },
    ]);
    const draftResult = compileGraphicDocument(draft, environment);
    expect(draftResult.logical).toBeNull();
    expect(draftResult.diagnostics.map((item) => item.code)).toContain("transform.draft");

    const cyclic = document(
      [
        {
          id: "a",
          kind: "core:limit",
          input: input("b"),
          enabled: true,
          state: "complete",
          count: 1,
        },
        {
          id: "b",
          kind: "core:limit",
          input: input("a"),
          enabled: true,
          state: "complete",
          count: 1,
        },
      ],
      "a",
    );
    const cycleResult = compileGraphicDocument(cyclic, environment);
    expect(cycleResult.logical).toBeNull();
    expect(cycleResult.diagnostics.map((item) => item.code)).toContain("transform.cycle");
  });

  test("field identity wins and stale or ambiguous names are rejected", () => {
    const missing = document([
      {
        id: "filter",
        kind: "core:filter",
        input: input(),
        enabled: true,
        state: "complete",
        predicate: {
          kind: "call",
          function: "gt",
          arguments: [
            { kind: "field", field: { fieldId: "field:gone", name: "mass_g" } },
            { kind: "literal", value: 1 },
          ],
        },
      },
    ]);
    const result = compileGraphicDocument(missing, environment);
    expect(result.logical).toBeNull();
    expect(result.diagnostics.map((item) => item.code)).toContain("field.missing");
  });

  test("validates expression signatures, aggregate types, duplicates, and non-negative limits", () => {
    const cases: Array<[GraphicDocument, string]> = [
      [
        document([
          {
            id: "filter",
            kind: "core:filter",
            input: input(),
            enabled: true,
            state: "complete",
            predicate: { kind: "field", field: field("field:source:mass", "mass_g") },
          },
        ]),
        "filter.type",
      ],
      [
        document([
          {
            id: "extend",
            kind: "core:extend",
            input: input(),
            enabled: true,
            state: "complete",
            name: "mass_g",
            semanticType: "quantitative",
            expression: { kind: "literal", value: 1 },
          },
        ]),
        "extend.duplicate",
      ],
      [
        document([
          {
            id: "limit",
            kind: "core:limit",
            input: input(),
            enabled: true,
            state: "complete",
            count: -1,
          },
        ]),
        "limit.count",
      ],
    ];

    for (const [inputDocument, code] of cases) {
      const result = compileGraphicDocument(inputDocument, environment);
      expect(result.logical).toBeNull();
      expect(result.diagnostics.map((item) => item.code)).toContain(code);
    }
  });

  test("structured cloning preserves the declarative document", () => {
    const original = document([]);
    expect(structuredClone(original)).toEqual(original);
    expect(JSON.parse(JSON.stringify(original))).toEqual(original);
  });
});
