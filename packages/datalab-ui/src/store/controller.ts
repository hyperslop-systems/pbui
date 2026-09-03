import { create } from "@bufbuild/protobuf";
import {
  AppViewSchema,
  MutationSchema,
  type Mutation,
  type Workspace,
} from "@hyperslop-systems/workbench-protocol";
import { leaves } from "@hyperslop-systems/workbench-protocol/client";
import {
  commands,
  type Axis,
  type ExecuteResult,
  type LayoutSpec,
  type WorkbenchCommand,
  type WorkbenchCore,
} from "@hyperslop-systems/workbench-core";
import type { AppStore } from "./index";
import {
  currentStageId as stageOfWorkspace,
  landingWorkspaceOf,
  navigationActions,
  stageOf,
  workspacesOfStage,
  type NavigationState,
  type StageChrome,
  type StageDefinition,
} from "./navigation";

/**
 * The Datalab workbench controller (design §5.4, §5.5, §8): the product's
 * one door to the workbench, in front of the core's commands.
 *
 * Two things live here and nowhere else. First, the PRODUCT POLICY that is
 * not a workbench rule — a pinned workspace cannot be renamed or deleted,
 * every stage keeps at least one workspace, a stage cannot be stranded — is
 * checked before a command reaches the core, and refused with a code the
 * caller can show. The core would happily rename `ws-account`; "pinned" is
 * not in the protocol. Second, the operations that change the workbench
 * document AND the navigation metadata together — create, clone, delete and
 * move a workspace; add and remove a stage — are sequenced here so that
 * metadata is written BEFORE the core command and rolled back on refusal
 * (§8.3): the core's install notifies subscribers synchronously, and a
 * reconcile that ran between "workspace exists" and "metadata written"
 * would file the new workspace under `work` for one notification.
 *
 * Headless: no React, no DOM. `execute` is injectable so the React layer can
 * pass the shell's geometry-measuring executor; the controller never
 * measures anything itself.
 */

export type ControllerResult = ExecuteResult;

const refused = (code: string, because: string): ControllerResult => ({ ok: false, code, because });

export interface CreateWorkspaceOptions {
  /** Default: the current stage. */
  stageId?: string;
  /** Default "workspace". */
  name?: string;
  /** Default: one launcher tile. */
  spec?: LayoutSpec;
  /** Default: select when the workspace lands in the current stage — a workspace added to ANOTHER stage does not steal the pointer. */
  select?: boolean;
  /** Narrow the workspace's application list from the start. */
  apps?: string[] | null;
}

/** What a tile should show after a replace or a split: a new view of an application, or an existing view. */
export type ShowRequest =
  | { kind: "application"; appId: string; docId?: string | null; title?: string }
  | { kind: "existing"; viewId: string };

export interface DatalabController {
  readonly core: WorkbenchCore;
  readonly store: AppStore;
  /** Execute through the injected executor (the shell's, when there is one). */
  execute(command: WorkbenchCommand | readonly WorkbenchCommand[]): ExecuteResult;

  /* ------------------------------------------------------ navigation -- */
  currentStageId(): string;
  currentStage(): StageDefinition | undefined;
  /** The document's workspaces belonging to one stage, in document order. */
  workspacesOfStage(stageId: string): Workspace[];
  selectWorkspace(workspaceId: string): ControllerResult;
  /** Land on the stage's remembered workspace, else its first (§11.1). */
  selectStage(stageId: string): ControllerResult;

  /* ------------------------------------------------------ workspaces -- */
  createWorkspace(options?: CreateWorkspaceOptions): ControllerResult;
  removeWorkspace(workspaceId: string): ControllerResult;
  renameWorkspace(workspaceId: string, name: string): ControllerResult;
  cloneWorkspace(workspaceId: string): ControllerResult;
  moveWorkspaceToStage(workspaceId: string, stageId: string): ControllerResult;
  setWorkspaceApps(workspaceId: string, apps: readonly string[] | null): ControllerResult;

  /* ---------------------------------------------------------- stages -- */
  addStage(name: string, apps?: readonly string[] | null, chrome?: StageChrome): ControllerResult;
  removeStage(stageId: string): ControllerResult;
  renameStage(stageId: string, name: string): ControllerResult;

