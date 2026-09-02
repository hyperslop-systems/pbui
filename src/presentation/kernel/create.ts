import { createActionRegistry } from "../actions/registry";
import { createPresentationTypeGraph } from "../actions/typeGraph";
import { createPredicateRegistry } from "../context/predicates";
import { createHelpRegistry } from "../help/registry";
import { isSerializableReference } from "../links/terms";
import { relationFromTranslator } from "../relations/adapters";
import { createRelationSystem } from "../relations/system";
import { createPresentationRegistry } from "../registry";
import { resolveAcceptance } from "../translators/resolve";
import type { PresentationReference, PresentationValues } from "../types";
import type {
  KernelDiagnostic,
  PresentationKernel,
  PresentationKernelDeclaration,
  PresentationVocabulary,
  SnapshotOptions,
  VocabularyHelpEntry,
} from "./types";

function checkedRevision(value: string | number | undefined): string | number {
  if (value === undefined) {
    throw new Error(
      "presentation snapshot has no revision - provide declaration.revision(facts) " +
        "or snapshot(..., { revision })",
    );
  }
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new Error("presentation snapshot revision must be a finite number or string");
  }
  return value;
}

/** Construct the complete presentation semantics from one declaration. */
export function createPresentationKernel<
  Values extends PresentationValues,
  Environment,
  ProductFacts,
  Verb,
>(
  declaration: PresentationKernelDeclaration<
    Values,
    Environment,
    ProductFacts,
    Verb
  >,
): PresentationKernel<Values, Environment, ProductFacts, Verb> {
  const version = declaration.version ?? 1;
  const scopes = [...declaration.scopes];
  if (scopes.length === 0) {
    throw new Error("a presentation kernel must declare at least one scope");
  }
  const seenScopes = new Set<string>();
  for (const scope of scopes) {
    if (seenScopes.has(scope)) {
      throw new Error(`duplicate presentation scope "${scope}"`);
    }
    seenScopes.add(scope);
  }
  if (declaration.relations && declaration.translators) {
    throw new Error(
      "createPresentationKernel accepts relations or translators, not both",
    );
  }

  const graph = createPresentationTypeGraph(declaration.types);
  const predicates = createPredicateRegistry(declaration.predicates);
  const descriptors = createPresentationRegistry(declaration.descriptors);
  const actions = createActionRegistry({
    graph,
    scopes,
    predicateRegistry: predicates,
    contributions: declaration.actions,
    version,
  });
  const help = declaration.help
    ? createHelpRegistry({
        graph,
        scopes,
        predicateRegistry: predicates,
        contributions: declaration.help,
        version,
      })
    : null;
  const relationDeclarations =
    declaration.relations ??
    (declaration.translators ?? []).map(relationFromTranslator);
  const relations = createRelationSystem({
    graph,
    scopes,
    predicateRegistry: predicates,
    relations: relationDeclarations,
    version,
    requireConcreteTargets: true,
  });

  for (const type of Object.keys(declaration.descriptors)) {
    if (!graph.has(type)) {
      throw new Error(
        `descriptor for type "${type}" has no node in the presentation type graph`,
      );
    }
  }

  const staticDiagnostics: KernelDiagnostic[] = [];
  for (const type of graph.types()) {
    if (!graph.isAbstract(type) && !descriptors.has(type)) {
      staticDiagnostics.push({
        code: "missing-descriptor",
        type,
        detail:
          `concrete type "${type}" has no descriptor; labels use the JSON fallback`,
      });
    }
  }

  function snapshot(
    facts: ProductFacts,
    options: SnapshotOptions = {},
  ) {
    const activeScopes = [...(options.scopes ?? scopes)];
    const activeSeen = new Set<string>();
    for (const scope of activeScopes) {
      if (!seenScopes.has(scope)) {
        throw new Error(
          `presentation snapshot names undeclared scope "${scope}"`,
        );
      }
      if (activeSeen.has(scope)) {
        throw new Error(
          `presentation snapshot repeats active scope "${scope}"`,
        );
      }
      activeSeen.add(scope);
    }
    return {
      revision: checkedRevision(
        options.revision ?? declaration.revision?.(facts),
      ),
      scopes: activeScopes,
      modes: new Set(options.modes ?? []),
      capabilities: new Set(options.capabilities ?? []),
      product: facts,
    };
  }

  const helpVocabulary: readonly VocabularyHelpEntry[] = (
    declaration.help ?? []
  ).map((rule) => ({
    id: rule.id,
    subject: rule.subject,
    match: rule.match,
    scopes: [...rule.scopes],
    priority: rule.priority ?? 0,
  }));

  function vocabulary(): PresentationVocabulary {
    return {
      ...actions.vocabulary(),
      relations: relations.definitions(),
      help: helpVocabulary,
    };
  }

  return {
    version,
    graph,
    scopes,
    predicates,
    descriptors,
    actions,
    relations,
    help,
    snapshot,
    accept: (request, reference, current) =>
      resolveAcceptance({ relations }, request, reference, current),
    linkDeps(options) {
      return {
        graph,
        relations: relations.definitions().map((relation) => ({
          id: relation.id,
          from: relation.from,
          to: relation.to,
          match: relation.match,
          ...(relation.label ? { label: relation.label } : {}),
        })),
        relationEvaluation: (id, reference, linkSnapshot) => {
          const relationSnapshot = options.snapshotFor(linkSnapshot);
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
          return {
            kind: "error",
            diagnostic: {
              code: result.code,
              message: result.because,
            },
          };
        },
        ...(options.label ? { label: options.label } : {}),
      };
    },
    vocabulary,
    diagnostics: () => [
      ...staticDiagnostics,
      ...actions.diagnostics().map(
        (diagnostic): KernelDiagnostic => ({
          code: "action-registry",
          diagnostic,
          detail: diagnostic.detail,
        }),
      ),
    ],
  };
}
