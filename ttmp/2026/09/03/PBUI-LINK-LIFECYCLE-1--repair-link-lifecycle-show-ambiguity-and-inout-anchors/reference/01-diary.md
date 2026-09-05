---
Title: Diary
Ticket: PBUI-LINK-LIFECYCLE-1
Status: complete
Topics:
    - pbui
    - frontend
    - architecture
    - refactoring
DocType: reference
Intent: long-term
Owners: []
RelatedFiles:
    - Path: repo://packages/workbench-core/src/execute.test.ts
      Note: Semantic and raw replacement regression coverage
    - Path: repo://src/chrome/chrome.test.tsx
      Note: Independent inout anchor regression coverage
    - Path: repo://src/presentation/links/kernel.test.ts
      Note: Removed-port identity and history regression coverage
    - Path: repo://src/presentation/links/resolveShow.test.ts
      Note: Spawn ambiguity and candidate-id regression coverage
    - Path: repo://ttmp/2026/09/03/PBUI-LINK-LIFECYCLE-1--repair-link-lifecycle-show-ambiguity-and-inout-anchors/design-doc/01-concise-design-for-pr-24-review-fixes.md
      Note: Design implemented in diary Step 1
ExternalSources:
    - https://github.com/hyperslop-systems/pbui/pull/24
Summary: Implementation record for the remaining PR 24 link lifecycle, show ambiguity, and inout anchor corrections.
LastUpdated: 2026-09-03T19:20:00-04:00
WhatFor: Preserve the reasoning, failures, tests, and review path for PBUI-LINK-LIFECYCLE-1.
WhenToUse: Read before reviewing or extending the corrected lifecycle and anchor behavior.
---


# Diary

## Goal

Record the compact design and implementation of the remaining PR 24 review corrections.

## Step 1: Unify removed-port lifecycle and fix bounded resolver and anchor defects

The reviewed SHA used shell-owned link handlers, but the branch had since moved planning and effects into headless Workbench core. I first classified the findings against the current architecture: planning purity was already covered; source-close and stale runtime state were one lifecycle-delta defect; spawn ambiguity and inout anchors were bounded model bugs.

The implementation now computes durable cleanup from removed semantic ports and local cleanup from semantic before/after documents. It also gives each spawn target a complete app/port/placement identity and gives each rendered port side its own DOM anchor.

### Prompt Context

**User prompt (verbatim):** "Create a small ticket to address the issue, make a concise design doc, ten solve the bugs.

[REMINDER] Output a <summary>...</summary> block at the VERY END of your response. This is mandatory."

**Assistant interpretation:** Create a narrowly scoped docmgr ticket and design, then implement and validate the four remaining PR 24 findings while preserving the later planning-purity fix.

**Inferred user intent:** Resolve the review rigorously without turning several symptoms into unrelated patches or reopening architecture already corrected by subsequent work.

**Commit (code):** c722244c6dd7e353c76d949c1d923e6c2782e1ef — "Fix link lifecycle and endpoint handling"

### What I did

- Created `PBUI-LINK-LIFECYCLE-1`, four tasks, and the concise design.
- Added `linksAfterPortsRemoved(...)` to apply destination removal, dependent source-close policy, identity recompilation, and history cleanup from one old snapshot.
- Changed Workbench link maintenance to derive removed ports from deleted views and app-changing `viewConfigure` mutations.
- Added `linkLifecycleEffects(before, after)` and used it for planned execution, raw apply, restore/reset, and wholesale replacement.
- Removed the narrower `stageReplace` path.
- Included `portName` in spawn candidate ids and stopped collapsing distinct equal-ranked spawn winners.
- Made the chrome port registry side-aware and changed PortRail/WireLayer callers.
- Added kernel, resolver, core integration, raw-mutation, and registry regression tests.

### Why

- Freeze must evaluate a dependent follower before its source disappears.
- Durable link topology and local runtime values are different outputs of the same semantic lifecycle transition.
- Mutation spelling is less reliable than comparing the committed before/after graph for runtime invalidation.
- An inout semantic port is one logical endpoint but has two geometric anchors.

### What worked

- Existing pure-planning architecture accepted the lifecycle effects without adding an imperative planning path.
- Semantic and raw app replacement both freeze the dependent follower and clear old emitted values.
- The kernel test proves removed identities are recompiled while an unrelated surviving identity and its history remain.
- Full PBUI, core, shell, consumer-package tests and workspace typechecks passed.

### What didn't work

- The first Workbench-core typecheck ran before rebuilding the PBUI link-kernel declaration entry and failed exactly with:

  ```text
  src/links/collaborator.ts(5,3): error TS2305: Module '"@hyperslop-systems/pbui/link-kernel"' has no exported member 'linksAfterPortsRemoved'.
  ```

  Running `pnpm build` at the PBUI root regenerated `dist/link-kernel.d.ts`; the core and shell then typechecked.

- A Workbench-core suite run executed in parallel with two other Vitest suites and hit the existing five-second dynamic-import timeout:

  ```text
  FAIL src/publicSurface.test.ts > public surface > index, sync, persistence and rebalance entries
  Error: Test timed out in 5000ms.
  ```

  The test passed alone in 2.27 seconds with a 15-second diagnostic timeout, then the unchanged full suite passed in 5.72 seconds under its normal configuration.

### What I learned

- The reviewed planning mutation no longer exists on the current branch; review findings must be rebased conceptually, not patched at old file locations.
- App replacement is a port-universe transition even when the view id survives.
- Candidate identity must include the destination port, not only app and placement.
- DOM anchor identity is `(portId, side)`, while semantic link identity remains `portId`.

### What was tricky to build

- Source-close freeze and runtime forgetting have opposite timing requirements. Freeze evaluates against the old snapshot so it can capture the final value; runtime forgetting must be staged and installed with the new document. Separating durable `linksAfterPortsRemoved` from local `linkLifecycleEffects` preserves both.
- Raw batches and semantic commands previously discovered lifecycle through different mutation scans. Deriving forget effects from before/after documents avoids missed app changes and avoids clearing values when intermediate mutations cancel out.

### What warrants a second pair of eyes

- Confirm that retaining a same-name port across app replacement is the desired identity rule even if its new contract differs. This patch preserves the preexisting name-based retention policy while clearing runtime values.
- Review the externally exported `spawnCandidateId` hard cutover; candidate ids are ephemeral chooser identities and are not persisted.
- Review source-close wording: the existing `source-closed` diagnostic remains compatible for both tile deletion and source-port removal.

### What should be done in the future

- If app replacement needs contract-sensitive port identity, define an explicit declaration-compatibility predicate rather than adding special cases to lifecycle maintenance.
- Add property tests for arbitrary removed-port subsets and identity graphs under the broader testing program.

### Code review instructions

- Start at `src/presentation/links/lifecycle.ts::linksAfterPortsRemoved` and `packages/workbench-core/src/links/collaborator.ts::maintenance`.
- Then inspect `effects.ts::linkLifecycleEffects` and its three call paths in planner/core.
- Review `resolveShow.ts` winner selection and `usePortCarry.ts` anchor storage independently.
- Validate with:

  ```bash
  pnpm test
  pnpm build
  pnpm -r typecheck
  pnpm -r test
  ```

### Technical details

```text
Removed-port durable transition: old LinkSnapshot → mutation data
Runtime lifecycle transition:    old WorkbenchDocument + new WorkbenchDocument → LocalEffect[]
Spawn identity:                   appId + portName + placementId
DOM anchor identity:              portId + in|out
```
