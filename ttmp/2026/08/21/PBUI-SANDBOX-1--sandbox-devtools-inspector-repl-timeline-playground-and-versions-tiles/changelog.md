# Changelog

## 2026-08-21

- Initial workspace created


## 2026-08-21

Step 1: ticket opened; intern guide (design D1–D12, phases 0–6, R1–R14) and diary step 1 written

### Related Files

- /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/packages/pbui-sandbox/src/host/useProgramInstance.ts — The hook the registry is fed from


## 2026-08-21

Phase 0 (commit 62bf01a): createInstanceRegistry (snapshots by view, timeline ring, selection, handles), SandboxHost, hook publishes timings and structured entries and drops its string log, renderer node paths + highlightPath, demo wired; 67 sandbox / 110 chat tests

### Related Files

- /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/packages/pbui-sandbox/src/instances.ts — The registry (commit 62bf01a)


## 2026-08-21

Phase 1 (commit 850089b): Program Inspector tile (state/bindings/tree/meta panes, hover highlight, fire handlers, apply/reset state), createSandboxDevtools, snapshot.globalState; 71 sandbox tests

### Related Files

- /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/packages/pbui-sandbox/src/devtools/InspectorTile/InspectorTile.tsx — The inspector (commit 850089b)


## 2026-08-21

Phase 2 (commit a57e818): ProgramEngine.evaluate implemented once in the bootstrap (direct eval, $-helpers, __describe markers), eval + QuickJS + worker protocol, evaluateMs limit, 5 conformance cases on both engines + a QuickJS REPL-timeout case; REPL tile (target follows the selection, history, render-here, set as state, apply intents, re-render); 86 sandbox tests

### Related Files

- /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/packages/pbui-sandbox/src/bootstrap.ts — evaluate + __describe, BOOTSTRAP_VERSION 2 (commit a57e818)

