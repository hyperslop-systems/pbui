import { createWorkbench, manifestsOf, type WorkbenchShell } from "@hyperslop-systems/pbui-workbench";
import { createManifestCatalog, parseWorkbenchDocument, split, tile, workspaces } from "@hyperslop-systems/workbench-core";
import { applyMutations } from "@hyperslop-systems/workbench-protocol/client";
import { EXAMPLE_SCRIPTS, PLOT_BINDING, connectPlotScriptDocuments, createPlotScriptApps, createPlotScriptHost, plotScriptMutation, type PlotScriptHost } from "@hyperslop-systems/pbui-plotscript";

/**
 * One workspace per example, so the workspace strip is the example picker.
 * Each workspace is a script tile beside a plot tile over that example's
 * document; the scripts themselves ride in the document as DocumentPayloads,
 * which is why `serialize()` round-trips them for free.
 */
export const STORAGE_KEY = "pbui-plotscript-demo.workbench.v1";

export function seedDocument() {
  const doc = workspaces(
    EXAMPLE_SCRIPTS.map((script) => ({
      id: `ws-${script.id}`,
      name: script.name,
      spec: split("row", 0.48, tile("plot-script", { documents: { [PLOT_BINDING]: script.id } }), tile("plot-view", { documents: { [PLOT_BINDING]: script.id } })),
    })),
    { id: "plotscript-demo", name: "scripted plots" },
  );
  return applyMutations(doc, EXAMPLE_SCRIPTS.map(plotScriptMutation));
}

export function createDemoWorkbench(): { workbench: WorkbenchShell; host: PlotScriptHost; restored: boolean } {
  const host = createPlotScriptHost();
  const apps = createPlotScriptApps(host);
  const seed = seedDocument();
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {
    stored = null;
  }
  const parsed = parseWorkbenchDocument(stored, { apps: createManifestCatalog(manifestsOf(apps)) });
  const restored = parsed.ok ? parsed.document : null;
  const workbench = createWorkbench({
    apps,
    initial: restored ?? seed,
    // Once per COMMITTED batch: a script write, a split, a rename. Never for
    // launcher toggles — those are this browser's.
    onCommit() {
      try {
        localStorage.setItem(STORAGE_KEY, workbench.serialize());
      } catch {
        // Private mode, quota: the demo still works, it just does not remember.
      }
    },
  });
  // Successful runs persist into the document from the runner's own
  // lifecycle, so a run that finishes after its tile closed is not lost.
  connectPlotScriptDocuments(workbench.core, host);
  return { workbench, host, restored: restored !== null };
}
