import { Button, EmptyState, Surface, Text } from "@hyperslop-systems/pbui";
import { selectTimelineEntities, useChatSelector, WidgetOutlet } from "@go-go-golems/chat-provider";
import { usePbuiChat } from "../../context";
import { usePbuiChatStore } from "../../store/chatStore";
import { findWidgetEntity, widgetTitleOf } from "../../widget/findWidgetEntity";
import styles from "./TilesPanel.module.css";

/**
 * Widgets the `openInTile` verb moved out of the transcript, for a product
 * WITHOUT a workbench attached. Each renders through chat-provider's
 * `WidgetOutlet`, so it is the same live instance (patches still arrive) —
 * only its place on the page changed. With a workbench, `openInTile` opens
 * a real `widget` tile instead (see `createChatApps`) and this panel stays
 * empty.
 */
export function TilesPanel() {
  const chat = usePbuiChat();
  const tiles = usePbuiChatStore(chat.store, (s) => s.tiles);
  const entities = useChatSelector(selectTimelineEntities);

  if (tiles.length === 0) {
    return <EmptyState message="no tiles" hint="choose Open in tile from a widget's menu" />;
  }

  return (
    <div data-part="tiles" className={styles.tiles}>
      {tiles.map((widgetId) => {
        const entity = findWidgetEntity(entities, widgetId);
        const props = (entity?.props.props as Record<string, unknown> | undefined) ?? {};
        const title = widgetTitleOf(entity, widgetId);
        return (
          <Surface key={widgetId} tone="pane" border="hair" padding={0} className={styles.tile} role="region" aria-label={title}>
            <div className={styles.head}>
              <Text size="tiny" strong className={styles.title}>
                {title}
              </Text>
              <Button size="tiny" aria-label={`close tile ${title}`} onClick={() => chat.store.closeTile(widgetId)}>
                ×
              </Button>
            </div>
            <div className={styles.body}>
              {entity ? (
                <WidgetOutlet
                  instanceId={widgetId}
                  widgetName={String(entity.props.widgetName ?? "")}
                  status={String(entity.props.status ?? "READY")}
                  props={props}
                />
              ) : (
                <Text size="small" tone="faint">
                  widget {widgetId} is no longer in the timeline
                </Text>
              )}
            </div>
          </Surface>
        );
      })}
    </div>
  );
}
