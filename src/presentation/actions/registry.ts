import type { PresentationValues } from "../types";
import type { PredicateDefinition } from "./conditions";
import type { ActionQuery, SelectionSnapshot } from "./types";
import type {
  ActionContribution,
  ResolutionResult,
} from "./types";
import type { RuntimeTypeId, ScopeId } from "./ids";
import { resolveActions } from "./resolve";
import { vocabularyOf } from "./vocabulary";
import type { ActionVocabulary } from "./vocabulary";
import type { PreparedRegistry } from "./resolve";
import type { PresentationTypeGraph } from "./typeGraph";
import { createPredicateRegistry, validateConditionPredicates } from "../context/predicates";
import type { PredicateRegistry } from "../context/predicates";
import { isAnyDeclaredType } from "../context/types";

/**
 * The action registry (PBUI-ACTIONS-2, source guide §13).
 *
 * Construction is fail-fast: duplicate ids, unknown types/scopes/predicates,
 * malformed metadata, and GUARANTEED collisions (two unconditional static
 * declarations that must tie in overlapping scopes at equal priority) throw
 * immediately. Query-dependent conflicts that cannot be proven at
 * registration (families, opaque testers) surface as non-fatal
 * `diagnostics()`; resolution remains authoritative and returns ambiguity
 * rather than guessing.
 */

export interface RegistryDiagnostic {
  code: "potential-conflict" | "family-overlap" | "opaque-tester";
  contributionIds: readonly string[];
  detail: string;
}

export interface ReachableContribution {
  contributionId: string;
  kind: "rule" | "family";
  action?: string;
  /** null: a universal (any-declared-type) family. */
  declaredType: RuntimeTypeId | null;
  distance: number;
}

export interface ActionRegistry<Values extends PresentationValues, ProductFacts, Verb> {
  readonly version: string | number;
  readonly graph: PresentationTypeGraph;
  resolve(
    query: ActionQuery<Values>,
    snapshot: SelectionSnapshot<ProductFacts>,
  ): ResolutionResult<Values, Verb>;
  /** Same selection path as resolve; exists for tooling symmetry. */
  explain(
    query: ActionQuery<Values>,
    snapshot: SelectionSnapshot<ProductFacts>,
  ): ResolutionResult<Values, Verb>;
  listReachable(
    type: RuntimeTypeId,
    scopes: readonly ScopeId[],
  ): readonly ReachableContribution[];
  diagnostics(): readonly RegistryDiagnostic[];
  /**
   * The agent-facing vocabulary generated from this registry's graph and
   * contributions (PBUI-ACTIONS-3 B2): serializable, snapshot-free, suitable
   * for a build-step export with a golden JSON test. See vocabulary.ts for
   * what is deliberately absent (verbs, dynamic labels, family instances).
   */
  vocabulary(): ActionVocabulary;
}

export interface CreateActionRegistryOptions<
  Values extends PresentationValues,
  ProductFacts,
  Verb,
> {
  graph: PresentationTypeGraph;
  /** Every scope any contribution may declare; unknown scopes throw. */
  scopes: readonly ScopeId[];
  predicates?: readonly PredicateDefinition<Values, ProductFacts>[];
  /** A prebuilt table supplied by PresentationKernel. Do not combine with predicates. */
  predicateRegistry?: PredicateRegistry<Values, ProductFacts>;
  contributions: readonly ActionContribution<Values, ProductFacts, Verb>[];
  version?: string | number;
}

