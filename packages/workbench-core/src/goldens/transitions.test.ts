import { describe, expect, it } from "vitest";
import { create, toJson } from "@bufbuild/protobuf";
import { createPresentationTypeGraph, documentSlotPort, linkVerbs } from "@hyperslop-systems/pbui";
import { DocumentPayloadSchema, MutationSchema, type Mutation, type WorkbenchDocument } from "@hyperslop-systems/workbench-protocol";
import { applyMutations, leaves, type IdGenerator } from "@hyperslop-systems/workbench-protocol/client";
import { defineAppManifest } from "../apps";
import { followTheCrowd } from "../binding";
import { commands, type WorkbenchCommand } from "../commands";
import { createWorkbenchCore, type CreateWorkbenchCoreOptions, type WorkbenchCore } from "../createWorkbenchCore";
import { layout, split, tile, workspaces } from "../document";
import type { GeometrySnapshot } from "../geometry";
import { createWorkbenchLinks } from "../links/collaborator";
import { leavesOfWorkspace } from "../queries";
import { sequentialIds } from "../testing";

/*
 * The Phase 0 goldens, replayed through the core (PBUI-WORKBENCH-CORE-1
 * Phase 3). Same scenarios, same names, same deterministic ids, same
 * observable shape — so `diff` against
 * packages/pbui-workbench/src/goldens/__snapshots__ is the review of the
 * cutover. Where a row differs on purpose, the diary says why.
 */

const graph = createPresentationTypeGraph([{ id: "inspectable", abstract: true }, { id: "order", parents: ["inspectable"] }, { id: "datum" }]);
const selectionPort = { name: "selection", direction: "inout" as const, contract: { valueType: "datum", semanticRole: "selection", cardinality: "many" as const, authorityDomain: "orders" }, doc: "the selection" };

const APPS = [
  defineAppManifest({ id: "counter", ports: [{ name: "count", direction: "out", contract: "number", doc: "the count" }] }),
  defineAppManifest({ id: "notes", viewCardinality: "one", ports: [{ name: "subject", direction: "in", contract: "any", doc: "anything" }] }),
  defineAppManifest({ id: "sku", duplicatePlacement: "link", ports: [documentSlotPort("product", "the product this tile details")] }),
  defineAppManifest({ id: "orders", ports: [{ name: "order", direction: "out", contract: { valueType: "order", semanticRole: "order.current" }, doc: "the clicked order", drivesContext: "workspace.order" }] }),
  defineAppManifest({ id: "detail", ports: [{ name: "order", direction: "in", contract: { valueType: "order", semanticRole: "order.detail" }, doc: "the order shown", fallbackContext: "workspace.order" }] }),
  defineAppManifest({ id: "table", ports: [selectionPort] }),
  defineAppManifest({ id: "plot", ports: [selectionPort] }),
  defineAppManifest({ id: "launcher" }),
];

interface Golden {
  batches: unknown[][];
  session: { workspaceId: string; activePlacementId: string | null };
  returned: unknown;
  views: string[];
  leaves: Record<string, string[]>;
}

function golden(core: WorkbenchCore, batches: Mutation[][], run: () => unknown): Golden {
  const returned = run();
  const state = core.getState();
  return {
    batches: batches.map((batch) => batch.map((mutation) => toJson(MutationSchema, mutation))),
    session: { ...state.session },
    returned,
    views: [...state.document.viewOrder],
    leaves: Object.fromEntries(state.document.workspaces.map((ws) => [ws.id, leaves(ws.tree).map((leaf) => `${leaf.id}=${leaf.body.case === "leaf" ? leaf.body.value.viewId : "?"}`)])),
  };
}

