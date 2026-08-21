import { Button, Chip, EmptyState, InlineRename, Text, TextInput, Toolbar } from "@hyperslop-systems/pbui";
import { useState } from "react";
import { usePbuiChat } from "../../context";
import type { ConversationSnapshot } from "../registry";
import { useConversations } from "../registry";
import styles from "./ConversationsTile.module.css";

/**
 * Every conversation this browser knows about, and everything a person can
 * do to one (guide §4.6).
 *
 * The rows are the registry's snapshots: the record (title, pins, counts) and
 * the mirror of an open runtime (status, tokens, what is waiting for you).
 * Pinned first, then by last activity, so the conversation you were just in
 * is near the top without the list reordering under the cursor while you read
 * it.
 *
 * Every action here goes through the router as a verb rather than calling the
 * registry directly, so a person renaming a conversation and an agent
 * renaming one land in the same trace with the same wording. The exceptions
 * are the three that have no verb because they are about THIS browser rather
 * than about the conversation — pin, archive, close, forget.
 */
export function ConversationsTile() {
  const chat = usePbuiChat();
  const registry = chat.conversations;
  const conversations = useConversations(registry, (r) => r.all());
  const [filter, setFilter] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const needle = filter.trim().toLowerCase();
  const rows = conversations.filter(
    (snapshot) =>
      (showArchived || !snapshot.archived) && (needle === "" || snapshot.title.toLowerCase().includes(needle) || snapshot.id.includes(needle)),
  );
  const archived = conversations.filter((snapshot) => snapshot.archived).length;

  const perform = (verb: Record<string, unknown>) => {
    void chat.router.perform(verb as never);
  };

  const startNew = async () => {
    // `conversation.new` mints a session over the network, so the button says
    // so rather than looking dead for a round trip.
    setBusy(true);
    try {
      await chat.router.perform({ kind: "conversation.new" } as never);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-part="conversations" className={styles.app}>
      <Toolbar tight className={styles.header}>
        <Button size="tiny" variant="framed" onClick={() => void startNew()} disabled={busy} title="start another conversation and open it in a tile">
          {busy ? "starting…" : "new conversation"}
        </Button>
        <span className={styles.spacer} />
        <TextInput size="tiny" width="compact" value={filter} onValueChange={setFilter} accessibleName="filter conversations by name" placeholder="filter" />
        {archived > 0 ? (
          <Button size="tiny" variant="bare" selected={showArchived} aria-pressed={showArchived} onClick={() => setShowArchived((next) => !next)}>
            {showArchived ? "hide archived" : `archived (${archived})`}
          </Button>
        ) : null}
      </Toolbar>

      {rows.length === 0 ? (
        <EmptyState
          message={conversations.length === 0 ? "no conversations yet" : "nothing matches the filter"}
          hint={conversations.length === 0 ? "start one with “new conversation”" : "clear the filter to see them all"}
        />
      ) : (
        <ol aria-label="conversations" className={styles.list}>
          {rows.map((snapshot) => (
            <Row
              key={snapshot.id}
              snapshot={snapshot}
              renaming={renaming === snapshot.id}
              onRename={(next) => {
                setRenaming(null);
                if (next !== snapshot.title) perform({ kind: "conversation.rename", conversationId: snapshot.id, title: next });
              }}
              onStartRename={() => setRenaming(snapshot.id)}
              onCancelRename={() => setRenaming(null)}
              onPerform={perform}
              registry={registry}
            />
          ))}
        </ol>
      )}
    </div>
  );
}

/** `streaming` beats `error` beats `waiting`: what is happening now, then what is wrong, then what is asked of you. */
export function statusOf(snapshot: ConversationSnapshot): { label: string; tone: "default" | "danger" | "faint" } {
  if (!snapshot.open) return { label: "closed", tone: "faint" };
  if (snapshot.streaming) return { label: "streaming", tone: "default" };
  if (snapshot.error) return { label: "error", tone: "danger" };
  if (snapshot.waiting > 0) return { label: `waiting · ${snapshot.waiting}`, tone: "danger" };
  return { label: snapshot.runStatus || "idle", tone: "faint" };
}

/** "3m", "2h", "yesterday" — a timestamp nobody reads, said as an age. */
export function ageOf(at: string, now = Date.now()): string {
  const then = new Date(at).getTime();
  if (Number.isNaN(then)) return at;
  const seconds = Math.max(0, Math.round((now - then) / 1000));
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function Row({
  snapshot,
  renaming,
  registry,
  onRename,
  onStartRename,
  onCancelRename,
  onPerform,
}: {
  snapshot: ConversationSnapshot;
  renaming: boolean;
  registry: ReturnType<typeof usePbuiChat>["conversations"];
  onRename(next: string): void;
  onStartRename(): void;
  onCancelRename(): void;
  onPerform(verb: Record<string, unknown>): void;
}) {
  const status = statusOf(snapshot);
  const tokens = snapshot.stats?.totals;
  return (
    <li
      data-part="conversation-row"
      data-conversation={snapshot.id}
      data-active={snapshot.active ? "true" : undefined}
      className={styles.row}
    >
      <div className={styles.name}>
        {renaming ? (
          <InlineRename initial={snapshot.title} accessibleName="conversation name" fallback={snapshot.title} onCommit={onRename} onCancel={onCancelRename} />
        ) : (
          <Text size="tiny" strong>
            {snapshot.active ? "▸ " : ""}
            {snapshot.title}
          </Text>
        )}
        <div className={styles.meta}>
          <Chip label={status.label} tone={status.tone === "danger" ? "var(--pbui-tone-proposal)" : "var(--pbui-tone-neutral)"} />
          {/* Only when it is worth saying: `ready` is the normal case. */}
          {snapshot.open && snapshot.wsStatus !== "ready" ? (
            <Text size="micro" tone="faint">
              {snapshot.wsStatus}
            </Text>
          ) : null}
          <Text size="micro" tone="faint">
            {snapshot.messageCount} message{snapshot.messageCount === 1 ? "" : "s"} · {ageOf(snapshot.lastActivityAt)}
            {tokens && tokens.inputTokens + tokens.outputTokens > 0 ? ` · ${tokens.inputTokens + tokens.outputTokens} tokens` : ""}
            {snapshot.pinned ? " · pinned" : ""}
          </Text>
        </div>
      </div>

      <span className={styles.actions}>
        <Button size="tiny" variant="bare" onClick={() => onPerform({ kind: "conversation.open", conversationId: snapshot.id })} title="open it in a tile, or go to the tile that has it">
          open
        </Button>
        <Button
          size="tiny"
          variant="bare"
          disabled={snapshot.active}
          onClick={() => onPerform({ kind: "conversation.select", conversationId: snapshot.id })}
          title="follow this conversation in the singleton tiles"
        >
          activate
        </Button>
        <Button size="tiny" variant="bare" onClick={onStartRename}>
          rename
        </Button>
        {/* Pin, archive, close and forget are about this browser's list, not
            about the conversation, so they have no verb and no trace entry. */}
        <Button size="tiny" variant="bare" selected={snapshot.pinned} aria-pressed={snapshot.pinned} onClick={() => registry.pin(snapshot.id, !snapshot.pinned)}>
          {snapshot.pinned ? "unpin" : "pin"}
        </Button>
        <Button size="tiny" variant="bare" onClick={() => registry.archive(snapshot.id, !snapshot.archived)}>
          {snapshot.archived ? "unarchive" : "archive"}
        </Button>
        <Button size="tiny" variant="bare" disabled={!snapshot.open} onClick={() => registry.close(snapshot.id)} title="disconnect it; the record and the server's session stay">
          close
        </Button>
        <Button size="tiny" variant="bare" onClick={() => registry.forget(snapshot.id)} title="drop it from this browser's list; the server keeps the session">
          forget
        </Button>
      </span>
    </li>
  );
}
