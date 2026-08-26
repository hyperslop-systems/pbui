import { describe, expect, test, vi } from "vitest";
import {
  createConversationRegistry,
  memoryConversationStorage,
  type ConversationRegistry,
  type ConversationStorage,
} from "./registry";

const KEY = "test.conversations";

function sessionFetch(...ids: string[]) {
  let next = 0;
  return vi.fn(async () => {
    const sessionId = ids[next] ?? `s${next + 1}`;
    next += 1;
    return new Response(JSON.stringify({ sessionId }), { status: 200 });
  }) as unknown as typeof fetch;
}

function registryWith(storage: ConversationStorage = memoryConversationStorage(), fetchImpl = sessionFetch("a", "b")) {
  let clock = 0;
  return createConversationRegistry({
    key: KEY,
    storage,
    fetch: fetchImpl,
    debounceMs: 0,
    autoConnect: false,
    // Deterministic and strictly increasing, so the sort by last activity is
    // testable rather than dependent on how fast the test runs.
    now: () => new Date(Date.UTC(2026, 7, 21, 0, 0, (clock += 1))).toISOString(),
    configFor: () => ({}),
  });
}

async function twoConversations(registry: ConversationRegistry) {
  const a = await registry.create();
  const b = await registry.create();
  return { a: a.id, b: b.id };
}

