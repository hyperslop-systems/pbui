---
Title: Migrating Datalab consumers to application views and tile placements
Ticket: DATALAB-VIEW-001
Status: review
Topics:
    - frontend
    - authoring
DocType: playbook
Intent: long-term
Owners: []
RelatedFiles:
    - Path: repo://packages/datalab-ui/src/appkit/registry.ts
      Note: Changed internal application component contract
    - Path: repo://packages/datalab-ui/src/index.ts
      Note: Unchanged supported public package surface
    - Path: repo://packages/datalab-ui/src/model/portable.ts
      Note: Version 3 portable bundle schema and parser
    - Path: repo://packages/datalab-ui/src/store/bundles.ts
      Note: Portable graph collection and hydration rules
    - Path: repo://packages/datalab-ui/src/store/layout.ts
      Note: Normalized AppView and placement APIs
    - Path: repo://packages/datalab-ui/src/store/persist.ts
      Note: Version 4 browser persistence and rejection behavior
    - Path: repo://packages/datalab-ui/src/store/templates.ts
      Note: Template library behavior for incompatible contained bundles
ExternalSources: []
Summary: Consumer-impact matrix and operational migration procedure for the Datalab persistence v3 to v4, portable bundle v2 to v3, and internal leaf-owned layout API to normalized application views and tile placements.
LastUpdated: 2026-07-30T17:18:00-04:00
WhatFor: Determine whether a PBUI or Datalab consumer must migrate, preserve valuable browser data safely, update internal source integrations, and verify the normalized view release.
WhenToUse: Use before deploying or consuming the DATALAB-VIEW-001 release, especially when an origin may contain saved workbench state, templates, exported bundles, custom application registrations, or direct imports from Datalab internals.
---


# Migrating Datalab consumers to application views and tile placements

## Purpose

This playbook explains who is affected by the application-view normalization,
what must be backed up before the new build runs, and how to migrate each
supported consumption pattern.

The short answer is:

- Consumers of the generic `@hyperslop-systems/pbui` package do not need to
  migrate.
- Consumers using only the documented root API of
  `@hyperslop-systems/datalab-ui` do not need source changes.
- Standalone Datalab users with saved browser state will start from defaults
  because persistence version 3 is rejected by version 4.
- Stored templates and portable bundles containing bundle version 2 are
  rejected by bundle version 3.
- Source consumers that import Datalab internals or register applications
  against the internal `AppProps` contract must update their code.

For the current project, where there are no external users and no browser state
that must be retained, the recommended migration is to clear the two Datalab
storage keys before or immediately after deploying the new build. Do not add a
runtime compatibility adapter for this case.

## 1. Release boundary

The normalized implementation changes Datalab UI internals. It does not change
the public exports of the generic PBUI package.

### 1.1 Generic PBUI

`@hyperslop-systems/pbui` remains the domain-neutral presentation and component
package. DATALAB-VIEW-001 does not change its documented package entry points.

An application that imports only:

```ts
import {
  Button,
  Dialog,
  Presentation,
  createPbui,
} from "@hyperslop-systems/pbui";
```

does not migrate for this release.

### 1.2 Datalab public package API

The Datalab root entry still exports:

```ts
export { DatalabApp } from "./DatalabApp";
export type { DatalabAppProps } from "./DatalabApp";
export { WorkbenchInstance } from "./components/pages/WorkbenchInstance";
export type { InstanceConfig } from "./components/pages/WorkbenchInstance";
export { routeFor } from "./routes";
export type { Route } from "./routes";
```

The package also retains:

```text
@hyperslop-systems/datalab-ui/styles.css
@hyperslop-systems/datalab-ui/vite
```

A host that mounts `DatalabApp`, mounts `WorkbenchInstance`, imports the
stylesheet, and uses `datalabPublicDir` does not need source changes.

### 1.3 Internal Datalab contract

The following are internal and changed:

- `src/store/layout.ts`
- `src/store/layoutTree.ts`
- `src/appkit/registry.ts`
- layout reducers and verbs
- application component props
- persisted workbench layout
- portable tile, workspace, and stage bundles
- stored templates, because they contain portable bundles

These modules are not exported from the package root. A consumer can depend on
them only by working inside the PBUI repository, maintaining a source fork, or
using unsupported deep imports.

## 2. Impact matrix

Classify each consumer before taking action.

