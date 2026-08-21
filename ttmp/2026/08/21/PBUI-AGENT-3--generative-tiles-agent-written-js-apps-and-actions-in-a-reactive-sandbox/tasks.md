# Tasks

## TODO

- [x] Step 1: open the ticket, read AGENT-1/2, WORKBENCH-2, the as-built pbui code and vm-system plugin-runtime; settle scope (apps + actions, eval engine OK) <!-- t:074o -->
- [ ] Step 2: write the intern guide — analysis (systems, the reactive sandbox pattern, gaps), design (dialect, engines, renderer, library, actions, tools, safety, decisions), phased implementation, sequences, failure modes, tests, API and file references <!-- t:0uc8 -->
- [ ] Step 3: relate files, update changelog, run docmgr doctor, upload the guide bundle to reMarkable, final diary step <!-- t:hw81 -->
- [ ] Phase 0 (impl): packages/pbui-sandbox skeleton — contracts, bootstrap, eval engine, validators, ported tests <!-- t:qayo -->
- [ ] Phase 1 (impl): UINode→PBUI renderer, ProgramLibrary (localStorage), host loop hook, the script app; demo registration <!-- t:lycp -->
- [ ] Phase 2 (impl): sandbox_* frontend tools, program/action types + 4 verb kinds in the demo vocabulary, router handlers, prompt.go section, regenerated vocabulary.json <!-- t:z8a7 -->
- [ ] Phase 3 (impl): generated actions — library.actions, registry composition, action.run, sandbox_define_action <!-- t:y1bk -->
- [ ] Phase 4 (impl): scripted scenario, Go e2e over a bridged sandbox tool, sandbox_test, limits and error tiles <!-- t:j0xt -->
- [ ] Phase 5 (impl): QuickJS worker engine behind ProgramEngine; Playwright runaway-loop test <!-- t:jjo9 -->
- [ ] Phase 6 (optional): server-side dry-run of a program with goja (vm-system daemon or in-process) <!-- t:hp27 -->
