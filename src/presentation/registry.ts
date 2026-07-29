import type { ReactNode } from "react";
import type {
  PresentationAction,
  PresentationDescriptor,
  PresentationDescriptorMap,
  PresentationReference,
  PresentationTone,
  PresentationType,
  PresentationValues,
} from "./types";

export interface PresentationRegistry<
  Values extends PresentationValues,
  Environment,
  Verb,
> {
  descriptorFor<Type extends PresentationType<Values>>(
    type: Type,
  ): PresentationDescriptor<Values[Type], Environment, Verb> | null;
  labelFor(reference: PresentationReference<Values>, environment: Environment): ReactNode;
  describeFor(reference: PresentationReference<Values>, environment: Environment): unknown;
  actionsFor(
    reference: PresentationReference<Values>,
    environment: Environment,
  ): readonly PresentationAction<Verb>[];
  toneFor(reference: PresentationReference<Values>): PresentationTone;
  has(type: string): type is PresentationType<Values>;
}

export function createPresentationRegistry<
  Values extends PresentationValues,
  Environment,
  Verb,
>(
  descriptors: PresentationDescriptorMap<Values, Environment, Verb>,
): PresentationRegistry<Values, Environment, Verb> {
  function descriptorFor<Type extends PresentationType<Values>>(
    type: Type,
  ): PresentationDescriptor<Values[Type], Environment, Verb> | null {
    return descriptors[type] ?? null;
  }

  function fallbackLabel(reference: PresentationReference<Values>): string {
    if (typeof reference.value === "string" || typeof reference.value === "number") {
      return String(reference.value);
    }
    try {
      return JSON.stringify(reference.value)?.slice(0, 48) ?? `<${reference.type}>`;
    } catch {
      return `<${reference.type}>`;
    }
  }

  return {
    descriptorFor,
    labelFor(reference, environment) {
      const descriptor = descriptorFor(reference.type);
      return descriptor
        ? descriptor.label(reference.value, environment)
        : fallbackLabel(reference);
    },
    describeFor(reference, environment) {
      const descriptor = descriptorFor(reference.type);
      return descriptor?.describe?.(reference.value, environment) ?? {
        presentationType: reference.type,
        value: reference.value,
      };
    },
    actionsFor(reference, environment) {
      const descriptor = descriptorFor(reference.type);
      return descriptor?.actions?.(reference.value, environment) ?? [];
    },
    toneFor(reference) {
      return descriptorFor(reference.type)?.tone ?? "neutral";
    },
    has(type): type is PresentationType<Values> {
      return Object.hasOwn(descriptors, type);
    },
  };
}
