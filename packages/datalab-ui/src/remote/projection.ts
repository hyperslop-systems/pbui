import { create } from "@bufbuild/protobuf";
import {
  WorkbenchDocumentSchema,
  type AppView,
  type DocumentPayload,
  type WorkbenchDocument,
  type Workspace,
} from "@hyperslop-systems/workbench-protocol";
import { leaves } from "@hyperslop-systems/workbench-protocol/client";
import type { GraphicDocument } from "../model/graphic";
import { graphicStub } from "../store/graphicSource";
import {
  reconcileNavigation,
  type PersistedNavigation,
  type WorkspaceMeta,
} from "../store/navigation";
import { WORK_STAGE_ID } from "../store/stageIds";
import { decodeRemoteGraphics, encodeGraphicDocument } from "./codec";
import type { RemoteIdentity } from "./types";
import { WORKBENCH_FORMAT, WORKBENCH_SCHEMA_VERSION } from "./types";

/**
 * The remote projection: what crosses Datalab's server boundary, and how a
 * server document is taken back in (design §14, Decision 6).
 *
 * The generic workbench sync assumes the whole document is the server's.
 * Datalab's is not: only the WORK stage is remote, and the full analytical
 * documents live in the world, not in the workbench. So the projection is
 * product policy, named as such:
 *
 *   outbound  work-stage workspaces → the views they reach → the documents
 *             those views bind → full `GraphicDocument`s from the world →
 *             one wire document
 *   inbound   preserve every local workspace outside the work stage and the
 *             views and stubs it reaches; refuse a remote document id that
 *             collides with a preserved one; replace the work stage with the
 *             server's workspaces and views; split the full graphics off for
 *             the world and keep identity stubs for the workbench.
 *
 * Every function is pure over plain values, which is what lets the
 * controller in `appkit/` capture one coherent moment of core and world,
 * project it, and check nothing moved before sending (§14.2).
 */

export interface LocalWorkbench {
  document: WorkbenchDocument;
  navigation: PersistedNavigation;
  world: { docs: Readonly<Record<string, GraphicDocument>>; docOrder: readonly string[] };
}

const viewIdOf = (leaf: { body: { case?: string; value?: unknown } }): string =>
  leaf.body.case === "leaf" ? (leaf.body.value as { viewId: string }).viewId : "";

function stageOf(navigation: PersistedNavigation, workspaceId: string): string {
  return navigation.workspace[workspaceId]?.stageId ?? WORK_STAGE_ID;
}

/** The work-stage workspaces, in document order. */
export function workStageWorkspaces(local: LocalWorkbench): Workspace[] {
  return local.document.workspaces.filter(
    (workspace) => stageOf(local.navigation, workspace.id) === WORK_STAGE_ID,
  );
}

/** Views and documents that belong to LOCAL-ONLY stages: what an adoption must never touch. */
export function preservedLocalState(local: LocalWorkbench): {
  viewIds: string[];
  documentIds: string[];
} {
  const viewIds = new Set<string>();
  for (const workspace of local.document.workspaces) {
    if (stageOf(local.navigation, workspace.id) === WORK_STAGE_ID) continue;
    for (const leaf of leaves(workspace.tree)) viewIds.add(viewIdOf(leaf));
  }
  const documentIds = new Set<string>();
  for (const id of viewIds) {
    for (const documentId of Object.values(local.document.views[id]?.documents ?? {}))
      documentIds.add(documentId);
  }
  return { viewIds: [...viewIds], documentIds: [...documentIds] };
}

/** A remote document may not overwrite a document a local-only stage binds. */
export function assertRemoteDocumentNamespace(
  remote: WorkbenchDocument,
  preservedDocumentIds: Iterable<string>,
): void {
  for (const id of preservedDocumentIds) {
    if (Object.hasOwn(remote.documents, id)) {
      throw new Error(`remote document ${id} collides with a code-defined stage document`);
    }
  }
}

/**
 * The wire document for the work stage (§14.2). `managedViewIds` are views
 * the server already knows about (its last document's order); a view the
 * user linked into a work workspace since is reachable and therefore sent,
 * a managed view that fell out of every work workspace is not.
 */
