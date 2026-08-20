import { selectOverlay, useChatSelector } from "@go-go-golems/chat-provider";
import type { AppProps } from "@hyperslop-systems/pbui-workbench";
import { Composer } from "../../composer/Composer";
import { usePbuiChat } from "../../context";
import { Messages } from "../../messages/Messages";
import styles from "./ChatApp.module.css";

/**
 * The conversation as a tile: the transcript above the composer above the
 * mouse-doc line. Three grid rows, the first the only one that scrolls, so
 * the composer stays put however long the transcript grows. The tile hands
 * this component a committed height (pbui-workbench's one-cell grid), which
 * is what lets `minmax(0, 1fr)` mean "the rest".
 */
export function ChatApp(_: AppProps) {
  const chat = usePbuiChat();
  const overlay = useChatSelector(selectOverlay);
  const MouseDocLine = chat.pbui.MouseDocLine;
  return (
    <div data-part="chat-app" className={styles.app}>
      <div className={styles.transcript}>
        <Messages />
      </div>
      <Composer />
      <MouseDocLine ambient={overlay.sessionId ? `session ${overlay.sessionId.slice(0, 8)}` : "no session yet"} />
    </div>
  );
}
