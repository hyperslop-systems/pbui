import { create, type MessageInitShape } from "@bufbuild/protobuf";
import { EmptySchema } from "@bufbuild/protobuf/wkt";
import {
  type AppView,
  AppViewSchema,
  Direction,
  DocumentBindingsSchema,
  type DocumentPayload,
  type Mutation,
  MutationSchema,
  type Node,
  PlacementPosition,
  type WorkbenchDocument,
} from "@hyperslop-systems/workbench-protocol";
import {
  closePlacement,
  dockPlacement,
  replacePlacement,
  findNode,
  leafNode,
  leaves,
  newId,
  placementCount,
  resizeSplit,
  snapRatio,
  splitNode,
  swapPlacements,
  viewsOfApp,
  workspaceOfPlacement,
  workspaceTree,
  type DockZone,
} from "@hyperslop-systems/workbench-protocol/client";
import { splitDirectionFor } from "@hyperslop-systems/pbui";
import type { AppDescriptor, AppRegistry } from "./apps";
import { buildLayout, workspaceCreateMutation, type LayoutSpec } from "./document";
import type { WorkbenchStore } from "./store";

export type SplitDirection = "row" | "col";

/**
 * Where the launcher's placement mode aims a new tile (PBUI-REBALANCE-1):
 * an edge docks the new tile there, "center" splits the target along its
 * longer rendered side, and "replace" (Alt) swaps the target's application
 * for the chosen one in place.
 */
export type PlaceZone = DockZone | "center" | "replace";

export interface PaneConstraints {
  /** Minimum width of either child in a row split. */
  minInlinePx: number;
  /** Minimum height of either child in a column split. */
  minBlockPx: number;
  /** Headless/relative floor even when rendered geometry is unavailable. */
  minFraction: number;
}

export const DEFAULT_PANE_CONSTRAINTS: PaneConstraints = {
  minInlinePx: 240,
  minBlockPx: 160,
  minFraction: 0.1,
};

export interface SplitRatioBounds {
  min: number;
  max: number;
}

/** Fallback for headless geometry; the rendered token is measured when available. */
export const DEFAULT_DIVIDER_PX = 10;

/** Bounds over the DISTRIBUTABLE pane axis, excluding the divider track. */
export function paneRatioBounds(size: number | null, minPx: number, minFraction: number): SplitRatioBounds | null {
  const floor = Math.max(0, Math.min(0.5, minFraction));
  if (size === null) return { min: floor, max: 1 - floor };
  if (!Number.isFinite(size) || size <= 0) return null;
  const renderedFloor = Math.max(floor, minPx / size);
  if (renderedFloor > 0.5) return null;
  return { min: renderedFloor, max: 1 - renderedFloor };
}

/**
 * What `place` does when the singleton it would place already has a view in
 * ANOTHER workspace. `"switch"` goes there (turboproof's and datalab-ui's
 * behaviour, and the least surprising); `"link"` gives this workspace a
 * second placement of the same view.
 */
export type CrossWorkspace = "switch" | "link";

/**
 * The tile verbs AS DATA, so a product can put them in an object menu beside
 * its own verbs: a `<tile>` descriptor's `actions()` returns these, the
 * product's router hands them to `performWorkbenchVerb`, and the chrome
 * buttons call the same handlers — two doors, one set of verbs.
 */
export type WorkbenchVerb =
  | { kind: "tile.split"; placementId: string; direction: SplitDirection; appId?: string }
  | { kind: "tile.close"; placementId: string }
  | { kind: "tile.swap"; a: string; b: string }
  | { kind: "tile.dock"; source: string; target: string; zone: DockZone }
  | { kind: "tile.replaceWith"; source: string; target: string }
  | { kind: "tile.activate"; placementId: string }
  | { kind: "split.resize"; splitId: string; ratio: number }
  | { kind: "app.place"; appId: string; from?: string }
  | { kind: "app.placeAt"; appId: string; target: string; zone: PlaceZone }
  | { kind: "view.setTitle"; viewId: string; title: string }
  | {
      kind: "view.open";
      appId: string;
      documents: Record<string, string>;
      near?: string;
      title?: string;
      /** Land at a named zone of a named tile, instead of beside `near`. */
      at?: { placementId: string; zone: PlaceZone };
    }
  | { kind: "tile.replace"; placementId: string; appId: string; documents?: Record<string, string> }
  | { kind: "tile.link"; placementId: string; viewId: string }
  | { kind: "view.rebind"; viewId: string; documents: Record<string, string> }
  | { kind: "workspace.select"; workspaceId: string }
  | { kind: "workspace.create"; name: string; spec?: LayoutSpec; workspaceId?: string; select?: boolean }
  | { kind: "workspace.setTree"; workspaceId: string; tree: Node }
  | { kind: "workspace.rename"; workspaceId: string; name: string }
  | { kind: "workspace.delete"; workspaceId: string }
  | { kind: "workspace.clone"; workspaceId: string; name?: string; newWorkspaceId?: string; select?: boolean }
  | { kind: "view.goTo"; viewId: string }
  | { kind: "launcher.open"; placementId?: string }
  | { kind: "launcher.close" }
  | { kind: "rebalance.open" }
  | { kind: "rebalance.close" };

export type WorkbenchVerbKind = WorkbenchVerb["kind"];

export const workbenchVerbs = {
  split: (placementId: string, direction: SplitDirection, appId?: string): WorkbenchVerb => ({
    kind: "tile.split",
    placementId,
    direction,
    ...(appId ? { appId } : {}),
  }),
  close: (placementId: string): WorkbenchVerb => ({ kind: "tile.close", placementId }),
  swap: (a: string, b: string): WorkbenchVerb => ({ kind: "tile.swap", a, b }),
  dock: (source: string, target: string, zone: DockZone): WorkbenchVerb => ({ kind: "tile.dock", source, target, zone }),
  replaceWith: (source: string, target: string): WorkbenchVerb => ({ kind: "tile.replaceWith", source, target }),
  activate: (placementId: string): WorkbenchVerb => ({ kind: "tile.activate", placementId }),
  resize: (splitId: string, ratio: number): WorkbenchVerb => ({ kind: "split.resize", splitId, ratio }),
  place: (appId: string, from?: string): WorkbenchVerb => ({ kind: "app.place", appId, ...(from ? { from } : {}) }),
  placeAt: (appId: string, target: string, zone: PlaceZone): WorkbenchVerb => ({ kind: "app.placeAt", appId, target, zone }),
  setTitle: (viewId: string, title: string): WorkbenchVerb => ({ kind: "view.setTitle", viewId, title }),
  open: (
    appId: string,
    documents: Record<string, string>,
    options: { near?: string; title?: string; at?: { placementId: string; zone: PlaceZone } } = {},
  ): WorkbenchVerb => ({
    kind: "view.open",
    appId,
    documents,
    ...options,
  }),
  replace: (placementId: string, appId: string, documents?: Record<string, string>): WorkbenchVerb => ({
    kind: "tile.replace",
    placementId,
    appId,
    ...(documents ? { documents } : {}),
  }),
  link: (placementId: string, viewId: string): WorkbenchVerb => ({ kind: "tile.link", placementId, viewId }),
  rebind: (viewId: string, documents: Record<string, string>): WorkbenchVerb => ({ kind: "view.rebind", viewId, documents }),
  selectWorkspace: (workspaceId: string): WorkbenchVerb => ({ kind: "workspace.select", workspaceId }),
  createWorkspace: (
    name: string,
    spec?: LayoutSpec,
    options: { workspaceId?: string; select?: boolean } = {},
  ): WorkbenchVerb => ({ kind: "workspace.create", name, ...(spec ? { spec } : {}), ...options }),
  renameWorkspace: (workspaceId: string, name: string): WorkbenchVerb => ({ kind: "workspace.rename", workspaceId, name }),
  deleteWorkspace: (workspaceId: string): WorkbenchVerb => ({ kind: "workspace.delete", workspaceId }),
  setWorkspaceTree: (workspaceId: string, tree: Node): WorkbenchVerb => ({ kind: "workspace.setTree", workspaceId, tree }),
  cloneWorkspace: (
    workspaceId: string,
    options: { name?: string; newWorkspaceId?: string; select?: boolean } = {},
  ): WorkbenchVerb => ({ kind: "workspace.clone", workspaceId, ...options }),
  goTo: (viewId: string): WorkbenchVerb => ({ kind: "view.goTo", viewId }),
  openLauncher: (placementId?: string): WorkbenchVerb => ({
    kind: "launcher.open",
    ...(placementId ? { placementId } : {}),
  }),
  closeLauncher: (): WorkbenchVerb => ({ kind: "launcher.close" }),
  openRebalance: (): WorkbenchVerb => ({ kind: "rebalance.open" }),
  closeRebalance: (): WorkbenchVerb => ({ kind: "rebalance.close" }),
};

