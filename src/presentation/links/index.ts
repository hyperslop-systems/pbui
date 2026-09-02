/**
 * The pure link kernel (PBUI-LINK-1): ports, contracts, binding terms, their
 * evaluation and planning. A SIBLING of the action kernel (design D1): it
 * shares the type graph, availability and snapshot conventions from
 * `actions/` and never imports React, a store, or the workbench document.
 */

export {
  CONTRACT_IDENTITY_FIELDS,
  DOCUMENT_VALUE_TYPE,
  contractFingerprint,
  contractMismatches,
  definePort,
  definePorts,
  documentSlotPort,
  documentSlotsOf,
  hasDocumentSlot,
  normalizeContract,
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
  SourceClosePolicy,
} from "./types";
export { describeBinding, isBinding, isSerializableReference, linkIdOf, sameReference, sourcePortOf, terms } from "./terms";
export type { Binding, Diagnostic, SerializableReference } from "./terms";
export { LINK_VERB_KINDS, describeLinkVerb, isLinkVerb, linkVerbs } from "./verbs";
export type { LinkVerb, LinkVerbKind, UnlinkPolicy } from "./verbs";
export { EMPTY_LINK_STATE, labelOf, reaches } from "./snapshot";
export type { ContextDefinition, LinkDeps, LinkSnapshot, LinkState, LinkValues, PortDefinition, RelationDefinition } from "./snapshot";
export { checkIdentityCompatibility, compatibilityOf, compileIdentity } from "./identity";
export type { ClassLineage, CompiledIdentity, Compatibility, IdentityClass, IdentityDeclaration, IdentityDiagnostic, MergePolicy, SplitPolicy } from "./identity";
export { effectiveBinding, evaluateBinding, evaluatePort, valueToHold } from "./evaluate";
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
