import "./styles.css";

/**
 * @hyperslop-systems/pbui-workbench — the PBUI React shell over
 * `@hyperslop-systems/workbench-core` (PBUI-WORKBENCH-CORE-1).
 *
 * The root exports what a product composes with: the app declaration, the
 * two constructors, the context/hooks, the bound components' prop types, the
 * placement controller, the presentation fragment, and the link UI pieces.
 * The engine (commands, builders, describe, persistence, sync, rebalance)
 * is imported from workbench-core and its subpaths.
 */
export { defineWorkbenchApp, createPresentationRegistry, isAppAvailable, labelOfView, manifestsOf } from "./app";
export type { AppAvailability, AppPresentation, AppProps, DefineWorkbenchAppInput, PresentationRegistry, WorkbenchApp } from "./app";
export { createWorkbench, createWorkbenchShell } from "./createWorkbenchShell";
export type { CreateWorkbenchOptions, CreateWorkbenchShellOptions } from "./createWorkbenchShell";
export { WorkbenchContext, useWorkbench, usePlacement } from "./context";
export type {
  LauncherProps,
  RebalanceProps,
  ShellDescribeOptions,
  SurfaceProps,
  TilePlacementInfo,
  WorkbenchShell,
  WorkbenchVerb,
  WorkspacePlacementInfo,
  WorkspaceStripProps,
} from "./types";
export { createShellStore, isWorkbenchShellAction, useShellState } from "./shellState";
export { describeWorkbenchVerb, isWorkbenchVerb } from "./verb";
export type { WorkbenchShellAction, WorkbenchShellState, WorkbenchShellStore } from "./shellState";
export { measureGeometry, measureSplitGeometry } from "./geometry";
export { createPlacementController } from "./placement";
export type { ActivePlacement, PlaceZone, PlacementAim, PlacementController, PlacementOutcome, PlacementRequest } from "./placement";
export { defaultLauncherRows, groupLauncherRows, rowOf, GOTO_PREFIX, PLACE_PREFIX } from "./launcherRows";
export type { LauncherInvocation, LauncherRow, LauncherRowsContext, LauncherScope } from "./launcherRows";
export { createTileDescriptor, tileRefOf } from "./tileDescriptor";
export type { TileRef } from "./tileDescriptor";
export { createWorkbenchPresentationFragment, workbenchScopes, workbenchTileContributions, workbenchTypeDefinitions } from "./actions";
export type { WorkbenchPresentationFragmentOptions, WorkbenchTileContributionOptions } from "./actions";
// Tile linking (PBUI-LINK-1): hooks, the port/link descriptors, the menus.
export {
  createLinkDescriptor,
  createPortDescriptor,
  linkRefsOf,
  linkTypeDefinitions,
  portRefOf,
  useBadges,
  useEmitPort,
  useLinkRuntime,
  useLinkSnapshot,
  usePort,
  workbenchLinkContributions,
} from "./links";
export type { EmitPortOptions, LinkFacts, LinkRef, PortReading, PortRef, WorkbenchLinkContributionOptions } from "./links";
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
export { AppShell } from "./components/AppShell";
export type { AppShellProps } from "./components/AppShell";
export { WorkbenchRebalance, rebalanceGeometry } from "./components/RebalanceDialog";
export { RebalanceStatusBadge } from "./components/RebalanceBadge";
export type { RebalanceBadgeProps } from "./components/RebalanceBadge";
export { RebalanceSettings, rebalanceSettingsApp, createRebalanceSettingsApp } from "./components/RebalanceSettings";
export type { RebalanceSettingsAppOptions } from "./components/RebalanceSettings";
export { documentRebalanceConfigStore, createLocalStorageRebalanceConfigStore } from "./rebalance/configStore";
export type { RebalanceConfigHost, RebalanceConfigStore } from "./rebalance/configStore";
