import type { FrontendTool, ToolDefinition } from "@go-go-golems/chat-provider";
import { isAppAvailable, type WorkbenchShell } from "@hyperslop-systems/pbui-workbench";
import {
  canSplitPlacement,
  commands,
  describeWorkbenchCommand,
  documentSlots,
  isWorkbenchCommand,
  layoutFits,
  longerAxis,
  splitRatioBounds,
  type LayoutSpec,
  type WorkbenchCommand,
  type WorkbenchCommandKind,
} from "@hyperslop-systems/workbench-core";
import { type JsonValue, fromJson, toJson } from "@bufbuild/protobuf";
import { type Mutation, MutationSchema, WorkbenchDocumentSchema } from "@hyperslop-systems/workbench-protocol";
import { applyMutations, MutationError } from "@hyperslop-systems/workbench-protocol/client";
import { z } from "zod";
import type { EffectCorrelation, Outcome, VerbLike } from "../types";
import type { AgentEffectGateway } from "./agentEffectGateway";
import { digestCanonicalJson } from "./approvalLedger";

/* ---- the dialect the model writes ---------------------------------------
 *
 * `LayoutSpec` is recursive, and a recursive zod schema compiles to a JSON
 * Schema with `$ref`/`$defs`. Providers differ in their tolerance for that in
 * a tool definition, and a schema the provider rejects is a tool the model
 * never sees. Four hand-rolled levels cost twelve lines and produce a flat,
 * universally accepted schema — and four levels is sixteen tiles, twice the
 * default limit, so the depth is never the binding constraint. */

const TileSpecSchema = z.object({
  kind: z.literal("tile"),
  appId: z.string().describe("an application id from workbench_describe"),
  documents: z.record(z.string(), z.string()).optional().describe("document bindings, for an application that is a view OF something"),
  title: z.string().optional(),
});

function splitOf<T extends z.ZodType>(child: T) {
  return z.object({
    kind: z.literal("split"),
    direction: z.enum(["row", "col"]).describe("'row' places a and b side by side; 'col' stacks them"),
    ratio: z.number().describe("a's share of the space, between 0.1 and 0.9"),
    a: child,
    b: child,
  });
}

const Depth1 = TileSpecSchema;
const Depth2 = z.union([TileSpecSchema, splitOf(Depth1)]);
const Depth3 = z.union([TileSpecSchema, splitOf(Depth2)]);
export const LayoutSpecSchema = z.union([TileSpecSchema, splitOf(Depth3)]);

const RevisionSchema = z.string().regex(/^[0-9a-f]{64}$/, "expectedRevision must be the SHA-256 revision from workbench_describe");

const WORKED_EXAMPLE =
  '{"kind":"split","direction":"row","ratio":0.55,"a":{"kind":"tile","appId":"chat"},' +
  '"b":{"kind":"split","direction":"col","ratio":0.4,"a":{"kind":"tile","appId":"metals"},' +
  '"b":{"kind":"tile","appId":"inventory"}}}';

/* ---- limits and policy --------------------------------------------------- */

export interface WorkbenchToolLimits {
  tilesPerWorkspace: number;
  workspaces: number;
  verbsPerCall: number;
  layoutDepth: number;
  /** Raw `workbench_apply` batches only. */
  mutationsPerCall: number;
}

export const DEFAULT_LIMITS: WorkbenchToolLimits = {
  tilesPerWorkspace: 8,
  workspaces: 6,
  verbsPerCall: 8,
  layoutDepth: 4,
  mutationsPerCall: 32,
};

export type PolicyDecision = "allow" | "confirm" | "deny";

/**
 * What the agent may do to the layout unassisted.
 *
 * `confirm` is not a new mechanism: the model must first call the existing
 * `pbui_propose` human tool and pass the id it agreed on as `confirmationId`.
 * Requiring the id rather than trusting the model to have asked is the whole
 * point — an unenforced convention is one the model skips under pressure.
 */
export type WorkbenchPolicy = Record<string, PolicyDecision>;

export const DEFAULT_POLICY: WorkbenchPolicy = {
  "session.activatePlacement": "allow",
  "session.selectWorkspace": "allow",
  "placement.duplicate": "allow",
  "placement.swap": "allow",
  "placement.dock": "allow",
  "placement.resize": "allow",
  "view.configure": "allow",
  "workspace.create": "allow",
  "workspace.rename": "allow",
  "workspace.clone": "allow",
  "workspace.rebalance": "allow",
  // `view.show` opens, links, navigates — and, with a `replace` placement,
  // changes what a tile shows. The replace form has its own key (see
  // `policyKindOf`); the kind itself is allowed.
  "view.show": "allow",
  "view.show.replace": "confirm",
  // Destroys what someone may be reading.
  "placement.close": "confirm",
  "placement.replaceWith": "confirm",
  "workspace.delete": "confirm",
  // Raw-only today; deleting payload can discard unsaved user work.
  "document.delete": "confirm",
  // The launcher and the other dialogs are shell actions, not commands: the
  // tools refuse them before any policy is consulted.
};

