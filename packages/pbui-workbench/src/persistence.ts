import { parseDocument, serializeDocument } from "./document";
import type { Workbench } from "./types";
import type { WorkbenchStore } from "./store";
import type { WorkbenchDocument } from "@hyperslop-systems/workbench-protocol";

/** The three methods this needs from `localStorage`, so a test can pass a Map. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** The current envelope version. A payload with no `version` reads as 0. */
export const PERSISTENCE_VERSION = 1;

/**
 * What a payload with no `version` field claims to be.
 *
 * Zero, not 1: every product that hand-wrote this loop stored the bare
 * serialised document under the key, and calling that "version 1" would make
 * it indistinguishable from an envelope — so `migrate` could never be handed
 * one. As version 0 it arrives at `migrate(payload, 0)`, which is a
 * four-line wrap, and a product that supplies no `migrate` discards it and
 * falls back to its default layout.
 */
export const PRE_ENVELOPE_VERSION = 0;

/**
 * What is written under the key.
 *
 * The document, and the ONE piece of browser-local state a reload must not
 * lose: which workspace was on screen. Everything else in `WorkbenchState` —
 * the active placement, whether the launcher is open — is this second's
 * business and restoring it would be restoring a dialog the user closed by
 * navigating away.
 *
 * `version` is the PRODUCT's envelope version, not the protocol's
 * `schemaVersion`: the document already refuses a schema it does not know,
 * and this is for a product changing what it wraps around one.
 */
export interface WorkbenchSnapshot {
  document: WorkbenchDocument;
  workspaceId?: string;
}

export interface ReadOptions {
  version?: number;
  storage?: StorageLike;
  /**
   * Bring an older envelope forward. Receives the parsed payload and the
   * version it claims; return the current shape, or null to discard it.
   * Never called for the current version.
   */
  migrate?(payload: unknown, fromVersion: number): unknown | null;
}

function storageOf(explicit?: StorageLike): StorageLike | null {
  if (explicit) return explicit;
  try {
    // Private modes and sandboxed frames throw on ACCESS, not on use.
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * Read a stored layout, for a product to hand to `createWorkbench` as
 * `initial`.
 *
 * Deliberately not folded into `createLocalPersistence`: a workbench that
 * restores itself after construction renders the default layout first and
 * then replaces it, which is a visible flash on every reload. Reading first
 * and constructing once has no flash, and makes "what did we restore" a
 * value the product can inspect rather than a side effect.
 *
 * Returns null for anything unusable — absent, unparseable, a schema this
 * build does not know, a tree naming views that are not there. Persistence
 * reads this on every load and a corrupted entry must fall back to the
 * default layout, never take the product down.
 */
export function readWorkbenchSnapshot(key: string, options: ReadOptions = {}): WorkbenchSnapshot | null {
  const storage = storageOf(options.storage);
  if (!storage) return null;
  const expected = options.version ?? PERSISTENCE_VERSION;
  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch {
    return null;
  }
  if (!raw) return null;
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!payload || typeof payload !== "object") return null;
  const claimed = (payload as { version?: unknown }).version;
  const version = typeof claimed === "number" ? claimed : PRE_ENVELOPE_VERSION;
  let current: unknown = payload;
  if (version !== expected) {
    if (!options.migrate) return null;
    current = options.migrate(payload, version);
    if (!current || typeof current !== "object") return null;
  }
  const envelope = current as { document?: unknown; workspaceId?: unknown };
  const document = parseDocument(
    typeof envelope.document === "string" ? envelope.document : JSON.stringify(envelope.document),
  );
  if (!document) return null;
  const workspaceId = typeof envelope.workspaceId === "string" ? envelope.workspaceId : undefined;
  return { document, ...(workspaceId ? { workspaceId } : {}) };
}

export interface LocalPersistenceOptions extends Omit<ReadOptions, "migrate"> {
  key: string;
  /** Trailing debounce, in ms; 0 writes synchronously. Default 250. */
  debounceMs?: number;
  /**
   * A write failed — a full quota, a storage that throws under a policy.
   * Never rethrown: a layout that cannot be saved is a degraded product, and
   * a layout that cannot be USED because saving threw is a broken one.
   */
  onError?(error: unknown): void;
}

export interface LocalPersistence {
  /** Write now, cancelling any pending debounce. */
  flush(): void;
  /** Stop listening. A pending write is flushed first, never dropped. */
  dispose(): void;
}

/**
 * Keep a workbench's layout in `localStorage` (§5.F).
 *
 * Subscribes to the STORE rather than to `onMutate`: a mutation batch is not
 * the only thing that changes what a reload should show. `replaceDocument`
 * (a restore, a reset, a server refetch) and a workspace switch are both
 * invisible to `onMutate`, and both must be written. The cost is that the
 * subscription also fires for activation and launcher toggles, which is paid
 * by comparing against the last snapshot written — document identity is
 * enough, because every mutation path installs a new object.
 */
export function createLocalPersistence(workbench: Workbench, options: LocalPersistenceOptions): LocalPersistence {
  const storage = storageOf(options.storage);
  const version = options.version ?? PERSISTENCE_VERSION;
  const debounceMs = options.debounceMs ?? 250;
  const store: WorkbenchStore = workbench.store;

  let lastDocument: WorkbenchDocument | null = null;
  let lastWorkspaceId: string | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  const write = () => {
    if (!storage || disposed) return;
    const state = store.getState();
    lastDocument = state.document;
    lastWorkspaceId = state.workspaceId;
    try {
      storage.setItem(
        options.key,
        JSON.stringify({
          version,
          document: JSON.parse(serializeDocument(state.document)),
          workspaceId: state.workspaceId,
        }),
      );
    } catch (error) {
      if (options.onError) options.onError(error);
      else console.warn(`pbui-workbench: could not persist the layout to "${options.key}"`, error);
    }
  };

  const cancel = () => {
    if (timer === null) return;
    clearTimeout(timer);
    timer = null;
  };

  const flush = () => {
    cancel();
    write();
  };

  const schedule = () => {
    const state = store.getState();
    // Activation and launcher toggles reach this subscription too; neither
    // is persisted, and neither should cost a write.
    if (state.document === lastDocument && state.workspaceId === lastWorkspaceId) return;
    if (debounceMs <= 0) {
      write();
      return;
    }
    // Trailing, and the timer is NOT reset on every notification: a drag that
    // commits ten times in 250ms should cost one write, not push the write
    // out until the drag stops.
    if (timer !== null) return;
    timer = setTimeout(() => {
      timer = null;
      write();
    }, debounceMs);
  };

  // The first write is immediate: a product that restored a layout and then
  // changed nothing still owns the key, and a crash before the first gesture
  // should not read as "never used".
  write();
  const unsubscribe = store.subscribe(schedule);

  // A debounced write is lost if the tab goes away inside the window.
  // `pagehide` fires for a close, a navigation and a bfcache freeze alike,
  // which `beforeunload` does not.
  const onHide = () => flush();
  const target = typeof window !== "undefined" ? window : null;
  target?.addEventListener("pagehide", onHide);

  return {
    flush,
    dispose() {
      if (disposed) return;
      flush();
      disposed = true;
      unsubscribe();
      target?.removeEventListener("pagehide", onHide);
    },
  };
}
