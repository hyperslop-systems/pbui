---
Title: Diary
Ticket: PBUI-HELP-001
Status: active
Topics:
    - frontend
    - pbui
    - design
    - architecture
DocType: reference
Intent: long-term
Owners: []
RelatedFiles:
    - Path: repo://src/presentation/actions/resolve.freeze.test.ts
      Note: Phase 1 freeze fixtures for the resolver front half (commit f9f6b83)
    - Path: repo://src/presentation/actions/resolve.ts
      Note: Resolver whose front half the fixtures freeze and Phase 2 extracts
ExternalSources: []
Summary: Implementation diary for the PBUI contextual help kernel — phase-by-phase narrative, failures, tricky parts, and review instructions.
LastUpdated: 2026-08-29T14:21:00-04:00
WhatFor: Record the implementation journey of PBUI-HELP-001 so reviewers and future implementers can follow what changed, why, and how to validate it.
WhenToUse: Read when reviewing the help kernel implementation or continuing work on this ticket.
---


# Diary

## Goal

Capture the implementation of PBUI-HELP-001: a sibling contextual help kernel that reuses the action kernel's type/scope/condition/snapshot matching, adds additive help-item resolution, built-in text/Markdown/fields/notice/actions renderers, a custom renderer registry, and a hover/focus `ContextHelp` surface — across the six phases laid out in the intern guide (design-doc/01).

## Step 1: Survey, baseline, and plan slip

Read the intern guide end to end, then the action kernel sources it names (`types.ts`, `resolve.ts`, `conditions.ts`, `typeGraph.ts`, `registry.ts`, `define.ts`, `availability.ts`), the runtime (`createPbui.tsx`), and the pbui-chat Markdown subset. Established the test baseline and printed the brutalist plan slip with the six phases.

### Prompt Context

**User prompt (verbatim):** "Implement PBUI-HELP system, commit at appropriate intervals and keep a detailed diary as you work (using the diary format from the skill), Print out a brutalist work slip with the plan / different phases for the ticket. then before stsarting a phase, plrint a split about the phase, and print one when the phase is done."

**Assistant interpretation:** Implement ticket PBUI-HELP-001 following its design doc's six phases, with focused commits per phase, a diary in the skill's strict step format, one up-front plan slip on the thermal printer, and a start slip + done slip per phase.

**Inferred user intent:** Get the contextual help kernel actually built to the spec that was already designed, with a physical paper trail of progress and a reviewable written record.

### What I did
- Read the full design doc `design-doc/01-intern-guide-to-the-pbui-contextual-help-kernel.md`.
- Read all action-kernel sources plus `createPbui.tsx` (921 lines) and `PbuiMarkdown.tsx`.
- Ran `pnpm test` in the repo root: **20 files, 182 tests, all pass**.
- Ran `pnpm test` in `packages/datalab-ui`: **532/533 pass, 1 pre-existing failure** in `test/shortcut-routing.test.ts` ("case does not matter: Shift+Mod+K still routes" expects `open-launcher`, gets `open-rebalance`) — unrelated to help; left untouched as the baseline.
- Printed the plan slip (6 phases, BASE=182 PASS fact).
- Created this diary via `docmgr doc add`.

### Why
- The design doc demands byte-for-byte action behavior preservation through the Phase 2 refactor; a recorded green baseline is the only way to prove that.
- The pre-existing datalab failure must be on record so it is not attributed to this ticket's changes.

### What worked
- The design doc is unusually complete: exact type signatures, file layout, phase plan, and test plan. Implementation can follow it closely.

### What didn't work
- `packages/datalab-ui` baseline has the one pre-existing shortcut-routing failure noted above (left as-is).

### What I learned
- `resolveActions` really is two halves as the doc claims: lines up to candidate collection are generic reachability (type distance via `graph.ancestors`, `activeScope`, invocation filter, condition/test evaluation), and the partition/ladder/bind half is action-only.
- The exact/inherited context objects are the same value at runtime; narrowing is type-level only (a comment in `resolve.ts` states this explicitly) — the help kernel can use the same trick.
- Trace entries for scope/invocation rejects use `stage: "scope"`; type-unreachable rules produce no trace at all. Any extraction must preserve this exact trace shape.

