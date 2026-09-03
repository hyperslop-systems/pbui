import { useCallback, useEffect, type ReactNode } from "react";
import { EmptyState, isEditableTarget, routeWorkbenchKey, useAnyEscapeSurface } from "@hyperslop-systems/pbui";
import type { Node } from "@hyperslop-systems/workbench-protocol";
import { usePlacement, useWorkbench } from "../../context";
import type { SurfaceProps } from "../../types";
import { SplitPane } from "../SplitPane";
import { Tile } from "../Tile";
import { LinkAnnouncer } from "../LinkAnnouncer";
import { RelationPalette } from "../RelationPalette";
import { ShowChooser } from "../ShowChooser";
import { WireLayer } from "../WireLayer";
import styles from "./Surface.module.css";

/**
 * The active workspace's split tree: a split becomes a `SplitPane`, a leaf a
 * `Tile`. The root carries `data-workbench-shell` so the launcher's shortcut
 * can tell "the only workbench on the page" from "one of several", and
 * `data-launcher-open` so the active tile is outlined only while a keyboard
 * operation needs a target.
 */
export function WorkbenchSurface({ renderTitle, renderBadges, renderPort, renderWire, linkModeShortcut = true, tileAction, className, swapLabel, dockLabel, replaceLabel }: SurfaceProps) {
  const workbench = useWorkbench();
  const tree = workbench.useCoreState((state) => state.index.workspaceById.get(state.session.workspaceId)?.tree);
  const launcherOpen = workbench.useShellState((state) => state.launcher !== null);
  const linkMode = workbench.useShellState((state) => state.linkModeOpen);
  const anySurfaceOpen = useAnyEscapeSurface();

  // Mod+Shift+L toggles connect mode (PBUI-LINK-1 Phase 3), under the same
  // ownership rule as the launcher's and the rebalance dialog's chords.
  useEffect(() => {
    if (!linkModeShortcut) return;
    const onKey = (event: KeyboardEvent) => {
      const root = workbench.root();
      if (!root) return;
      const focused = window.document.activeElement;
      const unowned = !focused || focused === window.document.body;
      const ownsFocus = !unowned && root.contains(focused);
      const lone = window.document.querySelectorAll("[data-workbench-shell]").length === 1;
      if (!ownsFocus && !(unowned && lone)) return;
      const open = workbench.shell.getState().linkModeOpen;
      const decision = routeWorkbenchKey(
        event,
        {
          targetIsEditable: isEditableTarget(event.target as HTMLElement | null),
          launcherOpen: workbench.shell.getState().launcher !== null,
          // The wire layer is itself an escape surface: closing must stay possible while it is open.
          dialogOpen: anySurfaceOpen && !open,
          objectMenuOpen: false,
          acceptingPresentation: false,
          renamingView: false,
        },
        navigator.platform,
      );
      if (decision.kind !== "toggle-link-mode") return;
      event.preventDefault();
      workbench.dispatch({ kind: open ? "link.mode.close" : "link.mode.open" });
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [linkModeShortcut, anySurfaceOpen, workbench]);
  const placing = usePlacement(workbench);

  const renderNode = useCallback(
    function renderNode(node: Node): ReactNode {
      if (node.body.case === "split") return <SplitPane key={node.id} node={node} renderNode={renderNode} />;
      return (
        <Tile
          key={node.id}
          node={node}
          renderTitle={renderTitle}
          renderBadges={renderBadges}
          renderPort={renderPort}
          tileAction={tileAction}
          swapLabel={swapLabel}
          dockLabel={dockLabel}
          replaceLabel={replaceLabel}
          placementLabelFor={placing?.labelFor}
        />
      );
    },
    [renderTitle, renderBadges, renderPort, tileAction, swapLabel, dockLabel, replaceLabel, placing],
  );

  return (
    <div
      ref={workbench.setRoot}
      data-part="workbench"
      data-workbench-shell=""
      data-launcher-open={launcherOpen || undefined}
      data-link-mode={linkMode || undefined}
      className={[styles.surface, className ?? ""].filter(Boolean).join(" ")}
    >
      {tree ? (
        renderNode(tree)
      ) : (
        <div className={styles.empty}>
          <EmptyState message="this workbench has no workspace" hint="create it with layout() or singleTile() and pass it as `initial`" />
        </div>
      )}
      {linkMode ? <WireLayer {...(renderWire ? { renderWire } : {})} /> : null}
      <ShowChooser />
      <RelationPalette />
      <LinkAnnouncer />
      {placing ? (
        <div className={styles.placing} data-part="workbench-placing" role="status">
          <b>{placing.prompt}</b>
          {" — click a tile: edges dock, centre splits, hold Alt to replace what it shows"}
          {placing.defaultLabel ? ` · Enter: ${placing.defaultLabel}` : ""}
          {" · Esc: cancel"}
        </div>
      ) : null}
    </div>
  );
}
