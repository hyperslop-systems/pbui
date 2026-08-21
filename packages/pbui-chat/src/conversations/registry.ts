import {
  selectRunStats,
  selectTimelineEntities,
  type ChatProviderConfig,
  type ChatRunStats,
  type TimelineEntity,
  type TransportStatus,
} from "@go-go-golems/chat-provider";
import type { ChatStore } from "@go-go-golems/chat-provider";
import type { ChatRuntimeContextValue } from "./providerTypes";
import { useSyncExternalStore } from "react";
import { chatRuntimeOf, type ChatRuntime } from "./runtime";

/**
 * The conversation registry (guide §4.2, D2/D6/D7).
 *
 * Records — ids, titles, pins, archive flags, counts — persist in storage and
 * are a few hundred bytes each. Runtimes are lazy: one exists while a
 * conversation is OPEN, from `open()` until `close()`, independent of whether
 * a tile is showing it, because a person who closes a chat tile for a minute
 * has not ended the conversation.
 *
 * The registry also holds THE ACTIVE CONVERSATION, the same way the sandbox's
 * instance registry holds the selected sandbox: singleton helper tiles that
 * follow it are siblings of the chat tiles, not descendants, so the state
 * cannot live in a React context above them.
 */

export type TitledBy = "auto" | "human" | "agent";

export interface ConversationRecord {
  /** The session id. Minted by the server, never by the browser. */
  id: string;
  title: string;
  titledBy: TitledBy;
  createdAt: string;
  lastActivityAt: string;
  pinned: boolean;
  archived: boolean;
  messageCount: number;
  model?: string | null;
  provider?: string | null;
}

/** What the mirror of an open runtime's store adds to a record. */
export interface ConversationMirror {
  runStatus: string;
  wsStatus: TransportStatus | "closed";
  error: string | null;
  streaming: boolean;
  stats: ChatRunStats | null;
  /** Parked human tools and undecided proposals — computed, never stored (D12). */
  waiting: number;
}

export interface ConversationSnapshot extends ConversationRecord, ConversationMirror {
  runtime: ChatRuntime | null;
  /** True between `open()` and `close()`, even before the runtime attaches. */
  open: boolean;
  active: boolean;
}

export interface ConversationRegistry {
  get(id: string): ConversationSnapshot | null;
  /** Pinned first, then by last activity. The same array until something changes. */
  all(): ConversationSnapshot[];
  /** The ids whose runtimes should exist right now; `ConversationHost` renders one provider each. */
  openIds(): readonly string[];
  activeId(): string | null;
  activate(id: string | null): void;
  /**
   * Which conversation the interface should be offering a name field for,
   * if any. `conversation.rename` without a title sets it — the object menu
   * cannot hold a text field, so the verb asks for the editor instead and
   * whatever is showing the conversation opens one.
   */
  renaming(): string | null;
  requestRename(id: string | null): void;

  /** `POST /api/chat/sessions`, record it, and (by default) open and activate it. */
  create(options?: { title?: string; open?: boolean; activate?: boolean }): Promise<ConversationSnapshot>;
  /** Adopt a session id that already exists (a migrated layout, the server's list). */
  adopt(id: string, record?: Partial<ConversationRecord>): ConversationSnapshot;
  /** Mark open so a runtime is built. Idempotent. */
  open(id: string): void;
  /** Dispose the runtime, keep the record. */
  close(id: string): void;
  rename(id: string, title: string, by?: TitledBy): void;
  pin(id: string, pinned: boolean): void;
  archive(id: string, archived: boolean): void;
  /** Drop the local record. The server keeps the session. */
  forget(id: string): void;

  runtimeFor(id: string): ChatRuntime | null;
  /** The active conversation's runtime, if it is open and attached. */
  activeRuntime(): ChatRuntime | null;
  forEachOpen(visit: (runtime: ChatRuntime) => void): void;
  /** The `ChatProvider` config for one conversation; stable per id, as `ChatProvider` memoises on it. */
  configFor(id: string): ChatProviderConfig;

  subscribe(listener: () => void): () => void;
  /** Write pending changes now (call on `beforeunload`). */
  flush(): void;
  /** Should `ConversationHost` connect a runtime as it attaches? False in stories and tests. */
  autoConnect(): boolean;
  setAutoConnect(next: boolean): void;

  /* ---- written by ConversationHost ------------------------------------- */
  attachRuntime(id: string, captured: { store: ChatStore; context: ChatRuntimeContextValue }): ChatRuntime;
  detachRuntime(id: string): void;
}

