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
  /** Last server-acknowledged title revision; local title remains immediate source of truth. */
  titleRevision: number;
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

export type ConversationRuntimeLifecycle =
  | { phase: "closed" }
  | { phase: "opening"; attempt: number }
  | { phase: "open"; attempt: number }
  | { phase: "failed"; attempt: number; error: string; retryable: boolean }
  | { phase: "closing"; attempt: number };

export type ConversationTitleSync =
  | { status: "synchronized"; revision: number }
  | { status: "queued" | "failed"; revision: number; error: string };

export interface ConversationSnapshot extends ConversationRecord, ConversationMirror {
  runtime: ChatRuntime | null;
  /** Explicit provider/connection lifecycle; never infer `opening` from a missing runtime. */
  lifecycle: ConversationRuntimeLifecycle;
  titleSync: ConversationTitleSync;
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
  /** Mark open so a runtime is built. Idempotent unless retrying a failed lifecycle. */
  open(id: string): void;
  /** Retry a failed provider connection without creating a second runtime. */
  retry(id: string): Promise<void>;
  /** Cancel an opening attempt or dispose an open runtime while keeping the record. */
  close(id: string): void;
  rename(id: string, title: string, by?: TitledBy): Promise<TitleRenameResult>;
  retryTitle(id: string): Promise<TitleRenameResult>;
  flushTitles(): Promise<TitleFlushResult>;
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

  /**
   * Reconcile with the server's session index (guide D10).
   *
   * MERGES, never replaces. The index is a convenience the server can rebuild
   * or lose; this browser's records are the ones that have been used. A
   * session the server lists and this browser does not know is adopted; a
   * session this browser knows and the server has forgotten is left alone,
   * because it still connects and hydrates perfectly.
   */
  sync(): Promise<SyncResult>;

  subscribe(listener: () => void): () => void;
  /** Write pending changes now (call on `beforeunload`). */
  flush(): void;
  /** Should `ConversationHost` connect a runtime as it attaches? False in stories and tests. */
  autoConnect(): boolean;
  setAutoConnect(next: boolean): void;

  /* ---- written by ConversationHost ------------------------------------- */
  attachRuntime(id: string, captured: { store: ChatStore; context: ChatRuntimeContextValue }): ChatRuntime;
  connectRuntime(id: string): Promise<void>;
  detachRuntime(id: string): void;
}

export interface ConversationStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** What one `sync()` changed, so a tile can say so rather than flicker. */
export interface TitleRenameResult {
  local: "updated";
  remote: "updated" | "queued" | "failed";
}

export interface TitleFlushResult {
  updated: string[];
  queued: string[];
  failed: string[];
}

export interface SyncResult {
  /** Sessions the server listed that this browser had never seen. */
  adopted: string[];
  /** Records the server had something better for — a title, a higher count. */
  updated: string[];
  /** Records the server does not list. They are kept; the server may have forgotten them. */
  unknownToServer: string[];
}

export interface ConversationsSnapshotFile {
  schema_version: 1;
  activeId: string | null;
  records: ConversationRecord[];
}

interface PendingTitleWrite {
  id: string;
  title: string;
  titledBy: TitledBy;
  localVersion: number;
  updatedAt: string;
}

