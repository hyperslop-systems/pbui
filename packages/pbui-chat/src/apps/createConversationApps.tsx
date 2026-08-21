import { defineApp, type AppDescriptor } from "@hyperslop-systems/pbui-workbench";
import { ConversationsTile } from "../conversations/ConversationsTile";
import type { ConversationRegistry } from "../conversations/registry";
import { toneVar } from "../tone";
import type { Vocabulary } from "../vocabulary/schemas";
import { PanelApp } from "./PanelApp";

export type ConversationAppId = "conversations";

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
  ];
}
