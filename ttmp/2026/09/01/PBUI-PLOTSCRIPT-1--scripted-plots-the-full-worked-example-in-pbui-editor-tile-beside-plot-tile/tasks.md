# Tasks

## TODO

- [x] Phase 0: confirm PBUI-PLOTKIT-1 phases 1-3 are merged and pnpm -r build is green <!-- t:1a3e -->
- [x] Phase 1: scaffold packages/pbui-plotscript; add packages/pbui-plotscript/demo to pnpm-workspace.yaml <!-- t:9vl1 -->
- [x] Phase 2: document.ts - PlotScriptDoc as a DocumentPayload, modelled on rebalance/configDocument.ts <!-- t:a6z8 -->
- [x] Phase 2: store.ts - a useSyncExternalStore script store keyed by document id <!-- t:b9nq -->
- [x] Phase 2: runner.ts - debounce, buildPlotScriptCode, evaluate, checkScriptResult, run-id staleness, lastGood, log capture <!-- t:stbo -->
- [x] Phase 3: ScriptTile - CodeEditor plus run/auto toolbar and a diagnostics/logs pane <!-- t:lmwt -->
- [x] Phase 3: PlotTile - ResponsivePlot over lastGood, stale chip, empty state <!-- t:41kt -->
- [x] Phase 3: createPlotScriptApps(host) returning both AppDescriptors with bindings: [plot] <!-- t:x7a4 -->
- [x] Phase 4: examples.ts - the three worked scripts as seeded docs with versioned ids <!-- t:a0jm -->
- [x] Phase 4: demo/ Vite app - createWorkbench, one workspace per example <!-- t:5quf -->
- [ ] Phase 5: swap in createQuickJsEngine; byte and row budgets; serialize/restore round-trip <!-- t:ikup -->
- [ ] Phase 5: script version history modelled on library.rollback <!-- t:keqb -->
- [ ] Resolve OQ-1..OQ-6 <!-- t:et5f -->
