import {
  createPbui,
  type AcceptRequest as GenericAcceptRequest,
  type MenuState as GenericMenuState,
  type PresentationReference,
} from "@hyperslop-systems/pbui/presentation";
import type { ReactNode } from "react";
import { datadropRegistry } from "./registry";
import type { CatRef, FieldRef, PbuiEnvironment, PresentationValues } from "./types";
import type { Verb } from "./verbs";

const EMPTY_ENVIRONMENT: PbuiEnvironment = {
  fieldsFor: () => [],
  tableFor: () => null,
  activeDocId: null,
  nameOf: () => "α",
};

const datadropPbui = createPbui<PresentationValues, PbuiEnvironment, Verb>({
  registry: datadropRegistry,
  defaultEnvironment: EMPTY_ENVIRONMENT,
  conversions: [
    (reference) => {
      if (reference.type !== "cat") return undefined;
      const cat = reference.value as CatRef;
      if (!cat.field) return undefined;
      return {
        type: "field",
        value: { docId: cat.docId, name: cat.field } satisfies FieldRef,
      };
    },
  ],
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

export type AcceptRequest = GenericAcceptRequest<PresentationValues>;
export type AcceptResult = PresentationReference<PresentationValues>;
export type MenuState = GenericMenuState<PresentationValues>;
export type PbuiContextValue = ReturnType<typeof usePbui>;
export type DatadropPresentationReference = PresentationReference<PresentationValues>;
