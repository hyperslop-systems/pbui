import type { FrontendTool, ToolDefinition } from "@go-go-golems/chat-provider";
import {
  describeWorkbench,
  describeWorkbenchVerb,
  isAppAvailable,
  isWorkbenchVerb,
  type LayoutSpec,
  type Workbench,
  type WorkbenchVerb,
  type WorkbenchVerbKind,
} from "@hyperslop-systems/pbui-workbench";
import { type JsonValue, fromJson } from "@bufbuild/protobuf";
import { type Mutation, MutationSchema, type WorkbenchDocument } from "@hyperslop-systems/workbench-protocol";
import { applyMutations, MutationError } from "@hyperslop-systems/workbench-protocol/client";
import { z } from "zod";
import type { Outcome, VerbLike } from "../types";

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
  "tile.activate": "allow",
  "tile.split": "allow",
  "tile.swap": "allow",
  "tile.dock": "allow",
  "tile.link": "allow",
  "split.resize": "allow",
  "app.place": "allow",
  "view.open": "allow",
  "view.setTitle": "allow",
  "view.rebind": "allow",
  "view.goTo": "allow",
  "workspace.create": "allow",
  "workspace.select": "allow",
  "workspace.rename": "allow",
  "workspace.clone": "allow",
  // Destroys what someone may be reading.
  "tile.close": "confirm",
  "tile.replace": "confirm",
  "workspace.delete": "confirm",
  // The launcher is a human's dialog; an agent opening it steals the keyboard.
  "launcher.open": "deny",
  "launcher.close": "deny",
};

/* ---- the factory --------------------------------------------------------- */

export interface WorkbenchToolsOptions {
  /**
   * The attached workbench, read at call time. A function rather than a value
   * because `createPbuiChat` builds its extension before the workbench exists
   * (the workbench's apps need the chat), so the tools are registered with
   * `available: () => getWorkbench() !== null` and simply are not offered to
   * the model until `attachWorkbench` runs.
   */
  getWorkbench(): Workbench | null;
  /**
   * Perform one verb through the PRODUCT's router rather than calling
   * `wb.verbs.*`. That single indirection is what buys the trace: the router
   * validates against the vocabulary, records the outcome — including a
   * rejection — and reports it with `actor: "agent"`.
   */
  perform(verb: VerbLike): Promise<Outcome>;
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
   * Translate a workbench verb into the product's own verb before it reaches
   * the router. The default emits the `WorkbenchVerb` unchanged, so a product
   * declares `tile.close` and friends in its vocabulary and routes them to
   * `performWorkbenchVerb`; a product that already has its own names for
   * these maps them here.
   */
  mapVerb?(verb: WorkbenchVerb): VerbLike;
  /** How many document snapshots to keep for undo. Default 20. */
  history?: number;
  /**
   * Was this `pbui_propose` id approved by a human, FOR THIS VERB?
   *
   * The verb is passed because an approval that names only an id authorises
   * every `confirm`-policy verb equally: approve one tile's closure and the
   * same id closes a different tile, or deletes a workspace. A product
   * compares the verb against what it actually put in front of the user.
   *
   * The product owns the answer because it owns the proposal state: the card
   * performs `resolveProposal` through the router, and whatever records that
   * is what this reads. There is no default that says yes — without a wiring
   * a `confirm`-policy verb is refused, which is the right way round for a
   * check whose whole job is to not be skippable.
   */
  isApproved?(confirmationId: string, verb: WorkbenchVerb): boolean;
}

export interface UndoEntry {
  token: string;
  label: string;
  at: string;
  document: WorkbenchDocument;
}

