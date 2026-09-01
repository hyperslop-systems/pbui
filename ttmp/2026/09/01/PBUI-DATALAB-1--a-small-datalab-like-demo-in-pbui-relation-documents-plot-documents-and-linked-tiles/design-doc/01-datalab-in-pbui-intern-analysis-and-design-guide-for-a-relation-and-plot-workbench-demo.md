---
Title: 'Datalab in pbui: intern analysis and design guide for a relation-and-plot workbench demo'
Ticket: PBUI-DATALAB-1
Status: active
Topics:
    - pbui
    - datalab
    - plot
    - frontend
    - design
    - onboarding
DocType: design-doc
Intent: long-term
Owners: []
RelatedFiles:
    - Path: repo://packages/datalab-ui/src/appkit/analysisCoordinator.ts
      Note: The DuckDB executor coordinator the demo host lifts whole
    - Path: repo://packages/datalab-ui/src/appkit/plotAdapter.ts
      Note: The existing lowering of datalab's plot half into plot's PlotDocument; proof the plot half is redundant
    - Path: repo://packages/datalab-ui/src/appkit/useRemoteWorkbench.ts
      Note: currentRemoteState — the wire document is a projection of two slices, not a codec
    - Path: repo://packages/datalab-ui/src/model/graphic.ts
      Note: GraphicDocument = data half (kept) + plot half (replaced by plot); LogicalGraphic and compileGraphicDocument
    - Path: repo://packages/pbui-plotscript/demo/src/workbench.ts
      Note: The demo boot the pbui-datalab demo copies
    - Path: repo://packages/pbui-plotscript/src/document.ts
      Note: The payload-in-the-workbench-document pattern the demo copies
    - Path: ws://datalab/pkg/workbenchapp/documents.go
      Note: Go document validator that must learn the new payload formats
    - Path: ws://plot/src/document.ts
      Note: PlotDocument, the demo's plot document verbatim
ExternalSources: []
Summary: What datalab is, how it is built, what was learned trying to migrate it onto pbui-workbench, and the shape of a small datalab-like demo inside pbui (relation documents + plot documents + linked tiles) that serves PBUI-LINK-1 now and the datalab rewrite later.
LastUpdated: 2026-09-01T18:43:34.772964483-04:00
WhatFor: Onboarding an engineer who has to build the pbui datalab demo, or who has to touch datalab-ui and needs to know why it looks the way it does.
WhenToUse: Read before starting PBUI-DATALAB-1 work, before PBUI-LINK-1 Phase 5 (the datalab demo), and before any further work on packages/datalab-ui.
---


# Datalab in pbui: intern analysis and design guide for a relation-and-plot workbench demo

## 0. How to read this guide

This document is written for an engineer new to pbui who has been asked to build a **small datalab-like demo inside the pbui monorepo**: a workbench where you bring in a table, shape it with a pipeline, and make plots of it, with the tiles linked to one another through the mechanisms PBUI-LINK-1 is introducing. It is deliberately more of a **map of what exists and what was discovered** than a step-by-step plan. The plan will be short once the map is understood; the map is the expensive part.

It has five parts:

1. **What datalab is and how it is built** (§2–§4). The existing product, `packages/datalab-ui`, is 35 000 lines of TypeScript. About 5 000 of them are the thing you are going to rebuild; the rest is a hand-rolled window manager, a marketing site, a teaching layer, and an account system that grew around it. You need to know which is which.
2. **The pbui substrate the demo stands on** (§5). The workbench protocol, the `pbui-workbench` shell, the `plot` grammar-of-graphics package, and `pbui-plotscript`, which is the exact shape the demo should copy.
3. **What was learned trying to migrate datalab as it is** (§6). PBUI-WORKBENCH-2 planned to move datalab-ui onto the shared shell as its Phase 7. The attempt produced measurements and findings that decide the shape of this ticket. They are restated here for this audience.
4. **The design of the demo** (§7–§10). Two document kinds, bindings by role, a data host, the tiles, the ports the demo offers PBUI-LINK-1, and the salvage map from datalab-ui. Loose on purpose.
5. **Open questions and first steps** (§11–§13).

Conventions:

- Path prefixes: `DL/` is `pbui/packages/datalab-ui/src`, `PW/` is `pbui/packages/pbui-workbench/src`, `PS/` is `pbui/packages/pbui-plotscript/src`, `PROTO/` is `pbui/packages/workbench-protocol`, `PLOT/` is `plot/src` (the sibling `plot/` repository), `GO/` is `datalab/pkg` (the sibling `datalab/` repository, the Go server). All relative to `/home/manuel/workspaces/2026-09-01/add-plot-editor/`.
- `path:line` references were read from the working tree on 2026-09-01 at these versions: pbui 0.10.0, pbui-workbench 0.4.0, workbench-protocol 0.4.1, pbui-plotscript 0.1.0, pbui-sandbox 0.3.1, plot 0.3.1, datalab-ui 0.1.6.
- "Observed" means read from a file. "Measured" means a command was run and its output recorded. "Inferred" means a conclusion drawn from observed facts.
- "The workbench guide" is PBUI-WORKBENCH-2's design doc (`pbui/ttmp/2026/08/20/PBUI-WORKBENCH-2--…/design-doc/01-intern-guide-….md`); "the linking guide" is PBUI-LINK-1's (`pbui/ttmp/2026/09/01/PBUI-LINK-1--…/design-doc/01-tile-linking-….md`). Section numbers cited as "workbench guide §10.4" or "linking guide §6.2" refer to those.

## 1. Executive summary

**Datalab is a grammar-of-graphics data workbench in the browser, and the frontend of Datadrop.** You bring a table in (an uploaded dataset, a live event stream, or a fixture), you build a pipeline of transforms over it, you encode fields to channels for a mark, and you get a chart. DuckDB compiled to WebAssembly executes the pipeline client-side. The document that describes one such analysis is a `GraphicDocument` (`DL/model/graphic.ts:154`), and it rides inside the pbui workbench document as a `DocumentPayload` when the layout is saved to the Datadrop server.

**Its `GraphicDocument` is two documents glued together.** The first half is a data pipeline: sources, a chain of relational transforms, and a bounded-window scope, compiled to SQL. The second half is a small grammar of graphics: four marks, five channels, six analysis specs, facets. The `plot` package (`@hyperslop-systems/plot`, `PLOT/document.ts:377`) already owns a far richer version of the second half, and datalab already contains a 304-line adapter (`DL/appkit/plotAdapter.ts`) lowering its own grammar into plot's. **With plot as the grammar of graphics, only the data half of datalab survives.**

**Migrating datalab-ui in place was tried and does not work as planned.** The workbench guide's §6.4 assumed the runtime document could become the wire document and that the migration could be done in two separable steps. Neither holds: the wire document is a projection of two Redux slices filtered by stage and by reachability (§4.7 below), and swapping datalab's own tree type for the protocol's produces 308 type errors across 25 files with no green intermediate (workbench guide §10.4, measured). The shell that would be replaced is about 9 000 lines; the marketing, tour and teaching layers another 3 500; none of it is the product.

**The recommendation is to build the product again, small, inside pbui, as a demo package** in the shape of `pbui-plotscript`: documents as payloads in the workbench document, tiles as views of those documents, a host object owning the runtime (here: the DuckDB executor and the per-relation results), built directly on `createWorkbench` with local persistence. Two document kinds: a **relation document** (datalab's data half, lifted) and a **plot document** (plot's, verbatim). A plot view binds both by role. The tiles are sources, pipeline, table, plot, a structured plot editor, and an inspector; plotscript's script tile is a third way to author the same plot document.

**Why this serves PBUI-LINK-1 first.** The linking guide names datalab as its Phase 5 demo (§11.3: table ≡ chart selection, chart click → detail) and plotscript as its Phase 2/4 demo (§11.2: script → plot → inspector). A datalab-like demo in pbui is those two demos with real data behind them, in a package the linking work can change freely, without datalab-ui's Redux, stages and account system in the way. The same package is the reference for cleaning up `datalab/` itself later, because its documents are already what the Datadrop server validates.

## 2. Why this ticket exists

Three threads converge here.

**PBUI-WORKBENCH-2** unified agentlogic, turboproof and hyperblog on `pbui-workbench`. Its Phase 7, datalab-ui, was attempted, measured, reverted and written up as §10 of that guide. The question it left open was *where datalab's documents live*, with three options and a recommendation. Then the question became a different one: is datalab-ui, as it stands, worth migrating at all, or is a small rebuild cheaper and more useful? This ticket answers the second question.

**PBUI-LINK-1** designs tile linking for pbui: ports on applications, binding terms (`Ambient`, `Constant`, `Follow`, `Hold`, `Alias`, `Derived`), a pure link kernel, a link document, and a connect-management mode. Its demo list (§11) needs applications with real, typed, emitted values: a table that emits a selection, a plot that emits a datum, an inspector that follows a subject. Datalab's tiles are those applications, and the linking guide already tabulates how datalab coordinates tiles today with ad-hoc globals (`world.activeDocId`, `world.inspected`; linking guide §4.9). Building the datalab demo inside pbui gives the linking work a product-shaped testbed that is not encumbered by datalab-ui's architecture.

**Datalab itself** was meant to be an application where you upload data and create all kinds of plots and graphs to study it, linked to that data. The product as built carries that idea, but under a lot of accretion: four hardwired "stages", six embedded tutorial workbenches on the marketing page, a stored template library, an account system, an own window manager, and its own grammar of graphics that predates `plot`. A small demo in pbui that does only the core loop, over the real document formats and the real server protocol, is the cleanest statement of what datalab should become.

