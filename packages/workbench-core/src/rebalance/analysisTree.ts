import { Direction, type Node } from "@hyperslop-systems/workbench-protocol";

/**
 * The adapter between the workbench protocol's BINARY split tree (one ratio
 * per split) and the N-ARY analysis tree (one weight vector per flattened
 * split) that the repair algorithms want (PBUI-REBALANCE-1, design-doc/01
 * Part III).
 *
 * The two representations describe the same rectangles differently, and the
 * conversion must be exact in pixels because a repair's preview must equal its
 * applied result. Two facts make exactness possible:
 *
 * 1. **Divider conservation.** A maximal chain of same-direction binary splits
 *    over k+1 leaves-in-order contains exactly k dividers, each consuming
 *    `dividerPx` of the extent — wherever the chain nests them. So the
 *    distributable space of the flattened split is exactly
 *    `extent − k·dividerPx`, the labs' `avail`.
 *
 * 2. **Weights from pixels, not ratio products.** Multiplying ratios down the
 *    chain does NOT give each child's share of `avail` (each binary level
 *    subtracts only its own divider before applying its ratio). We therefore
 *    lay the binary tree out first (`layoutBinary`, the exact math SplitPane
 *    renders) and define `w[i] = px[i] / Σ px`, which reproduces the rendered
 *    rectangles to float precision under the uniform-gap n-ary layout.
 *
 * Write-back (`analysisToResizes`) runs the flattening in reverse, in pixel
 * space: a chain step's new ratio is its `a`-subtree's extent (children plus
 * internal dividers) over the distributable pair extent. Provenance for that
 * reversal is carried on each flattened split as `ChainStep[]` — preorder over
 * the consumed binary splits, where `leftCount` says how many flattened
 * children fell under `a`. A chain over m children always contributes m−1
 * steps, which is what lets the reversal split the step list without ids.
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type AnalysisNode = APane | ASplit;

/** A tile: a protocol Leaf. `id` is the placement id — verbs target it. */
export interface APane {
  t: "p";
  id: string;
  viewId: string;
  name: string;
}

/** One binary split consumed while flattening a chain. */
export interface ChainStep {
  splitId: string;
  /** How many flattened children sit under this split's `a` subtree. */
  leftCount: number;
  /** The split's ratio before repair, for change detection on write-back. */
  ratio: number;
}

/** A flattened maximal same-direction chain: n children, n weights, Σw = 1. */
export interface ASplit {
  t: "s";
  /** Id of the topmost binary split of the chain. */
  id: string;
  /** 'h': children side by side (ROW). 'v': stacked (COLUMN). */
  axis: "h" | "v";
  ch: AnalysisNode[];
  w: number[];
  chain: ChainStep[];
}

const isSplit = (n: Node) => n.body.case === "split";
const axisOf = (direction: Direction): "h" | "v" => (direction === Direction.COLUMN ? "v" : "h");

/**
 * Exact mirror of the rendered geometry: each split subtracts ONE divider
 * track and hands `ratio` of the remainder to `a` (SplitPane's grid tracks).
 * Returns a rect per protocol node id, panes and splits alike.
 */
export function layoutBinary(node: Node, rect: Rect, dividerPx: number, out: Map<string, Rect> = new Map()): Map<string, Rect> {
  out.set(node.id, { ...rect });
  if (node.body.case !== "split") return out;
  const { direction, ratio, a, b } = node.body.value;
  if (!a || !b) return out;
  const horiz = axisOf(direction) === "h";
  const avail = (horiz ? rect.w : rect.h) - dividerPx;
  const first = ratio * avail;
  const second = avail - first;
  if (horiz) {
    layoutBinary(a, { x: rect.x, y: rect.y, w: first, h: rect.h }, dividerPx, out);
    layoutBinary(b, { x: rect.x + first + dividerPx, y: rect.y, w: second, h: rect.h }, dividerPx, out);
  } else {
    layoutBinary(a, { x: rect.x, y: rect.y, w: rect.w, h: first }, dividerPx, out);
    layoutBinary(b, { x: rect.x, y: rect.y + first + dividerPx, w: rect.w, h: second }, dividerPx, out);
  }
  return out;
}

export interface ToAnalysisOptions {
  /** placementId → display label; falls back to the view id. */
  labels?: ReadonlyMap<string, string>;
}

/**
 * Convert a protocol tree into the n-ary analysis tree. `rects` must come from
 * `layoutBinary` over the same tree — the weights are pixel shares (see module
 * comment), so geometry is an input of the conversion, not an afterthought.
 */
export function toAnalysis(node: Node, rects: ReadonlyMap<string, Rect>, options: ToAnalysisOptions = {}): AnalysisNode {
  if (node.body.case === "leaf") {
    const viewId = node.body.value.viewId;
    return { t: "p", id: node.id, viewId, name: options.labels?.get(node.id) ?? viewId };
  }
  if (node.body.case !== "split") throw new Error(`unsupported node body: ${node.body.case}`);
  const axis = axisOf(node.body.value.direction);
  const { children, chain } = flattenChain(node, axis);
  const px = children.map((child) => {
    const r = rects.get(child.id);
    if (!r) throw new Error(`no rect for node ${child.id}; pass layoutBinary output for this tree`);
    return axis === "h" ? r.w : r.h;
  });
  const total = px.reduce((s, v) => s + v, 0) || 1;
  return {
    t: "s",
    id: node.id,
    axis,
    ch: children.map((child) => toAnalysis(child, rects, options)),
    w: px.map((v) => v / total),
    chain,
  };
}

