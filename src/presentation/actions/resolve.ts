import { matchSelector, requireScoped, selectorOf } from "../context/selector";
import { isAnyDeclaredType } from "../context/types";
import type { PresentationValues } from "../types";
import { available } from "./availability";
import type { Availability } from "./availability";
import { evaluateCondition } from "./conditions";
import type { ProductPredicate } from "./conditions";
import { candidateId as makeCandidateId } from "./ids";
import type { ActionId, CandidateId, PredicateId, RuntimeTypeId, ScopeId } from "./ids";
import type { PresentationTypeGraph } from "./typeGraph";
import type {
  ActionContribution,
  ActionFamily,
  ActionMetadata,
  ActionQuery,
  InheritedRuleContext,
  ResolutionResult,
  ResolutionTraceEntry,
  ResolvedAction,
  SelectionAmbiguity,
  SelectionSnapshot,
} from "./types";

/**
 * The pure resolver (PBUI-ACTIONS-2, source guide §15).
 *
 * One call, one query, one snapshot, one deterministic result. The precedence
 * ladder within one action id is: smallest type distance → nearest active
 * scope → highest explicit priority → AMBIGUITY RETURNED AS DATA, nothing
 * selected. Registration order, import order, array order, labels, and menu
 * order are never tie-breakers — a permutation test enforces it.
 *
 * Status evaluation happens BEFORE the action partition because the two
 * absences differ: `inapplicable` leaves the competition (a generic fallback
 * may win), `hidden` stays in it (a winning hidden rule suppresses the
 * fallback and emits no row). Binding runs only for the uniquely selected
 * available candidate; unavailable and hidden candidates never carry verbs.
 *
 * The trace is emitted by the same branches that select — there is no second
 * debug resolver. Type-unreachable contributions produce no trace entries
 * (a menu on one type would otherwise trace every rule of every other type);
 * everything after a type match is traced.
 */

export interface PreparedRegistry<Values extends PresentationValues, ProductFacts, Verb> {
  graph: PresentationTypeGraph;
  contributions: readonly ActionContribution<Values, ProductFacts, Verb>[];
  predicates: ReadonlyMap<PredicateId, ProductPredicate<Values, ProductFacts>>;
  version: string | number;
}

interface Candidate<Values extends PresentationValues, ProductFacts, Verb> {
  candidateId: CandidateId;
  contributionId: string;
  action: ActionId;
  status: Availability;
  metadata: ActionMetadata<Values, ProductFacts>;
  bind(context: InheritedRuleContext<Values, ProductFacts>): Verb;
  declaredType: RuntimeTypeId;
  distance: number;
  scope: ScopeId;
  scopeIndex: number;
  priority: number;
}

