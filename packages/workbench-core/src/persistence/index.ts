import type { WorkbenchDocument } from "@hyperslop-systems/workbench-protocol";
import { applyMutations } from "@hyperslop-systems/workbench-protocol/client";
import type { ManifestCatalog } from "../apps";
import type { WorkbenchCore } from "../createWorkbenchCore";
import { parseWorkbenchDocument, serializeDocument } from "../document";
import { documentSourceMutations, type DocumentSource } from "../sources";
import { validateWorkbenchDocument } from "../validation";

/** The three methods this needs from `localStorage`, so a test can pass a Map. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** The current envelope version. A payload with no `version` reads as 0. */
export const PERSISTENCE_VERSION = 1;

/**
 * What a payload with no `version` field claims to be. Zero, not 1: every
 * product that hand-wrote this loop stored the bare serialised document
 * under the key, and calling that "version 1" would make it
 * indistinguishable from an envelope.
 */
export const PRE_ENVELOPE_VERSION = 0;

/**
 * What is written under the key: the document, and the ONE piece of
 * session state a reload must not lose — which workspace was on screen
 * (guide §15.1). The active placement and every shell dialog are this
 * second's business.
 */
export interface WorkbenchSnapshot {
  document: WorkbenchDocument;
  workspaceId?: string;
}

export interface ReadOptions {
  version?: number;
  storage?: StorageLike;
  /** Bring an older envelope forward; return the current shape, or null to discard it. Never called for the current version. */
  migrate?(payload: unknown, fromVersion: number): unknown | null;
  /** Validate the stored document against a catalog too, so a layout naming a retired application falls back rather than failing construction. */
  apps?: ManifestCatalog;
  /**
   * Hydrate before validating (design doc 04 §9.7): the stubs these
   * sources would contribute are added to the parsed document first, so a
   * layout stored before a source existed — or bound to a resource whose
   * stub was never persisted — is repaired, not discarded.
   */
  sources?: readonly DocumentSource[];
  /** Told why a stored entry was discarded; default silence (the product falls back to its default layout). */
  onDiscard?(reason: string): void;
}