function bench(make: (ids: IdGenerator) => WorkbenchDocument, options: Partial<Pick<CreateWorkbenchCoreOptions, "policy" | "links">> = {}) {
  const ids = sequentialIds();
  const batches: Mutation[][] = [];
  const core = createWorkbenchCore({ initial: make(ids), apps: APPS, ids, onCommit: (receipt) => batches.push([...receipt.mutations]), ...options });
  const tree = () => core.getState().index.workspaceById.get(core.getState().session.workspaceId)?.tree;
  const idsOf = () => leavesOfWorkspace(core.getState().index, core.getState().session.workspaceId).map((leaf) => leaf.id);
  const viewIds = () => leavesOfWorkspace(core.getState().index, core.getState().session.workspaceId).map((leaf) => (leaf.body.case === "leaf" ? leaf.body.value.viewId : ""));
  const exec = (command: WorkbenchCommand | WorkbenchCommand[], geometry?: GeometrySnapshot) => core.execute(command, geometry ? { geometry } : {});
  return { core, batches, tree, ids: idsOf, viewIds, exec, run: (fn: () => unknown) => golden(core, batches, fn) };
}

const withDocuments = (doc: WorkbenchDocument, ...ids: string[]) =>
  applyMutations(
    doc,
    ids.map((id) => create(MutationSchema, { body: { case: "documentPut", value: { document: create(DocumentPayloadSchema, { id, format: "shop.product", schemaVersion: 1, body: {} }) } } })),
  );

/** counter | (notes / counter "second") */
const threeTiles = (ids: IdGenerator) => layout(split("row", 0.6, tile("counter"), split("col", 0.5, tile("notes"), tile("counter", { title: "second" }))), { ids });

const geometry = (rects: Record<string, { width: number; height: number }>): GeometrySnapshot => ({
  divider: { inline: 10, block: 10 },
  placements: new Map(Object.entries(rects).map(([id, size]) => [id, { x: 0, y: 0, ...size }])),
  splits: new Map(),
});

describe("placement goldens", () => {
  it("split (bare, default policy) duplicates a clonable view after the target", () => {
    const b = bench(threeTiles);
    const [a] = b.ids();
    expect(b.run(() => b.exec(commands.duplicate(a!, "row")))).toMatchSnapshot();
  });

  it("split (bare) of a singleton links a second placement to the same view", () => {
    const b = bench(threeTiles);
    const [, notes] = b.ids();
    expect(b.run(() => b.exec(commands.duplicate(notes!, "col")))).toMatchSnapshot();
  });

  it("split with splitPolicy {app} opens an empty pane of that app; singleton launcher reused", () => {
    const b = bench(threeTiles, { policy: { duplicate: { app: "launcher" } } });
    const [a] = b.ids();
    expect(b.run(() => b.exec(commands.duplicate(a!, "row")))).toMatchSnapshot();
  });

  it("split with an appId mints a fresh view of that app", () => {
    const b = bench(threeTiles);
    const [a] = b.ids();
    expect(b.run(() => b.exec(commands.split(a!, "col", "counter")))).toMatchSnapshot();
  });

  it("split with a placed singleton's appId links rather than minting", () => {
    const b = bench(threeTiles);
    const [a] = b.ids();
    expect(b.run(() => b.exec(commands.split(a!, "row", "notes")))).toMatchSnapshot();
  });

  it("close removes the pane and its lone view, clearing activation", () => {
    const b = bench(threeTiles);
    const [, , c] = b.ids();
    b.exec(commands.activate(c!));
    expect(b.run(() => b.exec(commands.close(c!)))).toMatchSnapshot();
  });

  it("close of a linked twin keeps the view", () => {
    const b = bench(threeTiles);
    const [, notes] = b.ids();
    b.exec(commands.duplicate(notes!, "row"));
    b.batches.length = 0;
    const [, , twin] = b.ids();
    expect(b.run(() => b.exec(commands.close(twin!)))).toMatchSnapshot();
  });

  it("close of the last tile is refused", () => {
    const b = bench((ids) => layout(tile("counter"), { ids }));
    const [a] = b.ids();
    expect(b.run(() => b.exec(commands.close(a!)))).toMatchSnapshot();
  });

  it("swap exchanges two placements' views", () => {
    const b = bench(threeTiles);
    const [a, , c] = b.ids();
    expect(b.run(() => b.exec(commands.swap(a!, c!)))).toMatchSnapshot();
  });

  it("dock splits the target BEFORE (left), closes the source, follows the view", () => {
    const b = bench(threeTiles);
    const [a, , c] = b.ids();
    expect(b.run(() => b.exec(commands.dock(a!, c!, "left")))).toMatchSnapshot();
  });

  it("replaceWith: target shows the source's view, source closes, orphan deleted", () => {
    const b = bench(threeTiles);
    const [a, , c] = b.ids();
    b.exec(commands.activate(a!));
    expect(b.run(() => b.exec(commands.replaceWith(a!, c!)))).toMatchSnapshot();
  });

  it("resize clamps to headless [0.1, 0.9] and snaps", () => {
    const b = bench(threeTiles);
    const root = b.tree()!;
    expect(b.run(() => b.exec(commands.resize(root.id, 0.34)))).toMatchSnapshot();
  });
});

