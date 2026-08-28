import { create } from "@bufbuild/protobuf";
import { Direction, LeafSchema, NodeSchema, type Node } from "@hyperslop-systems/workbench-protocol";
import { newId } from "@hyperslop-systems/workbench-protocol/client";
import { layoutAnalysis, panesOf, type AnalysisNode, type APane, type ASplit, type Rect } from "./analysisTree";
import { violations } from "./propagate";
import { repairPass, newRepairContext } from "./repairPass";
import { stratProject, type RepairContext, type StrategyConfig } from "./strategies";
import { R0, sum, type TraceLine } from "./trace";

/**
 * Structural repair (PBUI-REBALANCE-1, design-doc/01 §2.6; textbook §9–10).
 * When `req(root)` exceeds the workspace, no weight assignment can help — the
 * TREE has to change. Two engines:
 *
 * - RESHAPE: greedy hill-climb over local tree mutations (transpose, rotate,
 *   reverse, adjacent swap, and REGROUP — wrapping k consecutive children in
 *   a perpendicular sub-split, the move that turns an impossible strip into a
 *   feasible grid). Every candidate is SETTLED with a weight repair before
 *   scoring, so topologies are compared fairly.
 *
 * - REBUILD: generate a fresh tree from a target shape and seat the existing
 *   tiles into its slots by minimum-cost assignment (Hungarian over centre
 *   distance), so windows land near where they were even though every
 *   rectangle changed. Generators do not consult constraints — the slate
 *   measures the result and can grey "makes it worse".
 *
 * Results are emitted back to the protocol as a fresh BINARY tree
 * (`emitBinary`): leaf placements keep their ids and views (identity is what
 * tiers and thumbnails key on), splits are minted fresh, and each chain
 * ratio is computed in pixel space, clamped to the server's [0.05, 0.95]
 * validation band.
 */

export interface StructuralConfig extends StrategyConfig {
  targetAspect: number;
}

/** The lab's scoring weights (repair-lab-2 cfg); empirically tuned there. */
const SCORE = { viol: 10, deficitPer100: 1, aspect: 0.6, movePer1000: 1 };
const MASTER_RATIO = 0.6;
const DWINDLE_RATIO = 0.62;

let analysisId = 0;
const freshSplitId = () => `as-${++analysisId}`;

const other = (axis: "h" | "v"): "h" | "v" => (axis === "h" ? "v" : "h");
const eqw = (n: number) => Array<number>(n).fill(1 / n);

const aSplit = (axis: "h" | "v", ch: AnalysisNode[], w: number[]): ASplit => ({
  t: "s",
  id: freshSplitId(),
  axis,
  ch,
  w,
  chain: [],
});

/** Flatten same-axis nesting, collapse single-child splits, renormalize. */
export function normalizeAnalysis(node: AnalysisNode): AnalysisNode {
  if (node.t === "p") return node;
  const children = node.ch.map(normalizeAnalysis);
  if (children.length === 1) return children[0] as AnalysisNode;
  const ch: AnalysisNode[] = [];
  const w: number[] = [];
  children.forEach((child, i) => {
    const weight = node.w[i] ?? 0;
    if (child.t === "s" && child.axis === node.axis) {
      child.ch.forEach((grand, j) => {
        ch.push(grand);
        w.push(weight * (child.w[j] ?? 0));
      });
    } else {
      ch.push(child);
      w.push(weight);
    }
  });
  const total = sum(w) || 1;
  return { ...node, ch, w: w.map((x) => x / total), chain: [] };
}

// --- mutation search --------------------------------------------------------

export type StructuralMutation =
  | { k: "transpose"; id: string; d: string }
  | { k: "rotate"; id: string; d: string }
  | { k: "reverse"; id: string; d: string }
  | { k: "swap"; id: string; i: number; d: string }
  | { k: "regroup"; id: string; s: number; run: number; d: string };

export function structuralMutationsOf(root: AnalysisNode): StructuralMutation[] {
  const out: StructuralMutation[] = [];
  const walk = (node: AnalysisNode): void => {
    if (node.t !== "s") return;
    out.push({ k: "transpose", id: node.id, d: `transpose ${node.axis === "h" ? "Row" : "Col"}(${node.ch.length})` });
    if (node.ch.length > 2) {
      out.push({ k: "rotate", id: node.id, d: "rotate children" });
      out.push({ k: "reverse", id: node.id, d: "reverse child order" });
      for (let run = 2; run <= Math.min(4, node.ch.length - 1); run++) {
        for (let s = 0; s + run <= node.ch.length; s += run) {
          out.push({ k: "regroup", id: node.id, s, run, d: `regroup ${run} from slot ${s}` });
        }
      }
    }
    for (let i = 0; i + 1 < node.ch.length; i++) out.push({ k: "swap", id: node.id, i, d: `swap children ${i}/${i + 1}` });
    node.ch.forEach(walk);
  };
  walk(root);
  return out;
}