/**
 * The policy key of one command. `view.show` with a `replace` placement is
 * what the old `tile.replace` was: it changes what someone may be reading,
 * so it has its own key.
 */
export function policyKindOf(command: WorkbenchCommand): string {
  if (command.kind === "view.show" && command.placement.kind === "replace") return "view.show.replace";
  return command.kind;
}

/* ---- the factory --------------------------------------------------------- */

export interface WorkbenchToolsOptions {
  /**
   * The attached workbench, read at call time. A function rather than a value
   * because `createPbuiChat` builds its extension before the workbench exists
   * (the workbench's apps need the chat), so the tools are registered with
   * `available: () => getWorkbench() !== null` and simply are not offered to
   * the model until `attachWorkbench` runs.
   */
  getWorkbench(): WorkbenchShell | null;
  /**
   * Perform one command through the PRODUCT's router rather than calling
   * `wb.execute` directly. That single indirection is what buys the trace:
   * the router validates against the vocabulary, records the outcome —
   * including a refusal — and reports it with `actor: "agent"`.
   */
  perform(verb: VerbLike, correlation?: EffectCorrelation): Promise<Outcome>;
  limits?: Partial<WorkbenchToolLimits>;
  policy?: Partial<WorkbenchPolicy>;
  /**
   * Offer `workbench_apply`, which takes a raw protobuf-JSON mutation batch —
   * parity with `hyperslop ui mutate`. Off by default: a raw batch is the
   * easiest way for a model to produce a document the applier refuses, and
   * every gesture that matters is already expressible above it.
   */
  allowRawMutations?: boolean;
  /**
   * Translate a workbench command into the product's own verb before it
   * reaches the router. The default emits the `WorkbenchCommand` unchanged,
   * so a product declares `placement.close` and friends in its vocabulary
   * and routes them to `workbench.perform`; a product with its own names
   * for these maps them here.
   */
  mapVerb?(verb: WorkbenchCommand): VerbLike;
  /** Conversation whose agent owns these per-session tools. */
  senderConversationId: string;
  /** Shared product execution, approval, idempotency, and trace gateway. */
  effectGateway: AgentEffectGateway;
}

export interface WorkbenchTools {
  tools: ToolDefinition[];
  // Deliberately no undo/history surface. A whole-document snapshot restore
  // can erase a later agent's work; until safe inverse batches exist, tools
  // return the committed revision and no unusable undo token.
}

interface Failure {
  ok: false;
  error: string;
}

function fail(error: string): Failure {
  return { ok: false, error };
}

/**
 * The browser-side tools that let the agent build and rearrange the user's
 * workspace.
 *
 * Every one of them is a thin, validated wrapper over the same
 * `WorkbenchCommand`s a mouse gesture executes, on the same core, reported
 * to the same trace. The agent gets no private door into the layout:
 * if it can do something the UI cannot, the UI is missing a button.
 */
