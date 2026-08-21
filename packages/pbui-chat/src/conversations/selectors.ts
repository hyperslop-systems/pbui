import { selectTimelineEntities, type TimelineEntity } from "@go-go-golems/chat-provider";
import { useCallback, useSyncExternalStore } from "react";
import type { ConversationRegistry } from "./registry";
import type { ChatRuntime } from "./runtime";

/**
 * Cross-conversation reads for the Runs and Tools tiles (guide D9).
 *
 * The Runs table needs only what the registry already mirrors, so it reads
 * snapshots and subscribes to nothing else. Tool traffic is the exception:
 * it needs timeline ENTITIES, which the registry does not mirror — there can
 * be thousands and they change on every frame. So this module reads each open
 * runtime's store directly, and memoises per runtime, so a frame arriving in
 * conversation A does not re-sort conversation B's rows.
 */

export interface ToolCall {
  conversationId: string;
  conversationTitle: string;
  toolCallId: string;
  toolName: string;
  /** `frontend`, `human`, `backend`, or "" when the tool is not registered here. */
  mode: string;
  status: string;
  createdAt: number;
  updatedAt: number;
  durationMs: number | null;
  input: unknown;
  result: Record<string, unknown> | undefined;
  error: string | undefined;
  /** A human tool still parked, waiting for a decision. */
  waiting: boolean;
}

interface Memo {
  entities: readonly TimelineEntity[];
  title: string;
  parked: string;
  calls: ToolCall[];
}

const memos = new WeakMap<ChatRuntime, Memo>();

/**
 * Which human tools are parked right now, as a string to compare.
 *
 * Answering a parked tool changes nothing about the timeline entities — the
 * result arrives later, in its own frame — so an entity-identity memo would
 * keep saying "waiting" after the user had decided. Only human tool calls
 * without a result are asked about, and nothing is allocated per call.
 */
function parkedSignature(runtime: ChatRuntime, entities: readonly TimelineEntity[]): string {
  let signature = "";
  for (const entity of entities) {
    if (entity.kind !== "tool_call" || entity.props.result) continue;
    if (runtime.toolRegistry.get(String(entity.props.toolName ?? ""))?.mode !== "human") continue;
    signature += runtime.toolRuntime.isPendingHumanTool(String(entity.props.toolCallId ?? entity.id)) ? "1" : "0";
  }
  return signature;
}

/** One runtime's tool calls, recomputed only when its timeline, its title or what is parked changed. */
export function toolCallsOf(runtime: ChatRuntime, conversationTitle: string): ToolCall[] {
  const entities = selectTimelineEntities(runtime.store.getState());
  const parked = parkedSignature(runtime, entities);
  const memo = memos.get(runtime);
  if (memo && memo.entities === entities && memo.title === conversationTitle && memo.parked === parked) return memo.calls;

  const calls: ToolCall[] = [];
  for (const entity of entities) {
    if (entity.kind !== "tool_call") continue;
    const toolCallId = String(entity.props.toolCallId ?? entity.id);
    const toolName = String(entity.props.toolName ?? "unknown");
    const result = (entity.props.result ?? undefined) as Record<string, unknown> | undefined;
    const tool = runtime.toolRegistry.get(toolName);
    const createdAt = entity.createdAt;
    const updatedAt = entity.updatedAt ?? entity.createdAt;
    calls.push({
      conversationId: runtime.sessionId,
      conversationTitle,
      toolCallId,
      toolName,
      mode: tool?.mode ?? "",
      status: String(entity.props.status ?? "requested"),
      createdAt,
      updatedAt,
      // `updatedAt` is only set once a call has changed; a call that arrived
      // and never moved has no duration rather than a duration of zero.
      durationMs: entity.updatedAt === undefined ? null : Math.max(0, updatedAt - createdAt),
      input: entity.props.input,
      result,
      error: typeof entity.props.error === "string" ? entity.props.error : undefined,
      waiting: tool?.mode === "human" && !result && runtime.toolRuntime.isPendingHumanTool(toolCallId),
    });
  }
  memos.set(runtime, { entities, title: conversationTitle, parked, calls });
  return calls;
}

