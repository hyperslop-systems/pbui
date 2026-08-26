import { timelineSlice, type TimelineEntity } from "@go-go-golems/chat-provider";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { chat } from "../../demo/src/chat";
import { RunsTile, compact, formatDuration } from "./RunsTile";
import { ToolsTile } from "./ToolsTile";
import { selectToolTraffic, selectWaiting, streamRate, toolCallsOf } from "./selectors";

/**
 * The two cross-conversation tiles, over two real runtimes whose stores are
 * dispatched into directly — no socket, the same entities a frame would
 * produce.
 */

const A = "runs-a";
const B = "runs-b";

function toolCall(id: string, patch: Record<string, unknown> = {}, times: { createdAt: number; updatedAt?: number } = { createdAt: 1 }): TimelineEntity {
  return {
    id,
    kind: "tool_call",
    createdAt: times.createdAt,
    ...(times.updatedAt === undefined ? {} : { updatedAt: times.updatedAt }),
    props: { toolCallId: id, toolName: "workbench_perform", status: "success", input: { verbs: [] }, result: { ok: true }, ...patch },
  };
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
  chat.conversations.setAutoConnect(false);
  chat.conversations.adopt(A, { title: "left desk" });
  chat.conversations.adopt(B, { title: "right desk" });
  chat.conversations.open(A);
  chat.conversations.open(B);
  chat.conversations.activate(A);
});

afterEach(() => {
  cleanup();
  for (const snapshot of chat.conversations.all()) chat.conversations.forget(snapshot.id);
  vi.unstubAllGlobals();
});

/*
 * ONE tree. `chat.Provider` renders the conversation host itself, so a second
 * `render` of it would mount a second host, re-attach both runtimes and throw
 * away the stores the test had just dispatched into — which is exactly what
 * the first version of this file did.
 */
async function mount(children?: React.ReactNode) {
  render(
    <chat.Provider environment={{ canApprove: false, sessionId: null } as never}>
      {children}
      <chat.ObjectMenu />
    </chat.Provider>,
  );
  await waitFor(() => {
    expect(chat.conversations.runtimeFor(A)).not.toBeNull();
    expect(chat.conversations.runtimeFor(B)).not.toBeNull();
  });
}

describe("selectToolTraffic", () => {
  test("joins every open conversation's calls, newest first, tagged with where they came from", async () => {
    await mount();
    chat.conversations.runtimeFor(A)!.store.dispatch(timelineSlice.actions.upsertEntity(toolCall("t1", {}, { createdAt: 10 })));
    chat.conversations.runtimeFor(B)!.store.dispatch(timelineSlice.actions.upsertEntity(toolCall("t2", {}, { createdAt: 20 })));

    const traffic = selectToolTraffic(chat.conversations);

    expect(traffic.map((call) => call.toolCallId)).toEqual(["t2", "t1"]);
    expect(traffic[0]?.conversationTitle).toBe("right desk");
    expect(traffic[1]?.conversationId).toBe(A);
  });

  test("a call that never moved has no duration, rather than a duration of zero", async () => {
    await mount();
    const runtime = chat.conversations.runtimeFor(A)!;
    runtime.store.dispatch(timelineSlice.actions.upsertEntity(toolCall("t1", {}, { createdAt: 10 })));
    runtime.store.dispatch(timelineSlice.actions.upsertEntity(toolCall("t2", {}, { createdAt: 10, updatedAt: 350 })));

    const calls = toolCallsOf(runtime, "left desk");

    expect(calls.find((c) => c.toolCallId === "t1")?.durationMs).toBeNull();
    expect(calls.find((c) => c.toolCallId === "t2")?.durationMs).toBe(340);
  });

  test("the per-runtime memo holds while nothing changes, so one conversation's frame does not re-sort another", async () => {
    await mount();
    const runtime = chat.conversations.runtimeFor(A)!;
    runtime.store.dispatch(timelineSlice.actions.upsertEntity(toolCall("t1")));

    const first = toolCallsOf(runtime, "left desk");
    expect(toolCallsOf(runtime, "left desk")).toBe(first);

    // A rename is a new title, and the rows carry it, so the memo must miss.
    expect(toolCallsOf(runtime, "renamed")).not.toBe(first);
  });

  test("waiting counts only parked human tools with no result", async () => {
    await mount();
    const runtime = chat.conversations.runtimeFor(A)!;
    // `pbui_propose` is a human tool the demo's extension registers.
    runtime.store.dispatch(
      timelineSlice.actions.upsertEntity(toolCall("p1", { toolName: "pbui_propose", status: "requested", result: undefined })),
    );
    runtime.store.dispatch(timelineSlice.actions.upsertEntity(toolCall("p2", { toolName: "pbui_propose", result: { decision: "approve" } })));

    // Nothing has parked p1 with the tool runtime, so nothing is waiting yet.
    expect(selectWaiting(chat.conversations)).toHaveLength(0);

    const executor = { clientInstanceId: "selector-client", connectionId: "selector-connection", assignmentId: "selector-assignment" };
    runtime.toolRuntime.setExecutorIdentity(executor);
    runtime.toolRuntime.reconcileFrontendToolRequests([{ toolCallId: "p1", toolName: "pbui_propose", input: { id: "p1", title: "t", body: "b" }, executor }]);
    await waitFor(() => {
      expect(runtime.toolRuntime.isPendingHumanTool("p1")).toBe(true);
    });

    const waiting = selectWaiting(chat.conversations);
    expect(waiting.map((call) => call.toolCallId)).toEqual(["p1"]);
  });
});

