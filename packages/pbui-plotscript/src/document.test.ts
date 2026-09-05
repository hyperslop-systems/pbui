import { applyMutations } from "@hyperslop-systems/workbench-protocol/client";
import { emptyDocument, layout, parseWorkbenchDocument, serializeDocument, tile } from "@hyperslop-systems/workbench-core";
import { describe, expect, it } from "vitest";
import { deletePlotScriptMutation, listPlotScripts, plotScriptMutation, readPlotScript } from "./document";

const script = { id: "s1", name: "scatter", source: "return null;", updatedAt: "2026-09-01T12:00:00.000Z" };

describe("PlotScriptDoc as a DocumentPayload", () => {
  it("round-trips through the document, and through serialize/parse", () => {
    // parseWorkbenchDocument refuses a document with no workspace, so seed one tile.
    const doc = applyMutations(layout(tile("plot-view"), { id: "wb" }), [plotScriptMutation(script)]);
    expect(readPlotScript(doc, "s1")).toEqual(script);
    const parsed = parseWorkbenchDocument(serializeDocument(doc));
    const again = parsed.ok ? parsed.document : null;
    expect(again && readPlotScript(again, "s1")).toEqual(script);
  });

  it("overwrites in place and deletes", () => {
    let doc = applyMutations(emptyDocument({ id: "wb" }), [plotScriptMutation(script)]);
    doc = applyMutations(doc, [plotScriptMutation({ ...script, source: "return 1;" })]);
    expect(readPlotScript(doc, "s1")?.source).toBe("return 1;");
    doc = applyMutations(doc, [deletePlotScriptMutation("s1")]);
    expect(readPlotScript(doc, "s1")).toBeNull();
  });

  it("reads a foreign-format payload as not-a-script, and lists only scripts", () => {
    const doc = applyMutations(emptyDocument({ id: "wb" }), [
      plotScriptMutation(script),
      plotScriptMutation({ ...script, id: "s2", name: "bars" }),
    ]);
    const foreign = { ...doc, documents: { ...doc.documents, other: { ...doc.documents.s1!, id: "other", format: "something.else" } } };
    expect(readPlotScript(foreign, "other")).toBeNull();
    expect(listPlotScripts(foreign).map((s) => s.id)).toEqual(["s1", "s2"]);
  });

  it("tolerates a malformed body field-by-field", () => {
    const doc = applyMutations(emptyDocument({ id: "wb" }), [plotScriptMutation(script)]);
    const broken = { ...doc, documents: { s1: { ...doc.documents.s1!, body: { name: 3 } } } };
    expect(readPlotScript(broken, "s1")).toEqual({ id: "s1", name: "s1", source: "", updatedAt: "" });
  });
});
