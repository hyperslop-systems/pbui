import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { buildDatalabPlot, buildPlotSchema, renderPbuiPlot } from "../src/appkit/plotAdapter";
import { fixtureResult, graphicFixture, readings, READINGS } from "../src/fixtures";
import { fieldRef, rootView } from "../src/model/graphicAuthoring";

const result = {
  ...fixtureResult(readings),
  coverage: {
    kind: "bounded" as const,
    strategy: readings.strategy,
    rows: readings.rows.length,
    hasMore: readings.truncated,
  },
  resultTruncated: readings.truncated,
};

describe("canonical Datalab Plot projection", () => {
  test("builds variables, composition, layers, and annotations without a second grammar", () => {
    const source = graphicFixture({
      geom: "line",
      mapping: {
        x: READINGS.time,
        y: READINGS.temp,
        color: READINGS.station,
        facet: READINGS.station,
      },
      references: [{ on: "y", value: 20, label: "target", intent: "target" }],
    });
    const built = buildDatalabPlot(source.id, rootView(source), result);

    expect(built.document.variables).toMatchObject({
      "field:source:root:time": {
        kind: "field",
        fieldId: "field:source:root:time",
      },
      "field:source:root:data.station": {
        kind: "field",
        fieldId: "field:source:root:data.station",
      },
    });
    expect(built.document.composition).toMatchObject({
      dimensions: {
        x: { kind: "variable", variable: "field:source:root:time" },
        y: { kind: "variable", variable: "field:source:root:data.temp_c" },
      },
      groups: [{ kind: "variable", variable: "field:source:root:data.station" }],
      facets: {
        columns: [{ kind: "variable", variable: "field:source:root:data.station" }],
      },
    });
    expect(built.document.layers).toMatchObject([
      {
        geom: { kind: "line" },
        mapping: { color: { kind: "variable", variable: "field:source:root:data.station" } },
      },
    ]);
    expect(built.document.layers.map((entry) => entry.geom.kind)).not.toContain("rule");
    expect(built.document.annotations).toMatchObject([
      { kind: "rule", channel: "y", label: "target", intent: "target" },
    ]);
    expect(JSON.stringify(built)).not.toContain("function");
  });

  test("joins result schema by stable field ID rather than display name", () => {
    const source = graphicFixture();
    const view = rootView(source);
    view.encodings.x = { fieldId: "field:right", name: "duplicate" };
    const schema = buildPlotSchema(view, {
      ...result,
      fields: [
        {
          fieldId: "field:left",
          name: "duplicate",
          type: "n",
          inferred_from: "schema",
        },
        {
          fieldId: "field:right",
          name: "duplicate",
          type: "q",
          inferred_from: "schema",
        },
      ],
    });
    expect(schema.fields).toContainEqual(
      expect.objectContaining({ id: "field:right", semanticType: "quantitative" }),
    );
    expect(schema.fields).not.toContainEqual(expect.objectContaining({ id: "field:left" }));
  });

  test("renders through the packed 0.3.0 contract with first-class annotation semantics", () => {
    const source = graphicFixture({
      references: [{ on: "y", value: 20, label: "target", intent: "target" }],
    });
    const outcome = renderPbuiPlot(source.id, rootView(source), result, 640, 360);
    expect(outcome.diagnostics.filter(({ severity }) => severity === "error")).toEqual([]);
    expect(outcome.grammar?.layers.map((entry) => entry.geom.kind)).toEqual(["line"]);
    expect(outcome.semantics?.annotations).toMatchObject([
      { kind: "rule", label: "target", intent: "target" },
    ]);
  });

  test("source contains no compatibility mapping, rule-layer, or identity fallback path", async () => {
    const adapter = await readFile(
      fileURLToPath(new URL("../src/appkit/plotAdapter.ts", import.meta.url)),
      "utf8",
    );
    expect(adapter).not.toMatch(/\bMappingSpec\b|\binheritMapping\b|geom:\s*\{\s*kind:\s*["']rule/);
    expect(adapter).not.toMatch(/fieldId\s*\?\?|pbui:\$\{encodeURIComponent/);
    expect(adapter).toContain("@hyperslop-systems/plot/author");
  });

  test("raw source references remain explicit and stable", () => {
    expect(fieldRef("source:root", READINGS.temp)).toEqual({
      fieldId: "field:source:root:data.temp_c",
      name: "data.temp_c",
    });
  });
});
