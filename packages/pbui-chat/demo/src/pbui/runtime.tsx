import { createPbui } from "@hyperslop-systems/pbui";
import { demoContextFor, demoPresentation } from "./actions";
import type { DemoFacts } from "./actions";
import { DEFAULT_ENVIRONMENT, type Environment, type Values } from "./types";
import type { Verb } from "./verbs";

export { demoConversions, rowToProduct } from "./relations";

/** The one descriptor registry: the compiled presentation's (PBUI-KERNEL-1). */
export const registry = demoPresentation.descriptors;

export const pbui = createPbui<Values, Environment, Verb, DemoFacts>({
  // PBUI-KERNEL-1: all nineteen types, their descriptors, the rules, and the
  // row → product relation are one compiled presentation (./actions.ts).
  presentation: demoPresentation,
  defaultEnvironment: DEFAULT_ENVIRONMENT,
  contextFor: demoContextFor,
  renderMenuHeader: (reference, _environment, label) => (
    <>
      &lt;{reference.type}&gt; {label}
      <span data-part="menu-target"> · {reference.value.id}</span>
    </>
  ),
});

export const PbuiProvider = pbui.Provider;
export const Presentation = pbui.Presentation;
export const ObjectMenu = pbui.ObjectMenu;
export const MouseDocLine = pbui.MouseDocLine;
export const AcceptBanner = pbui.AcceptBanner;
export const usePbui = pbui.usePbui;
