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
    - Path: repo://src/presentation/links/apply.ts
      Note: Persists candidateTermOf since Step 3
    - Path: repo://src/presentation/links/candidate.ts
      Note: candidateTermOf and friends (Step 3)
    - Path: repo://src/presentation/links/check.ts
      Note: The static checker whose coverage Step 1 proves
    - Path: repo://src/presentation/links/expression.ts
      Note: The IR, compiler, lowering and dependency extraction the laws hold
    - Path: repo://src/presentation/links/laws.test.ts
      Note: §19.6 laws and checker coverage (commit 3f55488)
    - Path: repo://src/presentation/links/plan.ts
      Note: Planners; imports dependsOn/titleOfPort since Step 2, per-verb checks retired in Step 4
    - Path: repo://src/presentation/links/snapshot.ts
      Note: titleOfPort lives here since Step 2
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

## Step 2: One dependency walk, and refusals that name tiles

Two functions walked the binding graph: `dependsOn` in `plan.ts`, over `sourcePortsOfBinding`, and `readsFrom` in `check.ts`, over `dependenciesOfBinding`. Both were correct and both included suspended wires, but two walks is one too many for a kernel whose point is that every interpreter reads the same program. This step keeps one, in the checker, and has the planners import it.

The checker's cycle diagnostic also changes from port ids (`v-east/order already reads from v-b/order`) to the sentence the planners wrote (`Orders East · order already reads from Detail B · order; that would be a cycle`). That required `titleOfPort` to leave `plan.ts` for `snapshot.ts`, where it belongs: it is a function of a port definition, not of a plan. With the same wording on both sides, P4 can delete the planner copy without a user-visible change.

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Assistant interpretation:** Phase 2 of the plan slip: centralize dependency extraction and make the checker's diagnostics at least as good as the planners' before replacing them.

**Inferred user intent:** Same as Step 1.

**Commit (code):** 1167b08 — "PBUI-KERNEL-2 P2: one dependency walk over the IR; titled cycle diagnostics"

### What I did
- `check.ts`: replaced `readsFrom` with an exported `dependsOn(port, target, snapshot)`; cycle message uses `titleOfPort` on both ends.
- `snapshot.ts`: added `titleOfPort`; `plan.ts` imports it and `dependsOn`, re-exports both so `index.ts` is unchanged.
- `laws.test.ts`: added the §12.5 parity law: for every wire fixture, `sourcePortOf(b)` is the one member of `dependencies.ports` (or null when the set is empty) and `linkIdOf(b)` is in `dependencies.links`.
- `npx tsc -p tsconfig.json --noEmit` clean; `npx vitest run src/presentation/links` → 9 files, 130 tests.

### Why
- §12.5 asks for one dependency extraction that every caller uses and that states whether suspended wires count. `dependsOn` in the checker is that caller; `sourcePortOf` remains as the projection the badge and the workbench's link refs need (one source to name), fenced by the parity law instead of reimplemented.

### What worked
- Message parity was exact on the first run: the planner test for `code: "type"` asserts `<order> does not reach <customer>`, which the checker already wrote.

### What didn't work
- N/A.

### What I learned
- `linkIdOf` of a `hold` returns the suspended wire's id, and `dependenciesOfBinding` includes suspended links by default, so the parity law holds without special-casing holds.

### What was tricky to build
- Import direction. `terms.ts` cannot import `expression.ts` (expression imports terms), so `sourcePortOf` cannot be defined over the IR without a cycle. The law test is the honest substitute: it fails the moment the two disagree.

### What warrants a second pair of eyes
- The cycle message when the source port is not in the snapshot falls back to the raw port id; the checker returns `source-missing` earlier for that case, so the fallback should be unreachable.

### What should be done in the future
- N/A.

### Code review instructions
- `src/presentation/links/check.ts` (`dependsOn`, the cycle branch of `checkBinding`), `snapshot.ts` (`titleOfPort`), `plan.ts` (imports and the tail re-export).
- `npx vitest run src/presentation/links`.

