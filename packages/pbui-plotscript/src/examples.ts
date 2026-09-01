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

  // identity names the field(s) that make a row itself, so marks get
  // stable interaction targets; without it the plot draws but says so.
  data: { rows, coverage: { kind: "complete", rowCount: rows.length }, identity: { fields: ["field:month"] } },

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

  data: { rows, coverage: { kind: "complete", rowCount: rows.length }, identity: { fields: ["field:line", "field:shift"] } },

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
    identity: { fields: ["field:t"] },
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
      layer({ id: "raw",   stat: stat.identity(),                 geom: geom.point({ radius: 2 }), position: position.identity() }),
      layer({ id: "trend", stat: stat.regression({ method: "ols" }), geom: geom.line(),            position: position.identity() }),
    ],
    presentation: presentation.compact({ padding: 8 }),
  }),
};
`;

export const DISTRIBUTION_SOURCE = `// D — a histogram and a density, two plots from one script.
// Return a LIST and the plot tile draws a grid: each entry is its own
// request with its own scales. (For panels that must SHARE scales, see F:
// facets in one document.)
let seed = 7;
const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const gaussian = () => Math.sqrt(-2 * Math.log(random())) * Math.cos(2 * Math.PI * random());
const rows = Array.from({ length: 400 }, (_, i) => ({ i, latency_ms: 120 + 18 * gaussian() + (i % 5 === 0 ? 40 : 0) }));

const schema = { fields: [
  { id: "field:i", name: "sample", column: "i", semanticType: "quantitative", nullable: false },
  { id: "field:v", name: "latency", column: "latency_ms", semanticType: "quantitative", nullable: false, unit: "ms" },
]};
const data = { rows, coverage: { kind: "complete", rowCount: rows.length }, identity: { fields: ["field:i"] } };
const variables = { v: variable.field("field:v", { label: "Latency" }) };

const histogram = {
  schema, data,
  document: plot({
    id: "latency-histogram",
    description: "Latency, 12 bins",
    variables,
    composition: composition.cartesian({ x: value.variable("v") }),
    layers: [
      layer({
        id: "bins",
        // The layer overrides y with the statistic's named output.
        composition: { dimensions: { y: value.afterStat("count") } },
        stat: stat.bin({ bins: 12 }),
        geom: geom.bar(),
        position: position.identity(),
      }),
    ],
  }),
};

const density = {
  schema, data,
  document: plot({
    id: "latency-density",
    description: "Latency, Gaussian density",
    variables,
    composition: composition.cartesian({ x: value.variable("v") }),
    layers: [
      layer({
        id: "kde",
        composition: { dimensions: { y: value.afterStat("density") } },
        stat: stat.density({ points: 64 }),
        geom: geom.line(),
        position: position.identity(),
      }),
    ],
  }),
};

return [histogram, density];
`;

export const INTERVALS_SOURCE = `// E — a mean with its standard error beside a Tukey boxplot, two plots.
const treatments = ["control", "candidate", "placebo"];
let seed = 3;
const random = () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647; };
const rows = [];
for (const [t, base] of [["control", 30], ["candidate", 36], ["placebo", 28]]) {
  for (let i = 0; i < 24; i++) rows.push({ id: rows.length, treatment: t, response: base + (random() - 0.5) * 14 });
}

const schema = { fields: [
  { id: "field:id", name: "id", column: "id", semanticType: "quantitative", nullable: false },
  { id: "field:t", name: "treatment", column: "treatment", semanticType: "nominal", nullable: false },
  { id: "field:r", name: "response", column: "response", semanticType: "quantitative", nullable: false },
]};
const data = { rows, coverage: { kind: "complete", rowCount: rows.length }, identity: { fields: ["field:id"] } };
const variables = { t: variable.field("field:t", { label: "Treatment" }), r: variable.field("field:r", { label: "Response" }) };
const scales = { x: scale.band({ domain: treatments }), color: scale.categorical({ domain: treatments }), fill: scale.categorical({ domain: treatments }) };

