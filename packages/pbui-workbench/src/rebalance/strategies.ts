import type { ASplit, AnalysisNode } from "./analysisTree";
import { projectLower } from "./projectLower";
import { R0, sum, vec, type TraceLine } from "./trace";

/**
 * Per-split weight strategies (PBUI-REBALANCE-1, design-doc/01 §2.5).
 *
 * Each strategy is a generator: it receives one flattened split, the split's
 * distributable pixels (`availPx`), and each child's propagated pixel lower
 * bound (`lowerPx`), yields trace lines, and RETURNS a new weight vector.
 * The driver (`repairPass.ts`) assigns the result; strategies never touch the
 * tree themselves.
 *
 * Ported from sources/repair-lab-2.html (stratRipple/stratSparse/stratProject/
 * stratBalance) with stacks removed — pbui has no stack node.
 */

export interface StrategyConfig {
  minInlinePx: number;
  minBlockPx: number;
  dividerPx: number;
  hystPx: number;
  donorOrder: "near" | "left" | "slack";
}

export interface RepairContext {
  /** Individual pixel transfers / weight changes, for the trace summary. */
  moves: number;
  /** Splits a strategy actually ran on. */
  visited: number;
  /** A split ran out of donors — an ancestor must supply the rest. */
  infeasible: boolean;
  /** The whole tree cannot fit at these floors; weight repair is best-effort. */
  globalInfeasible: boolean;
  /** The split's cross-axis extent, for aspect-aware strategies. */
  cross: number;
}

export type Strategy = ((
  node: ASplit,
  availPx: number,
  lowerPx: readonly number[],
  cfg: StrategyConfig,
  ctx: RepairContext,
) => Generator<TraceLine, number[]>) & {
  /** Run on healthy splits too (BALANCE); default: only where a deficit exists. */
  always?: boolean;
};

const label = (n: AnalysisNode): string =>
  n.t === "p" ? n.name : `${n.axis === "h" ? "Row" : "Col"}(${n.ch.length})`;

/** Pixel vector → normalized weights (guarding against negatives and zero sums). */
function normPx(px: readonly number[]): number[] {
  const clamped = px.map((x) => Math.max(0, x));
  const s = sum(clamped) || 1;
  return clamped.map((x) => x / s);
}

/**
 * RIPPLE — local sibling borrowing (textbook §4). What a person does by hand:
 * take pixels from the nearest sibling with slack, escalating to farther ones
 * only as donors run dry. Moves the fewest dividers; the default repair.
 */
export const stratRipple: Strategy = function* stratRipple(node, availPx, lowerPx, cfg, ctx) {
  const px = node.w.map((w) => w * availPx);
  const deficits = px
    .map((p, i) => [Math.max(0, (lowerPx[i] ?? 0) - p), i] as const)
    .filter(([d]) => d > 0.5)
    .sort((a, b) => b[0] - a[0])
    .map(([, i]) => i);
  for (const i of deficits) {
    let want = (lowerPx[i] ?? 0) - (px[i] ?? 0);
    if (want <= 0.5) continue;
    yield { c: "grn", t: `  ${label(node.ch[i] as AnalysisNode)} short ${R0(want)}px — borrow from nearest siblings` };
    const donors = px
      .map((p, j) => ({ j, slack: Math.max(0, p - (lowerPx[j] ?? 0)), d: Math.abs(j - i), side: Math.sign(j - i) }))
      .filter((o) => o.j !== i && o.slack > 0.5)
      .sort((a, b) => {
        if (cfg.donorOrder === "slack") return b.slack - a.slack || a.d - b.d;
        if (a.d !== b.d) return a.d - b.d;
        return cfg.donorOrder === "left" ? a.side - b.side : b.side - a.side;
      });
    for (const donor of donors) {
      if (want <= 0.5) break;
      const take = Math.min(want, donor.slack);
      px[donor.j] = (px[donor.j] ?? 0) - take;
      px[i] = (px[i] ?? 0) + take;
      want -= take;
      ctx.moves++;
      yield {
        c: "grn",
        t: `    take ${R0(take)}px from ${label(node.ch[donor.j] as AnalysisNode)} (slack ${R0(donor.slack)}) → ${want > 0.5 ? `still short ${R0(want)}` : "satisfied"}`,
      };
    }
    if (want > 0.5) {
      ctx.infeasible = true;
      yield { c: "red", t: `    no slack left in this split — ${R0(want)}px must come from an ancestor` };
    }
  }
  return normPx(px);
};

