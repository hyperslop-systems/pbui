import { describe, expect, test } from "vitest";
import { renderPbuiPlot, type PlotAnalysisResult } from "../src/appkit/plotAdapter";
import type { AnalysisSpec, AuthoringView } from "../src/model/graphic";
import { fieldRef } from "../src/model/graphicAuthoring";
import type { AnalyticalField, FieldType, Row } from "../src/model/table";

const ref = (name: string) => fieldRef("source:root", name);
const field = (name: string, type: FieldType): AnalyticalField => ({
  fieldId: ref(name).fieldId,
  name,
  type,
  inferred_from: "schema",
});
const fields = [field("x", "q"), field("y", "q"), field("group", "n")];

function result(rows: Row[], hasMore = false): PlotAnalysisResult {
  return {
    rows,
    fields,
    coverage: { kind: "bounded", strategy: "head", rows: rows.length, hasMore },
    resultTruncated: false,
  };
}

function view(
  analysis: AnalysisSpec,
  options: {
    mark?: AuthoringView["mark"];
    x?: string;
    y?: string;
    color?: string;
    facet?: string;
  } = {},
): AuthoringView {
  return {
    id: "view:parity",
    relation: { kind: "source", sourceId: "source:root" },
    mark: options.mark ?? "point",
    encodings: {
      ...(options.x === undefined ? { x: ref("x") } : options.x ? { x: ref(options.x) } : {}),
      ...(options.y === undefined ? { y: ref("y") } : options.y ? { y: ref(options.y) } : {}),
      ...(options.color ? { color: ref(options.color) } : {}),
      ...(options.facet ? { facet: ref(options.facet) } : {}),
    },
    yScale: "linear",
    analysis,
    facetScales: "fixed",
  };
}

const linearRows = [
  { x: 0, y: 1, group: "a" },
  { x: 1, y: 3, group: "a" },
  { x: 2, y: 5, group: "b" },
  { x: 3, y: 7, group: "b" },
];

const errors = (outcome: ReturnType<typeof renderPbuiPlot>) =>
  outcome.diagnostics.filter(({ severity }) => severity === "error");

