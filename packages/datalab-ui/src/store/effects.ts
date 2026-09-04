import { create } from "@bufbuild/protobuf";
import { MutationSchema, type AppView, type Mutation } from "@hyperslop-systems/workbench-protocol";
import { applyMutations } from "@hyperslop-systems/workbench-protocol/client";
import { workspaceCreateMutation } from "@hyperslop-systems/workbench-core";
import {
  describeBundle,
  measureBundle,
  parseBundle,
  type Bundle,
  type BundleKind,
} from "../model/portable";
import type { BundleSource, ImportTarget } from "../pbui/verbs";
import type { AppThunk } from "./index";
import {
  applyStageBundle,
  applyTileBundle,
  applyWorkspaceBundle,
  bundleForStage,
  bundleForTile,
  bundleForWorkspace,
  idsNeeded,
  type BundleState,
  type ImportedWorkspace,
} from "./bundles";
import type { DatalabController } from "./controller";
import { graphicStubMutation } from "./graphicSource";
import { durableNavigation, navigationActions } from "./navigation";
import { listTemplates, saveTemplate, type SaveResult } from "./templates";
import { newId, worldActions } from "./world";

/**
 * The verbs that end in a promise.
 *
 * `actionsForVerb` stays pure by *returning* one of these rather than running
 * it (DR-68): it is a thunk, and RTK's `dispatch` takes thunks, so the caller's
 * loop is unchanged in shape. The test that shows it builds a store with a
 * fake clipboard, dispatches the returned thunk and asserts on the JSON.
 *
 * **The only impure steps in the whole export/import path are `clipboard.write`
 * and `clipboard.read`, and both are parameters.** Building the bundle,
 * parsing it, minting documents and preparing the protocol batch are pure
 * functions of state and text, tested as such in `test/portable.test.ts`.
 */

export type ExportOutcome = { ok: true; bundle: Bundle } | { ok: false; reason: string };

/** The three stores a bundle is built from, captured at one moment. */
function bundleState(controller: DatalabController): BundleState {
  return {
    world: controller.store.getState().world,
    document: controller.core.getState().document,
    navigation: durableNavigation(controller.store.getState().navigation),
  };
}

/**
 * Copy something to the clipboard, and report the outcome.
 *
 * Two failures are distinguished on purpose. `bundleFor*` throws when the
 * object cannot be described — most importantly when the credential audit
 * fires — and `clipboard.write` throws when the platform refused. A user needs
 * to know which: the first is "this cannot be shared", the second is "try again".
 */
function exportBundle(build: (at: string) => Bundle): AppThunk<Promise<ExportOutcome>> {
  return async (dispatch, _getState, { clipboard }) => {
    let bundle: Bundle;
    try {
      // The timestamp is read HERE, in the impure layer, and passed into the
      // pure builder — the same rule `applyVerb`'s snapshot case follows.
      bundle = build(new Date().toISOString());
    } catch (error) {
      const reason = error instanceof Error ? error.message : "could not export";
      dispatch(
        navigationActions.showNotice({ ok: false, title: "Nothing was copied", body: reason }),
      );
      return { ok: false, reason };
    }
    try {
      await clipboard.write(JSON.stringify(bundle, null, 2));
    } catch (error) {
      const reason =
        error instanceof Error
          ? `the copy did not happen — ${error.message}`
          : "the copy did not happen";
      dispatch(
        navigationActions.showNotice({ ok: false, title: "Nothing was copied", body: reason }),
      );
      return { ok: false, reason };
    }
    dispatch(worldActions.noteExport(bundle.kind, bundle.name));
    // The confirmation states what a bundle contains AND what it does not,
    // once, at the moment the user is about to paste it somewhere.
    const measured = measureBundle(bundle);
    dispatch(
      navigationActions.showNotice({
        ok: true,
        title: "Copied to the clipboard",
        body:
          `${describeBundle(bundle)} ${Math.max(1, Math.round(measured.bytes / 1024))} kB. ` +
          "It names the sources these tiles read and the filters you set on them. " +
          "It contains no rows and no credentials.",
      }),
    );
    return { ok: true, bundle };
  };
}

export function exportTile(placementId: string): AppThunk<Promise<ExportOutcome>> {
  return (dispatch, getState, extra) =>
    exportBundle((at) => bundleForTile(bundleState(extra.controller()), placementId, at))(
      dispatch,
      getState,
      extra,
    );
}

export function exportWorkspace(workspaceId: string): AppThunk<Promise<ExportOutcome>> {
  return (dispatch, getState, extra) =>
    exportBundle((at) => bundleForWorkspace(bundleState(extra.controller()), workspaceId, at))(
      dispatch,
      getState,
      extra,
    );
}

export function exportStage(stageId: string): AppThunk<Promise<ExportOutcome>> {
  return (dispatch, getState, extra) =>
    exportBundle((at) => bundleForStage(bundleState(extra.controller()), stageId, at))(
      dispatch,
      getState,
      extra,
    );
}

