import type { Node, WorkbenchDocument, Workspace } from "@hyperslop-systems/workbench-protocol";
import { diagnostic, WorkbenchDiagnosticError } from "./diagnostics";

/** One occurrence of a view: the leaf and the workspace whose tree holds it. */
export interface PlacementRef {
  readonly placementId: string;
  readonly workspaceId: string;
}

/**
 * The structural index (guide §16.5, simplification S13): the six joins
 * nearly every command asks for, materialised once per document revision.
 * Everything else — bindings to a document, documents of a format, orphan
 * views — is an on-demand query in `queries.ts`.
 *
 * Immutable by contract: build a new one after every document change
 * (wholesale, never incrementally — profile before changing that).
 */
export interface WorkbenchIndex {
  readonly workspaceById: ReadonlyMap<string, Workspace>;
  readonly nodeById: ReadonlyMap<string, Node>;
  readonly workspaceByNodeId: ReadonlyMap<string, string>;
  readonly viewByPlacementId: ReadonlyMap<string, string>;
  /** In workspace order, then reading order within a tree. */
  readonly placementsByViewId: ReadonlyMap<string, readonly PlacementRef[]>;
  /** In `viewOrder`. */
  readonly viewsByAppId: ReadonlyMap<string, readonly string[]>;
}

/**
 * Build the index. A duplicate node id across the document is refused here
 * with `duplicate_id` (the same code Go uses) because two maps keyed by node
 * id cannot represent it; every other malformation is validation's business.
 */
export function buildWorkbenchIndex(doc: WorkbenchDocument): WorkbenchIndex {
  const workspaceById = new Map<string, Workspace>();
  const nodeById = new Map<string, Node>();
  const workspaceByNodeId = new Map<string, string>();
  const viewByPlacementId = new Map<string, string>();
  const placementsByViewId = new Map<string, PlacementRef[]>();
  const viewsByAppId = new Map<string, string[]>();

  const visit = (node: Node | undefined, workspaceId: string, path: string): void => {
    if (!node) return;
    if (nodeById.has(node.id)) {
      throw new WorkbenchDiagnosticError(diagnostic("duplicate_id", `${path}.id`, `node ID "${node.id}" was already used`));
    }
    nodeById.set(node.id, node);
    workspaceByNodeId.set(node.id, workspaceId);
    if (node.body.case === "leaf") {
      const viewId = node.body.value.viewId;
      viewByPlacementId.set(node.id, viewId);
      const refs = placementsByViewId.get(viewId) ?? [];
      refs.push({ placementId: node.id, workspaceId });
      placementsByViewId.set(viewId, refs);
      return;
    }
    if (node.body.case === "split") {
      visit(node.body.value.a, workspaceId, `${path}.split.a`);
      visit(node.body.value.b, workspaceId, `${path}.split.b`);
    }
  };

  doc.workspaces.forEach((workspace, index) => {
    workspaceById.set(workspace.id, workspace);
    visit(workspace.tree, workspace.id, `workspaces[${index}].tree`);
  });

  for (const viewId of doc.viewOrder) {
    const view = doc.views[viewId];
    if (!view) continue;
    const ids = viewsByAppId.get(view.appId) ?? [];
    ids.push(viewId);
    viewsByAppId.set(view.appId, ids);
  }

  return { workspaceById, nodeById, workspaceByNodeId, viewByPlacementId, placementsByViewId, viewsByAppId };
}
