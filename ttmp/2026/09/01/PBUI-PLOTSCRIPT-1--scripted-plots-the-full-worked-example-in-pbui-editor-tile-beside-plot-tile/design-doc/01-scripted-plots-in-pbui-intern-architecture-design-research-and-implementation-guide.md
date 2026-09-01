---
Title: 'Scripted plots in pbui: intern architecture, design research and implementation guide'
Ticket: PBUI-PLOTSCRIPT-1
Status: active
Topics:
    - frontend
    - pbui
    - plotting
    - design
    - architecture
DocType: design-doc
Intent: long-term
Owners: []
RelatedFiles:
    - Path: repo://packages/datalab-ui/src/apps/ChartApp/ChartApp.tsx
      Note: The plot tile this one is modelled on
    - Path: repo://packages/pbui-chat/demo/package.json
      Note: The reference-product demo pattern the example follows
    - Path: repo://packages/pbui-sandbox/src/devtools/PlaygroundTile/PlaygroundTile.tsx
      Note: The debounce-and-reload prototype the runner copies
    - Path: repo://packages/pbui-workbench/src/document.ts
      Note: LayoutSpec, tile, split and layout - how the demo workspace is built
    - Path: repo://packages/pbui-workbench/src/rebalance/configDocument.ts
      Note: The DocumentPayload pattern the script document follows
    - Path: ws://plot/src/author/index.ts
      Note: The authoring API the example scripts call
    - Path: ws://plot/src/render.ts
      Note: renderPlot, the five-stage pipeline a ScriptResult feeds
ExternalSources: []
Summary: Intern-ready tour of the plot compiler, the pbui workbench and the sandbox runtime, plus the design for a runnable pbui example where a JavaScript script written in an editor tile renders into a plot tile beside it.
LastUpdated: 2026-09-01T13:26:40.140642909-04:00
WhatFor: Teach a new engineer every part of the plot/pbui system this example touches, and specify the script contract, the runner, the two tiles and the demo workspace.
WhenToUse: Read before implementing PBUI-PLOTSCRIPT-1, or when orienting in the plot/pbui-workbench/pbui-sandbox package graph for the first time.
---



# Scripted plots in pbui

> **Who this is for.** Somebody who has never opened these repositories. Part I
> explains every part of the system, in the order you need it. Part II designs
> the feature. Part III is three worked example scripts, checked against the
> real type definitions. Part IV is the plan.
>
> **What this ticket delivers.** A runnable pbui example: a workspace with a
> **JavaScript editor tile** on the left and a **plot tile** on the right. You
> write a script against the `@hyperslop-systems/plot` authoring API; it runs in
> the sandbox; the chart re-renders.
>
> **Its dependency.** The editor component and the plot sandbox shim come from
> **PBUI-PLOTKIT-1** (`ttmp/2026/09/01/PBUI-PLOTKIT-1--*/`). Read that ticket's
> guide for the `CodeEditor` API and the shim internals; this one consumes both.
>
> **History.** This ticket began life as `DATALAB-PLOTSCRIPT-1` in the `datalab`
> repository, targeting the Datalab product. It moved here, and the target moved
> with it: the example is built **in pbui, for now**, because pbui already has
> `pbui-workbench` and Datalab does not. Datalab's cutover to the shared
> workbench is its own ticket, `DATALAB-WORKBENCH-1`, and bringing these tiles
> into the product is work that follows it.

---

# PART I — THE PARTS OF THE SYSTEM

---

## 1. The repositories

Three checkouts side by side in
`/home/manuel/workspaces/2026-09-01/add-plot-editor/`:

```
add-plot-editor/
├── go.work                  ties the two Go modules together
├── pbui/       ★ WHERE THIS TICKET'S CODE GOES
│   ├── src/                      @hyperslop-systems/pbui            the design system
│   ├── packages/
│   │   ├── pbui-workbench/       @hyperslop-systems/pbui-workbench  tiles + layout
│   │   ├── pbui-sandbox/         @hyperslop-systems/pbui-sandbox    a JS program runtime
│   │   ├── pbui-editor/          @hyperslop-systems/pbui-editor     ← NEW (PBUI-PLOTKIT-1)
│   │   ├── pbui-chat/            + its `demo/` reference product
│   │   ├── workbench-protocol/   the protobuf layout document
│   │   └── datalab-ui/           @hyperslop-systems/datalab-ui      the Datalab product
│   └── pkg/                      Go: a workbench/chat server for pbui's own demos
├── plot/       @hyperslop-systems/plot — the grammar-of-graphics compiler
└── datalab/    the Go server; its UI is nine lines that mount datalab-ui
```

### 1.1 Package dependency graph

```
        ┌──────────────────────────┐        ┌──────────────────────────┐
        │ @hyperslop-systems/plot  │        │  @hyperslop-systems/pbui │
        │  no runtime deps         │        │  no runtime deps         │
        │  pure compiler + React   │        │  design system + tokens  │
        └───────────┬──────────────┘        └──────┬──────────┬────────┘
                    │                              │          │
                    │        ┌─────────────────────┘          │
                    │        │                                │
                    │  ┌─────▼──────────────┐  ┌──────────────▼────────┐
                    │  │ pbui-workbench     │  │ pbui-editor  (NEW)    │
                    │  │ tiles, views, apps │  │ CodeMirror CodeEditor │
                    │  └─────┬──────────────┘  └──────────────┬────────┘
                    │        │                                │
                    │  ┌─────▼───────────────────┐            │
                    │  │ pbui-sandbox            │            │
                    │  │ engines, library,       │            │
                    │  │ devtools, + plot shim   │            │
                    │  └─────┬───────────────────┘            │
                    │        │                                │
                    └────────┴────────────┬───────────────────┘
                                          ▼
                          ┌───────────────────────────────┐
                          │ pbui-plotscript      (THIS)   │
                          │  script tile · plot tile ·    │
                          │  runner · demo workspace      │
                          └───────────────┬───────────────┘
                                          ▼
                              packages/pbui-plotscript/demo
                                 a runnable Vite app
```

---

## 2. `@hyperslop-systems/plot` — the grammar of graphics

