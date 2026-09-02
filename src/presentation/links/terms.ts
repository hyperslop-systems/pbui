import type { RuntimeTypeId } from "../actions/ids";
import type { PortId } from "./types";

/*
 * Binding terms (PBUI-LINK-1 Phase 2), verbatim from the research report's
 * algebra (§7.2):
 *
 *   b ::= Ambient(k) | Constant(r) | Follow(p) | Alias(c) | Derived(b, ρ)
 *       | Hold(r, b) | Unresolved(d)
 *
 * A term says where a port's value COMES FROM, never what it is. Terms are
 * persisted in the link document, so every field is JSON: a held or constant
 * reference is `{ type, value }` with a JSON value (design D4), and a
 * `Follow`/`Derived` carries a `linkId` so the wire is addressable
 * independently of its endpoints.
 */

/** A presentation reference as it is stored: the same `{ type, value }` shape the runtime uses, JSON-only. */
export interface SerializableReference {
  readonly type: RuntimeTypeId;
  readonly value: unknown;
}

export interface Diagnostic {
  readonly code: string;
  readonly message: string;
}

export type Binding =
  | { readonly kind: "ambient"; readonly key: string }
  | { readonly kind: "constant"; readonly reference: SerializableReference }
  | { readonly kind: "follow"; readonly source: PortId; readonly linkId: string }
  | { readonly kind: "alias"; readonly classId: string }
  | { readonly kind: "derived"; readonly source: Binding; readonly relationId: string; readonly linkId: string }
  | { readonly kind: "hold"; readonly reference: SerializableReference; readonly suspended: Binding }
  | { readonly kind: "unresolved"; readonly diagnostic: Diagnostic };

export const terms = {
  ambient: (key: string): Binding => ({ kind: "ambient", key }),
  constant: (reference: SerializableReference): Binding => ({ kind: "constant", reference }),
  follow: (source: PortId, linkId: string): Binding => ({ kind: "follow", source, linkId }),
  alias: (classId: string): Binding => ({ kind: "alias", classId }),
  derived: (source: Binding, relationId: string, linkId: string): Binding => ({ kind: "derived", source, relationId, linkId }),
  hold: (reference: SerializableReference, suspended: Binding): Binding => ({ kind: "hold", reference, suspended }),
  unresolved: (code: string, message: string): Binding => ({ kind: "unresolved", diagnostic: { code, message } }),
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export function isSerializableReference(value: unknown): value is SerializableReference {
  return isRecord(value) && typeof value.type === "string" && value.type.length > 0 && "value" in value;
}

/** Structural validation for terms read back from a document; a foreign shape is dropped, never trusted. */
export function isBinding(value: unknown, depth = 0): value is Binding {
  if (!isRecord(value) || depth > 8) return false;
  switch (value.kind) {
    case "ambient":
      return typeof value.key === "string" && value.key.length > 0;
    case "constant":
      return isSerializableReference(value.reference);
    case "follow":
      return typeof value.source === "string" && value.source.length > 0 && typeof value.linkId === "string" && value.linkId.length > 0;
    case "alias":
      return typeof value.classId === "string" && value.classId.length > 0;
    case "derived":
      return isBinding(value.source, depth + 1) && typeof value.relationId === "string" && typeof value.linkId === "string";
    case "hold":
      return isSerializableReference(value.reference) && isBinding(value.suspended, depth + 1);
    case "unresolved":
      return isRecord(value.diagnostic) && typeof value.diagnostic.code === "string" && typeof value.diagnostic.message === "string";
    default:
      return false;
  }
}

/** The link id a term carries, if it is a wire (follow or derived). */
export function linkIdOf(binding: Binding): string | null {
  if (binding.kind === "follow" || binding.kind === "derived") return binding.linkId;
  if (binding.kind === "hold") return linkIdOf(binding.suspended);
  return null;
}

/** The port a term ultimately reads, if it follows one (through a hold or a derivation). */
export function sourcePortOf(binding: Binding): PortId | null {
  switch (binding.kind) {
    case "follow":
      return binding.source;
    case "derived":
      return sourcePortOf(binding.source);
    case "hold":
      return sourcePortOf(binding.suspended);
    default:
      return null;
  }
}

/** One line, for logs and the inspector; the badge has its own wording (`badge.ts`). */
export function describeBinding(binding: Binding): string {
  switch (binding.kind) {
    case "ambient":
      return `ambient ${binding.key}`;
    case "constant":
      return `fixed on <${binding.reference.type}>`;
    case "follow":
      return `following ${binding.source}`;
    case "alias":
      return `shared through ${binding.classId}`;
    case "derived":
      return `${describeBinding(binding.source)} through ${binding.relationId}`;
    case "hold":
      return `held on <${binding.reference.type}>, suspending: ${describeBinding(binding.suspended)}`;
    case "unresolved":
      return `unresolved: ${binding.diagnostic.message}`;
  }
}

export function sameReference(a: SerializableReference | undefined, b: SerializableReference | undefined): boolean {
  if (!a || !b) return a === b;
  return a.type === b.type && JSON.stringify(a.value) === JSON.stringify(b.value);
}
