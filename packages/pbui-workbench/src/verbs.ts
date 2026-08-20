import { create, type MessageInitShape } from "@bufbuild/protobuf";
import { EmptySchema } from "@bufbuild/protobuf/wkt";
import {
  AppViewSchema,
  Direction,
  type Mutation,
  MutationSchema,
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
  splitPlacement,
  swapPlacements,
  viewsOfApp,
  workspaceOfPlacement,
  workspaceTree,
  type DockZone,
} from "@hyperslop-systems/workbench-protocol/client";
import { splitDirectionFor } from "@hyperslop-systems/pbui";
import type { AppRegistry } from "./apps";
import type { WorkbenchStore } from "./store";

export type SplitDirection = "row" | "col";

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
  | { kind: "launcher.open" }
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
  openLauncher: (): WorkbenchVerb => ({ kind: "launcher.open" }),
  closeLauncher: (): WorkbenchVerb => ({ kind: "launcher.close" }),
};

export function isWorkbenchVerb(value: unknown): value is WorkbenchVerb {
  if (!value || typeof value !== "object") return false;
  const kind = (value as { kind?: unknown }).kind;
  return typeof kind === "string" && /^(tile|split|app|view|launcher)\./.test(kind);
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
    case "launcher.open":
      return "open the launcher";
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
  place(appId: string, options?: { from?: string }): string | null;
  setTitle(viewId: string, title: string): boolean;
  /**
   * Open an application on specific document bindings beside a tile. A
   * doc-bound application already showing identical bindings is gone to
   * rather than opened twice.
   */
  openView(appId: string, documents: Record<string, string>, options?: { near?: string; title?: string }): string | null;
  activate(placementId: string | null): void;
  openLauncher(): void;
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

function firstPlacementOfView(doc: WorkbenchDocument, workspaceId: string, viewId: string): string | null {
  for (const leaf of leaves(workspaceTree(doc, workspaceId))) {
    if (leaf.body.case === "leaf" && leaf.body.value.viewId === viewId) return leaf.id;
  }
  return null;
}

export interface VerbEnvironment {
  store: WorkbenchStore;
  apps: AppRegistry;
  /** The Surface's root, so geometry lookups stay inside THIS workbench. */
  root(): HTMLElement | null;
}

export function createVerbHandlers({ store, apps, root }: VerbEnvironment): WorkbenchVerbHandlers {
  const doc = () => store.getState().document;
  const workspace = () => store.getState().workspaceId;

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
      mutations = existing ? splitWithView(current, placementId, direction, existing.id) : splitPlacement(current, placementId, direction, appId);
    } else if (!currentView) {
      return null;
    } else {
      const app = apps.get(currentView.appId);
      if (app?.singleton || app?.duplicable === false) {
        // A linked placement: the same view, twice on screen.
        mutations = splitWithView(current, placementId, direction, currentView.id);
      } else {
        const view = create(AppViewSchema, {
          id: newId("v"),
          appId: currentView.appId,
          documents: { ...currentView.documents },
          ...(currentView.title ? { title: currentView.title } : {}),
        });
        mutations = [mutation({ case: "viewCreate", value: { view } }), ...splitWithView(current, placementId, direction, view.id)];
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
        // Placed in another workspace, or nowhere: link it here.
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
      documents: { ...documents },
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
    activate,
    openLauncher: () => store.setState({ launcherOpen: true }),
    closeLauncher: () => store.setState({ launcherOpen: false }),
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
    case "launcher.open":
      handlers.openLauncher();
      return;
    case "launcher.close":
      handlers.closeLauncher();
      return;
  }
}

/** Re-exported so products can name a placement's share without reaching into the protocol. */
export { placementCount };
