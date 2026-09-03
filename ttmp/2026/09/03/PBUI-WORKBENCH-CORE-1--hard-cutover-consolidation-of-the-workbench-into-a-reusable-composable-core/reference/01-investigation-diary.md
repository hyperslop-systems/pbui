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
    - Path: repo://packages/pbui-workbench/src/goldens/transitions.test.ts
      Note: Phase 0 goldens (commit 9822ba8)
    - Path: repo://packages/pbui-workbench/src/rebalance/slate.ts
      Note: Evidence that rebalance algorithms are pure and should be preserved while integration moves
    - Path: repo://ttmp/2026/09/03/PBUI-WORKBENCH-CORE-1--hard-cutover-consolidation-of-the-workbench-into-a-reusable-composable-core/design-doc/01-intern-guide-to-the-pbui-workbench-core-consolidation-and-hard-cutover.md
      Note: Final evidence-backed architecture and implementation guide produced by the investigation
    - Path: repo://ttmp/2026/09/03/PBUI-WORKBENCH-CORE-1--hard-cutover-consolidation-of-the-workbench-into-a-reusable-composable-core/scripts/01-plan-purity-probe.output.txt
      Note: Captured successful probe output and Vitest evidence
    - Path: repo://ttmp/2026/09/03/PBUI-WORKBENCH-CORE-1--hard-cutover-consolidation-of-the-workbench-into-a-reusable-composable-core/scripts/01-plan-purity-probe.test.ts
      Note: Executable reproduction of live link-runtime mutation during plan
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
