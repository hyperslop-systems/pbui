---
Title: 'Intern guide: the PBUI workbench, tiles, and how pbui-chat runs on them'
Ticket: PBUI-WORKBENCH-1
Status: active
Topics:
    - pbui
    - frontend
    - chat
DocType: design-doc
Intent: long-term
Owners: []
RelatedFiles:
    - Path: repo://packages/datalab-ui/src/store/layout.ts
      Note: The Redux-bound reference implementation
    - Path: repo://packages/workbench-protocol/src/client/apply.ts
      Note: The structural applier the shell uses as runtime state
    - Path: repo://packages/workbench-protocol/src/client/builders.ts
      Note: Gesture -> Mutation[] builders
    - Path: repo://src/chrome/LauncherShell.tsx
      Note: Launcher mechanics and the two invariants
    - Path: repo://src/chrome/TileFrame.tsx
      Note: The tile chrome the shell renders
    - Path: repo://src/chrome/useTileDrag.ts
      Note: Swap/dock drag mechanics and zone bands
    - Path: ws://datalab/pkg/server/handlers_workbenches.go
      Note: Hosted workbench semantics (428/409/400, replay, stream)
ExternalSources: []
Summary: 'An intern-level guide to the PBUI workbench: the presentation protocol it sits on, the tile chrome kit, the workbench document and its applier, how datalab-ui and the datalab server implement a hosted workbench today, the design of the reusable server-less shell (@hyperslop-systems/pbui-workbench), how pbui-chat runs its apps as tiles, and the API and file references needed to extend either.'
LastUpdated: 2026-08-20T13:34:29.690217362-04:00
WhatFor: Give someone new everything needed to understand, modify and extend the workbench tile system across PBUI applications without re-deriving it from five repositories.
WhenToUse: Read before touching tiles, layouts, the launcher, the workbench protocol or any PBUI product shell; sections 2-5 are the analysis, 6-8 the design and implementation, 9-10 the references.
---


# Intern guide: the PBUI workbench, tiles, and how pbui-chat runs on them

## 0 · What this guide is for, and how to read it

PBUI applications are not pages with panels; they are **workbenches**: a set of workspaces, each a binary split tree of tiles, each tile showing one application view. The user splits, closes, drags, docks and resizes tiles, opens a launcher to place applications, and every one of those actions is a verb that is data. This guide explains the whole of that system as it exists in the workspace today, then the design and implementation of a reusable, server-less React shell (`@hyperslop-systems/pbui-workbench`) built in this ticket, and finally how the pbui-chat agent (ticket PBUI-AGENT-1) runs its chat, inspector, watchlist, trace and widget views as tiles of that shell.

Read it in order the first time. Sections 1–5 are analysis of what exists; they name files and line numbers so you can open the code beside the text. Section 6 is the design of the new package; section 7 is what was built and how it was verified; section 8 is how pbui-chat plugs in; sections 9–10 are reference material you will come back to.

Paths are relative to `/home/manuel/workspaces/2026-08-20/add-pbui-agent/` unless stated otherwise. `pbui/` is the PBUI repository, `datalab/` the datalab server, `hyperslop-cli/` the agent-facing CLI.

## 1 · The foundation: PBUI's presentation protocol

Everything in a PBUI product that the user can act on is a **presentation**: a typed value wrapped so that the interface knows its type, its label, its description and its verbs. The contract is in `pbui/src/presentation/types.ts`:

```ts
type PresentationReference<Values> = { type: keyof Values; value: Values[type] };

interface PresentationDescriptor<Value, Environment, Verb> {
  label(value, environment): ReactNode;
  describe?(value, environment): unknown;                       // the inspector payload
  actions?(value, environment): readonly PresentationAction<Verb>[];
  tone?: PresentationTone;
}
interface PresentationAction<Verb> {
  id: string; label: string; verb: Verb;                          // verb is DATA, never a closure
  description?: string; group?: string; danger?: boolean;
  disabledBecause?: string;                                       // present ⇔ unavailable, and why
}
```

