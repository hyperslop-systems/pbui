---
Title: Application views, linked tile placements, launcher, and replacement switcher implementation guide
Ticket: DATALAB-VIEW-001
Status: complete
Topics:
    - frontend
    - authoring
DocType: design-doc
Intent: long-term
Owners: []
RelatedFiles:
    - Path: repo://packages/datalab-ui/src/appkit/registry.ts
      Note: Defines application descriptors and component props
    - Path: repo://packages/datalab-ui/src/apps/LauncherApp/LauncherApp.tsx
      Note: Renders the shared view switcher in an empty Launcher placement
    - Path: repo://packages/datalab-ui/src/components/organisms/Tile/Tile.tsx
      Note: Resolves placement references and renders title-menu and Replace interactions
    - Path: repo://packages/datalab-ui/src/components/organisms/ViewSwitcher/model.ts
      Note: Encodes shared scoped existing-view and new-application selection policy
    - Path: repo://packages/datalab-ui/src/model/portable.ts
      Note: Defines portable tile workspace and stage data
    - Path: repo://packages/datalab-ui/src/pbui/descriptors/tile.ts
      Note: Defines current title object-menu actions
    - Path: repo://packages/datalab-ui/src/pbui/verbs.ts
      Note: Defines serializable PBUI user intents
    - Path: repo://packages/datalab-ui/src/store/applyLayoutVerb.ts
      Note: Maps tile and workspace verbs to Redux actions
    - Path: repo://packages/datalab-ui/src/store/bundles.ts
      Note: Hydrates portable identities into local state
    - Path: repo://packages/datalab-ui/src/store/layout.ts
      Note: Owns workspaces and current tile mutation semantics
    - Path: repo://packages/datalab-ui/src/store/layoutTree.ts
      Note: Defines the current combined leaf and split-tree geometry model
    - Path: repo://packages/datalab-ui/src/store/persist.ts
      Note: Validates and serializes durable layout state
ExternalSources: []
Summary: Design and phased implementation guide for separating logical application views from workspace placements.
LastUpdated: 2026-07-30T16:12:00-04:00
WhatFor: Implement a reusable view model without turning PBUI into a window manager.
WhenToUse: Use when changing layout state, tile actions, app selection, persistence, bundles, or keyboard view navigation.
---


# Application views, linked tile placements, launcher, and replacement switcher implementation guide

## Executive summary

PBUI currently stores a tile's application, optional document, and label directly
inside the leaf of a workspace layout tree. The leaf identifier is simultaneously
a geometry identifier, a drag target, a React key, a rename target, and the only
identity for what the user perceives as an open application. This works while a
tile is merely a rectangle that renders globally stored state. It becomes
ambiguous when an open application must outlive one rectangle, appear in several
workspaces, bind several documents, participate in a launcher, or be selected
through an Alt-Tab-style interface.

This design introduces a normalized `AppView` entity. An `AppView` represents one
logical open application: an application definition, named document bindings,
and an optional user title. A workspace leaf becomes a `TilePlacement`
containing only a placement identifier and a `viewId`. Several placements may
reference the same view, including placements in different workspaces.

The user-visible distinction is explicit:

- **Create linked duplicate** creates another placement that references the same
  `viewId`. Changes to the view's title, application, document bindings, or
  persistent view state are visible in every linked placement.
- **Duplicate** creates a new `AppView` copied from the source and a placement
  that references the new `viewId`. Subsequent view-level changes are
  independent. Referenced domain documents are not copied.

All view actions live in the object menu opened from the tile title. Both
left-click and right-click on the title open the same menu. Left-click no longer
starts inline rename. Rename remains available as a menu action. A **Replace**
action opens a unified switcher that contains the application choices currently
shown in the application selector plus existing views that are legal in the
current scope. Choosing an application creates a new view; choosing an existing
view links the current placement to it.

The implementation is deliberately phased. The first release adds only the
normalized view table, placement references, the two duplicate operations, one
title menu, and one shared Replace/Launcher switcher. Keyboard navigation,
general application state, and richer multi-document declarations can build on
the same identities later. No backend or CRDT work is part of this ticket.

## 1. Purpose and scope

### 1.1 Goals

The implementation must:

1. Separate logical application identity from workspace geometry.
2. Let one logical view appear in multiple placements and workspaces.
3. Represent a view as functionality plus explicitly named open documents.
4. Distinguish linked duplication from independent duplication.
5. Put all view actions behind the tile title's left- and right-click menu.
6. Replace the compact application selector with a switcher that includes both
   application definitions and existing views.
7. Keep closing a placement separate from closing a view or deleting a document.
8. Preserve the current stage/workspace application-scope rules.
9. Provide clean foundations for a launcher and recent-view keyboard switcher.
10. Deliver these changes incrementally without introducing a generalized
    desktop, process, tab, or plugin runtime.

### 1.2 Non-goals

This ticket does not:

- change the Go backend;
- synchronize views or layouts between clients;
- introduce CRDTs, collaboration, or conflict resolution;
- model operating-system processes or windows;
- copy domain documents when a view is duplicated;
- provide backward-compatibility adapters for old Redux APIs;
- require application-specific state to move into `AppView` immediately;
- require the Alt-Tab-style keyboard switcher in the first shipping phase.

The persisted browser payload and portable bundle schemas are part of the
frontend and must eventually adopt the new representation. Unless a separate
product requirement says otherwise, implementation should make a clean schema
version change rather than retain both object models.

### 1.3 Pragmatic first-release boundary

The smallest useful release consists of:

```text
State:
  views[viewId] = { id, appId, documents, title? }
  leaf = { id, type: "leaf", viewId }

Commands:
  Replace
  Rename
  Create linked duplicate
  Duplicate
  Remove from this workspace

Interface:
  title click → object menu
  Replace → existing views + current application choices
```

The first release does not need:

- a new Redux slice;
- a generic application-state container;
- application-declared document-role schemas;
- MRU history or global keyboard interception;
- processes, tabs, windows, sessions, or lifecycle services;
- automatic orphan cleanup;
- collaborative identifiers or CRDT metadata;
- a generalized command framework beyond the existing PBUI verbs.

