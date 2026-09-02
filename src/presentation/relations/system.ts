import type { RuntimeTypeId, ScopeId } from "../actions/ids";
import type { PresentationTypeGraph } from "../actions/typeGraph";
import type { SelectionSnapshot } from "../actions/types";
import type { SelectorMatch } from "../context/types";
import { matchSelector, selectorOf } from "../context/selector";
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
  RelationDiagnostic,
  RelationDiscoveryOptions,
  RelationEvaluation,
  RelationExposure,
  RelationId,
  RelationInterpreter,
  RelationMatch,
} from "./types";

/**
 * The canonical relation system (PBUI-KERNEL-1 §10): validate, prepare,
 * discover, evaluate, compose. Pure; no React.
 *
 * Construction is fail-fast on STRUCTURE — duplicate or empty ids, unknown
 * source/target types, unknown scopes or predicates, non-finite priorities,
 * empty or cyclic compositions, incompatible composition endpoints, missing
 * exposure. Advisory findings (a private relation no composition references)
 * are returned by `diagnostics()`.
 *
 * Discovery is filtered by interpreter EXPOSURE before any relation runs
 * (C6): acceptance sees only acceptance-exposed relations, link palettes only
 * derivation-exposed ones. Exposure never gates execution — a public
 * composition runs its private steps.
 */

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
  /** Every prepared relation in declaration order, public and private. */
  list(): readonly PreparedPresentationRelation<Values, ProductFacts>[];
  /** The relations one interpreter may discover, in declaration order. */
  exposed(
    interpreter: RelationInterpreter,
  ): readonly PreparedPresentationRelation<Values, ProductFacts>[];
  definitions(): readonly PresentationRelationDefinition[];
  diagnostics(): readonly RelationDiagnostic[];
  applicable(
    reference: PresentationReference<Values>,
    snapshot: SelectionSnapshot<ProductFacts>,
    options?: RelationDiscoveryOptions,
  ): readonly ApplicableRelation<Values, ProductFacts>[];
  matches(
    reference: PresentationReference<Values>,
    snapshot: SelectionSnapshot<ProductFacts>,
    options?: RelationDiscoveryOptions,
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

export function isExposedTo(exposure: RelationExposure, interpreter: RelationInterpreter): boolean {
  switch (interpreter) {
    case "acceptance":
      return exposure.acceptance === true;
    case "facet":
      return exposure.facet === true;
    case "derivation":
      return exposure.derivation !== undefined;
  }
}

function hasAnyExposure(exposure: RelationExposure): boolean {
  return (
    exposure.acceptance === true ||
    exposure.facet === true ||
    exposure.derivation !== undefined
  );
}

function normalizeExposure(id: RelationId, exposure: RelationExposure | undefined): RelationExposure {
  if (exposure === undefined || exposure === null || typeof exposure !== "object") {
    throw new Error(
      `relation "${id}" declares no exposure — every relation must say which ` +
        `interpreters may discover it (exposure: {} for a private composition step)`,
    );
  }
  if (exposure.derivation !== undefined && exposure.derivation.transport !== "serializable") {
    throw new Error(
      `relation "${id}" exposes derivation without the serializable transport contract`,
    );
  }
  return {
    ...(exposure.acceptance === true ? { acceptance: true } : {}),
    ...(exposure.facet === true ? { facet: true } : {}),
    ...(exposure.derivation !== undefined
      ? { derivation: { transport: "serializable" as const } }
      : {}),
  };
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
  const exposures = new Map<RelationId, RelationExposure>();

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
    exposures.set(declaration.id, normalizeExposure(declaration.id, declaration.exposure));
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
      // An abstract codomain is legal (C8); abstract OUTPUTS are rejected at
      // evaluation, where the concrete type is known.
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
  /** Relations named as a step by at least one composition. */
  const referenced = new Set<RelationId>();

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
    const exposure = exposures.get(id) as RelationExposure;

    let relation: PreparedPresentationRelation<Values, ProductFacts>;
    if (declaration.kind !== "composition") {
      relation = {
        ...declaration,
        kind: "direct",
        steps: [],
        scopes: declaration.scopes ?? [],
        priority: declaration.priority ?? 0,
        exposure,
      };
    } else {
      const composition: ComposedPresentationRelation = declaration;
      const steps = composition.steps.map((step) => {
        referenced.add(step);
        return prepare(step, [...path, id]);
      });
      for (let index = 1; index < steps.length; index += 1) {
        const previous = steps[index - 1] as PreparedPresentationRelation<
          Values,
          ProductFacts
        >;
        const next = steps[index] as PreparedPresentationRelation<
          Values,
          ProductFacts
        >;
        // Every value the previous step promises must be admissible to the
        // next step's source: an exact next step needs the exact type; a
        // subtypes next step needs the promised codomain to reach its source.
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
      relation = {
        ...composition,
        kind: "composition",
        from: first.from,
        to: last.to,
        match: first.match,
        steps: [...composition.steps],
        scopes: composition.scopes ?? [],
        priority: composition.priority ?? 0,
        exposure,
        apply(reference, snapshot) {
          let current: PresentationReference<Values> | undefined = reference;
          for (const step of steps) {
            if (!current) return undefined;
            // Each step's own selector gates its execution (§10.6); the
            // composition's selector gated discovery.
            const applicability = matchSelector(
              selectorOf({
                subject: step.from,
                match: step.match,
                scopes: step.scopes,
                ...(step.when ? { when: step.when } : {}),
                priority: step.priority,
              }),
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
      selectorOf({
        subject: relation.from,
        match: relation.match,
        scopes: relation.scopes,
        ...(relation.when ? { when: relation.when } : {}),
        priority: relation.priority,
      }),
      reference,
      snapshot,
      options.graph,
      predicates,
    );
  }

  const staticDiagnostics: RelationDiagnostic[] = ordered
    .filter((relation) => !hasAnyExposure(relation.exposure) && !referenced.has(relation.id))
    .map((relation) => ({
      code: "unreachable-private-relation",
      relationId: relation.id,
      detail:
        `relation "${relation.id}" exposes nothing and no composition names it as a step; ` +
        `no interpreter can ever discover or run it`,
    }));

  function discoverable(
    relation: PreparedPresentationRelation<Values, ProductFacts>,
    discovery: RelationDiscoveryOptions | undefined,
  ): boolean {
    if (discovery?.exposedTo !== undefined && !isExposedTo(relation.exposure, discovery.exposedTo)) {
      return false;
    }
    const targets = discovery?.targets;
    return (
      !targets ||
      targets.length === 0 ||
      targets.some((target) => reaches(relation.to, target, options.graph))
    );
  }

  function applicable(
    reference: PresentationReference<Values>,
    snapshot: SelectionSnapshot<ProductFacts>,
    discovery?: RelationDiscoveryOptions,
  ): readonly ApplicableRelation<Values, ProductFacts>[] {
    const found: ApplicableRelation<Values, ProductFacts>[] = [];
    for (const relation of ordered) {
      if (!discoverable(relation, discovery)) continue;
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
    match: SelectorMatch,
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
    const outputType = output.type as RuntimeTypeId;
    if (!options.graph.has(outputType)) {
      return {
        kind: "error",
        relationId: relation.id,
        code: "invalid-result-type",
        because: `relation "${relation.id}" produced undeclared type <${String(outputType)}>`,
      };
    }
    if (options.graph.isAbstract(outputType)) {
      return {
        kind: "error",
        relationId: relation.id,
        code: "invalid-result-type",
        because:
          `relation "${relation.id}" produced abstract type <${outputType}>; ` +
          `runtime references must carry a concrete type`,
      };
    }
    if (!reaches(outputType, relation.to, options.graph)) {
      return {
        kind: "error",
        relationId: relation.id,
        code: "invalid-result-type",
        because:
          `relation "${relation.id}" declares <${relation.to}> but produced <${outputType}>`,
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
    exposed: (interpreter) =>
      ordered.filter((relation) => isExposedTo(relation.exposure, interpreter)),
    definitions: () =>
      ordered.map((relation) => ({
        id: relation.id,
        kind: relation.kind,
        from: relation.from,
        to: relation.to,
        match: relation.match,
        steps: [...relation.steps],
        scopes: [...relation.scopes],
        priority: relation.priority,
        exposure: relation.exposure,
        ...(relation.label !== undefined ? { label: relation.label } : {}),
        ...(relation.description !== undefined
          ? { description: relation.description }
          : {}),
      })),
    diagnostics: () => staticDiagnostics,
    applicable,
    matches(reference, snapshot, discovery) {
      const found: RelationMatch<Values, ProductFacts>[] = [];
      for (const candidate of applicable(reference, snapshot, discovery)) {
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