A product declares its value types, writes one descriptor per type, builds a registry (`createPresentationRegistry`) and a runtime (`createPbui`, `pbui/src/presentation/createPbui.tsx`). The runtime returns `Provider` (with the one effect boundary, `onPerform(verb)`), `Presentation` (wraps any element; right-click or Enter opens the object menu, left click runs `activate` or opens the menu), `ObjectMenu`, `MouseDocLine` (the permanent strip describing what is under the pointer and what L/R will do), `AcceptBanner` and `usePbui` (with `accept({types, prompt})`, which makes every presentation of those types clickable across tiles until one is chosen).

Two consequences matter for tiles:

- A **tile's title is a presentation** of type `tile`. Its menu lists the tile's verbs (split, close, rename, duplicate, replace…), and the chrome buttons in the title bar perform the same verbs. The playbook states the rule: the buttons and the menu are two doors to the same verbs.
- A **verb is data**, so a tile verb can be produced by a menu, by a button, by a keyboard shortcut, by a launcher row, or by an agent, and all of them go through one router. This is why the workbench's mutation protocol (section 3) is also expressed as data.

## 2 · The chrome kit: what PBUI already ships for tiles

`pbui/src/chrome/` is the **document-model-agnostic** tile chrome (PBUI-UNIFY-001 decision DR-U3: "the extracted components never see a document"). It knows DOM ids and callbacks, nothing about trees, views or stores. Four pieces:

### 2.1 `TileFrame` (`pbui/src/chrome/TileFrame.tsx`)

The frame every tile wears: the tone is the title bar, a ⠿ grip, a title slot, split ⬌/⬍ and close ✕ buttons, and the labelled drop-zone overlay that names a drag's outcome before release.

```ts
interface TileFrameProps {
  placementId: string;                 // becomes data-placement-id; drag and focus restoration key on it
  tone: string;                        // a CSS custom property reference, never a hex value
  title: ReactNode;                    // the product's <tile> Presentation, or plain text
  canClose: boolean;
  onSplit(direction: "row" | "col"): void;
  onClose(): void;
  grip?: { onPointerDown(event): void };      // from useTileDrag
  dropZone?: DragZone | null;                 // from useTileDrag on the TARGET tile
  dragging?: boolean;
  registerElement?(element: HTMLElement | null): void;   // ref callback for the hit test
  children: ReactNode;
}
```

It emits `section[data-part="tile"][data-placement-id]` → `header[data-part="tile-bar"]` (tone applied inline) → `tile-grip`, `tile-title`, `tile-actions` → `div[data-part="tile-body"]`. `pbui/public/chrome.css` styles every part through those hooks with `--pbui-*` tokens; `tile-body` is `flex:1; min-height:0; overflow:auto`, which is why a tile's body must sit in a container with a committed height (see the playbook's "flex parent" trap).

### 2.2 `useTileDrag` (`pbui/src/chrome/useTileDrag.ts`)

Drag-to-swap and drag-to-dock, with a module-level registry of tile elements so the hit test can run synchronously on every pointer move and see tiles the dragged one is not a descendant of.

```ts
type DockZone = "left" | "right" | "top" | "bottom";
type DragZone = DockZone | "center";

useTileDrag({ id, onSwap(sourceId, targetId), onDock(sourceId, targetId, zone) })
  → { register(element), onGripPointerDown(event), dragging: boolean, zone: DragZone | null }
```

Zone classification (DR-U4) is banded: a band of 30 % of the smaller tile dimension, capped at 110 px; a pointer farther than the band from every edge is `center` (swap), otherwise the nearest edge (dock). The pointer sequence is: capture the pointer (so a release outside the window still delivers `pointerup`), track the hovered tile and zone, and on release call exactly one of `onSwap`/`onDock` — or nothing on `pointercancel`/window `blur`. Tiles that unmount are evicted from the registry on the next hit test, so a closed tile cannot be a phantom drop target.

