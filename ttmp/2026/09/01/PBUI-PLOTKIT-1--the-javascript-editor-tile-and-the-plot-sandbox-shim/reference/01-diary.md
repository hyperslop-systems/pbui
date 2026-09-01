---
Title: Diary
Ticket: PBUI-PLOTKIT-1
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
    - Path: repo://packages/pbui-editor/package.json
      Note: CodeMirror pins the smoke forced (commit f070334)
    - Path: repo://packages/pbui-editor/scripts/consumer-smoke.mjs
      Note: Packs four tarballs and builds a consumer (commit f070334)
    - Path: repo://packages/pbui-editor/src/CodeEditor/CodeEditor.tsx
      Note: The React/CodeMirror bridge (commit 73c99fb)
    - Path: repo://packages/pbui-editor/src/diagnostics.ts
      Note: StateField, decorations, gutter, line clamping (commit 73c99fb)
    - Path: repo://packages/pbui-editor/src/extensions.ts
      Note: pbuiKeymap minus deleteLine; runKeymap at Prec.highest (commit 73c99fb)
    - Path: repo://packages/pbui-editor/src/theme.ts
      Note: Token-only theme and highlight style (commit 73c99fb)
    - Path: repo://packages/pbui-editor/vite.config.ts
      Note: CodeMirror bundled, not externalised (commit 9bf8044)
    - Path: repo://packages/pbui-sandbox/src/bootstrap.ts
      Note: __pluginHost.evaluate is a direct eval and __describe caps arrays at 200; both shaped the runner
    - Path: repo://packages/pbui-sandbox/src/devtools/Devtools.stories.tsx
      Note: Playground and Source stories over an in-memory host (commit 7f8223d)
    - Path: repo://packages/pbui-sandbox/src/devtools/PlaygroundTile/PlaygroundTile.tsx
      Note: TextArea to CodeEditor (commit 549c325)
    - Path: repo://packages/pbui-sandbox/src/devtools/SourceTile/SourceTile.tsx
      Note: SourceListing as a read-only CodeEditor (commit 549c325)
    - Path: repo://packages/pbui-sandbox/src/plot/authorShim.test.ts
      Note: The 63-case parity test (commit e3ae012)
    - Path: repo://packages/pbui-sandbox/src/plot/authorShim.ts
      Note: The injected authoring API (commit e3ae012)
    - Path: repo://packages/pbui-sandbox/src/plot/plotScript.ts
      Note: PLOT_HOST_PROGRAM, buildPlotScriptCode, runPlotScript (commit e3ae012)
    - Path: repo://packages/pbui-sandbox/src/plot/scriptResult.ts
      Note: checkScriptResult and its problem kinds (commit e3ae012)
    - Path: repo://public/presentation-parts.css
      Note: Two of the hard-coded shadow/radius values the styling audit found
    - Path: repo://src/tokens.css
      Note: Six --pbui-syntax-* tokens added (commit 73c99fb)
ExternalSources: []
Summary: ""
LastUpdated: 2026-09-01T13:40:07.686508511-04:00
WhatFor: ""
WhenToUse: ""
---





# Diary

## Goal

Record the implementation of PBUI-PLOTKIT-1 — the `@hyperslop-systems/pbui-editor`
CodeMirror package and the plot author shim in `pbui-sandbox` — step by step,
including what failed, so a reviewer can follow the commits and a successor can
continue without re-deriving anything.

## Step 1: Scaffold `packages/pbui-editor`

The first phase creates the package skeleton and proves the toolchain end to end
before any editor code exists: an empty `src/index.ts` that imports an empty
stylesheet, built and typechecked through the same Vite library config the other
peer packages use. It exists as its own step because the one failure it hit —
the design system's `./vite` subpath not resolving — would otherwise have been
misattributed to CodeMirror.

### Prompt Context

**User prompt (verbatim):** "Implement PBUI-POTKIT-1. commit at appropriate intervals and keep a detailed diary as you work (using the diary format from the skill). Print out a brutalist work slip with the plan / different phases for the ticket. then before stsarting a phase, plrint a split about the phase, and print one when the phase is done."

**Assistant interpretation:** Implement the PBUI-PLOTKIT-1 ticket (the typo "POTKIT" refers to it) following its design doc's five phases; commit per phase; keep this diary; print a plan slip up front and a status slip at each phase boundary.

**Inferred user intent:** Land the editor package and the sandbox shim as real, reviewable code with a paper trail, so PBUI-PLOTSCRIPT-1 can start on top of it.

**Commit (code):** 9bf8044 — "pbui-editor: scaffold the package"

