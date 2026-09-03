---
Title: Investigation diary
Ticket: PBUI-WORKBENCH-CORE-1
Status: review
Topics:
    - pbui
    - frontend
    - architecture
    - design
    - refactoring
    - onboarding
DocType: reference
Intent: long-term
Owners: []
RelatedFiles:
    - Path: repo://packages/pbui-chat/demo/src/workbench.ts
      Note: Wiring order of sources, restore and persistence in the largest consumer
    - Path: repo://packages/workbench-core/src/goldens/transitions.test.ts
      Note: Phase 0 behavior goldens ported to the core
    - Path: repo://packages/workbench-core/src/rebalance/slate.ts
      Note: Pure rebalance engine after package move
    - Path: repo://packages/workbench-core/src/sources.ts
      Note: Document sources, the one new core facility of Phase 8
    - Path: repo://ttmp/2026/09/03/PBUI-WORKBENCH-CORE-1--hard-cutover-consolidation-of-the-workbench-into-a-reusable-composable-core/design-doc/01-intern-guide-to-the-pbui-workbench-core-consolidation-and-hard-cutover.md
      Note: Final evidence-backed architecture and implementation guide produced by the investigation
    - Path: repo://ttmp/2026/09/03/PBUI-WORKBENCH-CORE-1--hard-cutover-consolidation-of-the-workbench-into-a-reusable-composable-core/design-doc/03-post-implementation-architecture-and-code-review.md
      Note: Step 16 implementation assessment and stabilization plan
    - Path: repo://ttmp/2026/09/03/PBUI-WORKBENCH-CORE-1--hard-cutover-consolidation-of-the-workbench-into-a-reusable-composable-core/scripts/01-plan-purity-probe.historical.ts
      Note: Historical reproduction retained after the cutover
    - Path: repo://ttmp/2026/09/03/PBUI-WORKBENCH-CORE-1--hard-cutover-consolidation-of-the-workbench-into-a-reusable-composable-core/scripts/01-plan-purity-probe.output.txt
      Note: Captured successful probe output and Vitest evidence
    - Path: repo://ttmp/2026/09/03/PBUI-WORKBENCH-CORE-1--hard-cutover-consolidation-of-the-workbench-into-a-reusable-composable-core/sources/01-workbench-architectural-assessment.md
      Note: Verbatim supplied assessment used as the investigation hypothesis map
ExternalSources: []
Summary: Chronological evidence, commands, failures, design choices, review guidance, and delivery record for the PBUI workbench-core consolidation research ticket.
LastUpdated: 2026-09-03T15:00:00-04:00
WhatFor: Preserve how the consolidation design was derived so an implementer or reviewer can reproduce findings and continue without repeating the investigation.
WhenToUse: Read before resuming PBUI-WORKBENCH-CORE-1, reviewing its architecture recommendations, or reproducing the planner-purity finding.
---






# Diary

## Goal

Capture the creation, evidence gathering, defect verification, architecture design, ticket bookkeeping, and reMarkable delivery for a hard-cutover consolidation of PBUI’s Workbench into a reusable headless core and thin React shell.

## Step 1: Create the ticket and preserve the supplied assessment

The first step created a dedicated docmgr workspace before drawing conclusions. The user-supplied `/tmp/workbench.md` was copied without modification into `sources/01-workbench-architectural-assessment.md`, so the original framing remains distinguishable from the independently verified design.

The ticket was initialized with a design document, a chronological diary, tasks, changelog, and standard ticket directories. This established one place for source evidence, executable probes, design decisions, and delivery artifacts.

### Prompt Context

**User prompt (verbatim):** "Create a new docmgr ticket in pbui to clean up / streamline / consolidate the workbench core system. Import the /tmp/workbench.md file into the sources/ folder of the ticket, and then analyze the pbui codebase and the current situation and then draw up a detailed consolidation and streamlining / composability pass on the workbench to turn it into an elegant core reusable system. Hard cutover, we are still in alpha so we can do whatever we need to turn this into a solid set of foundational technologies.

Create  a detailed analysis / design / implementation guide that is for a new intern, explaining all the parts of the system needed to understand what it is, with prose paragraphs and bullet point sand pseudocode and diagrams and api references and file references. It should be very clear and technical. Store in the ticket and the nupload to remarkable.

[REMINDER] Output a <summary>...</summary> block at the VERY END of your response. This is mandatory."

**Assistant interpretation:** Create a new PBUI ticket, preserve the supplied Workbench assessment, verify it against the current repository and consumers, write an intern-ready hard-cutover architecture/implementation guide, maintain docmgr evidence, and deliver the bundle to reMarkable.

**Inferred user intent:** Establish a durable technical blueprint that an unfamiliar engineer can implement without preserving alpha-era accidental APIs or re-deriving the system from several repositories.

### What I did

- Ran `docmgr status --summary-only` and `docmgr vocab list` in `pbui/`.
- Created ticket `PBUI-WORKBENCH-CORE-1` with topics `pbui,frontend,architecture,design,refactoring,onboarding`.
- Added the design doc and investigation diary through `docmgr doc add`.
- Copied `/tmp/workbench.md` to `sources/01-workbench-architectural-assessment.md`.
- Added six ticket tasks covering import, architecture mapping, defect verification, guide authoring, bookkeeping/validation, and reMarkable delivery.

### Why

- The supplied assessment is valuable source material but should not be silently rewritten into the final recommendation.
- Ticket-first setup keeps code evidence, failures, decisions and delivery verification together.
- Explicit tasks make it possible to audit whether the requested research and upload were actually completed.

### What worked

- `docmgr ticket create-ticket`, both `doc add` calls, and the source copy succeeded.
- The generated ticket contains `index.md`, `tasks.md`, `changelog.md`, design/reference docs, `sources/`, `scripts/`, and the standard auxiliary directories.
- All requested vocabulary slugs already existed; no vocabulary addition was needed.

### What didn't work

- An initial orientation command ran Git from the workspace root rather than `pbui/` and failed verbatim:

  ```text
  fatal: not a git repository (or any of the parent directories): .git
  ```

  The correction was to prefix repository commands with `cd pbui &&`.

### What I learned

- The PBUI docmgr root is `/home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/ttmp`.
- The current repository branch is `task/consolidate-pbui-kernel`; ticket files are the only untracked changes created by this investigation.
- The imported assessment is already detailed enough to serve as a hypothesis map, but several claims require revision against the newer presentation-kernel and link code.

### What was tricky to build

- The workspace root contains several sibling Git repositories, so repository-relative and workspace-relative paths are easy to conflate. The symptom was Git failing before any useful status output. Every subsequent repository command explicitly changed to `pbui/`, while cross-consumer searches explicitly changed to the workspace root.

### What warrants a second pair of eyes

- Confirm the ticket id and title fit the project’s naming convention before implementation starts; they intentionally distinguish this foundational core pass from earlier `PBUI-WORKBENCH-1/2` extraction/adoption tickets.

### What should be done in the future

- Keep the imported assessment immutable. If its conclusions are superseded, record the correction in the design guide rather than editing the source artifact.

### Code review instructions

- Start at the ticket `index.md`, then compare `sources/01-workbench-architectural-assessment.md` with the final design doc’s findings and decisions.
- Validate ticket discovery with `docmgr ticket list --ticket PBUI-WORKBENCH-CORE-1` and `docmgr doc list --ticket PBUI-WORKBENCH-CORE-1`.

### Technical details

```bash
docmgr ticket create-ticket \
  --ticket PBUI-WORKBENCH-CORE-1 \
  --title "Hard-cutover consolidation of the workbench into a reusable composable core" \
  --topics pbui,frontend,architecture,design,refactoring,onboarding
```

## Step 2: Map the current system and verify the planner impurity

This step traced the Workbench from protobuf and Go validation through TypeScript structural mutation, store/verb orchestration, links, rebalance, persistence, synchronization, React components, and representative consumers. It established that the architecture has strong primitives but an overloaded composition boundary: semantic policy, DOM geometry, runtime effects, shell state, and React assembly meet in `createVerbHandlers` and `createWorkbench`.

The most important imported claim was tested rather than repeated. A dedicated Vitest probe planned an identity merge and showed that the durable document remained unchanged while the live link runtime revision incremented and class `σ1` appeared. This is direct evidence that current planning is not side-effect-free.

### Prompt Context

**User prompt (verbatim):** (same as Step 1)

**Assistant interpretation:** Verify the proposed consolidation against current code and turn observed architectural pressure into evidence-backed findings.

**Inferred user intent:** Avoid a theoretical redesign that misses current behaviors, consumers, or already-completed kernel work.

### What I did

- Read the protocol schema, TS structural applier/builders, Go mutation/validation/catalog/link validator, store, app descriptors, command union/handlers, workbench constructor/types, link runtime/handlers, description API, persistence, sync, rebalance algorithms/config integration, Surface, and Tile.
- Read prior Workbench/API/kernel design documents to recover intent and distinguish old findings from current code.
- Inspected representative consumers in pbui-chat, pbui-ecommerce, pbui-plotscript, agentlogic, turboproof, hyperblog, and rag-ttc.
- Counted public exports, source size, tests, fixtures, and importing files.
- Ran package typechecks and tests.
- Added and ran `scripts/01-plan-purity-probe.test.ts` with a ticket-local Vitest config; captured output in `scripts/01-plan-purity-probe.output.txt`.

### Why

- The Workbench’s behavior is distributed across protocol, semantic, runtime, shell, and consumer layers; reading only `createWorkbench.tsx` would miss server validation and sync semantics.
- The planning defect crosses document and runtime state, so source inspection alone could be disputed. The probe records the actual observable behavior.
- Consumer inspection prevents designing a pure internal abstraction that does not support Redux adapters, local persistence, product verb routing, linked ports, or server-backed products.

### What worked

- `pnpm --filter @hyperslop-systems/workbench-protocol typecheck` passed.
- Protocol tests passed: 3 files, 48 tests.
- `pnpm --filter @hyperslop-systems/pbui-workbench typecheck` passed.
- Workbench tests passed: 31 files, 281 tests.
- The successful purity probe printed:

  ```text
  PURITY_PROBE {"planOk":true,"documentUnchanged":true,"runtimeRevisionBefore":1,"runtimeRevisionAfter":2,"classCountBefore":0,"classCountAfter":1,"classIdsAfter":["σ1"]}
  ```

- Production search found no caller of `createWorkbenchClient`; only its protocol tests use it, making hard deletion a low-risk simplification.
- The repository scan confirmed that Workbench adoption spans multiple products, including a Redux adapter and large server-backed consumer.

### What didn't work

- Reading `packages/pbui-workbench/README.md` failed because the manifest lists it for publication but the file does not exist:

  ```text
  ENOENT: no such file or directory, access '/home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/packages/pbui-workbench/README.md'
  ```

  This became a documented onboarding/public-surface finding.

- The first probe execution used `tsx` directly and failed because Node could not import component CSS:

  ```text
  TypeError [ERR_UNKNOWN_FILE_EXTENSION]: Unknown file extension ".css" for /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/src/components/foundation/Text/Text.module.css
  ```

  The correction was to run the probe through Vitest/Vite, which handles CSS imports.

- The first Vitest invocation reused the workbench package config, whose include pattern excluded ticket scripts:

  ```text
  No test files found, exiting with code 1

  filter: ttmp/2026/09/03/PBUI-WORKBENCH-CORE-1--hard-cutover-consolidation-of-the-workbench-into-a-reusable-composable-core/scripts/01-plan-purity-probe.test.ts
  include: src/**/*.test.ts, src/**/*.test.tsx, test/**/*.test.ts
  ```

  The correction was `scripts/01-vitest.config.ts` with an explicit ticket-script include.

### What I learned

- The model’s strongest foundation is the explicit separation of app, logical view, placement, workspace, and document.
- The TypeScript applier is intentionally structural; Go performs full catalog, limits, credential and document validation after the batch.
- `verbs.ts` is now 1,407 lines and owns responsibilities from DOM measurement to orphan cleanup.
- `WorkbenchState` grew from semantic session pointers into a mixed shell state containing launcher, rebalance, connect mode, chooser and relation palette.
- `Workbench.mutate`, document replacement, restore/reset and sync adoption can bypass link lifecycle maintenance that is private to verb handlers.
- Sync flattens transaction batches and rebases structural mutations, which is suitable only for optimistic single-user/multi-client persistence, not semantic concurrent editing.
- Rebalance is already well-factored mathematically; its algorithms should be preserved while integration moves behind the engine/runtime boundary.
- Ecommerce already projects link semantics from the compiled presentation kernel, so the imported recommendation is partly implemented; the target should make that projection the compiled module path rather than retain an optional parallel environment.

### What was tricky to build

- The planner defect required an identity operation that actually produces a runtime effect. Ordinary follow-link planning changes only the links document and would not expose the bug. The probe creates two compatible `inout` ports, emits a value on the left, and plans `identity.add(prefer-left)`, which deterministically emits `seed-class`. Running through Vitest was necessary because importing the current package graph reaches CSS-bearing React modules even though the tested operation is headless. The exact solution was to add a ticket-local test and ticket-local Vite/Vitest config.

### What warrants a second pair of eyes

- Review the proposed “no orphan views after commit” rule against every persisted consumer document before changing Go validation.
- Review whether `workbench-core` should be a separate package or a strict subpath; the guide recommends a package because import boundaries are enforceable, but package count is a real tradeoff.
- Confirm that replacing sync mutation replay with command re-planning covers product-authored raw document mutations through explicit replay policies.
- Audit direct `store.mutate`/`replaceDocument` use in external consumers; these are the most likely migration sharp edges.

### What should be done in the future

- Invert the purity probe once runtime effects become plan data: after `plan`, runtime revision and class count must remain exactly equal.
- Add complete TypeScript validation fixtures shared with Go before making validated replacement mandatory.
- Capture command→transition goldens before deleting the old handlers.

### Code review instructions

- Start at `packages/pbui-workbench/src/createWorkbench.tsx:101-153`, then follow `runtime` into `links/handlers.ts:121-150` and `links/runtime.ts:114-127`.
- Re-run the probe:

  ```bash
  pnpm exec vitest run \
    --config ttmp/2026/09/03/PBUI-WORKBENCH-CORE-1--hard-cutover-consolidation-of-the-workbench-into-a-reusable-composable-core/scripts/01-vitest.config.ts \
    --reporter verbose
  ```

- Re-run baselines:

  ```bash
  pnpm --filter @hyperslop-systems/workbench-protocol typecheck
  pnpm --filter @hyperslop-systems/workbench-protocol test
  pnpm --filter @hyperslop-systems/pbui-workbench typecheck
  pnpm --filter @hyperslop-systems/pbui-workbench test
  ```

### Technical details

- Repository commit: `04d1d7c6df8f3ece8ccbe16a8cdd8cba4a229da5`.
- Workbench production source measured approximately 10,001 TS/TSX lines.
- Protocol mutation fixtures: 28.
- Root Workbench barrel: 188 lines and 64 `export` statements.
- Main hotspots: `verbs.ts` 1,407 lines; `workbench.test.ts` 1,138 lines; `RebalanceDialog.tsx` 541 lines; `sync.ts` 395 lines.

## Step 3: Write the hard-cutover design, complete docmgr bookkeeping, and deliver it

The final step turned the evidence into an implementation-ready guide rather than a cleanup wishlist. The guide defines the protocol/engine/runtime/React-shell layers, a pure planner and explicit prepared-transition contract, a single observable runtime transaction, a canonical index, app manifest/presentation projections, slot-aware binding policy, module integration, geometry snapshots, validation parity, intent-aware sync, hard-cutover deletion list, phased migration, tests, risks, and completion gates.

The ticket artifacts were then related to the source files that materially shaped the design, validated with docmgr, and bundled for reMarkable. No production source code was changed; the executable probe intentionally records the current defect for the implementation phase.

### Prompt Context

**User prompt (verbatim):** (same as Step 1)

**Assistant interpretation:** Produce and publish the final intern-facing technical deliverable with enough API, pseudocode, diagrams, file references, and sequencing to implement safely.

**Inferred user intent:** Hand a new engineer a concrete map and migration program, not merely an architectural opinion.

### What I did

- Replaced the generated design template with the detailed consolidation guide.
- Added current-state diagrams, target diagrams, formal entities, API sketches, planning/commit/sync pseudocode, decision records, a nine-phase implementation plan, deletion list, test strategy, risks, completion gates, and line-anchored file references.
- Updated the ticket index, tasks, changelog, related-file metadata, and this diary.
- Ran docmgr validation and reMarkable dry-run/upload/verification commands; final command results are recorded below.

### Why

- A hard cutover succeeds only if deletions and consumer migration are explicit.
- The intern audience needs the reason for every layer and enough concrete contracts to implement one vertical slice without guessing.
- reMarkable delivery must be verified remotely rather than assumed from a local render.

### What worked

- The design guide was written to `design-doc/01-intern-guide-to-the-pbui-workbench-core-consolidation-and-hard-cutover.md`.
- Both focused frontmatter validations passed.
- `docmgr doctor --ticket PBUI-WORKBENCH-CORE-1 --stale-after 30` reported one ticket and `✅ All checks passed`.
- The reMarkable dry run listed all four intended Markdown inputs and the destination.
- The real upload returned `OK: uploaded PBUI Workbench Core Consolidation.pdf -> /ai/2026/09/03/PBUI-WORKBENCH-CORE-1`.

### What didn't work

- No docmgr validation or reMarkable upload failure occurred in this step.

### What I learned

- The cleanest “consolidation” is not putting more behavior into `createWorkbench`; it is making protocol, planning, commit, and rendering independently testable and composing them explicitly.
- Package/API reduction must follow semantic extraction. Moving the existing monolith into folders first would preserve the same coupling under new paths.

### What was tricky to build

- The design had to reconcile “streamline” with introducing a core package. The chosen boundary adds one package but deletes overlapping configured clients, mixed state, direct DOM dependencies, and an everything-barrel. The package boundary is justified only because it enforces no-React/no-DOM imports; the guide explicitly rejects creating packages per controller or module.

### What warrants a second pair of eyes

