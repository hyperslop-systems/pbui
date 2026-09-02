import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createPresentationTypeGraph, linkVerbs, resetEscapeSurfaces } from "@hyperslop-systems/pbui";
import { leaves, viewsOfApp, workspaceTree } from "@hyperslop-systems/workbench-protocol/client";
import { defineApp } from "../apps";
import { createWorkbench } from "../createWorkbench";
import { layout, split, tile, type LayoutSpec } from "../document";
import { bindingsOf } from "./document";

/*
 * "Show details…" end to end (design §8.6): one free target → performed;
 * a held target → left alone; two equal targets → the chooser, whose row
 * performs the same verb with a candidate id; nothing on screen → a tile is
 * spawned beside the source AND linked in one batch.
 */

const graph = createPresentationTypeGraph([{ id: "inspectable", abstract: true }, { id: "order", parents: ["inspectable"] }]);
const ORDER = { type: "order", value: { id: "1042" } };
const ordersApp = defineApp({ id: "orders", title: "orders", tone: "var(--pbui-cat-1)", singleton: false, ports: [{ name: "order", direction: "out", contract: { valueType: "order", semanticRole: "order.current" }, doc: "the clicked order" }], Component: () => null });
const detailApp = defineApp({ id: "detail", title: "detail", tone: "var(--pbui-cat-2)", singleton: false, ports: [{ name: "order", direction: "in", contract: { valueType: "order", semanticRole: "order.detail" }, doc: "the order shown", fallbackContext: "workspace.order" }], Component: () => null });
const inspectorApp = defineApp({ id: "inspector", title: "inspector", tone: "var(--pbui-cat-3)", singleton: false, ports: [{ name: "subject", direction: "in", contract: "inspectable", doc: "anything" }], Component: () => null });

function scene(spec: LayoutSpec) {
  const onMutate = vi.fn();
  const wb = createWorkbench({ apps: [ordersApp, detailApp, inspectorApp], initial: layout(spec), links: { graph, label: (r) => `#${(r.value as { id: string }).id}` }, onMutate });
  const views = () => leaves(workspaceTree(wb.store.getState().document, wb.store.getState().workspaceId)).map((leaf) => (leaf.body.case === "leaf" ? leaf.body.value.viewId : ""));
  render(<wb.Surface />);
  return { wb, views, onMutate };
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
    expect(bindingsOf(wb.store.getState().document).get(`${detail}/order`)).toMatchObject({ kind: "follow", source: `${orders}/order` });
    expect(badges()).toEqual(["following:→Orders East"]);
    // The subject's provenance is found through the runtime when `from` is not given.
    expect(act(() => wb.perform(linkVerbs.clear(`${detail}/order`)))).toBeTruthy();
    expect(act(() => wb.perform(linkVerbs.show(ORDER)))).toBeTruthy();
    expect(bindingsOf(wb.store.getState().document).get(`${detail}/order`)?.kind).toBe("follow");
  });

  it("two details, one held: the free one is chosen; the held one is left alone", () => {
    const { wb, views } = scene(split("row", 0.5, tile("orders", { title: "Orders East" }), split("col", 0.5, tile("detail", { title: "A" }), tile("detail", { title: "B" }))));
    const [orders, a, b] = views();
    wb.links.runtime.emit(`${orders}/order`, ORDER);
    act(() => void wb.perform(linkVerbs.follow(`${orders}/order`, `${a}/order`)));
    act(() => void wb.perform(linkVerbs.pin(`${a}/order`)));
    expect(act(() => wb.perform(linkVerbs.show(ORDER, { from: `${orders}/order` })))).toBeTruthy();
    expect(bindingsOf(wb.store.getState().document).get(`${b}/order`)?.kind).toBe("follow");
    expect(bindingsOf(wb.store.getState().document).get(`${a}/order`)?.kind).toBe("hold");
    expect(wb.store.getState().showChooser).toBeNull();
  });

  it("two free details: the chooser opens; a row performs the show with its candidate id", async () => {
    const { wb, views } = scene(split("row", 0.5, tile("orders", { title: "Orders East" }), split("col", 0.5, tile("detail", { title: "A" }), tile("detail", { title: "B" }))));
    const [orders, , b] = views();
    wb.links.runtime.emit(`${orders}/order`, ORDER);
    expect(act(() => wb.perform(linkVerbs.show(ORDER, { from: `${orders}/order` })))).toBeTruthy();
    expect(wb.store.getState().showChooser?.resolution.winners).toHaveLength(2);
    expect(bindingsOf(wb.store.getState().document).size).toBe(0);
    expect(await screen.findByText("SHOW #1042")).toBeTruthy();
    expect(screen.getByText("EXISTING TARGETS")).toBeTruthy();
    fireEvent.click(screen.getByText("B · order"));
    expect(bindingsOf(wb.store.getState().document).get(`${b}/order`)?.kind).toBe("follow");
    expect(wb.store.getState().showChooser).toBeNull();
  });

  it("nothing on screen: a detail is spawned beside the source and linked in ONE batch", () => {
    const { wb, views, onMutate } = scene(tile("orders", { title: "Orders East" }));
    const [orders] = views();
    wb.links.runtime.emit(`${orders}/order`, ORDER);
    onMutate.mockClear();
    expect(act(() => wb.perform(linkVerbs.show(ORDER, { from: `${orders}/order`, role: "order.detail" })))).toBeTruthy();
    expect(onMutate).toHaveBeenCalledTimes(1);
    const detailViews = viewsOfApp(wb.store.getState().document, "detail");
    expect(detailViews).toHaveLength(1);
    expect(views()).toHaveLength(2);
    expect(bindingsOf(wb.store.getState().document).get(`${detailViews[0]!.id}/order`)).toMatchObject({ kind: "follow", source: `${orders}/order` });
    expect(badges()).toEqual(["following:→Orders East"]);
  });

  it("the role decides between the detail and the inspector when both could show an order", () => {
    const { wb, views } = scene(tile("orders", { title: "Orders East" }));
    const [orders] = views();
    wb.links.runtime.emit(`${orders}/order`, ORDER);
    // No role: the detail (exact type) beats the inspector (through <inspectable>) — one winner, spawned.
    expect(act(() => wb.perform(linkVerbs.show(ORDER, { from: `${orders}/order` })))).toBeTruthy();
    expect(viewsOfApp(wb.store.getState().document, "detail")).toHaveLength(1);
    expect(viewsOfApp(wb.store.getState().document, "inspector")).toHaveLength(0);
  });

  it("a stale candidate is refused, not replayed", () => {
    const { wb, views } = scene(split("row", 0.5, tile("orders", { title: "Orders East" }), tile("detail")));
    const [orders, detail] = views();
    wb.links.runtime.emit(`${orders}/order`, ORDER);
    act(() => void wb.perform(linkVerbs.follow(`${orders}/order`, `${detail}/order`)));
    act(() => void wb.perform(linkVerbs.pin(`${detail}/order`)));
    expect(performed(() => wb.perform(linkVerbs.show(ORDER, { from: `${orders}/order`, candidateId: `existing:${detail}/order` })))).toBe(false);
    expect(bindingsOf(wb.store.getState().document).get(`${detail}/order`)?.kind).toBe("hold");
  });
});
