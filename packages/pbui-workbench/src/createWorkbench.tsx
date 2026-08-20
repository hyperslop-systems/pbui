import type { WorkbenchDocument } from "@hyperslop-systems/workbench-protocol";
import { createAppRegistry, isAppRegistry, type AppDescriptor, type AppRegistry } from "./apps";
import { WorkbenchLauncher } from "./components/Launcher";
import { WorkbenchSurface } from "./components/Surface";
import { WorkspaceStrip } from "./components/WorkspaceStrip";
import { WorkbenchContext } from "./context";
import { parseDocument, serializeDocument } from "./document";
import { createWorkbenchStore, useWorkbenchStore, type WorkbenchStore, type WorkbenchStoreOptions } from "./store";
import type { LauncherProps, SurfaceProps, Workbench, WorkspaceStripProps } from "./types";
import { createVerbHandlers, performWorkbenchVerb, type BindingConfig, type SplitPolicy } from "./verbs";

export interface CreateWorkbenchOptions extends WorkbenchStoreOptions {
  /** The applications this workbench offers — a list, or a registry built with `createAppRegistry`. */
  apps: readonly AppDescriptor[] | AppRegistry;
  /** The starting layout: a document from `layout()`/`singleTile()`, or one restored from `serialize()`. */
  initial: WorkbenchDocument;
  /**
   * A product-owned store to back the shell with, instead of the one this
   * function would create. A Redux product passes an adapter here so its
   * slice stays the single source of truth, and the adapter owns the
   * mutation hooks — so passing `store` AND `onMutate`/`onRejected` is a
   * construction error rather than a silent drop.
   */
  store?: WorkbenchStore;
  /**
   * What a bare split puts in the new pane: `"duplicate"` (the default),
   * `"link"`, `{ app }` for an empty pane showing that application, or a
   * function of the view being split. A singleton always links regardless.
   */
  splitPolicy?: SplitPolicy;
  /**
   * How a freshly placed tile finds a document to bind. Products whose
   * applications are all views OF something need this, or newly placed tiles
   * come up unbound and read as broken.
   */
  binding?: BindingConfig;
}

/**
 * A workbench with no server and no Redux: one document in a local store,
 * the protocol's verbs over it, and two components — the tile surface and
 * the launcher — bound to that store. Everything a PBUI product needs to
 * show its applications as tiles instead of fixed panels.
 */
export function createWorkbench(options: CreateWorkbenchOptions): Workbench {
  const apps = isAppRegistry(options.apps) ? options.apps : createAppRegistry(options.apps);
  const initial = options.initial;
  // Both, and one of them would do nothing. Silently ignoring the hooks cost
  // the C1 migration time spent wondering why its outbox never filled; the
  // fix is to make the illegal combination unrepresentable at the door.
  if (options.store && (options.onMutate || options.onRejected)) {
    throw new Error(
      "pbui-workbench: createWorkbench({ store }) owns its own mutation hooks — " +
        "pass onMutate/onRejected to createWorkbenchStore, or to your adapter, not here",
    );
  }
  const store =
    options.store ??
    createWorkbenchStore(initial, {
      ...(options.onMutate ? { onMutate: options.onMutate } : {}),
      ...(options.onRejected ? { onRejected: options.onRejected } : {}),
    });
  let rootElement: HTMLElement | null = null;
  const root = () => rootElement;
  const verbs = createVerbHandlers({
    store,
    apps,
    root,
    ...(options.splitPolicy ? { splitPolicy: options.splitPolicy } : {}),
    ...(options.binding ? { binding: options.binding } : {}),
  });

  const workbench: Workbench = {
    apps,
    store,
    verbs,
    useDocument: () => useWorkbenchStore(store, (state) => state.document),
    useWorkbenchState: (selector) => useWorkbenchStore(store, selector),
    mutate: (mutations) => store.mutate(mutations),
    perform: (verb) => performWorkbenchVerb(verbs, verb),
    serialize: () => serializeDocument(store.getState().document),
    restore: (json) => {
      const doc = parseDocument(json);
      if (!doc) return false;
      store.replaceDocument(doc);
      return true;
    },
    reset: () => store.replaceDocument(initial),
    activePlacementId: () => store.getState().activePlacementId,
    root,
    setRoot: (element) => {
      rootElement = element;
    },
    focusPlacement: (placementId) => {
      // A frame later: the verb has committed the document but React has not
      // rendered the new tile yet, so the element does not exist on this tick.
      const focus = () => {
        const escaped =
          typeof CSS !== "undefined" && typeof CSS.escape === "function"
            ? CSS.escape(placementId)
            : placementId.replace(/"/g, '\\"');
        const frame = (rootElement ?? globalThis.document)?.querySelector(`[data-placement-id="${escaped}"]`);
        // The tile CELL, not the application inside it: focusing a button the
        // product happens to render first would steal the caret and read as
        // random. The cell is programmatically focusable only (tabIndex -1),
        // so Tab then moves forward into the application.
        const cell = frame?.closest<HTMLElement>('[data-part="workbench-tile"]');
        cell?.focus?.();
      };
      if (typeof requestAnimationFrame === "function") requestAnimationFrame(focus);
      else setTimeout(focus, 0);
    },
    Surface: function Surface(props: SurfaceProps) {
      return (
        <WorkbenchContext.Provider value={workbench}>
          <WorkbenchSurface {...props} />
        </WorkbenchContext.Provider>
      );
    },
    Launcher: function Launcher(props: LauncherProps) {
      return (
        <WorkbenchContext.Provider value={workbench}>
          <WorkbenchLauncher {...props} />
        </WorkbenchContext.Provider>
      );
    },
    WorkspaceStrip: function Strip(props: WorkspaceStripProps) {
      return (
        <WorkbenchContext.Provider value={workbench}>
          <WorkspaceStrip {...props} />
        </WorkbenchContext.Provider>
      );
    },
  };
  return workbench;
}
