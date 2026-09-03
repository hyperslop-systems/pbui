import { create } from "@bufbuild/protobuf";
import { AppViewSchema, DocumentBindingsSchema, type Mutation } from "@hyperslop-systems/workbench-protocol";
import { isDocBound, type WorkbenchAppManifest } from "../apps";
import { resolveInitialDocuments } from "../binding";
import type { PlacementRequest, ViewRequest, WorkbenchCommand } from "../commands";
import { canSplitPlacement, longerAxis } from "../geometry";
import type { Axis } from "../policy";
import { firstPlacementOfView, placementCount, sameBindings, workspaceOfView } from "../queries";
import { splitBeside, targetPlacement } from "./placement";
import { mutation, prepared, refuse, unchanged, type FragmentOutcome, type PlanWorld } from "./world";

/*
 * The generalized `view.show` (guide §8.5, §16.4, K2): one pipeline for
 * every "put this application/view somewhere" gesture. Identity and space
 * are resolved by two independent functions and joined by `materialize`;
 * the command-specific branches of the old verbs are gone.
 */

/** The identity axis: which view, and whether it must be minted. */
export type ResolvedView =
  | { readonly kind: "existing"; readonly viewId: string; readonly app: WorkbenchAppManifest | null }
  | {
      readonly kind: "create";
      readonly viewId: string;
      readonly app: WorkbenchAppManifest;
      readonly documents: Readonly<Record<string, string>>;
      readonly title?: string;
      /** Set when the caller named documents at all; a replace of the same app with none named is a no-op. */
      readonly documentsRequested: boolean;
    };

export function resolveView(world: PlanWorld, request: ViewRequest): ResolvedView | { kind: "refused"; code: string; because: string } {
  const { document: doc, index, apps } = world;
  if (request.kind === "existing") {
    const view = doc.views[request.viewId];
    if (!view) return { kind: "refused", code: "unknown_view", because: `view "${request.viewId}" does not exist` };
    return { kind: "existing", viewId: request.viewId, app: apps.get(view.appId) };
  }
  const app = apps.get(request.appId);
  if (!app) return { kind: "refused", code: "unknown_application", because: `application "${request.appId}" is not registered` };
  const reuse = request.reuse ?? "manifest-default";
  const requested = request.documents ?? {};
  if (reuse !== "never") {
    const existing = index.viewsByAppId.get(app.id) ?? [];
    if (app.viewCardinality === "one" && existing[0]) return { kind: "existing", viewId: existing[0], app };
    const byBindings = reuse === "same-bindings" || (reuse === "manifest-default" && isDocBound(app) && Object.keys(requested).length > 0);
    if (byBindings) {
      const twin = existing.find((viewId) => sameBindings(doc.views[viewId]?.documents ?? {}, requested));
      if (twin) return { kind: "existing", viewId: twin, app };
    }
  }
  const bound = resolveInitialDocuments(world.policy.initialDocuments, app, requested, doc, index);
  if (bound.kind === "refused") return { kind: "refused", code: bound.code, because: bound.because };
  return {
    kind: "create",
    viewId: request.requestedViewId ?? world.ids("v"),
    app,
    documents: bound.documents,
    ...(request.title ? { title: request.title } : {}),
    documentsRequested: request.documents !== undefined,
  };
}

/** The spatial axis: where the view goes, as a plan the materializer can carry out. */
export type ResolvedPlacement =
  | { readonly kind: "navigate"; readonly workspaceId: string; readonly placementId: string }
  | { readonly kind: "split"; readonly target: string; readonly axis: Axis; readonly position: "before" | "after" }
  | { readonly kind: "replace"; readonly target: string };

export function resolvePlacement(world: PlanWorld, request: PlacementRequest, view: ResolvedView): ResolvedPlacement | { kind: "refused"; code: string; because: string } {
  const { index, session, policy } = world;
  const refused = (code: string, because: string) => ({ kind: "refused" as const, code, because });

  const navigateTo = (): ResolvedPlacement | null => {
    if (view.kind !== "existing") return null;
    const here = firstPlacementOfView(index, view.viewId, session.workspaceId);
    if (here) return { kind: "navigate", workspaceId: session.workspaceId, placementId: here };
    const elsewhere = workspaceOfView(index, view.viewId);
    if (!elsewhere) return null;
    return { kind: "navigate", workspaceId: elsewhere, placementId: firstPlacementOfView(index, view.viewId, elsewhere)! };
  };

  const split = (targetId: string | undefined, edge: "left" | "right" | "top" | "bottom" | undefined, axis: Axis | undefined, fillEmpty: boolean): ResolvedPlacement | { kind: "refused"; code: string; because: string } => {
    const target = targetPlacement(world, targetId);
    if (!target) return refused("no_placement", "this workspace has no tile to open beside");
    if (targetId && target !== targetId) return refused("unknown_placement", `placement "${targetId}" is not a tile of the current workspace`);
    // Aiming at the CENTRE of a pane that holds nothing yet means "put it
    // here", not "split the empty pane and leave the picker in half of it".
    const empty = policy.emptyPlacement;
    const targetApp = world.document.views[index.viewByPlacementId.get(target) ?? ""]?.appId;
    const shownApp = view.kind === "create" ? view.app.id : (view.app?.id ?? null);
    if (fillEmpty && empty && targetApp === empty.appId && shownApp !== empty.appId) return { kind: "replace", target };
    const resolvedAxis: Axis = edge ? (edge === "left" || edge === "right" ? "row" : "col") : (axis ?? longerAxis(world.geometry, target, policy.split.headlessAxis));
    if (!canSplitPlacement(world.geometry, target, resolvedAxis, policy.split)) return refused("too_small", `tile "${target}" is too small to split ${resolvedAxis === "row" ? "side by side" : "top and bottom"}`);
    return { kind: "split", target, axis: resolvedAxis, position: edge === "left" || edge === "top" ? "before" : "after" };
  };

  switch (request.kind) {
    case "navigate": {
      const there = navigateTo();
      if (there) return there;
      return view.kind === "existing" ? refused("view_unplaced", `view "${view.viewId}" is not shown anywhere`) : refused("view_unplaced", "a view that does not exist yet cannot be gone to");
    }
    case "auto": {
      const there = navigateTo();
      if (there) return there;
      return split(request.near, undefined, undefined, false);
    }
    case "split":
      return split(request.target, request.edge, request.axis, request.edge === undefined && request.axis === undefined);
    case "replace": {
      if (!index.viewByPlacementId.has(request.target)) return refused("unknown_placement", `placement "${request.target}" does not exist`);
      return { kind: "replace", target: request.target };
    }
  }
}

