import type { ReactNode } from "react";
import { Button } from "@hyperslop-systems/pbui";
import { commands } from "@hyperslop-systems/workbench-core";
import type { Workspace } from "@hyperslop-systems/workbench-protocol";
import { leaves } from "@hyperslop-systems/workbench-protocol/client";
import { useWorkbench } from "../../context";
import type { WorkspaceStripProps } from "../../types";
import styles from "./WorkspaceStrip.module.css";

/**
 * The human door to `session.selectWorkspace`. Without it an agent — or any
 * code creating a workspace — can put the user in a workspace they have no
 * way to leave. Deliberately not a tab bar: a product that wants close
 * buttons or drag reorder wraps `renderWorkspace`.
 */
export function WorkspaceStrip({ renderWorkspace, className, addLabel }: WorkspaceStripProps) {
  const workbench = useWorkbench();
  const document = workbench.useDocument();
  const workspaceId = workbench.useCoreState((state) => state.session.workspaceId);

  const info = (workspace: Workspace) => ({
    active: workspace.id === workspaceId,
    tileCount: leaves(workspace.tree).length,
    select: () => workbench.execute(commands.selectWorkspace(workspace.id)).ok,
  });

  return (
    <div data-part="workspace-strip" className={[styles.strip, className ?? ""].filter(Boolean).join(" ")}>
      {document.workspaces.map((workspace) => {
        const placement = info(workspace);
        const custom: ReactNode = renderWorkspace?.(workspace, placement);
        if (custom !== undefined) {
          return (
            <div key={workspace.id} className={styles.item} data-part="workspace-strip-item">
              {custom}
            </div>
          );
        }
        return (
          <Button
            key={workspace.id}
            size="tiny"
            variant="framed"
            selected={placement.active}
            aria-current={placement.active ? "true" : undefined}
            title={`${placement.tileCount} tile${placement.tileCount === 1 ? "" : "s"}`}
            onClick={placement.select}
          >
            {workspace.name || workspace.id}
          </Button>
        );
      })}
      {addLabel ? (
        <Button size="tiny" variant="framed" onClick={() => workbench.execute(commands.createWorkspace(addLabel))} title="add a workspace">
          + {addLabel}
        </Button>
      ) : null}
    </div>
  );
}
