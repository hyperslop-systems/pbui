import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { create, toJson } from "@bufbuild/protobuf";
import { createPresentationTypeGraph, documentSlotPort, linkVerbs } from "@hyperslop-systems/pbui";
import { DocumentPayloadSchema, MutationSchema, type Mutation, type WorkbenchDocument } from "@hyperslop-systems/workbench-protocol";
import { applyMutations, leaves, workspaceTree } from "@hyperslop-systems/workbench-protocol/client";
import { defineApp } from "../apps";
import { createWorkbench, type CreateWorkbenchOptions } from "../createWorkbench";
import { layout, split, tile, workspaces } from "../document";
import { counterApp, notesApp } from "../stories/demoApps";
import type { Workbench } from "../types";

/*
 * PBUI-WORKBENCH-CORE-1 Phase 0: the command→transition goldens.
 *
 * Every case runs one current verb against a document whose ids are
 * deterministic (crypto.randomUUID is a counter) and freezes the EXACT
 * protocol batch it commits, the session it leaves behind, and what it
 * returned. The snapshot is the behavioural contract the core planner must
 * reproduce in Phase 3; a reviewed diff of this file is how a deliberate
 * semantic change is approved.
 *
 * Geometry: with no mounted Surface, `root()` is null, every split is
 * feasible, and the longer-axis policy falls back to "row". The one case
 * that freezes the rendered-axis rule mounts a fake root.
 */

const graph = createPresentationTypeGraph([{ id: "inspectable", abstract: true }, { id: "order", parents: ["inspectable"] }, { id: "datum" }]);

const skuApp = defineApp({
  id: "sku",
  title: "SKU",
  tone: "var(--pbui-cat-1)",
  singleton: false,
  duplicable: false,
  ports: [documentSlotPort("product", "the product this tile details")],
  Component: () => null,
});

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

const selectionPort = { name: "selection", direction: "inout" as const, contract: { valueType: "datum", semanticRole: "selection", cardinality: "many" as const, authorityDomain: "orders" }, doc: "the selection" };
const tableApp = defineApp({ id: "table", title: "table", tone: "t", singleton: false, ports: [selectionPort], Component: () => null });
const plotApp = defineApp({ id: "plot", title: "plot", tone: "t", singleton: false, ports: [selectionPort], Component: () => null });

const launcherApp = defineApp({ id: "launcher", title: "launcher", tone: "t", singleton: false, Component: () => null });

const ALL_APPS = [counterApp, notesApp, skuApp, ordersApp, detailApp, tableApp, plotApp, launcherApp];

let counter = 0;
beforeEach(() => {
  counter = 0;
  vi.spyOn(globalThis.crypto, "randomUUID").mockImplementation(() => `${String(++counter).padStart(8, "0")}-0000-4000-8000-000000000000` as `${string}-${string}-${string}-${string}-${string}`);
});
afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

interface Golden {
  batches: unknown[][];
  session: { workspaceId: string; activePlacementId: string | null };
  returned: unknown;
  views: string[];
  leaves: Record<string, string[]>;
}

/** Run one verb and freeze everything observable about the transition. */
function golden(wb: Workbench, batches: Mutation[][], run: () => unknown): Golden {
  const returned = run();
  const state = wb.store.getState();
  return {
    batches: batches.map((batch) => batch.map((mutation) => toJson(MutationSchema, mutation))),
    session: { workspaceId: state.workspaceId, activePlacementId: state.activePlacementId },
    returned,
    views: [...state.document.viewOrder],
    leaves: Object.fromEntries(state.document.workspaces.map((ws) => [ws.id, leaves(ws.tree).map((leaf) => `${leaf.id}=${leaf.body.case === "leaf" ? leaf.body.value.viewId : "?"}`)])),
  };
}

function bench(initial: WorkbenchDocument, options: Partial<CreateWorkbenchOptions> = {}) {
  const batches: Mutation[][] = [];
  const wb = createWorkbench({ apps: ALL_APPS, initial, onMutate: (m) => batches.push([...m]), ...options });
  const tree = () => workspaceTree(wb.store.getState().document, wb.store.getState().workspaceId);
  const ids = () => leaves(tree()).map((leaf) => leaf.id);
  const viewIds = () => leaves(tree()).map((leaf) => (leaf.body.case === "leaf" ? leaf.body.value.viewId : ""));
  return { wb, batches, tree, ids, viewIds, run: (fn: () => unknown) => golden(wb, batches, fn) };
}

