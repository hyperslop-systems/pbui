/**
 * The pure link kernel (PBUI-LINK-1): ports, contracts, binding terms and
 * their evaluation. A SIBLING of the action kernel (design D1): it shares the
 * type graph, scopes, availability and snapshot conventions from `actions/`
 * and never imports React, a store, or the workbench document. Phase 1 ships
 * the declarations; the terms, evaluator and planners follow in Phase 2.
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
