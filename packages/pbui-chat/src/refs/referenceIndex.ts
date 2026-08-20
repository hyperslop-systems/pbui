import { useMemo } from "react";
import { selectTimelineEntities, useChatSelector, type TimelineEntity } from "@go-go-golems/chat-provider";
import type { Reference } from "../types";
import { referenceKey } from "../types";
import { validateReference } from "../vocabulary/validate";

export const REFS_WIDGET_NAME = "pbui.refs";
export const WIDGET_WIDGET_NAME = "pbui.widget";
export const ERROR_WIDGET_NAME = "pbui.error";

/** `"<type>:<id>"` → the resolved reference. Latest publication wins. */
export type ReferenceIndex = ReadonlyMap<string, Reference>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/**
 * Fold every `pbui.refs` widget entity in the timeline into one lookup. The
 * entity's props are `{ instanceId, widgetName, props: { schema_version, refs } }`
 * once chat-provider's widget adapter has merged them; `refs` is keyed by
 * `type:id` and each value is a whole wire reference. Entities are walked in
 * timeline order, so a later message that re-resolves an object replaces the
 * earlier value — which is what "latest wins" means here.
 */
export function buildReferenceIndex(entities: readonly TimelineEntity[]): ReferenceIndex {
  const index = new Map<string, Reference>();
  for (const entity of entities) {
    if (entity.kind !== "widget") continue;
    if (entity.props.widgetName !== REFS_WIDGET_NAME) continue;
    const props = isRecord(entity.props.props) ? entity.props.props : null;
    const refs = props && isRecord(props.refs) ? props.refs : null;
    if (!refs) continue;
    for (const [key, raw] of Object.entries(refs)) {
      if (!isRecord(raw) || validateReference(raw)) continue;
      const reference: Reference = {
        type: String(raw.type),
        id: String(raw.id),
        ...(isRecord(raw.value) ? { value: raw.value } : {}),
        ...(isRecord(raw.provenance) ? { provenance: raw.provenance as Reference["provenance"] } : {}),
      };
      index.set(key || referenceKey(reference.type, reference.id), reference);
    }
  }
  return index;
}

/** The live index, recomputed only when the timeline's entity list changes. */
export function useReferenceIndex(): ReferenceIndex {
  const entities = useChatSelector(selectTimelineEntities);
  return useMemo(() => buildReferenceIndex(entities), [entities]);
}

/** A mention the index could not answer, as the `unresolved` presentation. */
export function unresolvedReference(type: string, id: string, label?: string): Reference {
  return { type: "unresolved", id: referenceKey(type, id), value: { type, id, ...(label ? { label } : {}) } };
}

export function resolveMention(
  index: ReferenceIndex,
  type: string,
  id: string,
  label?: string,
  extra?: Readonly<Record<string, Reference>>,
): Reference {
  const key = referenceKey(type, id);
  return index.get(key) ?? extra?.[key] ?? unresolvedReference(type, id, label);
}
