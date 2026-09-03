import type { ReactNode } from "react";
import type { ActionId, CandidateId } from "../actions/ids";
import type { ActionQuery, ResolutionResult, ResolutionTraceEntry, SelectionAmbiguity } from "../actions/types";
import type { PresentationValues } from "../types";

/*
 * Original-query introspection (PBUI-KERNEL-4 P5; KERNEL-1 guide §15.3–§15.4).
 *
 * An explanation is about the query the user is looking at: the MENU
 * query for a menu, the PRIMARY query for a left click. It is computed
 * from the same resolution over the same snapshot, never by re-resolving
 * with a synthetic `"introspection"` invocation — invocation is an input
 * to discovery and a different one can yield a different candidate set.
 *
 * Disclosure decides how much of the resolution's trace is shown:
 *
 *   public      exactly what the menu shows: the rows in menu order with
 *               their availability and the product's `because`, and the
 *               ambiguity notes. Hidden candidates, rejected candidates,
 *               reason codes and predicate detail are omitted — a hidden
 *               rule is hidden from the explanation too.
 *   developer   the same rows, each with the trace entries that produced
 *               it, plus every other candidate the resolver considered
 *               (hidden, rejected, shadowed, inapplicable) with its stage,
 *               result and reason code. For a product's own diagnostics
 *               behind a deliberate gate; never the default.
 */

export type IntrospectionDisclosure = "public" | "developer";

export interface ExplainedRow {
  readonly action: ActionId;
  readonly candidateId: CandidateId;
  readonly contributionId: string;
  readonly label: ReactNode;
  readonly outcome: "available" | "unavailable";
  readonly because?: string;
  /** Developer only: the trace entries for this candidate, in resolver order. */
  readonly trace?: readonly ResolutionTraceEntry[];
}

export interface ExplainedCandidate {
  readonly candidateId: CandidateId;
  readonly contributionId: string;
  readonly action?: ActionId;
  /** The last stage the candidate reached and how it left. */
  readonly stage: ResolutionTraceEntry["stage"];
  readonly result: ResolutionTraceEntry["result"];
  readonly reasonCode?: string;
  readonly trace: readonly ResolutionTraceEntry[];
}

export interface Explanation<Values extends PresentationValues> {
  readonly query: ActionQuery<Values>;
  readonly disclosure: IntrospectionDisclosure;
  readonly snapshotRevision: string | number;
  readonly registryVersion: string | number;
  /** The rows the menu (or the primary resolution) shows, in its order. */
  readonly rows: readonly ExplainedRow[];
  readonly ambiguities: readonly SelectionAmbiguity[];
  /** Developer only: every candidate that is not a shown row. */
  readonly others?: readonly ExplainedCandidate[];
}

export function explainResolution<Values extends PresentationValues, Verb>(
  query: ActionQuery<Values>,
  resolution: ResolutionResult<Values, Verb>,
  disclosure: IntrospectionDisclosure,
): Explanation<Values> {
  const byCandidate = new Map<CandidateId, ResolutionTraceEntry[]>();
  for (const entry of resolution.trace) {
    const list = byCandidate.get(entry.candidateId) ?? [];
    list.push(entry);
    byCandidate.set(entry.candidateId, list);
  }

  const rows: ExplainedRow[] = resolution.actions.map((action) => ({
    action: action.action,
    candidateId: action.candidateId,
    contributionId: action.contributionId,
    label: action.label,
    outcome: action.status.kind === "available" ? "available" : "unavailable",
    ...(action.status.kind === "unavailable" ? { because: action.status.because } : {}),
    ...(disclosure === "developer" ? { trace: byCandidate.get(action.candidateId) ?? [] } : {}),
  }));

  const base = {
    query,
    disclosure,
    snapshotRevision: resolution.snapshotRevision,
    registryVersion: resolution.registryVersion,
    rows,
    ambiguities: resolution.ambiguities,
  };
  if (disclosure === "public") return base;

  const shown = new Set(rows.map((row) => row.candidateId));
  const others: ExplainedCandidate[] = [];
  for (const [candidateId, trace] of byCandidate) {
    if (shown.has(candidateId)) continue;
    const last = trace[trace.length - 1]!;
    others.push({
      candidateId,
      contributionId: last.contributionId,
      ...(last.action !== undefined ? { action: last.action } : {}),
      stage: last.stage,
      result: last.result,
      ...(last.reasonCode !== undefined ? { reasonCode: last.reasonCode } : {}),
      trace,
    });
  }
  return { ...base, others };
}
