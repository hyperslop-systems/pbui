/**
 * The pure link kernel (PBUI-LINK-1): ports, contracts, binding terms, their
 * evaluation and planning. A SIBLING of the action kernel (design D1): it
 * shares the type graph, availability and snapshot conventions from
 * `actions/` and never imports React, a store, or the workbench document.
 */

export {
  CONTRACT_IDENTITY_FIELDS,
  PORT_PROTOCOL_FIELDS,
  VALUE_CONTRACT_FIELDS,
  DOCUMENT_VALUE_TYPE,
  contractFingerprint,
  contractMismatches,
  definePort,
  definePorts,
  documentSlotPort,
  documentSlotsOf,
  hasDocumentSlot,
  normalizeContract,
  portProtocolOf,
  valueContractOf,
  parsePortId,
  portId,
  refineDeclaration,
} from "./types";
export type {
  ContractMismatch,
  FanInPolicy,
  PortCardinality,
  PortContract,
  PortContractInput,
  PortDeclaration,
  PortDeclarationInput,
  PortDirection,
  PortId,
  PortLifetime,
  PortMode,
  PortProtocol,
  SourceClosePolicy,
  ValueContract,
} from "./types";
export { describeBinding, isBinding, isSerializableReference, linkIdOf, sameReference, sourcePortOf, terms } from "./terms";
export type { Binding, Diagnostic, SerializableReference } from "./terms";
export {
  bindingOf,
  dependenciesOfBinding,
  dependenciesOfProgram,
  normalizeBinding,
  programOf,
  sourcePortsOfBinding,
} from "./expression";
export type {
  BindingDependencies,
  BindingExpression,
  BindingProgram,
  BindingSource,
} from "./expression";
export { checkBinding } from "./check";
export { PLAN_LINK_ID, candidateTermOf, destinationOf, isTermVerb, linkIdFor } from "./candidate";
export type { TermVerb } from "./candidate";
export type { BindingCheckDiagnostic, BindingCheckResult } from "./check";
export { LINK_VERB_KINDS, describeLinkVerb, isLinkVerb, linkVerbs } from "./verbs";
export type { LinkVerb, LinkVerbKind, UnlinkPolicy } from "./verbs";
export { EMPTY_LINK_STATE, labelOf, reaches } from "./snapshot";
export type { ContextDefinition, LinkDeps, LinkRelationEvaluation, LinkSnapshot, LinkState, LinkValues, PortDefinition, RelationDefinition } from "./snapshot";
export { checkIdentityCompatibility, compatibilityOf, compileIdentity, compileIdentityQuotient, identityQuotientOf, logicalCellOf } from "./identity";
export type { ClassLineage, CompiledIdentity, Compatibility, IdentityClass, IdentityDeclaration, IdentityDiagnostic, IdentityQuotient, LogicalCell, MergePolicy, SplitPolicy } from "./identity";
export { effectiveBinding, effectiveProgram, evaluateBinding, evaluatePort, evaluateProgram, valueToHold } from "./evaluate";
export type { Evaluation } from "./evaluate";
export {
  dependsOn,
  findLink,
  legalRelations,
  planAmbient,
  planBind,
  planClear,
  planDerive,
  planDetach,
  planFollow,
  planIdentityAdd,
  planIdentityRemove,
  planPin,
  planResume,
  planUnlink,
  plansForPort,
  titleOfPort,
} from "./plan";
export type { LinkPlan } from "./plan";
export { applyLinkVerb } from "./apply";
export type { ApplyOptions, ApplyResult, RuntimeEffect } from "./apply";
export { bindingsAfterAppReplaced, bindingsAfterClone, bindingsAfterViewsRemoved, identityAfterViewsRemoved } from "./lifecycle";
export { badgeOf, badgesOfView } from "./badge";
export type { Badge, BadgeState } from "./badge";
export { checkInvariants } from "./invariants";
export { existingCandidateId, freshCandidate, resolveShow, spawnCandidateId } from "./resolveShow";
export type { PlacementCandidate, ResolveShowOptions, ShowCandidate, ShowDisposition, ShowQuery, ShowRank, ShowResolution, ShowStatus, SpawnableApp } from "./resolveShow";
export type { Violation } from "./invariants";
