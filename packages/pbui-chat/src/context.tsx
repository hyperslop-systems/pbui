import type { PbuiInstance, PresentationRegistry } from "@hyperslop-systems/pbui";
import { createContext, useContext } from "react";
import type { ConversationRegistry } from "./conversations/registry";
import type { ChatRuntime } from "./conversations/runtime";
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
  /** Every conversation this product knows about, and which one is active. */
  conversations: ConversationRegistry;
  /**
   * The conversation this subtree belongs to, or null outside one — the
   * inspector and the watchlist are product-wide, a chat tile is not.
   * `ConversationScope` sets it.
   */
  conversationId: string | null;
  /** The runtime of `conversationId`, once it has attached. */
  runtime: ChatRuntime | null;
  /** Send a message with typed refs; to this conversation, or to the active one. */
  send(body: Omit<ChatMessageBody, "attachments">): Promise<void>;
  /** Send to a named conversation; null means the active one. */
  sendTo(conversationId: string | null, body: Omit<ChatMessageBody, "attachments">): Promise<void>;
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
