# Changelog

## 2026-08-21

- Initial workspace created


## 2026-08-21

Opened the ticket; Step 1 of the diary records the evidence base (AGENT-1/2 docs and diaries, the as-built workbench tools, vm-system frontend plugin-runtime) and the scope settled with the user: agent-written programs in the definePlugin dialect rendered as tiles, agent-defined actions on presentation types persisted in localStorage, eval engine acceptable for v1.


## 2026-08-21

Step 2: wrote design-doc/01, a ~1390-line intern guide: nine gestures, five systems (with the as-built AGENT-2 state), the reactive sandbox pattern from vm-system's source file by file, a ten-row gap table, the design (definePlugin dialect with ref/meter/callout/select and dispatchVerb; eval engine now and QuickJS later behind one ProgramEngine; PBUI-atoms renderer; a localStorage program library separate from the layout; generated actions as data with three behaviours; seven sandbox_* frontend tools incl. sandbox_test; program/action types and five generic verb kinds; a sandbox block in the vocabulary; limits, policy and a per-engine trust table; D1-D14), six implementation phases with pseudocode, seed programs, five sequences, sixteen failure modes, tests, API/port/file references, open questions, glossary.


## 2026-08-21

Step 3: related 23 files, rewrote index.md, docmgr doctor clean, uploaded the guide+diary bundle to reMarkable at /ai/2026/08/21/PBUI-AGENT-3 (commit 65b7def)


## 2026-08-21

Phases 0-1 built (cc11ecf, d03fd7c, 48442ff): @hyperslop-systems/pbui-sandbox — bootstrap, validators, ProgramEngine, eval engine with throwing forbidden globals, conformance suite; PBUI-atoms renderer, localStorage library, view-keyed state, useProgramInstance host loop, ScriptTile/createScriptApp; demo seeded with two programs and launcher rows. Browser acceptance: counter tile renders, increments, linked placements share state, reload restores tiles with state reset. Defect found and fixed: inline callbacks made the host loop a busy loop.

### Related Files

- /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/packages/pbui-chat/demo/src/sandbox.ts — Library, engine, state store, binding resolver, seeds
- /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/packages/pbui-sandbox/src/engines/evalEngine.ts — The eval engine with throwing forbidden globals
- /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/packages/pbui-sandbox/src/host/useProgramInstance.ts — The host loop; callbacks through refs after the busy-loop defect


## 2026-08-21

Phases 2-3 built (1095567): seven sandbox_* frontend tools sharing one dry-run path behind a policy gate, attachSandbox, router provenance, the vocabulary's sandbox block and Go's generated '## Programs' prompt section, program/action types with descriptors, five verb kinds with local handlers, the registry wrapped with withGeneratedActions. Browser: a defined action appears in the product menu, opens the bound program tile, and the trace records program.open then action.run. Found: a server started before 'pnpm vocab' rejects the new kinds in the trace — restart it.

### Related Files

- /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/packages/pbui-chat/src/tools/sandboxTools.ts — The seven tools, the gate, the dry run
- /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/packages/pbui-sandbox/src/actions.ts — withGeneratedActions and substituteRef
- /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/pkg/pbuichat/prompt.go — sandboxSection and the worked example


## 2026-08-21

Phase 4 built (9f54d6e): scripted programScenario over a frontendTool helper (test → create → define action) using the prompt's exported worked example; two Go e2e tests with a fake browser; tool-level limits enforced in the dry run; honest sandbox_update_app result; guide R17/R18. Browser: the scripted gesture stores prg-3, opens it bound to 2049, defines act-2, traces program.open as agent.

### Related Files

- /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/pkg/chatserver/scripted/programs.go — The scripted program scenario
- /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/pkg/chatserver/server_test.go — answerFrontendTool and the two scenario e2e tests

