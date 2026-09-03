import { createContext, useContext, useSyncExternalStore } from "react";
import type { ActivePlacement } from "./placement";
import type { WorkbenchShell } from "./types";

export const WorkbenchContext = createContext<WorkbenchShell | null>(null);

export function useWorkbench(): WorkbenchShell {
  const value = useContext(WorkbenchContext);
  if (!value) throw new Error("pbui-workbench components must be rendered inside a workbench's Surface or Launcher");
  return value;
}

/** What is being placed right now, or null. A separate subscribable: placement mode is this browser's pointer, not the layout. */
export function usePlacement(workbench: WorkbenchShell): ActivePlacement {
  return useSyncExternalStore(workbench.placement.subscribe, workbench.placement.current, workbench.placement.current);
}
