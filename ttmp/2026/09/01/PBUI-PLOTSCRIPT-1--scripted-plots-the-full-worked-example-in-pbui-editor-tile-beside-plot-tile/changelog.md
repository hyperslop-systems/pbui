# Changelog

## 2026-09-01

- Initial workspace created


## 2026-09-01

Moved here from datalab (was DATALAB-PLOTSCRIPT-1) and retargeted: the worked example is built in pbui as a new @hyperslop-systems/pbui-plotscript package with a demo/ reference product, because pbui already has pbui-workbench and Datalab does not. Guide covers the plot compiler, the workbench view/placement model, the sandbox runtime, six decision records, the run loop with its staleness and last-good rules, and three worked scripts.

### Related Files

- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/ttmp/2026/09/01/PBUI-PLOTSCRIPT-1--scripted-plots-the-full-worked-example-in-pbui-editor-tile-beside-plot-tile/design-doc/01-scripted-plots-in-pbui-intern-architecture-design-research-and-implementation-guide.md — The primary deliverable


## 2026-09-01

Uploaded to reMarkable at /ai/2026/09/01/PBUI-PLOTSCRIPT-1.


## 2026-09-01

Step 1-2: scaffolded pbui-plotscript and its demo (commit b063aba); document as DocumentPayload, draft store, runner with stale-run ticket and lastGood, log capture added to the sandbox's buildPlotScriptCode; 10 tests (commit 126832d).

### Related Files

- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/packages/pbui-plotscript/src/runner.ts — The runner and its two rules


## 2026-09-01

Step 3: ScriptTile, PlotTile and createPlotScriptApps, tested inside a real workbench Surface (commit 2ff7f91); plot pane overflow fixed and stories split (commit 506c12a); four screenshots. Finding for the plot package: a data max of 25.1 is clipped at a niced 25 axis.

### Related Files

- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/packages/pbui-plotscript/src/ScriptTile/ScriptTile.tsx — The editor tile and its document-on-success rule