These exclusions are implementation constraints. A future extension should be
added only in response to a concrete behavior, not because the normalized model
could theoretically support it.

## 2. Vocabulary

The following terms are normative:

- **Application definition (`AppDescriptor`)**: registered functionality such
  as Chart, Table, Pipeline, Upload, or Inspector.
- **Domain document (`GraphicDocument`)**: durable user data and authoring state.
  Several views may reference one document.
- **Application view (`AppView`)**: one logical open use of an application,
  including its document bindings and optional title.
- **Tile placement (`TilePlacement`)**: one occurrence of a view at one leaf of a
  workspace layout.
- **Workspace**: a named split-tree arrangement of placements.
- **Linked placement**: another placement referencing an existing view.
- **Linked duplicate**: the command that creates a linked placement adjacent to
  the source.
- **Independent duplicate**: a copied view plus a new adjacent placement.
- **Replace switcher**: the selector opened by the Replace action. It offers
  existing views and application definitions.
- **Launcher**: an empty-placement presentation of the same selection model used
  by Replace.

“Tile” should refer to the rendered rectangle and its placement. It should not
be used as the name of the normalized logical object.

## 3. Current object model

### 3.1 Layout ownership

The layout tree currently defines a leaf as:

```ts
type Node =
  | {
      id: NodeId;
      type: "leaf";
      app: AppId;
      docId: DocId | null;
      label?: string;
    }
  | {
      id: NodeId;
      type: "split";
      dir: "row" | "col";
      a: Node;
      b: Node;
      ratio: number;
    };
```

Evidence: `packages/datalab-ui/src/store/layoutTree.ts:1-17`.

Each `Workspace` owns one such tree:

```ts
interface Workspace {
  id: string;
  name: string;
  tree: Node;
  stageId: StageId;
  apps?: AppId[] | null;
  pinned?: boolean;
}
```

Evidence: `packages/datalab-ui/src/store/layout.ts:118-148`.

The existing hierarchy is therefore:

```text
Stage
└── Workspace
    └── split tree
        └── leaf
            ├── geometry identity
            ├── application identifier
            ├── document identifier
            └── user label
```

There is no collection of open application views outside workspace trees.

### 3.2 Application contract

Applications register a stateless descriptor containing `id`, `title`, `tone`,
`docBound`, `duplicable`, `singleton`, and a React component. The component is
called with `leafId` and `docId`.

Evidence: `packages/datalab-ui/src/appkit/registry.ts:26-70`.

`docBound` is currently true for applications that are views of one composition.
This is a cardinality-one distinction. It cannot describe applications with two
documents playing different roles.

`singleton` is evaluated against other application identifiers in the current
workspace. This rule assumes application type is sufficient identity. After
normalization, singleton policy must state whether it limits view creation,
placement count, or placement count per workspace.

### 3.3 Rendering and title interaction

`Tile.tsx` resolves `node.app`, looks up `node.docId`, derives a title, and passes
the leaf identity and document to the application component. The current
left-click activation of the title begins rename, while right-click opens the
PBUI object menu.

Evidence:

- `packages/datalab-ui/src/components/organisms/Tile/Tile.tsx:28-77`
- `packages/datalab-ui/src/components/organisms/Tile/Tile.tsx:126-199`
- `packages/datalab-ui/src/components/organisms/Tile/Tile.tsx:234-252`

The title's `Presentation` value currently carries the full leaf payload needed
by the menu: node ID, app, title, label, document, duplicability, and whether the
leaf may close. This is evidence of the conflation: a menu described as a tile
menu acts partly on geometry and partly on logical content.

### 3.4 Application selection

The title bar includes a `SelectInput` whose values are application identifiers.
Changing it dispatches `setLeafApp`, mutating the current leaf in place.

Evidence: `packages/datalab-ui/src/components/organisms/Tile/Tile.tsx:203-211`.

The current option calculation:

- includes the current application even if it is outside the active scope;
- filters the application registry by instance, stage, and workspace scope;
- hides singleton applications already present in another leaf.

Pre-implementation evidence:
`packages/datalab-ui/src/components/organisms/Tile/options.ts:59-95` at commit
`0fa0142`. The shipped successor is
`packages/datalab-ui/src/components/organisms/ViewSwitcher/model.ts`.

The launcher shows buttons for the same scoped applications and calls
`setLeafApp`. It has no concept of existing open views.

Evidence: `packages/datalab-ui/src/apps/LauncherApp/LauncherApp.tsx:33-66`.

### 3.5 Duplication and movement

`duplicateLeaf` creates a new leaf ID, copies `app`, `docId`, and label, and
places it beside the original. Both leaves reference the same domain document,
but they are unrelated layout entities.

Evidence: `packages/datalab-ui/src/store/layout.ts:344-391`.

`cloneSpace` deep-copies the layout and mints every node ID again. App and
document values survive as copied scalar references; no logical tile identity
survives.

Evidence:

- `packages/datalab-ui/src/store/layoutTree.ts:66-75`
- `packages/datalab-ui/src/store/layout.ts:499-520`

`swapTiles` leaves geometric IDs in place and exchanges `app`, `docId`, and
`label` as a “view payload.” That comment identifies the missing entity:
application binding and label already behave as a unit, but the unit has no ID.

Evidence: `packages/datalab-ui/src/store/layout.ts:401-420`.

`dockTile` moves a source leaf rather than copying it. Its guard explicitly
prevents the same leaf from occurring twice in one tree.

Evidence: `packages/datalab-ui/src/store/layout.ts:429-451`.

### 3.6 Persistence and portable data

Persistence serializes the complete layout tree and validates leaves by checking
for a string `app`. The current durable payload version is 3.

Evidence:

- `packages/datalab-ui/src/store/persist.ts:29-46`
- `packages/datalab-ui/src/store/persist.ts:59-87`
- `packages/datalab-ui/src/store/persist.ts:132-179`
- `packages/datalab-ui/src/store/persist.ts:181-211`

