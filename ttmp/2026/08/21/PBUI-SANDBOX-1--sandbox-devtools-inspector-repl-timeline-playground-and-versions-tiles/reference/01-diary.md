---
Title: Diary
Ticket: PBUI-SANDBOX-1
Status: active
Topics:
    - pbui
    - chat
    - frontend
    - onboarding
DocType: reference
Intent: long-term
Owners: []
RelatedFiles:
    - Path: repo://packages/pbui-sandbox/src/host/useProgramInstance.ts
      Note: Read in full before the design; the log, effects and instance id rules shaped D1, D2 and D11
    - Path: repo://packages/pbui-sandbox/src/engines/evalEngine.ts
      Note: The single-Function closure is why a direct eval in the bootstrap can reach the program (D3)
    - Path: repo://packages/pbui-sandbox/src/quickjs/runtimeService.ts
      Note: evalCode strings per call; the same pattern carries `evaluate`
    - Path: repo://packages/pbui-workbench/src/apps.ts
      Note: docBound/singleton semantics decided which tiles are which (D12)
    - Path: repo://packages/pbui-chat/test/no-raw-controls.test.ts
      Note: The structural rules every devtool must satisfy (TextArea, SelectInput, CheckboxRow from pbui)
ExternalSources: []
Summary: Chronological record of PBUI-SANDBOX-1 — the suggestion that became the ticket, the evidence gathered from the sandbox package and the workbench, the design decisions, and (as they happen) each implementation phase with its failures verbatim.
LastUpdated: 2026-08-21T16:10:00-04:00
WhatFor: Continuation and review; read this to know what was tried, what broke, and why the design is shaped as it is.
WhenToUse: When resuming a phase, reviewing a commit, or wondering why something is the way it is.
---

# Diary

## Goal

Record how the sandbox devtools — the instance registry and the five tiles (Inspector, REPL, Timeline, Playground, Source & Versions) — were designed and built on top of `PBUI-AGENT-3`, including every failure and the reasoning behind each decision.

## Step 1: From a suggestion list to a ticket and a guide

The user asked, after the AGENT-3 close-out, for a suggestion of tiles that would support the generative-tile feature; I proposed eight, with ASCII mockups. They chose five — the Inspector, a REPL that injects into a selected sandbox, the Timeline, the Playground and Source & Versions — and asked for a new ticket with an intern-level guide, uploaded to the reMarkable, then an implementation with work slips per phase. This step is the ticket, the evidence pass, and the guide.

The evidence pass re-read the whole of `useProgramInstance.ts`, `ScriptTile.tsx`, `library.ts`, `bootstrap.ts`, both engines, the worker protocol, `sandboxTools.ts`'s `check()` and `sandbox_describe`, the workbench's `apps.ts` and verbs, the demo's `sandbox.ts`/`workbench.ts`/`App.tsx`, the trace panel, the structural tests, and the pbui atoms available (`TextArea code`, `JsonBlock`, `DiffHunk`, `ResultLog`, `CodeLine`, `SelectInput`, `CheckboxRow`). Two facts from that pass decided the two non-obvious parts of the design: the eval engine keeps the bootstrap and the program in one `new Function` scope, and QuickJS evaluates every later `evalCode` in the same global lexical scope — so a direct `eval` *inside the bootstrap* gives both engines the same REPL scope without any engine-specific code (D3). And `ProgramRecord.putProgram` overwrites `source`, so versions need a `history` field on the record, with rollback as an ordinary update (D6).

### Prompt Context

**User prompt (verbatim):** "Create a new docmgr ticket and Create  a detailed analysis / design / implementation guide that is for a new intern, explaining all the parts of the system needed to understand what it is, with prose paragraphs and bullet point sand pseudocode and diagrams and api references and file references. It should be very clear and technical. Store in the ticket and the nupload to remarkable.


We want 1, a REPL tile to inject into a selected sandbox, 2, 4, 5.

SInce we are a greenfield projec,t you are welcome to modify anythiing you want to have cleaner and effective code. 

commit at appropriate intervals and keep a detailed diary as you work (using the diary format from the skill)

Once the design guide and the phases/tasks are written, print out an overview brutalist work slip, and then for each phase, print a slip up front, so I can track where you are at, and one at the end when you are done witha write up. Then do the same for the nex tphase"

