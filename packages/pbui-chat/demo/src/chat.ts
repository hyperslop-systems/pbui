import { createPbuiChat, createVerbRouter, type VerbFamily } from "@hyperslop-systems/pbui-chat";
import { isWorkbenchVerb, performWorkbenchVerb, type WorkbenchVerb } from "@hyperslop-systems/pbui-workbench";
import { pbui } from "./pbui/runtime";
import { registry } from "./pbui/registry";
import type { Environment, Values } from "./pbui/types";
import type { Verb, VerbKind } from "./pbui/verbs";
import { vocabulary } from "./pbui/vocabulary";

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
};

export const router = createVerbRouter<Verb>({
  families: (verb) => FAMILIES[verb.kind],

  local: (verb, ctx) => {
    // The workbench owns its own verbs; `performWorkbenchVerb` is the single
    // dispatcher, so a verb added to the package needs no case here.
    if (isWorkbenchVerb(verb)) {
      const wb = chat.workbench();
      if (!wb) throw new Error("no workbench is attached");
      performWorkbenchVerb(wb.verbs, verb as unknown as WorkbenchVerb);
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
      default:
        throw new Error(`${verb.kind} is not a local verb`);
    }
  },

  agent: async (verb, ctx) => {
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

export const chat = createPbuiChat<Values, Environment, Verb>({
  pbui,
  registry,
  vocabulary,
  router,
  basePrefix: "",
});
