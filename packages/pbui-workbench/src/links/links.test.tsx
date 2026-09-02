import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createPresentationTypeGraph, linkVerbs, terms, type Binding } from "@hyperslop-systems/pbui";
import { leaves, viewsOfApp, workspaceTree } from "@hyperslop-systems/workbench-protocol/client";
import { defineApp } from "../apps";
import { createWorkbench } from "../createWorkbench";
import { layout, split, tile } from "../document";
import { counterApp, notesApp } from "../stories/demoApps";
import { LINKS_DOC_ID, bindingsOf } from "./document";

/*
 * The workbench half of Phase 2 (design §12.3): perform a link verb, then
 * assert what the USER sees — the badge text in the tile header, the tile's
 * content — never only the payload. And the lifecycle: closing a source
 * applies the follower's policy in the same batch.
 */

const graph = createPresentationTypeGraph([{ id: "inspectable", abstract: true }, { id: "order", parents: ["inspectable"] }]);

const ordersApp = defineApp({
  id: "orders",
  title: "orders",
  tone: "var(--pbui-cat-1)",
  singleton: false,
  ports: [{ name: "order", direction: "out", contract: { valueType: "order", semanticRole: "order.current" }, doc: "the clicked order", drivesContext: "workspace.order" }],
  Component: () => null,
});

const detailApp = defineApp({
  id: "detail",
  title: "detail",
  tone: "var(--pbui-cat-2)",
  singleton: false,
  ports: [{ name: "order", direction: "in", contract: { valueType: "order", semanticRole: "order.detail" }, doc: "the order shown", fallbackContext: "workspace.order" }],
  Component: () => null,
});

const ORDER = { type: "order", value: { id: "1042" } };

function twoTiles() {
  const wb = createWorkbench({
    apps: [ordersApp, detailApp, counterApp, notesApp],
    initial: layout(split("row", 0.5, tile("orders", { title: "Orders East" }), tile("detail"))),
    links: { graph, label: (reference) => `#${(reference.value as { id: string }).id}` },
  });
  const tree = () => workspaceTree(wb.store.getState().document, wb.store.getState().workspaceId);
  const [a, b] = leaves(tree()).map((leaf) => (leaf.body.case === "leaf" ? leaf.body.value.viewId : ""));
  return { wb, tree, orders: a!, detail: b! };
}

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

/** Run a state change inside act and hand back its result (React's act returns a thenable, not the value). */
function performed<T>(run: () => T): T {
  let result!: T;
  act(() => {
    result = run();
  });
  return result;
}

const badgeTexts = () => [...document.querySelectorAll('[data-part="port-badge"]')].map((el) => `${el.getAttribute("data-state")}:${el.textContent}`);

describe("follow, pin, resume through the workbench", () => {
  it("port.follow writes the pbui.links payload and the badge reads → Orders East", () => {
    const { wb, orders, detail } = twoTiles();
    render(<wb.Surface />);
    // Ambient first: the detail reads the workspace context, which is empty.
    expect(badgeTexts()).toEqual(["empty:○order · none"]);
    expect(performed(() => wb.perform(linkVerbs.follow(`${orders}/order`, `${detail}/order`)))).toBe(true);
    const payload = wb.store.getState().document.documents[LINKS_DOC_ID];
    expect(payload?.format).toBe("pbui.links");
    expect(bindingsOf(wb.store.getState().document).get(`${detail}/order`)).toMatchObject({ kind: "follow", source: `${orders}/order` });
    expect(badgeTexts()).toEqual(["following:→Orders East · none"]);
    act(() => wb.links.runtime.emit(`${orders}/order`, ORDER, { drives: ["workspace.order"] }));
    expect(badgeTexts()).toEqual(["following:→Orders East"]);
    expect(document.querySelector('[data-part="port-badge"]')?.getAttribute("title")).toBe("order follows Orders East, now #1042");
  });

  it("an unlinked detail reads the context the table drives (scene 1, ambient)", () => {
    const { wb, orders } = twoTiles();
    render(<wb.Surface />);
    act(() => wb.links.runtime.emit(`${orders}/order`, ORDER, { drives: ["workspace.order"] }));
    expect(badgeTexts()).toEqual(["ambient:○order · order"]);
    expect(wb.store.getState().document.documents[LINKS_DOC_ID]).toBeUndefined();
  });

  it("pin holds the value, resume restores the term, and the document ends where it started", () => {
    const { wb, orders, detail } = twoTiles();
    render(<wb.Surface />);
    act(() => void wb.perform(linkVerbs.follow(`${orders}/order`, `${detail}/order`)));
    act(() => wb.links.runtime.emit(`${orders}/order`, ORDER));
    const before = wb.serialize();
    expect(performed(() => wb.perform(linkVerbs.pin(`${detail}/order`)))).toBe(true);
    expect(badgeTexts()).toEqual(["held:⏸#1042"]);
    act(() => wb.links.runtime.emit(`${orders}/order`, { type: "order", value: { id: "1060" } }));
    expect(badgeTexts()).toEqual(["held:⏸#1042"]);
    // A second follow is refused while held; the refusal is reported, not thrown.
    expect(performed(() => wb.perform(linkVerbs.follow(`${orders}/order`, `${detail}/order`)))).toBe(false);
    expect(performed(() => wb.perform(linkVerbs.resume(`${detail}/order`)))).toBe(true);
    expect(badgeTexts()).toEqual(["following:→Orders East"]);
    expect(wb.serialize()).toBe(before);
  });

  it("detach fixes the value; clear returns to the fallback and drops the payload", () => {
    const { wb, orders, detail } = twoTiles();
    render(<wb.Surface />);
    act(() => void wb.perform(linkVerbs.follow(`${orders}/order`, `${detail}/order`)));
    act(() => wb.links.runtime.emit(`${orders}/order`, ORDER));
    act(() => void wb.perform(linkVerbs.pin(`${detail}/order`)));
    expect(performed(() => wb.perform(linkVerbs.detach(`${detail}/order`)))).toBe(true);
    expect(badgeTexts()).toEqual(["fixed:•#1042"]);
    expect(performed(() => wb.perform(linkVerbs.clear(`${detail}/order`)))).toBe(true);
    expect(wb.store.getState().document.documents[LINKS_DOC_ID]).toBeUndefined();
  });

  it("the verbs are workbench verbs: validated, described, planned atomically with layout changes", () => {
    const { wb, orders, detail } = twoTiles();
    const verb = linkVerbs.follow(`${orders}/order`, `${detail}/order`);
    const bad = wb.plan([verb, { kind: "tile.close", placementId: "missing" }]);
    expect(bad.ok).toBe(false);
    expect(wb.store.getState().document.documents[LINKS_DOC_ID]).toBeUndefined();
    const good = wb.plan([{ kind: "tile.split", placementId: leaves(workspaceTree(wb.store.getState().document, wb.store.getState().workspaceId))[0]!.id, direction: "row" }, verb]);
    expect(good.ok).toBe(true);
    if (!good.ok) return;
    expect(wb.applyPlan(good.plan)).toBe(true);
    expect(bindingsOf(wb.store.getState().document).size).toBe(1);
    expect(viewsOfApp(wb.store.getState().document, "orders")).toHaveLength(2);
  });
});

