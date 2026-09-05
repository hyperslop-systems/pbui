---
Title: Spatial use inventory and golden map
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
RelatedFiles: []
ExternalSources: []
Summary: Every production use of the Redux layout slice classified as generic spatial, product policy, transient UI, or import/restore, with the golden fixture that covers each before the cutover.
LastUpdated: 2026-09-03T19:28:47.896885743-04:00
WhatFor: Know which layout use is generic, product, or transient before deleting any, and which fixture proves each survived.
WhenToUse: When porting a file that imports store/layout, or when a golden fails after the cutover.
---

# Spatial use inventory and golden map

Phase 0 of the migration (design §18). Measured on 2026-09-03 against `packages/datalab-ui` at the baseline of 49 test files / 554 tests, before any file was changed.

## 1. Counts

```text
files importing store/layout (src + test):   45  (32 src, 13 test)
production layoutActions.* call sites:        52
distinct actions used in production:          23
production reads of state.layout.*:           57
```

## 2. Actions, classified

| Action | Uses | Class | Becomes |
|---|---|---|---|
| `setRatio` | 2 | generic spatial | `commands.resize` (shell SplitPane) |
| `splitLeaf` (no app) | 2 | generic spatial | `commands.duplicate` with policy `{ app: "launcher" }` |
| `splitLeaf` (with app) | 2 | generic spatial | `view.show` `{application, reuse: "never"}` / `{split, target, axis}` |
| `closeLeaf` | 1 | generic spatial | `commands.close` |
| `createViewInPlacement` | 4 | generic spatial | `view.show` `{application, documents, reuse: "never"}` / `{replace}` |
| `replacePlacementWithView` | 2 | generic spatial | `commands.link` |
| `swapTiles` | 1 | generic spatial | `commands.swap` (shell Tile) |
| `dockTile` | 1 | generic spatial | `commands.dock` (shell Tile) |
| `setViewDocument` | 3 | generic spatial | `commands.rebind` |
| `renameView` | verb | generic spatial | `commands.setTitle` |
| `duplicateView` | verb | generic spatial | `commands.duplicate` under a `"clone"` duplicate policy for the app |
| `createLinkedDuplicate` | verb | generic spatial | `view.show` `{existing}` / `{split, target}` |
| `closeView` | verb | product batch | controller `closeView`: `viewCreate(launcher)` + `viewClose` through `core.apply` |
| `setActivePlacement` | 1 | generic session | `commands.activate` (shell Tile) |
| `setCurrentSpace` | 2 | product + session | controller `selectWorkspace` → `commands.selectWorkspace` + stage memory |
| `addSpace` | 2 | product + spatial | controller `createWorkspace(stageId)` → `commands.createWorkspace` + metadata |
| `removeSpace`, `renameSpace`, `cloneSpace` | verbs | product + spatial | controller policy (pinned, last-in-stage) + `workspace.*` commands |
| `setSpaceApps` | 0 (tests) | product | navigation slice |
| `setCurrentStage` | 5 | product | controller `selectStage` |
| `addStage`, `removeStage`, `renameStage`, `moveSpaceToStage` | 0 (tests) | product | navigation slice + controller |
| `openLauncher`, `closeLauncher` | 3 + 5 | transient | navigation slice, unchanged |
| `beginRename` | 3 | transient | navigation slice, unchanged |
| `showNotice`, `dismissNotice` | 5 + 1 | transient | navigation slice, unchanged |
| `openImport`, `closeImport` | 2 + 1 | transient | navigation slice, unchanged |
| `setJustSignedUp` | 1 | transient | navigation slice, unchanged |
| `replaceLeafFromBundle`, `insertWorkspaceFromBundle`, `insertStageFromBundle` | 1 each | import | controller import: world docs → `core.apply(batch)` → navigation patch |
| `replaceLayout` | 0 | restore | gone; construction from the accepted state |
| `remoteWorkbenchLoaded` (extra reducer) | 1 | remote | projection merge → `core.replaceDocument` + world + navigation |

## 3. Reads of `state.layout.*`