*Repo:* `plot/` · *Version 0.3.1* · *Entrypoints:* `.`, `./author`, `./react`, `./styles.css`

### 2.1 What it is

A **pure compiler**. Give it four things — a `PlotDocument`, a `PlotSchema`,
`PlotData` and a `Viewport` — and it returns a renderer-neutral scene plus
diagnostics. It never fetches data, never touches Redux, never compiles SQL and
never throws for an authoring mistake: a bad document returns the deepest stage
that succeeded, plus `diagnostics`.

```
  document ──┐
  schema  ───┤
  data    ───┼──► renderPlot() ──► { grammar, plan, scene, semantics,
  viewport ──┘                        interactions, view, diagnostics }
                                              │
                                              ▼
                              <PlotHost scene={…} diagnostics={…} />  → SVG
```

### 2.2 The five stages

`renderPlot` (`plot/src/render.ts:33`) runs these in order and short-circuits at
the first that produces errors:

| # | Stage | Function | File | Produces |
|---|---|---|---|---|
| 1 | Compile | `compileGrammar(document, schema)` | `src/compile.ts` | `NormalizedGrammar`, the serialisable IR |
| 2 | Identity | `prepareDatumIdentity(schema, data)` | `src/identity.ts` | stable row identity for interactions |
| 3 | Materialise | `materializePlotData(grammar, data)` | `src/variables.ts` | variables resolved against rows |
| 4 | Plan | `planPlot(grammar, data, viewport, view)` | `src/plan.ts` | trained scales, panels, guides, geometries |
| 5 | Scene | `buildScene` + `projectSemantics` | `src/scene.ts`, `src/semantics.ts` | drawing nodes; a structured description |

Statistics (`src/stats.ts`), positions (`src/pipeline/positions.ts`), groups
(`src/pipeline/groups.ts`) and scale training (`src/pipeline/scales.ts`) all run
inside stage 4.

### 2.3 The three inputs, precisely

**`PlotSchema`** (`plot/src/schema.ts:19`) declares the fields. `id` is
identity; `column` is the property name on the row objects. They are *not* the
same thing, deliberately — a stat can rename a column without breaking every
reference to the field:

```ts
interface PlotField {
  id: FieldId;              // identity, e.g. "field:temp"
  name: string;             // human name
  label?: string;           // display override
  semanticType: "quantitative" | "nominal" | "ordinal" | "temporal";
  nullable: boolean;
  unit?: string;            // "°C", "ms" — reaches the axis through fieldLabel()
  timezone?: string;        // required in practice for temporal fields
  column: string;           // the key on each row object
}
```

**`PlotData`** (`plot/src/schema.ts:39`) is rows plus an honest statement about
whether you are looking at everything:

```ts
interface PlotData {
  rows: readonly Record<string, unknown>[];
  coverage:
    | { kind: "complete"; rowCount: number }
    | { kind: "bounded"; rowCount: number; hasMore: boolean; strategy: "head" | "latest" };
  identity?: { fields: readonly FieldId[] };
}
```

A `bounded` coverage produces a structured notice in the output, so a sample can
never silently look like a census.

**`PlotDocument`** (`plot/src/document.ts:377`) is the plot:

```ts
interface PlotDocument {
  format: "hyperslop.plot";              // literal
  version: 1;                            // literal
  id: PlotId;
  description?: string;
  variables: Record<VariableId, VariableSpec>;   // named semantic variables
  composition: CompositionSpec;                  // x/y dimensions, groups, facets
  layers: readonly LayerSpec[];                  // stat + geom + position
  scales?: ScaleMap;                             // per-channel scale overrides
  coordinate?: CoordinateSpec;                   // cartesian | transpose | polar
  presentation?: PresentationSpec;               // titles, guides, legends, frame
  annotations?: readonly AnnotationSpec[];
  limits?: RenderLimits;
  metadata?: Record<string, JsonValue>;
}
```

A `LayerSpec` (`plot/src/document.ts:199`) is the ggplot2 triple:

```ts
interface LayerSpec {
  id: LayerId;
  enabled?: boolean;
  composition?: LayerCompositionOverride;   // layer-local dimension/group overrides
  mapping?: AestheticMapping;               // color / fill / size / shape / opacity
  stat: StatSpec;                           // identity | summary | bin | regression | boxplot | density
  geom: GeomSpec;                           // point | line | bar | area | errorbar | ribbon | boxplot
  position: PositionSpec;                   // identity | stack | fill | dodge | jitter
}
```

### 2.4 The authoring API

`plot/src/author/index.ts` re-exports fourteen modules. Every function is a
**plain object constructor** — no classes, no stateful builders, no `this`.

| Namespace | File | Members |
|---|---|---|
| `plot(input)` | `author/plot.ts` | stamps `format` + `version` onto a document |
| `variable` | `author/variable.ts` | `.field(id, {label})` `.constant(v)` `.derived(expr, o)` `.unity(o)` |
| `value` | `author/value.ts` | `.variable(id)` `.afterStat(output)` `.constant(v)` |
| `composition` | `author/composition.ts` | `.cartesian({x, y, groups, facets})` `.algebra(spec)` |
| `algebra` | `author/algebra.ts` | `.variable .unity .cross .nest .blend` |
| `layer(input)` | `author/layer.ts` | identity function, for the type |
| `geom` | `author/geom.ts` | `.point .line .bar .area .errorbar .ribbon .boxplot` |
| `stat` | `author/stat.ts` | `.identity .summary .bin .regression .boxplot .density` |
| `position` | `author/position.ts` | `.identity .stack .fill .dodge .jitter` |
| `scale` | `author/scale.ts` | `.linear .log .temporal .band .categorical .colorLinear .size .shape .opacity` |
| `presentation`, `presence` | `author/presentation.ts` | `.compact({padding})`; `presence.auto/none/configured` |
| `guide`, `annotation`, `coordinate`, `transform` | same-named files | axis/legend config, reference lines, polar, derived expressions |
| presets | `author/presets/sparkline.ts` | a ready-made sparkline document |

### 2.5 Branded IDs erase at runtime — the hinge

