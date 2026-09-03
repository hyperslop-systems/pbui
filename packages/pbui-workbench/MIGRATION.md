# Migrating to pbui-workbench 0.5 / workbench-core 0.1

pbui-workbench 0.5 is a hard cutover (PBUI-WORKBENCH-CORE-1). The engine
moved into `@hyperslop-systems/workbench-core`; pbui-workbench is the React
shell over it. There are no compatibility aliases: the symbols below are gone
and every call site changes.

## Dependencies

Add `@hyperslop-systems/workbench-core`. Keep `@hyperslop-systems/workbench-protocol`
(wire types and applier; `createWorkbenchClient` is removed) and
`@hyperslop-systems/pbui-workbench`. Release order is protocol → core → shell.

## Applications

`defineApp({...})` and `createAppRegistry([...])` are replaced by one
declaration with two halves:

```ts
import { defineWorkbenchApp } from "@hyperslop-systems/pbui-workbench";

const sku = defineWorkbenchApp({
  manifest: { id: "sku", duplicatePlacement: "link", ports: [documentSlotPort("product")] },
  presentation: { title: "SKU", tone: "var(--pbui-tone-product)", Component: SkuApp },
});
```

`manifest` is what the engine plans with: `viewCardinality` (`"one"` for the old
`singleton: true`), `duplicatePlacement` (`"link"` where a split used to link
instead of clone), `ports`, and `openBindings` for an application whose
bindings are declared by what it binds. `presentation` is everything a
renderer needs: the old `defineApp` fields minus the semantic ones.

## Building the workbench

```ts
import { createWorkbench } from "@hyperslop-systems/pbui-workbench";
import { layout, split, tile } from "@hyperslop-systems/workbench-core";

const workbench = createWorkbench({ apps: [sku, inventory], initial: layout(split("row", 0.6, tile("inventory"), tile("sku"))) });
```

`createWorkbench` returns a `WorkbenchShell`: `core`, `apps`, `execute`,
`preview`, `perform`, `dispatch`, `apply`, `serialize`, `restore`, `reset`,
`describe`, `measure`, `useDocument`, `useCoreState`, `useShellState`,
`activePlacementId`, `links`, `linkSnapshot`, `placement`, and the components
`Surface`, `Launcher`, `WorkspaceStrip`, `Rebalance`, `RebalanceBadge`.
`workbench.store` is gone; read state through `workbench.core.getState()`
(`{ document, session: { workspaceId, activePlacementId }, index, revision }`)
and `workbench.core.subscribe`.

## Verbs become commands

`wb.verbs.*` and the `tile.*` verb kinds are replaced by commands, built with
`commands.*` from workbench-core and executed with `workbench.execute`:

| before | after |
| --- | --- |
| `verbs.splitTile(p, dir)` / `tile.split{direction}` | `commands.duplicate(p, axis)` → `placement.duplicate` |
| `tile.split{appId}` | `commands.split(p, axis, appId, documents?)` → `view.show` (split placement) |
| `verbs.closeTile` / `tile.close` | `commands.close(p)` → `placement.close` |
| `tile.swap`, `tile.dock`, `split.resize` | `commands.swap`, `commands.dock`, `commands.resize` → `placement.*` |
| `tile.activate` | `commands.activate(p)` → `session.activatePlacement` |
| `tile.replace{appId}` | `commands.replace(p, appId)` → `view.show` (replace placement) |
| `tile.link{viewId}` | `commands.link(p, viewId)` → `view.show` (existing view, split) |
| `verbs.openView` / `view.open` / `app.place` | `commands.open(appId, documents, { near?, title? })` → `view.show` (auto placement) |
| `view.setTitle`, `view.rebind` | `commands.setTitle`, `commands.rebind` → `view.configure` |
| `view.goTo` | `commands.goTo(viewId)` → `view.show` (navigate) |
| `workspace.select` | `commands.selectWorkspace(id)` → `session.selectWorkspace` |
| `workspace.create/rename/delete/clone` | `commands.createWorkspace/renameWorkspace/deleteWorkspace/cloneWorkspace` |

`execute` returns `{ ok: true, changed, placementId?, viewId?, workspaceId? }`
or `{ ok: false, code, because, choices?, index?, command? }`; it never
throws. `preview` plans without committing. Dialogs are shell actions, not
commands: `launcher.open{from?}`, `launcher.close`, `rebalance.open/close`,
`link.mode.open/close`, `show.chooser.open/close`, `relation.palette.open/close`,
dispatched with `workbench.dispatch` or, together with commands, `workbench.perform(verb)`.

`describeWorkbench(wb, options)` is `workbench.describe(options)`;
`wb.verbs.layoutFits(spec)` is `layoutFits(spec, workbench.measure(), workbench.core.policy.split)`;
`performWorkbenchVerb(wb.verbs, verb)` is `workbench.perform(verb)`.

## Persistence and sync

```ts
import { readWorkbenchSnapshot, createLocalPersistence } from "@hyperslop-systems/workbench-core/persistence";
const stored = readWorkbenchSnapshot(KEY, { migrate, apps: createManifestCatalog(manifestsOf(apps)) });
const workbench = createWorkbench({ apps, initial: stored?.document ?? defaultLayout(), ...(stored?.workspaceId ? { initialSession: { workspaceId: stored.workspaceId } } : {}) });
createLocalPersistence(workbench.core, { key: KEY });
```

Sync moved to `@hyperslop-systems/workbench-core/sync`; the outbox holds whole
batches (`{ id, mutations, destructive }`) and `onDropped(entries, reason)`
reports batches.

## Bindings are validated

The core refuses a view whose binding names an undeclared slot
(`unknown_binding`) or a document that is not in `document.documents`
(`unknown_document`), as the Go validator does; `readWorkbenchSnapshot` with
`apps` discards such a stored layout. A tile that binds a host-owned id (a
session, a file, a catalogue entry) needs a stub document for it:

```ts
import { connectDocumentSource } from "@hyperslop-systems/workbench-core";
connectDocumentSource(workbench.core, { format: "app.session", list: () => sessions.all().map((s) => ({ id: s.id })), subscribe: sessions.subscribe });
```

## Object menus

`createWorkbenchPresentationFragment`, `workbenchTileContributions`,
`tileRefOf` and `TileRef` are unchanged in name; the rules now bind commands.
