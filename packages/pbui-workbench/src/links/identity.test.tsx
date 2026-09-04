import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { create } from "@bufbuild/protobuf";
import { createPresentationTypeGraph, documentSlotPort, linkVerbs, resetEscapeSurfaces } from "@hyperslop-systems/pbui";
import { commands, layout, split, stateOf, tile } from "@hyperslop-systems/workbench-core";
import { DocumentPayloadSchema, MutationSchema } from "@hyperslop-systems/workbench-protocol";
import { applyMutations, leaves, workspaceTree } from "@hyperslop-systems/workbench-protocol/client";
import { defineWorkbenchApp } from "../app";
import { createWorkbench } from "../createWorkbenchShell";

/*
 * Identity through the workbench (Phase 5): the declaration lands in the
 * document with its compiled class, the runtime's class cell is what both
 * members read and write, the badge reads ≡, the split policies initialise
 * the fragments, and Ctrl-drag in connect mode is the gesture.
 */

const graph = createPresentationTypeGraph([{ id: "datum" }]);
const SEL = (id: string) => ({ type: "datum", value: [{ relation: "orders", identity: { id } }] });
const selection = (authority: string) => ({ name: "selection", direction: "inout" as const, contract: { valueType: "datum", semanticRole: "selection", cardinality: "many" as const, authorityDomain: authority }, doc: "the selection" });
const tableApp = defineWorkbenchApp({ manifest: { id: "table", ports: [selection("orders")] }, presentation: { title: "table", tone: "var(--pbui-cat-1)", Component: () => null } });
const plotApp = defineWorkbenchApp({
  // The authority is a fact of the VIEW: whichever table the plot is bound to (Q7).
  // `table` is a declared document slot: the core validates bindings at its door.
  manifest: { id: "plot", ports: [documentSlotPort("table", "the table this plot reads"), { ...selection("plot"), refineContract: (view) => ({ authorityDomain: view.documents["table"] ?? "plot" }) }] },
  presentation: { title: "plot", tone: "var(--pbui-cat-2)", Component: () => null },
});
const withTables = (doc: ReturnType<typeof layout>) =>
  applyMutations(doc, ["orders", "daily_sales"].map((id) => create(MutationSchema, { body: { case: "documentPut", value: { document: create(DocumentPayloadSchema, { id, format: "table", schemaVersion: 1, body: {} }) } } })));

function scene() {
  const wb = createWorkbench({
    apps: [tableApp, plotApp],
    initial: withTables(layout(split("row", 0.5, tile("table", { title: "Orders" }), split("col", 0.5, tile("plot", { title: "By status", documents: { table: "orders" } }), tile("plot", { title: "Sales", documents: { table: "daily_sales" } }))))),
    links: { graph },
  });
  const [table, plot, sales] = leaves(workspaceTree(wb.core.getState().document, wb.core.getState().session.workspaceId)).map((leaf) => (leaf.body.case === "leaf" ? leaf.body.value.viewId : ""));
  render(<wb.Surface />);
  return { wb, table: table!, plot: plot!, sales: sales! };
}

afterEach(() => {
  cleanup();
  resetEscapeSurfaces();
  document.body.innerHTML = "";
});

const badges = () => [...document.querySelectorAll('[data-part="port-badge"]')].map((el) => `${el.getAttribute("data-state")}:${el.textContent}`);

