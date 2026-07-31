import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useGetWorkbenchQuery, useReplaceWorkbenchMutation } from "../api/client";
import { startWorkbenchStream } from "../api/workbenchStream";
import type { RootState } from "../store";
import type { Node, ViewId } from "../store/layout";
import { remoteWorkbenchLoaded } from "../store/remote";
import { WORK_STAGE_ID } from "../store/stages";
import {
  assertRemoteDocumentNamespace,
  decodeRemoteWorkbench,
  encodeRemoteWorkbench,
  workbenchDocumentJSON,
} from "../remote/codec";
import type { RemoteWorkbenchState, WorkbenchPersistence } from "../remote/types";

export type { WorkbenchPersistence };

export interface RemoteConflict {
  detail: string;
  expectedRevision: bigint;
  currentRevision: bigint | null;
}

export interface RemoteWorkbenchController {
  loading: boolean;
  ready: boolean;
  dirty: boolean;
  saving: boolean;
  revision: bigint | null;
  error: string | null;
  conflict: RemoteConflict | null;
  reload: () => void;
  retry: () => void;
}

interface RemoteIdentity {
  id: string;
  name: string;
}

export function useRemoteWorkbench(workbenchId: string): RemoteWorkbenchController {
  const dispatch = useDispatch();
  const layout = useSelector((state: RootState) => state.layout);
  const world = useSelector((state: RootState) => state.world);
  const query = useGetWorkbenchQuery(workbenchId);
  const [replace] = useReplaceWorkbenchMutation();
  const [identity, setIdentity] = useState<RemoteIdentity | null>(null);
  const [revision, setRevision] = useState<bigint | null>(null);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState<RemoteConflict | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryGeneration, setRetryGeneration] = useState(0);
  const appliedFingerprint = useRef<string | null>(null);
  const managedViewIds = useRef(new Set<string>());
  const managedDocumentIds = useRef(new Set<string>());
  const revisionRef = useRef(0n);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const failedFingerprint = useRef<string | null>(null);
  const pendingRequest = useRef<{ fingerprint: string; id: string } | null>(null);
  const deferredRevision = useRef<bigint | null>(null);
  const activeWorkbenchId = useRef(workbenchId);

  // Update the request epoch during render so callbacks from an older
  // workbench cannot publish results before the reset effect runs.
  activeWorkbenchId.current = workbenchId;

  useEffect(() => {
    appliedFingerprint.current = null;
    managedViewIds.current = new Set();
    managedDocumentIds.current = new Set();
    revisionRef.current = 0n;
    dirtyRef.current = false;
    savingRef.current = false;
    failedFingerprint.current = null;
    pendingRequest.current = null;
    deferredRevision.current = null;
    setIdentity(null);
    setRevision(null);
    setSaving(false);
    setConflict(null);
    setError(null);
    setRetryGeneration(0);
  }, [workbenchId]);

  useEffect(() => {
    const resource = query.currentData;
    if (!resource?.workbench) {
      if (query.isSuccess)
        setError("The server returned a workbench response without a workbench.");
      return;
    }
    if (resource.workbench.id !== workbenchId) {
      setError(
        `The server returned workbench ${resource.workbench.id} while ${workbenchId} was requested.`,
      );
      return;
    }
    const incomingRevision = BigInt(resource.revision);
    if (
      identity?.id === workbenchId &&
      revision !== null &&
      incomingRevision <= revisionRef.current
    ) {
      return;
    }
    if (savingRef.current) {
      deferredRevision.current =
        deferredRevision.current === null || incomingRevision > deferredRevision.current
          ? incomingRevision
          : deferredRevision.current;
      return;
    }
    if (dirtyRef.current) {
      setConflict({
        detail: `Revision ${incomingRevision.toString()} arrived while this browser had unsaved changes.`,
        expectedRevision: revisionRef.current,
        currentRevision: incomingRevision,
      });
      return;
    }
    try {
      const remote = decodeRemoteWorkbench(resource.workbench);
      const preserved = preservedLocalState(layout);
      assertRemoteDocumentNamespace(remote, preserved.documentIds);
      dispatch(
        remoteWorkbenchLoaded({
          state: remote,
          stageId: WORK_STAGE_ID,
          preserveViewIds: preserved.viewIds,
          preserveDocumentIds: preserved.documentIds,
        }),
      );
      managedViewIds.current = new Set(remote.viewOrder);
      managedDocumentIds.current = new Set(Object.keys(remote.documents));
      appliedFingerprint.current = fingerprint(remote);
      revisionRef.current = incomingRevision;
      setRevision(incomingRevision);
      setIdentity({ id: remote.id, name: remote.name });
      setConflict(null);
      setError(null);
      failedFingerprint.current = null;
      pendingRequest.current = null;
    } catch (cause) {
      setError(messageOf(cause));
    }
  }, [dispatch, identity?.id, layout, query.currentData, query.isSuccess, revision, workbenchId]);

  const current = useMemo(
    () =>
      identity
        ? currentRemoteState(
            identity,
            layout,
            world,
            managedViewIds.current,
            managedDocumentIds.current,
          )
        : null,
    [identity, layout, world],
  );
  const currentFingerprint = useMemo(() => (current ? fingerprint(current) : null), [current]);
  const dirty =
    currentFingerprint !== null &&
    appliedFingerprint.current !== null &&
    currentFingerprint !== appliedFingerprint.current;
  dirtyRef.current = dirty;

  useEffect(() => {
    if (
      !current ||
      !currentFingerprint ||
      revision === null ||
      !dirty ||
      conflict ||
      savingRef.current ||
      failedFingerprint.current === currentFingerprint
    ) {
      return;
    }
    const timer = setTimeout(async () => {
      const requestWorkbenchId = workbenchId;
      const document = encodeRemoteWorkbench(current);
      const request =
        pendingRequest.current?.fingerprint === currentFingerprint
          ? pendingRequest.current
          : { fingerprint: currentFingerprint, id: crypto.randomUUID() };
      pendingRequest.current = request;
      savingRef.current = true;
      setSaving(true);
      setError(null);
      try {
        const resource = await replace({
          id: requestWorkbenchId,
          revision: revision.toString(),
          requestId: request.id,
          document,
        }).unwrap();
        if (activeWorkbenchId.current !== requestWorkbenchId) return;
        appliedFingerprint.current = currentFingerprint;
        const savedRevision = BigInt(resource.revision);
        revisionRef.current = savedRevision;
        setRevision(savedRevision);
        pendingRequest.current = null;
        failedFingerprint.current = null;
        const deferred = deferredRevision.current;
        deferredRevision.current = null;
        if (deferred !== null && deferred > savedRevision) {
          setConflict({
            detail: `Revision ${deferred.toString()} followed this browser's saved revision.`,
            expectedRevision: savedRevision,
            currentRevision: deferred,
          });
        } else {
          setConflict(null);
        }
      } catch (cause) {
        if (activeWorkbenchId.current !== requestWorkbenchId) return;
        const parsed = conflictOf(cause, revision);
        if (parsed) setConflict(parsed);
        else {
          failedFingerprint.current = currentFingerprint;
          setError(messageOf(cause));
        }
      } finally {
        if (activeWorkbenchId.current === requestWorkbenchId) {
          savingRef.current = false;
          setSaving(false);
        }
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [
    conflict,
    current,
    currentFingerprint,
    dirty,
    replace,
    retryGeneration,
    revision,
    workbenchId,
  ]);

  useEffect(() => {
    if (revision === null) return;
    return startWorkbenchStream({
      workbenchId,
      getAfter: () => revisionRef.current,
      onRevision: (incoming) => {
        if (incoming <= revisionRef.current) return;
        if (savingRef.current) {
          deferredRevision.current =
            deferredRevision.current === null || incoming > deferredRevision.current
              ? incoming
              : deferredRevision.current;
          return;
        }
        if (dirtyRef.current) {
          setConflict({
            detail: `A newer revision (${incoming.toString()}) is available while this browser has unsaved changes.`,
            expectedRevision: revisionRef.current,
            currentRevision: incoming,
          });
          return;
        }
        void query.refetch();
      },
      onError: (cause) => setError(cause.message),
    });
  }, [query.refetch, revision, workbenchId]);

  const reload = useCallback(() => {
    setConflict(null);
    setError(null);
    failedFingerprint.current = null;
    pendingRequest.current = null;
    // Allow the current query result to be applied again even if its revision
    // matches the controller's previous value.
    setRevision(null);
    void query.refetch();
  }, [query.refetch]);

  const retry = useCallback(() => {
    failedFingerprint.current = null;
    setError(null);
    if (identity === null) {
      void query.refetch();
      return;
    }
    setRetryGeneration((value) => value + 1);
  }, [identity, query.refetch]);

  return {
    loading: query.isLoading && identity === null,
    ready: identity !== null,
    dirty,
    saving,
    revision,
    error: error ?? (query.error ? messageOf(query.error) : null),
    conflict,
    reload,
    retry,
  };
}

function currentRemoteState(
  identity: RemoteIdentity,
  layout: RootState["layout"],
  world: RootState["world"],
  managedViews: Set<string>,
  managedDocuments: Set<string>,
): RemoteWorkbenchState {
  const workspaces = layout.spaces
    .filter((space) => space.stageId === WORK_STAGE_ID)
    .map(({ id, name, tree }) => ({ id, name, tree }));
  for (const workspace of workspaces) collectViewIds(workspace.tree, managedViews);

  const views: RemoteWorkbenchState["views"] = {};
  const viewOrder: string[] = [];
  for (const id of layout.viewOrder) {
    const view = layout.views[id];
    if (!managedViews.has(id) || !view) continue;
    views[id] = view;
    viewOrder.push(id);
    for (const documentId of Object.values(view.documents)) managedDocuments.add(documentId);
  }

  const documents: RemoteWorkbenchState["documents"] = {};
  for (const id of world.docOrder) {
    const document = world.docs[id];
    if (managedDocuments.has(id) && document) documents[id] = document;
  }
  return { ...identity, workspaces, views, viewOrder, documents };
}

function preservedLocalState(layout: RootState["layout"]): {
  viewIds: string[];
  documentIds: string[];
} {
  const viewIds = new Set<string>();
  for (const space of layout.spaces) {
    if (space.stageId !== WORK_STAGE_ID) collectViewIds(space.tree, viewIds);
  }
  const documentIds = new Set<string>();
  for (const id of viewIds) {
    const view = layout.views[id];
    if (!view) continue;
    for (const documentId of Object.values(view.documents)) documentIds.add(documentId);
  }
  return { viewIds: [...viewIds], documentIds: [...documentIds] };
}

function collectViewIds(node: Node, target: Set<ViewId>): void {
  if (node.type === "leaf") {
    target.add(node.viewId);
    return;
  }
  collectViewIds(node.a, target);
  collectViewIds(node.b, target);
}

function fingerprint(state: RemoteWorkbenchState): string {
  return JSON.stringify(workbenchDocumentJSON(encodeRemoteWorkbench(state)));
}

function conflictOf(cause: unknown, expected: bigint): RemoteConflict | null {
  if (!cause || typeof cause !== "object") return null;
  const candidate = cause as {
    status?: unknown;
    data?: {
      detail?: unknown;
      expectedRevision?: unknown;
      currentRevision?: unknown;
    };
  };
  if (candidate.status !== 409 || !candidate.data) return null;
  return {
    detail:
      typeof candidate.data.detail === "string"
        ? candidate.data.detail
        : "The workbench changed before this browser could save.",
    expectedRevision: decimalBigInt(candidate.data.expectedRevision) ?? expected,
    currentRevision: decimalBigInt(candidate.data.currentRevision),
  };
}

function decimalBigInt(value: unknown): bigint | null {
  if (typeof value !== "string" || !/^[0-9]+$/.test(value)) return null;
  return BigInt(value);
}

function messageOf(cause: unknown): string {
  if (cause instanceof Error) return cause.message;
  if (cause && typeof cause === "object") {
    const candidate = cause as { error?: unknown; data?: { detail?: unknown } };
    if (typeof candidate.data?.detail === "string") return candidate.data.detail;
    if (typeof candidate.error === "string") return candidate.error;
  }
  return String(cause);
}
