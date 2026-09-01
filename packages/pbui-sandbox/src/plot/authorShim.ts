/**
 * The `@hyperslop-systems/plot` authoring API, reproduced as source that is
 * prepended to a plot script's body.
 *
 * Every function in `plot/src/author/*.ts` is a pure object constructor over
 * types whose brands erase at runtime (`plot/src/document.ts:15-36`), so this
 * shim is exact rather than approximate — `authorShim.test.ts` asserts that
 * against the real package for every exported constructor.
 *
 * It is a string, not a module, because it is evaluated inside an engine:
 * under QuickJS there is no module loader, and under `eval` there is no reason
 * to behave differently. It must never import anything.
 *
 * `guide`, `annotation`, `coordinate` and `transform` are deliberately absent
 * from this first version: nothing in the worked examples uses them, and each
 * one added without a call site is one more thing to keep in step. Add them
 * with a parity case each when a script needs them.
 */
export const PLOT_AUTHOR_SHIM_VERSION = 1;

export const PLOT_AUTHOR_SHIM = String.raw`
const plot = (input) => ({ format: "hyperslop.plot", version: 1, ...input });
const layer = (input) => input;

const variable = {
  field: (fieldId, o = {}) => ({ kind: "field", fieldId, ...o }),
  constant: (value) => ({ kind: "constant", value }),
  derived: (expression, o = {}) => ({ kind: "derived", expression, ...o }),
  unity: (o = {}) => ({ kind: "unity", ...o }),
};

const value = {
  variable: (variable) => ({ kind: "variable", variable }),
  afterStat: (output) => ({ kind: "afterStat", output }),
  constant: (value) => ({ kind: "constant", value }),
};

const composition = {
  cartesian: (i) => ({
    dimensions: { ...(i.x ? { x: i.x } : {}), ...(i.y ? { y: i.y } : {}) },
    ...(i.groups ? { groups: i.groups } : {}),
    ...(i.facets ? { facets: i.facets } : {}),
  }),
  algebra: (spec) => ({ dimensions: {}, algebra: spec }),
};

const geom = {
  point: (o = {}) => ({ kind: "point", ...o }),
  line: (o = {}) => ({ kind: "line", ...o }),
  bar: (o = {}) => ({ kind: "bar", ...o }),
  area: (o = {}) => ({ kind: "area", ...o }),
  errorbar: (o = {}) => ({ kind: "errorbar", ...o }),
  ribbon: (o = {}) => ({ kind: "ribbon", ...o }),
  boxplot: (o = {}) => ({ kind: "boxplot", ...o }),
};

const stat = {
  identity: () => ({ kind: "identity" }),
  summary: (o) => ({ kind: "summary", ...o }),
  bin: (o = {}) => ({ kind: "bin", ...o }),
  regression: (o) => ({ kind: "regression", ...o }),
  boxplot: (o = {}) => ({ kind: "boxplot", ...o }),
  density: (o = {}) => ({ kind: "density", ...o }),
};

const position = {
  identity: () => ({ kind: "identity" }),
  stack: () => ({ kind: "stack" }),
  fill: () => ({ kind: "fill" }),
  dodge: () => ({ kind: "dodge" }),
  jitter: (o) => ({ kind: "jitter", ...o }),
};

const scale = {
  linear: (o = {}) => ({ kind: "linear", ...o }),
  log: (o = {}) => ({ kind: "log", ...o }),
  temporal: (o = {}) => ({ kind: "temporal", ...o }),
  band: (o = {}) => ({ kind: "band", ...o }),
  categorical: (o = {}) => ({ kind: "categorical", ...o }),
  colorLinear: (o = {}) => ({ kind: "color-linear", ...o }),
  size: (o = {}) => ({ kind: "size", ...o }),
  shape: (o = {}) => ({ kind: "shape", ...o }),
  opacity: (o = {}) => ({ kind: "opacity", ...o }),
};

const algebra = {
  variable: (variable) => ({ kind: "variable", variable }),
  unity: () => ({ kind: "unity" }),
  cross: (left, right) => ({ kind: "cross", left, right }),
  nest: (outer, inner, o = {}) => ({ kind: "nest", outer, inner, ...o }),
  blend: (operands, o = {}) => ({ kind: "blend", operands, ...o }),
};

const presence = {
  auto: () => ({ kind: "auto" }),
  none: () => ({ kind: "none" }),
  configured: (options) => ({ kind: "configured", options }),
};

const presentation = {
  compact: (o = {}) => ({
    title: presence.none(),
    xGuide: presence.none(),
    yGuide: presence.none(),
    legends: {
      color: presence.none(),
      fill: presence.none(),
      size: presence.none(),
      shape: presence.none(),
      opacity: presence.none(),
    },
    frame: presence.none(),
    padding: o.padding ?? 2,
  }),
};

// The branded id constructors erase at runtime; they exist so a script
// copied out of the plot README runs unchanged.
const plotId = (v) => v;
const variableId = (v) => v;
const fieldId = (v) => v;
const layerId = (v) => v;
const annotationId = (v) => v;
`;

/** The names the shim declares, for a consumer that lists what a script may use. */
export const PLOT_AUTHOR_SHIM_NAMES: readonly string[] = [
  "plot",
  "layer",
  "variable",
  "value",
  "composition",
  "geom",
  "stat",
  "position",
  "scale",
  "algebra",
  "presence",
  "presentation",
  "plotId",
  "variableId",
  "fieldId",
  "layerId",
  "annotationId",
];
