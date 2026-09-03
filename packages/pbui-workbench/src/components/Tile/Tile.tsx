import { Component as ReactComponent, type ErrorInfo, type ReactNode } from "react";
import { Button, Callout, EmptyState, IconButton, Text, TileFrame, useTileDrag } from "@hyperslop-systems/pbui";
import { canClose as canClosePlacement, commands, placementCount } from "@hyperslop-systems/workbench-core";
import type { Node } from "@hyperslop-systems/workbench-protocol";
import { labelOfView } from "../../app";
import { useWorkbench } from "../../context";
import { useBadges } from "../../links/hooks";
import type { PlaceZone } from "../../placement";
import { PortBadge } from "../PortBadge";
import { PortRail } from "../PortRail";
import type { SurfaceProps, TilePlacementInfo } from "../../types";
import styles from "./Tile.module.css";

export interface TileProps
  extends Pick<SurfaceProps, "renderTitle" | "renderBadges" | "renderPort" | "tileAction" | "swapLabel" | "dockLabel" | "replaceLabel"> {
  node: Node;
  /** The active placement request's per-tile wording, from the Surface. */
  placementLabelFor?(placementId: string, zone: PlaceZone): string | undefined;
}

/**
 * One leaf of the split tree: pbui's `TileFrame` around the application.
 *
 * The tile is the CONTAINER: it resolves the view and the presentation,
 * wires the frame's buttons and the drag grip to commands, and hands the
 * application a one-cell grid with a committed height. It holds no
 * application state and no layout logic of its own.
 */
export function Tile({ node, renderTitle, renderBadges, renderPort, tileAction, swapLabel, dockLabel, replaceLabel, placementLabelFor }: TileProps) {
  const workbench = useWorkbench();
  const document = workbench.useDocument();
  const index = workbench.useCoreState((state) => state.index);
  const active = workbench.useCoreState((state) => state.session.activePlacementId === node.id);
  const linkMode = workbench.useShellState((state) => state.linkModeOpen);
  const viewId = node.body.case === "leaf" ? node.body.value.viewId : "";
  const view = document.views[viewId];
  const app = view ? workbench.apps.get(view.appId) : null;
  const canClose = canClosePlacement(index, node.id);
  const badges = useBadges(view ?? ({ id: viewId, appId: "", documents: {} } as never));

  const drag = useTileDrag({
    id: node.id,
    onSwap: (source, target) => workbench.execute(commands.swap(source, target)).ok,
    onDock: (source, target, zone) => workbench.execute(commands.dock(source, target, zone)).ok,
    onReplace: (source, target) => workbench.execute(commands.replaceWith(source, target)).ok,
  });

  const label = view ? labelOfView(view, app) : `missing view ${viewId}`;
  const info: TilePlacementInfo = {
    placementId: node.id,
    app,
    label,
    canClose,
    placementCount: view ? placementCount(index, view.id) : 0,
  };
  // The linked badge is chrome, not a product decision: a view shown twice
  // looks like two independent tiles until something says otherwise. It is
  // handed to `renderTitle` rather than replaced by it.
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
  const badgeNodes = view && badges.length > 0 ? (renderBadges ? renderBadges(view, info, badges) : badges.map((badge) => <PortBadge key={badge.port} badge={badge} />)) : null;
  const title = (
    <>
      {view && renderTitle ? renderTitle(view, info, defaultTitle) : defaultTitle}
      {badgeNodes}
    </>
  );

  // The chrome's own door to the per-pane launcher, in the action group,
  // never the title: the title ellipsises.
  const defaultAction = (
    <IconButton variant="framed" size="tiny" glyph="⌕" accessibleName="show something else in this tile" onClick={() => workbench.dispatch({ kind: "launcher.open", from: node.id })} />
  );
  const custom = tileAction?.(info);
  const action = custom === undefined ? defaultAction : custom;
  const aimed = placementLabelFor && drag.zone ? placementLabelFor(node.id, drag.zone) : undefined;
  const activate = () => {
    if (workbench.core.getState().session.activePlacementId !== node.id) workbench.execute(commands.activate(node.id));
  };

  return (
    <div
      className={styles.cell}
      data-part="workbench-tile"
      data-active={active || undefined}
      // Programmatically focusable only: `focusPlacement` puts the keyboard
      // in a tile after a placement, and Tab then moves into the application.
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
        onSplit={(direction) => workbench.execute(commands.duplicate(node.id, direction))}
        onClose={() => workbench.execute(commands.close(node.id))}
        actions={action}
        grip={{ onPointerDown: drag.onGripPointerDown }}
        dropZone={drag.zone}
        dragging={drag.dragging}
        registerElement={drag.register}
        swapLabel={aimed ?? (drag.carrying ? (swapLabel ?? "place beside · splits the longer side") : swapLabel)}
        dockLabel={aimed ?? (drag.carrying ? (dockLabel ?? "place the new tile at this edge") : dockLabel)}
        replaceLabel={aimed ?? (drag.carrying ? (replaceLabel ?? "⌥ show it in this tile instead · keeps the tile") : replaceLabel)}
      >
        <div className={styles.body} data-link-mode={linkMode || undefined}>
          {view && app ? (
            // In connect mode the application is INERT under its rail.
            <div className={styles.app} inert={linkMode || undefined}>
              <TileBoundary resetKey={`${view.id}:${view.appId}`} title={app.title}>
                <app.Component placementId={node.id} view={view} />
              </TileBoundary>
            </div>
          ) : (
            <div className={styles.empty}>
              <EmptyState message={view ? `no application called “${view.appId}”` : `no view called “${viewId}”`} hint="close this tile, or open another application from the launcher (⌘K)" />
            </div>
          )}
          {linkMode && view ? <PortRail view={view} {...(renderPort ? { renderPort } : {})} /> : null}
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

/** An application that throws takes down its own tile, not the workbench. */
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
