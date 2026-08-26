import { defineApp, type AppDescriptor } from "@hyperslop-systems/pbui-workbench";
import { CONVERSATION_BINDING } from "../conversations/bindings";
import { ContextTile } from "../conversations/ContextTile";
import { ConversationsTile } from "../conversations/ConversationsTile";
import { EventsTile } from "../conversations/EventsTile";
import { RunsTile } from "../conversations/RunsTile";
import { ToolsTile } from "../conversations/ToolsTile";
import type { ConversationRegistry } from "../conversations/registry";
import { toneVar } from "../tone";
import type { Vocabulary } from "../vocabulary/schemas";
import { PanelApp } from "./PanelApp";

export type ConversationAppId = "conversations" | "chat-events" | "chat-runs" | "chat-tools" | "conversation-context";

export interface CreateConversationAppsOptions {
  tones?: Partial<Record<ConversationAppId, string>>;
  titles?: Partial<Record<ConversationAppId, string>>;
  /** Which launcher group the tiles are offered in; default "agent". */
  group?: string;
}

/**
 * The helper tiles a person uses to work with several agents at once.
 *
 * Separate from `createChatApps` on purpose: `createChatApps` is the
 * conversation itself and the three panels every product has wanted since
 * PBUI-AGENT-1, while these are the tiles that only start earning their space
 * once there is more than one agent. A product with one conversation can
 * leave them out and lose nothing.
 *
 * Phase 1 registers the first: *Conversations*. Events, Runs, Tools and Agent
 * context join it here.
 */
export function createConversationApps(
  chat: { vocabulary: Vocabulary; conversations: ConversationRegistry },
  options: CreateConversationAppsOptions = {},
): AppDescriptor[] {
  const group = options.group ?? "agent";
  return [
    defineApp({
      id: "conversations",
      title: options.titles?.conversations ?? "conversations",
      tone: options.tones?.conversations ?? toneVar(chat.vocabulary.types.conversation?.tone ?? "conversation", "var(--pbui-pane-alt)"),
      group,
      blurb: "every agent on this workbench: start, name, pin, archive, switch",
      singleton: true,
      Component: () => (
        <PanelApp part="conversations-app">
          <ConversationsTile />
        </PanelApp>
      ),
    }),
    defineApp({
      id: "chat-events",
      title: options.titles?.["chat-events"] ?? "events",
      tone: options.tones?.["chat-events"] ?? toneVar(chat.vocabulary.types.chatEvent?.tone ?? "chatEvent", "var(--pbui-tone-neutral)"),
      group,
      blurb: "what happens on the wire: frames, tool calls, widgets, reconnects",
      singleton: true,
      Component: () => (
        <PanelApp part="chat-events-app">
          <EventsTile />
        </PanelApp>
      ),
    }),
    defineApp({
      id: "chat-runs",
      title: options.titles?.["chat-runs"] ?? "runs",
      tone: options.tones?.["chat-runs"] ?? "var(--pbui-tone-neutral)",
      group,
      blurb: "what every agent has cost: model, runs, tokens, how fast it is going",
      singleton: true,
      Component: () => (
        <PanelApp part="chat-runs-app">
          <RunsTile />
        </PanelApp>
      ),
    }),
    defineApp({
      id: "chat-tools",
      title: options.titles?.["chat-tools"] ?? "tools",
      tone: options.tones?.["chat-tools"] ?? toneVar(chat.vocabulary.types.tool?.tone ?? "tool", "var(--pbui-tone-neutral)"),
      group,
      blurb: "what is waiting for you, and every tool call across conversations",
      singleton: true,
      Component: () => (
        <PanelApp part="chat-tools-app">
          <ToolsTile />
        </PanelApp>
      ),
    }),
    /*
     * Doc-bound, unlike the other four: what the model was told is a fact
     * about ONE conversation, and two of these side by side comparing two
     * agents is the point rather than a duplicate.
     */
    defineApp({
      id: "conversation-context",
      title: options.titles?.["conversation-context"] ?? "agent context",
      tone: options.tones?.["conversation-context"] ?? toneVar(chat.vocabulary.types.conversation?.tone ?? "conversation", "var(--pbui-pane-alt)"),
      group,
      blurb: "what this agent was told: its tools, the last message it sent, its environment",
      singleton: false,
      docBound: true,
      duplicable: true,
      bindings: [CONVERSATION_BINDING],
      titleFor: (view) => {
        const id = view.documents[CONVERSATION_BINDING];
        if (!id) return view.title || "agent context";
        return view.title || `context · ${chat.conversations.get(id)?.title ?? id.slice(0, 8)}`;
      },
      Component: (props) => (
        <PanelApp part="conversation-context-app">
          <ContextTile {...props} />
        </PanelApp>
      ),
    }),
  ];
}