```ts
// plot/src/document.ts:15-36
export type VariableId = string & { readonly [variableIdBrand]: true };
export function variableId(value: string): VariableId { return value as VariableId; }
export function fieldId(value: string): FieldId       { return value as FieldId; }
```

A compile-time-only cast. At runtime, the identity function on a string.
Therefore:

> A plain JavaScript program, with no TypeScript and no module loader, can
> construct a byte-identical `PlotDocument`. **The document is just JSON.**

That is why a sandboxed script can build a real plot, hand it across a
structured-clone boundary, and have the host pass it straight to `renderPlot`.
PBUI-PLOTKIT-1's shim (§4.4) is the ~140 lines that make it convenient.

### 2.6 The React host

```tsx
import { PlotHost, ResponsivePlot } from "@hyperslop-systems/plot/react";
```

- `PlotHost` (`plot/src/react/PlotHost.tsx`) renders a scene you already
  computed, plus its diagnostics.
- `ResponsivePlot` owns a `ResizeObserver` on its content box, appends the
  measured viewport to an ordinary `renderPlot` request, and renders through
  `PlotHost`. Props: `document`, `schema`, `data`, `resizeDelayMs`, `loading`,
  `renderTarget`, `emptyFallback`, `style`, `minHeight`. It ignores unusable and
  repeated dimensions, floors CSS pixels deterministically, and disconnects on
  cleanup.

The package has **no default chart minimum height**; a caller-supplied
`minHeight` is explicit layout policy.

---

## 3. `@hyperslop-systems/pbui-workbench` — tiles, views, applications

*Source:* `pbui/packages/pbui-workbench/` · *Version 0.3.1*

### 3.1 The vocabulary

```
 Workspace ──── a named binary split tree
      │
 Node ─┬─ split { direction: ROW|COLUMN, ratio, a: Node, b: Node }
       └─ leaf  { viewId }              ← a PLACEMENT: one rectangle on screen
                        │
 AppView { id, appId, documents: Record<string,string>, title? }   ← the LOGICAL view
                        │
 AppDescriptor { id, title, tone, singleton, docBound, bindings, Component }
```

- A **placement** is a rectangle; its id is a `Node.id`.
- A **view** is the logical thing shown. Two placements naming one `viewId` are
  a *linked* tile: both render from one object, which is what keeps them in
  lockstep.
- An **application** is named by `view.appId` and nothing more. Its state lives
  in the product's store, never in the tile — which is what makes swapping two
  tiles a two-field exchange.

**This is the mechanism the whole example rests on.** The script tile and the
plot tile are bound to the same document id through `view.documents`, so they
are two views of one object without either knowing about the other.

### 3.2 `AppDescriptor`

```ts
// packages/pbui-workbench/src/apps.ts
interface AppDescriptor {
  id: string;
  title: string;
  tone: string;                       // a var(--pbui-tone-*) reference, never a hex literal
  singleton: boolean;
  duplicable?: boolean;               // defaults to !singleton
  docBound?: boolean;
  bindings?: string[];                // keys a doc-bound app requires; describeWorkbench reads these
  titleFor?(view: AppView): string;
  group?: string;                     // launcher grouping
  blurb?: string;                     // one line under the title in the launcher
  available?(ctx: { workspaceId: string }): boolean;
  Component: ComponentType<{ placementId: string; view: AppView }>;
}
```

`createAppRegistry([...])` is an explicit list and throws on a duplicate id.

### 3.3 Building a layout declaratively

```ts
// packages/pbui-workbench/src/document.ts
export type LayoutSpec =
  | { kind: "tile"; appId: string; documents?: Record<string,string>; title?: string }
  | { kind: "split"; direction: "row" | "col"; ratio: number; a: LayoutSpec; b: LayoutSpec };

export function tile(appId, options?): LayoutSpec;
export function split(direction, ratio, a, b): LayoutSpec;
export function layout(spec, options?): WorkbenchDocument;
export function workspaces(specs, options?): WorkbenchDocument;
```

The comment at the top of that file is the important part:

> `layout()` turns a small spec into a `WorkbenchDocument` by issuing the same
> mutations a user would — `viewCreate` per tile, `workspaceCreate` with a tree
> assembled from the protocol's own `leafNode`/`splitNode` — and applying them
> with the shared applier. There is no second model and no hand-built document:
> whatever the applier accepts here is exactly what a server running
> `pkg/workbench` would accept.

Our demo workspace is one call:

```ts
const document = layout(
  split("row", 0.45, tile("plot-script", { documents: { plot: "demo-scatter" } }),
                     tile("plot-view",   { documents: { plot: "demo-scatter" } })),
  { name: "scripted plot" },
);
```

### 3.4 The store

`createWorkbenchStore(document, hooks)` (`src/store.ts`) is a
`useSyncExternalStore` store — not Redux — over the protobuf `WorkbenchDocument`,
plus five browser-local fields that are deliberately not serialised
(`workspaceId`, `activePlacementId`, `launcherOpen`, `launcherFrom`,
`rebalanceOpen`). Every change is a `mutate(mutations)` applied atomically;
`onMutate(mutations, next)` fires once per **committed** batch.

`createWorkbench(options)` (`src/createWorkbench.tsx:48`) assembles the registry,
the store and the verb handlers into a `Workbench` object with `perform(verb)`,
`plan(verbs)`, `applyPlan(plan)`, `serialize()`, `restore(json)` and `reset()`.

### 3.5 The verbs

Twenty-four of them (`src/verbs.ts:95`), of which we need four:

```
 tile.split · tile.close · tile.swap · tile.dock · tile.replaceWith · tile.activate
 split.resize · app.place · app.placeAt · view.setTitle
 view.open   ← open a view of an app with bindings          ★
 tile.replace · tile.link · view.rebind ← re-point a view's documents   ★
 workspace.select · workspace.create ★ · workspace.setTree · workspace.rename
 workspace.delete · workspace.clone · view.goTo
 launcher.open ★ · launcher.close · rebalance.open · rebalance.close
```

---

## 4. `@hyperslop-systems/pbui-sandbox` — the JS runtime

*Source:* `pbui/packages/pbui-sandbox/` · *Version 0.3.1*

