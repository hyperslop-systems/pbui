import { Direction, type Node } from "@hyperslop-systems/workbench-protocol";
import { leafNode, splitNode } from "@hyperslop-systems/workbench-protocol/client";

/**
 * Tree builders for rebalance tests: the textbook's reference layouts
 * (sources/tiling-repair-textbook.md §2) expressed as protocol trees, plus a
 * seeded random-tree generator for property tests.
 *
 * The textbook's reference configuration, which its worked numbers assume:
 * screen 1072×656 (usable), minW 190, minH 130, gap 8. pbui's divider plays
 * the gap's role, so fixtures pass dividerPx = 8 to match the book.
 */
export const BOOK = { rect: { x: 0, y: 0, w: 1072, h: 656 }, minW: 190, minH: 130, gap: 8 };

export function pane(name: string): Node {
  const node = leafNode(`view-${name}`);
  return { ...node, id: `p-${name}` };
}

export function row(a: Node, b: Node, ratio: number): Node {
  return splitNode(Direction.ROW, a, b, ratio);
}

export function col(a: Node, b: Node, ratio: number): Node {
  return splitNode(Direction.COLUMN, a, b, ratio);
}

/**
 * A right-leaning same-direction chain whose MASS ratios follow `weights`
 * (ratio at each step = head weight over remaining mass). Note: mass ratios
 * are not pixel shares once dividers nest — which is exactly what the adapter
 * exists to handle; fixtures only rely on the chain SHAPE, not equal pixels.
 */
export function chain(direction: Direction, nodes: Node[], weights?: number[]): Node {
  if (nodes.length === 0) throw new Error("chain needs nodes");
  const w = weights ?? nodes.map(() => 1);
  const rec = (from: number): Node => {
    if (from === nodes.length - 1) return nodes[from] as Node;
    const rest = w.slice(from).reduce((s, v) => s + v, 0);
    return splitNode(direction, nodes[from] as Node, rec(from + 1), (w[from] as number) / rest);
  };
  return rec(0);
}

/** Textbook COMPOUND (§2.3): no same-axis nesting, damage three levels deep. */
export function compound(): Node {
  return row(pane("A"), col(pane("B"), row(pane("C"), pane("D"), 0.7), 0.85), 0.8);
}

/** Textbook SKINNY COL (§2.4): Row[BIG, Col of 6] — the column cannot fit. */
export function skinnyCol(): Node {
  const panes = [1, 2, 3, 4, 5, 6].map((i) => pane(`s${i}`));
  return row(pane("BIG"), chain(Direction.COLUMN, panes), 0.74);
}

/** Textbook WIDE ROW 9 (§2.4): nine equal columns on one axis. */
export function wideRow9(): Node {
  return chain(Direction.ROW, [1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => pane(`w${i}`)));
}

/** Textbook FOUR DONORS (§2.2): 30/30/30/10 — one starved pane, three donors. */
export function fourDonors(): Node {
  return chain(Direction.ROW, ["A", "B", "C", "D"].map(pane), [0.3, 0.3, 0.3, 0.1]);
}

/** Textbook SLIVER (§2.2): one hog, two unusable slivers. */
export function sliver(): Node {
  return chain(Direction.ROW, ["A", "B", "C"].map(pane), [0.9, 0.05, 0.05]);
}

/** Textbook HEALTHY control (§2.1), minus the stack pbui does not have. */
export function healthy(): Node {
  return chain(
    Direction.ROW,
    [pane("MAIL"), pane("CHAT"), col(pane("DIFF"), pane("LOG"), 0.55)],
    [0.4, 0.3, 0.3],
  );
}

/** Deterministic LCG so property tests are reproducible. */
export function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** A random binary tree over `n` panes with skewed ratios and mixed axes. */
export function randomTree(n: number, rand: () => number): Node {
  let next = 0;
  const build = (count: number, direction: Direction): Node => {
    if (count === 1) return pane(`r${next++}`);
    const left = 1 + Math.floor(rand() * (count - 1));
    const child = rand() < 0.5 ? direction : other(direction);
    const ratio = 0.15 + rand() * 0.7;
    return splitNode(direction, build(left, flip(child, rand)), build(count - left, flip(child, rand)), ratio);
  };
  return build(n, rand() < 0.5 ? Direction.ROW : Direction.COLUMN);
}

const other = (d: Direction) => (d === Direction.ROW ? Direction.COLUMN : Direction.ROW);
const flip = (d: Direction, rand: () => number) => (rand() < 0.4 ? other(d) : d);
