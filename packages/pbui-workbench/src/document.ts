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

export function layout(spec: LayoutSpec, options: LayoutOptions = {}): WorkbenchDocument {
  const mutations: Mutation[] = [];
  const build = (node: LayoutSpec): Node => {
    if (node.kind === "tile") {
      const view = create(AppViewSchema, {
        id: newId("v"),
        appId: node.appId,
        documents: node.documents ?? {},
        ...(node.title ? { title: node.title } : {}),
      });
      mutations.push(create(MutationSchema, { body: { case: "viewCreate", value: { view } } }));
      return leafNode(view.id);
    }
    // Both children are built BEFORE the split so viewCreate mutations land
    // in reading order, which makes a serialised document pleasant to diff.
    const a = build(node.a);
    const b = build(node.b);
    return splitNode(node.direction === "row" ? Direction.ROW : Direction.COLUMN, a, b, node.ratio);
  };
  const tree = build(spec);
  mutations.push(
    create(MutationSchema, {
      body: {
        case: "workspaceCreate",
        value: {
          workspaceId: options.workspaceId ?? "main",
          name: options.workspaceName ?? "main",
          rootPlacement: tree,
        },
      },
    }),
  );
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