### 4.1 What it already provides

| Thing | File | What it is |
|---|---|---|
| `ProgramEngine` | `src/engine.ts:48` | `load / render / event / evaluate / dispose / health`, all async |
| `createEvalEngine()` | `src/engines/` | `new Function` on the calling thread; no isolation, no timeouts |
| `createQuickJsEngine({worker})` | `src/quickjs.ts` | the same contracts in QuickJS in a Web Worker, with memory, stack and time limits |
| `createQuickJsDirectEngine()` | `src/quickjs.ts` | QuickJS on the calling thread, for Node and tests |
| conformance suite | `src/engines/conformance.ts` | every engine passes the same tests, `evaluate` included |
| `createProgramLibrary({key})` | `src/library.ts` | programs in `localStorage`, per-program version history, `rollback` |
| `createProgramStateStore()` | `src/state.ts` | program state keyed by view id, so linked tiles share one state |
| `createInstanceRegistry()` | `src/instances.ts` | what is running, plus one global timeline of loads/renders/events/intents/errors |
| devtools | `src/devtools/` | inspector · REPL · timeline · playground · source+versions |
| limits | `src/limits.ts` | `DEFAULT_LIMITS`, `byteLength()` |

### 4.2 The rule that governs the package

From the top of `src/contracts.ts`:

> Everything here crosses an engine boundary as JSON. No functions, no class
> instances, no host objects — that rule is what lets the same program run under
> `eval` today and QuickJS tomorrow.

### 4.3 `PlaygroundTile` — read this before designing anything

`src/devtools/PlaygroundTile/PlaygroundTile.tsx` is a working prototype of three
quarters of this feature, in 300 lines:

- a `TextArea` on one side, the live-rendered draft on the other;
- a **debounced reload**: 400 ms after the last keystroke, `loaded` follows
  `draft.source` and a version counter bumps, which changes the instance id and
  reloads exactly as a library update would;
- the draft *is* a real instance (`DRAFT_PROGRAM_ID = "draft"`), so the REPL can
  target it and the timeline records it;
- save-as-new / update / load-from, gated on
  `canSave = !tooBig && !pending && status === "ready" && meta !== null`;
- a byte budget checked against `DEFAULT_LIMITS.sourceBytes`.

The debounce-and-remount loop is the one we copy. Its `TextArea` is the thing
PBUI-PLOTKIT-1 replaces.

### 4.4 What PBUI-PLOTKIT-1 adds to it

`packages/pbui-sandbox/src/plot/`:

```ts
/** The authoring API as source, prepended to a script before evaluation. */
export const PLOT_AUTHOR_SHIM: string;

/** What a plot script must return. */
export interface ScriptResult {
  document: PlotDocument; schema: PlotSchema; data: PlotData; view?: unknown;
}

/** A structural guard that names the problem instead of throwing. */
export function checkScriptResult(value: unknown, limits?):
  | { ok: true;  result: ScriptResult }
  | { ok: false; problem: ScriptResultProblem };

/** Assemble shim + scope preamble + async body. */
export function buildPlotScriptCode(source: string, scope?: readonly string[]): string;
```

`@hyperslop-systems/plot` is a **devDependency** of `pbui-sandbox` — used only
by the shim's parity test, so the published bundle carries no plot code.

---

## 5. `@hyperslop-systems/pbui-editor` — the editor

*Source:* `pbui/packages/pbui-editor/` (new, PBUI-PLOTKIT-1)

```ts
export interface CodeEditorProps {
  value: string;
  onValueChange(value: string): void;
  accessibleName: string;                       // becomes aria-label; follows TextArea
  language?: "javascript" | "json" | "plain";
  readOnly?: boolean;
  lineNumbers?: boolean;
  diagnostics?: readonly EditorDiagnostic[];
  onRun?(value: string): void;                  // Mod+Enter
  rows?: number;
  className?: string;
}

export interface EditorDiagnostic {
  line: number; column?: number;
  severity: "error" | "warning" | "info";
  message: string;
}
```

CodeMirror 6, themed from pbui tokens, with `deleteLine` removed from the keymap
because `Mod+Shift+K` belongs to the workbench's rebalance dialog and the
workbench listens in the capture phase.

---

## 6. `@hyperslop-systems/datalab-ui` — context, not a target

*Source:* `pbui/packages/datalab-ui/` · *Version 0.1.6*

You do not have to touch this. Read it as the reference implementation of
"plot tile", because two of its files are the model for ours.

**`ChartApp`** (`src/apps/ChartApp/ChartApp.tsx`) is the whole tile, 34 lines:

```tsx
function ChartApp({ view }: AppProps) {
  const docId = view.documents.primary ?? null;
  const { doc, table, plot, loading } = useDocPlot(docId);
  return (
    <>
      <DocBar viewId={view.id} docId={docId} />
      <AppBody className={styles.body}>
        <div className={styles.plotFrame}>
          <ChartPanel plot={plot} table={table} loading={loading} docId={doc?.id ?? null} />
        </div>
      </AppBody>
    </>
  );
}
registerApp({ id: "chart", title: "chart", tone: "var(--pbui-tone-cat)",
              docBound: true, duplicable: true, singleton: false, Component: ChartApp });
```

**`ChartPanel`** (`src/components/organisms/ChartPanel/ChartPanel.tsx`) wraps
`ResponsivePlot`, adds a truncation notice, and — the interesting part — wraps
marks and legend swatches in pbui `Presentation`s through `renderTarget`, so a
datum can be right-clicked:

```tsx
const renderTarget = (record: InteractionTargetRecord, element: ReactElement) => {
  if (record.target.kind === "legend") return <Presentation svg reference={{ type: "cat", … }}>{element}</Presentation>;
  if (record.target.kind !== "mark")   return element;
  return <Presentation svg reference={{ type: "datum", value: { docId, row: record.semanticValues } }}>{element}</Presentation>;
};
```

**`plotAdapter.ts`** (`src/appkit/plotAdapter.ts`) is the worked example of
building a `PlotDocument` in TypeScript in this codebase:
`buildPlotSchema`, `buildPlotVariables`, `buildPlotComposition`,
`buildPlotLayers`, and a `grouping()` helper deciding when a colour encoding
becomes a group.

