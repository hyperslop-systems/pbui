import "./styles.css";

export {
  createWorkbenchPresentationFragment,
  workbenchScopes,
  workbenchTileContributions,
  workbenchTypeDefinitions,
} from "./actions";
export type { WorkbenchPresentationFragmentOptions, WorkbenchTileContributionOptions } from "./actions";
export { defineApp, createAppRegistry, isAppAvailable, isDocBound, documentSlots } from "./apps";
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
  DescribedBinding,
  DescribedContext,
  DescribedLink,
  DescribedPort,
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
  PlaceZone,
  SplitPolicy,
  SplitDirection,
  WorkbenchVerb,
  WorkbenchVerbKind,
  WorkbenchVerbHandlers,
  VerbEnvironment,
} from "./verbs";
export { defaultLauncherRows, groupLauncherRows, rowOf, GOTO_PREFIX, PLACE_PREFIX } from "./launcherRows";
export type { LauncherInvocation, LauncherRow, LauncherRowsContext, LauncherScope } from "./launcherRows";
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
export { WorkbenchContext, useWorkbench, usePlacement } from "./context";
export { createPlacementController } from "./placement";
export { createLocalPersistence, readWorkbenchSnapshot, PERSISTENCE_VERSION, PRE_ENVELOPE_VERSION } from "./persistence";
export type { LocalPersistence, LocalPersistenceOptions, ReadOptions, StorageLike, WorkbenchSnapshot } from "./persistence";
export type {
  ActivePlacement,
  PlacementAim,
  PlacementController,
  PlacementOutcome,
  PlacementRequest,
} from "./placement";
// Tile linking (PBUI-LINK-1): the link document, runtime, hooks, port descriptor, menus.
export {
  LINKS_DOC_ID,
  LINKS_FORMAT,
  LINKS_SCHEMA_VERSION,
  bindingsOf,
  buildLinkSnapshot,
  createLinkHandlers,
  createLinkRuntime,
  createLinkDescriptor,
  createPortDescriptor,
  linkRefsOf,
  linkTypeDefinitions,
  linksChange,
  linksMutation,
  portRefOf,
  readLinks,
  useBadges,
  useEmitPort,
  useLinkRuntime,
  useLinkSnapshot,
  usePort,
  workbenchLinkContributions,
} from "./links";
export type {
  CreateLinkHandlersOptions,
  EmitOptions,
  EmitPortOptions,
  LinkEnvironment,
  LinkFacts,
  LinkHandlers,
  LinkRef,
  LinkRuntime,
  LinkRuntimeState,
  LinksPayload,
  PortReading,
  PortRef,
  WorkbenchLinkContributionOptions,
  WorkbenchLinks,
} from "./links";
export { PortBadge } from "./components/PortBadge";
export type { PortBadgeProps } from "./components/PortBadge";
export { ShowChooser } from "./components/ShowChooser";
export { RelationPalette } from "./components/RelationPalette";
export { LinkAnnouncer } from "./components/LinkAnnouncer";
export { CoordinationInspector, coordinationInspectorApp, createCoordinationInspectorApp } from "./components/CoordinationInspector";
export type { CoordinationInspectorAppOptions } from "./components/CoordinationInspector";
export { PortRail } from "./components/PortRail";
export type { PortRailProps } from "./components/PortRail";
export { WireLayer } from "./components/WireLayer";
export type { WireLayerProps } from "./components/WireLayer";
export { Tile } from "./components/Tile";
export type { TileProps } from "./components/Tile";
export { SplitPane } from "./components/SplitPane";
export type { SplitPaneProps } from "./components/SplitPane";
export { WorkbenchSurface } from "./components/Surface";
export { WorkbenchLauncher } from "./components/Launcher";
export { WorkspaceStrip } from "./components/WorkspaceStrip";
export { WorkbenchRebalance } from "./components/RebalanceDialog";
export { RebalanceStatusBadge } from "./components/RebalanceBadge";
export type { RebalanceBadgeProps } from "./components/RebalanceBadge";
export { RebalanceSettings, rebalanceSettingsApp, createRebalanceSettingsApp } from "./components/RebalanceSettings";
export type { RebalanceSettingsAppOptions } from "./components/RebalanceSettings";
export {
  documentRebalanceConfigStore,
  createLocalStorageRebalanceConfigStore,
} from "./rebalance/configStore";
export type { RebalanceConfigHost, RebalanceConfigStore } from "./rebalance/configStore";
// The rebalance engine lives in workbench-core/rebalance; re-exported whole until the Phase 6 barrel cut.
export * from "@hyperslop-systems/workbench-core/rebalance";
