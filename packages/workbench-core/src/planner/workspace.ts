import { Direction, type Mutation, type Node } from "@hyperslop-systems/workbench-protocol";
import { leafNode, leaves, splitNode } from "@hyperslop-systems/workbench-protocol/client";
import type { WorkbenchCommand } from "../commands";
import { buildLayout, workspaceCreateMutation, type LayoutSpec } from "../document";
import { layoutFits } from "../geometry";
import { mutation, prepared, refuse, unchanged, type FragmentOutcome, type PlanWorld } from "./world";

type Command<K extends WorkbenchCommand["kind"]> = Extract<WorkbenchCommand, { kind: K }>;

export function planCreateWorkspace(world: PlanWorld, command: Command<"workspace.create">): FragmentOutcome {
  const { document: doc, apps, policy, ids } = world;
  const fallback = apps.list()[0];
  const spec: LayoutSpec | null = command.layout ?? (fallback ? { kind: "tile", appId: fallback.id } : null);
  if (!spec) return refuse("no_application", "this workbench has no application to put in a new workspace");
  if (!layoutFits(spec, world.geometry, policy.split)) return refuse("too_small", "that layout would not leave every tile usable at this size");
  const singletonAppIds = new Set(apps.list().filter((app) => app.viewCardinality === "one").map((app) => app.id));
  const existingViewsByAppId = new Map<string, string>();
  for (const view of Object.values(doc.views)) {
    if (singletonAppIds.has(view.appId) && !existingViewsByAppId.has(view.appId)) existingViewsByAppId.set(view.appId, view.id);
  }
  const built = buildLayout(spec, { singletonAppIds, existingViewsByAppId, ids });
  const workspaceId = command.workspaceId ?? ids("ws");
  if (world.index.workspaceById.has(workspaceId)) return refuse("duplicate_id", `workspace "${workspaceId}" already exists`);
  const select = command.select !== false;
  return prepared({
    mutations: [...built.mutations, workspaceCreateMutation(workspaceId, command.name, built.tree)],
    ...(select ? { session: { workspaceId, activePlacementId: null } } : {}),
    workspaceId,
    changed: true,
  });
}

export function planRenameWorkspace(world: PlanWorld, command: Command<"workspace.rename">): FragmentOutcome {
  if (!world.index.workspaceById.has(command.workspaceId)) return refuse("unknown_workspace", `workspace "${command.workspaceId}" does not exist`);
  return prepared({ mutations: [mutation({ case: "workspaceRename", value: { workspaceId: command.workspaceId, name: command.name.trim() } })], workspaceId: command.workspaceId, changed: true });
}

export function planDeleteWorkspace(world: PlanWorld, command: Command<"workspace.delete">): FragmentOutcome {
  if (!world.index.workspaceById.has(command.workspaceId)) return refuse("unknown_workspace", `workspace "${command.workspaceId}" does not exist`);
  if (world.document.workspaces.length <= 1) return refuse("last_workspace", "the last workspace cannot be deleted");
  // Views the workspace held and nothing else places are swept by the
  // planner's orphan cleanup, in the same batch, after the workspace is gone.
  const survivor = world.document.workspaces.find((workspace) => workspace.id !== command.workspaceId)!;
  return prepared({
    mutations: [mutation({ case: "workspaceDelete", value: { workspaceId: command.workspaceId } })],
    ...(world.session.workspaceId === command.workspaceId ? { session: { workspaceId: survivor.id, activePlacementId: null } } : {}),
    workspaceId: command.workspaceId,
    changed: true,
  });
}

export function planCloneWorkspace(world: PlanWorld, command: Command<"workspace.clone">): FragmentOutcome {
  const { document: doc, apps, ids } = world;
  const source = world.index.workspaceById.get(command.workspaceId);
  if (!source?.tree) return refuse("unknown_workspace", `workspace "${command.workspaceId}" does not exist`);
  const mutations: Mutation[] = [];
  // A clonable application's view is cloned so the copy has its own
  // bindings and title; a `one`/`link` application's view is referenced.
  // Null for a malformed node: refusing the clone beats writing a tree the
  // next parse rejects.
  const copy = (node: Node): Node | null => {
    if (node.body.case === "leaf") {
      const viewId = node.body.value.viewId;
      const view = doc.views[viewId];
      const app = view ? apps.get(view.appId) : null;
      if (!view || app?.viewCardinality === "one" || app?.duplicatePlacement === "link") return leafNode(viewId, ids);
      const newViewId = ids("v");
      mutations.push(mutation({ case: "viewClone", value: { sourceViewId: viewId, newViewId } }));
      return leafNode(newViewId, ids);
    }
    if (node.body.case !== "split") return null;
    const { direction, ratio, a, b } = node.body.value;
    if (!a || !b) return null;
    const copiedA = copy(a);
    const copiedB = copy(b);
    if (!copiedA || !copiedB) return null;
    return splitNode(direction, copiedA, copiedB, ratio, ids);
  };
  const tree = copy(source.tree);
  if (!tree) return refuse("invalid_tree", `workspace "${command.workspaceId}" has a malformed tree`);
  const newWorkspaceId = command.newWorkspaceId ?? ids("ws");
  if (world.index.workspaceById.has(newWorkspaceId)) return refuse("duplicate_id", `workspace "${newWorkspaceId}" already exists`);
  mutations.push(workspaceCreateMutation(newWorkspaceId, command.name ?? `${source.name} copy`, tree));
  const select = command.select !== false;
  return prepared({ mutations, ...(select ? { session: { workspaceId: newWorkspaceId, activePlacementId: null } } : {}), workspaceId: newWorkspaceId, changed: true });
}

/** The rebalance law (guide §11.4, Decision 7): the new tree places exactly the same placement→view map. */
export function planRebalance(world: PlanWorld, command: Command<"workspace.rebalance">): FragmentOutcome {
  const workspace = world.index.workspaceById.get(command.workspaceId);
  if (!workspace) return refuse("unknown_workspace", `workspace "${command.workspaceId}" does not exist`);
  const map = (tree: Node | undefined) => new Map(leaves(tree).map((leaf) => [leaf.id, leaf.body.case === "leaf" ? leaf.body.value.viewId : ""]));
  const before = map(workspace.tree);
  const after = map(command.tree);
  const same = before.size === after.size && [...before].every(([id, viewId]) => after.get(id) === viewId);
  if (!same) return refuse("rebalance_changes_membership", "a rebalance may only rearrange tiles; it cannot add, drop, or retarget them");
  const valid = (node: Node): boolean => (node.body.case === "leaf" ? true : node.body.case === "split" ? Boolean(node.body.value.a && node.body.value.b) && (node.body.value.direction === Direction.ROW || node.body.value.direction === Direction.COLUMN) && valid(node.body.value.a!) && valid(node.body.value.b!) : false);
  if (!valid(command.tree)) return refuse("invalid_tree", "the proposed tree is malformed");
  return prepared({ mutations: [mutation({ case: "workspaceSetTree", value: { workspaceId: command.workspaceId, rootPlacement: command.tree } })], workspaceId: command.workspaceId, changed: true });
}

export { unchanged };
