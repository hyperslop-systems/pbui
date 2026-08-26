import { evaluateCondition } from "../actions/conditions";
import type { ProductPredicate } from "../actions/conditions";
import type { PredicateId } from "../actions/ids";
import type { PresentationTypeGraph } from "../actions/typeGraph";
import type { SelectionSnapshot } from "../actions/types";
import type { AcceptRequest, PresentationReference, PresentationValues } from "../types";
import type {
  AcceptanceOption,
  AcceptanceResolution,
  PresentationTranslator,
} from "./types";

/**
 * One resolver for highlighting AND clicking (source guide §19.4): the accept
 * banner's `data-state="acceptable"` marking and the click that settles the
 * request must agree, so both call this function. A simplified highlight
 * check that ignored translator conditions or ambiguity would advertise
 * clicks that then do nothing.
 *
 * Sequence (§19.2): direct satisfaction first — the concrete type is an
 * accepted target or a graph subtype of one, and the ORIGINAL reference
 * settles the request; then direct translator edges (source, scope,
 * condition); then the request's filter over each candidate result; then
 * zero/one/many → none / accepted / explicit chooser. Ties inside "many" are
 * first reduced by nearest scope, then priority — the same ladder actions
 * use — and only genuine remainders reach the chooser.
 */
export function resolveAcceptance<Values extends PresentationValues, ProductFacts>(
  options: {
    graph: PresentationTypeGraph;
    translators: readonly PresentationTranslator<Values, ProductFacts>[];
    predicates: ReadonlyMap<PredicateId, ProductPredicate<Values, ProductFacts>>;
  },
  request: AcceptRequest<Values>,
  reference: PresentationReference<Values>,
  snapshot: SelectionSnapshot<ProductFacts>,
): AcceptanceResolution<Values> {
  const wanted = Array.isArray(request.types) ? request.types : [request.types];
  const passes = (candidate: PresentationReference<Values>) =>
    !request.filter || request.filter(candidate);

  // Direct: identity or subtype substitution, original reference preserved.
  for (const target of wanted) {
    if (reference.type === target || options.graph.isSubtype(reference.type, target)) {
      return passes(reference)
        ? { kind: "accepted", option: { translator: null, result: reference } }
        : { kind: "none" };
    }
  }

  const candidates: Array<AcceptanceOption<Values> & { scopeIndex: number; priority: number }> =
    [];
  for (const translator of options.translators) {
    if (!wanted.includes(translator.to as (typeof wanted)[number])) continue;
    const sourceMatches =
      translator.match === "exact"
        ? reference.type === translator.from
        : options.graph.isSubtype(reference.type, translator.from);
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
      const availability = evaluateCondition(translator.when, { subject: reference, snapshot }, options.predicates);
      if (availability.kind !== "available") continue;
    }
    const result = translator.translate(reference, snapshot);
    if (!result || !wanted.includes(result.type as (typeof wanted)[number])) continue;
    if (!passes(result)) continue;
    candidates.push({
      translator: translator.id,
      result,
      scopeIndex,
      priority: translator.priority ?? 0,
    });
  }

  if (candidates.length === 0) return { kind: "none" };
  let pool = candidates;
  if (pool.length > 1) {
    const nearest = Math.min(...pool.map((candidate) => candidate.scopeIndex));
    pool = pool.filter((candidate) => candidate.scopeIndex === nearest);
  }
  if (pool.length > 1) {
    const highest = Math.max(...pool.map((candidate) => candidate.priority));
    pool = pool.filter((candidate) => candidate.priority === highest);
  }
  if (pool.length === 1) {
    const single = pool[0] as (typeof pool)[number];
    return { kind: "accepted", option: { translator: single.translator, result: single.result } };
  }
  return {
    kind: "ambiguous",
    options: [...pool]
      .sort((a, b) => String(a.translator).localeCompare(String(b.translator)))
      .map(({ translator, result }) => ({ translator, result })),
  };
}