## 3. What datalab is

### 3.1 The product, as a user sees it

Four routes (`DL/routes.ts:31-44`), no router library:

| URL | route kind | what renders |
|---|---|---|
| `/` | `marketing` | the landing page, six embedded fixture-backed workbenches down one scrolling page |
| `/ui/tour` | `tour` | the landing page scrolled to the tutorial band |
| `/ui/device` | `device` | the device-pairing approval screen |
| `/ui/…` (anything else) | `product` | the workbench, with a Redux store, local persistence or one server-backed workbench (`?workbench=<id>`) |

The workbench (the `product` route) is a tiling window manager: **stages** above **workspaces** above a **binary split tree** of **tiles**, each tile showing an **application view** bound to zero or more **documents**. Mod-K opens a launcher. Tiles drag to swap or dock, resize by divider, close, rename inline, duplicate, link (a second placement of one view), replace, and can be saved as templates, exported as portable bundles, and shared as permalinks.

### 3.2 The applications (tiles)

Registered by import side effect in `DL/apps/all.ts`. Grouped by what they are for:

**The authoring loop, each a view of one `GraphicDocument`** (`docBound: true`):

| id | what it shows |
|---|---|
| `sources` | pick a dataset or stream for the document's root source (singleton) |
| `pipeline` | the transform chain: filter, extend, project, aggregate, sort, limit |
| `encoding` | mark, channel→field assignments, analysis spec, facets |
| `chart` | the rendered plot (`DL/apps/ChartApp/ChartApp.tsx`) |
| `table` | the current DuckDB output relation (`DL/apps/TableApp/TableApp.tsx`) |

