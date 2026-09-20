import { Button, EmptyState } from "@hyperslop-systems/pbui";
import { RefPresentation } from "../../components/RefPresentation";
import { usePbuiChat } from "../../context";
import { usePbuiChatStore } from "../../store/chatStore";
import styles from "./WatchlistPanel.module.css";

/** The references the user pinned with `watch`, each still a live presentation. */
export function WatchlistPanel() {
  const chat = usePbuiChat();
  const watchlist = usePbuiChatStore(chat.store, (s) => s.watchlist);
  if (watchlist.length === 0) {
    return <EmptyState message="nothing watched" hint="choose Watch from any object's menu" />;
  }
  return (
    <ul data-part="watchlist" className={styles.list} aria-label="watchlist">
      {watchlist.map((reference) => (
        <li key={`${reference.type}:${reference.id}`} className={styles.row}>
          <RefPresentation reference={reference} badge={<span className={styles.type}>{reference.type}</span>} />
          <Button size="tiny" aria-label={`unwatch ${reference.id}`} onClick={() => chat.store.unwatch(reference)}>
            ×
          </Button>
        </li>
      ))}
    </ul>
  );
}
