# Tasks

## TODO

- [x] Phase 1: scaffold packages/pbui-editor from the pbui-workbench package config <!-- t:k14r -->
- [x] Phase 2: CodeEditor - CodeMirror view, controlled-value bridge with the identity guard, Compartments for readOnly/language <!-- t:4qwg -->
- [x] Phase 2: extensions.ts - line numbers, history, brackets, indent, javascript(), defaultKeymap MINUS deleteLine, Mod+Enter to onRun <!-- t:4v8x -->
- [x] Phase 2: theme.ts from pbui tokens; add the --pbui-syntax-* tokens to src/tokens.css <!-- t:6c0o -->
- [x] Phase 2: diagnostics.ts with out-of-range line clamping <!-- t:09ab -->
- [x] Phase 3: pbui-sandbox src/plot/authorShim.ts - the injected authoring API as source <!-- t:7ddg -->
- [x] Phase 3: scriptResult.ts - ScriptResult, ScriptResultProblem, checkScriptResult <!-- t:0bd1 -->
- [x] Phase 3: buildPlotScriptCode; verify it runs under eval AND quickjs-direct engines <!-- t:ltt8 -->
- [x] Phase 3: authorShim.test.ts - one parity case per exported plot/author constructor <!-- t:ckpv -->
- [x] Phase 3: add @hyperslop-systems/plot as a devDependency of pbui-sandbox; verify the bundle carries no plot code <!-- t:y2cy -->
- [x] Phase 4: migrate PlaygroundTile TextArea to CodeEditor <!-- t:chce -->
- [x] Phase 4: migrate SourceTile SourceListing to a read-only CodeEditor, keeping versions/diff/rollback <!-- t:jwpa -->
- [x] Phase 5: build, consumer:smoke, publish or link for PBUI-PLOTSCRIPT-1 <!-- t:x80a -->
