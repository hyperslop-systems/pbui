import type { ReactNode } from "react";

export type PresentationValues = object;
export type PresentationType<Values extends PresentationValues> = Extract<keyof Values, string>;

export type PresentationReference<
  Values extends PresentationValues,
  Type extends PresentationType<Values> = PresentationType<Values>,
> = {
  [Key in Type]: {
    type: Key;
    value: Values[Key];
  };
}[Type];

export type PresentationTone =
  | "neutral"
  | "accent"
  | "positive"
  | "warning"
  | "danger"
  | (string & {});

export interface PresentationAction<Verb> {
  id: string;
  label: string;
  verb: Verb;
  description?: string;
  group?: string;
  danger?: boolean;
  /**
   * Present ⇔ the action is unavailable, and the string is why.
   *
   * # Why this is one field
   *
   * It used to be two — `disabled?: boolean` and `disabledReason?: string` —
   * and the pair produced the same defect in every product that used it. An
   * author knows the rule and writes it twice, once as a predicate and once as
   * prose:
   *
   *     disabled: environment.cursorTerm === ref.id,
   *     disabledReason: "the cursor is already here",
   *
   * Two adjacent lines that read as one unit and evaluate as two. The renderer
   * guarded the reason on the reason being SET, so every usable action
   * displayed an explanation of why it could not be used. Fifteen live sites
   * across three products, plus this library's own story.
   *
   * The guard was the bug and P2 fixed it. This field is the reason the bug
   * was WRITABLE. With one field there is nothing for a predicate to disagree
   * with, and both illegal states stop existing:
   *
   *   - a reason on an available action — previously the live defect
   *   - a disabled action with no explanation — previously silent, and its own
   *     small usability defect. `presentation-parts.css` states the policy in
   *     prose ("Disabled entries are shown, not hidden: hiding a verb hides
   *     the rule that makes it unavailable"); this makes the type carry it.
   *
   * # The name
   *
   * Taken from datalab-ui rather than invented. That product merged the pair
   * into `disabledBecause` on its own, wrote it twice, and got it right both
   * times — the only one of four products that never had the bug, and it paid
   * a translation layer to escape this type. Adopting its name upstream let
   * that adapter collapse to a passthrough with no descriptor changing.
   *
   * # Writing it
   *
   *     disabledBecause: tile.canClose ? undefined : "the last tile cannot close",
   *
   * One expression over one field, predicate and prose adjacent. A conditional
   * spread (`...(cond ? {} : { disabledBecause })`) also works and is what a
   * discriminated union would have FORCED at every call site — which is why
   * the merge is better than the union.
   */
  disabledBecause?: string;

  /**
   * TOMBSTONES. Removed in 0.4.0; typed rather than deleted so that migrating
   * is a compile error instead of a silent behaviour change.
   *
   * Deleting a field is not enough here, and the reason is worth knowing
   * because it applies to every future rename in this interface. Actions are
   * returned from a descriptor's `actions()` function, whose return type is
   * INFERRED and then checked for assignability — and assignability is
   * structural, so it permits extra properties. TypeScript's excess-property
   * check only fires on a fresh literal assigned directly to a target, and
   * freshness is lost the moment the literal is widened into an inferred
   * return type. Verified against a minimal repro rather than assumed: a
   * property called `totallyBogusProperty` in a descriptor action produces no
   * diagnostic at all.
   *
   * So a product left on the old shape would have compiled cleanly, had both
   * of its fields ignored, and rendered `disabled={undefined}` — turning every
   * unavailable action, including destructive ones, into a clickable one. A
   * worse defect than the one this merge fixes, introduced by fixing it.
   *
   * Declaring them `never` makes it an ordinary type mismatch, which the
   * inference path DOES report:
   *
   *     Types of property 'disabled' are incompatible.
   *       Type 'boolean' is not assignable to type 'undefined'.
   *
   * Safe to delete once every consumer is on 0.4.0.
   *
   * @deprecated merged into `disabledBecause`
   */
  disabled?: never;
  /** @deprecated merged into `disabledBecause` — see the note above. */
  disabledReason?: never;
}

export interface PresentationDescriptor<Value, Environment, Verb> {
  label(value: Value, environment: Environment): ReactNode;
  describe?(value: Value, environment: Environment): unknown;
  actions?(value: Value, environment: Environment): readonly PresentationAction<Verb>[];
  tone?: PresentationTone;
}

export type PresentationDescriptorMap<
  Values extends PresentationValues,
  Environment,
  Verb,
> = Partial<{
  [Type in PresentationType<Values>]: PresentationDescriptor<Values[Type], Environment, Verb>;
}>;

export interface AcceptRequest<Values extends PresentationValues> {
  types: PresentationType<Values> | readonly PresentationType<Values>[];
  prompt: string;
  filter?: (reference: PresentationReference<Values>) => boolean;
}

export interface MenuState<Values extends PresentationValues> {
  reference: PresentationReference<Values>;
  x: number;
  y: number;
}

export type PresentationConversion<Values extends PresentationValues> = (
  reference: PresentationReference<Values>,
) => PresentationReference<Values> | undefined;
