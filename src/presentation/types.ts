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
  disabled?: boolean;
  disabledReason?: string;
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
