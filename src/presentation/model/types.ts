import type { PredicateDefinition } from "../actions/conditions";
import type { ModeId, RuntimeTypeId, ScopeId } from "../actions/ids";
import type { ActionRegistry } from "../actions/registry";
import type { PresentationTypeDefinition, PresentationTypeGraph } from "../actions/typeGraph";
import type { ActionContribution, SelectionSnapshot } from "../actions/types";
import type { VocabularyActionEntry, VocabularyTypeEntry } from "../actions/vocabulary";
import type { PredicateRegistry } from "../context/predicates";
import type { SelectorSubject } from "../context/types";
import type { HelpRegistry } from "../help/registry";
import type { HelpContribution } from "../help/types";
import type { LinkDeps, LinkSnapshot } from "../links/snapshot";
import type { SerializableReference } from "../links/terms";
import type { RelationSystem } from "../relations/system";
import type {
  PresentationRelationDeclaration,
  PresentationRelationDefinition,
} from "../relations/types";
import type { PresentationDescriptorRegistry } from "../registry";
import type { AcceptanceResolution } from "../acceptance/types";
import type {
  AcceptRequest,
  PresentationDescriptorMap,
  PresentationReference,
  PresentationValues,
} from "../types";
import type { ModelDiagnostic } from "./diagnostics";

/**
 * The compiled presentation model (PBUI-KERNEL-1 §6–§8, §15).
 *
 * A product declares its presentation semantics ONCE: the finite type
 * universe, known scopes, default active scopes, predicates, descriptors,
 * action rules, relations, help rules, and revision policy — as one root
 * declaration that includes reusable named FRAGMENTS. `compilePresentation`
 * merges them, validates every structural rule with fragment-aware
 * diagnostics, and constructs one graph, one predicate registry, one action
 * registry, one relation system, one optional help registry, and one
 * descriptor registry. Actions, help, acceptance, and links stay sibling
 * interpreters over those shared assets.
 */

/**
 * A reusable, atomic contribution to a product's presentation semantics: a
 * shared package exports one fragment (types + descriptors + actions +
 * relations + help + known scopes + predicates) so a product cannot include
 * its actions and forget its type declarations (§1.2 item 6, §7.2).
 */
export interface PresentationFragment<
  Values extends PresentationValues,
  Environment,
  ProductFacts,
  Verb,
> {
  readonly id: string;
  readonly types?: readonly PresentationTypeDefinition[];
  /** Every scope identifier declarations in this fragment may name. */
  readonly knownScopes?: readonly ScopeId[];
  readonly predicates?: readonly PredicateDefinition<Values, ProductFacts>[];
  readonly descriptors?: PresentationDescriptorMap<Values, Environment>;
  readonly actions?: readonly ActionContribution<Values, ProductFacts, Verb>[];
  readonly relations?: readonly PresentationRelationDeclaration<Values, ProductFacts>[];
  readonly help?: readonly HelpContribution<Values, ProductFacts>[];
}

/** The product root: a fragment plus runtime defaults and included fragments. */
export interface PresentationDeclaration<
  Values extends PresentationValues,
  Environment,
  ProductFacts,
  Verb,
> extends PresentationFragment<Values, Environment, ProductFacts, Verb> {
  readonly include?: readonly PresentationFragment<Values, Environment, ProductFacts, Verb>[];
  /**
   * The active inner-to-outer scope stack used when a context input gives
   * none. Product convenience, not declaration vocabulary: `knownScopes`
   * lists what declarations may name; this is what is active by default.
   */
  readonly defaultActiveScopes?: readonly ScopeId[];
  /**
   * Product-defined semantic revision (C4): a token that changes exactly
   * when resolution-relevant facts change. PBUI never serializes facts.
   */
  readonly revision?: (facts: Readonly<ProductFacts>) => string | number;
  readonly version?: string | number;
  /**
   * Strict descriptor completeness (§15.2): every concrete type must have a
   * descriptor, else compilation throws. Default true; a test fixture may
   * set false to receive `missing-descriptor` warnings instead.
   */
  readonly strictDescriptors?: boolean;
}

