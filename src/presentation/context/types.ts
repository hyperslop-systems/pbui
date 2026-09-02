import type { Condition } from "../actions/conditions";
import type { RuntimeTypeId, ScopeId } from "../actions/ids";

/**
 * The shared contextual-matching contracts (PBUI-HELP-001 §6, revised by
 * PBUI-KERNEL-1 §9).
 *
 * A PresentationSelector is the part of a declaration that says WHERE it
 * applies — a subject (one declared type with exact/subtype reach, or every
 * declared type), zero or more eligible scopes, and optionally a declarative
 * condition. Actions, help, and relations all declare selectors; only what
 * happens AFTER a match differs (actions compete per action id, help
 * accumulates, relations produce a value). Nothing here is interpreter-specific.
 */

/**
 * The universal subject: applies to every DECLARED runtime type. This is an
 * explicit value, not a string spelling — the pre-KERNEL-1 `"*"` family
 * subject rode on an open-world type graph that treated undeclared types as
 * isolated nodes; both are gone. A universal selector still requires the
 * concrete reference type to be declared (design doc §5.1, C9).
 */
export interface AnyDeclaredTypeSubject {
  readonly kind: "any-declared-type";
}

export const anyDeclaredType: AnyDeclaredTypeSubject = Object.freeze({
  kind: "any-declared-type",
});

export function isAnyDeclaredType(subject: unknown): subject is AnyDeclaredTypeSubject {
  return (
    typeof subject === "object" &&
    subject !== null &&
    (subject as { kind?: unknown }).kind === "any-declared-type"
  );
}

export type SelectorSubject =
  | {
      readonly kind: "type";
      readonly type: RuntimeTypeId;
      readonly match: "exact" | "subtypes";
    }
  | AnyDeclaredTypeSubject;

export interface PresentationSelector {
  readonly subject: SelectorSubject;
  /**
   * Empty means scope-universal: the selector matches regardless of the active
   * stack and its provenance carries `scope: null`. Action and help registries
   * deliberately require explicit scopes as an authoring rule; relations may
   * be universal.
   */
  readonly scopes: readonly ScopeId[];
  /**
   * Optional declarative gate. The ACTION caller does not pass one: a failing
   * action condition produces an Availability status that stays in the
   * override competition (unavailable/hidden suppress fallbacks), which a
   * binary reject cannot express. Help and relation callers pass it, because
   * for them only `available` matches — everything else contributes nothing.
   */
  readonly when?: Condition;
  /** Echoed into the match; ordering metadata for the caller, never a filter. */
  readonly priority?: number;
}

/**
 * Where and how a selector matched: the shared provenance of a contribution.
 * `declaredType` is null for a universal subject; `scope`/`scopeIndex` are
 * null for a scope-universal selector. Callers that require explicit scopes
 * narrow with `requireScoped`.
 */
export interface SelectorMatch {
  readonly declaredType: RuntimeTypeId | null;
  readonly concreteType: RuntimeTypeId;
  readonly typeDistance: number;
  readonly scope: ScopeId | null;
  readonly scopeIndex: number | null;
  readonly priority: number;
}

/** A match whose selector declared explicit scopes (actions, help). */
export interface ScopedSelectorMatch extends SelectorMatch {
  readonly scope: ScopeId;
  readonly scopeIndex: number;
}

export type SelectorMatchResult =
  | { readonly kind: "matched"; readonly match: SelectorMatch }
  | {
      readonly kind: "rejected";
      readonly stage: "type" | "scope" | "condition";
      readonly reason: string;
    };