| Consumer | Source migration | Data migration | Recommended action |
|---|---:|---:|---|
| Generic PBUI component consumer | No | No | Upgrade normally and run its existing checks. |
| Datalab host using `DatalabApp` only | No | Maybe | Back up and clear or convert standalone workbench state. |
| Embedded `WorkbenchInstance` with no persistence | No | No | Upgrade and run a browser smoke test. |
| Datalab origin with saved standalone layout | No | Yes | Back up `datadrop-workbench`; clear it or convert v3 to v4 offline. |
| Datalab template-library user | No | Yes | Back up `datadrop-templates`; clear it or convert contained bundles from v2 to v3. |
| User holding clipboard or file bundles | No | Yes | Re-export with the new build or convert the bundle offline. |
| Repository code registering a Datalab application | Yes | Maybe | Change `AppProps` from `leafId`/`docId` to `placementId`/`view`. |
| Code constructing layout trees or dispatching layout actions | Yes | Yes | Normalize views and placements and update reducer calls. |
| Code reading a tile title or document from a leaf | Yes | Yes | Resolve the leaf's `viewId` through `layout.views`. |

## 3. Important behavior during the first new launch

Standalone Datalab stores its durable workbench payload under:

```text
datadrop-workbench
```

The old payload version is 3. The new payload version is 4. The new
`persist.migrate` function accepts only version 4:

```ts
export function migrate(raw: unknown): unknown | null {
  if (!raw || typeof raw !== "object") return null;
  return (raw as { version?: number }).version === 4 ? raw : null;
}
```

When version 4 reads a version-3 value:

1. `load("datadrop-workbench")` rejects it.
2. The console reports that the stored workbench layout is unreadable.
3. `DatalabApp` constructs the default store.
4. The workbench persistence effect can later write the default version-4
   state to the same key.

The old value is therefore not guaranteed to remain available after the new
application has been open. Back up valuable state before loading the new build.

The template library uses:

```text
datadrop-templates
```

Its outer library version remains 1, but every record contains a portable
bundle. Version-2 bundles fail the version-3 parser and are filtered from the
visible template list.

## 4. Pre-upgrade inventory and backup

Perform this section on every browser origin that may contain valuable Datalab
work.

### 4.1 Inventory the integration

From the PBUI repository:

```bash
rg -n \
  'from ["'\''].*store/layout|from ["'\''].*layoutTree|AppProps|leafId|setLeafDoc|setLeafApp|renameLeaf|duplicateLeaf' \
  --glob '*.ts' --glob '*.tsx' .
```

Interpretation:

- No results outside `packages/datalab-ui`: likely a public-API consumer.
- Results in another package or host: internal source migration is required.
- Results for only `DatalabApp`, `WorkbenchInstance`, or the root package:
  source migration is not required.

### 4.2 Back up browser storage

Open the old application, then run this in browser developer tools:

```js
const backup = {
  capturedAt: new Date().toISOString(),
  origin: location.origin,
  workbench: localStorage.getItem("datadrop-workbench"),
  templates: localStorage.getItem("datadrop-templates"),
};

copy(JSON.stringify(backup, null, 2));
```

Paste the copied value into a dated local file. Do not paste it into an issue,
chat, or public repository. Persistence and bundle code scan for
credential-shaped data, but the backup may still contain private document
names, source references, or analytical work.

Confirm the version numbers:

```js
const workbench = JSON.parse(localStorage.getItem("datadrop-workbench") ?? "null");
console.log("workbench version", workbench?.version);

const templates = JSON.parse(localStorage.getItem("datadrop-templates") ?? "null");
console.log(
  "template bundle versions",
  templates?.templates?.map((record) => record.bundle?.version),
);
```

Expected pre-upgrade values are:

```text
workbench version: 3
template bundle versions: [2, 2, ...]
```

### 4.3 Prefer product exports when available

If the old build still runs, record or export the important workspaces, stages,
documents, and titles before changing versions. A version-2 portable export is
not directly accepted by the new build, but it is smaller and easier to inspect
than the complete persistence payload.

For a deployment with no valuable saved state, skip conversion and use the
clear-state procedure in Section 5.

## 5. Recommended migration for the current deployment

Use this procedure when no browser layout or template must be preserved.

### 5.1 Clear Datalab state

In developer tools on the affected origin:

```js
localStorage.removeItem("datadrop-workbench");
localStorage.removeItem("datadrop-templates");
location.reload();
```

This removes:

- the standalone workbench layout and its persisted Datalab documents;
- saved tile, workspace, and stage templates.

It does not remove:

