# @hyperslop-systems/pbui-workbench

The PBUI React shell over [`@hyperslop-systems/workbench-core`](../workbench-core/README.md): the tile surface, the launcher, the workspace strip, the rebalance dialog and badge, connect mode, placement mode, and the presentation fragment that puts the workbench's verbs in a product's object menus. It owns no layout semantics — every change is a command the core plans and executes.

```text
workbench-protocol   durable document + primitive mutations
        ↓
workbench-core       manifests, index, validation, pure planner, transactional core
        ↓
pbui-workbench       this package: React presentations, shell-local state, DOM measurement, components
```

## Declare applications once

```ts
import { defineWorkbenchApp } from "@hyperslop-systems/pbui-workbench";

const orders = defineWorkbenchApp({
  manifest: {
    id: "orders",
    viewCardinality: "many",       // "one" | "many"
    duplicatePlacement: "clone",   // "clone" | "link"
    ports: [{ name: "order", direction: "out", contract: "order", doc: "the selected order" }],
  },
  presentation: { title: "Orders", tone: "var(--pbui-tone-orders)", group: "DATA", Component: OrdersTile },
});
```

The manifest is what the engine plans with; the presentation is what the shell renders. They share one id because there is one declaration.

## Build a workbench

```tsx
import { createWorkbench } from "@hyperslop-systems/pbui-workbench";
import { layout, split, tile } from "@hyperslop-systems/workbench-core";

const workbench = createWorkbench({
  apps: [orders, orderDetail],
  initial: layout(split("row", 0.6, tile("orders"), tile("order-detail"))),
  links: shop.presentation.linkDeps({ ... }),   // optional: the product's type graph and relations
});

root.render(
  <>
    <workbench.WorkspaceStrip addLabel="new workspace" />
    <workbench.Surface />
    <workbench.Launcher />
    <workbench.Rebalance />
  </>,
);
```

`createWorkbench` is the convenience over the two constructors: `createWorkbenchCore({ initial, apps: manifests, policy, links })` and `createWorkbenchShell({ core, apps: presentations })`. Use them directly when the core must exist without React (agents, tests, workers).

## Change the layout

```ts
import { commands } from "@hyperslop-systems/workbench-core";

workbench.execute(commands.close(placementId));
workbench.execute(commands.open("order-detail", { order: "o-1042" }, { near: placementId }));
workbench.execute({ kind: "view.show", view: { kind: "existing", viewId }, placement: { kind: "navigate" } });
```

`execute` measures the mounted Surface when the command needs geometry and returns the core's small result: `{ ok: true, changed, placementId?, viewId?, workspaceId? }` or `{ ok: false, code, because, choices? }`. Launcher, rebalance dialog, connect mode, the show chooser and the relation palette are **shell actions**, not commands: `workbench.dispatch({ kind: "launcher.open", from: placementId })`. `workbench.perform(verb)` routes either kind, for a product's verb router.

## Read the workbench

- `workbench.core.getState()` — document, session (`workspaceId`, `activePlacementId`), structural index, revision.
- `workbench.useDocument()`, `workbench.useCoreState(selector)`, `workbench.useShellState(selector)` — React subscriptions.
- `workbench.describe({ geometry: true })` — the agent-facing description with presentation titles and measured rectangles.
- `usePort(view, name)`, `useEmitPort(view, name)`, `useBadges(view)` — an application's ports.

## Persistence and sync

Both live in the core, as subpaths:

```ts
import { createLocalPersistence, readWorkbenchSnapshot } from "@hyperslop-systems/workbench-core/persistence";
import { createWorkbenchSync } from "@hyperslop-systems/workbench-core/sync";

const stored = readWorkbenchSnapshot(KEY, { apps: manifests });
const workbench = createWorkbench({ apps, initial: stored?.document ?? defaultLayout(), initialSession: { workspaceId: stored?.workspaceId } });
createLocalPersistence(workbench.core, { key: KEY });
```

## Object menus

`createWorkbenchPresentationFragment()` contributes the `tile`, `port` and `link` types, their descriptors, and the shared rows (split, duplicate, rename, close, link to…, show details…) to a product's compiled presentation. `tileRefOf(workbench, placementId)` and `portRefOf(badge, snapshot)` build the values those presentations carry.

## Styles

```ts
import "@hyperslop-systems/pbui-workbench/styles.css";
```
