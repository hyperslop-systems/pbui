import { useCallback, type ReactNode } from "react";
import { EmptyState } from "@hyperslop-systems/pbui";
import type { Node } from "@hyperslop-systems/workbench-protocol";
import { useWorkbench } from "../../context";
import type { SurfaceProps } from "../../types";
import { SplitPane } from "../SplitPane";
import { Tile } from "../Tile";
import styles from "./Surface.module.css";

/**
 * The active workspace's split tree: a split becomes a `SplitPane`, a leaf a
 * `Tile`. The root carries `data-workbench-shell` so the launcher's shortcut
 * can tell "the only workbench on the page" from "one of several", and
 * `data-launcher-open` so the active tile is outlined only while a keyboard
 * operation needs a target.
 */
export function WorkbenchSurface({ renderTitle, tileAction, className, swapLabel, dockLabel, replaceLabel }: SurfaceProps) {
  const workbench = useWorkbench();
  const document = workbench.useDocument();
  const workspaceId = workbench.useWorkbenchState((state) => state.workspaceId);
  const launcherOpen = workbench.useWorkbenchState((state) => state.launcherOpen);
  const tree = document.workspaces.find((workspace) => workspace.id === workspaceId)?.tree;

  const renderNode = useCallback(
    function renderNode(node: Node): ReactNode {
      if (node.body.case === "split") return <SplitPane key={node.id} node={node} renderNode={renderNode} />;
      return (
        <Tile
          key={node.id}
          node={node}
          renderTitle={renderTitle}
          tileAction={tileAction}
          swapLabel={swapLabel}
          dockLabel={dockLabel}
          replaceLabel={replaceLabel}
        />
      );
    },
    [renderTitle, tileAction, swapLabel, dockLabel, replaceLabel],
  );

  return (
    <div
      ref={workbench.setRoot}
      data-part="workbench"
      data-workbench-shell=""
      data-launcher-open={launcherOpen || undefined}
      className={[styles.surface, className ?? ""].filter(Boolean).join(" ")}
    >
      {tree ? (
        renderNode(tree)
      ) : (
        <div className={styles.empty}>
          <EmptyState message="this workbench has no workspace" hint="create it with layout() or singleTile() and pass it as `initial`" />
        </div>
      )}
    </div>
  );
}
