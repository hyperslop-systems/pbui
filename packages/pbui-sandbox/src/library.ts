import { useSyncExternalStore } from "react";
import type { VerbLike } from "./contracts";
import { DEFAULT_LIMITS, byteLength, type SandboxLimits } from "./limits";

/**
 * The program library: every program and every generated action the agent
 * (or a human) has made, persisted apart from the layout (guide D5). Tiles
 * reference programs by id through `view.documents.program`; actions are
 * appended to type menus by `withGeneratedActions`.
 */

export interface ProgramRecord {
  id: string;
  title: string;
  /** The definePlugin source, verbatim. */
  source: string;
  /** Bumped on every update; part of the instance id, so an update is a fresh load. */
  version: number;
  /** Binding keys the program wants resolved, from its `bindings` or the tool's argument. */
  bindings: string[];
  meta: { declaredId?: string; widgets: string[] };
  by: "agent" | "human";
  pinned: boolean;
  lastError?: { phase: "load" | "render" | "event"; message: string; at: string };
  createdAt: string;
  updatedAt: string;
}

export type ActionBehaviour =
  | { kind: "openProgram"; programId: string; bind?: string }
  | { kind: "verb"; verb: VerbLike }
  | { kind: "askAgent"; template: string };

export interface ActionRecord {
  id: string;
  label: string;
  /** Presentation types the action applies to. */
  types: string[];
  behaviour: ActionBehaviour;
  danger?: boolean;
  description?: string;
  by: "agent" | "human";
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LibrarySnapshot {
  schema_version: 1;
  nextId: number;
  seeded: boolean;
  programs: Record<string, ProgramRecord>;
  actions: Record<string, ActionRecord>;
}

export type PutProgramInput = Omit<ProgramRecord, "id" | "version" | "createdAt" | "updatedAt" | "pinned" | "lastError"> & {
  id?: string;
  pinned?: boolean;
};

export type PutActionInput = Omit<ActionRecord, "id" | "createdAt" | "updatedAt" | "pinned"> & { id?: string; pinned?: boolean };

export interface ProgramLibrary {
  getState(): LibrarySnapshot;
  subscribe(listener: () => void): () => void;
  /** Create (no id) or update (id present; version bumps). Throws a message a tool can return verbatim. */
  putProgram(input: PutProgramInput): ProgramRecord;
  removeProgram(id: string): boolean;
  putAction(input: PutActionInput): ActionRecord;
  removeAction(id: string): boolean;
  setPinned(kind: "program" | "action", id: string, pinned: boolean): boolean;
  recordError(programId: string, error: ProgramRecord["lastError"] | undefined): void;
  markSeeded(): void;
  export(): LibrarySnapshot;
  import(snapshot: LibrarySnapshot, mode: "replace" | "merge"): void;
  /** Write now rather than after the debounce (call on `beforeunload`). */
  flush(): void;
}

/** The subset of `Storage` the library uses, so tests and non-browser hosts can hand in a map. */
export interface LibraryStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface CreateProgramLibraryOptions {
  /** The storage key; one per product. */
  key: string;
  storage?: LibraryStorage | null;
  limits?: Partial<SandboxLimits>;
  /** Milliseconds between the last change and the write; default 300. */
  debounceMs?: number;
  /** Called when a restore finds a corrupt entry or a write fails; the library never resets silently. */
  onRejected?(reason: "restore" | "persist", error: unknown): void;
  now?(): string;
}

export function emptyLibrary(): LibrarySnapshot {
  return { schema_version: 1, nextId: 1, seeded: false, programs: {}, actions: {} };
}

export function memoryStorage(): LibraryStorage {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

function defaultStorage(): LibraryStorage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function isSnapshot(value: unknown): value is LibrarySnapshot {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as LibrarySnapshot).schema_version === 1 &&
    typeof (value as LibrarySnapshot).programs === "object" &&
    typeof (value as LibrarySnapshot).actions === "object"
  );
}

