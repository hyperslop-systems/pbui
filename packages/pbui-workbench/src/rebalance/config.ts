import { DEFAULT_PANE_CONSTRAINTS } from "../verbs";

/**
 * Configuration for the rebalance slate (PBUI-REBALANCE-1, design-doc/01 §4.2).
 *
 * The pixel floors deliberately reuse the workbench's existing
 * `DEFAULT_PANE_CONSTRAINTS` so a repair aims at the same minimums the divider
 * clamp already enforces locally — propagation (see `propagate.ts`) is those
 * constraints made global, not a second opinion about tile size.
 */
export interface RebalanceConfig {
  /** Pixel floor for a visible tile's width. */
  minInlinePx: number;
  /** Pixel floor for a visible tile's height. */
  minBlockPx: number;
  /**
   * Trigger slack: a deficit must exceed `0.5 + hystPx` before a split is
   * repaired at all. Lives ONLY in the trigger — repair always goes to the
   * full requirement (textbook §1.6), or resizes would drift on every
   * one-pixel window resize.
   */
  hystPx: number;
  /** Target width:height used by the aspect terms of the policy scorer. */
  targetAspect: number;
  /** Donor ranking for ripple: nearest first, left-biased, or richest first. */
  donorOrder: "near" | "left" | "slack";
  /** Named profile the rest of the fields were seeded from; "custom" after any manual edit. */
  profile: RebalanceProfileName | "custom";
  /** What a proposal may do to the layout before it is greyed out. */
  allow: {
    reorder: boolean;
    topology: boolean;
    rebuild: boolean;
    overflow: boolean;
  };
  /** Budgets a proposal must stay within to remain in policy. */
  budget: {
    /** Max percentage of tiles that may move (0–100). */
    panesPct: number;
    /** Total displacement cap in px; null = unbounded. */
    dispPx: number | null;
  };
  /** Recommendation-score weights (design-doc/01 §2.8: polScore). */
  weights: { move: number; struct: number; aspect: number };
  /** Generator ids allowed to run; see `slate.ts` GENERATORS. */
  enabledGenerators: string[];
  /**
   * RELAX (textbook §7): projected gradient on a displacement energy.
   * alpha weighs centre movement, beta size movement, gamma the pull toward
   * targetAspect — NONZERO GAMMA ACTS ON HEALTHY SPLITS, which is a feature
   * for tidying and a hazard for silent repair; that is why the generator is
   * opt-in and gamma defaults to zero everywhere except TIDY.
   */
  relax: RelaxParams;
}

export interface RelaxParams {
  alpha: number;
  beta: number;
  gamma: number;
  iters: number;
  step: number;
}

export const DEFAULT_RELAX: RelaxParams = { alpha: 1, beta: 1, gamma: 0, iters: 60, step: 0.12 };

export type RebalanceProfileName = "careful" | "balanced" | "tidy" | "anything";

export interface RebalanceProfile {
  label: string;
  description: string;
  config: Omit<RebalanceConfig, "minInlinePx" | "minBlockPx" | "hystPx" | "targetAspect" | "profile">;
}

/**
 * The four policy profiles from the repair lab (textbook §12.2). Constraints
 * (minimum sizes, hysteresis, aspect) are NOT part of a profile — they describe
 * the screen and the user's eyes, not a repair posture — so switching profiles
 * never changes what counts as broken, only what may be done about it.
 */
