import type { ComponentType, ReactNode } from "react";
import type { ShortcutContext } from "@hyperslop-systems/pbui";
import type { AppView, Mutation, WorkbenchDocument, Workspace } from "@hyperslop-systems/workbench-protocol";
import type { AppDescriptor, AppRegistry } from "./apps";
import type { LauncherRow, LauncherRowsContext, LauncherScope } from "./launcherRows";
import type { PlacementController } from "./placement";
import type { RebalanceConfig } from "./rebalance/config";
import type { RebalanceBadgeProps } from "./components/RebalanceBadge";
import type { RebalanceConfigStore } from "./rebalance/configStore";
import type { WorkbenchState, WorkbenchStore } from "./store";
import type { WorkbenchVerb, WorkbenchVerbHandlers } from "./verbs";
import type { Badge } from "@hyperslop-systems/pbui";
import type { WorkbenchLinks } from "./links/handlers";

/** What a product's `renderTitle` learns about the tile it is titling. */
export interface TilePlacementInfo {
  placementId: string;
  app: AppDescriptor | null;
  /** The derived label: the view's own title, else the app's. */
  label: string;
  canClose: boolean;
  /** How many tiles show this view (a linked view is shown twice). */
  placementCount: number;
}

export interface SurfaceProps {
  /**
   * The title slot of every tile. A PBUI product wraps its `<tile>`
   * Presentation here so the object menu and the chrome buttons are two
   * doors to the same verbs; the default is the plain label.
   *
   * `defaultTitle` is the node this shell would have rendered — the label
   * plus the ×N linked badge. It is passed in so a product may COMPOSE with
   * the badge instead of re-implementing it: three products want a custom
   * title AND the badge, and each one that re-derives `×N` by hand is a
   * place the badge can silently drift out of the chrome's contract.
   */
  renderTitle?(view: AppView, placement: TilePlacementInfo, defaultTitle: ReactNode): ReactNode;
  /**
   * The binding badges of a tile (PBUI-LINK-1): one per bound port, after
   * the title and the ×N marker. A product wraps each in its `<port>`
   * presentation so the badge gets the object menu; the default renders
   * the plain `PortBadge`. Called only when the view has badges.
   */
  renderBadges?(view: AppView, placement: TilePlacementInfo, badges: readonly Badge[]): ReactNode;
  /**
   * Extra controls in the tile bar's action group, beside ⬌/⬍/✕ and OUTSIDE
   * the ellipsising title. Omitting the prop keeps the shell's own door to
   * the per-pane launcher ("show something else in this tile"); return
   * `undefined` from the function for the same default, and `null` for a
   * tile bar with nothing but the three standard buttons.
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
  /**
   * Draw one workspace yourself — a product's `<workspace>` Presentation, so
   * the strip and the object menu offer the same verbs. Returning `undefined`
   * falls back to the default button.
   */
  renderWorkspace?(workspace: Workspace, placement: WorkspacePlacementInfo): ReactNode;
  className?: string;
  /** Show a "+" that creates a workspace with this name. Omitted: no button. */
  addLabel?: string;
}

export interface LauncherProps {
  title?: string;
  /** Listen for Mod+K on the window; default true. */
  shortcut?: boolean;
  /**
   * The parts of the shortcut context only the product knows: whether its
   * object menu is open, whether a presentation is being accepted, whether a
   * tile name is being edited. Dialogs are detected here through pbui's
   * escape-surface stack.
   */
  shortcutContext?(): Partial<Pick<ShortcutContext, "objectMenuOpen" | "acceptingPresentation" | "renamingView">>;
  /**
   * The product's rows model, replacing the default one (what is on screen,
   * then what could be). DR-U6: launcher POLICY stays with the product; the
   * shell keeps the mechanics — Mod-K arbitration, the status line, the
   * keyboard loop, the placement rule.
   */
  rows?(context: LauncherRowsContext): LauncherRow[];
  /**
   * Claim a row before the default meaning applies. Return true to say "I
   * handled it"; false or nothing falls through, so a product may override
   * one row without restating the rest.
   */
  choose?(row: LauncherRow, context: LauncherRowsContext): boolean;
  /** Render a row's detail line; the default uses the row's own `detail`. */
  renderDetail?(row: LauncherRow): ReactNode;
  /**
   * How much of the document the "on screen" rows cover. `"document"` (the
   * default, and the behaviour before this option) lists every placed view
   * in every workspace, marking the foreign ones; `"workspace"` lists only
   * the current workspace's. A product with four workspaces and thirteen
   * tiles gets thirteen rows, nine of them elsewhere — right for a
   * go-anywhere palette, wrong for "what is in front of me".
   */
  scope?: LauncherScope;
}

