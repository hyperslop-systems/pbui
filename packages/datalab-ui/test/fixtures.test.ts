import { describe, expect, test } from "vitest";
import { batches, census, readings } from "../src/fixtures";
import {
  appendTransform,
  compileTableDocument,
  createDefaultGraphic,
  rootView,
} from "../src/model/graphicAuthoring";
import { buildPlotFromResult } from "../src/model/plot";
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
    const document = createDefaultGraphic("fixture", "fixture", table);
    const plot = buildPlotFromResult(
      { rows: table.rows, fields: table.fields, err: null },
      rootView(document),
      640,
      360,
    );
    // Not "does not throw" — buildPlot never throws, it reports. An empty
    // problems list is the only evidence that it drew anything.
    expect(plot.problems).toEqual([]);
    expect(plot.panels.length).toBeGreaterThan(0);
    expect(plot.panels[0]!.marks.length).toBeGreaterThan(0);
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
    const document = createDefaultGraphic("fixture", "fixture", readings);
    const plot = buildPlotFromResult(
      { rows: readings.rows, fields: readings.fields, err: null },
      rootView(document),
      640,
      360,
    );
    // A banded time axis would emit one tick per distinct timestamp — 90 of
    // them. A continuous one emits a handful on round units.
    expect(plot.xTicks.length).toBeLessThan(12);
    expect(plot.xTicks.length).toBeGreaterThan(1);
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
