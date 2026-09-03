import { evaluateCondition } from "../actions/conditions";
import type { Condition, ProductPredicate } from "../actions/conditions";
import type { PredicateId, RuntimeTypeId, ScopeId } from "../actions/ids";
import type { PresentationTypeGraph } from "../actions/typeGraph";
import type { SelectionSnapshot } from "../actions/types";
import type { PresentationReference, PresentationValues } from "../types";
import { isAnyDeclaredType } from "./types";
import type {
  AnyDeclaredTypeSubject,
  PresentationSelector,
  ScopedSelectorMatch,
  SelectorMatch,
  SelectorMatchResult,
} from "./types";

/**
 * The shared selector (PBUI-HELP-001 §6.1, revised by PBUI-KERNEL-1 §9.3) —
 * the front half of every contextual interpreter, extracted so actions, help,
 * and relations answer type reachability, scope nearness, and condition
 * evaluation identically. Pure: one selector, one subject, one snapshot in; a
 * match with provenance or a staged rejection out. No React, no effects, no
 * trace — emitting trace entries stays with each caller.
 *
 * Stage order is type → scope → condition, and it is load-bearing for the
 * action caller, which interleaves its invocation filter between the type and
 * scope stages by inspecting the rejection stage (see actions/resolve.ts).
 *
 * The runtime type world is CLOSED (design doc C9): a reference whose type the
 * graph does not declare is an error here, never an isolated node.
 */

/**
 * The nearest ACTIVE declared scope: lowest index in the snapshot's
 * inner-to-outer stack among the selector's declared scopes, or null when
 * none is active.
 */
export function activeScope(
  declared: readonly ScopeId[],
  stack: readonly ScopeId[],
): { scope: ScopeId; index: number } | null {
  let best: { scope: ScopeId; index: number } | null = null;
  for (const scope of declared) {
    const index = stack.indexOf(scope);
    if (index >= 0 && (best === null || index < best.index)) best = { scope, index };
  }
  return best;
}

/** The declaration fields every contribution kind shares; see `selectorOf`. */
export interface SelectorSource {
  readonly subject: RuntimeTypeId | AnyDeclaredTypeSubject;
  readonly match: "exact" | "subtypes";
  readonly scopes?: readonly ScopeId[];
  readonly when?: Condition;
  readonly priority?: number;
}

/**
 * Build the selector of an action, help, or relation declaration. Declarations
 * keep their flat `subject`/`match` authoring shape; this is the one place
 * that lifts it into the explicit `SelectorSubject` union.
 */
export function selectorOf(source: SelectorSource): PresentationSelector {
  return {
    subject: isAnyDeclaredType(source.subject)
      ? source.subject
      : { kind: "type", type: source.subject, match: source.match },
    scopes: source.scopes ?? [],
    ...(source.when !== undefined ? { when: source.when } : {}),
    ...(source.priority !== undefined ? { priority: source.priority } : {}),
  };
}

/**
 * Narrow a match to one whose selector declared scopes. Action and help
 * registries reject empty scope lists at construction, so for their matches
 * this never throws; it exists so those callers do not carry nullable scope
 * provenance through their ladders.
 */
export function requireScoped(match: SelectorMatch, owner: string): ScopedSelectorMatch {
  if (match.scope === null || match.scopeIndex === null) {
    throw new Error(
      `${owner} matched scope-universally but its interpreter requires explicit scopes`,
    );
  }
  return match as ScopedSelectorMatch;
}

export function matchSelector<Values extends PresentationValues, ProductFacts>(
  selector: PresentationSelector,
  subject: PresentationReference<Values>,
  snapshot: SelectionSnapshot<ProductFacts>,
  graph: PresentationTypeGraph,
  predicates: ReadonlyMap<PredicateId, ProductPredicate<Values, ProductFacts>>,
): SelectorMatchResult {
  const concreteType = subject.type as RuntimeTypeId;
  if (!graph.has(concreteType)) {
    throw new Error(
      `presentation reference type "${concreteType}" is not declared in the type graph — ` +
        `every runtime type must be declared (closed world, PBUI-KERNEL-1 C9)`,
    );
  }

  /* type ------------------------------------------------------------------ */

  let typeDistance: number;
  let declaredType: RuntimeTypeId | null;
  if (selector.subject.kind === "any-declared-type") {
    typeDistance = 0;
    declaredType = null;
  } else if (selector.subject.match === "exact") {
    if (selector.subject.type !== concreteType) {
      return {
        kind: "rejected",
        stage: "type",
        reason: `exact target "${selector.subject.type}" does not match concrete type "${concreteType}"`,
      };
    }
    typeDistance = 0;
    declaredType = selector.subject.type;
  } else {
    const distance = graph.distance(concreteType, selector.subject.type);
    if (!Number.isFinite(distance)) {
      return {
        kind: "rejected",
        stage: "type",
        reason: `"${selector.subject.type}" is not an ancestor of concrete type "${concreteType}"`,
      };
    }
    typeDistance = distance;
    declaredType = selector.subject.type;
  }

  /* scope ----------------------------------------------------------------- */

  let scope: ScopeId | null = null;
  let scopeIndex: number | null = null;
  if (selector.scopes.length > 0) {
    const nearest = activeScope(selector.scopes, snapshot.scopes);
    if (nearest === null) {
      return { kind: "rejected", stage: "scope", reason: "no-active-scope" };
    }
    scope = nearest.scope;
    scopeIndex = nearest.index;
  }

  /* condition ------------------------------------------------------------- */

  if (selector.when) {
    const status = evaluateCondition(selector.when, { subject, snapshot }, predicates);
    if (status.kind !== "available") {
      return {
        kind: "rejected",
        stage: "condition",
        reason: status.kind === "unavailable" ? status.because : status.kind,
      };
    }
  }

  return {
    kind: "matched",
    match: {
      declaredType,
      concreteType,
      typeDistance,
      scope,
      scopeIndex,
      priority: selector.priority ?? 0,
    },
  };
}
