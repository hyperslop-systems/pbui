---
Title: Investigation diary
Ticket: PBUI-KERNEL-1
Status: active
Topics:
    - pbui
    - actions
    - design
    - architecture
    - frontend
    - onboarding
    - refactoring
DocType: reference
Intent: long-term
Owners: []
RelatedFiles:
    - Path: repo://src/presentation/createPbui.tsx
      Note: Context value, engine construction, accept state, returned instance read with nl -ba
    - Path: repo://src/presentation/help/machine.ts
      Note: Invariants quoted for D9
    - Path: repo://src/presentation/index.ts
      Note: The export surface read first; the four-resolvers framing
    - Path: repo://ttmp/2026/09/02/PBUI-KERNEL-1--rethinking-the-pbui-presentation-kernel-one-declaration-sibling-resolvers-and-the-runtime-that-binds-them/sources/PBUI-Composable-Kernel-Research-Report.md
      Note: Imported research report that motivated the canonical relation system, binding IR, explicit revisions, and identity quotient
    - Path: repo://ttmp/2026/09/02/PBUI-KERNEL-1--rethinking-the-pbui-presentation-kernel-one-declaration-sibling-resolvers-and-the-runtime-that-binds-them/sources/pbui-composable-kernel.patch
      Note: Imported 31-file composable-kernel research implementation; applied only in a detached worktree for review
ExternalSources: []
Summary: 'Chronological record of the PBUI-KERNEL-1 analysis: how the presentation kernel was mapped part by part, how the six consumers and the seven prior tickets were surveyed for duplication and open backlog, and how the consolidation guide was produced and delivered.'
LastUpdated: 2026-09-02T14:45:00-04:00
WhatFor: Continue or review the kernel consolidation analysis without re-deriving the evidence.
WhenToUse: Before starting Phase 0 of the guide, or when checking why a decision cites a file or a prior ticket.
---



# Diary

## Goal

Capture how the whole presentation kernel was mapped (references, descriptors, graph, facts, the four resolvers, the runtime, the page protocol), how consumer wiring and prior-ticket backlogs were gathered as evidence, and how the consolidation design and its decision records were derived, validated and uploaded.

## Step 1: Map the kernel, survey consumers and prior tickets, write the guide

The request came after two review conversations on PBUI-FACETS-1 in which the user asked what registries exist besides actions and what each declaration (graph, scopes, predicates, descriptors, contributions, translators, help) is for. The answers showed a pattern: four sound resolvers, one runtime, and a product-facing declaration assembled by hand in every product with the same shape and different literals. The user then asked for a separate ticket to analyze, design and rethink the kernel as a whole.

The investigation had two halves. I read the core layer myself with line anchors: the export surface, the context value and returned instance of `createPbui`, the engine construction and accept state, the escape-surface stack and focus helpers, the help machine's header and events, the registry's validation, the id helpers, the vocabulary generator, and the Presentation props. In parallel, an explorer agent surveyed every consumer's wiring (datalab-ui, the chat demo, workbench fragments, sandbox, plotscript, ecommerce, editor, core stories) and the seven prior tickets (ACTIONS-1/2/3/PORT, HELP-001/002, HARDEN-1) for open tasks, invariants, deferrals and follow-ups, returning file:line evidence. The guide's §3.11 consumer table, §4.1 duplication list and §4.2 backlog table are that survey, checked against the files I had read.

### Prompt Context

**User prompt (verbatim):** "Ok, create a separate ticket to analyze, design, rethink the PBUI kernel.

Create  a detailed analysis / design / implementation guide that is for a new intern, explaining all the parts of the system needed to understand what it is, with prose paragraphs and bullet point sand pseudocode and diagrams and api references and file references. It should be very clear and technical. Store in the ticket and the nupload to remarkable."

**Assistant interpretation:** Create ticket PBUI-KERNEL-1; write an intern-level guide that maps every part of the presentation kernel with evidence, records what consumers duplicate and what prior tickets left open, proposes a consolidation (one declaration, sibling resolvers kept, a snapshot helper, one condition system, a runtime that surfaces refusals and explains itself, the link kernel fed from the same object), with decision records, phases and tests; keep a diary; validate; upload.

**Inferred user intent:** Have one place that explains the kernel end to end and a plan to remove the accumulated wiring duplication without touching resolution semantics, before more consumers (facets, turboproof, agentlogic) are built on it.

**Commit (code):** none — documentation only.

### What I did

- Created the ticket and two documents with `docmgr ticket create-ticket` / `docmgr doc add`.
- Inventoried `src/presentation`, `src/surfaces.ts`, `src/focus.ts`, `src/chrome` with `wc -l` (13,375 lines including chrome and tests; 24 test files, 224 tests under `src/presentation`).
- Read with line numbers: `presentation/index.ts`, `actions/index.ts`, `links/index.ts` (export surfaces); `createPbui.tsx:279-332` (context value), `:334-400` (engine construction, Provider state), `:455-500` (accept flow), `:1255-1283` (returned instance), `:196-278` (Presentation props); `surfaces.ts`, `focus.ts`; `help/machine.ts:1-90`; `actions/vocabulary.ts:56-108`; `actions/registry.ts:68-160`; `actions/ids.ts`; `Pbui.stories.tsx` wiring lines; `packages/pbui-workbench/src/actions.ts:1-70`.
- Delegated the consumer and prior-ticket survey to an explorer agent (Part A: eight packages and the core stories; Part B: seven tickets), which reported file:line evidence, the duplication list, the ACTIONS-3 Phase C items with status, the ACTIONS-2 five identities and pitfalls, ACTIONS-1's invariants and validation rules, HELP-001's deferred list, HELP-002's invariants and follow-ups, ACTIONS-PORT's unchecked tasks and a factual error in its design doc, HARDEN-1's root causes, and the playbook's stale sections.
- Wrote the guide (§0–§14): executive summary; problem and the meaning of "rethink"; current state in eleven evidence subsections plus the consumer table; gap analysis (duplication, backlog table, what must not change); design (kernel object, snapshot helper, one condition system, runtime taking the kernel with `onRefuse`, click ladder as a function and accept flow as a machine, introspection, vocabulary, link kernel from the kernel object, fragments, consumers after); nine decision records; pseudocode for construction, the click/perform flow, the accept machine and introspection; three diagrams; eight phases; tests; risks and open questions; reading order; glossary.

### Why

