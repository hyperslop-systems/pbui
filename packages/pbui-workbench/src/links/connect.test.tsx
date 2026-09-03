import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Button, createPresentationTypeGraph, linkVerbs, resetEscapeSurfaces, resetPortCarry } from "@hyperslop-systems/pbui";
import { leaves, workspaceTree } from "@hyperslop-systems/workbench-protocol/client";
import { defineApp } from "../apps";
import { createWorkbench } from "../createWorkbench";
import { layout, split, tile } from "../document";
import { bindingsOf } from "./document";

/*
 * Connect-management mode (design §6.8.3) through the DOM: the rails, the
 * wire, the port-to-port drag with the modifier read at release, Escape.
 * Pointer events are dispatched on the rail's port elements, which is how
 * the carry hit-tests in a browser too (the element under the pointer).
 */

const graph = createPresentationTypeGraph([{ id: "order" }]);
const ordersApp = defineApp({ id: "orders", title: "orders", tone: "var(--pbui-cat-1)", singleton: false, ports: [{ name: "order", direction: "out", contract: "order", doc: "the clicked order" }], Component: () => <Button data-testid="app-button">inside the app</Button> });
const detailApp = defineApp({ id: "detail", title: "detail", tone: "var(--pbui-cat-2)", singleton: false, ports: [{ name: "order", direction: "in", contract: "order", doc: "the order shown", fallbackContext: "workspace.order" }], Component: () => null });

function scene() {
  const wb = createWorkbench({
    apps: [ordersApp, detailApp],
    initial: layout(split("row", 0.5, tile("orders", { title: "Orders East" }), tile("detail"))),
    links: { graph, label: (r) => `#${(r.value as { id: string }).id}` },
  });
  const [orders, detail] = leaves(workspaceTree(wb.store.getState().document, wb.store.getState().workspaceId)).map((leaf) => (leaf.body.case === "leaf" ? leaf.body.value.viewId : ""));
  render(<wb.Surface />);
  return { wb, orders: orders!, detail: detail! };
}

const port = (id: string) => document.querySelector(`[data-part="port-rail-port"][data-port-id="${id}"]`) as HTMLElement;
const badges = () => [...document.querySelectorAll('[data-part="port-badge"]')].map((el) => `${el.getAttribute("data-state")}:${el.textContent}`);

afterEach(() => {
  cleanup();
  resetPortCarry();
  resetEscapeSurfaces();
  document.body.innerHTML = "";
});

