---
Title: Consumer inventory and public surface
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
    - Path: repo://packages/pbui-chat/src/tools/workbenchTools.ts
      Note: 'The heaviest in-repo consumer: agent tools over plan/verbs/describe'
    - Path: repo://packages/pbui-workbench/src/index.ts
      Note: The 64-export barrel this inventory sorts into delete/move/keep
ExternalSources: []
Summary: Phase 0 inventory of every pbui-workbench consumer, the API each one touches, the migration owner and order, and the intended final public entry points of workbench-protocol, workbench-core, and pbui-workbench.
LastUpdated: 2026-09-03T15:08:56.425136981-04:00
WhatFor: Give Phase 8 a checklist of who imports what, and Phase 6/9 the target export map, so the hard cutover is measured against a fixed list rather than a search.
WhenToUse: Before migrating a consumer, before changing a package barrel, and when auditing that no legacy symbol remains referenced.
---



# Consumer inventory and public surface

## Goal

Freeze, before extraction starts, (1) who consumes `@hyperslop-systems/pbui-workbench` and through which symbols, (2) the order and owner of each migration, and (3) the intended final entry points of the three packages. Phase 8 migrates against this list; Phase 9 audits against it.

## 1. Consumers

Counts are importing source files (tests and stories included, generated/build output excluded), taken on 2026-09-03 at commit `04d1d7c`.

| Consumer | Files | Dependency form | Branch | Surface used |
|---|---|---|---|---|
| pbui `packages/pbui-workbench` (own stories/tests) | 31 test files | — | task/consolidate-pbui-kernel | everything |
| pbui `packages/pbui-chat` (+ demo) | 22 | `workspace:^` | same | `defineApp`, `AppDescriptor`, `AppProps`, `Workbench`, `workbench.verbs.openView/rebind/selectWorkspace/openLauncher/closeLauncher`, `workbench.activePlacementId()`, `workbench.plan()` (agent tools, atomic multi-verb), `workbench.store.getState()`, `isWorkbenchVerb`, `describeWorkbenchVerb`, `describeWorkbench`, `isAppAvailable`, `documentSlots`, `createLocalPersistence`, `readWorkbenchSnapshot`, `layout/split/tile`, `rebalanceSettingsApp`, `workbench.reset(factory)`, `workbench.mutate` (NotesApp demo) |
| pbui `packages/pbui-sandbox` | 7 | `workspace:^` | same | `defineApp`, `AppDescriptor`, `AppProps`, `useWorkbench().verbs.openView` |
| pbui `packages/pbui-ecommerce` (+ demo) | 26 | `workspace:^` | same | `createWorkbench` (with `links` deps), `AppDescriptor`, `CreateWorkbenchOptions`, `Workbench`, `workbench.links` (snapshot, deps, runtime via hooks), `workbench.perform`, `isWorkbenchVerb`, `tileRefOf`, `portRefOf`, `PortBadge`, `coordinationInspectorApp`, `workbench.useDocument`, `workbench.reset`, `workbench.serialize`, `createWorkbenchPresentationFragment` |
| pbui `packages/pbui-plotscript` (+ demo) | 12 | `workspace:^` | same | `createWorkbench`, `createAppRegistry`, `parseDocument`, `workspaces/split/tile`, `defineApp`, `useWorkbench().useDocument`, `workbench.store.getState().document`, `workbench.mutate` (documentPut), `workbench.serialize`, `workbench.reset()` |
| pbui `packages/pbui-editor` | 2 | `workspace:^` | same | comments only (shortcut ownership note); no runtime import of the shell |
| rag-ttc `apps/workbench/web` | 45 | `link:` to this checkout (pins 0.3.1) | task/add-plot-editor | `createWorkbench`, `parseDocument`, `workspaces/split/tile`, `defineApp`, `AppProps`, `Workbench`, `createWorkbenchSync`-style document sync of its own, `createWorkbenchPresentationFragment`, `workbench.verbs.*`, `workbench.store` |
| agentlogic `ui` | 10 | packed tarball (pins 0.4.0) | task/add-plot-editor | `createWorkbench` over a local store, `defineApp`, `emptyDocument`, `rebalanceSettingsApp`, `WorkbenchState`, `WorkbenchStore` adapter, sync via `@hyperslop-systems/pbui-workbench/sync` |
| turboproof `ui` | 7 | packed tarball (pins 0.4.0) | task/add-plot-editor | Redux `WorkbenchStore` adapter (`createReduxWorkbenchStore`), `createWorkbench({ store })`, `defineApp`, `emptyDocument`, `rebalanceSettingsApp`, launcher rows |
| hyperblog `ui` | 4 | `link:` to this checkout (pins 0.4.0) | task/add-plot-editor | `createWorkbench`, `workspaces/split/tile`, `defineApp`, translated product verbs → `workbench.verbs` |
| datalab | 0 in this checkout | — | — | frozen (PBUI-DATALAB-1) |

Migration owner for every row in this ticket: the implementer of Phase 8 (this session). Order follows guide §17 Phase 8: workbench stories/tests → chat + sandbox → ecommerce + plotscript → rag-ttc → agentlogic → hyperblog → turboproof.

## 2. Current public surface (to be deleted or moved)

`packages/pbui-workbench/src/index.ts` exports 64 statements. Grouped by fate:

| Group | Symbols | Fate |
|---|---|---|
| assembly | `createWorkbench`, `CreateWorkbenchOptions`, `Workbench` | replaced by `createWorkbenchCore` (core) + `createWorkbenchShell` (shell) |
| stores | `createWorkbenchStore`, `useWorkbenchStore`, `WorkbenchState`, `WorkbenchStore`, `WorkbenchStoreOptions` | deleted; core owns state, shell owns `WorkbenchShellState` |
| verbs | `workbenchVerbs`, `performWorkbenchVerb`, `isWorkbenchVerb`, `describeWorkbenchVerb`, `createVerbHandlers`, `WorkbenchVerb*`, `VerbEnvironment`, `BindingConfig`, `SplitPolicy`, `CrossWorkspace`, `PlaceZone`, `canClose`, `clampRatio`, `placementCount` | replaced by `WorkbenchCommand`, `commands.*`, `isWorkbenchCommand`, `describeWorkbenchCommand` (core); `PlaceZone` stays in shell |
| apps | `defineApp`, `createAppRegistry`, `isAppAvailable`, `isDocBound`, `documentSlots`, `AppDescriptor`, `AppProps`, `AppRegistry`, `DefineAppInput`, `AppAvailability` | manifests in core (`WorkbenchAppManifest`, `isDocBound`, `documentSlots`); presentations + `defineWorkbenchApp` in shell |
| documents | `layout`, `workspaces`, `buildLayout`, `workspaceCreateMutation`, `tile`, `split`, `specOf`, `MISSING_APP_ID`, `singleTile`, `emptyDocument`, `serializeDocument`, `parseDocument`, `WORKBENCH_FORMAT`, `WORKBENCH_SCHEMA_VERSION` | move to core (`parseDocument` returns a structured result) |
| describe | `describeWorkbench`, `Described*` | move to core; geometry supplied as a value |
| links | `LINKS_DOC_ID`, `readLinks`, `linksMutation`, `linksChange`, `buildLinkSnapshot`, `createLinkHandlers`, `createLinkRuntime`, `LinkEnvironment`, `LinkHandlers`, `LinkRuntime*`, `WorkbenchLinks`, `bindingsOf`, `linkRefsOf`, `portRefOf`, `createLinkDescriptor`, `createPortDescriptor`, `linkTypeDefinitions`, `workbenchLinkContributions` | runtime/snapshot/document/collaborator to core `links/`; hooks, refs, descriptors, contributions stay in shell |
| React | `WorkbenchContext`, `useWorkbench`, `usePlacement`, hooks (`useBadges`, `useEmitPort`, `useLinkRuntime`, `useLinkSnapshot`, `usePort`), components, `createPlacementController`, `PlacementController*` | shell |
| persistence | `createLocalPersistence`, `readWorkbenchSnapshot`, `PERSISTENCE_VERSION`, `PRE_ENVELOPE_VERSION`, `StorageLike`, `WorkbenchSnapshot` | core `/persistence` subpath |
| sync | `createWorkbenchSync` (subpath) | core `/sync` subpath, batch-preserving |
| rebalance | `buildSlate`, `diagnose`, `propagate`, algorithms, config, `configDocument`, `configStore` | algorithms + config document to core `/rebalance`; `configStore` (React hook) and dialog stay in shell |
| actions | `createWorkbenchPresentationFragment`, `workbenchTileContributions`, `workbenchScopes`, `workbenchTypeDefinitions`, `createTileDescriptor`, `tileRefOf`, `TileRef` | shell, rewritten over commands |

`packages/workbench-protocol/src/client`: `ClientConfig`, `WorkbenchClient`, `createWorkbenchClient` are deleted in Phase 1. Primitive queries and builders stay; builders that mint ids gain an optional `IdGenerator`.

## 3. Intended final entry points

```text
@hyperslop-systems/workbench-protocol
  .            generated types
  ./client     applier, primitive builders/queries, ratios, IdGenerator

@hyperslop-systems/workbench-core
  .            manifests, policy, commands, index, queries, validation, layout builders,
               describe, createWorkbenchCore, createWorkbenchLinks, geometry types
  ./persistence
  ./sync
  ./rebalance  pure algorithms, config, config document
  ./testing    deterministic ids, fixtures helpers (never production)

@hyperslop-systems/pbui-workbench
  .            defineWorkbenchApp, presentations, createWorkbenchShell, context/hooks,
               components, placement controller, geometry measurement, actions fragment,
               link UI descriptors/contributions, rebalance UI + configStore
  ./styles.css
```

### 3.1 Phase 8 additions

- `connectDocumentSource(core, { format, list, subscribe? })`, `documentSourceMutations`, `DocumentSource` (workbench-core): stub documents for host-owned resources that tiles bind, because the core validates `unknown_document` like the Go validator.
- `WorkbenchAppManifest.openBindings` (default false): the application accepts bindings beyond its declared slots; used by the sandbox's `script` application.
- Consumers use them as: pbui-sandbox `programDocumentSource` / `connectProgramLibrary`; pbui-chat `attachWorkbench` (conversations) and "Open in tile" (widgets); the chat demo's world; test harnesses seed with static sources.

## 4. Phase 0 baseline

```text
@hyperslop-systems/workbench-protocol  typecheck pass · 3 files, 48 tests
@hyperslop-systems/pbui-workbench      typecheck pass · 31 files, 281 tests (one timing-sensitive perf test flaked once)
```
