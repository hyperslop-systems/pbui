import type { RuntimeTypeId, ScopeId } from "../actions/ids";
import type { PresentationTypeGraph } from "../actions/typeGraph";
import type { SelectionSnapshot } from "../actions/types";
import type { ContextMatch } from "../context/types";
import { matchSelector } from "../context/match";
import {
  createPredicateRegistry,
  validateConditionPredicates,
  type PredicateRegistry,
} from "../context/predicates";
import type { PredicateDefinition } from "../actions/conditions";
import type { PresentationReference, PresentationValues } from "../types";
import type {
  ApplicableRelation,
  ComposedPresentationRelation,
  PreparedPresentationRelation,
  PresentationRelationDeclaration,
  PresentationRelationDefinition,
  RelationEvaluation,
  RelationId,
  RelationMatch,
} from "./types";

export interface CreateRelationSystemOptions<
  Values extends PresentationValues,
  ProductFacts,
> {
  readonly graph: PresentationTypeGraph;
  readonly scopes: readonly ScopeId[];
  readonly predicates?: readonly PredicateDefinition<Values, ProductFacts>[];
  readonly predicateRegistry?: PredicateRegistry<Values, ProductFacts>;
  readonly relations: readonly PresentationRelationDeclaration<Values, ProductFacts>[];
  readonly version?: string | number;
  /** A kernel relation must declare a concrete result type. */
  readonly requireConcreteTargets?: boolean;
}

export interface RelationSystem<
  Values extends PresentationValues,
  ProductFacts,
> {
  readonly graph: PresentationTypeGraph;
  readonly scopes: readonly ScopeId[];
  readonly predicates: PredicateRegistry<Values, ProductFacts>;
  readonly version: string | number;
  has(id: RelationId): boolean;
  get(id: RelationId): PreparedPresentationRelation<Values, ProductFacts> | null;
  list(): readonly PreparedPresentationRelation<Values, ProductFacts>[];
  definitions(): readonly PresentationRelationDefinition[];
  applicable(
    reference: PresentationReference<Values>,
    snapshot: SelectionSnapshot<ProductFacts>,
    targets?: readonly RuntimeTypeId[],
  ): readonly ApplicableRelation<Values, ProductFacts>[];
  matches(
    reference: PresentationReference<Values>,
    snapshot: SelectionSnapshot<ProductFacts>,
    targets?: readonly RuntimeTypeId[],
  ): readonly RelationMatch<Values, ProductFacts>[];
  evaluate(
    id: RelationId,
    reference: PresentationReference<Values>,
    snapshot: SelectionSnapshot<ProductFacts>,
  ): RelationEvaluation<Values>;
  apply(
    id: RelationId,
    reference: PresentationReference<Values>,
    snapshot: SelectionSnapshot<ProductFacts>,
  ): PresentationReference<Values> | undefined;
}

function reaches(
  from: RuntimeTypeId,
  to: RuntimeTypeId,
  graph: PresentationTypeGraph,
): boolean {
  return from === to || graph.isSubtype(from, to);
}

/** Build and validate the canonical typed relation registry. */
export function createRelationSystem<
  Values extends PresentationValues,
  ProductFacts,