- The resolvers must not change (ACTIONS-3's "changes what surrounds the kernel, not the kernel"); the guide therefore separates the fence (§4.3, §10) from the design, and every phase's exit criterion is the Phase 0 goldens.
- The consolidation items already had names in ACTIONS-3 Phase C and HELP-002 §13; the guide's job was to give them a puller (facets, turboproof, the two-graph and empty-graph findings) and one shape rather than six separate helpers.
- Decision records exist for each place a future reader might re-litigate: merging resolvers, compatibility on `createPbui`, derived revisions, the `datalab-ui` freeze, the page protocol, machines versus functions.

### What worked

- Reading the export lists first (`index.ts` files) gave the kernel's public surface in three commands and made the "four resolvers over one facts type" framing obvious.
- The explorer agent's per-package table surfaced two findings I would not have looked for: the shop builds the type graph twice (`createShop.ts:48`), and the workbench's link handlers default to an empty graph (`handlers.ts:90`), which silently makes every type isolated.
- HELP-002's machine header (`machine.ts:1-33`) is a complete statement of the pattern the runtime's remaining policy should follow; quoting its invariants made D9 short.

### What didn't work

- N/A for the analysis. One tooling note: `grep --include=*.tsx` is rejected by zsh's glob handling in this shell; `rg` with `-g` was used instead.

### What I learned

- `predicates` is accepted by two registries and declared by no product; the acceptance path hardcodes an empty map (`createPbui.tsx:357, 371`). ACTIONS-3 C1 is a two-line change once the kernel object owns the map.
- Revisions are computed five different ways across consumers, each with the same "moves iff facts move" comment; the convention is real but unenforced.
- The PBUI-LINK-1 guide's §6.5 sketched `LinkSnapshot extends SelectionSnapshot`; the implementation kept them separate, and the KERNEL-1 design keeps that (D6) while unifying the deps.
- ACTIONS-PORT exists as two ticket directories and its design doc claims `createWorkbench` owns `createPbui`, which is not true at HEAD; both are Phase 6 hygiene items.

### What was tricky to build

- **Drawing the line between kernel and page protocol.** `surfaces.ts`, `focus.ts` and input modality are module globals shared by packages that never see a `PresentationKernel`; folding them in would have made the kernel object own DOM coordination. HELP-002 §13's rule ("a third machine") gave the criterion, recorded as D8.
- **Choosing the size of the runtime refactor.** The click ladder has no state and the accept flow has; a function for one and a machine for the other (D9) keeps the change proportional and reuses the help machine's test harness shape.
- **The `datalab-ui` freeze.** D3's hard cutover changes `createPbui`'s signature, and `datalab-ui` is frozen by LINK-1 D10. D7 records the exception (three call sites, goldens as the fence) and asks the user to confirm it.

### What warrants a second pair of eyes

- D7 (touching frozen `datalab-ui`) and D3 (no compatibility path on `createPbui`).
- The `factsFor` return shape (open question 2) and whether introspection is a Provider prop (open question 3).
- Sequencing with PBUI-FACETS-1 (open question 5): facets should read `kernel.translators` rather than a separate `FacetDeps`.

### What should be done in the future

- Phase 0 goldens across the five callers, then Phase 1 on a branch.
- Confirm D7 with the user before Phase 6; then rewrite the playbook's §6 and merge the ACTIONS-PORT directories.

### Code review instructions

- Check each `path:line` in §3 and §12 against `/home/manuel/workspaces/2026-09-01/add-plot-editor/pbui`.
- `docmgr doctor --ticket PBUI-KERNEL-1 --stale-after 30`; `remarquee cloud ls /ai/2026/09/02/PBUI-KERNEL-1 --long --non-interactive`.
- No code changed; nothing to run.

### Technical details

Commands that mapped the kernel:

```bash
find src/presentation src/surfaces.ts src/focus.ts src/chrome -type f -name "*.ts*" | xargs wc -l | sort -k2
rg -c "^\s*(it|test)\(" src/presentation --glob '*.test.ts*'
grep -v "^\s*$" src/presentation/index.ts src/presentation/actions/index.ts
nl -ba src/presentation/createPbui.tsx | sed -n 279,340p
nl -ba src/presentation/createPbui.tsx | sed -n 1255,1283p
nl -ba src/presentation/actions/registry.ts | sed -n 68,160p
rg -n "export function create[A-Za-z]*Registry|export interface [A-Za-z]*Registry\b" src packages/*/src -g '!*test*'
```

Ticket creation:

```bash
docmgr ticket create-ticket --ticket PBUI-KERNEL-1 \
  --title "Rethinking the pbui presentation kernel: one declaration, sibling resolvers, and the runtime that binds them" \
  --topics pbui,actions,design,architecture,frontend,onboarding,refactoring
docmgr doc add --ticket PBUI-KERNEL-1 --doc-type design-doc --title "The pbui presentation kernel: intern analysis, design, and implementation guide for its consolidation"
docmgr doc add --ticket PBUI-KERNEL-1 --doc-type reference --title "Investigation diary"
```

## Step 2: Import and evaluate the composable-kernel research package

The follow-up supplied a research report and a 31-file implementation patch, then clarified that “import” meant preserving both artifacts under this ticket rather than applying the patch to the working branch. I copied both files byte-for-byte into `sources/`, read the complete report and patch, and evaluated the patch in a detached temporary worktree so the active branch remained unchanged.

The report materially improves the original design in three places: explicit semantic revisions replace structural serialization, declared scopes are distinguished from overridable active scope stacks, and translators become a canonical relation system consumed by acceptance and projected into the link world. The implementation is credible—it applies cleanly to the ticket commit, passes root typechecking and all 347 root tests, and passes recursive workspace typechecking—but it should be treated as a research prototype rather than applied wholesale because it combines the kernel cutover with a binding IR, identity terminology, port-contract factoring, and compatibility paths that a clean cutover does not need.

### Prompt Context

**User prompt (verbatim):** "Import /home/manuel/Downloads/pbui-composable-kernel.patch and ~/Downloads/PBUI-Composable-Kernel-Research-Report.md and read them and then assuming we can do a clean cutover across all our pbui using repos, how would you apply the results from the report?

[REMINDER] Output a <summary>...</summary> block at the VERY END of your response. This is mandatory."

**User clarification (verbatim):** "Import into the sources directory of the ticket is what i mean, not apply necessarily.

[REMINDER] Output a <summary>...</summary> block at the VERY END of your response. This is mandatory."

**Assistant interpretation:** Preserve the supplied patch and report as ticket evidence, read and independently validate them without changing production code, then recommend how their results should shape a coordinated clean cutover across every PBUI consumer.

**Inferred user intent:** Use the external research as an implementation input rather than blindly landing its patch, and exploit the availability of a coordinated migration to remove transitional APIs and arrive at a smaller final architecture.

**Commit (code):** none — the patch was applied only in `/tmp/pbui-kernel-patch-review` for evaluation.

### What I did

- Copied `pbui-composable-kernel.patch` and `PBUI-Composable-Kernel-Research-Report.md` into the ticket’s `sources/` directory.
- Verified byte identity with SHA-256: patch `47e9233d7ba29726f4aa6fb938416250c88fa8bea4682673d9cd35e42a82ef62`; report `91db163e612775e156a88bcea8146e4de631e45b113669b17eb00480c28fe065`.
- Read all 1,511 report lines and all 3,633 patch lines.
- Ran `git apply --check` against PBUI commit `f2cac0b66028a3b41e50b328d08860c4bc87b783`; it passed.
- Created detached worktree `/tmp/pbui-kernel-patch-review`, applied the patch there, and ran `git diff --check`, `pnpm typecheck`, and `pnpm test`.
- Ran recursive workspace typechecking and tests after wiring the temporary worktree to the existing pnpm dependency directories.
- Reproduced the only recursive-suite failure on the untouched main worktree to establish that it predates and is unrelated to the patch.

### Why

- Source imports should remain auditable and byte-identical to what was supplied.
- Applying in a detached worktree distinguishes “the patch is syntactically plausible” from “the report claims it was tested,” without contaminating the active branch.
- A clean-cutover recommendation should separate durable semantic improvements from migration-only compatibility and unrelated refactors bundled into the research patch.

### What worked

- `git apply --check` and actual detached-worktree application both succeeded cleanly.
- Root `pnpm typecheck` passed.
- Root Vitest passed: `39 passed` files and `347 passed` tests.
- Recursive typechecking passed for all 11 selected workspace projects after package dependency links were made available.
- Before the known baseline failure stopped recursive execution, package suites passed for workbench-protocol (48), datalab-ui (554), pbui-workbench (281), pbui-editor (12), pbui-ecommerce (35), pbui-sandbox (224), and pbui-plotscript (32); pbui-chat passed 240 tests and failed one unrelated CSS policy test.

### What didn't work

- The first recursive typecheck from the temporary worktree failed because package-local pnpm links were absent:
  `error TS2688: Cannot find type definition file for 'node'.`
  The first recursive test similarly could not resolve `@bufbuild/protobuf`. I replaced the temporary package `node_modules` directories with links to the existing workspace package dependency directories and reran; recursive typechecking then passed.
- Recursive tests stopped at pbui-chat with:
  `AssertionError: expected [ …(4) ] to deeply equal []`
  in `test/grid-columns.test.ts`. Running that same test in the untouched main worktree produced the same four CSS offenders, proving it is a baseline failure rather than a patch regression.

### What I learned

- The research patch already fixes two concerns from the prior review: it requires explicit/product-derived revisions and supports a validated per-snapshot active scope stack.
- Its canonical relation system is the report’s strongest new contribution: explicit finite compositions, no inferred path search, selector provenance, detailed partial-function outcomes, and a controlled `LinkSnapshot` → `SelectionSnapshot` projection.
- The patch intentionally retains translator, matcher, acceptance, link-callback, and `createPbui` compatibility paths. Those are useful for incremental adoption but should be removed in the user’s assumed clean-cutover scenario.
- The patch exposes every canonical relation to both acceptance and linking. A final design still needs explicit operation eligibility so an acceptance-only or non-serializable relation is not offered as a persistent link derivation.

### What was tricky to build

- **Validating without applying.** `git apply --check` verifies context only, so I created a detached worktree, applied the patch there, and pointed it at the existing dependency store. The first recursive run revealed that pnpm’s package-local relative symlinks do not survive a worktree without package `node_modules`; replacing those directories with links to the original workspace resolved the environmental errors.
- **Separating patch failures from repository failures.** The recursive run stopped on a CSS policy test outside every changed file. I reran the exact test against the untouched checkout and obtained the same failure and offender list, which established the baseline rather than treating the suite as fully green.
- **Separating semantic consolidation from patch scope.** The 31-file patch combines at least five reviewable changes: shared predicates/selectors, relations and kernel assembly, runtime compatibility, binding-program IR/checking, and identity/port-contract cleanup. A clean cutover should sequence those rather than equate “applies cleanly” with “should land as one commit.”

### What warrants a second pair of eyes

- Relation operation eligibility and the `LinkSnapshot` → presentation-snapshot projection for persisted derivations.
- Whether universal-scope provenance should use the synthetic `"__unscoped__"` identifier or an explicit nullable scope.
- Static checker behavior for suspended dependencies and conservative composition endpoint checking.
- Which normalized binding-program types should be public API versus internal implementation detail.

### What should be done in the future

- Amend the KERNEL-1 design with the report’s accepted changes and a clean-cutover decision matrix.
- Split implementation into independently reviewable semantic commits, migrate every in-repository and external PBUI consumer, then delete all migration-only APIs in the same coordinated release.
- Run complete builds, consumer smoke tests, Storybook/browser checks, and external-repository CI before declaring the cutover complete.

### Code review instructions

- Start with `sources/PBUI-Composable-Kernel-Research-Report.md` §§“System architecture,” “Compatibility and migration,” and “Selected design cautions.”
- Review the patch in this order: `relations/types.ts` and `relations/system.ts`; `kernel/types.ts` and `kernel/create.ts`; `translators/resolve.ts`; `links/expression.ts` and `links/check.ts`; then `createPbui.tsx`.
- Reproduce the safe validation with `git apply --check sources/pbui-composable-kernel.patch`; do not apply it to the active branch as part of source review.

### Technical details

```bash
sha256sum /home/manuel/Downloads/pbui-composable-kernel.patch \
  ttmp/2026/09/02/PBUI-KERNEL-1--*/sources/pbui-composable-kernel.patch
git apply --check ttmp/2026/09/02/PBUI-KERNEL-1--*/sources/pbui-composable-kernel.patch
git worktree add --detach /tmp/pbui-kernel-patch-review HEAD
git -C /tmp/pbui-kernel-patch-review apply /absolute/path/to/sources/pbui-composable-kernel.patch
pnpm typecheck
pnpm test
pnpm -r typecheck
pnpm -r test
```

## Step 3: Write the authoritative clean-cutover implementation guide

This step turned the original KERNEL-1 map, the imported research report, the validated prototype patch, and the user's clean-cutover assumption into one implementation-ready guide. The new guide is deliberately stricter than the prototype about the final public API and more expressive around relation exposure, abstract codomains, active scopes, reusable fragments, and introspection disclosure.

The document keeps the original guide as historical/current-state evidence while superseding its API and phase plan. It explains the current action, help, acceptance, runtime, link, and identity systems; defines the target semantic model and APIs; records fifteen decisions; supplies pseudocode and text diagrams; gives file-level migration guidance for every known consumer; and ends with test, risk, deletion, release, and intern-reading checklists.

### Prompt Context

**User prompt (verbatim):** "Create  a detailed analysis / design / implementation guide that is for a new intern, explaining all the parts of the system needed to understand what it is, with prose paragraphs and bullet point sand pseudocode and diagrams and api references and file references. It should be very clear and technical. Store in the ticket and the nupload to remarkable.

[REMINDER] Output a <summary>...</summary> block at the VERY END of your response. This is mandatory."

**Assistant interpretation:** Author a standalone, technically rigorous intern guide inside PBUI-KERNEL-1 that consolidates the current-system evidence and imported research into the final clean-cutover design, then validate the ticket and deliver the guide with its investigation diary to reMarkable.

**Inferred user intent:** Leave the next implementer with one authoritative document that explains both why the architecture exists and exactly how to implement, migrate, test, review, and release it without re-deriving the prior discussions.

**Commit (code):** none — documentation and ticket bookkeeping only.

### What I did

- Created `design-doc/02-clean-cutover-composable-pbui-presentation-semantics-kernel-intern-analysis-design-and-implementation-guide.md` with docmgr.
- Wrote a 25-section guide covering current architecture, research assessment, semantic laws, target modules/APIs, relations, fragments, scopes/revisions, binding programs, identity quotient, runtime policy, vocabulary/introspection, fifteen decision records, eleven implementation phases, per-consumer migration, tests, risks, release criteria, glossary, and reading order.
- Added the final concepts omitted by the prototype: first-class fragments, relation interpreter exposure, abstract codomains with concrete outputs, strict closed-world types, nullable universal-scope provenance, one explicit runtime context input, and a strict model-only final runtime.
- Updated `index.md` to make the new guide authoritative and link the original guide, diary, report, and patch.
- Added a supersession notice to the original design guide without deleting its evidence map.
- Related seven key current/research files to the new guide and validated its frontmatter.
- Prepared a reMarkable bundle containing the authoritative guide and investigation diary.

### Why

- The original guide predates the canonical relation and binding-program research and contains revision, scope, vocabulary, and compatibility decisions that should no longer drive implementation.
- A clean cutover can remove migration infrastructure, but only if every consumer, test, story, smoke script, and external repository has explicit migration and release gates.
- Named fragments and relation exposure prevent the new “one declaration” from becoming either one giant file or a mechanism that accidentally offers every semantic arrow to every interpreter.

### What worked

- The guide was created with complete docmgr frontmatter and no placeholder sections.
- Markdown fence validation found an even set of fenced blocks, and docmgr frontmatter validation passed.
- The ticket index now identifies one authoritative implementation document while preserving historical evidence.
- reMarkable dry-run and upload results are recorded below in Technical details.

### What didn't work

- N/A during guide authoring. The known baseline pbui-chat CSS-policy test failure from Step 2 remains unrelated and is explicitly listed as a Phase 0 baseline item.

### What I learned

- The smallest stable shared substrate is graph + known scopes + predicates + selector + canonical relations; the interpreters should share those values without sharing terminal result semantics.
- “One declaration” needs physical composition through named fragments, otherwise it merely moves disconnected spread arrays into a larger product literal.
- Clean code cutover and persistence cutover are different decisions: all repositories can adopt the new APIs while existing workbench binding documents retain their wire grammar.
- Relation exposure is required to make one canonical relation system safe: acceptance, facets, and persisted derivation must discover deliberate subsets.

### What was tricky to build

- **Reconciling the original guide and report without producing a third ambiguous proposal.** The new document explicitly marks itself authoritative, adds a supersession notice to the original, and records accepted decisions rather than leaving competing alternatives unresolved.
- **Keeping semantic compression without over-unification.** The guide centralizes graph, predicates, selectors, relations, snapshots, fragments, and vocabulary while repeatedly fencing off action competition, help accumulation, acceptance choice, link-program interpretation, React policy, page coordination, and product authorization.
- **Designing a clean cutover that remains reviewable.** The final release has no compatibility branch, but implementation is split into semantic phases and coordinated through an integration artifact so downstream repositories can validate before publication.

### What warrants a second pair of eyes

- C6 relation exposure defaults and whether facet metadata belongs directly in exposure or in a facet-specific projection.
- C8 abstract-codomain behavior and the runtime rule that output references must be concrete declared subtypes.
- C9 strict closed-world migration for the sandbox's universal family and any external undeclared presentation types.
- The exact public/private boundary of the binding-program IR.
- The requirement that every Provider supply an `onRefuse` behavior.

### What should be done in the future

- Obtain architecture approval for decisions C1–C15 before Phase 0 implementation.
- Replace the superseded open implementation tasks with the new Phase 0–11 task set when implementation starts.
- Keep the guide and diary synchronized with implementation discoveries, especially consumer inventory and revision contracts.

### Code review instructions

- Start with the new guide §§1, 4, 5, 10, 17, 18, and 20.
- Compare relation claims against the imported report's “Formal model” and the patch's `relations/system.ts` diff.
- Compare current-state claims against `src/presentation/actions`, `context/match.ts`, `translators`, `links`, and `createPbui.tsx`.
- Validate with `docmgr validate frontmatter --doc <guide> --suggest-fixes` and `docmgr doctor --ticket PBUI-KERNEL-1 --stale-after 30`.

### Technical details

```text
Guide: design-doc/02-clean-cutover-composable-pbui-presentation-semantics-kernel-intern-analysis-design-and-implementation-guide.md
Sections: 25 top-level sections plus 15 decision records and 11 implementation phases
Markdown fences: balanced
Frontmatter: valid
reMarkable dry run: passed for the guide + diary bundle at `/ai/2026/09/02/PBUI-KERNEL-1`
reMarkable upload: `OK: uploaded PBUI-KERNEL-1 Clean Cutover Composable Kernel Guide.pdf -> /ai/2026/09/02/PBUI-KERNEL-1`
```

## Step 4: Assess the guide, redo the consumer inventory, confirm D3/D7, split the phases

The user asked for an opinion on the clean-cutover guide and what to do. The assessment held that the design is right and the eight corrections in §1.2 are the valuable part, but that the scope was five projects in one ticket, that two open decisions blocked starting, and that the guide's external-consumer picture was wrong. A workspace-wide inventory then found the consumer the guide did not know about (rag-ttc's workbench web app, the largest kernel consumer in the org), reclassified turboproof (pre-kernel 0.6.0, not a participant) and agentlogic (components plus pbui-workbench only), and identified hyperblog as the sole consumer of the open-world wildcard family. The user confirmed D3 (hard cutover) and D7 (touch datalab-ui), asked for the phase split, and asked for implementation with diary, slips, and screenshots.

