import {
  ChatProvider,
  ChatReduxContext,
  overlaySlice,
  useChatStore,
  type ChatStore,
} from "@go-go-golems/chat-provider";
import { ChatRuntimeContext, useChatRuntime } from "@go-go-golems/chat-provider/core";
import { useEffect, type ReactNode } from "react";
import { Provider as ReduxProvider } from "react-redux";
import type { ChatRuntimeContextValue } from "./providerTypes";
import { useConversations, type ConversationRegistry } from "./registry";
import type { ChatRuntime } from "./runtime";

/**
 * One `<ChatProvider>` per OPEN conversation, mounted at the product's root
 * rather than inside a tile (guide D2). Its lifetime is the conversation's:
 * closing every chat tile leaves the socket up, and `registry.close(id)` —
 * or archiving, or forgetting — takes it down.
 *
 * Renders nothing. Each provider's `Capture` child reports its runtime to the
 * registry and connects it; `ChatRuntimeScope` re-provides that runtime to
 * whatever tile is showing the conversation.
 */
export function ConversationHost({ registry }: { registry: ConversationRegistry }) {
  const openIds = useConversations(registry, (r) => r.openIds());
  return (
    <>
      {openIds.map((id) => (
        <ChatProvider key={id} config={registry.configFor(id)}>
          <Capture registry={registry} conversationId={id} />
        </ChatProvider>
      ))}
    </>
  );
}

function Capture({ registry, conversationId }: { registry: ConversationRegistry; conversationId: string }) {
  const context = useChatRuntime();
  const store = useChatStore() as unknown as ChatStore;

  useEffect(() => {
    // `ensureSession` reads the overlay before anything else, so dispatching
    // the id here is what makes this client speak to the conversation the
    // registry minted instead of creating one of its own. Every runtime's
    // `sessionPolicy` is `never` for the same reason.
    store.dispatch(overlaySlice.actions.setSessionId(conversationId));
    registry.attachRuntime(conversationId, { store, context });
    if (registry.autoConnect()) void registry.connectRuntime(conversationId).catch(() => undefined);
    return () => {
      registry.detachRuntime(conversationId);
      // `ChatProvider` has no cleanup of its own: without this the socket of
      // a closed conversation would stay open for the life of the page.
      context.client.reset();
    };
  }, [registry, conversationId, store, context]);

  return null;
}

/**
 * Re-provide a captured runtime's two contexts — the Redux store under
 * `ChatReduxContext` and the runtime graph under `ChatRuntimeContext` — which
 * are exactly what `ChatProvider` provides. Every chat-provider hook
 * (`useChatClient`, `useChatSelector`, `useChatRuntime`, `WidgetOutlet`,
 * `ToolCallOutlet`) and every pbui-chat component therefore works unchanged
 * inside a conversation's subtree (guide D1).
 */
export function ChatRuntimeScope({ runtime, children }: { runtime: ChatRuntime; children: ReactNode }) {
  return (
    <ReduxProvider store={runtime.store} context={ChatReduxContext}>
      <ChatRuntimeContext.Provider value={runtime.context as ChatRuntimeContextValue}>{children}</ChatRuntimeContext.Provider>
    </ReduxProvider>
  );
}
