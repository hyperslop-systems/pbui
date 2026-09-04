import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Button, createPresentationTypeGraph, linkVerbs, resetEscapeSurfaces } from "@hyperslop-systems/pbui";
import { bindingsOf, layout, split, tile } from "@hyperslop-systems/workbench-core";
import { leaves, workspaceTree } from "@hyperslop-systems/workbench-protocol/client";
import { defineWorkbenchApp } from "../app";
import { createWorkbench } from "../createWorkbenchShell";

/*
 * Connect-management mode (design §6.8.3) through the DOM: the rails, the
 * wire, the port-to-port drag with the modifier read at release, Escape.
 * Pointer events are dispatched on the rail's port elements, which is how
 * the carry hit-tests in a browser too (the element under the pointer).
 */

const graph = createPresentationTypeGraph([{ id: "order" }]);
const ordersApp = defineWorkbenchApp({ manifest: { id: "orders", ports: [{ name: "order", direction: "out", contract: "order", doc: "the clicked order" }] }, presentation: { title: "orders", tone: "var(--pbui-cat-1)", Component: () => <Button data-testid="app-button">inside the app</Button> } });
const detailApp = defineWorkbenchApp({ manifest: { id: "detail", ports: [{ name: "order", direction: "in", contract: "order", doc: "the order shown", fallbackContext: "workspace.order" }] }, presentation: { title: "detail", tone: "var(--pbui-cat-2)", Component: () => null } });

function scene() {
  const wb = createWorkbench({
    apps: [ordersApp, detailApp],
    initial: layout(split("row", 0.5, tile("orders", { title: "Orders East" }), tile("detail"))),
    links: { graph, label: (r) => `#${(r.value as { id: string }).id}` },
  });
  const [orders, detail] = leaves(workspaceTree(wb.core.getState().document, wb.core.getState().session.workspaceId)).map((leaf) => (leaf.body.case === "leaf" ? leaf.body.value.viewId : ""));
  render(<wb.Surface />);
  return { wb, orders: orders!, detail: detail! };
}

const port = (id: string) => document.querySelector(`[data-part="port-rail-port"][data-port-id="${id}"]`) as HTMLElement;
const badges = () => [...document.querySelectorAll('[data-part="port-badge"]')].map((el) => `${el.getAttribute("data-state")}:${el.textContent}`);

afterEach(() => {
  cleanup();
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
    expect(wb.shell.getState().linkModeOpen).toBe(false);
    expect(document.querySelector('[data-part="port-rail"]')).toBeNull();
    // The chord toggles it.
    act(() => void fireEvent.keyDown(window, { key: "L", shiftKey: true, ctrlKey: true, metaKey: true }));
    expect(wb.shell.getState().linkModeOpen).toBe(true);
    act(() => void fireEvent.keyDown(window, { key: "L", shiftKey: true, ctrlKey: true, metaKey: true }));
    expect(wb.shell.getState().linkModeOpen).toBe(false);
  });

  it("clicks source and destination to declare a follow and show its wire", () => {
    const { wb, orders, detail } = scene();
    act(() => void wb.perform(linkVerbs.openMode()));
    fireEvent.click(port(`${orders}/order`));
    expect(port(`${detail}/order`).getAttribute("data-acceptable")).toBe("true");
    fireEvent.click(port(`${detail}/order`));
    expect(bindingsOf(wb.core.getState().document).get(`${detail}/order`)).toMatchObject({kind:"follow",source:`${orders}/order`});
    expect(document.querySelector('[data-part="wire"]')?.getAttribute("data-term")).toBe("follow");
    expect(badges()).toEqual(["following:→Orders East · none"]);
  });

  it("commits Hold atomically, and an empty source leaves no half-created follow", () => {
    const { wb, orders, detail } = scene();
    act(() => void wb.perform(linkVerbs.openMode()));
    fireEvent.change(screen.getByLabelText("Connection operation"),{target:{value:"hold"}});
    fireEvent.click(port(`${orders}/order`));
    fireEvent.click(port(`${detail}/order`));
    expect(bindingsOf(wb.core.getState().document).size).toBe(0);
    expect(port(`${orders}/order`).hasAttribute("data-carrying")).toBe(true);
    act(()=>wb.links.runtime.emit(`${orders}/order`,{type:"order",value:{id:"1042"}}));
    let publications=0;
    const unsubscribe=wb.core.subscribe(()=>publications++);
    fireEvent.click(port(`${detail}/order`));
    unsubscribe();
    expect(publications).toBe(1);
    expect(bindingsOf(wb.core.getState().document).get(`${detail}/order`)).toMatchObject({kind:"hold",reference:{value:{id:"1042"}},suspended:{kind:"follow"}});
  });

  it("Escape first cancels the choice and then closes wiring without a binding", () => {
    const { wb, orders } = scene();
    act(() => void wb.perform(linkVerbs.openMode()));
    fireEvent.click(port(`${orders}/order`));
    fireEvent.keyDown(window,{key:"Escape"});
    expect(wb.shell.getState().linkModeOpen).toBe(true);
    expect(bindingsOf(wb.core.getState().document).size).toBe(0);
    fireEvent.keyDown(window,{key:"Escape"});
    expect(wb.shell.getState().linkModeOpen).toBe(false);
  });
});