const withDocuments = (doc: WorkbenchDocument, ...ids: string[]) =>
  applyMutations(
    doc,
    ids.map((id) => create(MutationSchema, { body: { case: "documentPut", value: { document: create(DocumentPayloadSchema, { id, format: "shop.product", schemaVersion: 1, body: {} }) } } })),
  );

/** counter | (notes / counter "second") */
const threeTiles = () => layout(split("row", 0.6, tile("counter"), split("col", 0.5, tile("notes"), tile("counter", { title: "second" }))));

function mountRoot(rects: Record<string, { width: number; height: number }>) {
  const root = document.createElement("div");
  for (const [id, size] of Object.entries(rects)) {
    const el = document.createElement("div");
    el.dataset.placementId = id;
    el.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: size.width, bottom: size.height, ...size, toJSON: () => ({}) }) as DOMRect;
    root.appendChild(el);
  }
  document.body.appendChild(root);
  return root;
}

describe("placement goldens", () => {
  it("split (bare, default policy) duplicates a clonable view after the target", () => {
    const b = bench(threeTiles());
    const [a] = b.ids();
    expect(b.run(() => b.wb.verbs.split(a!, "row"))).toMatchSnapshot();
  });

  it("split (bare) of a singleton links a second placement to the same view", () => {
    const b = bench(threeTiles());
    const [, notes] = b.ids();
    expect(b.run(() => b.wb.verbs.split(notes!, "col"))).toMatchSnapshot();
  });

  it("split with splitPolicy {app} opens an empty pane of that app; singleton launcher reused", () => {
    const b = bench(threeTiles(), { splitPolicy: { app: "launcher" } });
    const [a] = b.ids();
    expect(b.run(() => b.wb.verbs.split(a!, "row"))).toMatchSnapshot();
  });

  it("split with an appId mints a fresh view of that app", () => {
    const b = bench(threeTiles());
    const [a] = b.ids();
    expect(b.run(() => b.wb.verbs.split(a!, "col", "counter"))).toMatchSnapshot();
  });

  it("split with a placed singleton's appId links rather than minting", () => {
    const b = bench(threeTiles());
    const [a] = b.ids();
    expect(b.run(() => b.wb.verbs.split(a!, "row", "notes"))).toMatchSnapshot();
  });

  it("close removes the pane and its lone view, clearing activation", () => {
    const b = bench(threeTiles());
    const [, , c] = b.ids();
    b.wb.verbs.activate(c!);
    expect(b.run(() => b.wb.verbs.close(c!))).toMatchSnapshot();
  });

  it("close of a linked twin keeps the view", () => {
    const b = bench(threeTiles());
    const [, notes] = b.ids();
    b.wb.verbs.split(notes!, "row");
    b.batches.length = 0;
    const [, , twin] = b.ids();
    expect(b.run(() => b.wb.verbs.close(twin!))).toMatchSnapshot();
  });

  it("close of the last tile is refused", () => {
    const b = bench(layout(tile("counter")));
    const [a] = b.ids();
    expect(b.run(() => b.wb.verbs.close(a!))).toMatchSnapshot();
  });

  it("swap exchanges two placements' views", () => {
    const b = bench(threeTiles());
    const [a, , c] = b.ids();
    expect(b.run(() => b.wb.verbs.swap(a!, c!))).toMatchSnapshot();
  });

  it("dock splits the target BEFORE (left), closes the source, follows the view", () => {
    const b = bench(threeTiles());
    const [a, , c] = b.ids();
    expect(b.run(() => b.wb.verbs.dock(a!, c!, "left"))).toMatchSnapshot();
  });

  it("replaceWith: target shows the source's view, source closes, orphan deleted", () => {
    const b = bench(threeTiles());
    const [a, , c] = b.ids();
    b.wb.verbs.activate(a!);
    expect(b.run(() => b.wb.verbs.replaceWith(a!, c!))).toMatchSnapshot();
  });

  it("resize clamps to headless [0.1, 0.9] and snaps", () => {
    const b = bench(threeTiles());
    const root = b.tree()!;
    expect(b.run(() => b.wb.verbs.resize(root.id, 0.34))).toMatchSnapshot();
  });
});

