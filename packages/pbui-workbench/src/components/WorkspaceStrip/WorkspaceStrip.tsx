import type { ReactNode } from "react";
import { Button } from "@hyperslop-systems/pbui";
import type { Workspace } from "@hyperslop-systems/workbench-protocol";
import { leaves } from "@hyperslop-systems/workbench-protocol/client";
import { useWorkbench } from "../../context";
import type { WorkspaceStripProps } from "../../types";
import styles from "./WorkspaceStrip.module.css";

/**
 * The human door to `workspace.select`. Without it an agent — or any code
 * calling `verbs.createWorkspace` — can put the user in a workspace they have
 * no way to leave, which is the two-doors rule (playbook §6) broken in the
 * most user-hostile direction.
 *
 * Deliberately not a tab bar: no close buttons, no drag reorder, no overflow
 * menu. A product that wants those wraps `renderWorkspace` and draws its own
 * row; a product that wants its `<workspace>` Presentation puts it there too,
 * so the object menu and this strip are the same verbs.
 */
export function WorkspaceStrip({ renderWorkspace, className, addLabel }: WorkspaceStripProps) {
  const workbench = useWorkbench();
  const document = workbench.useDocument();
  const workspaceId = workbench.useWorkbenchState((state) => state.workspaceId);

  const info = (workspace: Workspace) => ({
    active: workspace.id === workspaceId,
    tileCount: leaves(workspace.tree).length,
    select: () => workbench.verbs.selectWorkspace(workspace.id),
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
            // `framed` is the strip's "you are here"; a product that wants a
            // stronger cue passes renderWorkspace.
            variant={placement.active ? "framed" : "bare"}
            aria-current={placement.active ? "true" : undefined}
            title={`${placement.tileCount} tile${placement.tileCount === 1 ? "" : "s"}`}
            onClick={placement.select}
          >
            {workspace.name || workspace.id}
          </Button>
        );
      })}
      {addLabel ? (
        <Button size="tiny" onClick={() => workbench.verbs.createWorkspace(addLabel)} title="add a workspace">
          +
        </Button>
      ) : null}
    </div>
  );
}
