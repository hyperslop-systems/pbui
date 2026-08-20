import { EmptyState } from "@hyperslop-systems/pbui";
import { selectTimelineEntities, useChatSelector, WidgetOutlet } from "@go-go-golems/chat-provider";
import type { AppView } from "@hyperslop-systems/workbench-protocol";
import { findWidgetEntity } from "../../widget/findWidgetEntity";
import styles from "./WidgetApp.module.css";

/** The binding key: `view.documents.widget` names the widget instance. */
export const WIDGET_BINDING = "widget";

/**
 * One widget instance as a tile — what "Open in tile" produces. It renders
 * through chat-provider's `WidgetOutlet`, so it is the SAME live instance as
 * the one in the transcript: patches still arrive, verbs still fire. Only
 * its place on the page changed.
 */
export function WidgetApp({ view }: { placementId: string; view: AppView }) {
  const widgetId = view.documents[WIDGET_BINDING] ?? "";
  const entities = useChatSelector(selectTimelineEntities);
  const entity = findWidgetEntity(entities, widgetId);

  if (!widgetId) {
    return (
      <div className={styles.pad}>
        <EmptyState message="this tile names no widget" hint="open one with “Open in tile” from a widget's menu" />
      </div>
    );
  }
  if (!entity) {
    return (
      <div className={styles.pad}>
        <EmptyState message={`widget ${widgetId} is no longer in the timeline`} hint="close this tile; the conversation it came from has moved on" />
      </div>
    );
  }
  return (
    <div data-part="widget-app" className={styles.pad}>
      <WidgetOutlet
        instanceId={widgetId}
        widgetName={String(entity.props.widgetName ?? "")}
        status={String(entity.props.status ?? "READY")}
        props={(entity.props.props as Record<string, unknown> | undefined) ?? {}}
      />
    </div>
  );
}
