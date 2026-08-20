---
Title: 'Intern guide: unifying the PBUI applications around one workbench package'
Ticket: PBUI-WORKBENCH-2
Status: active
Topics:
    - pbui
    - frontend
    - refactoring
DocType: design-doc
Intent: long-term
Owners: []
RelatedFiles:
    - Path: repo://packages/pbui-workbench/src/components/Launcher/Launcher.tsx
      Note: Launcher that gains the rows/choose slot and per-pane invocation
    - Path: repo://packages/pbui-workbench/src/createWorkbench.tsx
      Note: Options surface that gains store injection, hooks, splitPolicy and binding
    - Path: repo://packages/pbui-workbench/src/store.ts
      Note: WorkbenchStore interface a Redux adapter implements
    - Path: repo://packages/pbui-workbench/src/verbs.ts
      Note: Verb handlers the additions extend (workspaces, replace/link/rebind, zone-aware open)
    - Path: repo://packages/workbench-protocol/src/client/builders.ts
      Note: createWorkbenchClient config (sourceBinding, launcherAppId) the binding option adopts
ExternalSources: []
Summary: 'An intern-level analysis, design and implementation guide for making agentlogic, turboproof, hyperblog and datalab-ui share one workbench shell (@hyperslop-systems/pbui-workbench): what each product built, a feature matrix against the package, the features worth lifting into the shared core with API sketches, and a per-product migration plan with risks and verification.'
LastUpdated: 2026-08-20T14:29:03.751088984-04:00
WhatFor: Let someone new execute the unification product by product without re-reading five repositories, and give reviewers one place to challenge what goes into the shared core.
WhenToUse: Read before extending pbui-workbench or migrating any product onto it; §4 is the matrix, §5 the core additions, §6 the migrations.
---


# Intern guide: unifying the PBUI applications around one workbench package

## 0 · Purpose, scope, and how to read this

Four PBUI products — agentlogic, turboproof, hyperblog and datalab-ui — each render their work as a workbench: workspaces of split trees of tiles, with split/close/swap/dock/resize gestures and a launcher. Two layers of that system are already shared across them: the tile chrome in `@hyperslop-systems/pbui` (`TileFrame`, `useTileDrag`, `LauncherShell`, `splitDirectionFor`, the Mod-K router) and the document applier and gesture builders in `@hyperslop-systems/workbench-protocol/client`. The layer between — holding the document, rendering the tree, wiring gestures to mutations, the active tile, the launcher's policy, persistence — was written four times. Ticket PBUI-WORKBENCH-1 extracted that layer as `@hyperslop-systems/pbui-workbench` with the chat agent as its first consumer. This ticket plans the rest: what each product's shell does that the package does not yet do, which of those things belong in the shared core, how to add them, and how to move each product over.

Sections 1–3 are the analysis (the shared baseline and the four shells as they are); section 4 is the feature matrix; section 5 designs the core additions; section 6 is the migration plan per product; section 7 sequences the work; sections 8–9 are references. All claims name files and lines. Paths: `pbui/…` is the PBUI repository (workspace copy at `/home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui`); `AL/`, `TP/`, `HB/` are `~/code/wesen/hyperslop-systems/{agentlogic,turboproof,hyperblog}/ui`; `DL/` is `pbui/packages/datalab-ui`; `PW/` is `pbui/packages/pbui-workbench/src`. The companion guide in PBUI-WORKBENCH-1 explains the presentation protocol, the chrome kit, the protocol document and datalab-ui's implementation in depth; this guide repeats only what is needed to follow the argument.

## 1 · The shared baseline: what `pbui-workbench` is today

### 1.1 The one sentence

The package holds a protocol `WorkbenchDocument` in a local store, renders the active workspace's tree with PBUI's chrome, and turns every gesture into `Mutation[]` through the protocol builders, applied with the same `applyMutations` the Go server uses. It has no Redux, no server and no product knowledge.

### 1.2 Public API (`PW/index.ts`)

```ts
defineApp({ id, title, tone, singleton, duplicable?, docBound?, titleFor?(view), Component })   // apps.ts:53
createAppRegistry(apps) → { get(id), list() }                         // throws on a duplicate id (apps.ts:74)
tile(appId, {documents?, title?}) · split(dir, ratio, a, b) · layout(spec, {id?, name?, workspaceId?})
singleTile(appId) · emptyDocument() · serializeDocument(doc) · parseDocument(json)   // document.ts
createWorkbench({ apps, initial }) → Workbench                        // createWorkbench.tsx:24
  .store .verbs .useDocument() .useWorkbenchState(sel) .mutate(ms) .perform(verb)
  .serialize() .restore(json) .reset() .activePlacementId() .root() .Surface .Launcher
workbenchVerbs.{split, close, swap, dock, activate, resize, place, setTitle, open, openLauncher, closeLauncher}
performWorkbenchVerb(handlers, verb) · isWorkbenchVerb(v) · describeWorkbenchVerb(v)   // verbs.ts
```

State (`PW/store.ts:11-18`): `{ document, workspaceId, activePlacementId, launcherOpen }`; only `document` is serialised. `mutate()` applies a batch atomically with `applyMutations`; a `MutationError` drops the whole batch with a `console.warn` and returns `false` (`store.ts:67-80`). Subscription is a `Set` of listeners read through `useSyncExternalStore` (`store.ts:93-99`), so selectors must return referentially stable values.

Verb behaviour that matters for the products (`PW/verbs.ts`): `split` without an app **duplicates** a non-singleton view (fresh id, copied bindings and title) and **links** a singleton or `duplicable:false` app (`:240-261`); `close` refuses the last tile before the applier sees it (`:268-274`); `dock` re-activates by following the moved view (`:354-363`); `resize` clamps to `[0.1, 0.9]` and snaps to `[0.25, 1/3, 0.5, 2/3, 0.75]` (`:276-280`); `place` goes to a placed singleton or splits the active tile along its longer rendered axis (`:288-309`); `openView` de-duplicates a doc-bound view with identical bindings (`:311-337`); `setTitle` trims and clears without touching bindings (`:339-352`).

Components: `Surface` walks the tree (`Surface.tsx:24-30`); `SplitPane` is a CSS grid `minmax(0, r fr) auto minmax(0, 1−r fr)` with a `role="separator"` divider, live ratio in local state and one `resizeSplit` on release, arrow keys ±0.05 unsnapped (`SplitPane.tsx:36-115`); `Tile` wires `TileFrame` and `useTileDrag`, activates on `pointerdowncapture`/`focuscapture` without moving focus, puts the app in a one-cell grid inside an error boundary, and renders `EmptyState` for an unknown app (`Tile.tsx:22-131`); `Launcher` is `LauncherShell` with two fixed groups (*ON SCREEN*, *NEW TILE*), substring filtering, a status line naming the target, Mod-K routing with the multi-workbench ownership rule, and doc-bound apps hidden (`Launcher.tsx:27-131`).

### 1.3 What it does not do (verified against the source)

