import { documentSlotPort } from "@hyperslop-systems/pbui";
import { defineWorkbenchApp, type WorkbenchApp } from "@hyperslop-systems/pbui-workbench";
import { ActiveConversationScope } from "../conversations/ActiveConversationScope";
import { CONVERSATION_BINDING } from "../conversations/bindings";
import type { ConversationRegistry } from "../conversations/registry";
import { ChatInspectorPanel, TracePanel, WatchlistPanel } from "../panels";
import { toneVar } from "../tone";
import type { Vocabulary } from "../vocabulary/schemas";
import { ChatApp } from "./ChatApp";
import { PanelApp } from "./PanelApp";
import { WIDGET_BINDING, WidgetApp } from "./WidgetApp";

export type ChatAppId = "chat" | "inspector" | "watchlist" | "trace" | "widget";

export interface CreateChatAppsOptions {
  /** Override a tile's bar tone (a token reference); defaults read the vocabulary's tones. */
  tones?: Partial<Record<ChatAppId, string>>;
  /** Override a tile's title. */
  titles?: Partial<Record<ChatAppId, string>>;
}

/**
 * The chat layer's applications for a pbui-workbench: the conversation, the
 * three panels as singletons, and the doc-bound `widget` tile that "Open in
 * tile" opens. A product passes the result to `createWorkbench({ apps })`
 * and may add its own descriptors beside them.
 *
 * Takes the chat's vocabulary rather than the whole chat: the tones come
 * from there, and everything else the components need they read from the
 * chat's Provider at render time.
 */
export function createChatApps(
  chat: { vocabulary: Vocabulary; conversations: ConversationRegistry },
  options: CreateChatAppsOptions = {},
): WorkbenchApp[] {
  const tone = (id: ChatAppId, type: string, fallback: string) =>
    options.tones?.[id] ?? toneVar(chat.vocabulary.types[type]?.tone ?? type, fallback);
  const title = (id: ChatAppId, fallback: string) => options.titles?.[id] ?? fallback;

  return [
    /*
     * The conversation is a DOCUMENT the chat application is bound to, not
     * the application itself (guide D3). Two tiles with two bindings are two
     * agents; two placements of one view are one agent seen twice, which is
     * what splitting a tile has always meant. The workbench's doc-binding
     * rule gives de-duplication, titles and linked splits for free.
     */
    defineWorkbenchApp({
      manifest: {
        id: "chat",
        ports: [documentSlotPort(CONVERSATION_BINDING, "the conversation this tile is a view of")],
      },
      presentation: {
        title: title("chat", "chat"),
        tone: tone("chat", "message", "var(--pbui-pane-alt)"),
        titleFor: (view) => {
          const id = view.documents[CONVERSATION_BINDING];
          if (!id) return view.title || "chat";
          return view.title || chat.conversations.get(id)?.title || `conversation ${id.slice(0, 8)}`;
        },
        Component: ChatApp,
      },
    }),
    defineWorkbenchApp({
      manifest: {
        id: "inspector",
        viewCardinality: "one",
      },
      presentation: {
        title: title("inspector", "inspector"),
        tone: options.tones?.inspector ?? "var(--pbui-selected)",
        Component: () => (
          <PanelApp part="inspector-app">
            <ChatInspectorPanel />
          </PanelApp>
        ),
      },
    }),
    defineWorkbenchApp({
      manifest: {
        id: "watchlist",
        viewCardinality: "one",
      },
      presentation: {
        title: title("watchlist", "watchlist"),
        tone: options.tones?.watchlist ?? "var(--pbui-pane-alt)",
        Component: () => (
          <PanelApp part="watchlist-app">
            <WatchlistPanel />
          </PanelApp>
        ),
      },
    }),
    defineWorkbenchApp({
      manifest: {
        id: "trace",
      },
      presentation: {
        title: title("trace", "trace"),
        tone: tone("trace", "traceEntry", "var(--pbui-tone-neutral)"),
        Component: () => (
          <PanelApp part="trace-app">
            <ActiveConversationScope>
              <TracePanel />
            </ActiveConversationScope>
          </PanelApp>
        ),
      },
    }),
    defineWorkbenchApp({
      manifest: {
        id: "widget",
        duplicatePlacement: "link",
        ports: [documentSlotPort(WIDGET_BINDING, "the widget this tile shows")],
      },
      presentation: {
        title: title("widget", "widget"),
        tone: tone("widget", "widget", "var(--pbui-tone-neutral)"),
        titleFor: (view) => view.title || `widget ${view.documents[WIDGET_BINDING] ?? ""}`.trim(),
        Component: WidgetApp,
      },
    }),
  ];
}