export interface WorkbenchTools {
  tools: ToolDefinition[];
  /** The undo ring, so a product can render "Undo" chips and perform them. */
  history(): readonly UndoEntry[];
  /** Restore a snapshot. Returns false for a token that has aged out. */
  undo(token: string): boolean;
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
 * `WorkbenchVerb` handlers a mouse gesture calls, on the same local document,
 * reported to the same trace. The agent gets no private door into the layout:
 * if it can do something the UI cannot, the UI is missing a button.
 */
export function createWorkbenchTools(options: WorkbenchToolsOptions): WorkbenchTools {
  const limits: WorkbenchToolLimits = { ...DEFAULT_LIMITS, ...options.limits };
  // Not `WorkbenchPolicy`: spreading a Partial over it widens every value to
  // `PolicyDecision | undefined`, and `decisionFor` already answers "allow"
  // for a kind nobody has an opinion about.
  const policy: Record<string, PolicyDecision | undefined> = { ...DEFAULT_POLICY, ...options.policy };
  const mapVerb = options.mapVerb ?? ((verb: WorkbenchVerb) => verb as unknown as VerbLike);
  const keep = options.history ?? 20;
  const ring: UndoEntry[] = [];
  let counter = 0;

  const available = () => options.getWorkbench() !== null;

  /**
   * The document is an immutable protobuf message replaced wholesale on every
   * committed batch, so holding a reference IS the snapshot — there is
   * nothing to clone and nothing to diff.
   */
  function snapshot(wb: Workbench, label: string): string {
    counter += 1;
    const token = `undo-${counter}`;
    ring.push({ token, label, at: new Date().toISOString(), document: wb.store.getState().document });
    if (ring.length > keep) ring.shift();
    return token;
  }

  async function performVerb(verb: WorkbenchVerb): Promise<Outcome> {
    return options.perform(mapVerb(verb));
  }

  function decisionFor(kind: string): PolicyDecision {
    return policy[kind] ?? "allow";
  }

  const isApproved = options.isApproved ?? (() => false);
  /**
   * Approvals already spent. Even a product whose `isApproved` is a plain
   * id lookup gets one-shot semantics from here: an approval is permission to
   * do a thing once, and a model that reuses the id for a second destructive
   * verb is doing something nobody agreed to.
   */
  const spent = new Set<string>();

  function checkPolicy(verb: WorkbenchVerb, confirmationId: string | undefined): string | null {
    const decision = decisionFor(verb.kind);
    if (decision === "deny") return `${verb.kind} is not something the assistant may do; ask the user to do it`;
    if (decision === "allow") return null;
    if (!confirmationId) {
      return `${verb.kind} needs the user's approval: call pbui_propose first, describing exactly this change, and pass the id you used as confirmationId`;
    }
    if (spent.has(confirmationId)) {
      return `the approval "${confirmationId}" has already been used; ask again for this change`;
    }
    if (!isApproved(confirmationId, verb)) {
      return `no approved proposal with id "${confirmationId}" for ${describeWorkbenchVerb(verb)}`;
    }
    return null;
  }

  /** Called only after the verb was actually attempted, so a refusal does not burn the approval. */
  function spend(confirmationId: string | undefined): void {
    if (confirmationId) spent.add(confirmationId);
  }

  /* ---- id and availability checks, with messages a model can act on ------ */

  /** Is this application placeable HERE, and does it exist at all? */
  function appProblem(appId: string, wb: Workbench): string | null {
    const app = wb.apps.get(appId);
    if (!app) {
      return `unknown app "${appId}"; available: ${placeableIds(wb).join(", ")}`;
    }
    // A product hides an application from a workspace on purpose. The launcher
    // honours it; an agent that could place it anyway would be a way around
    // the policy rather than a second door to it.
    if (!isAppAvailable(app, { workspaceId: wb.store.getState().workspaceId })) {
      return `app "${appId}" is not offered in this workspace`;
    }
    return null;
  }

  function placeableIds(wb: Workbench): string[] {
    const workspaceId = wb.store.getState().workspaceId;
    return wb.apps
      .list()
      .filter((app) => isAppAvailable(app, { workspaceId }))
      .map((app) => app.id);
  }

  /**
   * What is wrong with a verb before it is dispatched, if anything.
   *
   * The handlers refuse a bad id by returning false, which now surfaces — but
   * "the workbench refused" is a worse message than "you misspelled
   * inventory", and an app id is the one field the protocol will happily
   * accept as anything at all.
   */
  function verbProblem(verb: WorkbenchVerb, wb: Workbench): string | null {
    const description = describeWorkbench(wb, { workspaceId: wb.store.getState().workspaceId });
    const tiles = description.workspaces[0]?.tiles ?? [];
    const knownPlacement = (id: string) => tiles.some((tile) => tile.placementId === id);
    const knownView = (id: string) => Boolean(wb.store.getState().document.views[id]);

    switch (verb.kind) {
      case "tile.split":
        if (!knownPlacement(verb.placementId)) return unknownPlacement(verb.placementId, tiles);
        return verb.appId ? appProblem(verb.appId, wb) : null;
      case "tile.replace":
        if (!knownPlacement(verb.placementId)) return unknownPlacement(verb.placementId, tiles);
        return appProblem(verb.appId, wb);
      case "app.place":
        return appProblem(verb.appId, wb);
      case "tile.close":
      case "tile.activate":
        return knownPlacement(verb.placementId) ? null : unknownPlacement(verb.placementId, tiles);
      case "tile.link":
        if (!knownPlacement(verb.placementId)) return unknownPlacement(verb.placementId, tiles);
        return knownView(verb.viewId) ? null : `unknown view "${verb.viewId}"`;
      case "tile.swap":
        if (!knownPlacement(verb.a)) return unknownPlacement(verb.a, tiles);
        return knownPlacement(verb.b) ? null : unknownPlacement(verb.b, tiles);
      case "tile.dock":
        if (!knownPlacement(verb.source)) return unknownPlacement(verb.source, tiles);
        return knownPlacement(verb.target) ? null : unknownPlacement(verb.target, tiles);
      case "view.setTitle":
      case "view.rebind":
      case "view.goTo":
        return knownView(verb.viewId) ? null : `unknown view "${verb.viewId}"`;
      case "split.resize":
        return description.workspaces[0]?.splits.some((split) => split.splitId === verb.splitId)
          ? null
          : `unknown split "${verb.splitId}"`;
      case "workspace.select":
      case "workspace.rename":
      case "workspace.delete":
      case "workspace.clone":
        return wb.store.getState().document.workspaces.some((workspace) => workspace.id === verb.workspaceId)
          ? null
          : `unknown workspace "${verb.workspaceId}"`;
      default:
        return null;
    }
  }

  function unknownPlacement(id: string, tiles: { placementId: string }[]): string {
    return `unknown tile "${id}"; on screen: ${tiles.map((tile) => tile.placementId).join(", ") || "none"}`;
  }

  /* ---- layout validation, with messages written for a model to act on ---- */

  function validateLayout(spec: LayoutSpec, wb: Workbench): string | null {
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
      const app = wb.apps.get(node.appId)!;
      // A doc-bound application placed with nothing bound opens empty, which
      // reads as a broken tile rather than as a mistake in the request.
      for (const key of app.bindings ?? []) {
        if (!node.documents?.[key]) {
          return `app "${node.appId}" needs a "${key}" binding; got ${JSON.stringify(node.documents ?? {})}`;
        }
      }
      return null;
    };

    const problem = walk(spec, 1);
    if (problem) return problem;
    if (tiles > limits.tilesPerWorkspace) return `layout has ${tiles} tiles, the limit is ${limits.tilesPerWorkspace}`;
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
    execute(input) {
      const wb = options.getWorkbench();
      if (!wb) return fail("no workbench is attached to this chat") as unknown as Record<string, unknown>;
      const description = describeWorkbench(wb, {
        ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
        ...(input.geometry ? { geometry: true } : {}),
      });
      if (input.workspaceId && description.workspaces.length === 0) {
        return fail(`unknown workspace "${input.workspaceId}"`) as unknown as Record<string, unknown>;
      }
      // A product may hide an application from a workspace. Marking rather
      // than omitting: the agent can then say "the ledger isn't available
      // here" instead of insisting the application does not exist.
      const workspaceId = input.workspaceId ?? wb.store.getState().workspaceId;
      const apps = description.apps.map((app) => {
        const descriptor = wb.apps.get(app.id);
        return { ...app, available: descriptor ? isAppAvailable(descriptor, { workspaceId }) : false };
      });
      return { ok: true, ...description, apps } as unknown as Record<string, unknown>;
    },
  };