// One statistic, three geometries: the ribbon, the error bar and the point
// all read the same summary, so they cannot disagree.
const summary = stat.summary({ function: "mean", interval: { kind: "standard-error" } });
const mean = {
  schema, data,
  document: plot({
    id: "mean-and-error",
    description: "Mean response ± standard error",
    variables, scales,
    composition: composition.cartesian({ x: value.variable("t"), y: value.variable("r"), groups: [value.variable("t")] }),
    layers: [
      layer({ id: "band",  mapping: { fill: value.variable("t") },  stat: summary, geom: geom.ribbon(),   position: position.identity() }),
      layer({ id: "error", mapping: { color: value.variable("t") }, stat: summary, geom: geom.errorbar(), position: position.identity() }),
      layer({ id: "mean",  mapping: { color: value.variable("t") }, stat: summary, geom: geom.point(),    position: position.identity() }),
    ],
  }),
};

const box = {
  schema, data,
  document: plot({
    id: "boxplot",
    description: "Tukey boxplot with the raw points jittered over it",
    variables, scales,
    composition: composition.cartesian({ x: value.variable("t"), y: value.variable("r") }),
    layers: [
      layer({ id: "box",    mapping: { color: value.variable("t"), fill: value.variable("t") }, stat: stat.boxplot({ whisker: "tukey" }), geom: geom.boxplot(), position: position.identity() }),
      layer({ id: "points", stat: stat.identity(), geom: geom.point({ radius: 2, opacity: 0.5 }), position: position.jitter({ seed: 11, width: 0.25 }) }),
    ],
  }),
};

return [mean, box];
`;

export const FACETS_SOURCE = `// F — small multiples: ONE document, one panel per station, shared scales.
// This is the grammar's way to show several plots that must be comparable;
// D shows the other way (a list of independent plots).
const stations = ["north", "east", "south"];
const rows = [];
for (const [k, station] of stations.entries()) {
  for (let h = 0; h < 48; h++) {
    rows.push({ id: rows.length, station, hour: h, temp: 12 + 6 * Math.sin((h - 6 * k) / 7.6) + k * 1.5 });
  }
}

return {
  schema: { fields: [
    { id: "field:id", name: "id", column: "id", semanticType: "quantitative", nullable: false },
    { id: "field:s", name: "station", column: "station", semanticType: "nominal", nullable: false },
    { id: "field:h", name: "hour", column: "hour", semanticType: "quantitative", nullable: false, unit: "h" },
    { id: "field:t", name: "temperature", column: "temp", semanticType: "quantitative", nullable: false, unit: "°C" },
  ]},
  data: { rows, coverage: { kind: "complete", rowCount: rows.length }, identity: { fields: ["field:id"] } },
  document: plot({
    id: "stations",
    description: "Temperature by hour, one panel per station",
    variables: {
      s: variable.field("field:s", { label: "Station" }),
      h: variable.field("field:h", { label: "Hour" }),
      t: variable.field("field:t", { label: "Temperature" }),
    },
    composition: composition.cartesian({
      x: value.variable("h"),
      y: value.variable("t"),
      groups: [value.variable("s")],
      facets: { columns: [value.variable("s")], scales: "fixed" },
    }),
    layers: [
      layer({ id: "line", mapping: { color: value.variable("s") }, stat: stat.identity(), geom: geom.line(), position: position.identity() }),
    ],
    annotations: [
      annotation.rule({ id: "comfort", channel: "y", value: value.constant(18), label: "comfort", intent: "target" }),
    ],
  }),
};
`;

export const STACKS_SOURCE = `// G — the same stacked bars three ways: stacked, filled to 100 %, and polar.
const quarters = ["Q1", "Q2", "Q3", "Q4"];
const lines = ["hardware", "software", "services"];
const base = { hardware: [42, 45, 40, 51], software: [30, 34, 39, 44], services: [12, 15, 19, 25] };
const rows = [];
for (const q of quarters.keys()) for (const l of lines) rows.push({ id: rows.length, quarter: quarters[q], line: l, revenue: base[l][q] });

