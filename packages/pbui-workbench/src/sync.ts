/**
 * Server sync for a workbench (PBUI-WORKBENCH-2 §5.F), React-free.
 *
 * The union of agentlogic's and turboproof's loops, which were written twice
 * and agree on every hard part: an outbox fed by committed batches, a
 * debounced `mutate` carrying the revision it was built against, a 409 that
 * refetches and REBASES the outbox one mutation at a time, a 422 that drops
 * the batch the server called invalid (or isolates to find which mutation it
 * meant), exponential backoff for everything else, and a change stream that
 * refetches only while the outbox is idle.
 *
 * Imported from `@hyperslop-systems/pbui-workbench/sync` rather than the
 * package root: a product with no server should not pay for this, and
 * nothing here touches React or the DOM.
 */
import type { Mutation, WorkbenchDocument } from "@hyperslop-systems/workbench-protocol";
import { applyMutation, MutationError } from "@hyperslop-systems/workbench-protocol/client";

/**
 * Where the workbench stands with the server.
 *
 * `local`: not talking to one yet (never probed, or no row). `probing`: the
 * bootstrap request is out. `synced`: everything committed is on the server.
 * `pending`: local changes are queued or in flight. `offline`: a request
 * failed and a retry is scheduled. `detached`: the server says the row is
 * gone, and nothing will be sent again — the layout is the user's to export,
 * not something to keep retrying into a 404.
 */
export type SyncPhase = "local" | "probing" | "synced" | "pending" | "offline" | "detached";

/** A revision as the server states it; opaque to this module, compared by equality. */
export type Revision = string;

export interface SyncResult {
  document: WorkbenchDocument;
  revision: Revision;
}

/**
 * What a product's HTTP layer must provide. Deliberately four small methods
 * over a transport this module never names: agentlogic's `POST /mutate` and
 * datalab's whole-document `PUT` differ in the wire, not in the loop.
 */
export interface SyncClient {
  /** Fetch the current server state; null when the row does not exist. */
  get(): Promise<SyncResult | null>;
  /** Create the row from the local document. Called once, when `get` returns null. */
  create(document: WorkbenchDocument): Promise<SyncResult>;
  /**
   * Send a batch against `revision`. `requestId` is stable for a batch's
   * CONTENT, so a retry after a timeout is idempotent on the server side.
   * Reject with a `SyncHttpError` to let this module tell 409 and 422 apart
   * from a network failure.
   */
  mutate(revision: Revision, mutations: Mutation[], requestId: string): Promise<SyncResult>;
  /**
   * Subscribe to change notifications. Call `onChange` when the server says
   * the document moved; return an unsubscribe. Optional — without it, other
   * tabs' changes arrive only on the next conflict.
   */
  stream?(onChange: (revision?: Revision) => void): () => void;
}

/**
 * The status a client attaches to a rejection so the loop can act on it.
 * 409 means "your revision is stale", 422 means "this batch is invalid",
 * 404 means "the row is gone"; anything else is treated as transport.
 */
export class SyncHttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "SyncHttpError";
    this.status = status;
  }
}

export interface SyncOptions {
  client: SyncClient;
  /** Trailing debounce before a flush, in ms. Default 400 — turboproof's and agentlogic's. */
  flushDelayMs?: number;
  /**
   * What a 422 means. `"drop"` discards the whole refused batch; `"isolate"`
   * re-sends the batch one mutation at a time so the survivors land and only
   * the guilty mutation is lost. Default `"drop"`.
   */
  onInvalid?: "drop" | "isolate";
  /** Backoff for transport failures, in ms; each retry doubles up to the last. Default [1000, 2000, 4000, 8000, 15000]. */
  backoffMs?: readonly number[];
  onPhase?(phase: SyncPhase): void;
  /** Every dropped mutation, with the reason. A product surfaces this as a notice. */
  onDropped?(mutations: Mutation[], reason: "invalid" | "rebase"): void;
  onError?(error: unknown): void;
}

export interface WorkbenchSync {
  /**
   * Queue a committed batch. Wire it as the workbench's `onMutate`, which is
   * the only thing that may add to the outbox: a batch nobody committed
   * locally must never reach the server, and `onMutate` fires for exactly
   * the batches that did.
   */
  enqueue(mutations: Mutation[]): void;
  /**
   * Give the loop the workbench to read and to replace, and start it.
   *
   * Separate from construction so a product can write
   * `createWorkbench({ onMutate: sync.enqueue })` without a circular
   * reference — the knot every one of these loops ties otherwise.
   */
  attach(target: SyncTarget): void;
  /** `queued`/`inFlight` count MUTATIONS, not batches: a rebase replays mutations. */
  status(): { phase: SyncPhase; revision: Revision | null; queued: number; inFlight: number };
  /** Send whatever is queued now, and resolve when that attempt settles. */
  flush(): Promise<void>;
  /** Stop the timers and the stream. Anything queued stays queued and unsent. */
  dispose(): void;
}

/** The half of a workbench this needs; `createWorkbench(...)` satisfies it. */
export interface SyncTarget {
  store: {
    getState(): { document: WorkbenchDocument };
    replaceDocument(document: WorkbenchDocument): void;
  };
}

