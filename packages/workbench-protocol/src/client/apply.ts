/**
 * The local workbench-document applier.
 *
 * `applyMutation` mirrors pbui's Go applier (pkg/workbench/mutation.go) arm
 * for arm, including its error codes. The Go applier is authoritative: where
 * the historical per-product TypeScript copies disagreed with Go (whitespace
 * trimming, documentDelete validation, rejecting an UNSPECIFIED placement
 * position), this port follows Go. The TS<->Go agreement is pinned by the
 * shared fixtures in fixtures/mutations, asserted from both languages.
 *
 * Note what this applier does NOT do: the Go side runs a full-graph
 * `Validate` (catalog lookups, limits, credential sniffing) after applying a
 * batch. This layer is the pure structural applier only; a mutation it
 * accepts can still be 422'd by the server's validation pass.
 */

import { clone, create } from "@bufbuild/protobuf";
import {
  AppViewSchema,
  DocumentPayloadSchema,
  LeafSchema,
  type Mutation,
  type Node,
  NodeSchema,
  PlacementPosition,
  SplitSchema,
  type WorkbenchDocument,
  WorkbenchDocumentSchema,
  WorkspaceSchema,
} from "../index.js";

/**
 * MutationError mirrors pkg/workbench's `ValidationError{Code, Path, Detail}`:
 * a stable `code` (the same strings the Go applier uses), the offending field
 * path, and the human-readable detail.
 *
 * `detail` is kept as a field and not only folded into `message` because a
 * caller that reports a refusal onward — a store's `onRejected`, an
 * agent-facing tool handing the reason back to whoever proposed the batch —
 * wants the sentence without the `workbench: code at path:` prefix.
 */
export class MutationError extends Error {
  readonly code: string;
  readonly path: string;
  readonly detail: string;

  constructor(code: string, path: string, detail: string) {
    super(path === "" ? `workbench: ${code}: ${detail}` : `workbench: ${code} at ${path}: ${detail}`);
    this.name = "MutationError";
    this.code = code;
    this.path = path;
    this.detail = detail;
  }
}

function invalid(code: string, path: string, detail: string): MutationError {
  return new MutationError(code, path, detail);
}

/**
 * applyMutation clones the document and applies one mutation. It throws a
 * MutationError on a mutation the document cannot take — callers drop such a
 * mutation instead of sending it to the server.
 */