/** The bundle kind an import target will accept. */
export function kindFor(target: ImportTarget): BundleKind {
  return target.kind === "tile" ? "tile" : target.kind === "workspace" ? "workspace" : "stage";
}

/**
 * Open the import dialog, prefilled only if the clipboard holds a bundle of the
 * right kind (DR-67). The empty path is *the* path and the prefill is the
 * optimisation: Firefox does not implement `readText` for web content at all.
 */
export function beginImport(target: ImportTarget): AppThunk<Promise<void>> {
  return async (dispatch, _getState, { clipboard }) => {
    const text = await clipboard.read();
    const usable = text !== null && text !== "" && parseBundle(text, kindFor(target)).ok;
    dispatch(
      navigationActions.openImport({
        target,
        prefill: usable ? (text as string) : "",
        from: usable ? "clipboard" : null,
      }),
    );
  };
}

/** Open the import dialog with text already in it — the template library's route in. */
export function beginImportWithText(target: ImportTarget, text: string): AppThunk {
  return (dispatch) => {
    dispatch(navigationActions.openImport({ target, prefill: text, from: "template" }));
  };
}

/* ------------------------------------------------------------ templates -- */

/**
 * Save something as a named template. "Copy this to the clipboard" and "save
 * this as a template" are the same code with a different sink (DR-71).
 */
export function storeTemplate(source: BundleSource, name: string): AppThunk<SaveResult> {
  return (dispatch, _getState, extra) => {
    const state = bundleState(extra.controller());
    const at = new Date().toISOString();
    let bundle: Bundle;
    try {
      bundle =
        source.kind === "tile"
          ? bundleForTile(state, source.nodeId, at)
          : source.kind === "workspace"
            ? bundleForWorkspace(state, source.spaceId, at)
            : bundleForStage(state, source.stageId, at);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "could not build that bundle";
      dispatch(
        navigationActions.showNotice({ ok: false, title: "Nothing was saved", body: reason }),
      );
      return { ok: false, reason };
    }

    const result = saveTemplate({ id: newId(), name, kind: bundle.kind, savedAt: at, bundle });
    dispatch(
      navigationActions.showNotice(
        result.ok
          ? {
              ok: true,
              title: "Saved as a template",
              body: `“${name}” — ${describeBundle(bundle)} Open the templates workspace on the account stage to load it.`,
            }
          : { ok: false, title: "Nothing was saved", body: result.reason },
      ),
    );
    return result;
  };
}

/** Load a stored template, through the import dialog rather than straight in (DR-71). */
export function loadTemplate(templateId: string, target: ImportTarget): AppThunk<boolean> {
  return (dispatch) => {
    const record = listTemplates().find((t) => t.id === templateId);
    if (!record) return false;
    dispatch(beginImportWithText(target, JSON.stringify(record.bundle, null, 2)));
    return true;
  };
}

/** Put a stored template on the clipboard, unchanged. */
export function copyTemplate(templateId: string): AppThunk<Promise<ExportOutcome>> {
  return (dispatch, getState, extra) => {
    const record = listTemplates().find((t) => t.id === templateId);
    if (!record) {
      return Promise.resolve<ExportOutcome>({ ok: false, reason: "that template is gone" });
    }
    return exportBundle(() => record.bundle)(dispatch, getState, extra);
  };
}

/* --------------------------------------------------------------- import -- */

export type CommitResult = { ok: true } | { ok: false; reason: string };

const viewCreate = (view: AppView): Mutation =>
  create(MutationSchema, { body: { case: "viewCreate", value: { view } } });

/**
 * Apply the text in the dialog (design §12.3).
 *
 * Three stores change, in dependency order: the world gets the minted
 * documents first (the graphic source writes their stubs into the core the
 * same tick), navigation gets the metadata a new workspace or stage needs
 * BEFORE the core's install can reconcile it, and the core gets one complete
 * batch. The batch is validated against a snapshot before anything is
 * touched, so a refusal leaves every store as it was; on the refusal that
 * cannot then happen, the minted documents are removed again rather than
 * left as silent library documents.
 *
 * A thunk rather than a reducer because it mints ids; the pure preparation
 * lives in `bundles.ts` and takes the ids from here.
 */
