import { Chip, JsonBlock, Text } from "@hyperslop-systems/pbui";
import { RefPresentation } from "../../components/RefPresentation";
import type { Reference } from "../../types";
import styles from "./ToolCard.module.css";

export interface ToolCardProps {
  toolCallId: string;
  toolName: string;
  status: string;
  parentMessageId?: string;
  input?: unknown;
  result?: unknown;
  error?: string;
}

function statusTone(status: string): string {
  const s = status.toLowerCase();
  if (s === "success" || s === "finished") return "var(--pbui-ok)";
  if (s === "failed" || s === "denied" || s === "cancelled") return "var(--pbui-danger)";
  return "var(--pbui-tone-tool, var(--pbui-tone-neutral))";
}

/**
 * A tool call as a `<tool>` presentation: the name is the handle, the
 * status is a chip, arguments and result fold away. Human tools that are
 * still pending do not come here — `ToolCallOutlet` renders them.
 */
export function ToolCard({ toolCallId, toolName, status, parentMessageId, input, result, error }: ToolCardProps) {
  const reference: Reference = {
    type: "tool",
    id: toolCallId,
    value: { callId: toolCallId, name: toolName, status, ...(parentMessageId ? { parentMessageId } : {}) },
  };
  return (
    <div data-part="tool-card" data-status={status} className={styles.card}>
      <div className={styles.head}>
        <RefPresentation reference={reference}>
          <Text size="small" strong className={styles.name}>
            ⚙ {toolName}
          </Text>
        </RefPresentation>
        <Chip label={status} tone={statusTone(status)} />
      </div>
      {input !== undefined && (
        <details className={styles.fold}>
          <summary className={styles.summary}>
            <Text size="tiny" tone="faint">
              arguments
            </Text>
          </summary>
          <JsonBlock value={input} maxHeight={160} />
        </details>
      )}
      {result !== undefined && (
        <details className={styles.fold}>
          <summary className={styles.summary}>
            <Text size="tiny" tone="faint">
              result
            </Text>
          </summary>
          <JsonBlock value={result} maxHeight={220} />
        </details>
      )}
      {error && (
        <Text size="small" tone="danger">
          {error}
        </Text>
      )}
    </div>
  );
}
