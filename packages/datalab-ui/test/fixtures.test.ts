import { describe, expect, test } from "vitest";
import { batches, census, readings, READINGS } from "../src/fixtures";
import {
  appendTransform,
  compileTableDocument,
  createDefaultGraphic,
  rootView,
} from "../src/model/graphicAuthoring";
import { renderPbuiPlot } from "../src/appkit/plotAdapter";
import type { Table } from "../src/model/table";

/**
 * The fixtures have to be realistic, not merely plausible.
 *
 * A fixture that the real engine cannot chart is a fixture that makes every
 * story built on it a fiction — the component renders, the story passes, and
 * the same component fed a real table behaves differently. So each fixture is
 * put through the actual `defaultChart` → `evaluate` → `buildPlot` path here.
 */

const ALL: [string, Table][] = [
  ["readings", readings],
  ["census", census],
  ["batches", batches],
];

function plotFixture(table: Table) {
  const document = createDefaultGraphic("fixture", "fixture", table);
  return renderPbuiPlot(
    document.id,
    rootView(document),
    {
      rows: table.rows,
      fields: table.fields,
      coverage: {
        kind: "bounded",
        strategy: table.strategy,
        rows: table.rows.length,
        hasMore: table.truncated,
      },
      resultTruncated: table.truncated,
    },
    640,
    360,
  );
}

describe("every fixture is a well-formed Table", () => {
  test.each(ALL)("%s has consistent fields and rows", (_name, table) => {
    expect(table.rows.length).toBe(table.row_count);
    expect(table.fields.length).toBeGreaterThan(0);

    const named = new Set(table.fields.map((f) => f.name));
    for (const row of table.rows) {
      for (const key of Object.keys(row)) {
        // A column present in the data but absent from `fields` would be
        // invisible to every dropdown in the interface.
        expect(named.has(key)).toBe(true);
      }
    }
  });

  test.each(ALL)("%s reports distinct counts that match the data", (_name, table) => {
    for (const field of table.fields) {
      const actual = new Set(table.rows.map((r) => JSON.stringify(r[field.name]))).size;
      expect(field.distinct).toBe(actual);
    }
  });
});

describe("every fixture charts through the real engine", () => {
  test.each(ALL)("%s produces a drawable default chart", (_name, table) => {
    const plot = plotFixture(table);
    // Not "does not throw" — buildPlot never throws, it reports. An empty
    // problems list is the only evidence that it drew anything.
    expect(plot.diagnostics.filter((item) => item.severity === "error")).toEqual([]);
    expect(plot.plan?.panels.length).toBeGreaterThan(0);
    expect(plot.scene?.metadata.renderedMarkCount).toBeGreaterThan(0);
  });
});