  /* ----------------------------------------------- tiles and views -- */
  /** Split a tile; with an application named, the new pane shows a fresh view of it, else an empty launcher. */
  splitTile(
    placementId: string,
    axis: Axis,
    show?: Extract<ShowRequest, { kind: "application" }>,
  ): ControllerResult;
  /** A second, independent view: same application, same documents, a copied label. */
  duplicateView(placementId: string, axis?: Axis): ControllerResult;
  /** A second placement of the same view. */
  createLinkedDuplicate(placementId: string, axis?: Axis): ControllerResult;
  /** Change what a tile shows, in place. */
  replacePlacement(placementId: string, show: ShowRequest): ControllerResult;
  renameView(viewId: string, title: string): ControllerResult;
  /** Point a view at a document (or, with null, un-point it) under one binding role. */
  rebindView(viewId: string, docId: string | null, role?: string): ControllerResult;
  removePlacement(placementId: string): ControllerResult;
  /** Remove every placement of a view everywhere; a workspace left empty gets a launcher tile (§8.2). */
  closeView(viewId: string): ControllerResult;
  setActivePlacement(placementId: string | null): ControllerResult;
}

export interface CreateDatalabControllerOptions {
  store: AppStore;
  core: WorkbenchCore;
  /** Default `core.execute`; the React layer passes the shell's executor so geometry is measured. */
  execute?(command: WorkbenchCommand | readonly WorkbenchCommand[]): ExecuteResult;
}

/** The application an empty pane shows. */
export const LAUNCHER_APP_ID = "launcher";

/** The mark a duplicated workspace's name carries. */
export const CLONE_SUFFIX = "′";

