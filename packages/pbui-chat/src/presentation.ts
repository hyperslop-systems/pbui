import type {
  PresentationDescriptorMap,
  PresentationFragment,
  PresentationTypeDefinition,
  PresentationValues,
} from "@hyperslop-systems/pbui";
import type { ChatValues } from "./types";

/**
 * The chat layer as ONE named fragment (PBUI-KERNEL-1 C18).
 *
 * The chat layer renders its own presentation types (`ChatValues`: message,
 * run, tool, widget, proposal, traceEntry, source, unresolved) but owns no
 * descriptors for them — how a proposal LABELS itself is product policy. So
 * the fragment is built from the product's descriptors for the chat types it
 * uses: every described chat type is declared, and no chat type is declared
 * without a descriptor. A product includes it and cannot register a widget
 * descriptor while forgetting the `widget` type, which under the closed
 * world (C9) would otherwise be a runtime error at the first hover.
 *
 *     include: [createChatPresentationFragment<Values, Environment, Facts, Verb>({
 *       widget: bind(widgetDescriptor), proposal: bind(proposalDescriptor), ...
 *     })]
 */
export type ChatTypeId = keyof ChatValues;

export const chatTypeIds: readonly ChatTypeId[] = [
  "message",
  "run",
  "tool",
  "widget",
  "proposal",
  "traceEntry",
  "source",
  "unresolved",
];

export function createChatPresentationFragment<
  Values extends PresentationValues,
  Environment,
  ProductFacts,
  Verb,
>(
  descriptors: PresentationDescriptorMap<Values, Environment>,
): PresentationFragment<Values, Environment, ProductFacts, Verb> {
  const declared = Object.keys(descriptors).filter((type) => (chatTypeIds as readonly string[]).includes(type));
  const stray = Object.keys(descriptors).filter((type) => !(chatTypeIds as readonly string[]).includes(type));
  if (stray.length > 0) {
    throw new Error(`createChatPresentationFragment: not chat-layer types: ${stray.join(", ")}`);
  }
  const types: PresentationTypeDefinition[] = declared.map((id) => ({ id }));
  return { id: "pbui-chat", types, descriptors };
}