### 2.3 `LauncherShell` and `splitDirectionFor` (`pbui/src/chrome/LauncherShell.tsx`)

The Cmd-K launcher's modal, search input, grouped rows and keyboard loop. The product supplies the rows and `onChoose(rowId)`; the shell supplies the behaviour. Two invariants live in its header comment and must be preserved by any caller:

1. **Escape has exactly one owner.** The shell registers no escape surface; `Dialog` already does. A second registration lands on top of the dialog's own, which then decides it is not topmost and ignores the key — Escape closes nothing at all.
2. **A global new view must never destroy a working tile.** `splitDirectionFor(placementId)` reads the tile's rendered box and returns `"row"` when it is wider than tall, else `"col"`; the launcher splits the active tile along that axis and says where the view will land (the `status` line) before Enter commits.

### 2.4 `shortcutRouting` (`pbui/src/chrome/shortcutRouting.ts`)

`routeWorkbenchKey(event, context, platform)` is a pure function returning `{kind: "ignore"} | {kind: "open-launcher"}`. It opens the launcher on Mod-K unless the launcher, a dialog, the object menu, accept mode or an inline rename already owns the keyboard. `isModKey` picks ⌘ on Apple platforms and Ctrl elsewhere; `isEditableTarget` is structural so it is testable in node. Escape is deliberately absent: the topmost transient surface owns it, through `pbui/src/surfaces.ts`.

**A fact worth knowing:** until this ticket, `TileFrame` and `LauncherShell` had no consumer in the repository except their own tests; datalab-ui consumes only `useTileDrag`, `DropZoneOverlay`, `routeWorkbenchKey` and `isEditableTarget`, and hand-rolls its own frame and launcher. The reusable shell is their first real caller.

## 3 · The workbench document and its applier

### 3.1 The schema (`pbui/proto/hyperslop/pbui/workbench/v1/workbench.proto`)

```
WorkbenchDocument { format "pbui.workbench"; schema_version 1; id; name;
                    repeated Workspace workspaces; map<string, AppView> views;
                    repeated string view_order; map<string, DocumentPayload> documents }
Workspace { id; name; Node tree }
Node      { id; oneof body { Leaf leaf; Split split } }
Leaf      { view_id }
Split     { Direction direction (ROW|COLUMN); double ratio; Node a; Node b }
AppView   { id; app_id; map<string,string> documents; optional title }
DocumentPayload { id; format; schema_version; google.protobuf.Struct body }
Mutation  { oneof: workbenchRename | workspaceCreate | workspaceRename | workspaceDelete |
            documentPut | documentDelete | viewCreate | viewConfigure | viewClone | viewDelete |
            viewClose | placementReplace | placementSplit | placementClose | splitResize }
```

Four identities, each owning one thing (DATADROP-18 §1): a **workspace** owns a split tree; a **placement** (a leaf node) owns geometry identity — it is the React key, the drag hit-test target and the focus-restoration anchor; an **application view** owns the app id, named document bindings and an optional title; a **document** owns content, opaque to the protocol (its body is a `Struct`). Two placements that reference one view are *linked*: they render the same view and stay in lockstep. An independent duplicate is a new view.

The ten invariants (DATALAB-VIEW-001 §5.2) that any implementation must hold:

1. Every leaf references exactly one existing view.
2. Every `view_order` entry names an existing view exactly once.
3. Every existing view occurs in `view_order` exactly once.
4. A view may be referenced by zero or more leaves.
5. A leaf occurs in exactly one workspace tree.
6. A view's document binding names an existing document.
7. Split-node and placement ids are globally unique within the layout.
8. View ids are globally unique within the workbench.
9. Removing a placement never deletes a view or a document implicitly.
10. Duplicating a view never duplicates a document implicitly.

### 3.2 The TypeScript applier (`pbui/packages/workbench-protocol/src/client/apply.ts`)

