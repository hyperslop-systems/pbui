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
export { activeScope, matchContext } from "./context/match";
export type { ContextMatch, ContextMatchResult, ContextTarget } from "./context/types";
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