- session-scoped authentication;
- backend datasets;
- generic PBUI state belonging to another application;
- other local-storage keys.

Do not use `localStorage.clear()`. The origin may contain unrelated application
state.

### 5.2 Deploy or install the new Datalab build

Use the repository's normal dependency and publication workflow. The host
source remains:

```tsx
import { createRoot } from "react-dom/client";
import { DatalabApp } from "@hyperslop-systems/datalab-ui";
import "@hyperslop-systems/datalab-ui/styles.css";

createRoot(document.getElementById("root")!).render(<DatalabApp />);
```

### 5.3 Verify new persistence

After interacting with the workbench long enough for its debounced persistence
write:

```js
const raw = localStorage.getItem("datadrop-workbench");
const persisted = raw ? JSON.parse(raw) : null;

console.log({
  version: persisted?.version,
  viewCount: Object.keys(persisted?.layout?.views ?? {}).length,
  viewOrder: persisted?.layout?.viewOrder,
});
```

Expected:

```text
version: 4
viewCount: greater than zero
viewOrder: one entry for every view
```

## 6. Preserving a version-3 workbench offline

Use this procedure only when the old browser state contains work worth
retaining. It is an operational conversion, not an application runtime
migration.

### 6.1 Conversion rule

The old leaf is:

```ts
type OldLeaf = {
  id: NodeId;
  type: "leaf";
  app: AppId;
  docId: DocId | null;
  label?: string;
};
```

The new representation is:

```ts
type NewLeaf = {
  id: NodeId;
  type: "leaf";
  viewId: ViewId;
};

interface AppView {
  id: ViewId;
  appId: AppId;
  documents: Record<string, DocId>;
  title?: string;
}
```

For every old leaf:

1. Mint one fresh `ViewId`.
2. Create one `AppView`.
3. Preserve the old application as `appId`.
4. Convert a non-null `docId` to `documents.primary`.
5. Convert `label` to `title`.
6. Preserve the old leaf `id` as the placement ID.
7. Replace the leaf payload with `viewId`.
8. Append the new `ViewId` to `viewOrder`.

Do not infer linked views from equal application IDs, document IDs, or titles.
The version-3 model had no logical view identity. Two equal old leaves were
independent tiles and must become two independent views.

### 6.2 Pseudocode

```text
convertPersistedV3(old):
    require old.version == 3

    views = {}
    viewOrder = []

    convertNode(node):
        if node.type == "split":
            return {
                ...node,
                a: convertNode(node.a),
                b: convertNode(node.b)
            }

        viewId = freshUUID()
        views[viewId] = {
            id: viewId,
            appId: node.app,
            documents:
                node.docId != null
                    ? { primary: node.docId }
                    : {},
            title:
                nonEmpty(node.label)
                    ? node.label
                    : absent
        }
        viewOrder.push(viewId)

        return {
            id: node.id,
            type: "leaf",
            viewId
        }

    spaces = old.layout.spaces.map(space => ({
        ...space,
        tree: convertNode(space.tree)
    }))

    return {
        ...old,
        version: 4,
        layout: {
            ...old.layout,
            spaces,
            views,
            viewOrder
        }
    }
```

### 6.3 Validation before installation

Validate the converted object independently:

```text
assert converted.version == 4
assert keys(converted.layout.views) == set(converted.layout.viewOrder)
assert converted.layout.viewOrder contains no duplicate

for each workspace:
    for each placement leaf:
        assert converted.layout.views[leaf.viewId] exists

for each view:
    assert view.id equals its dictionary key
    assert view.appId is a string
    assert every document binding is a string
```

Keep three files:

```text
workbench-v3-original.json
workbench-v4-converted.json
workbench-migration-notes.md
```

Do not overwrite the original backup.

### 6.4 Install the converted value

Open the new application only after the backup and validation are complete.
Before the workbench initializes, write the converted payload:

```js
localStorage.setItem(
  "datadrop-workbench",
  JSON.stringify(convertedVersion4Object),
);
location.reload();
```

Then inspect:

- every expected document is present;
- workspace and stage names are present;
- the current stage and workspace are valid;
- each tile shows the expected application;
- document-bound applications show the expected document;
- custom titles are present;
- the console contains no persistence warning.

Hardwired stages and workspaces are recreated from code during load. The merge
may replace stored hardwired trees even after conversion. Validate user-created
workspaces rather than assuming every stored hardwired tile survives.

## 7. Converting portable bundles from version 2 to version 3

