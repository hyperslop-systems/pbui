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

**A fact worth knowing:** inside the pbui repository, `TileFrame` and `LauncherShell` had no consumer except their own tests — datalab-ui consumes only `useTileDrag`, `DropZoneOverlay`, `routeWorkbenchKey` and `isEditableTarget`, and hand-rolls its own frame and launcher. Outside it, agentlogic, turboproof and hyperblog do import `TileFrame` + `useTileDrag` (turboproof also `LauncherShell` + `splitDirectionFor`), each inside a shell of its own (PBUI-WORKBENCH-2 analyses them). The chrome is shared; the shell is not — and the reusable shell is the first package to own that middle layer.

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

## 7 · Implementation: what was built, and how it differs from §6

### 7.1 Package layout (`pbui/packages/pbui-workbench`)

```
src/
  index.ts               public surface
  apps.ts                defineApp, createAppRegistry, AppDescriptor, AppProps
  document.ts            tile()/split()/layout()/singleTile() builders; serializeDocument/parseDocument
  store.ts               useSyncExternalStore store; mutate() applies batches with applyMutations
  verbs.ts               WorkbenchVerb data, workbenchVerbs.*, createVerbHandlers, performWorkbenchVerb
  createWorkbench.tsx    the entry point; binds store, registry, verbs, Surface, Launcher
  context.tsx types.ts styles.css
  components/Tile/       TileFrame + useTileDrag + app body in a one-cell grid + error boundary
  components/SplitPane/  CSS-grid split with a role="separator" divider (pointer + keyboard)
  components/Surface/    the tree walker
  components/Launcher/   LauncherShell + Mod-K routing
  stories/demoApps.tsx   two demo apps for the stories
  workbench.test.ts      verbs against the protocol types (28 tests across the package)
test/                    no-raw-controls, no-hex, component-folders
```

### 7.2 The public API as built

```ts
defineApp({ id, title, tone, singleton, duplicable?, docBound?, titleFor?(view), Component })
createAppRegistry(apps) → { get(id), list() }

tile(appId, { documents?, title? })          // a leaf spec
split("row" | "col", ratio, a, b)            // a split spec
layout(spec, { id?, name? })                 // → WorkbenchDocument, built through viewCreate/workspaceCreate
singleTile(appId)                            //    mutations and the protocol's leafNode/splitNode/applyMutations
serializeDocument(doc) / parseDocument(json) // protobuf JSON

const wb = createWorkbench({ apps, initial });
wb.store · wb.useDocument() · wb.useWorkbenchState(selector) · wb.mutate(mutations) · wb.perform(verb)
wb.serialize() · wb.restore(json) · wb.reset() · wb.activePlacementId() · wb.root()
wb.Surface · wb.Launcher
wb.verbs.split(placementId, dir, appId?)     // no appId = duplicate; a singleton → a linked placement of its view
wb.verbs.close(placementId)                  // no-op on the last tile
wb.verbs.swap(a, b) · wb.verbs.dock(source, target, zone)
wb.verbs.resize(splitId, ratio, { snap? })   // clamp 0.1–0.9, then snapRatio
wb.verbs.place(appId, { from? })             // placed singleton → go to; else split along the longer rendered axis
wb.verbs.setTitle(viewId, title) · wb.verbs.openView(appId, documents, { near?, title? })
wb.verbs.activate(placementId) · wb.verbs.openLauncher() / closeLauncher()
```

The data door: `workbenchVerbs.*` produce `{kind: "tile.split" | "tile.close" | "tile.swap" | "tile.dock" | "tile.activate" | "split.resize" | "app.place" | "view.setTitle" | "view.open" | "launcher.open" | "launcher.close", …}`; `performWorkbenchVerb(handlers, verb)` executes one; `isWorkbenchVerb` and `describeWorkbenchVerb` let a product router and a trace treat them like any other verb.

