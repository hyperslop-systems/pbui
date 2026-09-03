import {
  connectDocumentSource,
  createManifestCatalog,
  createWorkbenchCore,
  createWorkbenchLinks,
  isManifestCatalog,
  type CreateWorkbenchCoreOptions,
  type ManifestCatalog,
  type WorkbenchAppManifest,
  type WorkbenchCore,
  type WorkbenchLinks,
} from "@hyperslop-systems/workbench-core";
import type { IdGenerator } from "@hyperslop-systems/workbench-protocol/client";
import { createDatalabController, LAUNCHER_APP_ID, type DatalabController } from "./controller";
import { graphicDocumentSource } from "./graphicSource";
import { makeStore, type AppStore, type MakeStoreOptions } from "./index";
import { navigationActions } from "./navigation";
import type { DatalabSeed } from "./seed";
import type { WorldState } from "./world";

/**
 * One Datalab workbench, headless (design §5.4, §9.3): the Redux store
 * (world, navigation), the workbench core over the seed's document, the
 * controller in front of both, and the graphic-document source keeping the
 * core's stubs in line with the world.
 *
 * ONE per workbench instance, never module-global: the landing page mounts
 * six, and placement ids may repeat across them. The React shell is built
 * over `core` by `appkit/workbench.ts`; nothing here imports React.
 *
 * ## Two subscriptions, both one-way
 *
 * The source watches the store and writes stubs into the core; the runtime
 * watches the core and repairs navigation metadata when the document's set
 * of workspaces changes. Neither reacts to the other's write with a write of
 * its own — a reconcile that finds nothing to do dispatches nothing, and a
 * sync with no mutations applies nothing — which is what keeps the pair from
 * feeding each other (§8.3, the stabilization ticket's reentrancy rule).
 */
export interface DatalabRuntimeOptions extends Pick<MakeStoreOptions, "fixtures" | "clipboard"> {
  seed: DatalabSeed;
  /** Restored world state to preload, if any. */
  world?: Partial<WorldState>;
  /** Give a world with no documents one; default true, as `makeStore`'s is. */
  seedDocuments?: boolean;
  apps: ManifestCatalog | readonly WorkbenchAppManifest[];
  ids?: IdGenerator;
  links?: WorkbenchLinks;
  onRefused?: CreateWorkbenchCoreOptions["onRefused"];
  onRejected?: CreateWorkbenchCoreOptions["onRejected"];
  onCommit?: CreateWorkbenchCoreOptions["onCommit"];
  /** Deep-freeze the exposed core state (the core's default outside production). */
  ownership?: CreateWorkbenchCoreOptions["ownership"];
}

export interface DatalabRuntime {
  store: AppStore;
  core: WorkbenchCore;
  controller: DatalabController;
  /** Disconnect the source and the reconcile subscription. */
  dispose(): void;
}

export function createDatalabRuntime(options: DatalabRuntimeOptions): DatalabRuntime {
  const apps = isManifestCatalog(options.apps) ? options.apps : createManifestCatalog(options.apps);
  let controller: DatalabController | null = null;
  const store = makeStore({
    preloaded: {
      ...(options.world ? { world: options.world } : {}),
      navigation: options.seed.navigation,
    },
    seed: options.seedDocuments,
    fixtures: options.fixtures,
    clipboard: options.clipboard,
    controller: () => {
      if (!controller) throw new Error("datalab: the workbench controller is not built yet");
      return controller;
    },
  });
  const core = createWorkbenchCore({
    initial: options.seed.document,
    apps,
    links: options.links ?? createWorkbenchLinks(),
    initialSession: { workspaceId: options.seed.workspaceId },
    // A bare split makes an empty launcher tile, and aiming a new tile at a
    // launcher's centre fills it rather than splitting it.
    policy: { duplicate: { app: LAUNCHER_APP_ID } },
    ...(options.ids ? { ids: options.ids } : {}),
    ...(options.ownership ? { ownership: options.ownership } : {}),
    ...(options.onRefused ? { onRefused: options.onRefused } : {}),
    ...(options.onRejected ? { onRejected: options.onRejected } : {}),
    ...(options.onCommit ? { onCommit: options.onCommit } : {}),
  });
  controller = createDatalabController({ store, core });

  // Keep navigation true for the document: a workspace the core gained or
  // lost (a command, a restore, a remote adoption) is filed or forgotten.
  let lastWorkspaces = "";
  const reconcile = () => {
    const ids = core.getState().document.workspaces.map((workspace) => workspace.id);
    const key = ids.join(" ");
    if (key === lastWorkspaces) return;
    lastWorkspaces = key;
    store.dispatch(navigationActions.reconcile(ids));
  };
  reconcile();
  const unsubscribeCore = core.subscribe(reconcile);
  const disconnectSource = connectDocumentSource(
    core,
    graphicDocumentSource(() => store.getState().world, store.subscribe),
  );

  return {
    store,
    core,
    controller,
    dispose() {
      unsubscribeCore();
      disconnectSource();
    },
  };
}