export const REBALANCE_PROFILES: Record<RebalanceProfileName, RebalanceProfile> = {
  careful: {
    label: "CAREFUL",
    description: "Move as little as possible. Weights only — the tree you built stays the tree you built.",
    config: {
      donorOrder: "near",
      allow: { reorder: false, topology: false, rebuild: false, overflow: false },
      budget: { panesPct: 100, dispPx: 2600 },
      weights: { move: 1.6, struct: 6, aspect: 0.1 },
      enabledGenerators: ["ripple", "ripple-slack", "sparse", "project"],
      relax: { ...DEFAULT_RELAX },
    },
  },
  balanced: {
    label: "BALANCED",
    description: "Prefer a quiet repair, but restructure when weights genuinely cannot fix it.",
    config: {
      donorOrder: "near",
      allow: { reorder: true, topology: true, rebuild: false, overflow: true },
      budget: { panesPct: 100, dispPx: null },
      weights: { move: 1, struct: 3, aspect: 0.2 },
      enabledGenerators: ["ripple", "sparse", "project", "balance", "reshape-1", "reshape-4"],
      relax: { ...DEFAULT_RELAX },
    },
  },
  tidy: {
    label: "TIDY",
    description: "Optimise the result, not the transition. Regular grids and sane aspect ratios win.",
    config: {
      donorOrder: "near",
      allow: { reorder: true, topology: true, rebuild: true, overflow: true },
      budget: { panesPct: 100, dispPx: null },
      weights: { move: 0.25, struct: 0.3, aspect: 1.6 },
      // TIDY is the one profile where RELAX runs by default, WITH the
      // aspect term: it is the "optimise the result" posture, and a nonzero
      // gamma acting on healthy splits is exactly what tidy means.
      enabledGenerators: ["relax", "project", "balance", "reshape-4", "rebuild-grid", "rebuild-master", "rebuild-columns"],
      relax: { ...DEFAULT_RELAX, gamma: 1 },
    },
  },
  anything: {
    label: "ANYTHING",
    description: "Every generator, no budget. Useful for seeing the whole space at once.",
    config: {
      donorOrder: "near",
      allow: { reorder: true, topology: true, rebuild: true, overflow: true },
      budget: { panesPct: 100, dispPx: null },
      weights: { move: 1, struct: 1, aspect: 0.6 },
      enabledGenerators: [
        "ripple",
        "ripple-slack",
        "sparse",
        "project",
        "balance",
        "reshape-1",
        "reshape-4",
        "rebuild-grid",
        "rebuild-master",
        "rebuild-columns",
        "rebuild-dwindle",
        "relax",
      ],
      relax: { ...DEFAULT_RELAX },
    },
  },
};

export function profileConfig(name: RebalanceProfileName): RebalanceConfig {
  const profile = REBALANCE_PROFILES[name];
  return {
    minInlinePx: DEFAULT_PANE_CONSTRAINTS.minInlinePx,
    minBlockPx: DEFAULT_PANE_CONSTRAINTS.minBlockPx,
    hystPx: 0,
    targetAspect: 1.4,
    profile: name,
    ...structuredClone(profile.config),
  };
}

export const DEFAULT_REBALANCE_CONFIG: RebalanceConfig = profileConfig("balanced");

/**
 * Fill a partial (persisted, possibly stale-schema) config with defaults.
 * Unknown fields are dropped; missing fields come from the balanced profile.
 */
export function normalizeConfig(partial: unknown): RebalanceConfig {
  const base = profileConfig("balanced");
  if (!partial || typeof partial !== "object" || Array.isArray(partial)) return base;
  const p = partial as Partial<RebalanceConfig>;
  const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
  return {
    minInlinePx: num(p.minInlinePx, base.minInlinePx),
    minBlockPx: num(p.minBlockPx, base.minBlockPx),
    hystPx: num(p.hystPx, base.hystPx),
    targetAspect: num(p.targetAspect, base.targetAspect),
    donorOrder: p.donorOrder === "left" || p.donorOrder === "slack" ? p.donorOrder : "near",
    profile:
      p.profile === "careful" || p.profile === "balanced" || p.profile === "tidy" ||
      p.profile === "anything" || p.profile === "custom"
        ? p.profile
        : base.profile,
    allow: {
      reorder: bool(p.allow?.reorder, base.allow.reorder),
      topology: bool(p.allow?.topology, base.allow.topology),
      rebuild: bool(p.allow?.rebuild, base.allow.rebuild),
      overflow: bool(p.allow?.overflow, base.allow.overflow),
    },
    budget: {
      panesPct: num(p.budget?.panesPct, base.budget.panesPct),
      dispPx:
        p.budget?.dispPx === null ? null : num(p.budget?.dispPx, base.budget.dispPx ?? Number.NaN) || base.budget.dispPx,
    },
    weights: {
      move: num(p.weights?.move, base.weights.move),
      struct: num(p.weights?.struct, base.weights.struct),
      aspect: num(p.weights?.aspect, base.weights.aspect),
    },
    enabledGenerators: Array.isArray(p.enabledGenerators)
      ? p.enabledGenerators.filter((g): g is string => typeof g === "string")
      : base.enabledGenerators,
    relax: {
      alpha: num(p.relax?.alpha, base.relax.alpha),
      beta: num(p.relax?.beta, base.relax.beta),
      gamma: num(p.relax?.gamma, base.relax.gamma),
      iters: num(p.relax?.iters, base.relax.iters),
      step: num(p.relax?.step, base.relax.step),
    },
  };
}