**Ways of looking across documents:** `charts` (every document's chart), `gallery` (snapshots), `compare a/b` (two pinned documents), `inspector` (whatever was last inspected; a singleton reading `world.inspected`, `DL/apps/InspectorApp/InspectorApp.tsx:13-14`).

**Live and diagnostic:** `watchlist` (watched values), `trace` (the capped action trace), `about`.

**The teaching layer** (DATADROP-7): `lessons`, `cheat sheet`, `the brief`, `modules`, four tutorials. Rendered as tiles inside embedded workbenches on the marketing page; their content comes from `DL/appkit/TourContent.tsx`.

**Accounts** (DATADROP-5): `sign in`, `sign up`, `profile`, `tokens`, `upload`. **Templates** (DATADROP-8): the stored template library.

Twenty-five applications. Five are the product.

### 3.3 Sizes, so the salvage decision is a numbers decision

Measured with `find src -name '*.ts' -o -name '*.tsx' | xargs cat | wc -l` per layer on 2026-09-01:

| layer | lines | what it is | verdict for the demo |
|---|---|---|---|
| `components/` | 16 397 | atoms, molecules, organisms (panels, the tile, the launcher dialog, the view switcher), pages (workbench, marketing, instance, tour) | shell and site: replaced by `pbui-workbench` and dropped |
| `store/` | 4 275 | layout slice (1 162), stages, world, persist, bundles, templates, effects, verbs | replaced by the workbench document and a host |
| `apps/` | 3 349 | the 25 tile containers | five are adaptable; the rest dropped |
| `model/` | 2 688 | graphic document, authoring, table wire types, transform editor, live tail, portable, permalink | the data half is kept |
| `pbui/` | 2 511 | presentation descriptors, verbs, types for 16 presentation types | rewritten small against pbui 0.10 |
| `appkit/` | 1 636 | registry, analysis coordinator/provider, plot adapter, remote workbench controller, persistence hook | coordinator kept; adapter and controller dropped |
| `tour/` | 1 331 | lessons and modules content | dropped |
| `analysis/` | 1 128 | DuckDB compile, runtime, ingest, normalize, browser factory, ports | kept |
| `api/` | 1 041 | RTK Query client for Datadrop v1, workbench protocol JSON, SSE stream | kept in spirit; thinned |
| `remote/` | 289 | the codec between the layout store and the wire document | dropped (see §6.1) |
| `demo/`, `fixtures/`, `export/` | 527 | welcome documents, fixture tables, CSV/PNG export | fixtures and export kept |
| **total** | **35 348** (352 files) | | roughly **5 000 kept, 5 000 adaptable, 25 000 dropped** |

Tests: 554 passing across 40 files in `DL/../test/`. The largest are `store.test.ts` (946 lines), `portable.test.ts` (917), `launcher-index.test.ts` (692) and `stages.test.ts` (597), all of which cover the layers the demo drops. The model and analysis tests (`graphic`, `graphic-authoring`, `duckdb-compile`, `duckdb-runtime`, `analysis-coordinator`, `live`, `plot-adapter`) cover what is kept.

## 4. How datalab is built

### 4.1 The layer map

```text
DL/
├── model/          pure: GraphicDocument, authoring helpers, Table wire types, portable bundles, permalinks
├── analysis/       pure + DuckDB: compile LogicalGraphic → SQL, runtime, ingest, normalize, browser factory
├── api/            RTK Query: Datadrop v1 endpoints, workbench protocol JSON, SSE stream reader
├── store/          Redux Toolkit: layout (stages/workspaces/views/tree), world (docs), persist, bundles, templates, verbs
├── appkit/         glue: app registry, AnalysisCoordinator + AnalysisProvider, plotAdapter, useRemoteWorkbench
├── pbui/           the product's PBUI instance: descriptors, verbs, types, actions
├── apps/           the 25 tile containers (registerApp side effects)
├── components/     atoms → molecules → organisms → pages (the tile, split view, launcher dialog, shell)
├── tour/, demo/, fixtures/, export/, remote/
├── DatalabApp.tsx  the route switch; constructs the store only on the product route
└── routes.ts
```

The dependency direction `model → analysis → store → appkit → apps → components` is enforced by a test (`descriptor-coverage`, `api-surface`, and the layer comment in `DL/appkit/registry.ts:12-24` explain the one edge that had to move). Nothing under `model/` imports React; that is what lets the grammar be tested with no DOM.

### 4.2 The `GraphicDocument`: two documents glued together

```ts
// DL/model/graphic.ts:154-165
export interface GraphicDocument {
  format: "datadrop.gog.document";
  version: 2;
  id: DocumentId;
  name: string;
  sources: Record<SourceNodeId, AuthoringSource>;      // ┐
  transforms: Record<TransformId, AuthoringTransform>; // │ the DATA half
  parameters: Record<ParameterId, JsonValue>;          // ┘
  views: Record<ViewId, AuthoringView>;                // ┐ the PLOT half
  rootView: ViewId;                                    // ┘
  metadata?: Record<string, JsonValue>;
}
```

**The data half** (`DL/model/graphic.ts:68-110`):

- `AuthoringSource`: a `SourceRef` (`{ kind: "stream" | "dataset", drop, stream?, dataset?, version?, path? }`, `DL/model/table.ts:26-33`) and a scope `{ kind: "bounded-window", limit, strategy: "head" | "latest" }`.
- `AuthoringTransform`: a discriminated union over `input: RelationRef` (a source or another transform), with kinds `core:filter` (predicate expression), `core:extend` (a new named field from an expression, with a semantic type), `core:project` (keep these fields), `core:aggregate` (group-by plus measures `mean | sum | min | max | count_rows`), `core:sort`, `core:limit`. Each carries `enabled` and `state: "complete" | "draft"`.
- `Expression`: field, literal, parameter, call over a small `CoreFunction` set (`eq ne gt lt and or not add subtract multiply divide log10 is_null is_finite`), and cast.

**The plot half** (`DL/model/graphic.ts:112-152`):

- `AuthoringView`: a `relation` (which point of the chain to plot), a `mark` (`point | line | bar | area`), `encodings: Partial<Record<Channel, AuthoringFieldRef>>` over `x y color size facet`, `yScale`, an `analysis: AnalysisSpec` (`identity | histogram | summary | regression | boxplot | density`), `facetScales`, and `references` (reference lines).

Every one of the plot-half concepts has a richer counterpart in `plot` (§5.4). Every data-half concept has none: plot's README states it "never compiles SQL" and does not own DuckDB lifecycle or data loading.

### 4.3 The data path: document → SQL → rows → plot

This is the part of datalab that is genuinely hard-won and that the demo lifts wholesale.

```text
GraphicDocument ──compileGraphicDocument──▶ LogicalGraphic ──compileDuckDBRelation──▶ SQL + params
   (authoring)      DL/model/graphic.ts:563    (operations,       DL/analysis/compile.ts
                    + CompileEnvironment        relations,
                      from the Table's fields   views)
                                                       │
                                                       ▼
Table (rows from Datadrop) ──serializeTableNDJSON──▶ DuckDB-wasm ──query──▶ Arrow ──normalizeArrowResult──▶ AnalysisResult
 DL/model/table.ts:38        DL/analysis/ingest.ts:10   DL/analysis/browser.ts                DL/analysis/normalize.ts    (rows, fields, metrics)
                                                                                                                                │
                                                                                                                                ▼
                                                                       buildDatalabPlot(view, result) ──▶ PlotDocument + PlotSchema + PlotData
                                                                       DL/appkit/plotAdapter.ts:247                          ▶ renderPlot / ResponsivePlot (plot)
```

In words:

1. A tile asks for a document's table. `useDocTable` (`DL/apps/useTable.ts:21`) resolves the document's root source (`rootSource`, `DL/model/graphicAuthoring.ts:138`) and fetches bounded rows through RTK Query (`useStreamTableQuery` / `useDatasetTableQuery`). The `Table` (`DL/model/table.ts:38-46`) is the wire shape `pkg/tabular` produces: fields with `type: "q" | "n" | "t"` and how the type was decided, rows as JSON, `row_count`, `truncated`, `strategy`.
2. `compileEnvironmentForTable` (`graphicAuthoring.ts:66`) turns the table's fields into a `CompileEnvironment`; `compileGraphicDocument` (`graphic.ts:563`) lowers the authoring document into a `LogicalGraphic` (`graphic.ts:270`): a list of `LogicalOperation`s (`core:scan`, `core:filter`, `core:extend`, `core:project`, `core:aggregate`, …, `graphic.ts:233`), typed relations, and logical views, with diagnostics.
3. `compileDuckDBRelation` (`DL/analysis/compile.ts`) turns the logical operations into parameterised SQL over registered sources, with field aliases quoted through `DL/analysis/quote.ts`.
4. `AnalysisRuntime` (`DL/analysis/runtime.ts`) owns the DuckDB instance behind port interfaces (`DL/analysis/ports.ts`: `DuckDBFactory`, `DuckDBPort`, `DuckDBConnectionPort`, `ArrowResultPort`, `MemoryObserver`) so the runtime is testable without a browser. `BrowserDuckDBFactory` (`DL/analysis/browser.ts`) is the `@duckdb/duckdb-wasm` implementation; the reviewed local bundles are in `DL/analysis/assets.ts` and shipped through `datalabPublicDir` (`DL/vite.ts`). Tables are registered as NDJSON (`ingest.ts:10`), results come back as Arrow and are normalised to JSON rows (`normalize.ts`), with byte and memory observations in `AnalysisMetrics`.
5. `AnalysisCoordinator` (`DL/appkit/analysisCoordinator.ts:27`) owns one lazily-loaded executor and, per document namespace, a generation counter and semantic key: a stale request is dropped, an identical in-flight request is coalesced, and up to 32 completed executions are cached. It has no React state so lifecycle races are tested without a DOM (`test/analysis-coordinator.test.ts`).
6. `AnalysisProvider` (`DL/appkit/AnalysisProvider.tsx`) is the React context over one coordinator, keyed by a `principalKey` so embedded instances on the marketing page do not share results. `MVP_MAX_RESULT_ROWS = 10_000` bounds what reaches the browser.
7. `buildDatalabPlot` (`DL/appkit/plotAdapter.ts:247`) maps the view's mark, encodings, analysis and facets into a `PlotDocument`, the result's fields into a `PlotSchema` (`plotAdapter.ts:67`) and the rows into `PlotData`; `renderPbuiPlot` (`:293`) calls plot's `renderPlot`.

What matters for the demo: steps 1–6 are the relation document's runtime and do not change. Step 7 disappears because the plot document *is* a `PlotDocument`.

### 4.4 The layout slice: the window manager the demo does not need

`DL/store/layout.ts` (1 162 lines) is a Redux Toolkit slice over datalab's **own tree type**:

```ts
// DL/store/layoutTree.ts:5-7
export type Node =
  | { id: NodeId; type: "leaf"; viewId: ViewId }
  | { id: NodeId; type: "split"; dir: "row" | "col"; a: Node; b: Node; ratio: number };
```

Same shape as the protocol's `Node` (§5.2) but a separate TypeScript type, with pure helpers (`updateNode`, `removeLeaf`, `removeViewLeaves`, `cloneTree`, `snapRatio`).

```ts
// DL/store/layout.ts:305-345 (abridged)
export interface LayoutState {
  stages: Stage[];                       // sign-in, welcome, account, work (DL/store/stages.ts:45-48)
  currentStageId: StageId;
  spaces: Workspace[];                   // FLAT, every stage's workspaces, each with a stageId foreign key
  currentSpaceId: string;                // mirrors the current stage's currentSpaceId (the "space pointer" invariant)
  views: Record<ViewId, AppView>;        // { id, appId, documents: Record<string, DocId>, title? }
  viewOrder: ViewId[];
  pendingImport?, launcher?, activePlacementId?, renamingId?, notice?, export?   // never persisted
}
```

Twenty-nine reducers (`layout.ts:468-1033`). About twelve are geometry and view operations that `pbui-workbench` already implements over the protocol: `setRatio`, `splitLeaf`, `closeLeaf`, `closeView`, `createViewInPlacement`, `replacePlacementWithView`, `renameView`, `duplicateView`, `createLinkedDuplicate`, `swapTiles`. Six manage workspaces (`addSpace`, `removeSpace`, `renameSpace`, `cloneSpace`, `setCurrentSpace`, `setSpaceApps`). Five manage stages (`addStage`, `removeStage`, `renameStage`, `setCurrentStage`, `moveSpaceToStage`). The rest are UI state.

**Stages** (`DL/store/stages.ts`, DATADROP-8 DR-59) are a layer *above* workspaces that the protocol does not have. Four are hardwired: `stage-signin`, `stage-welcome`, `stage-account`, `stage-work`. A code-defined stage and its workspaces are taken from source on every load; only the work stage is the user's own and only it is sent to the server. A stage also carries `apps: AppId[] | null` (which applications the launcher offers there) and `chrome: { masthead, strip, … }` (which shell furniture shows). A test file of 597 lines walks the stage/space pointer invariant.

**Inferred:** stages exist because the sign-in screen, the welcome tour and the account pages were once ordinary workspaces in the same strip and had to be explained by a tooltip. They are really *different documents* that share a window manager; §7.8 says what the demo does with that.

### 4.5 The world slice: where documents actually live

```ts
// DL/store/world.ts:64-74
export interface WorldState {
  docs: Record<DocId, Doc>;          // Doc = GraphicDocument
  docOrder: DocId[];
  activeDocId: DocId | null;         // what an UNBOUND doc-bound tile shows (an ambient default)
  snapshots: Record<string, Snapshot>;
  snapshotOrder: string[];
  pins: [string | null, string | null];   // the compare a/b slots
  watch: WatchEntry[];
  trace: TraceEntry[];               // capped at 500 (TRACE_CAP)
  inspected: { title: string; value: unknown } | null;   // what the Inspector tile shows
}
```

Documents are **not** in the layout slice. Views reference them by id in `view.documents.primary`, and 25 files outside `store/` read them through selectors. The world slice was chosen over the prototype's mutate-and-notify for three reasons the file states (DR-7): selector subscriptions confine an update to the tiles that care, immutability keeps `useMemo` honest, and serialisable state makes persistence and snapshot equality fall out. All three remain true in the demo, and §7.4 explains why the demo still does not put rows into the workbench document.

### 4.6 The remote boundary: a sync policy hiding inside a codec

The server-backed mode (`?workbench=<id>`) is driven by `useRemoteWorkbench` (`DL/appkit/useRemoteWorkbench.ts`, 401 lines): whole-document `PUT` with an `Idempotency-Key` derived from a fingerprint of the encoded document, `If-Match` revisions, three conflict paths (409 on save, a newer revision arriving while dirty, a newer revision arriving while saving), and an SSE revision stream (`DL/api/workbenchStream.ts:18`, fetch-based because `EventSource` cannot carry a bearer token).

The wire document it sends is built by `currentRemoteState` (`useRemoteWorkbench.ts:307`) and is **a filtered projection of two slices**:

| wire field | source slice | narrowed by |
|---|---|---|
| `workspaces` | `layout.spaces` | `stageId === WORK_STAGE_ID` |
| `views`, `viewOrder` | `layout.views` | reachable from those workspaces' trees |
| `documents` | `world.docs` | reachable from those views' bindings |

Its inverse, `preservedLocalState`, collects the views and documents belonging to the *other* stages so that `remoteWorkbenchLoaded` (`DL/store/remote.ts:27`, handled by both slices in one dispatch) can replace the remote-owned parts without touching the local-only ones, and `assertRemoteDocumentNamespace` throws if the server returns an id that collides with a local one.

`DL/remote/codec.ts` (264 lines) is the type conversion between `Node`/`AppView`/`GraphicDocument` and the protobuf `WorkbenchDocument`, with strict checks (`text`, `checkedJSONObject`). It is what people mean by "the codec", but the boundary is mostly the policy around it.

**The Go side** (`GO/server/server.go:335-341`):

```text
POST   /v1/workbenches                     create   (Idempotency-Key required)
GET    /v1/workbenches                     list
GET    /v1/workbenches/{id}                get      (returns document + revision)
PUT    /v1/workbenches/{id}                replace  (If-Match revision; what datalab-ui uses)
DELETE /v1/workbenches/{id}
POST   /v1/workbenches/{id}/mutate         apply a MutationBatch (DATADROP-18; what pbui-workbench's sync module speaks)
GET    /v1/workbenches/{id}/stream         SSE WorkbenchUpdatedEvent
```

Every write runs `workbench.Validate` (pbui's `pkg/workbench`, shared with every product) with `workbenchapp.Dependencies()` (`GO/workbenchapp/documents.go:47`): the application **catalog** (`GO/workbenchapp/catalog.go:26`, `DefaultCatalog`) refusing `unknown_application` and `duplicate_singleton`, and a **document validator** (`documents.go:23`) that dispatches on `DocumentPayload.format` and, for `datadrop.gog.document`, walks sources, transforms, views and the relation chain (`graphic_validation.go:20-476`). This is the contract the demo's relation document must keep or version.

### 4.7 The shell: what the demo replaces outright

| datalab-ui | lines | pbui-workbench equivalent |
|---|---|---|
| `components/organisms/Tile/Tile.tsx` | 271 | `PW/components/Tile/Tile.tsx` (uses pbui's `TileFrame`, `useTileDrag`) |
| `components/organisms/SplitView/SplitView.tsx` | 104 | `PW/components/SplitPane.tsx` |
| `components/pages/Workbench/WorkbenchShell.tsx` (window-capture keyboard router, Mod-K ownership rule) | 392 | `PW/components/Launcher.tsx` + `routeWorkbenchKey` in pbui chrome |
| `components/organisms/LauncherDialog/` (rows model, `choose()`, focus restoration) | 986 | `PW/components/Launcher.tsx` with the `rows` slot (`PW/types.ts:89`) |
| `components/organisms/ViewSwitcher/` | 1 037 | replace / rebind verbs + launcher rows |
| `store/applyLayoutVerb.ts` (20 cases) | 101 | `PW/verbs.ts` handlers |
| `store/persist.ts` (localStorage v5, credential audit) | 289 | `PW/persistence.ts` (`createLocalPersistence`, `readWorkbenchSnapshot`) |
| `appkit/useRemoteWorkbench.ts` + `remote/codec.ts` | 665 | `PW/sync.ts` (`createWorkbenchSync` over `/mutate`) |

### 4.8 The embedding model: `WorkbenchInstance`

`DL/components/pages/WorkbenchInstance/WorkbenchInstance.tsx:108` mounts a whole workbench, sandboxed, as many times as you like on one page: the marketing page composes five. The store is the instance boundary; `InstanceConfig` (`:47`) carries a preloaded state, which applications the launcher offers, whether to seed a document, whether there is a masthead, and where (if anywhere) to persist. Reset is remount by `key`. The tutorials' lesson rails render as siblings of the shell under one `PbuiProvider`, so a lesson's ▶ can call `accept()`.

`pbui-workbench` already supports several `createWorkbench` instances on one page (Mod-K ownership by focus, DOM lookups scoped to `root()`), so the *idea* survives; the demo simply does not need five of them.

### 4.9 Persistence, portability, permalinks

- **localStorage**: `DL/store/persist.ts`, key `datadrop-workbench`, `VERSION = 5`, migrating v1 payloads rather than discarding them (DR-73), keyed per instance (DR-47) so embedded workbenches do not clobber the product. A test audits the payload for anything token-shaped.
- **Portable bundles**: `DL/model/portable.ts`, one envelope, three kinds (tile, workspace, stage), pure; conversions to and from `LayoutState` in `DL/store/bundles.ts`; secrets scrubbed by `DL/model/secrets.ts`.
- **Permalinks**: `DL/model/permalink.ts`, a base64url `graphic=` query parameter carrying one `GraphicDocument`.

In the demo, the first is `createLocalPersistence`, the second is `serializeDocument`/`parseDocument` on a whole workbench document (5.H's export/import helpers once they exist), and the third is a `DocumentPayload` in a URL.

### 4.10 How datalab tiles coordinate today

Restating linking guide §4.9 for this audience, because these are exactly the couplings the demo turns into ports:

| mechanism | evidence | linking-guide term |
|---|---|---|
| every doc-bound tile reads `view.documents.primary`; the `DocBar` dropdown re-points a view | `DL/apps/ChartApp/ChartApp.tsx:10-11`, `DL/components/molecules/DocBar/` | `Constant(doc)` per port |
| an unbound tile shows `world.activeDocId` | `DL/apps/useTable.ts:24-30` | `Ambient("workspace.doc")` fallback |
| the `inspect` verb writes `world.inspected`; the Inspector singleton reads it | `DL/apps/InspectorApp/InspectorApp.tsx:13-14` | an `<any>` input port fed by an ambient cell |
| two placements of one view read one `AppView` | `DL/appkit/registry.ts:24-30` | a linked view (identity at document granularity) |
| plot's `ResponsivePlot` emits `activate`, `hover`, `brush`, `view-change` with an `InteractionTargetRecord` | `PLOT/interactions.ts:52-58` | an out port waiting to be declared: `datum`, `selection` |

## 5. The pbui substrate the demo stands on

### 5.1 Package map

```text
pbui/                                   the monorepo (pnpm workspace + Go module)
├── src/                                @hyperslop-systems/pbui — presentations, action kernel, accept mode, chrome, components
├── proto/hyperslop/pbui/workbench/v1   the workbench document + mutation schema (protobuf)
├── packages/workbench-protocol/        generated TS + /client applier and builders (mirrors pkg/workbench)
├── pkg/workbench/                      Go validator/applier for the same document (used by datalab's server)
├── packages/pbui-workbench/            the tiled shell: store, verbs, Surface/Tile/Launcher, persistence, sync, rebalance
├── packages/pbui-sandbox/              sandboxed agent-written programs (eval and QuickJS engines)
├── packages/pbui-editor/               the JavaScript editor tile
├── packages/pbui-plotscript/           script tile beside plot tile over one script document  ← the template
│   └── demo/                           a Vite app: the reference product for the package      ← the template's demo
├── packages/pbui-chat/                 conversation apps and agent tools
└── packages/datalab-ui/                the existing product (this guide's §3–§4)
../plot/                                @hyperslop-systems/plot 0.3.1 — grammar-of-graphics compiler + React host
../datalab/                             the Go server (pkg/server, pkg/workbenchapp, pkg/tabular, …)
```

`pnpm-workspace.yaml` lists `packages/*` plus the two demo apps explicitly. A new `packages/pbui-datalab/` with a `demo/` would be added the same way.

### 5.2 The workbench protocol

`pbui/proto/hyperslop/pbui/workbench/v1/workbench.proto:11-66`:

```protobuf
message WorkbenchDocument {
  string format = 1;                        // "pbui.workbench"
  uint32 schema_version = 2;                // 1
  string id = 3;  string name = 4;
  repeated Workspace workspaces = 5;        // { id, name, Node tree }
  map<string, AppView> views = 6;           // { id, app_id, map<string,string> documents, title }
  repeated string view_order = 7;
  map<string, DocumentPayload> documents = 8;   // { id, format, schema_version, google.protobuf.Struct body }
}
message Node { string id = 1; oneof { Leaf leaf; Split split; } }   // Leaf { view_id }, Split { direction, ratio, a, b }
```

Mutations (`:89-216`): `workbenchRename`, `workspaceCreate/Rename/Delete`, `documentPut/Delete`, `viewCreate/Configure/Clone/Delete/Close`, `placementReplace/Split/Close`, `splitResize`, `workspaceSetTree`. A `MutationBatch` is atomic.

`PROTO/src/client/` (`apply.ts`, `builders.ts`, `ratios.ts`): `applyMutation`, `applyMutations` (the same semantics as `pkg/workbench` in Go; `MutationError` on refusal), `leafNode`, `splitNode`, `findNode`, `leaves`, `newId`, `resizeSplit`, `snapRatio`, `closePlacement`, `swapPlacements`, `dockPlacement`, `placementCount`, `workspaceOfPlacement`, `viewsOfApp`, `createWorkbenchClient`.

Two facts the demo leans on:

- `AppView.documents` is a **map of roles to document ids**, not a single id. datalab's own comment on its copy of the type (`DL/store/layout.ts:47-53`) says it was named rather than an array "so a later two-document application can add meaningful roles". The plot tile is that application.
- `DocumentPayload.body` is an open `Struct`. The server validates it by `format` (§4.6). Any JSON document can ride in the workbench document.

### 5.3 `pbui-workbench` in one page

```ts
// PW/apps.ts:9-12, 20-70, 95, 107
interface AppProps { placementId: string; view: AppView }
interface AppDescriptor {
  id; title; tone;                       // tone is a CSS token reference, never a colour
  singleton: boolean; duplicable?; docBound?;
  bindings?: string[];                   // the roles a doc-bound app needs in view.documents
  titleFor?(view); group?; blurb?; available?(ctx);
  Component: ComponentType<AppProps>;
}
defineApp(input) → AppDescriptor          // normalises duplicable/docBound
createAppRegistry(apps) → { get, list }   // throws on a duplicate id; an explicit list, never import side effects

// PW/document.ts
tile(appId, { documents?, title? }) · split(dir, ratio, a, b) · layout(spec, opts) · workspaces([{ id, name, spec }], opts)
emptyDocument() · singleTile(appId) · serializeDocument(doc) · parseDocument(json)   // strict: unknown field ⇒ null

// PW/createWorkbench.tsx → Workbench (PW/types.ts:141-197)
createWorkbench({ apps, initial, store?, onMutate?, splitPolicy?, emptyPaneApp?, binding? })
  .store .verbs .useDocument() .useWorkbenchState(sel) .mutate(ms) .perform(verb) .plan(verbs) .applyPlan(plan)
  .serialize() .restore(json) .reset(factory?) .activePlacementId() .root() .focusPlacement(id) .placement
  .Surface .Launcher .WorkspaceStrip .Rebalance .RebalanceBadge

// PW/persistence.ts
readWorkbenchSnapshot(key, { version?, storage?, migrate? }) → { document, workspaceId? } | null
createLocalPersistence(wb, { key, version?, debounceMs?, storage?, onError? }) → { flush(), dispose() }

// PW/sync.ts (entry "@hyperslop-systems/pbui-workbench/sync")
createWorkbenchSync({ client: SyncClient, … }) → { enqueue, attach(wb), status(), flush(), dispose() }
SyncClient = { get(), create(doc), mutate(revision, mutations, requestId), stream?(onChange) }   // speaks /mutate, not PUT
```

Verbs (`PW/verbs.ts`): `tile.split/close/swap/dock/activate/resize/replace/link/rebind`, `view.open` (with `at?: { placementId, zone }`), `view.setTitle`, `workspace.create/rename/delete/select/clone`, `launcher.open/close`, `rebalance.open`. Every UI door and the agent tools emit these; nothing mutates the store directly.

Products keep: their apps, their `<tile>` presentation for `renderTitle`, their launcher `rows` policy, their split policy, their store if they have one.

### 5.4 `plot` in one page

```ts
// PLOT/document.ts:377-391
interface PlotDocument {
  format: "hyperslop.plot"; version: 1; id: PlotId; description?;
  variables: Record<VariableId, VariableSpec>;   // field | constant | derived(expression) | unity   (:67-88)
  composition: CompositionSpec;                  // dimensions x/y, groups, facets (rows/columns), …
  layers: LayerSpec[];                           // geom + stat + position + aesthetics per layer
  scales?; coordinate?; presentation?; annotations?; limits?; metadata?;
}
// PLOT/schema.ts:5-45
interface PlotField { id: FieldId; name; label?; semanticType: "quantitative"|"nominal"|"ordinal"|"temporal"; nullable; unit?; timezone?; column }
interface PlotSchema { fields: PlotField[] }
interface PlotData { rows: PlotRow[]; coverage: { kind: "complete", rowCount } | { kind: "bounded", rowCount, hasMore, strategy }; identity?: { fields: FieldId[] } }
```

Statistics: identity, summary, histogram, OLS, boxplot, Gaussian density (`PLOT/stats.ts`, `stat-definitions.ts`). Geometry: point, line, bar, area, ribbon, rule, error-bar, boxplot. Positions: identity, stack, fill, dodge, jitter. The React host (`PLOT/react/`): `PlotHost`, `ResponsivePlot`, `PlotDescription`, an SVG renderer. Interactions (`PLOT/interactions.ts:19-58`): targets are marks (with `datumIds`), legend entries and panels; an `InteractionTargetRecord` carries `identities: DatumIdentity[]`, `semanticValues` per variable, and device bounds. The `identity?: { fields }` on `PlotData` is what makes a datum addressable back to a source row.

Compared with datalab's plot half: every datalab concept maps onto a plot concept (`plotAdapter.ts:80-245` is the proof), and plot has many more. Datalab's `AnalysisSpec` kinds are plot `stat`s. Datalab's `Channel` set is a subset of plot's aesthetics. Datalab's `facet` channel is plot's `composition.facets`.

### 5.5 `pbui-plotscript`: the template

Read this package before designing anything; the demo is this package with a relation document beside the plot document.

| piece | file | what it does |
|---|---|---|
| `PlotScriptDoc` | `PS/document.ts:17-24` | a script as a `DocumentPayload` (`format: "pbui.plotscript"`, `schemaVersion: 1`); `readPlotScript(doc, id)` returns `null` for a foreign format ("not a script", never an error); `plotScriptMutation(script)` is one idempotent `documentPut` |
| host | `PS/host.ts` | one object owning the runtime: the sandbox engine, the draft store, the runner |
| draft store | `PS/draftStore.ts` | the editor's live text, outside the document; the document holds what last **ran successfully** |
| runner | `PS/runner.ts` | one sandbox per script, debounce, a run ticket (a stale run never publishes), `lastGood` (a failing run never blanks the plot), captured console |
| apps | `PS/apps.tsx:19-39` | `createPlotScriptApps(host)`: `plot-script` and `plot-view`, both `bindings: [PLOT_BINDING]`, both non-singleton |
| demo boot | `PS/../demo/src/workbench.ts:14-47` | `workspaces([...])` seeded from example scripts, `applyMutations(doc, scripts.map(plotScriptMutation))`, `parseDocument(localStorage)` restore, `createWorkbench({ apps, initial, onMutate: save })`, `connectPlotScriptDocuments(workbench, host)` |
| demo shell | `demo/src/App.tsx` | a strip (`WorkspaceStrip`, a reset button), `Surface`, `Launcher`, `Rebalance`; reset clears the document AND the host |

The three design moves to copy:

1. **The document holds the committed thing; the host holds the live thing.** A script is in the document only after it ran. In the demo: a relation document is in the workbench document; its *result* (rows, schema, metrics) is in the host, keyed by document id and revision.
2. **A host is a plain object created once, passed into `createXApps(host)`, and reset with the workbench.** The demo's host owns the DuckDB executor and the coordinator (§4.3 steps 4–6, lifted).
3. **`connectXDocuments(workbench, host)` subscribes the host to the store**, so a result that finishes after its tile closed is not lost and a document change re-runs.

### 5.6 PBUI-LINK-1 in one page, and what the demo must offer it

The linking guide (§6) adds to `AppDescriptor` one optional field, `ports?: PortDeclaration[]`, each port `{ name, direction: "in"|"out"|"inout", contract: { valueType, semanticRole, cardinality, mode, authorityDomain, updateAlgebra, lifetime }, doc, fallbackContext?, fanIn?, onSourceClose?, documentSlot? }`. Binding terms (`§6.3`) are `Ambient(k)`, `Constant(r)`, `Follow(p)`, `Alias(c)`, `Derived(b, ρ)`, `Hold(r, b)`, `Unresolved(d)`. Declarations persist in a `pbui.links` payload in the workbench document; live values sit in a runtime store keyed by view id. Ports are addressed `viewId/name`. Interaction is a header badge, an object-menu "Link to…" family, and a connect-management mode with wires.

Its demo list (§11) asks for, in order: LinkLab (the research toy as Storybook apps), the plot workbench (script → plot → inspector, §11.2), **datalab (table ≡ chart selection, chart click → detail, §11.3)**, chat, and sandbox devtools. The datalab demo is described as: "Table and chart tiles bound to one document declare `selection : <datum[]>` inout ports with identical contracts; 'Make identity ≡' creates a class; brushing the chart selects rows in the table and vice versa; unlink with 'restore private history' gives each back its own selection. A second chart bound to a different document is not identity-compatible and the menu says why."

So the demo must have, at minimum: a table tile and a plot tile bound to one relation, both emitting and accepting a `selection` of datum identities; a plot that emits `datum` on activate; an inspector with a `subject` in port; and an ambient "current relation" context that unbound tiles fall back to. §7.6 declares them.

## 6. What was learned trying to migrate datalab as it is

Workbench guide §10 is the record; this is the summary that decides this ticket's shape.

### 6.1 "The codec disappears" was false

§6.4 of the workbench guide said that with a protocol tree at runtime, "the codec at the remote boundary disappears because the runtime document *is* the wire document". Observed (§4.6 above): the wire document is a projection of two slices narrowed by stage and by reachability, with an inverse that defends a local-only namespace. Deleting datalab's own `Node` type removes the tree and view encode/decode halves of `remote/codec.ts`. The stage filter, the two reachability walks, the world-slice merge and the namespace defence all remain. It is a sync policy that had been living inside a codec.

### 6.2 The two steps were not separable

The plan said: first swap the tree type and the geometry reducers, then swap the rendering. Observed: the twelve geometry and view reducers step one rewrites are exactly what step two deletes when `wb.Surface` and a store adapter take over. There is no green intermediate. **Measured:** swapping `DL/store/layoutTree.ts`'s `Node` for the protocol's, and nothing else, produced **308 type errors across 25 files** (102 in one test file, about 50 in components step two deletes) against 554 passing tests. It was reverted cleanly.

### 6.3 Where documents live was never decided

The protocol document has a `documents` map; datalab's real home for documents is the world slice, read by 25 files. Three options were tabled (workbench guide §10.5): (a) merge the world slice into the layout document, (b) keep them apart and rename the boundary to what it is, (c) put stage sendability into the protocol so the shared sync module can own the boundary. (b) was recommended. This ticket makes the question moot for the demo (§7.4) and leaves it for `datalab/` proper.

### 6.4 Stages have no home in the shell

`pbui-workbench`'s `WorkspaceStrip` renders every workspace in the document and has no filter (`PW/types.ts:60-70`). Datalab keeps four stages' workspaces in one flat array. Either a store adapter presents a stage-scoped document, or the strip gains a scope, or stages become separate documents. The last is the honest one and is what the demo does implicitly by not having stages (§7.8).

### 6.5 Two general lessons

- **A migration plan must state the product's package version and read the changelog since.** hyperblog's feature prerequisites were all satisfied and it was still blocked, because pbui 0.8.0 deleted the descriptor `actions()` callback (workbench guide §10.2). datalab-ui depends on pbui through `workspace:^`, so it is always current, and this particular trap does not apply to it. The demo, living in the monorepo, is immune the same way.
- **A package-shipped application must reach the product's Go catalog** (workbench guide §10.3): `pkg/workbench.Validate` refuses `unknown_application`. For the demo this means every tile id it defines must be in `GO/workbenchapp/catalog.go` before a demo layout can be saved to the Datadrop server, and any new `DocumentPayload.format` must have a validator branch in `GO/workbenchapp/documents.go` (§11, Q4).

### 6.6 The server side is ready

One thing that turned out better than expected: DATADROP-18 already added `POST /v1/workbenches/{id}/mutate` (§4.6), the mutation-batch endpoint `pbui-workbench`'s sync module speaks, with a typed-mutation test pinning the API surface (`test/api-surface.test.ts`). The demo can sync to the real server through `PW/sync.ts` without a `replace()` on `SyncClient` and without touching Go.

## 7. The design of the demo

Loose by intent. What follows are the shapes and the reasons; file names are suggestions.

### 7.1 Two document kinds, both payloads in the workbench document

```text
WorkbenchDocument
├── workspaces / views / view_order        (the layout: pbui-workbench's business)
└── documents
    ├── "rel-…"  format "pbui.relation"     v1   ← datalab's data half, lifted
    │      { id, name, sources, transforms, parameters, scope }
    ├── "plot-…" format "hyperslop.plot"    v1   ← plot's PlotDocument, verbatim
    │      { id, variables, composition, layers, scales?, … }
    └── "pbui.links"                             ← PBUI-LINK-1's declarations (later)
```

**The relation document** is `GraphicDocument` minus `views` and `rootView`, plus nothing. Whether it is literally a new format id or `datadrop.gog.document` v3 with the plot half removed is open question Q1 (§11). The authoring helpers that touch only the data half (`rootSource`, `relationChain`, `orderedTransformIds`, `appendTransform`, `removeTransform`, `moveTransform`, `replaceDocumentSource`, `documentLimit`, `fieldsAtRelation`, `DL/model/graphicAuthoring.ts`) come with it unchanged. The transform editor model (`DL/model/transformEditor.ts`) too.

**The plot document** is plot's own type. No adapter, no product grammar. Its `variables` of kind `field` name `FieldId`s; those ids come from the relation's output schema (§7.5).

### 7.2 Bindings by role

```ts
// what a view's documents map looks like for each tile
sources / pipeline / table :   { relation: "rel-1" }
plot / plot-editor :           { plot: "plot-1", relation: "rel-1" }
plot-script (from plotscript): { plot: "plot-1" }              // unchanged; it authors the same document
inspector :                    {}                               // a value port, not a document slot (§7.6)
```

`defineApp({ bindings: ["plot", "relation"] })` declares the roles; `describeWorkbench` tells an agent what to bind; `openView` de-duplicates a doc-bound view with identical bindings (§5.3). Two plots over one relation are two plot documents each bound to the same relation id. A second placement of one plot view is a linked view. Both come free.

### 7.3 The tiles

| id | binds | what it is | from datalab-ui |
|---|---|---|---|
| `sources` | `relation` | choose the root source: a fixture table, an uploaded file, a Datadrop dataset or stream | `DL/apps/SourceApp`, `UploadPanel` (thinned) |
| `pipeline` | `relation` | the transform chain editor | `DL/apps/PipelineApp`, `PipelinePanel`, `model/transformEditor.ts` |
| `table` | `relation` | the current output relation, paged; emits `selection` | `DL/apps/TableApp`, `TablePanel` |
| `plot` | `plot`, `relation` | `ResponsivePlot` over the relation's result; emits `datum`, `selection` | new, ~ `PS/PlotTile` |
| `plot-editor` | `plot`, `relation` | a structured editor over `PlotDocument`: layers, aesthetics, stats, facets, scales; replaces datalab's encoding panel | new; **belongs in its own pbui package** (§7.9) |
| `plot-script` | `plot` | plotscript's script tile, unchanged: a third way to author the same document | `pbui-plotscript` |
| `inspector` | — | a `subject : <any>` in port; shows a datum, a field, a relation, a plot | `DL/apps/InspectorApp` + pbui's `InspectorPanel` |

Not in the first cut, any of which can return as a tile once the base exists: charts (all plots), gallery/snapshots, compare a/b, watchlist, trace, templates, lessons, accounts.

### 7.4 The data host

The world slice's reasons for existing (§4.5) were performance and immutability over large tables. Neither argues for rows in the workbench document; rows never were in the document. So:

```ts
// packages/pbui-datalab/src/host.ts (sketch)
interface DatalabHost {
  executor: AnalysisCoordinator;                       // DL/appkit/analysisCoordinator.ts, lifted whole
  results: Map<RelationId, RelationResult>;            // { revision, schema: PlotSchema, data: PlotData, fields, metrics, diagnostics }
  sources: SourceProvider;                             // fixtures | uploads (DuckDB-registered files) | Datadrop v1 (api/client, thinned)
  subscribe(relationId, listener): () => void;
  run(relationId): Promise<RelationResult>;            // compile → SQL → DuckDB → normalise → schema/data; coalesced and generation-guarded by the coordinator
  reset(): void;
}
createDatalabHost(options): DatalabHost
connectDatalabDocuments(workbench, host): () => void   // store subscription: a relation payload changed ⇒ host.run; deleted ⇒ purge
```

Edits to a relation document are structural (add a transform, change a source, toggle `enabled`), not per-keystroke, so a `documentPut` per edit through `wb.mutate` is fine; the draft-in-progress of an expression lives in the tile's local state or a draft store as in plotscript. Results are host state, keyed by relation id and the document revision that produced them, so a plot tile and a table tile over one relation read one result.

### 7.5 Schema flow: the join the product lives on

A plot document's `field` variables name `FieldId`s. Datalab already mints stable field ids at the authoring boundary (`sourceFieldId`, `transformFieldRef`, `DL/model/graphicAuthoring.ts:20,172`; `AnalyticalField.fieldId`, `DL/model/table.ts:22`), and `buildPlotSchema` (`plotAdapter.ts:67`) already turns a result's fields into a `PlotSchema`. The demo keeps that: **the relation result's `PlotSchema` is the schema the plot compiles against**, and a plot variable whose field id no longer exists in the schema is a diagnostic (plot produces one), shown in the plot tile and in the plot editor, never an exception.

```text
relation doc ──run──▶ RelationResult { schema: PlotSchema, data: PlotData }
                                            │                 │
plot doc  ──────────────────────────────────┴── renderPlot ───┘──▶ scene
             variables[x] = { kind: "field", fieldId: "field:rel-1/t-3/mean_temp" }
```

When the pipeline changes and a field disappears, the plot editor offers the remaining fields; the plot shows plot's own "unknown field" diagnostic. This is where `analysisCoordinator`'s generation rule matters: a plot must never render an old result against a new schema.

### 7.6 Ports for PBUI-LINK-1

Declared with the linking guide's `PortDeclaration` (§5.6), once Phase 1 of that ticket lands the field on `AppDescriptor`:

| app | port | direction | valueType | semanticRole | notes |
|---|---|---|---|---|---|
| `table` | `selection` | inout | `datum[]` | `selection` | identities from `PlotData.identity.fields`; `fanIn: "active-source"` |
| `plot` | `selection` | inout | `datum[]` | `selection` | brush → emit; follow → highlight; identical contract to `table.selection` so identity is compatible when the relation matches |
| `plot` | `datum` | out | `datum` | `subject` | `activate` on a mark emits one datum with its `semanticValues` |
| `plot` | `field` | out | `field` | `subject` | legend entry click emits the field |
| `inspector` | `subject` | in | `any` | `subject` | `fallbackContext: "workspace.inspected"`; `onSourceClose: "freeze"` (the Hold story) |
| `sources`, `pipeline`, `table`, `plot`, `plot-editor` | `relation` | in | `relation` | `relation.current` | `documentSlot: true`; `fallbackContext: "workspace.relation"` replaces datalab's `activeDocId` |

`authorityDomain` for `selection` is the relation id, which is what makes "a second chart bound to a different document is not identity-compatible and the menu says why" (§5.6) fall out of contract normalisation rather than special code.

A `datum` value must be serialisable for `Hold`/`Constant` (linking guide Decision D4): the demo's `datum` reference is `{ relation, identity: Record<FieldId, JsonPrimitive> }`, never a row object. plot's `DatumIdentity` (`PLOT/identity.ts`) is already that shape.

### 7.7 Where statistics run

Datalab pushed histograms, regressions, boxplots and densities into DuckDB (`AnalysisSpec`, computed in SQL) so they scale past the browser's row budget. plot computes the same statistics over the bounded rows it is handed. The demo uses plot's, because the relation already bounds its window (`scope.limit`, default 2 000; `MVP_MAX_RESULT_ROWS` 10 000) and because plot's README lists backend statistical lowering as separate, later work. When that work happens, it is a `core:aggregate`-style transform in the relation document, and the plot document does not change. Nothing in the demo should assume where a stat ran.

### 7.8 What the demo deliberately does not have

- **Stages.** The demo has one workbench document with as many workspaces as the user makes. Sign-in, welcome and account are not workspaces; if they are needed later they are separate documents or separate pages.
- **The marketing page and the tour.** Storybook stories and the demo's seeded workspaces are the executable documentation. `WorkbenchInstance`'s idea (many isolated workbenches on one page) is available from `pbui-workbench` if a landing page is ever wanted.
- **Templates, portable bundles, permalinks.** `serializeDocument`/`parseDocument` and 5.H's export/import cover the first two at whole-document granularity; a payload in a URL covers the third. Per-tile templates are a later feature.
- **Its own grammar.** No `Mark`, no `Channel`, no `AnalysisSpec`, no `plotAdapter`. If datalab's four-mark five-channel UI is wanted as a *simpler* editor, it is a preset layer over `PlotDocument` inside the plot editor, not a second document type.
- **Its own shell.** No `Tile.tsx`, `SplitView`, `WorkbenchShell`, `LauncherDialog`, `ViewSwitcher`. The demo's launcher rows policy is `defaultLauncherRows` until it needs its own.
- **Redux.** The host is a plain object; the workbench store is `pbui-workbench`'s. If a product later needs Redux, turboproof's store adapter is the pattern (`turboproof/ui/src/store/workbenchShell.ts`).
- **Server sync in the first cut.** `createLocalPersistence` like plotscript's demo; `PW/sync.ts` against `/v1/workbenches/{id}/mutate` is a second step and needs the catalog entries (§6.5).

### 7.9 Package layout sketch

```text
pbui/packages/pbui-datalab/                @hyperslop-systems/pbui-datalab
├── src/
│   ├── relation/                          the data half, lifted from DL/model + DL/analysis
│   │   ├── document.ts                    RelationDoc type, readRelation(doc, id), relationMutation(rel) — the PS/document.ts pattern
│   │   ├── authoring.ts                   from DL/model/graphicAuthoring.ts (data-half functions only)
│   │   ├── compile.ts, logical.ts         from DL/model/graphic.ts (LogicalGraphic + compileGraphicDocument, minus views)
│   │   └── duckdb/                        from DL/analysis/* unchanged (compile, runtime, ingest, normalize, browser, ports, assets, quote)
│   ├── plot/
│   │   └── document.ts                    readPlot(doc, id), plotMutation(plot): plot's PlotDocument as a payload; format "hyperslop.plot"
│   ├── host.ts                            DatalabHost (§7.4); AnalysisCoordinator from DL/appkit
│   ├── connect.ts                         connectDatalabDocuments(workbench, host)
│   ├── apps.tsx                           createDatalabApps(host): sources, pipeline, table, plot, inspector
│   ├── tiles/                             SourcesTile, PipelineTile, TableTile, PlotTile, InspectorTile (+ .module.css)
│   ├── presentation/                      the product's PBUI instance: <relation>, <transform>, <field>, <datum>, <plot> descriptors (pbui 0.10 action kernel, as hyperblog/turboproof do)
│   ├── fixtures/                          from DL/fixtures (tables) and a few seeded relation + plot documents
│   └── index.ts
├── demo/                                  a Vite app exactly like packages/pbui-plotscript/demo
├── vite.ts                                datalabPublicDir for the DuckDB bundles (from DL/vite.ts)
└── package.json                           deps: pbui, pbui-workbench, pbui-plotscript (for the script tile), plot 0.3.1, @duckdb/duckdb-wasm

pbui/packages/pbui-plot-editor/            @hyperslop-systems/pbui-plot-editor   (its own package, any product with a plot document can use it)
└── src/                                   a structured editor tile over PlotDocument: layers, aesthetics, stats, positions, facets, scales
```

Why the plot editor is separate: it depends on plot and pbui only, not on relations or DuckDB, and plotscript's demo wants it as much as this one does. The workspace-relative name of this repo (`add-plot-editor`) suggests it is already on the way.

## 8. Salvage map from datalab-ui

Read "keep" as "move with its tests, drop the imports it no longer needs".

| datalab-ui file | verdict | note |
|---|---|---|
| `DL/model/graphic.ts` | split | data-half types and `LogicalGraphic`/`compileGraphicDocument` keep; `AuthoringView`, `Mark`, `Channel`, `AnalysisSpec`, `ReferenceLine`, `CHANNEL_ACCEPTS` drop |
| `DL/model/graphicAuthoring.ts` | split | keep everything that does not mention a view: source fields, relation chain, transforms, limits; `applyDefaultView`, `rootView`, `createDefaultGraphic` drop |
| `DL/model/table.ts`, `live.ts`, `secrets.ts`, `transformEditor.ts` | keep | wire types, live-tail projection, credential scrub, transform editing |
| `DL/model/portable.ts`, `permalink.ts`, `format.ts` | drop | whole-document serialisation replaces them |
| `DL/analysis/*` | keep | unchanged |
| `DL/appkit/analysisCoordinator.ts` | keep | becomes the host's executor |
| `DL/appkit/AnalysisProvider.tsx` | rewrite | a React context over the host, much smaller (no principal epochs: one host per workbench) |
| `DL/appkit/plotAdapter.ts` | drop | `buildPlotSchema` (13 lines) is the one function worth carrying into `relation/` |
| `DL/appkit/useRemoteWorkbench.ts`, `DL/remote/*` | drop | `PW/sync.ts` |
| `DL/appkit/registry.ts`, `AppScope.tsx`, `usePersistence.ts`, `useTransientSurface.ts` | drop | `pbui-workbench` |
| `DL/api/client.ts` | thin | keep the dataset/stream table queries and the token reader; drop accounts, members, workbench PUT; if RTK Query goes, replace with fetch wrappers |
| `DL/api/workbenchProtocol.ts`, `workbenchStream.ts` | drop | `PW/sync.ts` and the protocol package |
| `DL/store/*` | drop | all of it |
| `DL/apps/{SourceApp,PipelineApp,TableApp,InspectorApp}` + their organisms | adapt | the panel bodies are worth reading before writing new ones; their Redux wiring is not |
| `DL/apps/{ChartApp,EncodingApp}` + `ChartPanel`, `EncodingPanel` | drop | replaced by the plot tile and the plot editor |
| `DL/pbui/*` (descriptors, verbs, actions) | rewrite | against pbui 0.10's action kernel; keep the *vocabulary* of presentation types |
| `DL/components/{Tile,SplitView,LauncherDialog,ViewSwitcher,pages/*}` | drop | the shell |
| `DL/tour/*`, `TourContent.tsx`, lessons, tutorials, `MarketingPage`, `TutorialBand` | drop | |
| `DL/fixtures/*`, `DL/export/{csv,png}.ts` | keep | |
| `DL/vite.ts`, `DL/analysis/assets.ts` | keep | the DuckDB public dir |
| `test/{graphic,graphic-authoring,duckdb-compile,duckdb-runtime,analysis-coordinator,live,fixtures}.test.ts` | keep | re-pointed |
| `test/{store,stages,launcher-index,portable,instances,remote-*,shortcut-routing,routes}.test.ts` | drop | |

## 9. Pseudocode and key flows

### 9.1 Boot

```ts
// demo/src/workbench.ts
const host = createDatalabHost({ sources: fixtureSources() });                 // DuckDB loads lazily on first run
const apps = createAppRegistry([
  ...createDatalabApps(host),                                                  // sources, pipeline, table, plot, inspector
  ...createPlotScriptApps(createPlotScriptHost()),                             // plot-script, plot-view (optional)
  plotEditorApp,                                                               // from pbui-plot-editor
  rebalanceSettingsApp,
]);
const seed = applyMutations(
  workspaces([{ id: "ws-1", name: "temperatures", spec:
    split("row", 0.4,
      split("col", 0.5, tile("pipeline", { documents: { relation: "rel-1" } }), tile("table", { documents: { relation: "rel-1" } })),
      split("col", 0.6, tile("plot", { documents: { plot: "plot-1", relation: "rel-1" } }), tile("plot-editor", { documents: { plot: "plot-1", relation: "rel-1" } }))) }]),
  [relationMutation(SEED_RELATION), plotMutation(SEED_PLOT)],
);
const restored = readWorkbenchSnapshot(KEY);
const wb = createWorkbench({ apps, initial: restored?.document ?? seed, binding: { source: "relation" } });
createLocalPersistence(wb, { key: KEY });
connectDatalabDocuments(wb, host);                                             // runs rel-1 once, then on every change
```

### 9.2 Edit a transform → re-run → re-plot

```text
PipelineTile: user toggles transform t-3 enabled
  → wb.mutate([documentPut({ ...relation, transforms: { ...t, "t-3": { ...t3, enabled: true } } })])   // one atomic batch
  → store notifies; connectDatalabDocuments sees documents["rel-1"] changed
  → host.run("rel-1"): coordinator bumps generation for namespace rel-1, coalesces, executes
      compileGraphicDocument(rel, env) → compileDuckDBRelation → DuckDB → normalise → { schema, data, metrics, diagnostics }
  → host.results.set("rel-1", { revision, … }); listeners notified
  → TableTile (subscribed to rel-1) re-renders rows
  → PlotTile (subscribed to rel-1 AND reading plot-1 from wb.useDocument()) calls renderPlot(plot, schema, data, viewport)
      a variable naming a field that vanished ⇒ plot diagnostic, shown in the tile; never a throw
  → PlotEditorTile re-lists fields from the new schema
```

### 9.3 Open a plot on a relation from the launcher (a two-role bind)

```ts
// a product launcher row "new plot of ⟨relation⟩"
choose(row) {
  const plotId = newId();
  return wb.applyPlan(wb.plan([
    { type: "document.put", document: plotMutationPayload(defaultPlotFor(host.results.get(rel)!.schema, plotId)) },  // a raw mutation, or a product verb that emits one
    { type: "view.open", app: "plot", documents: { plot: plotId, relation: rel } },
  ]).plan);
}
```

`plan` runs the sequence against a shadow store and refuses atomically (`PW/types.ts:128-139`), which is how "make a document and open a tile on it" never leaves a half-state.

### 9.4 Brush on the plot → selection on the table (PBUI-LINK-1 Phase 5)

```text
PlotTile: ResponsivePlot onEvent(brush) → identities: DatumIdentity[]
  → links.emit("view-plot-1/selection", { relation: "rel-1", identities })          // out side of the inout port
  → kernel: class σ = { plot-1/selection, table-1/selection } (declared by "Share selection with…")
  → TableTile's effective binding is Alias(σ) ⇒ reads the class cell ⇒ highlights those rows
TableTile: user shift-clicks rows → emits on the same port → plot highlights marks
"Unlink · restore private history" → each port back to its own last value (Hold semantics, linking guide §6.3)
```

Before PBUI-LINK-1 Phase 2 exists, the same wiring is an explicit `host.selection` cell keyed by relation id, which is exactly datalab's `activeDocId`-style global; the demo should write it that way first and *replace* it with ports, so the linking work has a before/after.

## 10. Diagrams

### 10.1 Ownership

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ pbui core        presentations · action kernel · accept mode · chrome        │
├──────────────────────────────────────────────────────────────────────────────┤
│ pbui-workbench   WorkbenchDocument in a store · verbs · Surface/Launcher     │
│                  persistence · sync(/mutate) · rebalance · (links, LINK-1)   │
├───────────────────────────┬───────────────────────┬──────────────────────────┤
│ pbui-datalab              │ pbui-plot-editor      │ pbui-plotscript          │
│  relation doc + DuckDB    │  structured editor    │  script tile             │
│  host · sources/pipeline/ │  over PlotDocument    │  over PlotDocument       │
│  table/plot/inspector     │                       │                          │
├───────────────────────────┴───────────────────────┴──────────────────────────┤
│ plot             PlotDocument · PlotSchema/PlotData · renderPlot · React host │
└──────────────────────────────────────────────────────────────────────────────┘
        ▲ documents ride in WorkbenchDocument.documents; rows ride in the host
```

### 10.2 One relation, two documents, four tiles

```text
   documents["rel-1"] (pbui.relation)            documents["plot-1"] (hyperslop.plot)
            │                                              │
            │ host.run ──▶ RelationResult{schema,data}     │
            │                    │                         │
   ┌────────┴────────┐  ┌────────┴────────┐  ┌─────────────┴────────────┐  ┌──────────────────────────┐
   │ pipeline        │  │ table           │  │ plot                     │  │ plot-editor              │
   │ {relation}      │  │ {relation}      │  │ {plot, relation}         │  │ {plot, relation}         │
   │ edits rel-1     │  │ shows rows      │  │ renderPlot(plot-1,       │  │ edits plot-1 against     │
   │                 │  │ ⇄ selection     │  │   schema, data) ⇄ sel.   │  │   rel-1's schema         │
   └─────────────────┘  └─────────────────┘  └──────────────────────────┘  └──────────────────────────┘
```

### 10.3 Datalab-ui today versus the demo, side by side

```text
datalab-ui                                         pbui-datalab demo
──────────────────────────────────────────────     ──────────────────────────────────────────────
Redux: layout slice (own tree, stages)             pbui-workbench store (protocol document)
Redux: world slice (docs, activeDocId, inspected)  documents in WorkbenchDocument; host holds results; ports hold values
GraphicDocument = data half + plot half            relation doc (data half) + plot doc (plot's)
plotAdapter → PlotDocument                         — (the plot doc IS a PlotDocument)
useRemoteWorkbench PUT + codec                     PW/sync over /mutate (later); createLocalPersistence (first)
Tile/SplitView/WorkbenchShell/LauncherDialog       wb.Surface / wb.Launcher
25 apps, 4 stages, tour, accounts, templates       6 tiles, one document, seeded workspaces
```

## 11. Open questions

**Q1. Is the relation document a new format or `datadrop.gog.document` v3?** A new `pbui.relation` format is clean and lets the Go validator's `graphic_validation.go` be split along the same line. Reusing the existing format keeps existing stored workbenches loadable by both frontends. Recommendation: new format, and a one-way converter from `datadrop.gog.document` v2 that also emits the `hyperslop.plot` document `plotAdapter` would have built, so old data is not lost.

**Q2. Does the demo depend on `pbui-plotscript`, or the other way round?** Neither should depend on the other; both depend on plot and on a plot-document payload helper. That helper (`readPlot`, `plotMutation`) belongs in a tiny shared place, perhaps `pbui-plot-editor` or a `plot-document` module in `pbui-workbench`.

**Q3. Where do uploaded files live?** DuckDB can register a `File` directly. A relation whose root source is an upload has a `SourceRef` the Datadrop server cannot resolve. Either uploads are first-class local sources (a `kind: "local"` that the server refuses to store, like datalab's local-only namespace), or upload goes through Datadrop's dataset API first. The first is right for a demo; the second for the product.

**Q4. Go validation for the new formats.** `GO/workbenchapp/documents.go` must learn `pbui.relation` and `hyperslop.plot` before a demo document can be saved to the server. plot has no Go validator today; a permissive `format`+`version` check is enough to start.

**Q5. What happens to `packages/datalab-ui`?** It keeps building and its tests keep passing; nothing in this ticket touches it. It is frozen, not deleted, until the demo covers the product's core loop and `datalab/ui` can switch its dependency. That switch is a `datalab/` ticket.

**Q6. Field identity across pipeline edits.** Datalab mints field ids per source and per transform (`sourceFieldId`, `transformFieldRef`). A plot bound to `t-3`'s `mean_temp` loses its variable when `t-3` is deleted. That is correct (plot says so with a diagnostic), but the editor should offer "rebind to a field with the same name" as the common repair.

**Q7. The `selection` contract.** The linking guide wants identical contracts on `table.selection` and `plot.selection`. Both must agree on the identity fields (`PlotData.identity.fields`). The relation result should declare identity once, in the host, and both tiles read it from there.

## 12. Suggested first steps

Short, and each one leaves something running.

1. **Move the data half** into `packages/pbui-datalab/src/relation/` with its tests (`graphic`, `graphic-authoring` minus views, `duckdb-*`, `analysis-coordinator`, `live`). Green tests, no UI.
2. **`host.ts` + `connect.ts` + a `table` tile** over a fixture relation, in a demo Vite app copied from plotscript's. One tile, real DuckDB, local persistence.
3. **`plot` tile** reading a `hyperslop.plot` payload and the host's result; a seeded plot document. Two tiles, one relation.
4. **`pipeline` and `sources` tiles**, adapted from datalab's panels. The core loop is closed.
5. **`plot-editor`** as its own package, first as a field/aesthetic picker over the schema.
6. **Ports** (`selection`, `datum`, `subject`, `relation.current`) written first as host cells, then replaced by PBUI-LINK-1's declarations when Phase 1–2 land.
7. **Catalog + validator entries in `datalab/`** and `PW/sync.ts` against the real server.

## 13. File reference

**datalab-ui (`DL/`)**: `model/graphic.ts:68-165, 233-282, 563` · `model/graphicAuthoring.ts:20-384` · `model/table.ts:13-46` · `analysis/{compile,runtime,ingest,normalize,browser,ports,assets,quote,types}.ts` (`types.ts:99` `AnalysisRequest`) · `appkit/analysisCoordinator.ts:27` · `appkit/AnalysisProvider.tsx:22-30` · `appkit/plotAdapter.ts:67,80,117,140,247,293` · `appkit/useRemoteWorkbench.ts:307` (`currentRemoteState`) · `appkit/registry.ts:24-70` · `apps/all.ts` · `apps/useTable.ts:21` · `apps/ChartApp/ChartApp.tsx:10-11` · `apps/InspectorApp/InspectorApp.tsx:13-14` · `store/layout.ts:305-345, 468-1033` · `store/layoutTree.ts:5-7` · `store/stages.ts:45-48` · `store/world.ts:64-74` · `store/remote.ts:27` · `store/persist.ts:34-40` · `remote/codec.ts` · `api/client.ts:423,444` · `api/workbenchStream.ts:18` · `routes.ts:31-44` · `DatalabApp.tsx:38` · `components/pages/WorkbenchInstance/WorkbenchInstance.tsx:47,108` · `vite.ts`.

**Go (`GO/`)**: `server/server.go:335-341` · `server/handlers_workbenches.go` · `workbenchapp/catalog.go:26` · `workbenchapp/documents.go:23,47` · `workbenchapp/graphic_validation.go:20`.

**protocol**: `pbui/proto/hyperslop/pbui/workbench/v1/workbench.proto:11-66, 89-216` · `PROTO/src/client/{apply,builders,ratios}.ts`.

**pbui-workbench (`PW/`)**: `apps.ts:9-12, 20-70, 95, 107` · `document.ts:27,32,123,143,158,164,174` · `types.ts:60-70, 89, 128-197` · `createWorkbench.tsx` · `verbs.ts` · `persistence.ts` · `sync.ts` · `placement.ts` · `components/{Tile/Tile.tsx,SplitPane.tsx,Launcher.tsx,WorkspaceStrip.tsx}`.

**pbui-plotscript (`PS/`)**: `document.ts:14-24, 27, 52` · `apps.tsx:19-39` · `host.ts` · `runner.ts` · `draftStore.ts` · `connect.ts` · `PlotTile/PlotTile.tsx` · `../demo/src/{workbench.ts,App.tsx}`.

**plot (`PLOT/`)**: `document.ts:67-88, 377-391` · `schema.ts:5-45` · `interactions.ts:19-58` · `identity.ts` · `stats.ts`, `stat-definitions.ts` · `react/{PlotHost,ResponsivePlot,PlotDescription}` · `README.md`.

**Guides**: workbench guide §2.4, §6.4, §10.1–10.5 · linking guide §4.9, §6.2, §6.3, §11.2, §11.3.