/** Preorder flatten of a maximal same-direction chain. */
function flattenChain(node: Node, axis: "h" | "v"): { children: Node[]; chain: ChainStep[] } {
  if (node.body.case !== "split") throw new Error("flattenChain expects a split");
  const { a, b, ratio } = node.body.value;
  if (!a || !b) throw new Error(`split ${node.id} is missing a child`);
  const left = isSplit(a) && a.body.case === "split" && axisOf(a.body.value.direction) === axis
    ? flattenChain(a, axis)
    : { children: [a], chain: [] as ChainStep[] };
  const right = isSplit(b) && b.body.case === "split" && axisOf(b.body.value.direction) === axis
    ? flattenChain(b, axis)
    : { children: [b], chain: [] as ChainStep[] };
  return {
    children: [...left.children, ...right.children],
    chain: [
      { splitId: node.id, leftCount: left.children.length, ratio },
      ...left.chain,
      ...right.chain,
    ],
  };
}

/**
 * The labs' uniform-gap n-ary layout: a split subtracts one divider per
 * boundary and distributes the remainder by weight. For an unmodified
 * analysis tree this reproduces `layoutBinary`'s pane rects exactly
 * (divider conservation + pixel weights — see module comment).
 */
export function layoutAnalysis(node: AnalysisNode, rect: Rect, dividerPx: number, out: Map<string, Rect> = new Map()): Map<string, Rect> {
  out.set(node.id, { ...rect });
  if (node.t === "p") return out;
  const horiz = node.axis === "h";
  const avail = (horiz ? rect.w : rect.h) - dividerPx * (node.ch.length - 1);
  let pos = horiz ? rect.x : rect.y;
  node.ch.forEach((child, i) => {
    const size = (node.w[i] ?? 0) * avail;
    layoutAnalysis(
      child,
      horiz ? { x: pos, y: rect.y, w: size, h: rect.h } : { x: rect.x, y: pos, w: rect.w, h: size },
      dividerPx,
      out,
    );
    pos += size + dividerPx;
  });
  return out;
}

export interface SplitResize {
  splitId: string;
  ratio: number;
}

/** Ratio changes below this are noise, not repairs. */
const RATIO_EPSILON = 1e-6;

/**
 * Convert a (possibly weight-repaired) analysis tree back into the binary
 * splits' ratios, in pixel space, emitting one resize per chain step whose
 * ratio actually moved. The tree's STRUCTURE must be unchanged — structural
 * proposals do not go through this door (design-doc/01 §3.4).
 */
export function analysisToResizes(node: AnalysisNode, rect: Rect, dividerPx: number, out: SplitResize[] = []): SplitResize[] {
  if (node.t === "p") return out;
  const horiz = node.axis === "h";
  const avail = (horiz ? rect.w : rect.h) - dividerPx * (node.ch.length - 1);
  const px = node.w.map((w) => w * avail);
  writeBackChain(node.chain, px, dividerPx, out);
  // Recurse with the repaired child rects, mirroring layoutAnalysis.
  let pos = horiz ? rect.x : rect.y;
  node.ch.forEach((child, i) => {
    const size = px[i] ?? 0;
    const childRect = horiz
      ? { x: pos, y: rect.y, w: size, h: rect.h }
      : { x: rect.x, y: pos, w: rect.w, h: size };
    analysisToResizes(child, childRect, dividerPx, out);
    pos += size + dividerPx;
  });
  return out;
}

function writeBackChain(chain: readonly ChainStep[], px: readonly number[], dividerPx: number, out: SplitResize[]): void {
  if (px.length <= 1) return;
  const head = chain[0];
  if (!head) throw new Error(`chain exhausted with ${px.length} children left`);
  const left = px.slice(0, head.leftCount);
  const right = px.slice(head.leftCount);
  const extentA = sum(left) + (left.length - 1) * dividerPx;
  const extentB = sum(right) + (right.length - 1) * dividerPx;
  const pair = extentA + extentB;
  const ratio = pair > 0 ? extentA / pair : head.ratio;
  if (Math.abs(ratio - head.ratio) > RATIO_EPSILON) out.push({ splitId: head.splitId, ratio });
  // A chain over m children carries exactly m−1 steps, so the tail splits
  // deterministically: the next (leftCount−1) steps belong to the `a` side.
  const leftSteps = left.length - 1;
  writeBackChain(chain.slice(1, 1 + leftSteps), left, dividerPx, out);
  writeBackChain(chain.slice(1 + leftSteps), right, dividerPx, out);
}

const sum = (values: readonly number[]) => values.reduce((s, v) => s + v, 0);

/** Visible tiles in reading (DFS) order. */
export function panesOf(node: AnalysisNode, out: APane[] = []): APane[] {
  if (node.t === "p") out.push(node);
  else node.ch.forEach((child) => panesOf(child, out));
  return out;
}
