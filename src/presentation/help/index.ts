/**
 * The pure contextual help kernel (PBUI-HELP-001). Like the action kernel it
 * sits beside: no React at runtime, no store subscriptions, no effects. A
 * registry, a subject, and a snapshot go in; ordered additive help items with
 * provenance come out. Rendering lives in `src/components/ContextHelp/`.
 */

export { defineHelp } from "./define";
export type { DefinedHelpContribution } from "./define";
export { createHelpRegistry } from "./registry";
export type { CreateHelpRegistryOptions, HelpRegistry } from "./registry";
export { resolveHelp } from "./resolve";
export type { PreparedHelpRegistry } from "./resolve";
export type {
  ExactHelpRule,
  HelpContribution,
  HelpDiagnostic,
  HelpItem,
  HelpItemId,
  HelpKind,
  HelpQuery,
  HelpResolution,
  HelpRuleId,
  InheritedHelpRule,
  ResolvedHelpItem,
} from "./types";
