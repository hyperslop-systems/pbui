import type { RuntimeTypeId } from "../actions/ids";
import type { PresentationTypeGraph } from "../actions/typeGraph";
import type { IdentityClass, IdentityDeclaration } from "./identity";
import type { Binding, SerializableReference } from "./terms";
import type { PortDeclaration, PortId } from "./types";

/*
 * The immutable facts the link kernel reads (design §6.5). The shell builds
 * one from the workbench document, the app registry and the link runtime;
 * the kernel never touches a store. Values are read through `values` so a
 * snapshot can be cheap: nothing is copied until a resolver asks.
 */

export interface PortDefinition {
  readonly id: PortId;
  readonly viewId: string;
  readonly appId: string;
  readonly declaration: PortDeclaration;
  /** The tile's label, for badges and menu rows ("→ Orders East"). */
  readonly tileTitle: string;
}

export interface ContextDefinition {
  readonly key: string;
  readonly valueType: RuntimeTypeId;
  readonly doc: string;
  /** The out ports whose declarations drive this context. */
  readonly drivenBy: readonly PortId[];
}

export interface LinkValues {
  /** What an OUT/INOUT port last emitted. */
  emitted(port: PortId): SerializableReference | undefined;
  /** A context cell: `null` when the cell exists but is empty, `undefined` when there is no such cell. */
  context(key: string): SerializableReference | null | undefined;
  /** The last value PRESENTED as attended on a port (toy pattern 8), for Pin. */
  attended(port: PortId): SerializableReference | undefined;
  /** Identity class cells (Phase 5): `null` when the class exists but is empty, `undefined` when there is no such class. */
  classCell?(classId: string): SerializableReference | null | undefined;
}

/** Everything the link document holds (Phase 5 adds identity): the persisted half of the kernel's facts. */
export interface LinkState {
  readonly bindings: ReadonlyMap<PortId, Binding>;
  readonly identity: readonly IdentityDeclaration[];
  /** Compiled from `identity`, persisted for id stability. */
  readonly classes: readonly IdentityClass[];
  /** Pre-merge private values, for the "history" split policy. */
  readonly history: ReadonlyMap<PortId, SerializableReference | null>;
}

export const EMPTY_LINK_STATE: LinkState = { bindings: new Map(), identity: [], classes: [], history: new Map() };

export interface LinkSnapshot {
  readonly documentRevision: string | number;
  readonly runtimeRevision: number;
  /** Declared ports of the views in the document, keyed by port id. */
  readonly ports: ReadonlyMap<PortId, PortDefinition>;
  /** Explicit terms from the link document. */
  readonly bindings: ReadonlyMap<PortId, Binding>;
  /** Identity declarations, compiled classes, and pre-merge history (Phase 5). */
  readonly identity: readonly IdentityDeclaration[];
  readonly classes: ReadonlyMap<string, IdentityClass>;
  /** Member port → class id: the derived `Alias` of every member. */
  readonly aliases: ReadonlyMap<PortId, string>;
  readonly history: ReadonlyMap<PortId, SerializableReference | null>;
  /** `view.documents[slot]` projected as constants for document-slot ports (design D2). */
  readonly documentSlots: ReadonlyMap<PortId, SerializableReference>;
  readonly contexts: ReadonlyMap<string, ContextDefinition>;
  readonly values: LinkValues;
}

/** A direct relation a `Derived` term may name (Phase 6): the metadata of a product translator, without its function. */
export interface RelationDefinition {
  readonly id: string;
  readonly from: RuntimeTypeId;
  readonly to: RuntimeTypeId;
  /** One line for the palette and the wire label; defaults to the id. */
  readonly label?: string;
}

export interface LinkDeps {
  readonly graph: PresentationTypeGraph;
  /** The relations a `Derived` term may name (Phase 6). Absent ⇒ no derivations are offered. */
  readonly relations?: readonly RelationDefinition[];
  /**
   * A named relation applied to a value (Phase 6: the product's translators).
   * Absent ⇒ every `Derived` term evaluates to a diagnostic.
   */
  relation?(relationId: string, reference: SerializableReference, snapshot: LinkSnapshot): SerializableReference | undefined;
  /** How a value is named in a badge or menu row; defaults to `<type>`. */
  label?(reference: SerializableReference): string;
}

/** A value type reaches a port's declared type when it is that type, a subtype of it, or the port accepts `any`. */
export function reaches(from: RuntimeTypeId, to: RuntimeTypeId, graph: PresentationTypeGraph): boolean {
  if (to === "any" || from === to) return true;
  return graph.isSubtype(from, to);
}

export function labelOf(reference: SerializableReference, deps: LinkDeps): string {
  return deps.label?.(reference) ?? `<${reference.type}>`;
}
