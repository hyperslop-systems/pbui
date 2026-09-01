import { renderPlot } from "@hyperslop-systems/plot";
import { createEvalEngine } from "@hyperslop-systems/pbui-sandbox";
import { describe, expect, it } from "vitest";
import { EXAMPLE_SCRIPTS } from "./examples";
import { createPlotScriptRunner } from "./runner";

describe("the seeded examples", () => {
  it.each(EXAMPLE_SCRIPTS.map((s) => [s.name, s] as const))("%s runs and renders a scene with no error diagnostics", async (_name, script) => {
    const runner = createPlotScriptRunner({ engine: createEvalEngine() });
    await runner.run(script.id, script.source);
    const state = runner.getState(script.id);
    expect(state.status).toBe("ok");
    const outcome = renderPlot({ ...state.lastGood!, viewport: { width: 640, height: 360 } });
    expect(outcome.scene).not.toBeNull();
    expect(outcome.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  });

  it("uses versioned ids so a revision never mutates a persisted example", () => {
    for (const script of EXAMPLE_SCRIPTS) expect(script.id).toMatch(/^example-v\d+-/);
    expect(new Set(EXAMPLE_SCRIPTS.map((s) => s.id)).size).toBe(EXAMPLE_SCRIPTS.length);
  });
});
