import type { PredicateDefinition } from "../actions/conditions";
import type { ScopeId } from "../actions/ids";
import type { PresentationTypeGraph } from "../actions/typeGraph";
import type { SelectionSnapshot } from "../actions/types";
import type { PresentationReference, PresentationValues } from "../types";
import { resolveHelp } from "./resolve";
import type { PreparedHelpRegistry } from "./resolve";
import type { HelpContribution, HelpDiagnostic, HelpResolution } from "./types";
import { createPredicateRegistry, validateConditionPredicates } from "../context/predicates";
import type { PredicateRegistry } from "../context/predicates";

/**
 * The help registry (design doc §11). Construction is fail-fast in the same
 * spirit as the action registry: duplicate rule ids, unknown subject types,
 * empty or unknown scopes, non-finite priorities, and unknown predicate
 * references throw immediately. It needs none of the action registry's
 * collision analysis — help rules never compete, so two rules on one subject
 * are composition, not a conflict.
 */

export interface HelpRegistry<Values extends PresentationValues, ProductFacts> {
  readonly version: string | number;
  resolve(
    subject: PresentationReference<Values>,
    snapshot: SelectionSnapshot<ProductFacts>,
  ): HelpResolution;
  /** Reserved for non-fatal authoring signals; empty in v1. */
  diagnostics(): readonly HelpDiagnostic[];
}

export interface CreateHelpRegistryOptions<Values extends PresentationValues, ProductFacts> {
  graph: PresentationTypeGraph;
  /** Every scope any rule may declare; unknown scopes throw. */
  scopes: readonly ScopeId[];
  predicates?: readonly PredicateDefinition<Values, ProductFacts>[];
  /** A prebuilt table supplied by PresentationKernel. Do not combine with predicates. */
  predicateRegistry?: PredicateRegistry<Values, ProductFacts>;
  contributions: readonly HelpContribution<Values, ProductFacts>[];
  version?: string | number;
}

export function createHelpRegistry<Values extends PresentationValues, ProductFacts>(
  options: CreateHelpRegistryOptions<Values, ProductFacts>,
): HelpRegistry<Values, ProductFacts> {
  const { graph, contributions } = options;
  const declaredScopes = new Set(options.scopes);
  const version = options.version ?? 1;

  if (options.predicates && options.predicateRegistry) {
    throw new Error("createHelpRegistry accepts predicates or predicateRegistry, not both");
  }
  const predicates =
    options.predicateRegistry ?? createPredicateRegistry(options.predicates);

  const ruleIds = new Set<string>();
  for (const rule of contributions) {
    if (ruleIds.has(rule.id)) {
      throw new Error(`duplicate help rule id "${rule.id}"`);
    }
    ruleIds.add(rule.id);

    if (rule.scopes.length === 0) {
      throw new Error(`help rule "${rule.id}" declares no scopes`);
    }
    for (const scope of rule.scopes) {
      if (!declaredScopes.has(scope)) {
        throw new Error(
          `help rule "${rule.id}" names unknown scope "${scope}" — ` +
            `declare it in createHelpRegistry({scopes})`,
        );
      }
    }
    // No wildcard rules in the first release (§11): every rule targets a
    // declared type. Unlike the action registry there is no legacy "*" path.
    if (!graph.has(rule.subject)) {
      throw new Error(
        `help rule "${rule.id}" targets type "${rule.subject}" which is not in ` +
          `the type graph — declare the type first`,
      );
    }
    if (rule.priority !== undefined && !Number.isFinite(rule.priority)) {
      throw new Error(`help rule "${rule.id}" has a non-finite priority`);
    }
    validateConditionPredicates(
      `help rule "${rule.id}"`,
      rule.when,
      predicates,
    );
  }

  const prepared: PreparedHelpRegistry<Values, ProductFacts> = {
    graph,
    contributions,
    predicates,
    version,
  };

  return {
    version,
    resolve: (subject, snapshot) => resolveHelp(prepared, subject, snapshot),
    diagnostics: () => [],
  };
}
