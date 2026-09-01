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
