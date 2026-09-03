import {
  CONVERSATION_VERB_DOCS,
  ConversationVerbSchemas,
  describeConversationVerb,
  isConversationVerb,
  ReferenceSchema,
  type ConversationVerb,
  type VerbDocs,
} from "@hyperslop-systems/pbui-chat";
import { describeWorkbenchVerb, type WorkbenchVerb } from "@hyperslop-systems/pbui-workbench";
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

  /*
   * The workbench commands, spelled EXACTLY as `@hyperslop-systems/workbench-core`
   * spells them, plus the two launcher shell actions. The agent's tools emit
   * these objects unchanged and the local handler hands them to
   * `workbench.perform`, so one action has one name across the tool schema,
   * the vocabulary, the object menu and the trace.
   */
  z.object({ kind: z.literal("placement.duplicate"), placementId: z.string(), axis: z.enum(["row", "col"]).optional() }),
  z.object({ kind: z.literal("placement.close"), placementId: z.string() }),
  z.object({ kind: z.literal("placement.swap"), a: z.string(), b: z.string() }),
  z.object({ kind: z.literal("placement.dock"), source: z.string(), target: z.string(), edge: z.enum(["left", "right", "top", "bottom"]) }),
  z.object({ kind: z.literal("placement.replaceWith"), source: z.string(), target: z.string() }),
  z.object({ kind: z.literal("placement.resize"), splitId: z.string(), ratio: z.number(), snap: z.boolean().optional() }),
  z.object({
    kind: z.literal("view.show"),
    view: z.union([
      z.object({ kind: z.literal("existing"), viewId: z.string() }),
      z.object({ kind: z.literal("application"), appId: z.string(), documents: z.record(z.string(), z.string()).optional(), title: z.string().optional(), reuse: z.enum(["manifest-default", "same-bindings", "never"]).optional(), requestedViewId: z.string().optional() }),
    ]),
    placement: z.union([
      z.object({ kind: z.literal("navigate") }),
      z.object({ kind: z.literal("auto"), near: z.string().optional() }),
      z.object({ kind: z.literal("split"), target: z.string().optional(), edge: z.enum(["left", "right", "top", "bottom"]).optional(), axis: z.enum(["row", "col"]).optional() }),
      z.object({ kind: z.literal("replace"), target: z.string() }),
    ]),
  }),
  z.object({ kind: z.literal("view.configure"), viewId: z.string(), title: z.string().optional(), documents: z.record(z.string(), z.string()).optional() }),
  z.object({ kind: z.literal("session.selectWorkspace"), workspaceId: z.string() }),
  z.object({ kind: z.literal("session.activatePlacement"), placementId: z.string().nullable() }),
  z.object({ kind: z.literal("workspace.create"), name: z.string(), layout: z.record(z.string(), z.unknown()).optional(), workspaceId: z.string().optional(), select: z.boolean().optional() }),
  z.object({ kind: z.literal("workspace.rename"), workspaceId: z.string(), name: z.string() }),
  z.object({ kind: z.literal("workspace.delete"), workspaceId: z.string() }),
  z.object({ kind: z.literal("workspace.clone"), workspaceId: z.string(), name: z.string().optional(), newWorkspaceId: z.string().optional(), select: z.boolean().optional() }),
  z.object({ kind: z.literal("launcher.open"), from: z.string().optional() }),
  z.object({ kind: z.literal("launcher.close") }),

  /*
   * The sandbox verbs (PBUI-AGENT-3 D4): the vocabulary stays closed, and a
   * generated program or action is a PAYLOAD of one of these five kinds —
   * never a kind of its own. The agent's sandbox_* tools emit them, the
   * program/action descriptors offer them, and the local handler expands
   * `action.run` into whatever the stored action says.
   */
  z.object({ kind: z.literal("program.open"), programId: z.string(), documents: z.record(z.string(), z.string()).optional(), near: z.string().optional(), title: z.string().optional() }),
  z.object({ kind: z.literal("program.remove"), programId: z.string() }),
  z.object({ kind: z.literal("program.pin"), programId: z.string(), pinned: z.boolean() }),
  z.object({ kind: z.literal("action.run"), actionId: z.string(), ref: ReferenceSchema }),
  z.object({ kind: z.literal("action.remove"), actionId: z.string() }),

  /*
   * The conversation verbs, spelled exactly as pbui-chat spells them — the
   * same argument as the workbench verbs above. The package owns the payload
   * shapes and the refusal wording so a trace from one PBUI product reads in
   * another; this union only declares that the shop offers them.
   */
  ...ConversationVerbSchemas,
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

  "placement.duplicate": { doc: "open a second pane beside a tile" },
  "placement.close": { doc: "close a tile", danger: true },
  "placement.swap": { doc: "exchange what two tiles show" },
  "placement.dock": { doc: "move a tile to an edge of another" },
  "placement.replaceWith": { doc: "move a tile onto another, closing what it showed", danger: true },
  "placement.resize": { doc: "move a divider" },
  "view.show": { doc: "show an application or an existing view somewhere on screen" },
  "view.configure": { doc: "name a tile, or point it at different documents" },
  "session.selectWorkspace": { doc: "show a different workspace" },
  "session.activatePlacement": { doc: "make a tile the keyboard target" },
  "workspace.create": { doc: "create a workspace of tiles" },
  "workspace.rename": { doc: "rename a workspace" },
  "workspace.delete": { doc: "delete a workspace and its tiles", danger: true },
  "workspace.clone": { doc: "duplicate a workspace" },
  "launcher.open": { doc: "open the launcher" },
  "launcher.close": { doc: "close the launcher" },

  "program.open": { doc: "open a stored program in a tile, bound to the given documents" },
  "program.remove": { doc: "remove a program from the library and close its tiles", danger: true },
  "program.pin": { doc: "pin a program so the agent cannot change or remove it unasked" },
  "action.run": { doc: "perform a generated action on an object" },
  "action.remove": { doc: "remove a generated action from every menu", danger: true },

  ...CONVERSATION_VERB_DOCS,
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
    case "program.open":
      return `open program ${verb.programId}${verb.documents && Object.keys(verb.documents).length ? ` on ${JSON.stringify(verb.documents)}` : ""}`;
    case "program.remove":
      return `remove program ${verb.programId}`;
    case "program.pin":
      return `${verb.pinned ? "pin" : "unpin"} program ${verb.programId}`;
    case "action.run":
      return `run action ${verb.actionId} on <${verb.ref.type}> ${verb.ref.id}`;
    case "action.remove":
      return `remove action ${verb.actionId}`;
    default:
      // The workbench and conversation verbs describe themselves; their
      // packages own the wording so the object menu, the chrome buttons and
      // the trace agree.
      if (isConversationVerb(verb)) return describeConversationVerb(verb as ConversationVerb);
      return describeWorkbenchVerb(verb as unknown as WorkbenchVerb);
  }
}
