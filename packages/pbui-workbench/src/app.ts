import type { ComponentType } from "react";
import { defineAppManifest, type WorkbenchAppManifest, type WorkbenchAppManifestInput } from "@hyperslop-systems/workbench-core";
import type { AppView } from "@hyperslop-systems/workbench-protocol";

/**
 * What a tile hands its application: the rectangle it is in and the logical
 * view it shows. Two placements of one view receive the same `view`, which is
 * what keeps linked tiles in lockstep — the application reads one object.
 */
export interface AppProps {
  placementId: string;
  view: AppView;
}

/** What `available` is asked about. */
export interface AppAvailability {
  workspaceId: string;
}

/**
 * The React half of an application (guide §8.1, §16.8): everything a
 * renderer, a launcher, or a title bar needs and the engine never reads. It
 * is joined to its `WorkbenchAppManifest` by `id`.
 */
export interface AppPresentation {
  id: string;
  title: string;
  /** A CSS custom-property reference such as `var(--pbui-tone-chat)`; never a colour literal. */
  tone: string;
  /** The title of ONE view; defaults to `title`. Receives the view so a doc-bound app can name its document. */
  titleFor?(view: AppView): string;
  /** Which launcher group the application is offered in; the default rows model puts everything without one in "NEW TILE". */
  group?: string;
  /** One line under the title in the launcher. */
  blurb?: string;
  /**
   * May the LAUNCHER'S ROWS offer this application right now, and nothing
   * else? A tile whose layout already names an excluded application still
   * renders it, commands still place it, and a stored layout never silently
   * loses a tile because a predicate turned false.
   */
  available?(context: AppAvailability): boolean;
  Component: ComponentType<AppProps>;
}

/** One application, both projections, validated once. */
export interface WorkbenchApp {
  readonly manifest: WorkbenchAppManifest;
  readonly presentation: AppPresentation;
}

export interface DefineWorkbenchAppInput {
  manifest: WorkbenchAppManifestInput;
  presentation: Omit<AppPresentation, "id">;
}

/**
 * One ergonomic declaration, two projections (guide §8.1): the engine sees
 * only the manifest, the shell sees only the presentation, and the two can
 * never disagree about the id because there is one.
 */
export function defineWorkbenchApp(input: DefineWorkbenchAppInput): WorkbenchApp {
  const manifest = defineAppManifest(input.manifest);
  if (!input.presentation.title) throw new Error(`pbui-workbench: application "${manifest.id}" needs a title`);
  if (!input.presentation.Component) throw new Error(`pbui-workbench: application "${manifest.id}" needs a Component`);
  // The id comes from the manifest, whatever a spread presentation carried.
  return { manifest, presentation: { ...input.presentation, id: manifest.id } };
}

/** Is the application offered in this workspace's LAUNCHER? An app without a predicate always is. */
export function isAppAvailable(app: AppPresentation, context: AppAvailability): boolean {
  return app.available?.(context) ?? true;
}

export interface PresentationRegistry {
  get(id: string): AppPresentation | null;
  list(): readonly AppPresentation[];
}

/** An explicit list, never import-side-effect registration; a duplicate id fails construction. */
export function createPresentationRegistry(apps: readonly (WorkbenchApp | AppPresentation)[]): PresentationRegistry {
  const byId = new Map<string, AppPresentation>();
  for (const app of apps) {
    const presentation = "presentation" in app ? app.presentation : app;
    if (byId.has(presentation.id)) throw new Error(`pbui-workbench: application "${presentation.id}" is registered twice`);
    byId.set(presentation.id, presentation);
  }
  const list = Object.freeze([...byId.values()]);
  return { get: (id) => byId.get(id) ?? null, list: () => list };
}

/**
 * The derived tile label, computed the way the tile bar, the launcher, the
 * link badges, and `describe` all compute it: the view's own title, else the
 * presentation's `titleFor`, else its title, else the raw app id. One
 * spelling, so "close the Gold Coins tile" never misses.
 */
export function labelOfView(view: AppView, presentation: AppPresentation | null): string {
  return view.title || presentation?.titleFor?.(view) || presentation?.title || view.appId;
}

/** The manifests of a list of apps, for `createWorkbenchCore({ apps })`. */
export function manifestsOf(apps: readonly WorkbenchApp[]): WorkbenchAppManifest[] {
  return apps.map((app) => app.manifest);
}