The guide gained §0.1 (scope after the split), §3.13.1 (the inventory table and its consequences), C16–C18 (hard cutover, mechanical datalab-ui, pbui-chat as a fragment), a rewritten Phase 6 (in-repo packages first, then rag-ttc and hyperblog from the sibling checkouts, turboproof and agentlogic out), stubs for Phases 8–10 pointing at PBUI-KERNEL-2/3/4, a Phase 1 preamble that says to apply the prototype patch rather than rewrite it, and a §20.3 that names the two external repositories. tasks.md was rewritten to the new phases (it still carried the first guide's seven-phase plan with `kernel.translators`).

### Prompt Context

**User prompt (verbatim):** "Read PBUI-KERNEL-1  pbui/ttmp/2026/09/02/PBUI-KERNEL-1--rethinking-the-pbui-presentation-kernel-one-declaration-sibling-resolvers-and-the-run time-that-binds-them/design-doc/02-clean-cutover-composable-pbui-presentation-semantics-kernel-intern-analysis-design-and -implementation-guide.md And tell me what you think and what to do" — then "How do agentlogic and turboproof do their actions and such?" — then "what about rag-ttc/ ?" / "in this workspace." — then "k, update the design, split out the phases as tickets. D3 hard cutover yes, D7 yes touch datalab. Then implement, commit at appropriate intervals and keep a detailed diary as you work (using the diary format from the skill), Print out a brutalist work slip with the plan / different phases for the ticket. then before stsarting a phase, plrint a split about the phase, and print one when the phase is done." — mid-turn: "do we need to adapt the pbui-chat as well to use the new kernel?" and "take screenshots as you work and test, to go with the diary, and later on to write our report."

**Assistant interpretation:** Review the guide critically, ground it in what the consumers actually do, fold the corrections into the guide, split the out-of-scope phases into their own tickets, then implement KERNEL-1 phase by phase with commits, diary steps, printed slips at plan/phase-start/phase-end, and screenshots.

**Inferred user intent:** Ship the consolidation boundary (compiled model, relations, strict runtime, every consumer migrated) as one reviewable branch, with enough written and printed evidence to write a report afterwards.

**Commit (docs):** 4d49e37 — "PBUI-KERNEL-1: clean-cutover composable-kernel guide, imported research report and prototype patch"; 312bffd — "PBUI-KERNEL-1: consumer inventory, C16–C18, phase split into KERNEL-2/3/4, tasks rewritten"

### What I did
- Read the 2,400-line guide, tasks, changelog, the patch's file list, and the current `src/presentation` tree.
- Grepped every repository in the workspace that depends on `@hyperslop-systems/pbui` for presentation-layer symbols; read rag-ttc's `apps/workbench/web/src/pbui/{runtime,actions,translators,help}` and `sink.ts`/`acceptBridge.tsx`, hyperblog's `ui/src/pbui/runtime.tsx`, turboproof's `ui/src/pbui/{runtime,verbs,types,descriptors/*}`, agentlogic's `store/workbenchShell.tsx`.
- Edited the guide (§0.1, §3.13.1, C16–C18, Phase 1 preamble, Phase 6, Phase 8–10 stubs, §20.3); rewrote tasks.md; updated index.md.
- Created PBUI-KERNEL-2/3/4 with docmgr and filled their index overviews, specification pointers and exit criteria.
- Ran the baseline: root typecheck, 331 tests, recursive typecheck all green.
- Printed the plan slip, a "P0 DONE" status slip (commit 312bffd), and a "P1 START" slip.

### Why
- The guide's Phase 6 and §20.3 optimized for two repositories that do not use the kernel and missed the one that does. Migration risk lives in rag-ttc (frozen wire ids, vocabulary golden, pbui-chat over the instance, accept from outside React), not in agentlogic.
- Eleven phases in one ticket would have made the branch unreviewable; Phases 8–10 share no code with the consolidation.

### What worked
- The inventory grep across `~/workspaces/2026-09-01/add-plot-editor/*` was decisive in one pass once the pattern stopped requiring `createPbui(` on one line.

### What didn't work
- The first grep for `createPbui\(` missed turboproof, whose import and call are on different lines; I told the user no external repo used the kernel and had to correct it. Lesson: grep for the bare symbol, then read.

### What I learned
- rag-ttc is already shaped like the target (one facts type, composed semantic revision, abstract organizing types, unconditional translators with frozen ids), so its migration is mechanical.
- hyperblog is the only consumer of `define.family("*")` over an empty graph; the closed world (C9) is a real behavior change for it, not a cleanup.
- pbui-chat's package boundary is `PbuiInstance` + `pbui.registry`; under the fragment model the chat types belong in a fragment (C18).

### What was tricky to build
- Deciding where the patch's KERNEL-2/3 code goes: the patch is one green unit, so KERNEL-1 applies all of it and freezes the out-of-scope files rather than trying to carve them out.

### What warrants a second pair of eyes
- §3.13.1's claim that agentlogic needs only a version bump rests on `createWorkbench`/`defineApp` staying stable through Phase 6.

### What should be done in the future
- Turboproof upgrade ticket in that repository (0.6.0 → post-KERNEL-1).

### Code review instructions
- Guide §0.1, §3.13.1, C16–C18, Phase 6; `tasks.md`; the three new ticket `index.md` files.

### Technical details
- Inventory command: `rg -l '"@hyperslop-systems/pbui"' <workspace> --glob package.json`, then per repo `rg -n "createPbui|createActionRegistry|PresentationTranslator|defineActions|createPbuiChat|usePbui" src`.

## Step 5: Phase 1 — apply the prototype, then one selector substrate with an explicit universal subject and a closed type world

Phase 1 began by applying the imported 31-file prototype patch unchanged (commit d2ee0c2: root typecheck green, 347 tests). Everything after is a delta toward the guide. The delta in this step is the selector substrate of §9: `context/match.ts` became `context/selector.ts`; `PresentationSelector.subject` is now the explicit union `{ kind: "type", type, match } | { kind: "any-declared-type" }` built by `selectorOf` from the flat `subject`/`match` authoring shape every contribution keeps; provenance is `SelectorMatch` with `declaredType: RuntimeTypeId | null` and `scope`/`scopeIndex: … | null` for scope-universal selectors (the prototype's synthetic `"__unscoped__"` provenance is gone); `requireScoped` narrows for the two interpreters that require explicit scopes. The type graph is closed: `ancestors`, `isSubtype` and `distance` throw for an undeclared subject type, and `matchSelector` checks `graph.has` up front.

The action resolver's inline `"*"` path is deleted; families use `anyDeclaredType` and go through the same selector. Vocabulary emits `subject: null` for a universal family. Acceptance ranks a scope-universal relation behind any scoped one (`scopeIndex ?? Infinity`), which the prototype got wrong (it gave universal relations index 0, the nearest). The `matchContext`/`ContextTarget`/`activeScope` compatibility exports are removed from the package index.

### Prompt Context

**User prompt (verbatim):** (see Step 4)

**Assistant interpretation:** Land Phase 1 of the guide on top of the applied prototype, keeping the workspace green.

**Inferred user intent:** A reviewable first semantic step that removes the two open-world escape hatches (`"*"`, isolated nodes) the guide's C9 names.

**Commit (code):** d2ee0c2 — "PBUI-KERNEL-1 P1a: apply the composable-kernel prototype patch as the starting point"; 0007f6f — "PBUI-KERNEL-1 P1: one selector substrate — explicit universal subject, nullable scope provenance, closed type world"

### What I did
- `git apply` of `sources/pbui-composable-kernel.patch`; typecheck + tests; committed as-is.
- New `src/presentation/context/types.ts` (SelectorSubject, anyDeclaredType, SelectorMatch, ScopedSelectorMatch), `context/selector.ts` (activeScope, selectorOf, requireScoped, matchSelector), `context/selector.test.ts` (adds universal-subject, universal-scope, and closed-world tests); deleted `context/match.ts` and its test.
- `actions/typeGraph.ts`: undeclared subject throws; docs updated; test flipped.
- `actions/types.ts`: `ActionFamily.subject: RuntimeTypeId | AnyDeclaredTypeSubject`.
- `actions/registry.ts`, `actions/resolve.ts`, `actions/vocabulary.ts`, `help/resolve.ts`, `relations/system.ts`, `relations/types.ts`, `translators/resolve.ts`, `index.ts`: rewired to the selector; `"*"` checks replaced by `isAnyDeclaredType`.
- `packages/pbui-sandbox/src/actions.ts`: generated-actions family subject → `anyDeclaredType`.
- `createPbui.tsx`: `PbuiInstance`'s facts parameter defaults to `any` (see tricky).
- `packages/datalab-ui/test/descriptors.test.ts`: the "unknown type degrades" test now expects the closed-world throw.
- Validation: `pnpm typecheck` clean; `pnpm test` 349 passed; `pnpm build`; `pnpm -r typecheck` clean; `pnpm -r test`: datalab 554, workbench 281 (see didn't-work).

### Why
- §9.2 replaces string wildcard behavior with an explicit union so a universal family is a declared intent, not a spelling; §5.1 makes unknown types errors so one validated declaration can actually guarantee consistency.

### What worked
- Keeping the flat `subject`/`match` authoring shape on contributions and lifting it in one `selectorOf` meant no product declaration changed shape; only the sandbox's `"*"` moved.

### What didn't work
- `pnpm -r typecheck` failed in `pbui-chat/demo` with `Types of property 'kernel' are incompatible … PredicateRegistry<Values, DemoFacts> is not assignable to PredicateRegistry<Values, unknown>`. Cause: the prototype's instance exposes `kernel` typed by `ProductFacts`, invariant through predicates, while `PbuiInstance` defaulted `ProductFacts = unknown`. The diary's Step 2 "recursive typecheck passes" was measured against a stale `dist`; packages resolve pbui through `dist`, so `pnpm build` must precede `pnpm -r typecheck`.
- `pnpm -r test` stopped at datalab's `no descriptor means no verbs, not a crash` (expected: closed world). `pbui-workbench`'s "every generator over 12 skewed tiles stays interactive" showed a × under the parallel run (849 ms) and passes alone: a load-sensitive perf test, not a regression.

### What I learned
- The prototype's universal relations ranked nearest in acceptance; §11.3's "retain nearest scope" only makes sense if universal means "no claim", so they now rank last.

### What was tricky to build
- The `PbuiInstance` default. Facts appear only in invariant positions on the instance, so `unknown` makes no concrete instance assignable to the facts-agnostic spelling pbui-chat uses. `any` is the correct default for that spelling (the same reason React's `ComponentType<any>` exists); Phase 5 will keep it when the instance exposes `presentation`.
- Trace ordering in `actions/resolve.ts`: the selector checks type before scope but the trace must interleave invocation between them, so the rejection is still held and inspected by stage rather than acted on.

### What warrants a second pair of eyes
- `help/resolve.ts` maps a null `declaredType` to the concrete type for provenance; help rules cannot be universal today, so this is unreachable, but it is a silent default.
- The closed world now throws from `matchSelector` during hover resolution. That is what C9 asks for ("unknown references fail visibly"), but hyperblog will throw on every reference until its Phase 6 migration declares its types.

### What should be done in the future
- Phase 2: relation exposure, abstract codomains, vocabulary; Phase 3: `model/` replacing `kernel/`.

### Code review instructions
- Start at `src/presentation/context/selector.ts` and `context/types.ts`; then the `resolve.ts` loop head in `actions/`; then `actions/typeGraph.ts` `ancestorsOf`.
- Validate: `pnpm typecheck && pnpm test && pnpm build && pnpm -r typecheck && pnpm -r test`.

### Technical details
- Ranking change in `translators/resolve.ts`: `scopeIndex: candidate.match.scopeIndex ?? Number.POSITIVE_INFINITY`.

## Step 6: Phase 2 — relations declare who may discover them

The prototype's relation system already had the right shape (named contextual partial functions, explicit composition, detailed outcomes). Phase 2 adds what §10 says was missing: every relation and composition carries a required `exposure` naming the interpreters that may discover it (`acceptance`, `facet`, `derivation` with the serializable transport contract), discovery is filtered by exposure before any relation runs, and a relation that exposes nothing and is named by no composition is an advisory `diagnostics()` finding rather than a silent dead declaration. Abstract codomains became legal (C8): a relation may promise `party` and return a `customer`; evaluation rejects undeclared, abstract, and non-reaching outputs with three distinct messages. The prototype's `requireConcreteTargets` flag is gone.

Acceptance now asks for `exposedTo: "acceptance"`; the kernel's link dependency projection offers only `exposed("derivation")` (one line of Phase 7 brought forward because it fell out of the same change). `relationFromTranslator` marks its output acceptance-exposed so the compatibility path keeps working until Phase 4 deletes it.

### Prompt Context

**User prompt (verbatim):** (see Step 4)

**Assistant interpretation:** Land the relation-system deltas of guide §10 and §19.3 on the applied prototype.

**Inferred user intent:** A relation registry where a convenient acceptance conversion can never silently become a persistent link operator (risk §21.2).

**Commit (code):** 0309a70 — "PBUI-KERNEL-1 P2: canonical relations — interpreter exposure, abstract codomains, diagnostics"

### What I did
- `relations/types.ts`: `RelationInterpreter`, `RelationExposure`, `RelationDiscoveryOptions`, `RelationDiagnostic`; `exposure` required on `RelationDeclarationBase`; definitions carry exposure.
- `relations/system.ts`: `normalizeExposure` (throws on missing exposure or a non-serializable derivation transport); `referenced` set while preparing compositions; `exposed(interpreter)`, `diagnostics()`, `applicable/matches(reference, snapshot, { targets, exposedTo })`; evaluation splits undeclared / abstract / non-reaching outputs.
- `relations/system.test.ts`: rewritten around a `party` abstract node; adds exposure, private-step, orphan-diagnostic, "unexposed relation does not change acceptance", abstract-codomain, abstract-output, and outcome-kind tests.
- `translators/resolve.ts`, `kernel/create.ts`, `relations/adapters.ts`, `kernel/kernel.test.ts` adjusted.
- Validation: root typecheck clean; 357 tests; `pnpm build` + `pnpm -r typecheck` clean.

### Why
- C6: one relation system with per-relation exposure, rather than separate registries or everything-everywhere.
- C8: abstract codomains are useful contracts for families of concrete results; the runtime still needs descriptor-bearing concrete types, so the check moves to evaluation.

### What worked
- Threading exposure through `PreparedPresentationRelation` meant `exposed()` is a filter over the prepared list; no second index.

### What didn't work
- The Write tool refused `relations/system.ts` ("modified since read") because an earlier `sed` had touched it; the edits went through a Python replace script instead. No behavior impact.

### What I learned
- Exposure and `referenced` interact: the orphan diagnostic must be computed after every composition is prepared, because a private relation is reachable only through a composition that names it.

### What was tricky to build
- Keeping composition endpoint checks honest under abstract codomains: an exact next step needs the previous step's exact codomain, a subtypes next step needs the promised codomain to reach its source. An abstract previous codomain into an exact concrete next step is correctly rejected.

### What warrants a second pair of eyes
- `matches()` without `exposedTo` returns every relation (the tests use it that way). Product code should always pass an interpreter; the model layer in Phase 3 should not expose the unfiltered form.

### What should be done in the future
- Phase 3: `model/` replaces `kernel/`; relation diagnostics join the model's `diagnostics()`.

### Code review instructions
- `relations/system.ts`: `normalizeExposure`, `discoverable`, `execute`; then `relations/system.test.ts` "exposure (C6)" and "codomains and outputs (C8)".
- `pnpm test -- relations`.

### Technical details
- Discovery API: `relations.matches(reference, snapshot, { targets: ["account"], exposedTo: "acceptance" })`.

## Step 7: Phase 3 — one compiled model from one declaration and named fragments

The prototype's `kernel/` became `model/` (§6.1), and the aggregate gained the three things §7 and §8 asked for: named fragments merged with origin tracking, one explicit runtime context input, and the split between known scopes (declaration vocabulary), default active scopes (product convenience), and per-snapshot active scopes (runtime facts). `definePresentation()` now returns typed helpers and exactly one compiler method, `create`; `compilePresentation` is the lower-level function behind it. The compiler merges included fragments then the root, claims every type/predicate/action/relation/help id for its fragment, and throws fragment-aware messages on duplicates, conflicting descriptors, descriptors for undeclared or abstract types, and (by default) concrete types without descriptors. Advisory findings from the action registry, the relation system, empty fragments, and relaxed descriptor completeness are folded into one `diagnostics()` with severity, owner, fragment, and path.

`createPbui` lost the prototype's symbol-marked `factsFor` union: its non-legacy branch is `{ presentation, contextFor }`, and the instance exposes `presentation`. The legacy option bag remains until Phase 5.

### Prompt Context

**User prompt (verbatim):** (see Step 4)

**Assistant interpretation:** Land guide §7, §8, §15.1–§15.2 and the model half of §14.1 on top of the prototype's kernel.

**Inferred user intent:** The "one validated statement of the product's presentation semantics" of §1: a product that includes a fragment cannot omit its companions, and every drift the guide lists in §24 is caught at construction.

**Commit (code):** 94f6cb1 — "PBUI-KERNEL-1 P3: the compiled presentation model — fragments, one context input, closed-world compile"

### What I did
- New `model/types.ts` (PresentationFragment, PresentationDeclaration, PresentationContextInput, CompiledPresentation, vocabulary and link-deps types), `model/diagnostics.ts`, `model/compile.ts` (mergeFragments, checkedRevision, validateActiveScopes, compilePresentation), `model/vocabulary.ts`, `model/define.ts`, `model/index.ts`, `model/model.test.ts` (20 tests across construction, snapshot, structural rules, advisory diagnostics, universal family, link projection).
- Deleted `kernel/` (create, define, types, index, kernel.test).
- `createPbui.tsx`: `PresentationCreatePbuiOptions { presentation, contextFor }` replaces `KernelCreatePbuiOptions { kernel, factsFor }`; `SNAPSHOT_INPUT`/`isSnapshotInput` deleted; instance returns `presentation`.
- `index.ts`: exports `model` instead of `kernel`.
- Validation: root typecheck clean; 366 tests; build + recursive typecheck green.

### Why
- §1.2 items 6 and 7: reusable declarations are named fragments, and runtime context construction has one explicit shape rather than a bare-facts-or-symbol-wrapper union.
- §15.2: structural errors prevent construction; advisory conditions are returned.

### What worked
- Origin tracking as a flat `kind:id → fragmentId` map made every diagnostic and the vocabulary's `fragment` tag one lookup.

### What didn't work
- Two of my new tests failed on first run and both were test errors, not model errors: (1) I asked acceptance for `customer` from a relation whose declared codomain is abstract; §11.3 filters discovery by declared codomain, so that is `none` by design — the test now documents both the abstract-codomain success (request `party`, receive a concrete `customer`) and the by-declared-codomain rule. (2) I assumed registration order for menu rows; rows are sorted for presentation, so the assertion became order-independent. In the first fixture I also made `customer` a subtype of the same abstract node as `order`, so a request for it was satisfied by SUBTYPING with the original reference before any relation ran — correct behavior that the fixture had to be changed to get out of the way of.

### What I learned
- Discovery by declared codomain is a real authoring rule: a relation that wants to satisfy `customer` requests must say `to: "customer"`, even if it could also be described as `inspectable`. The guide's §11.4 note ("add metadata to the relation's facet exposure rather than inventing parallel ids") points the same way.

### What was tricky to build
- Strict descriptor completeness by default (§15.2) versus the many small in-repo fixtures that build registries without descriptors. The compiler takes `strictDescriptors: false` and downgrades the finding to a warning with origin, so fixtures can opt out visibly; products get the throw.
- `linkDeps` had to close over `snapshot` so that relation evaluation in the link world goes through the same revision and scope validation as acceptance (§12.1 step 2).

### What warrants a second pair of eyes
- `mergeFragments` treats the root declaration as the last fragment; an "empty root" is not reported as an empty fragment (a root that only includes is normal).
- `knownScopes` first-declaration order comes from fragment order; scope ORDER never affects semantics (active scopes are ordered per snapshot), but vocabulary readers may notice it.

### What should be done in the future
- Phase 4: rename translators to acceptance and the option field to `relation`.
- Phase 5: delete the legacy option bag; `onRefuse` required; no `registry` alias.

### Code review instructions
- `model/compile.ts` top to bottom (about 300 lines); then `model/model.test.ts` "structural rules" and "snapshot".
- `pnpm test -- model`.

### Technical details
- Snapshot resolution: `revision = input.revision ?? declaration.revision?.(facts) ?? throw`; `activeScopes = input.activeScopes ?? declaration.defaultActiveScopes ?? throw`; both validated.

## Step 8: Phase 4 — acceptance speaks relations

Acceptance moved from `translators/` to `acceptance/` and now has exactly one input: a relation system. `resolveAcceptance` discovers with `{ targets: wanted, exposedTo: "acceptance" }`, keeps concrete outputs that reach a wanted type and pass the request filter, ranks by nearest scope (a universal relation last) then highest priority, and returns a chooser for a genuine tie in stable relation-id order. `AcceptanceOption.relation` replaces `.translator`, with `null` still meaning direct subtype satisfaction. The translator branch of the resolver is deleted.

One real gap surfaced through the typechecker: `AcceptRequest.types` only admitted concrete `Values` keys, so a product could not ask for an abstract type at all, though §11.3 and C8 say an abstract request is satisfied by a concrete relation output. `AcceptableType<Values>` now admits abstract runtime ids while keeping autocomplete for concrete ones.

### Prompt Context

**User prompt (verbatim):** (see Step 4)

**Assistant interpretation:** Land guide §11.3 and the Phase 4 deletions, keeping the legacy runtime path working until Phase 5.

**Inferred user intent:** One semantic arrow (the relation) behind acceptance, facets, and links, with the old name gone from public identity.

**Commit (code):** 7ba3b3d — "PBUI-KERNEL-1 P4: acceptance over canonical relations"

### What I did
- New `acceptance/types.ts`, `acceptance/resolve.ts`, `acceptance/index.ts`, `acceptance/resolve.test.ts` (the ACTIONS-2 §24.7 matrix over relations plus abstract-request, exposure, and universal-ranking tests).
- Deleted `translators/` (types, resolve, resolve.test).
- `relations/adapters.ts` now carries the `PresentationTranslator` type beside `relationFromTranslator`, both marked for Phase 5 deletion.
- `createPbui.tsx`: imports from `acceptance/`; the legacy branch builds an acceptance-exposed relation system from `options.translators` over the action registry's graph (scopes collected from the translators themselves, since the action registry does not expose its scope list); the chooser renders `option.relation`.
- `types.ts`: `AcceptableType`; `index.ts` exports it and re-exports `acceptance/`.
- `model/*`: imports and the test's field name.
- Validation: root typecheck clean, 368 tests, build + recursive typecheck green.

### Why
- C5: relations are canonical; "translator" described one interpreter's use of the arrow.

### What worked
- Because Phase 2 already gave `matches()` the `exposedTo` filter, the new resolver is shorter than the old translator branch it replaces.

### What didn't work
- The first typecheck failed inside `model/model.test.ts` on `types: "party"`: the request type did not admit abstract ids. That was the gap described above, not a test error.
- The Write tool refused two files that a Python script had touched since my last read; the edits went through the script instead (as in Step 6).

### What I learned
- The legacy translator resolver gave scope-less translators index 0 (nearest). Over relations, a universal relation ranks last. No in-repo translator declares scopes, so no consumer sees a different answer; the new test pins the rule.

### What was tricky to build
- Keeping the legacy `createPbui` branch alive without the translator resolver: it needs a relation system, which needs the declared scope list, which the legacy `ActionRegistry` does not expose. Collecting scopes from the translators is exact for validation purposes and disappears with the branch in Phase 5.

### What warrants a second pair of eyes
- `AcceptableType`'s `(string & {})` member widens `AcceptRequest.types` to any string at the type level; the graph still rejects unknown ids at runtime (an undeclared supertype is simply unrelated, so the request yields `none`).

### What should be done in the future
- Phase 5 deletes `LegacyCreatePbuiOptions`, `PresentationTranslator`, `relationFromTranslator`, and the `registry` instance alias; `onRefuse` becomes required.

### Code review instructions
- `acceptance/resolve.ts` (about 90 lines) and `acceptance/resolve.test.ts`; the legacy-branch block in `createPbui.tsx` around `legacyRelations`.
- `pnpm test -- acceptance`.

### Technical details
- `AcceptableType<Values> = PresentationType<Values> | (string & {})`.

## Step 9: Phase 5 — the strict runtime

`createPbui` now has one construction path: `{ presentation, defaultEnvironment, contextFor, renderMenuHeader?, helpRenderers? }`. The pre-KERNEL-1 option bag (descriptor registry + action registry + `snapshotFor` + translators + help registry) is deleted along with the relation adapters that kept it alive through Phase 4. `PbuiProviderProps.onRefuse` is required: a stale row that fails fresh revalidation is always reported to the product. The instance exposes `presentation` and no longer a `registry` alias; pbui-chat reads `pbui.presentation.descriptors`.

Every in-repo core fixture moved to `definePresentation().create(...)`: the runtime, chrome, help, and action tests, the Pbui and FileBrowser stories, and the consumer smoke script. The Pbui stories now share one presentation between the plain example and the help example, which is the guide's point — help is a sibling interpreter over the same declaration, switched on by renderers, not a second registry.

### Prompt Context

**User prompt (verbatim):** (see Step 4)

**Assistant interpretation:** Land guide §14.1–§14.3 and the Phase 5 deletions; keep the root package green and accept that workspace packages are red until Phase 6.

**Inferred user intent:** No compatibility branch in the released runtime (C13/C16), and no silent refusals (§14.2).

**Commit (code):** 9102723 — "PBUI-KERNEL-1 P5: strict runtime — createPbui takes one compiled presentation, onRefuse is required"

### What I did
- `createPbui.tsx`: single `CreatePbuiOptions`; engine reads from `presentation`; `onRefuse` required and called unconditionally on refusal; instance returns `presentation`.
- Deleted `relations/adapters.ts`; `index.ts` and `relations/index.ts` no longer export `PresentationTranslator`, `relationFromTranslator`, `LegacyCreatePbuiOptions`, `PresentationCreatePbuiOptions`.
- Migrated `createPbui.test.tsx`, `createPbui.help.test.tsx`, `createPbui.actions.test.tsx` (its `mount` helper now takes contributions and compiles a presentation per test; the accept tests use `PresentationRelation`s), `instanceChrome.test.tsx`, `Pbui.stories.tsx`, `FileBrowser.stories.tsx`, `FileBrowser.test.tsx`, `scripts/consumer-smoke.mjs`.
- Added `onRefuse` to every `Provider` in those files (`ignoreRefuse` in tests, a `console.warn` handler in stories and the smoke script).
- `packages/pbui-chat/src/createPbuiChat.tsx`: `options.registry ?? pbui.presentation.descriptors`.
- Validation: root typecheck clean, 368 tests, `pnpm build` green. `pnpm -r typecheck` stops at `packages/datalab-ui` (expected; Phase 6).

### Why
- C13/C16: the final runtime supports only the compiled presentation.
- §14.2: making the callback required avoids recreating silent failure by omission.

### What worked
- Because Phase 3 had already retargeted the non-legacy branch, Phase 5 was mostly deletion plus fixture migration.

### What didn't work
- My first pass inserted `onRefuse={ignoreRefuse}` with a regex that treated the first `>` after `<pbui.Provider` as the tag end, which broke three props of the form `onPerform={() => ...}` into `onPerform={() = onRefuse={ignoreRefuse}> ...`. tsc reported `TS1109: Expression expected` at those three sites. The repair rule inserts the prop directly after the tag name and only when the tag's line lacks `onRefuse`.
- Two follow-up errors: the FileBrowser story's Provider lacked `onRefuse`, and an unused `defineActions` import in the action tests.

### What I learned
- `vi.spyOn(presentation.help, "resolve")` still works as the help test's laziness probe: the runtime reads `presentation.help` once and calls `.resolve` on that object at gesture time.

### What was tricky to build
- The action tests' `mount(registry, facts)` helper took a prebuilt `ActionRegistry`; every test built one with the same graph and scopes. Under the model each test compiles a presentation from its contributions (`presentationWith(contributions)`), and the registry-builder helpers collapsed to arrays via one regex over the file.

### What warrants a second pair of eyes
- Stories and the smoke script log refusals with `console.warn`; that is a deliberate "telemetry only" choice for demos (§14.2) and should not be copied into products.
- `PbuiInstance`'s facts default stays `any` (Step 5) so pbui-chat's facts-agnostic spelling remains assignable.

### What should be done in the future
- Phase 6: workbench fragment factory, chat fragment, ecommerce relations and single graph, sandbox fragment, datalab mechanical migration, then rag-ttc and hyperblog.

### Code review instructions
- `createPbui.tsx` lines 56–90 (options) and 360–380 (engine reads); then `createPbui.actions.test.tsx` `presentationWith`/`mount`.
- `pnpm typecheck && pnpm test && pnpm build`.

### Technical details
- Provider tag repair rule: `re.sub(r'<(?:pbui|filePbui)\.Provider[^\n]*', insert-if-missing)`.