describe("identity + placement goldens (the future view.show)", () => {
  it("place: a fresh app splits the active tile (headless axis row)", () => {
    const b = bench(threeTiles);
    const [, , c] = b.ids();
    b.exec(commands.activate(c!));
    expect(b.run(() => b.exec(commands.place("counter")))).toMatchSnapshot();
  });

  it("place splits along the longer RENDERED axis when geometry is available", () => {
    const b = bench(threeTiles);
    const [a] = b.ids();
    b.exec(commands.activate(a!));
    expect(b.run(() => b.exec(commands.place("counter"), geometry({ [a!]: { width: 300, height: 900 } })))).toMatchSnapshot();
  });

  it("place of a placed singleton goes to it", () => {
    const b = bench(threeTiles);
    expect(b.run(() => b.exec(commands.place("notes")))).toMatchSnapshot();
  });

  it("place of a singleton placed in another workspace switches workspace", () => {
    const b = bench((ids) => workspaces([{ id: "one", name: "one", spec: tile("counter") }, { id: "two", name: "two", spec: tile("notes") }], { ids }));
    expect(b.run(() => b.exec(commands.place("notes")))).toMatchSnapshot();
  });

  it("place of a singleton placed elsewhere with crossWorkspace link splits here with the same view", () => {
    const b = bench((ids) => workspaces([{ id: "one", name: "one", spec: tile("counter") }, { id: "two", name: "two", spec: tile("notes") }], { ids }));
    expect(b.run(() => b.exec({ kind: "view.show", view: { kind: "application", appId: "notes" }, placement: { kind: "split" } }))).toMatchSnapshot();
  });

  it("placeAt edge zone docks before the target on the zone's axis", () => {
    const b = bench(threeTiles);
    const [, notes] = b.ids();
    expect(b.run(() => b.exec(commands.placeAt("counter", notes!, "top")))).toMatchSnapshot();
  });

  it("placeAt center splits the target; replace swaps the app in place", () => {
    const b = bench(threeTiles);
    const [a, , c] = b.ids();
    const center = b.run(() => b.exec(commands.placeAt("counter", a!, "center")));
    const replace = b.run(() => b.exec(commands.placeAt("notes", c!, "replace")));
    expect({ center, replace }).toMatchSnapshot();
  });

  it("placeAt center on an empty (launcher) pane FILLS it", () => {
    const b = bench((ids) => layout(split("row", 0.5, tile("counter"), tile("launcher")), { ids }), { policy: { duplicate: { app: "launcher" } } });
    const [, empty] = b.ids();
    expect(b.run(() => b.exec(commands.placeAt("counter", empty!, "center")))).toMatchSnapshot();
  });

  it("openView with explicit bindings mints a bound view beside `near`", () => {
    const b = bench((ids) => withDocuments(threeTiles(ids), "p1", "p2"));
    const [a] = b.ids();
    expect(b.run(() => b.exec(commands.open("sku", { product: "p1" }, { near: a!, title: "Widget" })))).toMatchSnapshot();
  });

  it("openView with the same bindings goes to the existing doc-bound view", () => {
    const b = bench((ids) => withDocuments(threeTiles(ids), "p1"));
    const [a] = b.ids();
    b.exec(commands.open("sku", { product: "p1" }, { near: a! }));
    b.batches.length = 0;
    expect(b.run(() => b.exec(commands.open("sku", { product: "p1" })))).toMatchSnapshot();
  });

  it("openView with the same bindings in ANOTHER workspace switches there", () => {
    const b = bench((ids) => withDocuments(workspaces([{ id: "one", name: "one", spec: tile("counter") }, { id: "two", name: "two", spec: tile("sku", { documents: { product: "p1" } }) }], { ids }), "p1"));
    expect(b.run(() => b.exec(commands.open("sku", { product: "p1" })))).toMatchSnapshot();
  });

  it("openView at replace on a document already open LINKS the existing view in", () => {
    const b = bench((ids) => withDocuments(threeTiles(ids), "p1"));
    const [a, , c] = b.ids();
    b.exec(commands.open("sku", { product: "p1" }, { near: a! }));
    b.batches.length = 0;
    expect(b.run(() => b.exec(commands.open("sku", { product: "p1" }, { at: { placementId: c!, zone: "replace" } })))).toMatchSnapshot();
  });

  it("openView at an edge with a pre-minted viewId (the show spawn path)", () => {
    const b = bench((ids) => withDocuments(threeTiles(ids), "p1"));
    const [a] = b.ids();
    expect(b.run(() => b.exec(commands.open("sku", { product: "p1" }, { at: { placementId: a!, zone: "bottom" }, viewId: "v-preminted" })))).toMatchSnapshot();
  });

  it("openView with no bindings uses BindingConfig defaults (follow the crowd)", () => {
    const b = bench((ids) => withDocuments(threeTiles(ids), "p1", "p2"), { policy: { initialDocuments: followTheCrowd({ unbound: ["counter", "notes"] }) } });
    const [a] = b.ids();
    b.exec(commands.open("sku", { product: "p2" }, { near: a! }));
    b.batches.length = 0;
    expect(b.run(() => b.exec(commands.open("sku", {}, { near: a! })))).toMatchSnapshot();
  });

  it("replace retargets in place when the pane owns its view; clears bindings by default", () => {
    const b = bench((ids) => withDocuments(threeTiles(ids), "p1"));
    const [a] = b.ids();
    b.exec(commands.open("sku", { product: "p1" }, { near: a! }));
    b.batches.length = 0;
    const [, sku] = b.ids();
    expect(b.run(() => b.exec(commands.replace(sku!, "counter")))).toMatchSnapshot();
  });

  it("replace on a linked twin mints a view and moves only this placement", () => {
    const b = bench(threeTiles);
    const [, notes] = b.ids();
    b.exec(commands.duplicate(notes!, "row"));
    b.batches.length = 0;
    const [, , twin] = b.ids();
    expect(b.run(() => b.exec(commands.replace(twin!, "counter")))).toMatchSnapshot();
  });

  it("replace with a placed singleton links it; replace with the same app is a no-op", () => {
    const b = bench(threeTiles);
    const [a, , c] = b.ids();
    const links = b.run(() => b.exec(commands.replace(a!, "notes")));
    const noop = b.run(() => b.exec(commands.replace(c!, "counter")));
    expect({ links, noop }).toMatchSnapshot();
  });

  it("link points a pane at an existing view and deletes the orphan", () => {
    const b = bench(threeTiles);
    const [a] = b.ids();
    const [, notesView] = b.viewIds();
    expect(b.run(() => b.exec(commands.link(a!, notesView!)))).toMatchSnapshot();
  });

  it("goTo activates here, or switches workspace", () => {
    const b = bench((ids) => workspaces([{ id: "one", name: "one", spec: split("row", 0.5, tile("counter"), tile("notes")) }, { id: "two", name: "two", spec: tile("counter", { title: "far" }) }], { ids }));
    const [, notesView] = b.viewIds();
    const here = b.run(() => b.exec(commands.goTo(notesView!)));
    const far = b.core.getState().document.viewOrder[2]!;
    const there = b.run(() => b.exec(commands.goTo(far)));
    expect({ here, there }).toMatchSnapshot();
  });
});

