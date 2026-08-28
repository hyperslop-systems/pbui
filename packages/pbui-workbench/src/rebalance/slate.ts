import type { Node } from "@hyperslop-systems/workbench-protocol";
import type { WorkbenchVerb } from "../verbs";
import {
  analysisToResizes,
  layoutAnalysis,
  layoutBinary,
  panesOf,
  toAnalysis,
  type AnalysisNode,
  type Rect,
} from "./analysisTree";
import type { RebalanceConfig } from "./config";
import { classify, layoutStats, TIERS, type GeneratorKind, type LayoutStats, type Tier } from "./measure";
import { diagnose, type Diagnosis, type PropagateConfig } from "./propagate";
import { newRepairContext, repairPass } from "./repairPass";
import { stratBalance, stratProject, stratRipple, stratSparse, type RepairContext, type Strategy, type StrategyConfig } from "./strategies";
import { algoRebuild, algoReshape, emitBinary, type RebuildTarget, type StructuralConfig } from "./structural";
import type { TraceLine } from "./trace";

/**
 * The proposal slate (PBUI-REBALANCE-1, design-doc/01 §2.8, §4.2): run every
 * enabled generator against a clone of the workspace's analysis tree, measure
 * each result, classify its invasiveness from the result, merge candidates
 * that land on identical geometry, gate by policy (visible but greyed, with
 * the reason), and mark one recommendation. The layout is never repaired
 * behind the user's back — the slate proposes; accepting is the only door to
 * a mutation, and it goes through the workbench's plan/applyPlan.
 */

export interface RebalanceInput {
  /** The active workspace's placement tree. */
  tree: Node;
  /** The Surface's content box for that workspace. */
  rect: Rect;
  dividerPx: number;
  /** placementId → tile label, for traces and thumbnails. */
  labels: ReadonlyMap<string, string>;
}

export type ProposalApply =
  | { kind: "resize-batch"; verbs: WorkbenchVerb[] }
  | { kind: "set-tree"; tree: Node }
  | { kind: "none" };

export interface Proposal {
  id: string;
  label: string;
  note: string;
  /** Generators merged into this card by identical geometry; first is primary. */
  agrees: string[];
  tier: Tier;
  div: number | null;
  stats: LayoutStats;
  /** Proposed geometry per pane id, for thumbnails. */
  rects: ReadonlyMap<string, Rect>;
  /** Current geometry per pane id (shared reference; the thumbnails' ghost layer). */
  beforeRects: ReadonlyMap<string, Rect>;
  policy: { ok: boolean; reason: string };
  recommended: boolean;
  why: string;
  trace: TraceLine[];
  apply: ProposalApply;
  baseline: boolean;
}

export interface RebalanceSlate {
  diagnosis: Diagnosis;
  /** Current geometry per pane id (the thumbnails' ghost layer). */
  beforeRects: ReadonlyMap<string, Rect>;
  proposals: Proposal[];
}

type StructuralContext = RepairContext & { tree?: AnalysisNode; struct?: number };

type GeneratorSpec =
  | {
      id: string;
      label: string;
      note: string;
      kind: "weights";
      strategy: Strategy;
      donorOrder?: StrategyConfig["donorOrder"];
    }
  | {
      id: string;
      label: string;
      note: string;
      kind: Exclude<GeneratorKind, "weights" | "none">;
      run(tree: AnalysisNode, rect: Rect, cfg: StructuralConfig, ctx: StructuralContext): Generator<TraceLine, void>;
    };

/** The candidate generators: weight repairs, then the structural engines. */
export const GENERATORS: GeneratorSpec[] = [
  { id: "ripple", label: "RIPPLE", note: "nearest donor", kind: "weights", strategy: stratRipple, donorOrder: "near" },
  { id: "ripple-slack", label: "RIPPLE", note: "richest donor", kind: "weights", strategy: stratRipple, donorOrder: "slack" },
  { id: "sparse", label: "SPARSE", note: "fewest donors", kind: "weights", strategy: stratSparse },
  { id: "project", label: "PROJECT", note: "closest in L2", kind: "weights", strategy: stratProject },
  { id: "balance", label: "BALANCE", note: "every split 1/n", kind: "weights", strategy: stratBalance },
  {
    id: "reshape-1",
    label: "RESHAPE",
    note: "one move",
    kind: "topology",
    run: (tree, rect, cfg, ctx) => algoReshape(tree, rect, cfg, ctx, { maxMoves: 1, minGain: 0.05 }),
  },
  {
    id: "reshape-4",
    label: "RESHAPE",
    note: "up to four",
    kind: "topology",
    run: (tree, rect, cfg, ctx) => algoReshape(tree, rect, cfg, ctx, { maxMoves: 4, minGain: 0.05 }),
  },
  ...(["grid", "master", "columns", "dwindle"] as RebuildTarget[]).map(
    (target): GeneratorSpec => ({
      id: `rebuild-${target}`,
      label: "REBUILD",
      note: target,
      kind: "rebuild",
      run: (tree, rect, cfg, ctx) => algoRebuild(tree, rect, cfg, ctx, target),
    }),
  ),
];