The bundle model also serializes tile/workspace/stage layouts. Its hydration and
replacement paths preserve a target leaf ID while replacing the leaf's
application payload. These paths must be redesigned so bundles can contain a
view and a placement reference without dangling identifiers.

Evidence:

- `packages/datalab-ui/src/model/portable.ts`
- `packages/datalab-ui/src/store/bundles.ts`
- `packages/datalab-ui/src/store/effects.ts:258`
- `packages/datalab-ui/src/store/layout.ts:657-695`

## 4. Gap analysis

### 4.1 Placement identity is not view identity

`NodeId` must remain stable for geometry, React keys, focus, drag hit testing,
and divider operations. Those concerns do not define whether two rectangles show
the same logical application. Moving view fields out of the leaf lets each
identity change independently.

### 4.2 One document reference is insufficient

`docId` cannot describe comparison, merge, composition, or cross-document
applications without hidden state. An array would provide cardinality but not
meaning. Named document bindings allow applications to distinguish `primary`,
`left`, `right`, `baseline`, or other domain roles.

### 4.3 Existing views cannot be launched

The application selector and launcher only enumerate application definitions.
They can create or repoint functionality, but cannot ask the user to select an
already open logical view.

### 4.4 Duplication semantics are overloaded

Current Duplicate creates an independent leaf with copied view fields. Once
view-level state exists, users need two operations:

```text
Create linked duplicate:
  placement B ──► view 1 ◄── placement A

Duplicate:
  placement A ──► view 1
  placement B ──► view 2 (copied from view 1)
```

The command names and reducers must make this distinction impossible to miss.

### 4.5 Closing has no independent lifecycle

Today closing the leaf closes the only representation of the tile. A normalized
view can remain open with zero placements, and one of several linked placements
can close without closing the view. The UI needs separate **Remove from
workspace** and **Close view** semantics.

## 5. Proposed state model

### 5.1 Core types

The first implementation should keep all normalized state in the existing
`layout` slice. A separate Redux slice, repository layer, service abstraction,
event bus, or entity framework is not required merely because the state is
normalized.

```ts
export type ViewId = string;
export type PlacementId = NodeId;
export type DocumentBindings = Record<string, DocId>;

export interface AppView {
  id: ViewId;
  appId: AppId;
  documents: DocumentBindings;
  title?: string;
}

export type Node =
  | {
      id: PlacementId;
      type: "leaf";
      viewId: ViewId;
    }
  | {
      id: NodeId;
      type: "split";
      dir: "row" | "col";
      a: Node;
      b: Node;
      ratio: number;
    };

export interface LayoutState {
  stages: Stage[];
  currentStageId: StageId;
  spaces: Workspace[];
  currentSpaceId: string;

  views: Record<ViewId, AppView>;
  viewOrder: ViewId[];

  pendingImport?: PendingImport | null;
  renamingId?: ViewId | null;
  notice?: Notice | null;
}
```

`viewOrder` provides deterministic launcher order and persistence. It should not
double as recent-use order. A later keyboard switcher can keep transient MRU
state separately.

Do not add a generic `state` field in the first implementation. Existing
application state remains where it is. Add typed view configuration only when a
concrete application requires it; domain data still belongs in documents or
world state.

### 5.2 Identity and ownership invariants

Reducers and validators must enforce:

1. Every leaf references exactly one existing view.
2. Every `viewOrder` entry names an existing view exactly once.
3. Every existing view occurs in `viewOrder` exactly once.
4. A view may be referenced by zero or more leaves.
5. A leaf occurs in exactly one workspace tree.
6. A view's document binding either names an existing document or is retained as
   an explicitly unresolved reference during bundle preview; live state should
   not contain unresolved bindings.
7. Split-node IDs and placement IDs are globally unique within the layout.
8. View IDs are globally unique within the workbench instance.
9. Removing a placement never deletes a view or a document implicitly.
10. Duplicating a view never duplicates a document implicitly.

### 5.3 Minimal first-release document contract

The first release keeps the existing `docBound` behavior and stores the current
single document under a conventional `primary` key:

```ts
function primaryDocument(view: AppView): DocId | null {
  return view.documents.primary ?? null;
}
```

Non-document applications use `{}`. This provides a stable future shape without
requiring every application to adopt a new registry API in the same release.

### 5.4 Deferred document-role extension

When the first real multi-document application is implemented, application
definitions may declare document roles:

```ts
export interface AppDocumentRole {
  id: string;
  title: string;
  required: boolean;
  cardinality?: "one" | "many";
}

export interface AppDescriptor {
  id: AppId;
  title: string;
  tone: string;
  documentRoles: readonly AppDocumentRole[];
  duplicable: boolean;
  singleton: boolean;
  Component: ComponentType<AppProps>;
}
```

This declaration is not required for the first release. It is shown so the
initial `documents` representation does not block a known next requirement.
`docBound` should be removed only when a concrete multi-document implementation
justifies updating the application contract.

### 5.5 Rendering contract

The eventual application contract can distinguish placement context from
logical view context:

```ts
export interface AppProps {
  placementId: PlacementId;
  view: AppView;
}
```

The first release should continue using the current application props and adapt
inside `Tile`:

```ts
const view = useSelector(selectView(node.viewId));
const docId = view.documents.primary ?? null;

<Component leafId={node.id} docId={docId} />
```

This is a small internal call-site change, not a second exported compatibility
API. Do not rewrite all applications until one needs the complete view.

### 5.6 State diagram

```text
RootState.layout
│
├── views
│   ├── view-chart-yield
│   │   ├── appId: "chart"
│   │   ├── documents.primary: "doc-production"
│   │   └── title: "Yield by station"
│   └── view-table-raw
│       ├── appId: "table"
│       └── documents.primary: "doc-production"
│
└── spaces
    ├── workspace-analysis
    │   └── tree
    │       ├── placement-left  ─────► view-chart-yield
    │       └── placement-right ─────► view-table-raw
    │
    └── workspace-summary
        └── tree
            └── placement-main ──────► view-chart-yield
```

The two chart placements are linked. The table is a separate view even though it
references the same document.

## 6. View and placement operations

### 6.1 Primitive reducers

Reducers should expose explicit operations rather than a generic patch action:

