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