- Review Decisions 1–9 before implementation, especially separate-package enforcement, no-orphan final-state validation, one observable runtime snapshot, and sync re-planning semantics.
- Review the consumer migration order and ensure a product owner is assigned for each external repository.
- Review the final root/subpath export design before implementation publishes a prerelease.

### What should be done in the future

- Implement Phase 0 contract goldens before changing production code.
- Use `placement.close` as the first vertical engine/runtime/shell slice.
- Keep this diary chronological as implementation phases land; record code commit hashes per step.

### Code review instructions

- Read the design guide’s §§5–9 first for findings, decisions, architecture and transition contracts.
- Review §16 phase by phase and §17 as the hard-cutover deletion checklist.
- Validate the ticket with `docmgr doctor --ticket PBUI-WORKBENCH-CORE-1 --stale-after 30`.
- Compare every explicit user requirement with the completion record below.

### Technical details

#### Completion record

- **Frontmatter validation:** both design and diary documents reported `Frontmatter OK`.
- **Ticket validation:** `docmgr doctor --ticket PBUI-WORKBENCH-CORE-1 --stale-after 30` reported `✅ All checks passed`.
- **Dry run:** included `index.md`, the primary design guide, investigation diary, and imported assessment; targeted `/ai/2026/09/03/PBUI-WORKBENCH-CORE-1`.
- **Upload:** `OK: uploaded PBUI Workbench Core Consolidation.pdf -> /ai/2026/09/03/PBUI-WORKBENCH-CORE-1`.
- **Verification policy:** the current `remarkable-upload` skill treats the successful `OK: uploaded` response as verification and explicitly says not to run a routine `cloud ls` afterward.

## Step 4: Record the first-version simplification decisions

This step created a dedicated scope-control document beside the primary design before revising that larger guide. It records retained foundations, accepted simplifications, explicitly retained full designs, and parked questions so later edits cannot accidentally turn exploratory discussion into forgotten requirements.

The resulting document confirms the comprehensive `WorkbenchIndex`, generalized `view.show`, and explicit non-durable effect representation. It simplifies public assembly, revisions, shell state, validation, synchronization, geometry handling, and result metadata for the first implementation.

### Prompt Context

**User prompt (verbatim):** "we actualy want R3. and explain S6 , S11 and S12.

But first create the simplification tracking doc next to the design doc.

Then answer

[REMINDER] Output a <summary>...</summary> block at the VERY END of your response. This is mandatory."

**Assistant interpretation:** Create the simplification decision record first, confirm the full index, and then explain the generic-module, app-definition, and execution-result simplifications.

**Inferred user intent:** Preserve the evolving scope decisions before editing the large design and make sure the selected simplifications remain understandable rather than becoming unexplained deletions.

### What I did

- Added `design-doc/02-version-one-simplification-decisions.md` through docmgr.
- Recorded Keep, Simplify, Do not simplify, Deferred, lean architecture, and dated change-log sections.
- Confirmed the comprehensive `WorkbenchIndex` as a first-version requirement.
- Added the new decision record to the ticket index and related it to the primary design and relevant current implementation files.

### Why

- The main guide deliberately describes a more robust destination; a separate companion record makes scope reductions reviewable and reversible.
- Explicitly documenting rejected simplifications prevents implementation from silently choosing the smaller alternative later.

### What worked

- The document was created beside the primary guide as `design-doc/02-version-one-simplification-decisions.md`.
- The current decisions fit into a short first-version architecture without changing production code.

### What didn't work

- N/A.

### What I learned

- The comprehensive index is intentionally retained even while incremental indexing is deferred.
- The user wants to preserve an explicit effect model and generalized `view.show`; simplification should target surrounding infrastructure rather than these compositional foundations.

### What was tricky to build

- “R3” referred to the previously labeled decision to retain the comprehensive index. The tracking document records that affirmative result directly and avoids carrying the conversational double-negative (“reject reducing the index”) into the specification.

### What warrants a second pair of eyes

- Confirm the current interpretation of explicit effects: shell intents are removed, while the exact unified-versus-separate representation of session/runtime effects stays deferred until link-cell semantics are settled.

### What should be done in the future

- Update this decision record before changing the primary design whenever another simplification is accepted or rejected.
- Revise the primary design only after the open questions in the decision record are sufficiently settled.

### Code review instructions

- Read `design-doc/02-version-one-simplification-decisions.md` before reviewing changes to the primary guide.
- Check that K1–K3 under “Do not simplify” remain represented in implementation plans.

### Technical details

- New document: `design-doc/02-version-one-simplification-decisions.md`.
- Confirmed full indexes at that point in the discussion: workspace, node, placement→view, view→placements, app→views, document→views, format→documents, and orphan views.

## Step 5: Separate the ideal architecture from the chosen first implementation

This step revised both design documents after the user chose the structural-index simplification. The primary guide now keeps the fully elaborated architecture as an explicitly labeled ideal reference while adding an authoritative first-version implementation section and implementation phases that match the accepted reductions.

The ticket task list now distinguishes the completed research deliverables from ten open implementation phases. No production code changed; this step resolves scope and sequencing before Phase 0 begins.

### Prompt Context

**User prompt (verbatim):** "Ok, we want to simplify R3, update the doc. Then, update the design doc by clearly marking what the \"ideal design\" would be, and then what the design we are going to implement is. Update the phases / tasks in tasks.md too.

[REMINDER] Output a <summary>...</summary> block at the VERY END of your response. This is mandatory."

**Assistant interpretation:** Adopt the smaller structural index, preserve the robust proposal as an ideal design, make the chosen implementation unmistakable, and align the implementation phases and ticket tasks.

**Inferred user intent:** Prevent the intern guide from mixing aspirational robustness with actual first-pass acceptance criteria, while retaining the ideal as useful future context.

### What I did

- Changed the simplification record from a comprehensive index to six structural maps plus shared on-demand queries for document bindings, formats, and orphan views.
- Marked §§6–15 of the primary guide as the ideal design.
- Added authoritative §16 describing the chosen implementation and an ideal-versus-chosen comparison table.
- Rewrote Phases 1–8 around essential validation, the structural index, fresh execution, explicit links integration, execution-time geometry, one shell store, and batch-preserving sync.
- Updated testing, intern instructions, risks, completion gates, open questions, final statement, ticket status, and section numbering.
- Added open Phase 0–9 tasks to `tasks.md` through docmgr.

### Why

- The original primary guide contained requirements that had been deliberately deferred, so an implementer could not tell which design was authoritative.
- A separate ideal section preserves reasoning without turning every robustness mechanism into first-version work.
- Phase tasks must reflect the chosen architecture or task completion would measure the wrong system.

### What worked

- The structural index simplification preserves all behavior through centralized scans while reducing precomputed maps.
- The primary guide now states, near the top and again in §16, exactly which sections are ideal and which govern implementation.
- Ten unchecked implementation tasks correspond one-to-one with Phases 0–9.

### What didn't work

- N/A.

### What I learned

- Keeping the ideal design is useful only when the chosen implementation explicitly supersedes it where they differ.
- The index simplification affects materialization strategy, not document-binding validation, orphan cleanup, format lookup, or `view.show` behavior.

### What was tricky to build

- The old phases referenced fine-grained preconditions, generic modules, controller-per-feature shell state, complete validation, and command-replanning sync. Merely adding a simplification note would leave contradictory acceptance criteria. The fix required updating phases, tests, risks, gates, intern guidance, and cross-references together.

### What warrants a second pair of eyes

- Verify that §16’s comparison table matches every active simplification decision.
- Check that no chosen-phase exit gate still requires generic modules, full index materialization, detailed preconditions, or command-based sync re-planning.
- Confirm the exact effect representation before Phase 3; it remains intentionally deferred.

### What should be done in the future

- Begin with the open Phase 0 task; do not start production extraction before behavior goldens and headless import guards exist.
- Keep the simplification record updated before altering §16 or `tasks.md` again.

### Code review instructions

- Read primary guide §§6–15 as ideal reference, then §16 as authoritative implementation design.
- Compare each Phase 0–9 heading in §17 with its corresponding unchecked task in `tasks.md`.
- Run `docmgr doctor --ticket PBUI-WORKBENCH-CORE-1 --stale-after 30` after future scope edits.

### Technical details

Chosen version-one index:

```text
workspaceById
nodeById
workspaceByNodeId
viewByPlacementId
placementsByViewId
viewsByAppId
```

On-demand queries retain `viewsUsingDocument`, `documentsWithFormat`, and `orphanViewIds`.


## Step 6: Implementation kickoff — re-read the code against the guide and fix the build order

This step starts the implementation half of the ticket. Before touching production code I re-read the whole current workbench (verbs, assembly, store, links, sync, persistence, protocol client, the React components, and every consumer entry point in and outside the repository) against §16 of the guide and the simplification record, and turned Phases 0–9 into a concrete build order with the decisions that the guide left open for Phase 0/1.

The important outcome is not a new design but a set of small, now-fixed decisions: where the link kernel dependency leaves the core's "no React" fence, how deterministic ids reach the planner, which current verb maps onto which `view.show` request, and what the golden fixtures freeze before extraction begins.

### Prompt Context

**User prompt (verbatim):** "Work on the docmgr ticket PBUI-WORKBENCH-CORE-1, commit at appropriate intervals and keep a detailed diary as you work (using the diary format from the skill). Print out a brutalist work slip with the plan / different phases for the ticket. then before stsarting a phase, plrint a split about the phase, and print one when the phase is done.

Take your time to properly analyze the situation before starting"

(A mid-turn follow-up said "in pbui" to locate the ticket.)

**Assistant interpretation:** Execute the implementation phases of PBUI-WORKBENCH-CORE-1 in the pbui repository, one focused commit per phase, with a diary step per phase and thermal work slips at the plan, phase-start, and phase-end points.

**Inferred user intent:** Get the hard cutover actually built to the §16 design, with enough written trail that the work can be reviewed and resumed, and physical slips as a progress log.

### What I did

- Read every document in the ticket (guide §§0–25, the simplification record, diary Steps 1–5, tasks, changelog, the probe).
- Read the current implementation end to end: `verbs.ts` (1,407 lines), `createWorkbench.tsx`, `store.ts`, `types.ts`, `apps.ts`, `document.ts`, `describe.ts`, `sync.ts`, `persistence.ts`, `placement.ts`, `actions.ts`, `tileDescriptor.ts`, `launcherRows.ts`, `links/{handlers,runtime,snapshot}.ts`, the protocol client (`apply.ts`, `builders.ts`), `pkg/workbench/validate.go`, and the Surface/Tile/Launcher/RebalanceDialog components.
- Inventoried consumers: in-repo (pbui-chat + demo, pbui-sandbox, pbui-ecommerce + demo, pbui-plotscript + demo, pbui-editor docs only) and external (agentlogic, turboproof, hyperblog, rag-ttc; all on `task/add-plot-editor` branches; hyperblog and rag-ttc use `link:` overrides to this checkout, agentlogic and turboproof install a packed tarball).
- Re-ran the baseline: protocol 48/48 green; workbench 281 tests, one intermittent failure on the first run that did not reproduce on a verbose re-run (`slate.perf.test.ts` is timing-based); typecheck clean.
- Checked the React fence question: `src/presentation/links/*` is React-free by its own test, but the pbui root barrel (the only runtime entry) pulls `createPbui.tsx`, `registry.ts`, `actions/types.ts` and `interaction/explain.ts`, all of which import React.

### Why

- The guide says to start with behaviour, not folders (§20.1); the goldens and the inventory are what Phase 0 exists to produce.
- The open questions in §23 block Phase 1 file layout unless answered now.

### What worked

- The `view.show` normal form covers every current identity/placement verb once the two axes are named (table under Technical details).
- `crypto.randomUUID` is the only source of nondeterminism in the current planner, so goldens can pin exact mutations by stubbing it.

### What didn't work

- The first `pnpm --filter @hyperslop-systems/pbui-workbench test` run reported `1 failed | 280 passed` with no failure text captured by the grep; the verbose re-run passed 281/281. Treated as the known timing-sensitive perf test, not a real regression; recorded here so a reviewer is not surprised.

### What I learned

- `Workbench.mutate` bypassing link maintenance (F3) is used in production by `RebalanceDialog` (resize batches) and by consumers (`pbui-plotscript/connect.ts`, chat demo NotesApp), so the one-gateway rule must cover raw `documentPut` batches, not only commands.
- `LinkShellHooks.planner` is how `show` spawns a tile and links its port atomically today; the new planner handles `show` as one command whose fragment contains both the `viewCreate`/`placementSplit` and the links `documentPut`, so the hook disappears.
- turboproof's Redux `WorkbenchStore` adapter mirrors nothing but derives a cached snapshot; under the core the slice can no longer be the document's source of truth without a host port, which the guide defers. That consumer is the one most likely to need a decision at Phase 8.

### What was tricky to build

- Deciding the React fence. Core cannot avoid importing `@hyperslop-systems/pbui` for the link kernel, and that package's runtime entry loads React. Resolution: the fence is enforced on core's own sources (no `react`, `react-dom`, `window.`/`document.` in any non-test module) and by running core's tests in Vitest's `node` environment with no DOM at all; React is a devDependency of core only so the pbui bundle can be imported in tests. Splitting the link kernel into a React-free pbui subpath is recorded as a follow-up, not done in this ticket.

### What warrants a second pair of eyes

- The verb→command mapping table below is the behavioural contract the goldens freeze; if a row is wrong the whole cutover preserves the wrong thing.
- The decision to accept React as a devDependency of core (fence on sources, not on the module graph).

### What should be done in the future

- Add a React-free `@hyperslop-systems/pbui/links` (or `/kernel`) build entry so `workbench-core` can drop React from devDependencies entirely.

### Code review instructions

- Start with the mapping table and §16.4 of the guide; then read the goldens added in Phase 0 (`packages/pbui-workbench/src/goldens/`).
- Validate the baseline with `pnpm --filter @hyperslop-systems/workbench-protocol test` and `pnpm --filter @hyperslop-systems/pbui-workbench test`.

### Technical details

Build order (one commit per phase, each with its own diary step):

| Phase | Deliverable | Ticket task |
|---|---|---|
| P0 | commit ticket docs; transition goldens with deterministic ids; consumer/public-surface inventory; `workbench-core` skeleton with the no-React/no-DOM guard | fugt |
| P1 | `IdGenerator` in protocol builders; delete `createWorkbenchClient`; core `graph.ts` (six-map index), `queries.ts`, `validation.ts` (essential), `parse` | foa7 |
| P2 | manifests (`viewCardinality`, `duplicatePlacement`), slot-aware `InitialDocumentPolicy`, `defineWorkbenchApp`, `createWorkbenchCore` state + replace gateway, `createWorkbenchShell` skeleton | r5l4 |
| P3 | command schemas, `resolveView`/`resolvePlacement`/`materialize`, pure `plan`, `execute`/`preview`, links planning as data, probe inverted | ld9q |
| P4 | one gateway for commands, raw batches, restore/reset, sync adoption; `createWorkbenchLinks` lifecycle through every door; orphan cleanup | e2n6 |
| P5 | `GeometrySnapshot` measured by the shell; rebalance algorithms into `workbench-core/rebalance`; `workspace.rebalance` law; shell-local store | ofwb |
| P6 | React components over core selectors + shell store; `placement.*`/`view.show` everywhere; small barrel; README | i3vo |
| P7 | persistence + batch-preserving sync under core subpaths; delete the pbui-workbench copies | yj61 |
| P8 | migrate pbui-chat/sandbox/ecommerce/plotscript/editor, then rag-ttc, agentlogic, hyperblog, turboproof; delete §18 symbols | i09x |
| P9 | full audit (tests, typecheck, build, Go, protocol-check), package docs, versions | lnzs |

Verb → command mapping frozen by the goldens:

| Current verb | Core command |
|---|---|
| `tile.split(p, dir)` (no app) | `placement.duplicate { placementId, axis }` — policy decides clone/link/`{app}` |
| `tile.split(p, dir, appId)` | `view.show { view: application(appId, reuse: manifest-default), placement: split(target p, axis) }` |
| `tile.close` | `placement.close` |
| `tile.swap` | `placement.swap` |
| `tile.dock` | `placement.dock` |
| `tile.replaceWith` | `placement.replaceWith { source, target }` |
| `tile.activate` | `session.activatePlacement` |
| `split.resize` | `placement.resize` |
| `app.place(appId, from?)` | `view.show { application(appId, manifest-default), auto(near: from) }` — singleton elsewhere navigates |
| `app.placeAt(appId, target, zone)` | `view.show { application(appId, manifest-default), split(target, edge) \| auto(near) \| replace(target) }` |
| `view.open(appId, docs, near?/at?)` | `view.show { application(appId, documents, reuse: same-bindings), auto(near) \| split \| replace }` |
| `tile.replace(p, appId, docs?)` | `view.show { application(appId, documents, manifest-default), replace(p) }` |
| `tile.link(p, viewId)` | `view.show { existing(viewId), replace(p) }` |
| `view.goTo(viewId)` | `view.show { existing(viewId), navigate }` |
| `view.setTitle` / `view.rebind` | `view.configure { viewId, title? \| documents? }` |
| `workspace.*` | same names; `workspace.setTree` becomes `workspace.rebalance` with the preservation law |
| `launcher.*`, `rebalance.*`, `link.mode.*`, `relation.palette.*` | shell actions (not commands) |
| `show` with several winners | `{ ok: false, code: "ambiguous", choices }`; the shell opens the chooser from the result |

Decisions for §23:

1. persistence and sync: `@hyperslop-systems/workbench-core/persistence` and `/sync` subpaths.
2. link effects: `LocalEffect` union — `{ kind: "link-runtime", effects: RuntimeEffect[] }` and `{ kind: "forget-view-values", viewId }`; applied by `execute` after the document is installed, never by `preview`.
3. links collaborator methods: `snapshotOf(world)`, `plan(command, world)`, `maintenance(world, mutations)`, `afterCommit(mutations)`, `describe(world)`, plus `runtime`/`deps`.
4. selected workspace persistence: explicit envelope option (unchanged from today).
5. headless automatic axis: `policy.split.headlessAxis`, default `"row"`.
6. no-op success: `{ ok: true, changed: false }`.
7. imported orphans: accepted; core-generated commands never create new ones.

