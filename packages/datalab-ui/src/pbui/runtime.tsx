import {
  createPbui,
  type AcceptRequest as GenericAcceptRequest,
  type MenuState as GenericMenuState,
  type PresentationReference,
} from "@hyperslop-systems/pbui/presentation";
import type { ReactNode } from "react";
import { datalabContextFor } from "./actions";
import type { DatalabFacts } from "./actions";
import { datadropHelpRenderers } from "./help";
import { catToField, datalabPresentation } from "./presentation";
import type { PbuiEnvironment, PresentationValues } from "./types";
import type { Verb } from "./verbs";

const EMPTY_ENVIRONMENT: PbuiEnvironment = {
  fieldsFor: () => [],
  tableFor: () => null,
  activeDocId: null,
  nameOf: () => "α",
};

export { catToField };

/** Frozen by tests (PBUI-ACTIONS-2 P0): the conversion's behavior and the array's order. */
export const datadropConversions = [catToField] as const;

const datadropPbui = createPbui<PresentationValues, PbuiEnvironment, Verb, DatalabFacts>({
  // PBUI-KERNEL-1: one compiled presentation — types, descriptors, rules,
  // the cat → field relation, and the help rules — and one context
  // projection. See ./presentation.ts.
  presentation: datalabPresentation,
  defaultEnvironment: EMPTY_ENVIRONMENT,
  contextFor: datalabContextFor,
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