The new parser intentionally rejects old bundle versions. The correct default
is to re-create or re-export the layout from the new application. Use offline
conversion only for a bundle that cannot be reproduced.

### 7.1 Tile bundle

Version 2:

```ts
payload: {
  app: string;
  label?: string;
  doc?: PortableDoc;
}
```

Version 3:

```ts
payload: {
  view: {
    app: string;
    title?: string;
    documents: Record<string, number>;
  };
  docs: PortableDoc[];
}
```

Conversion:

```text
new.payload.docs =
    old.payload.doc exists
        ? [old.payload.doc]
        : []

new.payload.view = {
    app: old.payload.app,
    title: old.payload.label if present,
    documents:
        old.payload.doc exists
            ? { primary: 0 }
            : {}
}

new.version = 3
```

### 7.2 Workspace bundle

Version 2 stores application, label, and document index on every leaf. Version
3 stores a view array and makes each leaf reference a view index.

Convert each old leaf to one portable view:

```text
views = []

convertPortableNode(node):
    if node is split:
        return split(
            node.dir,
            node.ratio,
            convertPortableNode(node.a),
            convertPortableNode(node.b)
        )

    index = views.length
    views.push({
        app: node.leaf.app,
        title: node.leaf.label if present,
        documents:
            node.leaf.doc exists
                ? { primary: node.leaf.doc }
                : {}
    })
    return { leaf: { view: index } }

new.payload = {
    name: old.payload.name,
    tree: convertPortableNode(old.payload.tree),
    views,
    docs: old.payload.docs,
    apps: old.payload.apps if present
}
new.version = 3
```

Every old leaf becomes an independent portable view. Do not deduplicate equal
leaf values.

### 7.3 Stage bundle

A version-2 stage hoists documents across workspaces. A version-3 stage hoists
both documents and views.

Use one `views` array while traversing every stage workspace in order:

```text
views = []

for each old workspace:
    new workspace = {
        name: old workspace.name,
        tree: convertPortableNodeUsingSharedViews(old workspace.tree),
        views: [],
        docs: [],
        apps: old workspace.apps if present
    }

new stage payload = {
    name: old payload.name,
    apps: old payload.apps,
    chrome: old payload.chrome,
    spaces: converted workspaces,
    docs: old payload.docs,
    views
}
```

Nested workspace `views` arrays remain empty because stage-level indices refer
to the stage's hoisted `views`.

### 7.4 Validate through the application

After conversion:

- `format` remains `datadrop.layout`;
- `version` is exactly 3;
- `kind` is unchanged;
- `exportedAt` and `name` are preserved;
- document indices are in range;
- view indices are in range;
- every new view contains `documents`;
- tree depth and leaf count remain unchanged.

Paste or import the converted bundle into the new application. Do not consider
the conversion complete until Datalab's actual `parseBundle` accepts it and the
rendered layout has been inspected.

## 8. Migrating the stored template library

The outer template record format does not change. Each contained bundle does.

Backup:

```js
copy(localStorage.getItem("datadrop-templates"));
```

For each template record:

1. Read `record.kind`.
2. Convert `record.bundle` using the corresponding tile, workspace, or stage
   procedure in Section 7.
3. Preserve `id`, `name`, `kind`, and `savedAt`.
4. Preserve the outer library `version: 1`.
5. Write the converted library only after every record succeeds.

If one template cannot be converted, keep it out of the new library and retain
it in the backup. Do not write a partially converted record whose declared kind
does not match its bundle.

The safest operational choice for the current deployment is:

```js
localStorage.removeItem("datadrop-templates");
```

## 9. Migrating internal TypeScript code

Use this section for code inside the PBUI repository or a source fork.

### 9.1 Type mapping

| Before | After |
|---|---|
| `leaf.id` | `placement.id` |
| `leaf.app` | `layout.views[leaf.viewId].appId` |
| `leaf.docId` | `layout.views[leaf.viewId].documents.primary ?? null` |
| `leaf.label` | `layout.views[leaf.viewId].title` |
| `NodeId` used for both geometry and view operations | `NodeId` for geometry, `ViewId` for logical-view operations |
| `LayoutState.spaces` only | `LayoutState.spaces`, `LayoutState.views`, and `LayoutState.viewOrder` |

### 9.2 Application component props

Before:

```ts
export interface AppProps {
  leafId: NodeId;
  docId: DocId | null;
}

function ChartApp({ leafId, docId }: AppProps) {
  // ...
}
```

