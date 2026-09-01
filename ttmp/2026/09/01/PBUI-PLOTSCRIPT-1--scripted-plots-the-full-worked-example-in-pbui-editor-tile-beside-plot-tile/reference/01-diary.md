---
Title: Diary
Ticket: PBUI-PLOTSCRIPT-1
Status: active
Topics:
    - frontend
    - pbui
    - plotting
    - design
    - architecture
DocType: reference
Intent: long-term
Owners: []
RelatedFiles:
    - Path: repo://packages/pbui-plotscript/src/PlotTile/PlotTile.tsx
      Note: ResponsivePlot over lastGood, stale chip (commit 2ff7f91)
    - Path: repo://packages/pbui-plotscript/src/ScriptTile/ScriptTile.tsx
      Note: Editor, toolbar, run pane, document write (commit 2ff7f91)
    - Path: repo://packages/pbui-plotscript/src/apps.tsx
      Note: The two descriptors (commit 2ff7f91)
    - Path: repo://packages/pbui-plotscript/src/document.ts
      Note: PlotScriptDoc as DocumentPayload (commit 126832d)
    - Path: repo://packages/pbui-plotscript/src/draftStore.ts
      Note: The editor's live text outside the document (commit 126832d)
    - Path: repo://packages/pbui-plotscript/src/runner.ts
      Note: Ticket, runCount, lastGood (commit 126832d)
    - Path: repo://packages/pbui-plotscript/src/tiles.test.tsx
      Note: Both tiles inside a real Surface (commit 2ff7f91)
    - Path: repo://packages/pbui-sandbox/src/plot/plotScript.ts
      Note: console capture inside the JSON string (commit 126832d)
ExternalSources: []
Summary: ""
LastUpdated: 2026-09-01T14:11:52.0215631-04:00
WhatFor: ""
WhenToUse: ""
---



# Diary

## Goal

Record the implementation of PBUI-PLOTSCRIPT-1 — the `@hyperslop-systems/pbui-plotscript`
package and its demo: a JavaScript editor tile beside a plot tile, both views
of one script document, run live through the plot shim from PBUI-PLOTKIT-1.

## Step 1: Scaffold `packages/pbui-plotscript` and its `demo/`

Phase 0 was already true — PBUI-PLOTKIT-1 landed in this branch an hour
earlier and every package builds in dependency order — so this step is the
package skeleton and the demo skeleton, both proven by an empty build and
typecheck before any feature code exists.

### Prompt Context

**User prompt (verbatim):** "Ok, continue"

**Assistant interpretation:** Proceed with the recommended next item, PBUI-PLOTSCRIPT-1, in the same working method as the previous ticket: plan slip, per-phase slips, diary, commits per phase, screenshots.

**Inferred user intent:** Get the runnable editor-beside-plot example that the original request was about.

**Commit (code):** b063aba — "pbui-plotscript: scaffold the package and its demo"

### What I did
- `packages/pbui-plotscript/` with `package.json` (deps: pbui, pbui-editor, pbui-sandbox, pbui-workbench, plot 0.3.1, workbench-protocol, @bufbuild/protobuf), `tsconfig*.json`, `vite.config.ts` (every dependency externalised; jsdom + the CodeMirror `Range` stubs for tests), `.storybook/` on port 6011, an empty `src/index.ts`.
- `packages/pbui-plotscript/demo/` following `packages/pbui-chat/demo`: private package, Vite on port 5175, `pbuiVite()` for React dedupe, a placeholder `main.tsx`.
- `pnpm-workspace.yaml` gains `- "packages/pbui-plotscript/demo"` (design D1: `packages/*` does not match a nested directory).
- `pnpm install`; package build and both typechecks green.

### Why
- Design D1/D2 in the ticket guide.

### What worked
- Everything on the first run; the build order lesson from PLOTKIT-1 Step 1 held.

### What didn't work
- N/A

### What I learned
- `ResponsivePlot` takes `onOutcome(outcome)` — a hook to read diagnostics out of the plot tile without re-running `renderPlot`; the plot tile will use it for its status line.

### What was tricky to build
- N/A (scaffold).

### What warrants a second pair of eyes
- `@hyperslop-systems/plot` is pinned at `0.3.1` from the registry, the same as `datalab-ui`; the local `plot/` checkout is also 0.3.1. If the local checkout moves ahead, this package will not see it until published or `link:`ed.

### What should be done in the future
- N/A

### Code review instructions
- `packages/pbui-plotscript/package.json`, `vite.config.ts`, `pnpm-workspace.yaml`.
- Validate: `pnpm --filter @hyperslop-systems/pbui-plotscript build typecheck && pnpm --filter @hyperslop-systems/pbui-plotscript-demo typecheck`.

### Technical details
- Ports: Storybook 6011, demo 5175.

## Step 2: The script document, the draft store, and the runner

Phase 2 is everything below the tiles. `document.ts` stores a script in the
workbench document as a `DocumentPayload` (D3), `draftStore.ts` holds the
editor's live text outside the document, and `runner.ts` owns a sandbox
instance per script, the debounce, a run ticket, and the last good result. One
change reached back into PBUI-PLOTKIT-1: `buildPlotScriptCode` now captures
`console` output, because the design asks the tile to show logs and the
JSON-string boundary is the only way they can ride back.

