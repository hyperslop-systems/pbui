import { timelineSlice, type TimelineEntity } from "@go-go-golems/chat-provider";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { chat, conversationApproval } from "../../../demo/src/chat";
import { ContextTile } from "./ContextTile";

/**
 * What the model was told, read back. The runtime records it as a side effect
 * of syncing and sending, so this test drives those rather than faking them.
 */

const A = "ctx-a";

function view(documents: Record<string, string>) {
  return { id: "v1", appId: "conversation-context", documents, title: "" } as never;
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
  chat.conversations.setAutoConnect(false);
  chat.conversations.adopt(A, { title: "reorder desk" });
  chat.conversations.open(A);
  chat.conversations.activate(A);
});

afterEach(() => {
  cleanup();
  for (const snapshot of chat.conversations.all()) chat.conversations.forget(snapshot.id);
  vi.unstubAllGlobals();
});

async function mount(documents: Record<string, string> = { conversation: A }) {
  render(
    <chat.Provider environment={{ canApprove: true, sessionId: A } as never}>
      <ContextTile placementId="p1" view={view(documents)} />
      <chat.ObjectMenu />
    </chat.Provider>,
  );
  await waitFor(() => {
    expect(chat.conversations.runtimeFor(A)).not.toBeNull();
  });
}

describe("ContextTile", () => {
  test("an unbound tile says so rather than showing someone else's context", () => {
    render(
      <chat.Provider environment={{ canApprove: false, sessionId: null } as never}>
        <ContextTile placementId="p1" view={view({})} />
      </chat.Provider>,
    );
    expect(screen.getByText("this tile is not bound to a conversation")).toBeTruthy();
  });

  test("before anything is sent it says so, rather than showing a stale body", async () => {
    await mount();
    expect(document.body.textContent).toContain("nothing sent from this browser yet");
  });

  test("it lists the tools this conversation can be offered, read from the registry rather than from the last sync", async () => {
    await mount();

    await waitFor(() => {
      expect(document.querySelectorAll('[data-part="manifest-tool"]').length).toBeGreaterThan(0);
    });
    const names = [...document.querySelectorAll('[data-part="manifest-tool"]')].map((row) => row.textContent ?? "");
    expect(names.some((name) => name.includes("pbui_propose"))).toBe(true);
    expect(names.some((name) => name.includes("conversation_list"))).toBe(true);
    // Not yet advertised BY THIS CODE, and the hint says what does advertise it.
    expect(document.body.textContent).toContain("advertised on connect and on every send");
  });

  test("a sync stamps when the manifest last went out", async () => {
    await mount();
    await chat.conversations.runtimeFor(A)!.syncManifest();

    await waitFor(() => {
      expect(document.body.textContent).toContain("last advertised");
    });
    expect(document.body.textContent).toMatch(/revision \d+/);
  });

  test("the last message shows the objects it carried, as objects", async () => {
    await mount();
    // What the client would call: the body function is the runtime's.
    await chat.conversations.configFor(A).sendMessageBody!({ prompt: "how is the Eagle?" });

    // The tile reads `runtime.lastSend`, which the body function just set.
    await chat.conversations.runtimeFor(A)!.syncManifest();
    await waitFor(() => {
      expect(document.body.textContent).toContain("how is the Eagle?");
    });
  });

  test("the environment and the vocabulary are shown, because both shape what the model can do", async () => {
    await mount();
    expect(document.body.textContent).toContain("canApprove");
    expect(document.body.textContent).toMatch(/vocabulary · \d+ types · \d+ verbs/);
  });

  test("forgetting the conversation while the tile is open shows the empty state rather than crashing", async () => {
    await mount();
    expect(document.body.textContent).toContain("reorder desk");

    // Every hook must run before the early return, or this render drops the
    // hook count and React throws.
    chat.conversations.forget(A);

    await waitFor(() => {
      expect(screen.getByText("that conversation is not in this browser's list")).toBeTruthy();
    });
  });

  test("the session facts name the conversation and its connection", async () => {
    await mount();
    expect(document.body.textContent).toContain(A);
    expect(document.body.textContent).toContain("reorder desk");
  });
});

describe("the demo's handoff approval", () => {
  function propose(id: string, fields: { label: string; value: string }[], decision?: string): TimelineEntity {
    return {
      id: `tc-${id}`,
      kind: "tool_call",
      createdAt: 1,
      props: {
        toolCallId: `tc-${id}`,
        toolName: "pbui_propose",
        status: decision ? "success" : "requested",
        input: { id, title: "hand it over", body: "…", fields },
        ...(decision ? { result: { decision, id } } : {}),
      },
    };
  }

  test("only an approved proposal whose fields match the send authorises it", async () => {
    await mount();
    const runtime = chat.conversations.runtimeFor(A)!;
    const fields = [
      { label: "to", value: "them" },
      { label: "message", value: "please price the Eagle" },
    ];

    // Undecided.
    runtime.store.dispatch(timelineSlice.actions.upsertEntity(propose("p1", fields)));
    expect(conversationApproval("p1", "them", "please price the Eagle")).toBe(false);

    // Rejected.
    runtime.store.dispatch(timelineSlice.actions.upsertEntity(propose("p2", fields, "reject")));
    expect(conversationApproval("p2", "them", "please price the Eagle")).toBe(false);

    // Approved, and for exactly this message.
    runtime.store.dispatch(timelineSlice.actions.upsertEntity(propose("p3", fields, "approve")));
    expect(conversationApproval("p3", "them", "please price the Eagle")).toBe(true);

    // The same approval does NOT authorise a different message or target.
    expect(conversationApproval("p3", "them", "sell everything")).toBe(false);
    expect(conversationApproval("p3", "someone-else", "please price the Eagle")).toBe(false);
  });
});