export function materialize(world: PlanWorld, view: ResolvedView, placement: ResolvedPlacement): FragmentOutcome {
  const { document: doc, index, ids } = world;
  const mutations: Mutation[] = [];

  if (placement.kind === "navigate") {
    const changed = world.session.workspaceId !== placement.workspaceId || world.session.activePlacementId !== placement.placementId;
    return prepared({ mutations, session: { workspaceId: placement.workspaceId, activePlacementId: placement.placementId }, placementId: placement.placementId, viewId: view.viewId, workspaceId: placement.workspaceId, changed });
  }

  if (placement.kind === "replace") {
    const currentViewId = index.viewByPlacementId.get(placement.target)!;
    const workspaceId = index.workspaceByNodeId.get(placement.target)!;
    const currentView = doc.views[currentViewId];
    if (view.kind === "existing") {
      if (currentViewId === view.viewId) return unchanged({ placementId: placement.target, viewId: view.viewId });
      return prepared({ mutations: [mutation({ case: "placementReplace", value: { workspaceId, placementId: placement.target, viewId: view.viewId } })], session: { activePlacementId: placement.target }, placementId: placement.target, viewId: view.viewId, changed: true });
    }
    if (currentView?.appId === view.app.id && !view.documentsRequested) return unchanged({ placementId: placement.target, viewId: currentViewId });
    if (currentView && placementCount(index, currentViewId) === 1) {
      // The pane owns its view: retarget in place so it keeps its identity
      // (its placement id, its position, and any product state keyed by view).
      return prepared({
        mutations: [
          mutation({
            case: "viewConfigure",
            value: {
              viewId: currentViewId,
              appId: view.app.id,
              replaceDocuments: create(DocumentBindingsSchema, { values: { ...view.documents } }),
              ...(view.title ? { titleChange: { case: "setTitle", value: view.title } } : {}),
            },
          }),
        ],
        session: { activePlacementId: placement.target },
        placementId: placement.target,
        viewId: currentViewId,
        changed: true,
      });
    }
    // The view is linked into other tiles: mint one and move only this
    // placement, or the twin silently changes too.
    const minted = create(AppViewSchema, { id: view.viewId, appId: view.app.id, documents: { ...view.documents }, ...(view.title ? { title: view.title } : {}) });
    return prepared({
      mutations: [mutation({ case: "viewCreate", value: { view: minted } }), mutation({ case: "placementReplace", value: { workspaceId, placementId: placement.target, viewId: minted.id } })],
      session: { activePlacementId: placement.target },
      placementId: placement.target,
      viewId: minted.id,
      changed: true,
    });
  }

  // split
  if (view.kind === "create") {
    const minted = create(AppViewSchema, { id: view.viewId, appId: view.app.id, documents: { ...view.documents }, ...(view.title ? { title: view.title } : {}) });
    mutations.push(mutation({ case: "viewCreate", value: { view: minted } }));
  }
  const split = splitBeside(doc, index, placement.target, placement.axis, view.viewId, placement.position, ids);
  if (!split) return refuse("unknown_placement", `placement "${placement.target}" does not exist`);
  mutations.push(split.mutation);
  return prepared({ mutations, session: { activePlacementId: split.placementId }, placementId: split.placementId, viewId: view.viewId, changed: true });
}

export function planShow(world: PlanWorld, command: Extract<WorkbenchCommand, { kind: "view.show" }>): FragmentOutcome {
  const view = resolveView(world, command.view);
  if (view.kind === "refused") return refuse(view.code, view.because);
  const placement = resolvePlacement(world, command.placement, view);
  if (placement.kind === "refused") return refuse(placement.code, placement.because);
  return materialize(world, view, placement);
}
