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
import { applyMutations, leafNode, newId, splitNode, type IdGenerator } from "@hyperslop-systems/workbench-protocol/client";
import type { ManifestCatalog } from "./apps";
import { diagnostic, type WorkbenchDiagnostic } from "./diagnostics";
import { validateWorkbenchDocument, WORKBENCH_FORMAT, WORKBENCH_SCHEMA_VERSION, type WorkbenchLimits } from "./validation";

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
  /** Deterministic ids for tests; default `newId`. */
  ids?: IdGenerator;
}

export function emptyDocument(options: LayoutOptions = {}): WorkbenchDocument {
  const ids = options.ids ?? newId;
  return create(WorkbenchDocumentSchema, {
    format: WORKBENCH_FORMAT,
    schemaVersion: WORKBENCH_SCHEMA_VERSION,
    id: options.id ?? ids("wb"),
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
  ids?: IdGenerator;
}

/**
 * Turn a spec into `viewCreate` mutations and a placement tree WITHOUT a
 * workspace, so the same builder serves `layout()` (one workspace over an
 * empty document), `workspaces()` (several), and the `workspace.create`
 * command (one more inside a document that already exists).
 *
 * The optional singleton knowledge belongs to the caller because a bare
 * `LayoutSpec` has no application catalog. When supplied, an existing
 * singleton is referenced and repeated singleton leaves in one spec share
 * the first view created for that application.
 */
export function buildLayout(spec: LayoutSpec, options: BuildLayoutOptions = {}): BuiltLayout {
  const ids = options.ids ?? newId;
  const mutations: Mutation[] = [];
  const views: BuiltLayout["views"] = [];
  const singletonViews = new Map(options.existingViewsByAppId);
  const build = (node: LayoutSpec): Node => {
    if (node.kind === "tile") {
      if (options.singletonAppIds?.has(node.appId)) {
        const existing = singletonViews.get(node.appId);
        if (existing) {
          views.push({ viewId: existing, appId: node.appId, ...(node.title ? { title: node.title } : {}) });
          return leafNode(existing, ids);
        }
      }
      const view = create(AppViewSchema, {
        id: ids("v"),
        appId: node.appId,
        documents: node.documents ?? {},
        ...(node.title ? { title: node.title } : {}),
      });
      mutations.push(create(MutationSchema, { body: { case: "viewCreate", value: { view } } }));
      views.push({ viewId: view.id, appId: node.appId, ...(node.title ? { title: node.title } : {}) });
      if (options.singletonAppIds?.has(node.appId)) singletonViews.set(node.appId, view.id);
      return leafNode(view.id, ids);
    }
    // Both children are built BEFORE the split so viewCreate mutations land
    // in reading order, which makes a serialised document pleasant to diff.
    const a = build(node.a);
    const b = build(node.b);
    return splitNode(node.direction === "row" ? Direction.ROW : Direction.COLUMN, a, b, node.ratio, ids);
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
  const built = buildLayout(spec, options.ids ? { ids: options.ids } : {});
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
 * core renders. Ids default to `ids("ws")` rather than to the name, so two
 * workspaces a user calls the same thing do not collide as `duplicate_id`.
 */
export function workspaces(list: readonly WorkspaceSpec[], options: LayoutOptions = {}): WorkbenchDocument {
  if (list.length === 0) throw new Error("workbench-core: workspaces() needs at least one workspace");
  const ids = options.ids ?? newId;
  const mutations: Mutation[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    const built = buildLayout(item.spec, { ids });
    const id = item.id ?? ids("ws");
    if (seen.has(id)) throw new Error(`workbench-core: workspace id "${id}" is used twice`);
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

export type ParseWorkbenchResult =
  | { ok: true; document: WorkbenchDocument }
  | { ok: false; diagnostics: readonly WorkbenchDiagnostic[] };

export interface ParseOptions {
  /** Validate against a catalog too; omitted ⇒ structural rules only. */
  apps?: ManifestCatalog;
  limits?: Partial<WorkbenchLimits>;
}

/**
 * The reverse of `serializeDocument`, with structured refusal (guide §13.2).
 * Never throws: persistence reads this on every load, and a corrupt entry
 * must fall back to a default layout rather than take the product down — but
 * the caller learns WHY, so it can report or export the raw text.
 */
export function parseWorkbenchDocument(json: string | null | undefined, options: ParseOptions = {}): ParseWorkbenchResult {
  if (!json) return { ok: false, diagnostics: [diagnostic("empty", "", "no document text")] };
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (error) {
    return { ok: false, diagnostics: [diagnostic("invalid_json", "", error instanceof Error ? error.message : String(error))] };
  }
  let doc: WorkbenchDocument;
  try {
    doc = fromJson(WorkbenchDocumentSchema, raw as Parameters<typeof fromJson>[1]);
  } catch (error) {
    return { ok: false, diagnostics: [diagnostic("invalid_json", "", error instanceof Error ? error.message : String(error))] };
  }
  const result = validateWorkbenchDocument(doc, options);
  return result.ok ? { ok: true, document: doc } : { ok: false, diagnostics: result.diagnostics };
}

/** The appId `specOf` gives a leaf it cannot resolve; every caller that validates ids rejects `""` loudly. */
export const MISSING_APP_ID = "";

/**
 * The inverse of `buildLayout`: one workspace's tree back into the dialect
 * that built it, so a description round-trips into a `create`. Node ids and
 * view ids are deliberately dropped; nothing here throws.
 */
export function specOf(doc: WorkbenchDocument, node: Node): LayoutSpec {
  if (node.body.case === "split") {
    const { direction, ratio, a, b } = node.body.value;
    return {
      kind: "split",
      direction: direction === Direction.COLUMN ? "col" : "row",
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
    ...(Object.keys(view.documents).length > 0 ? { documents: { ...view.documents } } : {}),
    ...(view.title ? { title: view.title } : {}),
  };
}

function missingTile(label: string): LayoutSpec {
  return { kind: "tile", appId: MISSING_APP_ID, title: label };
}