### Technical details
- Cycle refusal, before and after:

```text
before  v-east/order already reads from v-b/order
after   Orders East · order already reads from Detail B · order; that would be a cycle
```

## Step 3: The planner checks the term the apply step writes

Guide §12.7 says a planner "should construct the exact candidate term it proposes to persist". Before this step the follow planner checked `terms.follow(source, "__plan__")` and the apply case wrote `terms.follow(source, id)`; the derive planner checked `Derived(Follow(source, "__plan-source__"), ρ, "__plan-derived__")` and the apply case wrote `Derived(Follow(source, id), ρ, id)`. The shapes agreed by inspection, not by construction. `links/candidate.ts` now spells each shape once: `candidateTermOf(verb, linkId)` for the four verbs that write a term, `destinationOf(verb)`, `linkIdFor(verb, mint)`, and `PLAN_LINK_ID` for the planner's placeholder.

The planners now build the verb they will return first and check `candidateTermOf(verb)`; apply stores `candidateTermOf(verb, linkIdFor(verb, newLinkId))`. The law added to `laws.test.ts` applies each term verb and asserts the persisted term equals the candidate under the minted id, and that bind and ambient mint no id at all (the counter must not advance, or link ids in documents would skip).

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Assistant interpretation:** Phase 3 of the plan slip: planner integration by construction rather than by inspection.

**Inferred user intent:** Same as Step 1.

**Commit (code):** 2cf52b6 — "PBUI-KERNEL-2 P3: planners check the exact term apply persists"

### What I did
- New `src/presentation/links/candidate.ts` (`TermVerb`, `isTermVerb`, `destinationOf`, `linkIdFor`, `candidateTermOf`, `PLAN_LINK_ID`), exported from `links/index.ts`.
- `apply.ts`: the four term cases persist `candidateTermOf`.
- `plan.ts`: `checkedCandidate(verb, destination, s, deps)` takes the verb; `planFollow`, `planBind`, `planAmbient`, `planDerive` return the same verb object they checked.
- `laws.test.ts`: "§12.7 a planner checks the term apply persists" (six assertions).
- Typecheck clean; 136 link tests pass.

### Why
- One spelling per shape is the only way the planner's admissibility verdict is about the term that will exist in the document.

### What worked
- `linkVerbs.derive` already existed with the exact field set apply used, so the derive planner's hand-built verb literal could be replaced without a shape change.

### What didn't work
- N/A.

### What I learned
- The `LinkVerb` union is not discriminated by a shared field name for the destination (`destination` for follow/derive, `port` for bind/ambient), which is why `destinationOf` exists rather than a property access.

### What was tricky to build
- The `linkVerbs.*` constructors return `LinkVerb`, not the narrowed member, so the planners cast to `TermVerb` after construction. A typed overload per constructor would remove the casts; left for a later cleanup since the cast is local to four lines.

### What warrants a second pair of eyes
- `linkIdFor` returns `undefined` for bind/ambient and `candidateTermOf` then defaults to `PLAN_LINK_ID`, which those two shapes ignore. Confirm no future term shape carries a link id without being listed in `linkIdFor`.

### What should be done in the future
- Narrowed return types on `linkVerbs.follow/bind/derive/ambient` to drop the casts.

### Code review instructions
- `src/presentation/links/candidate.ts`; then `apply.ts` cases `port.follow/bind/derive/ambient`; then `checkedCandidate` in `plan.ts`.
- `npx vitest run src/presentation/links/laws.test.ts`.

### Technical details

```text
plan:   checkBinding(candidateTermOf(verb, PLAN_LINK_ID), s, deps, destinationOf(verb))
apply:  bindings[destinationOf(verb)] = candidateTermOf(verb, linkIdFor(verb, mint))
law:    apply(verb).bindings[dest] == candidateTermOf(verb, minted)
```
