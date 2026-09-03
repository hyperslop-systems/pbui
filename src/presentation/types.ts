import type { ReactNode } from "react";
import type { FocusReturnTarget } from "../focus";

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

/**
 * A descriptor is REPRESENTATION policy only: how one concrete type renders
 * (`label`), narrates itself to agents and inspectors (`describe`), and is
 * toned. Action discovery lives entirely in the action kernel
 * (`createActionRegistry`); the pre-kernel `actions()` callback and its
 * `PresentationAction` row shape were deleted in 0.8.0 (PBUI-ACTIONS-3 A1).
 * The one-field unavailability argument that shape carried
 * (`disabledBecause`: present ⇔ unavailable, the string is why) lives on in
 * the kernel's `Availability` — see `actions/availability.ts`.
 */
export interface PresentationDescriptor<Value, Environment> {
  label(value: Value, environment: Environment): ReactNode;
  describe?(value: Value, environment: Environment): unknown;
  tone?: PresentationTone;
}

export type PresentationDescriptorMap<
  Values extends PresentationValues,
  Environment,
> = Partial<{
  [Type in PresentationType<Values>]: PresentationDescriptor<Values[Type], Environment>;
}>;

/**
 * A requested type may be a concrete presentation type (autocompleted) or an
 * ABSTRACT runtime type from the graph, which no `Values` key names: an
 * abstract request is satisfied by any concrete subtype, by subtyping or by
 * a relation whose codomain reaches it (PBUI-KERNEL-1 §11.3, C8).
 */
export type AcceptableType<Values extends PresentationValues> =
  | PresentationType<Values>
  | (string & {});

export interface AcceptRequest<Values extends PresentationValues> {
  types: AcceptableType<Values> | readonly AcceptableType<Values>[];
  prompt: string;
  filter?: (reference: PresentationReference<Values>) => boolean;
}

export interface MenuState<Values extends PresentationValues> {
  reference: PresentationReference<Values>;
  x: number;
  y: number;
  returnFocus: FocusReturnTarget;
}