`applyMutation(doc, mutation): WorkbenchDocument` clones the document first and applies one arm; `applyMutations` folds a batch. It mirrors the Go applier (`pbui/pkg/workbench/mutation.go`) arm for arm, including the error-code vocabulary of `MutationError{code, path}`: `invalid_mutation`, `duplicate_id`, `unknown_workspace`, `last_workspace`, `unknown_document`, `document_in_use`, `unknown_view`, `view_in_use`, `invalid_fallback`, `unknown_placement`, `invalid_leaf`, `invalid_position`, `last_placement`, `unknown_split`. Two arms deserve attention because the shell's gestures map onto them:

- `placementSplit` — the **target node becomes the split and keeps `split_id`**, while a copy of the old leaf moves down one level keeping its own id. `PlacementPosition` BEFORE puts the new leaf first, AFTER second; UNSPECIFIED is an error. Client and server therefore mint identical ids.
- `placementClose` — the sibling absorbs the closed leaf's position; closing the only leaf is `last_placement`.

What the TS applier does **not** do is Go's whole-graph `Validate` (`pbui/pkg/workbench/validate.go`): application catalog lookups (`unknown_application`, `duplicate_singleton`, `unknown_binding`, `required_binding`), limits, ratio bounds `[0.05, 0.95]`, and the credential-key scan. A mutation the TS applier accepts can still be refused by a server.

### 3.3 The builders (`pbui/packages/workbench-protocol/src/client/builders.ts`)

A builder answers "what mutations express this intent against this document". The config-independent ones are exactly the shell's gestures:

```ts
splitPlacement(doc, placementId, "row" | "col", appId): Mutation[]   // [viewCreate, placementSplit AFTER, ratio .5]
closePlacement(doc, placementId): Mutation[]                          // [placementClose] (+ viewDelete if it was the view's last placement)
swapPlacements(doc, aId, bId): Mutation[]                             // two placementReplace
dockPlacement(doc, sourceId, targetId, zone): Mutation[]              // [placementSplit on target, placementClose on source]
resizeSplit(doc, splitId, ratio): Mutation[]                          // [splitResize]
```

`dockPlacement` emits the split **before** the close so the moved view has its new placement before the old one disappears and cannot be mistaken for abandoned. `createWorkbenchClient({sourceBinding, launcherAppId, isBindableDocument?})` adds the product-configured verbs (`replaceApp`, `linkViewIntoPlacement`, `splitWithApp`) including the singleton rule: replacing with a singleton that already has a view **links** the placement to it rather than minting a second view, because the structural applier would accept the second view and the server's `Validate` would reject it as `duplicate_singleton`.

`ratios.ts` defines `SNAP_RATIOS = [0.25, 1/3, 0.5, 2/3, 0.75]` and `snapRatio(value)` with a tolerance of 0.022, so two workspaces line up when the user aims for the same fraction.

Parity: 26 fixtures in `packages/workbench-protocol/fixtures/mutations/*.json` are read by both `applierParity.test.ts` and `pbui/pkg/workbench/parity_fixtures_test.go`. Adding a mutation arm is: extend the proto, regenerate, implement both appliers, add a fixture. Drift is a build break.

## 4 · How datalab-ui implements the workbench today

datalab-ui (`pbui/packages/datalab-ui`) is the complete reference product. Understanding what it keeps inside Redux is what tells you what a reusable shell must own.

### 4.1 Its own tree, converted at the boundary

datalab-ui does **not** use the protocol document as runtime state. `src/store/layoutTree.ts` defines a structurally similar tree (`{type:"leaf", viewId} | {type:"split", dir, a, b, ratio}`) with pure helpers (`updateNode` shares untouched branches, which the `memo` on `SplitView` depends on; `removeLeaf`; `findLeaf`; `countLeaves`) and a verbatim copy of `snapRatio`. `src/store/layout.ts` (1 162 lines) is an RTK slice whose state is:

