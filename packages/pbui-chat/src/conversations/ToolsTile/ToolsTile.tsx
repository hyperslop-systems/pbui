import { Button, Chip, EmptyState, JsonBlock, SelectInput, Text, Toolbar } from "@hyperslop-systems/pbui";
import { useMemo, useState } from "react";
import { RefPresentation } from "../../components/RefPresentation";
import { usePbuiChat } from "../../context";
import type { Reference } from "../../types";
import { useConversations } from "../registry";
import { useToolTraffic, useWaiting, type ToolCall } from "../selectors";
import { formatDuration } from "../RunsTile";
import styles from "./ToolsTile.module.css";

/**
 * Every tool call across every open conversation, and — first — everything
 * that is waiting for a human (guide §4.6, D12).
 *
 * *Waiting for you* is computed rather than stored: a parked human tool is
 * already in its runtime's tool runtime and its timeline, and a count kept
 * beside them would drift the first time one was answered in another tab. The
 * cost is a pass over the entities, which `selectToolTraffic` memoises per
 * runtime so a frame in one conversation does not re-sort another's rows.
 *
 * Rows are `<tool>` objects, so the menu is the one the transcript's tool
 * cards already offer; *go to* is the one thing this tile adds, because a
 * parked tool is only answerable in the conversation that parked it.
 */

const ALL = "*";

export function toolReference(call: ToolCall): Reference {
  return {
    type: "tool",
    id: call.toolCallId,
    value: {
      name: call.toolName,
      status: call.status,
      mode: call.mode,
      conversationId: call.conversationId,
      conversation: call.conversationTitle,
      ...(call.durationMs === null ? {} : { durationMs: call.durationMs }),
      ...(call.error ? { error: call.error } : {}),
    },
  };
}

export function ToolsTile() {
  const chat = usePbuiChat();
  const registry = chat.conversations;
  // Tool calls are timeline ENTITIES, which the registry does not mirror, so
  // this tile subscribes to the open runtimes as well as to the registry.
  const traffic = useToolTraffic(registry);
  const waiting = useWaiting(registry);
  const conversations = useConversations(registry, (r) => r.all());
  const [scope, setScope] = useState<string>(ALL);
  const [status, setStatus] = useState<string>(ALL);

  const rows = useMemo(
    () =>
      traffic.filter(
        (call) => (scope === ALL || call.conversationId === scope) && (status === ALL || call.status === status),
      ),
    [traffic, scope, status],
  );
  const statuses = useMemo(() => [...new Set(traffic.map((call) => call.status))].sort(), [traffic]);

  const goTo = (call: ToolCall) => {
    void chat.router.perform({ kind: "conversation.open", conversationId: call.conversationId } as never);
  };

  return (
    <div data-part="chat-tools" className={styles.app}>
      {waiting.length > 0 ? (
        <section data-part="waiting" className={styles.waiting} aria-label="waiting for you">
          <Text size="tiny" strong>
            waiting for you · {waiting.length}
          </Text>
          <ol className={styles.waitingList}>
            {waiting.map((call) => (
              <li key={`${call.conversationId}:${call.toolCallId}`} className={styles.waitingRow} data-part="waiting-row" data-tool-call={call.toolCallId}>
                <RefPresentation reference={toolReference(call)} doc={`${call.toolName} · waiting in ${call.conversationTitle}`}>
                  <Text size="tiny" strong>
                    {call.toolName}
                  </Text>
                </RefPresentation>
                <Text size="micro" tone="faint">
                  in {call.conversationTitle}
                </Text>
                {/* The only gesture here that is not a verb on the tool: it
                    moves the user to where the tool can be answered. */}
                <Button size="tiny" variant="framed" onClick={() => goTo(call)} title="open that conversation and answer it there">
                  go to
                </Button>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <Toolbar tight className={styles.header}>
        <SelectInput
          size="tiny"
          variant="framed"
          value={scope}
          accessibleName="which conversation's tool calls to show"
          options={[{ value: ALL, label: "all conversations" }, ...conversations.filter((s) => s.runtime).map((s) => ({ value: s.id, label: s.title }))]}
          onValueChange={setScope}
        />
        <SelectInput
          size="tiny"
          variant="framed"
          value={status}
          accessibleName="which statuses to show"
          options={[{ value: ALL, label: "any status" }, ...statuses.map((value) => ({ value, label: value }))]}
          onValueChange={setStatus}
        />
      </Toolbar>

      {rows.length === 0 ? (
        <EmptyState
          message={traffic.length === 0 ? "no tool calls yet" : "nothing matches the filters"}
          hint={traffic.length === 0 ? "the agent's tool calls land here as it makes them" : "widen the conversation or the status"}
        />
      ) : (
        <ol className={styles.list} aria-label="tool traffic">
          {rows.map((call) => (
            <Row key={`${call.conversationId}:${call.toolCallId}`} call={call} />
          ))}
        </ol>
      )}

      <Text size="micro" tone="faint">
        {rows.length} of {traffic.length} call{traffic.length === 1 ? "" : "s"} · right-click one for what you can do with it
      </Text>
    </div>
  );
}

function Row({ call }: { call: ToolCall }) {
  const failed = call.status === "failed" || call.error !== undefined;
  return (
    <li className={styles.row} data-part="tool-row" data-tool-call={call.toolCallId} data-status={call.status} data-danger={failed ? "true" : undefined}>
      <RefPresentation reference={toolReference(call)} doc={`${call.toolName} · ${call.status} · in ${call.conversationTitle}`}>
        <Text size="tiny" strong>
          {call.toolName}
        </Text>
      </RefPresentation>
      <Chip label={call.status} tone={failed ? "var(--pbui-tone-proposal)" : "var(--pbui-tone-neutral)"} />
      <Text size="micro" tone="faint" className={styles.where}>
        {call.conversationTitle}
        {call.mode ? ` · ${call.mode}` : ""}
      </Text>
      <Text size="micro" tone="faint" className={styles.duration}>
        {formatDuration(call.durationMs)}
      </Text>
      {call.error ? (
        <Text size="tiny" tone="danger" className={styles.error}>
          {call.error}
        </Text>
      ) : null}
      <details className={styles.detail}>
        <summary>
          <Text size="micro" tone="faint">
            input and result
          </Text>
        </summary>
        <JsonBlock value={{ input: call.input, ...(call.result ? { result: call.result } : {}) }} maxHeight={200} />
      </details>
    </li>
  );
}
