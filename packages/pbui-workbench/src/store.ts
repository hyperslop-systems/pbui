import { useSyncExternalStore } from "react";
import type { Mutation, WorkbenchDocument } from "@hyperslop-systems/workbench-protocol";
import { applyMutations, MutationError } from "@hyperslop-systems/workbench-protocol/client";

/**
 * Everything the shell holds outside the document: which tile a keyboard
 * operation targets, and whether the launcher is open. Neither belongs in
 * the document — they are this browser's, not the layout's — and neither is
 * serialised.
 */
export interface WorkbenchState {
  document: WorkbenchDocument;
  /** The workspace the Surface renders; the first one until a product switches. */
  workspaceId: string;
  /** The tile a global operation (the launcher's "place") acts on. */
  activePlacementId: string | null;
  launcherOpen: boolean;
  /**
   * The tile the launcher was invoked FROM, when it was invoked per-pane
   * ("show something else in THIS tile"). Null means the global invocation,
   * whose rows place a new tile instead of replacing one. Two modes, one
   * dialog: the rows model reads this and changes what choosing means.
   */
  launcherFrom: string | null;
  /**
   * The rebalance dialog is open (PBUI-REBALANCE-1). Browser-local for the
   * same reason `launcherOpen` is: which transient surface is showing is this
   * browser's business, never the layout's, and is not serialised.
   */
  rebalanceOpen: boolean;
}

/**
 * What a product may observe about the document without owning the store.
 *
 * `onMutate` fires once per COMMITTED batch, after the new document is in
 * state, and is what a product's outbox or persistence layer subscribes to —
 * a store subscription would also fire for activation and launcher toggles,
 * which are this browser's business and must never reach a server.
 *
 * `onRejected` replaces the default `console.warn` for a batch the applier
 * refused. It exists because the caller otherwise learns only `false`: the
 * `MutationError`'s `code`/`path`/`detail` are the only actionable thing, and
 * an agent-facing caller has to hand them back to whoever proposed the batch.
 */
export interface WorkbenchStoreOptions {
  onMutate?(mutations: Mutation[], next: WorkbenchDocument): void;
  onRejected?(mutations: Mutation[], error: MutationError): void;
  /**
   * A post-commit hook failed after the document was already installed.
   * This is deliberately separate from `onRejected`: retrying this batch
   * would duplicate a change that did commit.
   */
  onPostCommitError?(error: unknown, mutations: Mutation[], next: WorkbenchDocument): void;
}

/**
 * A `useSyncExternalStore` store rather than Redux or context: the verbs are
 * plain code a router can call before React exists, and a product's own
 * components read it with a selector.
 *
 * A product that already owns its document — a Redux slice, a server-backed
 * controller — implements this interface as an adapter and passes it to
 * `createWorkbench({ store })` rather than mirroring state into a second
 * source of truth. `getState` must return a CACHED snapshot refreshed on each
 * upstream notification; a fresh object per call makes `useSyncExternalStore`
 * loop forever.
 */
export interface WorkbenchStore {
  getState(): WorkbenchState;
  subscribe(listener: () => void): () => void;
  setState(patch: Partial<WorkbenchState> | ((state: WorkbenchState) => Partial<WorkbenchState>)): void;
  /**
   * Apply a batch atomically: either every mutation lands or the document is
   * untouched. A batch the applier refuses is dropped with a warning — the
   * same policy a server-backed client follows before sending — and the
   * return value says which happened.
   */
  mutate(mutations: Mutation[]): boolean;
  /** Replace the document wholesale (restore, reset). */
  replaceDocument(document: WorkbenchDocument): void;
}

export function createWorkbenchStore(
  initial: WorkbenchDocument,
  options: WorkbenchStoreOptions = {},
): WorkbenchStore {
  let state: WorkbenchState = {
    document: initial,
    workspaceId: initial.workspaces[0]?.id ?? "",
    activePlacementId: null,
    launcherOpen: false,
    launcherFrom: null,
    rebalanceOpen: false,
  };
  const listeners = new Set<() => void>();
  const emit = () => {
    for (const listener of listeners) listener();
  };

  const setState: WorkbenchStore["setState"] = (patch) => {
    const next = typeof patch === "function" ? patch(state) : patch;
    state = { ...state, ...next };
    emit();
  };

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setState,
    mutate(mutations) {
      if (mutations.length === 0) return false;
      let document: WorkbenchDocument;
      try {
        document = applyMutations(state.document, mutations);
      } catch (error) {
        if (error instanceof MutationError) {
          if (options.onRejected) options.onRejected(mutations, error);
          else console.warn(`pbui-workbench: dropped a mutation batch — ${error.message}`);
          return false;
        }
        throw error;
      }

      setState({ document });
      // A persistence/outbox hook runs after commit. Its failure must never
      // turn a committed batch into `false` or throw through the caller: an
      // agent would retry and duplicate work that is already visible.
      try {
        options.onMutate?.(mutations, document);
      } catch (error) {
        try {
          if (options.onPostCommitError) options.onPostCommitError(error, mutations, document);
          else console.error("pbui-workbench: post-commit hook failed", error);
        } catch (reportingError) {
          console.error("pbui-workbench: post-commit error handler failed", reportingError);
        }
      }
      return true;
    },
    replaceDocument(document) {
      setState((current) => ({
        document,
        workspaceId: document.workspaces.some((w) => w.id === current.workspaceId)
          ? current.workspaceId
          : (document.workspaces[0]?.id ?? ""),
        activePlacementId: null,
      }));
    },
  };
}

export function useWorkbenchStore<T>(store: WorkbenchStore, selector: (state: WorkbenchState) => T): T {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(store.getState()),
  );
}