/**
 * The one explicit runtime context shape (§8.1, C3/C4). `facts` is the
 * product's immutable query-relevant state; everything else is optional and
 * resolved against the declaration's defaults by `model.snapshot`.
 */
export interface PresentationContextInput<ProductFacts> {
  readonly facts: ProductFacts;
  readonly revision?: string | number;
  readonly activeScopes?: readonly ScopeId[];
  readonly modes?: Iterable<ModeId>;
  readonly capabilities?: Iterable<string>;
}

/* ------------------------------------------------------------- vocabulary -- */

export interface VocabularyFragmentEntry {
  readonly id: string;
  readonly types: number;
  readonly actions: number;
  readonly relations: number;
  readonly help: number;
}

export interface VocabularyHelpRuleEntry {
  readonly id: string;
  readonly subject: SelectorSubject;
  readonly scopes: readonly ScopeId[];
  readonly priority: number;
  readonly fragment: string;
}

/**
 * The static, JSON-serializable projection of the whole declaration (§15.1).
 * It names what is declared, never runtime values, verbs, family instances,
 * dynamic labels, or dynamically emitted help kinds.
 */
export interface PresentationVocabulary {
  readonly version: string | number;
  readonly types: readonly (VocabularyTypeEntry & { readonly fragment: string })[];
  readonly actions: readonly (VocabularyActionEntry & { readonly fragment: string })[];
  readonly relations: readonly (PresentationRelationDefinition & { readonly fragment: string })[];
  readonly help: readonly VocabularyHelpRuleEntry[];
  readonly fragments: readonly VocabularyFragmentEntry[];
}

/* -------------------------------------------------------------- link deps -- */

/**
 * How a link world becomes a presentation context (§12.1–§12.2, C10). The
 * product is the only layer that can project document/runtime topology into
 * the facts, scopes, modes, capabilities, and revision a relation reads.
 */
export interface LinkDependencyOptions<ProductFacts> {
  contextFor(linkSnapshot: LinkSnapshot): PresentationContextInput<ProductFacts>;
  label?(reference: SerializableReference): string;
}

/* ---------------------------------------------------------- the model ----- */

export interface CompiledPresentation<
  Values extends PresentationValues,
  Environment,
  ProductFacts,
  Verb,
> {
  readonly id: string;
  readonly version: string | number;
  readonly graph: PresentationTypeGraph;
  /** Every scope any declaration may name, first-declaration order. */
  readonly knownScopes: readonly ScopeId[];
  readonly defaultActiveScopes: readonly ScopeId[] | null;
  readonly predicates: PredicateRegistry<Values, ProductFacts>;
  readonly descriptors: PresentationDescriptorRegistry<Values, Environment>;
  readonly actions: ActionRegistry<Values, ProductFacts, Verb>;
  readonly relations: RelationSystem<Values, ProductFacts>;
  readonly help: HelpRegistry<Values, ProductFacts> | null;
  /** Fragment ids in merge order (included fragments first, then the root). */
  readonly fragments: readonly string[];
  /** The fragment that declared a type, action, relation, help rule, or predicate. */
  originOf(kind: "type" | "action" | "relation" | "help" | "predicate", id: string): string | null;
  /** Validate and materialize one runtime context (§8.1). */
  snapshot(input: PresentationContextInput<ProductFacts>): SelectionSnapshot<ProductFacts>;
  accept(
    request: AcceptRequest<Values>,
    reference: PresentationReference<Values>,
    snapshot: SelectionSnapshot<ProductFacts>,
  ): AcceptanceResolution<Values>;
  /** Project the model onto the narrow link-kernel dependencies (§11.5, §12.1). */
  linkDeps(options: LinkDependencyOptions<ProductFacts>): LinkDeps;
  vocabulary(): PresentationVocabulary;
  diagnostics(): readonly ModelDiagnostic[];
}

export type { RuntimeTypeId };
