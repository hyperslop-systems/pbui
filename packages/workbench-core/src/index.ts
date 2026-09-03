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
export { sequentialIds } from "./testing";
