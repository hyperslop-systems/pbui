import type { FrontendTool, ToolDefinition } from "@go-go-golems/chat-provider";
import { describeWorkbench, type Workbench } from "@hyperslop-systems/pbui-workbench";
import { type ActionBehaviour, type ActionRecord, BOOTSTRAP_VERSION, DEFAULT_LIMITS, type DispatchIntent, type InstanceRegistry, type LoadedProgram, type ProgramEngine, type ProgramErrorPayload, type ProgramGlobalState, type ProgramLibrary, type ProgramRecord, SANDBOX_INTENTS, SANDBOX_UI_KINDS, type SandboxLimits, type UINode, type UIReference, byteLength, countNodes, reducePluginIntent, substituteVerbRef, toProgramError, validateUINode } from "@hyperslop-systems/pbui-sandbox";
import { z } from "zod";
import type { Outcome, VerbLike } from "../types";
import type { Vocabulary } from "../vocabulary/schemas";
import { validateVerb } from "../vocabulary/validate";
import type { PolicyDecision } from "./workbenchTools";

/* ---- policy ------------------------------------------------------------- */

export type SandboxPolicyKey = "program.create" | "program.update" | "program.open" | "program.remove" | "action.define" | "action.remove";
export type SandboxPolicy = Record<SandboxPolicyKey, PolicyDecision>;

/**
 * What the agent may do to the library unassisted. `confirm` is the same
 * mechanism the workbench tools use: a `pbui_propose` id the product's
 * `isApproved(id, verb)` recognises, spent once, only after the change
 * performed. A pinned or human-made artifact escalates `allow` to `confirm`
 * for update and removal, whatever the table says.
 */
export const DEFAULT_SANDBOX_POLICY: SandboxPolicy = {
  "program.create": "allow",
  "program.update": "allow",
  "program.open": "allow",
  "program.remove": "allow",
  "action.define": "allow",
  "action.remove": "allow",
};

/* ---- the factory --------------------------------------------------------- */

export interface SandboxToolsOptions {
  /** The library, read at call time; null until `attachSandbox` runs, and the tools are simply not offered. */
  getLibrary(): ProgramLibrary | null;
  getEngine(): ProgramEngine | null;
  /** The workbench programs open in; null disables opening but not creating or testing. */
  getWorkbench(): Workbench | null;
  /** The instance registry, when the product runs one: `sandbox_describe` then reports what is running and how it is doing. */
  getInstances?(): InstanceRegistry | null;
  /** Perform a verb through the PRODUCT's router with `actor: "agent"`, so the trace records it. */
  perform(verb: VerbLike): Promise<Outcome>;
  /** Resolve a binding for a dry render, the same way the tile does. */
  resolve(key: string, id: string): UIReference | null;
  /** The product's descriptor environment for a dry render; default `{}`. */
  getEnv?(): Record<string, unknown>;
  /** For validating a generated action's types and verb; omitted means "trust the product". */
  vocabulary?: Vocabulary;
  limits?: Partial<SandboxLimits>;
  policy?: Partial<SandboxPolicy>;
  isApproved?(confirmationId: string, verb: VerbLike): boolean;
}

export interface SandboxTools {
  tools: ToolDefinition[];
  /** The shared dry-run path, exposed for a product's own editor or tests. */
  check(source: string, documents?: Record<string, string>, state?: unknown, events?: { handler: string; args?: unknown }[]): Promise<CheckResult>;
}

export type CheckResult =
  | { ok: true; meta: Omit<LoadedProgram, "instanceId" | "programId">; trees: Record<string, UINode>; nodeCount: number; intents: DispatchIntent[]; state: unknown }
  | { ok: false; phase: ProgramErrorPayload["phase"]; code: ProgramErrorPayload["code"]; error: string };

interface Failure {
  ok: false;
  error: string;
}

function fail(error: string): Failure {
  return { ok: false, error };
}

/** A tool result, as chat-provider's types want it. */
type R = Record<string, unknown>;
const asResult = (value: unknown) => value as unknown as R;

const BehaviourSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("openProgram"),
    programId: z.string().describe("a program id from sandbox_describe"),
    bind: z.string().optional().describe("the binding key to put the clicked object under; default: the object's type"),
  }),
  z.object({
    kind: z.literal("verb"),
    verb: z.record(z.string(), z.unknown()).describe('a declared verb; write "$ref" where the clicked object goes, "$ref.id" for its id'),
  }),
  z.object({
    kind: z.literal("askAgent"),
    template: z.string().describe("what to ask; {0} is the clicked object"),
  }),
]);

