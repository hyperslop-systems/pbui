import { renderPlot } from "@hyperslop-systems/plot";
import { createAppRegistry, createWorkbench, layout, parseDocument, serializeDocument, split, tile } from "@hyperslop-systems/pbui-workbench";
import { applyMutations } from "@hyperslop-systems/workbench-protocol/client";
import { createPlotScriptApps } from "./apps";
import { plotScriptMutation, listPlotScripts } from "./document";
import { createPlotScriptHost } from "./host";
import { createEvalEngine } from "@hyperslop-systems/pbui-sandbox";
import { describe, expect, it } from "vitest";
import { EXAMPLE_SCRIPTS } from "./examples";
import { createPlotScriptRunner } from "./runner";

describe("the seeded examples", () => {
  it.each(EXAMPLE_SCRIPTS.map((s) => [s.name, s] as const))("%s runs and renders a scene with no error diagnostics", async (_name, script) => {
    const runner = createPlotScriptRunner({ engine: createEvalEngine() });
    await runner.run(script.id, script.source);
    const state = runner.getState(script.id);
    expect(state.status, JSON.stringify(state.error ?? state.problem)).toBe("ok");
    expect(state.lastGoodAll.length).toBeGreaterThan(0);
    for (const result of state.lastGoodAll) {
      const outcome = renderPlot({ ...result, viewport: { width: 640, height: 360 } });
      expect(outcome.scene, result.document.id).not.toBeNull();
      expect(outcome.diagnostics.filter((d) => d.severity === "error"), result.document.id).toEqual([]);
    }
  });

  it("the list-returning examples return more than one plot", async () => {
    const runner = createPlotScriptRunner({ engine: createEvalEngine() });
    for (const id of ["example-v1-distribution", "example-v1-intervals", "example-v1-stacks"]) {
      const script = EXAMPLE_SCRIPTS.find((s) => s.id === id)!;
      await runner.run(id, script.source);
      expect(runner.getState(id).lastGoodAll.length, id).toBeGreaterThan(1);
    }
  });

  it("uses versioned ids so a revision never mutates a persisted example", () => {
    for (const script of EXAMPLE_SCRIPTS) expect(script.id).toMatch(/^example-v\d+-/);
    expect(new Set(EXAMPLE_SCRIPTS.map((s) => s.id)).size).toBe(EXAMPLE_SCRIPTS.length);
  });
});

describe("the seeded demo document", () => {
  it("all nine scripts survive serialize → restore, layouts included", () => {
    const initial = applyMutations(
      layout(split("row", 0.5, tile("plot-script", { documents: { plot: EXAMPLE_SCRIPTS[0]!.id } }), tile("plot-view", { documents: { plot: EXAMPLE_SCRIPTS[0]!.id } })), { id: "wb" }),
      EXAMPLE_SCRIPTS.map((s) => plotScriptMutation(s)),
    );
    const wb = createWorkbench({ apps: createAppRegistry(createPlotScriptApps(createPlotScriptHost())), initial });
    const again = parseDocument(serializeDocument(wb.store.getState().document));
    expect(again).not.toBeNull();
    expect(listPlotScripts(again!).map((s) => s.id)).toEqual(EXAMPLE_SCRIPTS.map((s) => s.id));
    expect(listPlotScripts(again!).map((s) => s.source)).toEqual(EXAMPLE_SCRIPTS.map((s) => s.source));
  });
});
