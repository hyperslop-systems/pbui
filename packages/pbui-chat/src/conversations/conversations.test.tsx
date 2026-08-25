import { timelineSlice, type TimelineEntity } from "@go-go-golems/chat-provider";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { chat } from "../../demo/src/chat";
import { usePbuiChat, type PbuiChatContextValue } from "../context";
import { Messages } from "../messages/Messages";
import { ConversationScope } from "./ConversationScope";

/**
 * Two conversations on one workbench, end to end through the real
 * `chat.Provider`: two `<ChatProvider>`s hosted side by side, two stores, two
 * transcripts, and verbs traced against the conversation they came from.
 *
 * Nothing connects — `autoConnect` is off — so the runtimes exist and are
 * seeded directly, which is exactly what the tiles read.
 */

const A = "conv-a";
const B = "conv-b";

function message(id: string, content: string): TimelineEntity {
  return { id, kind: "message", createdAt: 1, props: { role: "user", content, status: "finished", streaming: false } };
}

let fetched: { url: string; body: unknown }[] = [];

beforeEach(() => {
  fetched = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      fetched.push({ url: String(input), body: init?.body ? JSON.parse(String(init.body)) : undefined });
      return new Response("{}", { status: 200 });
    }),
  );
  chat.conversations.setAutoConnect(false);
  chat.conversations.adopt(A, { title: "left" });
  chat.conversations.adopt(B, { title: "right" });
  chat.conversations.open(A);
  chat.conversations.open(B);
  chat.conversations.activate(A);
});

afterEach(() => {
  cleanup();
  chat.conversations.forget(A);
  chat.conversations.forget(B);
  chat.store.reset();
  vi.unstubAllGlobals();
});

const scoped = new Map<string, PbuiChatContextValue>();

/** Capture what a component inside a conversation tile sees. */
function Probe({ id }: { id: string }) {
  scoped.set(id, usePbuiChat());
  return null;
}

function TwoTiles() {
  return (
    <chat.Provider environment={{ canApprove: false, sessionId: null } as never}>
      <div data-testid="tile-a">
        <ConversationScope conversationId={A}>
          <Probe id={A} />
          <Messages follow={false} />
        </ConversationScope>
      </div>
      <div data-testid="tile-b">
        <ConversationScope conversationId={B}>
          <Probe id={B} />
          <Messages follow={false} />
        </ConversationScope>
      </div>
    </chat.Provider>
  );
}

async function renderTwo() {
  render(<TwoTiles />);
  // The host mounts a `<ChatProvider>` per open conversation and its capture
  // child reports the runtime in an effect, so the first paint of a scope is
  // "opening conversation…".
  await waitFor(() => {
    expect(chat.conversations.runtimeFor(A)).not.toBeNull();
    expect(chat.conversations.runtimeFor(B)).not.toBeNull();
  });
}

describe("two conversations on one workbench", () => {
  test("each open conversation gets its own runtime, store and session id", async () => {
    await renderTwo();

    const a = chat.conversations.runtimeFor(A)!;
    const b = chat.conversations.runtimeFor(B)!;

    expect(a).not.toBe(b);
    expect(a.store).not.toBe(b.store);
    expect(a.client).not.toBe(b.client);
    // Dispatched by the host before connect, which is what stops
    // `ensureSession` from minting a session of its own.
    expect(a.store.getState().overlay.sessionId).toBe(A);
    expect(b.store.getState().overlay.sessionId).toBe(B);
  });

  test("the two transcripts are independent", async () => {
    await renderTwo();

    chat.conversations.runtimeFor(A)!.store.dispatch(timelineSlice.actions.upsertEntity(message("m1", "left hand message")));
    chat.conversations.runtimeFor(B)!.store.dispatch(timelineSlice.actions.upsertEntity(message("m2", "right hand message")));

    await waitFor(() => {
      expect(screen.getByTestId("tile-a").textContent).toContain("left hand message");
    });
    expect(screen.getByTestId("tile-a").textContent).not.toContain("right hand message");
    expect(screen.getByTestId("tile-b").textContent).toContain("right hand message");
    expect(screen.getByTestId("tile-b").textContent).not.toContain("left hand message");
  });

  test("a verb performed for conversation B is traced against B, not the active one", async () => {
    await renderTwo();
    expect(chat.conversations.activeId()).toBe(A);

    await chat.router.perform({ kind: "watch", ref: { type: "product", id: "2049" } }, undefined, { conversationId: B });

    const verbPost = fetched.find((call) => call.url.includes("/verbs"));
    expect(verbPost?.url).toBe(`/api/chat/sessions/${B}/verbs`);
  });

  test("a verb with no conversation goes to the active one", async () => {
    await renderTwo();
    chat.conversations.activate(B);

    await chat.router.perform({ kind: "watch", ref: { type: "product", id: "2049" } });

    expect(fetched.find((call) => call.url.includes("/verbs"))?.url).toBe(`/api/chat/sessions/${B}/verbs`);
  });

  test("what a tile sees is its own conversation", async () => {
    await renderTwo();

    expect(scoped.get(A)?.conversationId).toBe(A);
    expect(scoped.get(B)?.conversationId).toBe(B);
    expect(scoped.get(A)?.runtime).toBe(chat.conversations.runtimeFor(A));
  });

  test("a mention queued in A does not ride on B's next message", async () => {
    await renderTwo();
    const eagle = { type: "product", id: "2049", value: { name: "Eagle" } };
    const runtimeA = chat.conversations.runtimeFor(A)!;
    let captured: Parameters<typeof runtimeA.client.send>[0] | null = null;
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.spyOn(runtimeA.client, "send").mockImplementation(async (request) => {
      captured = request;
      await blocked;
    });

    const sending = scoped.get(A)!.send({ prompt: "how is {0}?", refs: [eagle] });
    await waitFor(() => expect(captured).not.toBeNull());
    const bodyA = (await chat.conversations.configFor(A).sendMessageBody!(captured!)) as { refs?: unknown[] };
    const bodyB = (await chat.conversations.configFor(B).sendMessageBody!({ prompt: "unrelated" })) as { refs?: unknown[] };
    release();
    await sending;

    expect(bodyA.refs).toHaveLength(1);
    expect(bodyB.refs).toBeUndefined();
  });

  test("failed send preflight cannot leak refs into a later body", async () => {
    await renderTwo();
    const eagle = { type: "product", id: "2049", value: { name: "Eagle" } };
    const runtimeA = chat.conversations.runtimeFor(A)!;
    let failedRequest: Parameters<typeof runtimeA.client.send>[0] | null = null;
    vi.spyOn(runtimeA.client, "send").mockImplementation(async (request) => {
      failedRequest = request;
      throw new Error("manifest unavailable");
    });

    await expect(scoped.get(A)!.send({ prompt: "price it", refs: [eagle] })).rejects.toThrow("manifest unavailable");
    const failedBody = (await chat.conversations.configFor(A).sendMessageBody!(failedRequest!)) as { refs?: unknown[] };
    const nextBody = (await chat.conversations.configFor(A).sendMessageBody!({ prompt: "plain" })) as { refs?: unknown[] };

    expect(failedBody.refs).toBeUndefined();
    expect(nextBody.refs).toBeUndefined();
  });

  test("closing a conversation takes its runtime down and leaves the other alone", async () => {
    await renderTwo();

    chat.conversations.close(B);

    await waitFor(() => {
      expect(chat.conversations.runtimeFor(B)).toBeNull();
    });
    expect(chat.conversations.runtimeFor(A)).not.toBeNull();
    expect(chat.conversations.get(B)?.title).toBe("right");
  });
});