export function createProgramLibrary(options: CreateProgramLibraryOptions): ProgramLibrary {
  const limits: SandboxLimits = { ...DEFAULT_LIMITS, ...options.limits };
  const storage = options.storage === undefined ? defaultStorage() : options.storage;
  const debounceMs = options.debounceMs ?? 300;
  const now = options.now ?? (() => new Date().toISOString());
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setTimeout> | null = null;

  function restore(): LibrarySnapshot {
    if (!storage) return emptyLibrary();
    const raw = storage.getItem(options.key);
    if (!raw) return emptyLibrary();
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isSnapshot(parsed)) throw new Error("not a library snapshot");
      return { ...emptyLibrary(), ...parsed };
    } catch (error) {
      // Never the `parseDocument → null → default` pattern that costs a user
      // their layout: keep the bytes under a sibling key and say so.
      try {
        storage.setItem(`${options.key}.corrupt-${Date.now()}`, raw);
      } catch {
        // The original stays under the key; nothing more to do.
      }
      options.onRejected?.("restore", error);
      return emptyLibrary();
    }
  }

  let state: LibrarySnapshot = restore();

  function emit() {
    for (const listener of listeners) listener();
  }

  function write() {
    timer = null;
    if (!storage) return;
    try {
      storage.setItem(options.key, JSON.stringify(state));
    } catch (error) {
      options.onRejected?.("persist", error);
    }
  }

  function schedule() {
    if (!storage) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(write, debounceMs);
  }

  /** Install `next` if it fits the library byte limit; throw with a message otherwise. */
  function commit(next: LibrarySnapshot) {
    const size = byteLength(JSON.stringify(next));
    if (size > limits.libraryBytes) {
      throw new Error(`the library would be ${size} bytes, the limit is ${limits.libraryBytes}; remove an unpinned program or action first`);
    }
    state = next;
    schedule();
    emit();
  }

  function mint(prefix: string): { id: string; nextId: number } {
    return { id: `${prefix}-${state.nextId}`, nextId: state.nextId + 1 };
  }

  if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    window.addEventListener("storage", (event) => {
      if (event.key !== options.key) return;
      state = restore();
      emit();
    });
    window.addEventListener("beforeunload", () => {
      if (timer) {
        clearTimeout(timer);
        write();
      }
    });
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    putProgram(input) {
      const size = byteLength(input.source);
      if (size > limits.sourceBytes) throw new Error(`source is ${size} bytes, the limit is ${limits.sourceBytes}`);
      const at = now();
      const existing = input.id ? state.programs[input.id] : undefined;
      if (input.id && !existing) throw new Error(`no program ${input.id}`);
      if (!existing && Object.keys(state.programs).length >= limits.programs) {
        throw new Error(`the library already holds ${limits.programs} programs, the limit; remove one first`);
      }
      const minted = existing ? { id: existing.id, nextId: state.nextId } : mint("prg");
      const record: ProgramRecord = {
        id: minted.id,
        title: input.title,
        source: input.source,
        version: existing ? existing.version + 1 : 1,
        bindings: [...input.bindings],
        meta: { ...input.meta, widgets: [...input.meta.widgets] },
        by: input.by,
        pinned: input.pinned ?? existing?.pinned ?? false,
        createdAt: existing?.createdAt ?? at,
        updatedAt: at,
      };
      commit({ ...state, nextId: minted.nextId, programs: { ...state.programs, [record.id]: record } });
      return record;
    },

    removeProgram(id) {
      if (!state.programs[id]) return false;
      const programs = { ...state.programs };
      delete programs[id];
      commit({ ...state, programs });
      return true;
    },

    putAction(input) {
      if (input.types.length === 0) throw new Error("an action needs at least one presentation type");
      const at = now();
      const existing = input.id ? state.actions[input.id] : undefined;
      if (input.id && !existing) throw new Error(`no action ${input.id}`);
      if (!existing && Object.keys(state.actions).length >= limits.actions) {
        throw new Error(`the library already holds ${limits.actions} actions, the limit; remove one first`);
      }
      const minted = existing ? { id: existing.id, nextId: state.nextId } : mint("act");
      const record: ActionRecord = {
        id: minted.id,
        label: input.label,
        types: [...input.types],
        behaviour: input.behaviour,
        ...(input.danger ? { danger: true } : {}),
        ...(input.description ? { description: input.description } : {}),
        by: input.by,
        pinned: input.pinned ?? existing?.pinned ?? false,
        createdAt: existing?.createdAt ?? at,
        updatedAt: at,
      };
      commit({ ...state, nextId: minted.nextId, actions: { ...state.actions, [record.id]: record } });
      return record;
    },

    removeAction(id) {
      if (!state.actions[id]) return false;
      const actions = { ...state.actions };
      delete actions[id];
      commit({ ...state, actions });
      return true;
    },

    setPinned(kind, id, pinned) {
      if (kind === "program") {
        const program = state.programs[id];
        if (!program) return false;
        commit({ ...state, programs: { ...state.programs, [id]: { ...program, pinned, updatedAt: now() } } });
        return true;
      }
      const action = state.actions[id];
      if (!action) return false;
      commit({ ...state, actions: { ...state.actions, [id]: { ...action, pinned, updatedAt: now() } } });
      return true;
    },

    recordError(programId, error) {
      const program = state.programs[programId];
      if (!program) return;
      const next = { ...program };
      if (error) next.lastError = error;
      else delete next.lastError;
      // Errors are diagnostics, not edits: no version bump, no updatedAt.
      state = { ...state, programs: { ...state.programs, [programId]: next } };
      schedule();
      emit();
    },

    markSeeded() {
      commit({ ...state, seeded: true });
    },

    export: () => JSON.parse(JSON.stringify(state)) as LibrarySnapshot,

    import(snapshot, mode) {
      if (!isSnapshot(snapshot)) throw new Error("not a library snapshot");
      if (mode === "replace") {
        commit({ ...emptyLibrary(), ...snapshot });
        return;
      }
      commit({
        ...state,
        nextId: Math.max(state.nextId, snapshot.nextId ?? 1),
        seeded: state.seeded || Boolean(snapshot.seeded),
        programs: { ...state.programs, ...snapshot.programs },
        actions: { ...state.actions, ...snapshot.actions },
      });
    },

    flush() {
      if (timer) {
        clearTimeout(timer);
        write();
      }
    },
  };
}

export function useLibrary<T>(library: ProgramLibrary, selector: (state: LibrarySnapshot) => T): T {
  return useSyncExternalStore(
    library.subscribe,
    () => selector(library.getState()),
    () => selector(library.getState()),
  );
}
