import type { PlotScriptDoc } from "./document";

/**
 * The three worked examples from the design guide (§10), as seeded script
 * documents. The ids are VERSIONED (`example-v1-…`) so a revision can mint
 * new documents without mutating anything persisted under the old ids — the
 * discipline datalab's `demo/welcome.ts` follows. `examples.test.ts` runs
 * each through the runner and renderPlot and asserts a scene with no error
 * diagnostics, so a change to the author shim or to plot that breaks one
 * fails here, not in a user's tile.
 */
const AT = "2026-09-01T00:00:00.000Z";

export const SCATTER_SOURCE = `// A — a scatter plot from literal data.
// Everything is literal, so this script needs nothing bound to it.
const rows = [
  { month: 1, temp:  3.2 }, { month: 2, temp:  4.1 }, { month: 3, temp:  8.7 },
  { month: 4, temp: 13.0 }, { month: 5, temp: 18.4 }, { month: 6, temp: 22.9 },
  { month: 7, temp: 25.1 },
];

return {
  schema: {
    fields: [
      { id: "field:month", name: "month", column: "month",
        semanticType: "quantitative", nullable: false },
      { id: "field:temp",  name: "temperature", column: "temp",
        semanticType: "quantitative", nullable: false, unit: "°C" },
    ],
  },

  data: { rows, coverage: { kind: "complete", rowCount: rows.length } },

  document: plot({
    id: "monthly-temperature",
    description: "Mean monthly temperature at the greenhouse sensor.",
    variables: {
      month: variable.field("field:month", { label: "Month" }),
      temp:  variable.field("field:temp",  { label: "Temperature" }),
    },
    composition: composition.cartesian({
      x: value.variable("month"),
      y: value.variable("temp"),
    }),
    layers: [
      layer({ id: "points", stat: stat.identity(), geom: geom.point(), position: position.identity() }),
    ],
  }),
};
`;

export const BARS_SOURCE = `// B — a grouped, dodged bar chart with a colour aesthetic.
// The script is a program: the aggregation is a Map and a loop, not a
// feature the grammar had to grow.
const source = [
  { line: "A", shift: "day",   yield_kg: 41.2, qc_pass: true  },
  { line: "A", shift: "night", yield_kg: 37.8, qc_pass: true  },
  { line: "B", shift: "day",   yield_kg: 44.9, qc_pass: true  },
  { line: "B", shift: "night", yield_kg: 39.1, qc_pass: false },
  { line: "C", shift: "day",   yield_kg: 40.4, qc_pass: true  },
  { line: "C", shift: "night", yield_kg: 42.7, qc_pass: true  },
];

const groups = new Map();
for (const row of source) {
  if (!row.qc_pass) continue;
  const key = row.line + "|" + row.shift;
  const bucket = groups.get(key) ?? { line: row.line, shift: row.shift, total: 0, n: 0 };
  bucket.total += row.yield_kg;
  bucket.n += 1;
  groups.set(key, bucket);
}
const rows = [...groups.values()].map(({ line, shift, total, n }) => ({ line, shift, mean_yield: total / n }));
console.log(rows.length, "groups after the QC filter");

return {
  schema: {
    fields: [
      { id: "field:line",  name: "line",  column: "line",  semanticType: "nominal", nullable: false },
      { id: "field:shift", name: "shift", column: "shift", semanticType: "nominal", nullable: false },
      { id: "field:mean",  name: "mean yield", column: "mean_yield",
        semanticType: "quantitative", nullable: false, unit: "kg" },
    ],
  },

  data: { rows, coverage: { kind: "complete", rowCount: rows.length } },

  document: plot({
    id: "yield-by-line",
    description: "Mean yield per line and shift, QC-passing runs only.",
    variables: {
      line:  variable.field("field:line",  { label: "Line" }),
      shift: variable.field("field:shift", { label: "Shift" }),
      mean:  variable.field("field:mean",  { label: "Mean yield" }),
    },
    composition: composition.cartesian({
      x: value.variable("line"),
      y: value.variable("mean"),
      groups: [value.variable("shift")],
    }),
    scales: { x: scale.band(), y: scale.linear({ zero: true }), color: scale.categorical() },
    layers: [
      layer({
        id: "bars",
        mapping: { color: value.variable("shift") },
        stat: stat.identity(),
        geom: geom.bar(),
        position: position.dodge(),
      }),
    ],
  }),
};
`;

export const TREND_SOURCE = `// C — two layers, a statistic, and honest coverage.
// Raw readings with an OLS trend over them, from a bounded window.
const start = Date.parse("2026-08-31T00:00:00Z");
const rows = Array.from({ length: 240 }, (_, i) => ({
  ts: new Date(start + i * 6 * 60_000).toISOString(),
  humidity: 0.46 + 0.00042 * i + 0.01 * Math.sin(i / 9),
}));

return {
  schema: {
    fields: [
      { id: "field:t", name: "time",     column: "ts",
        semanticType: "temporal", nullable: false, timezone: "UTC" },
      { id: "field:v", name: "humidity", column: "humidity",
        semanticType: "quantitative", nullable: true },
    ],
  },

  // The window is the last 24 hours of a longer series: say so, and the
  // plot draws a notice rather than letting a sample look like a census.
  data: {
    rows,
    coverage: { kind: "bounded", rowCount: rows.length, hasMore: true, strategy: "latest" },
  },

  document: plot({
    id: "humidity-trend",
    description: "Humidity, last 24 h, with an OLS trend.",
    variables: {
      t: variable.field("field:t", { label: "Time" }),
      v: variable.field("field:v", { label: "Humidity" }),
    },
    composition: composition.cartesian({ x: value.variable("t"), y: value.variable("v") }),
    scales: { x: scale.temporal(), y: scale.linear() },
    layers: [
      layer({ id: "raw",   stat: stat.identity(),                 geom: geom.point({ size: 2 }), position: position.identity() }),
      layer({ id: "trend", stat: stat.regression({ method: "ols" }), geom: geom.line(),            position: position.identity() }),
    ],
    presentation: presentation.compact({ padding: 8 }),
  }),
};
`;

export const EXAMPLE_SCRIPTS: readonly PlotScriptDoc[] = [
  { id: "example-v1-scatter", name: "A · scatter", source: SCATTER_SOURCE, updatedAt: AT },
  { id: "example-v1-bars", name: "B · dodged bars", source: BARS_SOURCE, updatedAt: AT },
  { id: "example-v1-trend", name: "C · trend over a window", source: TREND_SOURCE, updatedAt: AT },
];
