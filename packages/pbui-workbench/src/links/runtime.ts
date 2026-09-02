import { useSyncExternalStore } from "react";
import type { PortId, SerializableReference } from "@hyperslop-systems/pbui";

/**
 * The link runtime (design §6.4): the VALUES that are not persisted — what
 * each out port last emitted, what each context cell holds, and the last
 * value PRESENTED as attended per port (toy pattern 8, for Pin). Keyed by
 * view id through the port id, like the sandbox's program state, so two
 * linked placements read one cell. A reload re-derives everything from what
 * tiles emit; only Hold/Constant capture values, and those live in the
 * document as terms.
 *
 * A `useSyncExternalStore` store: `getState()` returns a cached snapshot
 * refreshed on each change, `revision` bumps on every write so consumers
 * re-evaluate lazily (pull evaluation, D5).
 */
export interface LinkRuntimeState {
  readonly revision: number;
  readonly emitted: ReadonlyMap<PortId, SerializableReference>;
  readonly contexts: ReadonlyMap<string, SerializableReference | null>;
  readonly attended: ReadonlyMap<PortId, SerializableReference>;
}

export interface EmitOptions {
  /** Record the value as attended (hovered, focused) rather than selected. */
  attended?: boolean;
  /** Contexts this emission drives, from the port's declaration. */
  drives?: readonly string[];
}

export interface LinkRuntime {
  getState(): LinkRuntimeState;
  subscribe(listener: () => void): () => void;
  /** An OUT/INOUT port presents a value. */
  emit(port: PortId, reference: SerializableReference, options?: EmitOptions): void;
  setContext(key: string, reference: SerializableReference | null): void;
  /** Forget everything a view emitted or attended (it was closed or replaced). */
  forgetView(viewId: string): void;
  /** The out port whose ATTENDED or emitted value equals this reference — the provenance of a presentation the user is pointing at. */
  sourceOf(reference: SerializableReference): PortId | null;
}

export function createLinkRuntime(): LinkRuntime {
  let state: LinkRuntimeState = { revision: 0, emitted: new Map(), contexts: new Map(), attended: new Map() };
  const listeners = new Set<() => void>();
  const commit = (next: Omit<LinkRuntimeState, "revision">) => {
    state = { ...next, revision: state.revision + 1 };
    for (const listener of listeners) listener();
  };
  const same = (a: SerializableReference | null | undefined, b: SerializableReference | null | undefined) =>
    a === b || (a && b && a.type === b.type && JSON.stringify(a.value) === JSON.stringify(b.value));

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    emit(port, reference, options = {}) {
      const attended = new Map(state.attended);
      const emitted = new Map(state.emitted);
      const contexts = new Map(state.contexts);
      let changed = false;
      if (options.attended) {
        if (!same(attended.get(port), reference)) {
          attended.set(port, reference);
          changed = true;
        }
      } else {
        if (!same(emitted.get(port), reference)) {
          emitted.set(port, reference);
          changed = true;
        }
        // Presenting a value is also attending it: a click after a hover
        // leaves the same value in both cells.
        if (!same(attended.get(port), reference)) {
          attended.set(port, reference);
          changed = true;
        }
        for (const key of options.drives ?? []) {
          if (!same(contexts.get(key), reference)) {
            contexts.set(key, reference);
            changed = true;
          }
        }
      }
      if (changed) commit({ emitted, contexts, attended });
    },
    setContext(key, reference) {
      if (same(state.contexts.get(key), reference) && state.contexts.has(key)) return;
      const contexts = new Map(state.contexts);
      contexts.set(key, reference);
      commit({ emitted: state.emitted, contexts, attended: state.attended });
    },
    forgetView(viewId) {
      const prefix = `${viewId}/`;
      const emitted = new Map([...state.emitted].filter(([port]) => !port.startsWith(prefix)));
      const attended = new Map([...state.attended].filter(([port]) => !port.startsWith(prefix)));
      if (emitted.size === state.emitted.size && attended.size === state.attended.size) return;
      commit({ emitted, contexts: state.contexts, attended });
    },
    sourceOf(reference) {
      for (const [port, value] of state.attended) if (same(value, reference)) return port;
      for (const [port, value] of state.emitted) if (same(value, reference)) return port;
      return null;
    },
  };
}

export function useLinkRuntime(runtime: LinkRuntime): LinkRuntimeState {
  return useSyncExternalStore(runtime.subscribe, runtime.getState, runtime.getState);
}
