import type { UIEventRef, UINode } from "../contracts";
import { SANDBOX_UI_KINDS } from "../contracts";
import { DEFAULT_LIMITS, type SandboxLimits } from "../limits";

/**
 * Structural validation of a rendered tree. Ported from vm-system
 * `frontend/packages/plugin-runtime/src/uiSchema.ts` (37bd440) with the PBUI
 * kinds and the size limits. The error messages carry a path
 * (`root.children[2].props.onClick.handler must be a non-empty string`)
 * because the reader of most of them is a model fixing its own program.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertEventRef(value: unknown, path: string): asserts value is UIEventRef {
  if (!isRecord(value)) throw new Error(`${path} must be an object`);
  if (typeof value.handler !== "string" || value.handler.length === 0) {
    throw new Error(`${path}.handler must be a non-empty string`);
  }
}

function assertText(value: unknown, path: string, limits: SandboxLimits): asserts value is string {
  if (typeof value !== "string") throw new Error(`${path} must be a string`);
  if (value.length > limits.textChars) throw new Error(`${path} is ${value.length} characters, the limit is ${limits.textChars}`);
}

interface Counter {
  nodes: number;
}

function walk(value: unknown, path: string, depth: number, limits: SandboxLimits, counter: Counter): asserts value is UINode {
  if (!isRecord(value)) throw new Error(`${path} must be an object`);
  counter.nodes += 1;
  if (counter.nodes > limits.treeNodes) throw new Error(`the tree has more than ${limits.treeNodes} nodes`);
  if (depth > limits.treeDepth) throw new Error(`${path} nests deeper than ${limits.treeDepth} levels`);

  const kind = value.kind;
  if (typeof kind !== "string") throw new Error(`${path}.kind must be a string`);

  switch (kind) {
    case "panel":
    case "row":
    case "column": {
      if (value.props !== undefined && !isRecord(value.props)) throw new Error(`${path}.props must be an object`);
      if (value.children !== undefined) {
        if (!Array.isArray(value.children)) throw new Error(`${path}.children must be an array`);
        value.children.forEach((child, index) => walk(child, `${path}.children[${index}]`, depth + 1, limits, counter));
      }
      return;
    }
    case "text":
    case "badge": {
      assertText(value.text, `${path}.text`, limits);
      if (value.props !== undefined && !isRecord(value.props)) throw new Error(`${path}.props must be an object`);
      return;
    }
    case "button": {
      if (!isRecord(value.props) || typeof value.props.label !== "string") throw new Error(`${path}.props.label must be a string`);
      if (value.props.onClick !== undefined) assertEventRef(value.props.onClick, `${path}.props.onClick`);
      return;
    }
    case "input": {
      if (!isRecord(value.props) || typeof value.props.value !== "string") throw new Error(`${path}.props.value must be a string`);
      if (value.props.onChange !== undefined) assertEventRef(value.props.onChange, `${path}.props.onChange`);
      return;
    }
    case "select": {
      if (!isRecord(value.props) || typeof value.props.value !== "string") throw new Error(`${path}.props.value must be a string`);
      if (!Array.isArray(value.props.options)) throw new Error(`${path}.props.options must be an array`);
      value.props.options.forEach((option, index) => {
        if (!isRecord(option) || typeof option.value !== "string" || typeof option.label !== "string") {
          throw new Error(`${path}.props.options[${index}] must be {value: string, label: string}`);
        }
      });
      if (value.props.onChange !== undefined) assertEventRef(value.props.onChange, `${path}.props.onChange`);
      return;
    }
    case "table": {
      if (!isRecord(value.props)) throw new Error(`${path}.props must be an object`);
      if (!Array.isArray(value.props.headers) || value.props.headers.some((h) => typeof h !== "string")) {
        throw new Error(`${path}.props.headers must be a string[]`);
      }
      if (!Array.isArray(value.props.rows) || value.props.rows.some((row) => !Array.isArray(row))) {
        throw new Error(`${path}.props.rows must be an array of rows`);
      }
      if (value.props.rows.length > limits.tableRows) {
        throw new Error(`${path}.props.rows has ${value.props.rows.length} rows, the limit is ${limits.tableRows}`);
      }
      return;
    }
    case "meter": {
      if (!isRecord(value.props) || typeof value.props.fraction !== "number" || !Number.isFinite(value.props.fraction)) {
        throw new Error(`${path}.props.fraction must be a finite number`);
      }
      return;
    }
    case "sparkline": {
      if (!isRecord(value.props) || !Array.isArray(value.props.points) || value.props.points.some((p) => typeof p !== "number")) {
        throw new Error(`${path}.props.points must be a number[]`);
      }
      return;
    }
    case "callout": {
      if (!isRecord(value.props)) throw new Error(`${path}.props must be an object`);
      assertText(value.props.text, `${path}.props.text`, limits);
      return;
    }
    case "ref": {
      if (!isRecord(value.props) || !isRecord(value.props.reference)) throw new Error(`${path}.props.reference must be an object`);
      const reference = value.props.reference;
      if (typeof reference.type !== "string" || reference.type.length === 0) throw new Error(`${path}.props.reference.type must be a non-empty string`);
      if (typeof reference.id !== "string" || reference.id.length === 0) throw new Error(`${path}.props.reference.id must be a non-empty string`);
      return;
    }
    default:
      throw new Error(`${path}.kind '${kind}' is not supported; kinds: ${SANDBOX_UI_KINDS.join(", ")}`);
  }
}

export function assertUINode(value: unknown, limits: SandboxLimits = DEFAULT_LIMITS, path = "root"): asserts value is UINode {
  walk(value, path, 1, limits, { nodes: 0 });
}

export function validateUINode(value: unknown, limits: SandboxLimits = DEFAULT_LIMITS): UINode {
  assertUINode(value, limits);
  return value;
}

/** How many nodes a tree has; used by tools to prune what they return to a model. */
export function countNodes(node: UINode): number {
  if ("children" in node && Array.isArray(node.children)) {
    return 1 + node.children.reduce((total, child) => total + countNodes(child), 0);
  }
  return 1;
}

/**
 * Visit every node with its path — `root`, `root.0`, `root.0.2` by child
 * index. The renderer stamps the same paths on the DOM (`data-node-path`),
 * which is what lets an inspector's outline and a tile agree on a node.
 */
export function walkNodes(node: UINode, visit: (node: UINode, path: string, depth: number) => void, path = "root", depth = 1): void {
  visit(node, path, depth);
  if ("children" in node && Array.isArray(node.children)) {
    node.children.forEach((child, index) => walkNodes(child, visit, `${path}.${index}`, depth + 1));
  }
}