interface TitleOutboxFile {
  schema_version: 1;
  writes: PendingTitleWrite[];
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

interface ServerSession {
  id?: string;
  createdAt?: string;
  lastActivityAt?: string;
  messageCount?: number;
  title?: string;
  titleRevision?: number;
}

/**
 * What of a server row is worth taking.
 *
 * A HUMAN title is never overwritten (D7): the user named this conversation
 * in this browser, and the index only ever knows what some browser told it.
 * A count is taken only when it is HIGHER, because this browser's count comes
 * from a hydrated timeline it has actually seen, and the index's comes from
 * counting submissions — including ones from another browser, which is worth
 * knowing, but never worth losing messages over.
 */
function serverPatch(session: ServerSession, record: ConversationRecord | null, preserveLocalTitle = false): Partial<ConversationRecord> {
  const patch: Partial<ConversationRecord> = {};
  const title = String(session.title ?? "").trim();
  if (title && !preserveLocalTitle && (!record || record.titledBy !== "human") && record?.title !== title) {
    patch.title = title;
    patch.titledBy = "agent";
  }
  const revision = Number(session.titleRevision ?? 0);
  if (Number.isSafeInteger(revision) && revision >= 0 && revision > (record?.titleRevision ?? -1)) patch.titleRevision = revision;
  const count = Number(session.messageCount ?? 0);
  if (Number.isFinite(count) && count > (record?.messageCount ?? -1)) patch.messageCount = count;
  const created = String(session.createdAt ?? "").trim();
  if (created && !record) patch.createdAt = created;
  const last = String(session.lastActivityAt ?? "").trim();
  if (last && (!record || last > record.lastActivityAt)) patch.lastActivityAt = last;
  return patch;
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
  const lifecycles = new Map<string, ConversationRuntimeLifecycle>();
  const lifecycleAttempts = new Map<string, number>();
  const connectPromises = new Map<string, Promise<void>>();
  const unsubscribes = new Map<string, () => void>();
  const configs = new Map<string, ChatProviderConfig>();
  const openSet = new Set<string>();
  const listeners = new Set<() => void>();
  const pendingTitles = new Map<string, PendingTitleWrite>();
  const titleSync = new Map<string, ConversationTitleSync>();
  const titleVersions = new Map<string, number>();
  const titleProcesses = new Map<string, Promise<TitleRenameResult>>();
  const titleOutboxKey = `${options.key}.title-outbox`;

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

  function restoreTitleOutbox() {
    if (!storage) return;
    const raw = storage.getItem(titleOutboxKey);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Partial<TitleOutboxFile>;
      if (parsed.schema_version !== 1 || !Array.isArray(parsed.writes)) throw new Error("not a title outbox");
      for (const write of parsed.writes) {
        if (
          !write ||
          typeof write.id !== "string" ||
          !write.id ||
          typeof write.title !== "string" ||
          !Number.isSafeInteger(write.localVersion) ||
          write.localVersion <= 0 ||
          (write.titledBy !== "auto" && write.titledBy !== "human" && write.titledBy !== "agent")
        ) {
          throw new Error("invalid title outbox entry");
        }
        pendingTitles.set(write.id, write);
        titleVersions.set(write.id, Math.max(titleVersions.get(write.id) ?? 0, write.localVersion));
        titleSync.set(write.id, { status: "queued", revision: 0, error: "waiting to synchronize" });
      }
    } catch (error) {
      try {
        storage.setItem(`${titleOutboxKey}.corrupt-${Date.now()}`, raw);
      } catch {
        // Preserve the original bytes when even quarantine cannot be written.
      }
      options.onRejected?.("restore", error);
    }
  }