describe("lifecycle in the same batch", () => {
  it("closing the source freezes the follower on its last value, with a resume that explains itself", () => {
    const { wb, orders, detail } = twoTiles();
    render(<wb.Surface />);
    act(() => void wb.perform(linkVerbs.follow(`${orders}/order`, `${detail}/order`)));
    act(() => wb.links.runtime.emit(`${orders}/order`, ORDER));
    const placement = leaves(workspaceTree(wb.store.getState().document, wb.store.getState().workspaceId))[0]!.id;
    expect(performed(() => wb.verbs.close(placement))).toBe(true);
    expect(badgeTexts()).toEqual(["held:⏸#1042"]);
    expect(document.querySelector('[data-part="port-badge"]')?.getAttribute("title")).toBe("order is held on #1042; cannot resume: the source tile was closed");
    expect(wb.links.runtime.getState().emitted.has(`${orders}/order`)).toBe(false);
  });

  it("replacing the follower's app drops its stale term", () => {
    const { wb, orders, detail } = twoTiles();
    act(() => void wb.perform(linkVerbs.follow(`${orders}/order`, `${detail}/order`)));
    const placement = leaves(workspaceTree(wb.store.getState().document, wb.store.getState().workspaceId))[1]!.id;
    expect(wb.verbs.replace(placement, "counter")).toBe(true);
    expect(wb.store.getState().document.documents[LINKS_DOC_ID]).toBeUndefined();
  });

  it("cloning a workspace re-keys the terms onto the copies", () => {
    const { wb, orders, detail } = twoTiles();
    act(() => void wb.perform(linkVerbs.follow(`${orders}/order`, `${detail}/order`)));
    const workspaceId = wb.store.getState().workspaceId;
    const copy = wb.verbs.cloneWorkspace(workspaceId);
    expect(copy).not.toBeNull();
    const bindings = bindingsOf(wb.store.getState().document);
    expect(bindings.size).toBe(2);
    const copied = [...bindings.entries()].find(([port]) => port !== `${detail}/order`);
    expect(copied?.[1]).toMatchObject({ kind: "follow" });
    expect((copied?.[1] as Extract<Binding, { kind: "follow" }>).source).not.toBe(`${orders}/order`);
  });

  it("restore() brings the payload back and a foreign term is dropped on read", () => {
    const { wb, orders, detail } = twoTiles();
    act(() => void wb.perform(linkVerbs.follow(`${orders}/order`, `${detail}/order`)));
    const json = wb.serialize();
    const again = twoTiles().wb;
    expect(again.restore(json)).toBe(true);
    expect(bindingsOf(again.store.getState().document).get(`${detail}/order`)).toMatchObject({ kind: "follow" });
    const doc = JSON.parse(json) as { documents: Record<string, { body: { bindings: Record<string, unknown> } }> };
    doc.documents[LINKS_DOC_ID]!.body.bindings["x/y"] = { kind: "nonsense" };
    doc.documents[LINKS_DOC_ID]!.body.bindings[`${detail}/order`] = terms.constant(ORDER);
    expect(again.restore(JSON.stringify(doc))).toBe(true);
    expect([...bindingsOf(again.store.getState().document).keys()]).toEqual([`${detail}/order`]);
  });
});

describe("hooks in the demo apps", () => {
  it("the notes tile shows what the counter emits once linked", () => {
    const wb = createWorkbench({ apps: [counterApp, notesApp], initial: layout(split("row", 0.5, tile("counter"), tile("notes"))) });
    const [counter, notes] = leaves(workspaceTree(wb.store.getState().document, wb.store.getState().workspaceId)).map((leaf) => (leaf.body.case === "leaf" ? leaf.body.value.viewId : ""));
    render(<wb.Surface />);
    expect(screen.getByText("nothing linked in yet")).toBeTruthy();
    expect(performed(() => wb.perform(linkVerbs.follow(`${counter}/count`, `${notes}/subject`)))).toBe(true);
    fireEvent.click(screen.getByText("count"));
    fireEvent.click(screen.getByText("count"));
    expect(screen.getByText(/subject: <number> 2/)).toBeTruthy();
    expect(badgeTexts()).toEqual(["following:→counter"]);
  });
});