export function commitImport(text: string): AppThunk<CommitResult> {
  return (dispatch, getState, extra) => {
    const pending = getState().navigation.pendingImport;
    if (!pending) return { ok: false, reason: "there is no import in progress" };

    const parsed = parseBundle(text, kindFor(pending.target));
    if (!parsed.ok) return { ok: false, reason: parsed.reason };
    const bundle = parsed.bundle;
    const ids = Array.from({ length: idsNeeded(bundle) }, () => newId());
    const controller = extra.controller();
    const core = controller.core;

    const apply = (
      docs: Record<string, unknown>,
      mutations: Mutation[],
      before: () => void,
      undo: () => void,
      after: () => void,
    ): CommitResult => {
      // Stubs for the minted documents ride in the batch, so the batch is
      // self-contained: the pre-validation sees them, and the source's own
      // put for the same identity is idempotent.
      const batch = [...Object.keys(docs).map(graphicStubMutation), ...mutations];
      try {
        const candidate = applyMutations(core.snapshot(), batch);
        const checked = core.validateDocument(candidate);
        if (!checked.ok) {
          const first = checked.diagnostics[0];
          return {
            ok: false,
            reason: `that bundle does not fit here: ${first?.detail ?? first?.code}`,
          };
        }
      } catch (error) {
        return {
          ok: false,
          reason: error instanceof Error ? error.message : "that bundle does not apply",
        };
      }
      dispatch(worldActions.addDocs(docs as Parameters<typeof worldActions.addDocs>[0]));
      before();
      const applied = core.apply(batch);
      if (!applied.ok) {
        undo();
        for (const id of Object.keys(docs)) dispatch(worldActions.deleteDoc(id));
        return { ok: false, reason: applied.because };
      }
      after();
      dispatch(navigationActions.closeImport());
      return { ok: true };
    };

    if (pending.target.kind === "tile" && bundle.kind === "tile") {
      const target = pending.target.nodeId;
      const state = core.getState();
      const workspaceId = state.index.workspaceByNodeId.get(target);
      const shownViewId = state.index.viewByPlacementId.get(target);
      if (!workspaceId || !shownViewId) return { ok: false, reason: "that tile is gone" };
      const { viewId, docs, views } = applyTileBundle(bundle as Bundle<"tile">, ids);
      // The TARGET's placement id is kept: the tile is re-pointed, not
      // replaced, so a focus or a drag in flight stays valid. The view it
      // showed goes when nothing else shows it (`apply` has no orphan sweep).
      const orphaned = (state.index.placementsByViewId.get(shownViewId)?.length ?? 0) === 1;
      const mutations: Mutation[] = [
        ...views.map(viewCreate),
        create(MutationSchema, {
          body: { case: "placementReplace", value: { workspaceId, placementId: target, viewId } },
        }),
        ...(orphaned
          ? [
              create(MutationSchema, {
                body: { case: "viewDelete", value: { viewId: shownViewId } },
              }),
            ]
          : []),
      ];
      return apply(
        docs,
        mutations,
        () => undefined,
        () => undefined,
        () => undefined,
      );
    }

    if (pending.target.kind === "workspace" && bundle.kind === "workspace") {
      const { workspace, stageId, docs, views } = applyWorkspaceBundle(
        bundle as Bundle<"workspace">,
        pending.target.stageId,
        ids,
      );
      if (!getState().navigation.stages.some((stage) => stage.id === stageId)) {
        return { ok: false, reason: "that stage is gone" };
      }
      const mutations: Mutation[] = [
        ...views.map(viewCreate),
        workspaceCreateMutation(workspace.id, workspace.name, workspace.tree),
      ];
      const put = () =>
        dispatch(
          navigationActions.putWorkspace({
            id: workspace.id,
            meta: { stageId, pinned: false, apps: workspace.apps },
          }),
        );
      const forget = () => dispatch(navigationActions.forgetWorkspace(workspace.id));
      // A new workspace in ANOTHER stage does not steal the pointer.
      const select = () => {
        if (controller.currentStageId() === stageId) controller.selectWorkspace(workspace.id);
      };
      return apply(docs, mutations, put, forget, select);
    }

    if (pending.target.kind === "stage" && bundle.kind === "stage") {
      const { stage, workspaces, docs, views } = applyStageBundle(bundle as Bundle<"stage">, ids);
      if (workspaces.length === 0) return { ok: false, reason: "that stage has no workspaces" };
      const mutations: Mutation[] = [
        ...views.map(viewCreate),
        ...workspaces.map((workspace: ImportedWorkspace) =>
          workspaceCreateMutation(workspace.id, workspace.name, workspace.tree),
        ),
      ];
      const put = () => {
        dispatch(navigationActions.addStage(stage));
        for (const workspace of workspaces) {
          dispatch(
            navigationActions.putWorkspace({
              id: workspace.id,
              meta: { stageId: stage.id, pinned: false, apps: workspace.apps },
            }),
          );
        }
      };
      const forget = () => {
        for (const workspace of workspaces)
          dispatch(navigationActions.forgetWorkspace(workspace.id));
        dispatch(navigationActions.removeStage(stage.id));
      };
      const select = () => controller.selectWorkspace(workspaces[0]!.id);
      return apply(docs, mutations, put, forget, select);
    }
    // Unreachable: `parseBundle` was given the expected kind. Stated rather than
    // left to fall through, because a silent fall-through here would close the
    // dialog with nothing applied and no explanation.
    return { ok: false, reason: "that bundle does not fit here" };
  };
}