### What I did
- Committed the two design tickets first (`8a0706f`) so the diary has a base to refer to.
- Created `packages/pbui-editor/` with `package.json`, `tsconfig.json`, `tsconfig.build.json`, `vite.config.ts`, `.storybook/{main,preview}.ts`, `src/index.ts`, `src/styles.css`, `src/css.d.ts` — config copied from `packages/pbui-workbench/`, storybook port 6010 (6006–6009 are taken by the siblings).
- Pinned the CodeMirror dependencies at the versions `pnpm view` reported today: `@codemirror/state 6.7.2`, `view 6.43.10`, `commands 6.11.0`, `language 6.12.4`, `lang-javascript 6.2.5`, `lang-json 6.0.2`, `@lezer/highlight 1.2.3`.
- `pnpm install` at the pbui root; then `pnpm build` (root), `pnpm --filter @hyperslop-systems/workbench-protocol build`, `pnpm --filter @hyperslop-systems/pbui-workbench build`, then the new package's `pnpm build && pnpm typecheck`.

### Why
- The design (D1) puts the editor in a peer package so `@hyperslop-systems/pbui` keeps its zero-runtime-dependency property; the scaffold is the cheapest way to prove the package participates in the workspace before writing code that depends on that.
- Exact pins rather than carets because the six CodeMirror packages must agree on one `@codemirror/state`; a caret drift between them is the classic "Unrecognized extension value" failure.

### What worked
- The package was picked up by `packages/*` in `pnpm-workspace.yaml` with no config change; the empty build emits `dist/index.js`, `dist/pbui-editor.css`, `dist/index.d.ts`.

### What didn't work
- First `pnpm build` in the new package failed:
  ```
  Error [ERR_MODULE_NOT_FOUND]: Cannot find module
  '.../pbui/packages/pbui-editor/node_modules/@hyperslop-systems/pbui/dist/vite.js'
  ```
  and `pnpm typecheck` with `vite.config.ts(3,26): error TS2307: Cannot find module '@hyperslop-systems/pbui/vite'`. Cause: this checkout had never built the core package, so its `./vite` subpath (which points at `dist/vite.js`) did not exist. Fixed by building the root first.
- `pnpm --filter @hyperslop-systems/pbui build` reported `No projects matched the filters` even though that is the root package's name. Plain `pnpm build` at the root works. Not investigated further; noted so nobody loses time on it.

### What I learned
- The workspace's build order is core → protocol → workbench → everything else, and nothing enforces it. A fresh clone must run those in sequence before any peer package builds.

### What was tricky to build
- Nothing yet beyond the build-order discovery above; the scaffold is deliberately trivial.

### What warrants a second pair of eyes
- `vite.config.ts` bundles CodeMirror **into** `dist/index.js` rather than externalising it (the comment in the file says why). A reviewer who would rather externalise and rely on pnpm dedupe should say so now, before consumers exist.

### What should be done in the future
- Add a root `build:all` script, or a `pnpm -r --sort` note in the README, so the build-order requirement is written down somewhere other than this diary.

### Code review instructions
- Start at `packages/pbui-editor/package.json` and `vite.config.ts`.
- Validate: from the pbui root, `pnpm build && pnpm --filter @hyperslop-systems/workbench-protocol build && pnpm --filter @hyperslop-systems/pbui-workbench build && pnpm --filter @hyperslop-systems/pbui-editor build`.

### Technical details
- Storybook ports in use: pbui 6006, sandbox 6009, workbench 6008; editor takes 6010.

## Step 2: `CodeEditor`, the token theme, diagnostics, and the tests that found two keymap facts

Phase 2 is the editor itself: `packages/pbui-editor/src/` gains `theme.ts`,
`extensions.ts`, `diagnostics.ts`, the `CodeEditor` component with its module
CSS, stories and tests, and pbui's `src/tokens.css` gains six `--pbui-syntax-*`
tokens. The component follows the design's four-rule React↔CodeMirror bridge
and puts everything runtime-changeable behind `Compartment`s.

Two facts about CodeMirror's `defaultKeymap` shaped the code, one predicted by
the design and one found by a failing test: `Mod+Shift+K` is `deleteLine` and
had to be removed (the workbench owns it), and `Mod+Enter` is already
`insertBlankLine`, so the run chord had to be `Prec.highest` or it never fired.

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Assistant interpretation:** Build phase 2 of the ticket as the design doc specifies it (§7): the component API mirroring `TextArea`, the value-identity guard, compartments, a token theme, a diagnostics gutter, stories and tests.

**Inferred user intent:** A real, tested editor component that PBUI-PLOTSCRIPT-1 and the sandbox devtools can adopt without rediscovering CodeMirror's sharp edges.

**Commit (code):** 73c99fb — "pbui-editor: CodeEditor, token theme, diagnostics gutter, tests"

