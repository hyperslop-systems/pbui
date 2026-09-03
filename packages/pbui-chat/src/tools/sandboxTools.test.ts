import { documentSlotPort } from "@hyperslop-systems/pbui";
import { describe, expect, it } from "vitest";
import { createAppRegistry, createWorkbench, defineApp, layout, split, tile } from "@hyperslop-systems/pbui-workbench";
import {
  createInstanceRegistry,
  BROKEN_RENDER_PROGRAM,
  COUNTER_PROGRAM,
  DAYS_OF_COVER_PROGRAM,
  PRODUCT_2049,
  createEvalEngine,
  createProgramLibrary,
  memoryStorage,
  type UIReference,
} from "@hyperslop-systems/pbui-sandbox";
import type { FrontendTool } from "@go-go-golems/chat-provider";
import { defineVocabulary } from "../vocabulary/defineVocabulary";
import type { Outcome, VerbLike } from "../types";
import { createSandboxTools, type SandboxToolsOptions } from "./sandboxTools";
import type { ApprovalLedger } from "./approvalLedger";
import { AgentEffectGateway } from "./agentEffectGateway";

function effectGateway(approved: ReadonlySet<string>): AgentEffectGateway {
  const consumed = new Set<string>();
  const reserved = new Map<string, string>();
  const approvalLedger: ApprovalLedger = {
    async lookup(id) {
      return approved.has(id)
        ? { id, subjectDigest: id, issuedAt: "2026-08-25T00:00:00.000Z", expiresAt: "2099-01-01T00:00:00.000Z" }
        : null;
    },
    async reserve(capability, _subject, effectId) {
      if (consumed.has(capability.id)) return "already-used";
      reserved.set(capability.id, effectId);
      return "reserved";
    },
    async finalize(capability, effectId) {
      if (reserved.get(capability.id) !== effectId) return "wrong-effect";
      reserved.delete(capability.id);
      consumed.add(capability.id);
      return "finalized";
    },
    async release(capability, effectId) {
      if (reserved.get(capability.id) !== effectId) return "wrong-effect";
      reserved.delete(capability.id);
      return "released";
    },
  };
  return new AgentEffectGateway({ approvalLedger });
}

const Blank = () => null;

const apps = createAppRegistry([
  defineApp({ id: "chat", title: "chat", tone: "var(--pbui-pane-alt)", singleton: false, Component: Blank }),
  defineApp({ id: "script", title: "program", tone: "var(--pbui-pane-alt)", singleton: false, duplicable: false, ports: [documentSlotPort("program")], Component: Blank }),
]);

const vocabulary = defineVocabulary({
  product: "test",
  types: { product: { doc: "a product", verbs: ["watch"] }, program: { doc: "a program" }, action: { doc: "an action" } },
  verbs: {
    watch: { doc: "watch", fields: { ref: "ref" } },
    "program.open": { doc: "open", fields: { programId: "string", "documents?": "object", "near?": "string", "title?": "string" } },
    "program.remove": { doc: "remove", fields: { programId: "string" } },
    "action.remove": { doc: "remove", fields: { actionId: "string" } },
  },
  widgetKinds: ["text"],
});

/**
 * A library, an engine, a workbench and the router seam. `performed` records
 * what reached the router; the fake local handler does what the demo's does
 * for program.open / program.remove so tiles diff the way they will in the app.
 */
function harness(overrides: Partial<SandboxToolsOptions> = {}) {
  const library = createProgramLibrary({ key: "t", storage: memoryStorage() });
  const engine = createEvalEngine();
  const wb = createWorkbench({ apps, initial: layout(split("row", 0.6, tile("chat"), tile("chat"))) });
  const performed: VerbLike[] = [];
  const options: SandboxToolsOptions = {
    getLibrary: () => library,
    getEngine: () => engine,
    getWorkbench: () => wb,
    resolve: (key, id) => (key === "product" && id === "2049" ? (PRODUCT_2049 as UIReference) : null),
    vocabulary,
    senderConversationId: "agent-a",
    effectGateway: new AgentEffectGateway(),
    perform: async (verb) => {
      performed.push(verb);
      if (verb.kind === "program.open") {
        const near = (verb.near as string | undefined) ?? wb.activePlacementId() ?? undefined;
        wb.verbs.openView("script", { program: verb.programId as string, ...((verb.documents as Record<string, string>) ?? {}) }, near ? { near } : {});
      }
      if (verb.kind === "program.remove") library.removeProgram(verb.programId as string);
      if (verb.kind === "action.remove") library.removeAction(verb.actionId as string);
      return "performed" as Outcome;
    },
    ...overrides,
  };
  const tools = createSandboxTools(options);
  const byName = (name: string) => tools.tools.find((tool) => tool.name === name) as FrontendTool<any, any>;
  let callSequence = 0;
  const call = (name: string, input: unknown) => {
    callSequence += 1;
    return Promise.resolve(byName(name).execute(input as never, { signal: new AbortController().signal, toolCallId: `t${callSequence}` }));
  };
  return { library, engine, wb, performed, tools, byName, call };
}

