import type { ReactNode } from "react";
import type { PresentationReference, PresentationType, PresentationValues } from "../types";
import type { Availability } from "./availability";
import type { Condition } from "./conditions";
import type {
  ActionId,
  CandidateId,
  FamilyId,
  ModeId,
  RuleId,
  RuntimeTypeId,
  ScopeId,
} from "./ids";

/**
 * The action kernel's contracts (PBUI-ACTIONS-2; source guide §§9, 12, 14, 16).
 *
 * Everything here is data or pure functions over data. Nothing in this
 * directory imports React at runtime (ReactNode is a type-only import),
 * subscribes to a store, or causes an effect. Binders return serializable
 * verbs; the product's `onPerform` remains the only effect boundary.
 */

/* ------------------------------------------------------------- the query -- */

export type ActionInvocation = "menu" | "primary" | "agent" | "introspection";

export interface ActionQuery<Values extends PresentationValues> {
  subject: PresentationReference<Values>;
  invocation: ActionInvocation;
  gesture?: {
    kind: "pointer" | "keyboard" | "programmatic";
    name?: string;
    modifiers?: ReadonlySet<"shift" | "control" | "meta" | "alt">;
  };
}

/* ---------------------------------------------------------- the snapshot -- */

/**
 * The immutable, revisioned facts a resolution reads. The resolver never
 * touches live stores: the product's `snapshotFor(query, environment)`
 * captures query-relevant facts and a revision that advances whenever any
 * resolution-relevant fact changes. The revision is drift telemetry, not
 * authorization — perform always re-resolves.
 */
export interface SelectionSnapshot<ProductFacts> {
  revision: string | number;
  /** Ordered inner/local to outer/global. */
  scopes: readonly ScopeId[];
  /** Transient contextual facts, not virtual presentation types. */
  modes: ReadonlySet<ModeId>;
  /** UI feedback facts, never the sole security boundary. */
  capabilities: ReadonlySet<string>;
  /** Product-owned immutable facts derived for this query. */
  product: Readonly<ProductFacts>;
}

/* ------------------------------------------------------------- contexts --- */

/** What an exact rule sees: the narrowed concrete reference. */
export interface ExactRuleContext<
  Values extends PresentationValues,
  Type extends PresentationType<Values>,
  ProductFacts,
> {
  subject: { type: Type; value: Values[Type] };
  snapshot: SelectionSnapshot<ProductFacts>;
}

/**
 * What an inherited rule sees: the ORIGINAL generic concrete reference.
 * Runtime subtyping never coerces payloads; a rule needing a parent-shaped
 * view must use an explicit product projection or predicate.
 */
export interface InheritedRuleContext<Values extends PresentationValues, ProductFacts> {
  subject: PresentationReference<Values>;
  snapshot: SelectionSnapshot<ProductFacts>;
}

export type FamilyContext<
  Values extends PresentationValues,
  ProductFacts,
> = InheritedRuleContext<Values, ProductFacts>;

/* ------------------------------------------------------------- metadata --- */

export interface ActionMetadata<Values extends PresentationValues, ProductFacts> {
  label:
    | string
    | ((context: InheritedRuleContext<Values, ProductFacts>) => ReactNode);
  description?: string;
  group?: string;
  /** Menu placement only. Changing order must never change which rule wins. */
  order?: number;
  /**
   * Presentation metadata only: styling and confirmation UX. It must never
   * imply a capability, permission, or authorization rule.
   */
  danger?: boolean;
}

/* ---------------------------------------------------------- contributions -- */

export interface ExactActionRule<
  Values extends PresentationValues,
  Type extends PresentationType<Values>,
  ProductFacts,
  Verb,
> {
  kind: "rule";
  id: RuleId;
  action: ActionId;
  subject: Type;
  match: "exact";
  scopes: readonly ScopeId[];
  /** Which invocations may discover this rule; absent = all. */
  invocations?: readonly ActionInvocation[];
  when?: Condition;
  /** Opaque escape hatch; affects applicability only, never precedence. */
  test?(context: ExactRuleContext<Values, Type, ProductFacts>): Availability;
  metadata: ActionMetadata<Values, ProductFacts>;
  priority?: number;
  /** Pure; runs only for the uniquely selected AVAILABLE candidate. */
  bind(context: ExactRuleContext<Values, Type, ProductFacts>): Verb;
}