const EventSchema = z.object({ handler: z.string(), args: z.unknown().optional() });

const WORKED_EXAMPLE =
  'definePlugin(({ ui }) => ({ id: "counter", title: "Counter", initialState: { value: 0 }, widgets: { main: { ' +
  'render({ pluginState }) { const v = Number(pluginState?.value ?? 0); return ui.column([ui.text("Count: " + v), ' +
  'ui.button("+", { onClick: { handler: "inc" } })]); }, handlers: { inc({ dispatchPluginAction, pluginState }) { ' +
  'dispatchPluginAction("state/merge", { value: Number(pluginState?.value ?? 0) + 1 }); } } } } }))';

/**
 * The browser-side tools that let the agent write programs and define
 * actions. Every mutating tool validates with the same dry run `sandbox_test`
 * offers, stores only after a clean run, and opens tiles by performing the
 * product's `program.open` verb through the router — never by reaching into
 * the workbench itself (guide §5.8).
 */
export function createSandboxTools(options: SandboxToolsOptions): SandboxTools {
  const limits: SandboxLimits = { ...DEFAULT_LIMITS, ...options.limits };
  const policy: Record<string, PolicyDecision | undefined> = { ...DEFAULT_SANDBOX_POLICY, ...options.policy };
  const isApproved = options.isApproved ?? (() => false);
  const spent = new Set<string>();
  let scratch = 0;

  const available = () => options.getLibrary() !== null && options.getEngine() !== null;

  /* ---- policy gate, the same shape as the workbench tools' ------------- */

  function decisionFor(key: SandboxPolicyKey, protectedArtifact: boolean): PolicyDecision {
    const decision = policy[key] ?? "allow";
    if (decision === "allow" && protectedArtifact && key !== "program.create" && key !== "program.open" && key !== "action.define") {
      return "confirm";
    }
    return decision;
  }

  function gate(key: SandboxPolicyKey, verb: VerbLike, confirmationId: string | undefined, protectedArtifact = false): string | null {
    const decision = decisionFor(key, protectedArtifact);
    if (decision === "deny") return `${key} is not something the assistant may do; ask the user to do it`;
    if (decision === "allow") return null;
    if (!confirmationId) {
      return `${key} needs the user's approval${protectedArtifact ? " (it is pinned or human-made)" : ""}: call pbui_propose first, describing exactly this change, and pass the id you used as confirmationId`;
    }
    if (spent.has(confirmationId)) return `the approval "${confirmationId}" has already been used; ask again for this change`;
    if (!isApproved(confirmationId, verb)) return `no approved proposal with id "${confirmationId}" for ${verb.kind}`;
    return null;
  }

  async function performGated(key: SandboxPolicyKey, verb: VerbLike, confirmationId: string | undefined, protectedArtifact = false): Promise<Outcome> {
    const denied = gate(key, verb, confirmationId, protectedArtifact);
    if (denied) return `rejected:${denied}`;
    const outcome = await options.perform(verb);
    if (outcome === "performed" && decisionFor(key, protectedArtifact) === "confirm" && confirmationId) spent.add(confirmationId);
    return outcome;
  }

  /* ---- the dry run ------------------------------------------------------ */

  function resolveAll(documents: Record<string, string>): Record<string, UIReference | null> {
    const out: Record<string, UIReference | null> = {};
    for (const [key, id] of Object.entries(documents)) out[key] = options.resolve(key, id);
    return out;
  }

  async function check(source: string, documents: Record<string, string> = {}, state?: unknown, events: { handler: string; args?: unknown }[] = []): Promise<CheckResult> {
    const engine = options.getEngine();
    if (!engine) return { ok: false, phase: "load", code: "UNKNOWN_ERROR", error: "no sandbox engine is attached to this chat" };
    // The tools' limits may be tighter than the engine's; enforce them here
    // so a product can cap what the AGENT writes without re-creating the engine.
    const size = byteLength(source);
    if (size > limits.sourceBytes) {
      return { ok: false, phase: "load", code: "VALIDATION_ERROR", error: `source is ${size} bytes, the limit is ${limits.sourceBytes}` };
    }
    scratch += 1;
    const instanceId = `check#${scratch}`;
    let phase: ProgramErrorPayload["phase"] = "load";
    try {
      const meta = await engine.load({ instanceId, programId: "check", source });
      const globalState: ProgramGlobalState = {
        self: { instanceId, programId: "check", viewId: "check", placementId: "check" },
        shared: { documents: resolveAll(documents), env: options.getEnv?.() ?? {} },
        system: { engine: engine.kind, version: 0 },
      };
      let pluginState: unknown = state ?? meta.initialState ?? {};
      phase = "render";
      const trees: Record<string, UINode> = {};
      for (const widgetId of meta.widgets) trees[widgetId] = validateUINode(await engine.render({ instanceId, widgetId, pluginState, globalState }), limits);
      const intents: DispatchIntent[] = [];
      phase = "event";
      for (const event of events) {
        const out = await engine.event({ instanceId, widgetId: meta.widgets[0]!, handler: event.handler, args: event.args, pluginState, globalState });
        intents.push(...out);
        for (const intent of out) if (intent.scope === "plugin") pluginState = reducePluginIntent(pluginState, intent).next;
      }
      if (events.length > 0) {
        phase = "render";
        for (const widgetId of meta.widgets) trees[widgetId] = validateUINode(await engine.render({ instanceId, widgetId, pluginState, globalState }), limits);
      }
      const nodeCount = Object.values(trees).reduce((total, tree) => total + countNodes(tree), 0);
      const { instanceId: _i, programId: _p, ...rest } = meta;
      return { ok: true, meta: rest, trees: pruneTrees(trees), nodeCount, intents, state: pluginState };
    } catch (error) {
      const payload = toProgramError(error, phase);
      const code = phase === "render" && error instanceof Error && /the tree has more than|nests deeper than|is not supported/.test(error.message) ? "VALIDATION_ERROR" : payload.code;
      return { ok: false, phase, code, error: payload.message };
    } finally {
      await engine.dispose(instanceId);
    }
  }

  /** A tool result is paid for by the model: deep trees are cut at depth 4 with a note. */
  function pruneTrees(trees: Record<string, UINode>): Record<string, UINode> {
    const cut = (node: UINode, depth: number): UINode => {
      if (!("children" in node) || !node.children) return node;
      if (depth >= 4) {
        const omitted = countNodes(node) - 1;
        return { ...node, children: omitted > 0 ? [{ kind: "text", text: `… ${omitted} more nodes omitted` }] : [] };
      }
      return { ...node, children: node.children.map((child) => cut(child, depth + 1)) };
    };
    return Object.fromEntries(Object.entries(trees).map(([id, tree]) => [id, cut(tree, 1)]));
  }

  /* ---- reads ------------------------------------------------------------ */

  function tilesShowing(wb: Workbench, programId: string): string[] {
    return describeWorkbench(wb).workspaces.flatMap((workspace) =>
      workspace.tiles.filter((tile) => tile.appId === "script" && tile.documents.program === programId).map((tile) => tile.placementId),
    );
  }

  function currentTiles(wb: Workbench) {
    return describeWorkbench(wb, { workspaceId: wb.store.getState().workspaceId }).workspaces[0]?.tiles ?? [];
  }

  /** What the registry knows about a program's running instances — timings and errors a model can act on. */
  function running(programId: string) {
    const registry = options.getInstances?.() ?? null;
    if (!registry) return undefined;
    const snapshots = registry.all().filter((s) => s.programId === programId);
    if (snapshots.length === 0) return [];
    return snapshots.map((s) => ({
      viewId: s.viewId,
      version: s.version,
      status: s.status,
      tiles: s.placementIds.length,
      ...(s.timings.lastRenderMs !== undefined ? { lastRenderMs: Math.round(s.timings.lastRenderMs * 10) / 10 } : {}),
      renders: s.timings.renders,
      events: s.timings.events,
      errors: s.timings.errors,
      timeouts: s.timings.timeouts,
      ...(s.error ? { error: `${s.error.phase ?? "run"}: ${s.error.code}: ${s.error.message}` } : {}),
    }));
  }

  function summarise(program: ProgramRecord, wb: Workbench | null) {
    const instances = running(program.id);
    return {
      id: program.id,
      title: program.title,
      version: program.version,
      bindings: program.bindings,
      widgets: program.meta.widgets,
      by: program.by,
      pinned: program.pinned,
      history: program.history.length,
      ...(program.lastError ? { lastError: program.lastError } : {}),
      openIn: wb ? tilesShowing(wb, program.id) : [],
      ...(instances ? { running: instances } : {}),
    };
  }

  function summariseAction(action: ActionRecord) {
    return { id: action.id, label: action.label, types: action.types, behaviour: action.behaviour, by: action.by, pinned: action.pinned, ...(action.danger ? { danger: true } : {}) };
  }

  function protectedProgram(program: ProgramRecord): boolean {
    return program.pinned || program.by === "human";
  }

  function missingBindings(program: Pick<ProgramRecord, "bindings">, documents: Record<string, string>): string[] {
    return program.bindings.filter((key) => !documents[key]);
  }

  async function open(wb: Workbench, programId: string, documents: Record<string, string>, near: string | undefined, title: string | undefined, confirmationId: string | undefined) {
    const before = currentTiles(wb);
    const verb: VerbLike = {
      kind: "program.open",
      programId,
      documents,
      ...(near ? { near } : {}),
      ...(title ? { title } : {}),
    };
    const outcome = await performGated("program.open", verb, confirmationId);
    if (outcome !== "performed") return { ok: false as const, error: outcome.replace(/^rejected:/, "") };
    const after = currentTiles(wb);
    const fresh = after.find((tile) => !before.some((old) => old.placementId === tile.placementId));
    const target = fresh ?? after.find((tile) => tile.placementId === wb.activePlacementId());
    return { ok: true as const, placementId: target?.placementId ?? null, viewId: target?.viewId ?? null, wentToExisting: !fresh };
  }

  /* ---- the tools -------------------------------------------------------- */

  const describeTool: FrontendTool<Record<string, never>, R> = {
    name: "sandbox_describe",
    mode: "frontend",
    description:
      "List the programs and generated actions in the user's library, with their ids, and the dialect programs are written in. " +
      "Call it before sandbox_open, sandbox_update_app, sandbox_define_action or sandbox_remove — ids come from here, never from memory.",
    parameters: z.object({}),
    available,
    execute() {
      const library = options.getLibrary();
      const engine = options.getEngine();
      if (!library || !engine) return asResult(fail("no sandbox is attached to this chat"));
      const wb = options.getWorkbench();
      const state = library.getState();
      return asResult({
        ok: true,
        engine: engine.kind,
        bootstrapVersion: BOOTSTRAP_VERSION,
        limits: { sourceBytes: limits.sourceBytes, programs: limits.programs, actions: limits.actions, treeNodes: limits.treeNodes, intentsPerEvent: limits.intentsPerEvent },
        dsl: {
          kinds: [...SANDBOX_UI_KINDS],
          intents: [...SANDBOX_INTENTS],
          helpers:
            "ui.text(content, {size?, tone?, strong?}) ui.badge(text) ui.button(label, {onClick?, variant?, disabled?}) " +
            "ui.input(value, {placeholder?, type?, onChange?}) ui.select(value, {options, onChange?}) ui.row(children) ui.column(children) " +
            "ui.panel(children, {title?}) ui.table(rows, {headers}) ui.meter({fraction, label?, value?}) ui.sparkline({points, label?}) " +
            "ui.callout({variant?, title?, text}) ui.ref(reference, label?); handlers get {pluginState, globalState, dispatchPluginAction, dispatchVerb}",
          example: WORKED_EXAMPLE,
        },
        programs: Object.values(state.programs).map((program) => summarise(program, wb)),
        actions: Object.values(state.actions).map(summariseAction),
      });
    },
  };

  const testTool: FrontendTool<
    { source: string; documents?: Record<string, string>; state?: Record<string, unknown>; events?: { handler: string; args?: unknown }[] },
    R
  > = {
    name: "sandbox_test",
    mode: "frontend",
    description:
      "Run a program without storing it: load it, render every widget with its initialState (or the state you pass) and the bindings in documents, " +
      "then replay any events through its handlers. Returns the rendered trees, the intents the handlers emitted and the final state, or the error " +
      "with the phase it happened in. Call this before sandbox_create_app; fix what it reports.",
    parameters: z.object({
      source: z.string().describe(`the program source; it must call definePlugin once. Example: ${WORKED_EXAMPLE}`),
      documents: z.record(z.string(), z.string()).optional().describe('bindings to resolve, e.g. {"product": "2049"}'),
      state: z.record(z.string(), z.unknown()).optional().describe("a pluginState to render with instead of initialState"),
      events: z.array(EventSchema).optional().describe("handlers to call in order, e.g. [{handler: 'inc'}]"),
    }),
    available,
    async execute(input) {
      return asResult(await check(input.source, input.documents ?? {}, input.state, input.events ?? []));
    },
  };

  const createTool: FrontendTool<
    { title: string; source: string; bindings?: string[]; documents?: Record<string, string>; open?: boolean; near?: string; confirmationId?: string },
    R
  > = {
    name: "sandbox_create_app",
    mode: "frontend",
    description:
      "Store a program in the user's library and open it in a tile. The program is run first (as sandbox_test does) and nothing is stored if it fails. " +
      "A program that reads objects declares bindings and is opened with documents, e.g. bindings ['product'] and documents {product: '2049'}. " +
      "Returns the programId and the tile it opened in; mention the program as [[program:<programId>|title]].",
    parameters: z.object({
      title: z.string().min(1).describe("a short title for the tile"),
      source: z.string().describe("the definePlugin source"),
      bindings: z.array(z.string()).optional().describe("binding keys the program reads; defaults to the program's own `bindings`"),
      documents: z.record(z.string(), z.string()).optional().describe("what to bind when opening, by binding key"),
      open: z.boolean().optional().describe("open it in a tile; default true"),
      near: z.string().optional().describe("a placementId to open beside; omitted means the active tile"),
      confirmationId: z.string().optional(),
    }),
    available,
    async execute(input) {
      const library = options.getLibrary();
      if (!library) return asResult(fail("no sandbox is attached to this chat"));
      const denied = gate("program.create", { kind: "program.create", title: input.title }, input.confirmationId);
      if (denied) return asResult(fail(denied));
      const documents = input.documents ?? {};
      const result = await check(input.source, documents);
      if (!result.ok) return asResult({ ok: false, phase: result.phase, code: result.code, error: result.error });

      let program: ProgramRecord;
      try {
        program = library.putProgram({
          title: input.title,
          source: input.source,
          bindings: input.bindings ?? result.meta.bindings,
          meta: { ...(result.meta.declaredId ? { declaredId: result.meta.declaredId } : {}), widgets: result.meta.widgets },
          by: "agent",
        });
      } catch (error) {
        return asResult(fail(error instanceof Error ? error.message : String(error)));
      }

      const warnings: string[] = [];
      let opened: { placementId: string | null; viewId: string | null; wentToExisting: boolean } | null = null;
      if (input.open !== false) {
        const wb = options.getWorkbench();
        const missing = missingBindings(program, documents);
        if (!wb) warnings.push("not opened: no workbench is attached");
        else if (missing.length > 0) warnings.push(`not opened: the program needs ${missing.map((k) => `a "${k}" binding`).join(", ")}; call sandbox_open with documents`);
        else {
          const outcome = await open(wb, program.id, documents, input.near, input.title, input.confirmationId);
          if (outcome.ok) opened = outcome;
          else warnings.push(`not opened: ${outcome.error}`);
        }
      }
      return asResult({
        ok: true,
        programId: program.id,
        version: program.version,
        title: program.title,
        bindings: program.bindings,
        widgets: program.meta.widgets,
        nodeCount: result.nodeCount,
        ...(opened ?? {}),
        warnings,
      });
    },
  };

  const updateTool: FrontendTool<{ programId: string; source: string; title?: string; documents?: Record<string, string>; confirmationId?: string }, R> = {
    name: "sandbox_update_app",
    mode: "frontend",
    description:
      "Replace a program's source. It is run first and the old version keeps running if the new one fails. Every tile showing the program " +
      "reloads it; a tile keeps its state when the new version can render it, else resets to initialState. A pinned program needs the user's approval.",
    parameters: z.object({
      programId: z.string().describe("from sandbox_describe or the result that created it"),
      source: z.string(),
      title: z.string().optional(),
      documents: z.record(z.string(), z.string()).optional().describe("bindings to dry-run with, e.g. what one of its tiles shows"),
      confirmationId: z.string().optional(),
    }),
    available,
    async execute(input) {
      const library = options.getLibrary();
      if (!library) return asResult(fail("no sandbox is attached to this chat"));
      const existing = library.getState().programs[input.programId];
      if (!existing) return asResult(fail(`no program "${input.programId}"; sandbox_describe lists them`));
      const denied = gate("program.update", { kind: "program.update", programId: input.programId }, input.confirmationId, protectedProgram(existing));
      if (denied) return asResult(fail(denied));
      const result = await check(input.source, input.documents ?? {});
      if (!result.ok) return asResult({ ok: false, phase: result.phase, code: result.code, error: result.error, keptVersion: existing.version });
      try {
        const program = library.putProgram({
          id: existing.id,
          title: input.title ?? existing.title,
          source: input.source,
          bindings: result.meta.bindings.length > 0 ? result.meta.bindings : existing.bindings,
          meta: { ...(result.meta.declaredId ? { declaredId: result.meta.declaredId } : {}), widgets: result.meta.widgets },
          by: existing.by,
        });
        if (input.confirmationId && decisionFor("program.update", protectedProgram(existing)) === "confirm") spent.add(input.confirmationId);
        const wb = options.getWorkbench();
        const openIn = wb ? tilesShowing(wb, program.id) : [];
        return asResult({
          ok: true,
          programId: program.id,
          version: program.version,
          openIn,
          // Whether a tile kept its state is decided per tile when it reloads
          // (guide D11) and shown in that tile's details log; the tool cannot
          // know it, so it says where to look rather than guessing.
          note: openIn.length > 0 ? `${openIn.length} tile(s) reload the new version now; each tile's details log says whether its state was kept` : "no tile shows it; open it with sandbox_open",
        });
      } catch (error) {
        return asResult(fail(error instanceof Error ? error.message : String(error)));
      }
    },
  };

  const openTool: FrontendTool<{ programId: string; documents?: Record<string, string>; near?: string; title?: string; confirmationId?: string }, R> = {
    name: "sandbox_open",
    mode: "frontend",
    description:
      "Open a stored program in a tile, bound to the objects in documents. If a tile already shows this program with exactly these bindings " +
      "the result says wentToExisting; do not open it again.",
    parameters: z.object({
      programId: z.string(),
      documents: z.record(z.string(), z.string()).optional().describe('e.g. {"product": "2049"} for a program whose bindings include "product"'),
      near: z.string().optional().describe("a placementId to open beside"),
      title: z.string().optional(),
      confirmationId: z.string().optional(),
    }),
    available,
    async execute(input) {
      const library = options.getLibrary();
      const wb = options.getWorkbench();
      if (!library) return asResult(fail("no sandbox is attached to this chat"));
      if (!wb) return asResult(fail("no workbench is attached to this chat"));
      const program = library.getState().programs[input.programId];
      if (!program) return asResult(fail(`no program "${input.programId}"; sandbox_describe lists them`));
      const documents = input.documents ?? {};
      const missing = missingBindings(program, documents);
      if (missing.length > 0) {
        return asResult(fail(`the program needs ${missing.map((k) => `a "${k}" binding`).join(", ")}; got ${JSON.stringify(documents)}`));
      }
      const outcome = await open(wb, program.id, documents, input.near, input.title, input.confirmationId);
      return asResult(outcome.ok ? { ...outcome, title: input.title ?? program.title } : fail(outcome.error));
    },
  };

  const defineActionTool: FrontendTool<
    { label: string; types: string[]; behaviour: z.infer<typeof BehaviourSchema>; danger?: boolean; description?: string; actionId?: string; confirmationId?: string },
    R
  > = {
    name: "sandbox_define_action",
    mode: "frontend",
    description:
      "Add an action to the menu of every object of the given presentation types. An action opens a program bound to the clicked object " +
      "({kind:'openProgram', programId}), performs a declared verb on it ({kind:'verb', verb:{kind:'watch', ref:'$ref'}}), or asks you " +
      "({kind:'askAgent', template:'… {0} …'}). It is saved in this browser and offered on the next menu.",
    parameters: z.object({
      label: z.string().min(1).describe("the menu entry, e.g. 'Days of cover'"),
      types: z.array(z.string()).min(1).describe("presentation types it applies to, e.g. ['product']"),
      behaviour: BehaviourSchema,
      danger: z.boolean().optional().describe("mark it consequential"),
      description: z.string().optional().describe("one line for the menu's mouse-doc"),
      actionId: z.string().optional().describe("to replace an existing action"),
      confirmationId: z.string().optional(),
    }),
    available,
    execute(input) {
      const library = options.getLibrary();
      if (!library) return asResult(fail("no sandbox is attached to this chat"));
      const denied = gate("action.define", { kind: "action.define", label: input.label }, input.confirmationId);
      if (denied) return asResult(fail(denied));
      const vocabulary = options.vocabulary;
      if (vocabulary) {
        const unknown = input.types.filter((type) => !vocabulary.types[type]);
        if (unknown.length > 0) return asResult(fail(`unknown presentation type${unknown.length > 1 ? "s" : ""} ${unknown.join(", ")}; known: ${Object.keys(vocabulary.types).join(", ")}`));
      }
      const behaviour = input.behaviour as ActionBehaviour;
      if (behaviour.kind === "openProgram" && !library.getState().programs[behaviour.programId]) {
        return asResult(fail(`no program "${behaviour.programId}"; sandbox_describe lists them`));
      }
      if (behaviour.kind === "verb") {
        const sample: UIReference = { type: input.types[0]!, id: "example" };
        const substituted = substituteVerbRef(behaviour.verb as VerbLike, sample);
        if (typeof substituted.kind !== "string") return asResult(fail("the verb needs a string kind"));
        if (vocabulary) {
          const problem = validateVerb(vocabulary, substituted);
          if (problem) return asResult(fail(`the verb does not validate: ${problem}`));
        }
      }
      if (behaviour.kind === "askAgent" && !behaviour.template.includes("{0}")) {
        return asResult(fail("the template must contain {0}, which becomes the clicked object"));
      }
      try {
        const action = library.putAction({
          ...(input.actionId ? { id: input.actionId } : {}),
          label: input.label,
          types: input.types,
          behaviour,
          ...(input.danger ? { danger: true } : {}),
          ...(input.description ? { description: input.description } : {}),
          by: "agent",
        });
        return asResult({ ok: true, actionId: action.id, label: action.label, types: action.types });
      } catch (error) {
        return asResult(fail(error instanceof Error ? error.message : String(error)));
      }
    },
  };

  const removeTool: FrontendTool<{ programId?: string; actionId?: string; confirmationId?: string }, R> = {
    name: "sandbox_remove",
    mode: "frontend",
    description:
      "Remove a program (closing the tiles that show it) or a generated action. Something pinned or human-made needs the user's approval: " +
      "call pbui_propose first and pass its id as confirmationId.",
    parameters: z.object({
      programId: z.string().optional(),
      actionId: z.string().optional(),
      confirmationId: z.string().optional(),
    }),
    available,
    async execute(input) {
      const library = options.getLibrary();
      if (!library) return asResult(fail("no sandbox is attached to this chat"));
      if (Boolean(input.programId) === Boolean(input.actionId)) return asResult(fail("pass exactly one of programId or actionId"));
      const wb = options.getWorkbench();
      if (input.programId) {
        const program = library.getState().programs[input.programId];
        if (!program) return asResult(fail(`no program "${input.programId}"`));
        const closing = wb ? tilesShowing(wb, program.id) : [];
        const outcome = await performGated("program.remove", { kind: "program.remove", programId: program.id }, input.confirmationId, protectedProgram(program));
        if (outcome !== "performed") return asResult(fail(outcome.replace(/^rejected:/, "")));
        return asResult({ ok: true, removed: "program", programId: program.id, closedTiles: closing });
      }
      const action = library.getState().actions[input.actionId!];
      if (!action) return asResult(fail(`no action "${input.actionId}"`));
      const outcome = await performGated("action.remove", { kind: "action.remove", actionId: action.id }, input.confirmationId, action.pinned || action.by === "human");
      if (outcome !== "performed") return asResult(fail(outcome.replace(/^rejected:/, "")));
      return asResult({ ok: true, removed: "action", actionId: action.id });
    },
  };

  return {
    tools: [describeTool, testTool, createTool, updateTool, openTool, defineActionTool, removeTool] as ToolDefinition[],
    check,
  };
}

/** The verb kinds a product must declare in its vocabulary for these tools to work. */
export const SANDBOX_VERB_KINDS = ["program.open", "program.remove", "program.pin", "action.run", "action.remove"] as const;
