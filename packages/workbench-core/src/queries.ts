import type { Node, WorkbenchDocument } from "@hyperslop-systems/workbench-protocol";
import { leaves } from "@hyperslop-systems/workbench-protocol/client";
import type { WorkbenchIndex } from "./graph";

/*
 * The on-demand half of the structural-index decision (S13): questions
 * asked by a few commands, answered by one scan each, in ONE place. A command
 * that walks the document itself for any of these is a bug.
 */

/** Every view binding that references a document, in `viewOrder`. */
export interface ViewBindingRef {
  readonly viewId: string;
  readonly slot: string;
}

export function viewsUsingDocument(doc: WorkbenchDocument, documentId: string): ViewBindingRef[] {
  const out: ViewBindingRef[] = [];
  for (const viewId of doc.viewOrder) {
    const view = doc.views[viewId];
    if (!view) continue;
    for (const [slot, id] of Object.entries(view.documents)) {
      if (id === documentId) out.push({ viewId, slot });
    }
  }
  return out;
}

/** Document ids whose payload declares `format`, in map order. */
export function documentsWithFormat(doc: WorkbenchDocument, format: string): string[] {
  return Object.values(doc.documents)
    .filter((payload) => payload.format === format)
    .map((payload) => payload.id);
}

/** Every view id the document declares that no workspace places, in `viewOrder`. */
export function orphanViewIds(doc: WorkbenchDocument, index: WorkbenchIndex): string[] {
  return doc.viewOrder.filter((viewId) => !index.placementsByViewId.has(viewId));
}

/** How many tiles show this view, across every workspace. */
export function placementCount(index: WorkbenchIndex, viewId: string): number {
  return index.placementsByViewId.get(viewId)?.length ?? 0;
}

/** The first placement of a view — in `workspaceId` when given, else anywhere. */
export function firstPlacementOfView(index: WorkbenchIndex, viewId: string, workspaceId?: string): string | null {
  const refs = index.placementsByViewId.get(viewId) ?? [];
  const hit = workspaceId === undefined ? refs[0] : refs.find((ref) => ref.workspaceId === workspaceId);
  return hit?.placementId ?? null;
}

/** The first workspace that places the view, anywhere in the doc. */
export function workspaceOfView(index: WorkbenchIndex, viewId: string): string | null {
  return index.placementsByViewId.get(viewId)?.[0]?.workspaceId ?? null;
}

/** Is the node a placement (a leaf) at all? */
export function isPlacement(index: WorkbenchIndex, placementId: string): boolean {
  return index.viewByPlacementId.has(placementId);
}

/** The leaves of one workspace, in reading order. */
export function leavesOfWorkspace(index: WorkbenchIndex, workspaceId: string): Node[] {
  return leaves(index.workspaceById.get(workspaceId)?.tree);
}

/** A placement can close when its workspace keeps at least one other tile. */
export function canClose(index: WorkbenchIndex, placementId: string): boolean {
  const workspaceId = index.workspaceByNodeId.get(placementId);
  if (!workspaceId || !index.viewByPlacementId.has(placementId)) return false;
  return leavesOfWorkspace(index, workspaceId).length > 1;
}

/** Two binding maps name the same documents under the same slots. */
export function sameBindings(a: Readonly<Record<string, string>>, b: Readonly<Record<string, string>>): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  return keysA.length === keysB.length && keysA.every((key) => a[key] === b[key]);
}
