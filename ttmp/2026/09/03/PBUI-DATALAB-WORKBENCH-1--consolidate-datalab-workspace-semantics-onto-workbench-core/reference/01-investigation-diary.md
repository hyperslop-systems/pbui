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
    - Path: repo://packages/datalab-ui/src/appkit/workbenchApps.ts
      Note: Registry to manifest mapping (commit 49d27e8)
    - Path: repo://packages/datalab-ui/src/components/organisms/LauncherDialog/LauncherDialog.tsx
      Note: Product-specific launcher behavior inspected
    - Path: repo://packages/datalab-ui/src/components/pages/Workbench/WorkbenchShell.tsx
      Note: Surface mounted with Datalab's two slots (commit 0b980f3)
    - Path: repo://packages/datalab-ui/src/remote/codec.ts
      Note: Current local-to-protocol conversion inspected
    - Path: repo://packages/datalab-ui/src/remote/projection.ts
      Note: Work-stage projection and adoption (commit 0b980f3)
    - Path: repo://packages/datalab-ui/src/store/controller.ts
      Note: 'Controller: policy, metadata sequencing, close-view batch (commit 93cbf64)'
    - Path: repo://packages/datalab-ui/src/store/effects.ts
      Note: Import as one validated batch in dependency order (commit 0b980f3)
    - Path: repo://packages/datalab-ui/src/store/layout.ts
      Note: Primary duplicate spatial implementation inspected
    - Path: repo://packages/datalab-ui/src/store/merge.ts
      Note: Pinned merge with singleton dedupe (commit 0b980f3)
    - Path: repo://packages/datalab-ui/src/store/navigation.ts
      Note: Navigation slice; derived current stage; reconcile (commit 49d27e8)
    - Path: repo://packages/datalab-ui/src/store/runtime.ts
      Note: Store + core + controller + source as one unit (commit 93cbf64)
    - Path: repo://packages/datalab-ui/src/store/seed.ts
      Note: Seed compiler with singleton carry and bound-document stubs (commit 49d27e8)
    - Path: repo://packages/datalab-ui/test/controller.test.ts
      Note: Reducer goldens replayed through the controller (commit 93cbf64)
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

## Step 3: Phase 1 — manifests, seed compiler, graphic source, navigation slice

Phase 1 added the workbench-side foundation beside the untouched Redux slice. The registry is projected onto workbench manifests, the pinned stages are redeclared as `LayoutSpec` definitions and compiled through the protocol into one `WorkbenchDocument`, the world becomes an identity-only document source, and a navigation slice holds stage definitions, per-workspace metadata and per-stage memory with no mirrored current-workspace pointer. The Phase 1 exit gate holds: the compiled default seed reproduces the Phase 0 shape golden exactly and validates strictly against the real catalog in a headless core.

Nothing renders through the new stack yet; the full suite still runs the old code (53 files / 589 tests, up from 554 with the new tests).

### Prompt Context

**User prompt (verbatim):** (see Step 2)

**Assistant interpretation:** Build the adapters the design's Phase 1 lists, additively, and prove them with the golden before any cutover.

**Inferred user intent:** A reviewable, green intermediate state before the large spatial cutover.

**Commit (code):** 49d27e8 — "PBUI-DATALAB-WORKBENCH-1 P1: manifests, seed compiler, graphic source, navigation slice"

### What I did

