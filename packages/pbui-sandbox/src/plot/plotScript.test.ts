import { renderPlot } from "@hyperslop-systems/plot";
import { describe, expect, it } from "vitest";
import type { ProgramEngine } from "../engine";
import { createEvalEngine } from "../engines/evalEngine";
import { createQuickJsDirectEngine } from "../quickjs/directEngine";
import { PLOT_HOST_PROGRAM, buildPlotScriptCode, runPlotScript } from "./plotScript";

const SCATTER = `
const rows = [
  { month: 1, temp: 3.2 }, { month: 2, temp: 4.1 }, { month: 3, temp: 8.7 },
  { month: 4, temp: 13.0 }, { month: 5, temp: 18.4 }, { month: 6, temp: 22.9 },
];
return {
  schema: { fields: [
    { id: "field:month", name: "month", column: "month", semanticType: "quantitative", nullable: false },
    { id: "field:temp", name: "temperature", column: "temp", semanticType: "quantitative", nullable: false, unit: "°C" },
  ]},
  data: { rows, coverage: { kind: "complete", rowCount: rows.length } },
  document: plot({
    id: "monthly-temperature",
    variables: { month: variable.field("field:month", { label: "Month" }), temp: variable.field("field:temp", { label: "Temperature" }) },
    composition: composition.cartesian({ x: value.variable("month"), y: value.variable("temp") }),
    layers: [layer({ id: "points", stat: stat.identity(), geom: geom.point(), position: position.identity() })],
  }),
};
`;

/** More rows than __describe's 200-item cap, to prove the string boundary carries them all. */
const WIDE = `
const rows = Array.from({ length: 1000 }, (_, i) => ({ i, v: i % 7 }));
return {
  schema: { fields: [
    { id: "field:i", name: "i", column: "i", semanticType: "quantitative", nullable: false },
    { id: "field:v", name: "v", column: "v", semanticType: "quantitative", nullable: false },
  ]},
  data: { rows, coverage: { kind: "complete", rowCount: rows.length } },
  document: plot({
    id: "wide",
    variables: { i: variable.field("field:i"), v: variable.field("field:v") },
    composition: composition.cartesian({ x: value.variable("i"), y: value.variable("v") }),
    layers: [layer({ id: "l", stat: stat.identity(), geom: geom.line(), position: position.identity() })],
  }),
};
`;

function suite(name: string, make: () => ProgramEngine) {
  describe(`plot scripts under ${name}`, () => {
    async function host(id = "plot-1") {
      const engine = make();
      await engine.load({ instanceId: id, programId: "plot-script-host", source: PLOT_HOST_PROGRAM });
      return engine;
    }

    it("runs the scatter example and the result renders a scene with no error diagnostics", async () => {
      const engine = await host();
      const run = await runPlotScript(engine, { instanceId: "plot-1", source: SCATTER });
      expect(run.status).toBe("ok");
      if (run.status !== "ok") return;
      expect(run.result.data.rows).toHaveLength(6);
      const outcome = renderPlot({ ...run.result, viewport: { width: 640, height: 360 } });
      expect(outcome.scene).not.toBeNull();
      expect(outcome.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    });

    it("carries every row across the boundary, past __describe's 200-item cap", async () => {
      const engine = await host();
      const run = await runPlotScript(engine, { instanceId: "plot-1", source: WIDE });
      expect(run.status).toBe("ok");
      if (run.status === "ok") expect(run.result.data.rows).toHaveLength(1000);
    });

    it("a script's declarations do not leak into the next run", async () => {
      const engine = await host();
      await runPlotScript(engine, { instanceId: "plot-1", source: "const secret = 1; return null;" });
      const run = await runPlotScript(engine, { instanceId: "plot-1", source: "return { secret: typeof secret };" });
      // `return null` → "invalid" (not an object); the second run sees no `secret`.
      expect(run.status).toBe("invalid");
      if (run.status === "invalid") expect(run.problem.kind).toBe("missing");
    });

    it("a syntax error, a reference error and a thrown error are returned, not thrown", async () => {
      const engine = await host();
      const syntax = await runPlotScript(engine, { instanceId: "plot-1", source: "return {" });
      expect(syntax.status).toBe("error");
      if (syntax.status === "error") expect((syntax.error as Error).name).toBe("SyntaxError");
      const reference = await runPlotScript(engine, { instanceId: "plot-1", source: "return nope.x;" });
      expect(reference.status).toBe("error");
      if (reference.status === "error") expect((reference.error as Error).name).toBe("ReferenceError");
      const thrown = await runPlotScript(engine, { instanceId: "plot-1", source: "throw new RangeError('too far');" });
      expect(thrown.status).toBe("error");
      if (thrown.status === "error") expect((thrown.error as Error).message).toMatch(/too far/);
    });

    it("a result that is not shaped like a plot request names the problem", async () => {
      const engine = await host();
      const run = await runPlotScript(engine, { instanceId: "plot-1", source: "return { document: {}, schema: { fields: [] }, data: { rows: [], coverage: { kind: 'complete', rowCount: 0 } } };" });
      expect(run).toMatchObject({ status: "invalid", problem: { kind: "bad-format" } });
    });

    it("a script that returns nothing is invalid, not an engine error", async () => {
      const engine = await host();
      const run = await runPlotScript(engine, { instanceId: "plot-1", source: "const x = 1;" });
      expect(run).toMatchObject({ status: "invalid", problem: { kind: "not-an-object" } });
    });

    it("the row limit applies", async () => {
      const engine = await host();
      const run = await runPlotScript(engine, { instanceId: "plot-1", source: WIDE, limits: { rows: 100 } });
      expect(run).toMatchObject({ status: "invalid", problem: { kind: "too-many-rows", got: 1000, limit: 100 } });
    });
  });
}

suite("eval", () => createEvalEngine());
suite("quickjs (direct)", () => createQuickJsDirectEngine());

describe("buildPlotScriptCode", () => {
  it("is a single expression that JSON-stringifies the body's return value", () => {
    const code = buildPlotScriptCode("return { a: 1 };");
    expect(code.startsWith("JSON.stringify(")).toBe(true);
    expect(new Function(`return (${code});`)()).toBe('{"a":1}');
  });
});
