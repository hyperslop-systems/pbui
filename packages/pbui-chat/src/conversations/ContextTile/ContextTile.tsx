import { Button, Chip, EmptyState, JsonBlock, Text, Toolbar } from "@hyperslop-systems/pbui";
import type { AppProps } from "@hyperslop-systems/pbui-workbench";
import { useState } from "react";
import { RefPresentation } from "../../components/RefPresentation";
import { usePbuiChat } from "../../context";
import { CONVERSATION_BINDING } from "../bindings";
import { conversationReference } from "../ConversationsTile";
import { useConversations } from "../registry";
import styles from "./ContextTile.module.css";

/**
 * What this agent was told, and what it can actually do (guide §4.6).
 *
 * Every question this tile answers is one a person asks when a model
 * "ignores" a tool: was it offered? under what name? was it available at the
 * time? what did the last message actually carry? The runtime already knows —
 * `runtime.lastManifest` is what was advertised and `runtime.lastSend` is
 * what went on the wire — and until now nothing showed either.
 *
 * A tool that is registered but unavailable is listed WITH its reason rather
 * than omitted, because "the tool is missing" and "the tool is there but
 * turned off" are different problems and look identical in a transcript.
 */
export function ContextTile({ view }: AppProps) {
  const conversationId = view.documents[CONVERSATION_BINDING];
  if (!conversationId) {
    return <EmptyState message="this tile is not bound to a conversation" hint="open it from a conversation's menu" />;
  }
  return <Context conversationId={conversationId} />;
}