```ts
interface LayoutState {
  stages; currentStageId;                     // datalab-specific audience routing
  spaces: Workspace[]; currentSpaceId;        // workspaces, flat across stages
  views: Record<ViewId, AppView>; viewOrder;  // the logical views
  // transient, never persisted:
  launcher?: LauncherInvocation | null;       // {kind:"fill-launcher"|"replace"|"navigate", …}
  activePlacementId?: NodeId | null;          // the keyboard-operation target (not DOM focus)
  renamingId?: string | null;                 // a placement or workspace being renamed inline
  notice; pendingImport; justSignedUp;
}
```

Its reducers are the verbs: geometry (`setRatio`, `splitLeaf`, `closeLeaf`, `swapTiles`, `dockTile`), views (`closeView`, `createViewInPlacement`, `replacePlacementWithView`, `renameView`, `duplicateView`, `createLinkedDuplicate`, `setViewDocument`), workspaces and stages, and the transient ones (`openLauncher`, `setActivePlacement` with a no-op guard because `onFocusCapture` fires for every focusable descendant, `beginRename`). Conversion to the protocol happens only in `src/remote/codec.ts` at the remote boundary.

### 4.2 The tile (`src/components/organisms/Tile/Tile.tsx`)

The tile hand-rolls its frame (it predates `TileFrame`) but shows the adapter shape every shell needs. The drag wiring is five lines:

```ts
const { dragging, zone, onGripPointerDown, register } = useTileDrag({
  id: node.id,
  onSwap: (a, b) => dispatch(layoutActions.swapTiles({ a, b })),
  onDock: (from, to, dockZone) => dispatch(layoutActions.dockTile({ from, to, zone: dockZone })),
});
```

Its title is a `<Presentation>` carrying a `TileRef` — not a node id — because the tile descriptor must decide *Duplicate*, *Close* and *Remove* from `duplicable`, `canClose` and `placementCount`, none of which belong in the descriptor environment: "a presentation value carries what its menu needs to decide, resolved by the component that already knows it" (`src/pbui/types.ts:137-150`). `label = view.title ?? derived` uses `??`, not `||`, so clearing a custom title returns to the derived one. The tile marks itself active on `onFocusCapture` and `onPointerDownCapture` without moving DOM focus. Its body renders `<Component placementId view />` inside a `RenderBoundary`.

### 4.3 The shell (`src/components/pages/Workbench/WorkbenchShell.tsx`) and the split view

`SplitView` (`src/components/organisms/SplitView/SplitView.tsx`) renders a split as two panes with `flex: ratio 1 0px` around a divider that is a `<button role="separator" aria-orientation aria-valuenow>` — a button because a resize handle must be keyboard-operable. Pointer drag computes `(clientX − box.left) / box.width`, clamps to `[0.1, 0.9]`, snaps, and dispatches on every move; arrow keys step by 0.05 (0.01 with Shift).

Keyboard routing is a **window listener in the capture phase**, not a React handler on the root, because DOM focus is often on `<body>` and a React handler would never fire. Ownership: the workbench that contains focus reacts; with nothing focused, a *lone* workbench reacts; several instances with focus on body means none reacts. Two details cost real debugging: `launcherOpen` must be computed as `(state.launcher ?? null) !== null` (an `undefined` field read as "permanently open" and killed Mod-K), and Escape for full-frame is registered only while the shell owns the escape surface.

The launcher dialog (`src/apps/LauncherApp/LauncherDialog.tsx`) predates `LauncherShell`; its `choose(row)` is the policy: `navigate` + a placed view → switch and focus, never mutate; `navigate` + a new app → `splitLeaf({dir: splitDirectionFor(root, activePlacementId), appId})` — the "never destroy a working tile" promise; `fill-launcher`/`replace` → create or replace in place. Focus is restored by placement id one frame later (`requestAnimationFrame` → `[data-placement-id] [data-ptype="tile"]`), scoped to the shell root because two instances seeded from one layout share placement ids.

### 4.4 The app contract (`src/appkit/registry.ts`)

