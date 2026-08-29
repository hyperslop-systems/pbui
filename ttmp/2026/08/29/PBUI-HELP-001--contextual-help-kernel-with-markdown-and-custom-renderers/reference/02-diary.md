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
    - Path: repo://src/components/ContextHelp/builtins.tsx
      Note: Five built-in help renderers and payload contracts (commit f57ed5a)
    - Path: repo://src/components/ContextHelp/markdown.tsx
      Note: Bounded help Markdown subset, no HTML path (commit f57ed5a)
    - Path: repo://src/components/ContextHelp/registry.ts
      Note: defineHelpItem and renderer registry (commit f57ed5a)
    - Path: repo://src/presentation/actions/resolve.freeze.test.ts
      Note: Phase 1 freeze fixtures for the resolver front half (commit f9f6b83)
    - Path: repo://src/presentation/actions/resolve.ts
      Note: Resolver whose front half the fixtures freeze and Phase 2 extracts
    - Path: repo://src/presentation/context/match.ts
      Note: Shared contextual matcher extracted in Phase 2 (commit 9ae5bb9)
    - Path: repo://src/presentation/context/types.ts
      Note: ContextTarget/ContextMatch contracts (commit 9ae5bb9)
    - Path: repo://src/presentation/help/registry.ts
      Note: Fail-fast help registry (commit 2125f11)
    - Path: repo://src/presentation/help/resolve.ts
      Note: Additive help resolver (commit 2125f11)
    - Path: repo://src/presentation/help/types.ts
      Note: Help rule/item/resolution contracts (commit 2125f11)
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

## Step 3: Phase 2 — extract the shared contextual matcher

Created `src/presentation/context/` with the `ContextTarget`/`ContextMatch` contracts and a pure `matchContext` function, then refactored `resolveActions` to call it for every non-`"*"` contribution. The action resolver's output and trace are byte-identical: all 199 core tests (including the Phase 1 freeze fixtures) and the datalab golden suite pass unchanged.

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Assistant interpretation:** Execute Phase 2: extract `matchContext` per design doc §6.1 without changing action behavior.

**Inferred user intent:** One shared applicability model for actions and help, so the two kernels can never drift.

**Commit (code):** 9ae5bb9 — "PBUI-HELP-001: extract shared contextual matcher (Phase 2)"

### What I did
- Added `context/types.ts` (`ContextTarget`, `ContextMatch`, `ContextMatchResult` with staged rejections) and `context/match.ts` (`matchContext`, exported `activeScope`).
- Refactored `resolve.ts`: removed the per-query `ancestorDistance` map and the local `activeScope`; the loop now calls `matchContext` and interleaves the invocation filter using the rejection's stage.
- Added `context/match.test.ts` (11 tests): exact-only concrete match, shortest ancestor distance, nearest active scope, inactive-scope reject, condition/predicate parity with the action kernel (including `all` first-failure and fail-closed unknown predicates), provenance completeness, isolated undeclared types.
- Checked ticket task `adx6`.

### Why
- Design §6.1/§6.2: help must reuse the applicability front half without a rewrite, and the refactor is only acceptable with unchanged action behavior.

### What worked
- The Phase 1 freeze fixtures did their job: they passed unchanged through the refactor, which is the proof the extraction preserves trace shape.

### What didn't work
- Nothing failed in this phase; tests were green on the first run after the refactor.

### What was tricky to build
- **Trace order vs. stage order.** `matchContext` checks type → scope, but the resolver traces the invocation filter BETWEEN those stages: a type-reachable contribution that fails both invocation and scope must trace `invocation-not-allowed`, not `no-active-scope`. Calling the matcher and acting immediately on a scope rejection would have flipped that. Solution: hold the rejection (`scope = null`), run the invocation check, then emit the scope reject — the matcher call site in `resolve.ts` documents this.
- **Action conditions are not matcher conditions.** A failing action `when` yields a *status* (`unavailable`/`hidden`) that stays in the override competition; `matchContext`'s condition stage is a binary reject. So the action caller passes no `when` and keeps its own status evaluation; only help will use the matcher's condition stage. This is written into `ContextTarget.when`'s doc comment.
- **The `"*"` family target** is not expressible as a `ContextTarget` (help forbids wildcards in v1), so the resolver keeps an inline path for it using the exported `activeScope`.

### What warrants a second pair of eyes
- The `distance = 0; scope = null` placeholder branch in `resolve.ts` when the matcher rejects on scope — `distance` is unread on every rejected path, but a future edit could read it; the comment marks it.
- Perf: the per-query `ancestorDistance` map became `graph.distance()` calls (a linear `find` over the cached BFS ancestor list per contribution). Ancestor lists are tiny (≤5 in every product graph here), but a reviewer should confirm this is acceptable on the datalab grid path.

### What should be done in the future
- If a product ever has deep type graphs plus hundreds of contributions, memoize distance per (concreteType, declaredType) inside the matcher call site.