  const createWorkspaceTool: FrontendTool<
    { name: string; layout: LayoutSpec; select?: boolean },
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
      select: z.boolean().optional().describe("switch to it; default true"),
    }),
    available,
    async execute(input) {
      const wb = options.getWorkbench();
      if (!wb) return fail("no workbench is attached to this chat") as unknown as Record<string, unknown>;
      const denied = checkPolicy({ kind: "workspace.create", name: input.name, spec: input.layout }, undefined);
      if (denied) return fail(denied) as unknown as Record<string, unknown>;
      if (wb.store.getState().document.workspaces.length >= limits.workspaces) {
        return fail(`the workbench already has ${limits.workspaces} workspaces, the limit`) as unknown as Record<string, unknown>;
      }
      const problem = validateLayout(input.layout, wb);
      if (problem) return fail(problem) as unknown as Record<string, unknown>;

      const before = new Set(wb.store.getState().document.workspaces.map((w) => w.id));
      const undoToken = snapshot(wb, `create workspace ${input.name}`);
      const outcome = await performVerb({
        kind: "workspace.create",
        name: input.name,
        spec: input.layout,
        ...(input.select === false ? { select: false } : {}),
      });
      if (outcome !== "performed") return fail(outcome.replace(/^rejected:/, "")) as unknown as Record<string, unknown>;

      // The verb returns nothing through the router, so name the workspace by
      // difference; the model needs the id for anything it does next.
      const after = wb.store.getState().document.workspaces.find((w) => !before.has(w.id));
      const description = after ? describeWorkbench(wb, { workspaceId: after.id }) : null;
      return {
        ok: true,
        workspaceId: after?.id ?? null,
        name: after?.name ?? input.name,
        active: wb.store.getState().workspaceId === after?.id,
        tiles: description?.workspaces[0]?.tiles ?? [],
        undoToken,
      } as unknown as Record<string, unknown>;
    },
  };

  const openTileTool: FrontendTool<
    { appId: string; documents?: Record<string, string>; near?: string; title?: string },
    Record<string, unknown>
  > = {
    name: "workbench_open_tile",
    mode: "frontend",
    description:
      "Open one application in a new tile beside an existing one, optionally bound to specific documents. " +
      "If a tile already shows exactly these bindings the result says wentToExisting; do not call it again.",
    parameters: z.object({
      appId: z.string(),
      documents: z.record(z.string(), z.string()).optional(),
      near: z.string().optional().describe("a placementId to open beside; omitted means the active tile"),
      title: z.string().optional(),
    }),
    available,
    async execute(input) {
      const wb = options.getWorkbench();
      if (!wb) return fail("no workbench is attached to this chat") as unknown as Record<string, unknown>;
      const problem = validateLayout(
        { kind: "tile", appId: input.appId, ...(input.documents ? { documents: input.documents } : {}) },
        wb,
      );
      if (problem) return fail(problem) as unknown as Record<string, unknown>;

      const workspaceId = wb.store.getState().workspaceId;
      const before = describeWorkbench(wb, { workspaceId }).workspaces[0]?.tiles ?? [];
      const undoToken = snapshot(wb, `open ${input.appId}`);
      const outcome = await performVerb({
        kind: "view.open",
        appId: input.appId,
        documents: input.documents ?? {},
        ...(input.near ? { near: input.near } : {}),
        ...(input.title ? { title: input.title } : {}),
      });
      if (outcome !== "performed") return fail(outcome.replace(/^rejected:/, "")) as unknown as Record<string, unknown>;

      const after = describeWorkbench(wb, { workspaceId: wb.store.getState().workspaceId }).workspaces[0]?.tiles ?? [];
      const fresh = after.find((tile) => !before.some((old) => old.placementId === tile.placementId));
      // No new placement means `openView` went to an existing tile — the
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
        undoToken,
      } as unknown as Record<string, unknown>;
    },
  };

  const switchWorkspaceTool: FrontendTool<{ workspaceId: string }, Record<string, unknown>> = {
    name: "workbench_switch_workspace",
    mode: "frontend",
    description: "Show a different workspace. Its id comes from workbench_describe.",
    parameters: z.object({ workspaceId: z.string() }),
    available,
    async execute(input) {
      const wb = options.getWorkbench();
      if (!wb) return fail("no workbench is attached to this chat") as unknown as Record<string, unknown>;
      if (!wb.store.getState().document.workspaces.some((w) => w.id === input.workspaceId)) {
        return fail(`unknown workspace "${input.workspaceId}"`) as unknown as Record<string, unknown>;
      }
      const outcome = await performVerb({ kind: "workspace.select", workspaceId: input.workspaceId });
      if (outcome !== "performed") return fail(outcome.replace(/^rejected:/, "")) as unknown as Record<string, unknown>;
      const description = describeWorkbench(wb, { workspaceId: input.workspaceId });
      return {
        ok: true,
        activeWorkspaceId: wb.store.getState().workspaceId,
        tiles: description.workspaces[0]?.tiles ?? [],
      } as unknown as Record<string, unknown>;
    },
  };

  const performTool: FrontendTool<{ verbs: unknown[]; confirmationId?: string }, Record<string, unknown>> = {
    name: "workbench_perform",
    mode: "frontend",
    description:
      "Make one or two changes to the current layout. Each verb is an object with a kind: " +
      "tile.split{placementId,direction,appId?}, tile.close{placementId}, tile.swap{a,b}, " +
      "tile.replace{placementId,appId}, tile.link{placementId,viewId}, split.resize{splitId,ratio}, " +
      "app.place{appId,from?}, view.setTitle{viewId,title}, view.rebind{viewId,documents}, " +
      "view.goTo{viewId}, workspace.select{workspaceId}, workspace.rename{workspaceId,name}, " +
      "workspace.clone{workspaceId}. Ids come from workbench_describe.",
    parameters: z.object({
      verbs: z.array(z.record(z.string(), z.unknown())).min(1),
      confirmationId: z.string().optional().describe("the id of a pbui_propose the user approved, for a verb that needs approval"),
    }),
    available,
    async execute(input) {
      const wb = options.getWorkbench();
      if (!wb) return fail("no workbench is attached to this chat") as unknown as Record<string, unknown>;
      if (input.verbs.length > limits.verbsPerCall) {
        return fail(`${input.verbs.length} verbs in one call, the limit is ${limits.verbsPerCall}`) as unknown as Record<string, unknown>;
      }
      const undoToken = snapshot(wb, `perform ${input.verbs.length} verb(s)`);
      const results: { verb: unknown; ok: boolean; error?: string }[] = [];
      let applied = 0;
      for (const candidate of input.verbs) {
        if (!isWorkbenchVerb(candidate)) {
          results.push({ verb: candidate, ok: false, error: "not a workbench verb; see the tool description for the kinds" });
          continue;
        }
        const verb = candidate as WorkbenchVerb;
        const denied = checkPolicy(verb, input.confirmationId);
        if (denied) {
          results.push({ verb, ok: false, error: denied });
          continue;
        }
        // #2: `isWorkbenchVerb` is a prefix test on `kind`, nothing more. The
        // protocol accepts any string as an app id, so a misspelled one commits
        // a tile that renders an empty state while the tool reports success.
        const unusable = verbProblem(verb, wb);
        if (unusable) {
          results.push({ verb, ok: false, error: unusable });
          continue;
        }
        if (decisionFor(verb.kind) === "confirm") spend(input.confirmationId);
        const outcome = await performVerb(verb);
        if (outcome === "performed") {
          applied += 1;
          results.push({ verb, ok: true });
        } else {
          results.push({ verb, ok: false, error: outcome.replace(/^rejected:/, "") });
        }
      }
      const description = describeWorkbench(wb, { workspaceId: wb.store.getState().workspaceId });
      return {
        ok: applied > 0,
        applied,
        results,
        undoToken,
        tiles: description.workspaces[0]?.tiles ?? [],
      } as unknown as Record<string, unknown>;
    },
  };

  /**
   * Mutation cases that destroy something a person may be looking at. A raw
   * batch is not expressed in verbs, so the per-verb policy cannot see into
   * it; without this the escape hatch would also be a way around the confirm
   * gate, which is worse than not having the hatch.
   */
  const DESTRUCTIVE_CASES = new Set(["workspaceDelete", "viewDelete", "viewClose", "placementClose", "documentDelete"]);

  const applyTool: FrontendTool<{ mutations: unknown[]; confirmationId?: string }, Record<string, unknown>> = {
    name: "workbench_apply",
    mode: "frontend",
    description:
      "Apply a raw protobuf-JSON workbench MutationBatch — the same shape `hyperslop ui mutate` takes. Prefer the " +
      "higher-level tools; this exists for operations they do not express. The batch is atomic: either every " +
      "mutation lands or none does.",
    parameters: z.object({
      mutations: z.array(z.record(z.string(), z.unknown())).min(1),
      confirmationId: z.string().optional().describe("required when the batch removes a workspace, view, tile or document"),
    }),
    // Not merely hidden: `RegisterManifestTools` skips an unavailable
    // descriptor, so with the option off the model is never told this exists.
    available: () => Boolean(options.allowRawMutations) && available(),
    execute(input) {
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

      const destructive = batch.filter((item) => DESTRUCTIVE_CASES.has(item.body.case ?? ""));
      if (destructive.length > 0) {
        if (!input.confirmationId) {
          return fail(
            `this batch removes ${destructive.map((item) => item.body.case).join(", ")}; call pbui_propose first ` +
              "describing exactly that, and pass the id you used as confirmationId",
          ) as unknown as Record<string, unknown>;
        }
        if (spent.has(input.confirmationId)) {
          return fail(`the approval "${input.confirmationId}" has already been used`) as unknown as Record<string, unknown>;
        }
        // The product's predicate takes a verb; a raw batch has none, so it is
        // asked about the closest verb this batch amounts to.
        if (!isApproved(input.confirmationId, { kind: "workspace.delete", workspaceId: "" })) {
          return fail(`no approved proposal with id "${input.confirmationId}"`) as unknown as Record<string, unknown>;
        }
      }

      // Applied twice on purpose: once against a copy to learn WHY the applier
      // refuses, since `store.mutate` only answers true or false, and once for
      // real. The document is immutable, so the dry run cannot affect it.
      try {
        applyMutations(wb.store.getState().document, batch);
      } catch (error) {
        if (error instanceof MutationError) {
          return { ok: false, error: error.detail, code: error.code, path: error.path } as unknown as Record<string, unknown>;
        }
        throw error;
      }

      const undoToken = snapshot(wb, `apply ${batch.length} mutation(s)`);
      if (!wb.mutate(batch)) return fail("the workbench refused the batch") as unknown as Record<string, unknown>;
      if (destructive.length > 0) spend(input.confirmationId);

      const description = describeWorkbench(wb, { workspaceId: wb.store.getState().workspaceId });
      return {
        ok: true,
        applied: batch.length,
        undoToken,
        tiles: description.workspaces[0]?.tiles ?? [],
      } as unknown as Record<string, unknown>;
    },
  };

  return {
    tools: [describeTool, createWorkspaceTool, openTileTool, switchWorkspaceTool, performTool, applyTool] as ToolDefinition[],
    history: () => ring,
    undo(token) {
      const at = ring.findIndex((entry) => entry.token === token);
      if (at < 0) return false;
      const wb = options.getWorkbench();
      if (!wb) return false;
      wb.store.replaceDocument(ring[at]!.document);
      // Everything after the restored point is unreachable; keeping it would
      // let a second undo jump forward in time.
      ring.splice(at);
      return true;
    },
  };
}

/** The verb kinds a product must declare in its vocabulary for these tools to work. */
export const WORKBENCH_VERB_KINDS: WorkbenchVerbKind[] = [
  "tile.split",
  "tile.close",
  "tile.swap",
  "tile.dock",
  "tile.activate",
  "tile.replace",
  "tile.link",
  "split.resize",
  "app.place",
  "view.setTitle",
  "view.open",
  "view.rebind",
  "view.goTo",
  "workspace.select",
  "workspace.create",
  "workspace.rename",
  "workspace.delete",
  "workspace.clone",
];

export { describeWorkbenchVerb };