```ts
interface AppProps { placementId: NodeId; view: AppView }
interface AppDescriptor {
  id: string; title: string;
  tone: string;              // a token name, never a hex value
  docBound: boolean;         // a view of one composition; binds a document under "primary"
  duplicable: boolean;       // required, not optional-with-default
  singleton: boolean;        // at most one logical view in the workbench
  Component: ComponentType<AppProps>;
}
registerApp(descriptor)      // side-effect registration from src/apps/all.ts
```

"Doc-bound" means the app shows a document bar, can be re-pointed, and two tiles bound to the same document stay in lockstep. It drives whether a new view inherits the active document, the launcher row's detail text, and — through the server catalog — whether validation demands a `primary` binding.

### 4.5 The remote controller (`src/appkit/useRemoteWorkbench.ts`)

A **whole-document PUT controller**: it fingerprints the encoded document, debounces 500 ms, sends `PUT /v1/workbenches/{id}` with `If-Match: "workbench-{id}-{revision}"` and an `Idempotency-Key` keyed to the fingerprint (a retry of the same content replays rather than double-applies), and tracks `{loading, ready, dirty, saving, revision, error, conflict}`. Conflicts arrive three ways — a query result while saving (deferred and compared), a query result while dirty (immediate), a 409 response — and funnel into one state with *Reload server version* / *Try again*. The SSE stream (`src/api/workbenchStream.ts`, `fetch` rather than `EventSource` so a bearer token can be attached) delivers `workbench.updated {workbenchId, revision}` as **pure invalidation**: ignore if not newer, defer while saving, conflict while dirty, else refetch.

## 5 · How the datalab server hosts a workbench

`datalab/pkg/server/server.go` registers seven routes on a stdlib mux:

```
POST   /v1/workbenches                       create (Idempotency-Key required) → 201 + ETag + Location
GET    /v1/workbenches                       list
GET    /v1/workbenches/{id}                  get  → ETag "workbench-{id}-{revision}"
PUT    /v1/workbenches/{id}                  replace (If-Match + Idempotency-Key)
DELETE /v1/workbenches/{id}                  delete (If-Match)
POST   /v1/workbenches/{id}/mutate           MutationBatch (If-Match + Idempotency-Key)
GET    /v1/workbenches/{id}/stream           SSE: event workbench.updated, id: revision
```

`handlers_workbenches.go` fixes the semantics a client must know: a missing or malformed `If-Match` is **428 Precondition Required** (not 412); a missing `Idempotency-Key` is 400; a stale revision is **409** with a protobuf-JSON `WorkbenchConflict{code:"workbench_revision_conflict", expectedRevision, currentRevision}`; a validation failure is **400** with a problem document naming the `ValidationError` code and path. `handleMutateWorkbench` orders its work deliberately: replay the idempotency key first (a replay returns the stored response without touching state or re-publishing), then compare the revision, then `workbench.ApplyMutations` (apply all, validate once), then `store.ReplaceWorkbench` — the same function the PUT path uses, which is why both paths share revision, idempotency, audit and notification. The stream handler subscribes **before** reading the snapshot (no lost update), emits immediately when `current > after` (so reconnects self-correct), heartbeats every 20 s, and the hub (`workbench_hub.go`) closes a slow subscriber's channel rather than buffering without bound.

`datalab/pkg/workbenchapp/` is the only place datalab's product knowledge enters the generic engine: `Catalog` maps app ids to `workbench.ApplicationDescriptor{Singleton, DocumentBindings}` (the four doc-bound apps require `primary`), and `DocumentValidator` admits exactly one document format, `datadrop.gog.document@1`. A new host supplies its own `Dependencies` in about a hundred lines.

`hyperslop-cli/pkg/client/workbenches.go` and `pkg/cli/uicmd` are the agent-facing client of the same API: `hyperslop ui mutate <workbench> --file batch.json --revision N`.

### 5.1 Decisions to carry forward

