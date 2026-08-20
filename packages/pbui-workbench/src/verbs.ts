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
  | { kind: "tile.activate"; placementId: string }
  | { kind: "split.resize"; splitId: string; ratio: number }
  | { kind: "app.place"; appId: string; from?: string }
  | { kind: "view.setTitle"; viewId: string; title: string }
  | { kind: "view.open"; appId: string; documents: Record<string, string>; near?: string; title?: string }
  | { kind: "tile.replace"; placementId: string; appId: string; documents?: Record<string, string> }
  | { kind: "tile.link"; placementId: string; viewId: string }
  | { kind: "view.rebind"; viewId: string; documents: Record<string, string> }
  | { kind: "workspace.select"; workspaceId: string }
  | { kind: "workspace.create"; name: string; spec?: LayoutSpec; workspaceId?: string; select?: boolean }
  | { kind: "workspace.rename"; workspaceId: string; name: string }
  | { kind: "workspace.delete"; workspaceId: string }
  | { kind: "workspace.clone"; workspaceId: string; name?: string; newWorkspaceId?: string; select?: boolean }
  | { kind: "view.goTo"; viewId: string }
  | { kind: "launcher.open"; placementId?: string }
  | { kind: "launcher.close" };

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
  activate: (placementId: string): WorkbenchVerb => ({ kind: "tile.activate", placementId }),
  resize: (splitId: string, ratio: number): WorkbenchVerb => ({ kind: "split.resize", splitId, ratio }),
  place: (appId: string, from?: string): WorkbenchVerb => ({ kind: "app.place", appId, ...(from ? { from } : {}) }),
  setTitle: (viewId: string, title: string): WorkbenchVerb => ({ kind: "view.setTitle", viewId, title }),
  open: (appId: string, documents: Record<string, string>, options: { near?: string; title?: string } = {}): WorkbenchVerb => ({
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
};

export function isWorkbenchVerb(value: unknown): value is WorkbenchVerb {
  if (!value || typeof value !== "object") return false;
  const kind = (value as { kind?: unknown }).kind;
  return typeof kind === "string" && /^(tile|split|app|view|workspace|launcher)\./.test(kind);
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
    case "tile.activate":
      return "make this the active tile";
    case "split.resize":
      return `set the divider to ${Math.round(verb.ratio * 100)}%`;
    case "app.place":
      return `open ${verb.appId} beside the active tile`;
    case "view.setTitle":
      return verb.title ? `rename the tile to “${verb.title}”` : "clear the tile's name";
    case "view.open":
      return `open ${verb.appId} in a new tile`;
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
    case "workspace.clone":
      return "duplicate this workspace";
    case "view.goTo":
      return "go to that tile";
    case "launcher.open":
      return verb.placementId ? "show something else in this tile" : "open the launcher";
    case "launcher.close":
      return "close the launcher";
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
  /** A no-op on the last tile: the workbench never renders empty. */
  close(placementId: string): boolean;
  swap(a: string, b: string): boolean;
  dock(source: string, target: string, zone: DockZone): boolean;
  /** Clamp to [0.1, 0.9], then snap (default on) to the family's shared ratios. */
  resize(splitId: string, ratio: number, options?: { snap?: boolean }): number | null;
  /**
   * The launcher rule: a placed singleton is GONE TO (activated), anything
   * else splits the active tile — or `from` — along its longer RENDERED axis
   * so a new view never destroys a working tile and never lands as a sliver.
   */
  place(appId: string, options?: { from?: string; crossWorkspace?: CrossWorkspace }): string | null;
  setTitle(viewId: string, title: string): boolean;
  /**
   * Open an application on specific document bindings beside a tile. A
   * doc-bound application already showing identical bindings is gone to
   * rather than opened twice.
   */
  openView(appId: string, documents: Record<string, string>, options?: { near?: string; title?: string }): string | null;
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
   * Duplicate a workspace's tree. A duplicable application's view is CLONED
   * (the copy is independent); a singleton's or a `duplicable:false`
   * application's view is REFERENCED, so the copy stays in lockstep with the
   * original — the same rule `split` follows for one tile, applied to a tree.
   */
  cloneWorkspace(workspaceId: string, options?: { name?: string; newWorkspaceId?: string; select?: boolean }): string | null;
  /** With a placement, the launcher opens in per-pane mode ("show something else HERE"). */
  openLauncher(placementId?: string): void;
  closeLauncher(): void;
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
        place: PlacementPosition.AFTER,
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
}

export function createVerbHandlers({ store, apps, root, splitPolicy, binding }: VerbEnvironment): WorkbenchVerbHandlers {
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
  ): Mutation[] => {
    const view = create(AppViewSchema, { id: newId("v"), appId, documents: defaultBindings(current, appId) });
    return [
      mutation({ case: "viewCreate", value: { view } }),
      ...splitWithView(current, placementId, direction, view.id),
    ];
  };

  const split: WorkbenchVerbHandlers["split"] = (placementId, direction, appId) => {
    const current = doc();
    const workspaceId = workspaceOfPlacement(current, placementId);
    if (!workspaceId) return null;
    const node = findNode(workspaceTree(current, workspaceId), placementId);
    if (!node || node.body.case !== "leaf") return null;
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
    const clamped = clampRatio(ratio);
    const final = options.snap === false ? clamped : snapRatio(clamped).ratio;
    return store.mutate(resizeSplit(doc(), splitId, final)) ? final : null;
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
        const mutations = splitWithView(current, target, splitDirectionFor(target, root()), existing.id);
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

  const openView: WorkbenchVerbHandlers["openView"] = (appId, documents, options = {}) => {
    const current = doc();
    const app = apps.get(appId);
    if (app?.docBound) {
      const existing = viewsOfApp(current, appId).find((view) => sameBindings(view.documents, documents));
      if (existing) {
        const placement = goTo(current, existing.id);
        if (placement) return placement;
      }
    }
    const target = targetPlacement(options.near);
    if (!target) return null;
    const view = create(AppViewSchema, {
      id: newId("v"),
      appId,
      documents: Object.keys(documents).length > 0 ? { ...documents } : defaultBindings(current, appId),
      ...(options.title ? { title: options.title } : {}),
    });
    const mutations = [
      mutation({ case: "viewCreate", value: { view } }),
      ...splitWithView(current, target, splitDirectionFor(target, root()), view.id),
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
    const built = buildLayout(effective);
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
    const sourceNode = findNode(workspaceTree(current, workspaceOfPlacement(current, source) ?? ""), source);
    const sourceViewId = sourceNode?.body.case === "leaf" ? sourceNode.body.value.viewId : null;
    const ok = store.mutate(dockPlacement(current, source, target, zone));
    // The source placement is gone; follow its view to where it landed so the
    // active id never points at a closed tile.
    if (ok && sourceViewId) activate(firstPlacementOfView(store.getState().document, workspace(), sourceViewId));
    return ok;
  };

  return {
    split,
    close,
    swap: (a, b) => store.mutate(swapPlacements(doc(), a, b)),
    dock,
    resize,
    place,
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
    cloneWorkspace,
    goToView,
    openLauncher: (placementId) => store.setState({ launcherOpen: true, launcherFrom: placementId ?? null }),
    closeLauncher: () => store.setState({ launcherOpen: false, launcherFrom: null }),
  };
}

/** One verb object in, the matching handler out — the router's side of the two doors. */
export function performWorkbenchVerb(handlers: WorkbenchVerbHandlers, verb: WorkbenchVerb): void {
  switch (verb.kind) {
    case "tile.split":
      handlers.split(verb.placementId, verb.direction, verb.appId);
      return;
    case "tile.close":
      handlers.close(verb.placementId);
      return;
    case "tile.swap":
      handlers.swap(verb.a, verb.b);
      return;
    case "tile.dock":
      handlers.dock(verb.source, verb.target, verb.zone);
      return;
    case "tile.activate":
      handlers.activate(verb.placementId);
      return;
    case "split.resize":
      handlers.resize(verb.splitId, verb.ratio);
      return;
    case "app.place":
      handlers.place(verb.appId, verb.from ? { from: verb.from } : {});
      return;
    case "view.setTitle":
      handlers.setTitle(verb.viewId, verb.title);
      return;
    case "view.open":
      handlers.openView(verb.appId, verb.documents, {
        ...(verb.near ? { near: verb.near } : {}),
        ...(verb.title ? { title: verb.title } : {}),
      });
      return;
    case "tile.replace":
      handlers.replace(verb.placementId, verb.appId, verb.documents);
      return;
    case "tile.link":
      handlers.link(verb.placementId, verb.viewId);
      return;
    case "view.rebind":
      handlers.rebind(verb.viewId, verb.documents);
      return;
    case "workspace.select":
      handlers.selectWorkspace(verb.workspaceId);
      return;
    case "workspace.create":
      handlers.createWorkspace(verb.name, verb.spec, {
        ...(verb.workspaceId ? { workspaceId: verb.workspaceId } : {}),
        ...(verb.select !== undefined ? { select: verb.select } : {}),
      });
      return;
    case "workspace.rename":
      handlers.renameWorkspace(verb.workspaceId, verb.name);
      return;
    case "workspace.delete":
      handlers.deleteWorkspace(verb.workspaceId);
      return;
    case "workspace.clone":
      handlers.cloneWorkspace(verb.workspaceId, {
        ...(verb.name ? { name: verb.name } : {}),
        ...(verb.newWorkspaceId ? { newWorkspaceId: verb.newWorkspaceId } : {}),
        ...(verb.select !== undefined ? { select: verb.select } : {}),
      });
      return;
    case "view.goTo":
      handlers.goToView(verb.viewId);
      return;
    case "launcher.open":
      handlers.openLauncher(verb.placementId);
      return;
    case "launcher.close":
      handlers.closeLauncher();
      return;
  }
}

/** Re-exported so products can name a placement's share without reaching into the protocol. */
export { placementCount };