describe("createConversationRegistry", () => {
  test("create mints a session, records it, opens it and makes it active", async () => {
    const fetchImpl = sessionFetch("a");
    const registry = registryWith(memoryConversationStorage(), fetchImpl);

    const snapshot = await registry.create();

    expect(snapshot.id).toBe("a");
    expect(snapshot.open).toBe(true);
    expect(snapshot.lifecycle).toEqual({ phase: "opening", attempt: 1 });
    expect(snapshot.active).toBe(true);
    expect(snapshot.title).toBe("new conversation");
    expect(registry.activeId()).toBe("a");
    expect(registry.openIds()).toEqual(["a"]);
    expect((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toBe("/api/chat/sessions");
  });

  test("a second conversation is a second record, and activation moves", async () => {
    const registry = registryWith();
    const { a, b } = await twoConversations(registry);

    expect(registry.all().map((snapshot) => snapshot.id)).toContain(a);
    expect(registry.activeId()).toBe(b);
    expect(registry.openIds()).toEqual([a, b]);

    registry.activate(a);
    expect(registry.get(a)?.active).toBe(true);
    expect(registry.get(b)?.active).toBe(false);
  });

  test("close keeps the record and drops it from the open set; open is idempotent", async () => {
    const registry = registryWith();
    const { a } = await twoConversations(registry);

    registry.close(a);
    expect(registry.get(a)?.open).toBe(false);
    expect(registry.get(a)).not.toBeNull();
    expect(registry.openIds()).not.toContain(a);

    registry.open(a);
    registry.open(a);
    expect(registry.openIds().filter((id) => id === a)).toHaveLength(1);
  });

  test("close exposes closing before settling closed, and reopen starts a new attempt", async () => {
    const registry = registryWith();
    const { a } = await twoConversations(registry);

    registry.close(a);
    expect(registry.get(a)?.lifecycle).toEqual({ phase: "closing", attempt: 1 });
    await Promise.resolve();
    expect(registry.get(a)?.lifecycle).toEqual({ phase: "closed" });

    registry.open(a);
    expect(registry.get(a)?.lifecycle).toEqual({ phase: "opening", attempt: 2 });
  });

  test("rename, pin and archive; archiving closes the runtime", async () => {
    const registry = registryWith();
    const { a } = await twoConversations(registry);

    await registry.rename(a, "  reorder desk  ");
    expect(registry.get(a)?.title).toBe("reorder desk");
    expect(registry.get(a)?.titledBy).toBe("human");

    // An empty rename is not a rename; it would leave a row with no handle.
    await registry.rename(a, "   ");
    expect(registry.get(a)?.title).toBe("reorder desk");

    registry.pin(a, true);
    expect(registry.all()[0]?.id).toBe(a);

    registry.archive(a, true);
    expect(registry.get(a)?.archived).toBe(true);
    expect(registry.get(a)?.open).toBe(false);
  });

  test("forget drops the record and clears the activation that pointed at it", async () => {
    const registry = registryWith();
    const { b } = await twoConversations(registry);
    expect(registry.activeId()).toBe(b);

    registry.forget(b);

    expect(registry.get(b)).toBeNull();
    expect(registry.activeId()).toBeNull();
  });

  test("records survive a reload; runtimes do not", async () => {
    const storage = memoryConversationStorage();
    const first = registryWith(storage);
    const { a } = await twoConversations(first);
    await first.rename(a, "kept");
    first.flush();

    const second = registryWith(storage);

    expect(second.get(a)?.title).toBe("kept");
    expect(second.get(a)?.open).toBe(false);
    expect(second.openIds()).toEqual([]);
    expect(second.activeId()).not.toBeNull();
  });

  test("a corrupt entry is moved aside rather than overwritten", () => {
    const written = new Map<string, string>();
    const storage: ConversationStorage = {
      getItem: (key) => (key === KEY ? "{not json" : (written.get(key) ?? null)),
      setItem: (key, value) => {
        written.set(key, value);
      },
      removeItem: (key) => {
        written.delete(key);
      },
    };
    const onRejected = vi.fn();

    const registry = createConversationRegistry({
      key: KEY,
      storage,
      configFor: () => ({}),
      onRejected,
      autoConnect: false,
    });

    expect(registry.all()).toEqual([]);
    expect(onRejected).toHaveBeenCalledWith("restore", expect.anything());
    // Never the `parse → null → default` pattern that costs a user their list:
    // the bytes are kept under a sibling key.
    const moved = [...written.entries()].find(([key]) => key.startsWith(`${KEY}.corrupt-`));
    expect(moved?.[1]).toBe("{not json");
  });

  test("activation is persisted, so a reload returns to the same conversation", async () => {
    const storage = memoryConversationStorage();
    const first = registryWith(storage);
    const { a } = await twoConversations(first);
    first.activate(a);
    first.flush();

    expect(registryWith(storage).activeId()).toBe(a);
  });

  test("activating a conversation nobody knows is a no-op, not a dangling selection", async () => {
    const registry = registryWith();
    const { a } = await twoConversations(registry);
    registry.activate(a);

    registry.activate("ghost");

    expect(registry.activeId()).toBeNull();
  });

  test("configFor is memoised per conversation — ChatProvider rebuilds its client on a new config", async () => {
    const registry = registryWith();
    const { a } = await twoConversations(registry);
    expect(registry.configFor(a)).toBe(registry.configFor(a));
  });

  test("subscribers hear about a change once, and not about a no-op", async () => {
    const registry = registryWith();
    const { a } = await twoConversations(registry);
    const listener = vi.fn();
    registry.subscribe(listener);

    registry.pin(a, true);
    expect(listener).toHaveBeenCalledTimes(1);

    registry.pin(a, true);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  test("all() is stable until something changes, so a tile does not re-render on every tick", async () => {
    const registry = registryWith();
    await twoConversations(registry);
    const first = registry.all();
    expect(registry.all()).toBe(first);

    registry.activate(null);
    expect(registry.all()).not.toBe(first);
  });

  test("rename is immediate locally and PATCHes the exact server revision", async () => {
    const requests: Record<string, unknown>[] = [];
    const registry = createConversationRegistry({
      key: KEY,
      storage: memoryConversationStorage(),
      fetch: vi.fn(async (_input, init) => {
        requests.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
        return new Response(JSON.stringify({ title: "reorder desk", titleRevision: 1 }), { status: 200 });
      }) as unknown as typeof fetch,
      autoConnect: false,
      configFor: () => ({}),
    });
    registry.adopt("a");

    const pending = registry.rename("a", "  reorder desk  ");
    expect(registry.get("a")).toMatchObject({ title: "reorder desk", titleSync: { status: "queued" } });
    await expect(pending).resolves.toEqual({ local: "updated", remote: "updated" });
    expect(requests).toEqual([{ title: "reorder desk", expectedRevision: 0 }]);
    expect(registry.get("a")).toMatchObject({ titleRevision: 1, titleSync: { status: "synchronized", revision: 1 } });
  });

  test("concurrent renames serialize so an old response cannot overwrite the newer title", async () => {
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const requests: Record<string, unknown>[] = [];
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      requests.push(body);
      if (requests.length === 1) await firstGate;
      const expected = Number(body.expectedRevision);
      return new Response(JSON.stringify({ title: body.title, titleRevision: expected + 1 }), { status: 200 });
    }) as unknown as typeof fetch;
    const registry = createConversationRegistry({ key: KEY, storage: memoryConversationStorage(), fetch: fetchImpl, autoConnect: false, configFor: () => ({}) });
    registry.adopt("a");

    const older = registry.rename("a", "older");
    const newer = registry.rename("a", "newer");
    expect(registry.get("a")?.title).toBe("newer");
    expect(requests).toEqual([{ title: "older", expectedRevision: 0 }]);

    releaseFirst();
    await Promise.all([older, newer]);
    expect(requests).toEqual([
      { title: "older", expectedRevision: 0 },
      { title: "newer", expectedRevision: 1 },
    ]);
    expect(registry.get("a")).toMatchObject({ title: "newer", titleRevision: 2, titleSync: { status: "synchronized" } });
  });

  test("an offline title survives reload in the outbox and retries automatically", async () => {
    const storage = memoryConversationStorage();
    const offline = createConversationRegistry({
      key: KEY,
      storage,
      fetch: vi.fn(async () => {
        throw new TypeError("offline");
      }) as unknown as typeof fetch,
      debounceMs: 0,
      autoConnect: false,
      configFor: () => ({}),
    });
    offline.adopt("a");
    await expect(offline.rename("a", "offline title")).resolves.toEqual({ local: "updated", remote: "queued" });
    offline.flush();
    expect(storage.getItem(`${KEY}.title-outbox`)).toContain("offline title");

    const recoveredFetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { title: string; expectedRevision: number };
      return new Response(JSON.stringify({ title: body.title, titleRevision: body.expectedRevision + 1 }), { status: 200 });
    }) as unknown as typeof fetch;
    const recovered = createConversationRegistry({ key: KEY, storage, fetch: recoveredFetch, autoConnect: false, configFor: () => ({}) });
    await vi.waitFor(() => expect(recovered.get("a")?.titleSync.status).toBe("synchronized"));
    expect(recovered.get("a")).toMatchObject({ title: "offline title", titleRevision: 1 });
    expect(storage.getItem(`${KEY}.title-outbox`)).toBeNull();
  });

  test("a revision conflict keeps the local title visible and retryable", async () => {
    let conflict = true;
    const requests: Record<string, unknown>[] = [];
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      requests.push(body);
      if (conflict) {
        return new Response(JSON.stringify({ error: "conversation title changed on another client", title: "remote", titleRevision: 5 }), { status: 409 });
      }
      return new Response(JSON.stringify({ title: body.title, titleRevision: 6 }), { status: 200 });
    }) as unknown as typeof fetch;
    const registry = createConversationRegistry({ key: KEY, storage: memoryConversationStorage(), fetch: fetchImpl, autoConnect: false, configFor: () => ({}) });
    registry.adopt("a");

    await expect(registry.rename("a", "mine")).resolves.toEqual({ local: "updated", remote: "failed" });
    expect(registry.get("a")).toMatchObject({ title: "mine", titleRevision: 5, titleSync: { status: "failed" } });

    conflict = false;
    await expect(registry.retryTitle("a")).resolves.toEqual({ local: "updated", remote: "updated" });
    expect(requests[1]).toEqual({ title: "mine", expectedRevision: 5 });
    expect(registry.get("a")).toMatchObject({ title: "mine", titleRevision: 6, titleSync: { status: "synchronized" } });
  });

  test("retry accepts an authoritative lower revision after a rebuildable server index resets", async () => {
    let conflict = true;
    const requests: Record<string, unknown>[] = [];
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      requests.push(body);
      if (conflict) return new Response(JSON.stringify({ error: "stale", titleRevision: 0 }), { status: 409 });
      return new Response(JSON.stringify({ title: body.title, titleRevision: 1 }), { status: 200 });
    }) as unknown as typeof fetch;
    const registry = createConversationRegistry({ key: KEY, storage: memoryConversationStorage(), fetch: fetchImpl, autoConnect: false, configFor: () => ({}) });
    registry.adopt("a", { titleRevision: 5 });

    await registry.rename("a", "after reset");
    expect(registry.get("a")?.titleRevision).toBe(0);
    conflict = false;
    await registry.retryTitle("a");
    expect(requests).toEqual([
      { title: "after reset", expectedRevision: 5 },
      { title: "after reset", expectedRevision: 0 },
    ]);
    expect(registry.get("a")?.titleRevision).toBe(1);
  });

  test("sync adopts what the server lists and never overwrites a human title", async () => {
    const storage = memoryConversationStorage();
    const listing = {
      sessions: [
        { id: "a", createdAt: "2026-08-21T00:00:00.000Z", lastActivityAt: "2026-08-21T10:00:00.000Z", messageCount: 9, title: "the server's name" },
        { id: "new-to-us", createdAt: "2026-08-21T00:00:00.000Z", lastActivityAt: "2026-08-21T09:00:00.000Z", messageCount: 2, title: "another browser's" },
      ],
    };
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/api/chat/sessions") && !String(input).includes("messages")) {
        return new Response(JSON.stringify(listing), { status: 200 });
      }
      return new Response(JSON.stringify({ sessionId: "a" }), { status: 200 });
    }) as unknown as typeof fetch;

    const registry = createConversationRegistry({
      key: KEY,
      storage,
      fetch: fetchImpl,
      debounceMs: 0,
      autoConnect: false,
      configFor: () => ({}),
    });
    registry.adopt("a", { title: "mine", messageCount: 3 });
    await registry.rename("a", "mine", "human");
    registry.adopt("only-here");

    const result = await registry.sync();

    // The user named "a" in this browser; the index only knows what some
    // browser told it.
    expect(registry.get("a")?.title).toBe("mine");
    expect(registry.get("a")?.titledBy).toBe("human");
    // A higher count IS worth taking: another browser has been talking.
    expect(registry.get("a")?.messageCount).toBe(9);
    expect(result.updated).toContain("a");

    expect(result.adopted).toEqual(["new-to-us"]);
    expect(registry.get("new-to-us")?.title).toBe("another browser's");

    // A record the server has forgotten is KEPT: it still connects and
    // hydrates. Reporting it is how a tile can say so.
    expect(result.unknownToServer).toEqual(["only-here"]);
    expect(registry.get("only-here")).not.toBeNull();
  });

  test("sync takes an auto title from the server but not a lower message count", async () => {
    const listing = { sessions: [{ id: "a", lastActivityAt: "2026-08-21T10:00:00.000Z", messageCount: 1, title: "from the server" }] };
    const registry = createConversationRegistry({
      key: KEY,
      storage: memoryConversationStorage(),
      fetch: vi.fn(async () => new Response(JSON.stringify(listing), { status: 200 })) as unknown as typeof fetch,
      debounceMs: 0,
      autoConnect: false,
      configFor: () => ({}),
    });
    registry.adopt("a", { messageCount: 5 });

    await registry.sync();

    expect(registry.get("a")?.title).toBe("from the server");
    expect(registry.get("a")?.titledBy).toBe("agent");
    // This browser has seen five messages in a hydrated timeline; the index
    // counted one submission. Taking the lower number would lose four.
    expect(registry.get("a")?.messageCount).toBe(5);
  });

  test("a server that cannot list is an error the caller sees, not a silently empty list", async () => {
    const registry = createConversationRegistry({
      key: KEY,
      storage: memoryConversationStorage(),
      fetch: vi.fn(async () => new Response("nope", { status: 500 })) as unknown as typeof fetch,
      autoConnect: false,
      configFor: () => ({}),
    });
    registry.adopt("a");

    await expect(registry.sync()).rejects.toThrow(/could not list conversations: 500/);
    expect(registry.get("a")).not.toBeNull();
  });

  test("create refuses to invent an id when the server does not return one", async () => {
    const registry = registryWith(memoryConversationStorage(), vi.fn(async () => new Response("{}", { status: 200 })) as unknown as typeof fetch);
    await expect(registry.create()).rejects.toThrow(/without an id/);
  });
});
