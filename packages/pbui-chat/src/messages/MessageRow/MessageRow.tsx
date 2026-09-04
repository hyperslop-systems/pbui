import { Callout, Text } from "@hyperslop-systems/pbui";
import type { TimelineEntity } from "@go-go-golems/chat-provider";
import { useMemo } from "react";
import { RefPresentation } from "../../components/RefPresentation";
import { PbuiMarkdown } from "../../markdown/PbuiMarkdown";
import type { Reference } from "../../types";
import { referenceKey } from "../../types";
import styles from "./MessageRow.module.css";

export interface MessageRowProps {
  entity: TimelineEntity;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/**
 * One transcript message. User and assistant prose both go through
 * `PbuiMarkdown`, so the user's own mentions are as live as the model's. A
 * user message carries its refs in `props.refs` (the body the composer sent,
 * echoed back by the server); they are offered to the renderer so they
 * resolve even before any `pbui.refs` entity exists for them.
 */
export function MessageRow({ entity }: MessageRowProps) {
  const role = String(entity.props.role ?? "assistant");
  const content = String(entity.props.content ?? entity.props.prompt ?? entity.props.text ?? "");
  const streaming = entity.props.streaming === true;
  const references = useMemo(() => {
    const refs = entity.props.refs;
    if (!Array.isArray(refs)) return undefined;
    const out: Record<string, Reference> = {};
    for (const raw of refs) {
      if (isRecord(raw) && typeof raw.type === "string" && (typeof raw.id === "string" || typeof raw.id === "number")) {
        const reference: Reference = { type: raw.type, id: String(raw.id), ...(isRecord(raw.value) ? { value: raw.value } : {}) };
        out[referenceKey(reference.type, reference.id)] = reference;
      }
    }
    return out;
  }, [entity.props.refs]);

  const messageReference: Reference = {
    type: "message",
    id: entity.id,
    value: { role, content },
  };

  if (role === "thinking") {
    if (!content) return null;
    return (
      <details data-part="message" data-role="thinking" className={styles.thinking}>
        <summary className={styles.summary}>
          <Text size="tiny" tone="faint">
            thinking{streaming ? "┆" : ""}
          </Text>
        </summary>
        <Text as="div" size="small" tone="faint" prose className={styles.thinkingBody}>
          {content}
        </Text>
      </details>
    );
  }

  if (role === "error") {
    return (
      <div data-part="message" data-role="error">
        <Callout variant="danger" title="the run failed">
          {content}
        </Callout>
      </div>
    );
  }

  const isUser = role === "user";
  return (
    <article data-part="message" data-role={role} data-state={streaming ? "streaming" : undefined} className={[styles.row, isUser ? styles.user : styles.assistant].join(" ")}>
      <header className={styles.head}>
        <RefPresentation reference={messageReference} doc={isUser ? "<message> what you said" : "<message> what the agent said"}>
          <Text size="tiny" tone="faint" className={styles.role}>
            {isUser ? "you" : "agent"}
          </Text>
        </RefPresentation>
        {streaming && (
          <Text size="tiny" tone="faint">
            streaming┆
          </Text>
        )}
      </header>
      <PbuiMarkdown text={content} references={references} />
    </article>
  );
}