function findSplit(root: AnalysisNode, id: string): ASplit | null {
  if (root.t === "s") {
    if (root.id === id) return root;
    for (const child of root.ch) {
      const hit = findSplit(child, id);
      if (hit) return hit;
    }
  }
  return null;
}

/** Apply one mutation to a CLONE of the tree; returns the normalized result. */
export function applyStructuralMutation(root: AnalysisNode, m: StructuralMutation): AnalysisNode | null {
  const tree = structuredClone(root);
  const node = findSplit(tree, m.id);
  if (!node) return null;
  if (m.k === "transpose") node.axis = other(node.axis);
  else if (m.k === "rotate") {
    node.ch.unshift(node.ch.pop() as AnalysisNode);
    node.w.unshift(node.w.pop() as number);
  } else if (m.k === "reverse") {
    node.ch.reverse();
    node.w.reverse();
  } else if (m.k === "swap") {
    const { i } = m;
    [node.ch[i], node.ch[i + 1]] = [node.ch[i + 1] as AnalysisNode, node.ch[i] as AnalysisNode];
    [node.w[i], node.w[i + 1]] = [node.w[i + 1] as number, node.w[i] as number];
  } else {
    const kids = node.ch.splice(m.s, m.run);
    const weights = node.w.splice(m.s, m.run);
    const mass = sum(weights) || 1;
    node.ch.splice(m.s, 0, aSplit(other(node.axis), kids, weights.map((x) => x / mass)));
    node.w.splice(m.s, 0, mass);
  }
  return normalizeAnalysis(tree);
}

// --- scoring ----------------------------------------------------------------

export interface TreeScore {
  viol: number;
  deficit: number;
  aspect: number;
  move: number;
  score: number;
}

export function scoreTree(
  root: AnalysisNode,
  rect: Rect,
  cfg: StructuralConfig,
  baseRects: ReadonlyMap<string, Rect>,
): TreeScore {
  const rects = layoutAnalysis(root, rect, cfg.dividerPx);
  const v = violations(root, rect, cfg);
  let deficit = 0;
  let aspect = 0;
  let move = 0;
  for (const pane of panesOf(root)) {
    const r = rects.get(pane.id);
    if (!r) continue;
    deficit += Math.max(0, cfg.minInlinePx - r.w) + Math.max(0, cfg.minBlockPx - r.h);
    aspect += Math.abs(Math.log(Math.max(1, r.w) / Math.max(1, r.h)) - Math.log(cfg.targetAspect)) ** 2;
    const b = baseRects.get(pane.id);
    if (b) move += Math.abs(r.x - b.x) + Math.abs(r.y - b.y) + Math.abs(r.w - b.w) + Math.abs(r.h - b.h);
  }
  return {
    viol: v.length,
    deficit,
    aspect,
    move,
    score:
      SCORE.viol * v.length +
      (SCORE.deficitPer100 * deficit) / 100 +
      SCORE.aspect * aspect +
      (SCORE.movePer1000 * move) / 1000,
  };
}

/** Settle a candidate with PROJECT (silently) so topologies compare fairly. */
function settle(tree: AnalysisNode, rect: Rect, cfg: StructuralConfig): void {
  const ctx = newRepairContext();
  for (const _line of repairPass(tree, rect, cfg, stratProject, ctx)) {
    // discard the trace — settling is bookkeeping, not narration
  }
}

// --- RESHAPE ----------------------------------------------------------------

export interface ReshapeOptions {
  maxMoves: number;
  minGain: number;
}

/** Greedy hill-climb; leaves the best tree on `ctx.tree`. */
export function* algoReshape(
  root: AnalysisNode,
  rect: Rect,
  cfg: StructuralConfig,
  ctx: RepairContext & { tree?: AnalysisNode; struct?: number },
  options: ReshapeOptions = { maxMoves: 4, minGain: 0.05 },
): Generator<TraceLine, void> {
  const baseRects = layoutAnalysis(root, rect, cfg.dividerPx);
  let current = structuredClone(root);
  settle(current, rect, cfg);
  let currentScore = scoreTree(current, rect, cfg, baseRects);
  ctx.tree = current;
  yield { c: "blu", t: `settle first with project → ${currentScore.viol} violations, score ${currentScore.score.toFixed(2)}` };
  for (let round = 0; round < options.maxMoves; round++) {
    const candidates = structuralMutationsOf(current);
    let best: { m: StructuralMutation; tree: AnalysisNode; score: TreeScore } | null = null;
    for (const m of candidates) {
      const tree = applyStructuralMutation(current, m);
      if (!tree) continue;
      settle(tree, rect, cfg);
      const score = scoreTree(tree, rect, cfg, baseRects);
      if (!best || score.score < best.score.score) best = { m, tree, score };
    }
    if (!best) break;
    yield {
      c: "red",
      t: `round ${round + 1}: ${candidates.length} candidates, best is ${best.m.d} → ${best.score.score.toFixed(2)}`,
    };
    if (best.score.score > currentScore.score - options.minGain) {
      yield { c: "red", t: `gain below ${options.minGain} — stop` };
      break;
    }
    current = best.tree;
    currentScore = best.score;
    ctx.tree = current;
    ctx.struct = (ctx.struct ?? 0) + 1;
    yield { c: "red", t: `  accept ${best.m.k}: ${best.score.viol} violations left` };
  }
  ctx.tree = current;
}

