/**
 * @hyperslop-systems/workbench-core/rebalance — the pure layout-repair
 * engine (PBUI-REBALANCE-1): diagnose a layout, build the proposal slate,
 * and the config document it reads. No React, no DOM; the dialog, the badge,
 * and the config store hook live in pbui-workbench.
 */
export { buildSlate, detectOnly, GENERATORS, polScore } from "./slate";
export type { Proposal, ProposalApply, RebalanceInput, RebalanceSlate } from "./slate";
export { diagnose, propagate, violations } from "./propagate";
export type { Diagnosis, MinReq, PropagateConfig, Violation } from "./propagate";
export { DEFAULT_REBALANCE_CONFIG, REBALANCE_PROFILES, RELAX_ITERS_MAX, RELAX_ITERS_MIN, normalizeConfig, profileConfig } from "./config";
export type { RebalanceConfig, RebalanceProfileName } from "./config";
export { layoutBinary, toAnalysis, layoutAnalysis, analysisToResizes, panesOf } from "./analysisTree";
export type { AnalysisNode, APane, ASplit, ChainStep, Rect, SplitResize } from "./analysisTree";
export { TIERS, classify, layoutStats } from "./measure";
export type { Classification, GeneratorKind, LayoutStats, Tier } from "./measure";
export { algoRebuild, algoReshape, emitBinary, hungarian, normalizeAnalysis, REBUILD_TARGETS, scoreTree, structuralMutationsOf } from "./structural";
export type { RebuildTarget, StructuralConfig, StructuralMutation, TreeScore } from "./structural";
export { readRebalanceConfig, rebalanceConfigMutation, REBALANCE_CONFIG_DOC_ID, REBALANCE_CONFIG_FORMAT, REBALANCE_CONFIG_SCHEMA_VERSION } from "./configDocument";
export { placementMapOf, preservesPlacements } from "./law";
