import { fromJson, toJson, type JsonValue } from "@bufbuild/protobuf";
import { timestampDate, ValueSchema } from "@bufbuild/protobuf/wkt";
import {
  defineLiveAndHydrateAdapter,
  type HydrationPolicy,
  type TimelineAdapter,
  type TimelineEntity,
} from "@go-go-golems/chat-provider";
import { Actor as ActorEnum, TraceEntrySchema } from "../generated/hyperslop/pbui/chat/v1/chat_pb";
import type { Actor, EffectTraceEnvelope, Reference, TraceEntryProps, VerbLike } from "../types";

export const TRACE_UI_EVENT = "PbuiTraceEntryUpsert";
export const TRACE_SNAPSHOT_KIND = "PbuiTraceEntry";
export const TRACE_ENTITY_KIND = "trace_entry";
export const TRACE_ID_PREFIX = "trace-";

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function actorName(value: unknown): Actor {
  if (value === ActorEnum.AGENT || value === "ACTOR_AGENT" || value === "agent" || value === 2) return "agent";
  return "human";
}

function effectFromJson(raw: unknown): EffectTraceEnvelope | undefined {
  if (!isRecord(raw)) return undefined;
  const effectId = typeof raw.effectId === "string" ? raw.effectId : "";
  const effectKind = typeof raw.effectKind === "string" ? raw.effectKind : "";
  const conversationId = typeof raw.conversationId === "string" ? raw.conversationId : "";
  const effectScope = raw.effectScope;
  if (!effectId || !effectKind || !conversationId || !["workbench", "sandbox", "conversation", "server"].includes(String(effectScope))) {
    return undefined;
  }
  return {
    effectId,
    ...(typeof raw.invocationKey === "string" && raw.invocationKey ? { invocationKey: raw.invocationKey } : {}),
    actor: actorName(raw.actor),
    conversationId,
    effectKind,
    effectScope: effectScope as EffectTraceEnvelope["effectScope"],
    canonicalInput: (raw.canonicalInput ?? null) as JsonValue,
    inputDigest: typeof raw.inputDigest === "string" ? raw.inputDigest : "",
    targetIds: Array.isArray(raw.targetIds) ? raw.targetIds.filter((id): id is string => typeof id === "string") : [],
    referenceKeys: Array.isArray(raw.referenceKeys) ? raw.referenceKeys.filter((key): key is string => typeof key === "string") : [],
    ...(typeof raw.approvalId === "string" && raw.approvalId ? { approvalId: raw.approvalId } : {}),
    ...(typeof raw.beforeRevision === "string" && raw.beforeRevision ? { beforeRevision: raw.beforeRevision } : {}),
    ...(typeof raw.afterRevision === "string" && raw.afterRevision ? { afterRevision: raw.afterRevision } : {}),
    outcome: typeof raw.outcome === "string" ? raw.outcome : "",
    occurredAt: typeof raw.occurredAt === "string" ? raw.occurredAt : "",
  };
}

function referenceFromJson(raw: unknown): Reference | undefined {
  if (!isRecord(raw)) return undefined;
  const type = typeof raw.type === "string" ? raw.type : "";
  const id = typeof raw.id === "string" ? raw.id : typeof raw.id === "number" ? String(raw.id) : "";
  if (!type || !id) return undefined;
  const provenance = isRecord(raw.provenance)
    ? Object.fromEntries(
        Object.entries(raw.provenance).filter(([, v]) => typeof v === "string" && v !== ""),
      )
    : undefined;
  return {
    type,
    id,
    ...(isRecord(raw.value) ? { value: raw.value } : {}),
    ...(provenance && Object.keys(provenance).length > 0 ? { provenance } : {}),
  };
}

/**
 * Decode the protojson of a `TraceEntry`. The generated schema is tried
 * first — it is the contract — and a hand mapping catches payloads that are
 * shaped right but not strictly protojson (an actor given as a number, a
 * `seq` already numeric), because a trace row is not worth dropping over that.
 */
