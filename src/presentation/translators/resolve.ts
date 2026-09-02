import { evaluateCondition } from "../actions/conditions";
import type { ProductPredicate } from "../actions/conditions";
import type { PredicateId, RuntimeTypeId } from "../actions/ids";
import type { PresentationTypeGraph } from "../actions/typeGraph";
import type { SelectionSnapshot } from "../actions/types";
import type { RelationSystem } from "../relations/system";
import type {
  AcceptRequest,
  PresentationReference,
  PresentationValues,
} from "../types";
import type {
  AcceptanceOption,
  AcceptanceResolution,
  PresentationTranslator,
} from "./types";

export interface TranslatorAcceptanceOptions<
  Values extends PresentationValues,
  ProductFacts,
> {
  readonly graph: PresentationTypeGraph;
  readonly translators: readonly PresentationTranslator<Values, ProductFacts>[];
  readonly predicates: ReadonlyMap<
    PredicateId,
    ProductPredicate<Values, ProductFacts>
  >;
}

export interface RelationAcceptanceOptions<
  Values extends PresentationValues,
  ProductFacts,
> {
  readonly relations: RelationSystem<Values, ProductFacts>;
}

export type AcceptanceResolverOptions<
  Values extends PresentationValues,
  ProductFacts,
> =
  | TranslatorAcceptanceOptions<Values, ProductFacts>
  | RelationAcceptanceOptions<Values, ProductFacts>;

interface RankedOption<Values extends PresentationValues>
  extends AcceptanceOption<Values> {
  readonly scopeIndex: number;
  readonly priority: number;
}

function finish<Values extends PresentationValues>(
  candidates: readonly RankedOption<Values>[],
): AcceptanceResolution<Values> {
  if (candidates.length === 0) return { kind: "none" };
  let pool = [...candidates];
  if (pool.length > 1) {
    const nearest = Math.min(...pool.map((candidate) => candidate.scopeIndex));
    pool = pool.filter((candidate) => candidate.scopeIndex === nearest);
  }
  if (pool.length > 1) {
    const highest = Math.max(...pool.map((candidate) => candidate.priority));
    pool = pool.filter((candidate) => candidate.priority === highest);
  }
  if (pool.length === 1) {
    const single = pool[0] as RankedOption<Values>;
    return {
      kind: "accepted",
      option: { translator: single.translator, result: single.result },
    };
  }
  return {
    kind: "ambiguous",
    options: pool
      .sort((a, b) => String(a.translator).localeCompare(String(b.translator)))
      .map(({ translator, result }) => ({ translator, result })),
  };
}

/**
 * Resolve acceptance through direct subtyping first, then canonical typed
 * relations. The graph + translator tuple remains as a migration facade.
 */
export function resolveAcceptance<
  Values extends PresentationValues,
  ProductFacts,
>(
  options: AcceptanceResolverOptions<Values, ProductFacts>,
  request: AcceptRequest<Values>,
  reference: PresentationReference<Values>,
  snapshot: SelectionSnapshot<ProductFacts>,
): AcceptanceResolution<Values> {
  const graph = "relations" in options ? options.relations.graph : options.graph;
  const wanted = (Array.isArray(request.types)
    ? request.types
    : [request.types]) as readonly RuntimeTypeId[];
  const reachesWanted = (type: RuntimeTypeId) =>
    wanted.some((target) => type === target || graph.isSubtype(type, target));
  const passes = (candidate: PresentationReference<Values>) =>
    !request.filter || request.filter(candidate);

  // Subtyping is substitutability, never conversion: preserve the reference.
  if (reachesWanted(reference.type)) {
    return passes(reference)
      ? { kind: "accepted", option: { translator: null, result: reference } }
      : { kind: "none" };
  }

  const candidates: RankedOption<Values>[] = [];
  if ("relations" in options) {
    for (const candidate of options.relations.matches(
      reference,
      snapshot,
      wanted,
    )) {
      if (!reachesWanted(candidate.result.type) || !passes(candidate.result)) {
        continue;
      }
      candidates.push({
        translator: candidate.relation.id,
        result: candidate.result,
        // A scope-universal relation makes no nearness claim: it ranks behind
        // any relation that matched an active scope (design doc §11.3).
        scopeIndex: candidate.match.scopeIndex ?? Number.POSITIVE_INFINITY,
        priority: candidate.match.priority,
      });
    }
    return finish(candidates);
  }

  for (const translator of options.translators) {
    if (!reachesWanted(translator.to)) continue;
    const sourceMatches =
      translator.match === "exact"
        ? reference.type === translator.from
        : graph.isSubtype(reference.type, translator.from);
    if (!sourceMatches) continue;

    let scopeIndex = 0;
    if (translator.scopes && translator.scopes.length > 0) {
      const indices = translator.scopes
        .map((scope) => snapshot.scopes.indexOf(scope))
        .filter((index) => index >= 0);
      if (indices.length === 0) continue;
      scopeIndex = Math.min(...indices);
    }
    if (translator.when) {
      const status = evaluateCondition(
        translator.when,
        { subject: reference, snapshot },
        options.predicates,
      );
      if (status.kind !== "available") continue;
    }
    const result = translator.translate(reference, snapshot);
    if (!result || !reachesWanted(result.type) || !passes(result)) continue;
    candidates.push({
      translator: translator.id,
      result,
      scopeIndex,
      priority: translator.priority ?? 0,
    });
  }

  return finish(candidates);
}
