import type { Condition } from "../actions/conditions";
import type { RuntimeTypeId, ScopeId } from "../actions/ids";
import type { SelectionSnapshot } from "../actions/types";
import type { PresentationReference, PresentationValues } from "../types";

/**
 * Typed presentation translators (PBUI-ACTIONS-2 P6; source guide §19).
 *
 * The replacement for the ordered `conversions` callback array: a translator
 * declares its SOURCE and TARGET types, its scopes, an optional condition,
 * and a priority — so acceptance is deterministic, explainable, and
 * ambiguity-aware instead of first-registered-wins. Direct edges only: no
 * chaining in this phase.
 *
 * Two rules are load-bearing:
 *
 * - SUBTYPING IS SUBSTITUTABILITY, NOT CONVERSION. If the concrete reference
 *   type is a graph subtype of an accepted target, the request is satisfied
 *   with the ORIGINAL reference; downstream code may still dispatch on the
 *   concrete type. Translators run only when subtyping does not apply.
 * - AMBIGUITY IS A CHOICE, NEVER A GUESS. Two applicable edges at equal
 *   scope and priority produce an explicit chooser; registration order never
 *   picks a translator.
 */

export type TranslatorId = string;

export interface PresentationTranslator<Values extends PresentationValues, ProductFacts> {
  id: TranslatorId;
  from: RuntimeTypeId;
  to: RuntimeTypeId;
  /** exact: the concrete type must equal `from`; subtypes: any graph subtype. */
  match: "exact" | "subtypes";
  /** Empty or absent means: applicable in every scope. */
  scopes?: readonly ScopeId[];
  when?: Condition;
  priority?: number;
  translate(
    reference: PresentationReference<Values>,
    snapshot: SelectionSnapshot<ProductFacts>,
  ): PresentationReference<Values> | undefined;
}

/** One candidate outcome of an accept gesture. */
export interface AcceptanceOption<Values extends PresentationValues> {
  translator: TranslatorId | null; // null ⇒ direct (identity or subtype)
  result: PresentationReference<Values>;
}

export type AcceptanceResolution<Values extends PresentationValues> =
  | { kind: "none" }
  | { kind: "accepted"; option: AcceptanceOption<Values> }
  | { kind: "ambiguous"; options: readonly AcceptanceOption<Values>[] };