describe("identity classes through the workbench", () => {
  it("identity.add persists the declaration and its class, seeds the cell, and both members read it; the sales plot is incompatible", () => {
    const { wb, table, plot, sales } = scene();
    wb.links.runtime.emit(`${table}/selection`, SEL("88213"));
    expect(act(() => wb.perform(linkVerbs.identityAdd(`${table}/selection`, `${sales}/selection`)))).toBeTruthy();
    // Refused (different authority domain): nothing written.
    expect(stateOf(wb.core.getState().document).identity).toEqual([]);
    expect(act(() => wb.perform(linkVerbs.identityAdd(`${table}/selection`, `${plot}/selection`)))).toBeTruthy();
    const state = stateOf(wb.core.getState().document);
    expect(state.identity).toHaveLength(1);
    expect(state.classes[0]).toMatchObject({ id: "σ1", members: [`${plot}/selection`, `${table}/selection`].sort() });
    expect(wb.links.runtime.getState().classes.get("σ1")).toEqual(SEL("88213"));
    expect(badges()).toEqual(["shared:≡selection · σ1", "shared:≡selection · σ1"]);
    // Emitting from either member writes the shared cell.
    act(() => wb.links.runtime.emit(`${plot}/selection`, SEL("88214"), { classId: "σ1" }));
    expect(wb.links.runtime.getState().classes.get("σ1")).toEqual(SEL("88214"));
    const snapshot = wb.linkSnapshot();
    expect(snapshot.aliases.get(`${table}/selection`)).toBe("σ1");
  });

  it("identity.remove with history gives each side back what it showed before the merge", () => {
    const { wb, table, plot } = scene();
    wb.links.runtime.emit(`${table}/selection`, SEL("A"));
    wb.links.runtime.emit(`${plot}/selection`, SEL("B"));
    act(() => void wb.perform(linkVerbs.identityAdd(`${table}/selection`, `${plot}/selection`, "prefer-right")));
    expect(wb.links.runtime.getState().classes.get("σ1")).toEqual(SEL("B"));
    const linkId = stateOf(wb.core.getState().document).identity[0]!.linkId;
    expect(act(() => wb.perform(linkVerbs.identityRemove(linkId, "history")))).toBeTruthy();
    expect(stateOf(wb.core.getState().document).identity).toEqual([]);
    expect(stateOf(wb.core.getState().document).classes).toEqual([]);
    expect(wb.links.runtime.getState().emitted.get(`${table}/selection`)).toEqual(SEL("A"));
    expect(wb.links.runtime.getState().emitted.get(`${plot}/selection`)).toEqual(SEL("B"));
    expect(wb.links.runtime.getState().classes.has("σ1")).toBe(false);
    expect(badges()).toEqual([]);
  });

  it("Explicit Share in connect mode declares an identity, drawn as a double wire", () => {
    const { wb, table, plot } = scene();
    act(() => void wb.perform(linkVerbs.openMode()));
    const from = document.querySelector(`[data-part="port-rail-port"][data-side="out"][data-port-id="${table}/selection"]`) as HTMLElement;
    const to = document.querySelector(`[data-part="port-rail-port"][data-side="in"][data-port-id="${plot}/selection"]`) as HTMLElement;
    fireEvent.change(document.querySelector('[aria-label="Connection operation"]')!,{target:{value:"share"}});
    fireEvent.click(from);
    fireEvent.click(to);
    expect(stateOf(wb.core.getState().document).identity).toHaveLength(1);
    expect(document.querySelector('[data-part="wire"][data-term="identity"]')).not.toBeNull();
  });

  it("closing a member's tile drops the class; serialize/restore keeps the class id", () => {
    const { wb, table, plot } = scene();
    act(() => void wb.perform(linkVerbs.identityAdd(`${table}/selection`, `${plot}/selection`)));
    const json = wb.serialize();
    const again = createWorkbench({ apps: [tableApp, plotApp], initial: layout(tile("table")), links: { graph } });
    expect(again.restore(json)).toBe(true);
    expect(stateOf(again.core.getState().document).classes[0]?.id).toBe("σ1");
    const placement = leaves(workspaceTree(wb.core.getState().document, wb.core.getState().session.workspaceId))[1]!.id;
    act(() => void wb.execute(commands.close(placement)));
    expect(stateOf(wb.core.getState().document).identity).toEqual([]);
    expect(stateOf(wb.core.getState().document).classes).toEqual([]);
  });
});