>(
  options: CreateRelationSystemOptions<Values, ProductFacts>,
): RelationSystem<Values, ProductFacts> {
  if (options.predicates && options.predicateRegistry) {
    throw new Error("createRelationSystem accepts predicates or predicateRegistry, not both");
  }
  const predicates =
    options.predicateRegistry ?? createPredicateRegistry(options.predicates);
  const scopes = [...options.scopes];
  const declaredScopes = new Set(scopes);
  const version = options.version ?? 1;
  const declarations = new Map<
    RelationId,
    PresentationRelationDeclaration<Values, ProductFacts>
  >();

  for (const declaration of options.relations) {
    if (declaration.id.length === 0) throw new Error("a relation has an empty id");
    if (declarations.has(declaration.id)) {
      throw new Error(`duplicate relation id "${declaration.id}"`);
    }
    if (
      declaration.priority !== undefined &&
      !Number.isFinite(declaration.priority)
    ) {
      throw new Error(`relation "${declaration.id}" has a non-finite priority`);
    }
    for (const scope of declaration.scopes ?? []) {
      if (!declaredScopes.has(scope)) {
        throw new Error(
          `relation "${declaration.id}" names unknown scope "${scope}"`,
        );
      }
    }
    validateConditionPredicates(
      `relation "${declaration.id}"`,
      declaration.when,
      predicates,
    );
    if (declaration.kind !== "composition") {
      if (!options.graph.has(declaration.from)) {
        throw new Error(
          `relation "${declaration.id}" names unknown source type "${declaration.from}"`,
        );
      }
      if (!options.graph.has(declaration.to)) {
        throw new Error(
          `relation "${declaration.id}" names unknown target type "${declaration.to}"`,
        );
      }
      if (
        options.requireConcreteTargets &&
        options.graph.isAbstract(declaration.to)
      ) {
        throw new Error(
          `relation "${declaration.id}" targets abstract type "${declaration.to}"`,
        );
      }
    } else if (declaration.steps.length === 0) {
      throw new Error(
        `composed relation "${declaration.id}" declares no steps`,
      );
    }
    declarations.set(declaration.id, declaration);
  }

  const prepared = new Map<
    RelationId,
    PreparedPresentationRelation<Values, ProductFacts>
  >();
  const state = new Map<RelationId, "visiting" | "done">();

  function prepare(
    id: RelationId,
    path: readonly RelationId[],
  ): PreparedPresentationRelation<Values, ProductFacts> {
    const cached = prepared.get(id);
    if (cached) return cached;
    const declaration = declarations.get(id);
    if (!declaration) {
      throw new Error(`composition names unknown relation "${id}"`);
    }
    if (state.get(id) === "visiting") {
      throw new Error(
        `relation composition cycle: ${[...path, id].join(" -> ")}`,
      );
    }
    state.set(id, "visiting");

    let relation: PreparedPresentationRelation<Values, ProductFacts>;
    if (declaration.kind !== "composition") {
      relation = {
        ...declaration,
        kind: "direct",
        steps: [],
        scopes: declaration.scopes ?? [],
        priority: declaration.priority ?? 0,
      };
    } else {
      const composition: ComposedPresentationRelation = declaration;
      const steps = composition.steps.map((step) =>
        prepare(step, [...path, id]),
      );
      for (let index = 1; index < steps.length; index += 1) {
        const previous = steps[index - 1] as PreparedPresentationRelation<
          Values,
          ProductFacts
        >;
        const next = steps[index] as PreparedPresentationRelation<
          Values,
          ProductFacts
        >;
        const compatible =
          next.match === "exact"
            ? previous.to === next.from
            : reaches(previous.to, next.from, options.graph);
        if (!compatible) {
          throw new Error(
            `composed relation "${id}" cannot connect "${previous.id}" ` +
              `(<${previous.to}>) to "${next.id}" (<${next.from}>)`,
          );
        }
      }
      const first = steps[0] as PreparedPresentationRelation<
        Values,
        ProductFacts
      >;
      const last = steps[steps.length - 1] as PreparedPresentationRelation<
        Values,
        ProductFacts
      >;
      if (
        options.requireConcreteTargets &&
        options.graph.isAbstract(last.to)
      ) {
        throw new Error(`relation "${id}" ends at abstract type "${last.to}"`);
      }
      relation = {
        ...composition,
        kind: "composition",
        from: first.from,
        to: last.to,
        match: first.match,
        steps: [...composition.steps],
        scopes: composition.scopes ?? [],
        priority: composition.priority ?? 0,
        apply(reference, snapshot) {
          let current: PresentationReference<Values> | undefined = reference;
          for (const step of steps) {
            if (!current) return undefined;
            const applicability = matchSelector(
              {
                subject: step.from,
                match: step.match,
                scopes: step.scopes,
                ...(step.when ? { when: step.when } : {}),
                priority: step.priority,
              },
              current,
              snapshot,
              options.graph,
              predicates,
            );
            if (applicability.kind !== "matched") return undefined;
            current = step.apply(current, snapshot);
            if (current && !reaches(current.type, step.to, options.graph)) {
              return undefined;
            }
          }
          return current;
        },
      };
    }

    prepared.set(id, relation);
    state.set(id, "done");
    return relation;
  }

  for (const id of declarations.keys()) prepare(id, []);
  const ordered = options.relations.map(
    ({ id }) =>
      prepared.get(id) as PreparedPresentationRelation<Values, ProductFacts>,
  );

  function applicabilityOf(
    relation: PreparedPresentationRelation<Values, ProductFacts>,
    reference: PresentationReference<Values>,
    snapshot: SelectionSnapshot<ProductFacts>,
  ) {
    return matchSelector(
      {
        subject: relation.from,
        match: relation.match,
        scopes: relation.scopes,
        ...(relation.when ? { when: relation.when } : {}),
        priority: relation.priority,
      },
      reference,
      snapshot,
      options.graph,
      predicates,
    );
  }

  function targetMatches(
    relation: PreparedPresentationRelation<Values, ProductFacts>,
    targets: readonly RuntimeTypeId[] | undefined,
  ): boolean {
    return (
      !targets ||
      targets.length === 0 ||
      targets.some((target) => reaches(relation.to, target, options.graph))
    );
  }

  function applicable(
    reference: PresentationReference<Values>,
    snapshot: SelectionSnapshot<ProductFacts>,
    targets?: readonly RuntimeTypeId[],
  ): readonly ApplicableRelation<Values, ProductFacts>[] {
    const found: ApplicableRelation<Values, ProductFacts>[] = [];
    for (const relation of ordered) {
      if (!targetMatches(relation, targets)) continue;
      const result = applicabilityOf(relation, reference, snapshot);
      if (result.kind === "matched") {
        found.push({ relation, match: result.match });
      }
    }
    return found;
  }

  function execute(
    relation: PreparedPresentationRelation<Values, ProductFacts>,
    reference: PresentationReference<Values>,
    snapshot: SelectionSnapshot<ProductFacts>,
    match: ContextMatch,
  ): RelationEvaluation<Values> {
    let output: PresentationReference<Values> | undefined;
    try {
      output = relation.apply(reference, snapshot);
    } catch (cause) {
      return {
        kind: "error",
        relationId: relation.id,
        code: "relation-threw",
        because: `relation "${relation.id}" threw while evaluating`,
        cause,
      };
    }
    if (!output) {
      return { kind: "empty", relationId: relation.id, match };
    }
    if (
      !options.graph.has(output.type) ||
      !reaches(output.type, relation.to, options.graph)
    ) {
      return {
        kind: "error",
        relationId: relation.id,
        code: "invalid-result-type",
        because:
          `relation "${relation.id}" declares <${relation.to}> but produced ` +
          `<${String(output.type)}>`,
      };
    }
    return {
      kind: "value",
      relationId: relation.id,
      reference: output,
      match,
    };
  }

  function evaluate(
    id: RelationId,
    reference: PresentationReference<Values>,
    snapshot: SelectionSnapshot<ProductFacts>,
  ): RelationEvaluation<Values> {
    const relation = prepared.get(id);
    if (!relation) {
      return {
        kind: "unavailable",
        relationId: id,
        code: "relation-missing",
        because: `no relation called ${id}`,
      };
    }
    const applicability = applicabilityOf(relation, reference, snapshot);
    if (applicability.kind !== "matched") {
      return {
        kind: "unavailable",
        relationId: id,
        code: applicability.stage,
        because: applicability.reason,
      };
    }
    return execute(relation, reference, snapshot, applicability.match);
  }

  return {
    graph: options.graph,
    scopes,
    predicates,
    version,
    has: (id) => prepared.has(id),
    get: (id) => prepared.get(id) ?? null,
    list: () => ordered,
    definitions: () =>
      ordered.map((relation) => ({
        id: relation.id,
        kind: relation.kind,
        from: relation.from,
        to: relation.to,
        match: relation.match,
        steps: [...relation.steps],
        scopes: [...(relation.scopes ?? [])],
        priority: relation.priority,
        ...(relation.label !== undefined ? { label: relation.label } : {}),
        ...(relation.description !== undefined
          ? { description: relation.description }
          : {}),
      })),
    applicable,
    matches(reference, snapshot, targets) {
      const found: RelationMatch<Values, ProductFacts>[] = [];
      for (const candidate of applicable(reference, snapshot, targets)) {
        const result = execute(
          candidate.relation,
          reference,
          snapshot,
          candidate.match,
        );
        if (result.kind === "value") {
          found.push({ ...candidate, result: result.reference });
        }
      }
      return found;
    },
    evaluate,
    apply(id, reference, snapshot) {
      const result = evaluate(id, reference, snapshot);
      return result.kind === "value" ? result.reference : undefined;
    },
  };
}