`<Surface renderTitle?(view, {placementId, app, label, canClose, placementCount}) />` renders splits as CSS grids with a keyboard-operable divider (live ratio while dragging, `resizeSplit` snapped on release), leaves as pbui `TileFrame` + `useTileDrag`, the app inside a one-cell grid, an error boundary per tile, and `EmptyState` for an unknown app id. `<Launcher title? shortcut? shortcutContext?() />` wraps `LauncherShell`, routes Mod-K through `routeWorkbenchKey`/`isEditableTarget`/`useAnyEscapeSurface`, and registers no escape surface.

### 7.3 Differences from the design (§6)

| §6 said | Built | Why |
|---|---|---|
| verb kinds `view.place`, `view.title` | `app.place`, `view.setTitle`, plus `tile.activate`, `launcher.open/close` | naming; the extra kinds make the launcher and the active tile addressable as data |
| `openView(appId, documents, {near})` | same, plus `title?` and "identical bindings → go to" | a doc-bound view with the same bindings is the same view; opening it twice would be a duplicate |
| launcher lists every app | doc-bound apps are hidden from *new tile* | they would open empty; covered by a test |
| `restore()` only | `reset()` added | the demo's "reset layout" action |

Everything else in §6 holds: one protocol document as state, builders for every gesture, no Redux, no server, `TileFrame`/`useTileDrag`/`LauncherShell` as the chrome, local-only fields never serialised.

### 7.4 Verification

- `pnpm --filter @hyperslop-systems/pbui-workbench typecheck && test && build && build-storybook` — 28 tests: split/close/swap/dock/resize through `verbs` produce the expected documents (asserted with the protocol types); resize clamps and snaps; `place` picks the longer rendered axis; `Surface` renders one `TileFrame` per leaf; the last tile cannot close; the launcher hides doc-bound apps.
- `pnpm --filter @hyperslop-systems/pbui-chat typecheck && test && build` — 43 tests, including the router's `openTile` routing to the workbench when attached.
- Demo typecheck and build into `pkg/chatui/embed` (with `.gitkeep` restored).
- Browser (Playwright against the Go server): four `TileFrame` tiles (chat 60 % | inspector / watchlist / trace), no console errors; the split button on *watchlist* produced a linked fifth tile (four views, five placements); dragging the root divider committed 0.6 → 0.4 and survived a reload through `localStorage["pbui-chat-demo.workbench.v1"]`; Ctrl-K opened the launcher with the status "a new tile opens below “chat”", and placing *trace* created it there; "which gold eagles are low on stock?" worked inside the chat tile; *Open in tile* on the Low-stock widget opened a `widget` tile bound to `msg-1-w1` and recorded `openInTile ✓` in the trace. Screenshot: `various/01-browser-tiles-open-in-tile.png`.
- One anomaly was observed once and not reproduced: after a stale-reference click error in the automation, one evaluation briefly listed an extra unbound `widget` tile that was gone by the next evaluation and never persisted. It is recorded here rather than hidden; no code path that creates an untraced tile was found.

### 7.5 A defect the tiles exposed: the implicit grid column

Narrowing the chat tile revealed that a wide table widget stretched the chat application past the tile and made the tile body scroll horizontally, while a hover — which re-renders every presentation — made it lay out correctly. The measurement chain (`clientWidth/scrollWidth` from the table up to the tile) showed the transcript, an `overflow: auto` block, at the table's intrinsic width inside a 349 px tile. The cause was one missing declaration: `ChatApp.module.css` declared a grid with `grid-template-rows` and no `grid-template-columns`. An implicit column track is `auto`, and `auto` sizes to the widest child's max-content; `minmax(0, 1fr)` is required on both axes of any container that may hold a wide widget. The rule every tile author should carry: **a tile's application root is a grid with `minmax(0, 1fr)` columns and rows, and a scrolling region inside it is the only place a wide child may overflow.** A structural test (`packages/pbui-chat/test/grid-columns.test.ts`) now fails any `display: grid` rule in pbui-chat or pbui-workbench that omits a column template; a rule whose template is computed at runtime (the split pane) opts out with a `/* grid-columns: inline */` marker.

