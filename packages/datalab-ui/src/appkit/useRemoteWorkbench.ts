import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useGetWorkbenchQuery, useReplaceWorkbenchMutation } from "../api/client";
import { startWorkbenchStream } from "../api/workbenchStream";
import type { RootState } from "../store";
import { navigationActions } from "../store/navigation";
import { remoteWorkbenchLoaded } from "../store/remote";
import {
  assertRemoteEnvelope,
  parseRemoteWorkbenchJSON,
  workbenchDocumentJSON,
} from "../remote/codec";
import { mergeRemoteWorkStage, projectWorkStage, type LocalWorkbench } from "../remote/projection";
import type { RemoteIdentity, WorkbenchPersistence } from "../remote/types";
import { useCurrentWorkspaceId, useDatalabWorkbench } from "./DatalabWorkbenchContext";

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

/**
 * The remote controller: HTTP revision, conflict and stream policy over the
 * work-stage projection (design §14.1, Decision 6).
 *
 * The projection (`remote/projection.ts`) is pure; this owns the moments.
 * Outbound, a coherent capture of the core's document, the navigation
 * metadata and the world is projected to one wire document, fingerprinted,
 * and sent after a debounce. Inbound, a server document is merged into a
 * complete candidate, checked against the catalog, and installed in three
 * steps in dependency order — world documents, then the core, then
 * navigation — so no tile ever observes a view whose document is missing.
 *
 * Conflicts stay visible: a newer revision arriving while this browser has
 * unsaved changes is reported, never silently rebased (§14.4).
 */
export function useRemoteWorkbench(workbenchId: string): RemoteWorkbenchController {
  const dispatch = useDispatch();
  const workbench = useDatalabWorkbench();
  const document = workbench.shell.useDocument();
  const currentWorkspaceId = useCurrentWorkspaceId();
  const navigation = useSelector((state: RootState) => state.navigation);
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

  const local = useMemo<LocalWorkbench>(
    () => ({ document, navigation, world: { docs: world.docs, docOrder: world.docOrder } }),
    [document, navigation, world.docs, world.docOrder],
  );

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
      const remote = parseRemoteWorkbenchJSON(resource.workbench);
      assertRemoteEnvelope(remote);
      // One coherent capture of the core and the store, not the render's copy:
      // the merge must see the state the install will replace.
      const coreState = workbench.core.getState();
      const state = workbench.store.getState();
      const adoption = mergeRemoteWorkStage(
        { document: coreState.document, navigation: state.navigation, world: state.world },
        remote,
        coreState.session.workspaceId,
      );
      // Validate the candidate BEFORE touching the world: a refusal leaves
      // every store as it was.
      const checked = workbench.core.validateDocument(adoption.document);
      if (!checked.ok) {
        const first = checked.diagnostics[0];
        throw new Error(
          `the server workbench does not fit this build: ${first?.code}${first?.path ? ` at ${first.path}` : ""}: ${first?.detail}`,
        );
      }
      // World documents first, so a view that arrives with the core's install
      // never references a document the world lacks (§14.3).
      dispatch(
        remoteWorkbenchLoaded({
          documents: adoption.graphics,
          preserveDocumentIds: adoption.preserveDocumentIds,
        }),
      );
      dispatch(navigationActions.replaceNavigation(adoption.navigation));
      const installed = workbench.core.replaceDocument(adoption.document, {
        session: { workspaceId: adoption.workspaceId },
      });
      if (!installed.ok) {
        const first = installed.diagnostics[0];
        throw new Error(
          `the server workbench could not be installed: ${first?.code}: ${first?.detail}`,
        );
      }
      const remoteIdentity: RemoteIdentity = { id: remote.id, name: remote.name };
      appliedFingerprint.current = fingerprint(
        projectWorkStage(
          {
            document: workbench.core.getState().document,
            navigation: workbench.store.getState().navigation,
            world: workbench.store.getState().world,
          },
          remoteIdentity,
        ),
      );
      revisionRef.current = incomingRevision;
      setRevision(incomingRevision);
      setIdentity(remoteIdentity);
      setConflict(null);
      setError(null);
      failedFingerprint.current = null;
      pendingRequest.current = null;
    } catch (cause) {
      setError(messageOf(cause));
    }
  }, [
    dispatch,
    identity?.id,
    query.currentData,
    query.isSuccess,
    revision,
    workbenchId,
    workbench,
  ]);

  const current = useMemo(() => {
    if (!identity) return null;
    try {
      return projectWorkStage(local, identity);
    } catch {
      // The work stage binds a document the world has not received yet (a
      // remote adoption mid-flight); nothing coherent to send this render.
      return null;
    }
  }, [identity, local]);
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
          document: current,
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

  // The selected workspace is part of the capture that decides "dirty" only
  // through the document; it is read here so the memo above stays honest
  // about what the user is looking at without adding it to the wire.
  void currentWorkspaceId;

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

function fingerprint(document: Parameters<typeof workbenchDocumentJSON>[0]): string {
  return JSON.stringify(workbenchDocumentJSON(document));
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