describe("Datalab scientific parity on canonical Plot", () => {
  test.each(["point", "line", "bar", "area"] as const)(
    "%s identity geometry remains finite and renderer-neutral",
    (mark) => {
      const outcome = renderPbuiPlot(
        `identity-${mark}`,
        view(
          { kind: "identity" },
          {
            mark,
            x: mark === "bar" ? "group" : "x",
            color: mark === "line" ? "group" : undefined,
          },
        ),
        result(linearRows),
        640,
        360,
      );
      expect(errors(outcome)).toEqual([]);
      expect(outcome.grammar?.layers.map(({ geom }) => geom.kind)).toEqual([mark]);
      expect(outcome.plan?.panels[0]?.layers[0]?.kind).toBe(mark);
      expect(outcome.scene?.metadata.renderedMarkCount).toBeGreaterThan(0);
      expect(JSON.stringify(outcome.scene)).not.toMatch(/NaN|Infinity/);
    },
  );

  test("histogram preserves exact bin counts", () => {
    const rows = [
      { x: 0, y: 0, group: "a" },
      { x: 0.2, y: 0, group: "a" },
      { x: 0.8, y: 0, group: "a" },
      { x: 1, y: 0, group: "a" },
    ];
    const outcome = renderPbuiPlot(
      "histogram",
      view({ kind: "histogram", bins: 2 }, { y: "" }),
      result(rows),
      640,
      360,
    );
    expect(errors(outcome)).toEqual([]);
    const bars = outcome.plan?.panels[0]?.layers[0];
    expect(bars?.kind).toBe("bar");
    if (bars?.kind !== "bar") throw new Error("expected histogram bars");
    expect(bars.bars.map(({ datum }) => datum.yValue)).toEqual([2, 2]);
    expect(outcome.plan?.statistics[0]).toMatchObject({ method: "bin", invalidValueCount: 0 });
  });

  test("summary means and standard errors preserve numeric results", () => {
    const rows = [
      { x: 0, y: 1, group: "a" },
      { x: 0, y: 3, group: "a" },
      { x: 1, y: 2, group: "b" },
      { x: 1, y: 4, group: "b" },
    ];
    const outcome = renderPbuiPlot(
      "summary",
      view({ kind: "summary", interval: "standard-error", multiplier: 1 }),
      result(rows),
      640,
      360,
    );
    expect(errors(outcome)).toEqual([]);
    const [errorbar, mean] = outcome.plan?.panels[0]?.layers ?? [];
    if (errorbar?.kind !== "errorbar" || mean?.kind !== "point") {
      throw new Error("expected summary errorbar and mean layers");
    }
    expect(mean.data.map(({ yValue }) => yValue)).toEqual([2, 3]);
    expect(errorbar.data.map(({ yMinValue }) => yMinValue)).toEqual([1, 2]);
    expect(errorbar.data.map(({ yMaxValue }) => yMaxValue)).toEqual([3, 4]);
    expect(outcome.plan?.statistics.map(({ method }) => method)).toEqual(["mean", "mean"]);
  });

  test("OLS preserves slope, intercept, and fit semantics", () => {
    const outcome = renderPbuiPlot(
      "regression",
      view({ kind: "regression", confidence: 0.95 }),
      result(linearRows),
      640,
      360,
    );
    expect(errors(outcome)).toEqual([]);
    expect(outcome.plan?.statistics[1]?.estimates).toMatchObject([
      { count: 4, intercept: 1, slope: 2, rSquared: 1 },
    ]);
    expect(outcome.semantics?.layers.map(({ statistic }) => statistic.method)).toEqual([
      "identity",
      "ols",
      "ols",
    ]);
  });

  test("boxplot preserves the median and whisker ordering", () => {
    const rows = [1, 2, 3, 4, 100].map((y) => ({ x: 0, y, group: "a" }));
    const outcome = renderPbuiPlot("boxplot", view({ kind: "boxplot" }), result(rows), 640, 360);
    expect(errors(outcome)).toEqual([]);
    const planned = outcome.plan?.panels[0]?.layers[0];
    if (planned?.kind !== "boxplot") throw new Error("expected boxplot layer");
    expect(planned.data[0]).toMatchObject({ yValue: 3 });
    expect(planned.data[0]!.whiskerMinValue).toBeLessThanOrEqual(planned.data[0]!.yMinValue!);
    expect(planned.data[0]!.yMinValue).toBeLessThanOrEqual(planned.data[0]!.yValue as number);
    expect(planned.data[0]!.yValue as number).toBeLessThanOrEqual(planned.data[0]!.yMaxValue!);
    expect(planned.data[0]!.yMaxValue).toBeLessThanOrEqual(planned.data[0]!.whiskerMaxValue!);
  });

  test("density emits positive finite estimates and bandwidth metadata", () => {
    const outcome = renderPbuiPlot(
      "density",
      view({ kind: "density", points: 32 }, { y: "", color: "group", mark: "line" }),
      result(linearRows),
      640,
      360,
    );
    expect(errors(outcome)).toEqual([]);
    const planned = outcome.plan?.panels[0]?.layers[0];
    if (planned?.kind !== "line") throw new Error("expected density line");
    expect(planned.groups).toHaveLength(2);
    expect(
      planned.groups.flatMap(({ data }) => data).every(({ yValue }) => Number(yValue) >= 0),
    ).toBe(true);
    expect(outcome.plan?.statistics[0]?.bandwidths).toHaveLength(2);
  });

  test("facets, annotations, and bounded coverage survive as semantics", () => {
    const spec = view({ kind: "identity" }, { facet: "group" });
    spec.references = [{ on: "y", value: 4, label: "limit", intent: "limit" }];
    const outcome = renderPbuiPlot("faceted", spec, result(linearRows, true), 640, 360);
    expect(errors(outcome)).toEqual([]);
    expect(outcome.plan?.panels).toHaveLength(2);
    expect(outcome.plan?.annotations).toHaveLength(2);
    expect(outcome.semantics?.coverage).toMatchObject({ kind: "bounded", hasMore: true });
    expect(outcome.semantics?.annotations).toMatchObject([
      { kind: "rule", label: "limit", intent: "limit" },
    ]);
  });

  test("invalid specifications return diagnostics instead of an incidental scene", () => {
    const outcome = renderPbuiPlot(
      "invalid",
      view({ kind: "identity" }, { y: "" }),
      result(linearRows),
      640,
      360,
    );
    expect(errors(outcome).map(({ code }) => code)).toContain("dimension.required");
    expect(outcome.scene).toBeNull();
  });
});
