import { createEvalEngine, type ProgramEngine } from "@hyperslop-systems/pbui-sandbox";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createPlotScriptRunner, IDLE_RUN } from "./runner";

const OK = `
const rows = [{ x: 1, y: 2 }, { x: 2, y: 3 }];
return {
  schema: { fields: [
    { id: "f:x", name: "x", column: "x", semanticType: "quantitative", nullable: false },
    { id: "f:y", name: "y", column: "y", semanticType: "quantitative", nullable: false },
  ]},
  data: { rows, coverage: { kind: "complete", rowCount: 2 } },
  document: plot({ id: "p", variables: { x: variable.field("f:x"), y: variable.field("f:y") },
    composition: composition.cartesian({ x: value.variable("x"), y: value.variable("y") }),
    layers: [layer({ id: "l", stat: stat.identity(), geom: geom.point(), position: position.identity() })] }),
};`;

afterEach(() => {
  vi.useRealTimers();
});

describe("createPlotScriptRunner", () => {
  it("starts idle, runs, and publishes ok with lastGood", async () => {
    const runner = createPlotScriptRunner({ engine: createEvalEngine() });
    expect(runner.getState("a")).toBe(IDLE_RUN);
    await runner.run("a", OK);
    const state = runner.getState("a");
    expect(state.status).toBe("ok");
    expect(state.lastGood?.data.rows).toHaveLength(2);
    expect(state.lastGoodSource).toBe(OK);
    expect(state.runCount).toBe(1);
  });

  it("keeps lastGood through a failing run, and reports the error", async () => {
    const runner = createPlotScriptRunner({ engine: createEvalEngine() });
    await runner.run("a", OK);
    await runner.run("a", "return {");
    const state = runner.getState("a");
    expect(state.status).toBe("error");
    expect(state.error?.code).toBe("RUNTIME_ERROR");
    expect(state.error?.message).toMatch(/SyntaxError/);
    expect(state.lastGood?.data.rows).toHaveLength(2);
    expect(state.lastGoodSource).toBe(OK);
    await runner.run("a", "return { document: {}, schema: { fields: [] }, data: { rows: [], coverage: { kind: 'complete', rowCount: 0 } } };");
    expect(runner.getState("a")).toMatchObject({ status: "invalid", problem: { kind: "bad-format" } });
    expect(runner.getState("a").lastGood?.data.rows).toHaveLength(2);
  });

  it("discards a stale run: the earlier run resolving later does not publish", async () => {
    const base = createEvalEngine();
    let release: (() => void) | null = null;
    // The first evaluate blocks until released; the second is immediate.
    let calls = 0;
    const engine: ProgramEngine = {
      ...base,
      evaluate: (input) => {
        calls += 1;
        if (calls === 1) return new Promise((resolve) => { release = () => resolve(base.evaluate(input)); });
        return base.evaluate(input);
      },
    };
    const runner = createPlotScriptRunner({ engine });
    const first = runner.run("a", "return null;"); // would be "invalid"
    const second = runner.run("a", OK);
    await second;
    expect(runner.getState("a").status).toBe("ok");
    release!();
    await first;
    expect(runner.getState("a").status).toBe("ok");
    expect(runner.getState("a").runCount).toBe(1);
  });

  it("schedule debounces, and a newer schedule cancels the older one", async () => {
    vi.useFakeTimers();
    const onRan = vi.fn();
    const runner = createPlotScriptRunner({ engine: createEvalEngine(), debounceMs: 100, onRan });
    runner.schedule("a", "return {");
    runner.schedule("a", OK);
    await vi.advanceTimersByTimeAsync(99);
    expect(runner.getState("a").status).toBe("idle");
    await vi.advanceTimersByTimeAsync(2);
    await vi.runAllTimersAsync();
    expect(runner.getState("a").status).toBe("ok");
    expect(onRan).toHaveBeenCalledTimes(1);
    expect(onRan).toHaveBeenCalledWith("a", OK, expect.objectContaining({ status: "ok" }));
  });

  it("captures console output and two scripts do not share instances", async () => {
    const runner = createPlotScriptRunner({ engine: createEvalEngine() });
    await runner.run("a", "const secret = 1; console.log('a ran'); return null;");
    await runner.run("b", "return { secret: typeof secret };");
    expect(runner.getState("a").logs).toEqual([{ level: "log", text: "a ran" }]);
    expect(runner.getState("b")).toMatchObject({ status: "invalid", problem: { kind: "missing" } });
  });

  it("dispose forgets state and the instance; a run after dispose reloads", async () => {
    const engine = createEvalEngine();
    const runner = createPlotScriptRunner({ engine });
    await runner.run("a", OK);
    expect((await engine.health()).instances).toContain("plot-script:a");
    await runner.dispose("a");
    expect(runner.getState("a")).toBe(IDLE_RUN);
    expect((await engine.health()).instances).not.toContain("plot-script:a");
    await runner.run("a", OK);
    expect(runner.getState("a").status).toBe("ok");
  });
});
