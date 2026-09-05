import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createPresentationTypeGraph, linkVerbs, resetEscapeSurfaces } from "@hyperslop-systems/pbui";
import { bindingsOf, layout, split, tile, type LayoutSpec } from "@hyperslop-systems/workbench-core";
import { leaves, viewsOfApp, workspaceTree } from "@hyperslop-systems/workbench-protocol/client";
import { defineWorkbenchApp } from "../app";
import { createWorkbench } from "../createWorkbenchShell";

/*
 * "Show details…" end to end (design §8.6): one free target → performed;
 * a held target → left alone; two equal targets → the chooser, whose row
 * performs the same verb with a candidate id; nothing on screen → a tile is
 * spawned beside the source AND linked in one batch.
 */

const graph = createPresentationTypeGraph([{ id: "inspectable", abstract: true }, { id: "order", parents: ["inspectable"] }]);
const ORDER = { type: "order", value: { id: "1042" } };
const ordersApp = defineWorkbenchApp({ manifest: { id: "orders", ports: [{ name: "order", direction: "out", contract: { valueType: "order", semanticRole: "order.current" }, doc: "the clicked order" }] }, presentation: { title: "orders", tone: "var(--pbui-cat-1)", Component: () => null } });
const detailApp = defineWorkbenchApp({ manifest: { id: "detail", ports: [{ name: "order", direction: "in", contract: { valueType: "order", semanticRole: "order.detail" }, doc: "the order shown", fallbackContext: "workspace.order" }] }, presentation: { title: "detail", tone: "var(--pbui-cat-2)", Component: () => null } });
const inspectorApp = defineWorkbenchApp({ manifest: { id: "inspector", ports: [{ name: "subject", direction: "in", contract: "inspectable", doc: "anything" }] }, presentation: { title: "inspector", tone: "var(--pbui-cat-3)", Component: () => null } });

function scene(spec: LayoutSpec) {
  const onCommit = vi.fn();
  const wb = createWorkbench({ apps: [ordersApp, detailApp, inspectorApp], initial: layout(spec), links: { graph, label: (r) => `#${(r.value as { id: string }).id}` }, onCommit });
  const views = () => leaves(workspaceTree(wb.core.getState().document, wb.core.getState().session.workspaceId)).map((leaf) => (leaf.body.case === "leaf" ? leaf.body.value.viewId : ""));
  render(<wb.Surface />);
  return { wb, views, onCommit };
}

afterEach(() => {
  cleanup();
  resetEscapeSurfaces();
  document.body.innerHTML = "";
});

function performed<T>(run: () => T): T {
  let result!: T;
  act(() => {
    result = run();
  });
  return result;
}

const badges = () => [...document.querySelectorAll('[data-part="port-badge"]')].map((el) => `${el.getAttribute("data-state")}:${el.textContent}`);