function storageOf(explicit?: StorageLike): StorageLike | null {
  if (explicit) return explicit;
  try {
    // Private modes and sandboxed frames throw on ACCESS, not on use.
    return (globalThis as { localStorage?: StorageLike }).localStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * Read a stored layout, for a product to hand to `createWorkbenchCore` as
 * `initial`. Reading first and constructing once has no flash and makes
 * "what did we restore" a value the product can inspect. Returns null for
 * anything unusable; a corrupted entry must fall back to the default layout,
 * never take the product down.
 */
export function readWorkbenchSnapshot(key: string, options: ReadOptions = {}): WorkbenchSnapshot | null {
  const storage = storageOf(options.storage);
  if (!storage) return null;
  const expected = options.version ?? PERSISTENCE_VERSION;
  const discard = (reason: string): null => {
    options.onDiscard?.(reason);
    return null;
  };
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
    return discard("the stored entry is not JSON");
  }
  if (!payload || typeof payload !== "object") return discard("the stored entry is not an object");
  const claimed = (payload as { version?: unknown }).version;
  const version = typeof claimed === "number" ? claimed : PRE_ENVELOPE_VERSION;
  let current: unknown = payload;
  if (version !== expected) {
    if (!options.migrate) return discard(`envelope version ${version}, expected ${expected}, and no migrate was given`);
    current = options.migrate(payload, version);
    if (!current || typeof current !== "object") return discard(`migrate discarded envelope version ${version}`);
  }
  const envelope = current as { document?: unknown; workspaceId?: unknown };
  const explain = (diagnostics: readonly { code: string; path: string; detail: string }[]) => diagnostics.map((d) => `${d.code}${d.path ? ` at ${d.path}` : ""}: ${d.detail}`).join("; ");
  // Structural parse first, sources second, the catalog last.
  const parsed = parseWorkbenchDocument(typeof envelope.document === "string" ? envelope.document : JSON.stringify(envelope.document));
  if (!parsed.ok) return discard(explain(parsed.diagnostics));
  let document = parsed.document;
  for (const source of options.sources ?? []) {
    const { mutations } = documentSourceMutations(document, source);
    if (mutations.length > 0) document = applyMutations(document, mutations);
  }
  if (options.apps) {
    const checked = validateWorkbenchDocument(document, { apps: options.apps });
    if (!checked.ok) return discard(explain(checked.diagnostics));
  }
  const workspaceId = typeof envelope.workspaceId === "string" ? envelope.workspaceId : undefined;
  return { document, ...(workspaceId ? { workspaceId } : {}) };
}

export interface LocalPersistenceOptions extends Omit<ReadOptions, "migrate" | "apps" | "onDiscard"> {
  key: string;
  /** Trailing debounce, in ms; 0 writes synchronously. Default 250. */
  debounceMs?: number;
  /** A write failed. Never rethrown: a layout that cannot be saved is a degraded product, not a broken one. */
  onError?(error: unknown): void;
  /**
   * Flush on the host's "page is going away" signal. Default: `pagehide` on
   * `globalThis` when it can add listeners. Pass a no-op in a headless host.
   */
  onHide?(flush: () => void): () => void;
}

export interface LocalPersistence {
  /** Write now, cancelling any pending debounce. */
  flush(): void;
  /** Stop listening. A pending write is flushed first, never dropped. */
  dispose(): void;
}

/**
 * Keep a core's layout in `localStorage` (guide §15.1).
 *
 * Subscribes to the core's state rather than to `onCommit`: a mutation
 * batch is not the only thing that changes what a reload should show —
 * a replacement and a workspace switch are both invisible to `onCommit`.
 * Activation changes reach the subscription too and are filtered by
 * comparing document identity and the selected workspace.
 */
export function createLocalPersistence(core: WorkbenchCore, options: LocalPersistenceOptions): LocalPersistence {
  const storage = storageOf(options.storage);
  const version = options.version ?? PERSISTENCE_VERSION;
  const debounceMs = options.debounceMs ?? 250;

  let lastDocument: WorkbenchDocument | null = null;
  let lastWorkspaceId: string | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  const write = () => {
    if (!storage || disposed) return;
    const state = core.getState();
    lastDocument = state.document;
    lastWorkspaceId = state.session.workspaceId;
    try {
      storage.setItem(options.key, JSON.stringify({ version, document: JSON.parse(serializeDocument(state.document)), workspaceId: state.session.workspaceId }));
    } catch (error) {
      if (options.onError) options.onError(error);
      else console.warn(`workbench-core: could not persist the layout to "${options.key}"`, error);
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
    const state = core.getState();
    if (state.document === lastDocument && state.session.workspaceId === lastWorkspaceId) return;
    if (debounceMs <= 0) {
      write();
      return;
    }
    // Trailing, and NOT reset on every notification: a drag that commits ten
    // times in 250ms costs one write, not a write deferred until it stops.
    if (timer !== null) return;
    timer = setTimeout(() => {
      timer = null;
      write();
    }, debounceMs);
  };

  // The first write is immediate: a product that restored a layout and then
  // changed nothing still owns the key.
  write();
  const unsubscribe = core.subscribe(schedule);
  const stopHide = (options.onHide ?? defaultOnHide)(flush);

  return {
    flush,
    dispose() {
      if (disposed) return;
      flush();
      disposed = true;
      unsubscribe();
      stopHide();
    },
  };
}

/** `pagehide` fires for a close, a navigation, and a bfcache freeze alike, which `beforeunload` does not. */
function defaultOnHide(flush: () => void): () => void {
  const host = globalThis as { addEventListener?: (type: string, listener: () => void) => void; removeEventListener?: (type: string, listener: () => void) => void };
  if (typeof host.addEventListener !== "function" || typeof host.removeEventListener !== "function") return () => undefined;
  host.addEventListener("pagehide", flush);
  return () => host.removeEventListener?.("pagehide", flush);
}
