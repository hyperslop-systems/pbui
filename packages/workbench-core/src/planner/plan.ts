import type { Mutation } from "@hyperslop-systems/workbench-protocol";
import { applyMutations, MutationError } from "@hyperslop-systems/workbench-protocol/client";
import { isWorkbenchLinkCommand, type WorkbenchCommand } from "../commands";
import type { LocalEffect } from "../effects";
import { buildWorkbenchIndex } from "../graph";
import { orphanViewIds } from "../queries";
import type { WorkbenchSession } from "../session";
import { planLinkCommand, planShowValue } from "./links";
import { planClose, planDock, planDuplicate, planReplaceWith, planResize, planSwap } from "./placement";
import { planActivatePlacement, planSelectWorkspace } from "./session";
import { planShow } from "./show";
import { planCloneWorkspace, planCreateWorkspace, planDeleteWorkspace, planRebalance, planRenameWorkspace } from "./workspace";
import { mutation, type Choice, type FragmentOutcome, type PlanWorld } from "./world";

/** A whole transition, as data (guide §9.1 reduced by §16.2). */
export interface PreparedTransition {
  readonly commands: readonly WorkbenchCommand[];
  readonly mutations: readonly Mutation[];
  readonly session: WorkbenchSession;
  readonly effects: readonly LocalEffect[];
  readonly changed: boolean;
  readonly placementId?: string;
  readonly viewId?: string;
  readonly workspaceId?: string;
}

export type PlanResult =
  | { kind: "prepared"; transition: PreparedTransition }
  | { kind: "refused"; code: string; because: string; index: number; command: WorkbenchCommand }
  | { kind: "ambiguous"; because: string; choices: readonly Choice[]; index: number; command: WorkbenchCommand };

function planOne(world: PlanWorld, command: WorkbenchCommand, expand: (commands: readonly WorkbenchCommand[]) => FragmentOutcome): FragmentOutcome {
  if (isWorkbenchLinkCommand(command)) {
    return command.kind === "show" ? planShowValue(world, command, expand) : planLinkCommand(world, command);
  }
  switch (command.kind) {
    case "placement.duplicate":
      return planDuplicate(world, command);
    case "placement.close":
      return planClose(world, command);
    case "placement.swap":
      return planSwap(world, command);
    case "placement.dock":
      return planDock(world, command);
    case "placement.replaceWith":
      return planReplaceWith(world, command);
    case "placement.resize":
      return planResize(world, command);
    case "view.show":
      return planShow(world, command);
    case "view.configure": {
      if (!world.document.views[command.viewId]) return { kind: "refused", code: "unknown_view", because: `view "${command.viewId}" does not exist` };
      const title = command.title?.trim();
      return {
        kind: "prepared",
        mutations: [
          mutation({
            case: "viewConfigure",
            value: {
              viewId: command.viewId,
              ...(command.title !== undefined ? { titleChange: title ? { case: "setTitle", value: title } : { case: "clearTitle", value: {} } } : {}),
              ...(command.documents !== undefined ? { replaceDocuments: { values: { ...command.documents } } } : {}),
            },
          }),
        ],
        viewId: command.viewId,
        changed: true,
      };
    }
    case "workspace.create":
      return planCreateWorkspace(world, command);
    case "workspace.rename":
      return planRenameWorkspace(world, command);
    case "workspace.delete":
      return planDeleteWorkspace(world, command);
    case "workspace.clone":
      return planCloneWorkspace(world, command);
    case "workspace.rebalance":
      return planRebalance(world, command);
    case "session.selectWorkspace":
      return planSelectWorkspace(world, command);
    case "session.activatePlacement":
      return planActivatePlacement(world, command);
  }
}

/**
 * Plan a sequence of commands as ONE transition (guide §9.3, chosen form).
 * Each command sees the draft left by the previous one; nothing observable
 * is touched. After the last command: sweep the views this batch made
 * unreachable (once, centrally — S8), let the links collaborator append its
 * maintenance, and derive the forget-values effects for every deleted view.
 */
