export { createPbui, presentationTypes } from "./createPbui";
/*
 * The pure action-selection kernel (PBUI-ACTIONS-2). Exported alongside the
 * presentation runtime; nothing in the kernel imports React at runtime.
 */
export * from "./actions";
/*
 * The pure contextual help kernel and the shared matcher it rides on
 * (PBUI-HELP-001). Additive sibling of the action kernel; no React at runtime.
 */
export * from "./help";
/*
 * The pure link kernel (PBUI-LINK-1): ports, contracts, binding terms.
 * A sibling of the action kernel; no React at runtime.
 */
export * from "./links";
export { matchSelector, selectorOf } from "./context/selector";
export type { SelectorSource } from "./context/selector";
export { createPredicateRegistry, validateConditionPredicates } from "./context/predicates";
export type { PredicateRegistry } from "./context/predicates";
export { anyDeclaredType, isAnyDeclaredType } from "./context/types";
export type {
  AnyDeclaredTypeSubject,
  PresentationSelector,
  ScopedSelectorMatch,
  SelectorMatch,
  SelectorMatchResult,
  SelectorSubject,
} from "./context/types";
/* Canonical typed semantic arrows and the one-declaration kernel. */
export * from "./relations";
export * from "./kernel";
export { resolveAcceptance } from "./translators/resolve";
export type {
  AcceptanceOption,
  AcceptanceResolution,
  PresentationTranslator,
  TranslatorId,
} from "./translators/types";
export { createPresentationRegistry } from "./registry";
export type {
  CreatePbuiOptions,
  KernelCreatePbuiOptions,
  LegacyCreatePbuiOptions,
  PbuiRefusal,
  PbuiContextValue,
  PbuiInstance,
  PbuiProviderProps,
  PresentationProps,
} from "./createPbui";
export type { PresentationDescriptorRegistry } from "./registry";
export type {
  AcceptRequest,
  MenuState,
  PresentationDescriptor,
  PresentationDescriptorMap,
  PresentationReference,
  PresentationTone,
  PresentationType,
  PresentationValues,
} from "./types";