describe("show", () => {
  it("one free detail: the show makes it follow the source", () => {
    const { wb, views } = scene(split("row", 0.5, tile("orders", { title: "Orders East" }), tile("detail")));
    const [orders, detail] = views();
    wb.links.runtime.emit(`${orders}/order`, ORDER);
    expect(act(() => wb.perform(linkVerbs.show(ORDER, { from: `${orders}/order` })))).toBeTruthy();
    expect(bindingsOf(wb.core.getState().document).get(`${detail}/order`)).toMatchObject({ kind: "follow", source: `${orders}/order` });
    expect(badges()).toEqual(["following:→Orders East"]);
    // The subject's provenance is found through the runtime when `from` is not given.
    expect(act(() => wb.perform(linkVerbs.clear(`${detail}/order`)))).toBeTruthy();
    expect(act(() => wb.perform(linkVerbs.show(ORDER)))).toBeTruthy();
    expect(bindingsOf(wb.core.getState().document).get(`${detail}/order`)?.kind).toBe("follow");
  });

  it("two details, one held: the free one is chosen; the held one is left alone", () => {
    const { wb, views } = scene(split("row", 0.5, tile("orders", { title: "Orders East" }), split("col", 0.5, tile("detail", { title: "A" }), tile("detail", { title: "B" }))));
    const [orders, a, b] = views();
    wb.links.runtime.emit(`${orders}/order`, ORDER);
    act(() => void wb.perform(linkVerbs.follow(`${orders}/order`, `${a}/order`)));
    act(() => void wb.perform(linkVerbs.pin(`${a}/order`)));
    expect(act(() => wb.perform(linkVerbs.show(ORDER, { from: `${orders}/order` })))).toBeTruthy();
    expect(bindingsOf(wb.core.getState().document).get(`${b}/order`)?.kind).toBe("follow");
    expect(bindingsOf(wb.core.getState().document).get(`${a}/order`)?.kind).toBe("hold");
    expect(wb.shell.getState().showChooser).toBeNull();
  });

  it("two free details: the chooser opens; a row performs the show with its candidate id", async () => {
    const { wb, views } = scene(split("row", 0.5, tile("orders", { title: "Orders East" }), split("col", 0.5, tile("detail", { title: "A" }), tile("detail", { title: "B" }))));
    const [orders, , b] = views();
    wb.links.runtime.emit(`${orders}/order`, ORDER);
    expect(act(() => wb.perform(linkVerbs.show(ORDER, { from: `${orders}/order` })))).toBeTruthy();
    expect(wb.shell.getState().showChooser?.choices.filter((choice) => choice.available).length).toBeGreaterThanOrEqual(2);
    expect(bindingsOf(wb.core.getState().document).size).toBe(0);
    expect(await screen.findByText("SHOW #1042")).toBeTruthy();
    expect(screen.getByText("EXISTING TARGETS")).toBeTruthy();
    fireEvent.click(screen.getByText("B · order"));
    expect(bindingsOf(wb.core.getState().document).get(`${b}/order`)?.kind).toBe("follow");
    expect(wb.shell.getState().showChooser).toBeNull();
  });

  it("nothing on screen: a detail is spawned beside the source and linked in ONE batch", () => {
    const { wb, views, onCommit } = scene(tile("orders", { title: "Orders East" }));
    const [orders] = views();
    wb.links.runtime.emit(`${orders}/order`, ORDER);
    onCommit.mockClear();
    expect(act(() => wb.perform(linkVerbs.show(ORDER, { from: `${orders}/order`, role: "order.detail" })))).toBeTruthy();
    expect(onCommit).toHaveBeenCalledTimes(1);
    const detailViews = viewsOfApp(wb.core.getState().document, "detail");
    expect(detailViews).toHaveLength(1);
    expect(views()).toHaveLength(2);
    expect(bindingsOf(wb.core.getState().document).get(`${detailViews[0]!.id}/order`)).toMatchObject({ kind: "follow", source: `${orders}/order` });
    expect(badges()).toEqual(["following:→Orders East"]);
  });

  it("the role decides between the detail and the inspector when both could show an order", () => {
    const { wb, views } = scene(tile("orders", { title: "Orders East" }));
    const [orders] = views();
    wb.links.runtime.emit(`${orders}/order`, ORDER);
    // No role: the detail (exact type) beats the inspector (through <inspectable>) — one winner, spawned.
    expect(act(() => wb.perform(linkVerbs.show(ORDER, { from: `${orders}/order` })))).toBeTruthy();
    expect(viewsOfApp(wb.core.getState().document, "detail")).toHaveLength(1);
    expect(viewsOfApp(wb.core.getState().document, "inspector")).toHaveLength(0);
  });

  it("a stale candidate is refused, not replayed", () => {
    const { wb, views } = scene(split("row", 0.5, tile("orders", { title: "Orders East" }), tile("detail")));
    const [orders, detail] = views();
    wb.links.runtime.emit(`${orders}/order`, ORDER);
    act(() => void wb.perform(linkVerbs.follow(`${orders}/order`, `${detail}/order`)));
    act(() => void wb.perform(linkVerbs.pin(`${detail}/order`)));
    expect(performed(() => wb.perform(linkVerbs.show(ORDER, { from: `${orders}/order`, candidateId: `existing:${detail}/order` })))).toBe(false);
    expect(bindingsOf(wb.core.getState().document).get(`${detail}/order`)?.kind).toBe("hold");
  });
});
