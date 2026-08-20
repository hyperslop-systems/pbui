import { EmptyState, JsonBlock, Text } from "@hyperslop-systems/pbui";
import {
  selectTimelineEntities,
  ToolCallOutlet,
  useChatRuntime,
  useChatSelector,
  WidgetOutlet,
  type TimelineEntity,
} from "@go-go-golems/chat-provider";
import { useEffect, useRef } from "react";
import { TRACE_ENTITY_KIND } from "../../adapters/traceAdapter";
import { usePbuiChat } from "../../context";
import { REFS_WIDGET_NAME } from "../../refs/referenceIndex";
import { usePbuiChatStore } from "../../store/chatStore";
import { ACCEPT_TOOL_NAME } from "../../tools/acceptTool";
import { AcceptStatus } from "../../tools/AcceptStatus";
import { PROPOSE_TOOL_NAME } from "../../tools/proposeTool";
import { ProposalCard } from "../../tools/ProposalCard";
import { MessageRow } from "../MessageRow";
import { ToolCard } from "../ToolCard";
import styles from "./Messages.module.css";

export interface MessagesProps {
  className?: string;
  /** Keep the newest entry in view as the timeline grows (default true). */
  follow?: boolean;
  empty?: React.ReactNode;
}

/**
 * The transcript. Every timeline entity is rendered by kind: messages as
 * prose with live mentions, widgets through chat-provider's outlet (which
 * dispatches to `pbui.widget` / `pbui.error`; `pbui.refs` is invisible),
 * tool calls as `<tool>` cards or, while a human tool is parked, its own
 * UI, and anything this client does not know as folded JSON — never nothing,
 * never a crash.
 */
export function Messages({ className, follow = true, empty }: MessagesProps) {
  const chat = usePbuiChat();
  const entities = useChatSelector(selectTimelineEntities);
  const tiles = usePbuiChatStore(chat.store, (s) => s.tiles);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (follow) end.current?.scrollIntoView?.({ block: "end" });
  }, [entities, follow]);

  const visible = entities.filter((entity) => {
    if (entity.kind === TRACE_ENTITY_KIND) return false;
    if (entity.kind === "widget") {
      if (entity.props.widgetName === REFS_WIDGET_NAME) return false;
      const id = String(entity.props.instanceId ?? entity.id);
      if (tiles.includes(id)) return false;
    }
    return true;
  });

  if (visible.length === 0) {
    return (
      <div data-part="messages" className={[styles.list, className ?? ""].filter(Boolean).join(" ")}>
        {empty ?? <EmptyState message="no messages yet" hint="ask about the shop, or mention an object with the insert button" />}
        <div ref={end} />
      </div>
    );
  }

  return (
    <div data-part="messages" className={[styles.list, className ?? ""].filter(Boolean).join(" ")} role="log" aria-label="conversation">
      {visible.map((entity) => (
        <div key={entity.id} data-timeline-kind={entity.kind} data-timeline-id={entity.id} className={styles.entry}>
          <Entry entity={entity} />
        </div>
      ))}
      <div ref={end} />
    </div>
  );
}

function Entry({ entity }: { entity: TimelineEntity }) {
  switch (entity.kind) {
    case "message":
      return <MessageRow entity={entity} />;
    case "widget":
      return (
        <WidgetOutlet
          instanceId={String(entity.props.instanceId ?? entity.id)}
          widgetName={String(entity.props.widgetName ?? "unknown")}
          status={String(entity.props.status ?? "READY")}
          props={(entity.props.props as Record<string, unknown>) ?? {}}
        />
      );
    case "tool_call":
      return <ToolCallEntry entity={entity} />;
    default:
      return (
        <details className={styles.unknown} data-part="unknown-entity">
          <summary>
            <Text size="tiny" tone="faint">
              {entity.kind} · {entity.id}
            </Text>
          </summary>
          <JsonBlock value={entity.props} maxHeight={160} />
        </details>
      );
  }
}

function ToolCallEntry({ entity }: { entity: TimelineEntity }) {
  const { client, toolRuntime } = useChatRuntime();
  const toolCallId = String(entity.props.toolCallId ?? entity.id);
  const toolName = String(entity.props.toolName ?? "unknown");
  const status = String(entity.props.status ?? "requested");
  const input = entity.props.input;
  const result = entity.props.result as Record<string, unknown> | undefined;
  const error = typeof entity.props.error === "string" ? entity.props.error : undefined;
  const tool = client.tools.get(toolName);
  const pendingHuman = tool?.mode === "human" && toolRuntime.isPendingHumanTool(toolCallId) && !result;

  if (pendingHuman) {
    return <ToolCallOutlet toolCallId={toolCallId} toolName={toolName} status={status} input={input} result={result} error={error} />;
  }

  const inputRecord = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;

  if (toolName === PROPOSE_TOOL_NAME) {
    const decision = result?.decision === "approve" || result?.decision === "reject" ? result.decision : undefined;
    return (
      <ProposalCard
        id={String(inputRecord.id ?? toolCallId)}
        toolCallId={toolCallId}
        title={String(inputRecord.title ?? "proposal")}
        body={String(inputRecord.body ?? "")}
        danger={inputRecord.danger === true}
        fields={Array.isArray(inputRecord.fields) ? (inputRecord.fields as { label: string; value: string }[]) : undefined}
        decision={decision ?? (status === "denied" ? "reject" : undefined)}
      />
    );
  }

  if (toolName === ACCEPT_TOOL_NAME) {
    const types = Array.isArray(inputRecord.types) ? inputRecord.types.map(String) : [];
    const picked = result && typeof result.reference === "object" && result.reference ? (result.reference as { type: string; id: string }) : null;
    return (
      <AcceptStatus
        types={types}
        prompt={String(inputRecord.prompt ?? "")}
        outcome={picked ? { kind: "picked", type: picked.type, label: picked.id } : result || status !== "requested" ? { kind: "cancelled" } : undefined}
      />
    );
  }

  return (
    <ToolCard
      toolCallId={toolCallId}
      toolName={toolName}
      status={status}
      parentMessageId={typeof entity.props.parentMessageId === "string" ? entity.props.parentMessageId : undefined}
      input={input}
      result={result}
      error={error}
    />
  );
}