No workspace switching verb or UI (`workspaceId` can only be set through `store.setState`); no replace-in-place (`viewConfigure.app_id`, `placementReplace`) verb; no linking a pane to an existing view; no inline rename UI; no focus restoration; no full-frame; no persistence adapter, debounce or schema-version check (`parseDocument` checks only `format` and a tree, `document.ts:112-113`); no hosted mode; no document bars; no app scoping; no notices; no import/export; no templates; no linked-view badge; no pixel minimum; no tile keyboard navigation; no external drops; no window title; no store injection (`createWorkbench` always creates its own store, `createWorkbench.tsx:27`); no `blurb`/`group` on the descriptor; no launcher rows slot; no error callback on a refused batch. Tests: 24 across six files; none for `SplitPane` drag, the error boundary, or drag swap/dock through the UI.

## 2 · The four shells today

### 2.1 agentlogic (`AL/`)

**Architecture.** Layout state is a React context over `useState<WorkbenchDocument>` (`src/store/workbenchContext.tsx:141`, 413 lines) — the protocol document directly — with `mode: "local" | "synced"`, `currentWorkspaceId` and refs for the sync queue. Product configuration is `src/store/workbench.ts` (169 lines): re-exports of eighteen protocol symbols under historical names (`:42-61`), the constants `TRANSCRIPT_BINDING`, `TRANSCRIPT_REF_FORMAT`, `LAUNCHER_APP`, and the **configured client** `createWorkbenchClient({ sourceBinding: "transcript", launcherAppId: "launcher", isBindableDocument })` (`:82-97`). The tree renderer is `src/components/organisms/TileTree/TileTree.tsx` (200 lines, `NodeView`/`SplitView`/`TileView`/`Frame`), whose comment calls `Frame` "the product's ten-line adapter onto pbui's shared tile chrome". The launcher is an **app**: `src/apps/LauncherApp.tsx` + `LauncherPanel.tsx` render a grid of app buttons inside an empty pane. The registry is a module-level `Map` with side-effect registration (`src/appkit/registry.ts:54-56`, `apps/all.ts`), `AppDescriptor { id, title, tone, singleton, blurb, Component }`.

**Model.** The ⬌/⬍ buttons call the configured `splitPlacement`, which always mints a **launcher view** in the new pane; the user then picks in place, and `replaceApp` retargets the launcher view or links an existing singleton view (`workbench-protocol/src/client/builders.ts:329-386`). There is no active placement, no rename, no keyboard shortcuts, no error boundary.

**Persistence and sync.** `localStorage["agentlogic.workbench.v2"]` written synchronously on every change as protobuf JSON, read with `fromJson(…, { ignoreUnknownFields: false })` so a stale shape falls back to defaults (`workbenchContext.tsx:57-58, 92-110`). Server sync (`:112-336`): probe `/v1/me` → get-or-create `/v1/workbenches`; a 400 ms-debounced `POST /v1/workbenches/{id}/mutate` with `If-Match` and an `Idempotency-Key`; **409 → refetch and rebase** the queue onto the fresh document, dropping mutations that no longer apply (`:184-207`); SSE `EventSource` refetch when idle (`:317-336`); reset is a wholesale `PUT` (`:379-406`). The rebase loop applies mutations **one at a time** with `applyMutation`, which is a semantic it must keep.

**Features.** Split (→ launcher pane), close (last-leaf rule), swap, dock, pointer resize (clamp `[0.15, 0.85]`, preview then commit), in-pane launcher (no search, no groups), four seeded workspaces switched by a button strip (`pages/Workbench/Workbench.tsx:55-73`), reset, tones with a contrast test (`TileTree.tones.test.ts`), empty states for missing view/app/binding (`TileTree.tsx:103-126`, `BoundWorld.tsx:85-126`), transcript binding resolution in `BoundWorld`. Absent: keyboard resize, Mod-K, go-to, duplicate, rename, title presentation, focus, full-frame, error boundary, import/export.

### 2.2 turboproof (`TP/`)

**Architecture.** Turboproof has already done the layering PBUI-UNIFY-001 asked for: `src/store/workbench.ts` (510 lines) is a re-export barrel over the protocol client (`:51-70`), product constants and the seed (`:72-172`: `LAUNCHER_APP`, `SOURCE_BINDING = "source"`, `defaultWorkbench` with three workspaces), the product document type `turboproof.lean-source` with `leanSourceOf`/`putLeanSource`/`openLeanFile`/`revealLeanFile`/`placeSourceView`/`followSourceDocument` (`:174-453`), and the configured client (`:455-505`). The document lives **in a Redux slice** (`src/store/slice.ts:38-69`) together with the server relationship: `workbenchId`, `revision` (a decimal string), an `outbox` of applied-but-unacked mutations, `inFlight`, `syncPhase`, `staleAtRevision`, `isolating` (send one mutation per request after a 422), and `launcher: { placementId, activePlacementId } | null`. `src/store/sync.tsx` is a headless component doing bootstrap/probe, one-time rail seeding, localStorage persistence (`turboproof.workbench.v1`), the 400 ms flush with `If-Match`, 409 → rebase, 422 → reject/isolate, exponential backoff, and SSE. `src/state/filesTile.ts` routes file verbs to the right mounted tile by placement id (a singleton view linked into two panes mounts two `FilesApp`s). `src/components/pages/Workbench.tsx` (353 lines) holds the **one interpreter** `perform` (`:95-238`), `LauncherShortcut` with `routeWorkbenchKey` (`:283-311`), and `AcceptBridge` for swap-by-accept (`:313-353`). `organisms/Tile.tsx` (143) adapts `TileFrame`: a `<tile>` presentation title with a `×N` linked badge and a file-name chip, and per-tile drop labels computed from the pending placement. `organisms/NodeView.tsx` is a flex split with a `<button>` divider, preview then commit, arrow keys that snap. `organisms/LauncherDialog.tsx` wraps `LauncherShell` with a pure rows model (`model/launcherSearch.ts`: views first, launcher views excluded, substring filter over title/id/blurb) and two modes: per-pane *replace* and global *go to / open*.

**Features unique to turboproof.** **Placement mode** (`src/state/placement.ts`): an armed, modal aim-at-a-pane mode started from the files tile after a read, with a banner and a DOM hit test over `[data-part="tile"][data-placement-id]`, committed as `openLeanFile`/`revealLeanFile` into a zone of the chosen pane (centre rebinding the editor, edges docking a new view). **Active-document following** (`followSourceDocument`): placing an editor rebinds every non-source view in the workspace that carries a `source` binding, in the same batch. **Seed-into-existing-document** (`src/store/seed.ts`): retrofits a rail app into documents users already have, once per client. **Registry ↔ Go catalog parity** through `registry.fixture.json`. Absent: rename, error boundary, active placement (computed at Mod-K time from the DOM), focus restoration, duplicate-a-tile, `role="separator"` dividers.

### 2.3 hyperblog (`HB/`)

**Architecture.** The pane tree is `src/model/paneTree.ts` (261 lines; `model/layout.ts` is the term-map force layout, a different thing): its own `Node` type with `appId` and `bindings` **inlined into the leaf** — there is no view/placement distinction — pure operations (`replaceLeaf`, `removeLeaf`, `findLeaf`, `swapLeaves` exchanging contents so ids survive, `dock` moving a leaf as a new leaf), and `applyLayoutVerb(tree, verb, isSingleton)` returning `null` for verbs not about the tree. State is `useState<Workspace[]>` in `pages/Workbench/Workbench.tsx` (378 lines) with a `handled` flag set inside the updater (a strict-mode hazard, `:143-148`). The registry is side-effect `register()` with `TileDefinition { id, title, blurb, group, singleton, component }` and `TileProps { placementId, bindings, perform }` (`src/appkit/registry.ts`); fourteen tiles, only `reader` non-singleton. `@hyperslop-systems/workbench-protocol` is declared in `package.json` and **unused**; the Go server implements the whole protocol (`pkg/store/workbenches.go`, `/v1/workbenches/*`, SSE) and the browser is the only side that does not speak it.