```ts
createView({
  id: ViewId,
  appId: AppId,
  documents: DocumentBindings,
  title?: string,
})

assignViewToPlacement({
  placementId: PlacementId,
  viewId: ViewId,
})

renameView({
  viewId: ViewId,
  title: string,
})

setViewDocument({
  viewId: ViewId,
  role: string,
  docId: DocId | null,
})

removePlacement({
  placementId: PlacementId,
})

closeView({
  viewId: ViewId,
})
```

Action preparation should mint IDs outside reducer bodies so Redux actions remain
replayable, following the existing `duplicateLeaf` convention.

### 6.2 Create linked duplicate

The source placement remains unchanged. The reducer creates one new leaf next to
it and copies only `viewId`.

```ts
linkedDuplicatePlacement({
  placementId,
  newPlacementId,
  splitId,
  dir,
})

function reduce(state, action) {
  source = findLeaf(state.currentWorkspace.tree, action.placementId);

  linked = {
    id: action.newPlacementId,
    type: "leaf",
    viewId: source.viewId,
  };

  replace source with split(source, linked, action.splitId, action.dir);
}
```

Effects:

- both placements render the same view;
- renaming from either placement changes both titles;
- replacing the primary document changes both;
- future persistent view state changes both;
- closing either placement leaves the other intact;
- closing the view affects both placements.

The menu label should be exactly **Create linked duplicate**. “Linked copy” and
“mirror” should not appear as competing terms.

### 6.3 Duplicate

Duplicate copies the view and creates a placement for the copy:

```ts
duplicateViewIntoAdjacentPlacement({
  placementId,
  newViewId,
  newPlacementId,
  splitId,
  dir,
})

function reduce(state, action) {
  sourcePlacement = findLeaf(...);
  sourceView = state.views[sourcePlacement.viewId];

  copiedView = {
    ...deepCloneSerializable(sourceView),
    id: action.newViewId,
    title: copyTitle(sourceView.title),
  };

  state.views[copiedView.id] = copiedView;
  state.viewOrder.push(copiedView.id);

  copiedPlacement = {
    id: action.newPlacementId,
    type: "leaf",
    viewId: copiedView.id,
  };

  place copiedPlacement adjacent to sourcePlacement;
}
```

Document IDs remain references to the same documents. “Duplicate view” must not
dispatch the world-level `duplicateDoc` operation.

If typed view configuration is introduced later, its duplication semantics must
be specified then. The first release has no generic nested state to clone.

### 6.4 Replace

Replace changes which view a placement references. It does not mutate or close
the previous view:

```ts
replacePlacementView({ placementId, viewId });
```

If the replaced view now has zero placements, it remains available in the
switcher. This is required for launcher and recent-view behavior. A separate
Close view action removes it.

### 6.5 Close placement and close view

The title menu should use unambiguous labels:

- **Remove from this workspace** removes only the selected placement.
- **Close view everywhere** removes the logical view and all its placements.

Closing the last placement in a workspace should replace it with an empty
launcher placement rather than leave the workspace without a tree. Closing a
view with several placements should replace or collapse each occurrence using
the same deterministic tree-repair rule.

Recommended algorithm:

```ts
function closeViewEverywhere(state, viewId) {
  for (workspace of state.spaces) {
    workspace.tree = removeEveryLeafReferencing(workspace.tree, viewId);

    if (workspace.tree === null) {
      const launcherView = ensureLauncherView(state);
      workspace.tree = placement(launcherView.id);
    }
  }

  delete state.views[viewId];
  remove viewId from state.viewOrder;
}
```

An alternative is for launcher to be placement UI rather than an `AppView`.
That option is discussed in Decision 5.

## 7. Title action menu

### 7.1 Interaction requirement

When the title is not being edited:

- left-click opens the view action menu;
- right-click opens the same action menu;
- keyboard Enter or Space opens the same menu;
- neither left-click nor double-click starts rename directly;
- Rename is selected from the menu and then opens `InlineRename`;
- the drag grip remains a separate pointer target and must not open the menu.

This intentionally replaces the current `onActivate={() => setRenaming(true)}`
behavior in `Tile.tsx:187`.

The title should continue to be a PBUI `Presentation`, because the object-menu
descriptor, action trace, keyboard support, and mouse documentation are already
centralized there. The left-click activation should call the same menu-opening
path that a context-menu event uses. Do not implement a second custom menu.

Conceptual component code:

```tsx
<Presentation
  reference={{ type: "view", value: toViewRef(view, placement) }}
  doc={`<view> ${displayTitle}`}
  onActivate={({ anchor }) => pbui.openMenu(reference, anchor.x, anchor.y)}
  activateDoc="view actions"
>
  <TitleText>{displayTitle}</TitleText>
</Presentation>
```

The exact PBUI `Presentation` activation API may need a small package-level
extension if it cannot currently request its own object menu. That extension
should be generic and tested in `Pbui.stories.tsx`, not specialized to Datalab.

### 7.2 Menu structure

Recommended order:

```text
Replace …
Rename …

Create linked duplicate
Duplicate

Split right
Split below

Copy view to clipboard
Replace from clipboard …
Save as template …

Inspect
Remove from this workspace
Close view everywhere
```

Placement operations and view operations may share one menu because the title is
the primary handle for the displayed view. Labels must identify scope when the
difference is consequential.

The existing descriptor in
`packages/datalab-ui/src/pbui/descriptors/tile.ts` should be renamed or replaced
with a descriptor whose value includes both IDs:

```ts
interface ViewPresentationRef {
  viewId: ViewId;
  placementId: PlacementId;
  appId: AppId;
  title: string;
  documentIds: DocId[];
  placementCount: number;
  canRemovePlacement: boolean;
  canDuplicateView: boolean;
}
```

The descriptor remains a pure function. It should not query Redux.

### 7.3 Rename scope

Rename changes `AppView.title`, not a placement label. Linked placements
therefore share the same title.

The initial model should not add `placementTitleOverride`. A per-placement title
would make linked placements appear unrelated and reintroduce the ambiguity this
ticket removes. It can be added later only for a concrete use case.

