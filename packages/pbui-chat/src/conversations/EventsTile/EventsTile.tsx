import { Button, Chip, EmptyState, SelectInput, Text, TextArea, TextInput, Toolbar } from "@hyperslop-systems/pbui";
import { useChatDebugEntries, type ChatDebugEntry, type ChatDebugFamily } from "@go-go-golems/chat-provider";
import { useMemo, useState } from "react";
import { RefPresentation } from "../../components/RefPresentation";
import { usePbuiChat } from "../../context";
import type { Reference } from "../../types";
import { useConversations } from "../registry";
import styles from "./EventsTile.module.css";

/**
 * What actually happened on the wire, for one conversation (guide §4.6, D8).
 *
 * chat-provider already records this: every `onDebugEvent` the WebSocket
 * manager emits goes into a store keyed by conversation id, classified into
 * six families, capped, and summarised at ingest time. Nothing rendered it.
 * This tile is presentation over that store and adds no state to the runtime.
 *
 * Each row IS a `<chatEvent>` object: right-click to inspect the raw frame,
 * ask the agent about it, or go to the conversation it belongs to. The
 * controls in the header are not actions on an object — they are what this
 * tile is showing — so they stay buttons.
 */

export const EVENT_FAMILIES: ChatDebugFamily[] = ["llm", "tool", "widget", "timeline", "ws", "other"];

/**
 * Which UI-event name belongs to which family.
 *
 * chat-provider's classifier takes this as an option and files every
 * unlisted `ui-event` under `timeline`. No product had ever supplied one, so
 * the `llm`, `tool` and `widget` chips were permanently empty — three of six
 * filters that could never match anything, which reads as a broken control
 * rather than as an empty category.
 *
 * The names are the chatapp event vocabulary the Go side emits. A name this
 * map does not know still classifies as `timeline`, so adding an event
 * upstream does not break the tile; it lands in the default family until
 * someone files it.
 */
export const DEFAULT_EVENT_FAMILIES: Partial<Record<string, ChatDebugFamily>> = {
  // The model producing text, reasoning, or a provider call.
  ChatRunStarted: "llm",
  ChatRunFinished: "llm",
  ChatRunFailed: "llm",
  ChatRunStopped: "llm",
  ChatProviderCallStarted: "llm",
  ChatProviderCallFinished: "llm",
  ChatProviderCallMetadataUpdated: "llm",
  ChatTextSegmentStarted: "llm",
  ChatTextDelta: "llm",
  ChatTextPatch: "llm",
  ChatTextSegmentFinished: "llm",
  ChatReasoningSegmentStarted: "llm",
  ChatReasoningDelta: "llm",
  ChatReasoningPatch: "llm",
  ChatReasoningSegmentFinished: "llm",
  ChatMessage: "llm",
  ChatUserMessageAccepted: "llm",
  // Tools, whichever side runs them.
  ChatToolCall: "tool",
  ChatToolCallRequested: "tool",
  ChatToolCallStarted: "tool",
  ChatToolCallArgumentsDelta: "tool",
  ChatToolArgumentsDelta: "tool",
  ChatToolArgumentsPatch: "tool",
  ChatToolExecutionStarted: "tool",
  ChatToolCallFinished: "tool",
  ChatToolResult: "tool",
  ChatToolResultReady: "tool",
  ChatFrontendToolCall: "tool",
  ChatFrontendToolCallRequested: "tool",
  ChatFrontendToolResult: "tool",
  ChatFrontendToolResultReceived: "tool",
  ChatFrontendToolManifest: "tool",
  ChatFrontendToolManifestUpdated: "tool",
  // Widgets the agent published.
  ChatWidgetInstance: "widget",
  ChatWidgetInstanceStarted: "widget",
  ChatWidgetInstancePatched: "widget",
  ChatWidgetInstanceCompleted: "widget",
  ChatWidgetInstanceRemoved: "widget",
  ChatWidgetAction: "widget",
};

/** Follow whichever conversation is active, rather than pinning one. */
export const FOLLOW_ACTIVE = "@active";
const SHOW_AT_MOST = 300;

export function formatEventTime(at: number): string {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return "";
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  const ms = String(date.getMilliseconds()).padStart(3, "0");
  return `${hh}:${mm}:${ss}.${ms}`;
}

/** The extra line a row shows for the frames whose detail is the point. */
export function detailOf(entry: ChatDebugEntry): string | null {
  const event = entry.event as Record<string, unknown>;
  switch (event.type) {
    case "ws-lifecycle":
      return event.from ? `${String(event.from)} → ${String(event.event)}` : null;
    case "reconnect-scheduled":
      return `attempt ${String(event.attempt)} in ${String(event.delayMs)} ms`;
    case "ui-event": {
      const parts = [event.toolName, event.status, event.adapterName].filter(Boolean).map(String);
      return parts.length > 0 ? parts.join(" · ") : null;
    }
    case "snapshot":
      return Number(event.droppedCount ?? 0) > 0 ? `${String(event.droppedCount)} entities dropped` : null;
    default:
      return null;
  }
}

/** The wire reference for one entry, so it can carry a menu like everything else. */
export function chatEventReference(entry: ChatDebugEntry, conversationId: string): Reference {
  return {
    type: "chatEvent",
    id: `${conversationId}:${entry.id}`,
    value: {
      conversationId,
      seq: entry.seq,
      at: entry.at,
      family: entry.family,
      eventType: entry.eventType,
      eventId: entry.eventId,
      summary: entry.summary,
      event: entry.event as unknown as Record<string, unknown>,
    },
  };
}

