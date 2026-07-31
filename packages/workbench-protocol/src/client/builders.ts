/**
 * Verb builders and query helpers over a WorkbenchDocument.
 *
 * A verb answers "what mutations express this intent against this document".
 * Callers apply them locally (apply.ts) and queue the same mutations for the
 * server, which re-applies and re-validates them through pkg/workbench.
 *
 * Extracted from the agentlogic/turboproof `store/workbench.ts` copies
 * (turboproof's superset), stripped of product constants: the source-binding
 * key, the launcher application id, and the "which documents are bindable"
 * sniff live in a ClientConfig and are closed over by
 * `createWorkbenchClient`. Everything that does not need the config is a
 * plain export.
 */

import { create, type MessageInitShape } from "@bufbuild/protobuf";
import {
  AppViewSchema,
  Direction,
  DocumentBindingsSchema,
  type DocumentPayload,
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

/** newId mints a document-scoped identifier. */
export function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 13)}`;
}

// --- construction -----------------------------------------------------------

export function leafNode(viewId: string): Node {
  return create(NodeSchema, {
    id: newId("n"),
    body: { case: "leaf", value: create(LeafSchema, { viewId }) },
  });
}

export function splitNode(direction: Direction, a: Node, b: Node, ratio: number): Node {
  return create(NodeSchema, {
    id: newId("n"),
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
 * minted (unbound) view of `appId`. The launcher-opening convenience with the
 * app id baked in lives on the client returned by `createWorkbenchClient`.
 */
export function splitPlacement(
  doc: WorkbenchDocument,
  placementId: string,
  direction: "row" | "col",
  appId: string,
): Mutation[] {
  const workspaceId = workspaceOfPlacement(doc, placementId);
  if (!workspaceId) return [];
  const view = create(AppViewSchema, { id: newId("v"), appId });
  return [
    mutation({ case: "viewCreate", value: { view } }),
    mutation({
      case: "placementSplit",
      value: {
        workspaceId,
        placementId,
        direction: direction === "row" ? Direction.ROW : Direction.COLUMN,
        ratio: 0.5,
        splitId: newId("n"),
        newPlacement: leafNode(view.id),
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
        splitId: newId("n"),
        newPlacement: leafNode(source.body.value.viewId),
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

// --- the configured client --------------------------------------------------

/**
 * ClientConfig carries the product constants the shared verbs need:
 *
 * - `sourceBinding`: the binding key under which placed tiles reference their
 *   working document (turboproof: "source", datalab: "primary").
 * - `launcherAppId`: the application an empty pane shows; launcher views are
 *   treated as placeholders and garbage-collected when retargeted.
 * - `isBindableDocument`: which document payloads a freshly placed tile may
 *   bind by default. Omitted means "any document".
 */
export interface ClientConfig {
  sourceBinding: string;
  launcherAppId: string;
  isBindableDocument?(payload: DocumentPayload): boolean;
}

export interface WorkbenchClient {
  readonly config: ClientConfig;
  /** boundDocumentId reads the config's source binding off one view. */
  boundDocumentId(view: AppView | undefined): string | null;
  /**
   * defaultSourceDocumentId picks what a freshly placed tile should bind:
   * the document some existing view already binds (follow the crowd), else
   * the first bindable document in the workbench. Null means "nothing to
   * bind" and the tile shows its empty state.
   */
  defaultSourceDocumentId(doc: WorkbenchDocument): string | null;
  /** splitPlacement opens a launcher pane beside one placement. */
  splitPlacement(doc: WorkbenchDocument, placementId: string, direction: "row" | "col"): Mutation[];
  /** replaceApp changes what one pane shows; see the factory for the cases. */
  replaceApp(
    doc: WorkbenchDocument,
    placementId: string,
    appId: string,
    singleton: boolean,
  ): Mutation[];
  /** linkViewIntoPlacement points one pane at an EXISTING view. */
  linkViewIntoPlacement(doc: WorkbenchDocument, placementId: string, viewId: string): Mutation[];
  /** splitWithApp opens a NEW pane beside one placement holding the chosen app. */
  splitWithApp(
    doc: WorkbenchDocument,
    placementId: string,
    direction: "row" | "col",
    appId: string,
    singleton: boolean,
  ): Mutation[];
}

/**
 * createWorkbenchClient closes the config-dependent verbs over one product's
 * constants. The config-independent verbs remain plain module exports.
 */
export function createWorkbenchClient(config: ClientConfig): WorkbenchClient {
  const isBindable = config.isBindableDocument ?? (() => true);

  const boundId = (view: AppView | undefined): string | null =>
    boundDocumentId(view, config.sourceBinding);

  const defaultSourceDocumentId = (doc: WorkbenchDocument): string | null => {
    for (const viewId of doc.viewOrder) {
      const bound = boundId(doc.views[viewId]);
      if (bound && doc.documents[bound]) return bound;
    }
    for (const [documentId, payload] of Object.entries(doc.documents)) {
      if (isBindable(payload)) return documentId;
    }
    return null;
  };

  /**
   * replaceApp changes what one pane shows. Three cases, in order:
   *
   *   - the wanted application is a singleton with an existing view: LINK this
   *     placement to that view, and delete this placement's launcher view;
   *   - this placement holds a launcher view: RETARGET the view in place, so
   *     the pane keeps its identity;
   *   - otherwise: mint a new view and replace the placement's reference.
   *
   * A freshly minted view binds the workbench's default source document — an
   * unbound tile is technically legal but reads as broken to a user.
   */
  const replaceApp = (
    doc: WorkbenchDocument,
    placementId: string,
    appId: string,
    singleton: boolean,
  ): Mutation[] => {
    const workspaceId = workspaceOfPlacement(doc, placementId);
    if (!workspaceId) return [];
    const node = findNode(workspaceTree(doc, workspaceId), placementId);
    if (!node || node.body.case !== "leaf") return [];
    const currentViewId = node.body.value.viewId;
    const currentView = doc.views[currentViewId];

    if (singleton) {
      const existing = viewsOfApp(doc, appId)[0];
      // Already showing it: nothing to do. Falling through would mint a SECOND
      // view for the singleton — the structural applier here accepts that, but
      // `pkg/workbench`'s Validate rejects the batch as `duplicate_singleton`,
      // so the optimistic document would sit invalid until conflict repair.
      if (existing && existing.id === currentViewId) return [];
      if (existing) {
        const mutations = [
          mutation({
            case: "placementReplace",
            value: { workspaceId, placementId, viewId: existing.id },
          }),
        ];
        if (currentView?.appId === config.launcherAppId && placementCount(doc, currentViewId) === 1) {
          mutations.push(mutation({ case: "viewDelete", value: { viewId: currentViewId } }));
        }
        return mutations;
      }
    }

    const bindable = appId !== config.launcherAppId;
    const sourceDocumentId = bindable ? defaultSourceDocumentId(doc) : null;
    const documents: Record<string, string> = {};
    if (sourceDocumentId) documents[config.sourceBinding] = sourceDocumentId;

    if (currentView?.appId === config.launcherAppId && placementCount(doc, currentViewId) === 1) {
      return [
        mutation({
          case: "viewConfigure",
          value: {
            viewId: currentViewId,
            appId,
            replaceDocuments: create(DocumentBindingsSchema, { values: documents }),
          },
        }),
      ];
    }

    const view = create(AppViewSchema, { id: newId("v"), appId, documents });
    return [
      mutation({ case: "viewCreate", value: { view } }),
      mutation({ case: "placementReplace", value: { workspaceId, placementId, viewId: view.id } }),
    ];
  };

  /**
   * linkViewIntoPlacement points one pane at an EXISTING view (the launcher's
   * "open views" rows). When the pane held a launcher view with no other
   * placement, that view goes too.
   */
  const linkViewIntoPlacement = (
    doc: WorkbenchDocument,
    placementId: string,
    viewId: string,
  ): Mutation[] => {
    const workspaceId = workspaceOfPlacement(doc, placementId);
    if (!workspaceId || !doc.views[viewId]) return [];
    const node = findNode(workspaceTree(doc, workspaceId), placementId);
    if (!node || node.body.case !== "leaf") return [];
    const currentViewId = node.body.value.viewId;
    if (currentViewId === viewId) return [];
    const mutations = [
      mutation({ case: "placementReplace", value: { workspaceId, placementId, viewId } }),
    ];
    const currentView = doc.views[currentViewId];
    if (currentView?.appId === config.launcherAppId && placementCount(doc, currentViewId) === 1) {
      mutations.push(mutation({ case: "viewDelete", value: { viewId: currentViewId } }));
    }
    return mutations;
  };

  /**
   * splitWithApp opens a NEW pane beside one placement holding the chosen app
   * directly — the global launcher's "new view" path, which must never
   * destroy the tile the user was in (the datalab rule). Singletons with an
   * existing view get a new placement of THAT view; otherwise a fresh view is
   * minted, bound to the workbench's source document like every placed tile.
   */
  const splitWithApp = (
    doc: WorkbenchDocument,
    placementId: string,
    direction: "row" | "col",
    appId: string,
    singleton: boolean,
  ): Mutation[] => {
    const workspaceId = workspaceOfPlacement(doc, placementId);
    if (!workspaceId) return [];

    const split = (viewId: string): Mutation =>
      mutation({
        case: "placementSplit",
        value: {
          workspaceId,
          placementId,
          direction: direction === "row" ? Direction.ROW : Direction.COLUMN,
          ratio: 0.5,
          splitId: newId("n"),
          newPlacement: leafNode(viewId),
          place: PlacementPosition.AFTER,
        },
      });

    if (singleton) {
      const existing = viewsOfApp(doc, appId)[0];
      if (existing) return [split(existing.id)];
    }

    const documents: Record<string, string> = {};
    const sourceDocumentId = appId === config.launcherAppId ? null : defaultSourceDocumentId(doc);
    if (sourceDocumentId) documents[config.sourceBinding] = sourceDocumentId;
    const view = create(AppViewSchema, { id: newId("v"), appId, documents });
    return [mutation({ case: "viewCreate", value: { view } }), split(view.id)];
  };

  return {
    config,
    boundDocumentId: boundId,
    defaultSourceDocumentId,
    splitPlacement: (doc, placementId, direction) =>
      splitPlacement(doc, placementId, direction, config.launcherAppId),
    replaceApp,
    linkViewIntoPlacement,
    splitWithApp,
  };
}