export interface ConversationStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface ConversationsSnapshotFile {
  schema_version: 1;
  activeId: string | null;
  records: ConversationRecord[];
}

export interface CreateConversationRegistryOptions {
  /** Storage key; one per product. */
  key: string;
  storage?: ConversationStorage | null;
  /** Built per conversation by `createPbuiChat`; memoised here so `ChatProvider` does not rebuild its client. */
  configFor(id: string): ChatProviderConfig;
  /** Prefix for `/api/chat/sessions`. */
  basePrefix?: string;
  fetch?: typeof fetch;
  /** Milliseconds between the last change and the write; default 300. */
  debounceMs?: number;
  /** Called when a restore finds a corrupt entry or a write fails. */
  onRejected?(reason: "restore" | "persist", error: unknown): void;
  now?(): string;
  /** Longest auto title, in characters; default 60. */
  titleLength?: number;
  /** Connect each runtime as it attaches; default true. Stories and tests pass false. */
  autoConnect?: boolean;
}

const EMPTY_MIRROR: ConversationMirror = Object.freeze({
  runStatus: "idle",
  wsStatus: "closed",
  error: null,
  streaming: false,
  stats: null,
  waiting: 0,
});

function defaultStorage(): ConversationStorage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function memoryConversationStorage(): ConversationStorage {
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

function isFile(value: unknown): value is ConversationsSnapshotFile {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as ConversationsSnapshotFile).schema_version === 1 &&
    Array.isArray((value as ConversationsSnapshotFile).records)
  );
}

/** The first user message, trimmed to one line — a session id is not a title (D7). */
export function deriveTitle(entities: readonly TimelineEntity[], max: number): string | null {
  for (const entity of entities) {
    if (entity.kind !== "message") continue;
    if (String(entity.props.role ?? "assistant") !== "user") continue;
    const text = String(entity.props.content ?? entity.props.prompt ?? entity.props.text ?? "")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) continue;
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
  }
  return null;
}

/** Parked human tools and proposals nobody has decided yet. */
export function countWaiting(runtime: ChatRuntime, entities: readonly TimelineEntity[]): number {
  let waiting = 0;
  for (const entity of entities) {
    if (entity.kind !== "tool_call") continue;
    if (entity.props.result) continue;
    const toolCallId = String(entity.props.toolCallId ?? entity.id);
    const toolName = String(entity.props.toolName ?? "");
    const tool = runtime.toolRegistry.get(toolName);
    if (tool?.mode !== "human") continue;
    if (!runtime.toolRuntime.isPendingHumanTool(toolCallId)) continue;
    waiting += 1;
  }
  return waiting;
}