**Policy worth keeping.** `companionFor` (`paneTree.ts:89-95`): a singleton's new pane is the **launcher tile**, a non-singleton duplicates with copied bindings; `replaceView` clears bindings; bindings-or-cursor fallback (an absent binding means "follow the global cursor"); six seeded workspaces as "arrangements, not pages"; group → tone mapping; the `<tile>` presentation title with pin verbs ("Hold this pane on …" / "Follow the cursor"); a Go-catalog parity fixture.

**Features.** Split, close (last-tile no-op), swap and dock by drag, an in-pane launcher tile, six workspace tabs, tones, a mouse-doc line. Absent: **resize** (the divider is an inert `div` with `cursor: col-resize`), any keyboard shortcut, a placing launcher ("open X in a new tile" does not exist), rename, active tile, error boundaries, persistence. One dead verb: "Swap with… (accept a tile)" is emitted by the descriptor and handled by nothing.

### 2.4 datalab-ui (`DL/`)

Analysed in depth in PBUI-WORKBENCH-1. The shape: `store/layout.ts` (1 162 lines) is an RTK slice over its **own tree type** (`store/layoutTree.ts`), converted to the protocol only at the remote boundary (`remote/codec.ts`); stages and audiences above workspaces; `organisms/Tile/Tile.tsx` hand-rolls the frame and uses only `useTileDrag`/`DropZoneOverlay`; `pages/Workbench/WorkbenchShell.tsx` owns the window-capture keyboard router and the ownership rule; `apps/LauncherApp/LauncherDialog.tsx` (506 lines) owns the rows model, `choose()` and focus restoration by placement id one frame later; `appkit/useRemoteWorkbench.ts` is a whole-document `PUT` controller with fingerprint-keyed idempotency, three conflict paths and SSE invalidation. It has the richest tile descriptor (rename, linked duplicate, duplicate with `disabledBecause`, replace, copy/paste view, save as template, close everywhere), inline rename, templates, import/export, notices, app scoping (instance ∩ stage ∩ workspace), and a full-frame mode.

### 2.5 Sizes, and what each already shares

| Product | Shell lines (approx.) | Document | State | From pbui chrome | From protocol client |
|---|---|---|---|---|---|
| agentlogic | 510 | protocol doc | React context | `TileFrame`, `useTileDrag` | builders, `applyMutation`, `createWorkbenchClient` |
| turboproof | 1 190 | protocol doc | Redux slice | `TileFrame`, `useTileDrag`, `LauncherShell`, `splitDirectionFor`, `routeWorkbenchKey` | builders, `applyMutation`, `createWorkbenchClient` |
| hyperblog | 560 | own tree | `useState` | `TileFrame`, `useTileDrag` | none |
| datalab-ui | 2 300+ | own tree, codec at the boundary | Redux slices | `useTileDrag`, `DropZoneOverlay`, `routeWorkbenchKey` | none at runtime |
| pbui-workbench | — | protocol doc | `useSyncExternalStore` store | all of the above | all of the above |

## 3 · Three architectural divergences the plan must resolve

Before listing features, three structural differences decide the shape of the shared core.

**Who owns the store.** agentlogic and the package own their document in component or module state; turboproof owns it in Redux so that `SessionHost`, `SaveControl`, `FilesApp`, the workspace strip and the sync component can all observe it through `useAppSelector`; datalab-ui likewise. A shared shell that insists on its own store cannot be adopted by a Redux product without mirroring state, and mirrored state is two sources of truth. The package must therefore **accept an injected `WorkbenchStore`** — the interface it already defines (`PW/store.ts:25-38`: `getState`, `subscribe`, `setState`, `mutate`, `replaceDocument`).

**What a split means.** The package's bare split duplicates or links; agentlogic's and turboproof's split opens an **empty pane showing the launcher app**; hyperblog's opens the launcher tile for singletons and duplicates otherwise. These are product policies over the same mutation (`placementSplit` with a new view of some app), so the core must offer a **split policy** rather than a fixed default.

**Where the launcher's rows come from.** The package hard-codes two groups over the registry; turboproof and datalab-ui have pure rows models with their own groups (*OPEN VIEWS* with placement counts, blurbs, workspace scoping); hyperblog's launcher is a tile. DR-U6 already decided that launcher *policy* stays with the product; the package must therefore expose a **rows model slot** while keeping the mechanics (Mod-K arbitration, status line, `LauncherShell` wiring, `place` rule).

## 4 · The feature matrix

Legend: ✓ present · ~ partial · ✗ absent. The last column says where the capability should live after unification: **core** (the package), **core-opt** (in the package behind an option or slot), **product** (stays product-owned), **protocol** (a change to `workbench-protocol` or the Go validator).

