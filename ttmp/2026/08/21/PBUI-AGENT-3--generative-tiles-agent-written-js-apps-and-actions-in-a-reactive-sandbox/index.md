---
Title: 'Generative tiles: agent-written JS apps and actions in a reactive sandbox'
Ticket: PBUI-AGENT-3
Status: active
Topics:
    - pbui
    - chat
    - frontend
    - backend
    - onboarding
DocType: index
Intent: long-term
Owners: []
RelatedFiles:
    - Path: repo://packages/pbui-chat/src/tools/workbenchTools.ts
      Note: The as-built model every sandbox_* tool follows (zod parameters, available(), one policy door)
    - Path: repo://packages/pbui-chat/src/createPbuiChat.tsx
      Note: Where the sandbox tools register; attachSandbox mirrors attachWorkbench
    - Path: repo://packages/pbui-workbench/src/apps.ts
      Note: AppDescriptor + bindings; the immutable registry is why programs are documents of one script app
    - Path: repo://src/presentation/registry.ts
      Note: The closed registry that withGeneratedActions wraps
    - Path: repo://pkg/pbuichat/prompt.go
      Note: Gains the generated sandbox section
    - Path: repo://packages/pbui-chat/demo/src/workbench.ts
      Note: Layout persistence; resetLayout() is why the program library is separate
ExternalSources:
    - https://github.com/go-go-golems/vm-system/
Summary: 'Ticket for letting the PBUI chat agent write small JavaScript programs in vm-system''s definePlugin dialect (pure render to a JSON UI tree, handlers that emit intents) that run in a browser sandbox and show as workbench tiles, and define new actions on presentation types persisted in localStorage. Contains the intern guide (analysis, design with fourteen decision records, six implementation phases) and the diary.'
LastUpdated: 2026-08-21T15:10:00-04:00
WhatFor: Landing page for PBUI-AGENT-3; start here to find the intern guide, the diary and the phase breakdown.
WhenToUse: When picking up, implementing or reviewing the generative-tiles work.
---

# Generative tiles: agent-written JS apps and actions in a reactive sandbox

## Overview

AGENT-1 made the PBUI chat agent speak objects; AGENT-2 let it read and rearrange
the screen. This ticket lets it **make new things for the screen**: the model
writes a small program in vm-system's `definePlugin` dialect — a pure `render`
from `(pluginState, globalState)` to a JSON `UINode` tree, and `handlers` that
emit intents instead of mutating anything — the browser validates it, stores it
in a `localStorage` **program library**, runs it inside a `script` tile through a
swappable **engine** (`eval` now, QuickJS-in-a-worker later, behind one
`ProgramEngine` interface), renders its tree with PBUI atoms, and turns its
intents into program state or into verbs through the existing router and trace.
The agent can also define **actions on presentation types** ("add *Days of
cover* to every product") as stored records — open a program, perform an
existing verb, or ask the agent — appended to menus by a registry wrapper and
reloaded on boot.

Three rules carry the design: a program is pure functions over JSON; intents are
the only egress and verbs the only effect; the vocabulary stays closed (two
types, five generic verb kinds; programs and actions are payloads).

**No new wire types; no changes to `pbui-workbench`, `workbench-protocol`,
`pkg/chatserver`, pinocchio, sessionstream or geppetto.** Go changes are the
prompt section and an optional `sandbox` block in the vocabulary.

**Read in this order**

1. [design-doc/01 — Intern guide](./design-doc/01-intern-guide-generative-tiles-agent-written-js-apps-and-actions-in-a-reactive-sandbox.md): gestures (§1), the five systems (§2), the reactive sandbox pattern from vm-system's source (§3), the gap table (§4), the design and D1–D14 (§5), six phases with pseudocode (§6), seeds (§7), sequences (§8), failure modes (§9), API/file references (§10–§11), open questions (§12).
2. [reference/01 — Diary](./reference/01-diary.md): what was read and why, the as-built state of AGENT-2, the mid-flight scope additions, how the guide was written and delivered.

Background, not repeated: `PBUI-AGENT-1` (the agent), `PBUI-WORKBENCH-1/2` (the tiles), `PBUI-AGENT-2` (the workbench tools) — **and AGENT-2's diary**, whose lessons this ticket inherits.

## Status

Phases 0–5 built and verified in the browser (see the diary, steps 4–7, and `various/01`–`07`): `@hyperslop-systems/pbui-sandbox` (eval and QuickJS engines behind one `ProgramEngine`, PBUI renderer, localStorage library, host loop, `script` tile, generated-action registry wrapper), the seven `sandbox_*` tools in `pbui-chat`, the demo's `program`/`action` types and five verb kinds, Go's `## Programs` prompt section and `sandbox` vocabulary block, the scripted `programScenario` with Go e2e tests. Phase 6 (a server-side goja dry-run) is optional and open. See [tasks.md](./tasks.md).

## Topics

- pbui
- chat
- frontend
- backend
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
- various/ - Working notes and research
- archive/ - Deprecated or reference-only artifacts