export function isWorkbenchVerb(value: unknown): value is WorkbenchVerb {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const verb = value as Record<string, unknown>;
  const string = (key: string) => typeof verb[key] === "string" && (verb[key] as string).length > 0;
  const optionalString = (key: string) => verb[key] === undefined || typeof verb[key] === "string";
  const stringMap = (key: string) =>
    verb[key] === undefined ||
    (Boolean(verb[key]) &&
      typeof verb[key] === "object" &&
      !Array.isArray(verb[key]) &&
      Object.values(verb[key] as Record<string, unknown>).every((entry) => typeof entry === "string"));

  switch (verb.kind) {
    case "tile.split":
      return string("placementId") && (verb.direction === "row" || verb.direction === "col") && optionalString("appId");
    case "tile.close":
    case "tile.activate":
      return string("placementId");
    case "tile.swap":
      return string("a") && string("b");
    case "tile.dock":
      return string("source") && string("target") && ["top", "right", "bottom", "left"].includes(String(verb.zone));
    case "tile.replaceWith":
      return string("source") && string("target");
    case "split.resize":
      return string("splitId") && typeof verb.ratio === "number" && Number.isFinite(verb.ratio);
    case "app.place":
      return string("appId") && optionalString("from");
    case "app.placeAt":
      return (
        string("appId") &&
        string("target") &&
        ["top", "right", "bottom", "left", "center", "replace"].includes(String(verb.zone))
      );
    case "view.setTitle":
      return string("viewId") && typeof verb.title === "string";
    case "view.open": {
      const at = verb.at as { placementId?: unknown; zone?: unknown } | undefined;
      const atOk =
        at === undefined ||
        (Boolean(at) &&
          typeof at === "object" &&
          !Array.isArray(at) &&
          typeof at.placementId === "string" &&
          at.placementId.length > 0 &&
          ["top", "right", "bottom", "left", "center", "replace"].includes(String(at.zone)));
      return string("appId") && stringMap("documents") && optionalString("near") && optionalString("title") && atOk;
    }
    case "tile.replace":
      return string("placementId") && string("appId") && stringMap("documents");
    case "tile.link":
      return string("placementId") && string("viewId");
    case "view.rebind":
      return string("viewId") && stringMap("documents") && verb.documents !== undefined;
    case "workspace.select":
    case "workspace.delete":
      return string("workspaceId");
    case "workspace.create":
      return string("name") && optionalString("workspaceId") && (verb.select === undefined || typeof verb.select === "boolean");
    case "workspace.rename":
      return string("workspaceId") && string("name");
    case "workspace.setTree":
      return string("workspaceId") && Boolean(verb.tree) && typeof verb.tree === "object" && !Array.isArray(verb.tree);
    case "workspace.clone":
      return (
        string("workspaceId") &&
        optionalString("name") &&
        optionalString("newWorkspaceId") &&
        (verb.select === undefined || typeof verb.select === "boolean")
      );
    case "view.goTo":
      return string("viewId");
    case "launcher.open":
      return optionalString("placementId");
    case "launcher.close":
    case "rebalance.open":
    case "rebalance.close":
      return true;
    default:
      return false;
  }
}

export function describeWorkbenchVerb(verb: WorkbenchVerb): string {
  switch (verb.kind) {
    case "tile.split":
      return verb.direction === "row" ? "split side by side" : "split top and bottom";
    case "tile.close":
      return "close this tile";
    case "tile.swap":
      return "swap the two tiles";
    case "tile.dock":
      return `dock beside the ${verb.zone} edge`;
    case "tile.replaceWith":
      return "replace that tile with this one";
    case "tile.activate":
      return "make this the active tile";
    case "split.resize":
      return `set the divider to ${Math.round(verb.ratio * 100)}%`;
    case "app.place":
      return `open ${verb.appId} beside the active tile`;
    case "app.placeAt":
      return verb.zone === "replace"
        ? `show ${verb.appId} in that tile instead`
        : `open ${verb.appId} ${verb.zone === "center" ? "beside that tile" : `at that tile's ${verb.zone} edge`}`;
    case "view.setTitle":
      return verb.title ? `rename the tile to “${verb.title}”` : "clear the tile's name";
    case "view.open":
      if (!verb.at) return `open ${verb.appId} in a new tile`;
      return verb.at.zone === "replace"
        ? `show ${verb.appId} in that tile instead`
        : verb.at.zone === "center"
          ? `open ${verb.appId} beside that tile`
          : `open ${verb.appId} at that tile's ${verb.at.zone} edge`;
    case "tile.replace":
      return `show ${verb.appId} in this tile instead`;
    case "tile.link":
      return "show that view in this tile too";
    case "view.rebind":
      return "point this tile at a different document";
    case "workspace.select":
      return "go to that workspace";
    case "workspace.create":
      return `create the workspace “${verb.name}”`;
    case "workspace.rename":
      return `rename the workspace to “${verb.name}”`;
    case "workspace.delete":
      return "delete this workspace and its tiles";
    case "workspace.setTree":
      return "replace this workspace's tile arrangement";
    case "workspace.clone":
      return "duplicate this workspace";
    case "view.goTo":
      return "go to that tile";
    case "launcher.open":
      return verb.placementId ? "show something else in this tile" : "open the launcher";
    case "launcher.close":
      return "close the launcher";
    case "rebalance.open":
      return "propose layout repairs for this workspace";
    case "rebalance.close":
      return "close the rebalance dialog";
  }
}