// --- REBUILD ----------------------------------------------------------------

export type RebuildTarget = "grid" | "master" | "columns" | "rows" | "bsp" | "dwindle";

/** Layout generators over ordered pane units (textbook §10, lab TARGETS). */
export const REBUILD_TARGETS: Record<RebuildTarget, (units: AnalysisNode[]) => AnalysisNode> = {
  grid(units) {
    const n = units.length;
    const cols = Math.ceil(Math.sqrt(n));
    const rows: AnalysisNode[] = [];
    for (let i = 0; i < n; i += cols) {
      const slice = units.slice(i, i + cols);
      rows.push(slice.length === 1 ? (slice[0] as AnalysisNode) : aSplit("h", slice, eqw(slice.length)));
    }
    return rows.length === 1 ? (rows[0] as AnalysisNode) : aSplit("v", rows, eqw(rows.length));
  },
  columns: (units) => (units.length === 1 ? (units[0] as AnalysisNode) : aSplit("h", units, eqw(units.length))),
  rows: (units) => (units.length === 1 ? (units[0] as AnalysisNode) : aSplit("v", units, eqw(units.length))),
  master(units) {
    if (units.length === 1) return units[0] as AnalysisNode;
    const rest = units.slice(1);
    const column = rest.length === 1 ? (rest[0] as AnalysisNode) : aSplit("v", rest, eqw(rest.length));
    return aSplit("h", [units[0] as AnalysisNode, column], [MASTER_RATIO, 1 - MASTER_RATIO]);
  },
  bsp(units) {
    const build = (slice: AnalysisNode[], axis: "h" | "v"): AnalysisNode => {
      if (slice.length === 1) return slice[0] as AnalysisNode;
      const mid = Math.ceil(slice.length / 2);
      return aSplit(axis, [build(slice.slice(0, mid), other(axis)), build(slice.slice(mid), other(axis))], [0.5, 0.5]);
    };
    return build(units, "h");
  },
  dwindle(units) {
    const build = (slice: AnalysisNode[], axis: "h" | "v"): AnalysisNode => {
      if (slice.length === 1) return slice[0] as AnalysisNode;
      return aSplit(axis, [slice[0] as AnalysisNode, build(slice.slice(1), other(axis))], [DWINDLE_RATIO, 1 - DWINDLE_RATIO]);
    };
    return build(units, "h");
  },
};

/** O(n³) Hungarian assignment (shortest augmenting path with potentials). */
export function hungarian(cost: number[][]): number[] {
  const n = cost.length;
  const m = cost[0]?.length ?? 0;
  const INF = 1e18;
  const u = Array<number>(n + 1).fill(0);
  const v = Array<number>(m + 1).fill(0);
  const p = Array<number>(m + 1).fill(0);
  const way = Array<number>(m + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = Array<number>(m + 1).fill(INF);
    const used = Array<boolean>(m + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0] as number;
      let delta = INF;
      let j1 = -1;
      for (let j = 1; j <= m; j++) {
        if (used[j]) continue;
        const cur = (cost[i0 - 1]?.[j - 1] ?? INF) - (u[i0] as number) - (v[j] as number);
        if (cur < (minv[j] as number)) {
          minv[j] = cur;
          way[j] = j0;
        }
        if ((minv[j] as number) < delta) {
          delta = minv[j] as number;
          j1 = j;
        }
      }
      for (let j = 0; j <= m; j++) {
        if (used[j]) {
          u[p[j] as number] = (u[p[j] as number] as number) + delta;
          v[j] = (v[j] as number) - delta;
        } else {
          minv[j] = (minv[j] as number) - delta;
        }
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0] as number;
      p[j0] = p[j1] as number;
      j0 = j1;
    } while (j0);
  }
  const answer = Array<number>(n).fill(-1);
  for (let j = 1; j <= m; j++) if (p[j]) answer[(p[j] as number) - 1] = j - 1;
  return answer;
}

const SIZE_COST = 0.25;