The draft store is the one structural decision the design left implicit. A
keystroke is not a document mutation: with the document as the only store,
every keystroke would be a protobuf batch and an `onMutate` call. The runner
writes the document at the moment it runs — the same moment the plot changes —
and the editor shows the draft in between, which is exactly the
`draft.source` / `loaded` split `PlaygroundTile` already uses.

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Assistant interpretation:** Build phase 2 as designed (§8, §9 D3): the `DocumentPayload` document, the store, the runner with staleness and last-good rules, log capture, and tests for each.

**Inferred user intent:** The tiles in phase 3 should be thin; the rules that make the demo pleasant to type into belong here, tested.

**Commit (code):** 126832d — "pbui-plotscript: the script document, the draft store and the runner"

### What I did
- `pbui-sandbox/src/plot/plotScript.ts`: the evaluated expression now returns `{ value, logs }`; a local `console` shadows the engine's; `PlotScriptRun` gains `logs: ScriptLog[]` on every status. Two tests added/updated; sandbox 205/205.
- `document.ts`: `PLOTSCRIPT_FORMAT = "pbui.plotscript"`, `readPlotScript`, `listPlotScripts`, `plotScriptMutation` (`documentPut`), `deletePlotScriptMutation`. Modelled on `rebalance/configDocument.ts`; id/format/version on the envelope, body `{ name, source, updatedAt }`.
- `draftStore.ts`: `createDraftStore()` with `get/set/seed/forget/subscribe` and `useDraft`.
- `runner.ts`: `createPlotScriptRunner({ engine, debounceMs, limits, onRan })` → `getState/subscribe/run/schedule/dispose/disposeAll`, `useScriptRun`. Instance id `plot-script:<id>`, loaded lazily with `PLOT_HOST_PROGRAM`.
- Tests: 4 document, 6 runner (ok; lastGood survives error and invalid; **stale run discarded**; debounce + cancel with fake timers; log capture + instance isolation; dispose/reload).

### Why
- §8.1's two rules, and D3. The stale-run test blocks the first `evaluate` behind a promise and lets the second finish first — the shape of the bug it guards against.

### What worked
- 9/10 on the first run, typecheck clean.

### What didn't work
- `round-trips through serialize/parse` failed with `expected null`: `parseDocument` refuses a document with no workspace (`doc.workspaces.length === 0 → null`), and I had built on `emptyDocument`. The test now seeds one tile with `layout(tile("plot-view"))`. A one-line fix, and a fact worth knowing: a document that is only payloads is not a workbench.

### What I learned
- `PlaygroundTile`'s draft/loaded split generalises: draft store + document-on-run is the same idea with the document as the "loaded" side.

### What was tricky to build
- **Ticket vs. runCount.** A ticket increments at run *start* (so a stale finish can be recognised); `runCount` increments at *publish* (so the plot tile can key a stale chip on "has anything been published since my lastGood"). Conflating them makes the stale test pass and the chip wrong.
- **A failed load must not poison later runs**: `ensureLoaded` deletes its cached promise on rejection.

### What warrants a second pair of eyes
- `onRan` is where the document write will hang (phase 3). It fires for every published run including failures; the tile decides whether to write only on `ok`.
- `toProgramError(error, "event")` — the phase label is a guess; the sandbox has no "evaluate" phase.

### What should be done in the future
- N/A

### Code review instructions
- `src/runner.ts` first (the ticket/runCount comment), then `src/document.ts`, then `src/runner.test.ts` "discards a stale run".
- Validate: `pnpm --filter @hyperslop-systems/pbui-plotscript test typecheck build`.

### Technical details
- Logs shape: `{ level: "log" | "info" | "warn" | "error", text }`; non-string args are `JSON.stringify`'d.

## Step 3: The script tile, the plot tile, and the first picture of the demo

Phase 3 is the two tiles and their descriptors, tested inside a real
`createWorkbench` Surface rather than in isolation — the document write, the
draft, the runner and the workbench context all have to agree for the tests
to pass, and they did on the first run. Then Storybook, and the first
screenshot of the thing this whole pair of tickets was for: a script on the
left, a scatter on the right, `7 rows · complete`.

### Prompt Context

**User prompt (verbatim):** "don't forget to take screenshots"

**Assistant interpretation:** Build phase 3 (§8, §9 D6) and capture the running tiles into the ticket as I go.

**Inferred user intent:** See the demo working, not only its tests.

**Commit (code):** 2ff7f91 — "pbui-plotscript: the script tile, the plot tile, and their app descriptors"
**Commit (code):** 506c12a — "pbui-plotscript: plot pane never scrolls; split the failing story into invalid vs throwing"