Datalab also owns the DuckDB-Wasm analysis path (`src/analysis/`), which is
where a `sql` binding would eventually come from — see §11, OQ-3.

---

# PART II — THE DESIGN

---

## 7. The feature

```
┌──────────────────────────────────────┬──────────────────────────────────────┐
│ script · monthly temperature      ⋮  │ plot · monthly temperature        ⋮  │
├──────────────────────────────────────┼──────────────────────────────────────┤
│  1  const rows = [                   │        temperature (°C)              │
│  2    { month: 1, temp:  3.2 },      │   25 ┤                          ●    │
│  3    { month: 2, temp:  4.1 },      │   20 ┤                     ●         │
│  4    { month: 3, temp:  8.7 },      │   15 ┤                ●              │
│  5  ];                               │   10 ┤           ●                   │
│  6                                   │    5 ┤  ●   ●                        │
│  7  return {                         │    0 ┼──┬───┬───┬───┬───┬───┬───┬──  │
│  8    schema: { fields: [ … ] },     │        1   2   3   4   5   6   7     │
│  9    data:   { rows, coverage: … }, │                  month               │
│ 10    document: plot({ … }),         │                                      │
│ 11  };                               │                                      │
├──────────────────────────────────────┼──────────────────────────────────────┤
│ ▸ run ⌘↵   ⟳ auto   ✓ ok   12 ms     │ 7 rows · complete                    │
└──────────────────────────────────────┴──────────────────────────────────────┘
```

- Left: the **script tile** — `CodeEditor`, a run/auto toolbar, a diagnostics
  and log pane.
- Right: the **plot tile** — `ResponsivePlot` over the script's last good result.
- Both bound to the same document id through `view.documents.plot`, so they are
  two views of one object (§3.1).
- Editing re-runs the script after a pause; a failing run leaves the last good
  plot on screen and marks it stale.

## 8. Architecture

```
┌─ SCRIPT TILE ──────────────────────────────────────────────────────────┐
│  <CodeEditor value={doc.source} onValueChange={…} diagnostics={…}      │
│              onRun={run} language="javascript" />                      │
│  toolbar: run · auto · status · duration      pane: diagnostics + logs │
└────────────────────────┬───────────────────────────────────────────────┘
                         │ source, debounced 400 ms (or Mod+Enter)
                         ▼
┌─ SCRIPT STORE (pbui-plotscript/src/store.ts) ──────────────────────────┐
│  PlotScriptDoc { id, name, source, updatedAt }                         │
│  a useSyncExternalStore store; persisted through the workbench          │
│  document's DocumentPayload map, or localStorage (Decision D3)          │
└────────────────────────┬───────────────────────────────────────────────┘
                         ▼
┌─ RUNNER (pbui-plotscript/src/runner.ts) ───────────────────────────────┐
│  code = buildPlotScriptCode(source, scope)      ← from pbui-sandbox     │
│  engine.evaluate({ instanceId, code, … })       ← ProgramEngine         │
│  checkScriptResult(value)                       ← structural guard      │
│  → ScriptRun { status, result, logs, problem, error, ms }              │
└────────────────────────┬───────────────────────────────────────────────┘
                         │ ScriptResult (pure JSON)
                         ▼
┌─ PLOT TILE ────────────────────────────────────────────────────────────┐
│  <ResponsivePlot document={r.document} schema={r.schema} data={r.data} │
│                  resizeDelayMs={80} />  → renderPlot() → SVG           │
└────────────────────────────────────────────────────────────────────────┘
```

### 8.1 The full run, as pseudocode

```
on source change (debounced) or Mod+Enter:
    runId ← next()
    set status = "running"

    code ← buildPlotScriptCode(source, scopeNames)
    try:
        { value } ← await engine.evaluate({ instanceId, code,
                                            pluginState: null,
                                            globalState: { logs: [] } })
    catch error:
        record ProgramError via toProgramError(error, "event")
        → status = "error", keep lastGood, mark plot stale
        → map error.line/column to an EditorDiagnostic if the engine gave one
        return

    checked ← checkScriptResult(value, { rows: 200_000 })
    if not checked.ok:
        → status = "invalid", show problem as a diagnostic, keep lastGood
        return

    if runId is stale: discard          ← a slower earlier run must never win
    lastGood ← checked.result
    → status = "ok", duration recorded, plot tile re-renders
```

Two details that are easy to get wrong and both have tests in §12:

- **Staleness.** A run started earlier can resolve later. Compare the run id
  before publishing; discard a stale result silently.
- **Last good.** Never blank the plot on a failed run. A syntax error appears on
  every keystroke while you are typing `cons`; a tile that clears itself each
  time is unusable.

## 9. Decision records

### D1 — a new package, `@hyperslop-systems/pbui-plotscript`

**Chosen:** `pbui/packages/pbui-plotscript/`, depending on `pbui`,
`pbui-workbench`, `pbui-sandbox`, `pbui-editor` and `plot`.

*Why.* It is the only place all five meet. Putting the tiles in `pbui-sandbox`
would give that package a hard dependency on `plot` and `pbui-editor`, which
§4.4 deliberately avoided (the shim is a devDependency precisely so the sandbox
stays light). Putting them in `pbui-editor` would make an editor package know
about grammars of graphics. A fifth small package with one clear charter matches
how this repo already splits work.

*Consequence.* `pnpm-workspace.yaml` currently reads:

```yaml
packages:
  - "."
  - "packages/*"
  - "packages/pbui-chat/demo"
```

`packages/*` picks up the new package automatically, but its `demo/` needs its
own line — exactly as `pbui-chat/demo` does. Add
`- "packages/pbui-plotscript/demo"`.

### D2 — the example is a `demo/` app, following `pbui-chat/demo`

**Chosen:** `packages/pbui-plotscript/demo/` — a private Vite app with
`workspace:^` dependencies, `pnpm dev` to run it — plus Storybook stories in the
package itself.

