import {
  createPbuiChat,
  createVerbRouter,
  isConversationVerb,
  performConversationVerb,
  type ConversationVerb,
  type Reference,
  type VerbFamily,
} from "@hyperslop-systems/pbui-chat";
import { substituteVerbRef, type UIReference } from "@hyperslop-systems/pbui-sandbox";
import {
  describeWorkbench,
  describeWorkbenchVerb,
  isWorkbenchVerb,
  performWorkbenchVerb,
  type Workbench,
  type WorkbenchVerb,
} from "@hyperslop-systems/pbui-workbench";
import { pbui } from "./pbui/runtime";
import { registry } from "./pbui/registry";
import type { Environment, Values } from "./pbui/types";
import type { Verb, VerbKind } from "./pbui/verbs";
import { vocabulary } from "./pbui/vocabulary";
import { library, resolveDemoBinding } from "./sandbox";

/**
 * Which family performs each verb. `local` never talks to the model,
 * `agent` becomes a typed message, `tool` answers a parked human tool.
 */
const FAMILIES: Record<VerbKind, VerbFamily> = {
  inspect: "local",
  watch: "local",
  addFilter: "local",
  sortBy: "local",
  openInTile: "local",
  compareWith: "agent",
  askAgent: "agent",
  rerunTool: "agent",
  reorder: "agent",
  resolveProposal: "tool",

  /*
   * Every workbench verb is LOCAL: it changes this browser's layout and
   * nothing else. Routing them through the router rather than calling
   * `wb.verbs.*` directly is what puts an agent's rearrangement in the trace
   * beside a human's, with the same validation and the same rejection
   * strings — the price is this one indirection.
   */
  "tile.split": "local",
  "tile.close": "local",
  "tile.swap": "local",
  "tile.dock": "local",
  "tile.activate": "local",
  "tile.replace": "local",
  "tile.link": "local",
  "split.resize": "local",
  "app.place": "local",
  "view.setTitle": "local",
  "view.open": "local",
  "view.rebind": "local",
  "view.goTo": "local",
  "workspace.select": "local",
  "workspace.create": "local",
  "workspace.rename": "local",
  "workspace.delete": "local",
  "workspace.clone": "local",
  "launcher.open": "local",
  "launcher.close": "local",

  // The sandbox verbs are local too: they change this browser's library and
  // layout. `action.run` may EXPAND into an agent verb, through ctx.perform,
  // so the trace records both the action and what it became.
  "program.open": "local",
  "program.remove": "local",
  "program.pin": "local",
  "action.run": "local",
  "action.remove": "local",

  /*
   * Conversations: four are local — they change this browser's list and
   * layout — and `conversation.send` is an AGENT verb whose target is a
   * conversation other than the one performing it. That asymmetry is the
   * handoff, and it is the only place `sendToAgent`'s target argument is
   * used by the shop.
   */
  "conversation.new": "local",
  "conversation.open": "local",
  "conversation.select": "local",
  "conversation.rename": "local",
  "conversation.pin": "local",
  "conversation.archive": "local",
  "conversation.close": "local",
  "conversation.forget": "local",
  "conversation.send": "agent",
};

/** Every tile showing a program, across workspaces, by placement id. */
function tilesShowing(wb: Workbench, programId: string): string[] {
  return describeWorkbench(wb).workspaces.flatMap((workspace) =>
    workspace.tiles.filter((tile) => tile.appId === "script" && tile.documents.program === programId).map((tile) => tile.placementId),
  );
}

