import { EmptyState, Text } from "@hyperslop-systems/pbui";
import { useEffect, useState } from "react";
import { RefPresentation } from "../../components/RefPresentation";
import { usePbuiChat } from "../../context";
import { conversationReference } from "../ConversationsTile";
import type { ConversationSnapshot } from "../registry";
import { useConversations } from "../registry";
import { streamRate } from "../selectors";
import styles from "./RunsTile.module.css";

/**
 * What every agent on this workbench has cost and how fast it is going
 * (guide §4.6, D9).
 *
 * Reads only what the registry mirrors — model, provider, run count, token
 * totals, the last run's duration and stop reason, and whether it is
 * streaming — so the table subscribes to one store rather than to N Redux
 * stores of its own. A conversation that is closed still shows its last known
 * totals, because "what did that cost" outlives the socket.
 *
 * The rows are `<conversation>` objects, so the menu here is the menu
 * everywhere.
 */

/** 1234 → "1.2k". Token counts are read for their order of magnitude. */
export function compact(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

export function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`;
}

/** A live rate needs a live clock; nothing else in the tile does. */
function useTick(active: boolean, everyMs = 500): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const handle = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(handle);
  }, [active, everyMs]);
  return now;
}

export function RunsTile() {
  const registry = usePbuiChat().conversations;
  const conversations = useConversations(registry, (r) => r.all());
  const streaming = conversations.some((snapshot) => snapshot.streaming);
  const now = useTick(streaming);

  const rows = conversations.filter((snapshot) => !snapshot.archived);
  const totals = rows.reduce(
    (sum, snapshot) => {
      const t = snapshot.stats?.totals;
      return t
        ? {
            input: sum.input + t.inputTokens,
            output: sum.output + t.outputTokens,
            cached: sum.cached + t.cachedTokens,
            runs: sum.runs + (snapshot.stats?.completedRuns ?? 0),
          }
        : sum;
    },
    { input: 0, output: 0, cached: 0, runs: 0 },
  );

  if (rows.length === 0) {
    return <EmptyState message="no conversations yet" hint="start one and its runs land here" />;
  }

  return (
    <div data-part="chat-runs" className={styles.app}>
      <ol className={styles.list} aria-label="runs by conversation">
        {rows.map((snapshot) => (
          <Row key={snapshot.id} snapshot={snapshot} now={now} />
        ))}
      </ol>

      <Text size="micro" tone="faint">
        {totals.runs} run{totals.runs === 1 ? "" : "s"} across {rows.length} conversation{rows.length === 1 ? "" : "s"} · {compact(totals.input)} in ·{" "}
        {compact(totals.output)} out{totals.cached > 0 ? ` · ${compact(totals.cached)} cached` : ""}
      </Text>
    </div>
  );
}

function Row({ snapshot, now }: { snapshot: ConversationSnapshot; now: number }) {
  const stats = snapshot.stats;
  const totals = stats?.totals;
  const rate = streamRate(stats, now);
  return (
    <li className={styles.row} data-part="run-row" data-conversation={snapshot.id} data-streaming={snapshot.streaming ? "true" : undefined}>
      <RefPresentation reference={conversationReference(snapshot)} doc={`conversation · ${snapshot.open ? snapshot.runStatus : "closed"}`}>
        <Text size="tiny" strong>
          {snapshot.active ? "▸ " : ""}
          {snapshot.title}
        </Text>
      </RefPresentation>
      <Text size="micro" tone="faint" className={styles.model}>
        {stats?.model ?? snapshot.model ?? "no model yet"}
        {stats?.provider ? ` · ${stats.provider}` : ""}
      </Text>
      {/* Units inline rather than a header row: the numbers have to stay
          readable in a tile a third of a screen wide, and a column header
          three rows above is no help there. */}
      <Text size="micro" tone="faint" className={styles.numbers}>
        {stats?.completedRuns ?? 0} run{(stats?.completedRuns ?? 0) === 1 ? "" : "s"} · {compact(totals?.inputTokens ?? 0)} in ·{" "}
        {compact(totals?.outputTokens ?? 0)} out
        {totals && totals.cachedTokens > 0 ? ` · ${compact(totals.cachedTokens)} cached` : ""}
      </Text>
      <Text size="micro" tone={stats?.lastRunStopReason && stats.lastRunStopReason !== "stop" ? "danger" : "faint"} className={styles.last}>
        {/* While it streams, the useful number is the rate, not the last run. */}
        {rate !== null
          ? `${rate.toFixed(1)} tok/s`
          : `${formatDuration(stats?.lastRunDurationMs ?? null)}${stats?.lastRunStopReason ? ` · ${stats.lastRunStopReason}` : ""}`}
      </Text>
    </li>
  );
}