/** The handlers behind every verb; `createWorkbench` exposes them as `verbs`. */
export interface WorkbenchVerbHandlers {
  /**
   * Open a new pane beside a tile. With `appId` the new pane holds that
   * application (a placed singleton gets a linked placement); without it the
   * tile duplicates itself — a singleton links, anything else mints a view
   * with the same bindings. Returns the new placement's id, or null.
   */
  split(placementId: string, direction: SplitDirection, appId?: string): string | null;
  canSplit(placementId: string, direction: SplitDirection): boolean;
  /** A no-op on the last tile: the workbench never renders empty. */
  close(placementId: string): boolean;
  swap(a: string, b: string): boolean;
  dock(source: string, target: string, zone: DockZone): boolean;
  /**
   * The Alt-drag gesture: the target pane shows the SOURCE pane's view, the
   * source pane closes, and the target's old view is deleted when nothing
   * else places it. One tile fewer; the target's rectangle survives.
   */
  replaceWith(source: string, target: string): boolean;
  /** Clamp to this split's rendered pane constraints, then optionally snap. */
  resize(splitId: string, ratio: number, options?: { snap?: boolean }): number | null;
  ratioBounds(splitId: string): SplitRatioBounds | null;
  layoutFits(spec: LayoutSpec): boolean;
  /**
   * The launcher rule: a placed singleton is GONE TO (activated), anything
   * else splits the active tile — or `from` — along its longer RENDERED axis
   * so a new view never destroys a working tile and never lands as a sliver.
   */
  place(appId: string, options?: { from?: string; crossWorkspace?: CrossWorkspace }): string | null;
  /**
   * Placement mode's commit (PBUI-REBALANCE-1): open `appId` exactly where
   * the user aimed. An edge zone docks the new tile at that edge of the
   * target, "center" splits the target along its longer rendered side, and
   * "replace" shows the application in the target INSTEAD (the `replace`
   * handler's semantics). A placed singleton links rather than minting a
   * second view. Returns the placement now showing the application.
   */
  placeAt(appId: string, target: string, zone: PlaceZone): string | null;
  setTitle(viewId: string, title: string): boolean;
  /**
   * Open an application on specific document bindings beside a tile. A
   * doc-bound application already showing identical bindings is gone to
   * rather than opened twice.
   *
   * With `at`, the caller has already decided WHERE — placement mode's
   * commit for a bound document, the "open this file in that pane" gesture:
   * an edge zone docks the new tile at that edge, `"center"` splits the
   * target along its longer rendered side, and `"replace"` shows it in the
   * target instead. `at` beats the de-dup as a POSITION but never as an
   * identity: an existing view of the same document is LINKED into the aimed
   * pane rather than duplicated, so the two tiles stay one thing.
   */
  openView(
    appId: string,
    documents: Record<string, string>,
    options?: { near?: string; title?: string; at?: { placementId: string; zone: PlaceZone } },
  ): string | null;
  /**
   * Change what ONE pane shows, in place. When the pane's view has a single
   * placement the view is retargeted (`viewConfigure`), so the pane keeps its
   * identity; when the view is linked into other tiles a new view is minted
   * and only this placement moves, because retargeting would silently change
   * the twin as well.
   */
  replace(placementId: string, appId: string, documents?: Record<string, string>): boolean;
  /** Point a pane at an EXISTING view — the second placement of one view. */
  link(placementId: string, viewId: string): boolean;
  /** Replace a view's document bindings wholesale. Never a merge: a stale key nothing reads is a bug that reads as data. */
  rebind(viewId: string, documents: Record<string, string>): boolean;
  activate(placementId: string | null): void;
  /**
   * Make the tile showing a view the active one, switching workspace when the
   * view lives in another. Returns the placement, or null when nothing places
   * the view. This is what the launcher's "on screen" rows do.
   */
  goToView(viewId: string): string | null;
  /**
   * Render another workspace. Local state, not a mutation: which workspace
   * THIS browser is looking at is not part of the layout (DATADROP-18 §1.4).
   * Clears the active placement, because a placement of another workspace
   * must never stay the target of a global operation.
   */
  selectWorkspace(workspaceId: string): boolean;
  /**
   * Add a workspace. Without a spec it holds one tile of the first registered
   * application, which is the shortest thing that renders; `select` defaults
   * to true because a workspace nobody is looking at is invisible feedback.
   * Returns the new id, or null when the applier refused the batch.
   */
  createWorkspace(name: string, spec?: LayoutSpec, options?: { workspaceId?: string; select?: boolean }): string | null;
  renameWorkspace(workspaceId: string, name: string): boolean;
  /**
   * Remove a workspace and every view no remaining workspace places. Refused
   * on the last workspace by the applier (`last_workspace`); selecting falls
   * back to the first survivor when the deleted one was on screen.
   */
  deleteWorkspace(workspaceId: string): boolean;
  /**
   * Replace a workspace's placement tree wholesale (PBUI-REBALANCE-1): the
   * door structural layout repairs apply through. Leaves must reference
   * existing views; the caller is responsible for keeping the leaf set equal
   * to the workspace's current placements (rebalance never adds or drops).
   */
  setWorkspaceTree(workspaceId: string, tree: Node): boolean;
  /**
   * Duplicate a workspace's tree. A duplicable application's view is CLONED
   * (the copy is independent); a singleton's or a `duplicable:false`
   * application's view is REFERENCED, so the copy stays in lockstep with the
   * original — the same rule `split` follows for one tile, applied to a tree.
   */
  cloneWorkspace(workspaceId: string, options?: { name?: string; newWorkspaceId?: string; select?: boolean }): string | null;
  /** With a placement, the launcher opens in per-pane mode ("show something else HERE"). */
  openLauncher(placementId?: string): void;
  closeLauncher(): void;
  /** Open/close the rebalance dialog (PBUI-REBALANCE-1) for the active workspace. */
  openRebalance(): void;
  closeRebalance(): void;
}

export function canClose(doc: WorkbenchDocument, placementId: string): boolean {
  const workspaceId = workspaceOfPlacement(doc, placementId);
  if (!workspaceId) return false;
  return leaves(workspaceTree(doc, workspaceId)).length > 1;
}

export function clampRatio(ratio: number): number {
  if (!Number.isFinite(ratio)) return 0.5;
  return Math.max(0.1, Math.min(0.9, ratio));
}

type MutationBody = MessageInitShape<typeof MutationSchema>["body"];

function mutation(body: MutationBody): Mutation {
  return create(MutationSchema, { body });
}

function newPlacementIdOf(mutations: Mutation[]): string | null {
  for (const item of mutations) {
    if (item.body.case === "placementSplit") return item.body.value.newPlacement?.id ?? null;
  }
  return null;
}

function splitWithView(
  doc: WorkbenchDocument,
  placementId: string,
  direction: SplitDirection,
  viewId: string,
  position: "before" | "after" = "after",
): Mutation[] {
  const workspaceId = workspaceOfPlacement(doc, placementId);
  if (!workspaceId) return [];
  return [
    mutation({
      case: "placementSplit",
      value: {
        workspaceId,
        placementId,
        direction: direction === "row" ? Direction.ROW : Direction.COLUMN,
        ratio: 0.5,
        splitId: newId("n"),
        newPlacement: leafNode(viewId),
        place: position === "before" ? PlacementPosition.BEFORE : PlacementPosition.AFTER,
      },
    }),
  ];
}

function sameBindings(a: Record<string, string>, b: Record<string, string>): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  return keysA.length === keysB.length && keysA.every((key) => a[key] === b[key]);
}