export function createWorkbenchTools(options: WorkbenchToolsOptions): WorkbenchTools {
  const limits: WorkbenchToolLimits = { ...DEFAULT_LIMITS, ...options.limits };
  // Not `WorkbenchPolicy`: spreading a Partial over it widens every value to
  // `PolicyDecision | undefined`, and `decisionFor` already answers "allow"
  // for a kind nobody has an opinion about.
  const policy: Record<string, PolicyDecision | undefined> = { ...DEFAULT_POLICY, ...options.policy };
  const mapVerb = options.mapVerb ?? ((verb: WorkbenchCommand) => verb as unknown as VerbLike);

  const available = () => options.getWorkbench() !== null;

  async function performVerb(verb: WorkbenchCommand, correlation: EffectCorrelation): Promise<Outcome> {
    return options.perform(mapVerb(verb), correlation);
  }

  /** The one door every high-level mutating tool uses. */
  async function performWithPolicy(
    verb: WorkbenchCommand,
    expectedRevision: string,
    confirmationId: string | undefined,
    effectId: string,
  ): Promise<Outcome> {
    const wb = options.getWorkbench();
    if (!wb) return "rejected:no workbench is attached to this chat";
    const beforeRevision = await workbenchRevision(wb);
    if (expectedRevision !== beforeRevision) {
      return "rejected:workbench changed; call workbench_describe again and use its revision";
    }
    const baseRevision = wb.core.getState().revision;
    const policyKind = policyKindOf(verb);
    const result = await options.effectGateway.execute({
      effectId,
      invocationKey: effectId.replace(":", "/"),
      actor: "agent",
      conversationId: options.senderConversationId,
      effectKind: policyKind,
      effectScope: "workbench",
      input: verb as unknown as JsonValue,
      targetIds: workbenchVerbTargetIds(verb),
      policy: decisionFor(policyKind),
      confirmationId,
      beforeRevision,
      approvalPrompt: `${policyKind} needs the user's approval: call pbui_propose first, describing exactly this change, and pass the id you used as confirmationId`,
      approvalDescription: describeWorkbenchCommand(verb),
      async perform() {
        if (wb.core.getState().revision !== baseRevision) {
          return { outcome: "rejected:workbench changed while awaiting approval; call workbench_describe again" };
        }
        const outcome = await performVerb(verb, {
          effectId,
          invocationKey: effectId.replace(":", "/"),
          ...(confirmationId ? { approvalId: confirmationId } : {}),
        });
        return { outcome, afterRevision: await workbenchRevision(wb) };
      },
    });
    return result.outcome;
  }

  function decisionFor(kind: string): PolicyDecision {
    return policy[kind] ?? "allow";
  }

  /* ---- id and availability checks, with messages a model can act on ------ */

  /** Is this application placeable HERE, and does it exist at all? */
  function appProblem(appId: string, wb: WorkbenchShell): string | null {
    const app = wb.apps.get(appId);
    if (!app || !wb.core.apps.get(appId)) {
      return `unknown app "${appId}"; available: ${placeableIds(wb).join(", ")}`;
    }
    // A product hides an application from a workspace on purpose. The launcher
    // honours it; an agent that could place it anyway would be a way around
    // the policy rather than a second door to it.
    if (!isAppAvailable(app, { workspaceId: wb.core.getState().session.workspaceId })) {
      return `app "${appId}" is not offered in this workspace`;
    }
    return null;
  }

  function placeableIds(wb: WorkbenchShell): string[] {
    const workspaceId = wb.core.getState().session.workspaceId;
    return wb.apps
      .list()
      .filter((app) => isAppAvailable(app, { workspaceId }))
      .map((app) => app.id);
  }

  /**
   * What is wrong with a command before it is dispatched, if anything.
   *
   * The core refuses a bad id with a code, which does surface — but "the
   * workbench refused" is a worse message than "you misspelled inventory",
   * and an app id is the one field the protocol accepts as anything at all.
   */
  function verbProblem(command: WorkbenchCommand, wb: WorkbenchShell): string | null {
    const state = wb.core.getState();
    const description = wb.describe({ workspaceId: state.session.workspaceId });
    const tiles = description.workspaces[0]?.tiles ?? [];
    const knownPlacement = (id: string) => tiles.some((tile) => tile.placementId === id);
    const knownView = (id: string) => Boolean(state.document.views[id]);
    const knownWorkspace = (id: string) => state.document.workspaces.some((workspace) => workspace.id === id);
    const geometry = wb.measure();
    const constraints = wb.core.policy.split;
    const tooSmall = (placementId: string, axis: "row" | "col") => (canSplitPlacement(geometry, placementId, axis, constraints) ? null : `tile "${placementId}" is too small to split ${axis === "row" ? "side by side" : "top and bottom"}`);

    switch (command.kind) {
      case "placement.duplicate":
        if (!knownPlacement(command.placementId)) return unknownPlacement(command.placementId, tiles);
        return tooSmall(command.placementId, command.axis ?? longerAxis(geometry, command.placementId, constraints.headlessAxis));
      case "placement.close":
      case "session.activatePlacement":
        if (command.placementId === null) return null;
        return knownPlacement(command.placementId) ? null : unknownPlacement(command.placementId, tiles);
      case "placement.swap":
        if (!knownPlacement(command.a)) return unknownPlacement(command.a, tiles);
        return knownPlacement(command.b) ? null : unknownPlacement(command.b, tiles);
      case "placement.replaceWith":
        if (!knownPlacement(command.source)) return unknownPlacement(command.source, tiles);
        return knownPlacement(command.target) ? null : unknownPlacement(command.target, tiles);
      case "placement.dock": {
        if (!knownPlacement(command.source)) return unknownPlacement(command.source, tiles);
        if (!knownPlacement(command.target)) return unknownPlacement(command.target, tiles);
        const axis = command.edge === "left" || command.edge === "right" ? "row" : "col";
        return canSplitPlacement(geometry, command.target, axis, constraints) ? null : `tile "${command.target}" is too small to dock another tile`;
      }
      case "view.show": {
        if (command.view.kind === "existing") {
          if (!knownView(command.view.viewId)) return `unknown view "${command.view.viewId}"`;
        } else {
          const problem = appProblem(command.view.appId, wb);
          if (problem) return problem;
        }
        const placement = command.placement;
        if (placement.kind === "replace" && !knownPlacement(placement.target)) return unknownPlacement(placement.target, tiles);
        if (placement.kind === "split" && placement.target !== undefined) {
          if (!knownPlacement(placement.target)) return unknownPlacement(placement.target, tiles);
          const axis = placement.edge ? (placement.edge === "left" || placement.edge === "right" ? "row" : "col") : (placement.axis ?? longerAxis(geometry, placement.target, constraints.headlessAxis));
          return tooSmall(placement.target, axis);
        }
        if (placement.kind === "auto" && placement.near !== undefined && !knownPlacement(placement.near)) return unknownPlacement(placement.near, tiles);
        return null;
      }
      case "view.configure":
        return knownView(command.viewId) ? null : `unknown view "${command.viewId}"`;
      case "placement.resize": {
        const split = description.workspaces[0]?.splits.find((item) => item.splitId === command.splitId);
        if (!split) return `unknown split "${command.splitId}"`;
        return splitRatioBounds(geometry, command.splitId, split.direction, constraints) ? null : `split "${command.splitId}" is too small to resize while keeping both panes usable`;
      }
      case "session.selectWorkspace":
      case "workspace.rename":
      case "workspace.delete":
      case "workspace.clone":
      case "workspace.rebalance":
        return knownWorkspace(command.workspaceId) ? null : `unknown workspace "${command.workspaceId}"`;
      default:
        return null;
    }
  }

  async function workbenchRevision(wb: WorkbenchShell): Promise<string> {
    return digestCanonicalJson(toJson(WorkbenchDocumentSchema, wb.core.getState().document) as JsonValue);
  }

  /** Every id a command names, one level deep (a `view.show` names ids inside `view` and `placement`). */
  function workbenchVerbTargetIds(verb: WorkbenchCommand): string[] {
    const keys = ["placementId", "workspaceId", "viewId", "splitId", "appId", "source", "target", "a", "b", "near", "requestedViewId"];
    const out: string[] = [];
    const collect = (candidate: Record<string, unknown>) => {
      for (const key of keys) {
        const value = candidate[key];
        if (typeof value === "string" && value.length > 0) out.push(value);
      }
    };
    const record = verb as unknown as Record<string, unknown>;
    collect(record);
    for (const nested of ["view", "placement"]) {
      const inner = record[nested];
      if (inner && typeof inner === "object") collect(inner as Record<string, unknown>);
    }
    return out;
  }

  function unknownPlacement(id: string, tiles: { placementId: string }[]): string {
    return `unknown tile "${id}"; on screen: ${tiles.map((tile) => tile.placementId).join(", ") || "none"}`;
  }

  /* ---- layout validation, with messages written for a model to act on ---- */

  function validateLayout(spec: LayoutSpec, wb: WorkbenchShell): string | null {
    let tiles = 0;

    const walk = (node: LayoutSpec, depth: number): string | null => {
      if (depth > limits.layoutDepth) return `layout nests deeper than ${limits.layoutDepth} levels`;
      if (node.kind === "split") {
        if (!Number.isFinite(node.ratio) || node.ratio < 0.1 || node.ratio > 0.9) {
          return `ratio ${node.ratio} is outside [0.1, 0.9]`;
        }
        return walk(node.a, depth + 1) ?? walk(node.b, depth + 1);
      }
      tiles += 1;
      const problem = appProblem(node.appId, wb);
      if (problem) return problem;
      const app = wb.core.apps.get(node.appId)!;
      // A doc-bound application placed with nothing bound opens empty, which
      // reads as a broken tile rather than as a mistake in the request.
      for (const key of documentSlots(app)) {
        if (!node.documents?.[key]) {
          return `app "${node.appId}" needs a "${key}" binding; got ${JSON.stringify(node.documents ?? {})}`;
        }
      }
      return null;
    };

    const problem = walk(spec, 1);
    if (problem) return problem;
    if (tiles > limits.tilesPerWorkspace) return `layout has ${tiles} tiles, the limit is ${limits.tilesPerWorkspace}`;
    if (!layoutFits(spec, wb.measure(), wb.core.policy.split)) return "layout would create panes smaller than this workbench's configured minimum size";
    return null;
  }

  /* ---- the tools -------------------------------------------------------- */

  const describeTool: FrontendTool<{ workspaceId?: string; geometry?: boolean }, Record<string, unknown>> = {
    name: "workbench_describe",
    mode: "frontend",
    description:
      "Read the user's screen: the applications that can be placed, the workspaces, and every tile with the id its verbs take. " +
      "Call this before changing anything — every id you use must have come from a tool result, never from memory.",
    parameters: z.object({
      workspaceId: z.string().optional().describe("only this workspace; omitted means all of them"),
      geometry: z.boolean().optional().describe("include each tile's rendered size as fractions of the screen"),
    }),
    available,
    async execute(input) {
      const wb = options.getWorkbench();
      if (!wb) return fail("no workbench is attached to this chat") as unknown as Record<string, unknown>;
      const description = wb.describe({
        ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
        ...(input.geometry ? { geometry: true } : {}),
      });
      if (input.workspaceId && description.workspaces.length === 0) {
        return fail(`unknown workspace "${input.workspaceId}"`) as unknown as Record<string, unknown>;
      }
      // A product may hide an application from a workspace. Marking rather
      // than omitting: the agent can then say "the ledger isn't available
      // here" instead of insisting the application does not exist.
      const workspaceId = input.workspaceId ?? wb.core.getState().session.workspaceId;
      const apps = description.apps.map((app) => {
        const presentation = wb.apps.get(app.id);
        return { ...app, available: presentation ? isAppAvailable(presentation, { workspaceId }) : false };
      });
      return { ok: true, ...description, apps, revision: await workbenchRevision(wb) } as unknown as Record<string, unknown>;
    },
  };

  const createWorkspaceTool: FrontendTool<
    { name: string; layout: LayoutSpec; expectedRevision: string; select?: boolean; confirmationId?: string },
    Record<string, unknown>
  > = {
    name: "workbench_create_workspace",
    mode: "frontend",
    description:
      "Create a new workspace of tiles and switch to it. A tile is {kind:'tile',appId}; a split is " +
      "{kind:'split',direction:'row'|'col',ratio,a,b} where 'row' places a and b side by side and ratio is a's " +
      `share. Example: ${WORKED_EXAMPLE}. Application ids come from workbench_describe; never invent one.`,
    parameters: z.object({
      name: z.string().min(1).describe("what to call it, e.g. 'Gold desk'"),
      layout: LayoutSpecSchema as unknown as z.ZodType<LayoutSpec>,
      expectedRevision: RevisionSchema.describe("revision from the latest workbench_describe"),
      select: z.boolean().optional().describe("switch to it; default true"),
      confirmationId: z.string().optional().describe("an approved pbui_propose id, if workspace.create requires confirmation"),
    }),
    available,
    async execute(input, context) {
      const wb = options.getWorkbench();
      if (!wb) return fail("no workbench is attached to this chat") as unknown as Record<string, unknown>;
      if (wb.core.getState().document.workspaces.length >= limits.workspaces) {
        return fail(`the workbench already has ${limits.workspaces} workspaces, the limit`) as unknown as Record<string, unknown>;
      }
      const problem = validateLayout(input.layout, wb);
      if (problem) return fail(problem) as unknown as Record<string, unknown>;

      const before = new Set(wb.core.getState().document.workspaces.map((w) => w.id));
      const verb: WorkbenchCommand = commands.createWorkspace(input.name, input.layout, input.select === false ? { select: false } : {});
      const outcome = await performWithPolicy(
        verb,
        input.expectedRevision,
        input.confirmationId,
        `${options.senderConversationId}:${context.toolCallId}`,
      );
      if (outcome !== "performed") return fail(outcome.replace(/^rejected:/, "")) as unknown as Record<string, unknown>;

      // The router returns nothing but an outcome, so name the workspace by
      // difference; the model needs the id for anything it does next.
      const after = wb.core.getState().document.workspaces.find((w) => !before.has(w.id));
      const description = after ? wb.describe({ workspaceId: after.id }) : null;
      return {
        ok: true,
        workspaceId: after?.id ?? null,
        name: after?.name ?? input.name,
        active: wb.core.getState().session.workspaceId === after?.id,
        revision: await workbenchRevision(wb),
        tiles: description?.workspaces[0]?.tiles ?? [],
      } as unknown as Record<string, unknown>;
    },
  };

  const openTileTool: FrontendTool<
    { appId: string; expectedRevision: string; documents?: Record<string, string>; near?: string; title?: string; confirmationId?: string },
    Record<string, unknown>
  > = {
    name: "workbench_open_tile",
    mode: "frontend",
    description:
      "Open one application in a new tile beside an existing one, optionally bound to specific documents. " +
      "If a tile already shows exactly these bindings the result says wentToExisting; do not call it again.",
    parameters: z.object({
      appId: z.string(),
      expectedRevision: RevisionSchema.describe("revision from the latest workbench_describe"),
      documents: z.record(z.string(), z.string()).optional(),
      near: z.string().optional().describe("a placementId to open beside; omitted means the active tile"),
      title: z.string().optional(),
      confirmationId: z.string().optional().describe("an approved pbui_propose id, if view.show requires confirmation"),
    }),
    available,
    async execute(input, context) {
      const wb = options.getWorkbench();
      if (!wb) return fail("no workbench is attached to this chat") as unknown as Record<string, unknown>;
      const problem = validateLayout(
        { kind: "tile", appId: input.appId, ...(input.documents ? { documents: input.documents } : {}) },
        wb,
      );
      if (problem) return fail(problem) as unknown as Record<string, unknown>;

      const workspaceId = wb.core.getState().session.workspaceId;
      const before = wb.describe({ workspaceId }).workspaces[0]?.tiles ?? [];
      const verb: WorkbenchCommand = commands.open(input.appId, input.documents ?? {}, {
        ...(input.near ? { near: input.near } : {}),
        ...(input.title ? { title: input.title } : {}),
      });
      const outcome = await performWithPolicy(
        verb,
        input.expectedRevision,
        input.confirmationId,
        `${options.senderConversationId}:${context.toolCallId}`,
      );
      if (outcome !== "performed") return fail(outcome.replace(/^rejected:/, "")) as unknown as Record<string, unknown>;

      const after = wb.describe({ workspaceId: wb.core.getState().session.workspaceId }).workspaces[0]?.tiles ?? [];
      const fresh = after.find((tile) => !before.some((old) => old.placementId === tile.placementId));
      // No new placement means `view.show` went to an existing tile — the
      // doc-bound de-dup rule. Reporting it stops the model concluding it
      // failed and opening a third.
      const wentToExisting = !fresh;
      const target = fresh ?? after.find((tile) => tile.placementId === wb.activePlacementId());
      return {
        ok: true,
        placementId: target?.placementId ?? null,
        viewId: target?.viewId ?? null,
        title: target?.title ?? null,
        wentToExisting,
        revision: await workbenchRevision(wb),
      } as unknown as Record<string, unknown>;
    },
  };

  const switchWorkspaceTool: FrontendTool<{ workspaceId: string; expectedRevision: string; confirmationId?: string }, Record<string, unknown>> = {
    name: "workbench_switch_workspace",
    mode: "frontend",
    description: "Show a different workspace. Its id comes from workbench_describe.",
    parameters: z.object({
      workspaceId: z.string(),
      expectedRevision: RevisionSchema.describe("revision from the latest workbench_describe"),
      confirmationId: z.string().optional().describe("an approved pbui_propose id, if session.selectWorkspace requires confirmation"),
    }),
    available,
    async execute(input, context) {
      const wb = options.getWorkbench();
      if (!wb) return fail("no workbench is attached to this chat") as unknown as Record<string, unknown>;
      if (!wb.core.getState().document.workspaces.some((w) => w.id === input.workspaceId)) {
        return fail(`unknown workspace "${input.workspaceId}"`) as unknown as Record<string, unknown>;
      }
      const outcome = await performWithPolicy(
        commands.selectWorkspace(input.workspaceId),
        input.expectedRevision,
        input.confirmationId,
        `${options.senderConversationId}:${context.toolCallId}`,
      );
      if (outcome !== "performed") return fail(outcome.replace(/^rejected:/, "")) as unknown as Record<string, unknown>;
      const description = wb.describe({ workspaceId: input.workspaceId });
      return {
        ok: true,
        activeWorkspaceId: wb.core.getState().session.workspaceId,
        revision: await workbenchRevision(wb),
        tiles: description.workspaces[0]?.tiles ?? [],
      } as unknown as Record<string, unknown>;
    },
  };

  const performTool: FrontendTool<{ verbs: unknown[]; expectedRevision: string; confirmationId?: string }, Record<string, unknown>> = {
    name: "workbench_perform",
    mode: "frontend",
    description:
      "Atomically preflight and apply one or more changes to the current layout. Every command must be valid or none land. " +
      "Each command is an object with a kind: placement.duplicate{placementId,axis?:'row'|'col'}, placement.close{placementId}, " +
      "placement.swap{a,b}, placement.dock{source,target,edge}, placement.resize{splitId,ratio}, " +
      "view.show{view:{kind:'application',appId,documents?}|{kind:'existing',viewId}, placement:{kind:'auto',near?}|{kind:'split',target?,edge?,axis?}|{kind:'replace',target}|{kind:'navigate'}}, " +
      "view.configure{viewId,title?,documents?}, session.selectWorkspace{workspaceId}, session.activatePlacement{placementId}, " +
      "workspace.rename{workspaceId,name}, workspace.clone{workspaceId}. Ids and expectedRevision come from workbench_describe.",
    parameters: z.object({
      verbs: z.array(z.record(z.string(), z.unknown())).min(1),
      expectedRevision: RevisionSchema.describe("revision from the latest workbench_describe"),
      confirmationId: z.string().optional().describe("an approved pbui_propose id covering the complete atomic batch"),
    }),
    available,
    async execute(input, context) {
      const wb = options.getWorkbench();
      if (!wb) return fail("no workbench is attached to this chat") as unknown as Record<string, unknown>;
      if (input.verbs.length > limits.verbsPerCall) {
        return fail(`${input.verbs.length} verbs in one call, the limit is ${limits.verbsPerCall}`) as unknown as Record<string, unknown>;
      }
      const beforeRevision = await workbenchRevision(wb);
      if (input.expectedRevision !== beforeRevision) {
        return fail("workbench changed; call workbench_describe again and use its revision") as unknown as Record<string, unknown>;
      }

      const verbs: WorkbenchCommand[] = [];
      const errors: { index: number; verb: unknown; error: string }[] = [];
      input.verbs.forEach((candidate, index) => {
        if (!isWorkbenchCommand(candidate)) {
          const kind = (candidate as { kind?: unknown }).kind;
          // The launcher and the other dialogs are the human's; an agent
          // opening one steals the keyboard.
          const shellAction = typeof kind === "string" && /^(launcher|rebalance|link\.mode|relation\.palette|show\.chooser)\./.test(kind);
          errors.push({ index, verb: candidate, error: shellAction ? `${kind} is not something the assistant may do` : "not a complete workbench command; see the tool description for required fields" });
          return;
        }
        const unusable = verbProblem(candidate, wb);
        if (unusable) errors.push({ index, verb: candidate, error: unusable });
        else verbs.push(candidate);
      });
      const forbidden = verbs.find((verb) => decisionFor(policyKindOf(verb)) === "deny");
      if (forbidden) errors.push({ index: input.verbs.indexOf(forbidden), verb: forbidden, error: `${forbidden.kind} is not something the assistant may do` });
      if (errors.length > 0) {
        return {
          ok: false,
          atomic: true,
          applied: 0,
          errors,
          results: input.verbs.map((verb, index) => ({
            verb,
            ok: false,
            error: errors.find((entry) => entry.index === index)?.error ?? "atomic batch rejected because another verb is invalid",
          })),
        } as unknown as Record<string, unknown>;
      }

      // Advisory preflight (S2): the batch is planned against the current
      // state and refused early; acceptance below executes it FRESH.
      const previewed = wb.preview(verbs);
      if (!previewed.ok) {
        const at = previewed.index ?? 0;
        const because = `the workbench refused to ${describeWorkbenchCommand(verbs[at]!)}: ${previewed.because}`;
        return {
          ok: false,
          atomic: true,
          applied: 0,
          errors: [{ index: at, verb: verbs[at], error: because }],
          results: verbs.map((verb, index) => ({
            verb,
            ok: false,
            error: index === at ? because : "atomic plan rejected before any command was applied",
          })),
        } as unknown as Record<string, unknown>;
      }
      const baseRevision = wb.core.getState().revision;
      const gated = verbs.filter((verb) => decisionFor(policyKindOf(verb)) === "confirm");
      const effectId = `${options.senderConversationId}:${context.toolCallId}`;
      const result = await options.effectGateway.execute({
        effectId,
        invocationKey: effectId.replace(":", "/"),
        actor: "agent",
        conversationId: options.senderConversationId,
        effectKind: "workbench.verb_batch",
        effectScope: "workbench",
        input: { verbs: input.verbs, expectedRevision: input.expectedRevision } as unknown as JsonValue,
        targetIds: verbs.flatMap(workbenchVerbTargetIds),
        policy: gated.length > 0 ? "confirm" : "allow",
        confirmationId: input.confirmationId,
        beforeRevision,
        approvalPrompt:
          `this atomic batch includes ${gated.map((verb) => describeWorkbenchCommand(verb)).join(", ")}; call pbui_propose first ` +
          "describing the complete batch, and pass its id as confirmationId",
        approvalDescription: `apply ${verbs.length} workbench changes atomically`,
        async perform() {
          if (wb.core.getState().revision !== baseRevision) {
            return { outcome: "rejected:workbench changed while awaiting approval; call workbench_describe again" };
          }
          const executed = wb.execute(verbs);
          if (!executed.ok) return { outcome: `rejected:the workbench refused the atomic batch: ${executed.because}` };
          return { outcome: "performed", afterRevision: await workbenchRevision(wb) } as const;
        },
      });
      if (result.outcome !== "performed") {
        const error = result.outcome.replace(/^rejected:/, "");
        return {
          ok: false,
          atomic: true,
          applied: 0,
          error,
          results: verbs.map((verb) => ({ verb, ok: false, error })),
        } as unknown as Record<string, unknown>;
      }
      const description = wb.describe({ workspaceId: wb.core.getState().session.workspaceId });
      return {
        ok: true,
        atomic: true,
        applied: verbs.length,
        results: verbs.map((verb) => ({ verb, ok: true })),
        revision: await workbenchRevision(wb),
        tiles: description.workspaces[0]?.tiles ?? [],
      } as unknown as Record<string, unknown>;
    },
  };

  /**
   * Map raw mutations back to the high-level policy whose effect they mirror.
   * This is intentionally an allowlist: a newly generated mutation case gets
   * no implicit destructive classification and must be considered here.
   */
  function rawPolicyKind(mutation: Mutation): string | null {
    switch (mutation.body.case) {
      case "workspaceDelete":
        return "workspace.delete";
      case "viewDelete":
      case "viewClose":
      case "placementClose":
        return "placement.close";
      case "placementReplace":
        return "view.show.replace";
      case "viewConfigure":
        // Title and binding changes have their own allow-by-default command;
        // changing appId is the raw equivalent of replacing a tile.
        return mutation.body.value.appId !== undefined ? "view.show.replace" : null;
      case "documentDelete":
        return "document.delete";
      default:
        return null;
    }
  }

  const applyTool: FrontendTool<{ mutations: unknown[]; expectedRevision: string; confirmationId?: string }, Record<string, unknown>> = {
    name: "workbench_apply",
    mode: "frontend",
    description:
      "Apply a raw protobuf-JSON workbench MutationBatch — the same shape `hyperslop ui mutate` takes. Prefer the " +
      "higher-level tools; this exists for operations they do not express. The batch is atomic: either every " +
      "mutation lands or none does.",
    parameters: z.object({
      mutations: z.array(z.record(z.string(), z.unknown())).min(1),
      expectedRevision: RevisionSchema.describe("revision from the latest workbench_describe"),
      confirmationId: z.string().optional().describe("required when the batch performs a confirmation-gated operation"),
    }),
    // Not merely hidden: `RegisterManifestTools` skips an unavailable
    // descriptor, so with the option off the model is never told this exists.
    available: () => Boolean(options.allowRawMutations) && available(),
    async execute(input, context) {
      const wb = options.getWorkbench();
      if (!wb) return fail("no workbench is attached to this chat") as unknown as Record<string, unknown>;
      if (input.mutations.length > limits.mutationsPerCall) {
        return fail(`${input.mutations.length} mutations in one call, the limit is ${limits.mutationsPerCall}`) as unknown as Record<string, unknown>;
      }

      let batch: Mutation[];
      try {
        batch = input.mutations.map((raw) => fromJson(MutationSchema, raw as JsonValue));
      } catch (error) {
        // A shape the generated codec refuses never reaches the applier, and
        // its message names the field, which is what the model needs.
        return fail(`not a mutation: ${error instanceof Error ? error.message : String(error)}`) as unknown as Record<string, unknown>;
      }

      const classified = batch
        .map((mutation) => ({ mutation, policyKind: rawPolicyKind(mutation) }))
        .filter((item): item is { mutation: Mutation; policyKind: string } => item.policyKind !== null);
      const forbidden = classified.find((item) => decisionFor(item.policyKind) === "deny");
      if (forbidden) {
        return fail(`${forbidden.mutation.body.case} is not something the assistant may do; ask the user to do it`) as unknown as Record<string, unknown>;
      }
      const confirmationGated = classified.filter((item) => decisionFor(item.policyKind) === "confirm");

      const beforeRevision = await workbenchRevision(wb);
      if (input.expectedRevision !== beforeRevision) {
        return fail("workbench changed; call workbench_describe again and use its revision") as unknown as Record<string, unknown>;
      }
      const baseRevision = wb.core.getState().revision;

      // A dry run against the immutable document, to learn WHY the applier
      // refuses before spending an approval on the batch.
      try {
        applyMutations(wb.core.getState().document, batch);
      } catch (error) {
        if (error instanceof MutationError) {
          return { ok: false, error: error.detail, code: error.code, path: error.path } as unknown as Record<string, unknown>;
        }
        throw error;
      }

      const result = await options.effectGateway.execute({
        effectId: `${options.senderConversationId}:${context.toolCallId}`,
        invocationKey: `${options.senderConversationId}/${context.toolCallId}`,
        actor: "agent",
        conversationId: options.senderConversationId,
        effectKind: "workbench.mutation_batch",
        effectScope: "workbench",
        input: { mutations: input.mutations, expectedRevision: input.expectedRevision } as unknown as JsonValue,
        policy: confirmationGated.length > 0 ? "confirm" : "allow",
        confirmationId: input.confirmationId,
        beforeRevision,
        approvalPrompt:
          `this batch changes ${confirmationGated.map((item) => item.mutation.body.case).join(", ")}; call pbui_propose first ` +
          "describing exactly that, and pass the id you used as confirmationId",
        approvalDescription: "this mutation batch",
        async perform() {
          if (wb.core.getState().revision !== baseRevision) {
            return { outcome: "rejected:workbench changed while awaiting approval; call workbench_describe again" };
          }
          const applied = wb.apply(batch);
          if (!applied.ok) return { outcome: `rejected:the workbench refused the batch: ${applied.because}` };
          const description = wb.describe({ workspaceId: wb.core.getState().session.workspaceId });
          return {
            outcome: "performed",
            afterRevision: await workbenchRevision(wb),
            value: {
              ok: true,
              applied: batch.length,
              revision: await workbenchRevision(wb),
              tiles: description.workspaces[0]?.tiles ?? [],
            },
          } as const;
        },
      });
      if (result.outcome !== "performed") return fail(result.outcome.replace(/^rejected:/, "")) as unknown as Record<string, unknown>;
      return result.value as unknown as Record<string, unknown>;
    },
  };

  return {
    tools: [describeTool, createWorkspaceTool, openTileTool, switchWorkspaceTool, performTool, applyTool] as ToolDefinition[],
  };
}

/** The command kinds a product must declare in its vocabulary for these tools to work. */
export const WORKBENCH_COMMAND_KINDS: WorkbenchCommandKind[] = [
  "placement.duplicate",
  "placement.close",
  "placement.swap",
  "placement.dock",
  "placement.replaceWith",
  "placement.resize",
  "view.show",
  "view.configure",
  "workspace.create",
  "workspace.rename",
  "workspace.delete",
  "workspace.clone",
  "workspace.rebalance",
  "session.selectWorkspace",
  "session.activatePlacement",
];
