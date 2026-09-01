import { Component as ReactComponent, type ErrorInfo, type ReactNode } from "react";
import { Button, Callout, EmptyState, IconButton, Text, TileFrame, useTileDrag } from "@hyperslop-systems/pbui";
import type { Node } from "@hyperslop-systems/workbench-protocol";
import { placementCount } from "@hyperslop-systems/workbench-protocol/client";
import { useWorkbench } from "../../context";
import type { SurfaceProps, TilePlacementInfo } from "../../types";
import { canClose as canClosePlacement } from "../../verbs";
import styles from "./Tile.module.css";

export interface TileProps
  extends Pick<SurfaceProps, "renderTitle" | "tileAction" | "swapLabel" | "dockLabel" | "replaceLabel"> {
  node: Node;
}

/**
 * One leaf of the split tree: pbui's `TileFrame` around the application.
 *
 * The tile is the CONTAINER (playbook §6): it resolves the view and the app
 * descriptor, wires the frame's buttons and the drag grip to the workbench
 * verbs, and hands the application a one-cell grid with a committed height.
 * It holds no application state and no layout logic of its own.
 */
export function Tile({ node, renderTitle, tileAction, swapLabel, dockLabel, replaceLabel }: TileProps) {
  const workbench = useWorkbench();
  const document = workbench.useDocument();
  const active = workbench.useWorkbenchState((state) => state.activePlacementId === node.id);
  const viewId = node.body.case === "leaf" ? node.body.value.viewId : "";
  const view = document.views[viewId];
  const app = view ? workbench.apps.get(view.appId) : null;
  const canClose = canClosePlacement(document, node.id);

  const drag = useTileDrag({
    id: node.id,
    onSwap: (source, target) => workbench.verbs.swap(source, target),
    onDock: (source, target, zone) => workbench.verbs.dock(source, target, zone),
    onReplace: (source, target) => workbench.verbs.replaceWith(source, target),
  });

  const label = view ? (view.title || (app ? (app.titleFor?.(view) ?? app.title) : view.appId)) : `missing view ${viewId}`;
  const info: TilePlacementInfo = {
    placementId: node.id,
    app,
    label,
    canClose,
    placementCount: view ? placementCount(document, view.id) : 0,
  };
  // The linked badge is chrome, not a product decision: a view shown twice
  // looks like two independent tiles until something says otherwise, and
  // "why did editing this one change that one" is the confusion it prevents.
  // It is handed to `renderTitle` rather than replaced by it, so a product's
  // custom title composes with the badge instead of re-deriving it.
  const defaultTitle = (
    <>
      {label}
      {info.placementCount > 1 ? (
        <span data-part="tile-linked" title={`the same view is shown in ${info.placementCount} tiles`}>
          {` ×${info.placementCount}`}
        </span>
      ) : null}
    </>
  );
  const title = view && renderTitle ? renderTitle(view, info, defaultTitle) : defaultTitle;

  // The chrome's own door to the per-pane launcher. Without it a product with
  // no `<tile>` presentation cannot reach `launcher.open({ placementId })` at
  // all — and a pane the split policy filled with something unwanted has no
  // exit but "close it". In the action group, never the title: the title
  // ellipsises, so a control there vanishes on exactly the long-named tiles.
  const defaultAction = (
    <IconButton
      variant="framed"
      size="tiny"
      glyph="⌕"
      accessibleName="show something else in this tile"
      onClick={() => workbench.verbs.openLauncher(node.id)}
    />
  );
  // `undefined` (no prop, or a function that declines this tile) keeps the
  // default; an explicit `null` is how a product says "no extra button".
  const custom = tileAction?.(info);
  const action = custom === undefined ? defaultAction : custom;
  const activate = () => workbench.verbs.activate(node.id);

  return (
    <div
      className={styles.cell}
      data-part="workbench-tile"
      data-active={active || undefined}
      // Programmatically focusable only: `focusPlacement` puts the keyboard
      // in a tile after a placement, and Tab then moves into the application.
      // Tab-reachable would add a stop before every tile for no gain.
      tabIndex={-1}
      // Capture, so the tile becomes the context BEFORE a button or the grip
      // handles the event; neither handler moves DOM focus.
      onPointerDownCapture={activate}
      onFocusCapture={activate}
    >
      <TileFrame
        placementId={node.id}
        tone={app?.tone ?? "var(--pbui-pane-alt)"}
        title={title}
        canClose={canClose}
        onSplit={(direction) => workbench.verbs.split(node.id, direction)}
        onClose={() => workbench.verbs.close(node.id)}
        actions={action}
        grip={{ onPointerDown: drag.onGripPointerDown }}
        dropZone={drag.zone}
        dragging={drag.dragging}
        registerElement={drag.register}
        swapLabel={drag.carrying ? (swapLabel ?? "place beside \u00b7 splits the longer side") : swapLabel}
        dockLabel={drag.carrying ? (dockLabel ?? "place the new tile at this edge") : dockLabel}
        replaceLabel={
          drag.carrying ? (replaceLabel ?? "\u2325 show it in this tile instead \u00b7 keeps the tile") : replaceLabel
        }
      >
        <div className={styles.body}>
          {view && app ? (
            <TileBoundary resetKey={`${view.id}:${view.appId}`} title={app.title}>
              <app.Component placementId={node.id} view={view} />
            </TileBoundary>
          ) : (
            <div className={styles.empty}>
              <EmptyState
                message={view ? `no application called “${view.appId}”` : `no view called “${viewId}”`}
                hint="close this tile, or open another application from the launcher (⌘K)"
              />
            </div>
          )}
        </div>
      </TileFrame>
    </div>
  );
}

interface TileBoundaryProps {
  resetKey: string;
  title: string;
  children: ReactNode;
}

/**
 * An application that throws takes down its own tile, not the workbench.
 * The boundary resets when the view changes underneath it, and on request.
 */
class TileBoundary extends ReactComponent<TileBoundaryProps, { error: Error | null; resetKey: string }> {
  state = { error: null as Error | null, resetKey: this.props.resetKey };

  static getDerivedStateFromProps(props: TileBoundaryProps, state: { error: Error | null; resetKey: string }) {
    return props.resetKey !== state.resetKey ? { error: null, resetKey: props.resetKey } : null;
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`pbui-workbench: ${this.props.title} failed to render`, error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className={styles.empty}>
        <Callout variant="warning" title={`${this.props.title} could not render`}>
          <Text size="small" prose>
            {this.state.error.message}
          </Text>
          <div className={styles.retry}>
            <Button onClick={() => this.setState({ error: null })}>Try this tile again</Button>
          </div>
        </Callout>
      </div>
    );
  }
}