A second lesson from the same fix: the demo consumes the libraries through their `dist`, so `make chat-ui` and the devctl `build.run` build `pbui-workbench` and `pbui-chat` before the demo; a source edit in a library is invisible to the demo until that library is rebuilt.

## 8 · pbui-chat on tiles

`packages/pbui-chat/src/apps/createChatApps.tsx` turns the chat package's surfaces into apps:

| App | singleton | docBound | Component |
|---|---|---|---|
| `chat` | no | no | `Messages` + `Composer` + `MouseDocLine` |
| `inspector`, `watchlist`, `trace` | yes | no | the existing panels |
| `widget` | no | yes (`documents.widget = <instanceId>`) | `WidgetOutlet` over the named widget instance |

`createPbuiChat({ …, workbench? })` (or `chat.attachWorkbench(wb)`) binds the router's `openTile(widgetId)` to `wb.verbs.openView("widget", {widget: widgetId}, {near: wb.activePlacementId(), title})`; without a workbench the old `TilesPanel` remains as the fallback. The demo (`packages/pbui-chat/demo/src/{workbench.ts,App.tsx}`) builds `createWorkbench({ apps: createChatApps(chat), initial: layout(split("row", 0.6, tile("chat"), split("col", 1/3, tile("inspector"), split("col", 0.5, tile("watchlist"), tile("trace"))))) })`, persists the layout under `pbui-chat-demo.workbench.v1`, keeps the legend, the approver toggle, a *launcher* button and *reset layout* in the header, and mounts `ObjectMenu` and `AcceptBanner` once.