describe("identity + placement goldens (the future view.show)", () => {
  it("place: a fresh app splits the active tile (headless axis row)", () => {
    const b = bench(threeTiles());
    const [, , c] = b.ids();
    b.wb.verbs.activate(c!);
    expect(b.run(() => b.wb.verbs.place("counter"))).toMatchSnapshot();
  });

  it("place splits along the longer RENDERED axis when geometry is available", () => {
    const b = bench(threeTiles());
    const [a] = b.ids();
    b.wb.setRoot(mountRoot({ [a!]: { width: 300, height: 900 } }));
    b.wb.verbs.activate(a!);
    expect(b.run(() => b.wb.verbs.place("counter"))).toMatchSnapshot();
  });

  it("place of a placed singleton goes to it", () => {
    const b = bench(threeTiles());
    expect(b.run(() => b.wb.verbs.place("notes"))).toMatchSnapshot();
  });

  it("place of a singleton placed in another workspace switches workspace", () => {
    const b = bench(workspaces([{ id: "one", name: "one", spec: tile("counter") }, { id: "two", name: "two", spec: tile("notes") }]));
    expect(b.run(() => b.wb.verbs.place("notes"))).toMatchSnapshot();
  });

  it("place of a singleton placed elsewhere with crossWorkspace link splits here with the same view", () => {
    const b = bench(workspaces([{ id: "one", name: "one", spec: tile("counter") }, { id: "two", name: "two", spec: tile("notes") }]));
    expect(b.run(() => b.wb.verbs.place("notes", { crossWorkspace: "link" }))).toMatchSnapshot();
  });

  it("placeAt edge zone docks before the target on the zone's axis", () => {
    const b = bench(threeTiles());
    const [, notes] = b.ids();
    expect(b.run(() => b.wb.verbs.placeAt("counter", notes!, "top"))).toMatchSnapshot();
  });

  it("placeAt center splits the target; replace swaps the app in place", () => {
    const b = bench(threeTiles());
    const [a, , c] = b.ids();
    const center = b.run(() => b.wb.verbs.placeAt("counter", a!, "center"));
    const replace = b.run(() => b.wb.verbs.placeAt("notes", c!, "replace"));
    expect({ center, replace }).toMatchSnapshot();
  });

  it("placeAt center on an empty (launcher) pane FILLS it", () => {
    const b = bench(layout(split("row", 0.5, tile("counter"), tile("launcher"))), { splitPolicy: { app: "launcher" } });
    const [, empty] = b.ids();
    expect(b.run(() => b.wb.verbs.placeAt("counter", empty!, "center"))).toMatchSnapshot();
  });

  it("openView with explicit bindings mints a bound view beside `near`", () => {
    const b = bench(withDocuments(threeTiles(), "p1", "p2"));
    const [a] = b.ids();
    expect(b.run(() => b.wb.verbs.openView("sku", { product: "p1" }, { near: a!, title: "Widget" }))).toMatchSnapshot();
  });

  it("openView with the same bindings goes to the existing doc-bound view", () => {
    const b = bench(withDocuments(threeTiles(), "p1"));
    const [a] = b.ids();
    b.wb.verbs.openView("sku", { product: "p1" }, { near: a! });
    b.batches.length = 0;
    expect(b.run(() => b.wb.verbs.openView("sku", { product: "p1" }))).toMatchSnapshot();
  });

  it("openView with the same bindings in ANOTHER workspace switches there", () => {
    const b = bench(withDocuments(workspaces([{ id: "one", name: "one", spec: tile("counter") }, { id: "two", name: "two", spec: tile("sku", { documents: { product: "p1" } }) }]), "p1"));
    expect(b.run(() => b.wb.verbs.openView("sku", { product: "p1" }))).toMatchSnapshot();
  });

  it("openView at replace on a document already open LINKS the existing view in", () => {
    const b = bench(withDocuments(threeTiles(), "p1"));
    const [a, , c] = b.ids();
    b.wb.verbs.openView("sku", { product: "p1" }, { near: a! });
    b.batches.length = 0;
    expect(b.run(() => b.wb.verbs.openView("sku", { product: "p1" }, { at: { placementId: c!, zone: "replace" } }))).toMatchSnapshot();
  });

  it("openView at an edge with a pre-minted viewId (the show spawn path)", () => {
    const b = bench(withDocuments(threeTiles(), "p1"));
    const [a] = b.ids();
    expect(b.run(() => b.wb.verbs.openView("sku", { product: "p1" }, { at: { placementId: a!, zone: "bottom" }, viewId: "v-preminted" }))).toMatchSnapshot();
  });

  it("openView with no bindings uses BindingConfig defaults (follow the crowd)", () => {
    const b = bench(withDocuments(threeTiles(), "p1", "p2"), { binding: { source: "product", unbound: ["counter", "notes"] } });
    const [a] = b.ids();
    b.wb.verbs.openView("sku", { product: "p2" }, { near: a! });
    b.batches.length = 0;
    expect(b.run(() => b.wb.verbs.openView("sku", {}, { near: a! }))).toMatchSnapshot();
  });

  it("replace retargets in place when the pane owns its view; clears bindings by default", () => {
    const b = bench(withDocuments(threeTiles(), "p1"));
    const [a] = b.ids();
    b.wb.verbs.openView("sku", { product: "p1" }, { near: a! });
    b.batches.length = 0;
    const [, sku] = b.ids();
    expect(b.run(() => b.wb.verbs.replace(sku!, "counter"))).toMatchSnapshot();
  });

  it("replace on a linked twin mints a view and moves only this placement", () => {
    const b = bench(threeTiles());
    const [, notes] = b.ids();
    b.wb.verbs.split(notes!, "row");
    b.batches.length = 0;
    const [, , twin] = b.ids();
    expect(b.run(() => b.wb.verbs.replace(twin!, "counter"))).toMatchSnapshot();
  });

  it("replace with a placed singleton links it; replace with the same app is a no-op", () => {
    const b = bench(threeTiles());
    const [a, , c] = b.ids();
    const links = b.run(() => b.wb.verbs.replace(a!, "notes"));
    const noop = b.run(() => b.wb.verbs.replace(c!, "counter"));
    expect({ links, noop }).toMatchSnapshot();
  });

  it("link points a pane at an existing view and deletes the orphan", () => {
    const b = bench(threeTiles());
    const [a] = b.ids();
    const [, notesView] = b.viewIds();
    expect(b.run(() => b.wb.verbs.link(a!, notesView!))).toMatchSnapshot();
  });

  it("goTo activates here, or switches workspace", () => {
    const b = bench(workspaces([{ id: "one", name: "one", spec: split("row", 0.5, tile("counter"), tile("notes")) }, { id: "two", name: "two", spec: tile("counter", { title: "far" }) }]));
    const [, notesView] = b.viewIds();
    const here = b.run(() => b.wb.verbs.goToView(notesView!));
    const far = b.wb.store.getState().document.viewOrder[2]!;
    const there = b.run(() => b.wb.verbs.goToView(far));
    expect({ here, there }).toMatchSnapshot();
  });
});

