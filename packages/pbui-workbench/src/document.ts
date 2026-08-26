import { create, fromJson, toJson } from "@bufbuild/protobuf";
import {
  AppViewSchema,
  Direction,
  MutationSchema,
  type Mutation,
  type Node,
  type WorkbenchDocument,
  WorkbenchDocumentSchema,
} from "@hyperslop-systems/workbench-protocol";
import { applyMutations, leafNode, newId, splitNode } from "@hyperslop-systems/workbench-protocol/client";

/**
 * Declarative layouts, built THROUGH the protocol.
 *
 * `layout()` turns a small spec into a `WorkbenchDocument` by issuing the
 * same mutations a user would — `viewCreate` per tile, `workspaceCreate`
 * with a tree assembled from the protocol's own `leafNode`/`splitNode` —
 * and applying them with the shared applier. There is no second model and
 * no hand-built document: whatever the applier accepts here is exactly what
 * a server running pkg/workbench would accept.
 */
export type LayoutSpec =
  | { kind: "tile"; appId: string; documents?: Record<string, string>; title?: string }
  | { kind: "split"; direction: "row" | "col"; ratio: number; a: LayoutSpec; b: LayoutSpec };

export function tile(appId: string, options: { documents?: Record<string, string>; title?: string } = {}): LayoutSpec {
  return { kind: "tile", appId, ...options };
}

/** `direction: "row"` puts `a` and `b` side by side; `"col"` stacks them. */
export function split(direction: "row" | "col", ratio: number, a: LayoutSpec, b: LayoutSpec): LayoutSpec {
  return { kind: "split", direction, ratio, a, b };
}

export interface LayoutOptions {
  /** Document id; a stable one lets persistence tell two products apart. */
  id?: string;
  name?: string;
  workspaceId?: string;
  workspaceName?: string;
}

export const WORKBENCH_FORMAT = "pbui.workbench";
export const WORKBENCH_SCHEMA_VERSION = 1;

export function emptyDocument(options: LayoutOptions = {}): WorkbenchDocument {
  return create(WorkbenchDocumentSchema, {
    format: WORKBENCH_FORMAT,
    schemaVersion: WORKBENCH_SCHEMA_VERSION,
    id: options.id ?? newId("wb"),
    name: options.name ?? "workbench",
  });
}

/** What `buildLayout` produces: the views to create, and the tree that places them. */
export interface BuiltLayout {
  /** `viewCreate` per newly minted tile, in reading order. */
  mutations: Mutation[];
  /** The placement tree, ready for a `workspaceCreate`. */
  tree: Node;
  views: { viewId: string; appId: string; title?: string }[];
}

export interface BuildLayoutOptions {
  /** Applications whose logical view must be shared rather than minted twice. */
  singletonAppIds?: ReadonlySet<string>;
  /** Existing singleton view to place when the application is already present. */
  existingViewsByAppId?: ReadonlyMap<string, string>;
}

/**
 * Turn a spec into `viewCreate` mutations and a placement tree WITHOUT a
 * workspace, so the same builder serves `layout()` (one workspace over an
 * empty document), `workspaces()` (several), and the `workspace.create` verb
 * (one more inside a document that already exists).
 *
 * The optional singleton knowledge belongs to the caller because a bare
 * `LayoutSpec` has no application registry. When supplied, an existing
 * singleton is referenced and repeated singleton leaves in one spec share
 * the first view created for that application.
 */
export function buildLayout(spec: LayoutSpec, options: BuildLayoutOptions = {}): BuiltLayout {
  const mutations: Mutation[] = [];
  const views: BuiltLayout["views"] = [];
  const singletonViews = new Map(options.existingViewsByAppId);
  const build = (node: LayoutSpec): Node => {
    if (node.kind === "tile") {
      if (options.singletonAppIds?.has(node.appId)) {
        const existing = singletonViews.get(node.appId);
        if (existing) {
          views.push({ viewId: existing, appId: node.appId, ...(node.title ? { title: node.title } : {}) });
          return leafNode(existing);
        }
      }
      const view = create(AppViewSchema, {
        id: newId("v"),
        appId: node.appId,
        documents: node.documents ?? {},
        ...(node.title ? { title: node.title } : {}),
      });
      mutations.push(create(MutationSchema, { body: { case: "viewCreate", value: { view } } }));
      views.push({ viewId: view.id, appId: node.appId, ...(node.title ? { title: node.title } : {}) });
      if (options.singletonAppIds?.has(node.appId)) singletonViews.set(node.appId, view.id);
      return leafNode(view.id);
    }
    // Both children are built BEFORE the split so viewCreate mutations land
    // in reading order, which makes a serialised document pleasant to diff.
    const a = build(node.a);
    const b = build(node.b);
    return splitNode(node.direction === "row" ? Direction.ROW : Direction.COLUMN, a, b, node.ratio);
  };
  const tree = build(spec);
  return { mutations, tree, views };
}

export function workspaceCreateMutation(workspaceId: string, name: string, tree: Node): Mutation {
  return create(MutationSchema, {
    body: { case: "workspaceCreate", value: { workspaceId, name, rootPlacement: tree } },
  });
}

export function layout(spec: LayoutSpec, options: LayoutOptions = {}): WorkbenchDocument {
  const built = buildLayout(spec);
  return applyMutations(emptyDocument(options), [
    ...built.mutations,
    workspaceCreateMutation(options.workspaceId ?? "main", options.workspaceName ?? "main", built.tree),
  ]);
}