### What I did
- `host.ts`: `createPlotScriptHost({ engine?, debounceMs?, limits? })` → `{ engine, runner, drafts }`; `PLOT_BINDING = "plot"`.
- `ScriptTile/`: `CodeEditor` over the draft; toolbar `run` (`Mod+Enter`) · `auto` toggle · a status `Chip` (`not run / running… / ok / invalid result / error`) · ms/bytes/lines; a `RunPane` for the error or guard message and the console logs. Seeds the draft and runs once on first sight; **writes the document only when a run succeeds**, keyed on `runCount`.
- `PlotTile/`: `ResponsivePlot` over `lastGood`, `theme="embedded"`; a `stale` chip (`Chip state="stale"`) when the last run failed or the draft differs from what was drawn; `onOutcome` for the diagnostics count; runs the document's source itself if opened with nothing run yet, so a plot without an editor still draws.
- `apps.tsx`: `createPlotScriptApps(host)` → `plot-script` and `plot-view`, both `docBound` with `bindings: ["plot"]`, `titleFor` naming the script.
- `test-setup.ts`: a `ResizeObserver` stub reporting 640×360 so `ResponsivePlot` renders in jsdom.
- `tiles.test.tsx` (4 tests): both mount and draw; typing → debounce → good run writes the document, then a bad run keeps the SVG, marks stale, and leaves the document alone; console output reaches the pane; unbound and missing-script tiles say so.
- `Tiles.stories.tsx`: pair, plot-alone, invalid-result, throwing-script.
- Storybook on 6011; three screenshots via Playwright.

### Why
- D6 (two tiles). The "document only on success" rule keeps `PlotScriptDoc.source` equal to "what the plot shows", so a reload draws the last good plot and not a half-typed line.

### What worked
- 14/14 on the first run, typecheck clean twice. The stub `ResizeObserver` was enough for `ResponsivePlot`.

### What didn't work
- The first pair screenshot was Storybook's cold-start spinner: Vite was still bundling dependencies for a package that had never run Storybook. Waited on `rows · complete` and retook it.
- The plot pane grew a vertical scrollbar (visible in the first pair screenshot): the `AppBody` cell plus padding let a 100%-tall plot overflow by the padding. `overflow: hidden` on `.body` and `.plot`. Fixed in 506c12a.
- The story I had named "a script that throws" did not throw: `[].map(r => r.missing.x)` over an empty array returns `[]`, which is an *invalid result*, not an error. Split into `InvalidResult` and `ThrowingScript` (one row, so `.missing.x` actually dereferences `undefined`).

### What I learned
- `Chip` already has `state="stale"` — the design's stale marker cost one prop.
- **A finding for the plot package, not this one:** in the scatter, the month-7 point at 25.1 °C sits clipped at the top edge of a 5–25 axis. The linear scale's nice-ing appears to round the domain max *down* past the data max. Visible in `01-p3-editor-beside-plot.png` and `03-p3-plot-alone.png`. Not fixed here.

### What was tricky to build
- **Who runs first.** Both tiles want to run the document's source on mount so either works alone; with both open that is two runs of the same source. Each checks `runner.getState(id).status === "idle"` before running, and the runner's ticket makes a duplicate harmless anyway.
- **Stale semantics.** "Stale" is *the plot does not reflect the draft*: `draft !== lastGoodSource`, or the last run failed. Keying it on the draft store rather than the document means it appears the moment you type, which is the honest signal.

### What warrants a second pair of eyes
- The document write happens inside a `useEffect` in the script tile keyed on `runCount`. With two linked script tiles of one document, both effects fire; `documentPut` is idempotent so the second is a no-op batch, but it is still a second mutation.
- The `stale` chip title text and the empty states are my wording.

### What should be done in the future
- Report the domain-max clipping to `@hyperslop-systems/plot`.
- Map an engine error line to an `EditorDiagnostic` once an engine reports one.

### Code review instructions
- `src/ScriptTile/ScriptTile.tsx` (the two effects and their comments), `src/PlotTile/PlotTile.tsx` (`stale`), `src/tiles.test.tsx` test 2.
- Validate: `pnpm --filter @hyperslop-systems/pbui-plotscript test typecheck build`; `pnpm --filter @hyperslop-systems/pbui-plotscript storybook` (6011) → `Plotscript/Tiles`.

### Technical details
- Story ids: `plotscript-tiles--editor-beside-plot`, `--plot-alone`, `--invalid-result`, `--throwing-script`.

### Screenshots

![The demo: script tile beside plot tile over one document](./screenshots/01-p3-editor-beside-plot.png)

*Script on the left with the `ok` chip and `0 ms · 1065 bytes · 22 lines`; the scatter on the right, `7 rows · complete`. The month-7 point is clipped at the top — the plot package's domain, noted above.*

![A script returning the wrong shape](./screenshots/02-p3-failing-script.png)

*`invalid result` in the chip, the guard's sentence in the pane — "the script returned array; return { document, schema, data }" — and the plot tile explaining itself instead of blanking.*

![A plot tile with no editor open](./screenshots/03-p3-plot-alone.png)

*The plot tile alone runs the document's source itself and draws.*

![A script that throws](./screenshots/04-p3-throwing-script.png)

*The engine's own error in the pane.*
