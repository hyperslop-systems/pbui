import type { PresentationType, PresentationValues } from "../types";
import type { ExactHelpRule, HelpContribution, InheritedHelpRule } from "./types";

/**
 * The help-rule factories, mirroring `defineActions` (design doc §7.1): an
 * EXACT rule's callbacks see the correctly narrowed concrete payload; an
 * INHERITED rule's callbacks see the ORIGINAL generic reference, because
 * runtime subtyping never coerces payloads. The narrowing is type-level only
 * — at runtime both receive the same context object, exactly as in the
 * action kernel.
 */
export function defineHelp<Values extends PresentationValues, ProductFacts>() {
  return {
    exact<Type extends PresentationType<Values>>(
      subject: Type,
      rule: Omit<ExactHelpRule<Values, Type, ProductFacts>, "kind" | "subject" | "match">,
    ): ExactHelpRule<Values, Type, ProductFacts> {
      return { kind: "rule", subject, match: "exact", ...rule };
    },

    inherited(
      subject: string,
      rule: Omit<InheritedHelpRule<Values, ProductFacts>, "kind" | "subject" | "match">,
    ): InheritedHelpRule<Values, ProductFacts> {
      return { kind: "rule", subject, match: "subtypes", ...rule };
    },
  };
}

export type DefinedHelpContribution<
  Values extends PresentationValues,
  ProductFacts,
> = HelpContribution<Values, ProductFacts>;
