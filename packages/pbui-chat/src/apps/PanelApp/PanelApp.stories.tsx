import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect } from "react";
import { usePbuiChat } from "../../context";
import { ChatInspectorPanel, TracePanel, WatchlistPanel } from "../../panels";
import { DemoChat, eagle, gold } from "../../stories/DemoChat";
import { PanelApp } from "./PanelApp";

const meta: Meta = {
  title: "Apps/PanelApp",
};
export default meta;

function Seed() {
  const chat = usePbuiChat();
  useEffect(() => {
    chat.store.inspect(eagle, "<product> 1oz American Gold Eagle 2024");
    chat.store.watch(eagle);
    chat.store.watch(gold);
  }, [chat]);
  return null;
}

export const ThePanelsAsTiles: StoryObj = {
  name: "inspector, watchlist and trace, each in the panel frame",
  render: () => (
    <DemoChat>
      <Seed />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gridTemplateRows: "minmax(0, 1fr)", gap: 8, height: 320 }}>
        <div style={{ display: "grid", gridTemplateRows: "minmax(0, 1fr)", minHeight: 0, overflow: "auto", border: "var(--pbui-border-hair)" }}>
          <PanelApp part="inspector-app">
            <ChatInspectorPanel />
          </PanelApp>
        </div>
        <div style={{ display: "grid", gridTemplateRows: "minmax(0, 1fr)", minHeight: 0, overflow: "auto", border: "var(--pbui-border-hair)" }}>
          <PanelApp part="watchlist-app">
            <WatchlistPanel />
          </PanelApp>
        </div>
        <div style={{ display: "grid", gridTemplateRows: "minmax(0, 1fr)", minHeight: 0, overflow: "auto", border: "var(--pbui-border-hair)" }}>
          <PanelApp part="trace-app">
            <TracePanel />
          </PanelApp>
        </div>
      </div>
    </DemoChat>
  ),
};
