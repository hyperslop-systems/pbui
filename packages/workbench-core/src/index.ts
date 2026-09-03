/**
 * @hyperslop-systems/workbench-core — the headless PBUI workbench engine.
 *
 * Protocol (`workbench-protocol`) below, React shell (`pbui-workbench`) above;
 * this package owns everything semantic in between: app manifests, the
 * structural index and queries, essential validation, layout builders, the
 * command planner, and the core that executes commands transactionally.
 */
export { defineAppManifest, createManifestCatalog, isManifestCatalog, isDocBound, documentSlots } from "./apps";
export type { DuplicatePlacement, ManifestCatalog, ViewCardinality, WorkbenchAppManifest, WorkbenchAppManifestInput } from "./apps";
export { diagnostic, WorkbenchDiagnosticError } from "./diagnostics";
export { attemptAll, reportFailures } from "./publication";
export type { OwnershipMode } from "./ownership";
export type { ObserverErrorSink, ObserverStage, WorkbenchObserverError } from "./publication";
export type { ValidationResult, WorkbenchDiagnostic } from "./diagnostics";
export { buildWorkbenchIndex } from "./graph";
export type { PlacementRef, WorkbenchIndex } from "./graph";
export {
  canClose,
  documentsWithFormat,
  firstPlacementOfView,
  isPlacement,
  leavesOfWorkspace,
  orphanViewIds,
  placementCount,
  sameBindings,
  viewsUsingDocument,
  workspaceOfView,
} from "./queries";
export type { ViewBindingRef } from "./queries";
export { DEFAULT_LIMITS, validateWorkbenchDocument, WORKBENCH_FORMAT, WORKBENCH_SCHEMA_VERSION } from "./validation";
export type { ValidateOptions, WorkbenchLimits } from "./validation";
export {
  buildLayout,
  emptyDocument,
  layout,
  MISSING_APP_ID,
  parseWorkbenchDocument,
  serializeDocument,
  singleTile,
  specOf,
  split,
  tile,
  workspaceCreateMutation,
  workspaces,
} from "./document";
export type { BuildLayoutOptions, BuiltLayout, LayoutOptions, LayoutSpec, ParseOptions, ParseWorkbenchResult, WorkspaceSpec } from "./document";
export { compilePolicy, DEFAULT_PANE_CONSTRAINTS } from "./policy";
export type { Axis, DuplicatePolicy, PaneConstraints, WorkbenchPolicy, WorkbenchPolicyInput } from "./policy";
export { bindRequestedOnly, followTheCrowd, resolveInitialDocuments } from "./binding";
export type { FollowTheCrowdOptions, InitialDocumentInput, InitialDocumentPolicy, InitialDocumentResolution } from "./binding";
export { repairSession } from "./session";
export type { WorkbenchSession } from "./session";
export { createWorkbenchCore } from "./createWorkbenchCore";
export type { ApplyResult, CommitReceipt, CreateWorkbenchCoreOptions, ExecuteOptions, ExecuteResult, PreviewResult, ReplaceResult, WorkbenchCore, WorkbenchCoreState } from "./createWorkbenchCore";
export { commands, describeWorkbenchCommand, isWorkbenchCommand, isWorkbenchLinkCommand } from "./commands";
export type { Edge, PlacementRequest, ViewRequest, WorkbenchCommand, WorkbenchCommandKind, WorkbenchLinkCommand } from "./commands";
export { canSplitPlacement, DEFAULT_DIVIDER_PX, layoutFits, longerAxis, paneRatioBounds, splitRatioBounds } from "./geometry";
export type { GeometrySnapshot, Rect, SplitRatioBounds } from "./geometry";
export type { LocalEffect } from "./effects";
export { plan } from "./planner/plan";
export type { PlanResult, PreparedTransition } from "./planner/plan";
export type { Choice, PlanWorld } from "./planner/world";
export * from "./links";
export { describeWorkbench, titleOfView } from "./describe";
export { connectDocumentSource, documentSourceMutations } from "./sources";
export type { DocumentSource } from "./sources";
export type { DescribeOptions, DescribePresentation, DescribedApp, DescribedBinding, DescribedContext, DescribedLink, DescribedPort, DescribedSplit, DescribedTile, DescribedWorkspace, WorkbenchDescription } from "./describe";
export { sequentialIds } from "./testing";