- `package.json`: `@hyperslop-systems/workbench-core` and `@hyperslop-systems/pbui-workbench` as workspace dependencies; `vite.config.ts` externals extended for the library build.
- `src/store/stageIds.ts`: the fixed stage/workspace ids, so the navigation slice and the seed compiler need not import `stages.ts` (which imports the old layout). `stages.ts` re-exports them.
- `src/store/graphicSource.ts`: `GRAPHIC_DOCUMENT_FORMAT`, `GRAPHIC_SOURCE_ID`, `graphicStub`, `graphicStubMutation`, `isGraphicStub`, `graphicDocumentSource(read, subscribe?)`.
- `src/store/navigation.ts`: `StageDefinition`, `WorkspaceMeta`, `NavigationState`, the pure `reconcileNavigation`, `currentStageId`, `landingWorkspaceOf`, `workspacesOfStage`, and the slice (metadata, stage definition, transient UI reducers).
- `src/store/seed.ts`: `compileSeed`, `pinnedDefinitions`, `workDefinitions`, `defaultSeed`, `singleStageSeed`, re-exporting `split`/`tile`.
- `src/appkit/workbenchApps.ts`: `toWorkbenchApp`, `datalabWorkbenchApps`, `datalabManifests`.
- `test/helpers/layoutShape.ts`: `shapeOfDocument` over a seed; `test/seed.test.ts`, `test/navigation.test.ts`, `test/graphic-source.test.ts`.

### Why

- Design §6.1 mapping, §6.3 identity-only source, §7 seed compiler with singleton carry, §5.3 metadata shape, §5.2 no mirrored pointer.
- `primary` is an OPTIONAL binding and `launch` is `"unbound"`: a document-bound tile with no binding follows the active document, which DocBar's "+" and the launcher both produce, and Datalab's own launcher decides what to bind.

### What worked

- The shape golden matched on the first run: reading order in `buildLayout` and the old builder agree on every tree, and threading `existingViewsByAppId` across workspaces gave singleton sharing for free.
- `sequentialIds` from workbench-core makes the seed deterministic for tests.

### What didn't work

- Biome reformatted eight files (line length); no lint errors.

### What I learned

- `workbench-core`'s `split(direction, ratio, a, b)` has the ratio SECOND; Datalab's builder had it last. Every pinned tree was transcribed by hand and the golden is what caught nothing being wrong.
- Every stub the seed writes is exactly the set of bound ids (asserted), so the source will never delete one: bound stubs are retained by `documentSourceMutations` whether or not the world holds the document.

### What was tricky to build

- `reconcileNavigation` must return the SAME object when nothing changed, or a subscriber comparing identity wakes on every core install. The function tracks a `changed` flag through both maps and the memory.

### What warrants a second pair of eyes

- `duplicatePlacement` for an app that is `duplicable` AND `singleton` (none today; `apps.test.ts` forbids it) is forced to `"link"`, because the core refuses `one` + `clone`.

### What should be done in the future

- Phase 7 deletes the builder-based `pinnedStages` in `stages.ts`; until then the two definitions coexist and the golden pins them together.

### Code review instructions

- `src/store/seed.ts` (`compileSeed`), `src/store/navigation.ts` (`reconcileNavigation`), `src/appkit/workbenchApps.ts` (the manifest mapping).
- `pnpm --filter @hyperslop-systems/datalab-ui exec vitest run test/seed.test.ts test/navigation.test.ts test/graphic-source.test.ts`

### Technical details

```text
manifest mapping: singleton→one, duplicable→clone (else link), docBound→primary{required:false, formats:[datadrop.gog.document]}, launch: unbound
seed: 4 stages, 15 workspaces, stubs = bound demo ids; default seed validates ok
tests: 53 files / 589 passed
```

## Step 4: Phase 2 — headless controller, runtime, verb thunks

Phase 2 put the product's policy in front of the core. `store/controller.ts` is the one door Datalab code will use for anything spatial: it refuses what the workbench would allow but the product forbids (a pinned workspace renamed, a stage stranded), sequences the operations that touch the workbench document and the navigation metadata together, and expresses Datalab's tile verbs as core commands with the reuse rule Datalab's reducers implied (a singleton's view is reused, every other application gets a fresh view). `store/runtime.ts` builds the store, the core, the controller and the graphic source as one unit and keeps navigation reconciled with the document. `store/workbenchVerbs.ts` is the verb seam over the controller, not yet wired into `applyVerb.ts`.