export function EventsTile() {
  const chat = usePbuiChat();
  const registry = chat.conversations;
  const conversations = useConversations(registry, (r) => r.all());
  const activeId = useConversations(registry, (r) => r.activeId());
  const [target, setTarget] = useState<string>(FOLLOW_ACTIVE);
  const [families, setFamilies] = useState<Set<ChatDebugFamily>>(() => new Set(EVENT_FAMILIES));
  const [text, setText] = useState("");
  const [paused, setPaused] = useState<readonly ChatDebugEntry[] | null>(null);
  const [exported, setExported] = useState<string | null>(null);

  const conversationId = (target === FOLLOW_ACTIVE ? activeId : target) ?? "";
  const live = useChatDebugEntries(chat.debug, conversationId);
  const source = paused ?? live;
  const needle = text.trim().toLowerCase();

  const rows = useMemo(() => {
    const filtered = source.filter(
      (entry) =>
        families.has(entry.family) &&
        (needle === "" || entry.eventType.toLowerCase().includes(needle) || entry.summary.toLowerCase().includes(needle)),
    );
    return filtered.slice(-SHOW_AT_MOST).reverse();
  }, [source, families, needle]);

  const toggleFamily = (family: ChatDebugFamily) =>
    setFamilies((current) => {
      const next = new Set(current);
      if (next.has(family)) next.delete(family);
      else next.add(family);
      return next;
    });

  const copy = async () => {
    const json = JSON.stringify(rows.map((entry) => entry.event), null, 2);
    try {
      await navigator.clipboard.writeText(json);
      setExported(null);
    } catch {
      // No clipboard (permissions, insecure context): show it to select by hand.
      setExported(json);
    }
  };

  return (
    <div data-part="chat-events" className={styles.app}>
      <Toolbar tight className={styles.header}>
        <SelectInput
          size="tiny"
          variant="framed"
          value={target}
          accessibleName="which conversation's events to show"
          options={[
            { value: FOLLOW_ACTIVE, label: "active conversation" },
            ...conversations.map((snapshot) => ({ value: snapshot.id, label: snapshot.title })),
          ]}
          onValueChange={setTarget}
        />
        <span className={styles.spacer} />
        <TextInput size="tiny" width="compact" value={text} onValueChange={setText} accessibleName="filter events by type or summary" placeholder="filter" />
        <Button size="tiny" variant="framed" selected={paused !== null} aria-pressed={paused !== null} onClick={() => setPaused((p) => (p ? null : live))}>
          {paused ? "resume" : "pause"}
        </Button>
        <Button size="tiny" variant="bare" onClick={() => void copy()} disabled={rows.length === 0} title="the raw frames of the rows shown, as JSON">
          copy as JSON
        </Button>
        <Button size="tiny" variant="bare" onClick={() => chat.debug.clear(conversationId)} disabled={live.length === 0}>
          clear
        </Button>
      </Toolbar>

      <div role="group" aria-label="families">
        <Toolbar tight className={styles.families}>
          {EVENT_FAMILIES.map((family) => (
            <Button key={family} size="tiny" variant="bare" selected={families.has(family)} aria-pressed={families.has(family)} onClick={() => toggleFamily(family)}>
              {family}
            </Button>
          ))}
        </Toolbar>
      </div>

      {exported !== null ? (
        <TextArea code rows={6} value={exported} onValueChange={() => {}} accessibleName="events as JSON (the clipboard was not available)" readOnly />
      ) : null}

      {rows.length === 0 ? (
        <EmptyState
          message={conversationId === "" ? "no conversation to watch" : live.length === 0 ? "nothing on the wire yet" : "nothing matches the filters"}
          hint={conversationId === "" ? "activate a conversation, or pin one above" : live.length === 0 ? "send a message and watch it arrive" : "widen the families or clear the filter"}
        />
      ) : (
        <ol className={styles.list} aria-label="chat events">
          {rows.map((entry) => (
            <Row key={entry.id} entry={entry} conversationId={conversationId} />
          ))}
        </ol>
      )}

      <Text size="micro" tone="faint">
        {rows.length} of {source.length} events{paused ? " · paused" : ""} · right-click one for what you can do with it
      </Text>
    </div>
  );
}

function Row({ entry, conversationId }: { entry: ChatDebugEntry; conversationId: string }) {
  const detail = detailOf(entry);
  const danger = entry.family === "ws" && /error|failed|closed/i.test(entry.eventType);
  return (
    <li className={styles.row} data-part="event-row" data-family={entry.family} data-seq={entry.seq} data-danger={danger ? "true" : undefined}>
      <Text size="micro" tone="faint" className={styles.time}>
        {formatEventTime(entry.at)}
      </Text>
      <Chip label={entry.family} tone={`var(--pbui-tone-${entry.family}, var(--pbui-tone-neutral))`} />
      <RefPresentation reference={chatEventReference(entry, conversationId)} doc={`${entry.family} event · ${entry.summary}`}>
        <Text size="tiny" strong>
          {entry.eventType}
        </Text>
      </RefPresentation>
      <Text size="micro" tone="faint" className={styles.id}>
        {entry.eventId}
      </Text>
      <Text size="tiny" tone={danger ? "danger" : "default"} className={styles.summary}>
        {detail ?? entry.summary}
      </Text>
    </li>
  );
}