describe("view and workspace goldens", () => {
  it("setTitle sets and clears; rebind replaces the whole map", () => {
    // Deliberate divergence from Phase 0: rebinding `notes` (which declares no
    // document slot) is now refused as `unknown_binding`; the sku view is rebound instead.
    const b = bench((ids) => withDocuments(layout(split("row", 0.6, tile("counter"), split("col", 0.5, tile("notes"), tile("sku", { documents: { product: "p1" } }))), { ids }), "p1", "p2"));
    const [, notesView, skuView] = b.viewIds();
    const set = b.run(() => b.exec(commands.setTitle(notesView!, "  Notes  ")));
    const clear = b.run(() => b.exec(commands.setTitle(notesView!, "")));
    const refused = b.run(() => b.exec(commands.rebind(notesView!, { product: "p1" })));
    const rebind = b.run(() => b.exec(commands.rebind(skuView!, { product: "p2" })));
    expect({ set, clear, refused, rebind }).toMatchSnapshot();
  });

  it("workspace.create from a spec reuses singletons and selects it", () => {
    const b = bench(threeTiles);
    expect(b.run(() => b.exec(commands.createWorkspace("second", split("row", 0.5, tile("notes"), tile("counter")))))).toMatchSnapshot();
  });

  it("workspace.create with no spec holds the first registered app", () => {
    const b = bench(threeTiles);
    expect(b.run(() => b.exec(commands.createWorkspace("bare", undefined, { select: false })))).toMatchSnapshot();
  });

  it("workspace.rename trims; workspace.delete drops orphans and falls back", () => {
    const b = bench((ids) => workspaces([{ id: "one", name: "one", spec: split("row", 0.5, tile("counter"), tile("notes")) }, { id: "two", name: "two", spec: tile("counter") }], { ids }));
    const rename = b.run(() => b.exec(commands.renameWorkspace("two", "  Two  ")));
    const del = b.run(() => b.exec(commands.deleteWorkspace("one")));
    expect({ rename, del }).toMatchSnapshot();
  });

  it("workspace.clone clones clonable views and references singletons and non-duplicables", () => {
    const b = bench((ids) => withDocuments(layout(split("row", 0.5, tile("counter"), split("col", 0.5, tile("notes"), tile("sku", { documents: { product: "p1" } }))), { ids }), "p1"));
    expect(b.run(() => b.exec(commands.cloneWorkspace("main")))).toMatchSnapshot();
  });

  it("workspace.setTree replaces the tree wholesale", () => {
    const b = bench(threeTiles);
    const tree = b.tree()!;
    const swapped = { ...tree, body: tree.body.case === "split" ? { case: "split" as const, value: { ...tree.body.value, a: tree.body.value.b, b: tree.body.value.a } } : tree.body };
    expect(b.run(() => b.exec(commands.rebalance("main", swapped as typeof tree)))).toMatchSnapshot();
  });

  it("workspace.rebalance refuses a tree that drops or retargets a tile", () => {
    const b = bench(threeTiles);
    const tree = b.tree()!;
    const dropped = tree.body.case === "split" ? tree.body.value.a! : tree;
    expect(b.run(() => b.exec(commands.rebalance("main", dropped)))).toMatchSnapshot();
  });

  it("selectWorkspace clears the active placement", () => {
    const b = bench((ids) => workspaces([{ id: "one", name: "one", spec: tile("counter") }, { id: "two", name: "two", spec: tile("notes") }], { ids }));
    const [a] = b.ids();
    b.exec(commands.activate(a!));
    expect(b.run(() => b.exec(commands.selectWorkspace("two")))).toMatchSnapshot();
  });
});

