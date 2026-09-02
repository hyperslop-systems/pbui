import type { Condition } from "../actions/conditions";
import type { RuntimeTypeId, ScopeId } from "../actions/ids";
import type { SelectionSnapshot } from "../actions/types";
import type { SelectorMatch } from "../context/types";
import type { PresentationReference, PresentationValues } from "../types";

/** Stable identity for a semantic arrow in the presentation system. */
export type RelationId = string;

export interface RelationDeclarationBase {
  readonly id: RelationId;
  readonly label?: string;
  readonly description?: string;
  /** Empty or absent means that the relation is applicable in every active scope. */
  readonly scopes?: readonly ScopeId[];
  readonly when?: Condition;
  readonly priority?: number;
}

/** A directly implemented contextual partial function A ⇀ B. */
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
 * only the named finite sequence exists as a public relation.
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

export interface PresentationRelationDefinition {
  readonly id: RelationId;
  readonly kind: "direct" | "composition";
  readonly from: RuntimeTypeId;
  readonly to: RuntimeTypeId;
  readonly match: "exact" | "subtypes";
  readonly steps: readonly RelationId[];
  readonly scopes: readonly ScopeId[];
  readonly priority: number;
  readonly label?: string;
  readonly description?: string;
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
