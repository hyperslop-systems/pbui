import { create } from "@bufbuild/protobuf";
import {
  AppViewSchema,
  Direction,
  type AppView,
  type Node,
  type WorkbenchDocument,
} from "@hyperslop-systems/workbench-protocol";
import { leafNode, leaves, splitNode } from "@hyperslop-systems/workbench-protocol/client";
import { buildWorkbenchIndex } from "@hyperslop-systems/workbench-core";
import {
  BUNDLE_VERSION,
  FORMAT,
  clampRatio,
  type Bundle,
  type PortableDoc,
  type PortableNode,
  type PortableView,
  type StagePayload,
  type TilePayload,
  type WorkspacePayload,
} from "../model/portable";
import { findSecrets } from "../model/secrets";
import type { DocId } from "../pbui/types";
import type { PersistedNavigation, StageDefinition } from "./navigation";
import type { Doc, WorldState } from "./world";

/**
 * State ↔ bundle, in both directions, and nowhere else (design §12).
 *
 * Every function here is **pure**: it takes state and returns a value, or
 * takes a bundle plus the ids to mint and returns the protocol values to
 * insert. Nothing reads a clock or a random number generator except through
 * an argument.
 *
 * The state a bundle is built FROM is three things now, not two: the
 * world's documents, the workbench document (the core's, with its trees and
 * views), and Datalab's navigation metadata (which stage a workspace is in,
 * its allow-list). The portable format itself is unchanged: DR-64's index
 * references are still why two tiles on one document are still two tiles on
 * one document after a round trip.
 */

/* ------------------------------------------------------------- export -- */

/** The exporting side of DR-64: ids out, indices in. */
class DocCollector {
  readonly docs: PortableDoc[] = [];
  private readonly index = new Map<DocId, number>();

  constructor(private readonly world: Pick<WorldState, "docs">) {}

  /** The array index for a document id, adding it on first sight. */
  at(docId: DocId | null): number | undefined {
    if (!docId) return undefined;
    const seen = this.index.get(docId);
    if (seen !== undefined) return seen;
    const doc = this.world.docs[docId];
    if (!doc) return undefined;
    const next = this.docs.length;
    this.index.set(docId, next);
    this.docs.push(portableDoc(doc));
    return next;
  }
}

function portableDoc(doc: Doc): PortableDoc {
  const { id: _id, name, ...graphic } = structuredClone(doc);
  return { name, graphic };
}

class ViewCollector {
  readonly views: PortableView[] = [];
  private readonly index = new Map<string, number>();

  constructor(
    private readonly document: WorkbenchDocument,
    private readonly docs: DocCollector,
  ) {}

  at(viewId: string): number {
    const seen = this.index.get(viewId);
    if (seen !== undefined) return seen;
    const view = this.document.views[viewId];
    if (!view) throw new Error(`no view ${viewId}`);
    const next = this.views.length;
    this.index.set(viewId, next);
    this.views.push({
      app: view.appId,
      ...(view.title ? { title: view.title } : {}),
      documents: Object.fromEntries(
        Object.entries(view.documents).flatMap(([role, docId]) => {
          const index = this.docs.at(docId);
          return index === undefined ? [] : [[role, index]];
        }),
      ),
    });
    return next;
  }
}

function portableTree(node: Node | undefined, collector: ViewCollector): PortableNode {
  if (!node) throw new Error("a workspace has no tree");
  if (node.body.case === "leaf") {
    return { leaf: { view: collector.at(node.body.value.viewId) } };
  }
  if (node.body.case !== "split") throw new Error("a node has no body");
  const { direction, ratio, a, b } = node.body.value;
  return {
    split: {
      dir: direction === Direction.COLUMN ? "col" : "row",
      ratio: clampRatio(ratio),
      a: portableTree(a, collector),
      b: portableTree(b, collector),
    },
  };
}

function envelope<K extends Bundle["kind"]>(
  kind: K,
  name: string,
  payload: Bundle<K>["payload"],
  at: string,
): Bundle<K> {
  return { format: FORMAT, version: BUNDLE_VERSION, kind, exportedAt: at, name, payload };
}

/**
 * The export-side credential audit. Thrown rather than returned: a bundle
 * that trips this is a design mistake upstream, and the caller's job is to
 * tell the user the copy did not happen.
 */
function auditted<B extends Bundle>(bundle: B): B {
  const secrets = findSecrets(bundle);
  if (secrets.length > 0) {
    throw new Error(`refusing to export: credential-shaped keys — ${secrets.join(", ")}`);
  }
  return bundle;
}

export interface BundleState {
  world: Pick<WorldState, "docs">;
  document: WorkbenchDocument;
  navigation: PersistedNavigation;
}

