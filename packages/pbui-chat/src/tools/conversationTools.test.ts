import { describe, expect, test, vi } from "vitest";
import { createConversationRegistry, memoryConversationStorage, type ConversationRegistry } from "../conversations/registry";
import type { Outcome, VerbLike } from "../types";
import { createConversationTools, type ConversationToolsOptions } from "./conversationTools";

/**
 * The two tools a model uses to know it is not alone, and to hand work over.
 * Every refusal here is a sentence the model has to be able to act on, so the
 * assertions are on the wording as much as on the outcome.
 */

const ME = "me";
const THEM = "them";

async function registryWith(...ids: string[]): Promise<ConversationRegistry> {
  let next = 0;
  const registry = createConversationRegistry({
    key: "test.conversationTools",
    storage: memoryConversationStorage(),
    autoConnect: false,
    debounceMs: 0,
    configFor: () => ({}),
    fetch: vi.fn(async () => new Response(JSON.stringify({ sessionId: ids[next++] ?? `s${next}` }), { status: 200 })) as unknown as typeof fetch,
  });
  for (const id of ids) {
    registry.adopt(id, { title: id === ME ? "you" : "the other desk" });
    registry.open(id);
  }
  return registry;
}

function toolsFor(registry: ConversationRegistry | null, overrides: Partial<ConversationToolsOptions> = {}) {
  const performed: VerbLike[] = [];
  const tools = createConversationTools({
    getConversations: () => registry,
    conversationId: ME,
    perform: async (verb) => {
      performed.push(verb);
      return "performed" as Outcome;
    },
    ...overrides,
  });
  const byName = (name: string) => tools.tools.find((tool) => tool.name === name) as never as {
    available?(): boolean;
    execute(input: unknown, context?: unknown): Promise<Record<string, unknown>> | Record<string, unknown>;
  };
  return { performed, list: byName("conversation_list"), send: byName("conversation_send") };
}

describe("conversation_list", () => {
  test("says who else is here, which one is active, and which one is you", async () => {
    const registry = await registryWith(ME, THEM);
    registry.activate(THEM);
    const { list } = toolsFor(registry);

    const result = (await list.execute({})) as { you: string; activeConversationId: string; conversations: { conversationId: string; isYou: boolean; isActive: boolean }[] };

    expect(result.you).toBe(ME);
    expect(result.activeConversationId).toBe(THEM);
    expect(result.conversations.find((row) => row.conversationId === ME)?.isYou).toBe(true);
    expect(result.conversations.find((row) => row.conversationId === THEM)?.isActive).toBe(true);
  });

  test("archived conversations are out of the way unless asked for", async () => {
    const registry = await registryWith(ME, THEM);
    registry.archive(THEM, true);
    const { list } = toolsFor(registry);

    expect(((await list.execute({})) as { conversations: unknown[] }).conversations).toHaveLength(1);
    expect(((await list.execute({ includeArchived: true })) as { conversations: unknown[] }).conversations).toHaveLength(2);
  });

  test("a product with one conversation does not offer the tools at all", () => {
    const { list } = toolsFor(null);
    expect(list.available?.()).toBe(false);
  });
});