export function createDatalabController(
  options: CreateDatalabControllerOptions,
): DatalabController {
  const { store, core } = options;
  const execute = options.execute ?? ((command) => core.execute(command));
  const nav = (): NavigationState => store.getState().navigation;
  const document = () => core.getState().document;
  const session = () => core.getState().session;
  const workspaceIds = () => document().workspaces.map((workspace) => workspace.id);
  const stageIdOf = (workspaceId: string) => stageOfWorkspace(nav(), workspaceId);
  const currentStageId = () => stageIdOf(session().workspaceId);
  const workspacesOf = (stageId: string): Workspace[] => {
    const ids = new Set(workspacesOfStage(nav(), workspaceIds(), stageId));
    return document().workspaces.filter((workspace) => ids.has(workspace.id));
  };
  const remember = (workspaceId: string) => {
    store.dispatch(navigationActions.remember({ stageId: stageIdOf(workspaceId), workspaceId }));
  };
  const selectWorkspace = (workspaceId: string): ControllerResult => {
    const result = execute(commands.selectWorkspace(workspaceId));
    if (result.ok) remember(workspaceId);
    return result;
  };

  /**
   * A view of an application, respecting the singleton rule: a
   * `viewCardinality: "one"` application's existing view is reused; any
   * other application always gets a fresh view, as Datalab's reducers did.
   */
  const applicationView = (show: Extract<ShowRequest, { kind: "application" }>) => {
    const manifest = core.apps.get(show.appId);
    const documents: Record<string, string> = show.docId ? { primary: show.docId } : {};
    return {
      kind: "application" as const,
      appId: show.appId,
      documents,
      ...(show.title ? { title: show.title } : {}),
      reuse:
        manifest?.viewCardinality === "one" ? ("manifest-default" as const) : ("never" as const),
    };
  };

  const viewOfPlacement = (placementId: string) => {
    const state = core.getState();
    const viewId = state.index.viewByPlacementId.get(placementId);
    return viewId ? state.document.views[viewId] : undefined;
  };

  const controller: DatalabController = {
    core,
    store,
    execute,

    currentStageId,
    currentStage: () => stageOf(nav(), currentStageId()),
    workspacesOfStage: workspacesOf,
    selectWorkspace,
    selectStage(stageId) {
      if (!stageOf(nav(), stageId))
        return refused("unknown_stage", `stage "${stageId}" does not exist`);
      const landing = landingWorkspaceOf(nav(), workspaceIds(), stageId);
      if (!landing) return refused("empty_stage", `stage "${stageId}" has no workspace`);
      return selectWorkspace(landing);
    },

    createWorkspace(create = {}) {
      const stageId = create.stageId ?? currentStageId();
      if (!stageOf(nav(), stageId))
        return refused("unknown_stage", `stage "${stageId}" does not exist`);
      const workspaceId = core.ids("ws");
      const select = create.select ?? stageId === currentStageId();
      store.dispatch(
        navigationActions.putWorkspace({
          id: workspaceId,
          meta: { stageId, pinned: false, apps: create.apps ?? null },
        }),
      );
      const result = execute(
        commands.createWorkspace(
          create.name ?? "workspace",
          create.spec ?? { kind: "tile", appId: LAUNCHER_APP_ID },
          { workspaceId, select },
        ),
      );
      if (!result.ok) {
        store.dispatch(navigationActions.forgetWorkspace(workspaceId));
        return result;
      }
      if (select) remember(workspaceId);
      return { ...result, workspaceId };
    },

    removeWorkspace(workspaceId) {
      const meta = nav().workspace[workspaceId];
      if (!core.getState().index.workspaceById.has(workspaceId)) {
        return refused("unknown_workspace", `workspace "${workspaceId}" does not exist`);
      }
      if (meta?.pinned) return refused("pinned_workspace", "defined in code — cannot be deleted");
      const stageId = stageIdOf(workspaceId);
      const siblings = workspacesOf(stageId).filter((workspace) => workspace.id !== workspaceId);
      // At least one workspace per STAGE, not per document (DR-72).
      if (siblings.length === 0) {
        return refused(
          "last_workspace_in_stage",
          "the last workspace in a stage cannot be deleted",
        );
      }
      const leaving = session().workspaceId === workspaceId;
      const batch: WorkbenchCommand[] = leaving
        ? [commands.selectWorkspace(siblings[0]!.id), commands.deleteWorkspace(workspaceId)]
        : [commands.deleteWorkspace(workspaceId)];
      const result = execute(batch);
      if (!result.ok) return result;
      store.dispatch(navigationActions.forgetWorkspace(workspaceId));
      if (leaving) remember(siblings[0]!.id);
      return result;
    },

    renameWorkspace(workspaceId, name) {
      if (nav().workspace[workspaceId]?.pinned)
        return refused("pinned_workspace", "defined in code — cannot be renamed");
      if (!name.trim()) return refused("empty_name", "a workspace needs a name");
      return execute(commands.renameWorkspace(workspaceId, name));
    },

    cloneWorkspace(workspaceId) {
      const source = core.getState().index.workspaceById.get(workspaceId);
      if (!source) return refused("unknown_workspace", `workspace "${workspaceId}" does not exist`);
      const meta = nav().workspace[workspaceId];
      const stageId = stageIdOf(workspaceId);
      const newWorkspaceId = core.ids("ws");
      const select = stageId === currentStageId();
      // A copy is the user's, never code-defined, however it was made.
      store.dispatch(
        navigationActions.putWorkspace({
          id: newWorkspaceId,
          meta: { stageId, pinned: false, apps: meta?.apps ? [...meta.apps] : null },
        }),
      );
      const result = execute(
        commands.cloneWorkspace(workspaceId, {
          name: `${source.name}${CLONE_SUFFIX}`,
          newWorkspaceId,
          select,
        }),
      );
      if (!result.ok) {
        store.dispatch(navigationActions.forgetWorkspace(newWorkspaceId));
        return result;
      }
      if (select) remember(newWorkspaceId);
      return { ...result, workspaceId: newWorkspaceId };
    },

    moveWorkspaceToStage(workspaceId, stageId) {
      const meta = nav().workspace[workspaceId];
      if (!core.getState().index.workspaceById.has(workspaceId)) {
        return refused("unknown_workspace", `workspace "${workspaceId}" does not exist`);
      }
      if (!stageOf(nav(), stageId))
        return refused("unknown_stage", `stage "${stageId}" does not exist`);
      if (meta?.pinned) return refused("pinned_workspace", "defined in code — cannot be moved");
      const from = stageIdOf(workspaceId);
      if (from === stageId) return { ok: true, changed: false, workspaceId };
      // Do not strand the stage it is leaving.
      if (workspacesOf(from).length < 2) {
        return refused("last_workspace_in_stage", "the last workspace in a stage cannot be moved");
      }
      store.dispatch(navigationActions.moveWorkspace({ id: workspaceId, stageId }));
      if (session().workspaceId === workspaceId) {
        // The user stays in the stage they were in; the workspace left it.
        const landing = landingWorkspaceOf(nav(), workspaceIds(), from);
        if (landing) return selectWorkspace(landing);
      }
      return { ok: true, changed: true, workspaceId };
    },

    setWorkspaceApps(workspaceId, apps) {
      if (!nav().workspace[workspaceId])
        return refused("unknown_workspace", `workspace "${workspaceId}" does not exist`);
      store.dispatch(navigationActions.setWorkspaceApps({ id: workspaceId, apps }));
      return { ok: true, changed: true, workspaceId };
    },

    addStage(name, apps = null, chrome) {
      const stageId = core.ids("stage");
      store.dispatch(
        navigationActions.addStage({
          id: stageId,
          name,
          apps: apps === null ? null : [...apps],
          chrome: chrome ?? { masthead: true, workspaces: true, stageBar: true },
        }),
      );
      const result = controller.createWorkspace({ stageId, name: "build", select: true });
      if (!result.ok) store.dispatch(navigationActions.removeStage(stageId));
      return result;
    },

    removeStage(stageId) {
      const stage = stageOf(nav(), stageId);
      if (!stage) return refused("unknown_stage", `stage "${stageId}" does not exist`);
      // A code-defined stage never goes, and neither does the last one (DR-72).
      if (stage.pinned) return refused("pinned_stage", "defined in code — cannot be deleted");
      if (nav().stages.length < 2) return refused("last_stage", "the last stage cannot be deleted");
      const own = workspacesOf(stageId).map((workspace) => workspace.id);
      const batch: WorkbenchCommand[] = [];
      let landing: string | null = null;
      if (own.includes(session().workspaceId)) {
        const next = nav().stages.find((candidate) => candidate.id !== stageId)!;
        landing = landingWorkspaceOf(nav(), workspaceIds(), next.id);
        if (!landing)
          return refused("empty_stage", `stage "${next.id}" has no workspace to land on`);
        batch.push(commands.selectWorkspace(landing));
      }
      batch.push(...own.map((id) => commands.deleteWorkspace(id)));
      const result = execute(batch);
      if (!result.ok) return result;
      for (const id of own) store.dispatch(navigationActions.forgetWorkspace(id));
      store.dispatch(navigationActions.removeStage(stageId));
      if (landing) remember(landing);
      return result;
    },

    renameStage(stageId, name) {
      const stage = stageOf(nav(), stageId);
      if (!stage) return refused("unknown_stage", `stage "${stageId}" does not exist`);
      if (stage.pinned) return refused("pinned_stage", "defined in code — cannot be renamed");
      store.dispatch(navigationActions.renameStage({ stageId, name }));
      return { ok: true, changed: true };
    },

    splitTile(placementId, axis, show) {
      if (!show) return execute(commands.duplicate(placementId, axis));
      return execute({
        kind: "view.show",
        view: applicationView(show),
        placement: { kind: "split", target: placementId, axis },
      });
    },

    duplicateView(placementId, axis) {
      const view = viewOfPlacement(placementId);
      if (!view) return refused("unknown_placement", `placement "${placementId}" does not exist`);
      // The SAME documents, not copies; the label marked as a copy (DR-63).
      return execute({
        kind: "view.show",
        view: {
          kind: "application",
          appId: view.appId,
          documents: { ...view.documents },
          reuse: "never",
          ...(view.title ? { title: `${view.title} (copy)` } : {}),
        },
        placement: { kind: "split", target: placementId, ...(axis ? { axis } : {}) },
      });
    },

    createLinkedDuplicate(placementId, axis) {
      const view = viewOfPlacement(placementId);
      if (!view) return refused("unknown_placement", `placement "${placementId}" does not exist`);
      return execute({
        kind: "view.show",
        view: { kind: "existing", viewId: view.id },
        placement: { kind: "split", target: placementId, ...(axis ? { axis } : {}) },
      });
    },

    replacePlacement(placementId, show) {
      const view =
        show.kind === "existing"
          ? { kind: "existing" as const, viewId: show.viewId }
          : applicationView(show);
      return execute({
        kind: "view.show",
        view,
        placement: { kind: "replace", target: placementId },
      });
    },

    renameView(viewId, title) {
      return execute(commands.setTitle(viewId, title));
    },

    rebindView(viewId, docId, role = "primary") {
      const view = document().views[viewId];
      if (!view) return refused("unknown_view", `view "${viewId}" does not exist`);
      const documents: Record<string, string> = { ...view.documents };
      if (docId) documents[role] = docId;
      else delete documents[role];
      return execute(commands.rebind(viewId, documents));
    },

    removePlacement(placementId) {
      return execute(commands.close(placementId));
    },

    closeView(viewId) {
      const state = core.getState();
      if (!state.document.views[viewId])
        return refused("unknown_view", `view "${viewId}" does not exist`);
      const emptied = state.document.workspaces.filter((workspace) => {
        const own = leaves(workspace.tree);
        return (
          own.length > 0 &&
          own.every((leaf) => leaf.body.case === "leaf" && leaf.body.value.viewId === viewId)
        );
      });
      const batch: Mutation[] = [];
      let fallbackViewId = state.document.viewOrder.find((id) => id !== viewId);
      if (emptied.length > 0 || !fallbackViewId) {
        // A workspace left with nothing gets an empty launcher tile; the
        // protocol's `viewClose` needs the fallback to exist first.
        const fallback = create(AppViewSchema, {
          id: core.ids("v"),
          appId: LAUNCHER_APP_ID,
          documents: {},
        });
        batch.push(
          create(MutationSchema, { body: { case: "viewCreate", value: { view: fallback } } }),
        );
        fallbackViewId = fallback.id;
      }
      batch.push(
        create(MutationSchema, { body: { case: "viewClose", value: { viewId, fallbackViewId } } }),
      );
      const applied = core.apply(batch);
      if (!applied.ok) return refused(applied.code, applied.because);
      // A closed view cannot be renamed or replaced any more.
      store.dispatch(navigationActions.beginRename(null));
      store.dispatch(navigationActions.closeLauncher());
      return { ok: true, changed: applied.changed, viewId };
    },

    setActivePlacement(placementId) {
      return execute(commands.activate(placementId));
    },
  };

  return controller;
}