### Code review instructions
- Start at `src/presentation/context/match.ts` (pure, ~110 lines), then the refactored loop in `src/presentation/actions/resolve.ts` (the comment block explains the interleave).
- Validate: `pnpm test` (199), `pnpm typecheck`, `pnpm test` in `packages/datalab-ui` (532 pass + 1 pre-existing baseline failure).

### Technical details
- `matchContext` rejection reasons: type-stage reasons are prose; scope stage is exactly `"no-active-scope"`; condition stage carries the failure's `because` for `unavailable`, else its kind (`"inapplicable"`/`"hidden"`).

## Step 4: Phase 3 — the pure help kernel

Built `src/presentation/help/` as the additive sibling of the action kernel: typed exact/inherited rule factories, a fail-fast registry, and a resolver that rides `matchContext` for applicability and then accumulates every matching rule's items with provenance and deterministic ordering. 18 new tests; 217 total, typecheck clean.

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Assistant interpretation:** Execute Phase 3: help IDs, factories, registry validation, and the additive resolver per design doc §§7, 11, 15.

**Inferred user intent:** A working pure help kernel so renderers and runtime can layer on top in P4/P5.

**Commit (code):** 2125f11 — "PBUI-HELP-001: pure help kernel (Phase 3)"

### What I did
- Added `help/types.ts` (HelpRuleId/HelpItemId/HelpKind, `HelpItem`, exact/inherited rules with `kind: "rule"`, `ResolvedHelpItem` with provenance, `HelpResolution`), `help/define.ts` (`defineHelp` mirroring `defineActions`), `help/resolve.ts` (`resolveHelp` — matcher, only-available `test`, item validation, duplicate-id rejection, five-key sort), `help/registry.ts` (`createHelpRegistry` with duplicate/unknown-type/scope/predicate/priority validation), `help/index.ts`.
- Exported the help kernel plus `matchContext`/`ContextTarget` from `src/presentation/index.ts`.
- Tests: `registry.test.ts` (7 construction-failure cases) and `resolve.test.ts` (11 cases: accumulation, no-match, provenance, non-available when/test, exact narrowing, inherited original-reference, full ordering ladder, registration-order independence, duplicate/malformed items).
- Checked ticket task `w3lr`.

### Why
- §7.2: additive composition with ordering-only precedence is the core semantic difference from actions; the ordering test encodes the ladder (`typeDistance` ↑, `scopeIndex` ↑, `priority` ↓, `order` ↑, `id` ↑) end to end.

### What worked
- Everything passed on the first full run after one import fix; reusing `InheritedRuleContext`/`ExactRuleContext` from the action kernel meant zero new context machinery.

### What didn't work
- Two small self-inflicted slips fixed before running: an over-clever `declare function` type helper for `HelpQuery` (replaced with a plain interface) and importing `Availability` from `./types` where it isn't re-exported (import from `../actions/availability`), plus a `../context` vs `./context` path in the index export.

### What I learned
- The `exactOptionalPropertyTypes`-style spreads (`...(rule.when !== undefined ? { when: rule.when } : {})`) used across the action kernel are required here too — passing `when: undefined` explicitly would violate the optional-property contracts.

### What was tricky to build
- **Duplicate-id policy.** The design offers diagnostic-and-omit or throw; it recommends throwing because help never resolves during ordinary render. I implemented throw with an error naming BOTH rule ids (first writer and second writer), since with additive composition across packages the collision report is only useful if it names both sides. `diagnostics` stays in `HelpResolution` as a reserved empty field.
- **Registration-order independence without a competition ladder.** Actions get it from the partition ladder; help needs the final `id.localeCompare` tiebreaker to make sort order independent of rule iteration order by construction (two rules, same distance/scope/priority/order → id decides).

### What warrants a second pair of eyes
- The five-key sort comparator in `resolve.ts` — comparator bugs are classically silent.
- `test` narrowing cast (`rule.test as (ctx: InheritedRuleContext…)`) copies the action resolver's pattern; confirm the comment justifying runtime-identical contexts is acceptable.

### What should be done in the future
- If products want non-fatal duplicate handling in production builds, populate `HelpResolution.diagnostics` behind an option instead of throwing.

### Code review instructions
- Read `help/resolve.ts` first (the semantics live there, ~140 lines), then `help/registry.ts` against `actions/registry.ts` for the validation parity, then the ordering test in `help/resolve.test.ts`.
- Validate: `pnpm test` (217), `pnpm typecheck`.

### Technical details
- Help rules carry `kind: "rule"` for forward compatibility with a possible family/dynamic contribution kind, mirroring the action contribution union shape.

## Step 5: Phase 4 — built-in and custom renderers

Built `src/components/ContextHelp/` (registry, bounded Markdown, five built-ins, `HelpContent`) as the React half of the help system. 17 new tests bring the total to 234; typecheck clean.

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Assistant interpretation:** Execute Phase 4: renderer registry, safe Markdown subset, text/fields/notice/actions built-ins, custom renderer fixture.