*Why.* `packages/pbui-chat/demo` already establishes the pattern: a private,
unpublished "reference product" that proves the package works end to end
(`@hyperslop-systems/pbui-chat-demo`, "a gold-coin shop chat"). Storybook alone
would not exercise `createWorkbench`, the launcher, or the tile chrome; a
reference product does.

### D3 — the script lives in the workbench document, as a `DocumentPayload`

**Chosen:** a `PlotScriptDoc` stored in the workbench document's
`documents` map, with `format: "pbui.plotscript"` and `schemaVersion: 1`.

*Why.* The protocol already has the slot. `WorkbenchDocument.documents` is
`map<string, DocumentPayload>` and `DocumentPayload` is
`{ id, format, schema_version, body: google.protobuf.Struct }` — a typed
envelope around arbitrary JSON. `pbui-workbench` itself uses it for the
rebalance config (`src/rebalance/configDocument.ts`,
`REBALANCE_CONFIG_FORMAT`), and Datalab uses it for its graphic documents
(`packages/datalab-ui/src/remote/codec.ts`, `format:
"datadrop.gog.document"`). Following it means `serialize()`, `restore()`, the
server's mutation endpoint and every persistence path get the script for free.

*Rejected:* `pbui-sandbox`'s `createProgramLibrary({key})`. Good store, wrong
shape — it is keyed to `ProgramRecord` (title, bindings, meta, widgets, pinned,
history) and lives in its own `localStorage` key outside the workbench document,
so a script would not survive `serialize()`/`restore()`. Keep the *idea* of
version history for phase 5.

### D4 — `ScriptResult`, not `definePlugin`

Inherited from PBUI-PLOTKIT-1 D3. Restated because it is the shape of every
example in Part III: a plot script is an async function body that returns
`{ document, schema, data }`, evaluated through `ProgramEngine.evaluate()`.

### D5 — eval engine by default; QuickJS one line away

Inherited from PBUI-PLOTKIT-1 D5. The demo passes no engine and gets
`createEvalEngine()`. The honest security statement: a user evaluating their own
code in their own tab is not a privilege escalation; the moment scripts become
**shareable**, QuickJS stops being optional.

### D6 — two apps, not one

**Chosen:** `plot-script` (the editor) and `plot-view` (the plot) are two
`AppDescriptor`s, both `docBound: true` with `bindings: ["plot"]`.

*Why.* One tile containing both panes would work and would be less code. It
would also throw away the thing the workbench is for: the user can close the
editor and keep the plot, put them in different workspaces, or open a second
plot of the same script linked to the first. `bindings: ["plot"]` is read by
`describeWorkbench` so an agent asked to "open a plot tile" is told what to bind
before it places one.

---

# PART III — WORKED EXAMPLES

These are the scripts the demo seeds. Each has been checked against the type
definitions cited in Part I.

## 10.1 Example A — a scatter plot from literal data

The smallest complete script: no data source, no SQL, no `await`.

```js
// A scatter plot of seven measurements. Everything is literal, so this script
// runs with nothing bound to the tile.
const rows = [
  { month: 1, temp:  3.2 }, { month: 2, temp:  4.1 }, { month: 3, temp:  8.7 },
  { month: 4, temp: 13.0 }, { month: 5, temp: 18.4 }, { month: 6, temp: 22.9 },
  { month: 7, temp: 25.1 },
];

return {
  schema: {
    fields: [
      { id: "field:month", name: "month", column: "month",
        semanticType: "quantitative", nullable: false },
      { id: "field:temp",  name: "temperature", column: "temp",
        semanticType: "quantitative", nullable: false, unit: "°C" },
    ],
  },

  data: { rows, coverage: { kind: "complete", rowCount: rows.length } },

  document: plot({
    id: "monthly-temperature",
    description: "Mean monthly temperature at the greenhouse sensor.",
    variables: {
      month: variable.field("field:month", { label: "Month" }),
      temp:  variable.field("field:temp",  { label: "Temperature" }),
    },
    composition: composition.cartesian({
      x: value.variable("month"),
      y: value.variable("temp"),
    }),
    layers: [
      layer({
        id: "points",
        stat: stat.identity(),
        geom: geom.point(),
        position: position.identity(),
      }),
    ],
  }),
};
```

**Reading it.** `schema.fields[].column` is the key on the row objects (`temp`);
`schema.fields[].id` is identity (`field:temp`) and is what `variable.field()`
refers to. `variables` names those fields as semantic variables the composition
and layers talk about. `composition.cartesian` puts `month` on x and `temp` on
y. The single layer is the ggplot2 triple: no statistic, point marks, no
repositioning. `unit: "°C"` reaches the axis label through `fieldLabel()`
(`plot/src/schema.ts:57`).

## 10.2 Example B — a grouped, dodged bar chart with a colour aesthetic

```js
// Mean yield per production line, split by shift.
const source = [
  { line: "A", shift: "day",   yield_kg: 41.2, qc_pass: true  },
  { line: "A", shift: "night", yield_kg: 37.8, qc_pass: true  },
  { line: "B", shift: "day",   yield_kg: 44.9, qc_pass: true  },
  { line: "B", shift: "night", yield_kg: 39.1, qc_pass: false },
  { line: "C", shift: "day",   yield_kg: 40.4, qc_pass: true  },
  { line: "C", shift: "night", yield_kg: 42.7, qc_pass: true  },
];

// Ordinary JavaScript: the script is a program, not a template.
const groups = new Map();
for (const row of source) {
  if (!row.qc_pass) continue;
  const key = `${row.line}|${row.shift}`;
  const bucket = groups.get(key) ?? { line: row.line, shift: row.shift, total: 0, n: 0 };
  bucket.total += row.yield_kg;
  bucket.n += 1;
  groups.set(key, bucket);
}
const rows = [...groups.values()].map(({ line, shift, total, n }) => ({
  line, shift, mean_yield: total / n,
}));

return {
  schema: {
    fields: [
      { id: "field:line",  name: "line",  column: "line",
        semanticType: "nominal", nullable: false },
      { id: "field:shift", name: "shift", column: "shift",
        semanticType: "nominal", nullable: false },
      { id: "field:mean",  name: "mean yield", column: "mean_yield",
        semanticType: "quantitative", nullable: false, unit: "kg" },
    ],
  },

  data: { rows, coverage: { kind: "complete", rowCount: rows.length } },

  document: plot({
    id: "yield-by-line",
    description: "Mean yield per line and shift, QC-passing runs only.",
    variables: {
      line:  variable.field("field:line",  { label: "Line" }),
      shift: variable.field("field:shift", { label: "Shift" }),
      mean:  variable.field("field:mean",  { label: "Mean yield" }),
    },
    composition: composition.cartesian({
      x: value.variable("line"),
      y: value.variable("mean"),
      groups: [value.variable("shift")],
    }),
    scales: {
      x: scale.band(),
      y: scale.linear({ zero: true }),
      color: scale.categorical(),
    },
    layers: [
      layer({
        id: "bars",
        mapping: { color: value.variable("shift") },
        stat: stat.identity(),
        geom: geom.bar(),
        position: position.dodge(),
      }),
    ],
  }),
};
```