### What I did
- `src/tokens.css` (pbui core): added `--pbui-syntax-{keyword,string,number,function,property,comment}` inside the `:where(:root)` block with a comment saying why they live there; core `tokens-defined` and `styles-wiring` tests still pass (9/9); rebuilt core so `dist/` carries them.
- `src/theme.ts`: `EditorView.theme` + `HighlightStyle` reading only `var(--pbui-*)`; also the classes the diagnostics module decorates with.
- `src/extensions.ts`: `languageExtension()` for `javascript | json | plain`; `pbuiKeymap = defaultKeymap.filter(b => b.run !== deleteLine)`; `baseExtensions()`; `runKeymap()` at `Prec.highest`.
- `src/diagnostics.ts`: a `StateField` holding the list, decorations recomputed via `EditorView.decorations.compute([field, "doc"])`, a gutter with the worst severity per line, and `clampLine()` so an out-of-range line marks the last line rather than throwing.
- `src/CodeEditor/CodeEditor.tsx`: mount once in `useLayoutEffect`; `value` effect guarded by `current === value`; `language`/`readOnly`/`run` compartments; `onValueChange` and `onRun` read through refs so a new closure per render never reconfigures; `aria-label` on `contentDOM` via `EditorView.contentAttributes`.
- `CodeEditor.module.css`: geometry only; `rows` drives a `calc()` height from the theme's own font-size and line-height tokens; no `rows` → `height: 100%`.
- Stories: JavaScript by rows, read-only, diagnostics (including a clamped one), JSON, fills-container.
- Tests: 10 component tests + a `tokens-read` guard; `src/test-setup.ts` stubs `Range.getClientRects`/`getBoundingClientRect` and `document.elementFromPoint` for jsdom.
- `README.md` for the package.

### Why
- Every design decision is in the ticket's design doc §6–§7; this step implements it without deviation except the `Prec.highest` addition below.
- The `tokens-read` test exists because pbui's own token guard scans CSS only and this theme is JavaScript — the exact failure mode `tokens.css` documents would otherwise be reintroduced through the back door.

### What worked
- 11 of 12 tests passed on the first run, including the cursor-stability round trip and the identical-value-does-not-dispatch guard — the two the design flagged as "the single most common way to get this wrong".
- Typecheck clean on first run, stories included.

### What didn't work
- `Mod+Enter runs with the current document when onRun is given` failed: `expected "vi.fn()" to be called with arguments: [ '1 + 1' ] / Number of calls: 0`. First hypothesis was jsdom's `navigator.platform === ""` confusing CodeMirror's `Mod` resolution; a probe test with a bare `keymap.of([{ key: "Mod-Enter", … }])` fired fine under `ctrlKey`, so that was wrong. Actual cause: `defaultKeymap` binds `Mod-Enter` to `insertBlankLine`, and the base keymap precedes the run compartment in the extension array, so it handled the chord and returned `true`. Fix: `Prec.highest(keymap.of(...))` in `runKeymap`. 12/12 after.
- vitest hid `console.log` from the probe; surfacing values through a thrown `Error` message worked. Noted so the next person does not spend a cycle on it.

### What I learned
- Two `defaultKeymap` bindings collide with this design, not one. The design doc lists only `Mod+Shift+K`; `Mod+Enter → insertBlankLine` is the second and the README now states both.
- `EditorView.decorations.compute([field, "doc"], fn)` receives a `state`, not a `view`; `decorate()` is written against `state.doc` only and takes a `{ state }` shim.

### What was tricky to build
- **Keymap precedence.** Symptom: the run handler never called; the probe proved the binding syntax and platform were fine. Cause: facet precedence — keymaps are consulted in extension order and the first that returns `true` wins. Fix: wrap the run keymap in `Prec.highest`. The comment in `runKeymap` records it.
- **The diagnostics `RangeSetBuilder`.** It throws on out-of-order or equal-start ranges. Two diagnostics on one line at one column would have thrown at render; the module sorts by `(line, column)` and skips an equal start.
- **`rows` sizing.** CodeMirror has no `rows`; the height is `calc(rows × --pbui-fs-small × --pbui-lh-tight + padding + border)` using the same tokens the theme uses for the content, so the arithmetic matches what is drawn. If the theme's font tokens change, the CSS follows.

### What warrants a second pair of eyes
- `diagnostics.ts` decorations are recomputed on every doc change while any diagnostic exists (cheap for tile-sized scripts, unmeasured for large ones).
- The `EditorView.editable.of(!readOnly)` + `EditorState.readOnly.of(readOnly)` pair — both are needed (one blocks input, one blocks commands); a reviewer who knows a reason to set only one should say.
- `createEditorApp` (the optional workbench `AppDescriptor` factory in design §7.2) is **not built**: it is not in the task list, and PBUI-PLOTSCRIPT-1 builds its own descriptors. Deferred, not forgotten.

