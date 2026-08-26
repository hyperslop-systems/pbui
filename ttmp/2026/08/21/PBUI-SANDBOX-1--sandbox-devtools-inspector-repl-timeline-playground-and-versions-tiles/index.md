---
Title: 'Sandbox devtools: inspector, REPL, timeline, playground and versions tiles'
Ticket: PBUI-SANDBOX-1
Status: active
Topics:
    - pbui
    - chat
    - frontend
    - onboarding
DocType: index
Intent: long-term
Owners: []
RelatedFiles:
    - Path: repo://packages/pbui-sandbox/src/host/useProgramInstance.ts
      Note: The host loop; everything the devtools observe is published from here
    - Path: repo://packages/pbui-sandbox/src/bootstrap.ts
      Note: Gains `evaluate`, the REPL's door, so both engines behave alike
    - Path: repo://packages/pbui-sandbox/src/library.ts
      Note: Gains `history` and `rollback` for the versions tile
    - Path: repo://packages/pbui-chat/demo/src/workbench.ts
      Note: Where the devtools are registered in the demo
ExternalSources:
    - https://github.com/go-go-golems/vm-system/
Summary: 'Follow-up to PBUI-AGENT-3. Makes every running agent-written program observable and addressable through an instance registry (the "selected sandbox"), adds an `evaluate` door to the engines, and builds five workbench tiles on pbui atoms: Program Inspector (state, bindings, render tree, fire handlers), REPL (evaluate and inject into the selected sandbox), Dispatch Timeline (every load/render/event/intent/error across instances), Playground (a persisted draft run live, saved into the library) and Source & Versions (history, diff, rollback). Contains the intern guide and the diary.'
LastUpdated: 2026-08-21T16:55:00-04:00
WhatFor: Landing page for PBUI-SANDBOX-1; start here to find the guide, the diary and the phase breakdown.
WhenToUse: When picking up, implementing or reviewing the sandbox devtools work.
---

# Sandbox devtools: inspector, REPL, timeline, playground and versions tiles

## Overview

`PBUI-AGENT-3` let the chat agent write programs that run as tiles. Once a program runs, nothing shows what it is doing: its state, trees, intents and timings live inside the one React hook that runs it. This ticket adds the host-side machinery to observe and drive running programs and five tiles on top of it:

1. **Instance registry** (prerequisite) — a store keyed by view id that every `useProgramInstance` publishes into: status, meta, trees, error, timings, a control handle, and one global structured timeline. It also holds *the selected sandbox*, set when a program tile is focused.
2. **Program Inspector** — doc-bound to `program`: editable state, resolved bindings, the render tree as an outline with hover-highlight and *fire handler*, meta and timings.
3. **REPL** — singleton, targets the selected sandbox: evaluates code *inside* the live instance through a new `ProgramEngine.evaluate` implemented once in the bootstrap (direct `eval`, so the eval and QuickJS engines expose the same scope and helpers `$plugin $ui $state $global $render $event`); results render as JSON or as a UI tree; injections (`$plugin.widgets.main.handlers.x = …`) take effect on *re-render*.
4. **Dispatch Timeline** — singleton: every load, render, event, intent, error and evaluation across all instances with durations against the limits; filters, pause, *copy as `sandbox_test` events*.
5. **Playground** — singleton: a persisted draft run as a live instance (clickable, REPL-able), a bindings picker, save-as-new / update / load-from / ask-the-agent.
6. **Source & Versions** — doc-bound to `program`: source with line numbers, `history` on the record, a line diff between versions, rollback as an ordinary update.

No new verb kinds, no vocabulary or prompt change, no Go change. `sandbox_describe` gains a `running` list per program.

**Read in this order**

1. [design-doc/01 — Intern guide](./design-doc/01-intern-guide-observing-driving-and-editing-running-programs-the-instance-registry-and-five-devtools-tiles.md): the scenes (§1), the system as it stands with file anchors (§2), the gap table (§3), the design with decision records D1–D12 (§4), six phases (§5), sequences (§6), failure modes R1–R14 (§7), testing (§8), API and file references (§9–§10).
2. [reference/01 — Diary](./reference/01-diary.md): what was read, what was decided, and every failure as it happened.

Background: `PBUI-AGENT-3` (the sandbox itself and its guide), `PBUI-AGENT-2` (workbench tools, policy), `PBUI-WORKBENCH-1/2` (the app model).

## Status

All six phases built and verified in the browser (diary steps 2–8, screenshots `various/01`–`07`): the instance registry and `SandboxHost` (Phase 0), the Program Inspector (1), `ProgramEngine.evaluate` and the REPL (2), the Dispatch Timeline (3), the Playground (4), Source & Versions with `history`/`rollback` (5), and `running[]` in `sandbox_describe` plus docs (6). 103 tests in `pbui-sandbox`, 111 in `pbui-chat`. Along the way the timeline exposed and the ticket fixed a reload race in the host hook (guide R15). Storybook stories were not written (the package has no storybook config). See [tasks.md](./tasks.md).

## Topics

- pbui
- chat
- frontend
- onboarding

## Tasks

See [tasks.md](./tasks.md) for the current task list.

## Changelog

See [changelog.md](./changelog.md) for recent changes and decisions.

## Structure

- design-doc/ - The intern guide
- reference/ - The diary
- playbooks/ - Command sequences and test procedures
- scripts/ - Temporary code and tooling
- various/ - Screenshots and working notes
- archive/ - Deprecated or reference-only artifacts
