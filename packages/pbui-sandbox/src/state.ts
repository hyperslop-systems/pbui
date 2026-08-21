import { useSyncExternalStore } from "react";

/**
 * Program state, owned by the host and keyed by VIEW id — not placement id —
 * so two linked placements of one view show one state, the same invariant
 * `AppProps` documents for every workbench application. Not persisted
 * (guide D11): a reload restarts every program at its `initialState`.
 */
export interface ProgramStateStore {
  get(viewId: string): unknown;
  has(viewId: string): boolean;
  set(viewId: string, next: unknown): void;
  reset(viewId: string): void;
  subscribe(listener: () => void): () => void;
}

export function createProgramStateStore(): ProgramStateStore {
  const states = new Map<string, unknown>();
  const listeners = new Set<() => void>();
  const emit = () => {
    for (const listener of listeners) listener();
  };
  return {
    get: (viewId) => states.get(viewId),
    has: (viewId) => states.has(viewId),
    set(viewId, next) {
      states.set(viewId, next);
      emit();
    },
    reset(viewId) {
      if (!states.delete(viewId)) return;
      emit();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export function useProgramState(store: ProgramStateStore, viewId: string): unknown {
  return useSyncExternalStore(
    store.subscribe,
    () => store.get(viewId),
    () => store.get(viewId),
  );
}