- **DR-U3** — the chrome kit never sees a document; products keep a ten-line adapter. This is what makes a server-less shell possible.
- **DR-U5** — the TS mutation layer ships inside `workbench-protocol/client`, not a React package; a split-tree renderer was deferred "until a third consumer makes it real". pbui-chat is that consumer.
- **DR-U6** — the launcher's *policy* (rows model, `choose`) stays with the product; the shell extracts the mechanics.
- **DATADROP-18** — placement and view mutations are separate; a workbench snapshot is the revision boundary; stream invalidations, then refetch; no CRDT in version 1; and the **local-only state list** that must never be persisted in the resource: current workspace/stage, focused placement, open launcher/dialog/rename/menu, drag state and transient divider ratios, caches and handles, credentials.
- **DATALAB-VIEW-001 Decision 5** — the active placement lives in the layout state, not a React context, because a serialisable verb cannot reach a context. **Decision 6** — global invocation splits, never replaces. **Decision 7** — one hard-coded shortcut action, no command registry.

### 5.2 What a reusable shell must own

The analysis reduces to a responsibility list. Everything in the left column lives inside datalab-ui's Redux today and has no generic home; the right column names where it goes in the new package.

| Responsibility | datalab-ui today | pbui-workbench |
|---|---|---|
| tree data type + pure operations | `store/layoutTree.ts` | the protocol `Node` + `builders.ts` queries |
| snap ratios | duplicated | `workbench-protocol/client/ratios` |
| workspaces + current workspace | `store/layout.ts` | local document store |
| views + `viewOrder` discipline | `store/layout.ts` | the protocol applier enforces invariants 2–3 |
| geometry verbs (split, close, swap, dock, resize) | reducers | `builders.ts` + `applyMutations` |
| view verbs (create, replace, rename, duplicate, link) | reducers | `builders.ts` + `createWorkbenchClient` |
| active placement | `layout.activePlacementId` | shell state |
| focus restoration by placement id | `LauncherDialog.tsx` | shell helper |
| launcher invocation state | `layout.launcher` | shell state |
| inline-rename target | `layout.renamingId` | shell state |
| which key press means what / which workbench owns it | `WorkbenchShell.tsx` | `shortcutRouting` + shell ownership rule |
| escape/surface stack | `appkit/useTransientSurface.ts` | pbui `surfaces.ts` |
| divider drag + keyboard resize | `SplitView.tsx` | shell `Split` component |
| tile chrome assembly | `Tile.tsx` | `TileFrame` |
| app registry | `appkit/registry.ts` | `defineApp` / `createAppRegistry` |
| verb → state mapping | `applyLayoutVerb.ts` | `performWorkbenchVerb` |
| persistence policy | `persist.ts` | `serialize()/restore()` |
| stages, audiences, sign-in gating, `?first=1` | `Workbench.tsx` | **not** a shell concern |

## 6 · Design: `@hyperslop-systems/pbui-workbench`

### 6.1 The one sentence

The shell holds **one protocol `WorkbenchDocument`** in a local store, renders its active workspace's tree with PBUI's chrome, and turns every gesture into `Mutation[]` through the protocol builders, applied locally with `applyMutations`. Nothing in the shell knows a product, a server or Redux; a product supplies apps and, later, a transport.

```
 product                         pbui-workbench                         pbui / workbench-protocol
 ───────                         ──────────────                         ─────────────────────────
 defineApp({id,title,tone,   ─►  createAppRegistry(apps)
            singleton,Component})
 createWorkbench({apps,      ─►  store: WorkbenchDocument + ui state   ◄── applyMutations, builders, snapRatio
                  initial})      verbs: split/close/swap/dock/resize/
                                        place/setTitle/openView
                                 <Surface/>  tree → Split | Tile       ◄── TileFrame, useTileDrag, chrome.css
                                 <Launcher/> rows from the registry    ◄── LauncherShell, splitDirectionFor,
                                                                           routeWorkbenchKey
                                 serialize()/restore()                 (localStorage, or a server later)
```