describe("view and workspace goldens", () => {
  it("setTitle sets and clears; rebind replaces the whole map", () => {
    const b = bench(withDocuments(threeTiles(), "p1"));
    const [, notesView] = b.viewIds();
    const set = b.run(() => b.wb.verbs.setTitle(notesView!, "  Notes  "));
    const clear = b.run(() => b.wb.verbs.setTitle(notesView!, ""));
    const rebind = b.run(() => b.wb.verbs.rebind(notesView!, { product: "p1" }));
    expect({ set, clear, rebind }).toMatchSnapshot();
  });

  it("workspace.create from a spec reuses singletons and selects it", () => {
    const b = bench(threeTiles());
    expect(b.run(() => b.wb.verbs.createWorkspace("second", split("row", 0.5, tile("notes"), tile("counter"))))).toMatchSnapshot();
  });

  it("workspace.create with no spec holds the first registered app", () => {
    const b = bench(threeTiles());
    expect(b.run(() => b.wb.verbs.createWorkspace("bare", undefined, { select: false }))).toMatchSnapshot();
  });

  it("workspace.rename trims; workspace.delete drops orphans and falls back", () => {
    const b = bench(workspaces([{ id: "one", name: "one", spec: split("row", 0.5, tile("counter"), tile("notes")) }, { id: "two", name: "two", spec: tile("counter") }]));
    const rename = b.run(() => b.wb.verbs.renameWorkspace("two", "  Two  "));
    const del = b.run(() => b.wb.verbs.deleteWorkspace("one"));
    expect({ rename, del }).toMatchSnapshot();
  });

  it("workspace.clone clones clonable views and references singletons and non-duplicables", () => {
    const b = bench(withDocuments(layout(split("row", 0.5, tile("counter"), split("col", 0.5, tile("notes"), tile("sku", { documents: { product: "p1" } })))), "p1"));
    expect(b.run(() => b.wb.verbs.cloneWorkspace("main"))).toMatchSnapshot();
  });

  it("workspace.setTree replaces the tree wholesale", () => {
    const b = bench(threeTiles());
    const tree = b.tree()!;
    const swapped = { ...tree, body: tree.body.case === "split" ? { case: "split" as const, value: { ...tree.body.value, a: tree.body.value.b, b: tree.body.value.a } } : tree.body };
    expect(b.run(() => b.wb.verbs.setWorkspaceTree("main", swapped as typeof tree))).toMatchSnapshot();
  });

  it("selectWorkspace clears the active placement", () => {
    const b = bench(workspaces([{ id: "one", name: "one", spec: tile("counter") }, { id: "two", name: "two", spec: tile("notes") }]));
    const [a] = b.ids();
    b.wb.verbs.activate(a!);
    expect(b.run(() => b.wb.verbs.selectWorkspace("two"))).toMatchSnapshot();
  });
});

