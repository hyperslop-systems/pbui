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

## Step 4: Delete the planners' copies of the structural checks

With the checker's coverage proven (Step 1), one dependency walk (Step 2) and the exact candidate term in the planner's hands (Step 3), the planners' own type, cycle and context checks were duplicates running before the checker reached the same verdict. This step deletes them: `planFollow` loses `reaches` and `dependsOn`, `planBind` loses `reaches`, `planAmbient` loses the context lookup and `reaches`, `planDerive` loses `dependsOn`. What stays in a planner is operation policy, as §12.7 lists it: existence, direction, self, document slots, held, shared, already-linked, and which relations are legal.

One message would have regressed: the ambient planner said `workspace.order holds <order>, which does not reach <customer>` and the checker said `<order> does not reach <customer>`. The checker now names the context when the program's expression is a single context source, so the sentence is unchanged. The whole pbui root suite passes (40 files, 443 tests), which is the parity proof the guide asks for before deleting. The IR's constructors also leave the package root export, per §12.3: consumers get `normalizeBinding`, `dependenciesOfBinding`, `checkBinding` and `dependsOn`, not `programOf`/`bindingOf` or the `BindingProgram` types.

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Assistant interpretation:** Phase 4 of the plan slip: delete the duplicated planner logic after parity, and keep the IR internal.

**Inferred user intent:** Same as Step 1.

**Commit (code):** d080c68 — "PBUI-KERNEL-2 P4: retire the planners' duplicate structural checks; IR internal"

### What I did
- `plan.ts`: removed the four duplicated checks; header comment states the operation/structure split; `dependsOn` and `titleOfPort` re-exports dropped.
- `check.ts`: the `type` diagnostic names the context for a context-source program.
- `index.ts`: `programOf`, `bindingOf`, `dependenciesOfProgram`, `effectiveProgram`, `evaluateProgram` and the `Binding{Program,Expression,Source}` types are no longer exported; `dependsOn` from `./check`, `titleOfPort` from `./snapshot`.
- `laws.test.ts`: "§12.7 parity" describes the refusals that now come from the checker, with their sentences.
- `npx vitest run src` → 40 files, 443 tests; `tsc --noEmit` clean.

### Why
- Two implementations of one verdict drift. The guide's instruction is explicit: "delete duplicated planner logic rather than running both forever".

### What worked
- Every existing planner test passed unchanged after the deletion, including the one asserting the exact type sentence.

### What didn't work
- First parity test for a derive cycle asserted `code: "cycle"` and received `no-relation`: the selection ports are `datum`-typed and the fixture relations are all over `order`, so legality refused first. Fixed by adding a `datum.self` relation in that test and asserting both orders.

### What I learned
- Refusal precedence changed in one visible way: a derive that is both illegal (no relation) and cyclic now says "no relation" where it used to say "cycle". Legality is the more useful message, since the cycle is unreachable without a relation.

### What was tricky to build
- Choosing what stays. `planFollow` checks that the SOURCE exists before the checker runs, and must: the checker's `source-missing` is about the term's source too, but the planner needs both definitions to write titles, and the test asserts `code: "port-missing"` for a missing source. Existence stayed a planner concern for that reason.

### What warrants a second pair of eyes
- Precedence between planner policy and checker structure. The order is now: existence, self, direction, held, shared, already, then structure. A held port whose candidate would also be ill-typed says "held", which is right (the user must resume or detach first), but it is a change from "type" for the follow planner.

### What should be done in the future
- N/A.

### Code review instructions
- Diff of `plan.ts` in this commit: every deleted line should have a counterpart in `checkBinding`.
- `npx vitest run src`.

### Technical details
- What each planner still checks, after this step:

```text
planFollow   port-missing, self, direction(S in / D out), held, shared, already   → checker
planBind     port-missing, direction, document-slot, held, shared                  → checker
planAmbient  port-missing, direction, held                                         → checker
planDerive   port-missing, self, direction, held, shared, legal relations, already → checker
```