const MAX_TRACE = 3000;

export function buildSlate(input: RebalanceInput, cfg: RebalanceConfig): RebalanceSlate {
  const pcfg: PropagateConfig = {
    minInlinePx: cfg.minInlinePx,
    minBlockPx: cfg.minBlockPx,
    dividerPx: input.dividerPx,
  };
  const binaryRects = layoutBinary(input.tree, input.rect, input.dividerPx);
  const base = toAnalysis(input.tree, binaryRects, { labels: input.labels });
  const diagnosis = diagnose(base, input.rect, pcfg);
  const beforeRects = layoutAnalysis(base, input.rect, input.dividerPx);
  const baseStats = layoutStats(base, input.rect, pcfg, beforeRects);

  const candidates: Proposal[] = [];
  for (const gen of GENERATORS) {
    if (!cfg.enabledGenerators.includes(gen.id)) continue;
    const ctx: StructuralContext = newRepairContext();
    const scfg: StructuralConfig = {
      minInlinePx: cfg.minInlinePx,
      minBlockPx: cfg.minBlockPx,
      dividerPx: input.dividerPx,
      hystPx: cfg.hystPx,
      donorOrder: gen.kind === "weights" ? (gen.donorOrder ?? cfg.donorOrder) : cfg.donorOrder,
      targetAspect: cfg.targetAspect,
    };
    const trace: TraceLine[] = [];
    let tree: AnalysisNode;
    if (gen.kind === "weights") {
      tree = structuredClone(base);
      for (const line of repairPass(tree, input.rect, scfg, gen.strategy, ctx)) {
        trace.push(line);
        if (trace.length >= MAX_TRACE) break;
      }
    } else {
      for (const line of gen.run(base, input.rect, scfg, ctx)) {
        trace.push(line);
        if (trace.length >= MAX_TRACE) break;
      }
      tree = ctx.tree ?? structuredClone(base);
    }
    const stats = layoutStats(tree, input.rect, pcfg, beforeRects);
    const cls = classify(base, tree, gen.kind, stats);
    // Weight-only results (structure preserved, chains valid) apply as a
    // resize batch; anything structural replaces the workspace tree.
    let apply: ProposalApply = { kind: "none" };
    if (gen.kind === "weights") {
      const resizes = analysisToResizes(tree, input.rect, input.dividerPx);
      if (resizes.length > 0) {
        apply = {
          kind: "resize-batch",
          verbs: resizes.map((r) => ({ kind: "split.resize", splitId: r.splitId, ratio: r.ratio }) as WorkbenchVerb),
        };
      }
    } else if (cls.tier > 0) {
      apply = { kind: "set-tree", tree: emitBinary(tree, input.rect, input.dividerPx) };
    }
    candidates.push({
      id: gen.id,
      label: gen.label,
      note: gen.note,
      agrees: [`${gen.label} (${gen.note})`],
      tier: cls.tier,
      div: cls.div,
      stats,
      rects: layoutAnalysis(tree, input.rect, input.dividerPx),
      beforeRects,
      policy: { ok: true, reason: "" },
      recommended: false,
      why: whyLine(gen.kind, cls.tier, trace),
      trace,
      apply,
      baseline: false,
    });
  }

  // Dedup by geometry, seeded from the do-nothing baseline so "had no effect"
  // reads as agreement with LEAVE AS IS rather than silently vanishing.
  const keep: Proposal[] = [];
  const byGeometry = new Map<string, Proposal>();
  const baseline: Proposal = {
    id: "none",
    label: "LEAVE AS IS",
    note: "",
    agrees: ["LEAVE AS IS"],
    tier: 0,
    div: 0,
    stats: baseStats,
    rects: beforeRects,
    beforeRects,
    policy: { ok: true, reason: "" },
    recommended: false,
    why: "",
    trace: [],
    apply: { kind: "none" },
    baseline: true,
  };
  byGeometry.set(geometryKey(base, beforeRects), baseline);
  keep.push(baseline);
  for (const candidate of candidates) {
    const key = geometryKey(base, candidate.rects);
    const existing = byGeometry.get(key);
    if (existing) {
      const name = candidate.agrees[0] as string;
      if (!existing.agrees.includes(name)) existing.agrees.push(name);
    } else {
      byGeometry.set(key, candidate);
      keep.push(candidate);
    }
  }
  baseline.why =
    baseStats.viol === 0
      ? "Every tile already clears its minimum. The cheapest correct repair is none."
      : baseline.agrees.length > 1
        ? `Nothing changes. ${baseline.agrees.slice(1).join(", ")} found no slack to move — weights alone cannot help here.`
        : `Leave the layout as it is and live with ${baseStats.viol} unusable tile${baseStats.viol > 1 ? "s" : ""}.`;

  keep.sort((a, b) => a.tier - b.tier || a.stats.disp - b.stats.disp);
  for (const proposal of keep) proposal.policy = checkPolicy(proposal, baseStats, cfg);
  const minViol = Math.min(...keep.map((p) => p.stats.viol));
  const eligible = keep.filter((p) => p.policy.ok && p.stats.viol <= minViol);
  const recommended = eligible.sort((a, b) => polScore(a, cfg) - polScore(b, cfg))[0];
  for (const proposal of keep) proposal.recommended = proposal === recommended;

  return { diagnosis, beforeRects, proposals: keep };
}