### What was tricky to build
- N/A (survey step).

### What warrants a second pair of eyes
- The decision to treat the datalab shortcut-routing failure as pre-existing baseline rather than fixing it in this ticket.

### What should be done in the future
- N/A.

### Code review instructions
- Start at the design doc `design-doc/01`, then follow phase commits in order.
- Baseline commands: `pnpm test` (root), `pnpm test` in `packages/datalab-ui`.

### Technical details
- Repo: `/home/manuel/workspaces/2026-08-24/use-optkit/pbui`, package `@hyperslop-systems/pbui` 0.9.0, vitest 4.1.10, pnpm workspaces.

## Step 2: Phase 1 — freeze resolver front-half behavior

Audited `resolve.test.ts` (498 lines) against what the Phase 2 extraction could break. The back half (partitions, ladder, ambiguity, binding, permutation invariance) was already frozen; the gaps were all in the front half. Added `resolve.freeze.test.ts` with 7 focused fixtures and fixed a pre-existing typecheck error that was blocking the `pnpm typecheck` gate.

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Assistant interpretation:** Execute Phase 1 of the design doc: add freeze fixtures so the matcher extraction in Phase 2 can be proven behavior-preserving.

**Inferred user intent:** Make the refactor safe before it starts.

**Commit (code):** f9f6b83 — "PBUI-HELP-001: freeze resolver front-half behavior (Phase 1)"

### What I did
- Added `src/presentation/actions/resolve.freeze.test.ts`: `when`-conditions (mode, capability, predicate, `all` first-failure) evaluated through full resolution; failing `when` short-circuits `test()`; nearest declared scope among several (`scopes: ["global", "workbench"]` matches at workbench, scopeIndex 1); exact trace shapes for `no-active-scope`, `invocation-not-allowed`, and type-pass entries; type-unreachable rules emit zero trace entries.
- Fixed `vocabulary.test.ts:52`: `subject.reference.type` → `subject.type` (pre-existing TS2339 on the clean tree; label callbacks receive the reference directly).
- `pnpm typecheck` clean; `pnpm test` 188/188.

### Why
- Design doc §6.2: the extraction "is only acceptable if existing action tests remain unchanged" — but tests that don't exist can't hold the line. The front-half behaviors (condition evaluation order, scope nearest-index choice, trace emission points) were exercised only indirectly.

### What worked
- All 7 new fixtures passed on first run against the current resolver — they document behavior, not aspiration.

### What didn't work
- First version used `Parameters<typeof all>[0]` as the `when` parameter type; TS resolved it to `never` (rest-parameter tuple indexing). Errors: `TS2345: Argument of type 'Condition' is not assignable to parameter of type 'never'` at resolve.freeze.test.ts(77,91). Fixed by importing `Condition` directly.

### What I learned
- `pnpm typecheck` was already red on the clean tree (verified via `git stash -u`) from the vocabulary.test.ts slip — worth fixing here rather than inheriting a broken gate for five more phases.

### What was tricky to build
- The trace-shape fixtures had to assert with `toContainEqual` on complete entry objects, not `toMatchObject`, because the extraction risk is precisely fields being added/dropped/renamed in the moved code.

### What warrants a second pair of eyes
- Whether the vocabulary.test.ts fix belongs in this ticket's first commit (it is pre-existing, one line, test-only).

### What should be done in the future
- N/A.

### Code review instructions
- Read `src/presentation/actions/resolve.freeze.test.ts` beside `resolve.ts` lines 82–219 (the front half it freezes).
- Validate: `pnpm test` (188), `pnpm typecheck` (clean).

### Technical details
- Trace contract worth remembering: invocation rejects use `stage: "scope"` (not a dedicated stage), and type-unreachable contributions are deliberately traceless.