/** Regenerate as `target`, seating panes by minimum-cost assignment. */
export function* algoRebuild(
  root: AnalysisNode,
  rect: Rect,
  cfg: StructuralConfig,
  ctx: RepairContext & { tree?: AnalysisNode; struct?: number },
  target: RebuildTarget,
): Generator<TraceLine, void> {
  const before = layoutAnalysis(root, rect, cfg.dividerPx);
  const panes = panesOf(root);
  const n = panes.length;
  ctx.struct = (ctx.struct ?? 0) + 1;
  yield { c: "red", t: `REGENERATE as ${target.toUpperCase()} — the current topology is discarded` };
  if (n === 1) {
    ctx.tree = structuredClone(root);
    return;
  }
  // Slots are placeholder panes; the assignment decides which tile sits where.
  const slots: APane[] = panes.map((_, i) => ({ t: "p", id: `slot-${i}`, viewId: "", name: `slot ${i}` }));
  const fresh = REBUILD_TARGETS[target](slots.slice());
  const slotRects = layoutAnalysis(fresh, rect, cfg.dividerPx);
  const cost: number[][] = panes.map((pane) => {
    const a = before.get(pane.id) as Rect;
    return slots.map((slot) => {
      const b = slotRects.get(slot.id) as Rect;
      const centre = Math.hypot(a.x + a.w / 2 - (b.x + b.w / 2), a.y + a.h / 2 - (b.y + b.h / 2));
      return centre + SIZE_COST * (Math.abs(a.w - b.w) + Math.abs(a.h - b.h));
    });
  });
  const assignment = hungarian(cost);
  const total = assignment.reduce((s, j, i) => s + (cost[i]?.[j] ?? 0), 0);
  const naive = panes.reduce((s, _, i) => s + (cost[i]?.[i] ?? 0), 0);
  const saved = naive > 0.5 ? R0(100 - (100 * total) / naive) : 0;
  yield { c: "red", t: `min-cost assignment over ${n}×${n}: Σcost ${R0(total)}px vs ${R0(naive)}px in DFS order (−${saved}%)` };
  for (let i = 0; i < n; i++) {
    yield { c: "red", t: `  ${panes[i]?.name} → slot ${assignment[i]}  (${R0(cost[i]?.[assignment[i] as number] ?? 0)}px)` };
  }
  const paneBySlot = new Map<string, APane>();
  assignment.forEach((slot, i) => paneBySlot.set(`slot-${slot}`, panes[i] as APane));
  const seat = (node: AnalysisNode): AnalysisNode =>
    node.t === "p" ? (paneBySlot.get(node.id) ?? node) : { ...node, ch: node.ch.map(seat) };
  const seated = normalizeAnalysis(seat(fresh));
  settle(seated, rect, cfg);
  ctx.tree = seated;
}

// --- emission back to the protocol ------------------------------------------

/** The server's Validate rejects ratios outside this band (validate.go). */
const RATIO_MIN = 0.05;
const RATIO_MAX = 0.95;

/**
 * Emit an analysis tree as a fresh protocol tree. Leaf placements keep their
 * ids and views; splits are minted. Each n-ary split becomes a right-leaning
 * chain whose ratios are computed in pixel space against each level's own
 * remaining extent, so the rendered geometry equals `layoutAnalysis` of the
 * input (up to the [0.05, 0.95] clamp).
 */
export function emitBinary(node: AnalysisNode, rect: Rect, dividerPx: number): Node {
  if (node.t === "p") {
    return create(NodeSchema, {
      id: node.id,
      body: { case: "leaf", value: create(LeafSchema, { viewId: node.viewId }) },
    });
  }
  const horiz = node.axis === "h";
  const avail = (horiz ? rect.w : rect.h) - dividerPx * (node.ch.length - 1);
  const px = node.w.map((w) => w * avail);
  const childRects: Rect[] = [];
  let pos = horiz ? rect.x : rect.y;
  node.ch.forEach((_, i) => {
    const size = px[i] ?? 0;
    childRects.push(horiz ? { x: pos, y: rect.y, w: size, h: rect.h } : { x: rect.x, y: pos, w: rect.w, h: size });
    pos += size + dividerPx;
  });
  const direction = horiz ? Direction.ROW : Direction.COLUMN;
  const build = (index: number, extent: number): Node => {
    const child = emitBinary(node.ch[index] as AnalysisNode, childRects[index] as Rect, dividerPx);
    if (index === node.ch.length - 1) return child;
    const pair = extent - dividerPx;
    const raw = pair > 0 ? (px[index] as number) / pair : 0.5;
    const ratio = Math.min(RATIO_MAX, Math.max(RATIO_MIN, raw));
    const rest = build(index + 1, extent - (px[index] as number) - dividerPx);
    return create(NodeSchema, {
      id: newId("n"),
      body: { case: "split", value: { direction, ratio, a: child, b: rest } },
    });
  };
  return build(0, horiz ? rect.w : rect.h);
}
