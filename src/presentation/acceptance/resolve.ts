import type { RuntimeTypeId } from "../actions/ids";
import type { SelectionSnapshot } from "../actions/types";
import type { RelationSystem } from "../relations/system";
import type { AcceptRequest, PresentationReference, PresentationValues } from "../types";
import type { AcceptanceOption, AcceptanceResolution } from "./types";

export interface AcceptanceResolverOptions<Values extends PresentationValues, ProductFacts> {
  readonly relations: RelationSystem<Values, ProductFacts>;
}

interface RankedOption<Values extends PresentationValues> extends AcceptanceOption<Values> {
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
    return { kind: "accepted", option: { relation: single.relation, result: single.result } };
  }
  return {
    kind: "ambiguous",
    // Stable display order by relation id: never declaration order.
    options: pool
      .sort((a, b) => String(a.relation).localeCompare(String(b.relation)))
      .map(({ relation, result }) => ({ relation, result })),
  };
}

/**
 * Resolve acceptance through direct subtyping first, then the
 * acceptance-exposed canonical relations (PBUI-KERNEL-1 §11.3). Pure.
 */
export function resolveAcceptance<Values extends PresentationValues, ProductFacts>(
  options: AcceptanceResolverOptions<Values, ProductFacts>,
  request: AcceptRequest<Values>,
  reference: PresentationReference<Values>,
  snapshot: SelectionSnapshot<ProductFacts>,
): AcceptanceResolution<Values> {
  const { graph } = options.relations;
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
      ? { kind: "accepted", option: { relation: null, result: reference } }
      : { kind: "none" };
  }

  const candidates: RankedOption<Values>[] = [];
  // Only acceptance-exposed relations whose declared codomain reaches a wanted
  // type are discovered; discovery happens before any relation runs (C6).
  for (const candidate of options.relations.matches(reference, snapshot, {
    targets: wanted,
    exposedTo: "acceptance",
  })) {
    // The concrete output must still reach a wanted type (an abstract codomain
    // may promise more than one concrete result), and pass the request filter.
    if (!reachesWanted(candidate.result.type) || !passes(candidate.result)) continue;
    candidates.push({
      relation: candidate.relation.id,
      result: candidate.result,
      // A scope-universal relation makes no nearness claim: it ranks behind
      // any relation that matched an active scope.
      scopeIndex: candidate.match.scopeIndex ?? Number.POSITIVE_INFINITY,
      priority: candidate.match.priority,
    });
  }
  return finish(candidates);
}