describe("conversation_send", () => {
  test("without an approval it refuses and says exactly how to get one", async () => {
    const registry = await registryWith(ME, THEM);
    const { send, performed } = toolsFor(registry, { confirmationHint: "put the message in a field." });

    const result = (await send.execute({ conversationId: THEM, prompt: "have a look at this" })) as { ok: boolean; error: string };

    expect(result.ok).toBe(false);
    expect(result.error).toContain("pbui_propose");
    expect(result.error).toContain("the other desk");
    expect(result.error).toContain("put the message in a field.");
    expect(performed).toHaveLength(0);
  });

  test("an approval that does not match the message is refused", async () => {
    const registry = await registryWith(ME, THEM);
    const { send, performed } = toolsFor(registry, {
      isApproved: (_id, target, prompt) => target === THEM && prompt === "the message they approved",
    });

    const result = (await send.execute({ conversationId: THEM, prompt: "something else entirely", confirmationId: "p1" })) as { ok: boolean; error: string };

    expect(result.ok).toBe(false);
    expect(result.error).toContain("was not approved for this message");
    expect(performed).toHaveLength(0);
  });

  test("with a matching approval it performs conversation.send through the router", async () => {
    const registry = await registryWith(ME, THEM);
    const { send, performed } = toolsFor(registry, { isApproved: () => true });

    const result = (await send.execute({
      conversationId: THEM,
      prompt: "please price [[product:2049|the Eagle]]",
      refs: [{ type: "product", id: "2049" }],
      confirmationId: "p1",
    })) as { ok: boolean; note: string };

    expect(result.ok).toBe(true);
    expect(result.note).toContain("its own conversation");
    expect(performed).toEqual([
      { kind: "conversation.send", conversationId: THEM, template: "please price [[product:2049|the Eagle]]", refs: [{ type: "product", id: "2049" }] },
    ]);
  });

  test("a model cannot message itself", async () => {
    const registry = await registryWith(ME, THEM);
    const { send, performed } = toolsFor(registry, { isApproved: () => true });

    const result = (await send.execute({ conversationId: ME, prompt: "hello me", confirmationId: "p1" })) as { ok: boolean; error: string };

    expect(result.error).toContain("answer the user directly");
    expect(performed).toHaveLength(0);
  });

  test("an unknown conversation is refused with the way to find the real ones", async () => {
    const registry = await registryWith(ME, THEM);
    const { send } = toolsFor(registry, { isApproved: () => true });

    const result = (await send.execute({ conversationId: "ghost", prompt: "hi", confirmationId: "p1" })) as { error: string };

    expect(result.error).toContain("conversation_list");
  });

  test("a disconnected conversation is refused rather than silently queued", async () => {
    const registry = await registryWith(ME, THEM);
    registry.close(THEM);
    const { send } = toolsFor(registry, { isApproved: () => true });

    const result = (await send.execute({ conversationId: THEM, prompt: "hi", confirmationId: "p1" })) as { error: string };

    expect(result.error).toContain("disconnected");
  });

  test("an empty or overlong message is refused before anything is sent", async () => {
    const registry = await registryWith(ME, THEM);
    const { send } = toolsFor(registry, { isApproved: () => true, maxPromptLength: 10 });

    expect(((await send.execute({ conversationId: THEM, prompt: "   ", confirmationId: "p1" })) as { error: string }).error).toContain("something in it");
    expect(((await send.execute({ conversationId: THEM, prompt: "much too long to fit", confirmationId: "p1" })) as { error: string }).error).toContain("the limit is 10");
  });

  test("a product may forbid agent-to-agent messages outright", async () => {
    const registry = await registryWith(ME, THEM);
    const { send } = toolsFor(registry, { policy: { conversation_send: "deny" } });

    expect(((await send.execute({ conversationId: THEM, prompt: "hi" })) as { error: string }).error).toContain("does not let agents message each other");
  });

  test("with the policy relaxed to allow, no approval is asked for", async () => {
    const registry = await registryWith(ME, THEM);
    const { send, performed } = toolsFor(registry, { policy: { conversation_send: "allow" } });

    expect(((await send.execute({ conversationId: THEM, prompt: "hi" })) as { ok: boolean }).ok).toBe(true);
    expect(performed).toHaveLength(1);
  });

  test("a router rejection is reported to the model rather than swallowed", async () => {
    const registry = await registryWith(ME, THEM);
    const tools = createConversationTools({
      getConversations: () => registry,
      conversationId: ME,
      perform: async () => "rejected:that conversation is not open" as Outcome,
      isApproved: () => true,
    });
    const send = tools.tools.find((tool) => tool.name === "conversation_send") as never as { execute(input: unknown): Promise<Record<string, unknown>> };

    const result = (await send.execute({ conversationId: THEM, prompt: "hi", confirmationId: "p1" })) as { ok: boolean; error: string };

    expect(result.ok).toBe(false);
    expect(result.error).toBe("that conversation is not open");
  });
});
