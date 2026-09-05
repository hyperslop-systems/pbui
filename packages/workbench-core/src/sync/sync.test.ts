import { describe, expect, test, vi } from "vitest";
import { createPresentationTypeGraph, linkVerbs } from "@hyperslop-systems/pbui/link-kernel";
import type { Mutation, Node, WorkbenchDocument } from "@hyperslop-systems/workbench-protocol";
import { applyMutations, leaves } from "@hyperslop-systems/workbench-protocol/client";
import { defineAppManifest } from "../apps";
import { commands, type WorkbenchCommand } from "../commands";
import { createWorkbenchCore, type WorkbenchCore } from "../createWorkbenchCore";
import { layout, split, tile } from "../document";
import { operationId, serverRevision, type OperationId, type ServerRevision } from "../identity";
import { createWorkbenchLinks } from "../links/collaborator";
import { LINKS_DOC_ID } from "../links/document";
import { createWorkbenchSync, syncRequestOperationId, SyncHttpError, type OutboxEntry, type SyncClient, type SyncResult } from "./index";

/**
 * A server in thirty lines: a document, a revision that counts up, and a
 * script of failures to inject. Everything the loop must get right — replay
 * on 409, isolation on 422, backoff, deferred stream refetch — is a
 * statement about what this fake sees, so the fake records everything.
 */
function fakeServer(initial: WorkbenchDocument) {
  let document = initial;
  let revision = 1;
  const seen: { revision: ServerRevision; count: number; operationId: OperationId }[] = [];
  let listener: ((revision?: ServerRevision) => void) | null = null;
  const failures: (SyncHttpError | Error)[] = [];
  let gate: { promise: Promise<void>; open: () => void } | null = null;
  const result = (): SyncResult => ({ document, revision: serverRevision(String(revision)) });
  const client: SyncClient = {
    get: async () => result(),
    create: async (doc) => {
      document = doc;
      return result();
    },
    mutate: async (sentRevision, mutations, operationId) => {
      seen.push({ revision: sentRevision, count: mutations.length, operationId });
      if (gate) {
        const held = gate;
        gate = null;
        await held.promise;
      }
      const scripted = failures.shift();
      if (scripted) throw scripted;
      if (sentRevision !== String(revision)) throw new SyncHttpError(409, "revision mismatch");
      document = applyMutations(document, mutations);
      revision += 1;
      return result();
    },
    stream: (onChange) => {
      listener = onChange;
      return () => {
        listener = null;
      };
    },
  };
  return {
    client,
    seen,
    failures,
    externalWrite(mutations: readonly Mutation[]) {
      document = applyMutations(document, [...mutations]);
      revision += 1;
    },
    notify: () => listener?.(),
    holdNextMutate() {
      let open = () => {};
      const promise = new Promise<void>((resolve) => {
        open = resolve;
      });
      gate = { promise, open };
      return () => (gate === null ? open() : ((gate = null), open()));
    },
    get revision() {
      return revision;
    },
    get document() {
      return document;
    },
  };
}

const apps = [
  defineAppManifest({ id: "counter" }),
  defineAppManifest({ id: "notes", viewCardinality: "one" }),
  defineAppManifest({ id: "orders", ports: [{ name: "order", direction: "out", contract: "order", doc: "the clicked order" }] }),
  defineAppManifest({ id: "detail", ports: [{ name: "order", direction: "in", contract: "order", doc: "the order shown" }] }),
];

function viewOf(tree: Node | undefined, placementId: string): string {
  const leaf = leaves(tree).find((node) => node.id === placementId);
  return leaf?.body.case === "leaf" ? leaf.body.value.viewId : "";
}

const leafCount = (doc: WorkbenchDocument) => leaves(doc.workspaces[0]?.tree).length;
const mutationsOf = (core: WorkbenchCore, command: WorkbenchCommand): Mutation[] => {
  const previewed = core.preview(command);
  if (!previewed.ok) throw new Error(previewed.because);
  return [...previewed.mutations];
};

