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

  test("rename, pin and archive; archiving closes the runtime", async () => {
    const registry = registryWith();
    const { a } = await twoConversations(registry);

    registry.rename(a, "  reorder desk  ");
    expect(registry.get(a)?.title).toBe("reorder desk");
    expect(registry.get(a)?.titledBy).toBe("human");

    // An empty rename is not a rename; it would leave a row with no handle.
    registry.rename(a, "   ");
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
    first.rename(a, "kept");
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

  test("create refuses to invent an id when the server does not return one", async () => {
    const registry = registryWith(memoryConversationStorage(), vi.fn(async () => new Response("{}", { status: 200 })) as unknown as typeof fetch);
    await expect(registry.create()).rejects.toThrow(/without an id/);
  });
});
