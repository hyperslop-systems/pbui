import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createPresentationTypeGraph, linkVerbs, resetEscapeSurfaces } from "@hyperslop-systems/pbui";
import { bindingsOf, layout, split, tile } from "@hyperslop-systems/workbench-core";
import { leaves, workspaceTree } from "@hyperslop-systems/workbench-protocol/client";
import { defineWorkbenchApp } from "../app";
import { createWorkbench } from "../createWorkbenchShell";

/*
 * Derived through the workbench (Phase 6): the palette lists the legal
 * (source, relation) pairs for a destination, a row performs `port.derive`,
 * the badge reads `←` with the relation's label, and the value is the
 * relation applied to the source's emission.
 */

const graph = createPresentationTypeGraph([{ id: "order" }, { id: "customer" }]);
const ordersApp = defineWorkbenchApp({ manifest: { id: "orders", ports: [{ name: "order", direction: "out", contract: "order", doc: "the clicked order" }] }, presentation: { title: "orders", tone: "var(--pbui-cat-1)", Component: () => null } });
const customerApp = defineWorkbenchApp({ manifest: { id: "customer", ports: [{ name: "customer", direction: "in", contract: "customer", doc: "the customer shown" }] }, presentation: { title: "customer", tone: "var(--pbui-cat-2)", Component: () => null } });

function scene() {
  const wb = createWorkbench({
    apps: [ordersApp, customerApp],
    initial: layout(split("row", 0.5, tile("orders", { title: "Orders East" }), tile("customer"))),
    links: {
      graph,
      label: (r) => (r.type === "customer" ? String((r.value as { name: string }).name) : `#${(r.value as { id: string }).id}`),
      relations: [{ id: "order.customer", from: "order", to: "customer", label: "its customer" }],
      relationEvaluation: (id, reference) =>
        id === "order.customer"
          ? { kind: "value", reference: { type: "customer", value: { name: (reference.value as { customer: string }).customer } } }
          : { kind: "empty" },
    },
  });
  const [orders, customer] = leaves(workspaceTree(wb.core.getState().document, wb.core.getState().session.workspaceId)).map((leaf) => (leaf.body.case === "leaf" ? leaf.body.value.viewId : ""));
  render(<wb.Surface />);
  return { wb, orders: orders!, customer: customer! };
}

afterEach(() => {
  cleanup();
  resetEscapeSurfaces();
  document.body.innerHTML = "";
});

const badges = () => [...document.querySelectorAll('[data-part="port-badge"]')].map((el) => `${el.getAttribute("data-state")}:${el.textContent}`);

describe("derived bindings through the workbench", () => {
  it("the palette offers the legal relation; choosing it derives, and the badge names the relation", async () => {
    const { wb, orders, customer } = scene();
    wb.links.runtime.emit(`${orders}/order`, { type: "order", value: { id: "1042", customer: "Ada" } });
    act(() => void wb.perform(linkVerbs.openPalette(`${customer}/customer`)));
    expect(await screen.findByText("DERIVE customer · customer THROUGH…")).toBeTruthy();
    fireEvent.click(screen.getByText("its customer"));
    expect(bindingsOf(wb.core.getState().document).get(`${customer}/customer`)).toMatchObject({ kind: "derived", relationId: "order.customer", source: { kind: "follow", source: `${orders}/order` } });
    expect(wb.shell.getState().relationPalette).toBeNull();
    expect(badges()).toEqual(["derived:←customer ← its customer"]);
    expect(document.querySelector('[data-part="port-badge"]')?.getAttribute("title")).toBe("customer derives through order.customer from Orders East, now Ada");
    // A wire in connect mode carries the relation's label.
    act(() => void wb.perform(linkVerbs.openMode()));
    expect(document.querySelector('[data-part="wire"][data-term="derived"]')).not.toBeNull();
  });

  it("port.derive is refused when no relation fits, and follows the usual laws under pin/resume", () => {
    const { wb, orders, customer } = scene();
    expect(act(() => wb.perform(linkVerbs.derive(`${orders}/order`, `${customer}/customer`, "nope")))).toBeTruthy();
    expect(bindingsOf(wb.core.getState().document).size).toBe(0);
    act(() => void wb.perform(linkVerbs.derive(`${orders}/order`, `${customer}/customer`, "order.customer")));
    wb.links.runtime.emit(`${orders}/order`, { type: "order", value: { id: "1060", customer: "Sam" } });
    const before = wb.serialize();
    act(() => void wb.perform(linkVerbs.pin(`${customer}/customer`)));
    expect(badges()).toEqual(["held:⏸Sam"]);
    act(() => void wb.perform(linkVerbs.resume(`${customer}/customer`)));
    expect(wb.serialize()).toBe(before);
  });
});
