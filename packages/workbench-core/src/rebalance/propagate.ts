import { panesOf, layoutAnalysis, type AnalysisNode, type Rect } from "./analysisTree";

/**
 * Minimum-size propagation (PBUI-REBALANCE-1, design-doc/01 §2.3; textbook §3).
 *
 * The workbench's existing `paneRatioBounds` clamp is split-local, and a
 * split-local floor cannot protect tile size because sizes multiply down the
 * tree (three healthy-looking ratios of .2 × .15 × .3 leave a tile at ~1% of
 * the screen). Propagation turns the real constraint — a pixel floor on every
 * rendered tile — into one number per subtree per axis that any ancestor can
 * act on:
 *
 *   pane          needs (minInlinePx, minBlockPx)
 *   'h' split     needs ( Σ childW + dividers ,  max childH )
 *   'v' split     needs ( max childW          ,  Σ childH + dividers )
 *
 * Sum along the split axis, max across it. Gaps are real pixels along the
 * axis only.
 */

export interface MinReq {
  w: number;
  h: number;
}

export interface PropagateConfig {
  minInlinePx: number;
  minBlockPx: number;
  dividerPx: number;
}

/**
 * Bottom-up requirement per subtree, memoised by node id. The memo is only
 * valid for one tree shape — build a fresh one per call site; never cache
 * across mutations.
 */
export function propagate(node: AnalysisNode, cfg: PropagateConfig, memo: Map<string, MinReq> = new Map()): MinReq {
  const hit = memo.get(node.id);
  if (hit) return hit;
  let req: MinReq;
  if (node.t === "p") {
    req = { w: cfg.minInlinePx, h: cfg.minBlockPx };
  } else {
    const children = node.ch.map((child) => propagate(child, cfg, memo));
    const gaps = cfg.dividerPx * (node.ch.length - 1);
    req =
      node.axis === "h"
        ? { w: children.reduce((s, q) => s + q.w, 0) + gaps, h: Math.max(...children.map((q) => q.h)) }
        : { w: Math.max(...children.map((q) => q.w)), h: children.reduce((s, q) => s + q.h, 0) + gaps };
  }
  memo.set(node.id, req);
  return req;
}

export interface Violation {
  id: string;
  name: string;
  /** Pixels short of the width floor (0 when satisfied). */
  dw: number;
  /** Pixels short of the height floor (0 when satisfied). */
  dh: number;
  rect: Rect;
}

/** Half-pixel slop so float dust never reports a violation. */
const SLOP = 0.5;

/** Every visible tile whose rendered rect misses a pixel floor. */
export function violations(root: AnalysisNode, rect: Rect, cfg: PropagateConfig): Violation[] {
  const rects = layoutAnalysis(root, rect, cfg.dividerPx);
  const out: Violation[] = [];
  for (const pane of panesOf(root)) {
    const r = rects.get(pane.id);
    if (!r) continue;
    const dw = cfg.minInlinePx - r.w;
    const dh = cfg.minBlockPx - r.h;
    if (dw > SLOP || dh > SLOP) {
      out.push({ id: pane.id, name: pane.name, dw: Math.max(0, dw), dh: Math.max(0, dh), rect: r });
    }
  }
  return out;
}

export interface Capacity {
  cols: number;
  rows: number;
  /** How many tiles the rect can hold at the configured floors. */
  cap: number;
  panes: number;
  /** More tiles than the screen can physically hold — no layout fixes this. */
  overflow: boolean;
}

export interface Diagnosis {
  violations: Violation[];
  /** What the whole tree requires (root of the propagation). */
  need: MinReq;
  /** `need` fits the rect: some weight assignment can satisfy every tile. */
  fits: boolean;
  capacity: Capacity;
  worstShortfallPx: number;
}

/**
 * DETECT (textbook §3): measurement only, never mutation. Cheap enough to run
 * on every slate build and every modal open.
 */
export function diagnose(root: AnalysisNode, rect: Rect, cfg: PropagateConfig): Diagnosis {
  const need = propagate(root, cfg, new Map());
  const v = violations(root, rect, cfg);
  const cols = Math.max(1, Math.floor((rect.w + cfg.dividerPx) / (cfg.minInlinePx + cfg.dividerPx)));
  const rows = Math.max(1, Math.floor((rect.h + cfg.dividerPx) / (cfg.minBlockPx + cfg.dividerPx)));
  const panes = panesOf(root).length;
  const cap = cols * rows;
  return {
    violations: v,
    need,
    fits: need.w <= rect.w + SLOP && need.h <= rect.h + SLOP,
    capacity: { cols, rows, cap, panes, overflow: panes > cap },
    worstShortfallPx: Math.round(Math.max(0, ...v.map((x) => Math.max(x.dw, x.dh)))),
  };
}
