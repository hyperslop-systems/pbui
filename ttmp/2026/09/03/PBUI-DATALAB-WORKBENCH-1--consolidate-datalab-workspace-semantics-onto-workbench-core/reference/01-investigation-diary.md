---
Title: Investigation diary
Ticket: PBUI-DATALAB-WORKBENCH-1
Status: review
Topics:
    - pbui
    - datalab
    - frontend
    - architecture
    - refactoring
    - onboarding
DocType: reference
Intent: long-term
Owners: []
RelatedFiles:
    - Path: repo://packages/datalab-ui/src/appkit/useRemoteWorkbench.ts
      Note: Current remote projection policy inspected
    - Path: repo://packages/datalab-ui/src/components/organisms/LauncherDialog/LauncherDialog.tsx
      Note: Product-specific launcher behavior inspected
    - Path: repo://packages/datalab-ui/src/remote/codec.ts
      Note: Current local-to-protocol conversion inspected
    - Path: repo://packages/datalab-ui/src/store/layout.ts
      Note: Primary duplicate spatial implementation inspected
    - Path: repo://packages/datalab-ui/test/helpers/layoutShape.ts
      Note: Id-free shape describer behind the seed golden (commit bc3f027)
    - Path: repo://packages/datalab-ui/test/layers.test.ts
      Note: Machine-enforced Datalab dependency graph
    - Path: repo://packages/datalab-ui/test/migration-goldens.test.ts
      Note: Phase 0 golden test (commit bc3f027)
    - Path: repo://ttmp/2026/09/03/PBUI-DATALAB-WORKBENCH-1--consolidate-datalab-workspace-semantics-onto-workbench-core/design-doc/01-intern-guide-to-consolidating-datalab-onto-workbench-core.md
      Note: Design produced by Step 1
ExternalSources: []
Summary: Chronological evidence, decisions, commands, risks, and review guidance for consolidating Datalab UI's duplicate spatial model onto workbench-core.
LastUpdated: 2026-09-03T17:45:00-04:00
WhatFor: Preserve how the Datalab Workbench migration design was derived and make implementation continuation reproducible.
WhenToUse: Read before implementing or reviewing PBUI-DATALAB-WORKBENCH-1.
---



# Diary

## Goal

Capture the evidence and implementation reasoning for replacing Datalab’s duplicate workspace/view/placement/tree system with Workbench core while retaining Stage and analytical product semantics.

## Step 1: Map Datalab’s duplicate spatial model and design the cutover

This step created the dedicated migration ticket and traced Datalab’s layout state from its local tree algebra and 1,162-line Redux slice through tile rendering, Stage navigation, launcher resolution, portable bundles, local persistence, and remote Workbench projection. The design distinguishes duplicated Workbench semantics from Datalab-specific product behavior rather than treating every file under `store/layout.ts` as removable.

The chosen target makes Workbench core the spatial source of truth, keeps Stage metadata in Datalab, keeps full `GraphicDocument`s in the analytical world, and retains a product-specific remote projection for the work stage. The migration is additive through adapters and goldens before one coordinated reducer/renderer cutover; it explicitly rejects a temporary protobuf-shaped Redux layout.

### Prompt Context

**User prompt (verbatim):** "ok, create a new design doc in this ticket to address 1-3. Then a new docmgr ticket + design doc for 4. Create  a detailed analysis / design / implementation guide that is for a new intern, explaining all the parts of the system needed to understand what it is, with prose paragraphs and bullet point sand pseudocode and diagrams and api references and file references. It should be very clear and technical. Store in the ticket and the nupload to remarkable.

Then which of 5-9 do you think we should already flesh out, or should we give it a new stab sometime in the future?

[REMINDER] Output a <summary>...</summary> block at the VERY END of your response. This is mandatory."

**Assistant interpretation:** Turn Workbench priorities 1–3 into a stabilization design in the existing ticket; create a separate Datalab adoption ticket and intern-ready migration design for priority 4; validate and deliver both; then advise which broader priorities deserve design work now.

**Inferred user intent:** Preserve momentum from the Workbench cleanup while separating foundation stabilization from the much larger Datalab migration and avoiding premature tickets for speculative cross-repository abstractions.

### What I did

- Created ticket `PBUI-DATALAB-WORKBENCH-1` with design, diary, and nine implementation tasks.
- Read the prior PBUI-WORKBENCH-2 Datalab postmortem and DATALAB-VIEW-001 inventory.
- Read Datalab’s layout tree, layout/stage/world/remote stores, renderer, Stage/workspace chrome, launcher, app registry/scoping, persistence, remote codec/controller, and enforced layer graph.
- Measured the migration surface: 37 files import layout, 52 production `layoutActions` uses, 26 files name the local Node type, and no current workbench-core imports.
- Ran Datalab typecheck and all 554 tests successfully.
- Authored the intern migration guide with ownership tables, diagrams, APIs, command mapping, Stage model, source/remote/persistence design, decisions, phases, deletion list, tests, and completion gates.