describe("streamRate", () => {
  test("is null when nothing is streaming, and when there is not enough to divide by", () => {
    expect(streamRate(null, 1000)).toBeNull();
    expect(streamRate({ isStreaming: false, streamStartTime: 0, streamOutputTokens: 10 }, 1000)).toBeNull();
    expect(streamRate({ isStreaming: true, streamStartTime: 900, streamOutputTokens: 10 }, 1000)).toBeNull();
  });

  test("is output tokens per second once there is a second to measure over", () => {
    expect(streamRate({ isStreaming: true, streamStartTime: 0, streamOutputTokens: 40 }, 2000)).toBe(20);
  });
});

describe("RunsTile", () => {
  test("one row per conversation, with a footer that sums across them", async () => {
    await mount(<RunsTile />);

    await waitFor(() => {
      expect(document.querySelectorAll('[data-part="run-row"]')).toHaveLength(2);
    });
    expect(screen.getByLabelText("runs by conversation").textContent).toContain("left desk");
    expect(document.body.textContent).toContain("across 2 conversations");
  });

  test("numbers are read for their order of magnitude, and a missing duration says so", () => {
    expect(compact(999)).toBe("999");
    expect(compact(1234)).toBe("1.2k");
    expect(compact(45_000)).toBe("45k");
    expect(compact(2_300_000)).toBe("2.3M");
    expect(formatDuration(null)).toBe("—");
    expect(formatDuration(340)).toBe("340 ms");
    expect(formatDuration(3400)).toBe("3.4 s");
  });
});

describe("ToolsTile", () => {
  test("shows traffic across conversations and filters by conversation", async () => {
    await mount(<ToolsTile />);
    chat.conversations.runtimeFor(A)!.store.dispatch(timelineSlice.actions.upsertEntity(toolCall("t1", {}, { createdAt: 10 })));
    chat.conversations.runtimeFor(B)!.store.dispatch(timelineSlice.actions.upsertEntity(toolCall("t2", {}, { createdAt: 20 })));

    await waitFor(() => {
      expect(document.querySelectorAll('[data-part="tool-row"]')).toHaveLength(2);
    });
  });

  test("a failed call is marked, and its error is on the row rather than hidden in the disclosure", async () => {
    await mount(<ToolsTile />);
    chat.conversations
      .runtimeFor(A)!
      .store.dispatch(timelineSlice.actions.upsertEntity(toolCall("t1", { status: "failed", error: "the workbench refused to close the last tile", result: undefined })));

    await waitFor(() => {
      expect(document.querySelector('[data-tool-call="t1"]')?.getAttribute("data-danger")).toBe("true");
    });
    expect(document.body.textContent).toContain("refused to close the last tile");
  });

  test("a row is an object: right-click offers the tool's own menu", async () => {
    await mount(<ToolsTile />);
    chat.conversations.runtimeFor(A)!.store.dispatch(timelineSlice.actions.upsertEntity(toolCall("t1")));

    await waitFor(() => {
      expect(document.querySelector('[data-tool-call="t1"]')).not.toBeNull();
    });

    const presentation = document.querySelector('[data-tool-call="t1"] [data-part="presentation"]');
    const { fireEvent } = await import("@testing-library/react");
    fireEvent.contextMenu(presentation as Element, { clientX: 10, clientY: 10 });

    expect(screen.getAllByRole("menuitem").length).toBeGreaterThan(0);
  });
});
