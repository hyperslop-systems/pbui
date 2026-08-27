import { Button, Chip, Text, TextArea, Toolbar } from "@hyperslop-systems/pbui";
import { selectOverlay, useChatClient, useChatSelector } from "@go-go-golems/chat-provider";
import { useState, type KeyboardEvent } from "react";
import { RefPresentation } from "../../components/RefPresentation";
import { usePbuiChat } from "../../context";
import { scanMentions, uniqueMentions } from "../../mentions/mentions";
import { resolveMention, useReferenceIndex } from "../../refs/referenceIndex";
import { usePbuiChatStore, type ComposerDraft } from "../../store/chatStore";
import { toneVar } from "../../tone";
import type { Reference } from "../../types";
import { referenceKey } from "../../types";
import styles from "./Composer.module.css";

const EMPTY_DRAFT: ComposerDraft = { text: "", refs: {} };

export interface ComposerProps {
  placeholder?: string;
  className?: string;
}

/**
 * The composer: a text area whose draft lives in the chat store (so the
 * router can insert mentions into it), the references it mentions as chips
 * above it, and an "insert object…" button that enters accept mode for any
 * type the vocabulary knows. Sending attaches every mentioned reference —
 * the ones inserted by chip and the ones typed by hand that the reference
 * index can resolve — as typed `refs` in the message body.
 */
export function Composer({ placeholder = "ask the agent… (Enter sends, Shift+Enter for a newline)", className }: ComposerProps) {
  const chat = usePbuiChat();
  const pbui = chat.pbui.usePbui();
  const client = useChatClient();
  const overlay = useChatSelector(selectOverlay);
  const conversationId = chat.conversationId ?? chat.conversations.activeId();
  const draft = usePbuiChatStore(chat.store, (s) => (conversationId ? s.drafts[conversationId] ?? EMPTY_DRAFT : EMPTY_DRAFT));
  const index = useReferenceIndex();
  const [busy, setBusy] = useState(false);

  const streaming = overlay.runStatus === "streaming";
  const mentions = uniqueMentions(scanMentions(draft.text));
  const refs: Reference[] = mentions.map((m) => {
    const key = referenceKey(m.type, m.id);
    return draft.refs[key] ?? resolveMention(index, m.type, m.id, m.label);
  });
  const trimmed = draft.text.trim();
  const disabledBecause = !conversationId
    ? "select or open a conversation first"
    : busy
      ? "sending…"
      : streaming
        ? "the agent is still answering — stop it first"
        : trimmed === ""
          ? "nothing to send"
          : undefined;

  const send = async () => {
    if (disabledBecause || !conversationId) return;
    setBusy(true);
    try {
      await chat.send({ prompt: trimmed, refs });
      chat.store.clearDraft(conversationId);
    } finally {
      setBusy(false);
    }
  };

  const insertObject = async () => {
    const types = Object.keys(chat.vocabulary.types).filter((t) => t !== "unresolved");
    const picked = await pbui.accept({ types, prompt: "pick an object to mention" });
    if (!picked) return;
    const reference = chat.refs.fromProduct(picked);
    if (conversationId) chat.store.insertReference(conversationId, reference, chat.labelFor(reference));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void send();
    }
  };

  return (
    <div data-part="composer" className={[styles.composer, className ?? ""].filter(Boolean).join(" ")}>
      {refs.length > 0 && (
        <div data-part="composer-refs" className={styles.refs}>
          {refs.map((reference) => (
            <RefPresentation key={referenceKey(reference.type, reference.id)} reference={reference}>
              <Chip label={chat.labelFor(reference)} tone={toneVar(chat.toneFor(reference.type) ?? reference.type)} badge={<span className={styles.type}>{reference.type}</span>} />
            </RefPresentation>
          ))}
        </div>
      )}
      <TextArea
        value={draft.text}
        onValueChange={(text) => {
          if (conversationId) chat.store.setDraftText(conversationId, text);
        }}
        accessibleName="message to the agent"
        rows={3}
        placeholder={placeholder}
        onKeyDown={onKeyDown}
        className={styles.text}
      />
      <Toolbar tight>
        <Button variant="framed" size="small" onClick={() => void insertObject()} title="enter accept mode and click any object to mention it">
          insert object…
        </Button>
        <span className={styles.spacer} />
        {overlay.error && (
          <Text size="tiny" tone="danger" truncate title={overlay.error}>
            {overlay.error}
          </Text>
        )}
        {streaming ? (
          <Button variant="raised" size="small" tone="danger" onClick={() => void client.stop()}>
            stop
          </Button>
        ) : (
          <Button variant="raised" size="small" disabled={disabledBecause !== undefined} title={disabledBecause} onClick={() => void send()}>
            send
          </Button>
        )}
      </Toolbar>
    </div>
  );
}