const stageOf = (state: BundleState, workspaceId: string): string =>
  state.navigation.workspace[workspaceId]?.stageId ?? "";

export function bundleForTile(state: BundleState, placementId: string, at: string): Bundle<"tile"> {
  const index = buildWorkbenchIndex(state.document);
  const viewId = index.viewByPlacementId.get(placementId);
  if (!viewId) throw new Error(`no tile ${placementId} in this workbench`);
  const view = state.document.views[viewId];
  if (!view) throw new Error(`no view ${viewId}`);
  const docs = new DocCollector(state.world);
  const views = new ViewCollector(state.document, docs);
  const portable = views.at(view.id);
  const payload: TilePayload = {
    view: views.views[portable] as PortableView,
    docs: docs.docs,
  };
  return auditted(envelope("tile", view.title || view.appId, payload, at));
}

export function bundleForWorkspace(
  state: BundleState,
  workspaceId: string,
  at: string,
): Bundle<"workspace"> {
  const space = state.document.workspaces.find((candidate) => candidate.id === workspaceId);
  if (!space) throw new Error(`no workspace ${workspaceId}`);
  const meta = state.navigation.workspace[workspaceId];
  const docs = new DocCollector(state.world);
  const views = new ViewCollector(state.document, docs);
  const tree = portableTree(space.tree, views);
  const payload: WorkspacePayload = {
    name: space.name,
    tree,
    views: views.views,
    docs: docs.docs,
    ...(meta?.apps ? { apps: [...meta.apps] } : {}),
  };
  return auditted(envelope("workspace", space.name, payload, at));
}

export function bundleForStage(state: BundleState, stageId: string, at: string): Bundle<"stage"> {
  const stage = state.navigation.stages.find((candidate) => candidate.id === stageId);
  if (!stage) throw new Error(`no stage ${stageId}`);
  // ONE collector across every workspace in the stage, which is what hoists the
  // documents and preserves sharing between two workspaces that read the same
  // one — the same argument as DR-64, one level up.
  const docs = new DocCollector(state.world);
  const views = new ViewCollector(state.document, docs);
  const spaces: WorkspacePayload[] = state.document.workspaces
    .filter((space) => stageOf(state, space.id) === stageId)
    .map((space) => {
      const meta = state.navigation.workspace[space.id];
      return {
        name: space.name,
        tree: portableTree(space.tree, views),
        views: [],
        docs: [],
        ...(meta?.apps ? { apps: [...meta.apps] } : {}),
      };
    });
  const payload: StagePayload = {
    name: stage.name,
    apps: stage.apps ? [...stage.apps] : null,
    chrome: { ...stage.chrome },
    spaces,
    docs: docs.docs,
    views: views.views,
  };
  return auditted(envelope("stage", stage.name, payload, at));
}

/* ------------------------------------------------------------- import -- */

/**
 * Ids the caller minted, consumed in order. `idsNeeded` says how many to
 * mint, so the caller can produce exactly the right number before applying.
 */
export class IdPool {
  private next = 0;
  constructor(private readonly ids: readonly string[]) {}
  take(): string {
    const id = this.ids[this.next++];
    if (id === undefined) throw new Error("not enough ids were minted for this bundle");
    return id;
  }
}

/** How many fresh ids applying this bundle will consume. */
export function idsNeeded(bundle: Bundle): number {
  if (bundle.kind === "tile") {
    const payload = bundle.payload as TilePayload;
    // One view and its documents; the target placement keeps its own id.
    return 1 + payload.docs.length;
  }
  if (bundle.kind === "workspace") {
    const payload = bundle.payload as WorkspacePayload;
    return 1 + payload.docs.length + payload.views.length + nodesIn(payload.tree);
  }
  const payload = bundle.payload as StagePayload;
  return (
    1 +
    payload.docs.length +
    payload.views.length +
    payload.spaces.reduce((n, space) => n + 1 + nodesIn(space.tree), 0)
  );
}

function nodesIn(node: PortableNode): number {
  return "leaf" in node ? 1 : 1 + nodesIn(node.split.a) + nodesIn(node.split.b);
}

export interface MintedDocs {
  /** New documents, keyed by their new id, to merge into the world. */
  docs: Record<DocId, Doc>;
  /** Bundle document index → new document id. */
  byIndex: string[];
}

/** Mint one world document per bundle document, in order. */
export function hydrateDocs(docs: readonly PortableDoc[], pool: IdPool): MintedDocs {
  const out: MintedDocs = { docs: {}, byIndex: [] };
  for (const portable of docs) {
    const id = pool.take();
    out.docs[id] = {
      ...structuredClone(portable.graphic),
      id,
      name: portable.name,
    };
    out.byIndex.push(id);
  }
  return out;
}

