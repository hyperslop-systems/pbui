import type { Condition } from "../actions/conditions";
import type { RuntimeTypeId, ScopeId } from "../actions/ids";

/**
 * The shared contextual-matching contracts (PBUI-HELP-001, design doc §6).
 *
 * A ContextTarget is the part of a contribution that says WHERE it applies —
 * a declared type with exact/subtype reach, declared scopes, and optionally a
 * declarative condition. Both the action kernel and the help kernel declare
 * targets; only what happens AFTER a match differs (actions compete per
 * action id, help accumulates). Nothing here is action- or help-specific.
 */

export interface ContextTarget {
  subject: RuntimeTypeId;
  match: "exact" | "subtypes";
  scopes: readonly ScopeId[];
  /**
   * Optional declarative gate. The ACTION caller does not pass one: a failing
   * action condition produces an Availability status that stays in the
   * override competition (unavailable/hidden suppress fallbacks), which a
   * binary reject cannot express. The HELP caller passes it, because for help
   * only `available` matches — everything else contributes nothing.
   */
  when?: Condition;
  /** Echoed into the match; ordering metadata for the caller, never a filter. */
  priority?: number;
}

/** Where and how a target matched: the shared provenance of a contribution. */
export interface ContextMatch {
  declaredType: RuntimeTypeId;
  concreteType: RuntimeTypeId;
  typeDistance: number;
  scope: ScopeId;
  scopeIndex: number;
  priority: number;
}

export type ContextMatchResult =
  | { kind: "matched"; match: ContextMatch }
  | { kind: "rejected"; stage: "type" | "scope" | "condition"; reason: string };