/** One workspace in a multi-workspace seed. */
export interface WorkspaceSpec {
  id?: string;
  name: string;
  spec: LayoutSpec;
}

/**
 * A document with several workspaces, in order; the first one is what a fresh
 * store renders. Ids default to `newId("ws")` rather than to the name, so two
 * workspaces a user calls the same thing do not collide as `duplicate_id`.
 */
export function workspaces(list: readonly WorkspaceSpec[], options: LayoutOptions = {}): WorkbenchDocument {
  if (list.length === 0) throw new Error("pbui-workbench: workspaces() needs at least one workspace");
  const mutations: Mutation[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    const built = buildLayout(item.spec);
    const id = item.id ?? newId("ws");
    if (seen.has(id)) throw new Error(`pbui-workbench: workspace id "${id}" is used twice`);
    seen.add(id);
    mutations.push(...built.mutations, workspaceCreateMutation(id, item.name, built.tree));
  }
  return applyMutations(emptyDocument(options), mutations);
}

/** The one-tile workbench: the shortest way to a working shell. */
export function singleTile(appId: string, options: LayoutOptions & { documents?: Record<string, string> } = {}): WorkbenchDocument {
  const { documents, ...rest } = options;
  return layout(tile(appId, documents ? { documents } : {}), rest);
}

/** The document as JSON text — protobuf JSON, the same shape the Go server speaks. */
export function serializeDocument(doc: WorkbenchDocument): string {
  return JSON.stringify(toJson(WorkbenchDocumentSchema, doc));
}

/**
 * The reverse. Returns null rather than throwing for anything that does not
 * parse into a usable document — persistence reads this on every load, and
 * a corrupted localStorage entry must fall back to the default layout, not
 * take the product down.
 */
export function parseDocument(json: string | null | undefined): WorkbenchDocument | null {
  if (!json) return null;
  try {
    const doc = fromJson(WorkbenchDocumentSchema, JSON.parse(json));
    if (doc.format !== WORKBENCH_FORMAT || doc.schemaVersion !== WORKBENCH_SCHEMA_VERSION) return null;
    if (doc.workspaces.length === 0) return null;
    for (const workspace of doc.workspaces) {
      if (!workspace.tree || !hasUsableTree(workspace.tree, doc)) return null;
    }
    return doc;
  } catch {
    return null;
  }
}

function hasUsableTree(node: Node, doc: WorkbenchDocument): boolean {
  if (!node.id) return false;
  if (node.body.case === "leaf") {
    return Boolean(node.body.value.viewId && doc.views[node.body.value.viewId]);
  }
  if (node.body.case === "split") {
    const { a, b } = node.body.value;
    return Boolean(a && b && hasUsableTree(a, doc) && hasUsableTree(b, doc));
  }
  return false;
}

/**
 * The appId `specOf` gives a leaf it cannot resolve.
 *
 * Empty rather than a plausible-looking placeholder: the spec is meant to be
 * handed back to `layout()`/`workspace.create`, and every caller that
 * validates appIds against the registry rejects `""` loudly. A placeholder
 * like "unknown" would instead have to be registered, or would silently
 * re-create a broken tile as a real one.
 */
export const MISSING_APP_ID = "";

/**
 * The inverse of `buildLayout`: one workspace's tree back into the dialect
 * that built it, so a description round-trips into a `create`.
 *
 * "Make the right column 30 % instead of 40 %" is then a `specOf`, one field
 * changed, and a `layout()` — no second vocabulary for reading a layout and
 * writing one. Node ids and view ids are deliberately dropped: they are
 * minted per document, and a spec carrying them would re-create tiles that
 * collide with the ones it was read from.
 *
 * Nothing here throws. A leaf whose view has vanished from `doc.views`
 * (a hand-edited document, a `viewDelete` that outran its `close`) yields
 * `{ kind: "tile", appId: MISSING_APP_ID, title: "missing view <id>" }` —
 * the same words `Tile` renders for it — and a split with a missing child
 * yields that tile in the child's place, because a description that throws
 * halfway leaves the agent with nothing to reason about, and a document too
 * broken to describe is exactly the one it most needs described.
 */
export function specOf(doc: WorkbenchDocument, node: Node): LayoutSpec {
  if (node.body.case === "split") {
    const { direction, ratio, a, b } = node.body.value;
    return {
      kind: "split",
      // COLUMN is the only stacking direction; UNSPECIFIED reads as "row",
      // which is what the Surface draws for it.
      direction: direction === Direction.COLUMN ? "col" : "row",
      // Verbatim, unclamped: `describe` reports what the document says, and
      // a ratio outside [0.1, 0.9] is a finding for the caller's validator,
      // not something to launder into a lie about the layout on screen.
      ratio,
      a: a ? specOf(doc, a) : missingTile("missing pane"),
      b: b ? specOf(doc, b) : missingTile("missing pane"),
    };
  }
  const viewId = node.body.case === "leaf" ? node.body.value.viewId : "";
  const view = doc.views[viewId];
  if (!view) return missingTile(`missing view ${viewId}`);
  return {
    kind: "tile",
    appId: view.appId,
    // Both omitted when empty, so `specOf(layout(spec))` is deep-equal to
    // `spec` rather than to `spec` plus two empty fields.
    ...(Object.keys(view.documents).length > 0 ? { documents: { ...view.documents } } : {}),
    ...(view.title ? { title: view.title } : {}),
  };
}

function missingTile(label: string): LayoutSpec {
  return { kind: "tile", appId: MISSING_APP_ID, title: label };
}
