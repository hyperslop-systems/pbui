import type { ComponentType, ReactNode } from "react";
import type { Badge, ShortcutContext } from "@hyperslop-systems/pbui";
import type {
  ApplyResult,
  DescribeOptions,
  ExecuteResult,
  GeometrySnapshot,
  PreviewResult,
  WorkbenchCommand,
  WorkbenchCore,
  WorkbenchCoreState,
  WorkbenchDescription,
  WorkbenchLinks,
} from "@hyperslop-systems/workbench-core";
import type { RebalanceConfig } from "@hyperslop-systems/workbench-core/rebalance";
import type { LinkSnapshot } from "@hyperslop-systems/pbui";
import type { AppView, Mutation, WorkbenchDocument, Workspace } from "@hyperslop-systems/workbench-protocol";
import type { AppPresentation, PresentationRegistry } from "./app";
import type { RebalanceBadgeProps } from "./components/RebalanceBadge";
import type { LauncherRow, LauncherRowsContext, LauncherScope } from "./launcherRows";
import type { LinkRef } from "./links/linkRef";
import type { PortRef } from "./links/portRef";
import type { PlacementController } from "./placement";
import type { RebalanceConfigStore } from "./rebalance/configStore";
import type { WorkbenchShellAction, WorkbenchShellState, WorkbenchShellStore } from "./shellState";

/** What a product's `renderTitle` learns about the tile it is titling. */
export interface TilePlacementInfo {
  placementId: string;
  app: AppPresentation | null;
  /** The derived label: the view's own title, else the app's. */
  label: string;
  canClose: boolean;
  /** How many tiles show this view (a linked view is shown twice). */
  placementCount: number;
}

export interface WiringOptions {
  mode?: "auto" | "spatial" | "focused";
  renderPortDetails?(port: PortRef): ReactNode;
  renderRelationDetails?(link: LinkRef): ReactNode;
}

export interface SurfaceProps {
  /**
   * The title slot of every tile. A PBUI product wraps its `<tile>`
   * Presentation here so the object menu and the chrome buttons are two
   * doors to the same commands; the default is the plain label.
   * `defaultTitle` is the node this shell would have rendered — the label
   * plus the ×N linked badge — so a product may COMPOSE with the badge.
   */
  renderTitle?(view: AppView, placement: TilePlacementInfo, defaultTitle: ReactNode): ReactNode;
  /** The binding badges of a tile (PBUI-LINK-1): one per bound port, after the title and the ×N marker. */
  renderBadges?(view: AppView, placement: TilePlacementInfo, badges: readonly Badge[]): ReactNode;
  wiring?: WiringOptions;
  /** Listen for Mod+Shift+L on the window to toggle connect mode; default true. */
  linkModeShortcut?: boolean;
  /**
   * Extra controls in the tile bar's action group. Omitting the prop keeps
   * the shell's door to the per-pane launcher; `undefined` from the function
   * keeps the default, `null` removes it.
   */
  tileAction?(placement: TilePlacementInfo): ReactNode;
  className?: string;
  /** Drop-overlay labels, for products that word them differently. */
  swapLabel?: string;
  dockLabel?: string;
  replaceLabel?: string;
}

/** What `renderWorkspace` learns about the workspace it is drawing. */
export interface WorkspacePlacementInfo {
  active: boolean;
  /** Leaves in its tree; a linked view is counted once per tile. */
  tileCount: number;
  select(): boolean;
}

export interface WorkspaceStripProps {
  /** Draw one workspace yourself — a product's `<workspace>` Presentation; `undefined` falls back to the default button. */
  renderWorkspace?(workspace: Workspace, placement: WorkspacePlacementInfo): ReactNode;
  className?: string;
  /** Show a "+" that creates a workspace with this name. Omitted: no button. */
  addLabel?: string;
}

export interface LauncherProps {
  title?: string;
  /** Listen for Mod+K on the window; default true. */
  shortcut?: boolean;
  /** The parts of the shortcut context only the product knows. */
  shortcutContext?(): Partial<Pick<ShortcutContext, "objectMenuOpen" | "acceptingPresentation" | "renamingView">>;
  /** The product's rows model, replacing the default one (what is on screen, then what could be). */
  rows?(context: LauncherRowsContext): LauncherRow[];
  /** Claim a row before the default meaning applies; true means "I handled it". */
  choose?(row: LauncherRow, context: LauncherRowsContext): boolean;
  /** Render a row's detail line; the default uses the row's own `detail`. */
  renderDetail?(row: LauncherRow): ReactNode;
  /** How much of the document the "on screen" rows cover; default `"document"`. */
  scope?: LauncherScope;
}