## 8. Unified Replace switcher

### 8.1 One content model, two entry points

The launcher and Replace action should render the same selection component:

```tsx
<ViewSwitcher
  placementId={placementId}
  mode="replace"
  onComplete={closePopoverOrLauncher}
/>
```

The launcher embeds it in an empty tile. Replace opens it in a popover, dialog,
or anchored panel. Visual containment differs; selection semantics do not.

### 8.2 Sections

The switcher contains:

```text
EXISTING VIEWS
  Yield by station       Chart · production data       shown in 2 places
  Raw production rows    Table · production data
  Encoding setup         Encoding · production data

NEW VIEW
  Chart
  Table
  Pipeline
  Encoding
  ...
```

Existing views should display:

- resolved display title;
- application title;
- bound document names, when present;
- the number of placements when greater than one;
- whether the view is already shown in the current workspace.

Applications should retain the same scope and singleton filtering rules as the
current selector. The switcher must reuse a pure selection-model function rather
than independently reimplementing those rules.

### 8.3 Selection semantics

Selecting an existing view:

```ts
perform({
  kind: "replacePlacementWithView",
  placementId,
  viewId,
});
```

This makes the selected placement another linked occurrence if the view is
already placed elsewhere. It does not move the other occurrence.

Selecting an application:

```ts
perform({
  kind: "createViewInPlacement",
  placementId,
  viewId: newId(),
  appId,
  documents: defaultBindings(appId, activeDocId),
});
```

The default binding policy should initially reproduce current behavior:
document-bound applications use the active document when available; other
applications use no bindings.

### 8.4 Filtering existing views

An existing view is selectable when:

1. Its application is allowed by the current instance, stage, and workspace
   scope, or it is already assigned to the current placement.
2. Assigning it does not violate a placement policy.

Application singleton policy requires revision:

- A world-singleton application should have at most one logical view.
- That one view may have multiple linked placements.
- Therefore an existing singleton view remains selectable.
- The application definition is hidden or disabled in **New view** once its view
  exists.

This is a better fit than the current “one app per workspace” rule. It allows the
same Inspector or Trace view to be displayed in several workspaces without
creating redundant logical instances.

### 8.5 Accessibility

The switcher must:

- use a dialog/listbox or combobox pattern appropriate to its visual container;
- autofocus search or the first item;
- expose section labels;
- expose application, document, and placement-count metadata in accessible
  names or descriptions;
- support Arrow keys, Home, End, Enter, and Escape;
- restore focus to the originating title after dismissal;
- never rely on color to distinguish existing views from new applications.

## 9. Launcher and keyboard navigation

### 9.1 Launcher

The present Launcher application is a special leaf application. In the first
shipping implementation it can remain registered, but its body should render
`ViewSwitcher`. Selecting an existing view assigns it to the placement.
Selecting an application creates a view and assigns it.

Longer term, launcher is better understood as the empty state of a placement,
not as a logical open view. That cleanup should occur only after the normalized
model is stable.

### 9.2 Recent-view switcher

The normalized IDs allow an Alt-Tab-style switcher without changing persisted
workspace ownership:

```ts
interface ViewNavigationState {
  recentViewIds: ViewId[];
  focusedPlacementId: PlacementId | null;
}
```

MRU focus history is transient, per browser viewer, and excluded from
persistence. A first navigation policy can be:

1. If the selected view has a placement in the current workspace, focus it.
2. Otherwise assign the view to the currently focused placement.
3. If no placement is focused, focus the view's most recently used occurrence.

This behavior should be a later phase. The object model must support it, but the
initial normalization should not be blocked on global keyboard UX.

## 10. Drag, swap, and docking semantics

Current drag behavior distinguishes center swap from edge dock. After
normalization:

- **Center drop** swaps `viewId` values between placements.
- **Edge dock** moves the source placement, preserving its placement ID and
  `viewId`.
- A modifier-assisted edge drop may later create a linked placement, but that is
  not part of the initial design.

Pseudocode:

```ts
function swapPlacementViews(state, firstId, secondId) {
  first = findLeaf(...);
  second = findLeaf(...);
  [first.viewId, second.viewId] = [second.viewId, first.viewId];
}
```

This is simpler than the current three-field swap and makes the code match its
existing “view payload” comment.

## 11. Persistence and bundle schemas

### 11.1 Browser persistence

The persisted layout must include:

```ts
interface PersistedLayout {
  stages: Stage[];
  currentStageId: StageId;
  spaces: Workspace[];
  currentSpaceId: WorkspaceId;
  views: Record<ViewId, AppView>;
  viewOrder: ViewId[];
}
```

Validation must check references, not merely shapes:

```ts
function validateLayout(layout): boolean {
  if (!allViewsValid(layout.views)) return false;
  if (!isUniquePermutation(layout.viewOrder, keys(layout.views))) return false;

  for (space of layout.spaces) {
    if (!isNode(space.tree)) return false;
    for (leaf of leaves(space.tree)) {
      if (!layout.views[leaf.viewId]) return false;
    }
  }

  return true;
}
```

The storage version should be bumped. Per the project instruction against
unrequested compatibility layers, this ticket does not prescribe retaining the
old leaf shape or a dual reader. If preserving existing local browser layouts
becomes a product requirement, approve and implement one one-time conversion
from `{app, docId, label}` to distinct view objects.

### 11.2 Portable tile bundles

A portable “tile” now requires both view content and a root placement:

```ts
interface PortableViewBundle {
  format: "datadrop.view";
  version: 2;
  view: PortableAppView;
  documents: Record<PortableDocId, PortableDocument>;
}
```

Importing into a placement should create a new local view ID, remap imported
document IDs, and assign the new view to the existing target placement. The
target placement ID remains stable.

Export should export the logical view, not a placement ID. Geometry belongs to
workspace and stage bundles.

### 11.3 Workspace and stage bundles

Workspace and stage bundles must include:

- each exported tree with placement IDs;
- the transitive set of views referenced by those trees;
- the transitive set of documents referenced by those views.

Hydration order:

```text
Validate envelope
    ↓
Mint/remap document IDs
    ↓
Mint/remap view IDs and rewrite document bindings
    ↓
Mint/remap node IDs and rewrite leaf view IDs
    ↓
Insert workspace/stage
```

If two placements referenced one view before export, both must reference the
same remapped view after import. A naive “hydrate each leaf” loop would destroy
linked identity and is therefore incorrect.

## 12. Selectors and query APIs

Central selectors reduce repeated tree walks:

```ts
selectView(state, viewId): AppView | null

selectPlacement(state, placementId): {
  workspace: Workspace;
  placement: TilePlacement;
} | null

selectPlacementCountForView(state, viewId): number

selectPlacementsForView(state, viewId): Array<{
  workspaceId: WorkspaceId;
  placementId: PlacementId;
}>

selectResolvedViewTitle(state, viewId): string

selectExistingViewOptions(state, placementId): ViewOption[]

selectNewApplicationOptions(state, placementId): AppOption[]
```

`selectResolvedViewTitle` should use:

1. explicit `view.title`;
2. application title plus primary document name;
3. application ID when the descriptor is unavailable.

Selectors that use the registry must remain aware that the registry is not Redux
state. Pure helper functions may accept descriptors as explicit input when
memoization or testing requires it.

## 13. PBUI verb and descriptor changes

Add explicit verbs:

```ts
type LayoutVerb =
  | { kind: "openViewMenu"; placementId: PlacementId }
  | { kind: "beginRenameView"; viewId: ViewId }
  | { kind: "renameView"; viewId: ViewId; title: string }
  | { kind: "openReplaceSwitcher"; placementId: PlacementId }
  | { kind: "replacePlacementWithView"; placementId: PlacementId; viewId: ViewId }
  | {
      kind: "createViewInPlacement";
      placementId: PlacementId;
      viewId: ViewId;
      appId: AppId;
      documents: DocumentBindings;
    }
  | { kind: "linkedDuplicatePlacement"; placementId: PlacementId }
  | { kind: "duplicateView"; placementId: PlacementId }
  | { kind: "removePlacement"; placementId: PlacementId }
  | { kind: "closeView"; viewId: ViewId };
```

PBUI verbs describe user decisions. Prepared Redux actions may carry the
additional generated placement and split IDs required for deterministic replay.

The current `duplicateTile` verb should not survive with ambiguous semantics.
Rename it to `duplicateView`, and add `linkedDuplicatePlacement`.

## 14. Phased implementation plan

### Phase 1: Normalize state without changing visible behavior

Primary files:

- `src/store/layoutTree.ts`
- `src/store/layout.ts`
- `src/store/stages.ts`
- seeded layout and fixture files
- reducer and tree tests

Tasks:

1. Add `ViewId`, `AppView`, `DocumentBindings`, `views`, and `viewOrder`.
2. Change leaf nodes from `{app, docId, label}` to `{viewId}`.
3. Update seeded layouts to create views before placements.
4. Update `splitLeaf` so an empty adjacent placement receives a launcher view or
   the agreed temporary empty representation.
5. Update swap and docking to operate on `viewId`.
6. Keep existing rendered behavior through selectors and temporary prop
   adaptation.

Exit criteria:

- every leaf resolves to one view;
- current default stages render;
- current split, swap, dock, close, and workspace-clone behavior passes;
- cloning a workspace preserves shared view references intentionally rather than
  cloning views.

Workspace cloning should copy geometry but reference the same views. This makes a
cloned workspace another presentation of the same open work. An explicit
“duplicate workspace with independent views” command is outside scope.

### Phase 2: Persistence and portable schemas

Primary files:

- `src/store/persist.ts`
- `src/model/portable.ts`
- `src/store/bundles.ts`
- `src/store/effects.ts`
- persistence and bundle tests

Tasks:

1. Bump the durable storage version.
2. Validate view dictionaries and leaf references.
3. Define portable view, workspace, and stage envelopes.
4. Preserve link topology while remapping imported IDs.
5. Update secret scanning tests to cover all newly persisted view fields.
6. Update clipboard copy, import, and template flows.

Exit criteria:

- malformed or dangling view references are rejected safely;
- a linked view exported through a workspace stays linked after import;
- a view bundle replaces content without changing the target placement ID;
- no credential-shaped values are persisted.

### Phase 3: Title menu and Replace switcher

Primary files:

- `src/components/organisms/Tile/Tile.tsx`
- `src/components/organisms/Tile/Tile.module.css`
- `src/pbui/descriptors/tile.ts` or replacement view descriptor
- `src/pbui/types.ts`
- `src/pbui/verbs.ts`
- `src/store/applyLayoutVerb.ts`
- new `ViewSwitcher` organism and stories

Tasks:

1. Make left- and right-click on the title open the same object menu.
2. Move Rename exclusively into that menu.
3. Remove the title-bar application `SelectInput`.
4. Add Replace to the menu.
5. Build a shared switcher selection model.
6. Render existing views and new applications as separate sections.
7. Wire selection to assign an existing view or create a new one.
8. Preserve focus and keyboard operation.

Exit criteria:

- one click on a title opens actions;
- context-click opens the identical actions;
- Rename is only initiated from the menu;
- Replace shows the current application choices plus eligible existing views;
- selecting an existing view does not mutate that view or move its other
  placements.

### Phase 4: Linked and independent duplication

Primary files:

- `src/store/layout.ts`
- view selectors
- PBUI tile/view descriptor
- reducer, descriptor, and interaction tests

Tasks:

1. Implement **Create linked duplicate**.
2. Implement **Duplicate** as new view plus new placement.
3. Add placement counts to the menu and switcher model.
4. Add Remove from this workspace and Close view everywhere.
5. Verify shared rename and document-binding behavior.

Exit criteria:

- linked duplicate shares one `viewId`;
- duplicate uses a new `viewId`;
- both operations retain the same domain document IDs;
- closing one linked placement leaves the other;
- closing a view removes or repairs every referencing placement.

### Deferred follow-up: Application roles and view props

Primary files:

- `src/appkit/registry.ts`
- document-bound applications
- `DocBar`
- application registry tests

