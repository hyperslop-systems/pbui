/**
 * Server sync for a workbench core (guide §15, chosen form §16.9), React-free.
 *
 * The union of agentlogic's and turboproof's loops, which were written twice
 * and agree on every hard part: an outbox fed by committed batches, a
 * debounced `mutate` carrying the revision it was built against, a 409 that
 * refetches and REBASES the outbox, a 422 that drops the batch the server
 * called invalid, exponential backoff for everything else, and a change
 * stream that refetches only while the outbox is idle.
 *
 * What changed in PBUI-WORKBENCH-CORE-1 (F6, S9): the outbox holds WHOLE
 * committed batches. A local transition promised atomicity; the loop keeps
 * that promise all the way to the server. A batch is retried, rebased,
 * isolated, or dropped as one unit, never mutation by mutation, and a batch
 * that replaces a workspace tree wholesale conflicts rather than replays once
 * the server has moved.
 *
 * Imported from `@hyperslop-systems/workbench-core/sync` rather than the
 * package root: a product with no server should not pay for this.
 *
 * Version 1 provides optimistic single-user / multi-client persistence with
 * batch-level conflict detection. It does not provide collaborative
 * concurrent layout editing or CRDT convergence (§15.5).
 */
import { clone, toJsonString } from "@bufbuild/protobuf";
import { MutationSchema, WorkbenchDocumentSchema, type Mutation, type WorkbenchDocument } from "@hyperslop-systems/workbench-protocol";
import { applyMutations, MutationError } from "@hyperslop-systems/workbench-protocol/client";
import type { WorkbenchDiagnostic } from "../diagnostics";
import { newOperationId, operationId, type OperationId, type ServerRevision } from "../identity";

/**
 * Where the workbench stands with the server. `local`: not talking to one
 * yet. `probing`: the bootstrap request is out. `synced`: everything
 * committed is on the server. `pending`: batches are queued or in flight.
 * `offline`: a request failed and a retry is scheduled. `incompatible`: the
 * server answered with a document this client's catalog cannot accept — not
 * offline, not retryable (design doc 04 §7.2). `detached`: the server says
 * the row is gone, and nothing will be sent again.
 */
export type SyncPhase = "local" | "probing" | "synced" | "pending" | "offline" | "incompatible" | "detached";

export interface SyncResult {
  document: WorkbenchDocument;
  revision: ServerRevision;
}

/** One committed local transition, kept whole until the server has it (guide §15.2, reduced). */
export interface OutboxEntry {
  /** Stable for the life of the entry; NOT the request id (several entries may ride one request). */
  readonly id: OperationId;
  readonly mutations: readonly Mutation[];
  /**
   * The batch replaces a workspace tree wholesale (a rebalance). Such a
   * batch may apply structurally to a document another writer changed and
   * still overwrite their layout, so after a 409 it is reported as a
   * conflict instead of replayed.
   */
  readonly destructive: boolean;
}

/** What a product's HTTP layer must provide: four small methods over a transport this module never names. */
export interface SyncClient {
  /** Fetch the current server state; null when the row does not exist. */
  get(): Promise<SyncResult | null>;
  /** Create the row from the local document. Called once, when `get` returns null. */
  create(document: WorkbenchDocument): Promise<SyncResult>;
  /**
   * Send the mutations of one or more whole batches against `revision`.
   * `operationId` is stable for the logical request, so a retry after a
   * timeout is idempotent on the server side. Reject with a `SyncHttpError`
   * to let this module tell 409 and 422 apart from a network failure.
   */
  mutate(revision: ServerRevision, mutations: Mutation[], operationId: OperationId): Promise<SyncResult>;
  /** Subscribe to change notifications; return an unsubscribe. Optional. */
  stream?(onChange: (revision?: ServerRevision) => void): () => void;
}

/** 409: "your revision is stale"; 422: "this batch is invalid"; 404: "the row is gone"; anything else is transport. */
export class SyncHttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "SyncHttpError";
    this.status = status;
  }
}

export type DropReason = "invalid" | "rebase" | "conflict";

