import type { WorkbenchCommand } from "../commands";
import { prepared, refuse, unchanged, type FragmentOutcome, type PlanWorld } from "./world";

type Command<K extends WorkbenchCommand["kind"]> = Extract<WorkbenchCommand, { kind: K }>;

export function planSelectWorkspace(world: PlanWorld, command: Command<"session.selectWorkspace">): FragmentOutcome {
  if (!world.index.workspaceById.has(command.workspaceId)) return refuse("unknown_workspace", `workspace "${command.workspaceId}" does not exist`);
  if (world.session.workspaceId === command.workspaceId) return unchanged({ workspaceId: command.workspaceId });
  // The active placement belongs to the workspace we are leaving; keeping it
  // would aim every global command at a tile nobody can see.
  return prepared({ mutations: [], session: { workspaceId: command.workspaceId, activePlacementId: null }, workspaceId: command.workspaceId, changed: true });
}

export function planActivatePlacement(world: PlanWorld, command: Command<"session.activatePlacement">): FragmentOutcome {
  if (command.placementId !== null) {
    if (!world.index.viewByPlacementId.has(command.placementId)) return refuse("unknown_placement", `placement "${command.placementId}" does not exist`);
    if (world.index.workspaceByNodeId.get(command.placementId) !== world.session.workspaceId) return refuse("not_in_workspace", `placement "${command.placementId}" is not in the current workspace`);
  }
  if (world.session.activePlacementId === command.placementId) return unchanged({ ...(command.placementId ? { placementId: command.placementId } : {}) });
  return prepared({ mutations: [], session: { activePlacementId: command.placementId }, ...(command.placementId ? { placementId: command.placementId } : {}), changed: true });
}
