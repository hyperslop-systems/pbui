import type { PredicateDefinition } from "../actions/conditions";
import type { ModeId, ScopeId } from "../actions/ids";
import type {
  ActionRegistry,
  RegistryDiagnostic,
} from "../actions/registry";
import type {
  PresentationTypeDefinition,
  PresentationTypeGraph,
} from "../actions/typeGraph";
import type {
  ActionContribution,
  SelectionSnapshot,
} from "../actions/types";
import type { ActionVocabulary } from "../actions/vocabulary";
import type { PredicateRegistry } from "../context/predicates";
import type { HelpRegistry } from "../help/registry";
import type { HelpContribution } from "../help/types";
import type { LinkDeps, LinkSnapshot } from "../links/snapshot";
import type { SerializableReference } from "../links/terms";
import type {
  PresentationRelationDeclaration,
  PresentationRelationDefinition,
} from "../relations/types";
import type { RelationSystem } from "../relations/system";
import type { PresentationDescriptorRegistry } from "../registry";
import type {
  AcceptRequest,
  PresentationDescriptorMap,
  PresentationReference,
  PresentationValues,
} from "../types";
import type {
  AcceptanceResolution,
  PresentationTranslator,
} from "../translators/types";

export interface SnapshotOptions {
  /** Active inner-to-outer scope stack; defaults to the declaration order. */
  readonly scopes?: Iterable<ScopeId>;
  readonly modes?: Iterable<ModeId>;
  readonly capabilities?: Iterable<string>;
  /** Explicit cache/revalidation token. */
  readonly revision?: string | number;
}

/** Nominal runtime marker; product fact records cannot collide with it by shape. */
export const SNAPSHOT_INPUT: unique symbol = Symbol.for(
  "@hyperslop-systems/pbui/presentation-snapshot-input",
);

export interface SnapshotInput<ProductFacts> {
  readonly [SNAPSHOT_INPUT]: true;
  readonly facts: ProductFacts;
  readonly options: SnapshotOptions;
}

export interface PresentationKernelDeclaration<
  Values extends PresentationValues,
  Environment,
  ProductFacts,
  Verb,
> {
  readonly types: readonly PresentationTypeDefinition[];
  readonly scopes: readonly ScopeId[];
  readonly predicates?: readonly PredicateDefinition<Values, ProductFacts>[];
  readonly descriptors: PresentationDescriptorMap<Values, Environment>;
  readonly actions: readonly ActionContribution<Values, ProductFacts, Verb>[];
  /** Canonical semantic arrows. */
  readonly relations?: readonly PresentationRelationDeclaration<
    Values,
    ProductFacts
  >[];
  /** Migration-only input; converted into direct relations. Do not provide both. */
  readonly translators?: readonly PresentationTranslator<Values, ProductFacts>[];
  readonly help?: readonly HelpContribution<Values, ProductFacts>[];
  /**
   * Product-defined semantic revision. Structural serialization is not a
   * default: state equality and invalidation identity are distinct contracts.
   */
  readonly revision?: (facts: Readonly<ProductFacts>) => string | number;
  readonly version?: string | number;
}

export type KernelDiagnostic =
  | {
      readonly code: "missing-descriptor";
      readonly type: string;
      readonly detail: string;
    }
  | {
      readonly code: "action-registry";
      readonly diagnostic: RegistryDiagnostic;
      readonly detail: string;
    };

export interface VocabularyHelpEntry {
  readonly id: string;
  readonly subject: string;
  readonly match: "exact" | "subtypes";
  readonly scopes: readonly string[];
  readonly priority: number;
}

export interface PresentationVocabulary extends ActionVocabulary {
  readonly relations: readonly PresentationRelationDefinition[];
  readonly help: readonly VocabularyHelpEntry[];
}

export interface LinkDependencyOptions<ProductFacts> {
  /** Project a link world into the presentation snapshot relations read. */
  readonly snapshotFor: (
    snapshot: LinkSnapshot,
  ) => SelectionSnapshot<ProductFacts>;
  readonly label?: (reference: SerializableReference) => string;
}

export interface PresentationKernel<
  Values extends PresentationValues,
  Environment,
  ProductFacts,
  Verb,
> {
  readonly version: string | number;
  readonly graph: PresentationTypeGraph;
  readonly scopes: readonly ScopeId[];
  readonly predicates: PredicateRegistry<Values, ProductFacts>;
  readonly descriptors: PresentationDescriptorRegistry<Values, Environment>;
  readonly actions: ActionRegistry<Values, ProductFacts, Verb>;
  readonly relations: RelationSystem<Values, ProductFacts>;
  readonly help: HelpRegistry<Values, ProductFacts> | null;
  snapshot(
    facts: ProductFacts,
    options?: SnapshotOptions,
  ): SelectionSnapshot<ProductFacts>;
  accept(
    request: AcceptRequest<Values>,
    reference: PresentationReference<Values>,
    snapshot: SelectionSnapshot<ProductFacts>,
  ): AcceptanceResolution<Values>;
  /** Bind the pure relation system to a link-world projection. */
  linkDeps(options: LinkDependencyOptions<ProductFacts>): LinkDeps;
  vocabulary(): PresentationVocabulary;
  diagnostics(): readonly KernelDiagnostic[];
}
