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
}

/**
 * A `useSyncExternalStore` store rather than Redux or context: the verbs are
 * plain code a router can call before React exists, and a product's own
 * components read it with a selector.
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

export function createWorkbenchStore(initial: WorkbenchDocument): WorkbenchStore {
  let state: WorkbenchState = {
    document: initial,
    workspaceId: initial.workspaces[0]?.id ?? "",
    activePlacementId: null,
    launcherOpen: false,
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
      try {
        const document = applyMutations(state.document, mutations);
        setState({ document });
        return true;
      } catch (error) {
        if (error instanceof MutationError) {
          console.warn(`pbui-workbench: dropped a mutation batch — ${error.message}`);
          return false;
        }
        throw error;
      }
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
