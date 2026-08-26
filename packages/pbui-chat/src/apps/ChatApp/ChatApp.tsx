import { Text } from "@hyperslop-systems/pbui";
import type { AppProps } from "@hyperslop-systems/pbui-workbench";
import { Composer } from "../../composer/Composer";
import { CONVERSATION_BINDING } from "../../conversations/bindings";
import { ConversationScope } from "../../conversations/ConversationScope";
import { Messages } from "../../messages/Messages";
import styles from "./ChatApp.module.css";

/**
 * The conversation as a tile: the transcript above the composer. Two grid
 * rows, the first the only one that scrolls, so the composer stays put
 * however long the transcript grows. The tile hands this component a
 * committed height (pbui-workbench's one-cell grid), which is what lets
 * `minmax(0, 1fr)` mean "the rest".
 *
 * The mouse-doc line is NOT here. It documents whatever the pointer is over
 * anywhere on the screen, so it belongs to the page, once, at the bottom —
 * one per chat tile meant three of them saying the same thing, and none of
 * them covering the tiles between.
 */
export function ChatApp({ view }: AppProps) {
  const conversationId = view.documents[CONVERSATION_BINDING];
  if (!conversationId) {
    // A `chat` tile with no binding: a layout saved before conversations
    // existed and not migrated, or a hand-edited document. Saying so beats a
    // transcript that silently belongs to nobody.
    return (
      <div data-part="chat-app" className={styles.app}>
        <Text size="tiny" tone="faint">
          this tile is not bound to a conversation
        </Text>
      </div>
    );
  }
  return (
    <ConversationScope conversationId={conversationId}>
      <ChatSurface />
    </ConversationScope>
  );
}

function ChatSurface() {
  return (
    <div data-part="chat-app" className={styles.app}>
      <div className={styles.transcript}>
        <Messages />
      </div>
      <Composer />
    </div>
  );
}
