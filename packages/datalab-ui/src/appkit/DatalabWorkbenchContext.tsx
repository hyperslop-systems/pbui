import { createContext, useContext, useMemo, type ReactNode } from "react";
import { Provider } from "react-redux";
import { useSelector } from "react-redux";
import type { Workspace } from "@hyperslop-systems/workbench-protocol";
import type { RootState } from "../store";
import {
  currentStageId,
  metaOf,
  type StageDefinition,
  type WorkspaceMeta,
} from "../store/navigation";
import { WORK_STAGE_ID } from "../store/stageIds";
import type { DatalabWorkbench } from "./workbench";

/**
 * The workbench of the subtree: the Redux Provider for the world and the
 * navigation slices, and the context that hands components the core, the
 * shell and the controller (design §9.3).
 *
 * One provider per `WorkbenchInstance`, which is what makes six embedded
 * workbenches on one page share a module graph and nothing else.
 */
const DatalabWorkbenchContext = createContext<DatalabWorkbench | null>(null);

export function DatalabWorkbenchProvider({
  workbench,
  children,
}: {
  workbench: DatalabWorkbench;
  children: ReactNode;
}) {
  return (
    <Provider store={workbench.store}>
      <DatalabWorkbenchContext.Provider value={workbench}>
        {children}
      </DatalabWorkbenchContext.Provider>
    </Provider>
  );
}

export function useDatalabWorkbench(): DatalabWorkbench {
  const value = useContext(DatalabWorkbenchContext);
  if (!value)
    throw new Error("datalab: this component must be rendered inside a DatalabWorkbenchProvider");
  return value;
}

/** The workspace on screen, from the core's session. */
export function useCurrentWorkspaceId(): string {
  const workbench = useDatalabWorkbench();
  return workbench.shell.useCoreState((state) => state.session.workspaceId);
}

/** The current stage: derived from the selected workspace, never stored (design §5.2). */
export function useCurrentStageId(): string {
  const workspaceId = useCurrentWorkspaceId();
  return useSelector((state: RootState) => currentStageId(state.navigation, workspaceId));
}

export function useCurrentStage(): StageDefinition | undefined {
  const stageId = useCurrentStageId();
  return useSelector((state: RootState) =>
    state.navigation.stages.find((stage) => stage.id === stageId),
  );
}

export function useWorkspaceMeta(workspaceId: string): WorkspaceMeta {
  return useSelector((state: RootState) => metaOf(state.navigation, workspaceId));
}

/** The document's workspaces belonging to one stage, in document order. */
export function useWorkspacesOfStage(stageId: string): Workspace[] {
  const workbench = useDatalabWorkbench();
  const document = workbench.shell.useDocument();
  const meta = useSelector((state: RootState) => state.navigation.workspace);
  // Memoised on the document and the metadata map: a selector returning a
  // fresh array on every call re-renders on every store change.
  return useMemo(
    () =>
      document.workspaces.filter(
        (workspace) => (meta[workspace.id]?.stageId ?? WORK_STAGE_ID) === stageId,
      ),
    [document, meta, stageId],
  );
}
