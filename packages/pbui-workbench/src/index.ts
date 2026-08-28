import "./styles.css";

export {
  workbenchScopes,
  workbenchTileContributions,
  workbenchTypeDefinitions,
} from "./actions";
export type { WorkbenchTileContributionOptions } from "./actions";
export { defineApp, createAppRegistry, isAppAvailable } from "./apps";
export type { AppAvailability, AppDescriptor, AppProps, AppRegistry, DefineAppInput } from "./apps";
export {
  layout,
  workspaces,
  buildLayout,
  workspaceCreateMutation,
  tile,
  split,
  specOf,
  MISSING_APP_ID,
  singleTile,
  emptyDocument,
  serializeDocument,
  parseDocument,
  WORKBENCH_FORMAT,
  WORKBENCH_SCHEMA_VERSION,
} from "./document";
export type { BuiltLayout, LayoutOptions, LayoutSpec, WorkspaceSpec } from "./document";
export { describeWorkbench } from "./describe";
export type {
  DescribeOptions,
  DescribedApp,
  DescribedSplit,
  DescribedTile,
  DescribedWorkspace,
  WorkbenchDescription,
} from "./describe";
export { createWorkbenchStore, useWorkbenchStore } from "./store";
export type { WorkbenchState, WorkbenchStore, WorkbenchStoreOptions } from "./store";
export {
  workbenchVerbs,
  performWorkbenchVerb,
  isWorkbenchVerb,
  describeWorkbenchVerb,
  createVerbHandlers,
  canClose,
  clampRatio,
  placementCount,
} from "./verbs";
export type {
  BindingConfig,
  CrossWorkspace,
  SplitPolicy,
  SplitDirection,
  WorkbenchVerb,
  WorkbenchVerbKind,
  WorkbenchVerbHandlers,
  VerbEnvironment,
} from "./verbs";
export { defaultLauncherRows, groupLauncherRows, rowOf, GOTO_PREFIX, PLACE_PREFIX } from "./launcherRows";
export type { LauncherInvocation, LauncherRow, LauncherRowsContext } from "./launcherRows";
export { createTileDescriptor, tileRefOf } from "./tileDescriptor";
export type { TileRef } from "./tileDescriptor";
export { createWorkbench } from "./createWorkbench";
export type { CreateWorkbenchOptions } from "./createWorkbench";
export type {
  LauncherProps,
  RebalanceProps,
  SurfaceProps,
  TilePlacementInfo,
  Workbench,
  WorkspacePlacementInfo,
  WorkspaceStripProps,
} from "./types";
export { WorkbenchContext, useWorkbench } from "./context";
export { Tile } from "./components/Tile";
export type { TileProps } from "./components/Tile";
export { SplitPane } from "./components/SplitPane";
export type { SplitPaneProps } from "./components/SplitPane";
export { WorkbenchSurface } from "./components/Surface";
export { WorkbenchLauncher } from "./components/Launcher";
export { WorkspaceStrip } from "./components/WorkspaceStrip";
export { WorkbenchRebalance } from "./components/RebalanceDialog";
// The rebalance engine (PBUI-REBALANCE-1): pure logic a product or agent can
// call without the dialog — diagnose a layout, or build the proposal slate.
export { buildSlate, GENERATORS, polScore } from "./rebalance/slate";
export type { Proposal, ProposalApply, RebalanceInput, RebalanceSlate } from "./rebalance/slate";
export { diagnose, propagate, violations } from "./rebalance/propagate";
export type { Diagnosis, MinReq, PropagateConfig, Violation } from "./rebalance/propagate";
export { DEFAULT_REBALANCE_CONFIG, REBALANCE_PROFILES, normalizeConfig, profileConfig } from "./rebalance/config";
export type { RebalanceConfig, RebalanceProfileName } from "./rebalance/config";
export { layoutBinary, toAnalysis, layoutAnalysis, analysisToResizes, panesOf } from "./rebalance/analysisTree";
export type { AnalysisNode, APane, ASplit, ChainStep, Rect, SplitResize } from "./rebalance/analysisTree";
export { TIERS, classify, layoutStats } from "./rebalance/measure";
export type { Classification, GeneratorKind, LayoutStats, Tier } from "./rebalance/measure";
