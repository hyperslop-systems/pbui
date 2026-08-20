import { afterEach, describe, expect, test, vi } from "vitest";
import { Direction, type Node } from "@hyperslop-systems/workbench-protocol";
import { leaves, SNAP_RATIOS } from "@hyperslop-systems/workbench-protocol/client";
import { createWorkbench } from "./createWorkbench";
import { layout, parseDocument, singleTile, split, tile } from "./document";
import { counterApp, demoApps, notesApp } from "./stories/demoApps";
import { performWorkbenchVerb, workbenchVerbs } from "./verbs";

function leafIds(tree: Node | undefined): string[] {
  return leaves(tree).map((leaf) => leaf.id);
}

function viewOf(tree: Node | undefined, placementId: string): string {
  const leaf = leaves(tree).find((node) => node.id === placementId);
  return leaf?.body.case === "leaf" ? leaf.body.value.viewId : "";
}

function threeTiles() {
  const wb = createWorkbench({
    apps: demoApps,
    initial: layout(split("row", 0.6, tile("counter"), split("col", 0.5, tile("notes"), tile("counter", { title: "second" })))),
  });
  const tree = () => wb.store.getState().document.workspaces[0]?.tree;
  const [a, b, c] = leafIds(tree());
  return { wb, tree, a: a!, b: b!, c: c! };
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("layout builders", () => {
  test("layout() builds a protocol document through the applier", () => {
    const doc = layout(split("row", 0.6, tile("counter"), tile("notes", { documents: { note: "n1" }, title: "my notes" })), { id: "wb-test" });
    expect(doc.format).toBe("pbui.workbench");
    expect(doc.id).toBe("wb-test");
    expect(doc.workspaces).toHaveLength(1);
    const root = doc.workspaces[0]!.tree!;
    expect(root.body.case).toBe("split");
    if (root.body.case !== "split") throw new Error("unreachable");
    expect(root.body.value.direction).toBe(Direction.ROW);
    expect(root.body.value.ratio).toBeCloseTo(0.6);
    expect(doc.viewOrder).toHaveLength(2);
    const notes = doc.views[doc.viewOrder[1]!]!;
    expect(notes.appId).toBe("notes");
    expect(notes.documents).toEqual({ note: "n1" });
    expect(notes.title).toBe("my notes");
  });

  test("singleTile() is a one-leaf workspace", () => {
    const doc = singleTile("counter");
    expect(leaves(doc.workspaces[0]!.tree)).toHaveLength(1);
  });
});

describe("verbs", () => {
  test("split opens a new pane after the target, holding a fresh view of the same app", () => {
    const { wb, tree, a } = threeTiles();
    const before = Object.keys(wb.store.getState().document.views).length;
    const created = wb.verbs.split(a, "col");
    expect(created).not.toBeNull();
    expect(leafIds(tree())).toHaveLength(4);
    expect(Object.keys(wb.store.getState().document.views)).toHaveLength(before + 1);
    const view = wb.store.getState().document.views[viewOf(tree(), created!)]!;
    expect(view.appId).toBe("counter");
    expect(wb.activePlacementId()).toBe(created);
  });

  test("split of a singleton links a second placement to the SAME view", () => {
    const { wb, tree, b } = threeTiles();
    const notesView = viewOf(tree(), b);
    const created = wb.verbs.split(b, "row");
    expect(viewOf(tree(), created!)).toBe(notesView);
    expect(wb.store.getState().document.viewOrder.filter((id) => wb.store.getState().document.views[id]!.appId === "notes")).toHaveLength(1);
  });

  test("split with an appId opens that app; a placed singleton is linked rather than minted twice", () => {
    const { wb, tree, a, b } = threeTiles();
    const created = wb.verbs.split(a, "row", "notes");
    expect(viewOf(tree(), created!)).toBe(viewOf(tree(), b));
  });

  test("close removes the pane and its lone view; the sibling absorbs the space", () => {
    const { wb, tree, b, c } = threeTiles();
    const viewId = viewOf(tree(), b);
    expect(wb.verbs.close(b)).toBe(true);
    expect(leafIds(tree())).toEqual(expect.arrayContaining([c]));
    expect(leafIds(tree())).toHaveLength(2);
    expect(wb.store.getState().document.views[viewId]).toBeUndefined();
  });

  test("the last tile cannot close", () => {
    const wb = createWorkbench({ apps: demoApps, initial: singleTile("counter") });
    const [only] = leafIds(wb.store.getState().document.workspaces[0]!.tree);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(wb.verbs.close(only!)).toBe(false);
    expect(leafIds(wb.store.getState().document.workspaces[0]!.tree)).toEqual([only]);
    // Refused before the applier ever saw it: no dropped-batch warning.
    expect(warn).not.toHaveBeenCalled();
  });

  test("swap exchanges what two panes show and nothing else", () => {
    const { wb, tree, a, b, c } = threeTiles();
    const [va, vb, vc] = [viewOf(tree(), a), viewOf(tree(), b), viewOf(tree(), c)];
    expect(wb.verbs.swap(a, b)).toBe(true);
    expect(viewOf(tree(), a)).toBe(vb);
    expect(viewOf(tree(), b)).toBe(va);
    expect(viewOf(tree(), c)).toBe(vc);
    expect(leafIds(tree())).toEqual([a, b, c]);
  });

  test("dock splits the target, closes the source, and keeps the view", () => {
    const { wb, tree, a, c } = threeTiles();
    const moved = viewOf(tree(), a);
    expect(wb.verbs.dock(a, c, "top")).toBe(true);
    const ids = leafIds(tree());
    expect(ids).not.toContain(a);
    expect(ids).toHaveLength(3);
    const landed = ids.find((id) => viewOf(tree(), id) === moved);
    expect(landed).toBeDefined();
    // `top` puts the source BEFORE the target in a column split. With the
    // source gone, the former right-hand subtree IS the root now.
    const root = tree()!;
    expect(root.body.case).toBe("split");
    if (root.body.case !== "split") throw new Error("unreachable");
    const lower = root.body.value.b!;
    expect(lower.body.case).toBe("split");
    if (lower.body.case !== "split") throw new Error("unreachable");
    expect(lower.body.value.direction).toBe(Direction.COLUMN);
    expect(lower.body.value.a!.id).toBe(landed);
    expect(lower.body.value.b!.id).toBe(c);
    expect(wb.activePlacementId()).toBe(landed);
  });

  test("resize clamps to [0.1, 0.9] and snaps to the shared ratios", () => {
    const { wb, tree } = threeTiles();
    const root = tree()!;
    expect(wb.verbs.resize(root.id, 0.51)).toBe(0.5);
    expect(wb.verbs.resize(root.id, 0.99)).toBe(0.9);
    expect(wb.verbs.resize(root.id, -3)).toBe(0.1);
    expect(wb.verbs.resize(root.id, 0.4, { snap: false })).toBe(0.4);
    expect(SNAP_RATIOS).toContain(wb.verbs.resize(root.id, 0.34));
    const committed = tree()!;
    expect(committed.body.case === "split" && committed.body.value.ratio).toBeCloseTo(1 / 3);
    expect(wb.verbs.resize("nope", 0.5)).toBeNull();
  });

  test("setTitle sets and clears a view's title", () => {
    const { wb, tree, a } = threeTiles();
    const viewId = viewOf(tree(), a);
    expect(wb.verbs.setTitle(viewId, "  Inbox ")).toBe(true);
    expect(wb.store.getState().document.views[viewId]!.title).toBe("Inbox");
    expect(wb.verbs.setTitle(viewId, "")).toBe(true);
    expect(wb.store.getState().document.views[viewId]!.title).toBeUndefined();
  });

  test("openView binds documents and goes to an existing doc-bound view with the same bindings", () => {
    const widgetApp = { ...counterApp, id: "widget", title: "widget", docBound: true };
    const wb = createWorkbench({ apps: [counterApp, notesApp, widgetApp], initial: singleTile("counter") });
    const tree = () => wb.store.getState().document.workspaces[0]?.tree;
    const first = wb.verbs.openView("widget", { widget: "w-1" }, { title: "Low stock" });
    expect(first).not.toBeNull();
    const view = wb.store.getState().document.views[viewOf(tree(), first!)]!;
    expect(view.documents).toEqual({ widget: "w-1" });
    expect(view.title).toBe("Low stock");
    const again = wb.verbs.openView("widget", { widget: "w-1" });
    expect(again).toBe(first);
    expect(leafIds(tree())).toHaveLength(2);
    const other = wb.verbs.openView("widget", { widget: "w-2" });
    expect(other).not.toBe(first);
    expect(leafIds(tree())).toHaveLength(3);
  });
});

describe("the launcher placement rule", () => {
  function mountPlacement(id: string, width: number, height: number) {
    const element = document.createElement("section");
    element.setAttribute("data-placement-id", id);
    element.getBoundingClientRect = () => ({ width, height, top: 0, left: 0, right: width, bottom: height, x: 0, y: 0, toJSON: () => ({}) });
    document.body.appendChild(element);
  }

  test("place splits the active tile along its longer RENDERED axis", () => {
    const wb = createWorkbench({ apps: demoApps, initial: singleTile("counter") });
    const tree = () => wb.store.getState().document.workspaces[0]?.tree;
    const [only] = leafIds(tree());
    mountPlacement(only!, 300, 800);
    wb.verbs.activate(only!);
    wb.verbs.place("counter");
    const root = tree()!;
    expect(root.body.case === "split" && root.body.value.direction).toBe(Direction.COLUMN);

    const wide = createWorkbench({ apps: demoApps, initial: singleTile("counter") });
    const [wideOnly] = leafIds(wide.store.getState().document.workspaces[0]?.tree);
    mountPlacement(wideOnly!, 900, 400);
    wide.verbs.place("counter", { from: wideOnly! });
    const wideRoot = wide.store.getState().document.workspaces[0]!.tree!;
    expect(wideRoot.body.case === "split" && wideRoot.body.value.direction).toBe(Direction.ROW);
  });

  test("a placed singleton is gone to, not opened twice", () => {
    const { wb, tree, a, b } = threeTiles();
    wb.verbs.activate(a);
    expect(wb.verbs.place("notes")).toBe(b);
    expect(leafIds(tree())).toHaveLength(3);
    expect(wb.activePlacementId()).toBe(b);
  });
});

describe("verbs as data", () => {
  test("performWorkbenchVerb routes every verb object to its handler", () => {
    const { wb, tree, a, b } = threeTiles();
    const [va, vb] = [viewOf(tree(), a), viewOf(tree(), b)];
    performWorkbenchVerb(wb.verbs, workbenchVerbs.swap(a, b));
    expect(viewOf(tree(), a)).toBe(vb);
    performWorkbenchVerb(wb.verbs, workbenchVerbs.setTitle(va, "renamed"));
    expect(wb.store.getState().document.views[va]!.title).toBe("renamed");
    performWorkbenchVerb(wb.verbs, workbenchVerbs.split(a, "row"));
    expect(leafIds(tree())).toHaveLength(4);
    performWorkbenchVerb(wb.verbs, workbenchVerbs.openLauncher());
    expect(wb.store.getState().launcherOpen).toBe(true);
    wb.perform(workbenchVerbs.closeLauncher());
    expect(wb.store.getState().launcherOpen).toBe(false);
    expect(workbenchVerbs.dock(a, b, "left")).toEqual({ kind: "tile.dock", source: a, target: b, zone: "left" });
  });
});

describe("persistence", () => {
  test("serialize() round-trips through restore() and parseDocument(), and reset() returns to the initial layout", () => {
    const { wb, tree, a } = threeTiles();
    wb.verbs.split(a, "row");
    const json = wb.serialize();
    expect(parseDocument(json)?.workspaces[0]?.tree).toEqual(tree());
    const fresh = createWorkbench({ apps: demoApps, initial: singleTile("counter") });
    expect(fresh.restore(json)).toBe(true);
    expect(leafIds(fresh.store.getState().document.workspaces[0]?.tree)).toHaveLength(4);
    expect(fresh.restore("{not json")).toBe(false);
    expect(fresh.restore(JSON.stringify({ format: "something.else" }))).toBe(false);
    fresh.reset();
    expect(leafIds(fresh.store.getState().document.workspaces[0]?.tree)).toHaveLength(1);
  });

  test("store.subscribe fires once per committed batch", () => {
    const { wb, a } = threeTiles();
    const seen = vi.fn();
    const stop = wb.store.subscribe(seen);
    wb.verbs.split(a, "row");
    expect(seen).toHaveBeenCalledTimes(2); // the mutation, then the activation
    stop();
    wb.verbs.split(a, "row");
    expect(seen).toHaveBeenCalledTimes(2);
  });
});
