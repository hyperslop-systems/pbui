import { describeLinkVerb, isLinkVerb, type LinkVerb } from "@hyperslop-systems/pbui/link-kernel";
import type { Node } from "@hyperslop-systems/workbench-protocol";
import type { LayoutSpec } from "./document";
import type { Axis } from "./policy";

/*
 * The command algebra (guide §8.4, §16.4). Semantic, placement-level, and
 * data: a human's button, an agent's tool call, and a remote caller all cross
 * this one boundary. What is NOT here — launcher, rebalance dialog, connect
 * mode, the relation palette, the show chooser — is a shell action.
 */

export type Edge = "left" | "right" | "top" | "bottom";

/** Which logical view a `view.show` is about (guide §8.5). */
export type ViewRequest =
  | { kind: "existing"; viewId: string }
  | {
      kind: "application";
      appId: string;
      documents?: Readonly<Record<string, string>>;
      title?: string;
      /**
       * When to reuse a view instead of creating one. `"manifest-default"`
       * (the default): a `viewCardinality: "one"` application's view, and a
       * doc-bound application's view with exactly the requested bindings.
       * `"same-bindings"`: any view of the application with exactly the
       * requested bindings. `"never"`: always create.
       */
      reuse?: "manifest-default" | "same-bindings" | "never";
      /** Mint the view under THIS id (a planned follow may name its ports). */
      requestedViewId?: string;
    };

/** Where the view should appear (guide §8.5). */
export type PlacementRequest =
  /** Go to a placement the view already has, switching workspace if needed; refused for a view nothing places. */
  | { kind: "navigate" }
  /** Navigate when the view is already placed anywhere; otherwise split beside `near` (else the active tile, else the first) along the longer axis. */
  | { kind: "auto"; near?: string }
  /**
   * Always a new placement beside `target` (default: the active tile, else
   * the first). An `edge` fixes axis and side; `axis` fixes only the axis;
   * neither ⇒ the longer rendered axis, and a target showing the policy's
   * empty-placement application is FILLED instead of split.
   */
  | { kind: "split"; target?: string; edge?: Edge; axis?: Axis }
  /** Change what `target` shows, in place; the pane keeps its rectangle and, when it owns its view, its view identity. */
  | { kind: "replace"; target: string };

/** The link commands: every link verb except the shell-local ones. */
export type WorkbenchLinkCommand = Exclude<LinkVerb, { kind: "link.mode.open" | "link.mode.close" | "relation.palette.open" | "relation.palette.close" }>;

export type WorkbenchCommand =
  | { kind: "placement.duplicate"; placementId: string; axis?: Axis }
  | { kind: "placement.close"; placementId: string }
  | { kind: "placement.swap"; a: string; b: string }
  | { kind: "placement.dock"; source: string; target: string; edge: Edge }
  /** The Alt-drag gesture: the target shows the source's view, the source closes. */
  | { kind: "placement.replaceWith"; source: string; target: string }
  | { kind: "placement.resize"; splitId: string; ratio: number; snap?: boolean }
  | { kind: "view.show"; view: ViewRequest; placement: PlacementRequest }
  /** `title: ""` clears the title; `documents` replaces the whole binding map, never merges. */
  | { kind: "view.configure"; viewId: string; title?: string; documents?: Readonly<Record<string, string>> }
  | { kind: "workspace.create"; name: string; layout?: LayoutSpec; workspaceId?: string; select?: boolean }
  | { kind: "workspace.rename"; workspaceId: string; name: string }
  | { kind: "workspace.delete"; workspaceId: string }
  | { kind: "workspace.clone"; workspaceId: string; name?: string; newWorkspaceId?: string; select?: boolean }
  /** Replace a workspace's tree with one that places exactly the same placement→view map (guide §11.4). */
  | { kind: "workspace.rebalance"; workspaceId: string; tree: Node }
  | { kind: "session.selectWorkspace"; workspaceId: string }
  | { kind: "session.activatePlacement"; placementId: string | null }
  | WorkbenchLinkCommand;

export type WorkbenchCommandKind = WorkbenchCommand["kind"];

const SHELL_LOCAL_LINK_KINDS = new Set(["link.mode.open", "link.mode.close", "relation.palette.open", "relation.palette.close"]);

export function isWorkbenchLinkCommand(value: unknown): value is WorkbenchLinkCommand {
  return isLinkVerb(value) && !SHELL_LOCAL_LINK_KINDS.has(value.kind);
}