/** Rounded pane geometry — two proposals with the same key are the same outcome. */
function geometryKey(base: AnalysisNode, rects: ReadonlyMap<string, Rect>): string {
  return panesOf(base)
    .map((p) => {
      const r = rects.get(p.id);
      if (!r) return p.id;
      return `${p.id}:${Math.round(r.x / 2)},${Math.round(r.y / 2)},${Math.round(r.w / 2)},${Math.round(r.h / 2)}`;
    })
    .join("|");
}

/** polScore (textbook §12.2): the MEASURED tier enters the score directly. */
export function polScore(p: Proposal, cfg: RebalanceConfig): number {
  return (
    (cfg.weights.move * p.stats.disp) / 1000 +
    cfg.weights.struct * p.tier +
    cfg.weights.aspect * Math.log(p.stats.worstAspect) +
    12 * p.stats.viol
  );
}

function checkPolicy(p: Proposal, baseStats: LayoutStats, cfg: RebalanceConfig): { ok: boolean; reason: string } {
  if (p.tier === 3 && !cfg.allow.reorder) return { ok: false, reason: "reorders tiles" };
  if (p.tier === 4 && !cfg.allow.topology) return { ok: false, reason: "changes the tree" };
  if (p.tier === 5 && !cfg.allow.rebuild) return { ok: false, reason: "rebuilds the layout" };
  if (p.tier === 6 && !cfg.allow.overflow) return { ok: false, reason: "moves tiles to another workspace" };
  const movedPct = p.stats.panes ? (100 * p.stats.moved) / p.stats.panes : 0;
  if (movedPct > cfg.budget.panesPct + 0.01) return { ok: false, reason: `moves ${Math.round(movedPct)}% of tiles` };
  if (cfg.budget.dispPx !== null && p.stats.disp > cfg.budget.dispPx) return { ok: false, reason: `${p.stats.disp}px over budget` };
  if (p.stats.viol > baseStats.viol) return { ok: false, reason: "makes it worse" };
  return { ok: true, reason: "" };
}

function whyLine(kind: GeneratorKind, tier: Tier, trace: TraceLine[]): string {
  const detail = trace.map((l) => l.t).find((t) => /take |pays all|single donor|weights changed|sᵢ=1\/|assignment|accept /.test(t));
  const head =
    kind === "weights"
      ? "Weights only."
      : kind === "topology"
        ? "Reshapes a split."
        : kind === "rebuild"
          ? "Fresh tree, tiles reseated."
          : kind === "overflow"
            ? "Surplus tiles move to a new workspace."
            : "";
  const tail = detail ? detail.trim().replace(/\s+/g, " ") : TIERS[tier].name;
  const line = `${head} ${tail}`.replace(/\s+/g, " ").trim();
  return line.length > 112 ? `${line.slice(0, 110)}…` : line;
}
