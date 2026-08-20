import "./styles.css";

export { defineApp, createAppRegistry } from "./apps";
export type { AppDescriptor, AppProps, AppRegistry, DefineAppInput } from "./apps";
export {
  layout,
  tile,
  split,
  singleTile,
  emptyDocument,
  serializeDocument,
  parseDocument,
  WORKBENCH_FORMAT,
  WORKBENCH_SCHEMA_VERSION,
} from "./document";
export type { LayoutOptions, LayoutSpec } from "./document";
export { createWorkbenchStore, useWorkbenchStore } from "./store";
export type { WorkbenchState, WorkbenchStore } from "./store";
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
export type { SplitDirection, WorkbenchVerb, WorkbenchVerbKind, WorkbenchVerbHandlers, VerbEnvironment } from "./verbs";
export { createWorkbench } from "./createWorkbench";
export type { CreateWorkbenchOptions } from "./createWorkbench";
export type { LauncherProps, SurfaceProps, TilePlacementInfo, Workbench } from "./types";
export { WorkbenchContext, useWorkbench } from "./context";
export { Tile } from "./components/Tile";
export type { TileProps } from "./components/Tile";
export { SplitPane } from "./components/SplitPane";
export type { SplitPaneProps } from "./components/SplitPane";
export { WorkbenchSurface } from "./components/Surface";
export { WorkbenchLauncher } from "./components/Launcher";