| Capability | agentlogic | turboproof | hyperblog | datalab-ui | pbui-workbench | Home |
|---|---|---|---|---|---|---|
| Document is the protocol `WorkbenchDocument` | ✓ | ✓ | ✗ | ✗ (codec) | ✓ | core |
| Split / close / swap / dock | ✓ | ✓ | ✓ | ✓ | ✓ | core |
| Pointer resize, preview then commit | ✓ | ✓ | ✗ | ✓ | ✓ | core |
| Keyboard resize, `role="separator"` | ✗ | ~ (button) | ✗ | ✓ | ✓ | core |
| Snap ratios | ✓ | ✓ | ✗ | ✓ (own copy) | ✓ | core |
| Last-tile close guard | ✓ | ✓ | ✓ | ✓ | ✓ | core |
| Active placement tracked | ✗ | ~ (DOM at Mod-K) | ✗ | ✓ | ✓ | core |
| Error boundary per tile | ✗ | ✗ | ✗ | ✓ (`RenderBoundary`) | ✓ | core |
| Empty state for missing app/view | ✓ | ~ (plain text) | ✓ | ✓ | ✓ | core |
| Multiple workspaces + switching | ✓ (4) | ✓ (3) | ✓ (6) | ✓ (+stages) | ✗ | **core** |
| Workspace create/rename/delete/clone | ✗ | ✗ | ✗ | ✓ | ✗ | core-opt |
| Replace what a pane shows (in place) | ✓ (`replaceApp`) | ✓ | ✓ (`replaceView`) | ✓ | ✗ | **core** |
| Link a pane to an existing view | ✓ | ✓ | ✗ | ✓ | ✗ | **core** |
| Split policy (duplicate / link / launcher pane) | launcher | launcher | launcher or duplicate | launcher | duplicate or link | **core-opt** |
| Default document binding on placement | ✓ (`sourceBinding`) | ✓ | ✗ | ✓ (`primary`) | ✗ | core-opt |
| Rebind a view's documents | ✗ | ✓ | ✓ (`bindTile`) | ✓ (`setViewDocument`) | ✗ | **core** |
| Rename a view | ✗ | ✗ | ✗ | ✓ (inline) | ~ (verb only) | core (verb) / core-opt (UI) |
| Modal launcher with Mod-K | ✗ | ✓ | ✗ | ✓ | ✓ | core |
| Launcher rows model slot (groups, blurbs, search) | ✗ | ✓ (own) | ✗ | ✓ (own) | ✗ (fixed) | **core-opt** |
| Per-pane launcher invocation ("replace this pane") | ✓ (in-pane app) | ✓ | ✓ (launcher tile) | ✓ | ✗ | **core** |
| Go to a placed view / singleton | ~ | ✓ | ✗ | ✓ | ✓ | core |
| Doc-bound de-dup (`openView`) | ✗ | ✗ | ✗ | ✗ | ✓ | core |
| Longer-rendered-axis placement | ✗ | ✓ | ✗ | ✓ | ✓ | core |
| Focus restoration after placement | ✗ | ✗ | ✗ | ✓ | ✗ | **core** |
| Multi-workbench Mod-K ownership | ✗ | ✗ | ✗ | ✓ | ✓ | core |
| Tile title as a `<tile>` presentation | ✗ | ✓ | ✓ | ✓ | ~ (slot) | core-opt (helper) |
| Linked-view badge (`×N`) | ✗ | ✓ | ✗ | ✓ | ✗ (computed only) | core |
| Document bar / file chip for doc-bound apps | ~ (`BoundWorld`) | ✓ (chip) | ✗ | ✓ | ✗ | core-opt (slot) |
| Placement mode (aim at a pane, zone-aware open) | ✗ | ✓ | ✗ | ✗ | ✗ | **core-opt** |
| Per-tile drop overlay from outside the drag hook | ✗ | ✓ | ✗ | ✗ | ✗ | core-opt |
| Active-document following | ✗ | ✓ | ~ (cursor) | ✓ (linked docs) | ✗ | product (needs `rebind`) |
| localStorage persistence | ✓ (sync write) | ✓ | ✗ | ✓ (enumerated) | ✗ (manual) | **core-opt** |
| Strict (rejecting) reader + schema version | ✓ | ✓ | — | ✓ | ✗ (tolerant) | core |
| Server sync: mutate + `If-Match` + idempotency | ✓ | ✓ | ✗ (server ready) | ✓ (`PUT`) | ✗ | **core-opt** (module) |
| 409 rebase / 422 isolate / SSE invalidation | ✓ / ✗ / ✓ | ✓ / ✓ / ✓ | ✗ | conflict UI / ✗ / ✓ | ✗ | core-opt (module) |
| Seed an app into existing documents | ✗ | ✓ | ✗ | ✗ | ✗ | core-opt |
| Templates / save layout as | ✗ | ✗ | ✗ | ✓ | ✗ | product (datalab) |
| Import / export of layouts | ✗ | ✗ | ✗ | ✓ | ✗ (functions) | core-opt |
| Full-frame / maximize | ✗ | ✗ | ✗ | ✓ | ✗ | core-opt |
| Notices | ✗ | ~ | ✗ | ✓ | ✗ | product |
| App scoping (per instance/workspace) | ✗ | ✗ | ✗ | ✓ | ✗ | core-opt (predicate) |
| Registry ↔ Go catalog parity fixture | ✓ | ✓ | ✓ | ✓ (catalog.go) | ✗ | core (helper) |
| Store injection (Redux or other) | — | needed | — | needed | ✗ | **core** |
| Per-mutation hook for an outbox | needed | needed | — | needed | ✗ | **core** |
| Atomic batch application | ✗ (per mutation) | ✗ (per mutation) | — | — | ✓ | core |
| Verbs as data with `describe` | ✗ | ~ (own union) | ~ (own union) | ✓ | ✓ | core |
| Tests of the shell itself | ~ | ✓ (below components) | ✓ (tree) | ✓ | ✓ (24) | core |

Reading the matrix: the rows marked **core** in bold are the ones at least two products need and the package lacks; they are the additions designed in §5. Rows marked product are deliberately left alone (DR-U6 and the playbook: policy stays with the product).

## 5 · What goes into the shared core, and how

Each addition states the products that need it, the API, the behaviour, the size, and the tests. The order is the order to build them in: A unblocks the Redux products, B–D close the gaps every product hits on day one, E–H are the ones that make the package better than any single product's shell.

### 5.A Store injection and the mutation hook

**Needs:** turboproof, datalab-ui (Redux); agentlogic (outbox). This is the single blocking gap.

```ts
// PW/createWorkbench.tsx
interface CreateWorkbenchOptions {
  apps: readonly AppDescriptor[] | AppRegistry;
  initial: WorkbenchDocument;
  store?: WorkbenchStore;                               // NEW: back the shell with a product-owned store
  onMutate?(mutations: Mutation[], next: WorkbenchDocument): void;   // NEW: observe every committed batch
  onRejected?(mutations: Mutation[], error: MutationError): void;    // NEW: instead of console.warn
}
const store = options.store ?? createWorkbenchStore(initial, { onMutate, onRejected });
```

`WorkbenchStore` stays the five-method interface (`getState`, `subscribe`, `setState`, `mutate`, `replaceDocument`). A Redux product implements it as an adapter whose `getState` returns a **cached** snapshot refreshed on each Redux notification (a fresh object per call makes `useSyncExternalStore` loop), whose `setState` dispatches the slice's `workspaceSelected`/`launcherOpened` actions, and whose `mutate` **pre-validates the batch atomically** with `applyMutations` before dispatching, so the shell keeps its all-or-nothing promise while the product's rebase path keeps applying one mutation at a time:

```ts
mutate(ms) {
  try { applyMutations(redux.getState().workbench.document, ms); } catch { return false; }
  redux.dispatch(workbenchActions.perform({ mutations: ms }));   // applies locally and queues for the server
  return true;
}
```

`onMutate` is what agentlogic's context uses to enqueue for its flush without giving up its own rebase loop. Size: ~20 lines in the package plus a test that a custom store receives every batch and that `onRejected` fires with the `MutationError` code.

### 5.B Workspaces

**Needs:** all four products.

```ts
// document.ts
workspaces([{ id, name, spec }, …], { id?, name? }) → WorkbenchDocument   // N workspaceCreate mutations over emptyDocument()
// verbs.ts — new kinds
{ kind: "workspace.select"; workspaceId }
{ kind: "workspace.create"; workspaceId?; name; spec? }      // default spec: singleTile(launcherAppId ?? first app)
{ kind: "workspace.rename"; workspaceId; name }
{ kind: "workspace.delete"; workspaceId }                     // refused on the last workspace (protocol: last_workspace)
{ kind: "workspace.clone"; workspaceId; newId? }              // viewClone per view? no — placements link to the SAME views (the protocol has no workspace clone; clone = workspaceCreate with a tree copy whose leaves reference the same views, plus viewClone for views the product marks duplicable)
// components
<wb.WorkspaceStrip renderWorkspace?(ws, {active}) />         // a row of pbui Button/Chip, or the product's <workspace> Presentation through renderWorkspace
```

