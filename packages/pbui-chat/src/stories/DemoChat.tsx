import { ChatProvider, timelineSlice, useChatStore, type ChatProviderConfig, type TimelineEntity } from "@go-go-golems/chat-provider";
import { useEffect, type ReactNode } from "react";
import { chat } from "../../demo/src/chat";
import type { Environment } from "../../demo/src/pbui/types";
import type { Reference } from "../types";
import type { WidgetDocument } from "../vocabulary/schemas";

/*
 * The stories borrow the demo product (its registry, vocabulary and router)
 * and a real chat-provider store that is seeded rather than connected: no
 * backend, but the same reference index, outlets and adapters the app uses.
 * Verbs fire for real; with no session id the router skips the trace POST.
 */

const storyConfig: ChatProviderConfig = {
  basePrefix: "",
  extensions: [chat.extension],
  sendMessageBody: chat.sendMessageBody,
  sessionPolicy: { restore: "never" },
};

const STORY_ENVIRONMENT: Environment = { canApprove: true, sessionId: "story" };

function Seed({ entities }: { entities: TimelineEntity[] }) {
  const store = useChatStore();
  useEffect(() => {
    store.dispatch(timelineSlice.actions.clear());
    for (const entity of entities) store.dispatch(timelineSlice.actions.upsertEntity(entity));
  }, [store, entities]);
  return null;
}

export function DemoChat({
  children,
  entities = [],
  environment = STORY_ENVIRONMENT,
}: {
  children: ReactNode;
  entities?: TimelineEntity[];
  environment?: Environment;
}) {
  return (
    <ChatProvider config={storyConfig}>
      <chat.Provider environment={environment}>
        <Seed entities={entities} />
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--pbui-space-4)", maxWidth: 720 }}>{children}</div>
        <chat.MouseDocLine ambient="storybook" />
        <chat.ObjectMenu />
        <chat.AcceptBanner />
      </chat.Provider>
    </ChatProvider>
  );
}

/* ---- fixtures ------------------------------------------------------------ */

export const eagle: Reference = {
  type: "product",
  id: "2049",
  value: { name: "1oz American Gold Eagle 2024", sku: "AGE-2024-1", metal: "gold", price: 2610, stock: 12, reorderPoint: 20, category: "American Gold Eagles" },
  provenance: { messageId: "m2" },
};
export const buffalo: Reference = {
  type: "product",
  id: "2051",
  value: { name: "1oz Gold Buffalo 2024", sku: "BUF-2024-1", metal: "gold", price: 2645, stock: 31, reorderPoint: 15 },
  provenance: { messageId: "m2" },
};
export const eagles: Reference = { type: "category", id: "7", value: { name: "American Gold Eagles", count: 14 } };
export const gold: Reference = { type: "metal", id: "gold", value: { name: "gold", spot: 2498.4, unit: "USD/oz" } };
export const policy: Reference = { type: "source", id: "E2", value: { evidenceId: "E2", title: "pricing policy §3", locator: "docs/pricing.md#3" } };

export function refsEntity(messageId: string, refs: Reference[]): TimelineEntity {
  return {
    id: `${messageId}-refs`,
    kind: "widget",
    createdAt: 1,
    props: {
      instanceId: `${messageId}-refs`,
      widgetName: "pbui.refs",
      parentMessageId: messageId,
      status: "READY",
      props: { schema_version: 1, refs: Object.fromEntries(refs.map((r) => [`${r.type}:${r.id}`, r])) },
    },
  };
}

export function messageEntity(id: string, role: "user" | "assistant" | "thinking", content: string, extra: Record<string, unknown> = {}): TimelineEntity {
  return { id, kind: "message", createdAt: 1, props: { role, content, status: "finished", streaming: false, ...extra } };
}

export function widgetEntity(id: string, document: WidgetDocument, status = "READY"): TimelineEntity {
  return {
    id,
    kind: "widget",
    createdAt: 1,
    props: { instanceId: id, widgetName: "pbui.widget", parentMessageId: "m2", status, props: document as unknown as Record<string, unknown> },
  };
}

export const healthDocument: WidgetDocument = {
  format: "pbui.widget",
  schema_version: 1,
  title: "Gold Eagle health",
  tone: "product",
  layout: "grid",
  columns: 2,
  children: [
    { kind: "stat", label: "price", value: 2610, unit: "USD", delta: "+1.2%", ref: eagle },
    { kind: "stat", label: "stock", value: 12, unit: "pcs", delta: -8 },
    { kind: "meter", label: "stock vs reorder point", value: 12, max: 20, ref: eagle },
    { kind: "sparkline", label: "units sold, last 14 days", values: [3, 4, 2, 6, 5, 7, 4, 8, 9, 6, 7, 10, 8, 11], ref: eagle },
    { kind: "segmented", label: "sales by channel", parts: [{ label: "web", value: 62, tone: "accent" }, { label: "shop", value: 28, tone: "positive" }, { label: "phone", value: 10 }] },
    { kind: "refs", label: "related", refs: [eagles, gold, policy] },
    { kind: "text", text: "Stock for [[product:2049|the Eagle]] is **below** its reorder point; see [[source:E2|pricing policy §3]]." },
    { kind: "callout", tone: "warning", text: "Reorder lead time from the mint is 9 days." },
  ],
  verbs: [
    { label: "Refresh", verb: { kind: "rerunTool", toolCallId: "tc_31" } },
    { label: "Watch", verb: { kind: "watch", ref: eagle } },
    { label: "Compare…", verb: { kind: "compareWith", left: eagle } },
    { label: "Reorder", verb: { kind: "reorder", productId: "2049" }, danger: true },
    { label: "Teleport", verb: { kind: "teleport", to: "mars" } },
  ],
};