### What should be done in the future
- `createEditorApp` if a product on the shared workbench wants a bare editor tile.
- Storybook `build-storybook` was not run for this package (typecheck covers the stories); run it once before publishing.

### Code review instructions
- Start at `src/CodeEditor/CodeEditor.tsx` (the bridge), then `src/extensions.ts` (`pbuiKeymap`, `runKeymap`), then `src/diagnostics.ts`.
- Validate: `pnpm --filter @hyperslop-systems/pbui-editor test typecheck build`; at the root `npx vitest run src/tokens-defined.test.ts`.

### Technical details
- `dist/index.js` is 508 KB / 153 KB gzip with CodeMirror bundled (vite.config.ts explains why it is not externalised).
- Removed binding: `defaultKeymap.filter(b => b.run !== deleteLine)`; the test asserts `pbuiKeymap.some(b => b.run === deleteLine) === false`.

## Step 3: The plot author shim, the `ScriptResult` guard, and `runPlotScript` on both engines

Phase 3 adds `packages/pbui-sandbox/src/plot/`: the `@hyperslop-systems/plot`
authoring API as injectable source, a structural guard over an untrusted
result, and a runner that evaluates a script inside a one-widget host program.
Reading the engine before writing it changed the design in two ways, both
recorded in the code: the script body is synchronous, and the result crosses
the engine boundary as a JSON *string*.

The parity test is the point of the phase. Sixty-three cases, one per
exported constructor, evaluate an expression against the shim alone and
compare it with the real package's output. That is what turns a hand-copied
API into something that fails CI the day `plot` changes a field.

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Assistant interpretation:** Build phase 3 as designed (§8): shim, guard, `buildPlotScriptCode`, parity test, `plot` as a devDependency with no runtime code in the bundle, proven under both engines.

**Inferred user intent:** A sandboxed script can build a real `PlotDocument` and the host can trust the result's shape, so PBUI-PLOTSCRIPT-1 only has to wire tiles.

**Commit (code):** e3ae012 — "pbui-sandbox: the plot author shim, ScriptResult guard and runPlotScript"

### What I did
- `src/plot/authorShim.ts` — `PLOT_AUTHOR_SHIM` (a `String.raw` constant mirroring `plot/src/author/{plot,layer,variable,value,composition,geom,stat,position,scale,algebra,presentation}.ts`), `PLOT_AUTHOR_SHIM_NAMES`, `PLOT_AUTHOR_SHIM_VERSION`.
- `src/plot/scriptResult.ts` — `ScriptResult`, `ScriptResultProblem` (8 kinds), `checkScriptResult(value, limits)` returning `{ ok, result } | { ok, problem }`, `describeScriptResultProblem` for a one-line message.
- `src/plot/plotScript.ts` — `PLOT_HOST_PROGRAM`, `buildPlotScriptCode(source)`, `runPlotScript(engine, { instanceId, source, limits })` → `{ status: "ok" | "invalid" | "error", ms }`.
- Tests: `authorShim.test.ts` (63 parity cases + no-leak + no-import), `scriptResult.test.ts` (2 valid + 18 malformed + limit), `plotScript.test.ts` (7 cases × eval and QuickJS-direct, plus one for the code builder). 99 new tests; the package's full suite is 203/203.
- `@hyperslop-systems/plot@0.3.1` as a **devDependency**; `src/index.ts` re-exports `./plot`.
- Verified the built `dist/index.js` (94.8 KB) contains the shim (`hyperslop.plot` ×3) and none of the compiler (`compileGrammar|planPlot|materializePlotData` ×0).

### Why
- Design D2–D4 in the ticket guide. The shim is a string because under QuickJS there is no module loader; `plot` is a devDependency because only the parity test needs the real package.

### What worked
- All 99 tests passed on the first run, on both engines — the shim was correct as written, which is what the design's "pure object constructors over erased brands" argument predicted.
- The 1000-row test proves the JSON-string boundary carries every row.

### What didn't work
- One TypeScript error after the tests passed: `ScriptResult.view?: unknown` did not satisfy `PlotRequest.view?: PlotViewState` when the test spread a result into `renderPlot`. Fixed by importing `PlotViewState` (type-only). Also simplified an over-clever conditional type for `PlotScriptRun.result` into plain `ScriptResult`.
- A screenshot of the `WithDiagnostics` story showed **one empty line** under a status line saying "836 chars · 19 lines". Not the component: the story's `Live` wrapper spread Storybook's default `args` (`value: ""`, no-op `onValueChange`) *after* the explicit props. Fixed by spreading first. The component tests could never have caught it; the screenshot did in one look.