/*
 * `useConversations` feeds `useSyncExternalStore`, which compares snapshots by
 * IDENTITY: a selector that builds a fresh array every call re-renders
 * forever. `all()` and `toolCallsOf` are each stable until their inputs
 * change, so the join memoises on exactly those identities.
 */
interface TrafficMemo {
  key: readonly unknown[];
  rows: ToolCall[];
}

const trafficMemos = new WeakMap<ConversationRegistry, TrafficMemo>();
const waitingMemos = new WeakMap<ConversationRegistry, TrafficMemo>();

function sameKey(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/** Every tool call across every OPEN conversation, newest first. */
export function selectToolTraffic(registry: ConversationRegistry): ToolCall[] {
  const snapshots = registry.all();
  const key: unknown[] = [snapshots];
  const parts: ToolCall[][] = [];
  for (const snapshot of snapshots) {
    if (!snapshot.runtime) continue;
    const calls = toolCallsOf(snapshot.runtime, snapshot.title);
    key.push(calls);
    parts.push(calls);
  }

  const memo = trafficMemos.get(registry);
  if (memo && sameKey(memo.key, key)) return memo.rows;

  const rows = parts.flat().sort((a, b) => b.createdAt - a.createdAt);
  trafficMemos.set(registry, { key, rows });
  return rows;
}

/** What is waiting for a human decision, across every open conversation, oldest first. */
export function selectWaiting(registry: ConversationRegistry): ToolCall[] {
  return selectWaitingOf(selectToolTraffic(registry), registry);
}

function selectWaitingOf(traffic: ToolCall[], registry: ConversationRegistry): ToolCall[] {
  const memo = waitingMemos.get(registry);
  if (memo && memo.key[0] === traffic) return memo.rows;

  const rows = traffic.filter((call) => call.waiting).sort((a, b) => a.createdAt - b.createdAt);
  waitingMemos.set(registry, { key: [traffic], rows });
  return rows;
}

/**
 * Subscribe a component to tool traffic.
 *
 * The registry is not enough on its own: it mirrors a handful of fields and
 * notifies when one of them changes, and a tool call arriving changes none of
 * them — the count of messages is the same, the run stats are the same. So
 * this hook subscribes to the registry AND to each open runtime's store,
 * re-attaching only when the set of open runtimes actually changed. It is the
 * exception D9 names: everything else cross-conversation reads mirrors.
 */
export function useToolTraffic(registry: ConversationRegistry): ToolCall[] {
  const subscribe = useCallback(
    (onChange: () => void) => {
      let attached: { runtime: ChatRuntime; off: () => void }[] = [];

      const reattach = () => {
        const open = registry
          .all()
          .map((snapshot) => snapshot.runtime)
          .filter((runtime): runtime is ChatRuntime => runtime !== null);
        const unchanged = attached.length === open.length && attached.every((entry, index) => entry.runtime === open[index]);
        if (unchanged) return;
        for (const entry of attached) entry.off();
        attached = open.map((runtime) => ({ runtime, off: runtime.store.subscribe(onChange) }));
      };

      const offRegistry = registry.subscribe(() => {
        reattach();
        onChange();
      });
      reattach();

      return () => {
        offRegistry();
        for (const entry of attached) entry.off();
      };
    },
    [registry],
  );

  return useSyncExternalStore(
    subscribe,
    () => selectToolTraffic(registry),
    () => selectToolTraffic(registry),
  );
}

/** The same subscription, narrowed to what is asked of the user. */
export function useWaiting(registry: ConversationRegistry): ToolCall[] {
  const traffic = useToolTraffic(registry);
  return selectWaitingOf(traffic, registry);
}

/**
 * Output tokens per second for a conversation that is streaming right now.
 * Null when it is not streaming, or in the first moments before there is
 * enough to divide by — a rate computed over three milliseconds is a number,
 * not a measurement.
 */
export function streamRate(stats: { isStreaming: boolean; streamStartTime: number | null; streamOutputTokens: number } | null, now: number): number | null {
  if (!stats?.isStreaming || stats.streamStartTime === null) return null;
  const seconds = (now - stats.streamStartTime) / 1000;
  if (seconds < 0.25) return null;
  return stats.streamOutputTokens / seconds;
}