export const tableDocument: WidgetDocument = {
  format: "pbui.widget",
  schema_version: 1,
  title: "Top sellers this week",
  layout: "stack",
  children: [
    {
      kind: "table",
      docId: "t3",
      streaming: true,
      columns: [{ name: "id", type: "n" }, { name: "name", type: "n" }, { name: "metal", type: "n" }, { name: "qty", type: "q" }, { name: "revenue", type: "q" }],
      rows: [
        [2049, "1oz American Gold Eagle 2024", "gold", 41, 107010],
        [2051, "1oz Gold Buffalo 2024", "gold", 22, 58190],
        [3102, "1oz Silver Maple 2024", "silver", 310, 11470],
        [2077, "1/4oz Gold Krugerrand", "gold", 9, 6210],
        [4410, "1oz Platinum Eagle", "platinum", 4, 4360],
      ],
    },
  ],
  verbs: [
    { label: "Sort by revenue", verb: { kind: "sortBy", tableId: "t3", field: "revenue", dir: "desc" } },
    { label: "Only gold", verb: { kind: "addFilter", tableId: "t3", field: "metal", op: "=", value: "gold" } },
  ],
};

export const formDocument: WidgetDocument = {
  format: "pbui.widget",
  schema_version: 1,
  title: "Reorder draft",
  children: [
    { kind: "text", text: "Fill in the reorder for [[product:2049|the Eagle]] and I will price it." },
    {
      kind: "form",
      submitLabel: "Price it",
      fields: [
        { name: "product", label: "product", input: "object", accepts: ["product"], required: true },
        { name: "qty", label: "quantity", input: "number", required: true },
        { name: "supplier", label: "supplier", input: "select", options: ["US Mint", "A-Mark", "Dillon Gage"] },
        { name: "note", label: "note", input: "text" },
      ],
    },
  ],
};

export const nestedDocument: WidgetDocument = {
  format: "pbui.widget",
  schema_version: 1,
  title: "Metals overview",
  layout: "row",
  children: [
    { kind: "widget", document: { format: "pbui.widget", schema_version: 1, title: "gold", tone: "product", children: [{ kind: "stat", label: "spot", value: 2498.4, unit: "USD/oz", delta: "+0.4%", ref: gold }] } },
    { kind: "widget", document: { format: "pbui.widget", schema_version: 1, title: "silver", children: [{ kind: "stat", label: "spot", value: 29.1, unit: "USD/oz", delta: "-1.1%" }] } },
    { kind: "log", entries: [{ level: "info", text: "quotes refreshed", at: "10:15" }, { level: "warn", text: "platinum feed stale", at: "10:16" }] },
  ],
};

export const transcript: TimelineEntity[] = [
  refsEntity("m2", [eagle, buffalo, eagles, gold, policy]),
  messageEntity("m1", "user", "how is [[product:2049|the Eagle]] doing this week?", { refs: [eagle] }),
  messageEntity("m2-thinking", "thinking", "The user asks about product 2049. I should check sales and stock."),
  messageEntity(
    "m2",
    "assistant",
    "[[product:2049|The Eagle]] sold 41 units, well ahead of [[product:2051|the Buffalo]]. Stock is **12**, under the reorder point of `20` — [[source:E2|pricing policy §3]] says to reorder at that level.\n\n- category: [[category:7|American Gold Eagles]]\n- metal: [[metal:gold|gold]]\n- mystery: [[order:99999|an order I cannot resolve]]",
  ),
  widgetEntity("m2-w1", healthDocument),
  widgetEntity("m2-w2", tableDocument, "STREAMING"),
  {
    id: "tc_31",
    kind: "tool_call",
    createdAt: 1,
    props: { toolCallId: "tc_31", toolName: "sales_report", parentMessageId: "m2", status: "success", input: { product: 2049, days: 7 }, result: { units: 41, revenue: 107010 } },
  },
  {
    id: "m2-err",
    kind: "widget",
    createdAt: 1,
    props: { instanceId: "m2-err", widgetName: "pbui.error", parentMessageId: "m2", status: "READY", props: { message: 'children[2] has unknown kind "hologram"' } },
  },
  {
    id: "trace-1",
    kind: "trace_entry",
    createdAt: 1,
    props: { seq: 1, actor: "human", verb: { kind: "inspect", ref: eagle }, target: eagle, outcome: "performed", at: "2026-08-20T10:15:30Z" },
  },
];
