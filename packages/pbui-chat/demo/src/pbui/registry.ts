import type {
  PresentationDescriptor as GenericPresentationDescriptor,
  PresentationDescriptorMap,
} from "@hyperslop-systems/pbui";
import { actionDescriptor } from "./descriptors/action";
import { appDescriptor } from "./descriptors/app";
import { programDescriptor } from "./descriptors/program";
import { categoryDescriptor } from "./descriptors/category";
import { chatEventDescriptor } from "./descriptors/chatEvent";
import { conversationDescriptor } from "./descriptors/conversation";
import { fieldDescriptor } from "./descriptors/field";
import { metalDescriptor } from "./descriptors/metal";
import { orderDescriptor } from "./descriptors/order";
import { productDescriptor } from "./descriptors/product";
import { proposalDescriptor } from "./descriptors/proposal";
import { rowDescriptor } from "./descriptors/row";
import { sourceDescriptor } from "./descriptors/source";
import { tileDescriptor } from "./descriptors/tile";
import { toolDescriptor } from "./descriptors/tool";
import { traceEntryDescriptor } from "./descriptors/traceEntry";
import { unresolvedDescriptor } from "./descriptors/unresolved";
import { widgetDescriptor } from "./descriptors/widget";
import { workspaceDescriptor } from "./descriptors/workspace";
import type { Environment, PresentationType, Values } from "./types";

/** The product's descriptor shape: one file per type. Verbs live in the
 * kernel rules (`./actions.ts`) since PBUI-ACTIONS-2 P4; descriptors are
 * representation only (pbui 0.8.0 removed the `actions` callback). */
export interface PresentationDescriptor<Type extends PresentationType> {
  ptype: Type;
  tone: string;
  label(value: Values[Type], env: Environment): string;
  describe(value: Values[Type], env: Environment): unknown;
}

function bind<Type extends PresentationType>(
  descriptor: PresentationDescriptor<Type>,
): GenericPresentationDescriptor<Values[Type], Environment> {
  return {
    label: descriptor.label,
    describe: descriptor.describe,
    tone: descriptor.tone,
  };
}

/** The product's own thirteen types (PBUI-KERNEL-1): declared and described in ./actions.ts. */
export const demoDescriptors: PresentationDescriptorMap<Values, Environment> = {
  product: bind(productDescriptor),
  category: bind(categoryDescriptor),
  metal: bind(metalDescriptor),
  order: bind(orderDescriptor),
  tile: bind(tileDescriptor),
  workspace: bind(workspaceDescriptor),
  app: bind(appDescriptor),
  program: bind(programDescriptor),
  action: bind(actionDescriptor),
  conversation: bind(conversationDescriptor),
  chatEvent: bind(chatEventDescriptor),
  field: bind(fieldDescriptor),
  row: bind(rowDescriptor),
};

/** The chat layer's six types: handed to `createChatPresentationFragment`, which declares them (C18). */
export const chatDescriptors: PresentationDescriptorMap<Values, Environment> = {
  source: bind(sourceDescriptor),
  widget: bind(widgetDescriptor),
  tool: bind(toolDescriptor),
  proposal: bind(proposalDescriptor),
  traceEntry: bind(traceEntryDescriptor),
  unresolved: bind(unresolvedDescriptor),
};

/*
 * PBUI-ACTIONS-2 P4: the `withGeneratedActions` wrapper is gone — generated
 * actions now arrive through `createGeneratedActionsFamily` in `./actions.ts`,
 * with the same liveness (the records ride in the snapshot, read from the
 * library at resolution time) plus override, trace, and fresh revalidation.
 */