  function persistTitleOutbox(): boolean {
    if (!storage) return false;
    try {
      if (pendingTitles.size === 0) storage.removeItem(titleOutboxKey);
      else storage.setItem(titleOutboxKey, JSON.stringify({ schema_version: 1, writes: [...pendingTitles.values()] } satisfies TitleOutboxFile));
      return true;
    } catch (error) {
      options.onRejected?.("persist", error);
      return false;
    }
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
        records.set(record.id, {
          ...record,
          titleRevision: Number.isSafeInteger(record.titleRevision) && record.titleRevision >= 0 ? record.titleRevision : 0,
          pinned: record.pinned === true,
          archived: record.archived === true,
        });
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

  function lifecycleOf(id: string): ConversationRuntimeLifecycle {
    return lifecycles.get(id) ?? { phase: "closed" };
  }

  function setLifecycle(id: string, lifecycle: ConversationRuntimeLifecycle): void {
    const current = lifecycleOf(id);
    if (
      current.phase === lifecycle.phase &&
      ("attempt" in current ? current.attempt : 0) === ("attempt" in lifecycle ? lifecycle.attempt : 0) &&
      (current.phase !== "failed" ||
        (lifecycle.phase === "failed" && current.error === lifecycle.error && current.retryable === lifecycle.retryable))
    ) {
      return;
    }
    lifecycles.set(id, lifecycle);
    invalidate(id);
  }

  function nextAttempt(id: string): number {
    const attempt = (lifecycleAttempts.get(id) ?? 0) + 1;
    lifecycleAttempts.set(id, attempt);
    return attempt;
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
    let derivedTitle: string | null = null;
    if (record.titledBy === "auto") {
      derivedTitle = deriveTitle(entities, titleLength);
      if (derivedTitle && derivedTitle !== record.title) patch.title = derivedTitle;
    }
    patchRecord(id, patch);
    if (derivedTitle && derivedTitle !== record.title && pendingTitles.get(id)?.title !== derivedTitle) {
      void queueTitle(id, derivedTitle, "auto");
    }
  }

  function newRecord(id: string, patch: Partial<ConversationRecord> = {}): ConversationRecord {
    const at = now();
    return {
      id,
      title: "new conversation",
      titledBy: "auto",
      titleRevision: 0,
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
      lifecycle: lifecycleOf(id),
      titleSync: titleSync.get(id) ?? { status: "synchronized", revision: record.titleRevision },
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

  function setTitleSync(id: string, state: ConversationTitleSync): void {
    titleSync.set(id, state);
    invalidate(id);
  }

  async function responseJSON(response: Response): Promise<Record<string, unknown>> {
    try {
      const value = (await response.json()) as unknown;
      return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }

  async function drainTitle(id: string): Promise<TitleRenameResult> {
    for (;;) {
      const write = pendingTitles.get(id);
      const record = records.get(id);
      if (!write || !record) {
        return { local: "updated", remote: write ? "failed" : "updated" };
      }
      const expectedRevision = record.titleRevision;
      try {
        const response = await fetchImpl(`${basePrefix}/api/chat/sessions/${encodeURIComponent(id)}`, {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: write.title, expectedRevision }),
        });
        const data = await responseJSON(response);
        const reportedRevision = Number(data.titleRevision);
        const revision = Number.isSafeInteger(reportedRevision) && reportedRevision >= 0 ? reportedRevision : expectedRevision;
        if (response.status === 409) {
          if (revision > record.titleRevision) patchRecord(id, { titleRevision: revision });
          const error = String(data.error ?? "conversation title changed on another client");
          setTitleSync(id, { status: "failed", revision, error });
          persistTitleOutbox();
          return { local: "updated", remote: "failed" };
        }
        if (!response.ok) {
          const error = String(data.error ?? `could not synchronize title: ${response.status}`);
          const status = response.status >= 500 ? "queued" : "failed";
          setTitleSync(id, { status, revision: record.titleRevision, error });
          persistTitleOutbox();
          return { local: "updated", remote: status };
        }
        const acknowledgedRevision = revision > expectedRevision ? revision : expectedRevision + 1;
        patchRecord(id, { titleRevision: acknowledgedRevision });
        if (pendingTitles.get(id)?.localVersion === write.localVersion) pendingTitles.delete(id);
        persistTitleOutbox();
        const next = pendingTitles.get(id);
        if (!next) {
          setTitleSync(id, { status: "synchronized", revision: acknowledgedRevision });
          return { local: "updated", remote: "updated" };
        }
        // A newer local rename arrived while this PATCH was in flight. Loop
        // with the just-acknowledged revision so requests can never reorder.
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setTitleSync(id, { status: "queued", revision: record.titleRevision, error: message });
        persistTitleOutbox();
        return { local: "updated", remote: "queued" };
      }
    }
  }

  function processTitle(id: string): Promise<TitleRenameResult> {
    const existing = titleProcesses.get(id);
    if (existing) return existing;
    const promise = drainTitle(id).finally(() => {
      if (titleProcesses.get(id) === promise) titleProcesses.delete(id);
    });
    titleProcesses.set(id, promise);
    return promise;
  }

  function queueTitle(id: string, title: string, by: TitledBy): Promise<TitleRenameResult> {
    const trimmed = title.trim();
    if (!trimmed) return Promise.resolve({ local: "updated", remote: "updated" });
    const record = records.get(id);
    if (!record) return Promise.reject(new Error(`unknown conversation ${id}`));
    patchRecord(id, { title: trimmed, titledBy: by });
    const localVersion = (titleVersions.get(id) ?? 0) + 1;
    titleVersions.set(id, localVersion);
    pendingTitles.set(id, { id, title: trimmed, titledBy: by, localVersion, updatedAt: now() });
    const persisted = persistTitleOutbox();
    setTitleSync(id, {
      status: "queued",
      revision: record.titleRevision,
      error: persisted || !storage ? "waiting to synchronize" : "title retry could not be persisted",
    });
    return processTitle(id);
  }

  restore();
  restoreTitleOutbox();

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
      const snapshot = registry.adopt(id);
      if (createOptions.title) await registry.rename(id, createOptions.title, "human");
      if (createOptions.open !== false) registry.open(id);
      if (createOptions.activate !== false) registry.activate(id);
      return registry.get(id) ?? snapshot;
    },

    adopt(id, patch = {}) {
      if (!records.has(id)) {
        records.set(id, newRecord(id, patch));
        lifecycles.set(id, { phase: "closed" });
        schedule();
        invalidate();
      } else if (Object.keys(patch).length > 0) {
        patchRecord(id, patch);
      }
      return snapshotOf(id) as ConversationSnapshot;
    },

    open(id) {
      if (!records.has(id)) registry.adopt(id);
      const current = lifecycleOf(id);
      if (openSet.has(id) && current.phase !== "failed") return;
      if (!openSet.has(id)) {
        openSet.add(id);
        openIdsCache = null;
      }
      setLifecycle(id, { phase: "opening", attempt: nextAttempt(id) });
    },

    async retry(id) {
      if (!records.has(id)) throw new Error(`unknown conversation ${id}`);
      registry.open(id);
      if (runtimes.has(id)) await registry.connectRuntime(id);
    },

    close(id) {
      if (!openSet.has(id)) return;
      const current = lifecycleOf(id);
      const attempt = "attempt" in current ? current.attempt : 0;
      setLifecycle(id, { phase: "closing", attempt });
      openSet.delete(id);
      openIdsCache = null;
      invalidate(id);
      // If React has not attached the provider yet there will be no cleanup
      // callback to finish the transition. Finish it after subscribers have
      // had one observable `closing` snapshot.
      if (!runtimes.has(id)) {
        queueMicrotask(() => {
          if (!openSet.has(id) && !runtimes.has(id) && lifecycleOf(id).phase === "closing") {
            setLifecycle(id, { phase: "closed" });
          }
        });
      }
    },

    rename(id, title, by = "human") {
      return queueTitle(id, title, by);
    },

    retryTitle(id) {
      const pending = pendingTitles.get(id);
      const record = records.get(id);
      if (!record) return Promise.reject(new Error(`unknown conversation ${id}`));
      if (!pending) return Promise.resolve({ local: "updated", remote: "updated" });
      setTitleSync(id, { status: "queued", revision: record.titleRevision, error: "retrying" });
      return processTitle(id);
    },

    async flushTitles() {
      const result: TitleFlushResult = { updated: [], queued: [], failed: [] };
      await Promise.all(
        [...pendingTitles.keys()].map(async (id) => {
          const outcome = await processTitle(id);
          result[outcome.remote === "updated" ? "updated" : outcome.remote].push(id);
        }),
      );
      return result;
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
      pendingTitles.delete(id);
      titleSync.delete(id);
      titleVersions.delete(id);
      titleProcesses.delete(id);
      persistTitleOutbox();
      lifecycles.delete(id);
      lifecycleAttempts.delete(id);
      connectPromises.delete(id);
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

    async sync() {
      const response = await fetchImpl(`${basePrefix}/api/chat/sessions`, { credentials: "same-origin" });
      if (!response.ok) throw new Error(`could not list conversations: ${response.status}`);
      const data = (await response.json()) as { sessions?: ServerSession[] };
      const listed = Array.isArray(data.sessions) ? data.sessions : [];
      const seen = new Set<string>();
      const adopted: string[] = [];
      const updated: string[] = [];

      for (const session of listed) {
        const id = String(session?.id ?? "").trim();
        if (!id) continue;
        seen.add(id);
        const record = records.get(id);
        if (!record) {
          registry.adopt(id, serverPatch(session, null));
          adopted.push(id);
          continue;
        }
        const pending = pendingTitles.has(id);
        const patch = serverPatch(session, record, pending);
        if (Object.keys(patch).length > 0 && patchRecord(id, patch)) updated.push(id);
        const serverTitle = String(session.title ?? "").trim();
        const serverRevision = Number(session.titleRevision ?? 0);
        if (!pending && record.titledBy === "human" && serverTitle && serverTitle !== record.title && serverRevision > record.titleRevision) {
          const localVersion = (titleVersions.get(id) ?? 0) + 1;
          titleVersions.set(id, localVersion);
          pendingTitles.set(id, { id, title: record.title, titledBy: "human", localVersion, updatedAt: now() });
          persistTitleOutbox();
          setTitleSync(id, {
            status: "failed",
            revision: serverRevision,
            error: "conversation title changed on another client; retry to keep this local title",
          });
        }
      }

      return {
        adopted,
        updated,
        unknownToServer: [...records.keys()].filter((id) => !seen.has(id)),
      };
    },

    autoConnect: () => autoConnect,
    setAutoConnect(next) {
      autoConnect = next;
    },

    flush() {
      if (timer) {
        clearTimeout(timer);
        write();
      }
      persistTitleOutbox();
    },

    attachRuntime(id, captured) {
      unsubscribes.get(id)?.();
      const runtime = chatRuntimeOf({
        sessionId: id,
        store: captured.store,
        context: captured.context,
        now,
        // `lastManifest` and `lastSend` are not store state, so a tile reading
        // them needs the registry to say when they moved.
        onChange: () => invalidate(id),
      });
      runtimes.set(id, runtime);
      if (!autoConnect) {
        const current = lifecycleOf(id);
        setLifecycle(id, { phase: "open", attempt: "attempt" in current ? current.attempt : 1 });
      }
      unsubscribes.set(
        id,
        captured.store.subscribe(() => sync(id, runtime)),
      );
      sync(id, runtime);
      invalidate(id);
      return runtime;
    },

    async connectRuntime(id) {
      const existing = connectPromises.get(id);
      if (existing) return existing;
      const runtime = runtimes.get(id);
      if (!runtime) throw new Error(`conversation ${id} has no runtime to connect`);
      const current = lifecycleOf(id);
      const attempt = current.phase === "opening" ? current.attempt : nextAttempt(id);
      if (current.phase !== "opening") setLifecycle(id, { phase: "opening", attempt });
      const promise = runtime.context.client
        .connect()
        .then(() => {
          const lifecycle = lifecycleOf(id);
          if (openSet.has(id) && lifecycle.phase === "opening" && lifecycle.attempt === attempt) {
            setLifecycle(id, { phase: "open", attempt });
          }
        })
        .catch((error: unknown) => {
          const lifecycle = lifecycleOf(id);
          if (openSet.has(id) && lifecycle.phase === "opening" && lifecycle.attempt === attempt) {
            setLifecycle(id, {
              phase: "failed",
              attempt,
              error: error instanceof Error ? error.message : String(error),
              retryable: true,
            });
          }
          throw error;
        })
        .finally(() => {
          if (connectPromises.get(id) === promise) connectPromises.delete(id);
        });
      connectPromises.set(id, promise);
      return promise;
    },

    detachRuntime(id) {
      unsubscribes.get(id)?.();
      unsubscribes.delete(id);
      connectPromises.delete(id);
      if (!runtimes.delete(id)) return;
      mirrors.delete(id);
      if (openSet.has(id)) {
        setLifecycle(id, { phase: "opening", attempt: nextAttempt(id) });
      } else {
        setLifecycle(id, { phase: "closed" });
      }
      invalidate(id);
    },
  };

  if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    window.addEventListener("beforeunload", () => registry.flush());
  }
  if (pendingTitles.size > 0) queueMicrotask(() => void registry.flushTitles());

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