export const router = createVerbRouter<Verb>({
  families: (verb) => FAMILIES[verb.kind],

  local: async (verb, ctx) => {
    // pbui-chat owns the conversation verbs for the same reason the workbench
    // owns its own: one dispatcher, one set of refusal strings, one wording
    // across every product in the family.
    if (isConversationVerb(verb)) {
      await performConversationVerb(verb as ConversationVerb, {
        actor: ctx.actor,
        conversations: chat.conversations,
        workbench: chat.workbench(),
        send: (conversationId, template, refs) => ctx.sendToAgent(template, refs, { conversationId }),
      });
      return;
    }
    // The workbench owns its own verbs; `performWorkbenchVerb` is the single
    // dispatcher, so a verb added to the package needs no case here.
    if (isWorkbenchVerb(verb)) {
      const wb = chat.workbench();
      if (!wb) throw new Error("no workbench is attached");
      const workbenchVerb = verb as unknown as WorkbenchVerb;
      // Throwing on a refusal is what turns it into `rejected:…` in the trace
      // and in the tool result. Swallowing it told the agent that a close of a
      // stale placement, or of the last tile, had landed.
      if (!performWorkbenchVerb(wb.verbs, workbenchVerb)) {
        throw new Error(`the workbench refused to ${describeWorkbenchVerb(workbenchVerb)}`);
      }
      return;
    }
    switch (verb.kind) {
      case "inspect":
        ctx.store.inspect(verb.ref, `<${verb.ref.type}> ${ctx.labelFor(verb.ref)}`);
        return;
      case "watch":
        ctx.store.watch(verb.ref);
        return;
      case "addFilter":
        if (!verb.tableId) throw new Error("no table to filter");
        ctx.store.addFilter(verb.tableId, { field: verb.field, op: verb.op, value: verb.value });
        return;
      case "sortBy":
        ctx.store.sortBy(verb.tableId, verb.field, verb.dir);
        return;
      case "openInTile":
        // A widget tile in the workbench when one is attached, else the
        // TilesPanel list; the binding decides.
        ctx.openTile(verb.widgetId);
        return;

      case "program.open": {
        const wb = chat.workbench();
        if (!wb) throw new Error("no workbench is attached");
        const program = library.getState().programs[verb.programId];
        if (!program) throw new Error(`no program ${verb.programId} in the library`);
        const near = verb.near ?? wb.activePlacementId() ?? undefined;
        const placed = wb.verbs.openView("script", { program: program.id, ...(verb.documents ?? {}) }, { ...(near ? { near } : {}), ...(verb.title ? { title: verb.title } : {}) });
        if (!placed) throw new Error(`the workbench refused to open ${program.title}`);
        return;
      }
      case "program.remove": {
        const wb = chat.workbench();
        if (!library.getState().programs[verb.programId]) throw new Error(`no program ${verb.programId} in the library`);
        // Close its tiles first: a tile bound to a program that is gone shows
        // an empty state, which is honest but not what "remove" means.
        if (wb) for (const placementId of tilesShowing(wb, verb.programId)) wb.verbs.close(placementId);
        library.removeProgram(verb.programId);
        return;
      }
      case "program.pin":
        if (!library.setPinned("program", verb.programId, verb.pinned)) throw new Error(`no program ${verb.programId} in the library`);
        return;
      case "action.remove":
        if (!library.removeAction(verb.actionId)) throw new Error(`no action ${verb.actionId} in the library`);
        return;
      case "action.run": {
        const action = library.getState().actions[verb.actionId];
        if (!action) throw new Error(`no action ${verb.actionId} in the library`);
        const ref = verb.ref;
        switch (action.behaviour.kind) {
          case "openProgram":
            await ctx.perform(
              {
                kind: "program.open",
                programId: action.behaviour.programId,
                documents: { [action.behaviour.bind ?? ref.type]: ref.id },
              },
              ref as Reference,
            );
            return;
          case "verb":
            await ctx.perform(substituteVerbRef(action.behaviour.verb, ref as UIReference), ref as Reference);
            return;
          case "askAgent":
            await ctx.sendToAgent(action.behaviour.template, [ref as Reference]);
            return;
        }
        return;
      }
      default:
        throw new Error(`${verb.kind} is not a local verb`);
    }
  },

  agent: async (verb, ctx) => {
    // The handoff: a message to a conversation OTHER than the one this verb
    // came from. Everything below sends to the verb's own conversation.
    if (verb.kind === "conversation.send") {
      await ctx.sendToAgent(verb.template, verb.refs ?? [], { conversationId: verb.conversationId });
      return;
    }
    switch (verb.kind) {
      case "compareWith": {
        const right =
          verb.right ??
          (await ctx.accept({ types: [verb.left.type], prompt: "pick the object to compare against" }));
        if (!right) throw new Error("cancelled: nothing picked to compare against");
        await ctx.sendToAgent("compare {0} with {1}", [verb.left, right]);
        return;
      }
      case "askAgent":
        await ctx.sendToAgent(verb.template, verb.refs);
        return;
      case "rerunTool": {
        const args = verb.args ? ` with arguments ${JSON.stringify(verb.args)}` : "";
        await ctx.sendToAgent(`please run {0} again${args}`, [{ type: "tool", id: verb.toolCallId }]);
        return;
      }
      case "reorder":
        await ctx.sendToAgent("draft a reorder for {0} and propose it to me", [{ type: "product", id: verb.productId }]);
        return;
      default:
        throw new Error(`${verb.kind} is not an agent verb`);
    }
  },

  // resolveProposal is performed by the proposal card itself: it answers the
  // parked pbui_propose tool through chat-provider's respond() and only
  // routes here so the trace records the decision. Nothing else to do.
  tool: () => {},
});

/** Where the demo keeps the conversation records; the layout is a separate key. */
export const CONVERSATIONS_STORAGE_KEY = "pbui-chat-demo.conversations";
/** What the one-session build persisted, and what a returning browser is migrated from. */
export const LEGACY_SESSION_KEY = "pbui-chat-demo.session";

export const chat = createPbuiChat<Values, Environment, Verb>({
  pbui,
  registry,
  vocabulary,
  router,
  basePrefix: "",
  conversations: { key: CONVERSATIONS_STORAGE_KEY },
  // The library and the engine are attached by workbench.ts, which owns them;
  // the dry-run resolver is the same one the tiles use.
  sandbox: { resolve: resolveDemoBinding },
});
