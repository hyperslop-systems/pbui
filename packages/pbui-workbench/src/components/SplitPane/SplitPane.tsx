import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Direction, type Node } from "@hyperslop-systems/workbench-protocol";
import { snapRatio } from "@hyperslop-systems/workbench-protocol/client";
import { useWorkbench } from "../../context";
import { clampRatio } from "../../verbs";
import styles from "./SplitPane.module.css";

export interface SplitPaneProps {
  node: Node;
  /** How to render a child node; the Surface passes its recursive renderer. */
  renderNode(node: Node): ReactNode;
}

/**
 * Two panes and a divider, on a CSS grid whose tracks ARE the ratio.
 *
 * The ratio is live in component state while the pointer is down and is
 * committed to the document — snapped to the family's shared ratios — on
 * release. One mutation per drag rather than one per pointer move keeps a
 * persistence subscriber from writing localStorage sixty times a second.
 */
export function SplitPane({ node, renderNode }: SplitPaneProps) {
  const workbench = useWorkbench();
  const container = useRef<HTMLDivElement>(null);
  const split = node.body.case === "split" ? node.body.value : null;
  const row = split?.direction !== Direction.COLUMN;
  const committed = split?.ratio ?? 0.5;
  const [live, setLive] = useState<{ ratio: number; snapped: boolean } | null>(null);
  const ratio = live?.ratio ?? committed;

  // A drag that outlives the component (the split closed under it) must not
  // leave window listeners behind.
  const teardown = useRef<(() => void) | null>(null);
  useEffect(() => () => teardown.current?.(), []);

  const onPointerDown = useCallback(
    (event: React.PointerEvent) => {
      event.preventDefault();
      teardown.current?.();
      const previous = document.body.style.userSelect;
      document.body.style.userSelect = "none";
      let last = committed;

      const move = (moveEvent: PointerEvent) => {
        const element = container.current;
        if (!element) return;
        const box = element.getBoundingClientRect();
        const raw = row ? (moveEvent.clientX - box.left) / box.width : (moveEvent.clientY - box.top) / box.height;
        const next = snapRatio(clampRatio(raw));
        last = next.ratio;
        setLive(next);
      };
      const finish = (commit: boolean) => {
        if (teardown.current !== stop) return;
        teardown.current = null;
        document.body.style.userSelect = previous;
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", cancel);
        window.removeEventListener("blur", cancel);
        setLive(null);
        if (commit) workbench.verbs.resize(node.id, last);
      };
      const stop = () => finish(false);
      const up = () => finish(true);
      const cancel = () => finish(false);
      teardown.current = stop;
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", cancel);
      window.addEventListener("blur", cancel);
    },
    [committed, node.id, row, workbench],
  );

  // Keyboard-operable, because a layout you cannot adjust without a mouse is
  // a layout half the users are stuck with. Home/End go to the extremes,
  // which is the shape every other `role="separator"` on the web has.
  const onKeyDown = (event: React.KeyboardEvent) => {
    const step = event.shiftKey ? 0.01 : 0.05;
    const decrease = row ? "ArrowLeft" : "ArrowUp";
    const increase = row ? "ArrowRight" : "ArrowDown";
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      workbench.verbs.resize(node.id, event.key === "Home" ? 0.1 : 0.9, { snap: false });
      return;
    }
    if (event.key !== decrease && event.key !== increase) return;
    event.preventDefault();
    workbench.verbs.resize(node.id, committed + (event.key === increase ? step : -step), { snap: false });
  };

  // Double-click is the conventional "even it out" and costs one handler.
  const onDoubleClick = (event: React.MouseEvent) => {
    event.preventDefault();
    workbench.verbs.resize(node.id, 0.5);
  };

  if (!split?.a || !split.b) return null;

  const tracks = `minmax(0, ${ratio}fr) auto minmax(0, ${1 - ratio}fr)`;
  return (
    <div
      ref={container}
      data-part="split"
      data-direction={row ? "row" : "col"}
      data-split-id={node.id}
      className={[styles.split, row ? styles.row : styles.col].join(" ")}
      style={row ? { gridTemplateColumns: tracks } : { gridTemplateRows: tracks }}
    >
      <div className={styles.pane}>{renderNode(split.a)}</div>
      <div
        role="separator"
        tabIndex={0}
        aria-orientation={row ? "vertical" : "horizontal"}
        aria-label={row ? "resize horizontally" : "resize vertically"}
        aria-valuenow={Math.round(ratio * 100)}
        aria-valuemin={10}
        aria-valuemax={90}
        // A screen reader announcing "60" says nothing; the unit is the point.
        aria-valuetext={`${Math.round(ratio * 100)} percent`}
        data-part="split-divider"
        data-state={live ? (live.snapped ? "snapped" : "dragging") : undefined}
        className={styles.divider}
        onPointerDown={onPointerDown}
        onDoubleClick={onDoubleClick}
        onKeyDown={onKeyDown}
      >
        <span className={styles.grip} />
      </div>
      <div className={styles.pane}>{renderNode(split.b)}</div>
    </div>
  );
}
