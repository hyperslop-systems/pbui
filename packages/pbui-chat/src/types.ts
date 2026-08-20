import type { PresentationReference, PresentationValues } from "@hyperslop-systems/pbui";

/**
 * Where a reference was minted. Mirrors `hyperslop.pbui.chat.v1.Provenance`
 * with lowerCamel keys, which is how it travels inside a `Struct`.
 */
export interface Provenance {
  messageId?: string;
  toolCallId?: string;
  widgetId?: string;
}

/**
 * A presentation reference as it travels: the type, the stable id the model
 * may name, the resolved value (absent while unresolved) and its provenance.
 * Mirrors `hyperslop.pbui.chat.v1.Reference`.
 *
 * # How it becomes a pbui presentation
 *
 * pbui's own `PresentationReference` is `{ type, value }`, and the value is
 * whatever the product's descriptor wants to read. The chat layer's
 * convention is that the VALUE IS THE WIRE REFERENCE: a descriptor for a
 * chat-backed type receives the whole `Reference<V>` and reads `id`,
 * `value` and `provenance` from it. One definition of a reference on both
 * sides of the wire, and no per-type adapter. See `toPresentationReference`.
 */
export interface Reference<V = Record<string, unknown>> {
  type: string;
  id: string;
  value?: V;
  provenance?: Provenance;
}

/** `"<type>:<id>"`, the key used in `pbui.refs` documents. */
export function referenceKey(type: string, id: string): string {
  return `${type}:${id}`;
}

/**
 * Lift a wire reference into the product's `PresentationReference`. The cast
 * is the single place where the chat layer's convention (value = reference)
 * meets pbui's generic type; products that follow the convention in their
 * `Values` get a correctly typed reference out, products that do not get a
 * fallback label from the registry rather than a crash.
 */
export function toPresentationReference<Values extends PresentationValues>(
  reference: Reference,
): PresentationReference<Values> {
  return { type: reference.type, value: reference } as unknown as PresentationReference<Values>;
}

/**
 * The reverse direction, used when pbui hands a reference back (accept mode,
 * menus): a chat-backed value IS a wire reference; anything else is wrapped
 * with its type and a best-effort id.
 */
export function fromPresentationReference(reference: {
  type: string;
  value: unknown;
}): Reference {
  const value = reference.value;
  if (value && typeof value === "object" && "id" in value && typeof value.id === "string") {
    const wire = value as Reference;
    return {
      type: reference.type,
      id: wire.id,
      ...(wire.value !== undefined ? { value: wire.value as Record<string, unknown> } : {}),
      ...(wire.provenance ? { provenance: wire.provenance } : {}),
    };
  }
  return {
    type: reference.type,
    id: typeof value === "string" || typeof value === "number" ? String(value) : JSON.stringify(value ?? null),
    value: value && typeof value === "object" ? (value as Record<string, unknown>) : { value },
  };
}

/** A serialisable verb. Products narrow this with their own union. */
export type VerbLike = { kind: string } & Record<string, unknown>;

export type Actor = "human" | "agent";

/** `"performed"` or `"rejected:<why>"`. */
export type Outcome = "performed" | `rejected:${string}`;

/* ---- the chat layer's own presentation types (design §5.1) -------------
 * Type aliases, not interfaces: an alias gets an implicit index signature
 * and so satisfies `Reference`'s default `Record<string, unknown>` value. */

export type MessageValue = {
  role: "user" | "assistant" | "thinking" | "error";
  runId?: string;
  content?: string;
}

export type RunValue = {
  status: "streaming" | "finished" | "failed" | "stopped" | "idle";
  toolCalls: number;
  durationMs?: number;
  tokens?: number;
}

export type ToolValue = {
  callId: string;
  name: string;
  status: string;
  parentMessageId?: string;
  rows?: number;
}

export type WidgetValue = {
  title?: string;
  parentMessageId?: string;
  status: string;
}

export type ProposalValue = {
  toolCallId: string;
  title: string;
  body?: string;
  danger: boolean;
  fields?: { label: string; value: string }[];
  decision?: { by: string; at: string; value: "approve" | "reject" };
}

export type TraceEntryValue = {
  seq: number;
  actor: Actor;
  verb: VerbLike;
  target?: Reference;
  outcome: string;
  at: string;
}

export type SourceValue = {
  evidenceId: string;
  title: string;
  locator?: string;
}

export type UnresolvedValue = {
  type: string;
  id: string;
  label?: string;
}

/**
 * The presentation types the chat layer itself renders. A product's `Values`
 * includes the subset it registers descriptors for and adds its own; the
 * library is generic over the product's `Values`, so nothing here is
 * mandatory — but `unresolved` is what a mention falls back to, so a product
 * without it gets the registry's fallback label for those.
 */
export interface ChatValues {
  message: Reference<MessageValue>;
  run: Reference<RunValue>;
  tool: Reference<ToolValue>;
  widget: Reference<WidgetValue>;
  proposal: Reference<ProposalValue>;
  traceEntry: Reference<TraceEntryValue>;
  source: Reference<SourceValue>;
  unresolved: Reference<UnresolvedValue>;
}

/** The props of a `trace_entry` timeline entity (see adapters/traceAdapter). */
export interface TraceEntryProps {
  seq: number;
  actor: Actor;
  verb: VerbLike;
  target?: Reference;
  outcome: string;
  at: string;
  clientSeq?: string;
}

/** What `sendMessageBody` sends to `POST …/messages`. An alias so it satisfies chat-provider's `Record<string, unknown>` body type. */
export type ChatMessageBody = {
  prompt: string;
  attachments?: unknown[];
  refs?: Reference[];
  focus?: { reference: Reference };
};