const schema = { fields: [
  { id: "field:id", name: "id", column: "id", semanticType: "quantitative", nullable: false },
  { id: "field:q", name: "quarter", column: "quarter", semanticType: "nominal", nullable: false },
  { id: "field:l", name: "line", column: "line", semanticType: "nominal", nullable: false },
  { id: "field:r", name: "revenue", column: "revenue", semanticType: "quantitative", nullable: false, unit: "k€" },
]};
const data = { rows, coverage: { kind: "complete", rowCount: rows.length }, identity: { fields: ["field:id"] } };
const variables = { q: variable.field("field:q", { label: "Quarter" }), l: variable.field("field:l", { label: "Line" }), r: variable.field("field:r", { label: "Revenue" }) };
const scales = { x: scale.band({ domain: quarters }), fill: scale.categorical({ domain: lines }) };

const stacked = (id, description, pos, coord) => ({
  schema, data,
  document: plot({
    id, description, variables, scales,
    ...(coord ? { coordinate: coord } : {}),
    composition: composition.cartesian({ x: value.variable("q"), y: value.variable("r"), groups: [value.variable("l")] }),
    layers: [layer({ id: "bars", mapping: { fill: value.variable("l") }, stat: stat.identity(), geom: geom.bar(), position: pos })],
  }),
});

return [
  stacked("stack", "Stacked", position.stack()),
  stacked("fill", "Filled to 100 %", position.fill()),
  stacked("polar", "Polar, clockwise from the top", position.stack(), coordinate.polar({ theta: "x", startAngle: -Math.PI / 2, direction: "clockwise", innerRadius: 0.16 })),
];
`;

export const GUIDES_SOURCE = `// H — a log axis, configured guides, and every annotation kind.
const rows = Array.from({ length: 30 }, (_, i) => ({ i, day: i + 1, users: Math.round(40 * Math.exp(i * 0.18) * (1 + 0.15 * Math.sin(i))) }));

return {
  schema: { fields: [
    { id: "field:i", name: "i", column: "i", semanticType: "quantitative", nullable: false },
    { id: "field:d", name: "day", column: "day", semanticType: "quantitative", nullable: false },
    { id: "field:u", name: "users", column: "users", semanticType: "quantitative", nullable: false },
  ]},
  data: { rows, coverage: { kind: "complete", rowCount: rows.length }, identity: { fields: ["field:i"] } },
  document: plot({
    id: "growth",
    description: "Daily active users, log scale",
    variables: { d: variable.field("field:d", { label: "Day" }), u: variable.field("field:u", { label: "Users" }) },
    composition: composition.cartesian({ x: value.variable("d"), y: value.variable("u") }),
    scales: { y: scale.log({ tickCount: 5 }) },
    layers: [
      layer({ id: "line", stat: stat.identity(), geom: geom.line(), position: position.identity() }),
      layer({ id: "dots", stat: stat.identity(), geom: geom.point({ radius: 2 }), position: position.identity() }),
    ],
    presentation: {
      title: presence.configured({ text: "Thirty days of growth" }),
      xGuide: presence.configured(guide.axis({ label: "Day of launch", ticks: { kind: "values", values: [1, 10, 20, 30] }, grid: "major" })),
      yGuide: presence.configured(guide.axis({ label: "Users (log)", side: "left" })),
      frame: presence.configured({ stroke: true }),
    },
    annotations: [
      annotation.rule({ id: "goal", channel: "y", value: value.constant(1000), label: "1k goal", intent: "target" }),
      annotation.region({ id: "launch-week", from: { kind: "data", x: value.constant(1) }, to: { kind: "data", x: value.constant(7) }, label: "launch week", intent: "note" }),
      annotation.text({ id: "note", anchor: { kind: "panel", x: 0.05, y: 0.92 }, text: "log y: straight is exponential", align: "start" }),
      annotation.point({ id: "spike", anchor: { kind: "data", x: value.constant(21), y: value.constant(rows[20].users) }, label: "campaign", intent: "note" }),
    ],
  }),
};
`;

export const AESTHETICS_SOURCE = `// I — a derived variable, and colour, size and shape driven by data.
let seed = 19;
const random = () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647; };
const kinds = ["sensor", "gateway", "relay"];
const rows = Array.from({ length: 60 }, (_, i) => {
  const load = 2 + random() * 900;
  return { id: i, kind: kinds[i % 3], load, latency: 5 + Math.sqrt(load) * (0.8 + random() * 0.4), uptime: 0.9 + random() * 0.1 };
});