`select` is `store.setState({ workspaceId })` plus clearing `activePlacementId` (a placement of another workspace must never stay active). `goTo`, `dock` and `place` already scope themselves to the current workspace; `place` for a singleton placed in another workspace gains a choice: `{ crossWorkspace: "switch" | "link" }` (default `switch`, which is what turboproof and datalab-ui do). Size: ~80 lines plus a `WorkspaceStrip` folder; tests for each verb and for the last-workspace guard.

### 5.C Replace, link, rebind — and the split policy

**Needs:** agentlogic, turboproof, hyperblog (replace/link/rebind); all four (policy).

```ts
// verbs.ts — new kinds
{ kind: "tile.replace"; placementId; appId; documents? }      // viewConfigure{appId, replaceDocuments: documents ?? {}} on the pane's view when the view has ONE placement; otherwise viewCreate + placementReplace (so a linked twin is not retargeted by accident)
{ kind: "tile.link";    placementId; viewId }                 // placementReplace (+ viewDelete of an orphaned launcher view)
{ kind: "view.rebind";  viewId; documents }                   // viewConfigure{replaceDocuments} — the whole map, never a merge
// createWorkbench options
splitPolicy?: "duplicate" | "link" | { app: string } | ((view, app) => "duplicate" | "link" | { app: string })
binding?: { source: string; defaultDocumentId?(doc): string | null; isBindable?(payload): boolean }   // adopts ClientConfig
```

