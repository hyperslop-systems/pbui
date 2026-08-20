import { EmptyState, Text } from "@hyperslop-systems/pbui";
import { selectTimelineEntities, useChatSelector } from "@go-go-golems/chat-provider";
import { TRACE_ENTITY_KIND } from "../../adapters/traceAdapter";
import { RefPresentation } from "../../components/RefPresentation";
import { usePbuiChat } from "../../context";
import type { Reference, TraceEntryProps } from "../../types";
import styles from "./TracePanel.module.css";

export interface TracePanelProps {
  /** Newest first (default) or oldest first. */
  order?: "newest" | "oldest";
  limit?: number;
}

function formatTime(at: string): string {
  const date = new Date(at);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString(undefined, { hour12: false });
}

/**
 * Every verb performed in the session, by whom, on what, and how it went.
 * Each row is a `<traceEntry>` presentation, so a trace entry has a menu
 * like everything else (inspect it, ask the agent about it).
 */
export function TracePanel({ order = "newest", limit = 200 }: TracePanelProps) {
  const chat = usePbuiChat();
  const entities = useChatSelector(selectTimelineEntities);
  const entries = entities
    .filter((entity) => entity.kind === TRACE_ENTITY_KIND)
    .map((entity) => entity.props as unknown as TraceEntryProps)
    .sort((a, b) => (order === "newest" ? b.seq - a.seq : a.seq - b.seq))
    .slice(0, limit);

  if (entries.length === 0) {
    return <EmptyState message="no verbs performed yet" hint="menu entries and widget chips land here" />;
  }

  return (
    <ol data-part="trace" className={styles.list} aria-label="verb trace">
      {entries.map((entry) => {
        const reference: Reference = {
          type: "traceEntry",
          id: String(entry.seq),
          value: entry as unknown as Record<string, unknown>,
        };
        const rejected = entry.outcome.startsWith("rejected");
        return (
          <li key={entry.seq} className={styles.row} data-actor={entry.actor} data-outcome={rejected ? "rejected" : "performed"}>
            <Text size="tiny" tone="faint" className={styles.seq}>
              #{entry.seq}
            </Text>
            <Text size="tiny" tone="faint" className={styles.actor}>
              {entry.actor}
            </Text>
            <RefPresentation reference={reference}>
              <span className={styles.verb}>{String(entry.verb?.kind ?? "?")}</span>
            </RefPresentation>
            {entry.target && (
              <RefPresentation reference={entry.target}>
                <span className={styles.target}>{chat.labelFor(entry.target)}</span>
              </RefPresentation>
            )}
            <Text size="tiny" tone={rejected ? "danger" : "faint"} className={styles.outcome} title={entry.outcome}>
              {rejected ? entry.outcome.replace(/^rejected:/, "✗ ") : "✓"}
            </Text>
            <Text size="tiny" tone="faint" className={styles.time}>
              {formatTime(entry.at)}
            </Text>
          </li>
        );
      })}
    </ol>
  );
}