This is not part of the first release. Start it only when a concrete
multi-document application is ready. Tasks would be:

1. Add application document-role declarations.
2. Convert existing `docBound` applications to a required `primary` role.
3. Pass `placementId` and complete `view` to application components.
4. Make `DocBar` update a view binding by role.
5. Remove the temporary `leafId`/`docId` component contract and `docBound`.

Exit criteria:

- Chart, Table, Pipeline, and Encoding behave as before;
- a test application can declare two named document roles;
- changing a binding in one linked placement updates every placement.

### Deferred follow-up: Recent-view navigation

Tasks:

1. Render the shared switcher in Launcher.
2. Add transient focus and MRU view tracking.
3. Add the keyboard switcher behind a documented keybinding.
4. Define focus-existing-versus-show-here behavior.

The launcher portion of the shared switcher belongs in the first release. MRU
tracking and keyboard switching do not. The earlier phases deliver useful linked
workspaces and a richer Replace flow independently.

## 15. Testing strategy

### 15.1 Pure model tests

Test:

- tree leaves contain only `viewId`;
- linked duplicate creates one new placement and no view;
- duplicate creates one new placement and one new view;
- document bindings remain shared references after duplicate;
- workspace clone retains shared view IDs;
- swapping exchanges only `viewId`;
- docking preserves placement and view identity;
- removing a placement does not delete a view;
- closing a view repairs all affected workspace trees;
- selectors count placements across workspaces.

### 15.2 Persistence tests

Test:

- valid normalized layouts round-trip;
- missing view dictionaries fail;
- dangling leaf references fail;
- duplicate `viewOrder` entries fail;
- unknown application IDs survive rendering and validation where current policy
  permits them;
- transient menu, rename, switcher, focus, and MRU state is not persisted;
- secret scanning includes all newly persisted view fields.

### 15.3 Bundle tests

Test:

- a view bundle remaps view and document IDs;
- target placement identity survives replacement;
- two linked placements remain linked after workspace import;
- independently duplicated views remain independent after import;
- stage bundles preserve links across different included workspaces;
- importing one workspace does not reference a view omitted from its envelope.

### 15.4 Descriptor and verb tests

Test the exact action labels and mappings:

- Replace …
- Rename …
- Create linked duplicate
- Duplicate
- Remove from this workspace
- Close view everywhere

Verify `Create linked duplicate` maps to the placement-link action and
`Duplicate` maps to the view-copy action. This regression test is important
because the two operations produce initially identical pixels.

### 15.5 Storybook

Add stories for:

- title at rest;
- title action menu opened by left-click;
- title action menu opened by context-click;
- inline rename launched from the menu;
- Replace switcher with no existing views;
- Replace switcher with many existing views;
- view displayed once, twice, and in another workspace;
- scoped application list;
- singleton existing view selectable but singleton new-view action unavailable;
- narrow tile and long title;
- keyboard focus and Escape restoration;
- light and dark inherited themes.

Use interaction tests for click, context-click, keyboard opening, selection, and
focus restoration. Screenshot stories should ensure removal of the compact
application selector does not destabilize title-bar sizing.

### 15.6 End-to-end scenarios

Scenario A:

1. Open Chart on document A.
2. Choose Create linked duplicate.
3. Change the document to B in one placement.
4. Verify both placements show B.
5. Rename from one placement.
6. Verify both titles change.

Scenario B:

1. Open Chart on document A.
2. Choose Duplicate.
3. Change the duplicate to document B.
4. Verify the source remains on A.
5. Verify documents A and B were not copied by the duplicate action.

Scenario C:

1. Create a view in Workspace A.
2. Open Replace in Workspace B.
3. Select the existing view.
4. Verify both workspaces reference the same `viewId`.
5. Remove the placement from Workspace A.
6. Verify Workspace B and the view remain.

## 16. Risks and mitigations

### Risk: orphaned views accumulate

Zero-placement views are necessary for a launcher and recent-view model, but
they can accumulate. Mitigation: expose them in Existing views and provide Close
view. Do not add automatic garbage collection until actual usage establishes a
policy.

### Risk: users confuse the two duplication commands

Initially both commands produce the same pixels. Mitigation: exact labels,
placement-count badges, explanatory mouse documentation, and tests that
subsequent rename/document changes diverge only for ordinary Duplicate.

### Risk: singleton semantics remain ambiguous

Current singleton behavior is per workspace and application type. Mitigation:
define singleton as “at most one logical view” while allowing multiple linked
placements. Audit every current singleton application before changing the rule.

### Risk: bundles lose shared topology

Hydrating each leaf independently would turn linked placements into independent
views. Mitigation: build document, view, and node ID maps once per envelope and
test shared references after round-trip.

### Risk: view state grows without a concrete need

Mitigation: the first type has no generic state field. Add typed configuration
only for a specific application and keep domain data in documents.

### Risk: title-menu activation conflicts with dragging

The title includes a distinct grip. Mitigation: keep drag initiation exclusively
on the grip, stop its pointer event from reaching the title presentation, and
test a real browser interaction.

## 17. Alternatives considered

### Keep app and documents on leaves

This is smaller but cannot represent one logical view in multiple workspaces.
Copying fields between leaves is not shared identity.

### Store an array of document IDs

This supports cardinality but loses role semantics. `documents.left` and
`documents.right` are safer than index conventions.

### Model application, process, window, and tab

PBUI has no process lifecycle, and one view may have several simultaneous
placements. A desktop hierarchy would add objects without corresponding
behavior.

### Let one workspace own a view and other workspaces alias it

Deleting or cloning the owner produces arbitrary lifecycle rules. Global view
ownership is simpler and matches the requirement.

### Make Duplicate always linked

This prevents independent view-level configuration. Two explicit commands are
more precise.

### Keep left-click rename and right-click menu

This makes actions dependent on pointer button and hides the complete object
model behind a secondary gesture. The requested behavior is one title handle
that always exposes all view operations.

## 18. Decision records

### Decision 1: Normalize application views

- **Context:** Layout leaves currently combine geometry and logical content.
- **Options considered:** retain leaf fields; add an independently identified
  view; introduce a desktop window hierarchy.
