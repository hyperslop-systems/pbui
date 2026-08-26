import { useSyncExternalStore } from "react";
import type { LibraryStorage } from "../library";

/**
 * The playground's draft, persisted on its own (guide D5): a tile unmounts
 * whenever the layout changes, and a draft someone typed for ten minutes must
 * not go with it. Not a library record — a draft is not a program that
 * exists — so it lives under its own `localStorage` key.
 */
export interface PlaygroundDraft {
  source: string;
  /** Binding key → document id, as a script view's `documents` minus `program`. */
  bindings: Record<string, string>;
  /** The library program this draft was loaded from or saved as; "update" targets it. */
  fromProgramId: string | null;
  updatedAt: string;
}

export interface PlaygroundStore {
  get(): PlaygroundDraft;
  set(patch: Partial<Omit<PlaygroundDraft, "updatedAt">>): void;
  /** Back to the template. */
  reset(): void;
  subscribe(listener: () => void): () => void;
  flush(): void;
}

export interface CreatePlaygroundStoreOptions {
  key: string;
  storage?: LibraryStorage | null;
  debounceMs?: number;
  now?(): string;
  /** What an empty playground starts with; default `PLAYGROUND_TEMPLATE`. */
  template?: string;
}

export const PLAYGROUND_TEMPLATE = `definePlugin(({ ui }) => ({
  id: "my-draft",
  title: "My draft",
  initialState: { n: 0 },
  widgets: {
    main: {
      render({ pluginState }) {
        return ui.column([
          ui.text("n = " + pluginState.n),
          ui.button("+1", { onClick: { handler: "inc" } }),
        ]);
      },
      handlers: {
        inc({ pluginState, dispatchPluginAction }) {
          dispatchPluginAction("state/merge", { n: pluginState.n + 1 });
        },
      },
    },
  },
}));
`;

function defaultStorage(): LibraryStorage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function isDraft(value: unknown): value is PlaygroundDraft {
  return typeof value === "object" && value !== null && typeof (value as PlaygroundDraft).source === "string" && typeof (value as PlaygroundDraft).bindings === "object";
}

export function createPlaygroundStore(options: CreatePlaygroundStoreOptions): PlaygroundStore {
  const storage = options.storage === undefined ? defaultStorage() : options.storage;
  const debounceMs = options.debounceMs ?? 300;
  const now = options.now ?? (() => new Date().toISOString());
  const template = options.template ?? PLAYGROUND_TEMPLATE;
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setTimeout> | null = null;

  const fresh = (): PlaygroundDraft => ({ source: template, bindings: {}, fromProgramId: null, updatedAt: now() });

  function restore(): PlaygroundDraft {
    if (!storage) return fresh();
    const raw = storage.getItem(options.key);
    if (!raw) return fresh();
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isDraft(parsed)) throw new Error("not a playground draft");
      return { ...fresh(), ...parsed };
    } catch {
      // A corrupt draft is not worth the library's move-aside dance; a draft
      // is minutes of typing, not a program the user kept.
      return fresh();
    }
  }

  let draft = restore();

  function write() {
    timer = null;
    if (!storage) return;
    try {
      storage.setItem(options.key, JSON.stringify(draft));
    } catch {
      // Quota or a disabled storage: the draft still lives in memory.
    }
  }

  function commit(next: PlaygroundDraft) {
    draft = next;
    if (storage) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(write, debounceMs);
    }
    for (const listener of listeners) listener();
  }

  if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    window.addEventListener("beforeunload", () => {
      if (timer) {
        clearTimeout(timer);
        write();
      }
    });
  }

  return {
    get: () => draft,
    set(patch) {
      commit({ ...draft, ...patch, updatedAt: now() });
    },
    reset() {
      commit(fresh());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    flush() {
      if (timer) {
        clearTimeout(timer);
        write();
      }
    },
  };
}

export function usePlayground<T>(store: PlaygroundStore, selector: (draft: PlaygroundDraft) => T): T {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.get()),
    () => selector(store.get()),
  );
}