export function plan(world: PlanWorld, commands: readonly WorkbenchCommand[]): PlanResult {
  let draft = world;
  const mutations: Mutation[] = [];
  const effects: LocalEffect[] = [];
  let changed = false;
  let last: { placementId?: string; viewId?: string; workspaceId?: string } = {};

  const step = (fragmentMutations: readonly Mutation[], session: Partial<WorkbenchSession> | undefined): { ok: true } | { ok: false; code: string; because: string } => {
    let document = draft.document;
    if (fragmentMutations.length > 0) {
      try {
        document = applyMutations(document, [...fragmentMutations]);
      } catch (error) {
        if (!(error instanceof MutationError)) throw error;
        return { ok: false, code: error.code, because: error.detail };
      }
    }
    const index = document === draft.document ? draft.index : buildWorkbenchIndex(document);
    draft = { ...draft, document, index, session: { ...draft.session, ...session } };
    mutations.push(...fragmentMutations);
    return { ok: true };
  };

  const run = (list: readonly WorkbenchCommand[], base: number): PlanResult | null => {
    for (let i = 0; i < list.length; i += 1) {
      const command = list[i]!;
      const holder: { nested: PlanResult | null } = { nested: null };
      const expand = (inner: readonly WorkbenchCommand[]): FragmentOutcome => {
        holder.nested = run(inner, base + i);
        if (holder.nested) return { kind: "refused", code: "expanded", because: "" };
        return { kind: "prepared", mutations: [], changed: true };
      };
      const outcome = planOne(draft, command, expand);
      if (holder.nested) return holder.nested;
      if (outcome.kind === "refused") return { kind: "refused", code: outcome.code, because: outcome.because, index: base + i, command };
      if (outcome.kind === "ambiguous") return { kind: "ambiguous", because: outcome.because, choices: outcome.choices, index: base + i, command };
      const applied = step(outcome.mutations, outcome.session);
      if (!applied.ok) return { kind: "refused", code: applied.code, because: applied.because, index: base + i, command };
      if (outcome.effects) effects.push(...outcome.effects);
      changed = changed || outcome.changed;
      // The ids of the last command that landed somewhere (an expansion's
      // inner commands already recorded theirs).
      if (outcome.placementId || outcome.viewId || outcome.workspaceId) {
        last = {
          ...(outcome.placementId ? { placementId: outcome.placementId } : {}),
          ...(outcome.viewId ? { viewId: outcome.viewId } : {}),
          ...(outcome.workspaceId ? { workspaceId: outcome.workspaceId } : {}),
        };
      }
    }
    return null;
  };

  const failed = run(commands, 0);
  if (failed) return failed;

  // Finalize (guide §9.3): orphan cleanup once, only for views THIS batch
  // made unreachable — imported orphans stay legal (S8).
  if (mutations.length > 0) {
    const before = new Set(orphanViewIds(world.document, world.index));
    const orphans = orphanViewIds(draft.document, draft.index).filter((viewId) => !before.has(viewId));
    if (orphans.length > 0) {
      const applied = step(orphans.map((viewId) => mutation({ case: "viewDelete", value: { viewId } })), undefined);
      if (!applied.ok) return { kind: "refused", code: applied.code, because: applied.because, index: commands.length - 1, command: commands[commands.length - 1]! };
    }
    if (world.links) {
      const upkeep = world.links.maintenance(world.document, mutations);
      if (upkeep) {
        const applied = step([upkeep], undefined);
        if (!applied.ok) return { kind: "refused", code: applied.code, because: applied.because, index: commands.length - 1, command: commands[commands.length - 1]! };
      }
    }
    for (const item of mutations) {
      if (item.body.case === "viewDelete") effects.push({ kind: "forget-view-values", viewId: item.body.value.viewId });
    }
  }

  return {
    kind: "prepared",
    transition: { commands: [...commands], mutations, session: draft.session, effects, changed, ...last },
  };
}