function Context({ conversationId }: { conversationId: string }) {
  const chat = usePbuiChat();
  const snapshot = useConversations(chat.conversations, (r) => r.get(conversationId));
  const [syncing, setSyncing] = useState(false);

  if (!snapshot) {
    return <EmptyState message="that conversation is not in this browser's list" hint="the record may have been dropped" />;
  }

  const runtime = snapshot.runtime;
  /*
   * What the model CAN be offered is the tool registry, read now.
   * `lastManifest` is only what this code advertised: `connect()` and
   * `send()` call chat-provider's own internal sync, not the exposed method,
   * so a tile that showed only `lastManifest` said "nothing advertised yet"
   * while the manifest was going out with every message. The registry is the
   * source; `lastManifest` supplies the timestamp and revision when known.
   */
  const tools = runtime ? runtime.toolRegistry.manifest() : [];
  const manifest = runtime?.lastManifest ?? null;
  const send = runtime?.lastSend ?? null;
  const environment = chat.pbui.usePbui().environment as Record<string, unknown> | undefined;
  const vocabulary = chat.vocabulary;

  const resync = async () => {
    if (!runtime) return;
    setSyncing(true);
    try {
      await runtime.syncManifest();
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div data-part="conversation-context" className={styles.app}>
      <Toolbar tight className={styles.header}>
        <RefPresentation reference={conversationReference(snapshot)} doc="the conversation this describes">
          <Text size="tiny" strong>
            {snapshot.title}
          </Text>
        </RefPresentation>
        <Chip label={snapshot.open ? snapshot.runStatus : "closed"} tone="var(--pbui-tone-neutral)" />
        <span className={styles.spacer} />
        <Button size="tiny" variant="bare" onClick={() => void resync()} disabled={!runtime || syncing} title="advertise the tools again, as they are right now">
          {syncing ? "syncing…" : "re-sync manifest"}
        </Button>
      </Toolbar>

      <Section title="session">
        <dl className={styles.facts}>
          <Fact label="id" value={snapshot.id} />
          <Fact label="model" value={snapshot.stats?.model ?? snapshot.model ?? "not reported yet"} />
          <Fact label="provider" value={snapshot.stats?.provider ?? snapshot.provider ?? "not reported yet"} />
          <Fact label="connection" value={snapshot.open ? snapshot.wsStatus : "closed"} />
          <Fact label="messages" value={String(snapshot.messageCount)} />
        </dl>
      </Section>

      <Section
        title={`tools · ${tools.length}`}
        hint={manifest ? `last advertised ${new Date(manifest.at).toLocaleTimeString(undefined, { hour12: false })} · revision ${manifest.revision}` : "advertised on connect and on every send"}
      >
        {tools.length === 0 ? (
          <Text size="tiny" tone="faint">
            {runtime ? "this conversation has no tools registered" : "the conversation is closed, so nothing is registered"}
          </Text>
        ) : (
          <ol className={styles.tools} aria-label="advertised tools">
            {tools.map((tool) => {
              const entry = tool as unknown as { name?: string; mode?: string; available?: boolean; description?: string };
              const name = String(entry.name ?? "?");
              const available = entry.available !== false;
              return (
                <li key={name} className={styles.tool} data-part="manifest-tool" data-available={available ? "true" : "false"}>
                  <Text size="tiny" strong>
                    {name}
                  </Text>
                  <Chip label={String(entry.mode ?? "frontend")} tone="var(--pbui-tone-tool)" />
                  <Text size="micro" tone={available ? "faint" : "danger"} className={styles.toolNote}>
                    {/* The registry knows it is unavailable, not why; the two
                        reasons a product has are "turned off" and "not
                        attached yet", and saying only one of them would be
                        wrong for the other. */}
                    {available ? (entry.description ?? "") : "not available — the product has turned it off, or has not attached what it needs"}
                  </Text>
                </li>
              );
            })}
          </ol>
        )}
      </Section>

      <Section title="last message on the wire" hint={send ? new Date(send.at).toLocaleTimeString(undefined, { hour12: false }) : undefined}>
        {!send ? (
          <Text size="tiny" tone="faint">
            nothing sent from this browser yet
          </Text>
        ) : (
          <>
            <Text size="tiny" className={styles.prompt}>
              {send.prompt}
            </Text>
            <Refs body={send.body} />
          </>
        )}
      </Section>

      <Section title="environment">
        <JsonBlock value={environment ?? {}} maxHeight={120} />
      </Section>

      <Section title={`vocabulary · ${Object.keys(vocabulary.types).length} types · ${Object.keys(vocabulary.verbs).length} verbs`}>
        <details>
          <summary>
            <Text size="micro" tone="faint">
              what the model is told exists
            </Text>
          </summary>
          <JsonBlock value={{ types: Object.keys(vocabulary.types), verbs: Object.keys(vocabulary.verbs) }} maxHeight={200} />
        </details>
      </Section>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className={styles.section} data-part="context-section">
      <div className={styles.sectionHead}>
        <Text size="tiny" strong>
          {title}
        </Text>
        {hint ? (
          <Text size="micro" tone="faint">
            {hint}
          </Text>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt>
        <Text size="micro" tone="faint">
          {label}
        </Text>
      </dt>
      <dd>
        <Text size="tiny">{value}</Text>
      </dd>
    </>
  );
}

/** The refs and focus the last body carried, as the objects they are. */
function Refs({ body }: { body: Record<string, unknown> }) {
  const chat = usePbuiChat();
  const refs = Array.isArray(body.refs) ? (body.refs as { type: string; id: string }[]) : [];
  const focus = body.focus as { reference?: { type: string; id: string } } | undefined;
  if (refs.length === 0 && !focus?.reference) {
    return (
      <Text size="micro" tone="faint">
        no objects attached
      </Text>
    );
  }
  return (
    <div className={styles.refs}>
      {refs.map((reference) => (
        <RefPresentation key={`${reference.type}:${reference.id}`} reference={reference as never}>
          <Text size="micro">{chat.labelFor(reference as never)}</Text>
        </RefPresentation>
      ))}
      {focus?.reference ? (
        <>
          <Text size="micro" tone="faint">
            focus:
          </Text>
          <RefPresentation reference={focus.reference as never}>
            <Text size="micro">{chat.labelFor(focus.reference as never)}</Text>
          </RefPresentation>
        </>
      ) : null}
    </div>
  );
}
