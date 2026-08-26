import {
  createPresentationRegistry,
  type PresentationDescriptor as GenericPresentationDescriptor,
} from "@hyperslop-systems/pbui";
import { fromPresentationReference } from "@hyperslop-systems/pbui-chat";
import { withGeneratedActions } from "@hyperslop-systems/pbui-sandbox";
import { library } from "../sandbox";
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

const base = createPresentationRegistry<Values, Environment, Verb>({
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
  source: bind(sourceDescriptor),
  widget: bind(widgetDescriptor),
  tool: bind(toolDescriptor),
  proposal: bind(proposalDescriptor),
  traceEntry: bind(traceEntryDescriptor),
  unresolved: bind(unresolvedDescriptor),
});

/**
 * The product's registry, with the library's generated actions appended to
 * each matching type's menu. `ObjectMenu` asks `actionsFor` when it opens,
 * so an action the agent defines a moment ago is in the next menu.
 */
export const registry = withGeneratedActions<Values, Environment, Verb>(base, {
  getActions: () => Object.values(library.getState().actions),
  toVerb: (action, reference) => ({ kind: "action.run", actionId: action.id, ref: fromPresentationReference(reference) }),
  programExists: (programId) => Boolean(library.getState().programs[programId]),
});