describe("createSandboxTools · surface", () => {
  it("registers seven provider-safe tools, unavailable until a sandbox is attached", () => {
    const { tools, byName } = harness();
    expect(tools.tools.map((t) => t.name)).toEqual([
      "sandbox_describe",
      "sandbox_test",
      "sandbox_create_app",
      "sandbox_update_app",
      "sandbox_open",
      "sandbox_define_action",
      "sandbox_remove",
    ]);
    for (const tool of tools.tools) expect(tool.name).toMatch(/^[a-zA-Z0-9_-]+$/);
    expect((byName("sandbox_test").available as () => boolean)()).toBe(true);
    const detached = createSandboxTools({ ...harness(), getLibrary: () => null, getEngine: () => null, getWorkbench: () => null, resolve: () => null, perform: async () => "performed" as Outcome, senderConversationId: "agent-a", effectGateway: new AgentEffectGateway() });
    expect((detached.tools[0]!.available as () => boolean)()).toBe(false);
  });

  it("advertises schemas without $ref", () => {
    const { tools } = harness();
    for (const tool of tools.tools) expect(JSON.stringify(tool.parameters)).not.toContain("$ref");
  });
});

describe("sandbox_test", () => {
  it("renders, replays events and stores nothing", async () => {
    const { call, library } = harness();
    const result = (await call("sandbox_test", { source: COUNTER_PROGRAM, events: [{ handler: "increment" }, { handler: "increment" }] })) as any;
    expect(result.ok).toBe(true);
    expect(result.meta).toMatchObject({ title: "Minimal Counter", widgets: ["main"], bindings: [] });
    expect(result.intents).toHaveLength(2);
    expect(result.state).toEqual({ value: 2 });
    expect(result.trees.main.children[0]).toEqual({ kind: "text", text: "Count: 2" });
    expect(library.getState().programs).toEqual({});
  });

  it("reports the phase of a failure", async () => {
    const { call } = harness();
    const result = (await call("sandbox_test", { source: BROKEN_RENDER_PROGRAM })) as any;
    expect(result).toMatchObject({ ok: false, phase: "render", code: "RUNTIME_ERROR" });
    expect(result.error).toMatch(/TypeError/);
    const syntax = (await call("sandbox_test", { source: "definePlugin(({ui}) => ({ title: 'x', widgets: { main: { render() { return ui.text(<b/>) } } } }))" })) as any;
    expect(syntax).toMatchObject({ ok: false, phase: "load", code: "RUNTIME_ERROR" });
    expect(syntax.error).toMatch(/SyntaxError/);
  });

  it("resolves bindings for the dry render", async () => {
    const { call } = harness();
    const result = (await call("sandbox_test", { source: DAYS_OF_COVER_PROGRAM, documents: { product: "2049" } })) as any;
    expect(result.ok).toBe(true);
    expect(result.trees.main.children[0].children[1]).toEqual({ kind: "badge", text: "short" });
  });
});

