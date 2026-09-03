import { useSyncExternalStore } from "react";
import type { PortId, RuntimeEffect, SerializableReference } from "@hyperslop-systems/pbui";

/**
 * The link runtime (design §6.4): the VALUES that are not persisted — what
 * each out port last emitted, what each context cell holds, what each
 * identity class's shared cell holds (Phase 5), and the last value PRESENTED
 * as attended per port (toy pattern 8, for Pin). Keyed by view id through
 * the port id, like the sandbox's program state, so two linked placements
 * read one cell. A reload re-derives everything from what tiles emit; only
 * Hold/Constant capture values, and those live in the document as terms.
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
  readonly classes: ReadonlyMap<string, SerializableReference | null>;
}

export interface EmitOptions {
  /** Record the value as attended (hovered, focused) rather than selected. */
  attended?: boolean;
  /** Contexts this emission drives, from the port's declaration. */
  drives?: readonly string[];
  /** The identity class the port belongs to: the emission goes to the shared cell. */
  classId?: string;
}

export interface LinkRuntime {
  getState(): LinkRuntimeState;
  subscribe(listener: () => void): () => void;
  /** An OUT/INOUT port presents a value. */
  emit(port: PortId, reference: SerializableReference, options?: EmitOptions): void;
  setContext(key: string, reference: SerializableReference | null): void;
  setClass(classId: string, reference: SerializableReference | null): void;
  /** Apply the kernel's effects after a state change (merge seeds, split restores). */
  apply(effects: readonly RuntimeEffect[]): void;
  /** Forget everything a view emitted or attended (it was closed or replaced). */
  forgetView(viewId: string): void;
  /** The out port whose ATTENDED or emitted value equals this reference — the provenance of a presentation the user is pointing at. */
  sourceOf(reference: SerializableReference): PortId | null;
}

export function createLinkRuntime(): LinkRuntime {
  let state: LinkRuntimeState = { revision: 0, emitted: new Map(), contexts: new Map(), attended: new Map(), classes: new Map() };
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
      const classes = new Map(state.classes);
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
        if (options.classId && !same(classes.get(options.classId), reference)) {
          classes.set(options.classId, reference);
          changed = true;
        }
      }
      if (changed) commit({ emitted, contexts, attended, classes });
    },
    setContext(key, reference) {
      if (same(state.contexts.get(key), reference) && state.contexts.has(key)) return;
      const contexts = new Map(state.contexts);
      contexts.set(key, reference);
      commit({ ...state, contexts });
    },
    setClass(classId, reference) {
      if (same(state.classes.get(classId), reference) && state.classes.has(classId)) return;
      const classes = new Map(state.classes);
      classes.set(classId, reference);
      commit({ ...state, classes });
    },
    apply(effects) {
      if (effects.length === 0) return;
      const emitted = new Map(state.emitted);
      const classes = new Map(state.classes);
      for (const effect of effects) {
        if (effect.kind === "seed-class") classes.set(effect.classId, effect.reference);
        else if (effect.kind === "forget-class") classes.delete(effect.classId);
        else if (effect.kind === "set-emitted") {
          if (effect.reference) emitted.set(effect.port, effect.reference);
          else emitted.delete(effect.port);
        }
      }
      commit({ ...state, emitted, classes });
    },
    forgetView(viewId) {
      const prefix = `${viewId}/`;
      const emitted = new Map([...state.emitted].filter(([port]) => !port.startsWith(prefix)));
      const attended = new Map([...state.attended].filter(([port]) => !port.startsWith(prefix)));
      if (emitted.size === state.emitted.size && attended.size === state.attended.size) return;
      commit({ ...state, emitted, attended });
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
