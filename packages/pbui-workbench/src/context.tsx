import { createContext, useContext } from "react";
import type { Workbench } from "./types";

export const WorkbenchContext = createContext<Workbench | null>(null);

export function useWorkbench(): Workbench {
  const value = useContext(WorkbenchContext);
  if (!value) throw new Error("pbui-workbench components must be rendered inside a workbench's Surface or Launcher");
  return value;
}
