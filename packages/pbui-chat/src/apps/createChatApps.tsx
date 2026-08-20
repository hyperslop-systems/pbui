import { defineApp, type AppDescriptor } from "@hyperslop-systems/pbui-workbench";
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
export function createChatApps(chat: { vocabulary: Vocabulary }, options: CreateChatAppsOptions = {}): AppDescriptor[] {
  const tone = (id: ChatAppId, type: string, fallback: string) =>
    options.tones?.[id] ?? toneVar(chat.vocabulary.types[type]?.tone ?? type, fallback);
  const title = (id: ChatAppId, fallback: string) => options.titles?.[id] ?? fallback;

  return [
    defineApp({
      id: "chat",
      title: title("chat", "chat"),
      tone: tone("chat", "message", "var(--pbui-pane-alt)"),
      singleton: false,
      Component: ChatApp,
    }),
    defineApp({
      id: "inspector",
      title: title("inspector", "inspector"),
      tone: options.tones?.inspector ?? "var(--pbui-selected)",
      singleton: true,
      Component: () => (
        <PanelApp part="inspector-app">
          <ChatInspectorPanel />
        </PanelApp>
      ),
    }),
    defineApp({
      id: "watchlist",
      title: title("watchlist", "watchlist"),
      tone: options.tones?.watchlist ?? "var(--pbui-pane-alt)",
      singleton: true,
      Component: () => (
        <PanelApp part="watchlist-app">
          <WatchlistPanel />
        </PanelApp>
      ),
    }),
    defineApp({
      id: "trace",
      title: title("trace", "trace"),
      tone: tone("trace", "traceEntry", "var(--pbui-tone-neutral)"),
      singleton: true,
      Component: () => (
        <PanelApp part="trace-app">
          <TracePanel />
        </PanelApp>
      ),
    }),
    defineApp({
      id: "widget",
      title: title("widget", "widget"),
      tone: tone("widget", "widget", "var(--pbui-tone-neutral)"),
      singleton: false,
      docBound: true,
      duplicable: false,
      titleFor: (view) => view.title || `widget ${view.documents[WIDGET_BINDING] ?? ""}`.trim(),
      Component: WidgetApp,
    }),
  ];
}
