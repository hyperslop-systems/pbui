import { layoutAnalysis, panesOf, type AnalysisNode, type Rect } from "./analysisTree";
import { violations, type PropagateConfig } from "./propagate";
import { R0, sum } from "./trace";

/**
 * Measuring and classifying layout change (textbook §1.8–1.9; design-doc/01
 * §2.7). Disruption gets four numbers because no single scalar distinguishes
 * "everything drifted a little" from "one window teleported"; each result is
 * then classified into an invasiveness TIER, measured from the result rather
 * than claimed by the algorithm that produced it — an algorithm's ambition is
 * not the same as its effect.
 */

export interface LayoutStats {
  /** Visible tiles below a pixel floor. */
  viol: number;
  /** Largest single shortfall in px. */
  worst: number;
  /** Tiles whose displacement exceeds 1px. */
  moved: number;
  panes: number;
  /** Σ over tiles of |Δcx|+|Δcy|+|Δw|+|Δh|, identity-matched. */
  disp: number;
  /** The largest single tile displacement. */
  dispMax: number;
  /** Worst aspect ratio as max(w/h, h/w) ≥ 1. */
  worstAspect: number;
}

export function layoutStats(
  root: AnalysisNode,
  rect: Rect,
  cfg: PropagateConfig,
  baseRects: ReadonlyMap<string, Rect> | null,
): LayoutStats {
  const rects = layoutAnalysis(root, rect, cfg.dividerPx);
  const panes = panesOf(root);
  let moved = 0;
  let disp = 0;
  let dispMax = 0;
  let worstAspect = 1;
  for (const pane of panes) {
    const r = rects.get(pane.id);
    if (!r) continue;
    worstAspect = Math.max(worstAspect, r.w / Math.max(1, r.h), r.h / Math.max(1, r.w));
    const b = baseRects?.get(pane.id);
    if (b) {
      const d =
        Math.abs(r.x + r.w / 2 - (b.x + b.w / 2)) +
        Math.abs(r.y + r.h / 2 - (b.y + b.h / 2)) +
        Math.abs(r.w - b.w) +
        Math.abs(r.h - b.h);
      disp += d;
      dispMax = Math.max(dispMax, d);
      if (d > 1) moved++;
    }
  }
  const v = violations(root, rect, cfg);
  return {
    viol: v.length,
    worst: R0(Math.max(0, ...v.map((x) => Math.max(x.dw, x.dh)))),
    moved,
    panes: panes.length,
    disp: R0(disp),
    dispMax: R0(dispMax),
    worstAspect,
  };
}

/** Structural signature; `ordered: false` sorts children so reorders compare equal. */
export function sig(node: AnalysisNode, ordered: boolean): string {
  if (node.t === "p") return node.id;
  const kids = node.ch.map((c) => sig(c, ordered));
  return `${node.axis}(${(ordered ? kids : kids.slice().sort()).join(",")})`;
}

/**
 * How many split boundaries moved, comparing cumulative weight sums between
 * two same-shaped trees. Tolerance 0.004 ≈ what a user can perceive. Only
 * meaningful when `sig(a, true) === sig(b, true)`.
 */
export function dividerDiff(a: AnalysisNode, b: AnalysisNode): number {
  let count = 0;
  const walk = (x: AnalysisNode, y: AnalysisNode): void => {
    if (x.t !== "s" || y.t !== "s" || x.ch.length !== y.ch.length) return;
    for (let i = 0; i < x.ch.length - 1; i++) {
      const cx = sum(x.w.slice(0, i + 1));
      const cy = sum(y.w.slice(0, i + 1));
      if (Math.abs(cx - cy) > 0.004) count++;
    }
    x.ch.forEach((child, i) => walk(child, y.ch[i] as AnalysisNode));
  };
  walk(a, b);
  return count;
}

export type Tier = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const TIERS: Record<Tier, { name: string; chip: string }> = {
  0: { name: "no change", chip: "—" },
  1: { name: "a divider", chip: "W1" },
  2: { name: "many dividers", chip: "W+" },
  3: { name: "tiles reordered", chip: "ORD" },
  4: { name: "structure changed", chip: "STR" },
  5: { name: "layout rebuilt", chip: "NEW" },
  6: { name: "tiles moved to another workspace", chip: "OVF" },
};

export type GeneratorKind = "weights" | "topology" | "rebuild" | "overflow" | "none";

export interface Classification {
  tier: Tier;
  /** Divider count for tiers 1–2; null where undefined. */
  div: number | null;
}

/** Tier is measured from before/after, never declared (textbook §1.9). */
export function classify(before: AnalysisNode, after: AnalysisNode, kind: GeneratorKind, stats: LayoutStats): Classification {
  const visibleBefore = panesOf(before).map((p) => p.id).sort().join(",");
  const visibleAfter = panesOf(after).map((p) => p.id).sort().join(",");
  if (visibleBefore !== visibleAfter) return { tier: 6, div: null };
  if (stats.moved === 0) return { tier: 0, div: 0 };
  if (sig(before, true) === sig(after, true)) {
    const d = dividerDiff(before, after);
    return { tier: d <= 2 ? 1 : 2, div: d };
  }
  if (sig(before, false) === sig(after, false)) return { tier: 3, div: null };
  return { tier: kind === "rebuild" ? 5 : 4, div: null };
}
