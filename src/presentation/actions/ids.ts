/**
 * The five identities of the action kernel (PBUI-ACTIONS-2, source guide §7).
 *
 * They are plain strings, but they name different things, and the distinction
 * is load-bearing:
 *
 * - a RUNTIME TYPE ID names a node in the nominal type graph — concrete
 *   (`tile`) or abstract (`object`). Concrete presentation references remain
 *   keys of the product's `PresentationValues`; abstract nodes need no payload.
 * - a RULE ID names one declaration by one package (`workbench.tile.close`).
 *   Globally unique in a registry; appears in traces.
 * - a FAMILY ID names one dynamic contribution source
 *   (`sandbox.generated-actions`). Each expansion instance has a stable KEY,
 *   and `familyId/key` forms the CANDIDATE ID.
 * - an ACTION ID names the conceptual operation (`presentation.open`).
 *   Several rules implementing one action id COMPETE; different action ids
 *   ACCUMULATE. A rule id must not double as an action id.
 * - SCOPE and MODE ids name context: a scope is a position in the snapshot's
 *   inner-to-outer stack; a mode is a transient contextual fact.
 *
 * Array index, label text, and registration order are forbidden as identity
 * everywhere in this kernel.
 */

export type RuntimeTypeId = string;
export type RuleId = string;
export type FamilyId = string;
export type CandidateId = string;
export type ActionId = string;
export type ScopeId = string;
export type ModeId = string;
export type PredicateId = string;

/** `familyId/key` — the candidate identity of one family instance. */
export function candidateId(family: FamilyId, key: string): CandidateId {
  return `${family}/${key}`;
}
