import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { chat } from "../../../demo/src/chat";
import { ConversationsTile, ageOf, statusOf } from "./ConversationsTile";
import type { ConversationSnapshot } from "../registry";

/**
 * The list through the real registry, the real router and the real object
 * menu: a row IS a `<conversation>` presentation, so every action in these
 * tests is reached by right-clicking it and choosing the menu entry the
 * product's descriptor supplies — the same entry a mention in a transcript
 * would offer.
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
      <chat.ObjectMenu />
    </chat.Provider>,
  );
}

/** Right-click a conversation and choose an entry from its object menu. */
function menu(id: string, label: string | RegExp) {
  fireEvent.contextMenu(screen.getByTestId(`conversation-${id}`), { clientX: 10, clientY: 10 });
  return screen.getByRole("menuitem", { name: label });
}

function choose(id: string, label: string | RegExp) {
  fireEvent.click(menu(id, label));
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

  test("the object menu is the one door: every action on a conversation is in it", () => {
    renderTile();

    fireEvent.contextMenu(screen.getByTestId(`conversation-${B}`), { clientX: 10, clientY: 10 });
    const labels = screen.getAllByRole("menuitem").map((item) => item.textContent ?? "");

    for (const wanted of ["Open in a tile", "Make it the active one", "Rename…", "Archive it", "Disconnect it", "Hand something to this agent…", "Drop it from the list"]) {
      expect(labels.some((label) => label.includes(wanted)), `${wanted} is missing from the menu`).toBe(true);
    }
    // …and the tile itself offers no per-row buttons beside them.
    expect(row(B).querySelectorAll("button[data-part='menu-item']")).toHaveLength(0);
  });

  test("activate goes through the router, so the trace records it", async () => {
    renderTile();

    choose(B, "Make it the active one");

    await waitFor(() => {
      expect(chat.conversations.activeId()).toBe(B);
    });
    // A verb that would change nothing stays in the menu WITH its reason
    // appended to the label, rather than disappearing.
    const entry = menu(B, /Make it the active one/);
    expect(entry.hasAttribute("disabled")).toBe(true);
    expect(entry.textContent).toContain("already the active conversation");
  });

  test("Rename… opens the editor rather than carrying a name the menu cannot collect", async () => {
    renderTile();

    choose(A, "Rename…");

    const field = await screen.findByLabelText("conversation name");
    fireEvent.change(field, { target: { value: "gold desk" } });
    fireEvent.keyDown(field, { key: "Enter" });

    await waitFor(() => {
      expect(chat.conversations.get(A)?.title).toBe("gold desk");
    });
    expect(chat.conversations.get(A)?.titledBy).toBe("human");
  });

  test("pin sorts a conversation to the top; archive hides it behind a toggle", async () => {
    renderTile();

    choose(B, "Keep it at the top");
    await waitFor(() => {
      expect(chat.conversations.all()[0]?.id).toBe(B);
    });

    choose(B, "Archive it");
    await waitFor(() => {
      expect(document.querySelector(`[data-conversation="${B}"]`)).toBeNull();
    });

    fireEvent.click(screen.getByRole("button", { name: /archived \(1\)/ }));
    await waitFor(() => {
      expect(document.querySelector(`[data-conversation="${B}"]`)).not.toBeNull();
    });
  });

  test("dropping a conversation removes the row", async () => {
    renderTile();

    choose(B, "Drop it from the list");

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
