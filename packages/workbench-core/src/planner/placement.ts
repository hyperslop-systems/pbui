import { create } from "@bufbuild/protobuf";
import { AppViewSchema, Direction, PlacementPosition, type Mutation, type WorkbenchDocument } from "@hyperslop-systems/workbench-protocol";
import { leafNode, snapRatio, type IdGenerator } from "@hyperslop-systems/workbench-protocol/client";
import type { WorkbenchCommand } from "../commands";
import { canSplitPlacement, longerAxis, splitRatioBounds } from "../geometry";
import type { WorkbenchIndex } from "../graph";
import type { Axis } from "../policy";
import { canClose, firstPlacementOfView, leavesOfWorkspace } from "../queries";
import { mutation, prepared, refuse, unchanged, type FragmentOutcome, type PlanWorld } from "./world";
import { planShow } from "./show";

export type Command<K extends WorkbenchCommand["kind"]> = Extract<WorkbenchCommand, { kind: K }>;

/** A `placementSplit` beside `placementId` holding `viewId`; ids minted split-first, leaf-second (the goldens' order). */
export function splitBeside(doc: WorkbenchDocument, index: WorkbenchIndex, placementId: string, axis: Axis, viewId: string, position: "before" | "after", ids: IdGenerator): { mutation: Mutation; placementId: string } | null {
  const workspaceId = index.workspaceByNodeId.get(placementId);
  if (!workspaceId || !index.viewByPlacementId.has(placementId)) return null;
  void doc;
  const splitId = ids("n");
  const leaf = leafNode(viewId, ids);
  return {
    placementId: leaf.id,
    mutation: mutation({
      case: "placementSplit",
      value: {
        workspaceId,
        placementId,
        direction: axis === "row" ? Direction.ROW : Direction.COLUMN,
        ratio: 0.5,
        splitId,
        newPlacement: leaf,
        place: position === "before" ? PlacementPosition.BEFORE : PlacementPosition.AFTER,
      },
    }),
  };
}

/** The tile a global operation targets: the named one, else the active one, else the first of the current workspace. */
export function targetPlacement(world: PlanWorld, preferred?: string): string | null {
  const { index, session } = world;
  const inWorkspace = (id: string | null | undefined) => Boolean(id) && index.viewByPlacementId.has(id!) && index.workspaceByNodeId.get(id!) === session.workspaceId;
  if (preferred && inWorkspace(preferred)) return preferred;
  if (inWorkspace(session.activePlacementId)) return session.activePlacementId;
  return leavesOfWorkspace(index, session.workspaceId)[0]?.id ?? null;
}

export function planDuplicate(world: PlanWorld, command: Command<"placement.duplicate">): FragmentOutcome {
  const { document: doc, index, apps, policy, ids } = world;
  const viewId = index.viewByPlacementId.get(command.placementId);
  if (!viewId) return refuse("unknown_placement", `placement "${command.placementId}" does not exist`);
  const view = doc.views[viewId];
  if (!view) return refuse("unknown_view", `view "${viewId}" does not exist`);
  const axis = command.axis ?? longerAxis(world.geometry, command.placementId, policy.split.headlessAxis);
  if (!canSplitPlacement(world.geometry, command.placementId, axis, policy.split)) return refuse("too_small", `tile "${command.placementId}" is too small to split ${axis === "row" ? "side by side" : "top and bottom"}`);
  const app = apps.get(view.appId);
  const wanted = typeof policy.duplicate === "function" ? policy.duplicate(view, app) : policy.duplicate;
  // The singleton guard applies to CLONING only: `{ app }` puts a DIFFERENT
  // application in the new pane, so there is no second view of anything.
  const resolved = wanted === "clone" && (app?.viewCardinality === "one" || app?.duplicatePlacement === "link") ? "link" : wanted;
  if (typeof resolved === "object") {
    return planShow(world, { kind: "view.show", view: { kind: "application", appId: resolved.app }, placement: { kind: "split", target: command.placementId, axis } });
  }
  const mutations: Mutation[] = [];
  let placedViewId = viewId;
  if (resolved === "clone") {
    const clone = create(AppViewSchema, { id: ids("v"), appId: view.appId, documents: { ...view.documents }, ...(view.title ? { title: view.title } : {}) });
    mutations.push(mutation({ case: "viewCreate", value: { view: clone } }));
    placedViewId = clone.id;
  }
  const split = splitBeside(doc, index, command.placementId, axis, placedViewId, "after", ids);
  if (!split) return refuse("unknown_placement", `placement "${command.placementId}" does not exist`);
  mutations.push(split.mutation);
  return prepared({ mutations, session: { activePlacementId: split.placementId }, placementId: split.placementId, viewId: placedViewId, changed: true });
}

export function planClose(world: PlanWorld, command: Command<"placement.close">): FragmentOutcome {
  const { index, session } = world;
  const workspaceId = index.workspaceByNodeId.get(command.placementId);
  if (!workspaceId || !index.viewByPlacementId.has(command.placementId)) return refuse("unknown_placement", `placement "${command.placementId}" does not exist`);
  if (!canClose(index, command.placementId)) return refuse("last_placement", "a workspace keeps at least one tile");
  return prepared({
    mutations: [mutation({ case: "placementClose", value: { workspaceId, placementId: command.placementId } })],
    ...(session.activePlacementId === command.placementId ? { session: { activePlacementId: null } } : {}),
    changed: true,
  });
}