The split policy decides what a bare ⬌/⬍ split puts in the new pane: `"duplicate"` (today's default), `"link"`, or `{ app: "launcher" }` (agentlogic, turboproof, hyperblog's singleton case; hyperblog's function form returns `"duplicate"` for `reader`). `binding` adopts `createWorkbenchClient`'s `ClientConfig`, so a newly placed view of a doc-bound app is bound to the default source document exactly as `replaceApp` does today (`builders.ts:363-366`) — without it, agentlogic's and turboproof's newly placed tiles come up unbound. `tile.replace` must clear bindings by default (hyperblog's rule, and a `post` binding on a `map` view is state nothing reads); `setTitle` keeps avoiding `replaceDocuments`. Size: ~120 lines; tests mirror hyperblog's `paneTree.test.ts` seven behaviours and agentlogic's `replaceApp` cases (link a placed singleton; retarget a lone launcher view in place; mint and bind otherwise).

### 5.D The launcher as a slot, and per-pane invocation

**Needs:** turboproof, datalab-ui (own rows models); agentlogic, hyperblog (per-pane).

```ts
// apps.ts
AppDescriptor += { group?: string; blurb?: string; available?(ctx: { workspaceId }): boolean }
// verbs.ts
{ kind: "launcher.open"; placementId?: string }               // placementId set ⇒ "replace THIS pane" mode
// Launcher props
interface LauncherProps {
  title?; shortcut?; shortcutContext?;
  rows?(ctx: { document, apps, workspaceId, invocation }): LauncherShellGroup[];   // NEW: the product's rows model
  choose?(rowId, ctx): boolean;                                                   // NEW: return false to fall back to the default
  renderDetail?(row): ReactNode;
}
```

The default rows model grows the *OPEN VIEWS* group (every placed view, `shown N places`, in `viewOrder` order; choosing one *goes to* it, switching workspace if needed), keeps *NEW TILE* (apps filtered by `available`, doc-bound hidden, singletons already placed moved to the first group), and shows `blurb` as the detail. In per-pane mode the default `choose` performs `tile.replace`/`tile.link` instead of `place`. `LauncherApp`-style empty panes remain a product choice expressible as an app whose component renders a button performing `launcher.open({ placementId })`. Size: ~100 lines; tests: per-pane mode replaces, global mode never destroys a working tile, a product `rows` function is honoured, `available` hides an app.

### 5.E Placement mode and zone-aware open

**Needs:** turboproof; useful to every product that opens documents from a list.

```ts
{ kind: "view.open"; appId; documents; at?: { placementId; zone: "center" | DockZone } }   // center ⇒ rebind/replace that pane; edge ⇒ split on that side
wb.placement.begin({ appId, documents, prompt, labelFor?(placementId, zone) }) → Promise<{ placementId, zone } | null>
// Surface
dropOverlayFor?(placementId): { zone: DragZone; swapLabel?; dockLabel? } | null   // paint the overlay from outside the drag hook
```

`begin` arms a modal mode (a banner through the product's `AcceptBanner`-like slot, Escape cancels, pointer capture in the capture phase), hit-tests `[data-part="tile"][data-placement-id]` with `zoneFor` from the chrome kit, paints the overlay through `dropOverlayFor`, and resolves on release; the caller then performs `view.open` with `at`. This generalises turboproof's `state/placement.ts` and its per-tile labels ("open Basic.lean in this editor" / "…replaces goals" / "…keeps the other half"). Size: ~150 lines; tests: the state machine with an injected hit test (turboproof's `placement.test.ts` is the model), and `view.open` with each zone producing the expected tree (turboproof's `openLeanFile.test.ts` is the model).

### 5.F Persistence and the sync module

**Needs:** agentlogic, turboproof, datalab-ui, hyperblog (whose server is ready).

```ts
// persistence (in the package)
createLocalPersistence(wb, { key, version, debounceMs = 250, migrate?(json, fromVersion) }) → dispose
parseDocument(json, { strict: true })                          // fromJson ignoreUnknownFields:false; rejects on schema_version mismatch
// sync (a separate entry point: @hyperslop-systems/pbui-workbench/sync — React-free)
createWorkbenchSync(wb, {
  client: { get(id), create(doc, requestId), mutate(id, revision, batch, requestId), stream(id, after) },
  flushDelayMs = 400,
  onConflict: "rebase" | ((local, server) => WorkbenchDocument),
  onInvalid: "drop" | "isolate",
  onPhase?(phase: "local" | "probing" | "synced" | "offline" | "detached")
}) → { status(), flush(), dispose() }
```

The sync module is the union of agentlogic's and turboproof's loops: an outbox fed by `onMutate`; a debounced `mutate` with `If-Match: "workbench-{id}-{revision}"` and an idempotency key **per batch content**; 409 → refetch and rebase the outbox mutation by mutation with `applyMutation`, dropping what no longer applies; 422 → refetch and drop the head, or isolate to one mutation per request; other failures → offline with exponential backoff; SSE `workbench.updated` → refetch when the outbox is idle, defer while flushing; `detached` when the row is gone. The persisted payload is the document only, with the local-only list (DATADROP-18 §1.4) never written. datalab-ui's whole-document `PUT` controller can later be expressed as `onConflict` + a `replace` client method. Size: ~300 lines; tests with a fake client: ordering, replay-on-409, isolate-on-422, backoff, and that a stale SSE revision is ignored.

### 5.G The tile descriptor helper, badge, focus, and a11y

**Needs:** turboproof, hyperblog, datalab-ui (title presentation); everyone (focus, a11y).

```ts
createTileDescriptor(wb, { extra?(tile): PresentationAction[] }) → PresentationDescriptor<TileRef>
// actions: Split beside · Split below · Replace app… (launcher) · Link here… · Rename… · Duplicate (disabledBecause when !duplicable)
//          Create linked duplicate · Close tile (danger; disabledBecause "a workspace keeps at least one tile" when !canClose)
//          Close view everywhere (when placementCount > 1) · Inspect
renderTitle default: <Presentation reference={{type:"tile", value: TileRef}}> label {placementCount > 1 && ` ×${placementCount}`} </Presentation>   // when the product passes its pbui instance
wb.focusPlacement(placementId)     // requestAnimationFrame → root.querySelector(`[data-placement-id] [data-ptype="tile"]`)?.focus(); called by place/openView/launcher choose
divider: aria-valuetext "60 percent", Home/End (min/max), double-click → 0.5
```

`TileRef` is the shape turboproof, hyperblog and datalab-ui already mint (`placementId, viewId, appId, title, customTitle?, placementCount, canClose, duplicable`); the helper turns the workbench verbs into `PresentationAction`s with the right `disabledBecause` strings, so the chrome buttons and the object menu are two doors to the same verbs in every product. Size: ~120 lines; tests: the action list per tile state (no DOM), focus lands on the new tile after `place`.

### 5.H Seeding, scoping, parity, export

Smaller, each a morning's work:

- `seedApp(doc, appId, { rail: "left" | "right", width = 0.18, once: { key } })` — turboproof's `seed.ts` generalised (walk `a` through ROW splits, compensate the ratio for depth, cap at half the host leaf).
- `AppDescriptor.available?(ctx)` — datalab-ui's scoping as a predicate; a tile whose layout names an excluded app still renders it (a seeded layout must not silently lose a tile).
- `registrySnapshot(apps) → { id, singleton }[]` sorted — the fixture every product compares against its Go catalog.
- `exportLayout(wb)` / `importLayout(wb, json, { into: "replace" | "workspace" })` — functions only; the UI stays with the product.
- `reset(factory?)` — today `reset()` returns to the object captured at construction, which is wrong once `initial` came from storage; accept a factory.

### 5.I What stays with the products

Document formats and their validators (`turboproof.lean-source`, `datadrop.gog.document`, transcript refs), the domain verbs and descriptors, `BoundWorld`/`useBoundSource`/`SessionHost`, file sync and rename, stages and audiences, sign-in gating, templates UI, notices, the launcher's *rows* (through the slot), tones, blurbs and the Go catalog. DR-U3 and DR-U6 are not revisited.

## 6 · Migration plans

The order is by distance from the package: agentlogic (already protocol-native, no Redux), turboproof (protocol-native, Redux, richest policy), hyperblog (own tree, no persistence, server ready), datalab-ui (own tree, stages, remote controller). Each plan lists prerequisites from §5, the steps, the adapter, risks, and how to verify.

### 6.1 agentlogic

**Prerequisites:** 5.A (`onMutate`), 5.B (workspaces), 5.C (`tile.replace`, `{app: "launcher"}` split policy, `binding`), 5.D (per-pane launcher or delete `LauncherApp`).

**Steps.**
1. Add `@hyperslop-systems/pbui-workbench`; import its stylesheet after `chrome.css` and before `app.css` in both `main.tsx` and `.storybook/preview.tsx` (`styles-parity.test.ts` enforces parity and its filter already matches the new package name).
2. `src/store/workbenchShell.ts`: `createWorkbench({ apps: allApps().map(toDescriptor), initial: defaultWorkbench(), splitPolicy: { app: "launcher" }, binding: { source: TRANSCRIPT_BINDING, isBindable: p => p.format === TRANSCRIPT_REF_FORMAT }, onMutate: enqueue })`. Keep `defaultWorkbench()` (hand-built, four workspaces) rather than porting it to `layout()`; ids stay compatible because both use the protocol's `newId`.
3. `workbenchContext.tsx` shrinks to sync only (probe, flush, 409 rebase, SSE, localStorage, workspace pointer); it subscribes to `wb.store` instead of owning `doc`. The rebase loop keeps `applyMutation` per mutation and ends in `store.replaceDocument(rebased)`.
4. `pages/Workbench/Workbench.tsx`: body becomes `<wb.Surface />` + `<wb.Launcher />`; the workspace strip performs `workspace.select`.
5. Delete `TileTree/` (move `TileTree.tones.test.ts` to `appkit/`), `LauncherApp.tsx`, `LauncherPanel/`, the verb half of the context, and the re-export block once importers point at the protocol client.
6. `BoundWorld` becomes a `withBoundWorld(Component)` wrapper applied at registration; its one read of `workbench.doc.documents` becomes `wb.useDocument().documents`.

**Adapter (~12 lines):** the `createWorkbench` call above plus `{ ...a, duplicable: !a.singleton, docBound: false }` per descriptor; `blurb` rides along as an extra field and is shown by the launcher's default detail.

**Risks.** Stored layouts in `agentlogic.workbench.v2` and server rows reference `appId: "launcher"` — keep `launcher` registered as a stub app rendering `EmptyState` + "open the launcher (⌘K)" for one release, and keep it in the Go catalog for the same period (a cross-repo change). `store/workbench.test.ts` encodes "split opens a launcher view" and must be rewritten against `wb.verbs.split` with the policy. Clamp widens from `[0.15, 0.85]` to `[0.1, 0.9]` (one-way safe). Do not route the rebase loop through `wb.mutate` (atomic) — it relies on per-mutation survival.

**Verify.** Package tests; `registry.test.ts` + fixture (launcher row removed in lockstep with Go); `TileTree.tones.test.ts` unchanged; `styles-parity.test.ts`; manual: four workspaces switch, ⌘K names its target, `deck` (singleton) is offered as *go to*, a transcript binding resolves, reload restores, two tabs converge over SSE.

### 6.2 turboproof

**Prerequisites:** 5.A (store injection), 5.B, 5.C (`tile.replace`, `tile.link`, `view.rebind`, `{app: "launcher"}` policy, `binding: { source: "source" }`), 5.D (`rows` slot so `launcherSearch.ts` plugs in, per-pane invocation), 5.E (placement mode and `dropOverlayFor`).

**Steps.**
1. `src/store/workbenchShell.ts`: `createReduxWorkbenchStore(store)` — the adapter in §5.A with a cached snapshot, `setState` mapping `workspaceId → workspaceSelected`, `launcherOpen → launcherOpened/Closed`, `activePlacementId` kept per tab (add it to the slice or accept it as tab-local), and `mutate` pre-validating then dispatching `workbenchActions.perform`.
2. `pages/Workbench.tsx`: build the workbench once per store with `useMemo`; in `perform`, `if (isWorkbenchVerb(verb)) { wb.perform(verb); return; }` replaces the five layout arms; delete `LauncherShortcut` (the package's Mod-K arbitration needs `data-workbench-shell`, which only `wb.Surface` emits — two listeners would double-fire); `<main className="tp-canvas">` becomes `<wb.Surface renderTitle={renderTileTitle} dropOverlayFor={placement.overlayFor} />`.
3. `renderTileTitle`: the surviving half of `organisms/Tile.tsx` — the `<tile>` presentation (or `createTileDescriptor`), the `×N` badge (now from `placementCount`), and the file-name chip from `boundDocumentId(view)` + `leanSourceOf`.
4. `LauncherDialog.tsx` becomes `<wb.Launcher rows={rowsFromLauncherSearch} choose={…} />`; `launcherSearch.ts` stays pure and tested.
5. `state/placement.ts` is replaced by `wb.placement.begin(...)`; `openLeanFile`/`revealLeanFile` become `view.open` with `at`, plus `view.rebind` for the centre case and `followSourceDocument` (product) in the same batch.
6. Delete `NodeView.tsx`, `Tile.tsx`, `.tp-split*` CSS, the format constants (identical values in the package).
7. Untouched: `slice.ts`, `sync.tsx`, `seed.ts` (until 5.H lands), `fileSync.ts`, `renameBinding.ts`, `api/client.ts`, `filesTile.ts`, the session and proof planes, all apps, all descriptors except the tile's.

**Risks.** Two sources of truth if any path calls `wb.store.setState` without dispatching — the adapter must dispatch, never hold copies. Snapshot identity for `useSyncExternalStore`. Atomicity: the shell's `mutate` is all-or-nothing, the slice's `perform` is per-mutation — pre-validate in the adapter, keep the slice's behaviour for rebase. Singleton flags must match `registry.fixture.json` exactly or the server rejects a second singleton view (`duplicate_singleton`). The split button's meaning changes unless `splitPolicy: { app: "launcher" }` is set — decide it explicitly. Stored `turboproof.workbench.v1` blobs and server rows load unchanged (same format, schema version, `newId`), but keep turboproof's rejecting `loadStored` rather than the tolerant `parseDocument` until 5.F's strict mode lands. CSS: `.tp-split` is flex, `SplitPane` is grid; stylesheet order `chrome.css` → package → `app.css`.

**Verify.** The suite is mostly below the components and is the safety net: `slice.test.ts`, `openLeanFile.test.ts` (every zone's resulting graph — the strongest guard that geometry did not change), `seed.test.ts`, `renameBinding.test.ts`, `fileSync.test.ts`, `launcherSearch.test.ts`, `placement.test.ts`, `filesTile.test.ts`, `registry.test.ts` + fixture, `file.test.ts`. Add: an adapter test that each `wb.verbs.*` lands exactly one `workbenchActions.perform` with the mutations the old interpreter produced; `pnpm typecheck`; `pnpm build-storybook` (the tile stories enumerate the registry).

### 6.3 hyperblog

**Prerequisites:** 5.B (`workspace.select`), 5.C (`tile.replace` clearing bindings, `view.rebind` for pin/unpin, split policy as a function: `reader` duplicates, singletons open the launcher tile), 5.D (per-pane launcher). Everything else is a gain (resize, Mod-K, error boundaries, persistence).

**Steps.**
1. Rewrite `initialWorkspaces()` as `workspaces([...six specs])` using `tile`/`split`; every hyperblog leaf becomes one `AppView` + one leaf node (there are no view-less leaves), `bindings` → `documents` key for key (the keys `post`/`term` already match the Go catalog, `pkg/workbenchapp/catalog.go:44-49`).
2. `src/appkit/adapt.tsx`: `TileDefinition → defineApp({ id, title, tone: TONE[group], singleton, docBound: id === "reader", Component: Adapted })` where `Adapted` renders the legacy component with `{ placementId, bindings: view.documents, perform }`; keep `registrySnapshot()` for the fixture.
3. `Workbench.tsx` shrinks to masthead + `<wb.Surface renderTitle=… />` + `<wb.Launcher />` + boot states (~90 lines); workspace tabs perform `workspace.select` (today they call `setCurrentId` directly while the descriptor emits a verb — two doors must become one).
4. `App.tsx` interpreter: translate `splitTile/closeTile/swapTiles/dockTile/selectWorkspace/replaceView/openLauncher/bindTile` to workbench verbs; fix the dead `swapTilesByAccept` with `pbui.accept({ types: "tile" })` → `tile.swap`; `openLauncher` with `placementId: null` opens the modal (the documented hole closes).
5. Delete `model/paneTree.ts`, `NodeView`/`TileView`, `.hb-split`/`.hb-divider` CSS; remove the dead dependencies (`@reduxjs/toolkit`, `react-redux`) and finally use the declared `workbench-protocol`.
6. Persistence: `createLocalPersistence(wb, { key: "hyperblog.workbench.v1", version: 1 })` first; the server (`/v1/workbenches`) second, through the sync module.

**Risks.** The single highest-risk item is the split policy: migrating before it exists turns "split `term`" into a second linked `term` tile, which the Go catalog refuses (`Singleton: true`) — the regression the `paneTree` tests were written for. Interim: route `splitTile` through `wb.verbs.split(id, dir, "launcher")` explicitly. `tile.replace` must clear bindings or a `post` binding survives onto a `map` view. Ids change shape (`t1`/`s2` → `v-…`/`n-…`); nothing persists them today. The `shell` group has no tone; make the default explicit. CSS order as above; check tiles that relied on `.hb-tile-body`.

**Verify.** `registry.test.ts` + `registry.fixture.json` must pass unchanged (the Go side reads the same fixture); `ReaderApp.test.tsx` passes untouched if the adapter preserves `TileProps`; rewrite `paneTree.test.ts`'s seven behaviours against `wb.verbs` (singleton split → launcher view; reader split → two views, same documents; replace clears bindings; pin/unpin add and remove the key; swap keeps placement ids; dock carries the binding and leaves three leaves). Add: serialize → parse round trip; six workspaces and `workspace.select` change what `Surface` renders; a Go test in `pkg/workbenchapp` that validates a layout exported from TS with `workbench.Validate` and `Dependencies()`.

### 6.4 datalab-ui

**Prerequisites:** 5.A (Redux store adapter), 5.B including create/rename/clone, 5.C, 5.D (its rows model and scoping through `available`), 5.F (the sync module expressing its `PUT` controller, or keeping `useRemoteWorkbench` behind `onMutate`), 5.G (its tile descriptor is the richest — the helper's `extra` slot carries copy/paste view, save as template), 5.H (app scoping, export/import functions).

**Approach.** datalab-ui is the reference product and the largest; migrate it last and in two steps. First, replace `layoutTree.ts` + the geometry/view reducers with the protocol document held in the existing `layout` slice (the codec at the remote boundary disappears because the runtime document *is* the wire document); stages stay as a product layer that selects which workspaces are visible. Second, replace `Tile.tsx`, `SplitView.tsx`, the keyboard listener in `WorkbenchShell.tsx` and `LauncherDialog.tsx` with `wb.Surface`/`wb.Launcher` over the Redux store adapter. `applyLayoutVerb.ts`'s twenty cases become translations to workbench verbs; `persist.ts`'s enumeration becomes the local-only list the package already respects.

**Risks.** `syncSpacePointer` (the stage/space pointer invariant walked by `test/stages.test.ts`) must be re-expressed over `workspace.select`; `remoteWorkbenchLoaded` nulling `launcher`/`activePlacementId`/`renamingId` must survive as `replaceDocument` semantics (the package already resets `activePlacementId`); `WorkbenchInstance`-per-store means one `createWorkbench` per instance with the adapter bound to that store; two instances seeded from one layout share placement ids, so every DOM lookup stays scoped to `root()` (the package already does this).

**Verify.** `test/apps.test.ts` (duplicable follows docBound unless written down), `test/stages.test.ts`, `WorkbenchProviders.test.tsx`, the layout slice tests, the Go/TS parity fixtures, and the demo Vite config.

## 7 · Sequencing and acceptance

| Phase | Work | Done when (a gesture, not a checkbox) |
|---|---|---|
| 1 | 5.A store injection + hooks; 5.B workspaces; 5.C replace/link/rebind + split policy + binding | In the pbui-chat demo, a second workspace can be created from a verb and switched by a strip; a split with `{app: "launcher"}` opens an empty pane; `tile.replace` on a linked twin does not retarget its sibling |
| 2 | 5.D launcher slot + per-pane invocation; 5.G tile descriptor helper, badge, focus, a11y | Right-clicking any tile title in the demo shows the helper's verbs with correct `disabledBecause`; Enter in the launcher leaves focus in the new tile; a screen reader announces "60 percent" on the divider |
| 3 | agentlogic migration (6.1) | Four workspaces, ⌘K, transcript binding, reload, two-tab SSE convergence — all by hand; its suites green with the launcher row removed from the fixture on both sides |
| 4 | 5.E placement mode; 5.F persistence + sync module | turboproof's `openLeanFile.test.ts` graphs reproduced by `view.open` with `at`; a fake-client sync test replays on 409 and isolates on 422 |
| 5 | turboproof migration (6.2) | Every zone of "open a file here" lands where it did; a singleton linked into two panes routes file verbs to the right one; the server rejects nothing the shell produces |
| 6 | hyperblog migration (6.3); 5.H | Resize works for the first time in hyperblog; the swap-by-accept verb works; six workspaces persist across reload |
| 7 | datalab-ui migration (6.4), two steps | `make ui-token-check` prints nothing; the codec file is deleted; `remote/` talks to the server with the runtime document |

Two rules for every phase: the package change ships with tests and a story before any product consumes it, and a product migration is not merged half-done (a missing workspace verb means five dead tabs in hyperblog; a missing split policy means a server-rejected layout in turboproof).

## 8 · API reference for the additions

| Area | Addition | Signature |
|---|---|---|
| options | store injection | `createWorkbench({ apps, initial, store?, onMutate?, onRejected?, splitPolicy?, binding? })` |
| document | many workspaces | `workspaces([{ id, name, spec }], options?) → WorkbenchDocument` |
| verbs | workspaces | `workspace.select/create/rename/delete/clone` |
| verbs | replace/link/rebind | `tile.replace(placementId, appId, documents?)`, `tile.link(placementId, viewId)`, `view.rebind(viewId, documents)` |
| verbs | zone-aware open | `view.open(appId, documents, { at?: { placementId, zone }, near?, title? })` |
| verbs | launcher | `launcher.open({ placementId? })` |
| launcher | rows slot | `<Launcher rows?(ctx) choose?(rowId, ctx) renderDetail?(row) />` |
| apps | descriptor fields | `group?`, `blurb?`, `available?(ctx)` |
| surface | overlay hook | `<Surface dropOverlayFor?(placementId) />` |
| workbench | placement mode | `wb.placement.begin({ appId, documents, prompt, labelFor? }) → Promise<{ placementId, zone } | null>` |
| workbench | focus | `wb.focusPlacement(placementId)` |
| components | strip | `<WorkspaceStrip renderWorkspace? />` |
| presentation | descriptor helper | `createTileDescriptor(wb, { extra? }) → PresentationDescriptor<TileRef>` |
| persistence | local | `createLocalPersistence(wb, { key, version, debounceMs?, migrate? }) → dispose`; `parseDocument(json, { strict })` |
| sync | module | `createWorkbenchSync(wb, { client, flushDelayMs?, onConflict, onInvalid, onPhase? })` (`@hyperslop-systems/pbui-workbench/sync`) |
| misc | | `seedApp`, `registrySnapshot`, `exportLayout`/`importLayout`, `reset(factory?)` |

## 9 · File reference

| Area | Path |
|---|---|
| package (baseline) | `PW/{index,apps,document,store,verbs,types,context,createWorkbench}.ts(x)`, `PW/components/{Surface,SplitPane,Tile,Launcher}/`, `PW/workbench.test.ts`, `pbui/packages/pbui-workbench/test/` |
| chrome kit | `pbui/src/chrome/{TileFrame.tsx,useTileDrag.ts,LauncherShell.tsx,shortcutRouting.ts}`, `pbui/public/chrome.css` |
| protocol client | `pbui/packages/workbench-protocol/src/client/{apply,builders,ratios}.ts` (`createWorkbenchClient` at `builders.ts:300`) |
| agentlogic | `AL/src/store/{workbench.ts,workbenchContext.tsx}`, `AL/src/components/organisms/TileTree/`, `AL/src/components/pages/Workbench/Workbench.tsx`, `AL/src/apps/LauncherApp.tsx`, `AL/src/components/organisms/LauncherPanel/`, `AL/src/appkit/{registry.ts,registry.fixture.json}`, `AL/src/components/organisms/BoundWorld/BoundWorld.tsx`, `AL/src/styles-parity.test.ts` |
| turboproof | `TP/src/store/{workbench.ts,slice.ts,sync.tsx,seed.ts,fileSync.ts,index.ts}`, `TP/src/state/{placement.ts,filesTile.ts}`, `TP/src/components/pages/Workbench.tsx`, `TP/src/components/organisms/{Tile.tsx,NodeView.tsx,LauncherDialog.tsx,Chrome.tsx}`, `TP/src/model/launcherSearch.ts`, `TP/src/apps/LauncherApp.tsx`, `TP/src/appkit/{registry.ts,binding.ts,registry.fixture.json}`, `TP/src/pbui/descriptors/rest.ts` |
| hyperblog | `HB/src/model/paneTree.ts`, `HB/src/components/pages/Workbench/Workbench.tsx`, `HB/src/appkit/registry.ts`, `HB/src/apps/{all.ts,ShellApps.tsx,ReaderApp.tsx}`, `HB/src/pbui/{runtime.tsx,verbs.ts,descriptors/rest.ts}`, `HB/src/App.tsx`; Go: `hyperblog/pkg/store/workbenches.go`, `pkg/server/server.go`, `pkg/workbenchapp/catalog.go` |
| datalab-ui | `DL/src/store/{layout.ts,layoutTree.ts,applyVerb.ts,applyLayoutVerb.ts,persist.ts,remote.ts}`, `DL/src/components/organisms/{Tile,SplitView}/`, `DL/src/components/pages/Workbench/`, `DL/src/apps/LauncherApp/`, `DL/src/appkit/{registry.ts,AppScope.tsx,useRemoteWorkbench.ts}`, `DL/src/remote/codec.ts`, `DL/src/pbui/descriptors/{tile,workspace}.ts` |
| consumers of the package | `pbui/packages/pbui-chat/src/apps/createChatApps.tsx`, `pbui/packages/pbui-chat/demo/src/workbench.ts` |
| design records | PBUI-WORKBENCH-1 guide (`pbui/ttmp/2026/08/20/PBUI-WORKBENCH-1--…/design-doc/01-…md`), PBUI-UNIFY-001 (DR-U2..U6), DATADROP-18 design-doc/02, DATALAB-VIEW-001 design-doc/01–02, `pbui/docs/playbooks/building-a-new-hyperslop-systems-app-on-pbui.md` §6 |