/** The first workspace that places the view, anywhere in the document. */
function workspaceOfView(doc: WorkbenchDocument, viewId: string): string | null {
  for (const workspace of doc.workspaces) {
    for (const leaf of leaves(workspace.tree)) {
      if (leaf.body.case === "leaf" && leaf.body.value.viewId === viewId) return workspace.id;
    }
  }
  return null;
}

/** Every view id the document declares that no workspace places. */
function orphanViewIds(doc: WorkbenchDocument): string[] {
  const placed = new Set<string>();
  for (const workspace of doc.workspaces) {
    for (const leaf of leaves(workspace.tree)) {
      if (leaf.body.case === "leaf") placed.add(leaf.body.value.viewId);
    }
  }
  return Object.keys(doc.views).filter((viewId) => !placed.has(viewId));
}

function firstPlacementOfView(doc: WorkbenchDocument, workspaceId: string, viewId: string): string | null {
  for (const leaf of leaves(workspaceTree(doc, workspaceId))) {
    if (leaf.body.case === "leaf" && leaf.body.value.viewId === viewId) return leaf.id;
  }
  return null;
}

/**
 * What a bare split — the ⬌/⬍ chrome buttons, with no application named —
 * puts in the new pane. The package's historical default is `"duplicate"`;
 * three of the four family products open an empty pane showing their launcher
 * application instead, which is a POLICY over the same mutation and so must
 * not be hard-coded.
 */
export type SplitPolicy =
  | "duplicate"
  | "link"
  | { app: string }
  | ((view: AppView, app: AppDescriptor | null) => "duplicate" | "link" | { app: string });

/**
 * How a freshly placed tile finds a document to show. Without it a product
 * whose applications are all views OF something opens unbound tiles, which
 * read as broken. Mirrors `workbench-protocol`'s `ClientConfig`.
 */
export interface BindingConfig {
  /** The binding key a placed tile fills in, e.g. `"source"` or `"primary"`. */
  source: string;
  /** Which document a new tile should bind; default: follow what other views bind, else the first bindable one. */
  defaultDocumentId?(doc: WorkbenchDocument): string | null;
  /** Which payloads may be bound by default. Omitted means any. */
  isBindable?(payload: DocumentPayload): boolean;
  /** Applications that are never auto-bound (a launcher pane, an empty state). */
  unbound?: readonly string[];
}

export interface VerbEnvironment {
  store: WorkbenchStore;
  apps: AppRegistry;
  /** The Surface's root, so geometry lookups stay inside THIS workbench. */
  root(): HTMLElement | null;
  splitPolicy?: SplitPolicy;
  binding?: BindingConfig;
  paneConstraints?: Partial<PaneConstraints>;
  emptyPaneApp?: string;
}

/**
 * The application a pane shows when it holds NOTHING yet.
 *
 * Products whose split policy is `{ app: "launcher" }` fill every new pane
 * with a picker, and "aim a new tile at that empty pane" then means FILL IT,
 * not "split it in half and leave the picker in the other half". The policy
 * already names the application, so the default is read from it; the option
 * is for a product whose empty pane is something else, or whose policy is a
 * function.
 */
function emptyPaneAppOf(splitPolicy: SplitPolicy | undefined, explicit: string | undefined): string | null {
  if (explicit !== undefined) return explicit || null;
  if (splitPolicy && typeof splitPolicy === "object") return splitPolicy.app;
  return null;
}