export interface SyncOptions {
  client: SyncClient;
  /** Trailing debounce before a flush, in ms. Default 400. */
  flushDelayMs?: number;
  /**
   * What a 422 means when a request carried SEVERAL batches. `"drop"`
   * discards them all; `"isolate"` re-sends the batches one at a time so the
   * innocent ones land and only the guilty batch is lost. A batch itself is
   * never split. Default `"drop"`.
   */
  onInvalid?: "drop" | "isolate";
  /** Backoff for transport failures, in ms; each retry doubles up to the last. Default [1000, 2000, 4000, 8000, 15000]. */
  backoffMs?: readonly number[];
  /** Mint one identity per enqueued local batch. Injectable for deterministic tests/replay. */
  operationIds?(): OperationId;
  onPhase?(phase: SyncPhase): void;
  /**
   * Every dropped batch, whole, with the reason: `invalid` (the server
   * refused it), `rebase` (it no longer applies to the server's document),
   * `conflict` (a destructive batch built on a revision that moved). A
   * product surfaces this as a notice; it must never claim the change landed.
   */
  onDropped?(entries: readonly OutboxEntry[], reason: DropReason): void;
  onError?(error: unknown): void;
  /** The server's document was refused by the local catalog (phase `incompatible`); the diagnostics say why. */
  onIncompatible?(diagnostics: readonly WorkbenchDiagnostic[]): void;
}

export interface WorkbenchSync {
  /**
   * Queue a committed batch, whole. Wire it as the core's `onCommit`
   * (`(receipt) => sync.enqueue(receipt.mutations)`): a batch nobody
   * committed locally must never reach the server, and `onCommit` fires for
   * exactly the batches that did.
   */
  enqueue(mutations: readonly Mutation[]): void;
  /** Give the loop the core to read and to replace, and start it. */
  attach(target: SyncTarget): void;
  /** `queued`/`inFlight` count BATCHES. */
  status(): { phase: SyncPhase; revision: ServerRevision | null; queued: number; inFlight: number };
  /** Send whatever is queued now, and resolve when that attempt settles. */
  flush(): Promise<void>;
  /** Stop the timers and the stream. Anything queued stays queued and unsent. */
  dispose(): void;
}

/**
 * The half of a core this needs; `createWorkbenchCore(...)` satisfies it.
 * Replacement goes through the core's validated gateway and is ACKNOWLEDGED
 * (design doc 04 §7.2): the revision, the outbox and the phase advance only
 * after the target accepted the document. `validateDocument` lets a rebased
 * candidate be checked against the catalog before an entry is kept, since
 * the protocol applier proves structural applicability only (§7.3).
 */
export interface SyncTarget {
  getState(): { document: WorkbenchDocument };
  replaceDocument(document: WorkbenchDocument): { ok: true } | { ok: false; diagnostics: readonly WorkbenchDiagnostic[] };
  validateDocument?(document: WorkbenchDocument): { ok: true } | { ok: false; diagnostics: readonly WorkbenchDiagnostic[] };
}

const isDestructive = (mutations: readonly Mutation[]) => mutations.some((mutation) => mutation.body.case === "workspaceSetTree");

const frame = (value: string): string => `${new TextEncoder().encode(value).byteLength}:${value}`;

/**
 * Collision-resistant identity for one concrete transport attempt.
 *
 * Batch UUIDs distinguish separately intended operations with identical
 * contents. Canonical mutation JSON makes the identity faithful to the bytes
 * being sent. Length framing prevents values from imitating boundaries.
 */
export async function syncRequestOperationId(
  revision: ServerRevision,
  batches: readonly OutboxEntry[],
): Promise<OperationId> {
  const framed = [frame("pbui-workbench-sync-v1"), frame(revision), frame(String(batches.length))];
  for (const batch of batches) {
    framed.push(frame(batch.id), frame(String(batch.mutations.length)));
    for (const mutation of batch.mutations) {
      framed.push(frame(toJsonString(MutationSchema, mutation)));
    }
  }
  const bytes = new TextEncoder().encode(framed.join(""));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return operationId(`wb-sha256-${hex}`);
}

