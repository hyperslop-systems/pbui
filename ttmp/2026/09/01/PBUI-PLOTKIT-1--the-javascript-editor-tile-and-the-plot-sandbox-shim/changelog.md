# Changelog

## 2026-09-01

- Initial workspace created


## 2026-09-01

Created the ticket (superseding the short-lived PBUI-EDITOR-1, whose editor design is folded in and expanded) and wrote the intern guide for @hyperslop-systems/pbui-editor plus the plot author shim in pbui-sandbox: five decision records, the CodeEditor API and its CodeMirror/React bridge, the token theme, the Mod+Shift+K conflict with the workbench rebalance chord, the full shim source, and the parity test that keeps it from drifting from plot/src/author.

### Related Files

- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/ttmp/2026/09/01/PBUI-PLOTKIT-1--the-javascript-editor-tile-and-the-plot-sandbox-shim/design-doc/01-the-editor-tile-and-the-plot-sandbox-shim-intern-architecture-and-implementation-guide.md — The primary deliverable


## 2026-09-01

Uploaded to reMarkable at /ai/2026/09/01/PBUI-PLOTKIT-1.


## 2026-09-01

Step 1-2: scaffolded packages/pbui-editor (commit 9bf8044) and implemented CodeEditor with the token theme, diagnostics gutter and 12 tests (commit 73c99fb). Found a second defaultKeymap collision beyond the designed one: Mod+Enter is insertBlankLine, so the run chord is Prec.highest.

### Related Files

- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/packages/pbui-editor/src/CodeEditor/CodeEditor.tsx — The component


## 2026-09-01

Step 3: plot author shim, ScriptResult guard and runPlotScript in pbui-sandbox, 99 new tests on both engines, plot as a devDependency with zero compiler code in the bundle (commit e3ae012). Design amendments found by reading the engine: scripts are synchronous and hand back a JSON string because __describe caps arrays at 200.

### Related Files

- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/packages/pbui-sandbox/src/plot/plotScript.ts — buildPlotScriptCode and runPlotScript; the comment states both engine facts


## 2026-09-01

Step 4: PlaygroundTile and SourceTile migrated onto CodeEditor with tests driving the CodeMirror view (commit 549c325); sandbox Storybook config and devtools stories added so the change can be seen (commit 7f8223d); four screenshots in reference/screenshots. Styling audit in the diary lists seven hard-coded radius/shadow values outside this ticket's scope.

### Related Files

- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/packages/pbui-sandbox/src/devtools/Devtools.stories.tsx — The stories the screenshots come from

