import type { AnalysisNode, Rect } from "./analysisTree";
import { propagate, type MinReq } from "./propagate";
import { R0, type TraceLine } from "./trace";
import type { RepairContext, Strategy, StrategyConfig } from "./strategies";

/**
 * The repair driver (textbook §1.6; design-doc/01 §2.4): bottom-up
 * propagation, then ONE top-down pass. Propagation already crossed the axes —
 * a Row reports the max of its children's heights, which its parent Col
 * satisfies as an ordinary along-axis requirement before recursing — so a
 * single pass fixes both axes with no fixpoint iteration. Children are laid
 * out AFTER the parent's weights are corrected, so every level sees fresh
 * rectangles.
 *
 * Hysteresis lives only in the trigger (`deficit > 0.5 + hystPx`): repair
 * fires late but always repairs to the full requirement, which is what stops
 * a layout re-repairing itself on every one-pixel resize.
 *
 * MUTATES the tree it is given — callers pass a clone (`structuredClone` of
 * the analysis tree; it is plain data).
 */
export function* repairPass(
  root: AnalysisNode,
  rect: Rect,
  cfg: StrategyConfig,
  strategy: Strategy,
  ctx: RepairContext,
): Generator<TraceLine, void> {
  const memo = new Map<string, MinReq>();
  const need = propagate(root, cfg, memo);
  yield {
    c: "blu",
    t: `propagate minimums bottom-up: tree needs ${R0(need.w)}×${R0(need.h)}px, workspace ${R0(rect.w)}×${R0(rect.h)}px`,
  };
  if (need.w > rect.w + 0.5 || need.h > rect.h + 0.5) {
    ctx.globalInfeasible = true;
    yield { c: "red", t: "GLOBALLY INFEASIBLE — no weight assignment can satisfy every tile. Best effort follows." };
  }
  yield* recurse(root, rect, 0);

  function* recurse(node: AnalysisNode, r: Rect, depth: number): Generator<TraceLine, void> {
    if (node.t === "p") return;
    const horiz = node.axis === "h";
    const avail = (horiz ? r.w : r.h) - cfg.dividerPx * (node.ch.length - 1);
    const lower = node.ch.map((child) => {
      const req = memo.get(child.id);
      return Math.min(horiz ? (req?.w ?? 0) : (req?.h ?? 0), avail);
    });
    const current = node.w.map((w) => w * avail);
    const deficits = current
      .map((p, i) => (lower[i] ?? 0) - p)
      .filter((d) => d > 0.5 + cfg.hystPx);
    if (deficits.length > 0 || strategy.always) {
      if (deficits.length > 0) {
        yield {
          c: "blu",
          t: `${"· ".repeat(depth)}${horiz ? "Row" : "Col"}(${node.ch.length}) ${horiz ? "↔" : "↕"}${R0(avail)}px — ${deficits.length} child(ren) under minimum`,
        };
      }
      ctx.cross = horiz ? r.h : r.w;
      ctx.visited++;
      node.w = yield* strategy(node, avail, lower, cfg, ctx);
    }
    let pos = horiz ? r.x : r.y;
    for (let i = 0; i < node.ch.length; i++) {
      const size = (node.w[i] ?? 0) * avail;
      const childRect = horiz
        ? { x: pos, y: r.y, w: size, h: r.h }
        : { x: r.x, y: pos, w: r.w, h: size };
      pos += size + cfg.dividerPx;
      yield* recurse(node.ch[i] as AnalysisNode, childRect, depth + 1);
    }
  }
}

export function newRepairContext(): RepairContext {
  return { moves: 0, visited: 0, infeasible: false, globalInfeasible: false, cross: 0 };
}
