import type { ChatDebugEvent } from "@go-go-golems/chat-provider";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { chat } from "../../../demo/src/chat";
import { EventsTile, detailOf, formatEventTime } from "./EventsTile";

/**
 * The tile over chat-provider's debug store, fed synthetic frames — no
 * socket, no server, the same store the runtime pushes into.
 */

const A = "ev-a";
const B = "ev-b";

function push(conversationId: string, event: ChatDebugEvent) {
  chat.debug.push(conversationId, event);
}

function ws(conversationId: string, to: string, from?: string) {
  push(conversationId, { type: "ws-lifecycle", sessionId: conversationId, event: to as never, ...(from ? { from: from as never } : {}) });
}

function ui(conversationId: string, name: string, extra: Record<string, unknown> = {}) {
  push(conversationId, { type: "ui-event", sessionId: conversationId, name, ...extra } as ChatDebugEvent);
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
  chat.conversations.setAutoConnect(false);
  chat.conversations.adopt(A, { title: "left desk" });
  chat.conversations.adopt(B, { title: "right desk" });
  chat.conversations.activate(A);
  chat.debug.clear(A);
  chat.debug.clear(B);
});

afterEach(() => {
  cleanup();
  for (const snapshot of chat.conversations.all()) chat.conversations.forget(snapshot.id);
  vi.unstubAllGlobals();
});

function renderTile() {
  return render(
    <chat.Provider environment={{ canApprove: false, sessionId: null } as never}>
      <EventsTile />
      <chat.ObjectMenu />
    </chat.Provider>,
  );
}

function rows() {
  return [...document.querySelectorAll('[data-part="event-row"]')];
}

describe("EventsTile", () => {
  test("shows the active conversation's events, newest first", async () => {
    ws(A, "connecting");
    ws(A, "ready", "connecting");
    ui(B, "ChatMessage");

    renderTile();

    await waitFor(() => {
      expect(rows()).toHaveLength(2);
    });
    // Newest first: the transition into `ready` is the top row.
    expect(rows()[0]?.textContent).toContain("ws.ready");
    expect(document.body.textContent).not.toContain("ChatMessage");
  });

  test("pinning a conversation stops it following the active one", async () => {
    ui(B, "ChatMessage");
    renderTile();

    fireEvent.change(screen.getByLabelText("which conversation's events to show"), { target: { value: B } });

    await waitFor(() => {
      expect(rows()).toHaveLength(1);
    });
    expect(rows()[0]?.textContent).toContain("ChatMessage");

    // …and the active conversation moving no longer changes what is shown.
    chat.conversations.activate(A);
    await waitFor(() => {
      expect(rows()).toHaveLength(1);
    });
  });

  test("a family chip narrows the list and says so", async () => {
    ws(A, "ready");
    ui(A, "ChatMessage");
    renderTile();

    await waitFor(() => {
      expect(rows()).toHaveLength(2);
    });

    fireEvent.click(screen.getByRole("button", { name: "ws" }));

    await waitFor(() => {
      expect(rows()).toHaveLength(1);
    });
    expect(rows()[0]?.getAttribute("data-family")).toBe("llm");
  });

  test("the family map files chatapp events, so the llm, tool and widget chips are not permanently empty", async () => {
    ui(A, "ChatTextDelta");
    ui(A, "ChatFrontendToolCallRequested");
    ui(A, "ChatWidgetInstancePatched");
    ui(A, "SomethingNobodyFiled");
    renderTile();

    await waitFor(() => {
      expect(rows()).toHaveLength(4);
    });
    const families = rows().map((row) => row.getAttribute("data-family"));
    expect(families).toContain("llm");
    expect(families).toContain("tool");
    expect(families).toContain("widget");
    // An unfiled name still classifies, in the default family.
    expect(families).toContain("timeline");
  });

  test("the text filter matches the type and the summary", async () => {
    ws(A, "ready");
    ui(A, "ChatWidgetInstance");
    renderTile();

    fireEvent.change(screen.getByLabelText("filter events by type or summary"), { target: { value: "widget" } });

    await waitFor(() => {
      expect(rows()).toHaveLength(1);
    });
    expect(rows()[0]?.textContent).toContain("ChatWidgetInstance");
  });

  test("pause freezes the list while events keep arriving, and resume catches up", async () => {
    ws(A, "ready");
    renderTile();
    await waitFor(() => {
      expect(rows()).toHaveLength(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "pause" }));
    ui(A, "ChatMessage");
    ui(A, "ChatMessage");

    await waitFor(() => {
      expect(rows()).toHaveLength(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "resume" }));
    await waitFor(() => {
      expect(rows()).toHaveLength(3);
    });
  });

  test("clear empties this conversation's stream and leaves the other alone", async () => {
    ws(A, "ready");
    ws(B, "ready");
    renderTile();
    await waitFor(() => {
      expect(rows()).toHaveLength(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "clear" }));

    await waitFor(() => {
      expect(rows()).toHaveLength(0);
    });
    expect(chat.debug.getSnapshot(B)).toHaveLength(1);
  });

  test("a row is an object: right-click offers inspect, go-to and ask", async () => {
    ws(A, "ready");
    renderTile();
    await waitFor(() => {
      expect(rows()).toHaveLength(1);
    });

    const presentation = rows()[0]?.querySelector('[data-part="presentation"]');
    fireEvent.contextMenu(presentation as Element, { clientX: 10, clientY: 10 });

    const labels = screen.getAllByRole("menuitem").map((item) => item.textContent ?? "");
    expect(labels.some((label) => label.includes("Inspect the raw frame"))).toBe(true);
    expect(labels.some((label) => label.includes("Go to its conversation"))).toBe(true);
    expect(labels.some((label) => label.includes("Ask the agent what it means"))).toBe(true);
  });

  test("with no conversation to watch it says so rather than showing an empty list", async () => {
    chat.conversations.activate(null);
    renderTile();

    await waitFor(() => {
      expect(screen.getByText("no conversation to watch")).toBeTruthy();
    });
  });
});

describe("what a row says", () => {
  test("a lifecycle row shows the transition, not just the destination", () => {
    expect(detailOf({ event: { type: "ws-lifecycle", from: "connecting", event: "ready" } } as never)).toBe("connecting → ready");
    expect(detailOf({ event: { type: "ws-lifecycle", event: "ready" } } as never)).toBeNull();
  });

  test("a reconnect row shows the attempt and the delay, which is what you are waiting for", () => {
    expect(detailOf({ event: { type: "reconnect-scheduled", attempt: 3, delayMs: 800 } } as never)).toBe("attempt 3 in 800 ms");
  });

  test("a ui-event row shows the tool it belongs to; a clean snapshot says nothing extra", () => {
    expect(detailOf({ event: { type: "ui-event", toolName: "workbench_perform", status: "success" } } as never)).toBe("workbench_perform · success");
    expect(detailOf({ event: { type: "snapshot", droppedCount: 0 } } as never)).toBeNull();
    expect(detailOf({ event: { type: "snapshot", droppedCount: 2 } } as never)).toBe("2 entities dropped");
  });

  test("times are shown to the millisecond, because that is what ordering questions need", () => {
    const at = new Date(2026, 7, 21, 9, 5, 3, 40).getTime();
    expect(formatEventTime(at)).toBe("09:05:03.040");
  });
});
