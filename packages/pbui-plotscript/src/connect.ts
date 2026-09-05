import type { WorkbenchCore } from "@hyperslop-systems/workbench-core";
import { plotScriptMutation, readPlotScript } from "./document";
import type { PlotScriptHost } from "./host";

/**
 * Persist successful runs into the workbench document.
 *
 * This lives at the WORKBENCH level, not in a tile, because a run can publish
 * after the tile that started it has unmounted — the runner keeps going, the
 * plot may even show the result, and a tile-owned effect would never write
 * the document, so a reload would silently restore the previous source
 * (review finding P1 on PR #22). The runner's `onPublish` fires only for
 * published runs, so a stale run cannot write either.
 *
 * The write happens only when a run succeeded and produced a source that
 * differs from what the document holds, preserving the invariant that
 * `PlotScriptDoc.source` is always "what the plot shows". Call once per
 * workbench, next to `createWorkbench` (pass `workbench.core`); the returned function disconnects.
 */
export function connectPlotScriptDocuments(core: WorkbenchCore, host: PlotScriptHost): () => void {
  return host.runner.onPublish((id, source, state) => {
    if (state.status !== "ok") return;
    const script = readPlotScript(core.getState().document, id);
    if (!script || script.source === source) return;
    core.apply([plotScriptMutation({ ...script, source, updatedAt: new Date().toISOString() })]);
  });
}
