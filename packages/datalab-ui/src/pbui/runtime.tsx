import {
  createPbui,
  type AcceptRequest as GenericAcceptRequest,
  type MenuState as GenericMenuState,
  type PresentationReference,
} from "@hyperslop-systems/pbui/presentation";
import type { ReactNode } from "react";
import { datadropActionRegistry, snapshotForDatalab } from "./actions";
import type { DatalabFacts } from "./actions";
import { datadropHelpRenderers, datalabHelpRegistry } from "./help";
import { datadropRegistry } from "./registry";
import type { CatRef, FieldRef, PbuiEnvironment, PresentationValues } from "./types";
import type { Verb } from "./verbs";

const EMPTY_ENVIRONMENT: PbuiEnvironment = {
  fieldsFor: () => [],
  tableFor: () => null,
  activeDocId: null,
  nameOf: () => "α",
};

/**
 * A categorical value may stand in for its field during accept mode.
 *
 * Exported (PBUI-ACTIONS-2 P0) so the conversion's behavior and the array's
 * order are frozen by tests before typed translators replace this mechanism.
 */
export function catToField(
  reference: PresentationReference<PresentationValues>,
): PresentationReference<PresentationValues> | undefined {
  if (reference.type !== "cat") return undefined;
  const cat = reference.value as CatRef;
  if (!cat.field) return undefined;
  return {
    type: "field",
    value: { docId: cat.docId, name: cat.field } satisfies FieldRef,
  };
}

export const datadropConversions = [catToField] as const;

/**
 * PBUI-ACTIONS-2 P6: the same conversion as a typed translator — declared
 * source and target, deterministic, chooser-ready. `catToField` stays
 * exported as the pure mapping both spellings share.
 */
export const datadropTranslators = [
  {
    id: "datalab.cat-to-field",
    from: "cat",
    to: "field",
    match: "exact",
    translate: (reference: PresentationReference<PresentationValues>) => catToField(reference),
  },
] as const;

const datadropPbui = createPbui<PresentationValues, PbuiEnvironment, Verb, DatalabFacts>({
  registry: datadropRegistry,
  defaultEnvironment: EMPTY_ENVIRONMENT,
  // PBUI-ACTIONS-2 P3: the product supplies its own kernel — field, datum,
  // doc, and stage as rules/families, everything else via the legacy family
  // inside datadropActionRegistry. See ./actions.ts.
  actions: datadropActionRegistry,
  snapshotFor: snapshotForDatalab,
  translators: datadropTranslators,
  // PBUI-HELP-001 P6: typed contextual help over the same snapshot facts.
  help: datalabHelpRegistry,
  helpRenderers: datadropHelpRenderers,
  renderMenuHeader: (reference, environment, label: ReactNode) => {
    const ambient = ["field", "source", "geom"].includes(reference.type);
    return (
      <>
        &lt;{reference.type}&gt; {label}
        {ambient && (
          <span data-part="menu-target">
            {" "}
            → chart {environment.nameOf(environment.activeDocId)}
          </span>
        )}
      </>
    );
  },
});

export const PbuiProvider = datadropPbui.Provider;
export const Presentation = datadropPbui.Presentation;
export const ObjectMenu = datadropPbui.ObjectMenu;
export const usePbui = datadropPbui.usePbui;
export const MouseDocLine = datadropPbui.MouseDocLine;
export const AcceptBanner = datadropPbui.AcceptBanner;
export const ContextHelp = datadropPbui.ContextHelp;

export type AcceptRequest = GenericAcceptRequest<PresentationValues>;
export type AcceptResult = PresentationReference<PresentationValues>;
export type MenuState = GenericMenuState<PresentationValues>;
export type PbuiContextValue = ReturnType<typeof usePbui>;
export type DatadropPresentationReference = PresentationReference<PresentationValues>;