**Assistant interpretation:** Open `PBUI-SANDBOX-1`; write an intern guide covering the system as it is, the gap, the design (registry, `evaluate`, five tiles) and a phased plan; upload it; then implement phase by phase with a plan slip first and start/end slips per phase, committing and keeping this diary throughout. "Greenfield" licenses refactors (one `SandboxHost` options type, removing the hook's string log, moving the dry run if useful).

**Inferred user intent:** Make agent-written programs debuggable and editable by a human from inside the workbench — see state, poke at it, replay events, draft by hand, diff versions — using the same tile model and atoms as everything else, and have a kanban-visible trail of the work.

**Commit (code):** none yet — docs only in this step.

### What I did

- `docmgr ticket create-ticket --ticket PBUI-SANDBOX-1 …`; `docmgr doc add` for the guide (design-doc) and this diary (reference).
- Read the files listed in RelatedFiles plus `contracts.ts`, `state.ts`, `createScriptApp.tsx`, `UINodeRenderer.tsx`, `protocol.ts`, `worker.ts`, `workerEngine.ts`, `directEngine.ts`, `createPbuiChat.tsx` (attachSandbox), `demo/src/chat.ts` (`program.open` handler), `demo/src/App.tsx` (launcher rows), `TracePanel.tsx`, vm-system's `redux-adapter/store.ts` (`DispatchTimelineEntry`), and the pbui atom signatures.
- Wrote the guide: §1 five scenes, §2 the system with line anchors, §3 gap table, §4 design with D1–D12, §5 six phases with files/tests/acceptance, §6 sequences, §7 R1–R14, §8 testing, §9–§10 references, §11 open questions.
- Wrote `index.md`; added eight tasks (phases 0–6 and the slips).

### Why

- The guide is the contract for the phases; the user wants an intern to be able to build from it, so every design choice names the file and line that motivated it.
- The registry comes first because four of the five tiles cannot exist without it and the fifth (Source & Versions) wants it for "showing in N tiles".

### What worked

- The design fits the existing app model without touching `pbui-workbench`: doc-bound apps for "inspect prg-3" and "source of prg-3", singletons for the REPL, timeline and playground; de-dup and `titleFor` come free.
- The REPL needs no engine-specific scope code once `evaluate` lives in the bootstrap.

### What didn't work

- N/A for this step (no code yet). One tooling note: `rg -l "no-raw-controls" --glob "*no-raw-controls*.test.ts"` returned nothing because the file name already is the pattern; `ls packages/pbui-chat/test` found it.

### What I learned

- `UINodeRenderer` already computes the per-node key `root.0.2` that the inspector's outline needs; paths cost one attribute (D10).
- `ResultLog`, `DiffHunk`, `JsonBlock` and `TextArea code` exist in pbui, so no devtool needs a raw control or a new atom.
- vm-system's `DispatchTimelineEntry` is `{dispatchId, timestamp, scope, actionType, instanceId, domain, outcome, reason}`; the registry's entry keeps its spirit (one global ordered ring with outcomes) and adds durations and the non-dispatch kinds (load, render, error, evaluate).

### What was tricky to build

- Choosing where the selection lives. A React context would have tied the REPL to being under the same provider as the tiles, which is true in the demo but not a property of the app model; putting `selectedViewId` in the registry store means any tile anywhere can read it (D1).
- Deciding that the playground runs a live instance rather than calling the tools' `check()`. The dry run is the model's contract; a human wants to click. Running the draft under `useProgramInstance` with a synthetic record makes the draft appear in the registry, which gives REPL and timeline access for free (D4).

### What warrants a second pair of eyes

- D3: direct `eval` under `"use strict"` can read but not declare; confirm that is acceptable for the REPL (R4) and that `__describe`'s depth/length caps do not hide what a user needs.
- D6/R9: `history` on the record against the 1 MiB library limit; `historyDepth: 10` default.
- D9: rollback, state edits and injections are not verbs and do not reach the trace.

### What should be done in the future

- Upload the guide and this diary to the reMarkable; print the overview slip; start Phase 0 with its start slip.

### Code review instructions

- Read `design-doc/01-…md` §4.1, §4.3 and §4.12 first; then §5 Phase 0.
- `docmgr doctor --ticket PBUI-SANDBOX-1 --stale-after 30` must be clean.

### Technical details

- Ticket path: `ttmp/2026/08/21/PBUI-SANDBOX-1--sandbox-devtools-inspector-repl-timeline-playground-and-versions-tiles/`.
- Base commit of the evidence: `d2c5b2c` (AGENT-3 close-out).
