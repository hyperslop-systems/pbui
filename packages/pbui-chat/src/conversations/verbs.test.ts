import { describe, expect, test, vi } from "vitest";
import { vocabulary } from "../../demo/src/pbui/vocabulary";
import { validateVerb } from "../vocabulary/validate";
import { createConversationRegistry, memoryConversationStorage, type ConversationRegistry } from "./registry";
import {
  CONVERSATION_VERB_KINDS,
  describeConversationVerb,
  isConversationVerb,
  performConversationVerb,
  type ConversationVerbContext,
} from "./verbs";

function registryWith(...ids: string[]) {
  let next = 0;
  return createConversationRegistry({
    key: "test.verbs",
    storage: memoryConversationStorage(),
    autoConnect: false,
    debounceMs: 0,
    configFor: () => ({}),
    fetch: vi.fn(async () => {
      const sessionId = ids[next] ?? `s${next + 1}`;
      next += 1;
      return new Response(JSON.stringify({ sessionId }), { status: 200 });
    }) as unknown as typeof fetch,
  });
}

function contextFor(conversations: ConversationRegistry) {
  const opened: { appId: string; documents: Record<string, string>; near?: string }[] = [];
  const sent: { conversationId: string; template: string }[] = [];
  const workbench = {
    activePlacementId: () => "p-1",
    verbs: {
      openView: (appId: string, documents: Record<string, string>, options?: { near?: string }) => {
        opened.push({ appId, documents, ...(options?.near ? { near: options.near } : {}) });
        return "p-2";
      },
    },
  } as unknown as ConversationVerbContext["workbench"];
  const ctx: ConversationVerbContext = {
    actor: "human",
    conversations,
    workbench,
    send: async (conversationId, template) => {
      sent.push({ conversationId, template });
    },
  };
  return { ctx, opened, sent };
}

