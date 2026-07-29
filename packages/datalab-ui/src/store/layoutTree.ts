import type { DocId } from "../pbui/types";

export type NodeId = string;
export type AppId = string;

export type Node =
  | { id: NodeId; type: "leaf"; app: AppId; docId: DocId | null; label?: string }
  | { id: NodeId; type: "split"; dir: "row" | "col"; a: Node; b: Node; ratio: number };

export type IdFactory = () => string;

export const leaf = (app: AppId, docId: DocId | null = null, createId: IdFactory): Node => ({
  id: createId(),
  type: "leaf",
  app,
  docId,
});

export const split = (
  dir: "row" | "col",
  a: Node,
  b: Node,
  ratio = 0.5,
  createId: IdFactory,
): Node => ({
  id: createId(),
  type: "split",
  dir,
  a,
  b,
  ratio,
});

/** Replace one node while structurally sharing every untouched branch. */
export function updateNode(node: Node, id: NodeId, fn: (node: Node) => Node): Node {
  if (node.id === id) return fn(node);
  if (node.type === "split") {
    const a = updateNode(node.a, id, fn);
    const b = updateNode(node.b, id, fn);
    if (a !== node.a || b !== node.b) return { ...node, a, b };
  }
  return node;
}

/** Remove a leaf; its sibling absorbs the vacated space. */
export function removeLeaf(node: Node, id: NodeId): Node {
  if (node.type === "split") {
    if (node.a.id === id) return node.b;
    if (node.b.id === id) return node.a;
    const a = removeLeaf(node.a, id);
    const b = removeLeaf(node.b, id);
    if (a !== node.a || b !== node.b) return { ...node, a, b };
  }
  return node;
}

export function findLeaf(node: Node, id: NodeId): Node | null {
  if (node.type === "leaf") return node.id === id ? node : null;
  return findLeaf(node.a, id) ?? findLeaf(node.b, id);
}

export function countLeaves(node: Node): number {
  return node.type === "leaf" ? 1 : countLeaves(node.a) + countLeaves(node.b);
}

/** Deep-copy a layout tree, minting an id for every copied node. */
export function cloneTree(node: Node, createId: IdFactory): Node {
  return node.type === "leaf"
    ? { ...node, id: createId() }
    : {
        ...node,
        id: createId(),
        a: cloneTree(node.a, createId),
        b: cloneTree(node.b, createId),
      };
}

/** Divider positions that snap, and how close counts. */
export const SNAP_RATIOS = [0.25, 1 / 3, 0.5, 2 / 3, 0.75];
export const SNAP_TOLERANCE = 0.022;

export function snapRatio(value: number): { ratio: number; snapped: boolean } {
  for (const candidate of SNAP_RATIOS) {
    if (Math.abs(value - candidate) < SNAP_TOLERANCE) return { ratio: candidate, snapped: true };
  }
  return { ratio: value, snapped: false };
}
