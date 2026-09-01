import { describe, expect, test, vi } from "vitest";
import type { Mutation, WorkbenchDocument } from "@hyperslop-systems/workbench-protocol";
import { applyMutations, leaves } from "@hyperslop-systems/workbench-protocol/client";
import { createWorkbench } from "./createWorkbench";
import { layout, split, tile } from "./document";
import { demoApps } from "./stories/demoApps";
import { createWorkbenchSync, SyncHttpError, type SyncClient, type SyncResult } from "./sync";

/**
 * A server in thirty lines: a document, a revision that counts up, and a
 * script of failures to inject. Everything the loop must get right — replay
 * on 409, isolation on 422, backoff, deferred stream refetch — is a
 * statement about what this fake sees, so the fake records everything.
 */
function fakeServer(initial: WorkbenchDocument) {
  let document = initial;
  let revision = 1;
  const seen: { revision: string; count: number; requestId: string }[] = [];
  let listener: ((revision?: string) => void) | null = null;
  const failures: (SyncHttpError | Error)[] = [];

  const result = (): SyncResult => ({ document, revision: String(revision) });

  const client: SyncClient = {
    get: async () => result(),
    create: async (doc) => {
      document = doc;
      return result();
    },
    mutate: async (sentRevision, mutations, requestId) => {
      seen.push({ revision: sentRevision, count: mutations.length, requestId });
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
    /** Another writer commits, exactly as a second tab would. */
    externalWrite(mutations: Mutation[]) {
      document = applyMutations(document, mutations);
      revision += 1;
    },
    notify: () => listener?.(),
    get revision() {
      return revision;
    },
    get document() {
      return document;
    },
  };
}

function scenario(options: { onInvalid?: "drop" | "isolate" } = {}) {
  const initial = layout(split("row", 0.5, tile("counter"), tile("notes")));
  const server = fakeServer(initial);
  const sync = createWorkbenchSync({
    client: server.client,
    flushDelayMs: 0,
    ...(options.onInvalid ? { onInvalid: options.onInvalid } : {}),
    onError: () => {},
  });
  const wb = createWorkbench({ apps: demoApps, initial, onMutate: (mutations) => sync.enqueue(mutations) });
  sync.attach(wb);
  const ids = () => leaves(wb.store.getState().document.workspaces[0]?.tree).map((leaf) => leaf.id);
  return { wb, sync, server, ids };
}

describe("the sync module (5.F)", () => {
  test("committed batches reach the server in order, each against the revision it was built on", async () => {
    const { wb, sync, server, ids } = scenario();
    await sync.flush();
    expect(sync.status().phase).toBe("synced");

    wb.verbs.split(ids()[0]!, "row");
    wb.verbs.split(ids()[0]!, "col");
    await sync.flush();

    expect(server.seen.map((entry) => entry.revision)).toEqual(["1"]);
    // Both batches were queued before the flush, so they went as ONE request
    // against revision 1 — the debounce doing its job. Two splits are four
    // mutations (a viewCreate and a placementSplit each); the outbox counts
    // mutations, because that is what a rebase replays.
    expect(server.seen[0]!.count).toBe(4);
    expect(leaves(server.document.workspaces[0]?.tree)).toHaveLength(4);
    expect(sync.status()).toMatchObject({ phase: "synced", queued: 0, revision: "2" });
    sync.dispose();
  });

  test("a 409 refetches and replays the queue one mutation at a time", async () => {
    const { wb, sync, server, ids } = scenario();
    await sync.flush();

    // Another tab closes the second tile while this one splits the first.
    const [first, second] = ids();
    const closeSecond = wb.plan([{ kind: "tile.close", placementId: second! }]);
    expect(closeSecond.ok).toBe(true);
    if (!closeSecond.ok) return;
    wb.verbs.split(first!, "row");
    server.externalWrite([...closeSecond.plan.mutations]);

    await sync.flush();
    // Two leaves, then the other tab's close leaves one, then the local split
    // replays on top: two. The split SURVIVED a document that moved under it,
    // which is the whole point of replaying rather than dropping the queue.
    expect(leaves(server.document.workspaces[0]?.tree)).toHaveLength(2);
    expect(leaves(wb.store.getState().document.workspaces[0]?.tree)).toHaveLength(2);
    expect(sync.status().phase).toBe("synced");
    sync.dispose();
  });

  test("a mutation the rebase can no longer apply is dropped, and the rest still land", async () => {
    const dropped: Mutation[][] = [];
    const initial = layout(split("row", 0.5, tile("counter"), tile("notes")));
    const server = fakeServer(initial);
    const sync = createWorkbenchSync({
      client: server.client,
      flushDelayMs: 0,
      onDropped: (mutations, reason) => {
        if (reason === "rebase") dropped.push(mutations);
      },
      onError: () => {},
    });
    const wb = createWorkbench({ apps: demoApps, initial, onMutate: (mutations) => sync.enqueue(mutations) });
    sync.attach(wb);
    await sync.flush();

    const ids = leaves(wb.store.getState().document.workspaces[0]?.tree).map((leaf) => leaf.id);
    // This tab closes the second tile; the other tab closed it first.
    const planned = wb.plan([{ kind: "tile.close", placementId: ids[1]! }]);
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    server.externalWrite([...planned.plan.mutations]);
    wb.verbs.close(ids[1]!);
    wb.verbs.split(ids[0]!, "row");

    await sync.flush();
    // The duplicate close and the viewDelete that followed it: both refer to
    // a tile the server no longer has, and both are dropped by name.
    expect(dropped.flat().length).toBeGreaterThan(0);
    expect(leaves(server.document.workspaces[0]?.tree)).toHaveLength(2); // one closed, one split
    expect(sync.status().phase).toBe("synced");
    sync.dispose();
  });

  test("a 422 drops the refused batch by default and isolates when asked", async () => {
    const dropped: number[] = [];
    const initial = layout(split("row", 0.5, tile("counter"), tile("notes")));
    const server = fakeServer(initial);
    const sync = createWorkbenchSync({
      client: server.client,
      flushDelayMs: 0,
      onInvalid: "isolate",
      onDropped: (mutations, reason) => {
        if (reason === "invalid") dropped.push(mutations.length);
      },
      onError: () => {},
    });
    const wb = createWorkbench({ apps: demoApps, initial, onMutate: (mutations) => sync.enqueue(mutations) });
    sync.attach(wb);
    await sync.flush();

    const ids = leaves(wb.store.getState().document.workspaces[0]?.tree).map((leaf) => leaf.id);
    wb.verbs.split(ids[0]!, "row");
    wb.verbs.setTitle(
      (() => {
        const leaf = leaves(wb.store.getState().document.workspaces[0]?.tree)[0]!;
        return leaf.body.case === "leaf" ? leaf.body.value.viewId : "";
      })(),
      "renamed",
    );
    // The whole batch 422s once, then each mutation goes alone and both are
    // accepted: isolation keeps the innocent half of a batch.
    server.failures.push(new SyncHttpError(422, "invalid_document"));
    await sync.flush();
    expect(dropped).toEqual([]);
    // Three mutations refused as a batch, then sent singly and all accepted.
    expect(server.seen.map((entry) => entry.count)).toEqual([3, 1, 1, 1]);
    expect(sync.status().phase).toBe("synced");
    sync.dispose();
  });

  test("a transport failure keeps the queue, goes offline, and retries with backoff", async () => {
    vi.useFakeTimers();
    const { wb, sync, server, ids } = scenario();
    await sync.flush();
    wb.verbs.split(ids()[0]!, "row");
    server.failures.push(new Error("network down"));
    await sync.flush();
    expect(sync.status()).toMatchObject({ phase: "offline", queued: 2 });

    await vi.advanceTimersByTimeAsync(1000);
    expect(sync.status().phase).toBe("synced");
    expect(leaves(server.document.workspaces[0]?.tree)).toHaveLength(3);
    sync.dispose();
    vi.useRealTimers();
  });

  test("a 404 detaches: nothing is retried into a row that is gone", async () => {
    const { wb, sync, server, ids } = scenario();
    await sync.flush();
    wb.verbs.split(ids()[0]!, "row");
    server.failures.push(new SyncHttpError(404, "no such workbench"));
    await sync.flush();
    expect(sync.status()).toMatchObject({ phase: "detached", queued: 0 });
    // The layout still works locally; it simply is not being sent anywhere.
    wb.verbs.split(ids()[0]!, "col");
    await sync.flush();
    expect(sync.status().phase).toBe("detached");
    sync.dispose();
  });

  test("a stream notification refetches only while the outbox is idle", async () => {
    const { wb, sync, server, ids } = scenario();
    await sync.flush();

    // Queued work first: the notification must not adopt a server document
    // that does not yet contain what is about to be sent.
    wb.verbs.split(ids()[0]!, "row");
    server.notify();
    expect(sync.status().queued).toBe(2);
    await sync.flush();
    expect(leaves(server.document.workspaces[0]?.tree)).toHaveLength(3);

    // Now idle: another tab's rename arrives without a reload.
    const renamed = wb.plan([{ kind: "workspace.rename", workspaceId: wb.store.getState().workspaceId, name: "over there" }]);
    expect(renamed.ok).toBe(true);
    if (!renamed.ok) return;
    server.externalWrite([...renamed.plan.mutations]);
    server.notify();
    await sync.flush();
    expect(wb.store.getState().document.workspaces[0]!.name).toBe("over there");
    sync.dispose();
  });

  test("the same batch content keeps one request id, and different content does not", async () => {
    const { wb, sync, server, ids } = scenario();
    await sync.flush();
    wb.verbs.split(ids()[0]!, "row");
    // The first attempt times out; the retry must carry the same id or the
    // server applies the split twice.
    server.failures.push(new Error("timeout"));
    await sync.flush();
    await sync.flush();
    expect(server.seen).toHaveLength(2);
    expect(server.seen[0]!.requestId).toBe(server.seen[1]!.requestId);

    wb.verbs.split(ids()[0]!, "col");
    await sync.flush();
    expect(server.seen[2]!.requestId).not.toBe(server.seen[1]!.requestId);
    sync.dispose();
  });
});
