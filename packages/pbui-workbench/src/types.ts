import type { ComponentType, ReactNode } from "react";
import type { ShortcutContext } from "@hyperslop-systems/pbui";
import type { AppView, Mutation, WorkbenchDocument } from "@hyperslop-systems/workbench-protocol";
import type { AppDescriptor, AppRegistry } from "./apps";
import type { WorkbenchState, WorkbenchStore } from "./store";
import type { WorkbenchVerb, WorkbenchVerbHandlers } from "./verbs";

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
   */
  renderTitle?(view: AppView, placement: TilePlacementInfo): ReactNode;
  className?: string;
  /** Drop-overlay labels, for products that word them differently. */
  swapLabel?: string;
  dockLabel?: string;
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
}

export interface Workbench {
  apps: AppRegistry;
  store: WorkbenchStore;
  verbs: WorkbenchVerbHandlers;
  useDocument(): WorkbenchDocument;
  useWorkbenchState<T>(selector: (state: WorkbenchState) => T): T;
  /** Apply raw protocol mutations; the verbs are the usual door. */
  mutate(mutations: Mutation[]): boolean;
  /** The data door: one verb object in, the matching handler called. */
  perform(verb: WorkbenchVerb): void;
  serialize(): string;
  /** Replace the layout from `serialize()` output; false (and untouched) when it does not parse. */
  restore(json: string): boolean;
  /** Back to the layout the workbench was created with. */
  reset(): void;
  activePlacementId(): string | null;
  /** The Surface's root element, once mounted. */
  root(): HTMLElement | null;
  /** @internal set by the Surface */
  setRoot(element: HTMLElement | null): void;
  Surface: ComponentType<SurfaceProps>;
  Launcher: ComponentType<LauncherProps>;
}
