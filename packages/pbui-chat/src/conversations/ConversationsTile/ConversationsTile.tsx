import { Button, Chip, EmptyState, InlineRename, Text, TextInput, Toolbar } from "@hyperslop-systems/pbui";
import { useState } from "react";
import { RefPresentation } from "../../components/RefPresentation";
import { usePbuiChat } from "../../context";
import type { Reference } from "../../types";
import type { ConversationSnapshot } from "../registry";
import { useConversations } from "../registry";
import styles from "./ConversationsTile.module.css";

/**
 * Every conversation this browser knows about (guide §4.6).
 *
 * **A row IS the conversation**, not a label with buttons after it: each one
 * renders as a `<conversation>` presentation, so left-click is its default
 * verb and right-click opens the one menu that says what can be done to it —
 * open, activate, rename, keep at the top, archive, disconnect, inspect, hand
 * something to it, ask about it, drop it. That menu is the product's
 * descriptor, shared with every other place a conversation appears: a mention
 * in a transcript, a chip in a widget, a tile title. Laying the same actions
 * out as a row of buttons would be a second door that drifts from the first.
 *
 * The two controls that remain are the ones with no object to hang off: *new
 * conversation* (there is nothing to right-click until it exists) and the
 * filter.
 *
 * Rows are pinned first, then by last activity, so the conversation you were
 * just in is near the top without the list reordering under the cursor while
 * you read it.
 */
export function ConversationsTile() {
  const chat = usePbuiChat();
  const registry = chat.conversations;
  const conversations = useConversations(registry, (r) => r.all());
  const renaming = useConversations(registry, (r) => r.renaming());
  const [filter, setFilter] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [busy, setBusy] = useState(false);
  const [syncNote, setSyncNote] = useState<string | null>(null);

  const needle = filter.trim().toLowerCase();
  const rows = conversations.filter(
    (snapshot) =>
      (showArchived || !snapshot.archived) &&
      (needle === "" || snapshot.title.toLowerCase().includes(needle) || snapshot.id.includes(needle)),
  );
  const archived = conversations.filter((snapshot) => snapshot.archived).length;

  const sync = async () => {
    setBusy(true);
    try {
      const result = await registry.sync();
      // Say what changed, including what did NOT: a record the server has
      // forgotten is still usable, and a row silently vanishing would be the
      // wrong lesson to teach.
      const parts = [
        result.adopted.length > 0 ? `${result.adopted.length} adopted` : "",
        result.updated.length > 0 ? `${result.updated.length} updated` : "",
        result.unknownToServer.length > 0 ? `${result.unknownToServer.length} the server does not list (kept)` : "",
      ].filter(Boolean);
      setSyncNote(parts.length > 0 ? parts.join(" · ") : "nothing changed");
    } catch (error) {
      setSyncNote(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
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
        <Button size="tiny" variant="bare" onClick={() => void sync()} disabled={busy} title="reconcile with the server's list; your names and counts are kept">
          sync
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
            <Row key={snapshot.id} snapshot={snapshot} renaming={renaming === snapshot.id} />
          ))}
        </ol>
      )}

      <Text size="micro" tone="faint">
        {syncNote ? `${syncNote} · ` : ""}right-click a conversation for what you can do to it
      </Text>
    </div>
  );
}

/** `streaming` beats `error` beats `waiting`: what is happening now, then what is wrong, then what is asked of you. */
export function statusOf(snapshot: ConversationSnapshot): { label: string; tone: "default" | "danger" | "faint" } {
  if (snapshot.lifecycle.phase === "closed") return { label: "closed", tone: "faint" };
  if (snapshot.lifecycle.phase === "opening") return { label: "opening", tone: "faint" };
  if (snapshot.lifecycle.phase === "closing") return { label: "closing", tone: "faint" };
  if (snapshot.lifecycle.phase === "failed") return { label: "open failed", tone: "danger" };
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

/** The wire reference for a conversation, as every other place builds it. */
export function conversationReference(snapshot: ConversationSnapshot): Reference {
  return {
    type: "conversation",
    id: snapshot.id,
    value: {
      title: snapshot.title,
      messageCount: snapshot.messageCount,
      streaming: snapshot.streaming,
      active: snapshot.active,
      pinned: snapshot.pinned,
      archived: snapshot.archived,
      open: snapshot.open,
      lifecycle: snapshot.lifecycle.phase,
      titleSync: snapshot.titleSync.status,
      titleRevision: snapshot.titleRevision,
      ...(snapshot.model ? { model: snapshot.model } : {}),
    },
  };
}

function Row({ snapshot, renaming }: { snapshot: ConversationSnapshot; renaming: boolean }) {
  const chat = usePbuiChat();
  const status = statusOf(snapshot);
  const tokens = snapshot.stats?.totals;
  const reference = conversationReference(snapshot);

  const commit = (title: string) => {
    chat.conversations.requestRename(null);
    if (title !== snapshot.title) {
      void chat.router.perform({ kind: "conversation.rename", conversationId: snapshot.id, title } as never);
    }
  };

  return (
    <li
      data-part="conversation-row"
      data-conversation={snapshot.id}
      data-active={snapshot.active ? "true" : undefined}
      className={styles.row}
    >
      {renaming ? (
        <InlineRename
          initial={snapshot.title}
          accessibleName="conversation name"
          fallback={snapshot.title}
          onCommit={commit}
          onCancel={() => chat.conversations.requestRename(null)}
        />
      ) : (
        <RefPresentation
          reference={reference}
          doc={`conversation · ${status.label} · right-click for what you can do to it`}
          testId={`conversation-${snapshot.id}`}
        >
          <Text size="tiny" strong>
            {snapshot.active ? "▸ " : ""}
            {snapshot.title}
          </Text>
        </RefPresentation>
      )}

      <div className={styles.meta}>
        <Chip label={status.label} tone={status.tone === "danger" ? "var(--pbui-tone-proposal)" : "var(--pbui-tone-neutral)"} />
        {/* Only when it is worth saying: `ready` is the normal case. */}
        {snapshot.titleSync.status !== "synchronized" ? (
          <>
            <Text size="micro" tone={snapshot.titleSync.status === "failed" ? "danger" : "faint"} title={snapshot.titleSync.error}>
              title {snapshot.titleSync.status}
            </Text>
            <Button size="tiny" variant="bare" onClick={() => void chat.conversations.retryTitle(snapshot.id)}>
              retry title
            </Button>
          </>
        ) : null}
        {snapshot.open && snapshot.wsStatus !== "ready" ? (
          <Text size="micro" tone="faint">
            {snapshot.wsStatus}
          </Text>
        ) : null}
        <Text size="micro" tone="faint">
          {snapshot.messageCount} message{snapshot.messageCount === 1 ? "" : "s"} · {ageOf(snapshot.lastActivityAt)}
          {tokens && tokens.inputTokens + tokens.outputTokens > 0 ? ` · ${tokens.inputTokens + tokens.outputTokens} tokens` : ""}
          {snapshot.pinned ? " · pinned" : ""}
          {snapshot.archived ? " · archived" : ""}
        </Text>
      </div>
    </li>
  );
}
