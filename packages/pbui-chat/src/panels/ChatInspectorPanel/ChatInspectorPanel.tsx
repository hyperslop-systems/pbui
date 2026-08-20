import { Button, InspectorPanel, JsonBlock } from "@hyperslop-systems/pbui";
import { RefPresentation } from "../../components/RefPresentation";
import { usePbuiChat } from "../../context";
import { usePbuiChatStore } from "../../store/chatStore";
import styles from "./ChatInspectorPanel.module.css";

/**
 * pbui's `InspectorPanel` fed by the chat store: whatever the last `inspect`
 * verb pointed at, shown as its presentation (so it keeps its menu) above
 * its resolved value.
 */
export function ChatInspectorPanel() {
  const chat = usePbuiChat();
  const inspected = usePbuiChatStore(chat.store, (s) => s.inspected);
  return (
    <div data-part="inspector" className={styles.wrap}>
      <InspectorPanel
        inspected={inspected ? { title: inspected.title, value: inspected.reference } : null}
        emptyMessage="nothing inspected — choose Inspect from any object's menu"
        renderValue={({ value }) => {
          const reference = inspected?.reference;
          return (
            <div className={styles.body}>
              {reference && (
                <div className={styles.head}>
                  <RefPresentation reference={reference} />
                  <Button size="tiny" onClick={() => chat.store.clearInspected()}>
                    clear
                  </Button>
                </div>
              )}
              <JsonBlock value={value} maxHeight="none" />
            </div>
          );
        }}
      />
    </div>
  );
}
