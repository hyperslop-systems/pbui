import {
  createPresentationRegistry,
  type PresentationDescriptor as GenericPresentationDescriptor,
} from "@hyperslop-systems/pbui";
import { categoryDescriptor } from "./descriptors/category";
import { fieldDescriptor } from "./descriptors/field";
import { metalDescriptor } from "./descriptors/metal";
import { orderDescriptor } from "./descriptors/order";
import { productDescriptor } from "./descriptors/product";
import { proposalDescriptor } from "./descriptors/proposal";
import { rowDescriptor } from "./descriptors/row";
import { sourceDescriptor } from "./descriptors/source";
import { toolDescriptor } from "./descriptors/tool";
import { traceEntryDescriptor } from "./descriptors/traceEntry";
import { unresolvedDescriptor } from "./descriptors/unresolved";
import { widgetDescriptor } from "./descriptors/widget";
import type { Environment, PresentationType, Values } from "./types";
import type { Action, Verb } from "./verbs";

/** The product's descriptor shape: one file per type, verbs as data. */
export interface PresentationDescriptor<Type extends PresentationType> {
  ptype: Type;
  tone: string;
  label(value: Values[Type], env: Environment): string;
  describe(value: Values[Type], env: Environment): unknown;
  actions(value: Values[Type], env: Environment): Action[];
}

function bind<Type extends PresentationType>(
  descriptor: PresentationDescriptor<Type>,
): GenericPresentationDescriptor<Values[Type], Environment, Verb> {
  return {
    label: descriptor.label,
    describe: descriptor.describe,
    tone: descriptor.tone,
    actions: (value, environment) =>
      descriptor.actions(value, environment).map((action, index) => ({
        id: `${descriptor.ptype}:${index}:${action.label}`,
        label: action.label,
        verb: action.verb,
        danger: action.danger,
        description: action.description,
        disabledBecause: action.disabledBecause,
      })),
  };
}

export const registry = createPresentationRegistry<Values, Environment, Verb>({
  product: bind(productDescriptor),
  category: bind(categoryDescriptor),
  metal: bind(metalDescriptor),
  order: bind(orderDescriptor),
  field: bind(fieldDescriptor),
  row: bind(rowDescriptor),
  source: bind(sourceDescriptor),
  widget: bind(widgetDescriptor),
  tool: bind(toolDescriptor),
  proposal: bind(proposalDescriptor),
  traceEntry: bind(traceEntryDescriptor),
  unresolved: bind(unresolvedDescriptor),
});
