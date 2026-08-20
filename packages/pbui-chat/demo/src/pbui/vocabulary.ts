import { defineVocabulary, verbSpecsFromSchema, type TypeSpec } from "@hyperslop-systems/pbui-chat";
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
});
