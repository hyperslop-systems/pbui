import type { ResolutionTraceEntry } from "./types";

/**
 * Verbose materialization of compact trace entries (source guide §16.2).
 * Routine resolution stores codes and ids; prose is built on demand for
 * developer tools and test failures. Hidden non-disclosure details must not
 * be exposed in ordinary user or agent output — callers gate access.
 */
export function describeTraceEntry(entry: ResolutionTraceEntry): string {
  const subject = entry.action ? `${entry.candidateId} (${entry.action})` : entry.candidateId;
  switch (`${entry.stage}:${entry.result}`) {
    case "scope:reject":
      return entry.reasonCode === "invocation-not-allowed"
        ? `${subject} rejected: not offered for this invocation`
        : `${subject} rejected: none of its scopes are active`;
    case "type:pass":
      return `${subject} reachable at type distance ${entry.distance ?? 0}, scope index ${entry.scopeIndex ?? 0}`;
    case "expand:pass":
      return `${entry.contributionId} expanded ${entry.reasonCode ?? "?"} instance(s)`;
    case "condition:pass":
      return `${subject} applicable and available`;
    case "condition:unavailable":
      return `${subject} unavailable${entry.reasonCode ? ` (${entry.reasonCode})` : ""}`;
    case "condition:inapplicable":
      return `${subject} not relevant here; a less specific implementation may apply`;
    case "condition:hidden":
      return `${subject} hidden; less specific implementations stay suppressed`;
    case "override:shadowed":
      return `${subject} shadowed by ${entry.related?.[0] ?? "a more specific rule"}`;
    case "override:ambiguous":
      return `${subject} ambiguous with ${entry.related?.join(", ") ?? "peers"} — nothing selected`;
    case "selected:selected":
      return `${subject} selected`;
    case "selected:hidden":
      return `${subject} selected but hidden — no row, fallback suppressed`;
    default:
      return `${subject} ${entry.stage}:${entry.result}`;
  }
}
