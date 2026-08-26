import type { PresentationType, PresentationValues } from "../types";
import type {
  ActionContribution,
  ActionFamily,
  ExactActionRule,
  InheritedActionRule,
} from "./types";

/**
 * The two rule factories make the payload contract visible in the types
 * (source guide §8.4): an EXACT rule receives a correctly narrowed concrete
 * reference and payload; an INHERITED rule receives the original generic
 * reference, because runtime subtyping never coerces payloads. A family is a
 * bounded dynamic generator whose instances still enter the same
 * applicability, override, ambiguity, trace, and revalidation pipeline as
 * static rules.
 */
export function defineActions<Values extends PresentationValues, ProductFacts, Verb>() {
  return {
    exact<Type extends PresentationType<Values>>(
      subject: Type,
      rule: Omit<ExactActionRule<Values, Type, ProductFacts, Verb>, "kind" | "subject" | "match">,
    ): ExactActionRule<Values, Type, ProductFacts, Verb> {
      return { kind: "rule", subject, match: "exact", ...rule };
    },

    inherited(
      subject: string,
      rule: Omit<InheritedActionRule<Values, ProductFacts, Verb>, "kind" | "subject" | "match">,
    ): InheritedActionRule<Values, ProductFacts, Verb> {
      return { kind: "rule", subject, match: "subtypes", ...rule };
    },

    family(
      subject: ActionFamily<Values, ProductFacts, Verb>["subject"],
      family: Omit<ActionFamily<Values, ProductFacts, Verb>, "kind" | "subject" | "match"> & {
        match?: ActionFamily<Values, ProductFacts, Verb>["match"];
      },
    ): ActionFamily<Values, ProductFacts, Verb> {
      const { match, ...rest } = family;
      return { kind: "family", subject, match: match ?? "exact", ...rest };
    },
  };
}

export type DefinedContribution<
  Values extends PresentationValues,
  ProductFacts,
  Verb,
> = ActionContribution<Values, ProductFacts, Verb>;