describe("link goldens", () => {
  const twoLinked = () => bench(layout(split("row", 0.5, tile("orders", { title: "Orders East" }), tile("detail"))), { links: { graph, label: (r) => `#${(r.value as { id: string }).id}` } });

  it("port.follow writes one pbui.links documentPut", () => {
    const b = twoLinked();
    const [orders, detail] = b.viewIds();
    expect(b.run(() => b.wb.perform(linkVerbs.follow(`${orders}/order`, `${detail}/order`)))).toMatchSnapshot();
  });

  it("closing a followed source appends maintenance in the SAME batch", () => {
    const b = twoLinked();
    const [orders, detail] = b.viewIds();
    b.wb.perform(linkVerbs.follow(`${orders}/order`, `${detail}/order`));
    b.batches.length = 0;
    const [ordersPlacement] = b.ids();
    expect(b.run(() => b.wb.verbs.close(ordersPlacement!))).toMatchSnapshot();
  });

  it("replacing a follower's app drops its stale term in the same batch", () => {
    const b = twoLinked();
    const [orders, detail] = b.viewIds();
    b.wb.perform(linkVerbs.follow(`${orders}/order`, `${detail}/order`));
    b.batches.length = 0;
    const [, detailPlacement] = b.ids();
    expect(b.run(() => b.wb.verbs.replace(detailPlacement!, "counter"))).toMatchSnapshot();
  });

  it("cloning a workspace re-keys the terms onto the copies", () => {
    const b = twoLinked();
    const [orders, detail] = b.viewIds();
    b.wb.perform(linkVerbs.follow(`${orders}/order`, `${detail}/order`));
    b.batches.length = 0;
    expect(b.run(() => b.wb.verbs.cloneWorkspace("main"))).toMatchSnapshot();
  });

  it("identity.add persists the declaration and its class", () => {
    const b = bench(layout(split("row", 0.5, tile("table"), tile("plot"))), { links: { graph } });
    const [left, right] = b.viewIds();
    b.wb.links.runtime.emit(`${left}/selection`, { type: "datum", value: [{ relation: "orders", identity: { id: "A" } }] });
    const runtimeBefore = b.wb.links.runtime.getState().revision;
    const out = b.run(() => b.wb.perform(linkVerbs.identityAdd(`${left}/selection`, `${right}/selection`, "prefer-left")));
    expect({ ...out, runtimeRevisionDelta: b.wb.links.runtime.getState().revision - runtimeBefore, classes: [...b.wb.links.runtime.getState().classes.keys()] }).toMatchSnapshot();
  });

  it("show with nothing on screen spawns a detail beside the source and links it in ONE batch", () => {
    const b = bench(layout(tile("orders", { title: "Orders East" })), { links: { graph, label: (r) => `#${(r.value as { id: string }).id}` } });
    const [orders] = b.viewIds();
    b.wb.links.runtime.emit(`${orders}/order`, { type: "order", value: { id: "1042" } });
    expect(b.run(() => b.wb.perform({ kind: "show", subject: { type: "order", value: { id: "1042" } }, from: `${orders}/order` }))).toMatchSnapshot();
  });
});