- **Decision:** Add global `AppView` entities and let leaves reference `viewId`.
- **Rationale:** It is the smallest representation that supports one view in
  several workspaces and independent view lifetime.
- **Consequences:** Persistence, bundles, seeded layouts, and reducers must
  maintain referential integrity.
- **Status:** proposed

### Decision 2: Use named document bindings

- **Context:** Some applications require several documents with different roles.
- **Options considered:** one `docId`; `docIds[]`; named bindings.
- **Decision:** Store `documents: Record<string, DocId>`.
- **Rationale:** Named roles preserve meaning and retain a simple serializable
  shape.
- **Consequences:** Application descriptors should eventually declare allowed
  roles, and DocBar must update a role rather than a leaf field.
- **Status:** proposed

### Decision 3: Distinguish linked duplicate from duplicate

- **Context:** Reusing one view and copying a view produce different future
  behavior despite initially identical rendering.
- **Options considered:** one overloaded Duplicate command; modifier keys; two
  explicit menu actions.
- **Decision:** Expose **Create linked duplicate** and **Duplicate**.
- **Rationale:** Explicit commands make identity semantics inspectable and
  testable.
- **Consequences:** Help text and tests must demonstrate propagation behavior.
- **Status:** accepted

### Decision 4: Open one menu from either title click

- **Context:** Current left-click renames while right-click opens actions.
- **Options considered:** retain split gestures; add title-bar buttons; open the
  same object menu from both buttons.
- **Decision:** Left-click, right-click, and keyboard activation open the same
  view-action menu. Rename is a menu action.
- **Rationale:** All view operations have one discoverable home without adding
  controls to a narrow title bar.
- **Consequences:** PBUI Presentation may need a generic “activate by opening
  menu” capability.
- **Status:** accepted

### Decision 5: Share switcher content between Replace and Launcher

- **Context:** The current application selector and Launcher duplicate selection
  logic and cannot select existing views.
- **Options considered:** extend the native select; build independent launcher
  and replacement interfaces; share a `ViewSwitcher`.
- **Decision:** Use one switcher selection model and content component in both
  contexts.
- **Rationale:** Scope, singleton, view eligibility, and action semantics remain
  consistent.
- **Consequences:** Container presentation differs, but selection data and
  callbacks must not.
- **Status:** accepted

### Decision 6: Keep views after their final placement is removed

- **Context:** A launcher and Alt-Tab-style switcher need open views that are not
  currently visible.
- **Options considered:** garbage-collect immediately; retain until explicit
  close; keep a permanent history.
- **Decision:** Retain zero-placement views until Close view.
- **Rationale:** This provides a conventional open-view lifecycle without
  conflating close-placement and close-view.
- **Consequences:** The switcher needs placement counts and close actions.
- **Status:** proposed

### Decision 7: Do not add a backwards-compatibility object layer

- **Context:** Normalization changes every layout leaf and portable representation.
- **Options considered:** dual object models; a permanent adapter; clean schema
  version change; one-time conversion if separately required.
- **Decision:** Implement one normalized runtime model and bump schemas.
- **Rationale:** Two runtime models would preserve the ambiguity this ticket
  removes.
- **Consequences:** Existing local storage may reset unless preservation is
  explicitly authorized as separate migration work.
- **Status:** proposed

## 19. Open questions

These questions do not block Phase 1:

1. Should Close view everywhere ask for confirmation when the view has several
   placements?
2. Should the object menu show an explicit “shown in N places” informational
   line?
3. Should existing views outside the current stage scope be hidden or shown
   disabled with their stage?
4. Does every current `singleton` application truly require one logical view per
   workbench, or do some require one per stage?
5. Should launcher remain an `AppView`, or become a nullable/empty placement
   after normalization stabilizes?
6. Should ordinary Duplicate append “copy” to an explicit view title, or leave
   the derived title identical?
7. When closing a view removes the last placement from one workspace, should the
   workspace show Launcher or collapse to another existing linked view?

## 20. File-level implementation reference

Start review in this order:

1. `packages/datalab-ui/src/store/layoutTree.ts` — current leaf representation
   and structural tree helpers.
2. `packages/datalab-ui/src/store/layout.ts` — workspace ownership, reducers,
   duplicate, swap, dock, clone, rename, and bundle replacement.
3. `packages/datalab-ui/src/components/organisms/Tile/Tile.tsx` — current title,
   selector, app resolution, and component props.
4. `packages/datalab-ui/src/appkit/registry.ts` — application contract and
   singleton/document-bound policy.
5. `packages/datalab-ui/src/components/organisms/ViewSwitcher/model.ts` —
   shipped existing-view and new-application selection policy.
6. `packages/datalab-ui/src/apps/LauncherApp/LauncherApp.tsx` — current launcher
   behavior.
7. `packages/datalab-ui/src/pbui/descriptors/tile.ts` — title object-menu actions.
8. `packages/datalab-ui/src/pbui/verbs.ts` and
   `packages/datalab-ui/src/store/applyLayoutVerb.ts` — serializable intent and
   Redux mapping.
9. `packages/datalab-ui/src/store/persist.ts` — durable schema and validation.
10. `packages/datalab-ui/src/model/portable.ts`,
    `packages/datalab-ui/src/store/bundles.ts`, and
    `packages/datalab-ui/src/store/effects.ts` — portable identity remapping.
11. `packages/datalab-ui/src/components/organisms/Tile/Tile.stories.tsx` and
    `packages/datalab-ui/src/pbui/Pbui.stories.tsx` — interaction and visual
    coverage.

## Conclusion

The proposed design introduces one new durable entity and one new foreign key.
It does not require a desktop runtime. The normalization makes the existing
implicit “view payload” explicit and creates stable semantics for reuse,
duplication, replacement, launcher selection, and future keyboard navigation.

The implementation should ship in layers: normalize identity first, preserve
rendering, update durability, then expose the title menu and switcher, followed
by linked and independent duplication. Each phase has useful testable outcomes
and leaves the architecture ready for the next without requiring every planned
interaction to ship at once.
