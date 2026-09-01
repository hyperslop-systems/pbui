import { useSyncExternalStore } from "react";

/**
 * The editor's live text, keyed by script id.
 *
 * Kept OUTSIDE the workbench document on purpose: a keystroke is not a
 * document mutation. The document holds the last source that was run
 * (`PlotScriptDoc.source`), written by the runner at the same moment the plot
 * re-renders; the draft is what the editor shows between runs. Two script
 * tiles linked to one document read one draft, so they stay in lockstep
 * exactly as two placements of one view do.
 *
 * `getState` returns a cached snapshot per id; `useSyncExternalStore` loops
 * forever on a fresh object per call.
 */
export interface DraftStore {
  get(id: string): string | undefined;
  set(id: string, source: string): void;
  /** Seed a draft only if none exists — the document's source on first open. */
  seed(id: string, source: string): void;
  forget(id: string): void;
  subscribe(listener: () => void): () => void;
}

export function createDraftStore(): DraftStore {
  const drafts = new Map<string, string>();
  const listeners = new Set<() => void>();
  const emit = () => {
    for (const listener of listeners) listener();
  };
  return {
    get: (id) => drafts.get(id),
    set(id, source) {
      if (drafts.get(id) === source) return;
      drafts.set(id, source);
      emit();
    },
    seed(id, source) {
      if (drafts.has(id)) return;
      drafts.set(id, source);
      emit();
    },
    forget(id) {
      if (drafts.delete(id)) emit();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export function useDraft(store: DraftStore, id: string): string | undefined {
  return useSyncExternalStore(
    store.subscribe,
    () => store.get(id),
    () => store.get(id),
  );
}
