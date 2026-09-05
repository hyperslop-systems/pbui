import { EditorView } from "@hyperslop-systems/pbui-editor";
import { createWorkbench } from "@hyperslop-systems/pbui-workbench";
import { create } from "@bufbuild/protobuf";
import { DocumentPayloadSchema, MutationSchema } from "@hyperslop-systems/workbench-protocol";
import { applyMutations } from "@hyperslop-systems/workbench-protocol/client";
import { layout, split, tile } from "@hyperslop-systems/workbench-core";
import { act, cleanup, render, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { createPlotScriptApps } from "./apps";
import { connectPlotScriptDocuments } from "./connect";
import { plotScriptMutation, readPlotScript } from "./document";
import { createPlotScriptHost } from "./host";

const OK = `
const rows = [{ x: 1, y: 2 }, { x: 2, y: 3 }, { x: 3, y: 5 }];
return {
  schema: { fields: [
    { id: "f:x", name: "x", column: "x", semanticType: "quantitative", nullable: false },
    { id: "f:y", name: "y", column: "y", semanticType: "quantitative", nullable: false },
  ]},
  data: { rows, coverage: { kind: "complete", rowCount: rows.length } },
  document: plot({ id: "p", description: "three points", variables: { x: variable.field("f:x"), y: variable.field("f:y") },
    composition: composition.cartesian({ x: value.variable("x"), y: value.variable("y") }),
    layers: [layer({ id: "l", stat: stat.identity(), geom: geom.point(), position: position.identity() })] }),
};`;

afterEach(cleanup);

function mount(source = OK) {
  const host = createPlotScriptHost({ debounceMs: 10 });
  const initial = applyMutations(layout(split("row", 0.5, tile("plot-script", { documents: { plot: "s1" } }), tile("plot-view", { documents: { plot: "s1" } })), { id: "wb" }), [
    plotScriptMutation({ id: "s1", name: "three points", source, updatedAt: "2026-09-01T00:00:00.000Z" }),
  ]);
  const wb = createWorkbench({ apps: createPlotScriptApps(host), initial });
  connectPlotScriptDocuments(wb.core, host);
  const utils = render(<wb.Surface />);
  return { host, wb, ...utils };
}

const editorOf = (container: HTMLElement) => EditorView.findFromDOM(container.querySelector(".cm-editor") as HTMLElement)!;

describe("the script tile and the plot tile over one document", () => {
  test("both mount, the script runs once on open, and the plot draws", async () => {
    const { container, host } = mount();
    expect(container.querySelector('[data-part="plot-script"]')).not.toBeNull();
    expect(container.querySelector('[data-part="plot-view"]')).not.toBeNull();
    expect(editorOf(container).state.doc.toString()).toBe(OK);
    await waitFor(() => expect(host.runner.getState("s1").status).toBe("ok"));
    await waitFor(() => expect(container.querySelector('[data-part="plot-view"] svg')).not.toBeNull());
    const plotView = container.querySelector('[data-part="plot-view"]') as HTMLElement;
    expect(within(plotView).getByText("three points", { selector: "span, div, strong, b, p" })).toBeTruthy();
    expect(container.textContent).toContain("3 rows · complete");
    expect(container.querySelector('[data-part="plot-script"]')?.textContent).toContain("ok");
  });

  test("typing schedules a run; a good run writes the document; a bad one keeps the plot and marks it stale", async () => {
    const { container, host, wb } = mount();
    await waitFor(() => expect(host.runner.getState("s1").status).toBe("ok"));
    const view = editorOf(container);
    const next = OK.replace("three points", "four points");
    act(() => {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: next } });
    });
    // Draft changed, nothing drawn yet from it → stale until the debounce fires.
    expect(container.textContent).toContain("stale");
    await waitFor(() => expect(host.runner.getState("s1").lastGoodSource).toBe(next));
    await waitFor(() => expect(readPlotScript(wb.core.getState().document, "s1")?.source).toBe(next));
    await waitFor(() => expect(container.textContent).not.toContain("stale"));
    expect(container.textContent).toContain("four points");

    act(() => {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: "return {" } });
    });
    await waitFor(() => expect(host.runner.getState("s1").status).toBe("error"));
    expect(container.querySelector('[data-part="plot-script-output"]')?.textContent).toMatch(/SyntaxError/);
    // The plot is still the last good one, marked stale; the document is untouched.
    expect(container.querySelector('[data-part="plot-view"] svg')).not.toBeNull();
    expect(container.textContent).toContain("stale");
    expect(readPlotScript(wb.core.getState().document, "s1")?.source).toBe(next);
  });

  test("console output reaches the output pane", async () => {
    const { container, host } = mount(`console.log("hello", 42); ${OK}`);
    await waitFor(() => expect(host.runner.getState("s1").status).toBe("ok"));
    expect(container.querySelector('[data-part="plot-script-output"]')?.textContent).toContain("hello 42");
  });

  test("a script that returns a list draws a grid, one plot per result", async () => {
    const list = OK.replace("return {", "const one = {").replace(/\};\s*$/, "}; return [one, { ...one, document: { ...one.document, id: 'second', description: 'the second' } }];");
    const { container, host } = mount(list);
    await waitFor(() => expect(host.runner.getState("s1").status).toBe("ok"));
    await waitFor(() => expect(container.querySelector('[data-part="plot-grid"]')).not.toBeNull());
    expect(container.querySelector('[data-part="plot-grid"]')?.getAttribute("data-count")).toBe("2");
    await waitFor(() => expect(container.querySelectorAll('[data-part="plot-grid"] svg').length).toBe(2));
    expect(container.textContent).toContain("2 plots");
    expect(container.textContent).toContain("the second");
  });

  test("resetting the workbench AND the host restores the seeded source and re-runs it", async () => {
    // The P2 scenario from PR #22: reset must clear the host's drafts and
    // runner state, or remounted tiles keep showing the edited script.
    const { container, host, wb } = mount();
    await waitFor(() => expect(host.runner.getState("s1").status).toBe("ok"));
    const view = editorOf(container);
    const edited = OK.replace("three points", "still three points");
    act(() => {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: edited } });
    });
    await waitFor(() => expect(host.runner.getState("s1").lastGoodSource).toBe(edited));
    await waitFor(() => expect(readPlotScript(wb.core.getState().document, "s1")?.source).toBe(edited));

    // The demo's reset sequence.
    await act(async () => {
      wb.reset();
      host.drafts.clear();
      await host.runner.disposeAll();
    });
    await waitFor(() => expect(editorOf(container).state.doc.toString()).toBe(OK));
    await waitFor(() => expect(host.runner.getState("s1").lastGoodSource).toBe(OK));
    await waitFor(() => expect(container.querySelector('[data-part="plot-view"] svg')).not.toBeNull());
    expect(container.textContent).toContain("three points");
    expect(container.textContent).not.toContain("still three points");
  });

  test("an unbound tile and a missing script each say so", () => {
    const host = createPlotScriptHost();
    // The core validates bindings at its door, so "missing" means a document
    // that exists but is not a plot script (a foreign format), not an id
    // nothing holds.
    const ghost = create(MutationSchema, { body: { case: "documentPut", value: { document: create(DocumentPayloadSchema, { id: "ghost", format: "not.a.plotscript", schemaVersion: 1, body: {} }) } } });
    const wb = createWorkbench({
      apps: createPlotScriptApps(host),
      initial: applyMutations(layout(split("row", 0.5, tile("plot-script"), tile("plot-view", { documents: { plot: "ghost" } })), { id: "wb" }), [ghost]),
    });
    const { container } = render(<wb.Surface />);
    expect(container.textContent).toContain("this tile names no script");
    expect(container.textContent).toContain('no script "ghost"');
  });
});