| Field | Reads | After cutover |
|---|---|---|
| `spaces` | 16 | `core.document.workspaces` joined with navigation metadata |
| `currentSpaceId` | 10 | `core.session.workspaceId` |
| `views` | 8 | `core.document.views` |
| `currentStageId` | 7 | derived: `navigation.workspace[session.workspaceId].stageId` |
| `stages` | 5 | `navigation.stages` |
| `renamingId`, `launcher`, `pendingImport`, `notice`, `justSignedUp` | 9 | navigation slice, unchanged |
| `activePlacementId` | 2 | `core.session.activePlacementId` |

## 4. Files touching the slice

Generic spatial rendering (deleted in Phase 7): `components/organisms/SplitView/SplitView.tsx`, the spatial half of `components/organisms/Tile/Tile.tsx`, `store/layoutTree.ts`, the spatial reducers of `store/layout.ts`.

Adapted (keep product semantics, change data input): `appkit/registry.ts`, `appkit/AppScope.tsx`, `appkit/useRemoteWorkbench.ts`, `appkit/usePersistence.ts`, `apps/LauncherApp`, `apps/ModulesApp`, `apps/SignUpApp`, `components/molecules/DocBar`, `components/organisms/LauncherDialog/*`, `components/organisms/ViewSwitcher/*`, `components/organisms/StageBar`, `components/organisms/WorkspaceStrip`, `components/pages/Workbench/*`, `components/pages/WorkbenchInstance`, `remote/codec.ts`, `remote/types.ts`, `store/applyLayoutVerb.ts`, `store/applyVerb.ts`, `store/bundles.ts`, `store/effects.ts`, `store/index.ts`, `store/persist.ts`, `store/remote.ts`, `store/stages.ts`, `tour/fixtures.ts`, `tour/lessons/brief.tsx`, `tour/lessons/layout.tsx`, `model/portable.ts` (comment only), `components/pages/MarketingPage/copy.ts` (comment only).

Stories: `SplitView.stories`, `Tile.stories`, `ViewSwitcher.stories`, `LauncherDialog.stories`, `WorkbenchInstance.stories`, `apps/tiles.stories`.

Tests: `effects`, `instances`, `launcher-index`, `portable`, `remote-load`, `shortcut-routing`, `stages`, `store`, `view-switcher`; plus `remote-codec` (fixtures only) and `descriptors`/`menu-goldens` (TileRef/WorkspaceRef values, unchanged).

## 5. Golden map

| Behaviour that will be deleted | Frozen by |
|---|---|
| seed shape: stages, workspace order, trees, singleton sharing | `test/fixtures/layout-shape.golden.json` + `test/helpers/layoutShape.ts` (`migration-goldens.test.ts`) |
| version-5 local persistence with user changes | `test/fixtures/persisted-v5.json` (`migration-goldens.test.ts`) |
| split / close / swap / dock / duplicate / link / replace / rename / rebind | `test/store.test.ts` "the layout slice" — ported to controller parity tests in Phase 2 |
| close-view repairs an emptied workspace | `test/store.test.ts` "closing a view removes all placements…" |
| workspace create / delete / rename / clone, pinned refusals, last-in-stage guard | `test/stages.test.ts` "deletion keeps the same guard…" |
| stage memory, cross-stage select, visibility, landing | `test/stages.test.ts` "the space pointer…", "stage visibility" |
| launcher grammar, grouping, scope, linked/unplaced rows | `test/launcher-index.test.ts` (fixtures rebuilt over a WorkbenchDocument in Phase 4) |
| portable bundles: no ids travel, sharing survives, limits | `test/portable.test.ts` (state builders rebuilt over protocol values in Phase 5) |
| export/import effects with a fake clipboard | `test/effects.test.ts` |
| remote adoption preserves local-only stages, refuses collisions | `test/remote-load.test.ts`, `test/remote-codec.test.ts` |
| instance isolation, scoped persistence | `test/instances.test.ts` |
| active placement rules | `test/shortcut-routing.test.ts` "active placement" |

Not frozen separately: `viewOrder` ordering (the launcher's tie-break), because the seed compiler builds views in reading order while the builder created them in call order; the launcher tests assert on grouped results, not on raw order.