export function createActionRegistry<Values extends PresentationValues, ProductFacts, Verb>(
  options: CreateActionRegistryOptions<Values, ProductFacts, Verb>,
): ActionRegistry<Values, ProductFacts, Verb> {
  const { graph, contributions } = options;
  const declaredScopes = new Set(options.scopes);
  const version = options.version ?? 1;

  if (options.predicates && options.predicateRegistry) {
    throw new Error("createActionRegistry accepts predicates or predicateRegistry, not both");
  }
  const predicates =
    options.predicateRegistry ?? createPredicateRegistry(options.predicates);

  const contributionIds = new Set<string>();
  for (const contribution of contributions) {
    if (contributionIds.has(contribution.id)) {
      throw new Error(`duplicate contribution id "${contribution.id}"`);
    }
    contributionIds.add(contribution.id);

    if (contribution.kind === "family" && contribution.id.includes("/")) {
      throw new Error(
        `family id "${contribution.id}" contains "/" — reserved as the candidate-id separator`,
      );
    }
    if (contribution.scopes.length === 0) {
      throw new Error(`contribution "${contribution.id}" declares no scopes`);
    }
    for (const scope of contribution.scopes) {
      if (!declaredScopes.has(scope)) {
        throw new Error(
          `contribution "${contribution.id}" names unknown scope "${scope}" — ` +
            `declare it in createActionRegistry({scopes})`,
        );
      }
    }
    if (isAnyDeclaredType(contribution.subject)) {
      if (contribution.kind !== "family") {
        throw new Error(
          `only families may target anyDeclaredType (contribution "${contribution.id}")`,
        );
      }
    } else if (!graph.has(contribution.subject)) {
      throw new Error(
        `contribution "${contribution.id}" targets type "${contribution.subject}" ` +
          `which is not in the type graph — declare the type first`,
      );
    }
    if (
      contribution.priority !== undefined &&
      !Number.isFinite(contribution.priority)
    ) {
      throw new Error(`contribution "${contribution.id}" has a non-finite priority`);
    }
    if (contribution.kind === "rule") {
      if (contribution.action.length === 0) {
        throw new Error(`rule "${contribution.id}" has an empty action id`);
      }
      if (contribution.action === contribution.id) {
        throw new Error(
          `rule "${contribution.id}" reuses its rule id as its action id — ` +
            `a rule names a declaration, an action names the conceptual operation`,
        );
      }
      if (
        contribution.metadata.order !== undefined &&
        !Number.isFinite(contribution.metadata.order)
      ) {
        throw new Error(`rule "${contribution.id}" has a non-finite menu order`);
      }
      validateConditionPredicates(
        `rule "${contribution.id}"`,
        contribution.when,
        predicates,
      );
    }
  }

  // Guaranteed collisions: two unconditional static rules for one action and
  // one subject, in overlapping scopes, at equal priority, MUST tie at
  // resolution — reject the registry instead of shipping a latent ambiguity.
  const rules = contributions.filter((entry) => entry.kind === "rule");
  for (let i = 0; i < rules.length; i += 1) {
    for (let j = i + 1; j < rules.length; j += 1) {
      const a = rules[i] as Extract<(typeof rules)[number], { kind: "rule" }>;
      const b = rules[j] as Extract<(typeof rules)[number], { kind: "rule" }>;
      if (a.action !== b.action || a.subject !== b.subject) continue;
      if ((a.priority ?? 0) !== (b.priority ?? 0)) continue;
      if (a.when || a.test || b.when || b.test) continue;
      const overlap = a.scopes.filter((scope) => b.scopes.includes(scope));
      if (overlap.length === 0) continue;
      throw new Error(
        `rules "${a.id}" and "${b.id}" are guaranteed to collide: same action ` +
          `"${a.action}", same subject "${String(a.subject)}", overlapping scope ` +
          `"${overlap[0]}", equal priority, and no condition to separate them`,
      );
    }
  }

  const prepared: PreparedRegistry<Values, ProductFacts, Verb> = {
    graph,
    contributions,
    predicates,
    version,
  };

  function diagnostics(): readonly RegistryDiagnostic[] {
    const found: RegistryDiagnostic[] = [];
    for (let i = 0; i < rules.length; i += 1) {
      for (let j = i + 1; j < rules.length; j += 1) {
        const a = rules[i] as Extract<(typeof rules)[number], { kind: "rule" }>;
        const b = rules[j] as Extract<(typeof rules)[number], { kind: "rule" }>;
        if (a.action !== b.action || a.subject !== b.subject) continue;
        if ((a.priority ?? 0) !== (b.priority ?? 0)) continue;
        if (a.scopes.every((scope) => !b.scopes.includes(scope))) continue;
        // Not a guaranteed collision (construction would have thrown), so at
        // least one side is conditional: it may or may not tie per query.
        found.push({
          code: "potential-conflict",
          contributionIds: [a.id, b.id],
          detail:
            `"${a.id}" and "${b.id}" implement action "${a.action}" on ` +
            `"${String(a.subject)}" at equal priority in overlapping scopes; ` +
            `whether they tie depends on their conditions per query`,
        });
      }
      const rule = rules[i] as Extract<(typeof rules)[number], { kind: "rule" }>;
      if (rule.test) {
        found.push({
          code: "opaque-tester",
          contributionIds: [rule.id],
          detail: `"${rule.id}" uses an opaque test(); static conflict analysis is limited`,
        });
      }
    }
    return found;
  }

  function listReachable(
    type: RuntimeTypeId,
    scopes: readonly ScopeId[],
  ): readonly ReachableContribution[] {
    const distances = new Map(graph.ancestors(type).map((entry) => [entry.type, entry.distance]));
    const out: ReachableContribution[] = [];
    for (const contribution of contributions) {
      let distance: number;
      if (isAnyDeclaredType(contribution.subject)) distance = 0;
      else if (contribution.match === "exact") {
        if (contribution.subject !== type) continue;
        distance = 0;
      } else {
        const found = distances.get(contribution.subject);
        if (found === undefined) continue;
        distance = found;
      }
      if (!contribution.scopes.some((scope) => scopes.includes(scope))) continue;
      out.push({
        contributionId: contribution.id,
        kind: contribution.kind,
        ...(contribution.kind === "rule" ? { action: contribution.action } : {}),
        declaredType: isAnyDeclaredType(contribution.subject) ? null : contribution.subject,
        distance,
      });
    }
    return out;
  }

  return {
    version,
    graph,
    resolve: (query, snapshot) => resolveActions(prepared, query, snapshot),
    explain: (query, snapshot) => resolveActions(prepared, query, snapshot),
    listReachable,
    diagnostics,
    vocabulary: () => vocabularyOf(graph, contributions, version),
  };
}