export function applyMutation(doc: WorkbenchDocument, mutation: Mutation): WorkbenchDocument {
  const next = clone(WorkbenchDocumentSchema, doc);
  const body = mutation.body;
  switch (body.case) {
    case "workbenchRename": {
      next.name = body.value.name.trim();
      return next;
    }

    case "workspaceCreate": {
      const value = body.value;
      if (!value.rootPlacement) {
        throw invalid("invalid_mutation", "workspaceCreate", "workspace and root placement are required");
      }
      if (next.workspaces.some((workspace) => workspace.id === value.workspaceId)) {
        throw invalid("duplicate_id", "workspaceCreate.workspaceId", `workspace "${value.workspaceId}" already exists`);
      }
      next.workspaces.push(
        create(WorkspaceSchema, {
          id: value.workspaceId,
          name: value.name.trim(),
          tree: clone(NodeSchema, value.rootPlacement),
        }),
      );
      return next;
    }

    case "workspaceSetTree": {
      const value = body.value;
      if (!value.rootPlacement) {
        throw invalid("invalid_mutation", "workspaceSetTree", "root placement is required");
      }
      const workspace = next.workspaces.find((item) => item.id === value.workspaceId);
      if (!workspace) {
        throw invalid(
          "unknown_workspace",
          "workspaceSetTree.workspaceId",
          `workspace "${value.workspaceId}" does not exist`,
        );
      }
      workspace.tree = clone(NodeSchema, value.rootPlacement);
      return next;
    }

    case "workspaceRename": {
      const workspace = next.workspaces.find((item) => item.id === body.value.workspaceId);
      if (!workspace) {
        throw invalid(
          "unknown_workspace",
          "workspaceRename.workspaceId",
          `workspace "${body.value.workspaceId}" does not exist`,
        );
      }
      workspace.name = body.value.name.trim();
      return next;
    }

    case "workspaceDelete": {
      if (next.workspaces.length <= 1) {
        throw invalid("last_workspace", "workspaceDelete.workspaceId", "the last workspace cannot be deleted");
      }
      const index = next.workspaces.findIndex((item) => item.id === body.value.workspaceId);
      if (index < 0) {
        throw invalid(
          "unknown_workspace",
          "workspaceDelete.workspaceId",
          `workspace "${body.value.workspaceId}" does not exist`,
        );
      }
      next.workspaces.splice(index, 1);
      return next;
    }

    case "documentPut": {
      const document = body.value.document;
      if (!document) throw invalid("invalid_mutation", "documentPut.document", "document is required");
      next.documents[document.id] = clone(DocumentPayloadSchema, document);
      return next;
    }

    case "documentDelete": {
      const documentId = body.value.documentId;
      if (!next.documents[documentId]) {
        throw invalid("unknown_document", "documentDelete.documentId", `document "${documentId}" does not exist`);
      }
      for (const view of Object.values(next.views)) {
        for (const [binding, id] of Object.entries(view.documents)) {
          if (id === documentId) {
            throw invalid(
              "document_in_use",
              "documentDelete.documentId",
              `view "${view.id}" binding "${binding}" references document`,
            );
          }
        }
      }
      delete next.documents[documentId];
      return next;
    }

    case "viewCreate": {
      const view = body.value.view;
      if (!view) throw invalid("invalid_mutation", "viewCreate.view", "view is required");
      if (next.views[view.id]) {
        throw invalid("duplicate_id", "viewCreate.view.id", `view "${view.id}" already exists`);
      }
      next.views[view.id] = clone(AppViewSchema, view);
      next.viewOrder.push(view.id);
      return next;
    }

    case "viewConfigure": {
      const view = next.views[body.value.viewId];
      if (!view) {
        throw invalid("unknown_view", "viewConfigure.viewId", `view "${body.value.viewId}" does not exist`);
      }
      if (body.value.appId !== undefined) view.appId = body.value.appId.trim();
      if (body.value.titleChange.case === "setTitle") view.title = body.value.titleChange.value.trim();
      if (body.value.titleChange.case === "clearTitle") view.title = undefined;
      if (body.value.replaceDocuments) {
        view.documents = { ...body.value.replaceDocuments.values };
      }
      return next;
    }

    case "viewClone": {
      const value = body.value;
      const source = next.views[value.sourceViewId];
      if (!source) {
        throw invalid("unknown_view", "viewClone.sourceViewId", `view "${value.sourceViewId}" does not exist`);
      }
      if (next.views[value.newViewId]) {
        throw invalid("duplicate_id", "viewClone.newViewId", `view "${value.newViewId}" already exists`);
      }
      const cloned = clone(AppViewSchema, source);
      cloned.id = value.newViewId;
      if (value.titleChange.case === "setTitle") cloned.title = value.titleChange.value.trim();
      if (value.titleChange.case === "clearTitle") cloned.title = undefined;
      next.views[cloned.id] = cloned;
      next.viewOrder.push(cloned.id);
      return next;
    }

    case "viewDelete": {
      const viewId = body.value.viewId;
      if (!next.views[viewId]) {
        throw invalid("unknown_view", "viewDelete.viewId", `view "${viewId}" does not exist`);
      }
      if (countViewPlacements(next, viewId) > 0) {
        throw invalid("view_in_use", "viewDelete.viewId", `view "${viewId}" still has placements`);
      }
      removeViewRecord(next, viewId);
      return next;
    }

    case "viewClose": {
      const value = body.value;
      if (value.viewId === value.fallbackViewId) {
        throw invalid("invalid_fallback", "viewClose.fallbackViewId", "fallback must differ from closed view");
      }
      if (!next.views[value.viewId]) {
        throw invalid("unknown_view", "viewClose.viewId", `view "${value.viewId}" does not exist`);
      }
      if (!next.views[value.fallbackViewId]) {
        throw invalid("unknown_view", "viewClose.fallbackViewId", `view "${value.fallbackViewId}" does not exist`);
      }
      for (const workspace of next.workspaces) {
        if (!workspace.tree) continue;
        const rootId = workspace.tree.id;
        const remaining = removeViewPlacements(workspace.tree, value.viewId);
        workspace.tree =
          remaining ??
          create(NodeSchema, {
            id: rootId,
            body: { case: "leaf", value: create(LeafSchema, { viewId: value.fallbackViewId }) },
          });
      }
      removeViewRecord(next, value.viewId);
      return next;
    }

    case "placementReplace": {
      const value = body.value;
      if (!next.views[value.viewId]) {
        throw invalid("unknown_view", "placementReplace.viewId", `view "${value.viewId}" does not exist`);
      }
      const workspace = next.workspaces.find((item) => item.id === value.workspaceId);
      if (!workspace) {
        throw invalid("unknown_workspace", "workspaceId", `workspace "${value.workspaceId}" does not exist`);
      }
      const target = findNodeIn(workspace.tree, value.placementId);
      if (!target || target.body.case !== "leaf") {
        throw invalid("unknown_placement", "placementId", `placement "${value.placementId}" does not exist`);
      }
      target.body = { case: "leaf", value: create(LeafSchema, { viewId: value.viewId }) };
      return next;
    }

    case "placementSplit": {
      const value = body.value;
      const newLeaf = value.newPlacement;
      if (!newLeaf || newLeaf.body.case !== "leaf") {
        throw invalid("invalid_leaf", "placementSplit.newPlacement", "new placement must be a leaf");
      }
      const workspace = next.workspaces.find((item) => item.id === value.workspaceId);
      if (!workspace) {
        throw invalid(
          "unknown_workspace",
          "placementSplit.workspaceId",
          `workspace "${value.workspaceId}" does not exist`,
        );
      }
      const newViewId = newLeaf.body.value.viewId;
      if (!next.views[newViewId]) {
        throw invalid(
          "unknown_view",
          "placementSplit.newPlacement.leaf.viewId",
          `view "${newViewId}" does not exist`,
        );
      }
      const target = findNodeIn(workspace.tree, value.placementId);
      if (!target || target.body.case !== "leaf") {
        throw invalid(
          "unknown_placement",
          "placementSplit.placementId",
          `placement "${value.placementId}" does not exist`,
        );
      }
      // The target node BECOMES the split, and a copy of it moves down one
      // level keeping its id — exactly the Go applier's shape, so ids agree.
      const targetCopy = clone(NodeSchema, target);
      const newCopy = clone(NodeSchema, newLeaf);
      let a: Node;
      let b: Node;
      switch (value.place) {
        case PlacementPosition.BEFORE:
          [a, b] = [newCopy, targetCopy];
          break;
        case PlacementPosition.AFTER:
          [a, b] = [targetCopy, newCopy];
          break;
        default:
          throw invalid("invalid_position", "placementSplit.place", "position must be BEFORE or AFTER");
      }
      target.id = value.splitId;
      target.body = {
        case: "split",
        value: create(SplitSchema, { direction: value.direction, ratio: value.ratio, a, b }),
      };
      return next;
    }

    case "placementClose": {
      const workspace = next.workspaces.find((item) => item.id === body.value.workspaceId);
      if (!workspace || !workspace.tree) {
        throw invalid(
          "unknown_workspace",
          "placementClose.workspaceId",
          `workspace "${body.value.workspaceId}" does not exist`,
        );
      }
      const [remaining, removed] = removePlacement(workspace.tree, body.value.placementId);
      if (!removed) {
        throw invalid(
          "unknown_placement",
          "placementClose.placementId",
          `placement "${body.value.placementId}" does not exist`,
        );
      }
      if (remaining === null) {
        throw invalid("last_placement", "placementClose.placementId", "the last placement cannot be closed");
      }
      workspace.tree = remaining;
      return next;
    }

    case "splitResize": {
      const workspace = next.workspaces.find((item) => item.id === body.value.workspaceId);
      if (!workspace) {
        throw invalid(
          "unknown_workspace",
          "splitResize.workspaceId",
          `workspace "${body.value.workspaceId}" does not exist`,
        );
      }
      const node = findNodeIn(workspace.tree, body.value.splitId);
      if (!node || node.body.case !== "split") {
        throw invalid("unknown_split", "splitResize.splitId", `split "${body.value.splitId}" does not exist`);
      }
      node.body.value.ratio = body.value.ratio;
      return next;
    }

    default:
      throw invalid("invalid_mutation", "body", `unsupported mutation body ${body.case ?? "(empty)"}`);
  }
}