### Why

- Datalab is the largest remaining duplicate implementation of the Workbench spatial language.
- Stage, analytical world, portable graph bundles, and work-stage-only remote ownership are real product semantics and must not be erased during consolidation.
- Earlier evidence showed a type-first conversion rewrites code that the shell cutover immediately deletes.

### What worked

- Existing architecture boundaries are well documented and the layer graph is machine-enforced.
- Datalab’s local model already separates logical views from placements, closely matching Workbench protocol semantics.
- The current test suite provides a strong 554-test baseline.
- The prior postmortem supplies measured evidence and a useful decision: keep analytical documents separate during the first spatial migration.
- `docmgr doctor` passed and `Datalab Workbench Core Consolidation.pdf` uploaded and appeared in `/ai/2026/09/03/PBUI-DATALAB-WORKBENCH-1` after a successful dry run.

### What didn't work

- N/A in this design step. The historical direct Node substitution produced 308 errors across 25 files; this design does not repeat it.

### What I learned

- `remote/codec.ts` is partly a type codec and partly hidden synchronization policy. Only the type-conversion half disappears.
- The Datalab launcher should initially be adapted, not replaced; it has Stage/workspace query semantics absent from the generic shell.
- Current `currentSpaceId` is mirrored between layout and Stage; core session can become canonical and remove the mirror.
- Pinned/audience/app-scope rules belong in a Datalab controller, not Workbench validation.
- Full GraphicDocuments can remain in world while source-owned identity payloads satisfy core bindings and remote projection joins full payloads.

### What was tricky to build

- The document ownership decision controls persistence and remote design. Putting full GraphicDocuments in Workbench would rewrite a large analytical slice; leaving the core document empty violates strict binding validation. The selected middle path uses stabilized document-source identities in core and joins full world payloads only at Datalab boundaries.
- Stage metadata and core workspace mutations are separate stores. The first design uses one product controller, pre-minted workspace ids, deterministic metadata repair, and avoids synchronous bidirectional subscriptions rather than pretending they are one atomic store.

### What warrants a second pair of eyes

- Confirm identity-only graphic payloads can use `datadrop.gog.document`, or define a separate reference format accepted by Go.
- Review whether `view.show(existing,navigate)` needs a preferred placement id for Datalab launcher parity.
- Review import ordering across world/core/Stage stores and whether one transient render needs an adoption gate.
- Confirm generic Surface slots can preserve all Datalab title, menu, import/export, and drag presentation behavior.

### What should be done in the future

- Complete PBUI-WORKBENCH-CORE-1 stabilization before production migration.
- Begin Datalab Phase 0 by freezing migration goldens, not by editing local Node types.
- Keep the rich launcher and remote projection product-local until another consumer proves a common abstraction.

### Code review instructions

- Start with design §§3–5 for ownership, then §§8–14 for command/render/persistence/remote flows.
- Compare the deletion list with `store/layout.ts`, `layoutTree.ts`, `Tile.tsx`, `SplitView.tsx`, and `remote/codec.ts`.
- Validate the baseline with:

  ```bash
  pnpm --filter @hyperslop-systems/datalab-ui typecheck
  pnpm --filter @hyperslop-systems/datalab-ui test
  ```

### Technical details

```text
Canonical spatial owner: WorkbenchCore
Product navigation owner: Datalab Stage metadata
Analytical document owner: Redux world
Remote owner: Datalab work-stage projection
Migration baseline: 49 files / 554 tests passed
Upload: Datalab Workbench Core Consolidation.pdf
Remote: /ai/2026/09/03/PBUI-DATALAB-WORKBENCH-1
```

## Step 2: Analyse the cutover and freeze the Phase 0 goldens

