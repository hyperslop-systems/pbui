import { createContext, useContext, useSyncExternalStore } from "react";
import type { ActivePlacement } from "./placement";
import type { Workbench } from "./types";

export const WorkbenchContext = createContext<Workbench | null>(null);

export function useWorkbench(): Workbench {
  const value = useContext(WorkbenchContext);
  if (!value) throw new Error("pbui-workbench components must be rendered inside a workbench's Surface or Launcher");
  return value;
}

/**
 * What is being placed right now, or null. A separate subscribable from the
 * workbench store on purpose: placement mode is this browser's pointer, not
 * the layout, and a Redux product's adapter must not have to carry it.
 */
export function usePlacement(workbench: Workbench): ActivePlacement {
  return useSyncExternalStore(
    workbench.placement.subscribe,
    workbench.placement.current,
    workbench.placement.current,
  );
}
