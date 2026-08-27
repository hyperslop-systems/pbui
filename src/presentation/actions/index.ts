/**
 * The pure action-selection kernel (PBUI-ACTIONS-2). No React at runtime, no
 * store subscriptions, no effects: a registry, a query, and a snapshot go in;
 * resolved actions, ambiguities, and a trace come out. See the ticket's
 * intern guide and the PBUI-ACTIONS-1 source guide for the semantics.
 */

export { available, unavailable, inapplicable, hidden } from "./availability";
export type { Availability, Failure } from "./availability";
export {
  all,
  capability,
  definePredicate,
  evaluateCondition,
  modeOff,
  modeOn,
  predicate,
  referencedPredicates,
} from "./conditions";
export type { Condition, PredicateDefinition, ProductPredicate } from "./conditions";
export { defineActions } from "./define";
export { describeTraceEntry } from "./explain";
export { candidateId } from "./ids";
export type {
  ActionId,
  CandidateId,
  FamilyId,
  ModeId,
  PredicateId,
  RuleId,
  RuntimeTypeId,
  ScopeId,
} from "./ids";
export { evaluateFresh } from "./perform";
export type { FreshDecision } from "./perform";
export { createActionRegistry } from "./registry";
export type {
  ActionRegistry,
  CreateActionRegistryOptions,
  ReachableContribution,
  RegistryDiagnostic,
} from "./registry";
export { createPresentationTypeGraph } from "./typeGraph";
export type {
  AncestorEntry,
  PresentationTypeDefinition,
  PresentationTypeGraph,
} from "./typeGraph";
export type {
  ActionContribution,
  ActionFamily,
  ActionFamilyInstance,
  ActionInvocation,
  ActionMetadata,
  ActionQuery,
  ExactActionRule,
  ExactRuleContext,
  FamilyContext,
  InheritedActionRule,
  InheritedRuleContext,
  PerformResult,
  ResolutionResult,
  ResolutionTraceEntry,
  ResolvedAction,
  SelectionAmbiguity,
  SelectionSnapshot,
} from "./types";