export function createVerbHandlers({ store, apps, root, splitPolicy, binding, paneConstraints, emptyPaneApp }: VerbEnvironment): WorkbenchVerbHandlers {
  const emptyApp = emptyPaneAppOf(splitPolicy, emptyPaneApp);
  const constraints: PaneConstraints = { ...DEFAULT_PANE_CONSTRAINTS, ...paneConstraints };
  if (
    !Number.isFinite(constraints.minInlinePx) || constraints.minInlinePx <= 0 ||
    !Number.isFinite(constraints.minBlockPx) || constraints.minBlockPx <= 0 ||
    !Number.isFinite(constraints.minFraction) || constraints.minFraction <= 0 || constraints.minFraction > 0.5
  ) {
    throw new Error("pane constraints require positive pixel minima and minFraction in (0, 0.5]");
  }
  const doc = () => store.getState().document;
  const workspace = () => store.getState().workspaceId;

  /** The document a freshly placed view of `appId` should bind, if any. */
  const defaultBindings = (current: WorkbenchDocument, appId: string): Record<string, string> => {
    if (!binding || binding.unbound?.includes(appId)) return {};
    const pick =
      binding.defaultDocumentId ??
      ((document: WorkbenchDocument): string | null => {
        // Follow the crowd first: a tile that opens showing what everything
        // else shows is almost always what the user meant.
        for (const viewId of document.viewOrder) {
          const bound = document.views[viewId]?.documents[binding.source];
          if (bound && document.documents[bound]) return bound;
        }
        const bindable = binding.isBindable ?? (() => true);
        for (const [documentId, payload] of Object.entries(document.documents)) {
          if (bindable(payload)) return documentId;
        }
        return null;
      });
    const documentId = pick(current);
    return documentId ? { [binding.source]: documentId } : {};
  };

  /** What a bare split puts in the new pane. */
  const resolvePolicy = (view: AppView): "duplicate" | "link" | { app: string } => {
    const app = apps.get(view.appId);
    const wanted = !splitPolicy
      ? "duplicate"
      : typeof splitPolicy === "function"
        ? splitPolicy(view, app)
        : splitPolicy;
    // The singleton guard applies to DUPLICATION only. A second view of a
    // singleton is what pkg/workbench rejects as duplicate_singleton — but
    // `{ app }` puts a DIFFERENT application in the new pane, so there is no
    // second view of anything and nothing to reject.
    //
    // Getting this wrong made a product's "every split opens an empty pane"
    // policy silently inoperative for exactly its singletons, which is the
    // half of its applications most likely to be split (agentlogic: 6 of 14).
    // Found by the C1 migration, which is what migrations are for.
    if (wanted === "duplicate" && (app?.singleton || app?.duplicable === false)) return "link";
    return wanted;
  };

  /** The tile a global operation targets: the named one, else the active one, else the first. */
  const targetPlacement = (preferred?: string): string | null => {
    const current = doc();
    const tree = workspaceTree(current, workspace());
    if (preferred && findNode(tree, preferred)?.body.case === "leaf") return preferred;
    const active = store.getState().activePlacementId;
    if (active && findNode(tree, active)?.body.case === "leaf") return active;
    return leaves(tree)[0]?.id ?? null;
  };

  const elementByDataId = (attribute: "placement-id" | "split-id", id: string): HTMLElement | null => {
    const scope = root();
    if (!scope) return null;
    const escaped = typeof CSS !== "undefined" && typeof CSS.escape === "function" ? CSS.escape(id) : id.replace(/"/g, '\\"');
    return scope.querySelector<HTMLElement>(`[data-${attribute}="${escaped}"]`);
  };

  const dividerSize = (element: HTMLElement, row: boolean): number => {
    const rendered = Array.from(element.children).find(
      (child) => (child as HTMLElement).dataset?.part === "split-divider",
    ) as HTMLElement | undefined;
    const measured = rendered?.getBoundingClientRect();
    const measuredSize = measured ? (row ? measured.width : measured.height) : 0;
    if (Number.isFinite(measuredSize) && measuredSize > 0) return measuredSize;
    if (typeof getComputedStyle === "function") {
      const token = Number.parseFloat(getComputedStyle(element).getPropertyValue("--pbui-space-4"));
      if (Number.isFinite(token) && token >= 0) return token;
    }
    return DEFAULT_DIVIDER_PX;
  };

  const distributableSize = (element: HTMLElement, row: boolean): number | null => {
    const box = element.getBoundingClientRect();
    const total = row ? box.width : box.height;
    if (!Number.isFinite(total) || total <= 0) return null;
    return Math.max(0, total - dividerSize(element, row));
  };

  const canSplitPlacement = (placementId: string, direction: SplitDirection): boolean => {
    const element = elementByDataId("placement-id", placementId);
    if (!element) return true;
    const row = direction === "row";
    const size = distributableSize(element, row);
    const minimum = row ? constraints.minInlinePx : constraints.minBlockPx;
    return paneRatioBounds(size, minimum, constraints.minFraction) !== null;
  };

  const ratioBounds = (splitId: string): SplitRatioBounds | null => {
    let splitNode_: Node | undefined;
    for (const candidate of doc().workspaces) {
      const found = findNode(candidate.tree, splitId);
      if (found?.body.case === "split") {
        splitNode_ = found;
        break;
      }
    }
    if (!splitNode_ || splitNode_.body.case !== "split") return null;
    const element = elementByDataId("split-id", splitId);
    const row = splitNode_.body.value.direction !== Direction.COLUMN;
    const size = element ? distributableSize(element, row) : null;
    const minimum = row ? constraints.minInlinePx : constraints.minBlockPx;
    return paneRatioBounds(size, minimum, constraints.minFraction);
  };

  const layoutFits = (
    spec: LayoutSpec,
    width: number | null,
    height: number | null,
    inlineDivider: number,
    blockDivider: number,
  ): boolean => {
    if (spec.kind === "tile") return true;
    const row = spec.direction === "row";
    const total = row ? width : height;
    const size = total === null ? null : Math.max(0, total - (row ? inlineDivider : blockDivider));
    const minimum = row ? constraints.minInlinePx : constraints.minBlockPx;
    const bounds = paneRatioBounds(size, minimum, constraints.minFraction);
    if (!bounds || spec.ratio < bounds.min || spec.ratio > bounds.max) return false;
    const aWidth = row && size !== null ? size * spec.ratio : width;
    const bWidth = row && size !== null ? size * (1 - spec.ratio) : width;
    const aHeight = !row && size !== null ? size * spec.ratio : height;
    const bHeight = !row && size !== null ? size * (1 - spec.ratio) : height;
    return (
      layoutFits(spec.a, aWidth, aHeight, inlineDivider, blockDivider) &&
      layoutFits(spec.b, bWidth, bHeight, inlineDivider, blockDivider)
    );
  };

  const activate = (placementId: string | null) => {
    if (store.getState().activePlacementId === placementId) return;
    store.setState({ activePlacementId: placementId });
  };

  /** A new pane holding a fresh view of `appId`, bound the way a placed tile is. */
  const splitWithNewView = (
    current: WorkbenchDocument,
    placementId: string,
    direction: SplitDirection,
    appId: string,
    position: "before" | "after" = "after",
  ): Mutation[] => {
    const view = create(AppViewSchema, { id: newId("v"), appId, documents: defaultBindings(current, appId) });
    return [
      mutation({ case: "viewCreate", value: { view } }),
      ...splitWithView(current, placementId, direction, view.id, position),
    ];
  };

  const split: WorkbenchVerbHandlers["split"] = (placementId, direction, appId) => {
    const current = doc();
    const workspaceId = workspaceOfPlacement(current, placementId);
    if (!workspaceId) return null;
    const node = findNode(workspaceTree(current, workspaceId), placementId);
    if (!node || node.body.case !== "leaf") return null;
    if (!canSplitPlacement(placementId, direction)) return null;
    const currentView = current.views[node.body.value.viewId];

    let mutations: Mutation[];
    if (appId) {
      const app = apps.get(appId);
      const existing = app?.singleton ? viewsOfApp(current, appId)[0] : undefined;
      // Not the protocol's `splitPlacement`: it mints a view with no
      // documents, so a product with a `binding` config gets a tile that
      // opens empty and reads as broken. Mint it here so the same default
      // bindings `openView` applies also apply to a split and to the
      // launcher's `place`, which routes through here.
      mutations = existing
        ? splitWithView(current, placementId, direction, existing.id)
        : splitWithNewView(current, placementId, direction, appId);
    } else if (!currentView) {
      return null;
    } else {
      const policy = resolvePolicy(currentView);
      if (policy === "link") {
        // A linked placement: the same view, twice on screen.
        mutations = splitWithView(current, placementId, direction, currentView.id);
      } else if (policy === "duplicate") {
        const view = create(AppViewSchema, {
          id: newId("v"),
          appId: currentView.appId,
          documents: { ...currentView.documents },
          ...(currentView.title ? { title: currentView.title } : {}),
        });
        mutations = [mutation({ case: "viewCreate", value: { view } }), ...splitWithView(current, placementId, direction, view.id)];
      } else {
        // `{ app }`: an empty pane showing some application — a launcher, an
        // empty state — which is what three of the four family shells do.
        const existing = apps.get(policy.app)?.singleton ? viewsOfApp(current, policy.app)[0] : undefined;
        mutations = existing
          ? splitWithView(current, placementId, direction, existing.id)
          : splitWithNewView(current, placementId, direction, policy.app);
      }
    }
    const created = newPlacementIdOf(mutations);
    if (!store.mutate(mutations)) return null;
    if (created) activate(created);
    return created;
  };

  const close: WorkbenchVerbHandlers["close"] = (placementId) => {
    const current = doc();
    if (!canClose(current, placementId)) return false;
    const ok = store.mutate(closePlacement(current, placementId));
    if (ok && store.getState().activePlacementId === placementId) activate(null);
    return ok;
  };

  const resize: WorkbenchVerbHandlers["resize"] = (splitId, ratio, options = {}) => {
    const bounds = ratioBounds(splitId);
    if (!bounds) return null;
    const constrained = Math.max(bounds.min, Math.min(bounds.max, ratio));
    const snapped = options.snap === false ? constrained : snapRatio(constrained).ratio;
    // A conventional snap point may sit outside the rendered minimum. Clamp
    // it through the same bounds pointer, keyboard and agent calls share.
    const final = Math.max(bounds.min, Math.min(bounds.max, snapped));
    return store.mutate(resizeSplit(doc(), splitId, final)) ? final : null;
  };

  /** Which application a pane is showing, or null when it shows nothing usable. */
  const appAt = (placementId: string): string | null => {
    const current = doc();
    const workspaceId = workspaceOfPlacement(current, placementId);
    if (!workspaceId) return null;
    const node = findNode(workspaceTree(current, workspaceId), placementId);
    if (node?.body.case !== "leaf") return null;
    return current.views[node.body.value.viewId]?.appId ?? null;
  };

  const goTo = (current: WorkbenchDocument, viewId: string): string | null => {
    const placement = firstPlacementOfView(current, workspace(), viewId);
    if (placement) activate(placement);
    return placement;
  };

  const place: WorkbenchVerbHandlers["place"] = (appId, options = {}) => {
    const current = doc();
    const app = apps.get(appId);
    if (app?.singleton) {
      const existing = viewsOfApp(current, appId)[0];
      if (existing) {
        const placement = goTo(current, existing.id);
        if (placement) return placement;
        // Placed in ANOTHER workspace, or nowhere at all. Going there is the
        // least surprising answer for a singleton the user asked to see, so
        // it is the default; `link` is for products that want a second
        // placement of the same view in this workspace instead.
        const elsewhere = workspaceOfView(current, existing.id);
        if (elsewhere && (options.crossWorkspace ?? "switch") === "switch") {
          selectWorkspace(elsewhere);
          const there = firstPlacementOfView(doc(), elsewhere, existing.id);
          if (there) activate(there);
          return there;
        }
        const target = targetPlacement(options.from);
        if (!target) return null;
        const direction = splitDirectionFor(target, root());
        if (!canSplitPlacement(target, direction)) return null;
        const mutations = splitWithView(current, target, direction, existing.id);
        const created = newPlacementIdOf(mutations);
        if (!store.mutate(mutations)) return null;
        if (created) activate(created);
        return created;
      }
    }
    const target = targetPlacement(options.from);
    if (!target) return null;
    return split(target, splitDirectionFor(target, root()), appId);
  };

  const placeAt: WorkbenchVerbHandlers["placeAt"] = (appId, target, zone) => {
    // Aiming at the CENTRE of a pane that holds nothing yet means "put it
    // here", not "split the empty pane and leave the picker in half of it".
    // Splitting an empty pane to make room is absurd, and it is what every
    // product with a `{ app }` split policy had to special-case by hand.
    const fillsEmptyPane = zone === "center" && emptyApp !== null && appAt(target) === emptyApp && appId !== emptyApp;
    if (zone === "replace" || fillsEmptyPane) {
      // The target keeps its rectangle and identity; only what it shows changes.
      if (!replace(target, appId)) return null;
      activate(target);
      return target;
    }
    const current = doc();
    const direction: SplitDirection =
      zone === "left" || zone === "right" ? "row" : zone === "top" || zone === "bottom" ? "col" : splitDirectionFor(target, root());
    const position: "before" | "after" = zone === "left" || zone === "top" ? "before" : "after";
    if (!canSplitPlacement(target, direction)) return null;
    const app = apps.get(appId);
    const existing = app?.singleton ? viewsOfApp(current, appId)[0] : undefined;
    const mutations = existing
      ? splitWithView(current, target, direction, existing.id, position)
      : splitWithNewView(current, target, direction, appId, position);
    const created = newPlacementIdOf(mutations);
    if (!store.mutate(mutations)) return null;
    if (created) activate(created);
    return created;
  };

  /**
   * `openView`'s aimed half. Kept beside it rather than inside it because the
   * two answer different questions: `near` asks "somewhere sensible", `at`
   * asks "exactly here", and only the second has a zone to honour.
   */
  const openAt = (
    current: WorkbenchDocument,
    appId: string,
    documents: Record<string, string>,
    existing: AppView | undefined,
    at: { placementId: string; zone: PlaceZone },
    title?: string,
  ): string | null => {
    const { placementId, zone } = at;
    if (!workspaceOfPlacement(current, placementId)) return null;
    if (zone === "replace") {
      // Already open somewhere: link that view in rather than mint a second
      // view of one document, which is how two tiles silently drift apart.
      const ok = existing ? link(placementId, existing.id) : replace(placementId, appId, documents);
      if (!ok) return null;
      activate(placementId);
      return placementId;
    }
    const direction: SplitDirection =
      zone === "left" || zone === "right" ? "row" : zone === "top" || zone === "bottom" ? "col" : splitDirectionFor(placementId, root());
    const position: "before" | "after" = zone === "left" || zone === "top" ? "before" : "after";
    if (!canSplitPlacement(placementId, direction)) return null;
    let mutations: Mutation[];
    if (existing) {
      mutations = splitWithView(current, placementId, direction, existing.id, position);
    } else {
      const view = create(AppViewSchema, {
        id: newId("v"),
        appId,
        documents: Object.keys(documents).length > 0 ? { ...documents } : defaultBindings(current, appId),
        ...(title ? { title } : {}),
      });
      mutations = [
        mutation({ case: "viewCreate", value: { view } }),
        ...splitWithView(current, placementId, direction, view.id, position),
      ];
    }
    const created = newPlacementIdOf(mutations);
    if (!store.mutate(mutations)) return null;
    if (created) activate(created);
    return created;
  };

  const openView: WorkbenchVerbHandlers["openView"] = (appId, documents, options = {}) => {
    const current = doc();
    const app = apps.get(appId);
    // What this open would DUPLICATE if the document already has it: a
    // doc-bound application on exactly these bindings, or a singleton's one
    // view. Both mean "the same thing, already open".
    const already = app?.docBound
      ? viewsOfApp(current, appId).find((view) => sameBindings(view.documents, documents))
      : app?.singleton
        ? viewsOfApp(current, appId)[0]
        : undefined;
    if (options.at) return openAt(current, appId, documents, already, options.at, options.title);
    if (app?.docBound) {
      const existing = already;
      if (existing) {
        // `viewsOfApp` searches the whole document, so the match may live in
        // another workspace — where a workspace-local go-to fails and the
        // fall-through mints a SECOND view with identical bindings, breaking
        // the de-dup contract and lying to any caller told `wentToExisting`.
        // `goToView` switches workspace for exactly this case.
        const placement = goToView(existing.id);
        if (placement) return placement;
      }
    }
    const target = targetPlacement(options.near);
    if (!target) return null;
    const direction = splitDirectionFor(target, root());
    if (!canSplitPlacement(target, direction)) return null;
    const view = create(AppViewSchema, {
      id: newId("v"),
      appId,
      documents: Object.keys(documents).length > 0 ? { ...documents } : defaultBindings(current, appId),
      ...(options.title ? { title: options.title } : {}),
    });
    const mutations = [
      mutation({ case: "viewCreate", value: { view } }),
      ...splitWithView(current, target, direction, view.id),
    ];
    const created = newPlacementIdOf(mutations);
    if (!store.mutate(mutations)) return null;
    if (created) activate(created);
    return created;
  };

  const setTitle: WorkbenchVerbHandlers["setTitle"] = (viewId, title) => {
    const trimmed = title.trim();
    // No `replaceDocuments`: the applier only touches bindings when the
    // message is present, so a rename leaves the documents alone.
    return store.mutate([
      mutation({
        case: "viewConfigure",
        value: {
          viewId,
          titleChange: trimmed ? { case: "setTitle", value: trimmed } : { case: "clearTitle", value: create(EmptySchema) },
        },
      }),
    ]);
  };

  const bindings = (viewId: string, values: Record<string, string>): Mutation =>
    mutation({
      case: "viewConfigure",
      value: { viewId, replaceDocuments: create(DocumentBindingsSchema, { values }) },
    });

  const replace: WorkbenchVerbHandlers["replace"] = (placementId, appId, documents) => {
    const current = doc();
    const workspaceId = workspaceOfPlacement(current, placementId);
    if (!workspaceId) return false;
    const node = findNode(workspaceTree(current, workspaceId), placementId);
    if (node?.body.case !== "leaf") return false;
    const currentViewId = node.body.value.viewId;
    const currentView = current.views[currentViewId];
    if (currentView?.appId === appId && documents === undefined) return true;

    const app = apps.get(appId);
    // A placed singleton is LINKED rather than minted twice; the applier here
    // would accept a second view, but pkg/workbench's Validate rejects the
    // batch as duplicate_singleton, so the optimistic document would sit
    // invalid until a conflict repair.
    if (app?.singleton) {
      const existing = viewsOfApp(current, appId)[0];
      if (existing) return existing.id === currentViewId ? true : link(placementId, existing.id);
    }

    // Bindings are CLEARED by default: a `product` binding left on a view now
    // showing a chart is state nothing reads and everything can misread.
    const values = documents ?? defaultBindings(current, appId);

    if (currentView && placementCount(current, currentViewId) === 1) {
      // The pane owns its view: retarget in place so it keeps its identity
      // (its placement id, its position, and any product state keyed by view).
      return store.mutate([
        mutation({
          case: "viewConfigure",
          value: {
            viewId: currentViewId,
            appId,
            replaceDocuments: create(DocumentBindingsSchema, { values }),
          },
        }),
      ]);
    }

    // The view is linked into other tiles: mint one and move only this
    // placement, or the twin silently changes too.
    const view = create(AppViewSchema, { id: newId("v"), appId, documents: values });
    return store.mutate([
      mutation({ case: "viewCreate", value: { view } }),
      mutation({ case: "placementReplace", value: { workspaceId, placementId, viewId: view.id } }),
    ]);
  };

  const link: WorkbenchVerbHandlers["link"] = (placementId, viewId) => {
    const current = doc();
    const workspaceId = workspaceOfPlacement(current, placementId);
    if (!workspaceId || !current.views[viewId]) return false;
    const node = findNode(workspaceTree(current, workspaceId), placementId);
    if (node?.body.case !== "leaf") return false;
    const currentViewId = node.body.value.viewId;
    if (currentViewId === viewId) return true;
    const mutations: Mutation[] = [
      mutation({ case: "placementReplace", value: { workspaceId, placementId, viewId } }),
    ];
    // The view this pane held is now placed nowhere: it would linger in
    // document.views forever. Same batch, after the replace, so viewDelete
    // sees a placement count of zero rather than view_in_use.
    if (placementCount(current, currentViewId) === 1) {
      mutations.push(mutation({ case: "viewDelete", value: { viewId: currentViewId } }));
    }
    return store.mutate(mutations);
  };

  const rebind: WorkbenchVerbHandlers["rebind"] = (viewId, documents) => {
    if (!doc().views[viewId]) return false;
    return store.mutate([bindings(viewId, { ...documents })]);
  };

  const goToView: WorkbenchVerbHandlers["goToView"] = (viewId) => {
    const current = doc();
    const here = firstPlacementOfView(current, workspace(), viewId);
    if (here) {
      activate(here);
      return here;
    }
    const elsewhere = workspaceOfView(current, viewId);
    if (!elsewhere) return null;
    selectWorkspace(elsewhere);
    const there = firstPlacementOfView(doc(), elsewhere, viewId);
    if (there) activate(there);
    return there;
  };

  const selectWorkspace: WorkbenchVerbHandlers["selectWorkspace"] = (workspaceId) => {
    const state = store.getState();
    if (!state.document.workspaces.some((item) => item.id === workspaceId)) return false;
    if (state.workspaceId === workspaceId) return true;
    // activePlacementId belongs to the workspace we are leaving; keeping it
    // would aim every global verb at a tile nobody can see.
    store.setState({ workspaceId, activePlacementId: null });
    return true;
  };

  const createWorkspace: WorkbenchVerbHandlers["createWorkspace"] = (name, spec, options = {}) => {
    const fallbackApp = apps.list()[0];
    const effective = spec ?? (fallbackApp ? ({ kind: "tile", appId: fallbackApp.id } as LayoutSpec) : null);
    if (!effective) return null;
    const rootElement = root();
    const box = rootElement?.getBoundingClientRect();
    const inlineDivider = rootElement ? dividerSize(rootElement, true) : DEFAULT_DIVIDER_PX;
    const blockDivider = rootElement ? dividerSize(rootElement, false) : DEFAULT_DIVIDER_PX;
    if (!layoutFits(effective, box?.width || null, box?.height || null, inlineDivider, blockDivider)) return null;
    const singletonAppIds = new Set(apps.list().filter((app) => app.singleton).map((app) => app.id));
    const existingViewsByAppId = new Map<string, string>();
    for (const view of Object.values(doc().views)) {
      if (singletonAppIds.has(view.appId) && !existingViewsByAppId.has(view.appId)) {
        existingViewsByAppId.set(view.appId, view.id);
      }
    }
    const built = buildLayout(effective, { singletonAppIds, existingViewsByAppId });
    const workspaceId = options.workspaceId ?? newId("ws");
    if (!store.mutate([...built.mutations, workspaceCreateMutation(workspaceId, name, built.tree)])) return null;
    if (options.select !== false) selectWorkspace(workspaceId);
    return workspaceId;
  };

  const renameWorkspace: WorkbenchVerbHandlers["renameWorkspace"] = (workspaceId, name) =>
    store.mutate([mutation({ case: "workspaceRename", value: { workspaceId, name: name.trim() } })]);

  const deleteWorkspace: WorkbenchVerbHandlers["deleteWorkspace"] = (workspaceId) => {
    const current = doc();
    if (!current.workspaces.some((item) => item.id === workspaceId)) return false;
    // Views the workspace held and nothing else places would otherwise
    // accumulate in `document.views` for the life of the session. The deletes
    // ride in the SAME batch, after the workspace is gone, so `viewDelete`
    // sees a placement count of zero rather than `view_in_use`.
    const without = { ...current, workspaces: current.workspaces.filter((item) => item.id !== workspaceId) };
    const mutations: Mutation[] = [mutation({ case: "workspaceDelete", value: { workspaceId } })];
    for (const viewId of orphanViewIds(without)) {
      mutations.push(mutation({ case: "viewDelete", value: { viewId } }));
    }
    if (!store.mutate(mutations)) return false;
    if (store.getState().workspaceId === workspaceId) {
      const survivor = store.getState().document.workspaces[0];
      if (survivor) selectWorkspace(survivor.id);
    }
    return true;
  };

  const setWorkspaceTree: WorkbenchVerbHandlers["setWorkspaceTree"] = (workspaceId, tree) =>
    store.mutate([mutation({ case: "workspaceSetTree", value: { workspaceId, rootPlacement: tree } })]);

  const cloneWorkspace: WorkbenchVerbHandlers["cloneWorkspace"] = (workspaceId, options = {}) => {
    const current = doc();
    const source = current.workspaces.find((item) => item.id === workspaceId);
    if (!source?.tree) return null;
    const mutations: Mutation[] = [];
    // A duplicable application's view is cloned so the copy has its own
    // bindings and title; a singleton's is referenced, because a second view
    // of a singleton is exactly what `pkg/workbench` rejects as
    // `duplicate_singleton`.
    // Null rather than a placeholder for a malformed node: a tree with an
    // empty leaf would pass the applier and fail `parseDocument` on the next
    // reload, which is a much worse failure than refusing the clone here.
    const copy = (node: Node): Node | null => {
      if (node.body.case === "leaf") {
        const viewId = node.body.value.viewId;
        const view = current.views[viewId];
        const app = view ? apps.get(view.appId) : null;
        if (!view || app?.singleton || app?.duplicable === false) return leafNode(viewId);
        const newViewId = newId("v");
        mutations.push(mutation({ case: "viewClone", value: { sourceViewId: viewId, newViewId } }));
        return leafNode(newViewId);
      }
      if (node.body.case !== "split") return null;
      const { direction, ratio, a, b } = node.body.value;
      if (!a || !b) return null;
      const copiedA = copy(a);
      const copiedB = copy(b);
      if (!copiedA || !copiedB) return null;
      return splitNode(direction, copiedA, copiedB, ratio);
    };
    const tree = copy(source.tree);
    if (!tree) return null;
    const newWorkspaceId = options.newWorkspaceId ?? newId("ws");
    mutations.push(workspaceCreateMutation(newWorkspaceId, options.name ?? `${source.name} copy`, tree));
    if (!store.mutate(mutations)) return null;
    if (options.select !== false) selectWorkspace(newWorkspaceId);
    return newWorkspaceId;
  };

  const dock: WorkbenchVerbHandlers["dock"] = (source, target, zone) => {
    const current = doc();
    const direction: SplitDirection = zone === "left" || zone === "right" ? "row" : "col";
    if (!canSplitPlacement(target, direction)) return false;
    const sourceNode = findNode(workspaceTree(current, workspaceOfPlacement(current, source) ?? ""), source);
    const sourceViewId = sourceNode?.body.case === "leaf" ? sourceNode.body.value.viewId : null;
    const ok = store.mutate(dockPlacement(current, source, target, zone));
    // The source placement is gone; follow its view to where it landed so the
    // active id never points at a closed tile.
    if (ok && sourceViewId) activate(firstPlacementOfView(store.getState().document, workspace(), sourceViewId));
    return ok;
  };

  const replaceWith: WorkbenchVerbHandlers["replaceWith"] = (source, target) => {
    const mutations = replacePlacement(doc(), source, target);
    if (mutations.length === 0) return false;
    if (!store.mutate(mutations)) return false;
    // The source placement is gone; its view now lives in the target (or the
    // twins collapsed there), so that is where the active id belongs.
    if (store.getState().activePlacementId === source) activate(target);
    return true;
  };

  return {
    split,
    canSplit: canSplitPlacement,
    close,
    swap: (a, b) => store.mutate(swapPlacements(doc(), a, b)),
    dock,
    replaceWith,
    resize,
    ratioBounds,
    layoutFits: (spec) => {
      const rootElement = root();
      const box = rootElement?.getBoundingClientRect();
      return layoutFits(
        spec,
        box?.width || null,
        box?.height || null,
        rootElement ? dividerSize(rootElement, true) : DEFAULT_DIVIDER_PX,
        rootElement ? dividerSize(rootElement, false) : DEFAULT_DIVIDER_PX,
      );
    },
    place,
    placeAt,
    setTitle,
    openView,
    replace,
    link,
    rebind,
    activate,
    selectWorkspace,
    createWorkspace,
    renameWorkspace,
    deleteWorkspace,
    setWorkspaceTree,
    cloneWorkspace,
    goToView,
    openLauncher: (placementId) => store.setState({ launcherOpen: true, launcherFrom: placementId ?? null }),
    closeLauncher: () => store.setState({ launcherOpen: false, launcherFrom: null }),
    openRebalance: () => store.setState({ rebalanceOpen: true }),
    closeRebalance: () => store.setState({ rebalanceOpen: false }),
  };
}

/**
 * One verb object in, the matching handler out — the router's side of the two
 * doors. Returns whether the verb CHANGED anything.
 *
 * The boolean is not decoration. Every handler already refuses what it cannot
 * do — `close` on the last tile, `selectWorkspace` on an id nothing has,
 * `replace` on a stale placement — and it says so by returning `false` or
 * `null`. Dropping that on the floor here made a product's router report
 * `performed` for a verb that touched nothing, which an agent then reads as
 * "the change landed" and builds its next call on. A caller that routes verbs
 * for a model MUST propagate this; a caller wiring a button may ignore it,
 * because the button is attached to the thing it operates on.
 */
export function performWorkbenchVerb(handlers: WorkbenchVerbHandlers, verb: WorkbenchVerb): boolean {
  switch (verb.kind) {
    case "tile.split":
      return handlers.split(verb.placementId, verb.direction, verb.appId) !== null;
    case "tile.close":
      return handlers.close(verb.placementId);
    case "tile.swap":
      return handlers.swap(verb.a, verb.b);
    case "tile.dock":
      return handlers.dock(verb.source, verb.target, verb.zone);
    case "tile.replaceWith":
      return handlers.replaceWith(verb.source, verb.target);
    case "tile.activate":
      handlers.activate(verb.placementId);
      return true;
    case "tile.replace":
      return handlers.replace(verb.placementId, verb.appId, verb.documents);
    case "tile.link":
      return handlers.link(verb.placementId, verb.viewId);
    case "view.rebind":
      return handlers.rebind(verb.viewId, verb.documents);
    case "split.resize":
      return handlers.resize(verb.splitId, verb.ratio) !== null;
    case "app.place":
      return handlers.place(verb.appId, verb.from ? { from: verb.from } : {}) !== null;
    case "app.placeAt":
      return handlers.placeAt(verb.appId, verb.target, verb.zone) !== null;
    case "view.setTitle":
      return handlers.setTitle(verb.viewId, verb.title);
    case "view.open":
      return (
        handlers.openView(verb.appId, verb.documents, {
          ...(verb.near ? { near: verb.near } : {}),
          ...(verb.title ? { title: verb.title } : {}),
          ...(verb.at ? { at: verb.at } : {}),
        }) !== null
      );
    case "view.goTo":
      return handlers.goToView(verb.viewId) !== null;
    case "workspace.select":
      return handlers.selectWorkspace(verb.workspaceId);
    case "workspace.create":
      return (
        handlers.createWorkspace(verb.name, verb.spec, {
          ...(verb.workspaceId ? { workspaceId: verb.workspaceId } : {}),
          ...(verb.select !== undefined ? { select: verb.select } : {}),
        }) !== null
      );
    case "workspace.rename":
      return handlers.renameWorkspace(verb.workspaceId, verb.name);
    case "workspace.delete":
      return handlers.deleteWorkspace(verb.workspaceId);
    case "workspace.setTree":
      return handlers.setWorkspaceTree(verb.workspaceId, verb.tree);
    case "workspace.clone":
      return (
        handlers.cloneWorkspace(verb.workspaceId, {
          ...(verb.name ? { name: verb.name } : {}),
          ...(verb.newWorkspaceId ? { newWorkspaceId: verb.newWorkspaceId } : {}),
          ...(verb.select !== undefined ? { select: verb.select } : {}),
        }) !== null
      );
    case "launcher.open":
      handlers.openLauncher(verb.placementId);
      return true;
    case "launcher.close":
      handlers.closeLauncher();
      return true;
    case "rebalance.open":
      handlers.openRebalance();
      return true;
    case "rebalance.close":
      handlers.closeRebalance();
      return true;
  }
}

/** Re-exported so products can name a placement's share without reaching into the protocol. */
export { placementCount };