export function planSwap(world: PlanWorld, command: Command<"placement.swap">): FragmentOutcome {
  const { index } = world;
  if (command.a === command.b) return refuse("same_placement", "a tile cannot swap with itself");
  const aView = index.viewByPlacementId.get(command.a);
  const bView = index.viewByPlacementId.get(command.b);
  const aWorkspace = index.workspaceByNodeId.get(command.a);
  const bWorkspace = index.workspaceByNodeId.get(command.b);
  if (!aView || !aWorkspace) return refuse("unknown_placement", `placement "${command.a}" does not exist`);
  if (!bView || !bWorkspace) return refuse("unknown_placement", `placement "${command.b}" does not exist`);
  return prepared({
    mutations: [
      mutation({ case: "placementReplace", value: { workspaceId: aWorkspace, placementId: command.a, viewId: bView } }),
      mutation({ case: "placementReplace", value: { workspaceId: bWorkspace, placementId: command.b, viewId: aView } }),
    ],
    changed: true,
  });
}

export function planDock(world: PlanWorld, command: Command<"placement.dock">): FragmentOutcome {
  const { document: doc, index, policy, ids } = world;
  if (command.source === command.target) return refuse("same_placement", "a tile cannot dock onto itself");
  const sourceView = index.viewByPlacementId.get(command.source);
  const sourceWorkspace = index.workspaceByNodeId.get(command.source);
  if (!sourceView || !sourceWorkspace) return refuse("unknown_placement", `placement "${command.source}" does not exist`);
  if (!index.viewByPlacementId.has(command.target)) return refuse("unknown_placement", `placement "${command.target}" does not exist`);
  const axis: Axis = command.edge === "left" || command.edge === "right" ? "row" : "col";
  if (!canSplitPlacement(world.geometry, command.target, axis, policy.split)) return refuse("too_small", `tile "${command.target}" is too small to dock another tile`);
  const split = splitBeside(doc, index, command.target, axis, sourceView, command.edge === "left" || command.edge === "top" ? "before" : "after", ids);
  if (!split) return refuse("unknown_placement", `placement "${command.target}" does not exist`);
  // The source view has its new placement BEFORE the old one closes, so it
  // can never look abandoned to the orphan sweep.
  return prepared({
    mutations: [split.mutation, mutation({ case: "placementClose", value: { workspaceId: sourceWorkspace, placementId: command.source } })],
    session: { activePlacementId: split.placementId },
    placementId: split.placementId,
    viewId: sourceView,
    changed: true,
  });
}

export function planReplaceWith(world: PlanWorld, command: Command<"placement.replaceWith">): FragmentOutcome {
  const { index, session } = world;
  if (command.source === command.target) return refuse("same_placement", "a tile cannot replace itself");
  const sourceView = index.viewByPlacementId.get(command.source);
  const targetView = index.viewByPlacementId.get(command.target);
  const sourceWorkspace = index.workspaceByNodeId.get(command.source);
  const targetWorkspace = index.workspaceByNodeId.get(command.target);
  if (!sourceView || !sourceWorkspace) return refuse("unknown_placement", `placement "${command.source}" does not exist`);
  if (!targetView || !targetWorkspace) return refuse("unknown_placement", `placement "${command.target}" does not exist`);
  const activate = session.activePlacementId === command.source ? { session: { activePlacementId: command.target } } : {};
  if (sourceView === targetView) {
    // Linked twins collapse to the target placement alone.
    if (!canClose(index, command.source)) return refuse("last_placement", "a workspace keeps at least one tile");
    return prepared({ mutations: [mutation({ case: "placementClose", value: { workspaceId: sourceWorkspace, placementId: command.source } })], ...activate, placementId: command.target, viewId: sourceView, changed: true });
  }
  return prepared({
    mutations: [
      mutation({ case: "placementReplace", value: { workspaceId: targetWorkspace, placementId: command.target, viewId: sourceView } }),
      mutation({ case: "placementClose", value: { workspaceId: sourceWorkspace, placementId: command.source } }),
    ],
    ...activate,
    placementId: command.target,
    viewId: sourceView,
    changed: true,
  });
}

export function planResize(world: PlanWorld, command: Command<"placement.resize">): FragmentOutcome {
  const { index, policy } = world;
  const node = index.nodeById.get(command.splitId);
  const workspaceId = index.workspaceByNodeId.get(command.splitId);
  if (!node || node.body.case !== "split" || !workspaceId) return refuse("unknown_split", `split "${command.splitId}" does not exist`);
  const axis: Axis = node.body.value.direction === Direction.COLUMN ? "col" : "row";
  const bounds = splitRatioBounds(world.geometry, command.splitId, axis, policy.split);
  if (!bounds) return refuse("too_small", `split "${command.splitId}" is too small to keep both panes usable`);
  const constrained = Math.max(bounds.min, Math.min(bounds.max, Number.isFinite(command.ratio) ? command.ratio : 0.5));
  const snapped = command.snap === false ? constrained : snapRatio(constrained).ratio;
  // A conventional snap point may sit outside the rendered minimum; clamp
  // through the same bounds pointer, keyboard, and agent calls share.
  const final = Math.max(bounds.min, Math.min(bounds.max, snapped));
  return prepared({ mutations: [mutation({ case: "splitResize", value: { workspaceId, splitId: command.splitId, ratio: final } })], changed: true });
}

/** Where a view is on screen in the current workspace, for a navigate. */
export function placementHere(world: PlanWorld, viewId: string): string | null {
  return firstPlacementOfView(world.index, viewId, world.session.workspaceId);
}

export { unchanged };
