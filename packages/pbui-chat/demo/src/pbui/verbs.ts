import { ReferenceSchema, type VerbDocs } from "@hyperslop-systems/pbui-chat";
import { z } from "zod";

/**
 * Every action, as data. The zod union is the single declaration: the
 * descriptors are typed against `Verb`, the chips are validated against the
 * vocabulary, and the vocabulary's verb fields are DERIVED from this schema
 * (`verbSpecsFromSchema`), so the three cannot drift.
 */
export const VerbSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("inspect"), ref: ReferenceSchema }),
  z.object({ kind: z.literal("watch"), ref: ReferenceSchema }),
  z.object({ kind: z.literal("compareWith"), left: ReferenceSchema, right: ReferenceSchema.optional() }),
  z.object({ kind: z.literal("askAgent"), template: z.string(), refs: z.array(ReferenceSchema) }),
  z.object({ kind: z.literal("addFilter"), tableId: z.string(), field: z.string(), op: z.string(), value: z.string() }),
  z.object({ kind: z.literal("sortBy"), tableId: z.string(), field: z.string(), dir: z.enum(["asc", "desc"]) }),
  z.object({ kind: z.literal("openInTile"), widgetId: z.string() }),
  z.object({ kind: z.literal("rerunTool"), toolCallId: z.string(), args: z.record(z.string(), z.unknown()).optional() }),
  z.object({ kind: z.literal("resolveProposal"), id: z.string(), decision: z.enum(["approve", "reject"]) }),
  z.object({ kind: z.literal("reorder"), productId: z.string() }),
]);

export type Verb = z.infer<typeof VerbSchema>;
export type VerbKind = Verb["kind"];

/** The one-line docs the model reads, plus which verbs it may never perform itself. */
export const VERB_DOCS: VerbDocs = {
  inspect: { doc: "show the object in the inspector" },
  watch: { doc: "pin the object to the watchlist" },
  compareWith: { doc: "compare the object with another of the same type (enters accept mode)" },
  askAgent: { doc: "send the agent a question about the objects" },
  addFilter: { doc: "filter a table by a field" },
  sortBy: { doc: "sort a table by a field" },
  openInTile: { doc: "open the widget in its own tile" },
  rerunTool: { doc: "ask the agent to run the tool again" },
  resolveProposal: { doc: "approve or reject a proposal", danger: true },
  reorder: { doc: "draft a reorder for the product", danger: true },
};

export interface Action {
  label: string;
  verb: Verb;
  danger?: boolean;
  description?: string;
  /** Present exactly when the action cannot be performed, and why. */
  disabledBecause?: string;
}

export function describeVerb(verb: Verb): string {
  switch (verb.kind) {
    case "inspect":
      return `inspect <${verb.ref.type}> ${verb.ref.id}`;
    case "watch":
      return `watch <${verb.ref.type}> ${verb.ref.id}`;
    case "compareWith":
      return verb.right ? `compare ${verb.left.id} with ${verb.right.id}` : `compare ${verb.left.id} with…`;
    case "askAgent":
      return `ask: ${verb.template}`;
    case "addFilter":
      return `filter ${verb.tableId} where ${verb.field} ${verb.op} ${verb.value || "…"}`;
    case "sortBy":
      return `sort ${verb.tableId} by ${verb.field} ${verb.dir}`;
    case "openInTile":
      return `open ${verb.widgetId} in a tile`;
    case "rerunTool":
      return `re-run ${verb.toolCallId}`;
    case "resolveProposal":
      return `${verb.decision} proposal ${verb.id}`;
    case "reorder":
      return `reorder product ${verb.productId}`;
  }
}
