import { Text } from "@hyperslop-systems/pbui";
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

  if (!runtime) {
    // One frame, between `open()` and the host's provider attaching. Saying
    // so beats rendering an empty transcript that looks like a lost session.
    return (
      <Text size="tiny" tone="faint">
        opening conversation…
      </Text>
    );
  }

  return (
    <ChatRuntimeScope runtime={runtime}>
      <PbuiChatContext.Provider value={value}>{children}</PbuiChatContext.Provider>
    </ChatRuntimeScope>
  );
}