describe("sandbox_create_app", () => {
  it("stores after a clean run and opens a tile through the router", async () => {
    const { call, library, performed, wb } = harness();
    const result = (await call("sandbox_create_app", { title: "Counter", source: COUNTER_PROGRAM })) as any;
    expect(result).toMatchObject({ ok: true, programId: "prg-1", version: 1, wentToExisting: false, warnings: [] });
    expect(result.placementId).toBeTruthy();
    expect(library.getState().programs["prg-1"]).toMatchObject({ title: "Counter", by: "agent", pinned: false });
    expect(performed).toEqual([{ kind: "program.open", programId: "prg-1", documents: {}, title: "Counter" }]);
    expect(wb.store.getState().document.viewOrder).toHaveLength(3);
  });

  it("stores nothing when the program fails, and names the phase", async () => {
    const { call, library, performed } = harness();
    const result = (await call("sandbox_create_app", { title: "Broken", source: BROKEN_RENDER_PROGRAM })) as any;
    expect(result).toMatchObject({ ok: false, phase: "render" });
    expect(library.getState().programs).toEqual({});
    expect(performed).toEqual([]);
  });

  it("stores a program with unmet bindings but does not open it, and says why", async () => {
    const { call, performed } = harness();
    const result = (await call("sandbox_create_app", { title: "Days", source: DAYS_OF_COVER_PROGRAM })) as any;
    expect(result.ok).toBe(true);
    expect(result.bindings).toEqual(["product"]);
    expect(result.warnings[0]).toMatch(/needs a "product" binding; call sandbox_open/);
    expect(performed).toEqual([]);
    const opened = (await call("sandbox_open", { programId: result.programId, documents: { product: "2049" } })) as any;
    expect(opened).toMatchObject({ ok: true, wentToExisting: false });
    const again = (await call("sandbox_open", { programId: result.programId, documents: { product: "2049" } })) as any;
    expect(again).toMatchObject({ ok: true, wentToExisting: true });
  });

  it("honours a deny policy", async () => {
    const { call } = harness({ policy: { "program.create": "deny" } });
    const result = (await call("sandbox_create_app", { title: "x", source: COUNTER_PROGRAM })) as any;
    expect(result.error).toMatch(/not something the assistant may do/);
  });
});