**Reading it.** `groups` in the composition tells the compiler that `shift`
partitions the data — that is what makes `position.dodge()` produce side-by-side
bars rather than overplotted ones. `mapping.color` is the layer-local aesthetic;
`scales.color` picks the scale family. `scale.linear({ zero: true })` forces the
y axis to include zero, which a bar chart needs to be honest. And note the
middle third: this is a *program*, so grouping is a `Map` and a loop, not a
declarative aggregation the grammar has to grow a feature for.

## 10.3 Example C — two layers, a statistic, and honest coverage

```js
// Raw readings with an OLS trend line over them, from a bounded window.
const start = Date.parse("2026-08-31T00:00:00Z");
const rows = Array.from({ length: 240 }, (_, i) => ({
  ts: new Date(start + i * 6 * 60_000).toISOString(),
  humidity: 0.46 + 0.00042 * i + 0.01 * Math.sin(i / 9),
}));

return {
  schema: {
    fields: [
      { id: "field:t", name: "time",     column: "ts",
        semanticType: "temporal", nullable: false, timezone: "UTC" },
      { id: "field:v", name: "humidity", column: "humidity",
        semanticType: "quantitative", nullable: true },
    ],
  },

  // The window is the last 24 hours of a longer series: say so, and the plot
  // draws a notice rather than letting a sample look like a census.
  data: {
    rows,
    coverage: { kind: "bounded", rowCount: rows.length, hasMore: true, strategy: "latest" },
  },

  document: plot({
    id: "humidity-trend",
    variables: {
      t: variable.field("field:t", { label: "Time" }),
      v: variable.field("field:v", { label: "Humidity" }),
    },
    composition: composition.cartesian({
      x: value.variable("t"),
      y: value.variable("v"),
    }),
    scales: { x: scale.temporal(), y: scale.linear() },
    layers: [
      layer({ id: "raw",
              stat: stat.identity(),
              geom: geom.point({ size: 2 }),
              position: position.identity() }),
      layer({ id: "trend",
              stat: stat.regression({ method: "ols" }),
              geom: geom.line(),
              position: position.identity() }),
    ],
    presentation: presentation.compact({ padding: 8 }),
  }),
};
```

**Reading it.** Two layers share one composition — the layered grammar's core
move. The regression layer produces *named statistic outputs*, which a further
layer could reference with `value.afterStat("fit")`. `timezone: "UTC"` is
required for a temporal field or the formatter has no reference frame.
`coverage.kind: "bounded"` with `hasMore: true` makes the plot emit a structured
notice.

---

# PART IV — DELIVERY

---

## 11. Open questions

| # | Question | Why it matters | Proposed answer |
|---|---|---|---|
| **OQ-1** | Should the plot tile be `plot-view` here, or should it reuse a Datalab component? | Datalab's `ChartPanel` adds presentations and truncation notices we would otherwise reimplement. | Build a plain `plot-view` in `pbui-plotscript`. `ChartPanel` depends on Datalab's `Presentation` registry and `Table` model; extracting it is its own ticket. |
| **OQ-2** | One tile with two panes, or two tiles? | Fewer moving parts vs. actually using the workbench. | Two tiles (D6). |
| **OQ-3** | Does the injected scope get a `sql` binding? | DuckDB-Wasm lives in `datalab-ui`, not in pbui. | **No, not in pbui.** Literal data and computed data only. `sql` arrives when these tiles reach Datalab, after `DATALAB-WORKBENCH-1`. |
| **OQ-4** | Script parameters (`params` in scope, exposed as tile inputs)? | Turns a script into a small app. | Out of scope; note it in the README as the obvious next feature. |
| **OQ-5** | TypeScript in the editor? | Needs a worker-hosted language service — a different ticket. | JavaScript only; `@codemirror/lang-javascript` with `{ typescript: false }`. |
| **OQ-6** | Does the demo need the Go workbench server (`pbui/pkg/workbench`)? | Server persistence vs. `localStorage`. | `localStorage` only. The `DocumentPayload` choice (D3) means server persistence is later a configuration change, not a rewrite. |

## 12. Implementation plan

Each phase ends with something you can look at.

### Phase 0 — prerequisites (½ day)
- [ ] PBUI-PLOTKIT-1 phases 1–3 are merged: `pbui-editor` builds, the shim and `checkScriptResult` exist and their tests pass.
- [ ] `pnpm -r build` is green at the pbui root; `pnpm --filter @hyperslop-systems/plot build` is green in `plot/`.

### Phase 1 — package scaffold (½ day)
- [ ] `packages/pbui-plotscript/` from `packages/pbui-workbench/`'s config.
- [ ] Dependencies: `@hyperslop-systems/{pbui,pbui-workbench,pbui-sandbox,pbui-editor,plot}`; peers `react`, `react-dom`.
- [ ] Add `- "packages/pbui-plotscript/demo"` to `pnpm-workspace.yaml` (D1).