### What I learned
- `ProgramEngine.evaluate` is a **direct eval inside a loaded instance** (`bootstrap.ts`, `__pluginHost.evaluate`), so (a) a consumer must load a host program first and (b) the code must be an expression — a top-level `return` is a `SyntaxError`. Hence the IIFE wrapper and `PLOT_HOST_PROGRAM`.
- `__describe` (the boundary describer) truncates arrays at 200 items and objects at depth 8 — right for a REPL, wrong for plot rows. Strings pass through untouched, so the result is `JSON.stringify`'d inside the sandbox and parsed outside. This is also exactly `contracts.ts`'s JSON-only rule, applied.
- Neither engine's `evaluate` drives promise jobs, so `await` in a script body would come back as `{}`. The body is synchronous for now; the design doc's "async function body" is amended in the code comment and here. `sql` (deferred to PBUI-PLOTSCRIPT-1 OQ-3) is what will bring async with it.

### What was tricky to build
- **Scope discipline across runs.** A direct eval sees the instance's top-level declarations; without the arrow wrapper, a script's `const rows` would persist into the next evaluation and the second run's `const rows` would throw "already declared". The test "declarations do not leak into the next run" pins this.
- **Getting the error out honestly.** `runPlotScript` returns `{ status: "error", error }` with the engine's own error object (name preserved across the QuickJS boundary by `toProgramError`), so a tile can map `SyntaxError` vs `ReferenceError` vs timeout to different diagnostics.

### What warrants a second pair of eyes
- The shim omits `guide`, `annotation`, `coordinate`, `transform` on purpose (§8.1 of the guide). A reviewer who expects a script to draw a reference line today will find it missing.
- `checkScriptResult` validates only the envelope; a document with nonsense inside a layer reaches `renderPlot` and comes back as diagnostics. That is by design (renderPlot is total) but worth agreeing on.
- The 200 000-row default limit is a guess.

### What should be done in the future
- Async script bodies once an engine can drive promise jobs (needed for `sql`).
- The four omitted author namespaces, each with a parity case.

### Code review instructions
- Start at `src/plot/plotScript.ts` (the comment on `buildPlotScriptCode` states both engine facts), then `authorShim.ts` side by side with `plot/src/author/`, then `scriptResult.ts`.
- Validate: `pnpm --filter @hyperslop-systems/pbui-sandbox test typecheck build`, then `grep -c compileGrammar packages/pbui-sandbox/dist/index.js` → `0`.

### Technical details
- The evaluated code shape: `JSON.stringify((() => {<shim>\nreturn (() => {\n<source>\n})();\n})())`.
- `PLOT_HOST_PROGRAM` is a `definePlugin` with one widget whose render returns an empty text node; its only job is to exist so `evaluate` has a scope.

### Screenshots

![P2 CodeEditor with diagnostics — the story defect the screenshot caught](./screenshots/01-p2-codeeditor-with-diagnostics.png)

*The `WithDiagnostics` story before the fix: one empty line, an error marker on line 1 (every diagnostic clamped), and a status line claiming 836 characters. The editor was fine; the story overrode its own `value`.*

## Step 4: `PlaygroundTile` and `SourceTile` onto `CodeEditor`, with Storybook to see it

Phase 4 proves the editor on two real call sites in `pbui-sandbox` before
anything outside the repo depends on it. The playground's 24-row `TextArea`
becomes a container-sized `CodeEditor`; the source tile's hand-built
`<pre><ol><li>` listing with CSS-counter line numbers becomes a read-only
editor with a real gutter. Both tiles' tests were rewritten to drive the
CodeMirror view instead of a `<textarea>` change event, so they still prove the
editor → `onValueChange` → store wiring.

Because the user asked for screenshots as I go, and the sandbox package had a
`storybook` script but **no `.storybook/` directory at all**, this step also
adds one plus `src/devtools/Devtools.stories.tsx` — two stories over an
in-memory host, the same shape the tests build.

### Prompt Context

**User prompt (verbatim):** "take screenshots as you go so I can see your progress, add them to diary"

**User prompt (verbatim):** "as you go through the plots, our colleague has added a bunch of styling that is too modern for the overall look, like dropshadows and rounded corners and stuff, did you find some of that? or found in the screenshots?"

**Assistant interpretation:** Migrate the two sandbox tiles (phase 4 of the ticket); capture screenshots of the running result into the ticket and link them here; while looking at the UI, report any drop shadows / rounded corners that break the family's flat, zero-radius look.

**Inferred user intent:** See the work rather than take the tests' word for it, and use the pass through the UI to catch styling drift the rules forbid.

**Commit (code):** 549c325 — "pbui-sandbox: PlaygroundTile and SourceTile on pbui-editor's CodeEditor"
**Commit (code):** 7f8223d — "pbui-sandbox: Storybook config and devtools stories for the playground and source tiles"

