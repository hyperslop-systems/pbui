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
export { labelOf, reaches } from "./snapshot";
export type { ContextDefinition, LinkDeps, LinkSnapshot, LinkValues, PortDefinition } from "./snapshot";
export { effectiveBinding, evaluateBinding, evaluatePort, valueToHold } from "./evaluate";
export type { Evaluation } from "./evaluate";
export {
  dependsOn,
  findLink,
  planAmbient,
  planBind,
  planClear,
  planDetach,
  planFollow,
  planPin,
  planResume,
  planUnlink,
  plansForPort,
  titleOfPort,
} from "./plan";
export type { LinkPlan } from "./plan";
export { applyLinkVerb } from "./apply";
export type { ApplyOptions, ApplyResult } from "./apply";
export { bindingsAfterAppReplaced, bindingsAfterClone, bindingsAfterViewsRemoved } from "./lifecycle";
export { badgeOf, badgesOfView } from "./badge";
export type { Badge, BadgeState } from "./badge";
export { checkInvariants } from "./invariants";
export { existingCandidateId, freshCandidate, resolveShow, spawnCandidateId } from "./resolveShow";
export type { PlacementCandidate, ResolveShowOptions, ShowCandidate, ShowDisposition, ShowQuery, ShowRank, ShowResolution, ShowStatus, SpawnableApp } from "./resolveShow";
export type { Violation } from "./invariants";
