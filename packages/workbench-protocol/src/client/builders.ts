/**
 * Primitive builders and query helpers over a WorkbenchDocument.
 *
 * A builder answers "what mutations express this structural intent against
 * this document". Callers apply them locally (apply.ts) and queue the same
 * mutations for the server, which re-applies and re-validates them through
 * pkg/workbench.
 *
 * Policy-neutral by contract (PBUI-WORKBENCH-CORE-1 §13.4): nothing here
 * knows an application catalog, a binding key, a launcher, or a singleton.
 * Everything catalog- or policy-aware lives in `@hyperslop-systems/workbench-core`.
 */

import { create, type MessageInitShape } from "@bufbuild/protobuf";
import {
  AppViewSchema,
  Direction,
  LeafSchema,
  type Mutation,
  MutationSchema,
  type Node,
  NodeSchema,
  PlacementPosition,
  SplitSchema,
  type AppView,
  type WorkbenchDocument,
} from "../index.js";

/**
 * How a builder mints an id for a node, view, or workspace it creates. The
 * default draws on `crypto.randomUUID`; a planner that must be deterministic
 * (tests, goldens, replay) passes its own.
 */
export type IdGenerator = (prefix: string) => string;

/** newId mints a document-scoped identifier. */
export function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 13)}`;
}

// --- construction -----------------------------------------------------------

export function leafNode(viewId: string, ids: IdGenerator = newId): Node {
  return create(NodeSchema, {
    id: ids("n"),
    body: { case: "leaf", value: create(LeafSchema, { viewId }) },
  });
}

export function splitNode(direction: Direction, a: Node, b: Node, ratio: number, ids: IdGenerator = newId): Node {
  return create(NodeSchema, {
    id: ids("n"),
    body: { case: "split", value: create(SplitSchema, { direction, ratio, a, b }) },
  });
}

// --- queries ----------------------------------------------------------------

export function findNode(node: Node | undefined, id: string): Node | null {
  if (!node) return null;
  if (node.id === id) return node;
  if (node.body.case === "split") {
    return findNode(node.body.value.a, id) ?? findNode(node.body.value.b, id);
  }
  return null;
}

/** leaves lists every placement of one tree, in order. */
export function leaves(node: Node | undefined): Node[] {
  if (!node) return [];
  if (node.body.case === "leaf") return [node];
  if (node.body.case === "split") {
    return [...leaves(node.body.value.a), ...leaves(node.body.value.b)];
  }
  return [];
}

/** viewsOfApp lists the logical views of one application, across workspaces. */
export function viewsOfApp(doc: WorkbenchDocument, appId: string): AppView[] {
  return doc.viewOrder
    .map((id) => doc.views[id])
    .filter((view): view is AppView => view !== undefined && view.appId === appId);
}

/** placementCount counts the placements of one view across every workspace. */
export function placementCount(doc: WorkbenchDocument, viewId: string): number {
  let count = 0;
  for (const workspace of doc.workspaces) {
    for (const leaf of leaves(workspace.tree)) {
      if (leaf.body.case === "leaf" && leaf.body.value.viewId === viewId) count += 1;
    }
  }
  return count;
}

/** workspaceOfPlacement names the workspace whose tree holds one placement. */
export function workspaceOfPlacement(doc: WorkbenchDocument, placementId: string): string | null {
  for (const workspace of doc.workspaces) {
    if (findNode(workspace.tree, placementId)) return workspace.id;
  }
  return null;
}

/** workspaceTree returns one workspace's split tree, if the workspace exists. */
export function workspaceTree(doc: WorkbenchDocument, workspaceId: string): Node | undefined {
  return doc.workspaces.find((workspace) => workspace.id === workspaceId)?.tree;
}

/** boundDocumentId reads which document a view's named binding references. */
export function boundDocumentId(view: AppView | undefined, binding: string): string | null {
  if (!view) return null;
  return view.documents[binding] ?? null;
}

// --- config-independent verbs -----------------------------------------------

type MutationBody = MessageInitShape<typeof MutationSchema>["body"];

function mutation(body: MutationBody): Mutation {
  return create(MutationSchema, { body });
}

/**
 * splitPlacement opens a new pane beside one placement, holding a freshly
 * minted (unbound) view of `appId`. Binding policy is the engine's, not this
 * package's.
 */
export function splitPlacement(
  doc: WorkbenchDocument,
  placementId: string,
  direction: "row" | "col",
  appId: string,
  ids: IdGenerator = newId,
): Mutation[] {
  const workspaceId = workspaceOfPlacement(doc, placementId);
  if (!workspaceId) return [];
  const view = create(AppViewSchema, { id: ids("v"), appId });
  return [
    mutation({ case: "viewCreate", value: { view } }),
    mutation({
      case: "placementSplit",
      value: {
        workspaceId,
        placementId,
        direction: direction === "row" ? Direction.ROW : Direction.COLUMN,
        ratio: 0.5,
        splitId: ids("n"),
        newPlacement: leafNode(view.id, ids),
        place: PlacementPosition.AFTER,
      },
    }),
  ];
}

/**
 * closePlacement removes one pane. When the pane held the LAST placement of
 * its view, the view goes too: the user model is "closing the tile closes
 * the thing", and an unreachable view would otherwise linger in the document.
 */
export function closePlacement(doc: WorkbenchDocument, placementId: string): Mutation[] {
  const workspaceId = workspaceOfPlacement(doc, placementId);
  if (!workspaceId) return [];
  const tree = workspaceTree(doc, workspaceId);
  const node = findNode(tree, placementId);
  if (!node || node.body.case !== "leaf") return [];
  const viewId = node.body.value.viewId;

  const mutations = [mutation({ case: "placementClose", value: { workspaceId, placementId } })];
  if (placementCount(doc, viewId) === 1) {
    mutations.push(mutation({ case: "viewDelete", value: { viewId } }));
  }
  return mutations;
}

/**
 * replacePlacement makes the TARGET pane show the SOURCE pane's view and
 * closes the source pane (the Alt-drag gesture, PBUI-REBALANCE-1): the
 * dragged application takes the target's rectangle, the layout loses one
 * tile, and the target's old view is deleted when nothing else places it.
 * Sources and targets showing the SAME view (linked twins) collapse to the
 * target placement alone.
 */
export function replacePlacement(doc: WorkbenchDocument, sourceId: string, targetId: string): Mutation[] {
  if (sourceId === targetId) return [];
  const sourceWorkspace = workspaceOfPlacement(doc, sourceId);
  const targetWorkspace = workspaceOfPlacement(doc, targetId);
  if (!sourceWorkspace || !targetWorkspace) return [];
  const source = findNode(workspaceTree(doc, sourceWorkspace), sourceId);
  const target = findNode(workspaceTree(doc, targetWorkspace), targetId);
  if (source?.body.case !== "leaf" || target?.body.case !== "leaf") return [];
  const sourceView = source.body.value.viewId;
  const targetView = target.body.value.viewId;
  if (sourceView === targetView) return closePlacement(doc, sourceId);
  const mutations: Mutation[] = [
    mutation({
      case: "placementReplace",
      value: { workspaceId: targetWorkspace, placementId: targetId, viewId: sourceView },
    }),
    // The source view has its new placement before the old one closes, so it
    // can never look abandoned (same ordering dockPlacement relies on).
    mutation({ case: "placementClose", value: { workspaceId: sourceWorkspace, placementId: sourceId } }),
  ];
  if (placementCount(doc, targetView) === 1) {
    mutations.push(mutation({ case: "viewDelete", value: { viewId: targetView } }));
  }
  return mutations;
}

/**
 * swapPlacements exchanges what two panes show. Two placement references
 * change; the views themselves do not notice — which is the whole point of
 * the placement/view split.
 */
export function swapPlacements(doc: WorkbenchDocument, aId: string, bId: string): Mutation[] {
  if (aId === bId) return [];
  const aWorkspace = workspaceOfPlacement(doc, aId);
  const bWorkspace = workspaceOfPlacement(doc, bId);
  if (!aWorkspace || !bWorkspace) return [];
  const a = findNode(workspaceTree(doc, aWorkspace), aId);
  const b = findNode(workspaceTree(doc, bWorkspace), bId);
  if (a?.body.case !== "leaf" || b?.body.case !== "leaf") return [];
  return [
    mutation({
      case: "placementReplace",
      value: { workspaceId: aWorkspace, placementId: aId, viewId: b.body.value.viewId },
    }),
    mutation({
      case: "placementReplace",
      value: { workspaceId: bWorkspace, placementId: bId, viewId: a.body.value.viewId },
    }),
  ];
}

/** The edge of a tile a drag can dock onto. */
export type DockZone = "left" | "right" | "top" | "bottom";

/**
 * dockPlacement moves one pane's view next to another pane: the target splits
 * to make room, and the source pane closes. The source VIEW survives — it has
 * its new placement before the old one closes, so no garbage collection can
 * mistake it for abandoned.
 */
export function dockPlacement(
  doc: WorkbenchDocument,
  sourceId: string,
  targetId: string,
  zone: DockZone,
  ids: IdGenerator = newId,
): Mutation[] {
  if (sourceId === targetId) return [];
  const sourceWorkspace = workspaceOfPlacement(doc, sourceId);
  const targetWorkspace = workspaceOfPlacement(doc, targetId);
  if (!sourceWorkspace || !targetWorkspace) return [];
  const source = findNode(workspaceTree(doc, sourceWorkspace), sourceId);
  if (source?.body.case !== "leaf") return [];

  return [
    mutation({
      case: "placementSplit",
      value: {
        workspaceId: targetWorkspace,
        placementId: targetId,
        direction: zone === "left" || zone === "right" ? Direction.ROW : Direction.COLUMN,
        ratio: 0.5,
        splitId: ids("n"),
        newPlacement: leafNode(source.body.value.viewId, ids),
        place:
          zone === "left" || zone === "top" ? PlacementPosition.BEFORE : PlacementPosition.AFTER,
      },
    }),
    mutation({
      case: "placementClose",
      value: { workspaceId: sourceWorkspace, placementId: sourceId },
    }),
  ];
}

/** resizeSplit commits one divider position. */
export function resizeSplit(doc: WorkbenchDocument, splitId: string, ratio: number): Mutation[] {
  const workspaceId = doc.workspaces.find((workspace) => findNode(workspace.tree, splitId))?.id;
  if (!workspaceId) return [];
  return [mutation({ case: "splitResize", value: { workspaceId, splitId, ratio } })];
}