**Inferred user intent:** Products should render help without touching HTML, and typed custom renderers should be provably wired.

**Commit (code):** f57ed5a — "PBUI-HELP-001: built-in and custom help renderers (Phase 4)"

### What I did
- `registry.ts`: `HelpRendererProps<Payload, Values, ProductFacts>`, `defineHelpItem` (bundles kind + Renderer + `create` so a kind can't be misspelled), `createHelpRendererRegistry` (duplicate kinds throw).
- `markdown.tsx`: `splitHelpMarkdownBlocks` + `HelpMarkdown` — the pbui-chat subset minus `[[type:id|label]]` mentions; paragraphs/breaks/strong/inline-code/fences/lists/headings; everything becomes text nodes.
- `builtins.tsx`: `textHelp`, `markdownHelp`, `fieldsHelp` (dl), `noticeHelp` (tone as data + text), `actionsHelp` (informational rows; `ActionsHelpEntry` is the structural slice of `ResolvedAction` so `resolution.actions` passes straight through), `builtinHelpItems`.
- `HelpContent.tsx`: renders a resolution; unknown kinds `console.warn` and omit that item only.
- Tests: `markdown.test.tsx` (block splitting, inline rendering, **no raw HTML**, mention syntax stays literal) and `renderers.test.tsx` (registry, every built-in's semantic structure, title part, custom renderer receiving payload + provenance, no buttons in v1 actions).
- Exported via `components/ContextHelp/index.ts` → `components/index.ts`. Checked task `gq7b`.

### Why
- §8: the renderer registry is React-specific and must live outside the pure selector; §9.2: reuse the proven bounded parser rather than adding react-markdown.

### What worked
- Copying the pbui-chat block splitter verbatim (minus mentions) meant the Markdown tests passed immediately — the parser was already battle-tested.

### What didn't work
- `pnpm typecheck` caught two errors the test run didn't: (1) `HelpRenderer = ComponentType<HelpRendererProps>` — the DEFAULT type args collapse, because `PresentationReference<object>` resolves to `never` (`PresentationType<object> = Extract<keyof object, string> = never`), producing `TS2769 … 'PresentationReference<Values>' is not assignable to type 'never'` at the `<Renderer …>` call; fixed by erasing with `ComponentType<HelpRendererProps<any, any, any>>`. (2) An unused `type Values` in the test (TS6196).
- First draft passed `data-part` directly to the `Text` foundation component, which has a closed prop set — wrapped in plain elements instead (3 sites).

### What I learned
- `PresentationValues = object` means "the default generic" is a trap for any erased-component type in this codebase; `any`-erasure with a comment is the working pattern.
- Vitest passing while tsc fails is routine here (vitest transpiles without typechecking) — both gates must run every phase.

### What was tricky to build
- **Payload variance at the registry boundary.** `HelpItemDefinition<TextPayload>` is not assignable to `HelpItemDefinition<unknown>` (contravariant `Renderer` prop), so the registry accepts `HelpItemDefinition<any>` (`AnyHelpItemDefinition`). The precision lives in the definition values authors touch; the registry is deliberately erased.
- **Typing the actions payload without generic contagion.** `ActionsHelpPayload` as `ResolvedAction<Values, Verb>[]` would make every renderer generic over product types. `ActionsHelpEntry` (action/label/description/danger/status) is the structural subset — `ResolvedAction` satisfies it, products just pass `resolution.actions`.

### What warrants a second pair of eyes
- The `no-explicit-any` suppressions in `registry.ts` — deliberate erasure, but worth a style check.
- I did NOT ship an `escapeMarkdown` helper although the design's §19 example references one: the subset has no backslash-escape syntax, so a correct escaper can't exist without extending the grammar. The Markdown doc comment and the builtins steer user-controlled values to the fields item instead.

### What should be done in the future
- If pbui-chat later consumes `splitHelpMarkdownBlocks` (the design suggests it may), delete its private copy of the splitter.
- Decide whether to add backslash escaping to the subset so an honest `escapeMarkdown` becomes possible.

### Code review instructions
- Read `builtins.tsx` top to bottom (payload contracts are the API), then `markdown.tsx` against `packages/pbui-chat/src/markdown/PbuiMarkdown/PbuiMarkdown.tsx` to confirm the subset is a strict reduction.
- Validate: `pnpm test` (234), `pnpm typecheck`; the no-raw-HTML test in `markdown.test.tsx` is the security-relevant one.

### Technical details
- Built-in kinds: `help.text`, `help.markdown`, `help.fields`, `help.notice`, `help.actions`. Parts: `help-item`, `help-title`, `help-text`, `help-markdown(-list/-code)`, `help-fields`/`help-field`, `help-notice`, `help-actions`/`help-action(-reason)`.