### What I did
- `packages/pbui-sandbox/package.json`: `@hyperslop-systems/pbui-editor: workspace:^`; `vite.config.ts`: externalised it and added `setupFiles: ["src/test-setup.ts"]` (the same jsdom `Range`/`elementFromPoint` stubs the editor package uses).
- `PlaygroundTile.tsx`: `TextArea` → `CodeEditor language="javascript"`; the `invalid` prop had no equivalent and the status line already carries the error text, so it was dropped rather than faked. `.code { flex: 1 1 auto; min-height: 12em }` so the editor fills the column.
- `SourceTile.tsx`: `SourceListing` now renders `<CodeEditor readOnly …>` inside the same `data-part="source-listing"` wrapper; `.lines`/`.line`/`.line::before` CSS deleted.
- `packages/pbui-editor/src/index.ts`: re-exports `EditorView`, `EditorState`, `Compartment`, `Prec` — because the package bundles CodeMirror, a consumer (including a test) that needs the view class must use *this* copy.
- Tests: `typeSource(container, text)` in the playground test finds the view with `EditorView.findFromDOM` and dispatches a whole-document replace under `act`; the source test asserts the document behind the listing (`doc.lines`, `toContain("Sum: ")`, `readOnly`, `aria-label`) instead of counting `<li>`s.
- `.storybook/{main,preview}.ts` and `Devtools.stories.tsx` in the sandbox; Storybook on port 6009; four screenshots captured with Playwright into `reference/screenshots/`.
- Sandbox suite 203/203; typecheck clean; build 94.7 KB.

### Why
- The design (§10 phase 4) wants the editor proven on a real consumer before PBUI-PLOTSCRIPT-1 depends on it. These two tiles were the ones the guide named.
- Stories rather than a throwaway page: the sandbox devtools had none, and the user wants to see progress; a story is the reusable form of "let me look at it".

### What worked
- The migration itself was uneventful — three of the five initial failures were my own test-rewrite slips (below), not the tiles.
- The screenshots read as the pbui family: monochrome, hairline borders, zero radius, the six syntax tokens as the only colour.

### What didn't work
- First test run after the rewrite: 5 failures. Two causes, both mine: (1) `ReferenceError: EditorView is not defined` ×4 — my rewrite script decided the import was already present because the new `typeSource` helper *mentioned* `EditorView` above the first `describe(`; (2) `Cannot access 'view' before initialization` in the source test — my local `const view` shadowed the file's existing `view(documents)` helper. Renamed to `editorView`.
- Then one assertion failure: `expected '\ndefinePlugin(…' to be '\ndefinePlugin(…'` — I asserted the listing equals `COUNTER_PROGRAM`, but the test's current record is v3 with `"Total: "` → `"Sum: "`. The original test only checked line count and that substring; restored that intent.
- The first `Devtools.stories.tsx` threw `Error: no program prg-2` at `library.putProgram`: an explicit `id` is an *update* and ids are minted sequentially, so `prg-2` did not exist yet when I tried to seed it. Reordered to mirror the test fixture.
- A cwd drift bit twice: the shell's working directory persisted from an earlier `cd` in a parallel call, and two edits ran against the wrong root (`No such file or directory`). Every command now uses absolute paths.

### What I learned
- `library.putProgram` semantics: no `id` → create with the next sequential id; `id` given → update, and it throws if the program is missing. Worth a sentence in the library's doc comment.
- vitest resolves `@hyperslop-systems/pbui-editor` through the package's `main: dist/index.js`, so the sandbox tests need the editor **built** first. Same as its existing dependence on `pbui-workbench`'s dist; the build order from Step 1 grows by one.

### What was tricky to build
- **Testing a CodeMirror-backed tile in jsdom.** `fireEvent.change` on a `contenteditable` does nothing. The honest replacement is a dispatch on the view (a paste, effectively); reaching the view needs `EditorView.findFromDOM`, and that must come from the *bundled* copy — hence the re-export. A separately installed `@codemirror/view` would be a second instance whose `findFromDOM` still works (it reads a plain `cmView` property on the DOM node) but whose extensions would not, which is a trap for the next person.
- **Sizing.** The `TextArea` had `rows={24}`; the editor has no rows and fills its container, which means the column must be a bounded flex box. The playground's `.editor` column already was; `.code` just needed `flex: 1 1 auto`.

### What warrants a second pair of eyes
- Dropping `invalid` from the playground editor. The red dashed border is gone; the status line still says `render · RUNTIME_ERROR · …`. If the border mattered to somebody, the right fix is a diagnostic on a line, which needs the engine to report one.
- The source tile no longer has `aria-label="program source"` on the wrapper; it is on the editor's content element instead. Screen-reader users get the same name, one level deeper.

