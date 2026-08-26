import { Button, Text } from "@hyperslop-systems/pbui";
import { useEffect, useMemo, type ReactNode } from "react";
import { PbuiChatContext, usePbuiChat, type PbuiChatContextValue } from "../context";
import type { ChatMessageBody } from "../types";
import { ChatRuntimeScope } from "./ConversationHost";
import { useConversations } from "./registry";

/**
 * What a tile showing one conversation wraps its content in.
 *
 * Two jobs. It re-provides the conversation's chat-provider contexts, so the
 * transcript, the composer, the widget outlets and the tool cards inside it
 * read that conversation's store and client rather than whichever one
 * happened to be mounted last. And it overrides the pbui-chat context so
 * `usePbuiChat()` inside means "the conversation I am in": `send` goes to
 * this runtime, and `conversationId` rides along on every verb performed
 * from a chip or a menu (guide §4.3, D4).
 */
export function ConversationScope({ conversationId, children }: { conversationId: string; children: ReactNode }) {
  const base = usePbuiChat();
  const registry = base.conversations;
  const snapshot = useConversations(registry, (r) => r.get(conversationId));

  // Opening is idempotent, and it is what makes `ConversationHost` render a
  // provider for this conversation; a tile restored from a saved layout is
  // usually how a conversation comes back after a reload.
  useEffect(() => {
    registry.open(conversationId);
  }, [registry, conversationId]);

  const runtime = snapshot?.runtime ?? null;
  const lifecycle = snapshot?.lifecycle ?? { phase: "closed" as const };

  const value = useMemo<PbuiChatContextValue>(
    () => ({
      ...base,
      conversationId,
      runtime,
      send: async (body: Omit<ChatMessageBody, "attachments">) => {
        await base.sendTo(conversationId, body);
      },
    }),
    [base, conversationId, runtime],
  );

  if (lifecycle.phase !== "open" || !runtime) {
    if (lifecycle.phase === "failed") {
      return (
        <div data-part="conversation-lifecycle" data-phase="failed" role="alert">
          <Text size="tiny" tone="danger">could not open conversation: {lifecycle.error}</Text>{" "}
          {lifecycle.retryable ? <Button size="tiny" variant="framed" onClick={() => void registry.retry(conversationId)}>retry</Button> : null}
          <Button size="tiny" variant="bare" onClick={() => registry.close(conversationId)}>close</Button>
        </div>
      );
    }
    if (lifecycle.phase === "closed") {
      return (
        <div data-part="conversation-lifecycle" data-phase="closed">
          <Text size="tiny" tone="faint">conversation is closed</Text>{" "}
          <Button size="tiny" variant="framed" onClick={() => registry.open(conversationId)}>open</Button>
        </div>
      );
    }
    return (
      <div data-part="conversation-lifecycle" data-phase={lifecycle.phase}>
        <Text size="tiny" tone="faint">{lifecycle.phase === "closing" ? "closing conversation…" : "opening conversation…"}</Text>{" "}
        {lifecycle.phase === "opening" ? <Button size="tiny" variant="bare" onClick={() => registry.close(conversationId)}>cancel</Button> : null}
      </div>
    );
  }

  return (
    <ChatRuntimeScope runtime={runtime}>
      <PbuiChatContext.Provider value={value}>{children}</PbuiChatContext.Provider>
    </ChatRuntimeScope>
  );
}