return {
  schema: { fields: [
    { id: "field:id", name: "id", column: "id", semanticType: "quantitative", nullable: false },
    { id: "field:k", name: "kind", column: "kind", semanticType: "nominal", nullable: false },
    { id: "field:load", name: "load", column: "load", semanticType: "quantitative", nullable: false, unit: "rps" },
    { id: "field:lat", name: "latency", column: "latency", semanticType: "quantitative", nullable: false, unit: "ms" },
    { id: "field:up", name: "uptime", column: "uptime", semanticType: "quantitative", nullable: false },
  ]},
  data: { rows, coverage: { kind: "complete", rowCount: rows.length }, identity: { fields: ["field:id"] } },
  document: plot({
    id: "devices",
    description: "Latency against √load; colour = uptime, size = load, shape = kind",
    variables: {
      k: variable.field("field:k", { label: "Kind" }),
      load: variable.field("field:load", { label: "Load" }),
      lat: variable.field("field:lat", { label: "Latency" }),
      up: variable.field("field:up", { label: "Uptime" }),
      // Derived before statistics, from a serialisable expression — no callbacks.
      sqrtLoad: variable.derived(transform.sqrt(transform.variable("load")), { label: "√load", semanticType: "quantitative" }),
    },
    composition: composition.cartesian({ x: value.variable("sqrtLoad"), y: value.variable("lat") }),
    scales: {
      color: scale.colorLinear({ domain: [0.9, 1] }),
      size: scale.size({ range: [2, 9] }),
      shape: scale.shape({ domain: kinds }),
    },
    layers: [
      layer({
        id: "devices",
        mapping: { color: value.variable("up"), size: value.variable("load"), shape: value.variable("k") },
        stat: stat.identity(),
        geom: geom.point({ opacity: 0.85 }),
        position: position.identity(),
      }),
    ],
  }),
};
`;

export const EXAMPLE_SCRIPTS: readonly PlotScriptDoc[] = [
  { id: "example-v1-scatter", name: "A · scatter", source: SCATTER_SOURCE, updatedAt: AT },
  { id: "example-v1-bars", name: "B · dodged bars", source: BARS_SOURCE, updatedAt: AT },
  { id: "example-v1-trend", name: "C · trend over a window", source: TREND_SOURCE, updatedAt: AT },
  { id: "example-v1-distribution", name: "D · histogram + density", source: DISTRIBUTION_SOURCE, updatedAt: AT },
  { id: "example-v1-intervals", name: "E · mean ± SE, boxplot", source: INTERVALS_SOURCE, updatedAt: AT },
  { id: "example-v1-facets", name: "F · facets", source: FACETS_SOURCE, updatedAt: AT },
  { id: "example-v1-stacks", name: "G · stack, fill, polar", source: STACKS_SOURCE, updatedAt: AT },
  { id: "example-v1-guides", name: "H · log, guides, annotations", source: GUIDES_SOURCE, updatedAt: AT },
  { id: "example-v1-aesthetics", name: "I · derived, colour, size, shape", source: AESTHETICS_SOURCE, updatedAt: AT },
];