### What should be done in the future
- Stories for the other three devtools tiles (inspector, REPL, timeline) now that the sandbox has a Storybook.
- Map an engine error's line (when QuickJS reports one) to an `EditorDiagnostic` in the playground.

### Code review instructions
- Start at `PlaygroundTile.tsx` (the six-line diff), then `SourceTile.tsx` `SourceListing`, then the two test rewrites.
- Validate: build `pbui-editor` first, then `pnpm --filter @hyperslop-systems/pbui-sandbox test typecheck build`; `pnpm --filter @hyperslop-systems/pbui-sandbox storybook` (port 6009) → `Sandbox/Devtools`.

### Technical details
- Storybook ids: `sandbox-devtools--playground`, `sandbox-devtools--source`; editor: `editor-codeeditor--with-diagnostics`.

### Screenshots

![The playground tile: the draft in a CodeEditor on the left, run live on the right](./screenshots/03-p4-playground-tile-on-codeeditor.png)

*The playground after migration — `ok · main · 3 nodes · 482 bytes` in the status line, the rendered draft on the right, the six syntax tokens the only colour.*

![The source tile as a read-only CodeEditor with versions and diff](./screenshots/04-p4-source-tile-on-codeeditor.png)

*The source tile: `Counter · v2 · human`, the real gutter, and the `source / versions / diff` panes untouched.*

![P2, fixed: highlighting, gutter markers and a dashed underline on `month`](./screenshots/02-p2-codeeditor-with-diagnostics-fixed.png)

*The editor's own `WithDiagnostics` story after the story fix from Step 3: `×` on line 3 with `month` underlined at column 5, `!` on line 10, the line-400 diagnostic clamped to the last line.*

### Styling audit, answering the user's question

Nothing in the four screenshots shows a drop shadow or a rounded corner; the
editor reads only tokens and `--pbui-radius` is `0`. A grep of the shipped
stylesheets (`box-shadow|border-radius|backdrop-filter|blur|gradient|text-shadow`
across `pbui/src`, `pbui/public`, `pbui/packages/*/src`, `plot/src`, excluding
`var(--pbui-radius)` reads) found these hard-coded values — the foundation
story's own rule is *"No border-radius, anywhere. `--pbui-radius: 0` exists so
an exception must name itself"*:

| File | Line | Value | Note |
|---|---|---|---|
| `pbui/public/presentation-parts.css` | 163 | `box-shadow: 0 8px 24px rgb(0 0 0 / 0.12)` | the accept-chooser popover; a literal, no token |
| `pbui/public/presentation-parts.css` | 254–255 | `border-radius: var(--pbui-radius, 2px)`; `box-shadow: var(--pbui-shadow, 0 2px 8px rgba(31,36,48,.18))` | the context-help card; the fallbacks are the modern look, and `--pbui-shadow` is **not** defined in `tokens.css`, so the fallback is what renders |
| `pbui/public/components.css` | 46 | `border-radius: 0.25rem` | dialog close button, literal |
| `pbui/public/components.css` | 67 | `border-radius: 0.25rem` | `json-block`, literal |
| `plot/src/styles.css` | 93 | `border-radius: 0.375rem` | the diagnostics strip |
| `plot/src/styles.css` | 108 | `border-radius: 0.375rem` | loading / empty states |
| `pbui-sandbox … InspectorTile.module.css` | 45 | `border-radius: 2px` | tree rows |

Not flagged: `plot/src/styles.css:56` reads `var(--hs-plot-radius)` which
defaults to `0`; datalab's marketing page uses `box-shadow: 4px 4px 0` (a hard
offset, which is the brutalist idiom, not a blur); `RebalanceDialog` uses a
`0 0 0 1px` ring as a focus outline. Not fixed here — out of this ticket's
scope — but the two `presentation-parts.css` entries are the ones a user
actually sees on every hover, and `--pbui-shadow` being undefined is exactly
the token-fallback failure `tokens.css` documents.

## Step 5: Build order, consumer smoke, and the CodeMirror repin

Phase 5 is the "does it work for a stranger" gate: every package built in
dependency order, every affected suite run, and a consumer smoke that packs
the four tarballs a real consumer would install, installs them from the public
registry into a throwaway project, and typechecks and builds a page that mounts
a `CodeEditor`. The smoke found the one thing the monorepo could never have:
`npm` refused the CodeMirror versions I had pinned.

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Assistant interpretation:** Finish phase 5: build, smoke, and leave the package consumable by PBUI-PLOTSCRIPT-1.

**Inferred user intent:** Ship a package that installs and works outside the workspace, not only under `workspace:^`.