describe("the fixtures cover the states that matter", () => {
  test("readings picks a payload column, not the row number", () => {
    // The defect that shipped in DATADROP-3: first-quantitative on a stream
    // table is `seq`, and a chart of sequence against time is a straight line
    // that says nothing. This fixture is the regression guard for that rule.
    const view = rootView(createDefaultGraphic("fixture", "fixture", readings));
    expect(view.encodings.y?.name).not.toBe("seq");
    expect(view.encodings.y?.name.startsWith("data.")).toBe(true);
    expect(view.encodings.x?.name).toBe("time");
    // Four stations: few enough to colour by, which is why the colour rule
    // requires 2-8 distinct values.
    expect(view.encodings.color?.name).toBe("data.station");
  });

  test("readings has a temporal x, so the continuous time axis is exercised", () => {
    const plot = plotFixture(readings);
    // A banded time axis would emit one tick per distinct timestamp — 90 of
    // them. A continuous one emits a handful on round units.
    expect(plot.plan?.axes[0].ticks.length).toBeLessThan(12);
    expect(plot.plan?.axes[0].ticks.length).toBeGreaterThan(1);
  });

  test("authoring references become ordinary rule layers", () => {
    const document = createDefaultGraphic("fixture", "fixture", readings);
    rootView(document).references = [{ on: "y", value: 20, label: "target", intent: "target" }];
    const plot = renderPbuiPlot(
      document.id,
      rootView(document),
      {
        rows: readings.rows,
        fields: readings.fields,
        coverage: {
          kind: "bounded",
          strategy: readings.strategy,
          rows: readings.rows.length,
          hasMore: readings.truncated,
        },
        resultTruncated: readings.truncated,
      },
      640,
      360,
    );

    expect(plot.compiled?.layers.map((layer) => layer.geom.kind)).toEqual(["rule", "line"]);
    expect(plot.plan?.layers.map((layer) => layer.kind)).toEqual(["rule", "line"]);
    expect(plot.scene?.root.children.some((node) => node.id.includes(":rule"))).toBe(true);
  });

  test.each([
    {
      name: "histogram",
      analysis: { kind: "histogram", bins: 12 } as const,
      encodings: { x: { name: READINGS.temp } },
      methods: ["bin"],
      layers: ["bar"],
    },
    {
      name: "summary",
      analysis: {
        kind: "summary",
        interval: "standard-error",
        multiplier: 1,
      } as const,
      encodings: {
        x: { name: READINGS.station },
        y: { name: READINGS.temp },
        color: { name: READINGS.station },
      },
      methods: ["mean", "mean"],
      layers: ["errorbar", "point"],
    },
    {
      name: "regression",
      analysis: { kind: "regression", confidence: 0.95 } as const,
      encodings: {
        x: { name: READINGS.humidity },
        y: { name: READINGS.temp },
        color: { name: READINGS.station },
      },
      methods: ["identity", "ols", "ols"],
      layers: ["point", "ribbon", "line"],
    },
    {
      name: "boxplot",
      analysis: { kind: "boxplot" } as const,
      encodings: {
        x: { name: READINGS.station },
        y: { name: READINGS.temp },
        color: { name: READINGS.station },
      },
      methods: ["boxplot"],
      layers: ["boxplot"],
    },
    {
      name: "density",
      analysis: { kind: "density", points: 64 } as const,
      encodings: {
        x: { name: READINGS.temp },
        color: { name: READINGS.station },
      },
      methods: ["density"],
      layers: ["line"],
    },
  ])("$name authoring lowers to executable statistical layers", (fixture) => {
    const document = createDefaultGraphic("fixture", fixture.name, readings);
    const view = rootView(document);
    view.analysis = fixture.analysis;
    view.encodings = fixture.encodings;
    const plot = renderPbuiPlot(
      document.id,
      view,
      {
        rows: readings.rows,
        fields: readings.fields,
        coverage: {
          kind: "bounded",
          strategy: readings.strategy,
          rows: readings.rows.length,
          hasMore: readings.truncated,
        },
        resultTruncated: readings.truncated,
      },
      640,
      360,
    );

    expect(plot.diagnostics.filter((item) => item.severity === "error")).toEqual([]);
    expect(plot.plan?.statistics.map((statistic) => statistic.method)).toEqual(fixture.methods);
    expect(plot.plan?.layers.map((layer) => layer.kind)).toEqual(fixture.layers);
    expect(plot.scene?.metadata.renderedMarkCount).toBeGreaterThan(0);
  });

  test("facet scale authoring reaches the plot planner", () => {
    const document = createDefaultGraphic("fixture", "facets", readings);
    const view = rootView(document);
    view.encodings.facet = { name: READINGS.station };
    view.facetScales = "free-y";
    const plot = renderPbuiPlot(
      document.id,
      view,
      {
        rows: readings.rows,
        fields: readings.fields,
        coverage: {
          kind: "bounded",
          strategy: readings.strategy,
          rows: readings.rows.length,
          hasMore: readings.truncated,
        },
        resultTruncated: readings.truncated,
      },
      640,
      360,
    );

    expect(plot.compiled?.facetScales).toBe("free-y");
    expect(plot.plan?.panels).toHaveLength(4);
  });

  test("census keeps the zero-padded identifier a string", () => {
    // The whole argument for server-side typing in one assertion: a sniffer
    // calls this column numeric and "001" becomes 1 before any schema can
    // object.
    expect(census.rows[0]!.station_id).toBe("001");
    const stationId = census.fields.find((f) => f.name === "station_id");
    expect(stationId?.type).toBe("n");
    expect(stationId?.inferred_from).toBe("schema");
  });

  test("batches is truncated, so the notice has something to describe", () => {
    expect(batches.truncated).toBe(true);
    expect(batches.strategy).toBe("head");
  });

  test("an aggregate transform infers the schema the editors claim", () => {
    const document = createDefaultGraphic("fixture", "fixture", batches);
    appendTransform(document, {
      id: "aggregate",
      kind: "core:aggregate",
      input: { kind: "source", sourceId: "pending" },
      enabled: true,
      state: "complete",
      groupBy: [{ name: "line" }],
      measures: [{ name: "mean_yield_pct", function: "mean", field: { name: "yield_pct" } }],
    });
    rootView(document).encodings = {};
    const logical = compileTableDocument(document, batches).logical!;
    const view = logical.views[logical.rootView]!;
    expect(logical.relations[view.relation]?.fields.map((field) => field.name)).toEqual([
      "line",
      "mean_yield_pct",
    ]);
  });
});