/**
 * SPARSE — fewest-donor repair (textbook §6). Prefer ONE donor who can pay in
 * full (nearest such); otherwise take from the largest-slack donors so the
 * count of tiles whose size changes stays low.
 */
export const stratSparse: Strategy = function* stratSparse(node, availPx, lowerPx, _cfg, ctx) {
  const px = node.w.map((w) => w * availPx);
  const deficits = px
    .map((p, i) => [Math.max(0, (lowerPx[i] ?? 0) - p), i] as const)
    .filter(([d]) => d > 0.5)
    .sort((a, b) => b[0] - a[0])
    .map(([, i]) => i);
  for (const i of deficits) {
    let want = (lowerPx[i] ?? 0) - (px[i] ?? 0);
    if (want <= 0.5) continue;
    const candidates = px
      .map((p, j) => ({ j, slack: Math.max(0, p - (lowerPx[j] ?? 0)), d: Math.abs(j - i) }))
      .filter((o) => o.j !== i && o.slack > 0.5);
    const solo = candidates.filter((o) => o.slack >= want - 0.5).sort((a, b) => a.d - b.d)[0];
    if (solo) {
      px[solo.j] = (px[solo.j] ?? 0) - want;
      px[i] = (px[i] ?? 0) + want;
      ctx.moves++;
      yield {
        c: "grn",
        t: `  ${label(node.ch[i] as AnalysisNode)} short ${R0(want)}px → single donor ${label(node.ch[solo.j] as AnalysisNode)} pays all (dist ${solo.d})`,
      };
      continue;
    }
    yield { c: "grn", t: `  ${label(node.ch[i] as AnalysisNode)} short ${R0(want)}px — no single donor, use fewest (largest slack first)` };
    candidates.sort((a, b) => b.slack - a.slack || a.d - b.d);
    for (const donor of candidates) {
      if (want <= 0.5) break;
      const take = Math.min(want, donor.slack);
      px[donor.j] = (px[donor.j] ?? 0) - take;
      px[i] = (px[i] ?? 0) + take;
      want -= take;
      ctx.moves++;
      yield { c: "grn", t: `    ${R0(take)}px from ${label(node.ch[donor.j] as AnalysisNode)}` };
    }
    if (want > 0.5) {
      ctx.infeasible = true;
      yield { c: "red", t: `    ${R0(want)}px still missing — escalate to ancestor` };
    }
  }
  return normPx(px);
};

/**
 * PROJECT — constrained L2 projection (textbook §5): the feasible weight
 * vector closest to the current one in Euclidean distance. Deterministic and
 * order-independent; spreads a correction over every free sibling, which is
 * optimal for L2 and not for perception — that trade is the reason SPARSE
 * exists.
 */
export const stratProject: Strategy = function* stratProject(node, availPx, lowerPx, _cfg, ctx) {
  const floors = lowerPx.map((x) => x / availPx);
  const before = node.w.slice();
  const after = projectLower(before, floors);
  const changed = after.filter((x, i) => Math.abs(x - (before[i] ?? 0)) > 1e-4).length;
  ctx.moves += changed;
  yield { c: "grn", t: `  min ‖w′−w‖²  s.t. Σw′=1, w′≥l   l=${vec(floors)}` };
  yield { c: "grn", t: `  ${vec(before)} → ${vec(after)}   (${changed}/${before.length} weights changed)` };
  return after;
};

/**
 * BALANCE — every split to 1/n (textbook §8). A legitimate USER COMMAND and
 * the control the other proposals are measured against; never an automatic
 * repair. Runs on healthy splits too (`always`), and projects afterwards when
 * 1/n itself violates a floor.
 */
export const stratBalance: Strategy = function* stratBalance(node, availPx, lowerPx, _cfg, ctx) {
  const n = node.ch.length;
  const equal = Array(n).fill(1 / n) as number[];
  ctx.moves += n - 1;
  yield { c: "grn", t: `  ${label(node)} → sᵢ=1/${n} regardless of need` };
  const floors = lowerPx.map((x) => x / availPx);
  if (equal.some((x, i) => x < (floors[i] ?? 0) - 1e-9)) {
    const projected = projectLower(equal, floors);
    yield { c: "grn", t: `  1/n violates minimums → project → ${vec(projected)}` };
    return projected;
  }
  return equal;
};
stratBalance.always = true;
