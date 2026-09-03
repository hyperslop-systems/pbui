import type { Condition } from "../actions/conditions";
import type { RuntimeTypeId, ScopeId } from "../actions/ids";
import type { SelectionSnapshot } from "../actions/types";
import type { SelectorMatch } from "../context/types";
import type { PresentationReference, PresentationValues } from "../types";

/**
 * Canonical typed relations (PBUI-KERNEL-1 §5.5–§5.6, §10).
 *
 * A relation is a named, typed, contextual PARTIAL function from one
 * presentation reference to another. It is the one semantic arrow that
 * acceptance ("may this click satisfy that request?"), facet derivation, and
 * persistent link derivation all read — each through its own EXPOSURE, so a
 * convenient acceptance conversion never silently becomes a persistent link
 * operator. Composition is finite, named, and explicit: PBUI never searches
 * for a path.
 */

/** Stable identity for a semantic arrow in the presentation system. */
export type RelationId = string;

/** The interpreters that may DISCOVER a relation (§10.1, C6). */
export type RelationInterpreter = "acceptance" | "facet" | "derivation";

/**
 * Which interpreters may discover this relation. Exposure controls discovery,
 * not execution: a public composition may run private steps that are not
 * independently offered anywhere. `derivation` requires the relation's
 * outputs to be serializable, because a `Derived` link term persists them.
 */
export interface RelationExposure {
  readonly acceptance?: boolean;
  readonly facet?: boolean;
  readonly derivation?: {
    readonly transport: "serializable";
  };
}

export interface RelationDeclarationBase {
  readonly id: RelationId;
  readonly label?: string;
  readonly description?: string;
  /** Empty or absent means that the relation is applicable in every active scope. */
  readonly scopes?: readonly ScopeId[];
  readonly when?: Condition;
  readonly priority?: number;
  /**
   * Required. `{}` declares a PRIVATE relation, legal only as a step of a
   * public composition; an unreferenced private relation is reported by
   * `diagnostics()`.
   */
  readonly exposure: RelationExposure;
}

/**
 * A directly implemented contextual partial function A ⇀ B. The codomain
 * `to` MAY be abstract (C8): a relation may promise `inspectable` and return
 * a concrete `customer`. Every actual output must be a declared CONCRETE
 * subtype of `to`; runtime references always carry a concrete type.
 */
export interface PresentationRelation<
  Values extends PresentationValues,
  ProductFacts,
> extends RelationDeclarationBase {
  readonly kind?: "direct";
  readonly from: RuntimeTypeId;
  readonly to: RuntimeTypeId;
  readonly match: "exact" | "subtypes";
  apply(
    reference: PresentationReference<Values>,
    snapshot: SelectionSnapshot<ProductFacts>,
  ): PresentationReference<Values> | undefined;
}

/**
 * An explicitly authorized composition. No implicit path search is performed:
 * only the named finite sequence exists as a public relation. Its `from`,
 * `to`, and source match discipline are inferred from its steps.
 */
export interface ComposedPresentationRelation extends RelationDeclarationBase {
  readonly kind: "composition";
  readonly steps: readonly RelationId[];
}

export type PresentationRelationDeclaration<
  Values extends PresentationValues,
  ProductFacts,
> = PresentationRelation<Values, ProductFacts> | ComposedPresentationRelation;

/** Validated executable relation, including endpoints inferred for compositions. */
export interface PreparedPresentationRelation<
  Values extends PresentationValues,
  ProductFacts,
> extends Omit<RelationDeclarationBase, "scopes" | "priority"> {
  readonly scopes: readonly ScopeId[];
  readonly priority: number;
  readonly kind: "direct" | "composition";
  readonly from: RuntimeTypeId;
  readonly to: RuntimeTypeId;
  readonly match: "exact" | "subtypes";
  readonly steps: readonly RelationId[];
  apply(
    reference: PresentationReference<Values>,
    snapshot: SelectionSnapshot<ProductFacts>,
  ): PresentationReference<Values> | undefined;
}

/** The static, serializable vocabulary projection of one relation (§15.1). */
export interface PresentationRelationDefinition {
  readonly id: RelationId;
  readonly kind: "direct" | "composition";
  readonly from: RuntimeTypeId;
  readonly to: RuntimeTypeId;
  readonly match: "exact" | "subtypes";
  readonly steps: readonly RelationId[];
  readonly scopes: readonly ScopeId[];
  readonly priority: number;
  readonly exposure: RelationExposure;
  readonly label?: string;
  readonly description?: string;
}

/** Advisory construction findings; structural errors throw instead (§15.2). */
export interface RelationDiagnostic {
  readonly code: "unreachable-private-relation";
  readonly relationId: RelationId;
  readonly detail: string;
}

export interface RelationDiscoveryOptions {
  /** Keep only relations whose codomain reaches one of these types. */
  readonly targets?: readonly RuntimeTypeId[];
  /** Keep only relations exposed to this interpreter. Absent: every relation. */
  readonly exposedTo?: RelationInterpreter;
}

export interface ApplicableRelation<
  Values extends PresentationValues,
  ProductFacts,
> {
  readonly relation: PreparedPresentationRelation<Values, ProductFacts>;
  readonly match: SelectorMatch;
}

export interface RelationMatch<
  Values extends PresentationValues,
  ProductFacts,
> extends ApplicableRelation<Values, ProductFacts> {
  readonly result: PresentationReference<Values>;
}

/**
 * The detailed outcome of one evaluation (§10.4). `empty`, `unavailable`, and
 * `error` are deliberately distinct: a contextual partial relation may be
 * empty under current facts; a failed selector is not a thrown callback; an
 * invalid output type is an implementation defect. `match` is the selector
 * provenance for the outcomes that reached the selector.
 */
export type RelationEvaluation<Values extends PresentationValues> =
  | {
      readonly kind: "value";
      readonly relationId: RelationId;
      readonly reference: PresentationReference<Values>;
      readonly match: SelectorMatch;
    }
  | {
      readonly kind: "empty";
      readonly relationId: RelationId;
      readonly match: SelectorMatch;
    }
  | {
      readonly kind: "unavailable";
      readonly relationId: RelationId;
      readonly code: string;
      readonly because: string;
    }
  | {
      readonly kind: "error";
      readonly relationId: RelationId;
      readonly code: "relation-threw" | "invalid-result-type";
      readonly because: string;
      readonly cause?: unknown;
    };