## Step 7: Phase 0 — goldens, inventory, and the core package fence

Phase 0 froze the behaviour worth keeping before any extraction. Forty-four goldens now pin the exact protocol batch, session, returned value, view order, and leaf→view map that every current verb produces on a document with deterministic ids. The `workbench-core` package exists with nothing in it except the fence that will keep React and the DOM out of it.

The consumer inventory and target export map live in `reference/02-consumer-inventory-and-public-surface.md`; the ticket documents themselves were committed for the first time in this step.

### Prompt Context

**User prompt (verbatim):** (see Step 6)

**Assistant interpretation:** Deliver guide §17 Phase 0: goldens, inventory, public-boundary record, and the headless import guard scaffold.

**Inferred user intent:** Make the later phases measurable against a frozen contract rather than against memory.

**Commit (code):** 9822ba8 — "PBUI-WORKBENCH-CORE-1 P0: transition goldens, workbench-core skeleton with React/DOM fence"

**Commit (docs):** e9ce3ed — "PBUI-WORKBENCH-CORE-1: ticket workspace, design, decisions, diary steps 1-6, inventory"

### What I did

- Added `packages/pbui-workbench/src/goldens/transitions.test.ts` (44 cases) and its snapshot: placement verbs, every identity/placement combination that `view.show` will absorb, view/workspace verbs, and the link lifecycle (follow, close-source maintenance, app replacement, clone re-keying, identity.add, show spawn).
- Stubbed `crypto.randomUUID` with a zero-padded counter so `newId` yields `v-00000001-0000`-style ids; the initial layout is built under the same stub, so leaf ids are stable too.
- Created `packages/workbench-core` (package.json, tsconfig, tsconfig.build, vite/vitest config with `environment: "node"`, empty `src/index.ts`) and `src/fence.test.ts`.
- Ran `pnpm install --offline` to link the new workspace package; core tests 5/5, typecheck clean; pbui-workbench typecheck clean.

### Why

- §20.1 and §17 Phase 0: behaviour first, folders second.
- The fence must exist before the first module lands or it is never enforced.

### What worked

- The goldens captured everything in one harness by hooking `onMutate` and reading the store after each verb.
- The rendered-axis rule could be frozen with a fake root whose `getBoundingClientRect` is stubbed per placement.

### What didn't work

- Nothing failed in this step.

### What I learned

- `place()` on a singleton that lives in another workspace produces an EMPTY batch and a workspace switch; `view.show { existing, navigate }` must therefore be a session-only transition.
- The `show` spawn golden shows the current two-batch coupling (`viewCreate`+`placementSplit`, then the links `documentPut`) arriving as ONE batch through the shell planner hook; the core must keep that atomicity without the hook.

### What was tricky to build

- The identity.add golden also records the runtime revision delta and class ids, because that is the defect F1 makes visible; the same fields flip in Phase 3 when planning becomes pure.

### What warrants a second pair of eyes

- Read the snapshot file once as a whole: it is the semantic contract. Any row that looks wrong today is a bug to fix deliberately in Phase 3, not something to reproduce.

### What should be done in the future

- Phase 3 ports these 44 cases to the core planner; the snapshot names stay so the diff is legible.

### Code review instructions

- `packages/pbui-workbench/src/goldens/transitions.test.ts` and its `__snapshots__`.
- `packages/workbench-core/src/fence.test.ts`.
- Validate: `pnpm --filter @hyperslop-systems/pbui-workbench test -- src/goldens` and `pnpm --filter @hyperslop-systems/workbench-core test`.

### Technical details

- The fence exempts `persistence/` and `sync/` from the DOM-global regex (host adapters by design) but still forbids React there and forbids bare `window.`/`document.` access.

## Step 8: Phase 1 — protocol hygiene and the core's foundations

Phase 1 gave the protocol client injectable ids and removed the configured client that duplicated engine policy, then laid the core's first four modules: manifests, the six-map structural index, the on-demand queries, and essential validation with Go's codes and paths. Layout builders moved into the core with a deterministic-id option, and parsing now returns diagnostics instead of `null`.

Nothing in the shell changed yet; the old `pbui-workbench` modules keep running side by side until Phase 6 cuts over. That duplication is deliberate and temporary.

### Prompt Context

**User prompt (verbatim):** (see Step 6)

**Assistant interpretation:** Deliver guide §17 Phase 1.

**Inferred user intent:** A core whose index, queries, and validation can be trusted before any planner is written on top of them.

**Commit (code):** 54beaf4 — "PBUI-WORKBENCH-CORE-1 P1: protocol IdGenerator, delete createWorkbenchClient; core index, queries, validation, layout builders"

### What I did

- `workbench-protocol/client/builders.ts`: added `IdGenerator`; `leafNode`, `splitNode`, `splitPlacement`, `dockPlacement` take an optional generator (default `newId`); deleted `ClientConfig`, `WorkbenchClient`, `createWorkbenchClient` and their eight tests (protocol suite now 40 tests).
- `workbench-core/src/apps.ts`: `WorkbenchAppManifest`, `defineAppManifest` (defaults `many`/`clone`, `one` ⇒ `link`, refuses `one`+`clone`), `createManifestCatalog`, `isDocBound`, `documentSlots`.
- `graph.ts`: `buildWorkbenchIndex` with the six maps; duplicate node ids throw `WorkbenchDiagnosticError(duplicate_id)`.
- `queries.ts`: `viewsUsingDocument`, `documentsWithFormat`, `orphanViewIds`, `placementCount`, `firstPlacementOfView`, `workspaceOfView`, `isPlacement`, `leavesOfWorkspace`, `canClose`, `sameBindings`.
- `validation.ts`: `validateWorkbenchDocument` (format/version, workspace and node shape, global node ids, leaf→view, view/viewOrder bijection, key mismatches, trimmed titles, count limits, and — with a catalog — `unknown_application`, `duplicate_singleton`, `unknown_binding`, `unknown_document`).
- `document.ts`: builders with `ids`, `parseWorkbenchDocument` → `{ ok, document } | { ok: false, diagnostics }`, `specOf`.
- `testing.ts`: `sequentialIds()` producing the same thirteen-character shape as the Phase 0 goldens.
- Tests: `graph.test.ts` (index equals slow traversal for every join; duplicate refusal; orphans), `queries.test.ts`, `validation.test.ts` (every code), `document.test.ts`.

### Why

- F7: two implementations of binding/replacement policy had drifted; the protocol keeps only policy-neutral primitives.
- F14: one index per revision replaces 179 scattered tree walks.
- F8: replacement will validate through this module in Phase 2.

### What worked

- Reference-traversal tests caught nothing wrong, which is the point: the index is a cache of what `findNode`/`leaves`/`viewsOfApp` already compute.

### What didn't work

- `pnpm --filter @hyperslop-systems/workbench-core test` first failed with `Module '"@hyperslop-systems/workbench-protocol/client"' has no exported member 'IdGenerator'` and ids that ignored the generator: the core resolves the protocol package through its built `dist/`, which was stale. Fixed by `pnpm --filter @hyperslop-systems/workbench-protocol build`. Rule for the rest of the ticket: rebuild `workbench-protocol` (and later `workbench-core`) after changing them before testing a dependant.
- The fence flagged `graph.ts`, `queries.ts`, `validation.ts` because a parameter named `document` matched the DOM regex (`document.views`). Renamed the parameter to `doc` in all core modules rather than weakening the fence; one missed rename (`document = fromJson(...)` against `let doc`) surfaced as `invalid_json: document is not defined` and was fixed.
- `slate.perf.test.ts` in pbui-workbench failed once more while another suite ran in parallel and passed on rerun; it is a wall-clock guard, not a regression.

### What I learned

- `viewsByAppId` must be built from `viewOrder`, not from the placement walk, or an unplaced view disappears from the catalog view of the document.

### What was tricky to build

- Matching Go's paths exactly (`views["v-1"].documents["slot"]`, `workspaces[0].tree.split.a.leaf.viewId`) so a refusal from either side reads the same; the tests pin the strings.

### What warrants a second pair of eyes

- `validateWorkbenchDocument` collects every diagnostic while Go returns the first; the first entry is the one to compare with a Go refusal.

### What should be done in the future

- Wire the `contracts/workbench/v1/{valid,invalid}` fixtures into a core parity test once the catalog shape for fixtures is decided (deferred by S7).

### Code review instructions

- Start at `packages/workbench-core/src/graph.ts` and `validation.ts`; then the protocol diff in `builders.ts`.
- Validate: `pnpm --filter @hyperslop-systems/workbench-protocol build && pnpm --filter @hyperslop-systems/workbench-protocol test && pnpm --filter @hyperslop-systems/workbench-core test`.

### Technical details

- Core modules never name a variable `document`; the fence's DOM regex depends on it.

## Step 9: Phase 2 — the app model and the core's constructor

Phase 2 put the semantic policy into data the planner will read, and built the stateful half of the core: one immutable observable state, a validated raw-batch gateway, and validated replacement. The shell gained `defineWorkbenchApp`, the one declaration that yields both a manifest and a presentation.

The binding policy is the visible semantic change of this phase: default document binding now operates over every declared document slot of the manifest and refuses undeclared slots or missing documents before a view exists, instead of filling one privileged `source` key on any application.

### Prompt Context

**User prompt (verbatim):** (see Step 6)

**Assistant interpretation:** Deliver guide §17 Phase 2.

**Inferred user intent:** Headless construction of a workbench with real manifests, so agents and tests never touch React.

**Commit (code):** dfab835 — "PBUI-WORKBENCH-CORE-1 P2: policy, slot-aware bindings, session, createWorkbenchCore, defineWorkbenchApp"

### What I did

- `policy.ts`: `compilePolicy` — pane constraints plus `headlessAxis` (default `"row"`), `duplicate` (`"clone" | "link" | { app } | fn`), `emptyPlacement` (derived from an `{ app }` duplicate policy, `null` switches the fill rule off), `initialDocuments`.
- `binding.ts`: `InitialDocumentPolicy`, `bindRequestedOnly` (default), `followTheCrowd` (per slot: request → crowd → first bindable → unbound; `isBindable`, `unbound`, `pick` options), `resolveInitialDocuments` (refuses `unknown_binding` / `unknown_document`).
- `session.ts`: `WorkbenchSession` and `repairSession`.
- `createWorkbenchCore.ts`: `WorkbenchCoreState { document, session, index, revision }`, `subscribe`, `apply(mutations)` (apply → validate → install → `onCommit`), `replaceDocument` / `restore` / `reset` (validated, session repaired, no `onCommit`), `onRejected`, `onPostCommitError`; construction validates the initial document and throws on failure. `createWorkbenchCoreWithInternals` exposes `install`/`prepare` for Phases 3–4 without making them public.
- pbui-workbench `app.ts`: `AppPresentation`, `WorkbenchApp`, `defineWorkbenchApp`, `createPresentationRegistry`, `isAppAvailable`, `manifestsOf`; the package depends on `workbench-core` and externalises it in its build.
- Tests: `policy.test.ts`, `binding.test.ts`, `createWorkbenchCore.test.ts` (atomic apply, refusal codes from applier then validation, post-commit isolation, replacement semantics, serialize/restore/reset), shell `app.test.ts`.

### Why

- F10 and S11: bindings over declared slots; one declaration, two projections.
- F3/F8: every durable door validates and installs through one function.

### What worked

- `repairSession` after every install means no component can ever read an active placement that is not a leaf of the selected workspace.

### What didn't work

- The core tests typechecked only after the test helper's mutation body was typed as `MessageInitShape<typeof MutationSchema>["body"]` rather than `Mutation["body"]` (protobuf-es init shapes are looser than message shapes).

### What I learned

- Validating the initial document at construction is a behaviour change: a stored layout naming an application that is no longer registered used to render an empty tile; it now fails construction. `readWorkbenchSnapshot` will take the catalog in Phase 7 so persistence falls back to the default layout instead.

### What was tricky to build

- Keeping `install` and `prepare` off the public object while letting `execute` (Phase 3) and the links collaborator (Phase 4) use them: a second factory returns `{ core, internals }` and the public `createWorkbenchCore` discards the internals.

### What warrants a second pair of eyes

- `followTheCrowd` fills every declared slot, including a slot the caller left out of a non-empty request; the old code used a non-empty request verbatim. The goldens do not cover a multi-slot app, so this is a deliberate change, not a regression.

### What should be done in the future

- Phase 7: `readWorkbenchSnapshot({ apps })`.

### Code review instructions

- `packages/workbench-core/src/createWorkbenchCore.ts` (`prepare`/`install`), then `binding.ts`.
- Validate: `pnpm --filter @hyperslop-systems/workbench-core test` and `pnpm --filter @hyperslop-systems/pbui-workbench test -- src/app.test.ts`.

### Technical details

- Rebuild rule: `pnpm --filter @hyperslop-systems/workbench-core build` before running pbui-workbench, which resolves the core through `dist/`.

## Step 10: Phase 3 — the pure planner, generalized `view.show`, and fresh execution

Phase 3 is the heart of the cutover: the 1,407-line verb module's policy now lives in a planner that reads values and returns data. Every old identity/placement verb is one `view.show` with a `ViewRequest` and a `PlacementRequest`; identity is resolved by `resolveView`, space by `resolvePlacement`, and `materialize` joins them. `core.execute` plans fresh against the captured state, checks the coarse revision, applies and validates the complete batch, installs once, and only then runs the planned effects. `core.preview` is the same planning with nothing installed and no effect run.

The proof is the golden replay: all 44 Phase 0 scenarios produce the same protocol batches, leaf→view maps, view orders, and sessions through the core, with three deliberate differences recorded below. The ticket's purity probe now has an inverted twin for the core, and it passes.

### Prompt Context

**User prompt (verbatim):** (see Step 6)

**Assistant interpretation:** Deliver guide §17 Phase 3.

**Inferred user intent:** Planning that agents, tests, and sync can trust because it cannot touch anything live.

**Commit (code):** 98d34a6 — "PBUI-WORKBENCH-CORE-1 P3: commands, pure planner, generalized view.show, execute/preview, links as data"

### What I did

- `commands.ts`: `WorkbenchCommand`, `ViewRequest`, `PlacementRequest` (`navigate` / `auto` / `split` / `replace`), `isWorkbenchCommand` (complete shapes, shell-local link verbs excluded), `describeWorkbenchCommand`, and `commands.*` builders (`split`, `place`, `placeAt`, `open`, `replace`, `link`, `goTo`, …) that compile to the normal form.
- `geometry.ts`: `GeometrySnapshot` and the pure math (`paneRatioBounds`, `canSplitPlacement`, `splitRatioBounds`, `longerAxis`, `layoutFits`).
- `effects.ts`: `LocalEffect` = `link-runtime` | `forget-view-values`.
- `links/`: `runtime.ts` (no React), `document.ts`, `snapshot.ts` (labels injected), `collaborator.ts` — `createWorkbenchLinks({ deps?, labels?, runtime? })` with `bind`, `snapshot`, `plan` (data only), `maintenance`, `afterCommit`, `sourceOf`.
- `planner/`: `world.ts`, `placement.ts` (duplicate/close/swap/dock/replaceWith/resize), `show.ts` (`resolveView`, `resolvePlacement`, `materialize`), `workspace.ts` (create/rename/delete/clone/rebalance with the preservation law), `session.ts`, `links.ts` (term commands; `show` resolves on a fresh snapshot and expands a spawn into `view.show` + follow/bind inside the same plan), `plan.ts` (sequential drafts, one orphan sweep, one links maintenance, forget effects).
- `createWorkbenchCore`: `links`, `execute`, `preview`, `onRefused`; `ExecuteResult` is the small `{ ok, changed, placementId?, viewId?, workspaceId? }` / `{ ok: false, code, because, choices? }`.
- Tests: `goldens/transitions.test.ts` (45), `execute.test.ts` (purity, atomic batches, session-only commands, ambiguity → choices, onRefused), `commands.test.ts`; ticket `scripts/02-plan-purity-probe-core.test.ts` with captured output.

### Why

- F1, F2, F3, F9, F11, F12: one pipeline, no shadow store, no live writes during planning, placement vocabulary, centralized orphan cleanup.

### What worked

- A diff of the two snapshot files (ignoring the `returned` value, which changed shape by design) shows identical batches in 41 of 44 cases; the remaining three are intentional.

### What didn't work

- Two first-run test expectations were mine, not the code's: the orphan sweep appends `viewDelete` after the LAST command's mutations (not right after the close), and an ambiguous `show` offers every ranked candidate (six), not only the two winners. Both expectations were corrected and the behaviour kept.

### What I learned

- The old code activated the target pane after `placeAt`/`openAt` replace but NOT after `tile.link` / `tile.replace`; the unified `replace` materialization always activates it. Three goldens show `activePlacementId` set where it used to stay null. Kept: the pane the user just changed is the natural active one.
- `followTheCrowd` reproduces the old `BindingConfig` golden exactly for a single-slot app.

### What was tricky to build

- `show`'s spawn had to become an expansion inside the same plan: the follow verb's snapshot must include the just-minted view's ports, so the planner runs `view.show` first, rebuilds the draft index and link snapshot, then plans the follow. This is what the old shell "planner hook" did through a shadow store; here it is the ordinary sequential draft loop.
- The fence flagged `world.document.views` as DOM access; the regex now ignores property access preceded by a dot.

### What warrants a second pair of eyes

- `resolvePlacement`'s empty-pane fill applies to any `split` without an edge or axis (the old code applied it only to `placeAt`, not to `openView … at center`).
- Rebinding an application that declares no document slot is now refused (`unknown_binding`); the old code wrote it and the server would have rejected the batch.

### What should be done in the future

- Phase 4 routes the raw-batch and replacement doors through links maintenance and adds `afterReplace` runtime cleanup.

### Code review instructions

- Read `planner/show.ts` first, then `planner/plan.ts`, then `createWorkbenchCore.ts` `execute`.
- Compare `packages/pbui-workbench/src/goldens/__snapshots__` with `packages/workbench-core/src/goldens/__snapshots__`.
- Validate: `pnpm --filter @hyperslop-systems/workbench-core test`; `npx vitest run --config ttmp/…/scripts/01-vitest.config.ts` in `pbui/`.

