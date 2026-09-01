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


## 2026-09-01

Step 4: the three worked examples as seeded documents with an integration test each, and the demo app with one workspace per example persisted to localStorage (commits 48bb255, ad79e72); three demo screenshots. The accessibility snapshot exposed a missing data.identity in every example.

### Related Files

- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/packages/pbui-plotscript/demo/src/workbench.ts — seedDocument and persistence


## 2026-09-01

Step 5: six showcase examples (D histogram+density, E intervals+boxplot, F facets, G stack/fill/polar, H log+guides+annotations, I derived+aesthetics) and multi-plot tiles — a script may return a list, drawn as a grid; shim v2 gained annotation/coordinate/guide/transform (commits 8ece301, daa55f1). Six more demo screenshots. Answers the two user questions in code.

### Related Files

- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/packages/pbui-plotscript/src/examples.ts — The nine-example showcase


## 2026-09-01

Step 6: QuickJS runner test, nine-script serialize round-trip, README, design amendments section 15; every suite on the branch green (commit 6b34bf9). Ticket to review; version history (keqb) deliberately left open.

### Related Files

- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/packages/pbui-plotscript/README.md — The package charter


## 2026-09-01

Step 7: PR #22 review round. P1: document persistence moved from a ScriptTile effect to connectPlotScriptDocuments over the runner's new onPublish listener, proven with no component mounted. P2: the demo reset clears drafts and runner state; tiles re-seed via a run.status dependency. 32 package tests.

### Related Files

- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/packages/pbui-plotscript/src/connect.ts — The workbench-level persistence connector

