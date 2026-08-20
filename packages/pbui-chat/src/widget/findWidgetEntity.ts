import type { TimelineEntity } from "@go-go-golems/chat-provider";

/**
 * The timeline entity behind a widget instance id. Widgets are keyed by
 * `props.instanceId`; older entries only carry the entity id, so both are
 * accepted — the tile and the fallback panel resolve them the same way.
 */
export function findWidgetEntity(entities: readonly TimelineEntity[], widgetId: string): TimelineEntity | undefined {
  return entities.find((entity) => entity.kind === "widget" && (entity.props.instanceId === widgetId || entity.id === widgetId));
}

/** The widget's own title from its document, else the id. */
export function widgetTitleOf(entity: TimelineEntity | undefined, widgetId: string): string {
  const props = (entity?.props.props as Record<string, unknown> | undefined) ?? {};
  return typeof props.title === "string" && props.title ? props.title : widgetId;
}