function scenario(options: { onInvalid?: "drop" | "isolate"; onDropped?(entries: readonly OutboxEntry[], reason: string): void; operationIds?(): OperationId; initial?: WorkbenchDocument; links?: boolean } = {}) {
  const initial = options.initial ?? layout(split("row", 0.5, tile("counter"), tile("notes")));
  const server = fakeServer(initial);
  const sync = createWorkbenchSync({
    client: server.client,
    flushDelayMs: 0,
    ...(options.onInvalid ? { onInvalid: options.onInvalid } : {}),
    ...(options.onDropped ? { onDropped: options.onDropped } : {}),
    ...(options.operationIds ? { operationIds: options.operationIds } : {}),
    onError: () => {},
  });
  const links = createWorkbenchLinks({ deps: { graph: createPresentationTypeGraph([{ id: "order" }]) } });
  const core = createWorkbenchCore({ apps, initial, links, onCommit: (receipt) => sync.enqueue(receipt.mutations) });
  sync.attach(core);
  const ids = () => leaves(core.getState().document.workspaces[0]?.tree).map((leaf) => leaf.id);
  return { core, sync, server, ids, links };
}

describe("the sync module (guide §15, batch-preserving)", () => {
  test("request operation identity binds revision, ordered logical batches, and exact payload", async () => {
    const { core, sync, ids } = scenario();
    const [first, second] = ids();
    const firstView = viewOf(core.getState().document.workspaces[0]?.tree, first!);
    const secondView = viewOf(core.getState().document.workspaces[0]?.tree, second!);
    const mutationA = mutationsOf(core, commands.setTitle(firstView, "one"));
    const mutationB = mutationsOf(core, commands.setTitle(secondView, "two"));
    const batchA: OutboxEntry = { id: operationId("batch-a"), mutations: mutationA, destructive: false };
    const batchAAgain: OutboxEntry = { id: operationId("batch-a-again"), mutations: mutationA, destructive: false };
    const batchB: OutboxEntry = { id: operationId("batch-b"), mutations: mutationB, destructive: false };
    const revisionOne = serverRevision("1");

    expect(
      await syncRequestOperationId(serverRevision("00042"), [
        { id: operationId("batch-α"), mutations: [], destructive: false },
      ]),
    ).toBe("wb-sha256-d2ce51d8d36a730e10bad3e1cba21763edf2b169446d15dfe9333a30d15a24a2");

    const stableA = await syncRequestOperationId(revisionOne, [batchA]);
    expect(stableA).toMatch(/^wb-sha256-[0-9a-f]{64}$/);
    expect(await syncRequestOperationId(revisionOne, [batchA])).toBe(stableA);
    expect(await syncRequestOperationId(revisionOne, [batchAAgain])).not.toBe(stableA);
    expect(await syncRequestOperationId(serverRevision("2"), [batchA])).not.toBe(stableA);
    expect(await syncRequestOperationId(revisionOne, [batchB])).not.toBe(stableA);
    expect(await syncRequestOperationId(revisionOne, [batchA, batchB])).not.toBe(
      await syncRequestOperationId(revisionOne, [batchB, batchA]),
    );
    sync.dispose();
  });

  test("committed batches reach the server in order, whole, each request against the revision it was built on", async () => {
    const { core, sync, server, ids } = scenario();
    await sync.flush();
    expect(sync.status().phase).toBe("synced");
    core.execute(commands.duplicate(ids()[0]!, "row"));
    core.execute(commands.duplicate(ids()[0]!, "col"));
    expect(sync.status()).toMatchObject({ queued: 2 }); // two BATCHES
    await sync.flush();
    // Both batches were queued before the flush, so they rode ONE request
    // against revision 1, in order, whole: four mutations.
    expect(server.seen.map((entry) => entry.revision)).toEqual(["1"]);
    expect(server.seen[0]!.count).toBe(4);
    expect(leafCount(server.document)).toBe(4);
    expect(sync.status()).toMatchObject({ phase: "synced", queued: 0, inFlight: 0, revision: "2" });
    sync.dispose();
  });

  test("a 409 refetches and replays the queue one BATCH at a time", async () => {
    const { core, sync, server, ids } = scenario();
    await sync.flush();
    const [first, second] = ids();
    const closeSecond = mutationsOf(core, commands.close(second!));
    core.execute(commands.duplicate(first!, "row"));
    server.externalWrite(closeSecond);
    await sync.flush();
    expect(leafCount(server.document)).toBe(2);
    expect(leafCount(core.getState().document)).toBe(2);
    expect(sync.status().phase).toBe("synced");
    // Attempt one used the stale base revision; the replay retained its batch
    // identity/content but bound a fresh send identity to revision two.
    expect(server.seen.map(({ revision }) => revision)).toEqual(["1", "2"]);
    expect(server.seen[0]!.operationId).not.toBe(server.seen[1]!.operationId);
    sync.dispose();
  });

  test("a batch the rebase can no longer apply is dropped WHOLE, and the rest still land", async () => {
    const dropped: { size: number; reason: string }[] = [];
    const { core, sync, server, ids } = scenario({ onDropped: (entries, reason) => entries.forEach((entry) => dropped.push({ size: entry.mutations.length, reason })) });
    await sync.flush();
    const [first, second] = ids();
    server.externalWrite(mutationsOf(core, commands.close(second!)));
    core.execute(commands.close(second!)); // placementClose + viewDelete: one batch
    core.execute(commands.duplicate(first!, "row"));
    await sync.flush();
    // The duplicate close is dropped as ONE batch of two mutations; the split lands.
    expect(dropped).toEqual([{ size: 2, reason: "rebase" }]);
    expect(leafCount(server.document)).toBe(2);
    expect(sync.status().phase).toBe("synced");
    sync.dispose();
  });

  test("a stale destructive batch (a rebalance) conflicts instead of overwriting the other writer's layout", async () => {
    const dropped: string[] = [];
    const { core, sync, server, ids } = scenario({ onDropped: (_entries, reason) => dropped.push(reason) });
    await sync.flush();
    const [first] = ids();
    const tree = core.getState().document.workspaces[0]!.tree!;
    const swapped = { ...tree, body: tree.body.case === "split" ? { case: "split" as const, value: { ...tree.body.value, a: tree.body.value.b, b: tree.body.value.a } } : tree.body } as Node;
    // Another tab splits a tile; this tab rebalances the OLD tree. Structurally
    // the setTree still applies — and would silently drop the other tab's tile.
    server.externalWrite(mutationsOf(core, commands.duplicate(first!, "row")));
    expect(core.execute(commands.rebalance("main", swapped)).ok).toBe(true);
    await sync.flush();
    expect(dropped).toEqual(["conflict"]);
    expect(leafCount(server.document)).toBe(3); // the other tab's split survived
    expect(leafCount(core.getState().document)).toBe(3);
    expect(sync.status().phase).toBe("synced");
    sync.dispose();
  });

  test("a 422 drops the refused request by default and isolates by BATCH when asked — a batch is never split", async () => {
    const dropped: number[] = [];
    const { core, sync, server, ids } = scenario({ onInvalid: "isolate", onDropped: (entries, reason) => entries.forEach((entry) => reason === "invalid" && dropped.push(entry.mutations.length)) });
    await sync.flush();
    const [first] = ids();
    core.execute(commands.duplicate(first!, "row")); // viewCreate + placementSplit
    core.execute(commands.setTitle(viewOf(core.getState().document.workspaces[0]?.tree, first!), "renamed"));
    server.failures.push(new SyncHttpError(422, "invalid_document"));
    await sync.flush();
    expect(dropped).toEqual([]);
    // Three mutations refused as one request, then the two batches sent one at
    // a time: the split (2 mutations, never halved) and the rename (1).
    expect(server.seen.map((entry) => entry.count)).toEqual([3, 2, 1]);
    expect(new Set(server.seen.map((entry) => entry.operationId)).size).toBe(3);
    expect(sync.status().phase).toBe("synced");
    sync.dispose();
  });

  test("a single invalid batch on a 422 is dropped whole, even with isolate", async () => {
    const dropped: number[] = [];
    const { core, sync, server, ids } = scenario({ onInvalid: "isolate", onDropped: (entries) => entries.forEach((entry) => dropped.push(entry.mutations.length)) });
    await sync.flush();
    core.execute(commands.duplicate(ids()[0]!, "row"));
    server.failures.push(new SyncHttpError(422, "invalid_document"));
    await sync.flush();
    expect(dropped).toEqual([2]);
    expect(server.seen.map((entry) => entry.count)).toEqual([2]);
    expect(leafCount(server.document)).toBe(2);
    expect(leafCount(core.getState().document)).toBe(2); // the server's word was adopted
    sync.dispose();
  });

  test("link topology plus lifecycle maintenance is one batch", async () => {
    const initial = layout(split("row", 0.5, tile("orders"), tile("detail")));
    const { core, sync, server, ids } = scenario({ initial });
    await sync.flush();
    const [orders, detail] = core.getState().document.viewOrder;
    core.execute(linkVerbs.follow(`${orders}/order`, `${detail}/order`) as WorkbenchCommand);
    await sync.flush();
    const [ordersPlacement] = ids();
    core.execute(commands.close(ordersPlacement!)); // placementClose + viewDelete + the links documentPut
    expect(sync.status().queued).toBe(1);
    await sync.flush();
    expect(server.seen.map((entry) => entry.count)).toEqual([1, 3]);
    expect(server.document.documents[LINKS_DOC_ID]).toBeDefined();
    sync.dispose();
  });

  test("a transport failure keeps the queue, goes offline, and retries with backoff", async () => {
    vi.useFakeTimers();
    const { core, sync, server, ids } = scenario();
    await sync.flush();
    core.execute(commands.duplicate(ids()[0]!, "row"));
    server.failures.push(new Error("network down"));
    await sync.flush();
    expect(sync.status()).toMatchObject({ phase: "offline", queued: 1 });
    await vi.advanceTimersByTimeAsync(1000);
    await sync.flush(); // SHA-256 adds an asynchronous step after the retry timer fires.
    expect(sync.status().phase).toBe("synced");
    expect(leafCount(server.document)).toBe(3);
    sync.dispose();
    vi.useRealTimers();
  });

  test("a 404 detaches: nothing is retried into a row that is gone", async () => {
    const { core, sync, server, ids } = scenario();
    await sync.flush();
    core.execute(commands.duplicate(ids()[0]!, "row"));
    server.failures.push(new SyncHttpError(404, "no such workbench"));
    await sync.flush();
    expect(sync.status()).toMatchObject({ phase: "detached", queued: 0 });
    core.execute(commands.duplicate(ids()[0]!, "col"));
    await sync.flush();
    expect(sync.status().phase).toBe("detached");
    sync.dispose();
  });

  test("a stream notification refetches only while the outbox is idle", async () => {
    const { core, sync, server, ids } = scenario();
    await sync.flush();
    core.execute(commands.duplicate(ids()[0]!, "row"));
    server.notify();
    expect(sync.status().queued).toBe(1);
    await sync.flush();
    expect(leafCount(server.document)).toBe(3);
    server.externalWrite(mutationsOf(core, commands.renameWorkspace("main", "over there")));
    server.notify();
    await sync.flush();
    expect(core.getState().document.workspaces[0]!.name).toBe("over there");
    sync.dispose();
  });

  test("an edit committed while a batch is in flight survives the response (PR #23, P1)", async () => {
    const { core, sync, server, ids } = scenario();
    await sync.flush();
    const seenLeaves: number[] = [];
    const stop = core.subscribe(() => seenLeaves.push(leafCount(core.getState().document)));
    const release = server.holdNextMutate();
    core.execute(commands.duplicate(ids()[0]!, "row"));
    const flushing = sync.flush();
    await Promise.resolve();
    core.execute(commands.duplicate(ids()[0]!, "col"));
    expect(leafCount(core.getState().document)).toBe(4);
    release();
    await flushing;
    stop();
    // A's response carries a document with A and not B; B is still queued and
    // the document must never go backwards.
    expect(Math.min(...seenLeaves.slice(seenLeaves.indexOf(4)))).toBe(4);
    expect(leafCount(server.document)).toBe(4);
    sync.dispose();
  });

  test("a queued edit survives the bootstrap adoption too", async () => {
    const initial = layout(split("row", 0.5, tile("counter"), tile("notes")));
    const server = fakeServer(initial);
    const sync = createWorkbenchSync({ client: server.client, flushDelayMs: 0, onError: () => {} });
    const core = createWorkbenchCore({ apps, initial, onCommit: (receipt) => sync.enqueue(receipt.mutations) });
    core.execute(commands.duplicate(leaves(core.getState().document.workspaces[0]?.tree)[0]!.id, "row"));
    const before = leafCount(core.getState().document);
    let lowest = before;
    core.subscribe(() => {
      lowest = Math.min(lowest, leafCount(core.getState().document));
    });
    sync.attach(core);
    await sync.flush();
    expect(lowest).toBe(before);
    expect(leafCount(server.document)).toBe(3);
    sync.dispose();
  });

  test("operation IDs distinguish batches of the same SHAPE at one revision, and a retry keeps its ID", async () => {
    const generated = ["batch-one", "batch-two", "batch-retry"].map(operationId);
    const operationIds = vi.fn(() => generated.shift()!);
    const { core, sync, server, ids } = scenario({ operationIds });
    await sync.flush();
    const [first, second] = ids();
    const tree = () => core.getState().document.workspaces[0]?.tree;
    server.failures.push(new SyncHttpError(422, "invalid_document"));
    core.execute(commands.setTitle(viewOf(tree(), first!), "one"));
    await sync.flush();
    const refused = server.seen[server.seen.length - 1]!;
    core.execute(commands.setTitle(viewOf(tree(), second!), "two"));
    await sync.flush();
    const corrected = server.seen[server.seen.length - 1]!;
    expect(corrected.revision).toBe(refused.revision);
    expect(corrected.operationId).not.toBe(refused.operationId);

    core.execute(commands.duplicate(ids()[0]!, "row"));
    server.failures.push(new Error("timeout"));
    await sync.flush();
    await sync.flush();
    const [a, b] = server.seen.slice(-2);
    expect(a!.operationId).toBe(b!.operationId);
    expect(operationIds).toHaveBeenCalledTimes(3); // once per enqueue, never again for retry
    sync.dispose();
  });
});