export function createWorkbenchSync(options: SyncOptions): WorkbenchSync {
  const { client } = options;
  const flushDelayMs = options.flushDelayMs ?? 400;
  const onInvalid = options.onInvalid ?? "drop";
  const backoff = options.backoffMs ?? [1000, 2000, 4000, 8000, 15000];
  const nextOperationId = options.operationIds ?? (() => newOperationId());

  let phase: SyncPhase = "local";
  let revision: ServerRevision | null = null;
  let outbox: OutboxEntry[] = [];
  let inFlight: OutboxEntry[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  let failures = 0;
  let disposed = false;
  let running: Promise<void> | null = null;
  let streamDirty = false;
  let stopStream: (() => void) | null = null;
  let target: SyncTarget | null = null;
  // A server that keeps moving under us is a livelock, not a conflict.
  let conflicts = 0;
  const MAX_CONFLICTS = 5;

  const detached = () => phase === "detached";

  const setPhase = (next: SyncPhase) => {
    if (phase === next) return;
    phase = next;
    options.onPhase?.(next);
  };

  const report = (error: unknown) => {
    if (options.onError) options.onError(error);
    else console.warn("workbench-core/sync:", error);
  };

  const drop = (entries: readonly OutboxEntry[], reason: DropReason) => {
    if (entries.length > 0) options.onDropped?.(entries, reason);
  };

  /**
   * Install a server document, keeping what is still queued: a response is
   * a snapshot of what the server had when it answered, and the local
   * document is that plus everything not yet acknowledged — the outbox, and
   * `extra`: entries the caller still holds in flight (an isolation loop, a
   * 409 rebase) that must stay overlaid rather than roll back on screen.
   *
   * Acknowledged: nothing advances until the target accepted the candidate.
   * A refusal is `incompatible` — the server is reachable, the document is
   * not one this catalog can show — and leaves revision and queue alone.
   * Returns the `extra` entries that still apply, for the caller to keep.
   */
  const adopt = (result: SyncResult, extra: readonly OutboxEntry[] = [], afterConflict = false): { ok: boolean; keptExtra: OutboxEntry[] } => {
    if (!target) return { ok: false, keptExtra: [...extra] };
    const queue = [...extra, ...outbox];
    const { document, kept } = queue.length > 0 ? rebase(result.document, queue, afterConflict) : { document: result.document, kept: [] as OutboxEntry[] };
    const accepted = target.replaceDocument(document);
    if (!accepted.ok) {
      options.onIncompatible?.(accepted.diagnostics);
      report(new Error(`workbench-core/sync: the server's document was refused locally — ${accepted.diagnostics[0]?.code}: ${accepted.diagnostics[0]?.detail}`));
      setPhase("incompatible");
      return { ok: false, keptExtra: [...extra] };
    }
    revision = result.revision;
    const extraSet = new Set(extra);
    outbox = kept.filter((entry) => !extraSet.has(entry));
    return { ok: true, keptExtra: kept.filter((entry) => extraSet.has(entry)) };
  };

  /**
   * Replay the queue onto a document that moved underneath it, ONE BATCH AT
   * A TIME. A batch either applies whole or is dropped whole; the point is to
   * keep the transitions that still make sense and drop only the ones the
   * other writer made meaningless (a close of a tile they already closed).
   * After a conflict, a destructive batch is never replayed.
   */
  const rebase = (server: WorkbenchDocument, queue: readonly OutboxEntry[], afterConflict: boolean): { document: WorkbenchDocument; kept: OutboxEntry[] } => {
    let document = server;
    const kept: OutboxEntry[] = [];
    const dropped: OutboxEntry[] = [];
    const conflicted: OutboxEntry[] = [];
    for (const entry of queue) {
      if (afterConflict && entry.destructive) {
        conflicted.push(entry);
        continue;
      }
      let candidate: WorkbenchDocument;
      try {
        candidate = applyMutations(document, [...entry.mutations]);
      } catch (error) {
        if (!(error instanceof MutationError)) throw error;
        dropped.push(entry);
        continue;
      }
      // Structurally applicable is not the same as acceptable (§7.3): the
      // target's catalog decides whether the candidate may be installed.
      const checked = target?.validateDocument?.(candidate);
      if (checked && !checked.ok) {
        dropped.push(entry);
        continue;
      }
      document = candidate;
      kept.push(entry);
    }
    drop(conflicted, "conflict");
    drop(dropped, "rebase");
    return { document, kept };
  };

  const schedule = (delay = flushDelayMs) => {
    if (disposed || timer !== null) return;
    timer = setTimeout(() => {
      timer = null;
      void pump();
    }, delay);
  };

  const idle = () => outbox.length === 0 && inFlight.length === 0;

  /**
   * The first request (design doc 04 §7.1). A row that exists is adopted.
   * A missing row is CREATED from the local document — which already
   * contains everything queued, so those entries are acknowledged by the
   * creation itself rather than rebased over the very document they built.
   * Entries queued while the request is out are overlaid afterwards, and a
   * failed creation puts the covered entries back ahead of them.
   */
  async function bootstrap(): Promise<boolean> {
    setPhase("probing");
    const existing = await client.get();
    if (existing) return adopt(existing).ok;
    const covered = outbox;
    outbox = [];
    const snapshot = clone(WorkbenchDocumentSchema, target!.getState().document);
    let created: SyncResult;
    try {
      created = await client.create(snapshot);
    } catch (error) {
      outbox = [...covered, ...outbox];
      throw error;
    }
    return adopt(created).ok;
  }

  async function pump(): Promise<void> {
    if (disposed || detached() || !target) return;
    if (running) return running;
    running = (async () => {
      try {
        if (revision === null && !(await bootstrap())) return;
        while (!disposed && !detached() && outbox.length > 0) {
          if (conflicts >= MAX_CONFLICTS) throw new Error("workbench-core/sync: too many conflicts in a row; backing off");
          inFlight = outbox;
          outbox = [];
          setPhase("pending");
          await send(inFlight);
          inFlight = [];
          if (phase === "incompatible") return;
        }
        if (!disposed && !detached()) {
          if (streamDirty && idle()) {
            streamDirty = false;
            const fresh = await client.get();
            if (fresh && !adopt(fresh).ok) return;
          }
          setPhase(idle() ? "synced" : "pending");
          failures = 0;
          conflicts = 0;
        }
      } catch (error) {
        // Transport: keep the queue, back off, try again.
        outbox = [...inFlight, ...outbox];
        inFlight = [];
        report(error);
        setPhase("offline");
        const delay = backoff[Math.min(failures, backoff.length - 1)] ?? 1000;
        failures += 1;
        schedule(delay);
      } finally {
        running = null;
      }
    })();
    return running;
  }

  /**
   * One request carries several whole batches, in order; the server applies
   * the request atomically. `remaining` are batches the caller still holds
   * in flight after this one (the isolation loop): any adoption here keeps
   * them overlaid so the screen never rolls back a change that is still
   * pending (§7.4).
   */
  async function send(batches: readonly OutboxEntry[], remaining: OutboxEntry[] = []): Promise<OutboxEntry[]> {
    const mutations = batches.flatMap((entry) => [...entry.mutations]);
    try {
      const requestOperationId = await syncRequestOperationId(revision!, batches);
      return adopt(await client.mutate(revision!, mutations, requestOperationId), remaining).keptExtra;
    } catch (error) {
      if (!(error instanceof SyncHttpError)) throw error;
      if (error.status === 404) {
        outbox = [];
        inFlight = [];
        setPhase("detached");
        report(error);
        return [];
      }
      if (error.status === 409) {
        const fresh = await client.get();
        if (!fresh) {
          setPhase("detached");
          return [];
        }
        conflicts += 1;
        // The batches that were refused go back in front of the queue and
        // are rebased with it; a destructive one is a conflict, not a replay.
        outbox = [...batches, ...remaining, ...outbox];
        inFlight = [];
        adopt(fresh, [], true);
        return [];
      }
      if (error.status === 422) {
        if (onInvalid === "isolate" && batches.length > 1) {
          // One of the batches is invalid and the server did not say which.
          // Send them one at a time — whole — so the innocent ones land and
          // the guilty one 422s alone and is dropped below. The ones not yet
          // sent stay overlaid through every adoption in between.
          let pending = [...batches];
          while (pending.length > 0) {
            const entry = pending.shift()!;
            if (phase === "detached" || phase === "incompatible") return [];
            pending = await send([entry], [...pending, ...remaining]);
            const remainingSet = new Set(remaining);
            remaining = pending.filter((item) => remainingSet.has(item));
            pending = pending.filter((item) => !remainingSet.has(item));
          }
          return remaining;
        }
        drop(batches, "invalid");
        report(error);
        // The optimistic document contains a change the server refused.
        const fresh = await client.get();
        if (fresh) return adopt(fresh, remaining).keptExtra;
        setPhase("detached");
        return [];
      }
      throw error;
    }
  }

  if (client.stream) {
    stopStream = client.stream(() => {
      streamDirty = true;
      // Deferred while anything is queued: refetching mid-flush would adopt
      // a document that does not yet contain what is about to be sent.
      if (idle()) schedule(0);
    });
  }

  return {
    enqueue(mutations) {
      if (disposed || mutations.length === 0) return;
      outbox = [...outbox, { id: nextOperationId(), mutations: [...mutations], destructive: isDestructive(mutations) }];
      if (!detached()) setPhase("pending");
      schedule();
    },
    attach(next) {
      target = next;
      schedule(0);
    },
    status: () => ({ phase, revision, queued: outbox.length, inFlight: inFlight.length }),
    flush() {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      return pump();
    },
    dispose() {
      disposed = true;
      if (timer !== null) clearTimeout(timer);
      timer = null;
      stopStream?.();
      stopStream = null;
    },
  };
}
