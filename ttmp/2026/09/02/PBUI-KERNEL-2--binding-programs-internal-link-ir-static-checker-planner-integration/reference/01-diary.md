---
Title: Diary
Ticket: PBUI-KERNEL-2
Status: active
Topics:
    - pbui
    - design
    - architecture
    - refactoring
DocType: reference
Intent: long-term
Owners: []
RelatedFiles:
    - Path: repo://src/presentation/links/check.ts
      Note: The static checker whose coverage Step 1 proves
    - Path: repo://src/presentation/links/expression.ts
      Note: The IR, compiler, lowering and dependency extraction the laws hold
    - Path: repo://src/presentation/links/laws.test.ts
      Note: §19.6 laws and checker coverage (commit 3f55488)
ExternalSources: []
Summary: 'Chronological record of PBUI-KERNEL-2: how the binding-program laws were pinned as tests, how dependency extraction and candidate construction were centralized on the IR, and how the per-verb planner checks were retired after parity.'
LastUpdated: 2026-09-02T20:33:04.350435303-04:00
WhatFor: Continue or review the binding-program work without re-deriving what was tried, what failed, and why the planners look the way they do.
WhenToUse: Before touching links/expression.ts, links/check.ts or links/plan.ts, or when a link refusal message changed.
---


# Diary

## Goal

Capture how the prototype binding-program IR (`links/expression.ts`, `links/check.ts`, landed with KERNEL-1) was promoted from "present in the tree" to "the one authority the link kernel reasons over": the laws it must satisfy, the dependency and candidate-term helpers built on it, the planner checks it replaced, and the evidence at each step.

## Step 1: Pin the §19.6 laws and the checker's coverage as tests

The KERNEL-1 patch brought the IR, the compiler and lowering, dependency extraction and a static checker, and the evaluator was already interpreting programs rather than terms. What it did not bring was the test surface the guide asks for in §19.6: a wire round trip that is byte-for-byte stable, idempotent normalization, the hold/resume law at the term level, held-value independence, dependency preservation, and a checker exercised on every failure class. Before changing any planner, this step wrote those laws down as `laws.test.ts`, so the next steps have a fence to stand behind.

Every one of the 55 assertions passed on the first run. That is the finding of this step: the prototype satisfies the laws as written, including the one it documents as an exception (a `hold` nested under a `derived` collapses to a `constant`, and that collapse is a fixpoint). The tests also fixed the key order the lowering writes, which is what a document diff sees.

### Prompt Context

**User prompt (verbatim):** "Do PBUI-KERNEL-2, 3. commit at appropriate intervals and keep a detailed diary as you work (using the diary format from the skill) . Print out a brutalist work slip with the plan / different phases for the ticket. then before stsarting a phase, plrint a split about the phase, and print one when the phase is done.

Keep screenshots regularly for the diary and for the report ultimately."

**Assistant interpretation:** Implement the two follow-up tickets split out of KERNEL-1 (binding programs; identity quotient and port compatibility), in phases, with a commit per phase, a diary step per phase, a printed plan slip per ticket and a printed slip at the start and end of each phase, and screenshots of the affected UI for the diary and a later report.

**Inferred user intent:** Finish the link-kernel half of the KERNEL-1 design now that the consolidation has landed, with the same evidence discipline as KERNEL-1 so the eventual report can be written from the diary.

**Commit (code):** 3f55488 — "PBUI-KERNEL-2 P1: binding-program laws and checker coverage as tests (§19.6)"

### What I did
- Read the two ticket indexes, guide §12.3–§12.7, §13, §19.6–§19.7, and every file under `src/presentation/links/`, plus the workbench call sites of `sourcePortOf`/`linkIdOf`.
- Ran the baseline: `npx vitest run src/presentation/links` → 8 files, 65 tests, green.
- Printed the KERNEL-2 and KERNEL-3 plan slips and the P1 start slip; created both diaries and ten tasks with docmgr.
- Wrote `src/presentation/links/laws.test.ts`: ten JSON wire fixtures (one per production plus the nestings the planners write), the four normalization laws, `resume(pin(b)) == b` for follow/derived/ambient/alias terms, held independence at program and port level, and twelve checker cases.

### Why
- §12.7 says to delete the planners' structural checks "once parity tests prove the checker covers" them. Parity needs the checker's own coverage proven first.
- The wire format is what products persist; a byte-for-byte fixture is the only test that catches a reordered key or a dropped field.

### What worked
- `npx vitest run src/presentation/links/laws.test.ts` → 55 passed. The lowering already writes keys in the grammar's order, so `JSON.stringify(bindingOf(programOf(b)))` equals the fixture text.
- The alias case of the hold/resume law passes because `restore` in `apply.ts` recognizes a suspended `alias` equal to the port's current class as "no term".

### What didn't work
- Nothing failed in this step. The first attempt at separators in a shell command (`echo ====X`) was expanded by zsh; irrelevant to the code.

### What I learned
- The checker's cycle walk uses `dependenciesOfBinding` with suspended wires included, so a held term whose suspended wire would close a loop on resume is refused before the resume. That is the conservative reading and it is now a test.
- A `constant` cannot be pinned (`code: "fixed"`), so the hold/resume law is vacuous for it; the test records that instead of skipping it silently.

### What was tricky to build
- The non-canonical shape. `Derived(Hold(r, b), ρ)` is admitted by `isBinding` but `expressionOf` folds the hold to `Constant(r)`, dropping `b` and its wire. The law `normalize ∘ normalize = normalize` still holds, but `bindingOf(programOf(b)) == b` does not for that shape, and "normalization preserves dependencies" does not either. The tests state the collapse explicitly rather than pretending the law is universal; no planner writes that shape.

### What warrants a second pair of eyes
- Whether the collapse of a hold under a derivation should instead be a `broken` program (a diagnostic) so the loss is visible in the document. The prototype chose the silent fold; this step kept it and documented it.

### What should be done in the future
- N/A beyond P2–P5 of this ticket.

### Code review instructions
- Start at `src/presentation/links/laws.test.ts`; the fixtures at the top are the wire contract.
- Validate with `npx vitest run src/presentation/links`.

### Technical details
- The four normalization laws as the tests state them:

```text
bindingOf(programOf(b)) == b                   for every persisted shape
normalize(normalize(b)) == normalize(b)        for every shape, canonical or not
deps(normalize(b)) == deps(b)                  for every persisted shape
normalize(Derived(Hold(r, b), ρ)) == Derived(Constant(r), ρ)   the documented exception
```