Implementation started. Before touching code I read the whole Datalab spatial stack (the 1,162-line layout slice, the tree algebra, stages, persistence, the remote codec and controller, the launcher index, bundles, effects, the layer test) against the workbench-core and pbui-workbench APIs as they exist after PBUI-WORKBENCH-CORE-1 and its stabilization pass. The design holds; three concrete facts sharpened it: the protocol already has a `viewClose` mutation with a fallback view (Datalab's close-view repair, exactly), the core's planner sweeps views a batch leaves unplaced (so Datalab stops manufacturing "unplaced" views), and a seed that binds the welcome documents needs stub payloads for ids the world does not hold yet, which the identity-only source design covers.

Phase 0 then froze what the Redux slice does today: an id-free shape golden of `defaultLayout()` that makes singleton sharing visible, a real version-5 `save()` payload with user changes layered on the seed, a golden test that proves both readable, and an inventory classifying all 52 production action uses and 57 state reads.

### Prompt Context

**User prompt (verbatim):** "Work on @PBUI-DATALAB-WORKBENCH-1 docmgr ticket. commit at appropriate intervals and keep a detailed diary as you work (using the diary format from the skill)

Print out a brutalist work slip with the plan / different phases for the ticket. then before stsarting a phase, plrint a split about the phase, and print one when the phase is done."

**Assistant interpretation:** Implement the ticket's nine tasks end to end on the current branch, with commits per phase, diary steps per phase, and printed work slips for the plan, each phase start, and each phase end.

**Inferred user intent:** Finish the consolidation the design describes — Datalab's duplicate spatial model gone, workbench-core canonical — with a reviewable trail.

**Commit (code):** bc3f027 — "PBUI-DATALAB-WORKBENCH-1 P0: freeze layout goldens and use inventory"

### What I did

- Read `store/layout.ts`, `layoutTree.ts`, `stages.ts`, `applyLayoutVerb.ts`, `persist.ts`, `remote/codec.ts`, `appkit/useRemoteWorkbench.ts`, `bundles.ts`, `effects.ts`, `LauncherDialog`, `launcherIndex.logic.ts`, `Tile`, `SplitView`, `WorkbenchShell`, `Workbench`, `WorkbenchInstance`, `test/layers.test.ts`, and the touched tests.
- Read `workbench-core`'s commands, planner (show, placement, workspace, session), core, sources, apps, document builders, validation, persistence; `pbui-workbench`'s shell factory, Surface, Tile, launcher rows, strip; the protocol client's applier.
- Confirmed the baseline: typecheck clean, 49 files / 554 tests.
- Wrote `test/helpers/layoutShape.ts` (`shapeOfLayout`), the ticket script `scripts/01-freeze-layout-goldens.ts`, generated `test/fixtures/layout-shape.golden.json` and `test/fixtures/persisted-v5.json`, and `test/migration-goldens.test.ts`.
- Wrote `reference/02-spatial-use-inventory-and-golden-map.md`.
- Printed the plan slip and the P0 start/done slips.

### Why

- The design's Decision 4: goldens and adapters first, one coordinated cutover after. A golden generated from the code being deleted is the only golden that cannot be wrong about what that code did.
- View aliasing in the shape golden is what makes the singleton-sharing risk (§21) testable rather than remembered.

### What worked

- `makeStore()` runs under plain node, so the freeze script is `tsx` over the real store and the real `save()`, no browser.
- The existing test suite already isolates most spatial semantics behind pure functions (launcher index, bundles, effects), so the port is a fixture rewrite rather than a rewrite of the assertions.

### What didn't work

- The freeze script's doc comment contained `*/scripts/…`, which closed the comment: `ERROR: Unterminated regular expression`. Reworded.
- Relative imports from the ticket's `scripts/` directory needed six `..` segments, not five: `ERR_MODULE_NOT_FOUND …/ttmp/packages/datalab-ui/src/store`.

### What I learned

- `viewClose` (protocol) is Datalab's `closeView` reducer as a mutation: every placement of one view removed, an emptied workspace repaired with a fallback view. The controller can send it through `core.apply` with a freshly created launcher view as the fallback.
- The planner's finalize step deletes views THIS batch made unplaced. Replacing a tile's only view therefore deletes the old view; Datalab's "Not shown" launcher group will only ever hold views that arrived unplaced (a remote adoption, an import), never ones the product manufactured.
- `view.show` with `{ kind: "replace" }` on a view placed once retargets it in place (same view id, `viewConfigure` with a new `appId`); on a linked view it mints a new one. Datalab's `createViewInPlacement` always minted; the core's rule is the better one and the launcher will adopt it.
- Pinned welcome workspaces bind `WELCOME_DOC_IDS.*` before those documents exist in the world; the seed must emit identity stubs for bound ids so the core's `unknown_document` check passes.

### What was tricky to build

- Deciding the layer placement of the controller. `test/layers.test.ts` forbids `store → appkit` even for type imports, and the export/import thunks in `store/effects.ts` must reach the controller. So the headless controller (core + Redux store + policy) will live in `store/`, and only the React shell wiring in `appkit/`.

### What warrants a second pair of eyes

- The decision to let the core's orphan sweep replace Datalab's unplaced-view behaviour (design §19.3 "unplaced view handling"). Reviewed in Phase 4 with the launcher tests.

### What should be done in the future

- N/A for this step.

### Code review instructions

- Start with `test/helpers/layoutShape.ts` and `test/fixtures/layout-shape.golden.json`; check the `sources` alias appears once with several placements.
- Run `pnpm --filter @hyperslop-systems/datalab-ui exec vitest run test/migration-goldens.test.ts`.

### Technical details

```text
files importing store/layout: 32 src + 13 test
production layoutActions uses: 52 (23 distinct)
production state.layout reads: 57
fixtures: layout-shape.golden.json (12.8 kB), persisted-v5.json (32.2 kB)
```
