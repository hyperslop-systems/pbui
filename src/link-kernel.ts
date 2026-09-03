/**
 * `@hyperslop-systems/pbui/link-kernel` — the pure semantic half PBUI's
 * link kernel needs, with no React, no DOM, no component, no CSS (design
 * doc 04 §8, Decision D). This is the entry `@hyperslop-systems/workbench-core`
 * imports: the port and contract declarations, binding terms, link verbs and
 * their planning and evaluation, identity, lifecycle, badges, show
 * resolution — and the type graph those depend on.
 *
 * One implementation, two entries: everything here is re-exported from the
 * root entry too. What this entry guarantees is the dependency graph: a
 * consumer that imports only this path installs and runs without React.
 */
export * from "./presentation/links/index";
export { createPresentationTypeGraph } from "./presentation/actions/typeGraph";
export type { AncestorEntry, PresentationTypeDefinition, PresentationTypeGraph } from "./presentation/actions/typeGraph";
export type { ActionId, CandidateId, FamilyId, ModeId, PredicateId, RuleId, RuntimeTypeId, ScopeId } from "./presentation/actions/ids";