describe("the conversation verbs", () => {
  test("every kind the package declares is in the demo's vocabulary", () => {
    for (const kind of CONVERSATION_VERB_KINDS) {
      expect(vocabulary.verbs[kind], `${kind} is missing from the vocabulary`).toBeTruthy();
    }
  });

  test("a well-formed verb validates and a malformed one is refused with a reason", () => {
    expect(validateVerb(vocabulary, { kind: "conversation.select", conversationId: "a" })).toBeNull();
    // A rename with no title is well-formed on purpose: it asks the interface
    // for its editor, which is how an object menu offers a rename at all.
    expect(validateVerb(vocabulary, { kind: "conversation.rename", conversationId: "a" })).toBeNull();
    expect(validateVerb(vocabulary, { kind: "conversation.rename" })).toMatch(/conversationId/);
    expect(validateVerb(vocabulary, { kind: "conversation.pin", conversationId: "a" })).toMatch(/pinned/);
  });

  test("rename without a title asks for the editor instead of renaming", async () => {
    const conversations = registryWith("a");
    await conversations.create();
    const { ctx } = contextFor(conversations);

    await performConversationVerb({ kind: "conversation.rename", conversationId: "a" }, ctx);

    expect(conversations.renaming()).toBe("a");
    expect(conversations.get("a")?.titledBy).toBe("auto");
  });

  test("pin, archive, close and forget are verbs, so the object menu can offer them", async () => {
    const conversations = registryWith("a");
    await conversations.create();
    const { ctx } = contextFor(conversations);

    await performConversationVerb({ kind: "conversation.pin", conversationId: "a", pinned: true }, ctx);
    expect(conversations.get("a")?.pinned).toBe(true);

    await performConversationVerb({ kind: "conversation.close", conversationId: "a" }, ctx);
    expect(conversations.get("a")?.open).toBe(false);

    await performConversationVerb({ kind: "conversation.archive", conversationId: "a", archived: true }, ctx);
    expect(conversations.get("a")?.archived).toBe(true);

    await performConversationVerb({ kind: "conversation.forget", conversationId: "a" }, ctx);
    expect(conversations.get("a")).toBeNull();
  });

  test("conversation.new mints a session, opens a tile beside the active one, and activates it", async () => {
    const conversations = registryWith("a");
    const { ctx, opened } = contextFor(conversations);

    await performConversationVerb({ kind: "conversation.new", title: "reorder desk" }, ctx);

    expect(conversations.all().map((snapshot) => snapshot.title)).toEqual(["reorder desk"]);
    expect(conversations.activeId()).toBe("a");
    expect(opened).toEqual([{ appId: "chat", documents: { conversation: "a" }, near: "p-1" }]);
  });

  test("conversation.new with a prompt sends it to the conversation it just made", async () => {
    const conversations = registryWith("a");
    const { ctx, sent } = contextFor(conversations);

    await performConversationVerb({ kind: "conversation.new", prompt: "watch the gold desk" }, ctx);

    expect(sent).toEqual([{ conversationId: "a", template: "watch the gold desk" }]);
  });

  test("open, select and rename act on a known conversation", async () => {
    const conversations = registryWith("a", "b");
    const { ctx, opened } = contextFor(conversations);
    await conversations.create();
    await conversations.create();
    conversations.close("a");

    await performConversationVerb({ kind: "conversation.open", conversationId: "a" }, ctx);
    expect(conversations.get("a")?.open).toBe(true);
    expect(conversations.activeId()).toBe("a");
    expect(opened.at(-1)?.documents).toEqual({ conversation: "a" });

    await performConversationVerb({ kind: "conversation.select", conversationId: "b" }, ctx);
    expect(conversations.activeId()).toBe("b");

    await performConversationVerb({ kind: "conversation.rename", conversationId: "b", title: "gold desk" }, ctx);
    expect(conversations.get("b")?.title).toBe("gold desk");
    expect(conversations.get("b")?.titledBy).toBe("human");
  });

  test("an agent may name a conversation nobody has named, and may not rename one the user named (D7)", async () => {
    const conversations = registryWith("a");
    await conversations.create();
    const { ctx } = contextFor(conversations);
    const asAgent: ConversationVerbContext = { ...ctx, actor: "agent" };

    await performConversationVerb({ kind: "conversation.rename", conversationId: "a", title: "gold desk" }, asAgent);
    expect(conversations.get("a")?.title).toBe("gold desk");
    expect(conversations.get("a")?.titledBy).toBe("agent");

    await performConversationVerb({ kind: "conversation.rename", conversationId: "a", title: "mine" }, ctx);
    expect(conversations.get("a")?.titledBy).toBe("human");

    await expect(
      performConversationVerb({ kind: "conversation.rename", conversationId: "a", title: "theirs" }, asAgent),
    ).rejects.toThrow(/the user named this conversation/);
    expect(conversations.get("a")?.title).toBe("mine");
  });

  test("a verb against a conversation nobody knows is refused, not silently ignored", async () => {
    const conversations = registryWith();
    const { ctx } = contextFor(conversations);

    await expect(performConversationVerb({ kind: "conversation.open", conversationId: "ghost" }, ctx)).rejects.toThrow(
      /no conversation ghost/,
    );
    await expect(performConversationVerb({ kind: "conversation.select", conversationId: "ghost" }, ctx)).rejects.toThrow(
      /no conversation ghost/,
    );
  });

  test("an empty rename is refused rather than leaving a row with no handle", async () => {
    const conversations = registryWith("a");
    await conversations.create();
    const { ctx } = contextFor(conversations);

    await expect(performConversationVerb({ kind: "conversation.rename", conversationId: "a", title: "  " }, ctx)).rejects.toThrow(
      /needs a name/,
    );
  });

  test("conversation.send belongs to the agent family and says so", async () => {
    const conversations = registryWith("a");
    await conversations.create();
    const { ctx } = contextFor(conversations);

    await expect(
      performConversationVerb({ kind: "conversation.send", conversationId: "a", template: "hi" }, ctx),
    ).rejects.toThrow(/agent verb/);
  });

  test("isConversationVerb separates them from everything else", () => {
    expect(isConversationVerb({ kind: "conversation.new" })).toBe(true);
    expect(isConversationVerb({ kind: "tile.close", placementId: "p" })).toBe(false);
    expect(isConversationVerb({ kind: "inspect" })).toBe(false);
  });

  test("every kind describes itself", () => {
    expect(describeConversationVerb({ kind: "conversation.new" })).toBe("start another conversation");
    expect(describeConversationVerb({ kind: "conversation.new", title: "desk" })).toContain("desk");
    expect(describeConversationVerb({ kind: "conversation.rename", conversationId: "a", title: "desk" })).toContain("desk");
  });
});