Two follow-ups belong to this seam: a `tile` presentation type in the chat vocabulary (so the tile title becomes a `<Presentation>` with the tile descriptor's verbs, as in datalab-ui — `renderTitle` renders plain text today because `vocabulary.json` is embedded by the Go server and asserted equal by a test on each side), and the hosted mode of §6.5 once a workbench server sits next to the chat server.

### 8.1 Sequence: "Open in tile"

```
user   R-click <widget Low stock> → ObjectMenu → "Open in tile"
       → router.perform({kind:"openInTile", widgetId:"msg-1-w1"})          family: local
       → ctx.openTile("msg-1-w1")
       → wb.verbs.openView("widget", {widget:"msg-1-w1"}, {near: active, title:"Low stock"})
         → builders: viewCreate{appId:"widget", documents:{widget:"msg-1-w1"}} + placementSplit(near, longer axis)
         → store.mutate(mutations) → applyMutations → new document → Surface re-renders
       → POST /api/chat/sessions/{id}/verbs {actor:"human", verb:{kind:"openInTile",…}, outcome:"performed"}
         → trace entry #1 "openInTile ✓"
```

## 9 · API reference

### 9.1 PBUI chrome (`@hyperslop-systems/pbui`)

| Export | Signature | Notes |
|---|---|---|
| `TileFrame` | `(props: TileFrameProps) => JSX` | see §2.1; emits `data-part="tile"`, `data-placement-id`, `data-state="dragging"` |
| `DropZoneOverlay` | `({zone, swapLabel?, dockLabel?})` | rendered by `TileFrame` when `dropZone` is set |
| `useTileDrag` | `({id, onSwap, onDock}) => {register, onGripPointerDown, dragging, zone}` | module-level registry; `registeredTileCount()` for tests |
| `LauncherShell` | `({title, groups, query, onQueryChange, onChoose, onClose, status?, enterVerb?, searchLabel?, placeholder?, emptyText?})` | registers no escape surface |
| `splitDirectionFor` | `(placementId, root?) => "row" \| "col"` | reads the rendered box |
| `routeWorkbenchKey` | `(event, context, platform?) => {kind:"ignore"} \| {kind:"open-launcher"}` | Mod-K only |
| `isModKey`, `isEditableTarget` | pure helpers | |
| `createPbui` runtime | `Provider`, `Presentation`, `ObjectMenu`, `MouseDocLine`, `AcceptBanner`, `usePbui` | §1 |
| `useEscapeSurface` | `(open: boolean) => ownsEscape` | `pbui/src/surfaces.ts`; the escape stack |
| components | `IconButton`, `Button`, `TextInput`, `Dialog`, `EmptyState`, `Callout`, `Stack`, `Surface`, … | `pbui/src/components` |

### 9.2 Workbench protocol (`@hyperslop-systems/workbench-protocol`)

| Export | Signature | Notes |
|---|---|---|
| types | `WorkbenchDocument`, `Workspace`, `Node`, `Leaf`, `Split`, `Direction`, `AppView`, `DocumentPayload`, `Mutation`, `MutationBatch`, `WorkbenchResource`, `WorkbenchConflict`, `WorkbenchUpdatedEvent` + `*Schema` | generated by protoc-gen-es |
| `applyMutation` | `(doc, mutation) => WorkbenchDocument` | clones first; throws `MutationError{code, path}` |
| `applyMutations` | `(doc, mutations[]) => WorkbenchDocument` | |
| `newId`, `leafNode`, `splitNode` | construction | |
| `findNode`, `leaves`, `viewsOfApp`, `placementCount`, `workspaceOfPlacement`, `workspaceTree`, `boundDocumentId` | queries | |
| `splitPlacement`, `closePlacement`, `swapPlacements`, `dockPlacement`, `resizeSplit` | `(doc, …) => Mutation[]` | config-independent verbs |
| `createWorkbenchClient` | `({sourceBinding, launcherAppId, isBindableDocument?}) => {replaceApp, linkViewIntoPlacement, splitWithApp, defaultSourceDocumentId, …}` | product-configured verbs |
| `SNAP_RATIOS`, `SNAP_TOLERANCE`, `snapRatio` | `(value) => {ratio, snapped}` | |

Go mirror (`github.com/hyperslop-systems/pbui/pkg/workbench`): `ApplyMutations(ctx, doc, mutations, deps, limits)`, `Validate(ctx, doc, deps, limits)`, `Clone`, `Limits`/`DefaultLimits`, `ApplicationCatalog`, `DocumentValidator`, `ValidationError{Code, Path, Detail}`.

### 9.3 `@hyperslop-systems/pbui-workbench` and pbui-chat apps

| Export | Signature |
|---|---|
| `defineApp` | `({id, title, tone, singleton, duplicable?, docBound?, titleFor?, Component}) => AppDescriptor` |
| `createAppRegistry` | `(apps) => {get, list}` |
| `tile`, `split`, `layout`, `singleTile` | document builders (§7.2) |
| `serializeDocument`, `parseDocument` | protobuf JSON |
| `createWorkbench` | `({apps, initial}) => Workbench` (§7.2) |
| `workbenchVerbs`, `performWorkbenchVerb`, `isWorkbenchVerb`, `describeWorkbenchVerb` | verbs as data |
| `Surface`, `Launcher` | components bound to a workbench through context |
| pbui-chat `createChatApps` | `(chat, {tones?, titles?}) => AppDescriptor[]` |
| pbui-chat `createPbuiChat({ workbench? })`, `chat.attachWorkbench(wb)` | binds `openTile` |

### 9.4 Hosted workbench HTTP (datalab)

| Method · path | Headers | Success | Failure |
|---|---|---|---|
| `POST /v1/workbenches` | `Idempotency-Key` | 201, `ETag`, `Location` | 400 validation |
| `GET /v1/workbenches/{id}` | — | 200, `ETag: "workbench-{id}-{rev}"` | 404 |
| `PUT /v1/workbenches/{id}` | `If-Match`, `Idempotency-Key` | 200 | 428 missing If-Match · 409 `WorkbenchConflict` · 400 validation |
| `POST /v1/workbenches/{id}/mutate` | `If-Match`, `Idempotency-Key` | 200 (replayed when the key is known) | as above |
| `DELETE /v1/workbenches/{id}` | `If-Match` | 204 | 428 · 409 |
| `GET /v1/workbenches/{id}/stream?after=N` | `Last-Event-ID` alternative | `event: workbench.updated` `id: rev` `data: {workbenchId, revision}`; `: keepalive` every 20 s | — |

### 9.5 Agent CLI

`hyperslop ui list | get | create | replace | mutate | delete | stream`; `mutate <workbench> --file batch.json --revision N [--request-id …]` sends a protobuf-JSON `MutationBatch` with the two headers.

## 10 · File reference

| Area | Path |
|---|---|
| presentation protocol | `pbui/src/presentation/{types.ts,registry.ts,createPbui.tsx}`, `pbui/src/surfaces.ts` |
| chrome kit | `pbui/src/chrome/{TileFrame.tsx,useTileDrag.ts,LauncherShell.tsx,shortcutRouting.ts,index.ts}`, `pbui/public/chrome.css`, tests `pbui/src/chrome/chrome.test.tsx` |
| protocol schema | `pbui/proto/hyperslop/pbui/workbench/v1/workbench.proto` |
| protocol TS | `pbui/packages/workbench-protocol/src/{index.ts,generated/…,client/{apply,builders,ratios,index}.ts}`, fixtures `fixtures/mutations/*.json`, `src/client/{applierParity,client}.test.ts` |
| protocol Go | `pbui/pkg/workbench/{model,mutation,validate,clone,errors}.go`, `parity_fixtures_test.go`; `pbui/pkg/workbenchapi/json.go` |
| datalab-ui layout | `pbui/packages/datalab-ui/src/store/{layout.ts,layoutTree.ts,applyVerb.ts,applyLayoutVerb.ts,persist.ts,remote.ts}` |
| datalab-ui tile & shell | `…/components/organisms/{Tile/Tile.tsx,SplitView/SplitView.tsx}`, `…/components/pages/Workbench/{Workbench.tsx,WorkbenchShell.tsx,WorkbenchProviders.tsx}` |
| datalab-ui launcher | `…/apps/LauncherApp/{LauncherApp.tsx,LauncherDialog.tsx,LauncherResults.tsx,launcherIndex.logic.ts}` |
| datalab-ui app contract | `…/appkit/{registry.ts,AppScope.tsx,useRemoteWorkbench.ts,useTransientSurface.ts,usePersistence.ts}`, `…/api/{client.ts,workbenchStream.ts}`, `…/remote/{codec.ts,types.ts}` |
| datalab-ui descriptors | `…/pbui/descriptors/{tile.ts,workspace.ts}`, `…/pbui/types.ts` (`TileRef`) |
| datalab server | `datalab/pkg/server/{server.go,handlers_workbenches.go,workbench_hub.go}`, `datalab/pkg/workbenchapp/{catalog.go,documents.go,graphic_validation.go}`, `datalab/pkg/store/workbenches.go`, `migrations/0007_workbenches.sql` |
| agent CLI | `hyperslop-cli/pkg/client/workbenches.go`, `hyperslop-cli/pkg/cli/uicmd/*` |
| design records | `datalab/ttmp/2026/07/30/DATADROP-18--…/design-doc/02-pragmatic-workspace-snapshot-and-agent-mutation-api.md`; `pbui/ttmp/2026/07/31/PBUI-UNIFY-001--…/design-doc/01-…md` (DR-U2..U6); `pbui/ttmp/2026/07/30/DATALAB-VIEW-001--…/design-doc/{01,02}-…md`; `pbui/docs/playbooks/building-a-new-hyperslop-systems-app-on-pbui.md` §6 |
| pbui-chat (PBUI-AGENT-1) | `pbui/packages/pbui-chat/src/{createPbuiChat.tsx,router/createVerbRouter.ts,store/chatStore.ts,panels/*}`, `pbui/pkg/pbuichat`, `pbui/pkg/chatserver`, ticket `pbui/ttmp/2026/08/20/PBUI-AGENT-1--…/` |
| this ticket | `pbui/packages/pbui-workbench/` (new), `pbui/packages/pbui-chat/src/apps/` (new), `pbui/packages/pbui-chat/demo/src/App.tsx` |
