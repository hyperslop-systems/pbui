/*
 * The compiled presentation model (PBUI-KERNEL-1): one declaration, named
 * fragments, one graph, one predicate registry, sibling interpreters. Pure;
 * no React at runtime.
 */
export { compilePresentation } from "./compile";
export { definePresentation } from "./define";
export type { PresentationDefinitionTools } from "./define";
export type { ModelDiagnostic, ModelDiagnosticCode } from "./diagnostics";
export type {
  CompiledPresentation,
  LinkDependencyOptions,
  PresentationContextInput,
  PresentationDeclaration,
  PresentationFragment,
  PresentationVocabulary,
  VocabularyFragmentEntry,
  VocabularyHelpRuleEntry,
} from "./types";
export { vocabularyOfModel } from "./vocabulary";
