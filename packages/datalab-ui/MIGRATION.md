# Migrating to the workbench-core Datalab (PBUI-DATALAB-WORKBENCH-1)

`@hyperslop-systems/datalab-ui` 0.2.0 renders its tiles through
`@hyperslop-systems/workbench-core` and `@hyperslop-systems/pbui-workbench`.
The Redux `layout` slice, the local `Node`/`AppView`/`Workspace` types and the
`SplitView`/`NodeView` renderer are gone. What follows is what an embedder or
a contributor has to change.

## Embedding

- `InstanceConfig.preloaded` is `{ world?, seed? }`. A seed is a
  `DatalabSeed` (a workbench document plus navigation metadata), built with
  `datalabSingleStageSeed(name, spec, allowed?)` from `src/appkit/workbench.ts`
  or `compileSeed(...)` from `src/store/seed.ts`. Layout specs are
  workbench-core's `tile(appId, { documents?, title? })` and
  `split(direction, ratio, a, b)` — note the ratio comes second.
- There is one workbench per `WorkbenchInstance`. Components under it reach
  the core, the shell and the controller through `useDatalabWorkbench()`;
  the current workspace and stage come from `useCurrentWorkspaceId()` and
  `useCurrentStageId()`. Nothing about workspaces is in Redux any more.
- `AppProps.view` is the protocol's `AppView` (`id`, `appId`, `documents`,
  `title?`). Field names are unchanged.

## Lessons and goals

- `Lesson.done` and `Goal.done` receive `(state, workbench)`: the Redux state
  and the core's `{ document, session, index }`. Predicates about tiles read
  the second argument (`leavesOfWorkspace(workbench.index, workbench.session.workspaceId)`).
- `LessonContext.workbench` is the instance's controller; a `run` that used
  to dispatch `layoutActions.*` calls `workbench.splitTile(...)`,
  `workbench.rebindView(...)`, `workbench.createWorkspace(...)`.
- The tour's `Seed` is `{ world, seed }`.

## Persistence

- The local envelope is version 6: `{ version: 6, world, workbench, navigation, workspaceId }`,
  where `workbench` is the workbench document as protobuf JSON. A version-5
  payload is migrated on load; versions 1–4 are refused as before.
- `load(key, apps)` needs the application catalog (`datalabManifests()`) and
  returns `{ world, seed }`; `save(key, world, { document, workspaceId }, navigation)`.

## Behaviour that changed on purpose

- Duplicating a workspace clones the views of clone-able applications
  (chart, table, pipeline, encoding) and links singletons; it used to link
  every view.
- Replacing what a tile shows deletes the old view when nothing else shows
  it; the launcher's "Not shown" group only lists views that arrived
  unplaced (a remote adoption, an import).
- Every spatial refusal is a result with a code (`pinned_workspace`,
  `last_workspace_in_stage`, `pinned_stage`, `last_stage`, plus the core's
  own), never a silent no-op reducer.
- A stored `workspaceId` that no longer exists lands on the work stage's
  remembered workspace, never on the first page in document order.

## Where things went

| Was | Is |
|---|---|
| `store/layout.ts` reducers | `store/controller.ts` (policy) + workbench-core commands |
| `store/layout.ts` stages, `currentStageId` | `store/navigation.ts` (derived current stage) |
| `store/layoutTree.ts` | `@hyperslop-systems/workbench-protocol/client` |
| `store/stages.ts` `pinnedStages`, `defaultLayout`, `singleStageLayout`, `mergeStages` | `store/seed.ts` `pinnedDefinitions`, `defaultSeed`, `singleStageSeed`; `store/merge.ts` `mergePinned` |
| `store/applyLayoutVerb.ts` | `store/workbenchVerbs.ts` |
| `remote/codec.ts` node/view conversion, `RemoteWorkbenchState` | `remote/projection.ts` (`projectWorkStage`, `mergeRemoteWorkStage`) |
| `organisms/SplitView`, spatial half of `organisms/Tile` | `workbench.shell.Surface` with `renderDatalabTitle` / `renderDatalabTileAction` |

Design and diary: `ttmp/2026/09/03/PBUI-DATALAB-WORKBENCH-1--consolidate-datalab-workspace-semantics-onto-workbench-core/`.