**Commit (code):** f070334 — "pbui-editor: consumer smoke, CodeMirror repinned to versions npm will resolve"

### What I did
- Full build in dependency order (`pnpm build` at the root → `workbench-protocol` → `pbui-workbench` → `pbui-editor` → `pbui-sandbox`); suites: editor 12/12, sandbox 203/203, core 272/272, workbench 209/210 then 1/1 (below).
- `packages/pbui-editor/scripts/consumer-smoke.mjs`, modelled on `datalab-ui`'s: packs `pbui`, `workbench-protocol`, `pbui-workbench`, `pbui-editor`; writes a consumer with `skipLibCheck: false`, a `vite-env.d.ts` (`/// <reference types="vite/client" />`), and a `main.tsx` importing `CodeEditor`, `EditorView`, both stylesheets; `npm install` → `tsc --noEmit` → `vite build`. `consumer:smoke` and `pack:check` scripts added.
- Repinned `@codemirror/state 6.7.2 → 6.7.1` and `@codemirror/view 6.43.10 → 6.43.9`.
- `tsconfig.build.json` excludes `src/test-setup.ts` (the pack listing showed `dist/test-setup.d.ts` shipping).
- Killed both Storybook tmux sessions once the screenshots were in.

### Why
- A dist that works under `workspace:^` and not from the tarball is the exact failure the sibling packages' smoke scripts exist for; a new package gets one on day one.

### What worked
- Once the two issues below were fixed: `consumer smoke: ok`, consumer bundle 603 KB / 200 KB gzip (CodeMirror + React), CSS 31.7 KB.

### What didn't work
- `pbui-workbench`'s `slate.perf.test.ts` ("every generator over 12 skewed tiles stays interactive") failed during the full run — a wall-clock guard in a package this ticket never touched, while two Storybook servers and five builds were running. Alone on a quiet machine: 1/1 in 84 ms. Load, not a regression.
- First smoke: `npm install --silent` failed with no output. Without `--silent`: `npm error notarget No matching version found for @codemirror/state@6.7.2 with a date before 8/25/2026`. `npm config get before` is `null`, no `.npmrc` sets it, no `npm_config_*` env — the cutoff's source is unknown; pnpm did not apply it, which is why the original install succeeded. Resolved by pinning to the newest versions published before that date (`npm view … time`): `state 6.7.1` (2026-07-05), `view 6.43.9` (2026-08-16). The other four were already older.
- Second smoke: `error TS2882: Cannot find module or type declarations for side-effect import of './styles.css'` from the packed `dist/index.d.ts`, plus the consumer's own two stylesheet imports. Every sibling package ships the same `import "./styles.css"` line in its d.ts; core's smoke handles it by writing `src/vite-env.d.ts` with `/// <reference types="vite/client" />` into the consumer, which declares `*.css` globally. Copied.

### What I learned
- Something on this machine gives npm a `before` date. Until its source is found, any dependency pinned with `pnpm view` can fail under `npm install`. The smoke is the guard.
- The `styles.css` side-effect import in a package's d.ts is a known shape here, handled on the consumer side by `vite/client` types rather than by a typed CSS export like `plot`'s `styles-export.ts`. Either would do; this package follows its siblings.

### What was tricky to build
- Nothing in the code; the phase was diagnosis. The `--silent` flag on `npm install` cost one cycle by hiding the only useful line — the sibling smokes use it too and would hide the same failure.

### What warrants a second pair of eyes
- The CodeMirror repin. `6.7.1`/`6.43.9` vs `6.7.2`/`6.43.10` is a patch-level difference; a reviewer who knows why the cutoff exists should confirm it is the policy and not an accident.
- The smoke is not wired into CI for this package. The siblings' `consumer:smoke` scripts are invoked by a publish workflow; this one should join it.

### What should be done in the future
- Drop `--silent` from the sibling smoke scripts' `npm install`, or make the failure visible another way.
- Find the `before` cutoff's source and write it down in the repo.

### Code review instructions
- `packages/pbui-editor/scripts/consumer-smoke.mjs`; `package.json` dependency pins.
- Validate: `pnpm --filter @hyperslop-systems/pbui-editor consumer:smoke` (needs network access to `registry.npmjs.org`).

### Technical details
- Ticket totals: 5 phases, 8 code commits, 4 screenshots, tests added: editor 12, sandbox +99 (203 total).
- Deliverables for PBUI-PLOTSCRIPT-1: `@hyperslop-systems/pbui-editor` (`CodeEditor`, `EditorDiagnostic`, `EditorView` re-export) and `@hyperslop-systems/pbui-sandbox`'s `PLOT_AUTHOR_SHIM`, `PLOT_HOST_PROGRAM`, `buildPlotScriptCode`, `runPlotScript`, `checkScriptResult`.
