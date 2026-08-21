import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { chat } from "../../../demo/src/chat";
import { ConversationsTile, ageOf, statusOf } from "./ConversationsTile";
import type { ConversationSnapshot } from "../registry";

/**
 * The list, and the actions on a row, through the real registry and the real
 * router — so a rename here is the same `conversation.rename` an agent would
 * perform, validated against the demo's vocabulary on the way.
 */

const A = "row-a";
const B = "row-b";
let created: string[] = [];

beforeEach(() => {
  created = [];
  let next = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/chat/sessions")) {
        next += 1;
        const sessionId = `made-${next}`;
        created.push(sessionId);
        return new Response(JSON.stringify({ sessionId }), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    }),
  );
  chat.conversations.setAutoConnect(false);
  chat.conversations.adopt(A, { title: "left desk" });
  chat.conversations.adopt(B, { title: "right desk" });
  chat.conversations.activate(A);
});

afterEach(() => {
  cleanup();
  for (const snapshot of chat.conversations.all()) chat.conversations.forget(snapshot.id);
  vi.unstubAllGlobals();
});

function renderTile() {
  return render(
    <chat.Provider environment={{ canApprove: false, sessionId: null } as never}>
      <ConversationsTile />
    </chat.Provider>,
  );
}

function row(id: string): HTMLElement {
  const element = document.querySelector(`[data-conversation="${id}"]`);
  if (!element) throw new Error(`no row for ${id}`);
  return element as HTMLElement;
}

describe("ConversationsTile", () => {
  test("one row per conversation, the active one marked", () => {
    renderTile();

    expect(screen.getByRole("list", { name: "conversations" })).toBeTruthy();
    expect(row(A).getAttribute("data-active")).toBe("true");
    expect(row(B).getAttribute("data-active")).toBeNull();
    expect(row(A).textContent).toContain("left desk");
  });

  test("new conversation mints a session and opens it", async () => {
    renderTile();

    fireEvent.click(screen.getByRole("button", { name: /new conversation/ }));

    await waitFor(() => {
      expect(created).toHaveLength(1);
    });
    const id = created[0]!;
    expect(chat.conversations.get(id)).not.toBeNull();
    expect(chat.conversations.activeId()).toBe(id);
  });

  test("activate goes through the router, so the trace records it", async () => {
    renderTile();

    fireEvent.click(within(row(B)).getByRole("button", { name: "activate" }));

    await waitFor(() => {
      expect(chat.conversations.activeId()).toBe(B);
    });
    // The active row's own activate button is the one gesture that is not
    // offered: it would be a verb that changes nothing.
    expect(within(row(B)).getByRole("button", { name: "activate" }).hasAttribute("disabled")).toBe(true);
  });

  test("rename replaces the title in place and marks it owned", async () => {
    renderTile();

    fireEvent.click(within(row(A)).getByRole("button", { name: "rename" }));
    const field = screen.getByLabelText("conversation name");
    fireEvent.change(field, { target: { value: "gold desk" } });
    fireEvent.keyDown(field, { key: "Enter" });

    await waitFor(() => {
      expect(chat.conversations.get(A)?.title).toBe("gold desk");
    });
    expect(chat.conversations.get(A)?.titledBy).toBe("human");
  });

  test("pin sorts a conversation to the top; archive hides it behind a toggle", async () => {
    renderTile();

    fireEvent.click(within(row(B)).getByRole("button", { name: "pin" }));
    await waitFor(() => {
      expect(chat.conversations.all()[0]?.id).toBe(B);
    });

    fireEvent.click(within(row(B)).getByRole("button", { name: "archive" }));
    await waitFor(() => {
      expect(document.querySelector(`[data-conversation="${B}"]`)).toBeNull();
    });

    fireEvent.click(screen.getByRole("button", { name: /archived \(1\)/ }));
    await waitFor(() => {
      expect(document.querySelector(`[data-conversation="${B}"]`)).not.toBeNull();
    });
  });

  test("forget drops the row", async () => {
    renderTile();

    fireEvent.click(within(row(B)).getByRole("button", { name: "forget" }));

    await waitFor(() => {
      expect(document.querySelector(`[data-conversation="${B}"]`)).toBeNull();
    });
    expect(chat.conversations.get(B)).toBeNull();
  });

  test("the filter narrows the list by name", async () => {
    renderTile();

    fireEvent.change(screen.getByLabelText("filter conversations by name"), { target: { value: "right" } });

    await waitFor(() => {
      expect(document.querySelector(`[data-conversation="${A}"]`)).toBeNull();
    });
    expect(document.querySelector(`[data-conversation="${B}"]`)).not.toBeNull();
  });
});

function snapshot(patch: Partial<ConversationSnapshot>): ConversationSnapshot {
  return {
    id: "x",
    title: "x",
    titledBy: "auto",
    createdAt: "2026-08-21T00:00:00.000Z",
    lastActivityAt: "2026-08-21T00:00:00.000Z",
    pinned: false,
    archived: false,
    messageCount: 0,
    runStatus: "idle",
    wsStatus: "ready",
    error: null,
    streaming: false,
    stats: null,
    waiting: 0,
    runtime: null,
    open: true,
    active: false,
    ...patch,
  };
}

describe("what a row says", () => {
  test("streaming beats error beats waiting; a closed conversation says closed", () => {
    expect(statusOf(snapshot({ streaming: true, error: "boom", waiting: 2 })).label).toBe("streaming");
    expect(statusOf(snapshot({ error: "boom", waiting: 2 })).label).toBe("error");
    expect(statusOf(snapshot({ waiting: 2 })).label).toBe("waiting · 2");
    expect(statusOf(snapshot({ open: false, streaming: true })).label).toBe("closed");
  });

  test("a timestamp nobody reads is said as an age", () => {
    const now = Date.parse("2026-08-21T12:00:00.000Z");
    expect(ageOf("2026-08-21T11:59:30.000Z", now)).toBe("just now");
    expect(ageOf("2026-08-21T11:30:00.000Z", now)).toBe("30m ago");
    expect(ageOf("2026-08-21T09:00:00.000Z", now)).toBe("3h ago");
    expect(ageOf("2026-08-19T12:00:00.000Z", now)).toBe("2d ago");
  });
});