export function traceEntryProps(payload: unknown): TraceEntryProps | null {
  if (!isRecord(payload)) return null;
  try {
    const entry = fromJson(TraceEntrySchema, payload as JsonValue, { ignoreUnknownFields: true });
    const at = entry.at ? timestampDate(entry.at).toISOString() : "";
    const target = entry.target
      ? referenceFromJson({
          type: entry.target.type,
          id: entry.target.id,
          value: entry.target.value,
          provenance: entry.target.provenance
            ? {
                messageId: entry.target.provenance.messageId,
                toolCallId: entry.target.provenance.toolCallId,
                widgetId: entry.target.provenance.widgetId,
              }
            : undefined,
        })
      : undefined;
    const effect = entry.effect
      ? effectFromJson({
          effectId: entry.effect.effectId,
          invocationKey: entry.effect.invocationKey,
          actor: entry.effect.actor,
          conversationId: entry.effect.conversationId,
          effectKind: entry.effect.effectKind,
          effectScope: entry.effect.effectScope,
          canonicalInput: entry.effect.canonicalInput ? toJson(ValueSchema, entry.effect.canonicalInput) : null,
          inputDigest: entry.effect.inputDigest,
          targetIds: entry.effect.targetIds,
          referenceKeys: entry.effect.referenceKeys,
          approvalId: entry.effect.approvalId,
          beforeRevision: entry.effect.beforeRevision,
          afterRevision: entry.effect.afterRevision,
          outcome: entry.effect.outcome,
          occurredAt: entry.effect.occurredAt ? timestampDate(entry.effect.occurredAt).toISOString() : "",
        })
      : undefined;
    return {
      seq: Number(entry.seq),
      actor: actorName(entry.actor),
      verb: (entry.verb ?? {}) as VerbLike,
      ...(target ? { target } : {}),
      outcome: entry.outcome,
      at,
      ...(entry.clientSeq ? { clientSeq: entry.clientSeq } : {}),
      ...(effect ? { effect } : {}),
      ...(entry.effectId ? { effectId: entry.effectId } : {}),
      ...(entry.invocationKey ? { invocationKey: entry.invocationKey } : {}),
      ...(entry.approvalId ? { approvalId: entry.approvalId } : {}),
    };
  } catch {
    const seq = Number(payload.seq);
    if (!Number.isFinite(seq)) return null;
    const target = referenceFromJson(payload.target);
    const at = typeof payload.at === "string" ? payload.at : "";
    const effect = effectFromJson(payload.effect);
    return {
      seq,
      actor: actorName(payload.actor),
      verb: (isRecord(payload.verb) ? payload.verb : {}) as VerbLike,
      ...(target ? { target } : {}),
      outcome: typeof payload.outcome === "string" ? payload.outcome : "",
      at,
      ...(typeof payload.clientSeq === "string" && payload.clientSeq ? { clientSeq: payload.clientSeq } : {}),
      ...(effect ? { effect } : {}),
      ...(typeof payload.effectId === "string" && payload.effectId ? { effectId: payload.effectId } : {}),
      ...(typeof payload.invocationKey === "string" && payload.invocationKey ? { invocationKey: payload.invocationKey } : {}),
      ...(typeof payload.approvalId === "string" && payload.approvalId ? { approvalId: payload.approvalId } : {}),
    };
  }
}

export function traceEntity(props: TraceEntryProps): TimelineEntity {
  const at = Date.parse(props.at);
  const stamp = Number.isFinite(at) ? at : Date.now();
  return {
    id: `${TRACE_ID_PREFIX}${props.seq}`,
    kind: TRACE_ENTITY_KIND,
    createdAt: stamp,
    updatedAt: stamp,
    props: props as unknown as Record<string, unknown>,
  };
}

/**
 * Live `PbuiTraceEntryUpsert` events and hydrated `PbuiTraceEntry` entities
 * carry the same payload (the event IS the entity), so both paths share one
 * decoder and produce identical `trace_entry` entities — `traceAdapter.test`
 * asserts exactly that.
 */
export type LiveAndHydrateAdapter = TimelineAdapter & {
  live: NonNullable<TimelineAdapter["live"]>;
  hydrate: Extract<HydrationPolicy, { kind: "supported" }>;
};

export const traceAdapter: LiveAndHydrateAdapter = defineLiveAndHydrateAdapter({
  name: "pbui-chat.trace",
  priority: 0,
  live: {
    accepts: (frame) => frame.name === TRACE_UI_EVENT,
    project(frame) {
      const props = traceEntryProps(frame.payload);
      return props ? { upsert: traceEntity(props) } : null;
    },
  },
  hydrate: {
    kind: "supported",
    project(entity) {
      if (entity.kind !== TRACE_SNAPSHOT_KIND) return null;
      const props = traceEntryProps(entity.payload);
      return props ? traceEntity(props) : null;
    },
  },
});