The exit gate holds: every behaviour the old reducer tests pinned replays through the controller without rendering (36 parity tests), and the whole suite is green at 55 files / 628 tests with the old slice still in place.

### Prompt Context

**User prompt (verbatim):** (see Step 2)

**Assistant interpretation:** Design §8 and §5.4–5.5, additively, proven by the reducer goldens.

**Inferred user intent:** The spatial semantics ported and verified before any component changes.

**Commit (code):** 93cbf64 — "PBUI-DATALAB-WORKBENCH-1 P2: headless controller, runtime, verb thunks"

### What I did

- `src/store/index.ts`: the `navigation` slice beside `layout`; a lazy `controller` getter on the thunk extra argument.
- `src/store/controller.ts`: `createDatalabController({ store, core, execute? })` with navigation (`selectWorkspace`, `selectStage`), workspace policy (`createWorkspace`, `removeWorkspace`, `renameWorkspace`, `cloneWorkspace`, `moveWorkspaceToStage`, `setWorkspaceApps`), stage policy (`addStage`, `removeStage`, `renameStage`), and tile verbs (`splitTile`, `duplicateView`, `createLinkedDuplicate`, `replacePlacement`, `renameView`, `rebindView`, `removePlacement`, `closeView`, `setActivePlacement`).
- `src/store/runtime.ts`: `createDatalabRuntime({ seed, apps, world?, ids?, … })` → `{ store, core, controller, dispose }`; policy `duplicate: { app: "launcher" }`; source connected; reconcile on workspace-set change.
- `src/store/workbenchVerbs.ts`: `actionsForWorkbenchVerb(verb)` → thunks; `null` for export/import/template verbs.
- `test/controller.test.ts` (36), `test/workbench-verbs.test.ts` (3).

### Why

- §5.5: protocol validity and product permission are separate checks; the controller is where the second lives.
- §8.3: metadata before the command, rolled back on refusal, so the runtime's reconcile never files a new workspace under `work` for one notification.
- §8.2: close-view as one validated raw batch through `core.apply` (`viewCreate` of a launcher fallback only when a workspace would empty, then `viewClose`), not a generic core command.

### What worked

- The protocol's `viewClose` is exactly the old `closeView` reducer; the controller only has to mint the fallback when needed.
- `execute` injection: the React layer will pass `shell.execute` so geometry is measured, and the tests run the same controller headless.

### What didn't work

- `Bash` refused one heredoc as containing a control character (the prime in `′`); the files were written with the Write tool instead.
- First test run: 7 failures. Two causes — the test handed the seed and the core separate `sequentialIds()` generators, so a minted node id collided with a seeded one (`duplicate_id … "n-00000004-0000" was already used`); and tests bound `"doc-a"` without a world document, correctly refused as `unknown_document`. Fixed by sharing one generator and minting real documents through `worldActions.newDoc`.
- TS2345 on `view.show`: an inline `{ primary } | {}` union is not a `Record<string, string>`; typed the map explicitly.

### What I learned

- Two deliberate deviations from the reducers, both toward the core's rule: (1) `workspace.clone` CLONES a clone-able application's view where `cloneSpace` linked every view; a duplicated workspace now gets independent chart/table views and shares singletons. (2) The planner sweeps views a batch leaves unplaced, so replacing a tile's only view deletes the old view instead of leaving it "unplaced" (§19.3).
- `view.show` `{ replace }` on a view placed once retargets the same view id; the swap test still passes because swap is placement-level.

### What was tricky to build

- `removeStage` when the current workspace is in it: the batch must `selectWorkspace(landing)` BEFORE the deletes, or the core's `workspace.delete` picks any survivor and the user lands in a random stage. Same shape for `removeWorkspace` of the current one: select a same-stage sibling first, in one transition.
- `reconcile` on the core subscription compares the joined workspace-id list, not object identity, so an install that changed only tiles dispatches nothing.

### What warrants a second pair of eyes