export function createWorkbenchSync(options: SyncOptions): WorkbenchSync {
  const { client } = options;
  const flushDelayMs = options.flushDelayMs ?? 400;
  const onInvalid = options.onInvalid ?? "drop";
  const backoff = options.backoffMs ?? [1000, 2000, 4000, 8000, 15000];

  let phase: SyncPhase = "local";
  let revision: Revision | null = null;
  let outbox: Mutation[] = [];
  let inFlight: Mutation[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  let failures = 0;
  let disposed = false;
  let running: Promise<void> | null = null;
  let streamDirty = false;
  let stopStream: (() => void) | null = null;
  let target: SyncTarget | null = null;
  // A server that keeps moving under us is a livelock, not a conflict. After
  // this many rebases in a row the queue waits for a backoff instead of
  // spinning against a writer it cannot win against.
  let conflicts = 0;
  const MAX_CONFLICTS = 5;

  // Read through a call, never the variable: `phase` is assigned from
  // callbacks, and TypeScript's narrowing after an early `phase === "detached"`
  // return would otherwise convince it the later checks are dead code.
  const detached = () => phase === "detached";

  const setPhase = (next: SyncPhase) => {
    if (phase === next) return;
    phase = next;
    options.onPhase?.(next);
  };

  const report = (error: unknown) => {
    if (options.onError) options.onError(error);
    else console.warn("pbui-workbench/sync:", error);
  };

  const adopt = (result: SyncResult) => {
    revision = result.revision;
    target?.store.replaceDocument(result.document);
  };

  /**
   * A stable id for a batch's CONTENT. A retry after a timeout must carry the
   * id the first attempt carried, or the server applies the batch twice; two
   * DIFFERENT batches must never share one, or the second is swallowed as a
   * replay. Hashing the batch gives both without any bookkeeping.
   */
  const requestIdOf = (mutations: Mutation[]): string => {
    const text = `${revision ?? ""}:${JSON.stringify(mutations.map((mutation) => mutation.body.case ?? ""))}:${mutations.length}`;
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `wb-${(hash >>> 0).toString(36)}-${mutations.length}`;
  };

  /**
   * Replay the queue onto a document that moved underneath it, ONE MUTATION
   * AT A TIME. A rebase is not atomic and must not be: the point is to keep
   * the mutations that still apply and drop only the ones the other writer
   * made meaningless (a close of a tile they already closed). Routing this
   * through the store's atomic `mutate` would throw the whole queue away for
   * one stale entry — the mistake both products' comments warn about.
   */
  const rebase = (server: WorkbenchDocument, queue: Mutation[]): { document: WorkbenchDocument; kept: Mutation[] } => {
    let document = server;
    const kept: Mutation[] = [];
    const dropped: Mutation[] = [];
    for (const mutation of queue) {
      try {
        document = applyMutation(document, mutation);
        kept.push(mutation);
      } catch (error) {
        if (!(error instanceof MutationError)) throw error;
        dropped.push(mutation);
      }
    }
    if (dropped.length > 0) options.onDropped?.(dropped, "rebase");
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
      // The server's document wins on adoption: the local one is either
      // identical or a default nobody has touched yet.
      adopt(existing);
      return true;
    }
    adopt(await client.create(target!.store.getState().document));
    return true;
  }

  async function pump(): Promise<void> {
    if (disposed || detached() || !target) return;
    if (running) return running;
    running = (async () => {
      try {
        if (revision === null) await bootstrap();
        while (!disposed && !detached() && outbox.length > 0) {
          if (conflicts >= MAX_CONFLICTS) throw new Error("pbui-workbench/sync: too many conflicts in a row; backing off");
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
        // Anything that reached here is transport (the HTTP cases are handled
        // in `send`): keep the queue, back off, try again.
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

  async function send(batch: Mutation[]): Promise<void> {
    try {
      adopt(await client.mutate(revision!, batch, requestIdOf(batch)));
    } catch (error) {
      if (!(error instanceof SyncHttpError)) throw error;
      if (error.status === 404) {
        // The row is gone. Retrying into a 404 forever is worse than saying
        // so: the layout is still usable locally, and the product decides.
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
        const { document, kept } = rebase(fresh.document, [...batch, ...outbox]);
        revision = fresh.revision;
        target!.store.replaceDocument(document);
        outbox = kept;
        inFlight = [];
        return;
      }
      if (error.status === 422) {
        if (onInvalid === "isolate" && batch.length > 1) {
          // One of them is invalid and the server did not say which. Send
          // them singly so the innocent ones land; the guilty one 422s alone
          // and is dropped by the branch below.
          for (const mutation of batch) {
            await send([mutation]);
          }
          return;
        }
        options.onDropped?.(batch, "invalid");
        report(error);
        // The optimistic document contains a change the server refused. Only
        // the server knows what it now holds, so take its word for it.
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
      // a document that does not yet contain what is about to be sent, and
      // the queue would then rebase onto a version of itself.
      if (idle()) schedule(0);
    });
  }

  return {
    enqueue(mutations) {
      if (disposed || mutations.length === 0) return;
      outbox = [...outbox, ...mutations];
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
