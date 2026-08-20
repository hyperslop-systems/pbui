import "./styles.css";

export { defineApp, createAppRegistry, isAppAvailable } from "./apps";
export type { AppAvailability, AppDescriptor, AppProps, AppRegistry, DefineAppInput } from "./apps";
export {
  layout,
  workspaces,
  buildLayout,
  workspaceCreateMutation,
  tile,
  split,
  singleTile,
  emptyDocument,
  serializeDocument,
  parseDocument,
  WORKBENCH_FORMAT,
  WORKBENCH_SCHEMA_VERSION,
} from "./document";
export type { BuiltLayout, LayoutOptions, LayoutSpec, WorkspaceSpec } from "./document";
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
export type { TileDescriptorOptions, TileRef } from "./tileDescriptor";
export { createWorkbench } from "./createWorkbench";
export type { CreateWorkbenchOptions } from "./createWorkbench";
export type {
  LauncherProps,
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