### 6.2 State

```ts
interface WorkbenchState {
  document: WorkbenchDocument;          // the protocol document; the only persisted part
  workspaceId: string;                  // current workspace (local-only, DATADROP-18 §1.4)
  activePlacementId: string | null;     // keyboard-operation target; not DOM focus
  launcher: { from: string | null } | null;
  renamingViewId: string | null;
  draggingRatio: { splitId: string; ratio: number } | null;   // live, uncommitted divider position
}
```

The store is a `useSyncExternalStore` store with `getSnapshot`, `subscribe` and one `mutate(mutations)` that runs `applyMutations` and publishes the new document. A rejected mutation (a `MutationError`) leaves the document unchanged and surfaces the code; the caller decides whether to show it.

### 6.3 Verbs

Every gesture is a verb that is data, so a product can put it in an object menu or receive it from an agent:

```ts
type WorkbenchVerb =
  | { kind: "tile.split";  placementId; direction: "row" | "col"; appId?: string }
  | { kind: "tile.close";  placementId }
  | { kind: "tile.swap";   a: placementId; b: placementId }
  | { kind: "tile.dock";   source: placementId; target: placementId; zone: DockZone }
  | { kind: "split.resize"; splitId; ratio: number }
  | { kind: "view.place";  appId; from?: placementId; documents?: Record<string,string> }  // launcher rule
  | { kind: "view.title";  viewId; title: string | null }
  | { kind: "view.open";   appId; documents; near?: placementId };                          // Open in tile

performWorkbenchVerb(wb, verb)   // → builders → wb.mutate(mutations)
```

`view.place` implements the launcher rule: split the `from` placement (default: the active one) along its longer rendered axis (`splitDirectionFor`) and put the new view there; it never replaces a working tile. `view.open` is what pbui-chat's *Open in tile* uses: a doc-bound `widget` view whose `documents.widget` names a widget instance id.

### 6.4 Rendering

`<Surface/>` walks `document.workspaces[workspaceId].tree`:

- a **split** renders a CSS grid with two panes sized `ratio` / `1 − ratio` along `direction` and a divider that is a focusable `role="separator"`. Pointer drag updates `draggingRatio` live (no mutation per move), and release commits `resizeSplit(splitId, snapRatio(ratio).ratio)`. Arrow keys step 0.05 (0.01 with Shift). Ratios are clamped to `[0.1, 0.9]` before snapping, inside the protocol's `[0.05, 0.95]` validity range.
- a **leaf** renders `TileFrame` with `useTileDrag({id: placementId, onSwap → tile.swap, onDock → tile.dock})`, `onSplit → tile.split`, `onClose → tile.close` (disabled when the workspace has one leaf), `title` from `renderTitle(view, placement)` (a product-supplied `<tile>` Presentation, default plain text), and the app's `Component` inside a one-cell grid so it receives a committed height. An unknown `appId` renders an `EmptyState` naming the id rather than an empty tile.

`<Launcher/>` wraps `LauncherShell` with rows from the registry: singletons that already have a view are offered as *go to*; everything else as *place*; the status line names where the view will land. Mod-K routing follows `routeWorkbenchKey` with the ownership rule from §4.3.

### 6.5 Persistence and the path to a server

`serialize()` returns the protocol JSON of the document (`toJson(WorkbenchDocumentSchema, doc)`); `restore(json)` parses and validates it. The demo keeps it in `localStorage`. A hosted mode later replaces the store's `mutate` with apply-then-queue against `POST /v1/workbenches/{id}/mutate` (§5), adding `{revision, dirty, saving, conflict}` — and nothing else changes: not the builders, not the renderer, not the apps. The local-only fields in §6.2 are never serialised.

### 6.6 What stays with the product

The descriptor for `tile` (its verbs and `disabledBecause` strings), the launcher's rows policy beyond the registry default, the document formats, and any server transport. This is DR-U3 and DR-U6 applied to the new package.