/**
 * The importing side of DR-64: indices out, fresh ids in.
 *
 * A `doc` index that names nothing becomes an unbound view, which is the
 * tile's "follow the active document" state and is the honest reading of a
 * bundle that has been edited by hand.
 */
export interface MintedViews {
  views: AppView[];
  byIndex: string[];
}

export function hydrateViews(
  views: readonly PortableView[],
  docIds: readonly string[],
  pool: IdPool,
): MintedViews {
  const out: MintedViews = { views: [], byIndex: [] };
  for (const portable of views) {
    const id = pool.take();
    out.views.push(
      create(AppViewSchema, {
        id,
        appId: portable.app,
        documents: Object.fromEntries(
          Object.entries(portable.documents).flatMap(([role, index]) => {
            const docId = docIds[index];
            return docId ? [[role, docId]] : [];
          }),
        ),
        ...(portable.title ? { title: portable.title } : {}),
      }),
    );
    out.byIndex.push(id);
  }
  return out;
}

export function hydrateTree(node: PortableNode, byIndex: readonly string[], pool: IdPool): Node {
  const ids = () => pool.take();
  if ("leaf" in node) {
    const viewId = byIndex[node.leaf.view];
    if (!viewId) throw new Error(`portable leaf names missing view ${node.leaf.view}`);
    return leafNode(viewId, ids);
  }
  return splitNode(
    node.split.dir === "row" ? Direction.ROW : Direction.COLUMN,
    hydrateTree(node.split.a, byIndex, pool),
    hydrateTree(node.split.b, byIndex, pool),
    clampRatio(node.split.ratio),
    ids,
  );
}

export interface TileImport {
  /** The minted view the target placement will show. */
  viewId: string;
  docs: Record<DocId, Doc>;
  views: AppView[];
}

export function applyTileBundle(bundle: Bundle<"tile">, ids: readonly string[]): TileImport {
  const pool = new IdPool(ids);
  const payload = bundle.payload;
  const minted = hydrateDocs(payload.docs, pool);
  const view = hydrateViews([payload.view], minted.byIndex, pool);
  return { viewId: view.byIndex[0] as string, docs: minted.docs, views: view.views };
}

export interface ImportedWorkspace {
  id: string;
  name: string;
  tree: Node;
  apps: string[] | null;
}

export interface WorkspaceImport {
  workspace: ImportedWorkspace;
  stageId: string;
  docs: Record<DocId, Doc>;
  views: AppView[];
}

export function applyWorkspaceBundle(
  bundle: Bundle<"workspace">,
  stageId: string,
  ids: readonly string[],
): WorkspaceImport {
  const pool = new IdPool(ids);
  const payload = bundle.payload;
  const minted = hydrateDocs(payload.docs, pool);
  const views = hydrateViews(payload.views, minted.byIndex, pool);
  return {
    workspace: {
      id: pool.take(),
      name: payload.name,
      tree: hydrateTree(payload.tree, views.byIndex, pool),
      apps: payload.apps ? [...payload.apps] : null,
    },
    stageId,
    docs: minted.docs,
    views: views.views,
  };
}

export interface StageImport {
  stage: StageDefinition;
  workspaces: ImportedWorkspace[];
  docs: Record<DocId, Doc>;
  views: AppView[];
}

export function applyStageBundle(bundle: Bundle<"stage">, ids: readonly string[]): StageImport {
  const pool = new IdPool(ids);
  const payload = bundle.payload;
  const minted = hydrateDocs(payload.docs, pool);
  const views = hydrateViews(payload.views, minted.byIndex, pool);
  const stageId = pool.take();
  const workspaces: ImportedWorkspace[] = payload.spaces.map((space) => ({
    id: pool.take(),
    name: space.name,
    tree: hydrateTree(space.tree, views.byIndex, pool),
    apps: space.apps ? [...space.apps] : null,
  }));
  return {
    stage: {
      id: stageId,
      name: payload.name,
      apps: payload.apps ? [...payload.apps] : null,
      // `chrome` is assigned from `PortableChrome` to `StageChrome` here, the
      // one place the two structurally-identical types meet.
      chrome: { ...payload.chrome },
      // An imported stage is the user's, never code-defined, however it was
      // made: a bundle claiming `pinned` would create a stage that cannot be
      // deleted and that no release will ever re-create.
    },
    workspaces,
    docs: minted.docs,
    views: views.views,
  };
}

/** Every view id a tree places, for the reachability questions import makes. */
export function placedViewIds(tree: Node | undefined): string[] {
  return leaves(tree).map((leaf) => (leaf.body.case === "leaf" ? leaf.body.value.viewId : ""));
}
