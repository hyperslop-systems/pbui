import type { ComponentType } from "react";
import { definePorts, documentSlotsOf, hasDocumentSlot, type PortDeclaration, type PortDeclarationInput } from "@hyperslop-systems/pbui";
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
   * Typed ports (PBUI-LINK-1). Absent or empty ⇒ the application takes part
   * in no linking. A port marked `documentSlot` is a slot of `view.documents`
   * and makes the application DOC-BOUND: the workbench then treats a second
   * `openView` with identical bindings as "go to the existing tile", the
   * launcher offers the application only through `openView`, and
   * `describeWorkbench` reports the slot so an agent knows what to bind.
   * The old `docBound` and `bindings` fields are derived: `isDocBound(app)`
   * and `documentSlots(app)`.
   */
  ports?: readonly PortDeclaration[];
  /** The title of ONE view; defaults to `title`. Receives the bindings so a doc-bound app can name its document. */
  titleFor?(view: AppView): string;
  /**
   * Which launcher group the application is offered in. The default rows
   * model puts everything without one in "NEW TILE"; a product with twenty
   * applications gives them two or three groups instead.
   */
  group?: string;
  /** One line under the title in the launcher, so a name that is not self-explanatory can explain itself. */
  blurb?: string;
  /**
   * May the LAUNCHER'S ROWS offer this application right now, and nothing
   * else? Datalab's app scoping as a predicate. It gates one list: a tile
   * whose layout already names an excluded application still renders it,
   * `place`/`open`/`replace` still place it, and a stored layout never
   * silently loses a tile because a predicate turned false.
   */
  available?(context: AppAvailability): boolean;
  Component: ComponentType<AppProps>;
}

/** What `available` is asked about. */
export interface AppAvailability {
  workspaceId: string;
}

export interface DefineAppInput extends Omit<AppDescriptor, "duplicable" | "ports"> {
  duplicable?: boolean;
  /** Declarations as written; `defineApp` normalizes them (`definePorts`). */
  ports?: readonly PortDeclarationInput[];
}

/** Is the application offered in this workspace's LAUNCHER? An app without a predicate always is. */
export function isAppAvailable(app: AppDescriptor, context: AppAvailability): boolean {
  return app.available?.(context) ?? true;
}

/** Is the application a view OF a document — does it declare a document-slot port? */
export function isDocBound(app: AppDescriptor): boolean {
  return hasDocumentSlot(app.ports);
}

/** The keys of `view.documents` the application reads: its document-slot port names, in declaration order. */
export function documentSlots(app: AppDescriptor): string[] {
  return documentSlotsOf(app.ports);
}

/** Normalise the optional fields so readers never branch on `undefined`. */
export function defineApp(input: DefineAppInput): AppDescriptor {
  const { ports, ...rest } = input;
  return {
    ...rest,
    duplicable: input.duplicable ?? !input.singleton,
    ...(ports && ports.length > 0 ? { ports: definePorts(ports) } : {}),
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