describe("connect mode", () => {
  it("opens with the verb or Mod+Shift+L, flips every tile to its rail, and makes the app inert", () => {
    const { wb, orders, detail } = scene();
    expect(document.querySelector('[data-part="port-rail"]')).toBeNull();
    act(() => void wb.perform(linkVerbs.openMode()));
    expect(document.querySelectorAll('[data-part="port-rail"]')).toHaveLength(2);
    expect(port(`${orders}/order`).getAttribute("data-side")).toBe("out");
    expect(port(`${detail}/order`).getAttribute("data-side")).toBe("in");
    expect(document.querySelector('[data-part="workbench-wires"]')).not.toBeNull();
    expect(screen.getByText("inside the app").closest("[inert]")).not.toBeNull();
    // Escape closes the mode through the escape-surface stack.
    act(() => void fireEvent.keyDown(window, { key: "Escape" }));
    expect(wb.store.getState().linkModeOpen).toBe(false);
    expect(document.querySelector('[data-part="port-rail"]')).toBeNull();
    // The chord toggles it.
    act(() => void fireEvent.keyDown(window, { key: "L", shiftKey: true, ctrlKey: true, metaKey: true }));
    expect(wb.store.getState().linkModeOpen).toBe(true);
    act(() => void fireEvent.keyDown(window, { key: "L", shiftKey: true, ctrlKey: true, metaKey: true }));
    expect(wb.store.getState().linkModeOpen).toBe(false);
  });

  it("drags an output onto an input: the follow is declared, the wire drawn, the badge reads →", () => {
    const { wb, orders, detail } = scene();
    act(() => void wb.perform(linkVerbs.openMode()));
    const from = port(`${orders}/order`);
    const to = port(`${detail}/order`);
    act(() => void fireEvent.pointerDown(from, { button: 0, clientX: 10, clientY: 10 }));
    act(() => void fireEvent.pointerMove(to, { clientX: 300, clientY: 10 }));
    expect(to.getAttribute("data-acceptable")).toBe("true");
    expect(document.querySelector('[data-part="wire-cursor"]')?.textContent).toContain("Follow(Orders East · order)");
    act(() => void fireEvent.pointerUp(to, { clientX: 300, clientY: 10 }));
    expect(bindingsOf(wb.store.getState().document).get(`${detail}/order`)).toMatchObject({ kind: "follow", source: `${orders}/order` });
    expect(document.querySelector('[data-part="wire"]')?.getAttribute("data-term")).toBe("follow");
    expect(badges()).toEqual(["following:→Orders East · none"]);
    expect(wb.store.getState().linkModeOpen).toBe(true);
  });

  it("Shift held at RELEASE pins the destination; Shift released mid-drag does not", () => {
    const { wb, orders, detail } = scene();
    wb.links.runtime.emit(`${orders}/order`, { type: "order", value: { id: "1042" } });
    act(() => void wb.perform(linkVerbs.openMode()));
    const from = port(`${orders}/order`);
    const to = port(`${detail}/order`);
    // jsdom's synthetic pointer events carry no modifiers; the keyboard path is what a browser also reports.
    act(() => void fireEvent.pointerDown(from, { button: 0 }));
    act(() => void fireEvent.keyDown(window, { key: "Shift" }));
    act(() => void fireEvent.pointerMove(to));
    expect(document.querySelector('[data-part="wire-cursor"]')?.textContent).toContain("Hold(");
    act(() => void fireEvent.keyUp(window, { key: "Shift" }));
    act(() => void fireEvent.pointerMove(to));
    expect(document.querySelector('[data-part="wire-cursor"]')?.textContent).toContain("Follow(");
    act(() => void fireEvent.pointerUp(to));
    expect(bindingsOf(wb.store.getState().document).get(`${detail}/order`)?.kind).toBe("follow");
    // Now again with Shift at release: the follow is pinned at once.
    act(() => void wb.perform(linkVerbs.clear(`${detail}/order`)));
    act(() => void fireEvent.pointerDown(port(`${orders}/order`), { button: 0 }));
    act(() => void fireEvent.pointerMove(port(`${detail}/order`)));
    act(() => void fireEvent.keyDown(window, { key: "Shift" }));
    act(() => void fireEvent.pointerUp(port(`${detail}/order`)));
    expect(bindingsOf(wb.store.getState().document).get(`${detail}/order`)).toMatchObject({ kind: "hold", reference: { value: { id: "1042" } }, suspended: { kind: "follow" } });
    expect(document.querySelector('[data-part="wire"]')?.getAttribute("data-term")).toBe("held");
  });

  it("a drop on the wrong port, on empty space, or an Escape mid-drag declares nothing", () => {
    const { wb, orders, detail } = scene();
    act(() => void wb.perform(linkVerbs.openMode()));
    // Input → input is not a carry at all.
    act(() => void fireEvent.pointerDown(port(`${detail}/order`), { button: 0 }));
    expect(document.querySelector('[data-part="wire-band"]')).toBeNull();
    // Output dropped on itself.
    act(() => void fireEvent.pointerDown(port(`${orders}/order`), { button: 0 }));
    act(() => void fireEvent.pointerUp(port(`${orders}/order`)));
    expect(bindingsOf(wb.store.getState().document).size).toBe(0);
    // Escape cancels the carry, and the mode stays open.
    act(() => void fireEvent.pointerDown(port(`${orders}/order`), { button: 0 }));
    act(() => void fireEvent.keyDown(window, { key: "Escape" }));
    expect(wb.store.getState().linkModeOpen).toBe(true);
    act(() => void fireEvent.pointerUp(port(`${detail}/order`)));
    expect(bindingsOf(wb.store.getState().document).size).toBe(0);
  });
});
