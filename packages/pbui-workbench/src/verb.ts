import { describeWorkbenchCommand, isWorkbenchCommand } from "@hyperslop-systems/workbench-core";
import { isWorkbenchShellAction, type WorkbenchShellAction } from "./shellState";
import type { WorkbenchVerb } from "./types";

/** Is this anything the shell performs — a semantic command or a shell action? A product's verb router asks this before `workbench.perform`. */
export function isWorkbenchVerb(value: unknown): value is WorkbenchVerb {
  return isWorkbenchShellAction(value) || isWorkbenchCommand(value);
}

function describeShellAction(action: WorkbenchShellAction): string {
  switch (action.kind) {
    case "launcher.open":
      return action.from ? "show something else in this tile" : "open the launcher";
    case "launcher.close":
      return "close the launcher";
    case "rebalance.open":
      return "propose layout repairs for this workspace";
    case "rebalance.close":
      return "close the rebalance dialog";
    case "link.mode.open":
      return "show the wiring";
    case "link.mode.close":
      return "hide the wiring";
    case "show.chooser.open":
      return "choose where to show it";
    case "show.chooser.close":
      return "close the chooser";
    case "relation.palette.open":
      return "choose a relation to derive through";
    case "relation.palette.close":
      return "close the relation palette";
  }
}

/** One line a trace or an approval prompt can show. */
export function describeWorkbenchVerb(verb: WorkbenchVerb): string {
  return isWorkbenchShellAction(verb) ? describeShellAction(verb) : describeWorkbenchCommand(verb);
}
