import { createAppRegistry, createWorkbench, layout, split, tile } from "@hyperslop-systems/pbui-workbench";
import { applyMutations } from "@hyperslop-systems/workbench-protocol/client";
import { describe, expect, it } from "vitest";
import { createPlotScriptApps } from "./apps";
import { connectPlotScriptDocuments } from "./connect";
import { plotScriptMutation, readPlotScript } from "./document";
import { createPlotScriptHost } from "./host";

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

function make(source = "return null;") {
  const host = createPlotScriptHost();
  const initial = applyMutations(layout(split("row", 0.5, tile("plot-script", { documents: { plot: "s1" } }), tile("plot-view", { documents: { plot: "s1" } })), { id: "wb" }), [
    plotScriptMutation({ id: "s1", name: "s", source, updatedAt: "2026-09-01T00:00:00.000Z" }),
  ]);
  const wb = createWorkbench({ apps: createAppRegistry(createPlotScriptApps(host)), initial });
  const disconnect = connectPlotScriptDocuments(wb, host);
  return { host, wb, disconnect };
}

const sourceOf = (wb: ReturnType<typeof make>["wb"]) => readPlotScript(wb.store.getState().document, "s1")?.source;

describe("connectPlotScriptDocuments", () => {
  it("persists a successful run with NO tile mounted — the run outlives any component", async () => {
    // The P1 scenario from PR #22: nothing is rendered at all, so nothing can
    // unmount; persistence must still happen.
    const { host, wb } = make();
    await host.runner.run("s1", OK);
    expect(sourceOf(wb)).toBe(OK);
  });

  it("writes nothing for a failing run, an unknown script, or an unchanged source", async () => {
    const { host, wb } = make(OK);
    await host.runner.run("s1", "return {");
    expect(sourceOf(wb)).toBe(OK);
    await host.runner.run("ghost", OK);
    expect(readPlotScript(wb.store.getState().document, "ghost")).toBeNull();
    const before = wb.store.getState().document;
    await host.runner.run("s1", OK); // succeeds, but the document already holds this source
    expect(wb.store.getState().document).toBe(before);
  });

  it("disconnect stops the writes", async () => {
    const { host, wb, disconnect } = make();
    disconnect();
    await host.runner.run("s1", OK);
    expect(sourceOf(wb)).toBe("return null;");
  });
});
