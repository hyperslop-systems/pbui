import type { PbuiInstance, PresentationRegistry } from "@hyperslop-systems/pbui";
import { createContext, useContext } from "react";
import type { VerbRouter } from "./router/createVerbRouter";
import type { PbuiChatStore } from "./store/chatStore";
import type { ChatMessageBody, Reference, VerbLike } from "./types";
import type { Vocabulary } from "./vocabulary/schemas";

/* eslint-disable @typescript-eslint/no-explicit-any */
export type AnyPbui = PbuiInstance<any, any, any>;
export type AnyRegistry = PresentationRegistry<any, any, any>;
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * What every chat component reads. The generics are erased here on purpose:
 * the components render wire references, which are typed the same for every
 * product, and only the product's own descriptors know the concrete `Values`.
 */
export interface PbuiChatContextValue {
  pbui: AnyPbui;
  registry: AnyRegistry;
  vocabulary: Vocabulary;
  store: PbuiChatStore;
  router: VerbRouter<VerbLike>;
  basePrefix: string;
  /** Send a message with typed refs through the chat client. */
  send(body: Omit<ChatMessageBody, "attachments">): Promise<void>;
  /** The product's text label for a wire reference. */
  labelFor(reference: Reference): string;
  /** Doc line for a type, from the vocabulary. */
  docFor(type: string): string | undefined;
  /** Tone CSS value for a type, from the vocabulary. */
  toneFor(type: string): string | undefined;
}

export const PbuiChatContext = createContext<PbuiChatContextValue | null>(null);

export function usePbuiChat(): PbuiChatContextValue {
  const value = useContext(PbuiChatContext);
  if (!value) throw new Error("pbui-chat components must be rendered inside the chat's Provider");
  return value;
}
