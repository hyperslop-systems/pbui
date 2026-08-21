import { Button, Text, TextInput } from "@hyperslop-systems/pbui";
import { useState } from "react";
import type { UIEventRef, UINode } from "../../contracts";
import { walkNodes } from "../../validate/uiSchema";
import styles from "./InspectorTile.module.css";

export interface OutlineRow {
  path: string;
  depth: number;
  node: UINode;
  /** The handler a control on this node would call, and what the renderer sends it. */
  event?: { ref: UIEventRef; kind: "click" | "change" };
}

/** One line that identifies a node: its text, label, value, or shape. */
export function summariseNode(node: UINode): string {
  switch (node.kind) {
    case "text":
    case "badge":
      return JSON.stringify(node.text);
    case "button":
      return `${JSON.stringify(node.props.label)}${node.props.onClick ? ` onClick→${node.props.onClick.handler}` : ""}${node.props.disabled ? " disabled" : ""}`;
    case "input":
      return `value=${JSON.stringify(node.props.value)}${node.props.onChange ? ` onChange→${node.props.onChange.handler}` : ""}`;
    case "select":
      return `value=${JSON.stringify(node.props.value)} · ${node.props.options.length} options${node.props.onChange ? ` onChange→${node.props.onChange.handler}` : ""}`;
    case "table":
      return `${node.props.headers.length} columns × ${node.props.rows.length} rows`;
    case "meter":
      return `fraction=${node.props.fraction}${node.props.label ? ` ${JSON.stringify(node.props.label)}` : ""}`;
    case "sparkline":
      return `${node.props.points.length} points${node.props.label ? ` ${JSON.stringify(node.props.label)}` : ""}`;
    case "callout":
      return `${node.props.variant ?? "neutral"}${node.props.title ? ` ${JSON.stringify(node.props.title)}` : ""}`;
    case "ref":
      return `${node.props.reference.type}:${node.props.reference.id}`;
    case "panel":
      return node.props?.title ? JSON.stringify(node.props.title) : `${node.children?.length ?? 0} children`;
    case "row":
    case "column":
      return `${node.children?.length ?? 0} children`;
    default:
      return "";
  }
}

export function outlineRows(tree: UINode): OutlineRow[] {
  const rows: OutlineRow[] = [];
  walkNodes(tree, (node, path, depth) => {
    let event: OutlineRow["event"];
    if (node.kind === "button" && node.props.onClick) event = { ref: node.props.onClick, kind: "click" };
    if ((node.kind === "input" || node.kind === "select") && node.props.onChange) event = { ref: node.props.onChange, kind: "change" };
    rows.push({ path, depth, node, event });
  });
  return rows;
}

export function treeDepth(tree: UINode): number {
  let max = 0;
  walkNodes(tree, (_node, _path, depth) => {
    if (depth > max) max = depth;
  });
  return max;
}

export interface TreeOutlineProps {
  tree: UINode;
  highlight: string | null;
  onHover(path: string | null): void;
  /** Fire a node's handler with what the renderer would send (`{ value }` for a change). */
  onFire(ref: UIEventRef, payload?: unknown): void;
  disabled?: boolean;
}

/**
 * The render tree as an outline — kind, a one-line summary, and a way to
 * fire the handler a control would. Hovering a row asks the tile to outline
 * that node (guide §4.10); the paths are the renderer's own.
 */
export function TreeOutline({ tree, highlight, onHover, onFire, disabled }: TreeOutlineProps) {
  const rows = outlineRows(tree);
  return (
    <ul className={styles.outline} aria-label="render tree" onMouseLeave={() => onHover(null)}>
      {rows.map((row) => (
        <li
          key={row.path}
          className={styles.row}
          data-path={row.path}
          data-highlighted={highlight === row.path ? "true" : undefined}
          style={{ marginLeft: `calc(${row.depth - 1} * var(--pbui-space-3))` }}
          onMouseEnter={() => onHover(row.path)}
        >
          <Text size="tiny" className={styles.kind}>
            {row.node.kind}
          </Text>
          <Text size="tiny" tone="faint" className={styles.summary} title={row.path}>
            {summariseNode(row.node)}
          </Text>
          {row.event ? <FireControl row={row} onFire={onFire} disabled={disabled} /> : null}
        </li>
      ))}
    </ul>
  );
}

function FireControl({ row, onFire, disabled }: { row: OutlineRow; onFire: TreeOutlineProps["onFire"]; disabled?: boolean }) {
  const [value, setValue] = useState(() => (row.node.kind === "input" || row.node.kind === "select" ? row.node.props.value : ""));
  const event = row.event!;
  return (
    <span className={styles.fire}>
      {event.kind === "change" ? (
        <TextInput size="tiny" width="compact" value={value} onValueChange={setValue} accessibleName={`value for ${event.ref.handler}`} />
      ) : null}
      <Button
        size="tiny"
        variant="framed"
        disabled={disabled}
        onClick={() => onFire(event.ref, event.kind === "change" ? { value } : undefined)}
        title={`fire ${event.ref.handler} on ${row.path}`}
      >
        fire {event.ref.handler}
      </Button>
    </span>
  );
}
