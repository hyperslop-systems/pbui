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
   * The workbench verbs, spelled EXACTLY as `@hyperslop-systems/pbui-workbench`
   * spells them. The agent's tools emit these objects unchanged and the local
   * handler hands them to `performWorkbenchVerb`, so one action has one name
   * across the tool schema, the vocabulary, the object menu and the trace. A
   * parallel set of product names would mean four places to keep in step and
   * a translation layer that exists only to rename things.
   */
  z.object({ kind: z.literal("tile.split"), placementId: z.string(), direction: z.enum(["row", "col"]), appId: z.string().optional() }),
  z.object({ kind: z.literal("tile.close"), placementId: z.string() }),
  z.object({ kind: z.literal("tile.swap"), a: z.string(), b: z.string() }),
  z.object({ kind: z.literal("tile.dock"), source: z.string(), target: z.string(), zone: z.enum(["left", "right", "top", "bottom"]) }),
  z.object({ kind: z.literal("tile.activate"), placementId: z.string() }),
  z.object({ kind: z.literal("tile.replace"), placementId: z.string(), appId: z.string(), documents: z.record(z.string(), z.string()).optional() }),
  z.object({ kind: z.literal("tile.link"), placementId: z.string(), viewId: z.string() }),
  z.object({ kind: z.literal("split.resize"), splitId: z.string(), ratio: z.number() }),
  z.object({ kind: z.literal("app.place"), appId: z.string(), from: z.string().optional() }),
  z.object({ kind: z.literal("view.setTitle"), viewId: z.string(), title: z.string() }),
  z.object({ kind: z.literal("view.open"), appId: z.string(), documents: z.record(z.string(), z.string()), near: z.string().optional(), title: z.string().optional() }),
  z.object({ kind: z.literal("view.rebind"), viewId: z.string(), documents: z.record(z.string(), z.string()) }),
  z.object({ kind: z.literal("view.goTo"), viewId: z.string() }),
  z.object({ kind: z.literal("workspace.select"), workspaceId: z.string() }),
  z.object({ kind: z.literal("workspace.create"), name: z.string(), spec: z.record(z.string(), z.unknown()).optional(), workspaceId: z.string().optional(), select: z.boolean().optional() }),
  z.object({ kind: z.literal("workspace.rename"), workspaceId: z.string(), name: z.string() }),
  z.object({ kind: z.literal("workspace.delete"), workspaceId: z.string() }),
  z.object({ kind: z.literal("workspace.clone"), workspaceId: z.string(), name: z.string().optional(), newWorkspaceId: z.string().optional(), select: z.boolean().optional() }),
  z.object({ kind: z.literal("launcher.open"), placementId: z.string().optional() }),
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

  "tile.split": { doc: "open a new pane beside a tile" },
  "tile.close": { doc: "close a tile", danger: true },
  "tile.swap": { doc: "exchange what two tiles show" },
  "tile.dock": { doc: "move a tile to an edge of another" },
  "tile.activate": { doc: "make a tile the keyboard target" },
  "tile.replace": { doc: "show a different application in a tile", danger: true },
  "tile.link": { doc: "show an existing view in a tile too" },
  "split.resize": { doc: "move a divider" },
  "app.place": { doc: "open an application beside the active tile" },
  "view.setTitle": { doc: "name a tile, or clear its name" },
  "view.open": { doc: "open an application on specific documents in a new tile" },
  "view.rebind": { doc: "point a tile at different documents" },
  "view.goTo": { doc: "go to the tile showing a view" },
  "workspace.select": { doc: "show a different workspace" },
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