- The clone deviation above (Decision recorded; the design's §8.1 mapping said `commands.cloneWorkspace + metadata copy`).
- `closeView` bypasses the planner (raw `apply`): links maintenance runs, orphan sweep does not; `viewClose` deletes the view itself, so nothing is left unplaced.

### What should be done in the future

- Phase 3 passes `shell.execute` as the controller's executor and wires `actionsForWorkbenchVerb` into `applyVerb.ts`.

### Code review instructions

- `src/store/controller.ts` (`removeWorkspace`, `removeStage`, `closeView`, `applicationView`); `src/store/runtime.ts` (the two one-way subscriptions).
- `pnpm --filter @hyperslop-systems/datalab-ui exec vitest run test/controller.test.ts test/workbench-verbs.test.ts`

### Technical details

```text
refusal codes: pinned_workspace, last_workspace_in_stage, pinned_stage, last_stage, unknown_stage, empty_stage, empty_name (+ core codes)
policy: duplicate { app: "launcher" } ⇒ bare split = launcher tile, centre-aim on a launcher fills it
tests: 55 files / 628 passed
```

## Step 5: Phases 3–7 — the spatial cutover and the deletion

One continuous block, committed once green, as Decision 4 requires. Workbench core became the only owner of workspaces, views, placements and trees; the pbui-workbench Surface renders the current workspace with two Datalab slots (the `<tile>` presentation with inline rename and the derived `chart · α` title; the door to Datalab's launcher in the action group). Every component that read the layout slice reads the core or the navigation slice instead, every write is a controller call, and the Redux layout slice, the tree algebra, `SplitView`/`NodeView` and the node/view codec are gone. Persistence moved to a version-6 envelope with a version-5 migrator and a pinned merge; the remote layer became a pure work-stage projection plus an adoption in dependency order; portable bundles export from the document and import as one validated protocol batch.

The tests and stories were ported by three parallel agents over a shared API brief while I finished the source; the whole package is green (55 files / 602 tests, typecheck, biome, build, storybook build) and the demo was smoke-tested in a browser: six embedded instances, split/close/launcher/navigate/add-workspace in the product, and a reload that restored the version-6 envelope.

### Prompt Context

**User prompt (verbatim):** (see Step 2)

**Assistant interpretation:** Execute the coordinated cutover (design Phases 3–7) and prove it with the ported suites and a browser smoke.

**Inferred user intent:** No duplicate spatial model left in Datalab, with the product's own semantics intact.

**Commit (code):** 0b980f3 — "PBUI-DATALAB-WORKBENCH-1 P3-P7: cut Datalab over to workbench-core"; beb8887 — "memoise the stage-scoped workspace list"

### What I did

- **Workbench wiring:** `appkit/workbench.ts` (`createDatalabWorkbench` = runtime + `createWorkbenchShell`; the controller runs through `shell.execute` so geometry is measured), `appkit/DatalabWorkbenchContext.tsx` (provider, `useDatalabWorkbench`, `useCurrentWorkspaceId`, `useCurrentStageId`, `useCurrentStage`, `useWorkspacesOfStage`), `runtime.ts` gained an `executor` option, `registry.ts`'s `AppProps.view` is the protocol `AppView`.
- **Rendering:** `WorkbenchShell` mounts `workbench.shell.Surface` with `renderDatalabTitle`/`renderDatalabTileAction`, `linkModeShortcut={false}`; `Tile.tsx` is now `TileTitle` + `TileAction`; `SplitView/` deleted; the active-tile outline is keyed on Datalab's own `data-launcher-open`.
- **Chrome and launcher:** `WorkspaceStrip`, `StageBar`, `LauncherDialog` (+ `launcherIndex.logic.ts` over protocol nodes and a `LauncherWorkspace` join), `ViewSwitcher`, `DocBar` (through a `rebindView` thunk — a molecule may not import `appkit`), `AppScope.useAvailableApps`, `LauncherApp`, `ModulesApp`, `SignUpApp`, `TemplatesApp`.
- **Session and instances:** `Workbench.tsx` (gate → `controller.selectStage`), `WorkbenchInstance` (one workbench per instance; `preloaded: { world, seed }`), `DatalabApp.Product` (load → merge → construct from the accepted state), `WorkbenchProviders` (`actionsForVerb(verb, { world })`), `applyVerb.ts` over `workbenchVerbs.ts` (which now owns the export/import/template verbs too; `applyLayoutVerb.ts` deleted).
- **Lessons:** `Lesson.done(state, workbench)` and `Goal.done(state, workbench)` take the core's state; `LessonContext.workbench` is the controller; `tour/fixtures.ts` seeds through `datalabSingleStageSeed`; `tour/lessons/layout.tsx` and `brief.tsx` read `leavesOfWorkspace`.
- **Persistence:** `persist.ts` (v6 envelope, `migrate`, `validate(input, apps)`, `save(key, world, {document, workspaceId}, navigation)`, `load(key, apps)`), `migrateV5.ts`, `merge.ts` (`mergePinned`), `usePersistence` over store + core.
- **Remote:** `remote/codec.ts` (JSON + graphic envelope only), `remote/projection.ts` (`projectWorkStage`, `preservedLocalState`, `assertRemoteDocumentNamespace`, `mergeRemoteWorkStage`), `remote/types.ts`, `store/remote.ts` (world-only action), `useRemoteWorkbench` (validate candidate → world → navigation → `core.replaceDocument`).
- **Bundles:** `bundles.ts` over `{ world, document, navigation }`, protocol nodes on import; `effects.ts` `commitImport` validates the batch on a snapshot, then world → navigation → `core.apply`, with rollback of minted documents.
- **Deleted:** `store/layout.ts`, `store/layoutTree.ts`, `store/applyLayoutVerb.ts`, `components/organisms/SplitView/`, the builder half of `stages.ts`, the remote node/view codec and its local types.
- **Docs:** README "Workbench ownership" section; the editing playbook's boundary list.
- Tests/stories ported by agents: launcher-index, view-switcher, lessons, portable, effects; helpers/layoutShape, migration-goldens, stages, store, instances, shortcut-routing; remote-codec, remote-load and seven stories. I fixed `no-raw-controls` (stale allowlist entry) and `render-boundary` (the per-tile boundary is the shell's).

### Why

- Design §9 (two slots, everything else the shell's), §10 (adapt the launcher, feed it the core), §11 (stage-scoped strip, derived current stage), §12 (bundles as prepared operations in dependency order), §13 (version 6, construct from the accepted state), §14 (keep the projection product-local), §15 (what leaves Redux), §20 (the deletion list).

### What worked

- `createWorkbenchShell`'s `execute` measures geometry, so the launcher no longer reads the DOM to pick a split axis: `controller.splitTile(id, undefined, show)` splits along the longer rendered axis.
- The browser smoke found nothing broken: the shell's split button makes a `new tile` launcher pane (the `duplicate: { app: "launcher" }` policy), the Datalab launcher opens in replace mode from the action-group door and in navigate mode from Mod+K, a placed row switches workspace and shows the linked counts (`sources ×4`), `+ workspace` selects the new workspace, and a reload restores it from a 15 kB version-6 envelope.

### What didn't work

- `test/layers.test.ts`: `DocBar` (a molecule) imported the workbench context (appkit). Fixed with a store thunk `rebindView(viewId, docId)` in `workbenchVerbs.ts`.
- `mergePinned` fell back to `workspaces[0]` — the sign-in page — when the stored `workspaceId` was gone (found by the store-side agent, which had weakened the test). Fixed: the fallback is the work stage's remembered workspace; test tightened. A first patch left `landingWorkspaceOf` unimported because biome had reflowed the import block under my regex; `ReferenceError: landingWorkspaceOf is not defined` in three tests.
- react-redux warned that `useWorkspacesOfStage` returned a fresh array per call; memoised (beb8887). The remaining warnings (`useSelector(s => s)` in `LessonRail`/`BriefChecklist`, the `DocBar` document map) predate this ticket.
- `Bash` refused two heredocs as containing control characters (the `′` and `⌕` glyphs); those files went through the Write tool.
- The only console error in the smoke is the `/v1/me` proxy 502 — no API was running.

### What I learned

- Deviations from the reducers, all toward the core's rule and recorded here for the review: (1) `workspace.clone` clones a clone-able application's view where `cloneSpace` linked every view; (2) the planner sweeps a view a batch leaves unplaced, so replacing a tile's only view deletes the old view rather than leaving it "not shown"; (3) a tile import that re-points the target's only view deletes that view explicitly (`core.apply` has no sweep); (4) a raw `view.show` `{ replace }` on a view placed once retargets the same view id.
- Story-level deviations (from the story agent): the per-tile application dropdown is gone, so the TwoInstances play now proves separation by tile counts; "Replace …" opens the launcher dialog and Escape returns focus to the tile cell; a story about an unregistered application must add a ghost manifest, because the core refuses a document naming an application its catalog lacks; a story may only bind `primary` on a doc-bound app.
- `test/stories.test.ts` takes the first quoted `title:` in a file as the meta title, so a `tile("chart", { title })` above the meta breaks it.

### What was tricky to build

- Ordering in `commitImport` and remote adoption: metadata must be in the navigation slice BEFORE the core installs a new workspace (or the runtime's reconcile files it under `work` for one notification), and world documents must exist BEFORE a view binding them is installed. Both paths validate the candidate on a snapshot first so a refusal touches nothing.
- The launcher's navigate row: `[selectWorkspace, activate]` as ONE batch, because `session.activatePlacement` refuses a placement outside the current workspace and the draft session inside a batch already reflects the switch.
- Two `data-workbench-shell` markers would have doubled the "lone workbench" count for Mod+K; Datalab's root dropped its marker and keeps only `data-launcher-open` for its own outline rule.

### What warrants a second pair of eyes

- `mergePinned`'s singleton deduplication (a kept leaf is repointed at the canonical view) and its choice of canonical view (the seed's, else the first the user reaches).
- `mergeRemoteWorkStage` drops local stubs that no preserved view binds; the source re-adds any the world still holds, so nothing is lost, but the two are coupled.
- The four reducer deviations above.

### What should be done in the future

- `useSelector(s => s)` in the lesson rail and the brief checklist predates this ticket and now also re-renders on every core install through `useCoreState(s => s)`; a narrower subscription would help on the tour page.
- Open question 1 (a preferred placement on `view.show(existing, navigate)`) stays open: the launcher achieves it with a batch.

### Code review instructions

- Start at `src/appkit/workbench.ts` and `src/components/pages/Workbench/WorkbenchShell.tsx`, then `LauncherDialog.tsx` (`choose`), `store/effects.ts` (`commitImport`), `store/merge.ts`, `remote/projection.ts`, `appkit/useRemoteWorkbench.ts`.
- `pnpm --filter @hyperslop-systems/datalab-ui typecheck && pnpm --filter @hyperslop-systems/datalab-ui test && pnpm --filter @hyperslop-systems/datalab-ui build-storybook`; the demo: `pnpm --filter @hyperslop-systems/datalab-ui dev` and open `/` (tour) and `/ui/` (product).

### Technical details

```text
commit 0b980f3: 89 files, +4348 / −6026
deleted: store/layout.ts (1,162 lines), layoutTree.ts, applyLayoutVerb.ts, organisms/SplitView/, remote node/view codec
new: appkit/workbench.ts, appkit/DatalabWorkbenchContext.tsx, store/merge.ts, store/migrateV5.ts, remote/projection.ts
package: 55 test files / 602 tests; storybook builds; demo smoke: 6 instances, 0 console errors (api 502 aside)
persistence: version 6 = { world, workbench (protobuf JSON), navigation, workspaceId }; v5 migrates; v1–4 refused
```