## Step 5: Prove it across the packages, on screen, and in the README

The kernel's tests are one fence; the workbench, the shop and the external consumers are the other. This step rebuilt pbui (`pnpm build`, since the packages resolve it through `dist`), typechecked every workspace package, ran every package's tests without bailing, and then exercised the link verbs by hand in two UIs: the workbench's own LinkLab story (follow, pin, resume) and the gold-coin shop (the "Link to…" family, the port badge menu, and a refusal rendered in the menu). Six screenshots and an index went into `various/screenshots/`.

The README had no section on the link kernel at all, so one was added: what the package exposes of the binding program (`normalizeBinding`, `dependenciesOfBinding`, `dependsOn`, `checkBinding`, `candidateTermOf`), what stays internal, and the planner/checker split in one paragraph.

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Assistant interpretation:** Phase 5 of the plan slip: verification beyond the kernel's own tests, screenshots for the diary and the report, documentation.

**Inferred user intent:** Same as Step 1.

**Commit (code):** b8e3687 — "PBUI-KERNEL-2 P5: README link-kernel section, screenshots with index, ticket status"

### What I did
- `pnpm build` → `pnpm -r typecheck`: every package clean.
- `pnpm -r --no-bail --workspace-concurrency=1 test`: green everywhere except two failures that predate this ticket and were baselined in KERNEL-1 (`packages/pbui-chat/test/grid-columns.test.ts`, which scans workbench CSS; `packages/pbui-workbench/src/rebalance/slate.perf.test.ts`, load-sensitive and passing alone).
- Storybook `Workbench/LinkLab`: follow, count twice, pin, count, resume; screenshots 01–03.
- Gold-coin shop demo: "Link to order detail · order" on #88150, the port badge menu, Pin, then the "Link to…" menu on #88151 showing the held refusal; screenshots 04–06.
- `README.md`: new section "Link kernel: terms, programs, planners"; `various/screenshots/README.md`; KERNEL-2 `index.md` status; related files on the ticket.

### Why
- The planners' deletions in P4 are only safe if every consumer's tests still hold; the workbench alone has 554 tests over the link handlers, badges and the "Link to…" family.

### What worked
- The held state on screen matches the law: the counter advanced to 3 while the notes port stayed on 2, and Resume brought it back to following.

### What didn't work
- The first screenshot attempt targeted the session scratchpad, which is outside the Playwright server's allowed roots; and the second targeted a directory that did not exist yet. Screenshots go under the ticket's `various/screenshots/` directory, created first.
- The first `pnpm -r test` bailed at pbui-chat's known failure and skipped the packages after it; rerun with `--no-bail`.

### What I learned
- The "Link to…" family filters its targets by `reaches` before planning, so a type refusal from the checker never reaches that menu; the held/shared/cycle refusals do. A screenshot of a checker type verdict would need the connect-mode rail or the relation palette.

### What was tricky to build
- Nothing in code. Locating the shop demo: `pnpm dev` in `packages/pbui-ecommerce/demo` listens on 5176 (its `vite.config.ts`), while 5173 belonged to an unrelated app running on this machine.

### What warrants a second pair of eyes
- The README section's claim that the checker is the one source of a cycle refusal: true for the four term verbs; `planIdentityAdd` has its own checks (KERNEL-3's subject).

### What should be done in the future
- The KERNEL-2 project report (task added at the user's request); then KERNEL-3.

### Code review instructions
- `README.md` section "Link kernel"; `various/screenshots/README.md` for what each image is evidence of.
- `pnpm build && pnpm -r typecheck && pnpm -r --no-bail test`.

### Technical details
- Per-package test counts from the no-bail run: workbench-protocol 48, pbui-workbench 554 (1 baselined perf failure), datalab-ui 281 (…), pbui-editor 35, pbui-ecommerce 12, pbui-sandbox 224, pbui-chat 241 (1 baselined), pbui-plotscript 32, chat demo 13; pbui root 443.