### Phase 2 — the document and the runner (1½ days)
- [ ] `src/document.ts` — `PlotScriptDoc`, `PLOTSCRIPT_FORMAT`, `PLOTSCRIPT_SCHEMA_VERSION`, and the `DocumentPayload` read/write pair, modelled on `pbui-workbench/src/rebalance/configDocument.ts`.
- [ ] `src/store.ts` — a `useSyncExternalStore` script store keyed by document id.
- [ ] `src/runner.ts` — debounce, `buildPlotScriptCode`, `engine.evaluate`, `checkScriptResult`, run-id staleness, `lastGood`, log capture, `ScriptRun`.
- [ ] Tests: success, syntax error, thrown error, timeout, oversized source, out-of-order resolution, malformed result.

### Phase 3 — the two tiles (1½ days)
- [ ] `src/ScriptTile/` — `CodeEditor` + toolbar (run · auto · status · duration) + diagnostics/logs pane.
- [ ] `src/PlotTile/` — `ResponsivePlot` over `lastGood`, a stale chip when the current run failed, an empty state before the first run.
- [ ] `src/createPlotScriptApps(host)` — returns both `AppDescriptor`s, `docBound`, `bindings: ["plot"]`.
- [ ] Stories: each tile alone, and the pair side by side in a workbench.

### Phase 4 — the demo (1 day)
- [ ] `src/examples.ts` — the three §10 scripts as seeded `PlotScriptDoc`s with versioned ids (`example-v1-scatter`, `-bars`, `-trend`).
- [ ] `demo/` — a Vite app: `createWorkbench({ apps, initial: layout(split("row", 0.45, tile("plot-script", …), tile("plot-view", …))) })`, `WorkbenchSurface`, `WorkspaceStrip`, `WorkbenchLauncher`.
- [ ] One workspace per example, so the strip is the example picker.

### Phase 5 — hardening (1 day, optional for the demo)
- [ ] Swap in `createQuickJsEngine({ worker })`; confirm the conformance promise holds for real.
- [ ] Byte and row budgets with visible counters, following `pbui-sandbox/src/limits.ts`.
- [ ] `serialize()` / `restore()` round-trip test proving scripts survive as `DocumentPayload`s.
- [ ] Script version history, modelled on `library.rollback`.

## 13. Testing

| Level | What | Where |
|---|---|---|
| Unit | `PlotScriptDoc` ↔ `DocumentPayload` round-trip, including a rejected malformed payload | `src/document.test.ts` |
| Unit | runner: ok, syntax error, thrown error, timeout, invalid result, **stale run discarded**, **lastGood retained on failure** | `src/runner.test.ts` |
| Component | script tile debounces, shows diagnostics, `Mod+Enter` runs immediately | `src/ScriptTile/ScriptTile.test.tsx` |
| Component | plot tile keeps the last good result and marks it stale on a failing run | `src/PlotTile/PlotTile.test.tsx` |
| Integration | **each of the three §10 scripts runs and produces a scene with no error diagnostics** | `src/examples.test.ts` |
| Integration | the demo layout builds and both apps resolve in the registry | `src/apps.test.ts` |
| Story | each tile; the pair in a workbench; a failing script | `*.stories.tsx` |

The integration test over the examples is the important one and it is cheap:

```ts
it.each(EXAMPLES)("%s renders a scene", async (name, source) => {
  const run = await runScript(engine, source);
  expect(run.status).toBe("ok");
  const outcome = renderPlot({ ...run.result!, viewport: { width: 640, height: 360 } });
  expect(outcome.scene).not.toBeNull();
  expect(outcome.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
});
```

## 14. File reference index

**plot**
- `src/render.ts:33` — `renderPlot` and its five stages
- `src/document.ts:15-36` — branded ids and their erasing constructors
- `src/document.ts:199` — `LayerSpec`; `:211-267` — `ScaleSpec`/`ScaleMap`; `:377` — `PlotDocument`
- `src/schema.ts:19` — `PlotField`; `:39` — `PlotData`; `:57` — `fieldLabel`
- `src/author/index.ts` and the fourteen modules beneath it
- `src/react/PlotHost.tsx` — `PlotHost`, `ResponsivePlot`
- `README.md` — the package charter

**pbui**
- `src/index.ts` — the stylesheet cascade
- `src/chrome/shortcutRouting.ts` — the chord table and `isEditableTarget`
- `src/components/atoms/` — the primitives the tiles are built from

**pbui-workbench**
- `src/apps.ts` — `AppDescriptor`, `createAppRegistry`
- `src/document.ts` — `LayoutSpec`, `tile`, `split`, `layout`, `workspaces`
- `src/store.ts` — `createWorkbenchStore` and its hooks
- `src/verbs.ts:95` — the twenty-four verbs
- `src/createWorkbench.tsx:48` — `createWorkbench`
- `src/rebalance/configDocument.ts` — the `DocumentPayload` pattern D3 follows
- `src/index.ts` — the full public surface

**pbui-sandbox**
- `README.md` — engines, hosting, devtools
- `src/contracts.ts` — the JSON-only rule
- `src/engine.ts:26` — `EvaluateInput`; `:48` — `ProgramEngine`; `toProgramError`
- `src/limits.ts` — `DEFAULT_LIMITS`
- `src/devtools/PlaygroundTile/PlaygroundTile.tsx` — the debounce-and-reload prototype
- `src/plot/` — the shim, `ScriptResult`, `checkScriptResult` (PBUI-PLOTKIT-1)

**datalab-ui (reference only)**
- `src/apps/ChartApp/ChartApp.tsx` — the 34-line chart tile
- `src/components/organisms/ChartPanel/ChartPanel.tsx` — `ResponsivePlot` + presentations
- `src/appkit/plotAdapter.ts` — building a `PlotDocument` in TypeScript
- `src/analysis/runtime.ts` — where a future `sql` binding comes from

**pbui-chat/demo**
- `packages/pbui-chat/demo/package.json` — the reference-product pattern D2 follows

**Companion tickets**
- `pbui/ttmp/2026/09/01/PBUI-PLOTKIT-1--*/` — the editor and the shim
- `datalab/ttmp/2026/09/01/DATALAB-WORKBENCH-1--*/` — Datalab's cutover, after which these tiles can reach the product
- `datalab/ttmp/2026/07/27/DATADROP-12--extensible-grammar-of-graphics-ir-visual-builder-and-fluent-javascript-api/` — the 34-section design that produced the authoring API this ticket exposes to users