describe("sandbox_update_app", () => {
  it("bumps the version on success and keeps the old one on failure", async () => {
    const { call, library } = harness();
    const created = (await call("sandbox_create_app", { title: "Counter", source: COUNTER_PROGRAM, open: false })) as any;
    const broken = (await call("sandbox_update_app", { programId: created.programId, source: BROKEN_RENDER_PROGRAM })) as any;
    expect(broken).toMatchObject({ ok: false, phase: "render", keptVersion: 1 });
    expect(library.getState().programs["prg-1"]!.version).toBe(1);
    const good = (await call("sandbox_update_app", { programId: created.programId, source: COUNTER_PROGRAM.replace("Count: ", "Total: ") })) as any;
    expect(good).toMatchObject({ ok: true, version: 2 });
    expect(library.getState().programs["prg-1"]!.source).toContain("Total: ");
  });

  it("needs an approval for a pinned program, spent once", async () => {
    const approvals = new Set(["p-1"]);
    const { call, library } = harness({ effectGateway: effectGateway(approvals) });
    const created = (await call("sandbox_create_app", { title: "Counter", source: COUNTER_PROGRAM, open: false })) as any;
    library.setPinned("program", created.programId, true);
    const refused = (await call("sandbox_update_app", { programId: created.programId, source: COUNTER_PROGRAM })) as any;
    expect(refused.error).toMatch(/needs the user's approval \(it is pinned or human-made\)/);
    const ok = (await call("sandbox_update_app", { programId: created.programId, source: COUNTER_PROGRAM, confirmationId: "p-1" })) as any;
    expect(ok.ok).toBe(true);
    const reused = (await call("sandbox_update_app", { programId: created.programId, source: COUNTER_PROGRAM, confirmationId: "p-1" })) as any;
    expect(reused.error).toMatch(/already been used/);
  });
});

describe("limits", () => {
  it("refuses a source over the byte limit at the load phase, storing nothing", async () => {
    const { call, library } = harness({ limits: { sourceBytes: 40 } });
    const result = (await call("sandbox_create_app", { title: "big", source: COUNTER_PROGRAM })) as any;
    expect(result).toMatchObject({ ok: false, phase: "load" });
    expect(result.error).toMatch(/limit is 40/);
    expect(library.getState().programs).toEqual({});
  });

  it("refuses a tree over the node limit with a path-free message", async () => {
    const { call } = harness({ limits: { treeNodes: 3 } });
    const result = (await call("sandbox_test", { source: COUNTER_PROGRAM })) as any;
    expect(result).toMatchObject({ ok: false, phase: "render", code: "VALIDATION_ERROR" });
    expect(result.error).toMatch(/more than 3 nodes/);
  });
});

describe("sandbox_define_action and sandbox_remove", () => {
  it("validates types, programs, verbs and templates", async () => {
    const { call, library } = harness();
    expect((await call("sandbox_define_action", { label: "x", types: ["widget"], behaviour: { kind: "askAgent", template: "{0}" } })) as any).toMatchObject({
      error: expect.stringContaining("unknown presentation type widget"),
    });
    expect((await call("sandbox_define_action", { label: "x", types: ["product"], behaviour: { kind: "openProgram", programId: "prg-9" } })) as any).toMatchObject({
      error: expect.stringContaining('no program "prg-9"'),
    });
    expect((await call("sandbox_define_action", { label: "x", types: ["product"], behaviour: { kind: "verb", verb: { kind: "frobnicate", ref: "$ref" } } })) as any).toMatchObject({
      error: expect.stringContaining("unknown verb frobnicate"),
    });
    expect((await call("sandbox_define_action", { label: "x", types: ["product"], behaviour: { kind: "askAgent", template: "why?" } })) as any).toMatchObject({
      error: expect.stringContaining("{0}"),
    });
    const ok = (await call("sandbox_define_action", { label: "Watch it", types: ["product"], behaviour: { kind: "verb", verb: { kind: "watch", ref: "$ref" } } })) as any;
    expect(ok).toMatchObject({ ok: true, actionId: "act-1" });
    expect(library.getState().actions["act-1"]).toMatchObject({ label: "Watch it", by: "agent" });
  });

  it("removes through the router and reports the tiles it closed", async () => {
    const { call, performed, library } = harness();
    const created = (await call("sandbox_create_app", { title: "Counter", source: COUNTER_PROGRAM })) as any;
    const removed = (await call("sandbox_remove", { programId: created.programId })) as any;
    expect(removed).toMatchObject({ ok: true, removed: "program", closedTiles: [created.placementId] });
    expect(performed.at(-1)).toEqual({ kind: "program.remove", programId: created.programId });
    expect(library.getState().programs).toEqual({});
    expect((await call("sandbox_remove", {})) as any).toMatchObject({ error: "pass exactly one of programId or actionId" });
  });

  it("refuses to remove a human-made program without approval", async () => {
    const { call, library } = harness();
    library.putProgram({ title: "Seed", source: COUNTER_PROGRAM, bindings: [], meta: { widgets: ["main"] }, by: "human", pinned: true });
    const refused = (await call("sandbox_remove", { programId: "prg-1" })) as any;
    expect(refused.error).toMatch(/needs the user's approval/);
    expect(library.getState().programs["prg-1"]).toBeTruthy();
  });
});

describe("sandbox_describe", () => {
  it("lists programs with where they are open, actions, and the dialect", async () => {
    const { call } = harness();
    const created = (await call("sandbox_create_app", { title: "Counter", source: COUNTER_PROGRAM })) as any;
    await call("sandbox_define_action", { label: "Ask", types: ["product"], behaviour: { kind: "askAgent", template: "tell me about {0}" } });
    const described = (await call("sandbox_describe", {})) as any;
    expect(described.engine).toBe("eval");
    expect(described.dsl.kinds).toContain("ref");
    expect(described.programs).toEqual([expect.objectContaining({ id: "prg-1", title: "Counter", openIn: [created.placementId] })]);
    expect(described.actions).toEqual([expect.objectContaining({ id: "act-1", label: "Ask" })]);
    // No registry attached: nothing claims to know what is running.
    expect(described.programs[0].running).toBeUndefined();
    expect(described.programs[0].history).toBe(0);
  });

  it("reports running instances from the registry — status, tiles, timings, the error", async () => {
    const instances = createInstanceRegistry();
    const { call } = harness({ getInstances: () => instances });
    await call("sandbox_create_app", { title: "Counter", source: COUNTER_PROGRAM });
    instances.mount("v-1", "n-1");
    instances.mount("v-1", "n-2");
    instances.publish("v-1", { programId: "prg-1", version: 1, status: "error", instanceId: "v-1:prg-1:v1#1", timings: { renders: 3, events: 1, errors: 1, timeouts: 1, lastRenderMs: 101.26 }, error: { phase: "render", code: "RUNTIME_TIMEOUT", message: "interrupted" } });
    const described = (await call("sandbox_describe", {})) as any;
    expect(described.programs[0].running).toEqual([
      { viewId: "v-1", version: 1, status: "error", tiles: 2, lastRenderMs: 101.3, renders: 3, events: 1, errors: 1, timeouts: 1, error: "render: RUNTIME_TIMEOUT: interrupted" },
    ]);
    instances.unmount("v-1", "n-1");
    instances.unmount("v-1", "n-2");
    expect(((await call("sandbox_describe", {})) as any).programs[0].running).toEqual([]);
  });
});
