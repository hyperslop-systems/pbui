import type { ComponentType } from "react";
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

/**
 * The application contract (the datalab `AppDescriptor`, minus its Redux).
 *
 * A tile names an application by id and nothing more, so swapping two tiles
 * is a two-field exchange and the application's state lives wherever the
 * product keeps it — a chat store, a server, a document — never in the tile.
 */
export interface AppDescriptor {
  id: string;
  title: string;
  /** A CSS custom-property reference such as `var(--pbui-tone-chat)`; never a colour literal. */
  tone: string;
  /**
   * May the layout hold at most one logical view of this application? True
   * for applications that are a pure function of shared state — a second
   * trace tile renders the same pixels forever. The launcher offers a placed
   * singleton as "go to", and a split of its tile links a second placement to
   * the same view rather than minting another.
   */
  singleton: boolean;
  /** Does the split button duplicate this application's tile? Defaults to `!singleton`. */
  duplicable?: boolean;
  /**
   * The application is a view OF a document named in `view.documents`; the
   * workbench then treats a second `openView` with identical bindings as
   * "go to the existing tile" rather than a second one.
   */
  docBound?: boolean;
  /** The title of ONE view; defaults to `title`. Receives the bindings so a doc-bound app can name its document. */
  titleFor?(view: AppView): string;
  Component: ComponentType<AppProps>;
}

export interface DefineAppInput extends Omit<AppDescriptor, "duplicable" | "docBound"> {
  duplicable?: boolean;
  docBound?: boolean;
}

/** Normalise the optional fields so readers never branch on `undefined`. */
export function defineApp(input: DefineAppInput): AppDescriptor {
  return {
    ...input,
    duplicable: input.duplicable ?? !input.singleton,
    docBound: input.docBound ?? false,
  };
}

export interface AppRegistry {
  get(id: string): AppDescriptor | null;
  list(): AppDescriptor[];
}

/**
 * An explicit list, never import-side-effect registration: the product says
 * which applications this workbench offers, and a test can build a registry
 * of two fakes without importing the product.
 */
export function createAppRegistry(apps: readonly AppDescriptor[]): AppRegistry {
  const byId = new Map<string, AppDescriptor>();
  for (const app of apps) {
    if (byId.has(app.id)) throw new Error(`pbui-workbench: application "${app.id}" is registered twice`);
    byId.set(app.id, app);
  }
  return {
    get: (id) => byId.get(id) ?? null,
    list: () => [...byId.values()],
  };
}

export function isAppRegistry(value: readonly AppDescriptor[] | AppRegistry): value is AppRegistry {
  return !Array.isArray(value) && typeof (value as AppRegistry).get === "function";
}