/** applyMutations applies a batch left to right, throwing on the first bad one. */
export function applyMutations(doc: WorkbenchDocument, mutations: Mutation[]): WorkbenchDocument {
  let next = doc;
  for (const mutation of mutations) {
    next = applyMutation(next, mutation);
  }
  return next;
}

// --- tree helpers (shared with builders.ts through this module) -------------

function findNodeIn(node: Node | undefined, id: string): Node | null {
  if (!node) return null;
  if (node.id === id) return node;
  if (node.body.case === "split") {
    return findNodeIn(node.body.value.a, id) ?? findNodeIn(node.body.value.b, id);
  }
  return null;
}

/**
 * removePlacement returns the tree without one leaf; the sibling absorbs the
 * vacated space. The tuple mirrors Go's (node, removed): `[null, true]` means
 * the leaf was the whole tree (the last placement, which cannot close).
 */
function removePlacement(node: Node, placementId: string): [Node | null, boolean] {
  if (node.body.case === "leaf") {
    return node.id === placementId ? [null, true] : [node, false];
  }
  if (node.body.case !== "split") return [node, false];
  const split = node.body.value;
  if (!split.a || !split.b) return [node, false];
  const [a, removedA] = removePlacement(split.a, placementId);
  const [b, removedB] = removePlacement(split.b, placementId);
  if (!removedA && !removedB) return [node, false];
  if (a === null) return [b, true];
  if (b === null) return [a, true];
  split.a = a;
  split.b = b;
  return [node, true];
}

/** removeViewPlacements drops every leaf of one view; null means "tree emptied". */
function removeViewPlacements(node: Node | undefined, viewId: string): Node | null {
  if (!node) return null;
  if (node.body.case === "leaf") {
    return node.body.value.viewId === viewId ? null : node;
  }
  if (node.body.case !== "split") return node;
  const split = node.body.value;
  const a = removeViewPlacements(split.a, viewId);
  const b = removeViewPlacements(split.b, viewId);
  if (a === null) return b;
  if (b === null) return a;
  split.a = a;
  split.b = b;
  return node;
}

function countViewPlacements(doc: WorkbenchDocument, viewId: string): number {
  let total = 0;
  const count = (node: Node | undefined): void => {
    if (!node) return;
    if (node.body.case === "leaf") {
      if (node.body.value.viewId === viewId) total += 1;
      return;
    }
    if (node.body.case === "split") {
      count(node.body.value.a);
      count(node.body.value.b);
    }
  };
  for (const workspace of doc.workspaces) count(workspace.tree);
  return total;
}

function removeViewRecord(doc: WorkbenchDocument, viewId: string): void {
  delete doc.views[viewId];
  doc.viewOrder = doc.viewOrder.filter((id) => id !== viewId);
}
