import { defineVocabulary, verbSpecsFromSchema, type TypeSpec } from "@hyperslop-systems/pbui-chat";
import { SANDBOX_INTENTS, SANDBOX_UI_KINDS } from "@hyperslop-systems/pbui-sandbox";
import { TONES, type PresentationType } from "./types";
import { VERB_DOCS, VerbSchema } from "./verbs";

/**
 * What the model is told about this interface, and what the server validates
 * its output against. `pnpm vocab` writes `exportVocabulary(vocabulary)` to
 * pkg/chatserver/demo/vocabulary.json; the Go binary embeds that file.
 */
const types: Record<PresentationType, TypeSpec> = {
  product: {
    doc: "a sellable coin SKU in the shop inventory",
    idHint: "products.id (a number)",
    tone: TONES.product,
    verbs: ["inspect", "watch", "compareWith", "askAgent", "reorder"],
    example: "[[product:2049|1oz American Gold Eagle 2024]]",
  },
  category: {
    doc: "a product category",
    idHint: "categories.id",
    tone: TONES.category,
    verbs: ["inspect", "askAgent", "addFilter"],
    example: "[[category:7|American Gold Eagles]]",
  },
  metal: {
    doc: "a precious metal (gold, silver, platinum, palladium)",
    idHint: "metal slug",
    tone: TONES.metal,
    verbs: ["inspect", "addFilter", "askAgent"],
    example: "[[metal:gold|gold]]",
  },
  order: {
    doc: "a customer order",
    idHint: "orders.id",
    tone: TONES.order,
    verbs: ["inspect", "watch", "askAgent"],
    example: "[[order:88213|order 88213]]",
  },
  tile: {
    doc: "one pane of the user's screen, showing one application",
    idHint: "placementId, from workbench_describe",
    tone: TONES.tile,
    verbs: ["tile.split", "tile.close", "tile.replace", "tile.link", "view.setTitle", "view.goTo", "askAgent"],
    example: "[[tile:n-7|inventory]]",
  },
  workspace: {
    doc: "a named tree of tiles; the user sees one at a time",
    idHint: "workspaceId, from workbench_describe",
    tone: TONES.workspace,
    verbs: ["workspace.select", "workspace.rename", "workspace.delete", "workspace.clone", "askAgent"],
    example: "[[workspace:ws-2|Gold desk]]",
  },
  app: {
    doc: "an application that can be placed in a tile",
    idHint: "appId, from workbench_describe",
    tone: TONES.app,
    verbs: ["app.place", "askAgent"],
    example: "[[app:inventory|inventory]]",
  },
  program: {
    doc: "a small program written in the sandbox dialect, running in a tile",
    idHint: "programId, from sandbox_describe or the tool that created it",
    tone: TONES.program,
    verbs: ["program.open", "inspect", "program.pin", "program.remove", "askAgent"],
    example: "[[program:prg-7|Days of cover]]",
  },
  action: {
    doc: "a generated action in the menu of some presentation types",
    idHint: "actionId, from sandbox_describe",
    tone: TONES.action,
    verbs: ["inspect", "action.remove", "askAgent"],
    example: "[[action:act-3|Days of cover]]",
  },
  conversation: {
    doc: "one conversation with an agent; the id is its chat session id",
    idHint: "conversationId, from conversation_list",
    tone: TONES.conversation,
    verbs: [
      "conversation.open",
      "conversation.select",
      "conversation.rename",
      "conversation.pin",
      "conversation.archive",
      "conversation.close",
      "conversation.forget",
      "conversation.send",
      "inspect",
      "askAgent",
    ],
    example: "[[conversation:3f0a…|reorder desk]]",
  },
  field: {
    doc: "a column of a table the agent produced",
    idHint: "<tableId>.<column>",
    tone: TONES.field,
    verbs: ["inspect", "addFilter", "sortBy", "askAgent"],
    example: "[[field:t3.qty|qty]]",
  },
  row: {
    doc: "one row of a table the agent produced",
    idHint: "<tableId>#<rowIndex>",
    tone: TONES.row,
    verbs: ["inspect", "watch", "askAgent"],
  },
  source: {
    doc: "a piece of evidence the agent cited",
    idHint: "evidence id E<n>",
    tone: TONES.source,
    verbs: ["inspect", "askAgent"],
    example: "[[source:E2|pricing policy §3]]",
  },
  widget: {
    doc: "a widget the agent published",
    idHint: "widget id returned by pbui_widget",
    tone: TONES.widget,
    verbs: ["inspect", "openInTile", "askAgent"],
  },
  tool: {
    doc: "a tool call the agent made",
    idHint: "tool call id",
    tone: TONES.tool,
    verbs: ["inspect", "rerunTool", "askAgent"],
  },
  proposal: {
    doc: "a consequential action awaiting a human decision",
    idHint: "proposal id",
    tone: TONES.proposal,
    verbs: ["inspect", "resolveProposal", "askAgent"],
  },
  traceEntry: {
    doc: "one performed verb in the session trace",
    idHint: "sequence number",
    tone: TONES.traceEntry,
    verbs: ["inspect", "askAgent"],
  },
  unresolved: {
    doc: "a mention the server could not resolve",
    idHint: "the original type and id",
    tone: TONES.unresolved,
    verbs: ["askAgent"],
  },
};

export const vocabulary = defineVocabulary({
  product: "pbui-chat-demo",
  types,
  verbs: verbSpecsFromSchema(VerbSchema, VERB_DOCS),
  widgetKinds: ["text", "refs", "meter", "sparkline", "segmented", "stat", "callout", "table", "log", "form", "widget"],
  layouts: ["stack", "row", "grid"],
  conversions: [{ from: "row", to: "product" }],
  // The program dialect the model is taught; the same lists the renderer and
  // the reducer are built against (PBUI-AGENT-3 D12).
  sandbox: { kinds: SANDBOX_UI_KINDS, intents: SANDBOX_INTENTS },
});
