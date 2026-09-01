# `@hyperslop-systems/pbui-plotscript`

Scripted plots for the PBUI workbench: a **JavaScript editor tile** beside a
**plot tile**, both views of one script document. You write a script against
the `@hyperslop-systems/plot` authoring API; it runs in the pbui-sandbox; the
returned `{ document, schema, data }` renders through `renderPlot`. Return a
**list** of results and the plot tile draws a grid.

```ts
import { createAppRegistry, createWorkbench, layout, split, tile } from "@hyperslop-systems/pbui-workbench";
import { applyMutations } from "@hyperslop-systems/workbench-protocol/client";
import { EXAMPLE_SCRIPTS, createPlotScriptApps, createPlotScriptHost, plotScriptMutation } from "@hyperslop-systems/pbui-plotscript";

const host = createPlotScriptHost();               // eval engine; pass createQuickJsEngine for isolation
const apps = createAppRegistry(createPlotScriptApps(host));
const initial = applyMutations(
  layout(split("row", 0.5,
    tile("plot-script", { documents: { plot: "example-v1-scatter" } }),
    tile("plot-view",   { documents: { plot: "example-v1-scatter" } }))),
  EXAMPLE_SCRIPTS.map(plotScriptMutation),
);
const wb = createWorkbench({ apps, initial });
```

## The pieces

| Thing | File | What it is |
|---|---|---|
| `PlotScriptDoc` | `src/document.ts` | a script as a `DocumentPayload` in the workbench document (`pbui.plotscript`), so it serialises, restores and syncs with the layout |
| draft store | `src/draftStore.ts` | the editor's live text, outside the document; the document holds what was last **successfully run** |
| runner | `src/runner.ts` | one sandbox instance per script, a debounce, a run ticket (a stale run never publishes), `lastGood` (a failing run never blanks the plot), captured `console` output |
| `ScriptTile` | `src/ScriptTile/` | a `CodeEditor` with run/auto, status, and an error/log pane; writes the document only when a run succeeds |
| `PlotTile` | `src/PlotTile/` | `ResponsivePlot` over the last good result; a stale chip; a grid when the script returned a list; stands alone without an editor |
| examples | `src/examples.ts` | nine seeded scripts, A–I, covering marks, statistics, positions, scales, facets, polar, annotations, configured guides and derived variables |

## Multiple plots in one tile

Two ways, deliberately different:

- **Facets** — one document, `composition.facets`: panels that share scales,
  legends and identity. The grammar's answer when panels must be comparable
  (example F).
- **A list** — `return [a, b, c]`: independent requests, each with its own
  scales, drawn as a grid, capped at 12 (examples D, E, G).

## The script contract

A script is a synchronous function body evaluated in the sandbox with the plot
authoring API in scope (`plot`, `layer`, `geom`, `stat`, `position`, `scale`,
`composition`, `value`, `variable`, `annotation`, `coordinate`, `guide`,
`transform`, `presence`, `presentation`, `algebra`). It returns
`{ document, schema, data, view? }` or a list of them. `console.log` reaches
the tile's pane, never the browser console. See
`pbui-sandbox/src/plot/` for the shim, the guard and the runner door.

## Demo

`demo/` is the reference product: one workspace per example, persisted to
`localStorage`, with a reset. `pnpm --filter @hyperslop-systems/pbui-plotscript-demo dev`
(port 5175). Storybook: port 6011.

Design and diary: `ttmp/2026/09/01/PBUI-PLOTSCRIPT-1--*/`; the editor and shim
are PBUI-PLOTKIT-1.
