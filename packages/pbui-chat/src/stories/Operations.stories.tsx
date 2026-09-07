import type { Meta, StoryObj } from "@storybook/react-vite";
import type { TimelineEntity } from "@go-go-golems/chat-provider";
import { useEffect, type ReactNode } from "react";
import { chat } from "../../demo/src/chat";
import { EventsTile } from "../conversations/EventsTile";
import { RunsTile } from "../conversations/RunsTile";
import { ToolsTile } from "../conversations/ToolsTile";
import { TracePanel } from "../panels/TracePanel";
import { DemoChat, eagle } from "./DemoChat";

const meta: Meta = { title: "pbui-chat/Operational Panels" };
export default meta;

const entities: TimelineEntity[] = [
  { id: "trace-target", kind: "trace_entry", createdAt: 1, props: { seq: 1, actor: "human", verb: { kind: "inspect" }, target: eagle, outcome: "performed", at: "2026-09-06T12:00:00Z" } },
  { id: "trace-no-target", kind: "trace_entry", createdAt: 2, props: { seq: 2, actor: "agent", verb: { kind: "close_workspace" }, outcome: "rejected: cannot close the last workspace; keep the current investigation available", at: "2026-09-06T12:00:01Z" } },
  { id: "tool-failed", kind: "tool_call", createdAt: 3, props: { toolCallId: "fixture-failed", toolName: "inspect_" + "long_identifier_".repeat(3), status: "failed", input: { exact: "9007199254740993.00" }, error: "Unavailable receipt: " + "abcdef0123456789".repeat(5) } },
  { id: "tool-ok", kind: "tool_call", createdAt: 4, props: { toolCallId: "fixture-ok", toolName: "sales_report", status: "success", input: { product: "2049" }, result: { amount: "120.00" } } },
];

function SeedDebug() {
  useEffect(() => {
    chat.debug.clear("story");
    chat.debug.push("story", { type: "ws-lifecycle", sessionId: "story", event: "failed" });
    chat.debug.push("story", { type: "ui-event", sessionId: "story", name: "fixture_event_" + "long_identifier_".repeat(5) });
    chat.conversations.adopt("style-closed", { title: "Closed investigation " + "long_identifier_".repeat(4), model: "fixture-model-with-long-name" });
    return () => { chat.debug.clear("story"); chat.conversations.forget("style-closed"); };
  }, []);
  return null;
}

function Frame({ children, width = 640 }: { children: ReactNode; width?: number }) {
  return <DemoChat entities={entities}><SeedDebug /><div style={{ width, maxWidth: "100%", height: 360, minWidth: 0, display: "flex", flexDirection: "column", overflow: "auto", border: "var(--pbui-border-hair)" }}>{children}</div></DemoChat>;
}

export const TraceWide: StoryObj = { render: () => <Frame><TracePanel /></Frame> };
export const TraceNarrow: StoryObj = { render: () => <Frame width={280}><TracePanel /></Frame> };
export const RunsWide: StoryObj = { render: () => <Frame><RunsTile /></Frame> };
export const RunsNarrow: StoryObj = { render: () => <Frame width={280}><RunsTile /></Frame> };
export const EventsWide: StoryObj = { render: () => <Frame><EventsTile /></Frame> };
export const EventsNarrow: StoryObj = { render: () => <Frame width={280}><EventsTile /></Frame> };
export const ToolsWide: StoryObj = { render: () => <Frame><ToolsTile /></Frame> };
export const ToolsNarrow: StoryObj = { render: () => <Frame width={280}><ToolsTile /></Frame> };