export interface RebalanceProps {
  /** Listen for Mod+Shift+K on the window; default true. */
  shortcut?: boolean;
  /** Same contract as `LauncherProps.shortcutContext` — the parts only the product knows. */
  shortcutContext?(): Partial<Pick<ShortcutContext, "objectMenuOpen" | "acceptingPresentation" | "renamingView">>;
  /**
   * Fully-controlled repair configuration; wins over `configStore`. Most
   * products should prefer `configStore` so the settings tile stays live.
   */
  config?: RebalanceConfig;
  /**
   * Where the config lives (see rebalance/configStore.ts). Pass the SAME
   * store to `createRebalanceSettingsApp({ store })`. Default: the
   * `pbui.rebalance-config` DocumentPayload in the workbench document.
   * Keep the identity stable across renders.
   */
  configStore?: RebalanceConfigStore;
}

export interface WorkbenchPlan {
  /** Exact immutable document identity the plan was derived from. */
  baseDocument: WorkbenchDocument;
  verbs: readonly WorkbenchVerb[];
  /** One atomic protocol batch produced by running every verb against a shadow store. */
  mutations: readonly Mutation[];
  finalState: Pick<WorkbenchState, "workspaceId" | "activePlacementId" | "launcherOpen" | "launcherFrom">;
}

export type WorkbenchPlanResult =
  | { ok: true; plan: WorkbenchPlan }
  | { ok: false; index: number; verb: WorkbenchVerb; error: string };

export interface Workbench {
  apps: AppRegistry;
  store: WorkbenchStore;
  verbs: WorkbenchVerbHandlers;
  /** Tile linking (PBUI-LINK-1): the runtime values, the current snapshot, the kernel deps. */
  links: WorkbenchLinks;
  useDocument(): WorkbenchDocument;
  useWorkbenchState<T>(selector: (state: WorkbenchState) => T): T;
  /** Apply raw protocol mutations; the verbs are the usual door. */
  mutate(mutations: Mutation[]): boolean;
  /** The data door: one verb object in, with refusal represented explicitly. */
  perform(verb: WorkbenchVerb): boolean;
  /** Preflight a whole sequence against a shadow store without touching the real workbench. */
  plan(verbs: readonly WorkbenchVerb[]): WorkbenchPlanResult;
  /** Commit a fresh plan as one mutation batch plus its browser-local selection state. */
  applyPlan(plan: WorkbenchPlan): boolean;
  serialize(): string;
  /** Replace the layout from `serialize()` output; false (and untouched) when it does not parse. */
  restore(json: string): boolean;
  /**
   * Back to a starting layout. With no argument, the document the workbench
   * was CREATED with — which after a reload is the one restored from storage,
   * so a persisted product must pass its own factory or "reset" restores the
   * layout the user is trying to escape.
   */
  reset(factory?: () => WorkbenchDocument): void;
  activePlacementId(): string | null;
  /** The Surface's root element, once mounted. */
  root(): HTMLElement | null;
  /** @internal set by the Surface */
  setRoot(element: HTMLElement | null): void;
  /**
   * Move DOM focus into a tile. Called after a placement so the keyboard does
   * not stay in the dialog that has closed; a product calls it after its own
   * placements. Deferred a frame, because the tile does not exist yet when
   * the verb returns.
   */
  focusPlacement(placementId: string): void;
  /**
   * Placement mode (§5.E): arm "aim at a pane" and learn where the user
   * pointed. The controller performs nothing — a file list awaits an aim and
   * then calls `view.open` with `at`, the launcher awaits one and calls
   * `placeAt`. The Surface draws the banner and the per-tile labels.
   */
  placement: PlacementController;
  Surface: ComponentType<SurfaceProps>;
  Launcher: ComponentType<LauncherProps>;
  WorkspaceStrip: ComponentType<WorkspaceStripProps>;
  /** The rebalance dialog (PBUI-REBALANCE-1): Mod+Shift+K, or the `rebalance.open` verb. */
  Rebalance: ComponentType<RebalanceProps>;
  /**
   * The always-on diagnosis badge, rendering nothing while the layout is
   * healthy. Bound to this workbench like every other component here, because
   * the place it belongs — a status bar — is precisely where the Surface's
   * context does not reach, and the bare `RebalanceStatusBadge` export throws
   * there.
   */
  RebalanceBadge: ComponentType<RebalanceBadgeProps>;
}