const EDGES = new Set<string>(["left", "right", "top", "bottom"]);
const AXES = new Set<string>(["row", "col"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isStringMap(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((entry) => typeof entry === "string");
}

function isViewRequest(value: unknown): value is ViewRequest {
  if (!isRecord(value)) return false;
  if (value.kind === "existing") return typeof value.viewId === "string" && value.viewId.length > 0;
  if (value.kind !== "application") return false;
  return (
    typeof value.appId === "string" &&
    value.appId.length > 0 &&
    (value.documents === undefined || isStringMap(value.documents)) &&
    (value.title === undefined || typeof value.title === "string") &&
    (value.reuse === undefined || ["manifest-default", "same-bindings", "never"].includes(String(value.reuse))) &&
    (value.requestedViewId === undefined || (typeof value.requestedViewId === "string" && value.requestedViewId.length > 0))
  );
}

function isPlacementRequest(value: unknown): value is PlacementRequest {
  if (!isRecord(value)) return false;
  switch (value.kind) {
    case "navigate":
      return true;
    case "auto":
      return value.near === undefined || typeof value.near === "string";
    case "split":
      return (
        (value.target === undefined || typeof value.target === "string") &&
        (value.edge === undefined || EDGES.has(String(value.edge))) &&
        (value.axis === undefined || AXES.has(String(value.axis)))
      );
    case "replace":
      return typeof value.target === "string" && value.target.length > 0;
    default:
      return false;
  }
}

/** The complete shape, not a kind prefix: an agent's half-written command must be refused before it is planned. */
export function isWorkbenchCommand(value: unknown): value is WorkbenchCommand {
  if (!isRecord(value)) return false;
  const string = (key: string) => typeof value[key] === "string" && (value[key] as string).length > 0;
  const optionalString = (key: string) => value[key] === undefined || typeof value[key] === "string";
  const optionalBoolean = (key: string) => value[key] === undefined || typeof value[key] === "boolean";
  switch (value.kind) {
    case "placement.duplicate":
      return string("placementId") && (value.axis === undefined || AXES.has(String(value.axis)));
    case "placement.close":
      return string("placementId");
    case "placement.swap":
      return string("a") && string("b");
    case "placement.dock":
      return string("source") && string("target") && EDGES.has(String(value.edge));
    case "placement.replaceWith":
      return string("source") && string("target");
    case "placement.resize":
      return string("splitId") && typeof value.ratio === "number" && Number.isFinite(value.ratio) && optionalBoolean("snap");
    case "view.show":
      return isViewRequest(value.view) && isPlacementRequest(value.placement);
    case "view.configure":
      return string("viewId") && optionalString("title") && (value.documents === undefined || isStringMap(value.documents)) && (value.title !== undefined || value.documents !== undefined);
    case "workspace.create":
      return string("name") && optionalString("workspaceId") && optionalBoolean("select") && (value.layout === undefined || isRecord(value.layout));
    case "workspace.rename":
      return string("workspaceId") && string("name");
    case "workspace.delete":
    case "session.selectWorkspace":
      return string("workspaceId");
    case "workspace.clone":
      return string("workspaceId") && optionalString("name") && optionalString("newWorkspaceId") && optionalBoolean("select");
    case "workspace.rebalance":
      return string("workspaceId") && isRecord(value.tree);
    case "session.activatePlacement":
      return value.placementId === null || string("placementId");
    default:
      return isWorkbenchLinkCommand(value);
  }
}

function describePlacement(placement: PlacementRequest, what: string): string {
  switch (placement.kind) {
    case "navigate":
      return `go to ${what}`;
    case "auto":
      return `open ${what} ${placement.near ? "beside that tile" : "beside the active tile"}`;
    case "split":
      return placement.edge ? `open ${what} at that tile's ${placement.edge} edge` : `open ${what} beside that tile`;
    case "replace":
      return `show ${what} in that tile instead`;
  }
}

export function describeWorkbenchCommand(command: WorkbenchCommand): string {
  if (isWorkbenchLinkCommand(command)) return describeLinkVerb(command);
  switch (command.kind) {
    case "placement.duplicate":
      return command.axis === "col" ? "split top and bottom" : command.axis === "row" ? "split side by side" : "duplicate this tile";
    case "placement.close":
      return "close this tile";
    case "placement.swap":
      return "swap the two tiles";
    case "placement.dock":
      return `dock beside the ${command.edge} edge`;
    case "placement.replaceWith":
      return "replace that tile with this one";
    case "placement.resize":
      return `set the divider to ${Math.round(command.ratio * 100)}%`;
    case "view.show":
      return describePlacement(command.placement, command.view.kind === "existing" ? "that view" : command.view.appId);
    case "view.configure":
      if (command.documents && command.title === undefined) return "point this tile at a different document";
      return command.title ? `rename the tile to “${command.title}”` : "clear the tile's name";
    case "workspace.create":
      return `create the workspace “${command.name}”`;
    case "workspace.rename":
      return `rename the workspace to “${command.name}”`;
    case "workspace.delete":
      return "delete this workspace and its tiles";
    case "workspace.clone":
      return "duplicate this workspace";
    case "workspace.rebalance":
      return "rearrange this workspace's tiles";
    case "session.selectWorkspace":
      return "go to that workspace";
    case "session.activatePlacement":
      return command.placementId ? "make this the active tile" : "clear the active tile";
  }
}

/**
 * Convenience builders. Each compiles to the normal form; there is no
 * second vocabulary, so a product that names its own verbs maps them here.
 */
export const commands = {
  duplicate: (placementId: string, axis?: Axis): WorkbenchCommand => ({ kind: "placement.duplicate", placementId, ...(axis ? { axis } : {}) }),
  /** A split with an application named: a fresh (or reused singleton) view of it beside the tile. */
  split: (placementId: string, axis: Axis, appId?: string): WorkbenchCommand =>
    appId
      ? { kind: "view.show", view: { kind: "application", appId }, placement: { kind: "split", target: placementId, axis } }
      : { kind: "placement.duplicate", placementId, axis },
  close: (placementId: string): WorkbenchCommand => ({ kind: "placement.close", placementId }),
  swap: (a: string, b: string): WorkbenchCommand => ({ kind: "placement.swap", a, b }),
  dock: (source: string, target: string, edge: Edge): WorkbenchCommand => ({ kind: "placement.dock", source, target, edge }),
  replaceWith: (source: string, target: string): WorkbenchCommand => ({ kind: "placement.replaceWith", source, target }),
  resize: (splitId: string, ratio: number, options: { snap?: boolean } = {}): WorkbenchCommand => ({ kind: "placement.resize", splitId, ratio, ...options }),
  activate: (placementId: string | null): WorkbenchCommand => ({ kind: "session.activatePlacement", placementId }),
  /** The launcher rule: a placed view is gone to; anything else opens beside `from` (else the active tile). */
  place: (appId: string, options: { from?: string } = {}): WorkbenchCommand => ({
    kind: "view.show",
    view: { kind: "application", appId },
    placement: { kind: "auto", ...(options.from ? { near: options.from } : {}) },
  }),
  /** Placement mode's commit: open `appId` exactly where the user aimed. */
  placeAt: (appId: string, target: string, zone: Edge | "center" | "replace", documents?: Record<string, string>): WorkbenchCommand => ({
    kind: "view.show",
    view: { kind: "application", appId, ...(documents ? { documents, reuse: "same-bindings" } : {}) },
    placement: zone === "replace" ? { kind: "replace", target } : zone === "center" ? { kind: "split", target } : { kind: "split", target, edge: zone },
  }),
  /** Open an application on specific bindings; the same bindings already open are gone to (or linked in when aimed). */
  open: (appId: string, documents: Record<string, string>, options: { near?: string; title?: string; at?: { placementId: string; zone: Edge | "center" | "replace" }; viewId?: string } = {}): WorkbenchCommand => ({
    kind: "view.show",
    view: { kind: "application", appId, documents, reuse: "same-bindings", ...(options.title ? { title: options.title } : {}), ...(options.viewId ? { requestedViewId: options.viewId } : {}) },
    placement: options.at
      ? options.at.zone === "replace"
        ? { kind: "replace", target: options.at.placementId }
        : options.at.zone === "center"
          ? { kind: "split", target: options.at.placementId }
          : { kind: "split", target: options.at.placementId, edge: options.at.zone }
      : { kind: "auto", ...(options.near ? { near: options.near } : {}) },
  }),
  /** Change what one pane shows, in place. */
  replace: (placementId: string, appId: string, documents?: Record<string, string>): WorkbenchCommand => ({
    kind: "view.show",
    view: { kind: "application", appId, ...(documents ? { documents } : {}) },
    placement: { kind: "replace", target: placementId },
  }),
  /** Point a pane at an EXISTING view — the second placement of one view. */
  link: (placementId: string, viewId: string): WorkbenchCommand => ({ kind: "view.show", view: { kind: "existing", viewId }, placement: { kind: "replace", target: placementId } }),
  goTo: (viewId: string): WorkbenchCommand => ({ kind: "view.show", view: { kind: "existing", viewId }, placement: { kind: "navigate" } }),
  setTitle: (viewId: string, title: string): WorkbenchCommand => ({ kind: "view.configure", viewId, title }),
  rebind: (viewId: string, documents: Record<string, string>): WorkbenchCommand => ({ kind: "view.configure", viewId, documents }),
  selectWorkspace: (workspaceId: string): WorkbenchCommand => ({ kind: "session.selectWorkspace", workspaceId }),
  createWorkspace: (name: string, layout?: LayoutSpec, options: { workspaceId?: string; select?: boolean } = {}): WorkbenchCommand => ({ kind: "workspace.create", name, ...(layout ? { layout } : {}), ...options }),
  renameWorkspace: (workspaceId: string, name: string): WorkbenchCommand => ({ kind: "workspace.rename", workspaceId, name }),
  deleteWorkspace: (workspaceId: string): WorkbenchCommand => ({ kind: "workspace.delete", workspaceId }),
  cloneWorkspace: (workspaceId: string, options: { name?: string; newWorkspaceId?: string; select?: boolean } = {}): WorkbenchCommand => ({ kind: "workspace.clone", workspaceId, ...options }),
  rebalance: (workspaceId: string, tree: Node): WorkbenchCommand => ({ kind: "workspace.rebalance", workspaceId, tree }),
};