### Technical details

- Id minting order inside a split: view id (if created) → split id → new leaf id, matching the old handlers so the goldens' ids line up.

## Step 11: Phase 4 — one execution gateway, links through every door

Phase 4 closed F3: there is no longer a door into the document that skips validation or links maintenance. A raw protocol batch now receives the same links upkeep a command does, in the same atomic batch, and replacement (restore, reset, and later sync adoption) tells the links runtime which views are gone.

Most of what the guide lists for this phase had already landed with the constructor in Phase 2 (state shape, revision, post-commit isolation, validated replacement), so the commit is small and its value is the door-equivalence test.

### Prompt Context

**User prompt (verbatim):** (see Step 6)

**Assistant interpretation:** Deliver guide §17 Phase 4.

**Inferred user intent:** No path — button, agent, product adapter, sync — can leave link topology or runtime values stale.

**Commit (code):** 93724d5 — "PBUI-WORKBENCH-CORE-1 P4: one gateway for raw batches and replacement; links maintenance through every door"

### What I did

- `createWorkbenchCore.apply`: appends `links.maintenance(document, batch)`, validates the whole batch, installs once, then `links.afterCommit` with a forget-values effect per `viewDelete`.
- `replace` (used by `replaceDocument`, `restore`, `reset`): calls the new `links.afterReplace(document)`, which forgets emitted/attended values of every view absent from the new document.
- `gateway.test.ts`: the close command and a raw `closePlacement` batch produce byte-identical committed batches and link payloads; a raw batch whose second half is invalid is refused whole; replacement forgets only the vanished views; restore/reset validate.

### Why

- F3 and the Phase 4 exit gate: "equivalent view lifecycle changes maintain links identically".

### What worked

- Comparing the two doors by their committed batch (through `onCommit`) is a precise, cheap equivalence test.

### What didn't work

- First run of the equivalence test failed on the hold's captured value: only the raw path had emitted a value before closing, so the follower held `7` on one side and an unresolved diagnostic on the other. A setup mismatch in the test, not a gateway difference; both paths now emit first.

### What I learned

- `afterReplace` cannot reuse maintenance: a replacement has no mutation list, so the runtime is reconciled against the new document's view set instead.

### What was tricky to build

- Nothing beyond the test setup.

### What warrants a second pair of eyes

- Raw batches receive links maintenance but NOT the orphan sweep; a raw batch is taken to mean exactly what it says.

### What should be done in the future

- Phase 7 makes sync adoption call `replaceDocument`, which now carries this cleanup for free.

### Code review instructions

- `packages/workbench-core/src/createWorkbenchCore.ts` (`apply`, `replace`) and `links/collaborator.ts` (`afterReplace`); `gateway.test.ts`.

### Technical details

- N/A

## Step 12: Phase 5 — geometry as a value, the rebalance law, one shell store

Phase 5 moved the rebalance engine out of the React package and into a `workbench-core/rebalance` subpath, stated the preservation law as a function, and proved with a generated-tree property test that every structural proposal the slate emits obeys it. On the shell side, `measureGeometry` turns the DOM into the `GeometrySnapshot` the planner already consumes, and `createShellStore` holds the five transient shell facts the old `WorkbenchState` mixed into the semantic store.

The React components are still on the old assembly; Phase 6 rewires them. The shell barrel re-exports the engine from the core so nothing downstream moved yet.

### Prompt Context

**User prompt (verbatim):** (see Step 6)

**Assistant interpretation:** Deliver guide §17 Phase 5.

**Inferred user intent:** No DOM in semantic code; rebalance provably rearranges only; shell state with its own lifetime.

**Commit (code):** f909b1e — "PBUI-WORKBENCH-CORE-1 P5: rebalance into workbench-core/rebalance with the preservation law; shell geometry snapshot and shell-local store"

### What I did

- `git mv` of every pure `rebalance/*` module and test (all but `configStore.ts`) into `packages/workbench-core/src/rebalance/`; `config.ts` now takes `DEFAULT_PANE_CONSTRAINTS` from `../policy`; a barrel `rebalance/index.ts`; `./rebalance` subpath export and Vite entry.
- `rebalance/law.ts`: `placementMapOf`, `preservesPlacements`; `law.test.ts` generates 48 trees × 2 profiles and checks every `set-tree` proposal.
- pbui-workbench: imports rewired to `@hyperslop-systems/workbench-core/rebalance`; barrel re-exports the subpath whole; `geometry.ts` (`measureGeometry`), `shellState.ts` (`createShellStore`, `useShellState`, `WorkbenchShellAction`, `isWorkbenchShellAction`) with tests.
- core `geometry.test.ts`: headless fallbacks are deterministic; measured minima decide.

### Why

- §4.8 / §12.4: keep the algorithms, move the integration; §11.4 the law; S5 and S10.

### What worked

- The move was clean: the rebalance modules imported nothing from the shell except one constant.

### What didn't work

- `splitRatioBounds` for a 400px-tall column split is not null (two 160px panes fit with a 10px divider: `160/390 ≈ 0.41 < 0.5`); my expectation was wrong and the test now also covers the genuinely-too-small case (300px).
- `slate.perf.test.ts` failed once under parallel load in its new home and passed alone; unchanged behaviour.

### What I learned

- `measureGeometry` measures the divider from the first rendered `split-divider` per axis and falls back to the `--pbui-space-4` token, the same two sources the old handler consulted, now once per execution instead of per lookup.

### What was tricky to build

- Two `Rect` types now exist on purpose: the rebalance engine's `{x,y,w,h}` under the subpath and the geometry snapshot's `{x,y,width,height}` at the root. Unifying them would have meant editing every rebalance module for no semantic gain.

### What warrants a second pair of eyes

- The law test's tree grammar is small (depth ≤ 3); it exercises reshape and rebuild but not the 12-tile perf fixture.

### What should be done in the future

- Phase 6 replaces `measureRect`/`measureDividerPx` inside `RebalanceDialog` with `measureGeometry`.

### Code review instructions

- `packages/workbench-core/src/rebalance/law.ts`, `law.test.ts`; `packages/pbui-workbench/src/geometry.ts`, `shellState.ts`.
- Validate: `pnpm --filter @hyperslop-systems/workbench-core build && pnpm --filter @hyperslop-systems/workbench-core test && pnpm --filter @hyperslop-systems/pbui-workbench test`.

### Technical details

- Shell test count dropped from 328 to 274 because the rebalance suites moved to the core (158 there).

## Step 13: Phase 6 — the React shell cutover

Phase 6 turned `pbui-workbench` into what the guide calls a shell: an adapter and renderer over a `WorkbenchCore`, with no semantic code of its own. The 1,407-line verb module, the mixed store, the god constructor with its shadow planner, and the link handlers with their live runtime writes are gone. Components read core selectors and the shell-local store, issue `placement.*` / `view.show` / `session.*` commands through `workbench.execute`, and dispatch dialogs and modes as shell actions.

The shell's test corpus was ported rather than rewritten: every Surface, Launcher, WorkspaceStrip, placement, rebalance, link, connect, derive, identity, and show test runs against the new API, with the same DOM assertions. The two suites that tested engine behaviour through the shell (the verb tests and the persistence/describe tests) moved to the core, where they belong.

### Prompt Context

**User prompt (verbatim):** (see Step 6)

**Assistant interpretation:** Deliver guide §17 Phase 6, taking the persistence/sync file moves of Phase 7 with it because the old modules could not compile against the new shell.

**Inferred user intent:** A React package that cannot contain layout policy, because it has no store to put it in.

**Commit (code):** 4fa53f1 — "PBUI-WORKBENCH-CORE-1 P6: React shell over the core; old assembly, store, verbs, and shell-state mixing deleted"

### What I did

- `createWorkbenchShell.tsx`: `createWorkbenchShell({ core, apps })` → `WorkbenchShell` (core, presentations, shell store, placement, `execute`/`preview`/`dispatch`/`perform`/`apply`, `useDocument`/`useCoreState`/`useShellState`, `linkSnapshot`, root/measure/focus, `describe`, five bound components); `createWorkbench({ apps: WorkbenchApp[], initial, links?: LinkDeps | WorkbenchLinks, …core options })` as the convenience. `execute` measures geometry only for commands that read it and opens the show chooser from an ambiguous result.
- `types.ts`: `WorkbenchShell`, `WorkbenchVerb = WorkbenchCommand | WorkbenchShellAction`, props unchanged except `TilePlacementInfo.app: AppPresentation | null`.
- `app.ts`: `labelOfView`, the one title spelling; `defineWorkbenchApp` now puts the manifest id last so a spread presentation cannot override it.
- Components: Surface, Tile, SplitPane (bounds from `measureSplitGeometry`), Launcher (placement mode through `commands.placeAt`/`place`, rows over presentations + manifests), WorkspaceStrip, ShowChooser (over `choices`), RelationPalette, WireLayer, PortRail, LinkAnnouncer, CoordinationInspector and RebalanceSettings (now `WorkbenchApp`s), RebalanceDialog (`rebalanceGeometry` from the measured snapshot; apply via `core.apply` for resize batches and `commands.rebalance` for trees; undo via the command), RebalanceBadge.
- `links/hooks.ts` over the shell; `launcherRows.ts` takes `apps` (presentations) and `manifests`; `tileDescriptor.ts` reads the index; `actions.ts` and `links/contributions.ts` bind commands and shell actions.
- Core: `describe.ts` (presentations and geometry as inputs; `revision`, `viewCardinality`, `duplicatePlacement` added to the shape), `persistence/index.ts` (`readWorkbenchSnapshot({ apps, onDiscard })`, `createLocalPersistence(core, { onHide })`), `sync/index.ts` (moved, target is the core), subpath exports `./persistence` and `./sync`; `describe.test.ts` and `persistence/persistence.test.ts` ported.
- Deleted from the shell: `createWorkbench.tsx`, `store.ts`, `verbs.ts`, `apps.ts`, `document.ts`, `describe.ts`, `persistence.ts`, `sync.ts`, `links/{handlers,runtime,snapshot,document}.ts`, `workbench.test.ts`, the old goldens (snapshot preserved as ticket `scripts/03-phase0-goldens.snap`); the old probe is kept as `01-plan-purity-probe.historical.ts`.
- New barrel (60 lines), package README for both packages, the shell's `sync` build entry and `./sync` export removed.

### Why

- F2, F3, F4, F13, F15: shell state out of the semantic store, no bypassing door, no object-identity precondition, presentations separate from manifests, a barrel that communicates stability.

### What worked

- Keeping `createWorkbench({ apps, initial, links })` as the name and shape of the convenience meant most stories and tests changed only in what they read (`core.getState()`, `shell.getState()`) and how they act (`execute(commands.*)`, `dispatch`).

### What didn't work

- The test-port script asserted `"verbs" not in file` and stopped on a test NAME ("the rebalance verbs are data…"), so four test files were silently not written on the first pass; a second pass with a narrower check finished them.
- `defineWorkbenchApp` spread the presentation AFTER the id, so `{ ...counterApp.presentation, title: "widget" }` produced a second "counter" and the registry threw `registered twice`; fixed by spreading first.
- Three link tests seeded views bound to documents that did not exist (`table: "orders"`) on an app that declared no such slot; the core now validates at the door, so the tests declare the slot and put the documents in the seed.
- The folder-convention test listed `createWorkbench.tsx` as a non-component by name; updated to `createWorkbenchShell.tsx`.

### What I learned

- Measuring the whole Surface on every divider pointer-move is wasteful; `measureSplitGeometry(element, splitId)` gives the engine exactly the one rect its ratio math reads, and the keyboard/pointer tests pass unchanged (41 % / 59 %).
- The old shell rendered an empty tile for an application that no longer exists; the core refuses that document at construction. `readWorkbenchSnapshot({ apps })` is the door that falls back instead, so products must pass their manifests to it (Phase 8).

### What was tricky to build

- The show chooser: the old code kept a `ShowResolution` in the store; the new one keeps the `show` command and the `choices` the core returned, groups them by candidate-id prefix (`spawn:`), and re-executes the command with `candidateId`. No kernel object crosses the shell boundary.
- The rebalance config store's host: `RebalanceConfigHost` is now `{ useDocument(); apply(mutations) }`, which the shell satisfies; a product with its own settings backend still passes its own store.

### What warrants a second pair of eyes

- `WorkbenchShell.perform` returns true for an ambiguous show (the chooser opened), matching the old boolean; agents should read `execute`'s result instead.
- `createWorkbenchShell` throws when the core has no links collaborator; `createWorkbench` always installs one.
- In-repo consumers (pbui-chat, sandbox, ecommerce, plotscript, editor) do not compile at this commit; Phase 8 migrates them. The root `pnpm -r typecheck` is red until then.

### What should be done in the future

- Phase 7: batch-preserving sync; Phase 8: consumers and the deletion audit.

### Code review instructions

- Start at `packages/pbui-workbench/src/createWorkbenchShell.tsx`, then `components/Tile/Tile.tsx` and `components/Launcher/Launcher.tsx`; then `packages/workbench-core/src/describe.ts` and `persistence/index.ts`.
- Validate: `pnpm --filter @hyperslop-systems/workbench-core build && pnpm --filter @hyperslop-systems/workbench-core test && pnpm --filter @hyperslop-systems/pbui-workbench typecheck && pnpm --filter @hyperslop-systems/pbui-workbench test && pnpm --filter @hyperslop-systems/pbui-workbench build`.

### Technical details

- Shell suite: 22 files, 114 tests; core suite: 24 files, 171 tests (Phase 0 baseline was 31 files / 281 tests in the shell alone, before the goldens and the moves).

## Step 14: Phase 7 — batch-preserving sync

Phase 7 rewrote the sync outbox so the atomicity a local transition promises survives to the server. An outbox entry is one committed batch with a stable id and a `destructive` flag; a request carries whole batches in order; a 409 rebases batch by batch and refuses to replay a stale tree replacement; a 422 with isolation re-sends batches one at a time and never halves one. Local persistence had already moved to the core in Phase 6.

### Prompt Context

**User prompt (verbatim):** (see Step 6)

**Assistant interpretation:** Deliver guide §17 Phase 7 (persistence landed in Phase 6; this step is the outbox).

**Inferred user intent:** The server never sees half of a semantic transition, and a rebalance never silently overwrites another tab's layout.

**Commit (code):** 580f1a9 — "PBUI-WORKBENCH-CORE-1 P7: batch-preserving sync"

### What I did

- `packages/workbench-core/src/sync/index.ts`: `OutboxEntry { id, mutations, destructive }`; `enqueue` makes one entry per batch; `send` concatenates whole entries into one request; `rebase(server, entries, afterConflict)` applies each entry whole and, after a 409, drops destructive entries with reason `conflict`; 422 isolation is per entry; `status()` counts batches; `onDropped(entries, "invalid" | "rebase" | "conflict")`.
- `sync/sync.test.ts`: the old loop's guarantees ported to the core (order, in-flight survival, bootstrap adoption, request-id stability and distinction, transport backoff, 404 detach, stream refetch) plus the §19.6 cases: whole-batch rebase drop, destructive conflict, per-batch isolation (`[3, 2, 1]` requests, never `[3, 1, 1, 1]`), single invalid batch dropped whole, link topology plus maintenance as one batch.

### Why

- F5, F6, S9, Decision 8's reduced form.

### What worked

- The fake server from the old test needed no change; only what it observes changed (batch counts instead of mutation counts).

### What didn't work

- Nothing failed in this step.

### What I learned

- The one-request-many-batches shape keeps the request count of the old flattened outbox while preserving batch boundaries, because the Go server applies a request atomically anyway; isolation is the only path where batch boundaries cost extra requests.

### What was tricky to build

- Distinguishing "structurally inapplicable" (`rebase`) from "applicable but wrong" (`conflict`): the second needs the batch to declare itself, which `workspaceSetTree` does by kind. No other mutation is treated as destructive in version one.

### What warrants a second pair of eyes

- `adopt` (a normal response or a stream refetch) rebases queued entries WITHOUT the conflict rule; only a 409 marks destructive batches as conflicts. A stream refetch that arrives while a rebalance is queued will replay it if it still applies.

### What should be done in the future

- Phase 8 migrates the products that used `onDropped(mutations, reason)` to the entry-based signature.

### Code review instructions

- `packages/workbench-core/src/sync/index.ts` (`rebase`, `send`), then `sync.test.ts`.
- Validate: `pnpm --filter @hyperslop-systems/workbench-core test -- src/sync`.

### Technical details

- Concurrency statement (guide §15.5) is in the module header: optimistic single-user / multi-client persistence with batch-level conflict detection; no collaborative editing.

## Step 15: Phase 8 (in-repo) — every consumer on the core, and documents for what tiles bind

Phase 8's in-repo half moved pbui-sandbox, pbui-plotscript, pbui-ecommerce, pbui-chat and the chat demo onto `createWorkbench` / `defineWorkbenchApp` and the command vocabulary, and deleted nothing more from the shell because Phase 6 had already deleted it: the consumers were the last holders of `defineApp`, `wb.verbs.*`, `wb.store`, `describeWorkbench(wb)` and the `tile.*` verb kinds. Each package was converted mechanically (a manifest/presentation split per app, a command builder per verb call) and then run against the core, and the runs are where the real work was: the core validates every binding against the document store, and three of the four products bind things that live somewhere else.

That finding produced the one new facility of this phase, `connectDocumentSource` in workbench-core: a host-owned set of resources (a program library, a conversation registry, a product catalogue) is mirrored into the workbench document as stub documents, kept in step with the source and with the document itself, so a `chat` tile can bind a conversation and a `script` tile a program without either resource moving house. The `script` application additionally declares `openBindings`, because a program names its own bindings beyond the one slot the manifest can declare.

### Prompt Context

**User prompt (verbatim):** (see Step 6)

**Assistant interpretation:** Phase 8 of the guide: migrate the in-repo consumers to the core and the thin shell, delete legacy APIs, no compatibility aliases.

**Inferred user intent:** A repo where nothing still speaks the old verb vocabulary or reaches into the old store, so the cutover is real and the external consumers have worked examples to copy.