export function resolveActions<Values extends PresentationValues, ProductFacts, Verb>(
  prepared: PreparedRegistry<Values, ProductFacts, Verb>,
  query: ActionQuery<Values>,
  snapshot: SelectionSnapshot<ProductFacts>,
): ResolutionResult<Values, Verb> {
  const trace: ResolutionTraceEntry[] = [];
  const subjectType = query.subject.type as RuntimeTypeId;
  const context: InheritedRuleContext<Values, ProductFacts> = {
    subject: query.subject,
    snapshot,
  };

  /* [1..7] collect, scope-filter, expand, evaluate ------------------------- */

  const candidates: Candidate<Values, ProductFacts, Verb>[] = [];

  for (const contribution of prepared.contributions) {
    /*
     * Type reachability and scope nearness come from the shared selector
     * (PBUI-HELP-001, PBUI-KERNEL-1 §9). The selector checks type before
     * scope, and this loop's trace order requires invocation BETWEEN them (a
     * type-reachable contribution failing both invocation and scope traces
     * invocation-not-allowed), so the rejection is held and interleaved
     * rather than acted on immediately. No `when` is passed: a failing action
     * condition is a STATUS that stays in the override competition, not a
     * reject. A universal family is an explicit `anyDeclaredType` subject;
     * the selector handles it like any other.
     */
    let distance: number;
    let scope: { scope: ScopeId; index: number } | null;
    const matched = matchSelector(
      selectorOf({
        subject: contribution.subject,
        match: contribution.match,
        scopes: contribution.scopes,
      }),
      query.subject,
      snapshot,
      prepared.graph,
      prepared.predicates,
    );
    if (matched.kind === "rejected" && matched.stage === "type") continue;
    if (matched.kind === "matched") {
      const scoped = requireScoped(matched.match, `contribution "${contribution.id}"`);
      distance = scoped.typeDistance;
      scope = { scope: scoped.scope, index: scoped.scopeIndex };
    } else {
      distance = 0; // unread: every rejected path below continues
      scope = null;
    }

    const seedId =
      contribution.kind === "rule" ? contribution.id : makeCandidateId(contribution.id, "*");

    if (
      contribution.invocations !== undefined &&
      !contribution.invocations.includes(query.invocation)
    ) {
      trace.push({
        candidateId: seedId,
        contributionId: contribution.id,
        stage: "scope",
        result: "reject",
        reasonCode: "invocation-not-allowed",
      });
      continue;
    }

    if (scope === null) {
      trace.push({
        candidateId: seedId,
        contributionId: contribution.id,
        stage: "scope",
        result: "reject",
        reasonCode: "no-active-scope",
      });
      continue;
    }
    trace.push({
      candidateId: seedId,
      contributionId: contribution.id,
      stage: "type",
      result: "pass",
      distance,
      scopeIndex: scope.index,
    });

    if (contribution.kind === "rule") {
      let status: Availability = available();
      if (contribution.when) {
        status = evaluateCondition(contribution.when, context, prepared.predicates);
      }
      if (status.kind === "available" && contribution.test) {
        // Exact and inherited contexts are the same object at runtime; the
        // factories narrowed the exact rule's view at the type level only.
        status = (
          contribution.test as (
            ctx: InheritedRuleContext<Values, ProductFacts>,
          ) => Availability
        )(context);
      }
      traceStatus(trace, contribution.id, contribution.id, contribution.action, status);
      if (status.kind === "inapplicable") continue;
      candidates.push({
        candidateId: contribution.id,
        contributionId: contribution.id,
        action: contribution.action,
        status,
        metadata: contribution.metadata,
        bind: contribution.bind as Candidate<Values, ProductFacts, Verb>["bind"],
        declaredType: contribution.subject,
        distance,
        scope: scope.scope,
        scopeIndex: scope.index,
        priority: contribution.priority ?? 0,
      });
      continue;
    }

    // Family expansion: pure, bounded, stable unique keys.
    const family: ActionFamily<Values, ProductFacts, Verb> = contribution;
    const instances = family.expand(context);
    const keys = new Set<string>();
    for (const instance of instances) {
      if (keys.has(instance.key)) {
        throw new Error(
          `family "${family.id}" expanded duplicate key "${instance.key}" — ` +
            `instance keys must be unique within one expansion`,
        );
      }
      keys.add(instance.key);
    }
    trace.push({
      candidateId: seedId,
      contributionId: family.id,
      stage: "expand",
      result: "pass",
      reasonCode: String(instances.length),
    });
    for (const instance of instances) {
      const cid = makeCandidateId(family.id, instance.key);
      const status = instance.status ?? available();
      traceStatus(trace, cid, family.id, instance.action, status);
      if (status.kind === "inapplicable") continue;
      candidates.push({
        candidateId: cid,
        contributionId: family.id,
        action: instance.action,
        status,
        metadata: instance.metadata,
        bind: instance.bind as Candidate<Values, ProductFacts, Verb>["bind"],
        declaredType: isAnyDeclaredType(family.subject) ? subjectType : family.subject,
        distance,
        scope: scope.scope,
        scopeIndex: scope.index,
        priority: family.priority ?? 0,
      });
    }
  }

  /* [8..12] partition by action id, run the ladder ------------------------- */

  const partitions = new Map<ActionId, Candidate<Values, ProductFacts, Verb>[]>();
  for (const candidate of candidates) {
    const partition = partitions.get(candidate.action);
    if (partition) partition.push(candidate);
    else partitions.set(candidate.action, [candidate]);
  }

  const ambiguities: SelectionAmbiguity[] = [];
  const selected: Candidate<Values, ProductFacts, Verb>[] = [];

  for (const [action, partition] of partitions) {
    let pool = partition;
    const byDistance = Math.min(...pool.map((candidate) => candidate.distance));
    pool = pool.filter((candidate) => candidate.distance === byDistance);
    if (pool.length > 1) {
      const byScope = Math.min(...pool.map((candidate) => candidate.scopeIndex));
      pool = pool.filter((candidate) => candidate.scopeIndex === byScope);
    }
    if (pool.length > 1) {
      const byPriority = Math.max(...pool.map((candidate) => candidate.priority));
      pool = pool.filter((candidate) => candidate.priority === byPriority);
    }

    if (pool.length > 1) {
      const ids = pool.map((candidate) => candidate.candidateId).sort();
      const types = new Set(pool.map((candidate) => candidate.declaredType));
      ambiguities.push({
        action,
        candidates: ids,
        because: types.size > 1 ? "incomparable-types" : "equal-priority",
      });
      for (const candidate of pool) {
        trace.push({
          candidateId: candidate.candidateId,
          contributionId: candidate.contributionId,
          action,
          stage: "override",
          result: "ambiguous",
          related: ids.filter((id) => id !== candidate.candidateId),
        });
      }
      continue;
    }

    const winner = pool[0] as Candidate<Values, ProductFacts, Verb>;
    for (const candidate of partition) {
      if (candidate === winner) continue;
      trace.push({
        candidateId: candidate.candidateId,
        contributionId: candidate.contributionId,
        action,
        stage: "override",
        result: "shadowed",
        related: [winner.candidateId],
      });
    }
    trace.push({
      candidateId: winner.candidateId,
      contributionId: winner.contributionId,
      action,
      stage: "selected",
      result: winner.status.kind === "hidden" ? "hidden" : "selected",
      distance: winner.distance,
      scopeIndex: winner.scopeIndex,
    });
    selected.push(winner);
  }

  /* [13..16] bind winners, hide hidden, sort, assemble --------------------- */

  const actions: ResolvedAction<Values, Verb>[] = [];
  for (const winner of selected) {
    const winnerStatus = winner.status;
    if (winnerStatus.kind === "hidden") continue; // in the trace, not the menu
    if (winnerStatus.kind === "inapplicable") {
      throw new Error("unreachable: inapplicable candidates never enter selection");
    }
    const resolved: ResolvedAction<Values, Verb> = {
      action: winner.action,
      candidateId: winner.candidateId,
      contributionId: winner.contributionId,
      query,
      label:
        typeof winner.metadata.label === "function"
          ? winner.metadata.label(context)
          : winner.metadata.label,
      ...(winner.metadata.description !== undefined
        ? { description: winner.metadata.description }
        : {}),
      ...(winner.metadata.group !== undefined ? { group: winner.metadata.group } : {}),
      order: winner.metadata.order ?? 0,
      danger: winner.metadata.danger ?? false,
      primary: winner.metadata.primary ?? false,
      status:
        winnerStatus.kind === "available"
          ? { kind: "available" }
          : {
              kind: "unavailable",
              because: winnerStatus.because,
              ...(winnerStatus.code !== undefined ? { code: winnerStatus.code } : {}),
            },
      snapshotRevision: snapshot.revision,
      registryVersion: prepared.version,
      provenance: {
        declaredType: winner.declaredType,
        concreteType: subjectType,
        typeDistance: winner.distance,
        scope: winner.scope,
        scopeIndex: winner.scopeIndex,
        priority: winner.priority,
      },
    };
    if (winner.status.kind === "available") {
      resolved.verb = winner.bind(context);
    }
    actions.push(resolved);
  }

  // Presentation sort only — never precedence. Stable within equal keys.
  actions.sort((a, b) => {
    const group = (a.group ?? "").localeCompare(b.group ?? "");
    if (group !== 0) return group;
    if (a.order !== b.order) return a.order - b.order;
    const labelA = typeof a.label === "string" ? a.label : "";
    const labelB = typeof b.label === "string" ? b.label : "";
    const label = labelA.localeCompare(labelB);
    if (label !== 0) return label;
    return a.action.localeCompare(b.action);
  });

  ambiguities.sort((a, b) => a.action.localeCompare(b.action));

  return {
    actions,
    ambiguities,
    trace,
    snapshotRevision: snapshot.revision,
    registryVersion: prepared.version,
  };
}

function traceStatus(
  trace: ResolutionTraceEntry[],
  candidateId: CandidateId,
  contributionId: string,
  action: ActionId,
  status: Availability,
): void {
  const entry: ResolutionTraceEntry = {
    candidateId,
    contributionId,
    action,
    stage: "condition",
    result:
      status.kind === "available"
        ? "pass"
        : status.kind === "unavailable"
          ? "unavailable"
          : status.kind === "inapplicable"
            ? "inapplicable"
            : "hidden",
  };
  if (status.kind === "unavailable" && status.code !== undefined) {
    entry.reasonCode = status.code;
  }
  trace.push(entry);
}