export function createConversationRegistry(options: CreateConversationRegistryOptions): ConversationRegistry {
  const storage = options.storage === undefined ? defaultStorage() : options.storage;
  const debounceMs = options.debounceMs ?? 300;
  const now = options.now ?? (() => new Date().toISOString());
  const fetchImpl = options.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const basePrefix = options.basePrefix ?? "";
  const titleLength = options.titleLength ?? 60;

  const records = new Map<string, ConversationRecord>();
  const mirrors = new Map<string, ConversationMirror>();
  const runtimes = new Map<string, ChatRuntime>();
  const unsubscribes = new Map<string, () => void>();
  const configs = new Map<string, ChatProviderConfig>();
  const openSet = new Set<string>();
  const listeners = new Set<() => void>();

  let activeId: string | null = null;
  let snapshotCache: ConversationSnapshot[] | null = null;
  const snapshots = new Map<string, ConversationSnapshot>();
  let openIdsCache: string[] | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let autoConnect = options.autoConnect !== false;
  let renaming: string | null = null;

  function emit() {
    for (const listener of listeners) listener();
  }

  /** Drop the memoised snapshot of one conversation (or all) and notify. */
  function invalidate(id?: string) {
    if (id) snapshots.delete(id);
    else snapshots.clear();
    snapshotCache = null;
    emit();
  }

  function restore() {
    if (!storage) return;
    const raw = storage.getItem(options.key);
    if (!raw) return;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isFile(parsed)) throw new Error("not a conversations snapshot");
      for (const record of parsed.records) {
        if (!record || typeof record.id !== "string" || !record.id) continue;
        records.set(record.id, { ...record, pinned: record.pinned === true, archived: record.archived === true });
      }
      activeId = parsed.activeId && records.has(parsed.activeId) ? parsed.activeId : null;
    } catch (error) {
      // Never lose the bytes: a corrupt entry is moved aside, not overwritten.
      try {
        storage.setItem(`${options.key}.corrupt-${Date.now()}`, raw);
      } catch {
        // The original stays under the key; nothing more to do.
      }
      options.onRejected?.("restore", error);
    }
  }

  function write() {
    timer = null;
    if (!storage) return;
    const file: ConversationsSnapshotFile = { schema_version: 1, activeId, records: [...records.values()] };
    try {
      storage.setItem(options.key, JSON.stringify(file));
    } catch (error) {
      options.onRejected?.("persist", error);
    }
  }

  function schedule() {
    if (!storage) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(write, debounceMs);
  }

  function patchRecord(id: string, patch: Partial<ConversationRecord>): boolean {
    const current = records.get(id);
    if (!current) return false;
    let changed = false;
    for (const key of Object.keys(patch) as (keyof ConversationRecord)[]) {
      if (!Object.is(current[key], patch[key])) {
        changed = true;
        break;
      }
    }
    if (!changed) return false;
    records.set(id, { ...current, ...patch });
    schedule();
    invalidate(id);
    return true;
  }

  function patchMirror(id: string, next: ConversationMirror) {
    const current = mirrors.get(id) ?? EMPTY_MIRROR;
    let changed = false;
    for (const key of Object.keys(next) as (keyof ConversationMirror)[]) {
      if (!Object.is(current[key], next[key])) {
        changed = true;
        break;
      }
    }
    if (!changed) return;
    mirrors.set(id, next);
    invalidate(id);
  }

  /**
   * One subscription per open runtime. The registry mirrors the handful of
   * fields cross-conversation tiles need, so the Runs table does not
   * subscribe to N Redux stores itself (D9), and folds the derived record
   * fields — message count, last activity, an auto title — back into storage.
   */
  function mirrorOf(runtime: ChatRuntime): ConversationMirror {
    const state = runtime.store.getState();
    const entities = selectTimelineEntities(state);
    return {
      runStatus: state.overlay.runStatus,
      wsStatus: state.overlay.wsStatus,
      error: state.overlay.error,
      streaming: state.runStats.isStreaming,
      stats: selectRunStats(state),
      waiting: countWaiting(runtime, entities),
    };
  }

  function sync(id: string, runtime: ChatRuntime) {
    patchMirror(id, mirrorOf(runtime));
    const entities = selectTimelineEntities(runtime.store.getState());
    const messages = entities.filter((entity) => entity.kind === "message").length;
    const record = records.get(id);
    if (!record) return;
    const stats = runtime.store.getState().runStats;
    const patch: Partial<ConversationRecord> = {
      messageCount: messages,
      ...(stats.model ? { model: stats.model } : {}),
      ...(stats.provider ? { provider: stats.provider } : {}),
    };
    if (messages !== record.messageCount) patch.lastActivityAt = now();
    // An auto title is recomputed until someone owns it; a human or agent
    // rename ends that for good.
    if (record.titledBy === "auto") {
      const derived = deriveTitle(entities, titleLength);
      if (derived && derived !== record.title) patch.title = derived;
    }
    patchRecord(id, patch);
  }

  function newRecord(id: string, patch: Partial<ConversationRecord> = {}): ConversationRecord {
    const at = now();
    return {
      id,
      title: "new conversation",
      titledBy: "auto",
      createdAt: at,
      lastActivityAt: at,
      pinned: false,
      archived: false,
      messageCount: 0,
      ...patch,
    };
  }

  function snapshotOf(id: string): ConversationSnapshot | null {
    const record = records.get(id);
    if (!record) return null;
    const cached = snapshots.get(id);
    if (cached) return cached;
    const snapshot: ConversationSnapshot = {
      ...record,
      ...(mirrors.get(id) ?? EMPTY_MIRROR),
      runtime: runtimes.get(id) ?? null,
      open: openSet.has(id),
      active: activeId === id,
    };
    snapshots.set(id, snapshot);
    return snapshot;
  }

  function compare(a: ConversationRecord, b: ConversationRecord): number {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (a.lastActivityAt !== b.lastActivityAt) return a.lastActivityAt < b.lastActivityAt ? 1 : -1;
    return a.id < b.id ? -1 : 1;
  }

  restore();

  const registry: ConversationRegistry = {
    get: (id) => snapshotOf(id),

    all() {
      if (!snapshotCache) {
        snapshotCache = [...records.values()]
          .sort(compare)
          .map((record) => snapshotOf(record.id))
          .filter((snapshot): snapshot is ConversationSnapshot => snapshot !== null);
      }
      return snapshotCache;
    },

    openIds() {
      if (!openIdsCache) openIdsCache = [...openSet];
      return openIdsCache;
    },

    activeId: () => activeId,

    renaming: () => renaming,

    requestRename(id) {
      const next = id && records.has(id) ? id : null;
      if (next === renaming) return;
      renaming = next;
      emit();
    },

    activate(id) {
      const next = id && records.has(id) ? id : null;
      if (next === activeId) return;
      const previous = activeId;
      activeId = next;
      if (previous) snapshots.delete(previous);
      if (next) snapshots.delete(next);
      schedule();
      invalidate();
    },

    async create(createOptions = {}) {
      const response = await fetchImpl(`${basePrefix}/api/chat/sessions`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!response.ok) throw new Error(`could not create a conversation: ${response.status}`);
      const data = (await response.json()) as { sessionId?: string; session_id?: string };
      const id = String(data.sessionId ?? data.session_id ?? "").trim();
      if (!id) throw new Error("the server created a session without an id");
      const snapshot = registry.adopt(id, createOptions.title ? { title: createOptions.title, titledBy: "human" } : {});
      if (createOptions.open !== false) registry.open(id);
      if (createOptions.activate !== false) registry.activate(id);
      return registry.get(id) ?? snapshot;
    },

    adopt(id, patch = {}) {
      if (!records.has(id)) {
        records.set(id, newRecord(id, patch));
        schedule();
        invalidate();
      } else if (Object.keys(patch).length > 0) {
        patchRecord(id, patch);
      }
      return snapshotOf(id) as ConversationSnapshot;
    },

    open(id) {
      if (!records.has(id)) registry.adopt(id);
      if (openSet.has(id)) return;
      openSet.add(id);
      openIdsCache = null;
      invalidate(id);
    },

    close(id) {
      if (!openSet.delete(id)) return;
      openIdsCache = null;
      // The host stops rendering this conversation's provider, whose cleanup
      // resets the client (cancelling tools and disconnecting) and calls
      // `detachRuntime`. Nothing to dispose here.
      invalidate(id);
    },

    rename(id, title, by = "human") {
      const trimmed = title.trim();
      if (!trimmed) return;
      patchRecord(id, { title: trimmed, titledBy: by });
    },

    pin(id, pinned) {
      patchRecord(id, { pinned });
    },

    archive(id, archived) {
      patchRecord(id, { archived });
      if (archived) registry.close(id);
    },

    forget(id) {
      if (!records.delete(id)) return;
      if (renaming === id) renaming = null;
      registry.close(id);
      mirrors.delete(id);
      configs.delete(id);
      // A selection pointing at a conversation that is gone would leave every
      // singleton that follows it showing a stale target.
      if (activeId === id) activeId = null;
      schedule();
      invalidate();
    },

    runtimeFor: (id) => runtimes.get(id) ?? null,
    activeRuntime: () => (activeId ? (runtimes.get(activeId) ?? null) : null),

    forEachOpen(visit) {
      for (const runtime of runtimes.values()) visit(runtime);
    },

    configFor(id) {
      let config = configs.get(id);
      if (!config) {
        config = options.configFor(id);
        configs.set(id, config);
      }
      return config;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    autoConnect: () => autoConnect,
    setAutoConnect(next) {
      autoConnect = next;
    },

    flush() {
      if (!timer) return;
      clearTimeout(timer);
      write();
    },

    attachRuntime(id, captured) {
      unsubscribes.get(id)?.();
      const runtime = chatRuntimeOf({ sessionId: id, store: captured.store, context: captured.context, now });
      runtimes.set(id, runtime);
      unsubscribes.set(
        id,
        captured.store.subscribe(() => sync(id, runtime)),
      );
      sync(id, runtime);
      invalidate(id);
      return runtime;
    },

    detachRuntime(id) {
      unsubscribes.get(id)?.();
      unsubscribes.delete(id);
      if (!runtimes.delete(id)) return;
      mirrors.delete(id);
      invalidate(id);
    },
  };

  if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    window.addEventListener("beforeunload", () => registry.flush());
  }

  return registry;
}

/** Subscribe a component to a slice; the selector must return a stable reference for an unchanged slice. */
export function useConversations<T>(registry: ConversationRegistry, selector: (registry: ConversationRegistry) => T): T {
  return useSyncExternalStore(
    registry.subscribe,
    () => selector(registry),
    () => selector(registry),
  );
}
