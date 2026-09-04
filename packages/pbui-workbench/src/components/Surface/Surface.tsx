import { useCallback, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { EmptyState, isEditableTarget, routeWorkbenchKey, useAnyEscapeSurface } from "@hyperslop-systems/pbui";
import type { Node } from "@hyperslop-systems/workbench-protocol";
import { usePlacement, useWorkbench } from "../../context";
import type { SurfaceProps } from "../../types";
import { SplitPane } from "../SplitPane";
import { Tile } from "../Tile";
import { LinkAnnouncer } from "../LinkAnnouncer";
import { RelationPalette } from "../RelationPalette";
import { ShowChooser } from "../ShowChooser";
import { ConnectionProvider } from "../../wiring/connectionController";
import { ConnectionInspector } from "../../wiring/ConnectionInspector";
import { WiringCanvas } from "../../wiring/WiringCanvas";
import { createGeometryStore } from "../../wiring/geometryStore";
import { wiringMinimum, shouldFocus } from "../../wiring/layoutPolicy";
import { GeometryContext, useWiringGeometry } from "../../wiring/geometryContext";
import { useConnectedHighlight } from "../../wiring/connectedHighlight";
import styles from "./Surface.module.css";

/**
 * The active workspace's split tree: a split becomes a `SplitPane`, a leaf a
 * `Tile`. The root carries `data-workbench-shell` so the launcher's shortcut
 * can tell "the only workbench on the page" from "one of several", and
 * `data-launcher-open` so the active tile is outlined only while a keyboard
 * operation needs a target.
 */
export function WorkbenchSurface({ renderTitle, renderBadges, wiring = {}, linkModeShortcut = true, tileAction, className, swapLabel, dockLabel, replaceLabel }: SurfaceProps) {
  const workbench = useWorkbench();
  const geometry = useMemo(() => createGeometryStore(), []);
  const setRoot = useCallback((element: HTMLDivElement | null) => { workbench.setRoot(element); geometry.setRoot(element); }, [workbench, geometry]);
  const tree = workbench.useCoreState((state) => state.index.workspaceById.get(state.session.workspaceId)?.tree);
  const launcherOpen = workbench.useShellState((state) => state.launcher !== null);
  const linkMode = workbench.useShellState((state) => state.linkModeOpen);
  useLayoutEffect(() => { geometry.invalidate(); geometry.flush(); }, [geometry, tree, linkMode]);
  useConnectedHighlight(geometry, linkMode);
  const measured = useWiringGeometry(geometry);
  const [automaticFocus, setAutomaticFocus] = useState(false);
  const [presentation, setPresentation] = useState<"auto"|"spatial"|"focused">("auto");
  const requested = wiring.mode ?? presentation;
  const focused = linkMode && (requested === "focused" || requested === "auto" && automaticFocus);
  useLayoutEffect(() => {
    if (!linkMode || measured.bounds.right === 0) return;
    const minimum = wiringMinimum(tree);
    setAutomaticFocus(previous => shouldFocus({width: measured.bounds.right,height: measured.bounds.bottom}, minimum, previous));
  }, [linkMode, measured.bounds, tree]);
  useLayoutEffect(() => { geometry.invalidate(); }, [geometry, focused]);
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
          tileAction={tileAction}
          swapLabel={swapLabel}
          dockLabel={dockLabel}
          replaceLabel={replaceLabel}
          placementLabelFor={placing?.labelFor}
        />
      );
    },
    [renderTitle, renderBadges, tileAction, swapLabel, dockLabel, replaceLabel, placing],
  );

  return (
    <GeometryContext.Provider value={geometry}>
    <ConnectionProvider enabled={linkMode} options={wiring} focused={focused}>
    <div
      tabIndex={-1}
      ref={setRoot}
      data-part="workbench"
      data-workbench-shell=""
      data-launcher-open={launcherOpen || undefined}
      data-link-mode={linkMode || undefined}
      data-wiring-focused={focused || undefined}
      className={[styles.surface, className ?? ""].filter(Boolean).join(" ")}
    >
      <div className={styles.tree} inert={focused || undefined} data-part="workbench-tree">
      {tree ? (
        renderNode(tree)
      ) : (
        <div className={styles.empty}>
          <EmptyState message="this workbench has no workspace" hint="create it with layout() or singleTile() and pass it as `initial`" />
        </div>
      )}
      </div>
      {linkMode && !focused ? <WiringCanvas /> : null}
      {linkMode ? <ConnectionInspector focused={focused} mode={requested} onMode={setPresentation} /> : null}
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
    </ConnectionProvider>
    </GeometryContext.Provider>
  );
}