export interface InheritedActionRule<
  Values extends PresentationValues,
  ProductFacts,
  Verb,
> {
  kind: "rule";
  id: RuleId;
  action: ActionId;
  subject: RuntimeTypeId;
  match: "subtypes";
  scopes: readonly ScopeId[];
  invocations?: readonly ActionInvocation[];
  when?: Condition;
  test?(context: InheritedRuleContext<Values, ProductFacts>): Availability;
  metadata: ActionMetadata<Values, ProductFacts>;
  priority?: number;
  bind(context: InheritedRuleContext<Values, ProductFacts>): Verb;
}

export interface ActionFamilyInstance<
  Values extends PresentationValues,
  ProductFacts,
  Verb,
> {
  /** Stable for the same semantic instance; unique within one expansion. */
  key: string;
  action: ActionId;
  /** Defaults to available. Selected-only binding rules still apply. */
  status?: Availability;
  metadata: ActionMetadata<Values, ProductFacts>;
  bind(context: FamilyContext<Values, ProductFacts>): Verb;
}

export interface ActionFamily<Values extends PresentationValues, ProductFacts, Verb> {
  kind: "family";
  id: FamilyId;
  /**
   * A runtime type, or `"*"` to match every concrete type exactly — the
   * legacy-adapter escape hatch; new product code declares real types.
   */
  subject: RuntimeTypeId | "*";
  match: "exact" | "subtypes";
  scopes: readonly ScopeId[];
  invocations?: readonly ActionInvocation[];
  priority?: number;
  /** Pure and bounded; output order carries no override meaning. */
  expand(
    context: FamilyContext<Values, ProductFacts>,
  ): readonly ActionFamilyInstance<Values, ProductFacts, Verb>[];
}

export type ActionContribution<Values extends PresentationValues, ProductFacts, Verb> =
  | ExactActionRule<Values, PresentationType<Values>, ProductFacts, Verb>
  | InheritedActionRule<Values, ProductFacts, Verb>
  | ActionFamily<Values, ProductFacts, Verb>;

/* --------------------------------------------------------------- results --- */

export interface ResolvedAction<Values extends PresentationValues, Verb> {
  action: ActionId;
  candidateId: CandidateId;
  contributionId: RuleId | FamilyId;
  query: ActionQuery<Values>;

  label: ReactNode;
  description?: string;
  group?: string;
  order: number;
  danger: boolean;

  status:
    | { kind: "available" }
    | { kind: "unavailable"; because: string; code?: string };

  /** Present only when status is available. */
  verb?: Verb;
  snapshotRevision: string | number;
  registryVersion: string | number;

  provenance: {
    declaredType: RuntimeTypeId;
    concreteType: RuntimeTypeId;
    typeDistance: number;
    scope: ScopeId;
    scopeIndex: number;
    priority: number;
  };
}

export interface SelectionAmbiguity {
  action: ActionId;
  candidates: readonly CandidateId[];
  because: "equal-specificity" | "incomparable-types" | "equal-scope" | "equal-priority";
}

export interface ResolutionTraceEntry {
  candidateId: CandidateId;
  contributionId: string;
  action?: ActionId;
  stage: "scope" | "type" | "expand" | "condition" | "override" | "selected";
  result:
    | "pass"
    | "reject"
    | "unavailable"
    | "inapplicable"
    | "hidden"
    | "shadowed"
    | "ambiguous"
    | "selected";
  reasonCode?: string;
  distance?: number;
  scopeIndex?: number;
  related?: readonly CandidateId[];
}

export interface ResolutionResult<Values extends PresentationValues, Verb> {
  actions: readonly ResolvedAction<Values, Verb>[];
  ambiguities: readonly SelectionAmbiguity[];
  trace: readonly ResolutionTraceEntry[];
  snapshotRevision: string | number;
  registryVersion: string | number;
}

/* --------------------------------------------------------------- perform --- */

/**
 * `delegated` means PBUI successfully crossed its boundary — it does not
 * claim the domain accepted the mutation. Refusals never reach `onPerform`.
 */
export type PerformResult =
  | { kind: "delegated" }
  | { kind: "refused"; code: string; because?: string }
  | { kind: "failed"; error: unknown };