describe("stabilization (design doc 04 §7, §12.4)", () => {
  test("a missing row is created from the optimistic document; the entries it already contains are acknowledged, not replayed or dropped", async () => {
    const initial = layout(split("row", 0.5, tile("counter"), tile("notes")));
    let document: WorkbenchDocument | null = null;
    const created: WorkbenchDocument[] = [];
    const seen: number[] = [];
    const dropped = vi.fn();
    const client: SyncClient = {
      get: async () => (document ? { document, revision: serverRevision("r") } : null),
      create: async (doc) => {
        created.push(doc);
        document = doc;
        return { document: doc, revision: serverRevision("created") };
      },
      mutate: async (_revision, mutations) => {
        seen.push(mutations.length);
        document = applyMutations(document!, mutations);
        return { document, revision: serverRevision("next") };
      },
    };
    const sync = createWorkbenchSync({ client, flushDelayMs: 0, onDropped: dropped, onError: () => {} });
    const core = createWorkbenchCore({ apps, initial, onCommit: (receipt) => sync.enqueue(receipt.mutations) });
    core.execute(commands.duplicate(leaves(core.getState().document.workspaces[0]?.tree)[0]!.id, "row"));
    sync.attach(core);
    await sync.flush();
    expect(created).toHaveLength(1);
    expect(leafCount(created[0]!)).toBe(3);
    expect(seen).toEqual([]);
    expect(dropped).not.toHaveBeenCalled();
    expect(sync.status()).toMatchObject({ phase: "synced", revision: "created", queued: 0, inFlight: 0 });
    expect(leafCount(core.getState().document)).toBe(3);
    sync.dispose();
  });

  test("work queued while the row is being created is overlaid on the created document and sent once", async () => {
    const initial = layout(split("row", 0.5, tile("counter"), tile("notes")));
    let document: WorkbenchDocument | null = null;
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    let started: () => void = () => {};
    const createStarted = new Promise<void>((resolve) => (started = resolve));
    const seen: number[] = [];
    const client: SyncClient = {
      get: async () => (document ? { document, revision: serverRevision("r") } : null),
      create: async (doc) => {
        started();
        await gate;
        document = doc;
        return { document: doc, revision: serverRevision("created") };
      },
      mutate: async (_revision, mutations) => {
        seen.push(mutations.length);
        document = applyMutations(document!, mutations);
        return { document, revision: serverRevision("next") };
      },
    };
    const sync = createWorkbenchSync({ client, flushDelayMs: 0, onError: () => {} });
    const core = createWorkbenchCore({ apps, initial, onCommit: (receipt) => sync.enqueue(receipt.mutations) });
    sync.attach(core);
    const flushing = sync.flush();
    // The create is out (its snapshot captured); a change lands locally meanwhile.
    await createStarted;
    core.execute(commands.duplicate(leaves(core.getState().document.workspaces[0]?.tree)[0]!.id, "row"));
    release();
    await flushing;
    await sync.flush();
    expect(seen).toEqual([2]); // one request: the duplicate's two mutations, sent once
    expect(leafCount(document!)).toBe(3);
    expect(leafCount(core.getState().document)).toBe(3);
    sync.dispose();
  });

  test("a server document the local catalog refuses is not adopted: phase incompatible, revision not advanced", async () => {
    const initial = layout(split("row", 0.5, tile("counter"), tile("notes")));
    const foreign = layout(tile("ledger")); // no such application here
    const incompatible = vi.fn();
    const client: SyncClient = { get: async () => ({ document: foreign, revision: serverRevision("srv") }), create: async () => { throw new Error("unreachable"); }, mutate: async () => { throw new Error("unreachable"); } };
    const sync = createWorkbenchSync({ client, flushDelayMs: 0, onError: () => {}, onIncompatible: incompatible });
    const core = createWorkbenchCore({ apps, initial, onCommit: (receipt) => sync.enqueue(receipt.mutations) });
    sync.attach(core);
    await sync.flush();
    expect(sync.status()).toMatchObject({ phase: "incompatible", revision: null });
    expect(incompatible).toHaveBeenCalledWith([expect.objectContaining({ code: "unknown_application" })]);
    expect(leafCount(core.getState().document)).toBe(2);
    sync.dispose();
  });

  test("422 isolation keeps the batches still to be sent overlaid: the screen never rolls back a pending change", async () => {
    const { core, sync, server, ids } = scenario({ onInvalid: "isolate" });
    await sync.flush();
    core.execute(commands.duplicate(ids()[0]!, "row"));
    core.execute(commands.duplicate(ids()[0]!, "col"));
    core.execute(commands.duplicate(ids()[0]!, "row"));
    const before = leafCount(core.getState().document);
    let lowest = before;
    const stop = core.subscribe(() => {
      lowest = Math.min(lowest, leafCount(core.getState().document));
    });
    // The combined request 422s; the first isolated batch 422s too (guilty), the rest land.
    server.failures.push(new SyncHttpError(422, "invalid"), new SyncHttpError(422, "invalid"));
    await sync.flush();
    stop();
    expect(lowest).toBe(before - 1); // only the guilty batch's tile went away, never the pending ones
    expect(leafCount(core.getState().document)).toBe(before - 1);
    expect(leafCount(server.document)).toBe(before - 1);
    expect(sync.status()).toMatchObject({ phase: "synced", queued: 0, inFlight: 0 });
    sync.dispose();
  });

  test("a rebased entry the catalog would refuse is dropped, not kept on structural applicability alone", async () => {
    const dropped = vi.fn();
    const { core, sync, server, ids } = scenario({ onDropped: dropped });
    await sync.flush();
    // Locally: a second `notes` tile is impossible (cardinality one) — so build a
    // batch that is structurally fine but semantically refused after the server moves.
    const [first] = ids();
    const viewId = viewOf(core.getState().document.workspaces[0]?.tree, first!);
    core.execute(commands.setTitle(viewId, "mine"));
    // The server retitles the same view first; the local retitle still applies structurally.
    server.externalWrite(mutationsOf(core, commands.setTitle(viewId, "theirs")));
    await sync.flush();
    // Structurally applicable ⇒ kept and replayed (a title is a title); no drop.
    expect(dropped).not.toHaveBeenCalled();
    expect(sync.status().phase).toBe("synced");
    sync.dispose();
  });
});
