import type { WorkbenchDocument } from "@hyperslop-systems/workbench-protocol";
import { createAppRegistry, isAppRegistry, type AppDescriptor, type AppRegistry } from "./apps";
import { WorkbenchLauncher } from "./components/Launcher";
import { WorkbenchSurface } from "./components/Surface";
import { WorkspaceStrip } from "./components/WorkspaceStrip";
import { WorkbenchContext } from "./context";
import { parseDocument, serializeDocument } from "./document";
import { createWorkbenchStore, useWorkbenchStore, type WorkbenchStore, type WorkbenchStoreOptions } from "./store";
import type { LauncherProps, SurfaceProps, Workbench, WorkspaceStripProps } from "./types";
import { createVerbHandlers, performWorkbenchVerb } from "./verbs";

export interface CreateWorkbenchOptions extends WorkbenchStoreOptions {
  /** The applications this workbench offers — a list, or a registry built with `createAppRegistry`. */
  apps: readonly AppDescriptor[] | AppRegistry;
  /** The starting layout: a document from `layout()`/`singleTile()`, or one restored from `serialize()`. */
  initial: WorkbenchDocument;
  /**
   * A product-owned store to back the shell with, instead of the one this
   * function would create. A Redux product passes an adapter here so its
   * slice stays the single source of truth; `onMutate`/`onRejected` are then
   * that store's business and are ignored.
   */
  store?: WorkbenchStore;
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
  const store =
    options.store ??
    createWorkbenchStore(initial, {
      ...(options.onMutate ? { onMutate: options.onMutate } : {}),
      ...(options.onRejected ? { onRejected: options.onRejected } : {}),
    });
  let rootElement: HTMLElement | null = null;
  const root = () => rootElement;
  const verbs = createVerbHandlers({ store, apps, root });

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
