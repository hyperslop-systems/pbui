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
import { toJsonString } from "@bufbuild/protobuf";
import { MutationSchema, type Mutation, type WorkbenchDocument } from "@hyperslop-systems/workbench-protocol";
import { applyMutations, MutationError } from "@hyperslop-systems/workbench-protocol/client";

/**
 * Where the workbench stands with the server. `local`: not talking to one
 * yet. `probing`: the bootstrap request is out. `synced`: everything
 * committed is on the server. `pending`: batches are queued or in flight.
 * `offline`: a request failed and a retry is scheduled. `detached`: the
 * server says the row is gone, and nothing will be sent again.
 */
export type SyncPhase = "local" | "probing" | "synced" | "pending" | "offline" | "detached";

/** A revision as the server states it; opaque to this module, compared by equality. */
export type Revision = string;

export interface SyncResult {
  document: WorkbenchDocument;
  revision: Revision;
}

/** One committed local transition, kept whole until the server has it (guide §15.2, reduced). */
export interface OutboxEntry {
  /** Stable for the life of the entry; NOT the request id (several entries may ride one request). */
  readonly id: string;
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
   * `requestId` is stable for the request's CONTENT, so a retry after a
   * timeout is idempotent on the server side. Reject with a `SyncHttpError`
   * to let this module tell 409 and 422 apart from a network failure.
   */
  mutate(revision: Revision, mutations: Mutation[], requestId: string): Promise<SyncResult>;
  /** Subscribe to change notifications; return an unsubscribe. Optional. */
  stream?(onChange: (revision?: Revision) => void): () => void;
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
  onPhase?(phase: SyncPhase): void;
  /**
   * Every dropped batch, whole, with the reason: `invalid` (the server
   * refused it), `rebase` (it no longer applies to the server's document),
   * `conflict` (a destructive batch built on a revision that moved). A
   * product surfaces this as a notice; it must never claim the change landed.
   */
  onDropped?(entries: readonly OutboxEntry[], reason: DropReason): void;
  onError?(error: unknown): void;
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
  status(): { phase: SyncPhase; revision: Revision | null; queued: number; inFlight: number };
  /** Send whatever is queued now, and resolve when that attempt settles. */
  flush(): Promise<void>;
  /** Stop the timers and the stream. Anything queued stays queued and unsent. */
  dispose(): void;
}

/** The half of a core this needs; `createWorkbenchCore(...)` satisfies it. Replacement goes through the core's validated gateway. */
export interface SyncTarget {
  getState(): { document: WorkbenchDocument };
  replaceDocument(document: WorkbenchDocument): unknown;
}

const isDestructive = (mutations: readonly Mutation[]) => mutations.some((mutation) => mutation.body.case === "workspaceSetTree");

export function createWorkbenchSync(options: SyncOptions): WorkbenchSync {
  const { client } = options;
  const flushDelayMs = options.flushDelayMs ?? 400;
  const onInvalid = options.onInvalid ?? "drop";
  const backoff = options.backoffMs ?? [1000, 2000, 4000, 8000, 15000];

  let phase: SyncPhase = "local";
  let revision: Revision | null = null;
  let outbox: OutboxEntry[] = [];
  let inFlight: OutboxEntry[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  let failures = 0;
  let disposed = false;
  let running: Promise<void> | null = null;
  let streamDirty = false;
  let stopStream: (() => void) | null = null;
  let target: SyncTarget | null = null;
  let entryCounter = 0;
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
   * document is that plus everything not yet acknowledged.
   */
  const adopt = (result: SyncResult) => {
    revision = result.revision;
    if (!target) return;
    if (outbox.length === 0) {
      target.replaceDocument(result.document);
      return;
    }
    const { document, kept } = rebase(result.document, outbox, false);
    outbox = kept;
    target.replaceDocument(document);
  };

  /** A stable id for a request's CONTENT (the payloads, not only the kinds), so a retry is idempotent and a correction is not a replay. */
  const requestIdOf = (mutations: readonly Mutation[]): string => {
    const text = `${revision ?? ""}:${mutations.map((mutation) => toJsonString(MutationSchema, mutation)).join("|")}:${mutations.length}`;
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `wb-${(hash >>> 0).toString(36)}-${mutations.length}`;
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
      try {
        document = applyMutations(document, [...entry.mutations]);
        kept.push(entry);
      } catch (error) {
        if (!(error instanceof MutationError)) throw error;
        dropped.push(entry);
      }
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

  async function bootstrap(): Promise<boolean> {
    setPhase("probing");
    const existing = await client.get();
    if (existing) {
      adopt(existing);
      return true;
    }
    adopt(await client.create(target!.getState().document));
    return true;
  }

  async function pump(): Promise<void> {
    if (disposed || detached() || !target) return;
    if (running) return running;
    running = (async () => {
      try {
        if (revision === null) await bootstrap();
        while (!disposed && !detached() && outbox.length > 0) {
          if (conflicts >= MAX_CONFLICTS) throw new Error("workbench-core/sync: too many conflicts in a row; backing off");
          inFlight = outbox;
          outbox = [];
          setPhase("pending");
          await send(inFlight);
          inFlight = [];
        }
        if (!disposed && !detached()) {
          if (streamDirty && idle()) {
            streamDirty = false;
            const fresh = await client.get();
            if (fresh) adopt(fresh);
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

  /** One request carries several whole batches, in order; the server applies the request atomically. */
  async function send(batches: readonly OutboxEntry[]): Promise<void> {
    const mutations = batches.flatMap((entry) => [...entry.mutations]);
    try {
      adopt(await client.mutate(revision!, mutations, requestIdOf(mutations)));
    } catch (error) {
      if (!(error instanceof SyncHttpError)) throw error;
      if (error.status === 404) {
        outbox = [];
        inFlight = [];
        setPhase("detached");
        report(error);
        return;
      }
      if (error.status === 409) {
        const fresh = await client.get();
        if (!fresh) {
          setPhase("detached");
          return;
        }
        conflicts += 1;
        const { document, kept } = rebase(fresh.document, [...batches, ...outbox], true);
        revision = fresh.revision;
        target!.replaceDocument(document);
        outbox = kept;
        inFlight = [];
        return;
      }
      if (error.status === 422) {
        if (onInvalid === "isolate" && batches.length > 1) {
          // One of the batches is invalid and the server did not say which.
          // Send them one at a time — whole — so the innocent ones land and
          // the guilty one 422s alone and is dropped below.
          for (const entry of batches) await send([entry]);
          return;
        }
        drop(batches, "invalid");
        report(error);
        // The optimistic document contains a change the server refused.
        const fresh = await client.get();
        if (fresh) adopt(fresh);
        else setPhase("detached");
        return;
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
      entryCounter += 1;
      outbox = [...outbox, { id: `tx-${entryCounter}`, mutations: [...mutations], destructive: isDestructive(mutations) }];
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