After:

```ts
export interface AppProps {
  placementId: NodeId;
  view: AppView;
}

function ChartApp({ placementId, view }: AppProps) {
  const docId = primaryDocId(view);
  const viewId = view.id;
  // ...
}
```

Use:

- `placementId` for drag, dock, split, replace, focus, and removal;
- `view.id` for rename and document binding;
- `primaryDocId(view)` for existing document-bound applications;
- `view.documents[role]` for a named non-primary role.

### 9.3 Layout construction

Before:

```ts
const tree = split(
  "row",
  leaf("chart", "doc-a"),
  leaf("table", "doc-a"),
);
```

After:

```ts
const builder = createLayoutBuilder();
const tree = split(
  "row",
  builder.leaf("chart", "doc-a"),
  builder.leaf("table", "doc-a"),
);

const layout = {
  // stages, spaces, pointers...
  views: builder.views,
  viewOrder: builder.viewOrder,
};
```

Use the builder for fixtures and seeded layouts because it registers every
view and returns a valid placement.

To create another placement for an existing view:

```ts
const anotherPlacement = leaf(existingViewId);
```

### 9.4 Reducer and verb mapping

| Before | After | Semantic note |
|---|---|---|
| `setLeafApp({ nodeId, app, docId })` | `createViewInPlacement({ nodeId, appId, docId })` | Creates a new logical view. |
| `setLeafApp(...)` when selecting something already open | `replacePlacementWithView({ nodeId, viewId })` | Links the placement to an existing view. |
| `renameLeaf({ nodeId, label })` | `renameView({ viewId, title })` | All linked placements show the new title. |
| `setLeafDoc({ nodeId, docId })` | `setViewDocument({ viewId, role: "primary", docId })` | All linked placements follow the binding. |
| `duplicateLeaf(nodeId)` | `duplicateView(nodeId)` | Creates a new view and a new placement. |
| No equivalent | `createLinkedDuplicate(nodeId)` | Creates a placement for the same view. |
| `closeLeaf(nodeId)` | `closeLeaf(nodeId)` / `removePlacement` verb | Removes only one placement. |
| No view-wide close | `closeView(viewId)` | Removes all placements and the view. |

Do not replace every old `setLeafApp` with the same new action. The correct
action depends on whether the user chose an application definition or an
existing logical view.

### 9.5 Selectors

Before:

```ts
const leaf = findLeaf(space.tree, placementId);
const appId = leaf?.type === "leaf" ? leaf.app : null;
const docId = leaf?.type === "leaf" ? leaf.docId : null;
```

After:

```ts
const placement = findLeaf(space.tree, placementId);
const view =
  placement?.type === "leaf"
    ? layout.views[placement.viewId]
    : undefined;

const appId = view?.appId ?? null;
const docId = primaryDocId(view);
```

If the caller already has a `ViewId`, do not traverse a workspace tree. Read
the normalized dictionary directly.

### 9.6 Duplication semantics

Choose explicitly:

```text
same view, another rectangle:
    createLinkedDuplicate

new view initialized from the old view:
    duplicateView

new document:
    duplicateDoc
```

`duplicateView` retains document IDs. It copies the binding record but does not
copy Datalab documents.

### 9.7 Singleton semantics

Singleton policy now limits logical views, not placements. Do not count leaves
to decide whether a singleton application may be created. Check whether an
`AppView` already exists for the singleton application:

```text
existing singleton view:
    selectable for linking

new singleton view:
    unavailable
```

## 10. Verification commands

Run from the PBUI repository:

```bash
pnpm --filter @hyperslop-systems/datalab-ui lint
pnpm --filter @hyperslop-systems/datalab-ui typecheck
pnpm --filter @hyperslop-systems/datalab-ui test
pnpm --filter @hyperslop-systems/datalab-ui build
pnpm --filter @hyperslop-systems/datalab-ui build-storybook
pnpm typecheck
pnpm test
git diff --check
```

Expected baseline for DATALAB-VIEW-001:

```text
Datalab lint: pass
Datalab TypeScript: pass
Datalab tests: 37 files, 411 tests
Datalab production build: pass
Datalab Storybook static build: pass
Root PBUI TypeScript: pass
Root PBUI tests: 5 files, 26 tests
```

Run the packed-consumer smoke when preparing a package release:

```bash
pnpm --filter @hyperslop-systems/datalab-ui consumer:smoke
```

## 11. Browser verification

### 11.1 Public host

Verify:

- the host still imports from the package root;
- stylesheet loading succeeds;
- Vite copies the package-owned public assets;
- marketing, tour, device, and workbench routes still resolve;
- no deep import was introduced as part of migration.

### 11.2 Workbench state

Verify:

- the default workbench renders after a clean-state upgrade;
- a custom view title survives reload;
- changing a view's primary document survives reload;
- every workspace renders at least one placement;
- no console warning reports an unreadable version-4 payload.

### 11.3 View behavior

Verify:

1. Open a title menu with left click.
2. Open the same menu with context click.
3. Choose **Create linked duplicate**.
4. Rename either placement.
5. Confirm both placements display the new title.
6. Choose **Duplicate**.
7. Rename the independent copy.
8. Confirm the original linked placements retain their title.
9. Use Replace to choose an existing view.
10. Confirm the title menu says **Close view everywhere** when appropriate.

### 11.4 Portable data

Verify one bundle of each kind:

- tile;
- workspace with two applications reading one document;
- stage with a view or document shared across workspaces.

Round-trip each bundle through the new application and confirm:

- documents retain sharing;
- version-3 view identity retains sharing;
- placement IDs are freshly minted;
- source IDs do not collide with destination IDs.

## 12. Rollback

If the new build must be rolled back:

1. Stop the new build from writing further state.
2. Preserve the current version-4 keys separately.
3. Restore the old application version.
4. Restore the original version-3 workbench backup.
5. Restore the original template-library backup.
6. Reload and verify the old application before deleting any backup.

Do not put a version-4 payload into the old build or a version-3 payload into
the new build and expect partial compatibility. Both versions validate their
supported structure.

Do not solve rollback by changing only the top-level `version` number. The
layout and portable schemas changed structurally.

## 13. Troubleshooting

### The workbench starts with defaults

Inspect:

```js
JSON.parse(localStorage.getItem("datadrop-workbench") ?? "null")?.version
```

- `3`: the new build rejected the old payload; clear it or perform the offline
  conversion.
- `4`: inspect the console for graph validation failures such as a missing
  view or dangling `viewId`.
- `null`: the key was cleared or persistence is disabled.

### Templates disappeared

Inspect:

```js
JSON.parse(localStorage.getItem("datadrop-templates") ?? "null")
  ?.templates
  ?.map((record) => ({
    name: record.name,
    version: record.bundle?.version,
  }));
```

Version-2 records are filtered by the version-3 bundle parser. Restore the
backup and convert or recreate those records.

### TypeScript says `app`, `docId`, or `label` is missing on a leaf

The code is reading application state from geometry. Resolve `leaf.viewId`
through `layout.views`.

### TypeScript says `leafId` or `docId` is missing from `AppProps`

Change the component to accept `placementId` and `view`. Read the primary
document through `primaryDocId(view)`.

### Duplicate behavior appears linked

Inspect the two leaves:

```text
same viewId:
    linked duplicate

different viewId:
    independent duplicate
```

Document IDs may remain equal in both cases. Equal documents do not imply
linked views.

### `docmgr doctor` reports missing PBUI paths

Ticket `repo://` paths are relative to the PBUI repository root. Use:

```text
repo://packages/datalab-ui/...
```

not:

```text
repo://pbui/packages/datalab-ui/...
```

## 14. Exit criteria

Migration is complete when:

- the consumer has been classified using Section 2;
- valuable old browser state has a verified backup;
- no unsupported v3 workbench or v2 bundle is expected to load silently;
- public package consumers compile without deep imports;
- internal applications use `{ placementId, view }`;
- layout leaves contain only `id`, `type`, and `viewId`;
- `layout.views` and `viewOrder` are complete and consistent;
- browser persistence writes version 4;
- new portable exports use bundle version 3;
- linked and independent duplication behave differently by `ViewId`;
- the package, unit, Storybook, and browser checks pass;
- rollback artifacts remain available until the release is accepted.

## 15. Project recommendation

There are currently no external PBUI or Datalab users whose saved state must be
preserved. Use the simple path:

1. Keep the runtime free of v3/v2 compatibility code.
2. Clear `datadrop-workbench` and `datadrop-templates` on development origins.
3. Upgrade the package and host.
4. Run the automated and browser checks.
5. Retain this playbook for a future deployment where saved state has value.

If a real user appears with valuable version-3 state, perform a one-off offline
conversion using Sections 6 through 8. Do not convert that exceptional need
into a permanent runtime adapter without a separate product decision.
