import { Button, Callout, Chip, Meter, SelectInput, Sparkline, Stack, Surface, Text, TextInput, Toolbar } from "@hyperslop-systems/pbui";
import type { ReactNode } from "react";
import type { UIEventRef, UINode, UIReference } from "../../contracts";
import styles from "./UINodeRenderer.module.css";

export interface UINodeRendererProps {
  tree: UINode | null;
  /** A control was used: the ref names the handler; `payload` is what the control produced (`{ value }` for inputs). */
  onEvent(ref: UIEventRef, payload?: unknown): void;
  /**
   * How a `ref` node becomes a presentation. The renderer stays ignorant of
   * any product's `createPbui` instance; the product hands in its
   * `<Presentation>` here, and the node gets the object menu, accept mode and
   * the mouse-doc line for free.
   */
  renderReference(reference: UIReference, label: string): ReactNode;
  /** Prefix for the accessible names of inputs without a label of their own. */
  accessiblePrefix?: string;
}

/**
 * Interprets a program's UI tree into pbui atoms — vm-system's
 * `WidgetRenderer` with the product's own components instead of raw DOM, so a
 * generated tile is indistinguishable in chrome, tokens and keyboard
 * behaviour from a shipped one (guide D3). Every kind maps to one atom; an
 * unknown kind cannot reach here because the engine validated the tree.
 */
export function UINodeRenderer({ tree, onEvent, renderReference, accessiblePrefix = "program" }: UINodeRendererProps) {
  if (!tree) return null;
  return <>{renderNode(tree, { onEvent, renderReference, accessiblePrefix }, "root")}</>;
}

interface Context {
  onEvent: UINodeRendererProps["onEvent"];
  renderReference: UINodeRendererProps["renderReference"];
  accessiblePrefix: string;
}

function children(nodes: UINode[] | undefined, context: Context, path: string): ReactNode[] {
  return (nodes ?? []).map((child, index) => {
    const key = `${path}.${index}`;
    return <span key={key} className={styles.child} data-part="program-node" data-kind={child.kind}>{renderNode(child, context, key)}</span>;
  });
}

function renderNode(node: UINode, context: Context, path: string): ReactNode {
  switch (node.kind) {
    case "panel":
      return (
        <Surface tone="alt" border="hair" padding={2} className={styles.panel}>
          <Stack gap={node.props?.gap ?? 2}>
            {node.props?.title ? (
              <Text size="small" strong>
                {node.props.title}
              </Text>
            ) : null}
            {children(node.children, context, path)}
          </Stack>
        </Surface>
      );
    case "row":
      return (
        <Toolbar tight className={styles.row}>
          {children(node.children, context, path)}
        </Toolbar>
      );
    case "column":
      return (
        <Stack gap={node.props?.gap ?? 2} className={styles.column}>
          {children(node.children, context, path)}
        </Stack>
      );
    case "text":
      return (
        <Text size={textSize(node.props?.size)} tone={node.props?.tone === "faint" ? "faint" : "default"} strong={node.props?.strong} prose>
          {node.text}
        </Text>
      );
    case "badge":
      return <Chip label={node.text} tone={node.props?.tone} />;
    case "button": {
      const { label, onClick, variant, disabled } = node.props;
      return (
        <Button
          size="tiny"
          variant={variant === "primary" ? "raised" : "framed"}
          tone={variant === "destructive" ? "danger" : "default"}
          disabled={disabled}
          onClick={() => onClick && context.onEvent(onClick, onClick.args)}
        >
          {label}
        </Button>
      );
    }
    case "input": {
      const { value, placeholder, type, onChange } = node.props;
      return (
        <TextInput
          size="small"
          value={value}
          placeholder={placeholder}
          inputMode={type === "number" ? "decimal" : undefined}
          accessibleName={placeholder ?? `${context.accessiblePrefix} ${path}`}
          onValueChange={(next) => onChange && context.onEvent(onChange, { value: next })}
        />
      );
    }
    case "select": {
      const { value, options, onChange } = node.props;
      return (
        <SelectInput
          size="small"
          variant="framed"
          value={value}
          options={options}
          accessibleName={`${context.accessiblePrefix} ${path}`}
          onValueChange={(next) => onChange && context.onEvent(onChange, { value: next })}
        />
      );
    }
    case "table": {
      const { headers, rows } = node.props;
      return (
        <div data-part="program-table" className={styles.scroll}>
          <table className={styles.table}>
            {headers.length > 0 ? (
              <thead>
                <tr>
                  {headers.map((header, index) => (
                    <th key={index}>{header}</th>
                  ))}
                </tr>
              </thead>
            ) : null}
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} data-numeric={typeof cell === "number" ? "true" : undefined}>
                      {cellText(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    case "meter": {
      const { fraction, label, value } = node.props;
      return (
        <div className={styles.labelled}>
          {label ? (
            <Text size="tiny" tone="faint">
              {label}
            </Text>
          ) : null}
          <Meter fraction={Math.max(0, Math.min(1, fraction))} value={value} accessibleName={label ?? value ?? "meter"} />
        </div>
      );
    }
    case "sparkline": {
      const { points, label } = node.props;
      return (
        <div className={styles.labelled}>
          {label ? (
            <Text size="tiny" tone="faint">
              {label}
            </Text>
          ) : null}
          <Sparkline points={points} accessibleName={label ?? "sparkline"} width={120} />
        </div>
      );
    }
    case "callout": {
      const { variant, title, text } = node.props;
      return (
        <Callout variant={variant === "positive" ? "ok" : variant === "warning" || variant === "danger" ? "warning" : "info"} title={title}>
          <Text size="small" prose>
            {text}
          </Text>
        </Callout>
      );
    }
    case "ref": {
      const { reference, label } = node.props;
      return <>{context.renderReference(reference, label ?? "")}</>;
    }
    default:
      return null;
  }
}

function textSize(size: string | undefined): "tiny" | "small" | "base" | "title" {
  switch (size) {
    case "tiny":
      return "tiny";
    case "small":
      return "small";
    case "title":
      return "title";
    default:
      return "base";
  }
}

function cellText(cell: unknown): string {
  if (cell === null || cell === undefined) return "";
  if (typeof cell === "object") {
    try {
      return JSON.stringify(cell);
    } catch {
      return String(cell);
    }
  }
  return String(cell);
}
