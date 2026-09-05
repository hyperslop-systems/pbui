import type { WorkbenchDocument } from "@hyperslop-systems/workbench-protocol";
import type { WorkbenchIndex } from "./graph";

/**
 * Semantic session state (guide §14.2): the two pointers this browser holds
 * outside the document and that commands may read. Nothing about dialogs,
 * modes, or focus — those are the shell's.
 */
export interface WorkbenchSession {
  /** The workspace being rendered/acted on; always an existing workspace. */
  readonly workspaceId: string;
  /** The placement global operations aim at; always a leaf of `workspaceId`, or null. */
  readonly activePlacementId: string | null;
}

/**
 * Make a session true for a document: the selected workspace must exist
 * (else the first), the active placement must be a leaf of it (else null).
 * Runs after every install so no observer ever sees a dangling pointer.
 */
export function repairSession(session: WorkbenchSession, doc: WorkbenchDocument, index: WorkbenchIndex): WorkbenchSession {
  const workspaceId = index.workspaceById.has(session.workspaceId) ? session.workspaceId : (doc.workspaces[0]?.id ?? "");
  const active = session.activePlacementId;
  const activePlacementId = active && index.viewByPlacementId.has(active) && index.workspaceByNodeId.get(active) === workspaceId ? active : null;
  if (workspaceId === session.workspaceId && activePlacementId === session.activePlacementId) return session;
  return { workspaceId, activePlacementId };
}
