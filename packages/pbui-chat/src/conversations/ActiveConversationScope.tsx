import { Text } from "@hyperslop-systems/pbui";
import type { ReactNode } from "react";
import { usePbuiChat } from "../context";
import { ConversationScope } from "./ConversationScope";
import { useConversations } from "./registry";

/**
 * Scope a singleton tile to THE ACTIVE CONVERSATION.
 *
 * The trace is per session — `trace_entry` entities live in one runtime's
 * timeline — but the trace tile is a singleton that sits beside the chat
 * tiles rather than inside one. Following the active conversation is the
 * same arrangement the sandbox devtools use for the selected sandbox: the
 * tile is a sibling, so the target comes from the registry, not from a
 * React context above it.
 */
export function ActiveConversationScope({ children, empty }: { children: ReactNode; empty?: ReactNode }) {
  const registry = usePbuiChat().conversations;
  const activeId = useConversations(registry, (r) => r.activeId());

  if (!activeId) {
    return (
      <>
        {empty ?? (
          <Text size="tiny" tone="faint">
            no conversation is active
          </Text>
        )}
      </>
    );
  }

  return <ConversationScope conversationId={activeId}>{children}</ConversationScope>;
}
