import type { PredicateDefinition } from "../actions/conditions";
import type { ScopeId } from "../actions/ids";
import { createActionRegistry } from "../actions/registry";
import { createPresentationTypeGraph } from "../actions/typeGraph";
import type { PresentationTypeDefinition } from "../actions/typeGraph";
import type { ActionContribution, SelectionSnapshot } from "../actions/types";
import { createPredicateRegistry } from "../context/predicates";
import { createHelpRegistry } from "../help/registry";
import type { HelpContribution } from "../help/types";
import { isSerializableReference } from "../links/terms";
import type { LinkDeps } from "../links/snapshot";
import { createRelationSystem } from "../relations/system";
import type { PresentationRelationDeclaration } from "../relations/types";
import { createPresentationRegistry } from "../registry";
import { resolveAcceptance } from "../translators/resolve";
import type {
  PresentationDescriptorMap,
  PresentationReference,
  PresentationValues,
} from "../types";
import type { ModelDiagnostic } from "./diagnostics";
import type {
  CompiledPresentation,
  PresentationContextInput,
  PresentationDeclaration,
  PresentationFragment,
} from "./types";
import { vocabularyOfModel } from "./vocabulary";

/**
 * The compiler (PBUI-KERNEL-1 §7.2, §8.1, §15): merge the root declaration
 * and its included fragments with origin tracking, validate every structural
 * rule with fragment-aware messages, and construct the sibling interpreters
 * over one graph and one predicate registry.
 *
 * Structural errors THROW; nothing partial is ever returned. Advisory
 * findings are collected once and returned by `diagnostics()`.
 */

type OriginKind = "type" | "action" | "relation" | "help" | "predicate";

interface Merged<Values extends PresentationValues, Environment, ProductFacts, Verb> {
  readonly fragments: readonly string[];
  readonly types: readonly PresentationTypeDefinition[];
  readonly knownScopes: readonly ScopeId[];
  readonly predicates: readonly PredicateDefinition<Values, ProductFacts>[];
  readonly descriptors: PresentationDescriptorMap<Values, Environment>;
  readonly actions: readonly ActionContribution<Values, ProductFacts, Verb>[];
  readonly relations: readonly PresentationRelationDeclaration<Values, ProductFacts>[];
  readonly help: readonly HelpContribution<Values, ProductFacts>[];
  readonly origins: ReadonlyMap<string, string>;
  readonly emptyFragments: readonly string[];
}

function originKey(kind: OriginKind, id: string): string {
  return `${kind}:${id}`;
}

function mergeFragments<Values extends PresentationValues, Environment, ProductFacts, Verb>(
  declaration: PresentationDeclaration<Values, Environment, ProductFacts, Verb>,
): Merged<Values, Environment, ProductFacts, Verb> {
  const ordered: readonly PresentationFragment<Values, Environment, ProductFacts, Verb>[] = [
    ...(declaration.include ?? []),
    declaration,
  ];
  const fragmentIds = new Set<string>();
  const origins = new Map<string, string>();
  const types: PresentationTypeDefinition[] = [];
  const knownScopes: ScopeId[] = [];
  const predicates: PredicateDefinition<Values, ProductFacts>[] = [];
  const descriptors: Record<string, unknown> = {};
  const actions: ActionContribution<Values, ProductFacts, Verb>[] = [];
  const relations: PresentationRelationDeclaration<Values, ProductFacts>[] = [];
  const help: HelpContribution<Values, ProductFacts>[] = [];
  const emptyFragments: string[] = [];

  function claim(kind: OriginKind, id: string, fragmentId: string, what: string): void {
    const key = originKey(kind, id);
    const previous = origins.get(key);
    if (previous !== undefined) {
      throw new Error(
        `${what} "${id}" is declared by both fragment "${previous}" and fragment "${fragmentId}"`,
      );
    }
    origins.set(key, fragmentId);
  }

  for (const fragment of ordered) {
    if (typeof fragment.id !== "string" || fragment.id.length === 0) {
      throw new Error("a presentation fragment has an empty id");
    }
    if (fragmentIds.has(fragment.id)) {
      throw new Error(`duplicate presentation fragment id "${fragment.id}"`);
    }
    fragmentIds.add(fragment.id);

    let contributed = 0;
    for (const type of fragment.types ?? []) {
      claim("type", type.id, fragment.id, "runtime type");
      types.push(type);
      contributed += 1;
    }
    for (const scope of fragment.knownScopes ?? []) {
      // Identical known scopes are deduplicated across fragments; first
      // declaration order is preserved (§7.2).
      if (!knownScopes.includes(scope)) knownScopes.push(scope);
    }
    for (const predicate of fragment.predicates ?? []) {
      claim("predicate", predicate.id, fragment.id, "predicate");
      predicates.push(predicate);
      contributed += 1;
    }
    for (const [type, descriptor] of Object.entries(fragment.descriptors ?? {})) {
      if (descriptor === undefined) continue;
      if (Object.hasOwn(descriptors, type)) {
        throw new Error(
          `descriptor for type "${type}" is declared by fragment "${fragment.id}" ` +
            `but another fragment already declared one — descriptors do not merge`,
        );
      }
      descriptors[type] = descriptor;
      contributed += 1;
    }
    for (const contribution of fragment.actions ?? []) {
      claim("action", contribution.id, fragment.id, "action contribution");
      actions.push(contribution);
      contributed += 1;
    }
    for (const relation of fragment.relations ?? []) {
      claim("relation", relation.id, fragment.id, "relation");
      relations.push(relation);
      contributed += 1;
    }
    for (const rule of fragment.help ?? []) {
      claim("help", rule.id, fragment.id, "help rule");
      help.push(rule);
      contributed += 1;
    }
    if (contributed === 0 && fragment !== declaration) emptyFragments.push(fragment.id);
  }

  return {
    fragments: ordered.map((fragment) => fragment.id),
    types,
    knownScopes,
    predicates,
    descriptors: descriptors as PresentationDescriptorMap<Values, Environment>,
    actions,
    relations,
    help,
    origins,
    emptyFragments,
  };
}

