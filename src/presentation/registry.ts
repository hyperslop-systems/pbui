import type { ReactNode } from "react";
import type {
  PresentationDescriptor,
  PresentationDescriptorMap,
  PresentationReference,
  PresentationTone,
  PresentationType,
  PresentationValues,
} from "./types";

/**
 * The DESCRIPTOR registry: representation policy (label/describe/tone) per
 * exact concrete type. Action discovery lives entirely in the action kernel
 * — this registry knows nothing about verbs, availability, or menus.
 */
export interface PresentationDescriptorRegistry<
  Values extends PresentationValues,
  Environment,
> {
  descriptorFor<Type extends PresentationType<Values>>(
    type: Type,
  ): PresentationDescriptor<Values[Type], Environment> | null;
  labelFor(reference: PresentationReference<Values>, environment: Environment): ReactNode;
  describeFor(reference: PresentationReference<Values>, environment: Environment): unknown;
  toneFor(reference: PresentationReference<Values>): PresentationTone;
  has(type: string): type is PresentationType<Values>;
}

export function createPresentationRegistry<
  Values extends PresentationValues,
  Environment,
>(
  descriptors: PresentationDescriptorMap<Values, Environment>,
): PresentationDescriptorRegistry<Values, Environment> {
  function descriptorFor<Type extends PresentationType<Values>>(
    type: Type,
  ): PresentationDescriptor<Values[Type], Environment> | null {
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
    toneFor(reference) {
      return descriptorFor(reference.type)?.tone ?? "neutral";
    },
    has(type): type is PresentationType<Values> {
      return Object.hasOwn(descriptors, type);
    },
  };
}