**Commit (code):** cc19b38 — "PBUI-WORKBENCH-CORE-1 P8: migrate in-repo consumers to workbench-core; document sources"; d2a182c — lockfile.

### What I did

- pbui-sandbox: `createScriptApp` and the devtools apps became `defineWorkbenchApp` pairs; the tiles execute `commands.open("script", …)`; the `script` manifest declares `openBindings: true`; new `connect.ts` (`programDocumentSource`, `connectProgramLibrary`) mirrors the library as `sandbox.program` stubs; `@bufbuild/protobuf` and workbench-core added as dependencies.
- pbui-plotscript: apps converted; `connectPlotScriptDocuments(core, host)` now takes the core and writes through `core.apply`; tests, stories and the demo use `parseWorkbenchDocument` and `wb.core`.
- pbui-ecommerce: the seven apps converted line-wise; `createShop` takes `WorkbenchApp[]` and returns a `WorkbenchShell`; the presentation environment's `links` is the shell (`linkSnapshot()`, `links.deps`, `links.sourceOf`); the demo restores through `parseWorkbenchDocument(stored, { apps: createManifestCatalog(manifestsOf(shop.apps)) })`.
- pbui-chat: `createChatApps` / `createConversationApps` converted; `createPbuiChat` holds a `WorkbenchShell`, opens widget tiles with `commands.open("widget", …)` after putting a `chat.widget` stub, and `attachWorkbench` connects the conversation registry as a `chat.conversation` document source (disconnected on detach); `conversations/verbs.ts` executes `commands.open("chat", …)`; `sandboxTools` reads `wb.describe`.
- `src/tools/workbenchTools.ts` rewritten on the new surface: `DEFAULT_POLICY` keyed by command kind with `view.show.replace` as the confirm-gated form (`policyKindOf`); `performWithPolicy` guards on `core.getState().revision` instead of document identity; `verbProblem` switches on the new kinds and uses `canSplitPlacement` / `splitRatioBounds` with `wb.measure()`; `workbenchVerbTargetIds` reads one level into `view` / `placement`; `validateLayout` uses `layoutFits(spec, wb.measure(), wb.core.policy.split)`; the perform tool refuses shell-action kinds ("is not something the assistant may do"), preflights with `wb.preview` and executes with `wb.execute` inside the gateway; the raw tool applies through `wb.apply`; `WORKBENCH_COMMAND_KINDS` replaces `WORKBENCH_VERB_KINDS`.
- Chat demo: `workbench.ts` builds one apps array, restores with `readWorkbenchSnapshot(key, { migrate, apps })`, passes `initialSession`, connects the world (`shop.product|category|metal|order`) and the program library as document sources, persists with `createLocalPersistence(workbench.core, …)`; `pbui/verbs.ts` carries zod schemas for the command kinds and `launcher.open{from?}/close`; `chat.ts` routes the command kinds as local verbs through `wb.perform`; `pbui/actions.ts` and `vocabulary.ts` emit `view.show` / `session.selectWorkspace` literals; `pkg/chatserver/demo/vocabulary.json` regenerated with `pnpm vocab`.
- Tests: `workbenchTools.test.ts` ported (apps as `defineWorkbenchApp`, `wb.perform` in the router seam, `wb.core.getState()`, a `withProduct` seed because the core validates the `sku` binding); `sandboxTools.test.ts` harness connects the program library and a static product source; `conversations/verbs.test.ts` fakes `execute`; core `sources.test.ts` (five cases incl. `openBindings`); refusal goldens updated for `index` / `command`.
- `test/grid-columns.test.ts` had been failing since PBUI-LINK-1: three module stylesheets (CoordinationInspector `.app`/`.pad`, PortRail `.column`, SourceTile `.code`) now state `grid-template-columns: minmax(0, 1fr)`.

### Why

- Guide §17 Phase 8; the agent tools are the product's only path from the model to the layout, so they had to keep every guarantee (revision check, policy, trace) while changing vocabulary.
- The document-store rule is the Go validator's rule (`pkg/workbench/validate.go`: `unknown_binding`, `unknown_document`); relaxing it in TypeScript would have reopened the parity gap the guide closes in §13.1. Mirroring identities keeps AGENT-3's D5 (the library is not the workbench document) while satisfying the rule.

### What worked

- Line-wise converters for the app declarations (keyed on the six-space-indented fields) were reliable where a regex over the whole object was not.
- The agent tools' tests carried over almost verbatim once the harness performed through `wb.perform`: the behaviours (stale revision, deny, confirm ledger, limits, atomic batches) are vocabulary-independent.
- 241 pbui-chat tests, 224 sandbox, 35 ecommerce, 32 plotscript, 114 shell, 189 core (one timing test flaky under load, green alone).

### What didn't work