describe("link goldens", () => {
  const label = (r: { value: unknown }) => `#${(r.value as { id: string }).id}`;
  const twoLinked = () => bench((ids) => layout(split("row", 0.5, tile("orders", { title: "Orders East" }), tile("detail")), { ids }), { links: createWorkbenchLinks({ deps: { graph, label } }) });

  it("port.follow writes one pbui.links documentPut", () => {
    const b = twoLinked();
    const [orders, detail] = b.viewIds();
    expect(b.run(() => b.exec(linkVerbs.follow(`${orders}/order`, `${detail}/order`) as WorkbenchCommand))).toMatchSnapshot();
  });

  it("closing a followed source appends maintenance in the SAME batch", () => {
    const b = twoLinked();
    const [orders, detail] = b.viewIds();
    b.exec(linkVerbs.follow(`${orders}/order`, `${detail}/order`) as WorkbenchCommand);
    b.batches.length = 0;
    const [ordersPlacement] = b.ids();
    expect(b.run(() => b.exec(commands.close(ordersPlacement!)))).toMatchSnapshot();
  });

  it("replacing a follower's app drops its stale term in the same batch", () => {
    const b = twoLinked();
    const [orders, detail] = b.viewIds();
    b.exec(linkVerbs.follow(`${orders}/order`, `${detail}/order`) as WorkbenchCommand);
    b.batches.length = 0;
    const [, detailPlacement] = b.ids();
    expect(b.run(() => b.exec(commands.replace(detailPlacement!, "counter")))).toMatchSnapshot();
  });

  it("cloning a workspace re-keys the terms onto the copies", () => {
    const b = twoLinked();
    const [orders, detail] = b.viewIds();
    b.exec(linkVerbs.follow(`${orders}/order`, `${detail}/order`) as WorkbenchCommand);
    b.batches.length = 0;
    expect(b.run(() => b.exec(commands.cloneWorkspace("main")))).toMatchSnapshot();
  });

  it("identity.add persists the declaration and its class", () => {
    const b = bench((ids) => layout(split("row", 0.5, tile("table"), tile("plot")), { ids }), { links: createWorkbenchLinks({ deps: { graph } }) });
    const [left, right] = b.viewIds();
    const runtime = b.core.links!.runtime;
    runtime.emit(`${left}/selection`, { type: "datum", value: [{ relation: "orders", identity: { id: "A" } }] });
    const runtimeBefore = runtime.getState().revision;
    const out = b.run(() => b.exec(linkVerbs.identityAdd(`${left}/selection`, `${right}/selection`, "prefer-left") as WorkbenchCommand));
    expect({ ...out, runtimeRevisionDelta: runtime.getState().revision - runtimeBefore, classes: [...runtime.getState().classes.keys()] }).toMatchSnapshot();
  });

  it("show with nothing on screen spawns a detail beside the source and links it in ONE batch", () => {
    const b = bench((ids) => layout(tile("orders", { title: "Orders East" }), { ids }), { links: createWorkbenchLinks({ deps: { graph, label } }) });
    const [orders] = b.viewIds();
    b.core.links!.runtime.emit(`${orders}/order`, { type: "order", value: { id: "1042" } });
    expect(b.run(() => b.exec({ kind: "show", subject: { type: "order", value: { id: "1042" } }, from: `${orders}/order` }))).toMatchSnapshot();
  });
});