export interface RebalanceProps {
  /** Listen for Mod+Shift+K on the window; default true. */
  shortcut?: boolean;
  shortcutContext?(): Partial<Pick<ShortcutContext, "objectMenuOpen" | "acceptingPresentation" | "renamingView">>;
  /** Fully-controlled repair configuration; wins over `configStore`. */
  config?: RebalanceConfig;
  /** Where the config lives; default: the `pbui.rebalance-config` payload in the workbench document. Keep the identity stable. */
  configStore?: RebalanceConfigStore;
}

/**
 * Anything the shell performs (guide §8.4 vs §14.3): a semantic command,
 * which the core executes, or a shell action, which the shell-local store
 * takes. One union so a product's verb router has one door.
 */
export type WorkbenchVerb = WorkbenchCommand | WorkbenchShellAction;

export interface ShellDescribeOptions extends Omit<DescribeOptions, "presentations" | "geometry"> {
  /** Read `rect` off the mounted Surface; opt-in because it is the only part that needs a DOM. */
  geometry?: boolean;
}

/**
 * The React shell over a `WorkbenchCore` (guide §16.3): the core, the
 * presentation registry, the shell-local store, placement mode, focus and
 * geometry helpers, the routing door, and five bound components. It owns no
 * semantics: every layout change is a command the core executes.
 */
export interface WorkbenchShell {
  readonly core: WorkbenchCore;
  /** The React projections, by app id. */
  readonly apps: PresentationRegistry;
  /** Launcher, rebalance dialog, connect mode, show chooser, relation palette. */
  readonly shell: WorkbenchShellStore;
  /** Tile linking: the core's collaborator (runtime values, deps, snapshots). */
  readonly links: WorkbenchLinks;
  /** Placement mode (§5.E): arm "aim at a pane" and learn where the user pointed. */
  readonly placement: PlacementController;
  useDocument(): WorkbenchDocument;
  useCoreState<T>(selector: (state: WorkbenchCoreState) => T): T;
  useShellState<T>(selector: (state: WorkbenchShellState) => T): T;
  /** Measure geometry now (when the command needs it) and execute through the core. An ambiguous `show` opens the chooser. */
  execute(command: WorkbenchCommand | readonly WorkbenchCommand[]): ExecuteResult;
  preview(command: WorkbenchCommand | readonly WorkbenchCommand[]): PreviewResult;
  dispatch(action: WorkbenchShellAction): void;
  /**
   * The routing door: a command executes, a shell action dispatches. Returns
   * whether it landed — false for a refusal. A caller that routes verbs for
   * a model MUST propagate this; a button may ignore it.
   */
  perform(verb: WorkbenchVerb): boolean;
  /** A raw protocol batch through the core's gateway (a product document write). */
  apply(mutations: readonly Mutation[]): ApplyResult;
  serialize(): string;
  /** Replace from `serialize()` output; false (and untouched) when it does not parse or validate. */
  restore(json: string): boolean;
  /** Back to a starting layout; a persisted product passes its own factory. */
  reset(factory?: () => WorkbenchDocument): boolean;
  activePlacementId(): string | null;
  /** The current link facts, for a product's presentation snapshot. */
  linkSnapshot(): LinkSnapshot;
  /** The Surface's root element, once mounted. */
  root(): HTMLElement | null;
  /** @internal set by the Surface */
  setRoot(element: HTMLElement | null): void;
  /** The DOM measured now, or null with no mounted Surface. */
  measure(): GeometrySnapshot | null;
  /** Move DOM focus into a tile, a frame later (the tile may not exist yet when a command returns). */
  focusPlacement(placementId: string): void;
  /** The workbench as an agent reads it, with presentation titles and optional measured geometry. */
  describe(options?: ShellDescribeOptions): WorkbenchDescription;
  Surface: ComponentType<SurfaceProps>;
  Launcher: ComponentType<LauncherProps>;
  WorkspaceStrip: ComponentType<WorkspaceStripProps>;
  /** The rebalance dialog: Mod+Shift+K, or the `rebalance.open` shell action. */
  Rebalance: ComponentType<RebalanceProps>;
  /** The always-on diagnosis badge, rendering nothing while the layout is healthy. */
  RebalanceBadge: ComponentType<RebalanceBadgeProps>;
}