- The first rewrite of `workbenchTools.ts` aborted on its own leftover check: comment lines mentioning `wb.verbs.*` and the tool's `input.verbs` field matched the old-API pattern. Narrowed the check to code lines and the actual old symbols.
- `sandbox_open` with `{ product: "2049" }` was refused twice: first `unknown_document` (no product document — the test's world is a resolver, not a store), then `unknown_binding` (the test harness declares its own `script` manifest without `openBindings`). Both are the rule working; the fixes are a static source in the harness and the flag on the harness manifest.
- `pnpm vocab` crashed on a stale `pbui-chat/dist` importing `defineApp`; rebuilding the package first fixed it.
- The fence test flagged `sources.ts` for a parameter named `document`; renamed to `doc`, as elsewhere in the core.

### What I learned

- Every product in this repo binds at least one host-owned id: conversations and widgets (chat), programs (sandbox), products (both demos). The old store never noticed because its validation ran without a catalog. The core's strictness surfaced a real modelling gap, and the document source is a small, uniform answer to it.
- A restored layout from before this change carries bindings without stubs and is discarded by `readWorkbenchSnapshot` (with `apps`); the demo falls back to its default layout once. Stubs persist with the document from then on.

### What was tricky to build

- Stub deletion: a `documentDelete` of a bound document is refused by the applier (`document_in_use`), so a source that drops a resource while a tile still shows it must leave the stub and try again when the view goes. `documentSourceMutations` skips bound stubs, and the core subscription re-runs the sync after the closing commit — which is also what stops the subscription feeding itself: a sync that computes no mutations applies nothing.
- The chat demo's `Verb` union is zod-inferred, so `commands.*` (typed as the wide `WorkbenchCommand`) is not assignable in `bind:`; the demo's action rules emit literal `view.show` / `session.selectWorkspace` objects instead.

### What warrants a second pair of eyes

- `openBindings` has no Go counterpart yet: `pkg/workbench` `ApplicationDescriptor.DocumentBindings` would still refuse a `script` view with a `product` binding if the server validated the chat demo's document with a catalog. Today the chat server does not; the flag should be mirrored into the Go descriptor before it does.
- Widget stubs are never removed (a widget that left the timeline is what the tile's empty state reports); the document grows by one small stub per "Open in tile".
- `DEFAULT_POLICY` gates `view.show.replace` and `placement.replaceWith` on confirmation but allows `view.show` otherwise; the old policy gated `tile.replace` only, so this is the same surface under new names.

### What should be done in the future

- Mirror `openBindings` into the Go `ApplicationDescriptor` and the protocol fixtures.
- The external consumers (Step 17).

### Code review instructions

- Start at `packages/workbench-core/src/sources.ts` and `sources.test.ts`; then `packages/pbui-chat/src/tools/workbenchTools.ts` (`policyKindOf`, `verbProblem`, the perform tool) against its test; then `packages/pbui-chat/demo/src/workbench.ts` for the wiring order (sources before `bootstrapConversations`).
- Validate: `pnpm --filter @hyperslop-systems/workbench-core build && pnpm --filter @hyperslop-systems/pbui-sandbox build && cd packages/pbui-chat && pnpm typecheck && npx vitest run && pnpm build && cd demo && pnpm build`.

### Technical details

- Stub formats: `sandbox.program` (body `{ title }`), `chat.conversation`, `chat.widget`, `shop.product` (body `{ name }`), `shop.category`, `shop.metal`, `shop.order`.
- Old verb → command mapping used throughout: `tile.split{dir}` → `placement.duplicate{axis}`; `tile.split{appId}` → `view.show{application, split{target}}`; `tile.close` → `placement.close`; `tile.activate` → `session.activatePlacement`; `tile.replace` → `view.show{…, replace{target}}`; `tile.link` → `view.show{existing, split}`; `split.resize` → `placement.resize`; `app.place` / `view.open` → `view.show{application, auto}`; `view.setTitle` / `view.rebind` → `view.configure`; `view.goTo` → `view.show{existing, navigate}`; `workspace.select` → `session.selectWorkspace`.

## Step 16: Perform the post-implementation architecture and code review

This step reviewed the implemented Phase 0–8 code against the chosen design, the simplification record, the implementation diary, and the current consumers. It produced a new intern-facing assessment that explains the resulting architecture, records what succeeded, audits every completion gate, and prioritizes nineteen concrete findings with stabilization pseudocode and tests.

Seven executable probes verified the most important findings rather than leaving them as source-reading hypotheses. The review concludes that the protocol/core/shell architecture should be retained, but transaction publication, document-source reentrancy, sync bootstrap, mutable state ownership, and TypeScript/Go binding parity need work before release.

### Prompt Context

**User prompt (verbatim):** "We have implemented the ticket (a colleague has), read their diary, read the design documents, analyze the source code that was written, and write a detailed code review / architecture review / assessment of where we are now, what could be improved, what went well, what got exposed as needing work, etc... Create  a detailed analysis / design / code review that is for a new intern, explaining all the parts of the system needed to understand what it is, with prose paragraphs and bullet point sand pseudocode and diagrams and api references and file references. It should be very clear and technical. Store in the ticket and the nupload to remarkable.

[REMINDER] Output a <summary>...</summary> block at the VERY END of your response. This is mandatory."

**Assistant interpretation:** Independently audit the delivered architecture and code, teach the resulting system to a new engineer, preserve executable evidence for discovered defects, store the review in the ticket, and deliver the refreshed documentation bundle to reMarkable.

**Inferred user intent:** Obtain an honest handoff assessment after implementation—not a restatement of the design—so stabilization and release work are guided by concrete strengths, defects, and newly exposed modeling problems.

### What I did

- Read both design documents, the full diary through Step 15, consumer inventory, task/changelog state, implementation commit sequence, core/shell source, tests, Go validation, in-repository consumers, and representative external adapters.
- Ran protocol, core, shell, in-repository consumer, workspace typecheck, and targeted Go validation commands.
- Added `scripts/04-implementation-review-probes.test.ts` and captured its seven observations.
- Added `design-doc/03-post-implementation-architecture-and-code-review.md` with system orientation, actual architecture, end-to-end flows, strengths, completion-gate matrix, nineteen prioritized findings, decisions, phased fixes, test plan, API notes, and file references.
- Updated the ticket index and added a review-delivery task.

### Why

- The implemented system materially differs from both the old code and the ideal architecture, so an intern needs a current-state guide rather than only the pre-implementation plan.
- Callback ordering, reentrancy, and sync bootstrap defects are easy to miss in ordinary happy-path tests but directly affect persistence and server ordering.
- Strict binding validation exposed product resource semantics that need a cross-language decision.

### What worked

- Protocol tests passed 40/40; shell tests passed 114/114.
- Workspace-wide TypeScript typecheck passed for all 12 selected projects.
- Chat passed 241 tests, chat demo 13, sandbox 224, ecommerce 35, and plotscript 32; all targeted packages built.
- `GOWORK=off go test ./pkg/workbench ./pkg/workbenchapi` passed.
- The review probes reproduced mutable state bypass, preview-id drift, subscriber/effect exceptions after commit, source receipt inversion, dropped replacement title, and sync-create false drop.
- The isolated rebalance performance test passed at 36.7 ms median.
- `docmgr doctor --ticket PBUI-WORKBENCH-CORE-1 --stale-after 30` passed after replacing historical RelatedFiles entries for files deleted by the cutover.
- The refreshed nine-document bundle uploaded successfully and the remote directory listed `PBUI Workbench Core Consolidation`.

### What didn't work

- The first review-probe run failed because a ticket-local test could not resolve the workspace package from its directory:

  ```text
  Error: Failed to resolve import "@hyperslop-systems/workbench-core" from "ttmp/2026/09/03/PBUI-WORKBENCH-CORE-1--hard-cutover-consolidation-of-the-workbench-into-a-reusable-composable-core/scripts/04-implementation-review-probes.test.ts". Does the file exist?
  ```

  The fix was to import the core source through its explicit repository-relative path.

- Two full core test runs failed the wall-clock performance assertion:

  ```text
  AssertionError: expected 53.57029700000021 to be less than 50
  AssertionError: expected 72.42204200000015 to be less than 50
  ```

  The exact test passed alone at 36.7 ms, confirming load-sensitive flakiness.

- `make protocol-check` reached Go and failed because the workspace directive/toolchain versions disagree:

  ```text
  go: module . listed in go.work file requires go >= 1.26.6, but go.work lists go 1.26; to update it:
      go work use
  ```

  Targeted package tests passed with `GOWORK=off`.

### What I learned

- The architectural split is successful; the highest-risk problems are now concentrated in publication and integration boundaries rather than semantic planning.
- “One gateway” is not enforceable while callers can mutate the exposed protobuf document and index maps.
- A synchronous store listener is part of transaction semantics: document-source reconciliation can reverse receipt order and therefore produce server-invalid outbox order.
- `openBindings` represents at least two different missing concepts—optional contextual binding and program-owned binding—and should not become the final model.
- A source-clean package is not necessarily dependency-clean; workbench-core still reaches React transitively through the PBUI root entry.

### What was tricky to build

- The repository was moving concurrently while the review ran: the in-repository Phase 8 commit landed before review completion, and external consumer migrations were actively changing. The review therefore records an explicit PBUI commit baseline and separates stable implementation findings from migration status.
- The source receipt-order defect required a particular sequence: remove a resource while still bound, then close the view. That causes the core subscriber to notice the now-unbound stale stub and perform a nested `documentDelete` before the outer close receipt.
- Sync bootstrap needed a missing server row plus a local queued batch before attach; ordinary existing-row bootstrap tests do not expose the double-processing.

### What warrants a second pair of eyes

- Re-run and inspect all seven review probes, especially whether source receipt order can feed the current sync adapters exactly as described.
- Review the proposed observer publication order before implementation; internal link-runtime and external receipt/state observers have different consistency needs.
- Decide whether sandbox program-owned bindings belong in `AppView.documents` at all.
- Decide turboproof state ownership before writing a mirrored Redux/core adapter.

### What should be done in the future

- Fix the P0 transaction/source/sync findings before package release.
- Add explicit source ownership and persisted-layout hydration.
- Replace or formally specify `openBindings` and mirror accepted semantics in Go fixtures.
- Complete external consumer migration and Phase 9 only after stabilization.

### Code review instructions

- Start with design doc 03 §§1, 7, and 8.
- Inspect `createWorkbenchCore.ts:202-232, 280-327`, `sources.ts:67-75`, and `sync/index.ts:184-255` beside the probe output.
- Run:

  ```bash
  pnpm exec vitest run \
    --config ttmp/2026/09/03/PBUI-WORKBENCH-CORE-1--hard-cutover-consolidation-of-the-workbench-into-a-reusable-composable-core/scripts/01-vitest.config.ts \
    ttmp/2026/09/03/PBUI-WORKBENCH-CORE-1--hard-cutover-consolidation-of-the-workbench-into-a-reusable-composable-core/scripts/04-implementation-review-probes.test.ts
  ```

### Technical details

Observed probe evidence:

```text
EXPOSED_STATE_MUTATION revision=0
PREVIEW_ID_DRIFT preview=n-00000009-0000 execute=n-00000012-0000
SUBSCRIBER_ESCAPE revisionAfterThrow=1 commitReceipts=0
POST_COMMIT_ESCAPE revisionAfterThrow=1
REENTRANT_RECEIPTS revisions=[4,3] cases=[[documentDelete],[placementClose,viewDelete]]
DROPPED_REPLACE_TITLE changed=false
CREATE_BOOTSTRAP_DROP droppedCalls=1 phase=synced
```

Delivery evidence:

```text
OK: uploaded PBUI Workbench Core Consolidation.pdf -> /ai/2026/09/03/PBUI-WORKBENCH-CORE-1
OK: uploaded PBUI Workbench Core Post-Implementation Review.pdf -> /ai/2026/09/03/PBUI-WORKBENCH-CORE-1
remarquee cloud ls: [f] PBUI Workbench Core Post-Implementation Review
```

## Step 17: Phase 8 (external) — four products cut over in parallel

The external half of Phase 8 was delegated to four subagents working from one brief (the new API on a page, the worked in-repo migrations to copy, the hard-cutover rules, and the "bindings are validated" warning from Step 15), one per repo: hyperblog, agentlogic, turboproof and rag-ttc. All four typecheck, test and build on the new core and shell, each committed on its own `task/add-plot-editor` branch and none pushed. Each report was read for decisions that reach back into pbui; one did, and it was fixed here before the phase closed.

The reach-back was rag-ttc's: pbui-chat's `attachWorkbench` mirrored conversations as `chat.conversation` stubs with no way to choose the format or opt out, and rag-ttc's Go host refuses documents of a format it does not know. `createPbuiChat` now takes `conversationDocuments: { format } | false`; rag-ttc opted out and kept its own reconciler, and the double write it had to install is gone.

### Prompt Context

**User prompt (verbatim):** (see Step 6)

**Assistant interpretation:** Finish Phase 8: the consumers outside this repo, per guide §17 Phase 8's list, as feasible.

**Inferred user intent:** No product left on the old API, so the deletion is real and the next pbui publish does not strand anything.

**Commit (code):** 7fdbe1e — "PBUI-WORKBENCH-CORE-1 P8: conversationDocuments option on createPbuiChat". Consumer commits: hyperblog 6358676; agentlogic e3b69e0; turboproof 68ed102; rag-ttc bdfb04f + 50db0fc.

### What I did

- Wrote the brief (`scratchpad/external-migration-brief.md`, not in the repo) and launched four agents in parallel; read each report; fixed the one pbui gap; sent rag-ttc's agent a follow-up to adopt the option.
- hyperblog (`ui/`, `link:` overrides): apps as `defineWorkbenchApp`; document slots declared per `pkg/workbenchapp/catalog.go`; `splitPolicy` → `policy.duplicate` with the launcher as the empty placement; the old no-op `binding: { source: "post" }` dropped in favour of the default `bindRequestedOnly`; the corpus mirrored as `hyperblog.post` / `hyperblog.term` document sources through a React-context ref; verbs → commands; stored workspace → `initialSession`. 29 tests.
- agentlogic (`ui/`, registry pins with local tarball overrides): `toApp` / `defineWorkbenchApp`; `policy.duplicate: { app: launcher }`; `followTheCrowd({ isBindable, unbound })` over the `transcript` slot; the transcript binding declared through `openBindings` rather than a slot (a declared slot makes an app doc-bound and `defaultLauncherRows` hides doc-bound apps); hand-rolled localStorage → `readWorkbenchSnapshot` + `createLocalPersistence` with a migration that folds the old workspace-pointer key; no document source needed (transcripts arrive by `documentPut`). The agent repacked the ROOT pbui package too, since the Sep 1 tarball lacked the port helpers the core imports. 128 tests.
- turboproof (`ui/`, registry pins with local tarball overrides): the Redux mirror of the old store deleted; the core is the document's home (`useDocument` / `useCoreState` for React, `core.getState()` outside, `apply` / `execute` for writes); Redux keeps `fileSync` and a new `syncStatus { phase }` slice; sync rebuilt on `workbench-core/sync` with `onInvalid: "isolate"` and a 400ms flush; manifests with `documentSlotPort("source")` except the three that bind nothing; `followTheCrowd` over lean sources; the pbui runtime (`createPbui({ presentation, contextFor })`) migrated along the way because the new packages need post-KERNEL pbui at runtime. 129 tests.
- rag-ttc (`apps/workbench/web`, `link:` overrides already pointing at this checkout): apps, workbench, sync adopt through `parseWorkbenchDocument` + `core.replaceDocument`, persistence, agent vocabulary regenerated with the command kinds; `conversationDocuments: false`. 167 tests.
- pbui-chat: the option, README paragraph, and the two format constants exported.

### Why

- Guide §17 Phase 8 lists these products; the brief is what made four independent migrations converge on the same decisions (manifest slots mirroring the Go catalogs, `followTheCrowd` for the old `binding` option, launcher as the duplicate app).
- A product that owns a strict host cannot accept a stub format chosen by a library; the option is the library-side fix, and opting out is the right shape for a product that already reconciles conversation documents itself.

### What worked

- The "bindings are validated" paragraph in the brief pre-empted the failure Step 15 hit; three of four products needed no document source because their bindings were already `documentPut` documents, and hyperblog's corpus became one in a few lines.
- Every agent found and reported the same two conventions (a local-only `pnpm-workspace.yaml` with tarball overrides; a lockfile that deliberately lags unpublished versions) and followed them.

### What didn't work

- Nothing failed outright. agentlogic's `pnpm install` reused stale extractions of same-named tarballs and needed `--force`.

### What I learned

- The root `@hyperslop-systems/pbui` package is still 0.10.0 while its API is post-KERNEL-1..4; two consumers had to repack it, and turboproof's pin now names two incompatible things. Phase 9 bumps it.
- Agentlogic's optional `transcript` binding has no exact spelling in the manifest: a document slot makes the app doc-bound (hidden from the launcher), and `openBindings` is a broader permission than "this one slot is optional". Follow-up.

### What was tricky to build

- Two writers of one document: pbui-chat's conversation source and rag-ttc's reconciler both asserted the conversation documents, each re-running on the other's commit. Both stopped when nothing differed, so it converged, but the fixed format was wrong for the host. The option removes the second writer instead of ordering them.

### What warrants a second pair of eyes

- turboproof's sync no longer coalesces consecutive `documentPut`s of one document: each keystroke queues a one-mutation batch and the debounce bundles them into one request. The agent chose not to add a coalescer because a put held outside the outbox could be lost on a concurrent adoption; worth a look when the editor is used against a live host.
- hyperblog and agentlogic discard a stored layout from the previous build once (`unknown_document`, no stub documents were stored) and fall back to their seeds.
- None of the four ran a browser smoke; Phase 9 lists it.

### What should be done in the future

- Mirror `openBindings` into the Go `ApplicationDescriptor`; consider an "optional document slot" that does not make an application doc-bound.
- Bump the root pbui package (Phase 9); publish protocol → core → shell so the lagging lockfiles and embedded bundles can be committed.

### Code review instructions

- The consumer commits listed above; in each, start at the `workbenchShell`/`workbench.ts` module and its test. In pbui: `packages/pbui-chat/src/createPbuiChat.tsx` (`connectWorkbench`, `conversationDocuments`).
- Validate: `pnpm typecheck && pnpm test && pnpm build` in each consumer's UI package; `cd packages/pbui-chat && pnpm typecheck && npx vitest run`.

### Technical details

- Consumer test counts: hyperblog 29, agentlogic 128 (+1 skipped), turboproof 129, rag-ttc 167.
- Brief's key line: "The core refuses a view whose `documents` binding names a document not in `document.documents` (`unknown_document`), or a slot the manifest does not declare (`unknown_binding`, unless `openBindings`)."

## Step 18: Phase 9 — release audit, baselines, versions

Phase 9 is the audit the guide asks for before a publish: every package's suite, the Go tests, protocol generation parity, the bundle fence, a browser smoke, performance baselines, the migration note, and version bumps in dependency order. Everything that can be run without publishing was run and is green; the publish itself is left to the user, since it is outward-facing and the four external consumers' lockfiles and embedded bundles wait on it by their own convention.

The one result worth reading is the baseline table: index build and link snapshot are effectively free at 12 tiles, a plan costs under a millisecond, a plan-and-commit pair about two, and the full rebalance slate (every generator, the relax gradient, the cubic assignment) about sixteen — the same order as the Phase 6 guard's lab number.

### Prompt Context

**User prompt (verbatim):** (see Step 6)

**Assistant interpretation:** Guide §17 Phase 9: run all suites and consumer suites, Go and protocol checks, confirm the core bundle carries no React or DOM, write the READMEs and migration note, record baselines, bump versions in order.

**Inferred user intent:** A branch that can be published as protocol → core → shell with confidence, and numbers to compare against later.

**Commit (code):** 83074c5 — "PBUI-WORKBENCH-CORE-1 P9: versions, migration note, performance baselines"

### What I did

- Whole-workspace audit: `pnpm -r typecheck` (13 projects), `pnpm -r test` (10 suites, 1,454 tests: protocol 40, pbui 554, core 189, shell 114, ecommerce 35, editor 12, sandbox 224, chat 241, plotscript 32, datalab 13), `pnpm -r build` (12 builds), Storybook builds for workbench, chat, sandbox, ecommerce, plotscript; `make protocol-check` (buf lint, regenerate, no diff); `GOWORK=off go test ./pkg/workbench/... ./pkg/workbenchapi/...` (the workspace `go.work` refuses sibling modules' Go versions, an environment matter).
- Consumer suites: hyperblog 29, agentlogic 128, turboproof 129, rag-ttc 167 (Step 17).
- Bundle fence: `packages/workbench-core/dist/*.js` import only `@bufbuild/protobuf`, `workbench-protocol`, `workbench-protocol/client` and `@hyperslop-systems/pbui` (port helpers); no `react`, `window` or `document.body` in the output. The source fence test stays.
- Browser smoke: the ecommerce demo served from its `dist` with `vite preview`; the seeded workspace renders three tiles, the tile object menu opens, "Split beside" produces a nested pair, zero console warnings or errors.
- Baselines: `scripts/05-perf-baselines.test.ts` (12 tiles, 3 apps, 20 links; medians of 25 after a warm-up) writes `05-perf-baselines.output.txt`.
- `packages/pbui-workbench/MIGRATION.md`: old verbs and store → commands and core, persistence, sync, validated bindings, object menus.
- Versions: workbench-protocol 0.4.1 → 0.5.0; pbui-workbench 0.4.0 → 0.5.0; workbench-core 0.1.0 (new); root pbui 0.10.0 → 0.11.0. All internal deps are `workspace:^`, so nothing else moved; the lockfile did not change.

### Why

- Guide §17 Phase 9, item by item. The root bump answers turboproof's finding that its `0.10.0` pin names two incompatible APIs.

### What worked

- The audit had been running in the background since Phase 8 closed in-repo, so Phase 9 mostly read results.

### What didn't work

- `import.meta.url` under the ticket's vitest config is not a `file:` URL; the baseline script writes through `__dirname` instead.
- The guide lists property/fuzz tests; none exist in this repo (`fast-check` is not a dependency). The goldens and the purity probe are the closest thing. Recorded, not invented.
- `pkill -f "vite preview"` matched the shell that ran it; a `[v]ite` pattern does not.

### What I learned

- `preview placement.duplicate` costs about 30× `preview view.show auto` at 12 tiles because a duplicate consults geometry for the longer axis and runs the split feasibility check; both are still under a millisecond.

### What was tricky to build

- Nothing in this phase; the numbering collision (`04-` was taken by the implementation-review probes) was the only correction.

### What warrants a second pair of eyes

- The publish order and the two consumer conventions that depend on it (agentlogic/turboproof commit neither the lockfile nor the embedded bundle until the packages are on the registry).
- `@hyperslop-systems/pbui` is a runtime dependency of the core for `definePorts` / `documentSlotsOf`; the package's root entry also exports React components. The core's bundle imports only the helpers, but a stricter fence would give pbui a pure `ports` subpath.

### What should be done in the future

- Publish protocol 0.5.0 → core 0.1.0 → shell 0.5.0 (and pbui 0.11.0 first, since the core depends on it), then let the consumers commit their lockfiles and bundles.
- Follow-ups carried from Steps 15–16: `openBindings` in the Go descriptor; an optional document slot that does not make an app doc-bound; a pure ports subpath on pbui.

### Code review instructions

- `packages/pbui-workbench/MIGRATION.md`; `scripts/05-perf-baselines.test.ts` and its output; the three `package.json` version lines.
- Validate: `pnpm -r typecheck && pnpm -r test && pnpm -r build && make protocol-check && GOWORK=off go test ./pkg/workbench/... ./pkg/workbenchapi/...`; `npx vitest run --config <ticket>/scripts/01-vitest.config.ts <ticket>/scripts/05-perf-baselines.test.ts`.

### Technical details

- Baselines (medians, ms): index 0.014; preview duplicate 0.849; preview show 0.030; execute duplicate+close 2.056; links snapshot 0.000; slate 15.602 (n=5). Node v24.18.0.

## Step 19: Design the Workbench stabilization program

This step turned the first three post-cleanup priorities into one implementation guide: safe transaction publication, a genuinely React-free core dependency graph, and binding/document-source semantics shared by TypeScript and Go. It treats these as one prerequisite program because Datalab and future consumers should not adopt the core while receipt ordering, source hydration, and server acceptance remain ambiguous.

The design retains the completed protocol/core/shell architecture. It introduces prepare/install/publish phases, exception-isolated observers, deterministic reentrancy refusal, scheduled source reconciliation, owned snapshots, acknowledged sync adoption, a pure PBUI link-kernel entry, explicit binding rules, source ownership, hydration-before-validation, and shared semantic fixtures.

### Prompt Context

**User prompt (verbatim):** "ok, create a new design doc in this ticket to address 1-3. Then a new docmgr ticket + design doc for 4. Create  a detailed analysis / design / implementation guide that is for a new intern, explaining all the parts of the system needed to understand what it is, with prose paragraphs and bullet point sand pseudocode and diagrams and api references and file references. It should be very clear and technical. Store in the ticket and the nupload to remarkable.

Then which of 5-9 do you think we should already flesh out, or should we give it a new stab sometime in the future?

[REMINDER] Output a <summary>...</summary> block at the VERY END of your response. This is mandatory."

**Assistant interpretation:** Add an implementation-ready stabilization design to this ticket for priorities 1–3, then separately design Datalab adoption and advise on later priorities.

**Inferred user intent:** Finish the Workbench foundation before expanding its adoption and keep unrelated future architecture from becoming one oversized ticket.

### What I did

- Added `design-doc/04-workbench-stabilization-transaction-safety-headless-boundary-and-typescript-go-parity.md`.
- Added three implementation tasks corresponding to transaction/sync/source safety, a pure PBUI kernel entry, and TS/Go binding/source parity.
- Defined transaction phases, observer error data, reentrancy behavior, source scheduling, state ownership, staged link effects, preview allocation, sync bootstrap/adoption, package build entries, binding rules, Go counterparts, source ownership, hydration, fixtures, phases, tests, risks, and completion gates.
- Related the stabilization sequence explicitly to the new Datalab adoption ticket.

### Why

- The review probes demonstrate release-relevant boundary defects even though the main cutover and release audit passed.
- The core’s source fence does not prove a React-free installed graph.
- `openBindings` and format-owned sources are not yet a cross-language semantic contract.

### What worked

- The post-implementation review supplied executable acceptance cases, so the stabilization plan is concrete rather than speculative.
- The existing pure link-kernel barrel provides a clear path to a dedicated package subpath without duplicating semantics.
- Go already has `BindingRule`, providing a natural place to align requiredness and format constraints.
- `docmgr doctor` passed and `PBUI Workbench Stabilization.pdf` uploaded to `/ai/2026/09/03/PBUI-WORKBENCH-CORE-1` after a successful dry run.

### What didn't work

- N/A; this was a design-only step.

### What I learned

- The Phase 9 diary independently identified the same pure-PBUI-subpath and optional-binding gaps, reinforcing the review conclusions.
- Binding legality, binding requiredness, format compatibility, and launcher eligibility must be separate facts.

### What was tricky to build

- Reentrant mutation cannot simply be queued because the synchronous caller expects an immediate truthful result. The chosen version-one rule rejects mutation during publication and requires reactive integrations such as document sources to schedule a later reconciliation.
- A full unified runtime would exceed the chosen first-version architecture, so the design stages core and link values together without introducing a generic module system.

### What warrants a second pair of eyes

- Review receipt versus subscriber publication order and whether persistence/sync should observe before UI subscribers.
- Confirm a pure `pbui/link-kernel` entry includes the type graph without pulling React-bearing declaration files.
- Decide whether sandbox program inputs belong in `AppView.documents` or only in the program payload.

### What should be done in the future

- Implement stabilization phases S0–S7 before starting the Datalab spatial cutover.
- Invert all seven review probes into package regression tests.

### Code review instructions

- Start with design §§5–9 and compare each invariant to `createWorkbenchCore.ts`, `sources.ts`, `sync/index.ts`, PBUI package exports, and Go validation.
- Run the existing implementation-review probes before changing publication order.

### Technical details

```text
Track A: safe transactions, sources, sync, ownership
Track B: React-free PBUI link-kernel entry
Track C: explicit TS/Go binding and source semantics
Dependency: A → B → C → Datalab adoption
Upload: PBUI Workbench Stabilization.pdf
Remote: /ai/2026/09/03/PBUI-WORKBENCH-CORE-1
```

## Step 20: Stabilization kickoff — reading design doc 04 against the code

Design doc 04 turns the review's seven probes into a program: safe publication (Track A), a React-free installed dependency graph for the core (Track B), and binding/source semantics that TypeScript and Go agree on (Track C). This step is the analysis before the first phase: every invariant in §5 was read against the module it constrains, and the places where the document leaves a choice were decided here so the phases can proceed without re-deriving them.

The code confirms the review. `install` sets state, runs a `for … of` over listeners with no guard, then `onCommit` under a guard, then `links.afterCommit` outside it; the link runtime notifies from inside its own `commit`; `connectDocumentSource` re-enters `core.apply` from a core listener; `preview` plans against the same `ids` generator `execute` uses; `getState()` hands out the live protobuf messages and the index's `Map`s; sync's `bootstrap` creates from the optimistic document and then rebases the outbox that document already contains; `SyncTarget.replaceDocument` returns `unknown` and `adopt` advances `revision` before the target answers. The core imports `@hyperslop-systems/pbui`'s root entry in nine modules for symbols that all live under `src/presentation/links` plus `createPresentationTypeGraph` from `presentation/actions/typeGraph`.

### Prompt Context

**User prompt (verbatim):** "Work on  PBUI-WORKBENCH-CORE-1/design-doc/04-workbench-stabilization-transaction-safety-headless-boundary-and-typescript-go-parity.md  commit at appropriate intervals and keep a detailed diary as you work (using the diary format from the skill)  Print out a brutalist work slip with the plan / different phases for the ticket. then before stsarting a phase, plrint a split about the phase, and print one when the phase is done."

**Assistant interpretation:** Implement design doc 04's phases S0–S7 as a hard cutover, with the same commit/diary/slip discipline as the first program.

**Inferred user intent:** A core whose boundaries are as strong as its planner before Datalab adopts it; no second rewrite.

**Commit (code):** 03fde84 — the other session's docs (design doc 04, review bookkeeping, the Datalab ticket scaffold) committed as the baseline.

### What I did

- Read design doc 04 end to end; read the seven probes and their recorded output; read `createWorkbenchCore.ts`, `links/runtime.ts`, `links/collaborator.ts`, `sources.ts`, `sync/index.ts`, `planner/plan.ts`, `planner/show.ts`, `persistence/index.ts`, `describe.ts`, `apps.ts`, the shell's focus and construction checks, PBUI's root exports and Vite entries, the links barrel, and the Go binding model and validator.
- Printed the plan slip; added tasks mu7f (S0), umfy (S1), 8q05 (S2), dea6 (S3), i6k3 (S4), fcn6 (S5), pul0 (S6), 54ag (S7) beside the three track tasks 2mfw, 4m7u, ba1r.

### Why

- §15's checklist ("before or after the point of no return?", "can this callback call a mutation door?") is only answerable per line of the gateway, so the gateway was read first.

### What worked

- The design's §17 file references are exact; nothing had moved since the review.

### What didn't work

- N/A; analysis only.

### What I learned

- Decisions the document leaves open, taken here:
  - Reentrancy: refuse with code `reentrant_execution` from every mutation door while `phase !== "idle"`; the refusal is NOT reported through `onRejected` (nothing was wrong with the batch). A document source tries to reconcile synchronously and, when refused as reentrant, retries in a microtask — so a stub still exists synchronously after `library.putProgram()` followed by `commands.open("script", …)` in the same tick (the sandbox tools do exactly that), while a reconcile triggered from inside a publication lands after the outer receipt.
  - Observer errors: `onPostCommitError` is replaced by `onObserverError(finding: { stage, revision, error })`; the receipt observer, link subscribers and core subscribers are each attempted once; failures are collected and reported after all attempts.
  - Publication order, per §6.2: receipt (`onCommit`) → link subscribers → core subscribers.
  - Preview ids: a lookahead pool rather than a per-transaction factory. A plan draws from a per-prefix buffer that is refilled from the configured generator; a committed execution consumes what its plan drew, a preview or a refused execution consumes nothing. Preview and the following execute therefore mint the SAME ids, the goldens keep their ids, and `sequentialIds()` keeps working for fixtures.
  - Ownership: clone at every ingress (`initial`, replace, restore, adoption); deep-freeze the document and wrap the index maps read-only when `process.env.NODE_ENV !== "production"` (overridable by an `ownership` option); add `core.snapshot()` (a clone) for untrusted integrations; no clone on `getState()`.
  - No-op detection: after applying a transition's mutations, a document `equals` the current one with an unchanged session is `changed: false` and installs nothing.
  - Sandbox bindings (§9.4): program INPUTS are per view, not per program — two tiles may run one program on two products — so they stay in `AppView.documents`, declared through a typed `additionalBindings: { formats? }` on the manifest with Go `AdditionalBindings *BindingRule`, not through `openBindings`.
  - Source ownership: a stub carries its owner in a reserved body field `$source`; collisions are reported through `onCollision`, never applied.
  - Shell construction: every manifest in the core must have a presentation (a tile with no component cannot render); the shell throws at construction.

### What was tricky to build

- Deciding between §6.7's per-transaction id factory and a pool: the factory restarts deterministic sequences per transaction (colliding ids across transactions unless seeded by revision, which changes every golden's ids). The pool keeps today's ids and still satisfies §5.5.

### What warrants a second pair of eyes

- The "try, then defer on reentrant refusal" source protocol: it is one line more than the document's pure microtask scheduling, in exchange for synchronous stubs outside publication.

### What should be done in the future

- Phases S0–S7 (Steps 21 onward).

### Code review instructions

- This step changes no code; start at design doc 04 §§5–9 with the file list in §17 open.

### Technical details

```text
Phase → task: S0 mu7f, S1 umfy, S2 8q05, S3 dea6, S4 i6k3, S5 fcn6, S6 pul0, S7 54ag
Core's PBUI imports: apps, commands, effects, describe, links/{runtime,snapshot,collaborator,document}, planner/links
Only non-links symbol used: createPresentationTypeGraph (presentation/actions/typeGraph)
```

## Step 21: Phase S0 — the evidence, locked

Phase S0 makes the review's evidence a property of the package rather than of a script under the ticket. The seven probes now live in `workbench-core/src/stabilization.probes.test.ts`, each asserting the behaviour the program requires and marked `it.fails`: the suite is green while the defect stands and turns red the moment a later phase fixes a case, which is the signal to remove the marker. A second test snapshots the export names of the four package entries so every surface change in S1–S6 is a deliberate snapshot update.

The inventory (reference doc "Stabilization inventory") records who consumes each surface the program changes — document sources, `openBindings`, `onPostCommitError`, `SyncTarget.replaceDocument`, `readWorkbenchSnapshot` — in this repo and in the four external products, and the core's dependency graph as it stands.

### Prompt Context

**User prompt (verbatim):** (see Step 20)

**Assistant interpretation:** Design doc 04 Phase S0: every known defect as a reproducible package test; API fixtures; dependency graph; consumer inventory.

**Inferred user intent:** No phase can claim a fix without a test that flips.

**Commit (code):** 8dd9302 — "PBUI-WORKBENCH-CORE-1 S0: review probes as expected-fail package tests, public-surface golden, inventory"

### What I did

- `stabilization.probes.test.ts`: EXPOSED_STATE_MUTATION (assignment throws), PREVIEW_ID_DRIFT (execute mints the previewed id), SUBSCRIBER_ESCAPE (result ok, receipt delivered, other subscriber attempted, `onObserverError` with stage `core-subscriber`), POST_COMMIT_ESCAPE (a throwing LINK subscriber, stage `link-subscriber`), REENTRANT_RECEIPTS (receipts `[3, 4]` with the delete after the close, awaiting a microtask), DROPPED_REPLACE_TITLE, CREATE_BOOTSTRAP_DROP (no drop, phase synced).
- `publicSurface.test.ts` + snapshot.
- The inventory doc; `pnpm why react` in the core (dev-only, used by nothing).

### Why

- §11 S0's exit gate: "every known defect has a reproducible package test".

### What worked

- Vitest's `it.fails` gives exactly the inversion semantics the design asks for without a second assertion style.

### What didn't work

- N/A.

### What I learned

- POST_COMMIT_ESCAPE in the review script replaced `links.afterCommit` with a throwing function; the package test throws from a link RUNTIME subscriber instead, which is the realistic failure and the stage the design names.

### What was tricky to build

- The SUBSCRIBER_ESCAPE probe names an option (`onObserverError`) that does not exist yet; it is passed through a cast so the file typechecks before S1.

### What warrants a second pair of eyes

- REENTRANT_RECEIPTS awaits one microtask after the close; if S3 chooses a longer deferral the test must follow.

### What should be done in the future

- S1.

### Code review instructions

- `packages/workbench-core/src/stabilization.probes.test.ts`; run `npx vitest run src/stabilization.probes.test.ts` (expect "7 expected fail").

### Technical details

- Surface snapshot: `packages/workbench-core/src/__snapshots__/publicSurface.test.ts.snap`.

## Step 22: Phase S1 — the safe observer primitive and the reentrancy rule

Phase S1 replaced the core's `for (const l of listeners) l()` with one primitive, `attemptAll`, and made observer failures data. The receipt hook, the link runtime's subscribers and the core's subscribers are each attempted exactly once per publication; a throw is recorded as `{ stage, revision, error }` and the collection is handed to `onObserverError` after all attempts, through a sink that cannot itself break the publication. The mutation doors carry a phase — idle, preparing, publishing — and refuse with `reentrant_execution` while not idle; `try/finally` guarantees the phase cannot wedge on an unexpected exception.

The document source is the one integration that mutated from a subscriber. It now tries to reconcile synchronously and, when refused as reentrant, retries once in a microtask; a resource added and bound in the same tick still finds its stub synchronously, while a delete triggered by a close lands as the next transaction, after the receipt that made it legal.

### Prompt Context

**User prompt (verbatim):** (see Step 20)

**Assistant interpretation:** Design doc 04 Phase S1: attempt-all publication, observer errors as data, phase and reentrancy guard, applied to the core and the link runtime.

**Inferred user intent:** No exception past the point of no return; no observer suppressed by another; no nested transaction.

**Commit (code):** 740ef57 — "PBUI-WORKBENCH-CORE-1 S1+S2: safe publication, reentrancy refusal, staged link runtime" (S1 and S2 share the commit; see Step 23 for why)

### What I did

- `src/publication.ts`: `ObserverStage`, `WorkbenchObserverError`, `attemptAll` (snapshots the observer set first), `reportFailures`.
- `createWorkbenchCore.ts`: `phase`; `REENTRANT` refusal on `execute`, `apply`, `replace` (hence `restore`, `reset`); `onObserverError` replaces `onPostCommitError`; `install` publishes receipt → links → core listeners under `attemptAll` and reports afterwards.
- `links/runtime.ts`: runtime-only writes (emit, setContext, setClass) publish under `attemptAll` with the runtime's own sink (`createLinkRuntime({ onObserverError })`).
- `sources.ts`: try-then-defer; `disposed` flag so a disconnected source never applies from a stale microtask.
- Tests: three publication cases in `createWorkbenchCore.test.ts` (nested execute refused with the outer receipt alone; apply and replace refused during publication; attempt order and reporting); `sources.test.ts` awaits the microtask; probes SUBSCRIBER_ESCAPE and REENTRANT_RECEIPTS un-failed; surface snapshot updated (`attemptAll`, `reportFailures`, the observer types).
- README: "Publication order and observer failures".

### Why

- §5.1–5.3 and Decision B.

### What worked

- The REENTRANT_RECEIPTS probe flipped with the S1 guard plus the source's retry alone: the delete is refused inside the close's publication and lands one microtask later as revision 4 after revision 3.

### What didn't work

- The first patch script matched an old comment inside `install` and aborted; the rewrite switched to index-based block replacement between stable markers.

### What I learned

- "Try, then defer on reentrant refusal" gives synchronous stubs outside publication for free, which the sandbox tools rely on (`putProgram` then `commands.open` in one tick).

### What was tricky to build

- The phase must be restored on every early return of `execute`/`apply` (refusals before install) but NOT reset by them after `install` already set it back — hence `if (phase === "preparing") phase = "idle"` in the `finally`.

### What warrants a second pair of eyes

- `preview` is allowed during publication (it is read-only); a preview from a subscriber plans against the newly installed state, which is the state the subscriber sees.

### What should be done in the future

- Shell and placement stores still notify with a bare loop (§11 S1: "shell/placement stores may follow").

### Code review instructions

- `packages/workbench-core/src/publication.ts`, then `install` and the three doors in `createWorkbenchCore.ts`; `npx vitest run src/createWorkbenchCore.test.ts src/stabilization.probes.test.ts`.

### Technical details

- Refusal payloads: execute `{ ok: false, code: "reentrant_execution", because }`; apply adds `diagnostics: []`; replace `{ ok: false, diagnostics: [reentrant_execution] }`. None is reported through `onRejected`.

## Step 23: Phase S2 — the link runtime staged as a value

Phase S2 made the link runtime's post-commit effects a pure function. `reduceRuntimeEffects(state, effects)` and `forgetViewValues(state, viewId)` return the next runtime state (the same object when nothing changes); the collaborator's `stage(effects)` folds a transition's effects into a value, `stageReplace(doc)` does the same for a wholesale replacement, and the core computes that value before the point of no return, installs it beside the document without notifying, and publishes both afterwards. `afterCommit`, `afterReplace`, `runtime.apply` and `runtime.forgetView` are gone.

S2 was implemented in the same pass as S1 because the POST_COMMIT_ESCAPE probe cannot pass without it: with `afterCommit` notifying from inside the runtime, a throwing link subscriber was reported through the runtime's own sink, not the core's, and the design's publication order (receipt → link observers → core observers) is only possible once the runtime's notification belongs to the core's publish step.

### Prompt Context

**User prompt (verbatim):** (see Step 20)

**Assistant interpretation:** Design doc 04 Phase S2: pure link-runtime reducer, stage core and link values before installation, publish after both are current, replacement through the same path.

**Inferred user intent:** A mixed core/link selector can never observe a new durable link program with stale runtime values.

**Commit (code):** 740ef57 (shared with Step 22)

### What I did

- `links/runtime.ts`: `reduceRuntimeEffects`, `forgetViewValues` (exported); `LinkRuntime.install(next)` (no notify) and `publish(revision, failures)`; `apply`/`forgetView` removed.
- `links/collaborator.ts`: `stage`, `stageReplace`, `install`, `publish` replace `afterCommit`/`afterReplace`.
- `createWorkbenchCore.ts`: `install` takes `effects` or a pre-staged `linkState`, stages before assigning `state`, installs both, publishes in order.
- POST_COMMIT_ESCAPE un-failed (the probe now emits a value on the closed view first, so the close carries a forget effect).

### Why

- §6.6 and the S2 exit gate.

### What worked

- Shell (114) and chat (241) suites pass unchanged: nothing outside the core called the removed methods.

### What didn't work

- The block rewrite of the runtime dropped the `CreateLinkRuntimeOptions` interface added minutes earlier; restored.

### What I learned

- A close whose view holds no runtime value stages nothing and publishes no link notification; observers of the runtime are told only when its state changed, which keeps `useSyncExternalStore` consumers quiet.

### What was tricky to build

- Deciding who publishes the runtime: a runtime-only write (a tile emitting) has no core transaction around it, so the runtime keeps a self-publishing `commit` with its own sink; a core transaction publishes the runtime through `links.publish` into the core's failure list.

### What warrants a second pair of eyes

- `stage` runs during prepare, so a reducer exception surfaces as a thrown error from `execute` with nothing installed — correct, but it is the one place a throw is still the answer.

### What should be done in the future

- N/A.

### Code review instructions

- `packages/workbench-core/src/links/runtime.ts` (the two reducers, `install`/`publish`), `collaborator.ts` (`stage`), then `install` in the core.

### Technical details

- Publication order: `onCommit(receipt)` → `links.publish` → core listeners → `reportFailures`.

## Step 24: Phase S3 — sources after publication, sync that waits for an answer

Phase S3 finished the ordering half of Track A. The document source's scheduling had landed with S1 (try synchronously, defer once on a reentrant refusal); this step pinned its three behaviours — a burst of signals reconciles once, a signal from inside a publication reconciles after it in one transaction, a disconnected source applies nothing from a stale microtask — and then rewrote the four sync paths design doc 04 §7 names.

Bootstrap no longer rebases the outbox over the document it built: the covered entries are set aside, the row is created from a clone of the local document, and the creation acknowledges them; a failed creation puts them back ahead of anything queued meanwhile. Adoption is acknowledged — `revision`, the outbox and the phase advance only after the target accepted the candidate, and a refusal is the new phase `incompatible`, which is neither offline nor retryable. Rebase consults the target's catalog through `validateDocument` before keeping an entry. The 422 isolation loop threads the batches still to be sent through every adoption as an overlay, so a change that is still pending never disappears from the screen between two isolated requests.

### Prompt Context

**User prompt (verbatim):** (see Step 20)

**Assistant interpretation:** Design doc 04 Phase S3: schedule and coalesce source reconciliation; fix the missing-row bootstrap; require target acknowledgement; overlay remaining in-flight entries during isolation; pin the receipt/outbox order.

**Inferred user intent:** The close-bound-source scenario reaches a Go-like server in valid order, and a client never claims a revision the core did not install.

**Commit (code):** 929c9e1 — "PBUI-WORKBENCH-CORE-1 S3: source scheduling tests, sync bootstrap, acknowledged adoption, isolation overlay"

### What I did

- `sync/index.ts`: `adopt(result, extra, afterConflict)` returns `{ ok, keptExtra }`; `SyncTarget.replaceDocument` must return `{ ok } | { ok: false, diagnostics }` and may offer `validateDocument`; `SyncPhase` gains `incompatible`; `SyncOptions.onIncompatible`; `bootstrap` per §7.1; `send(batches, remaining)` returns the still-applicable remaining entries; the 409 path re-queues the refused batches before the conflict rebase; `pump` stops on `incompatible`.
- `createWorkbenchCore.ts`: `validateDocument(document): ReplaceResult`.
- Tests: five sync cases (create acknowledges covered entries; work queued during create overlaid and sent once; incompatible server document; isolation never rolls back; rebased-and-accepted title); three source cases; CREATE_BOOTSTRAP_DROP un-failed.

### Why

- §7.1–7.4, §12.3–12.4, and the S3 exit gate.

### What worked

- The core already returned `ReplaceResult` from `replaceDocument`, so tightening `SyncTarget` cost the in-repo consumers nothing (chat demo, sandbox tests typecheck unchanged).

### What didn't work

- The "work queued during create" test first staged the change while `client.get()` was pending — before the snapshot was captured — so the creation legitimately covered it and nothing was sent; the second version waits for `create` to start. Its assertion then counted mutations (2 for a duplicate) where I had written batches (1). Traced by appending to a file, since the package's vitest config silences console output.

### What I learned

- "Covered" is decided by WHEN the snapshot is cloned, not by when the row is missing: everything committed before the clone is in the created document, everything after is an overlay.

### What was tricky to build

- The isolation loop's overlay bookkeeping: `send` returns the remaining entries that still apply after any adoption it caused, and the loop splits them back into "not yet sent in this loop" and "held by the outer caller" by identity.

### What warrants a second pair of eyes

- On a 409 the refused batches are put back in front of the outbox BEFORE `adopt(fresh, [], true)` rebases; a destructive one among them is reported as a conflict, as before, but the order of `onDropped` calls relative to the replacement changed (drop first, then replace).
- `incompatible` halts the pump; recovery requires a new `attach` or a catalog change and is not automatic.

### What should be done in the future

- rag-ttc's own `SyncTarget` (`apps/workbench/web/src/sync.ts`) must return the core's `ReplaceResult` — S7 verifies.

### Code review instructions

- `packages/workbench-core/src/sync/index.ts` (`adopt`, `bootstrap`, `send`), the five new cases at the end of `sync.test.ts`; `npx vitest run src/sync src/sources.test.ts src/stabilization.probes.test.ts`.

### Technical details

- Remaining expected-fail probes after S3: EXPOSED_STATE_MUTATION, PREVIEW_ID_DRIFT, DROPPED_REPLACE_TITLE (all S4).

## Step 25: Phase S4 — the core owns its state, and preview stops spending ids

Phase S4 closed Track A. The core clones every document at its doors — `initial`, replacement (so restore, reset and adoption) — and, outside production, deep-freezes what `getState()` hands out, so a caller that writes on the document or the index fails at the assignment rather than corrupting state under an unchanged revision. `snapshot()` is the door for an integration that wants a document of its own. Preview is pure with respect to execution: plans draw ids from a lookahead pool and only a committed plan consumes what it drew, so `execute` after `preview` mints exactly the ids the preview reported, deterministic generators keep their sequence, and the goldens keep their ids. A transition that reproduces the current document with an unchanged session is `changed: false` and reaches neither revision nor outbox.

The five edge fixes from the review landed alongside: a same-app replacement with a title keeps the title (and keeps its bindings), the description reads one captured index throughout, a refusal inside an expanded link command reports the caller's command index, the shell requires a presentation for every manifest at construction, and `focusPlacement` never falls back to the global document. All seven review probes now assert the required behaviour with no `fails` marker.

### Prompt Context

**User prompt (verbatim):** (see Step 20)

**Assistant interpretation:** Design doc 04 Phase S4: clone at ingress, development freeze, safe snapshot, a non-consuming preview allocator, and the §6.8 edge fixes; exit gate: all seven probes inverted and green.

**Inferred user intent:** No public reference can mutate internal state; "what would happen" and "what happened" agree.

**Commit (code):** 2833785 — "PBUI-WORKBENCH-CORE-1 S4: owned state, non-consuming preview ids, semantic edge fixes"

### What I did

- `src/ownership.ts`: `defaultOwnership` (freeze unless `NODE_ENV=production`), `own` (clone), `deepFreeze`, `readonlyIndex` (the index's maps refuse `set`/`delete`/`clear` with a message naming the gateway).
- `src/ids.ts`: `createIdPool(generator)` with `fork()` → `{ ids, commit }`; per-prefix lookahead buffers.
- `createWorkbenchCore.ts`: `ownership` option; `snapshot()`; ingress clone in the constructor and `replace`; `owned()` at every install; `planned()` forks the pool and `execute` commits it only after a successful prepare; `isNoOp` (protobuf `equals` on the document plus a session comparison) in `execute` and `apply`.
- `planner/show.ts`: same-app replace keeps bindings and applies the title; `planner/plan.ts`: expansion refusals carry the top-level index and command; `describe.ts`: `describeTile(index, …)` from the captured state.
- Shell: manifest-without-presentation throws at construction; `focusPlacement` searches `rootElement` only.
- Tests: `ownership.test.ts` (initial and replacement tamper-proof, freeze refuses writes, snapshot is a clone, same revision same document, two no-op cases, refused execution consumes no ids); `createWorkbenchShell.test.ts` (both completeness directions; focus with no root); three probes un-failed; the reset round-trip test now compares by value.
- README "Owned state"; MIGRATION.md "Stabilization" section covering S1–S4's surface changes.

### Why

- §5.4, §5.5, §6.5, §6.7, §6.8; Decision C.

### What worked

- `applyMutations` already clones the whole document before touching it, so a frozen input is safe through every planner step and the applier — no consumer broke on the freeze (workbench 116, sandbox 224, ecommerce 35, plotscript 32, chat 241).

### What didn't work

- The reset round-trip test asserted `toBe` identity between the factory's document and the installed one; identity is exactly what Decision C gives up. Changed to `toEqual`.
- A first plotscript run failed in a typing-debounce test and passed on rerun; timing, not the freeze.

### What I learned

- Freezing costs one traversal per install in development; at 12 tiles it is invisible against the index build.

### What was tricky to build

- Deciding what `commit()` of the id pool means for a refused execution: the plan drew ids, prepare refused the batch, nothing was installed — so nothing is consumed, and the next plan reads the same ids. The pool is consumed in exactly one place, after `prepare` succeeded and before `install`.

### What warrants a second pair of eyes

- `isNoOp` runs `equals` over the whole document per command; cheap at product sizes, but a document with thousands of payloads would pay for it on every keystroke that goes through `apply`.
- The expanded-refusal index override is verified by reading, not by a test: constructing a refusal INSIDE a show expansion needs geometry small enough to refuse the spawn split, and I did not want a test that depends on the chooser's ranking. Worth a golden when the link goldens are next touched.

### What should be done in the future

- Track B (S5) and Track C (S6).

### Code review instructions

- `ownership.ts`, `ids.ts`, then the four touched sites in `createWorkbenchCore.ts` (`owned`, `planned`, `isNoOp`, `snapshot`); `npx vitest run src/ownership.test.ts src/stabilization.probes.test.ts` (7 passed, 0 expected fail).

### Technical details

- Freeze mode default: `process.env.NODE_ENV !== "production"`, read defensively (no `process` ⇒ trust).

## Step 26: Phase S5 — a pure PBUI entry, and a boundary the build proves

Phase S5 closed Track B. The core's source never imported React, but its package graph did: the nine modules that need the link kernel imported `@hyperslop-systems/pbui`'s root entry, whose runtime bundle carries React and whose `peerDependencies` name it, so a package manager installing the core alone would install React. Two changes fix the graph. PBUI gains `./link-kernel` — `src/link-kernel.ts` re-exports the links barrel, `createPresentationTypeGraph` and the runtime id types, nothing that renders — and declares React and react-dom as optional peers, which npm and pnpm then do not auto-install for a consumer that does not use them. The core imports only that entry; its fence test now forbids the root entry as it forbids `react`; react and react-dom leave its devDependencies.

The claim is then proven rather than asserted. `pnpm boundary` packs pbui, workbench-protocol and workbench-core, installs the core alone into an empty project with scripts disabled, asserts React is absent from `node_modules`, imports the core, plans a command, and scans the built output's import specifiers; `packageGraph.test.ts` pins the declarations by dependency kind so a stray `react` in any of the three manifests fails a unit test.

### Prompt Context

**User prompt (verbatim):** (see Step 20)

**Assistant interpretation:** Design doc 04 Phase S5: add the link-kernel entry, repoint the core, remove React from the core's requirements, add the packed no-React consumer and built-import scan, update package docs.

**Inferred user intent:** "No React, no DOM" as a property of the installed package, not of a regex.

**Commit (code):** c3befc7 — "PBUI-WORKBENCH-CORE-1 S5: pure PBUI link-kernel entry; core imports it; packed no-React boundary check"

### What I did

- Root: `src/link-kernel.ts`; `package.json` exports `./link-kernel` and `peerDependenciesMeta` (react, react-dom optional); `vite.config.ts` third entry. The built `dist/link-kernel.js` reaches one shared chunk (`resolveShow-*.js`) and no external module.
- Core: nine imports repointed; `fence.test.ts` forbids the root entry; devDependencies without react; `scripts/check-boundary.mjs` + `pnpm boundary`; `packageGraph.test.ts`; README "Package boundary".
- Verified: root typecheck and its 554 tests; core 219 (the slate perf guard is flaky under a full parallel run and green alone); `pnpm boundary` → "installed without React", "imported and planned: split side by side".

### Why

- §5.7, §8.1–8.5, Decision D.

### What worked

- Every symbol the core used was already exported by the links barrel except `createPresentationTypeGraph`; the links directory imports only `actions/ids` and `actions/typeGraph` from outside itself, both pure — so the entry is a re-export file, not a refactor.

### What didn't work

- N/A (the boundary script worked on the first run; it needs registry access for `@bufbuild/protobuf`).

### What I learned

- With npm ≥ 7 and pnpm, a dependency's NON-optional peer is auto-installed, so the design's "React absent from the dependency graph" is only achievable by declaring PBUI's React peers optional. That is also the truthful declaration: the root entry needs React, the link-kernel entry does not.

### What was tricky to build

- The built-import scan must allow `@hyperslop-systems/pbui/link-kernel` and forbid every other `@hyperslop-systems/pbui` specifier, including the bare root; the regex in the script does exactly that.

### What warrants a second pair of eyes

- Making React an optional peer of PBUI changes what a product installing the ROOT entry gets: a product that forgot to depend on React itself now gets a runtime error instead of an auto-installed React. Every product in this repo and the four external ones declare React.

### What should be done in the future

- Track C (S6).

### Code review instructions

- `src/link-kernel.ts`, the root `package.json` diff, `packages/workbench-core/scripts/check-boundary.mjs`; run `pnpm build` at the root, `pnpm --filter @hyperslop-systems/workbench-core build boundary`.

### Technical details

- Core's built externals after S5: `@bufbuild/protobuf`, `@hyperslop-systems/pbui/link-kernel`, `@hyperslop-systems/workbench-protocol`, `@hyperslop-systems/workbench-protocol/client`.

## Step 27: Phase S6 — bindings and sources TypeScript and Go agree on

Phase S6 closed Track C. The manifest now separates the four questions design doc 04 §9.1 lists. Which binding names are legal, which are required and which formats may fill them are `bindings: Record<name, { required, formats?, role }>`; whether the launcher may create an unbound view is `launch`; an application whose inputs are named by what it binds says so with the typed `additionalBindings: { formats? }`. `openBindings` is gone. A `documentSlot` port still implies a binding, so every existing manifest keeps its meaning, and the launcher offers applications by launch policy — agentlogic's optional transcript context can now be `{ required: false, role: "context" }` with `launch: "unbound"` and stay in the launcher.

Go carries the same facts: `BindingRule.Formats` and `ApplicationDescriptor.AdditionalBindings`, validated in the same order as the core (legality, existence, format, then requiredness) with the same codes and paths, which the shared fixtures under `contracts/workbench/v1` now assert from both sides. Document sources gained an identity — every stub records its writer in `$source` — with the collision and ownership rules of §9.6, and `readWorkbenchSnapshot` hydrates a stored layout with its sources before the catalog judges it, so a layout from before a source existed is repaired instead of replaced by the default.

### Prompt Context

**User prompt (verbatim):** (see Step 20)

**Assistant interpretation:** Design doc 04 Phase S6: binding rules and launch policy, manifests migrated, `openBindings` replaced by a typed rule, source identity/ownership/update, persistence hydration, Go descriptor and validator, shared fixtures.

**Inferred user intent:** TypeScript and Go accept the same document for the same reason, and a product cannot type its way past a validator.

**Commit (code):** 7d76033 — "PBUI-WORKBENCH-CORE-1 S6: binding rules and launch policy, source ownership, hydration, Go parity fixtures"

### What I did

- `apps.ts`: `WorkbenchBindingRule`, `WorkbenchAdditionalBindings`, `LaunchPolicy`; `defineAppManifest` merges port-derived and explicit rules and derives `launch`; `bindingNames` replaces `documentSlots`; `isDocBound` means "has a primary binding".
- `validation.ts`: per binding — `unknown_binding` (unless additional), `unknown_document`, `invalid_binding_format` — then `required_binding` at `views["v"].documents`; `binding.ts` honours `additionalBindings`; `describe.ts` reports `launch` and defines `docBound` as "must be opened from something".
- `sources.ts`: `id`, `update`, `owns`, `SOURCE_OWNER_FIELD`, collisions reported through `onCollision`; `persistence`: `sources` option, structural parse → hydrate → catalog validation.
- Go: `model.go` (`Formats`, `AdditionalBindings`, `acceptsFormat`), `validate.go` (the same order, `invalid_binding_format`), `binding_fixtures_test.go` (loads the shared catalogs; an accept-anything payload validator, since the fixtures assert binding rules).
- Fixtures: `packages/workbench-core/scripts/generate-binding-fixtures.ts` writes 3 catalogs, 9 valid and 6 invalid cases; `bindingFixtures.test.ts` asserts them from TypeScript.
- Consumers: the shell's launcher rows use `launch`; the sandbox's `script` declares `program: { formats: ["sandbox.program"] }`, `additionalBindings: {}`, `launch: "requires-bindings"`, and its library source is `sandbox.programs` with `replace-body` (a renamed program renames its stub); pbui-chat's conversation source is `chat.conversations`; the demo's world sources carry ids and the demo hydrates its stored layout with them; the agent tools use `bindingNames`.
- Tests: ownership (collision, other owner, replace-body vs identity-only, legacy unowned stub adopted), hydration, describe expectations, surface and describe goldens; the slate perf guard's line raised to what a real regression would cross rather than what a parallel run reaches.
- README "Bindings and launch policy" and the reworked "Documents for what tiles bind"; MIGRATION.md.

### Why

- §9.1–9.9, §12.5, Decisions E and F.

### What worked

- Port-derived rules made the manifest change invisible to every product that only declares `documentSlotPort`s: sandbox 224, chat 241, ecommerce 35, plotscript 32 passed without a manifest edit.
- Go's `testCatalog` and error type were reusable as-is; the parity test is forty lines of loading.

### What didn't work

- The first Go run failed every valid fixture with `unsupported graphic document`: the package's test payload validator accepts one format; the fixture test now supplies an accept-anything validator, since it asserts binding rules, not payloads.
- `documentSourceMutations` changed shape (`{ mutations, collisions }`) and two call sites in tests asserted the old array.

### What I learned

- `docBound` in the agent description had two meanings — "has a binding" and "cannot be launched empty" — which coincided until optional context bindings existed. It now means the second, and `launch` is reported beside it.

### What was tricky to build

- The sandbox decision (§9.4): program inputs are per VIEW (one program on two products in two tiles), so they cannot live in the program document; `additionalBindings: {}` (formats unconstrained, since an input may be any product document) is the honest declaration, and its Go counterpart `AdditionalBindings: &BindingRule{}` means the same.
- Ownership for stubs written before this step: a stub without `$source` is treated as owned by whichever source claims its format, so an existing persisted layout is adopted rather than orphaned.

### What warrants a second pair of eyes

- Go ranges over `view.Documents` in map order; a document with two violations in one view reports either first. The fixtures carry one violation each; the TypeScript side reports all and compares the first.
- `required: true` was NOT applied to the sandbox's program binding (an unbound script tile is legal and shows its empty state); the fixture catalog's `sku` demonstrates the required path instead.

### What should be done in the future

- S7: re-verify the four external consumers (agentlogic's transcript to a context binding; hyperblog's sources need ids; rag-ttc's sync target signature).

### Code review instructions

- `apps.ts` (`defineAppManifest`), `validation.ts` (the binding loop), `pkg/workbench/validate.go` (the same loop), then the fixtures; run `npx vitest run src/bindingFixtures.test.ts` and `GOWORK=off go test ./pkg/workbench/ -run TestBindingFixtures -v`.

### Technical details

- Fixture expectation shape: `{ name, catalog, document: <protobuf JSON>, expected: { ok } | { ok: false, code, path } }`.
- Stub body after S6: `{ ...body, "$source": "<source id>" }`.

## Step 28: Phase S7 — every product verified against the stabilized core

Phase S7 ran the whole workspace and the four external products against S1–S6, and closed the program. In this repo: 13 typechecks, 1,508 tests across 10 suites (protocol 40, pbui 554, core 241, shell 116, ecommerce 35, editor 12, sandbox 224, chat 241, plotscript 32, datalab 13), 12 builds, 5 Storybook builds, `make protocol-check` clean, `pnpm boundary` (packed core installs and plans without React), and the Go suite plus lint through the pre-commit hook. A browser smoke of the shop demo restored the layout split during the Phase 9 smoke under the stabilized core, reset through the replacement path, reloaded, and logged nothing.

The four external products were re-verified in parallel by agents from one brief: agentlogic 8ce82b5 (the transcript binding is finally what it is — optional context, `launch: "unbound"`; the launcher pane is `launch: "hidden"`), hyperblog 38f53ed (source ids, hydrated snapshot, `launch: "unbound"` on the slotted tiles), turboproof 25ef8eb (`launch` policies, the `incompatible` phase in its chip and runtime, a sync test that split into probe-time refusal and true 422 isolation), rag-ttc ea2bc79 (`adopt` returns the core's `ReplaceResult`; the ten bindings its Go host always required are now `required: true` in TypeScript, and the parity test compares the flag). All four typecheck, test and build; none is pushed.

### Prompt Context

**User prompt (verbatim):** (see Step 20)

**Assistant interpretation:** Design doc 04 Phase S7: run the package, consumer, Go and browser checks; fix what they find.

**Inferred user intent:** The stabilization is done when every product that depends on the core still works and the completion gates in §16 hold.

**Commit (code):** eabf8e1 — versions (pbui 0.12.0, workbench-core 0.2.0, pbui-workbench 0.6.0); 306a3c6 — the migration note. Consumer commits as above.

### What I did

- Whole-workspace audit in the background while the agents ran; the browser smoke; the version bumps; the S7 brief for the agents (the MIGRATION "Stabilization" section plus the concrete list of surface changes).
- Added the launch-policy default to MIGRATION.md after two products hit it.

### Why

- §11 S7 and the completion gates of §16.

### What worked

- The brief's "what changed, concretely" list let each agent finish in one pass; no agent found anything missing in pbui.

### What didn't work

- Nothing in this repo. In the consumers: turboproof's first `pnpm install --force` served a stale extraction for a same-named tarball (a sibling agent had packed to the same path); fixed by clearing the store entry.

### What I learned

- The one migration hazard of Track C is the launch-policy default: a `documentSlotPort` now implies `requires-bindings`, and products whose slot is filled by `followTheCrowd` (hyperblog, turboproof) must say `launch: "unbound"` or lose their tiles from the launcher. Two of four products needed it; the note is in MIGRATION.md.
- Three external Go hosts pin the pbui Go module by pseudo-version, so `BindingRule.Formats` reaches them only after the module is published and `go.mod` bumped; each agent verified against the local module through a scratch `go.work` and left the pinned build untouched.
- rag-ttc's Go host had required bindings the TypeScript manifests did not declare; the parity the fixtures enforce in this repo surfaced the same gap in a product the moment the flag existed.

### What was tricky to build

- Nothing new; the phase is verification.

### What warrants a second pair of eyes

- The publish order is now pbui 0.12.0 → workbench-protocol 0.5.0 → workbench-core 0.2.0 → pbui-workbench 0.6.0, and the Go module afterwards; agentlogic and turboproof commit lockfiles and embedded bundles only after the npm publish, and all three Go hosts bump `go.mod` after the module push.
- The slate perf guard's line moved from 50ms to 1500ms (Step 27); the number it guards against is an exponential, which is seconds.

### What should be done in the future

- Publish (npm, then Go); push the four consumer branches; declare `formats` in the consumer catalogs once their `go.mod` moves.
- The design's §16 gate "all first-party consumers and browser smokes pass" is met for the shop demo smoke; a chat-demo smoke needs the Go chat server and was not run.

### Code review instructions

- Diary Steps 20–28 in order; `git log 03fde84..HEAD` in pbui; the four consumer commits.
- Validate: `pnpm -r typecheck && pnpm -r test && pnpm -r build && make protocol-check && pnpm --filter @hyperslop-systems/workbench-core boundary && GOWORK=off go test ./pkg/...`.

### Technical details

- §16 completion gates: all seventeen hold in this repo; "TypeScript and Go pass shared fixtures" holds for this repo's Go module, and for the external hosts once they take the module.
