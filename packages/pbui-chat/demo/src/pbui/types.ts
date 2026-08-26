import type {
  ProposalValue,
  Reference,
  SourceValue,
  ToolValue,
  TraceEntryValue,
  UnresolvedValue,
  WidgetValue,
} from "@hyperslop-systems/pbui-chat";

/*
 * The gold-coin shop's objects. Every value is the WIRE REFERENCE for its
 * type (pbui-chat's convention, see its `Reference` doc), so a descriptor
 * reads `ref.id` for identity and `ref.value` for what the server resolved.
 * Type aliases rather than interfaces: an alias has an implicit index
 * signature and so satisfies `Record<string, unknown>` where a verb carries
 * a reference.
 */

export type ProductValue = {
  name: string;
  sku?: string;
  metal?: string;
  categoryId?: string;
  category?: string;
  price?: number;
  stock?: number;
  reorderPoint?: number;
  /** Units sold over the last 30 days; what a days-of-cover program divides by. */
  sold30d?: number;
};

export type CategoryValue = {
  name: string;
  count?: number;
  tableId?: string;
};

export type MetalValue = {
  name: string;
  spot?: number;
  unit?: string;
  tableId?: string;
};

export type OrderValue = {
  customer?: string;
  total?: number;
  status?: string;
  placedAt?: string;
  items?: number;
};

/**
 * A tile, as an object. Mirrors pbui-workbench's `TileRef` minus its
 * `placementId`, which IS the reference id — the same split every other type
 * here makes between identity and resolved value.
 */
export type TileValue = {
  viewId: string;
  appId: string;
  title: string;
  /** Set only when a human named this tile, so Rename can offer to clear it. */
  customTitle?: string;
  placementCount: number;
  canClose: boolean;
  duplicable: boolean;
  workspaceId?: string;
};

export type WorkspaceValue = {
  name: string;
  tileCount: number;
  active: boolean;
};

export type AppValue = {
  title: string;
  singleton: boolean;
  docBound: boolean;
  blurb?: string;
};

/**
 * A program the agent (or a human) wrote, as an object. `id` is the library
 * id (`prg-7`); the source is not in the value — `describe()` reads it from
 * the library, so a mention stays small and the inspector shows the code.
 */
export type ProgramValue = {
  title: string;
  version?: number;
  bindings?: string[];
  by?: "agent" | "human";
  pinned?: boolean;
  lastError?: string;
};

/** A generated action, as an object; `id` is the library id (`act-3`). */
export type ActionValue = {
  label: string;
  types?: string[];
  behaviour?: string;
  by?: "agent" | "human";
  pinned?: boolean;
};

/**
 * A conversation with an agent, as an object. The id IS the chat session id,
 * so a mention of one is a mention of the session the server knows.
 */
export type ConversationValue = {
  title: string;
  messageCount?: number;
  streaming?: boolean;
  active?: boolean;
  pinned?: boolean;
  archived?: boolean;
  open?: boolean;
  model?: string | null;
};

/**
 * One entry of chat-provider's classified debug stream: a frame, a lifecycle
 * change, a projected UI event. The id is `<conversationId>:<entryId>`, so a
 * mention of one names the conversation it belongs to as well.
 */
export type ChatEventValue = {
  conversationId: string;
  seq: number;
  at: number;
  family: string;
  eventType: string;
  eventId: string;
  summary: string;
  event: Record<string, unknown>;
};

export type FieldValue = {
  tableId: string;
  name: string;
  type?: string;
};

export type RowValue = {
  tableId: string;
  index: number;
  cells: Record<string, unknown>;
};

export interface Values {
  product: Reference<ProductValue>;
  category: Reference<CategoryValue>;
  metal: Reference<MetalValue>;
  order: Reference<OrderValue>;
  tile: Reference<TileValue>;
  workspace: Reference<WorkspaceValue>;
  app: Reference<AppValue>;
  program: Reference<ProgramValue>;
  action: Reference<ActionValue>;
  conversation: Reference<ConversationValue>;
  chatEvent: Reference<ChatEventValue>;
  field: Reference<FieldValue>;
  row: Reference<RowValue>;
  source: Reference<SourceValue>;
  widget: Reference<WidgetValue>;
  tool: Reference<ToolValue>;
  proposal: Reference<ProposalValue>;
  traceEntry: Reference<TraceEntryValue>;
  unresolved: Reference<UnresolvedValue>;
}

export type PresentationType = keyof Values;

/** What a descriptor may read besides its value. */
export interface Environment {
  /** The signed-in user may approve reorders and proposals. */
  canApprove: boolean;
  sessionId: string | null;
}

export const DEFAULT_ENVIRONMENT: Environment = { canApprove: false, sessionId: null };

/** One tone token per type; the same strings go into the vocabulary. */
export const TONES: Record<PresentationType, string> = {
  product: "var(--pbui-tone-product)",
  category: "var(--pbui-tone-category)",
  metal: "var(--pbui-tone-metal)",
  order: "var(--pbui-tone-order)",
  tile: "var(--pbui-selected)",
  workspace: "var(--pbui-tone-neutral)",
  app: "var(--pbui-pane-alt)",
  program: "var(--pbui-tone-widget)",
  action: "var(--pbui-tone-neutral)",
  conversation: "var(--pbui-pane-alt)",
  chatEvent: "var(--pbui-tone-trace)",
  field: "var(--pbui-tone-field)",
  row: "var(--pbui-tone-row)",
  source: "var(--pbui-tone-source)",
  widget: "var(--pbui-tone-widget)",
  tool: "var(--pbui-tone-tool)",
  proposal: "var(--pbui-tone-proposal)",
  traceEntry: "var(--pbui-tone-trace)",
  unresolved: "var(--pbui-tone-neutral)",
};