function checkedRevision(value: string | number | undefined): string | number {
  if (value === undefined) {
    throw new Error(
      "presentation context has no semantic revision — pass input.revision or declare " +
        "revision(facts) on the presentation (PBUI-KERNEL-1 C4)",
    );
  }
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new Error("presentation revision must be a string or a finite number");
  }
  if (typeof value !== "number" && typeof value !== "string") {
    throw new Error("presentation revision must be a string or a finite number");
  }
  return value;
}

/** Construct the complete presentation semantics from one declaration. */
export function compilePresentation<
  Values extends PresentationValues,
  Environment,
  ProductFacts,
  Verb,
>(
  declaration: PresentationDeclaration<Values, Environment, ProductFacts, Verb>,
): CompiledPresentation<Values, Environment, ProductFacts, Verb> {
  const merged = mergeFragments(declaration);
  const version = declaration.version ?? 1;
  const knownScopes = [...merged.knownScopes];
  if (knownScopes.length === 0) {
    throw new Error(
      `presentation "${declaration.id}" declares no known scopes — every contribution ` +
        `names a scope, so at least one fragment must declare knownScopes`,
    );
  }
  const knownScopeSet = new Set(knownScopes);

  const defaultActiveScopes = declaration.defaultActiveScopes
    ? [...declaration.defaultActiveScopes]
    : null;
  if (defaultActiveScopes) validateActiveScopes(defaultActiveScopes, knownScopeSet, "defaultActiveScopes");

  const graph = createPresentationTypeGraph(merged.types);
  const predicates = createPredicateRegistry(merged.predicates);
  const descriptors = createPresentationRegistry(merged.descriptors);
  const actions = createActionRegistry<Values, ProductFacts, Verb>({
    graph,
    scopes: knownScopes,
    predicateRegistry: predicates,
    contributions: merged.actions,
    version,
  });
  const help =
    merged.help.length > 0
      ? createHelpRegistry<Values, ProductFacts>({
          graph,
          scopes: knownScopes,
          predicateRegistry: predicates,
          contributions: merged.help,
          version,
        })
      : null;
  const relations = createRelationSystem<Values, ProductFacts>({
    graph,
    scopes: knownScopes,
    predicateRegistry: predicates,
    relations: merged.relations,
    version,
  });

  /* closed-world cross validation ---------------------------------------- */

  for (const type of Object.keys(merged.descriptors)) {
    if (!graph.has(type)) {
      throw new Error(
        `descriptor for type "${type}" has no node in the presentation type graph — ` +
          `declare the type in the fragment that owns the descriptor`,
      );
    }
    if (graph.isAbstract(type)) {
      throw new Error(
        `descriptor for abstract type "${type}" — abstract types never appear as runtime ` +
          `references and take no descriptor`,
      );
    }
  }
  const advisory: ModelDiagnostic[] = [];
  const strict = declaration.strictDescriptors ?? true;
  for (const type of graph.types()) {
    if (graph.isAbstract(type) || descriptors.has(type)) continue;
    const message =
      `concrete type "${type}" has no descriptor; labels would use the JSON fallback`;
    if (strict) {
      throw new Error(`${message} (declare one, or set strictDescriptors: false in a test fixture)`);
    }
    advisory.push({
      severity: "warning",
      code: "missing-descriptor",
      message,
      ownerId: type,
      ...(originOf("type", type) ? { fragmentId: originOf("type", type) as string } : {}),
    });
  }

  function originOf(kind: OriginKind, id: string): string | null {
    return merged.origins.get(originKey(kind, id)) ?? null;
  }

  /* advisory diagnostics -------------------------------------------------- */

  for (const diagnostic of actions.diagnostics()) {
    const owner = diagnostic.contributionIds[0];
    advisory.push({
      severity: "warning",
      code: diagnostic.code,
      message: diagnostic.detail,
      ...(owner !== undefined ? { ownerId: owner } : {}),
      ...(owner !== undefined && originOf("action", owner)
        ? { fragmentId: originOf("action", owner) as string }
        : {}),
      path: `actions.${diagnostic.contributionIds.join("+")}`,
    });
  }
  for (const diagnostic of relations.diagnostics()) {
    advisory.push({
      severity: "warning",
      code: diagnostic.code,
      message: diagnostic.detail,
      ownerId: diagnostic.relationId,
      ...(originOf("relation", diagnostic.relationId)
        ? { fragmentId: originOf("relation", diagnostic.relationId) as string }
        : {}),
      path: `relations.${diagnostic.relationId}`,
    });
  }
  for (const fragmentId of merged.emptyFragments) {
    advisory.push({
      severity: "warning",
      code: "empty-fragment",
      message: `fragment "${fragmentId}" is included but contributes nothing`,
      fragmentId,
    });
  }

  /* snapshot -------------------------------------------------------------- */

  function snapshot(input: PresentationContextInput<ProductFacts>): SelectionSnapshot<ProductFacts> {
    if (typeof input !== "object" || input === null || !("facts" in input)) {
      throw new Error("presentation.snapshot expects a context input with a facts field");
    }
    const revision = checkedRevision(input.revision ?? declaration.revision?.(input.facts));
    const active = input.activeScopes ?? defaultActiveScopes;
    if (!active) {
      throw new Error(
        "presentation context has no active scopes — pass input.activeScopes or declare " +
          "defaultActiveScopes on the presentation (PBUI-KERNEL-1 C3)",
      );
    }
    const activeScopes = [...active];
    validateActiveScopes(activeScopes, knownScopeSet, "activeScopes");
    return {
      revision,
      scopes: activeScopes,
      modes: new Set(input.modes ?? []),
      capabilities: new Set(input.capabilities ?? []),
      product: input.facts,
    };
  }

  /* link projection (§12.1) ---------------------------------------------- */

  function linkDeps(options: Parameters<CompiledPresentation<Values, Environment, ProductFacts, Verb>["linkDeps"]>[0]): LinkDeps {
    return {
      graph,
      // Only derivation-exposed relations enter link palettes (C6).
      relations: relations.exposed("derivation").map((relation) => ({
        id: relation.id,
        from: relation.from,
        to: relation.to,
        match: relation.match,
        ...(relation.label ? { label: relation.label } : {}),
      })),
      relationEvaluation: (id, reference, linkSnapshot) => {
        const relationSnapshot = snapshot(options.contextFor(linkSnapshot));
        const result = relations.evaluate(
          id,
          reference as PresentationReference<Values>,
          relationSnapshot,
        );
        if (result.kind === "empty") return { kind: "empty" };
        if (result.kind === "value") {
          if (!isSerializableReference(result.reference)) {
            return {
              kind: "error",
              diagnostic: {
                code: "relation-result-not-serializable",
                message: `relation ${id} produced a non-serializable presentation reference`,
              },
            };
          }
          return { kind: "value", reference: result.reference };
        }
        return { kind: "error", diagnostic: { code: result.code, message: result.because } };
      },
      ...(options.label ? { label: options.label } : {}),
    };
  }

  return {
    id: declaration.id,
    version,
    graph,
    knownScopes,
    defaultActiveScopes,
    predicates,
    descriptors,
    actions,
    relations,
    help,
    fragments: merged.fragments,
    originOf,
    snapshot,
    accept: (request, reference, current) =>
      resolveAcceptance({ relations }, request, reference, current),
    linkDeps,
    vocabulary: () =>
      vocabularyOfModel({ version, actions, relations, help: merged.help, fragments: merged.fragments, originOf }),
    diagnostics: () => advisory,
  };
}

function validateActiveScopes(
  scopes: readonly ScopeId[],
  known: ReadonlySet<ScopeId>,
  what: string,
): void {
  const seen = new Set<ScopeId>();
  for (const scope of scopes) {
    if (!known.has(scope)) {
      throw new Error(`${what} names undeclared scope "${scope}" — declare it in knownScopes`);
    }
    if (seen.has(scope)) {
      throw new Error(`${what} repeats active scope "${scope}"`);
    }
    seen.add(scope);
  }
}