export function projectWorkStage(
  local: LocalWorkbench,
  identity: RemoteIdentity,
): WorkbenchDocument {
  const workspaces = workStageWorkspaces(local);
  const reachable = new Set<string>();
  for (const workspace of workspaces)
    for (const leaf of leaves(workspace.tree)) reachable.add(viewIdOf(leaf));

  const views: Record<string, AppView> = {};
  const viewOrder: string[] = [];
  const documentIds = new Set<string>();
  for (const id of local.document.viewOrder) {
    const view = local.document.views[id];
    if (!view || !reachable.has(id)) continue;
    views[id] = view;
    viewOrder.push(id);
    for (const documentId of Object.values(view.documents)) documentIds.add(documentId);
  }

  const documents: Record<string, DocumentPayload> = {};
  for (const id of local.world.docOrder) {
    const graphic = local.world.docs[id];
    if (documentIds.has(id) && graphic) documents[id] = encodeGraphicDocument(graphic);
  }
  for (const id of documentIds) {
    if (!documents[id])
      throw new Error(`the work stage binds document ${id}, which the world does not hold`);
  }

  return create(WorkbenchDocumentSchema, {
    format: WORKBENCH_FORMAT,
    schemaVersion: WORKBENCH_SCHEMA_VERSION,
    id: identity.id,
    name: identity.name,
    workspaces,
    views,
    viewOrder,
    documents,
  });
}

export interface RemoteAdoption {
  /** The complete candidate workbench document: local-only stages preserved, the work stage replaced. */
  document: WorkbenchDocument;
  /** The full graphic documents the server sent, for the world. */
  graphics: Record<string, GraphicDocument>;
  /** Ids of world documents that belong to local-only stages and must survive the world's replacement. */
  preserveDocumentIds: string[];
  navigation: PersistedNavigation;
  /** Where to be after adoption: unchanged unless the user was in the work stage. */
  workspaceId: string;
}

/**
 * Take a server document in (§14.3). Pure: returns what to install, in the
 * order the caller must install it — world documents first, then the
 * workbench document, then navigation — and throws on a namespace
 * collision rather than adopting half.
 */
export function mergeRemoteWorkStage(
  local: LocalWorkbench,
  remote: WorkbenchDocument,
  currentWorkspaceId: string,
): RemoteAdoption {
  const preserved = preservedLocalState(local);
  assertRemoteDocumentNamespace(remote, preserved.documentIds);
  const graphics = decodeRemoteGraphics(remote);
  const preservedViews = new Set(preserved.viewIds);

  const views: Record<string, AppView> = {};
  const viewOrder: string[] = [];
  for (const id of local.document.viewOrder) {
    const view = local.document.views[id];
    if (preservedViews.has(id) && view) {
      views[id] = view;
      viewOrder.push(id);
    }
  }
  for (const id of remote.viewOrder) {
    const view = remote.views[id];
    if (!view) continue;
    views[id] = view;
    if (!viewOrder.includes(id)) viewOrder.push(id);
  }

  // Stubs: what the preserved views bind, plus one per remote document. The
  // full graphics go to the world; the workbench holds identities only.
  const documents: Record<string, DocumentPayload> = {};
  for (const id of preserved.documentIds) {
    const payload = local.document.documents[id];
    if (payload) documents[id] = payload;
  }
  for (const id of Object.keys(remote.documents)) documents[id] = graphicStub(id);

  const localOnly = local.document.workspaces.filter(
    (workspace) => stageOf(local.navigation, workspace.id) !== WORK_STAGE_ID,
  );
  const workspaces = [...localOnly, ...remote.workspaces];

  const document = create(WorkbenchDocumentSchema, {
    format: local.document.format,
    schemaVersion: local.document.schemaVersion,
    id: local.document.id,
    name: local.document.name,
    workspaces,
    views,
    viewOrder,
    documents,
  });

  // Navigation: every remote workspace is the work stage's; the old work
  // workspaces are forgotten; memory survives where the workspace does.
  const workspaceMeta: Record<string, WorkspaceMeta> = {};
  for (const workspace of localOnly) {
    workspaceMeta[workspace.id] = local.navigation.workspace[workspace.id] ?? {
      stageId: WORK_STAGE_ID,
      pinned: false,
      apps: null,
    };
  }
  for (const workspace of remote.workspaces) {
    workspaceMeta[workspace.id] = { stageId: WORK_STAGE_ID, pinned: false, apps: null };
  }
  const navigation = reconcileNavigation(
    {
      stages: local.navigation.stages,
      workspace: workspaceMeta,
      rememberedWorkspaceByStage: { ...local.navigation.rememberedWorkspaceByStage },
    },
    workspaces.map((workspace) => workspace.id),
  );

  const wasInWork = stageOf(local.navigation, currentWorkspaceId) === WORK_STAGE_ID;
  const workspaceId = wasInWork
    ? (navigation.rememberedWorkspaceByStage[WORK_STAGE_ID] ??
      remote.workspaces[0]?.id ??
      currentWorkspaceId)
    : currentWorkspaceId;

  return {
    document,
    graphics,
    preserveDocumentIds: preserved.documentIds,
    navigation,
    workspaceId,
  };
}
