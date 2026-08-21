---
Title: Diary
Ticket: PBUI-SANDBOX-1
Status: active
Topics:
    - pbui
    - chat
    - frontend
    - onboarding
DocType: reference
Intent: long-term
Owners: []
RelatedFiles:
    - Path: repo://packages/pbui-chat/demo/src/workbench.ts
      Note: sandboxHost built once; createScriptApp(host) (commit 62bf01a)
    - Path: repo://packages/pbui-chat/test/no-raw-controls.test.ts
      Note: The structural rules every devtool must satisfy (TextArea, SelectInput, CheckboxRow from pbui)
    - Path: repo://packages/pbui-sandbox/src/bootstrap.ts
      Note: evaluate via direct eval; __describe (commit a57e818)
    - Path: repo://packages/pbui-sandbox/src/devtools/InspectorTile/InspectorTile.tsx
      Note: Inspector tile, chooseInstance (commit 850089b)
    - Path: repo://packages/pbui-sandbox/src/devtools/InspectorTile/TreeOutline.tsx
      Note: outlineRows/summariseNode, fire controls (commit 850089b)
    - Path: repo://packages/pbui-sandbox/src/devtools/ReplTile/ReplTile.tsx
      Note: The REPL tile (commit a57e818)
    - Path: repo://packages/pbui-sandbox/src/devtools/createSandboxDevtools.tsx
      Note: The devtools factory; sets host.devtools (commit 850089b)
    - Path: repo://packages/pbui-sandbox/src/engines/conformance.ts
      Note: evaluate cases both engines must pass (commit a57e818)
    - Path: repo://packages/pbui-sandbox/src/engines/evalEngine.ts
      Note: The single-Function closure is why a direct eval in the bootstrap can reach the program (D3)
    - Path: repo://packages/pbui-sandbox/src/host/hostOptions.ts
      Note: SandboxHost — the one options object (commit 62bf01a)
    - Path: repo://packages/pbui-sandbox/src/host/useProgramInstance.ts
      Note: Read in full before the design; the log, effects and instance id rules shaped D1, D2 and D11
    - Path: repo://packages/pbui-sandbox/src/instances.ts
      Note: Registry, timeline ring, selection, formatEntry (commit 62bf01a)
    - Path: repo://packages/pbui-sandbox/src/quickjs/runtimeService.ts
      Note: evalCode strings per call; the same pattern carries `evaluate`
    - Path: repo://packages/pbui-workbench/src/apps.ts
      Note: docBound/singleton semantics decided which tiles are which (D12)
ExternalSources: []
Summary: Chronological record of PBUI-SANDBOX-1 — the suggestion that became the ticket, the evidence gathered from the sandbox package and the workbench, the design decisions, and (as they happen) each implementation phase with its failures verbatim.
LastUpdated: 2026-08-21T16:10:00-04:00
WhatFor: Continuation and review; read this to know what was tried, what broke, and why the design is shaped as it is.
WhenToUse: When resuming a phase, reviewing a commit, or wondering why something is the way it is.
---




# Diary

## Goal

Record how the sandbox devtools — the instance registry and the five tiles (Inspector, REPL, Timeline, Playground, Source & Versions) — were designed and built on top of `PBUI-AGENT-3`, including every failure and the reasoning behind each decision.

## Step 1: From a suggestion list to a ticket and a guide

The user asked, after the AGENT-3 close-out, for a suggestion of tiles that would support the generative-tile feature; I proposed eight, with ASCII mockups. They chose five — the Inspector, a REPL that injects into a selected sandbox, the Timeline, the Playground and Source & Versions — and asked for a new ticket with an intern-level guide, uploaded to the reMarkable, then an implementation with work slips per phase. This step is the ticket, the evidence pass, and the guide.

The evidence pass re-read the whole of `useProgramInstance.ts`, `ScriptTile.tsx`, `library.ts`, `bootstrap.ts`, both engines, the worker protocol, `sandboxTools.ts`'s `check()` and `sandbox_describe`, the workbench's `apps.ts` and verbs, the demo's `sandbox.ts`/`workbench.ts`/`App.tsx`, the trace panel, the structural tests, and the pbui atoms available (`TextArea code`, `JsonBlock`, `DiffHunk`, `ResultLog`, `CodeLine`, `SelectInput`, `CheckboxRow`). Two facts from that pass decided the two non-obvious parts of the design: the eval engine keeps the bootstrap and the program in one `new Function` scope, and QuickJS evaluates every later `evalCode` in the same global lexical scope — so a direct `eval` *inside the bootstrap* gives both engines the same REPL scope without any engine-specific code (D3). And `ProgramRecord.putProgram` overwrites `source`, so versions need a `history` field on the record, with rollback as an ordinary update (D6).

### Prompt Context

**User prompt (verbatim):** "Create a new docmgr ticket and Create  a detailed analysis / design / implementation guide that is for a new intern, explaining all the parts of the system needed to understand what it is, with prose paragraphs and bullet point sand pseudocode and diagrams and api references and file references. It should be very clear and technical. Store in the ticket and the nupload to remarkable.


We want 1, a REPL tile to inject into a selected sandbox, 2, 4, 5.

SInce we are a greenfield projec,t you are welcome to modify anythiing you want to have cleaner and effective code. 

commit at appropriate intervals and keep a detailed diary as you work (using the diary format from the skill)

Once the design guide and the phases/tasks are written, print out an overview brutalist work slip, and then for each phase, print a slip up front, so I can track where you are at, and one at the end when you are done witha write up. Then do the same for the nex tphase"

**Assistant interpretation:** Open `PBUI-SANDBOX-1`; write an intern guide covering the system as it is, the gap, the design (registry, `evaluate`, five tiles) and a phased plan; upload it; then implement phase by phase with a plan slip first and start/end slips per phase, committing and keeping this diary throughout. "Greenfield" licenses refactors (one `SandboxHost` options type, removing the hook's string log, moving the dry run if useful).

**Inferred user intent:** Make agent-written programs debuggable and editable by a human from inside the workbench — see state, poke at it, replay events, draft by hand, diff versions — using the same tile model and atoms as everything else, and have a kanban-visible trail of the work.

**Commit (code):** none yet — docs only in this step.

### What I did

- `docmgr ticket create-ticket --ticket PBUI-SANDBOX-1 …`; `docmgr doc add` for the guide (design-doc) and this diary (reference).
- Read the files listed in RelatedFiles plus `contracts.ts`, `state.ts`, `createScriptApp.tsx`, `UINodeRenderer.tsx`, `protocol.ts`, `worker.ts`, `workerEngine.ts`, `directEngine.ts`, `createPbuiChat.tsx` (attachSandbox), `demo/src/chat.ts` (`program.open` handler), `demo/src/App.tsx` (launcher rows), `TracePanel.tsx`, vm-system's `redux-adapter/store.ts` (`DispatchTimelineEntry`), and the pbui atom signatures.
- Wrote the guide: §1 five scenes, §2 the system with line anchors, §3 gap table, §4 design with D1–D12, §5 six phases with files/tests/acceptance, §6 sequences, §7 R1–R14, §8 testing, §9–§10 references, §11 open questions.
- Wrote `index.md`; added eight tasks (phases 0–6 and the slips).

### Why

- The guide is the contract for the phases; the user wants an intern to be able to build from it, so every design choice names the file and line that motivated it.
- The registry comes first because four of the five tiles cannot exist without it and the fifth (Source & Versions) wants it for "showing in N tiles".

### What worked

- The design fits the existing app model without touching `pbui-workbench`: doc-bound apps for "inspect prg-3" and "source of prg-3", singletons for the REPL, timeline and playground; de-dup and `titleFor` come free.
- The REPL needs no engine-specific scope code once `evaluate` lives in the bootstrap.

### What didn't work

- N/A for this step (no code yet). One tooling note: `rg -l "no-raw-controls" --glob "*no-raw-controls*.test.ts"` returned nothing because the file name already is the pattern; `ls packages/pbui-chat/test` found it.

### What I learned

- `UINodeRenderer` already computes the per-node key `root.0.2` that the inspector's outline needs; paths cost one attribute (D10).
- `ResultLog`, `DiffHunk`, `JsonBlock` and `TextArea code` exist in pbui, so no devtool needs a raw control or a new atom.
- vm-system's `DispatchTimelineEntry` is `{dispatchId, timestamp, scope, actionType, instanceId, domain, outcome, reason}`; the registry's entry keeps its spirit (one global ordered ring with outcomes) and adds durations and the non-dispatch kinds (load, render, error, evaluate).

### What was tricky to build

- Choosing where the selection lives. A React context would have tied the REPL to being under the same provider as the tiles, which is true in the demo but not a property of the app model; putting `selectedViewId` in the registry store means any tile anywhere can read it (D1).
- Deciding that the playground runs a live instance rather than calling the tools' `check()`. The dry run is the model's contract; a human wants to click. Running the draft under `useProgramInstance` with a synthetic record makes the draft appear in the registry, which gives REPL and timeline access for free (D4).

### What warrants a second pair of eyes

- D3: direct `eval` under `"use strict"` can read but not declare; confirm that is acceptable for the REPL (R4) and that `__describe`'s depth/length caps do not hide what a user needs.
- D6/R9: `history` on the record against the 1 MiB library limit; `historyDepth: 10` default.
- D9: rollback, state edits and injections are not verbs and do not reach the trace.

### What should be done in the future

- Upload the guide and this diary to the reMarkable; print the overview slip; start Phase 0 with its start slip.

### Code review instructions

- Read `design-doc/01-…md` §4.1, §4.3 and §4.12 first; then §5 Phase 0.
- `docmgr doctor --ticket PBUI-SANDBOX-1 --stale-after 30` must be clean.

### Technical details

- Ticket path: `ttmp/2026/08/21/PBUI-SANDBOX-1--sandbox-devtools-inspector-repl-timeline-playground-and-versions-tiles/`.
- Base commit of the evidence: `d2c5b2c` (AGENT-3 close-out).

## Step 2: Phase 0 — the registry, the host object, the hook that publishes

Phase 0 is the machinery every tile stands on. `createInstanceRegistry` keeps one snapshot per view (placements, program, version, instance id, status, meta, trees, error, timings, a control handle, a highlight path), one global timeline ring of structured entries, and the selected sandbox. `useProgramInstance` now takes the registry, measures each engine call with `performance.now()`, records load/render/event/intent/error/note entries, publishes after every effect, and registers a handle (`fire`, `reset`, `rerender`) once per mount through refs. Its string log is gone (D2); the script tile's details disclosure filters the timeline by view id and formats it with the same `formatEntry` the Timeline tile will use.

The script tile takes one `SandboxHost` object instead of eight options, selects its view on focus or click, and shows *inspect*/*source* buttons only when `host.devtools` is set (so they never dangle in a product without devtools). The renderer stamps `data-node-path` on every node wrapper and marks the `highlightPath` with `data-highlighted`, which the CSS module outlines through the focus-ring tokens. The demo builds `sandboxHost` once in `workbench.ts`.

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Assistant interpretation:** Build the prerequisite from guide §5 Phase 0, verify it in the browser, commit.

**Inferred user intent:** A foundation the five tiles can be built on without touching the hook again.

**Commit (code):** 62bf01a — "PBUI-SANDBOX-1 Phase 0: instance registry (timeline ring, selection, handles), SandboxHost, hook timings, renderer node paths + highlight"

### What I did

- New `src/instances.ts` (registry, `useInstances`, `formatEntry`, `EMPTY_TIMINGS`) and `src/host/hostOptions.ts` (`SandboxHost`).
- Rewrote `useProgramInstance.ts`: `instances` option, timings, structured records, `rerender()` via a tick the render effect depends on, a handle effect, `treesRef` so an unchanged tree keeps its identity in both the hook state and the registry.
- Rewrote `ScriptTile.tsx` (host object, `ProgramLog` and `DevtoolButtons` as separate components, `askToFix` through `host.askAgent`) and `createScriptApp(host, options)`.
- Renderer: `wrap()` puts every node — root included — in the path-carrying span; `highlightPath` prop; `walkNodes` in `validate/uiSchema.ts`.
- Tests: `instances.test.ts` (4 registry tests + 8 `formatEntry` cases), hook tests updated to assert registry contents and a new handle/unmount test, renderer paths/highlight test. `pnpm test`: 67 in pbui-sandbox; pbui-chat 110 (structural scans included).
- Demo: `instances` exported from `sandbox.ts` and on `window.__pbuiDemo`; `sandboxHost` in `workbench.ts`.
- Browser: rebuilt `pbui-chat` and the demo, restarted `make chat-serve` (the old tmux session was gone; started a new `pbui-chat` session), opened *Minimal Counter* from the launcher, clicked `+`: the registry showed `{status: "ready", timings: {loadMs: 51.6, renders: 2, events: 1}}`, selection = that view, paths `root, root.0, root.1, root.1.0, root.1.1`, timeline `load → render → event → intent applied → render`. From the console: `handle.fire` incremented, `publish({highlight: "root.1.0"})` marked the `+` button, `handle.reset()` returned the state to 0. Screenshot `various/01-p0-registry-and-highlight.png`.

### Why

- Every devtool needs the same facts; one store with one subscription model (`useSyncExternalStore`, like the library) is the smallest thing that gives them to tiles that are not each other's ancestors.
- A registry that re-notified on unchanged trees would make the inspector re-render on every program render; hence `publish` compares by identity and the hook only hands it a new `trees` object when the content changed.

### What worked

- The busy-loop regression test from AGENT-3 still passes with the registry in the loop: publishing from effects and callbacks only, never during render, kept the settle property.
- `data-node-path` cost one wrapper function; the existing React keys were already the paths.

### What didn't work

- `type TimelineEntryInput = Omit<TimelineEntry, "seq" | "at">` collapsed the union: every `record({kind: "render", …})` failed with `'durationMs' does not exist in type 'TimelineEntryInput'`. Spelled it as `{head} & TimelineEntryBody` instead.
- A test asserted the timeline's last entry after a click was the `intent`; it is the `render` the applied intent caused. The assertion now checks the last two kinds are `["intent", "render"]`.
- `formatEntry` for `evaluate` JSON-quoted the code (`"1 + 1" → 2`); code is shown verbatim, whitespace collapsed, truncated at 60.
- The first `pnpm typecheck` also flagged `Cannot redeclare block-scoped variable 'instances'` in the update test, which already used that name for `engine.health().instances` — renamed to `engineInstances`.
- `tmux send-keys -t pbui-chat` reported `can't find pane` / `can't find session` even though `tmux ls` had listed it moments before; a fresh `tmux new-session -d -s pbui-chat "make chat-serve"` worked.

### What I learned

- Two linked placements of one view run two engine instances (each `ScriptTile` mounts its own hook), sharing state through the view-keyed store. The registry is keyed by view, so its `instanceId` and `handle` are whichever placement published last — equivalent instances, so any handle drives the view's state correctly, but the inspector's "instance id" is one of two. Recorded as a known property rather than changed: making one hook serve two placements would need the hook to move out of the tile.
- React 18 batches `setState` from async callbacks, so the earlier idea of reading a functional updater's result synchronously after `setTrees` was unsafe; a `treesRef` mirror is the honest version.

### What was tricky to build

- **Handle identity.** The handle must be stable (one `publish`) but call the latest `onEvent`/`reset`, which change with `meta` and `globalState`. Refs updated every render plus one effect keyed on `[instances, viewId, rerender]` does it; the cleanup only nulls the handle if it is still ours, so a second placement's handle survives the first's unmount.
- **Unchanged trees, twice.** The hook previously compared inside a functional `setTrees` updater. The registry needs the same decision outside React's batching, so the comparison moved to `treesRef` and both the state and the registry receive the same object.

### What warrants a second pair of eyes

- `publish` compares patch fields with `Object.is`; a caller passing a fresh `timings` object every time (as `bumpTimings` does) always notifies — intended, since timings changed, but worth knowing when reading subscriber counts.
- The timeline ring's `keep` of 500 with `intents` arrays and `args` kept by reference: a program that emits large payloads holds them alive until they scroll out.

### What should be done in the future

- Phase 1: the Inspector tile and `createSandboxDevtools`, which sets `host.devtools`.

### Code review instructions

- Start at `src/instances.ts` (`publish`, `record`, `unmount`), then `useProgramInstance.ts` (`bumpTimings`, the handle effect, `treesRef`), then `ScriptTile.tsx` (`ProgramLog`, `DevtoolButtons`).
- `pnpm --filter @hyperslop-systems/pbui-sandbox test`; `pnpm --filter @hyperslop-systems/pbui-chat test`; in the demo, `__pbuiDemo.instances.all()` after opening a program tile.

### Technical details

```ts
// the registry's door for devtools, as published by the hook
instances.get(viewId)?.handle?.fire("main", { handler: "increment" });
instances.publish(viewId, { highlight: "root.1.0" });   // the tile outlines that node
instances.timeline().filter((e) => e.viewId === viewId).map(formatEntry);
```

## Step 3: Phase 1 — the Program Inspector

The inspector is the first tile on the registry. It is doc-bound to `program` with an optional `view` binding, chooses which instance to show by `chosen → wanted view → selected sandbox → latest` (`chooseInstance`, a pure function with its own test), and has four panes behind pressed buttons: *state* (a `JsonBlock` over a `TextArea code` editor with apply/discard/reset), *bindings* (every declared or bound key with the product's own `<Presentation>` for a resolved reference, `unresolved` in the danger tone otherwise, plus `env`), *tree* (one outline per widget from `walkNodes`, each row kind + summary + a *fire* control that sends what the renderer would — `{ value }` for a change — and hover publishing `highlight`), and *meta* (instance id, engine, placements, timings, the error, the loaded meta).

The snapshot gained `globalState` (published by the render effect) because the bindings pane needs the resolved documents the program saw, and the REPL will need the same object for `$global`. `createSandboxDevtools(host)` registers the inspector (more tiles join it in later phases) and sets `host.devtools = true`, which is what makes the script tile's *inspect*/*source* buttons appear — the same host object must be passed to both factories, stated in the doc comment.

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Assistant interpretation:** Guide §5 Phase 1.

**Inferred user intent:** Scene 1 — see and change a running program's state, see what it rendered, fire a handler, know what it was bound to.

**Commit (code):** 850089b — "PBUI-SANDBOX-1 Phase 1: Program Inspector tile (state editor, bindings, tree outline with highlight and fire, meta/timings), createSandboxDevtools"

### What I did

- `src/devtools/InspectorTile/{InspectorTile,TreeOutline,StatePane}.tsx` + CSS module; `src/devtools/createSandboxDevtools.tsx`; `src/devtools/index.ts` re-exported from the package index.
- `InstanceSnapshot.globalState`; the hook publishes it with the trees.
- Tests: `InspectorTile.test.tsx` mounts a real `ScriptTile` and the inspector on one host — outline paths, fire, hover → highlight in the program tile, apply/invalid/reset state, bindings with a resolved `product`, meta facts, the not-running state, `chooseInstance` order. 71 tests in the package; chat 110; all builds.
- Demo: `devtoolApps = createSandboxDevtools(sandboxHost)` registered after `scriptApp`.
- Browser: from the counter tile's *inspect* button, an inspector opened beside it; the tree pane listed `root column · root.0 text "Count: 0" · root.1 row · root.1.0 button "-" onClick→decrement · root.1.1 button "+"`, hovering `root.1.0` outlined the `-` button in the program tile, *fire increment* set the state to 1. Screenshot `various/02-p1-inspector.png`.

### Why

- Panes rather than a stacked page: the inspector is opened *beside* a program tile, in a third of a column; four stacked sections would not fit.
- `chooseInstance` as a pure function: the precedence is the one piece of policy in the tile and deserves a table test.

### What worked

- Everything the panes show was already in the registry after Phase 0 except `globalState`; the tile is mostly presentation.
- The hover highlight crossed from the inspector to the program tile with no DOM queries: publish a path, the tile's renderer marks it.

### What didn't work

- The second test failed only when run after the first: `vitest` without `globals: true` does not auto-cleanup `@testing-library/react`, so the first test's tiles were still mounted and `getByRole("button", {name: "bindings"})` matched two. Fixed with `afterEach(cleanup)` and a comment; the other test files in the package query within their own `container`, which is why they never hit it.

### What I learned

- `Button` has a `selected` prop, which is what a pane switch needs; no segmented atom required.
- `JSON.stringify(node.text)` as the summary makes whitespace and quotes visible in the outline — worth keeping over raw text.

### What was tricky to build

- **Editor that follows the live state until touched.** The state pane must show changes the program makes (a click in the tile) but must not overwrite what the user is typing. A `dirty` flag set when the draft differs from the live JSON, cleared on apply/discard, and an effect that copies the live JSON in only while not dirty.
- **What "fire" sends.** The renderer sends `{ value }` for inputs and selects and `ref.args` for buttons; the outline's fire control mirrors that so a fired event is indistinguishable from a real one in the timeline.

### What warrants a second pair of eyes

- `host.devtools = true` mutates the caller's object inside a factory. It is documented, and the alternative (a second host object) would split what the script tile and the devtools see.
- The bindings pane renders `reference.value` as JSON beside the presentation — a large value (an order with lines) is a long block; `maxHeight` caps it.

### What should be done in the future

- Phase 2: `evaluate` in the bootstrap, both engines, the worker protocol, conformance cases, and the REPL tile.

### Code review instructions

- `InspectorTile.tsx` top to bottom, then `TreeOutline.tsx` (`outlineRows`, `FireControl`), then the test.
- `pnpm --filter @hyperslop-systems/pbui-sandbox test`; in the demo, open a program tile and press *inspect*.

### Technical details

- App id `program-inspector`, bindings `["program"]`, optional `view`; opened by the script tile with `openView(INSPECTOR_APP_ID, { program, view }, { near: placementId })`.

## Step 4: Phase 2 — `evaluate`, and the REPL into the selected sandbox

The REPL needed one new door through the engine boundary, and the guide's D3 put it in the bootstrap rather than in either engine: `__pluginHost.evaluate(code, pluginState, globalState)` binds `$plugin`, `$ui`, `$state`, `$global`, `$widget`, `$render`, `$event` as locals and runs a *direct* `eval(code)`, so the line sees those, the bootstrap's `__plugin`/`__ui`, and the program's own top-level declarations — under `new Function` (one closure) and under QuickJS (one global lexical scope) alike. The result goes through `__describe`, which passes JSON and replaces what JSON cannot carry with `{ $type }` markers (`undefined`, `function` with its text, `cyclic`, `deep`, non-finite numbers, `error` with name and message). Each engine's `evaluate` is a few lines: the eval engine clones in and out; QuickJS builds an `evalCode` string under a new `evaluateMs` limit (1 s), so the interrupt handler applies; the worker protocol gained one request.

The REPL tile is a singleton that follows the selected sandbox (a checkbox unpins it, a select picks any running instance), runs a line on Enter, walks history with the arrow keys, and shows each result as `JsonBlock` — or, for a `UINode`, with a *render here* toggle that draws it with the real renderer. A plain-object result offers *set as state*; an intents array (from `$event`) offers *apply intents*, which runs the host's reducer and `perform` exactly as a real event would and records `intent` entries tagged "from the REPL". *re-render* calls the handle after an injection. Every line is an `evaluate` timeline entry with a one-line summary.

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Assistant interpretation:** Guide §5 Phase 2; "a REPL tile to inject into a selected sandbox".

**Inferred user intent:** Poke at a running program's objects and patch them live, with the same reach under both engines and nothing new exposed to the model.

**Commit (code):** a57e818 — "PBUI-SANDBOX-1 Phase 2: ProgramEngine.evaluate via the bootstrap (direct eval, $plugin/$ui/$state/$global/$render/$event, __describe), both engines + worker protocol, conformance cases; REPL tile"

### What I did

- `bootstrap.ts`: `__describe`, `evaluate`, `BOOTSTRAP_VERSION = 2`. `engine.ts`: `EvaluateInput`/`EvaluateResult`, `evaluate` on `ProgramEngine`. `limits.ts`: `evaluateMs`. `evalEngine.ts`, `quickjs/{runtimeService,protocol,worker,workerEngine,directEngine}.ts`: the method and the request.
- `engines/conformance.ts`: five `evaluate` cases (helpers and state; `$render`/`$event`; an injection that changes a later `event`; the markers and copy semantics; thrown errors keep their names incl. `SyntaxError` and a `ReferenceError` for `fetch`). `quickjs/conformance.test.ts`: `while (true) {}` at the REPL rejects with `InternalError` under `evaluateMs: 50`.
- `devtools/ReplTile/{ReplTile.tsx, ReplTile.module.css, ReplTile.test.tsx}`; registered as `sandbox-repl` (singleton) in `createSandboxDevtools`; exports.
- 86 tests in the package (eval and QuickJS conformance both run the new cases); chat 110; all builds.
- Browser, QuickJS worker: opened the REPL from the launcher, clicked the counter tile (selection), ran `$state` → `{value: 0}`, `$global.system` → `{engine: "quickjs", version: 1}`, injected `$plugin.widgets.main.handlers.increment = (c) => c.dispatchPluginAction("state/merge", { value: $state.value + 10 })`, clicked the tile's real `+` → state `10`; `$render({ value: 7 })` → `UINode column (5 nodes)`, *render here* drew it. Screenshot `various/03-p2-repl-quickjs.png`.

### Why

- One bootstrap function instead of two engine-specific scopes is what makes "the same REPL under both engines" a fact rather than a goal; the conformance suite is the proof, and it runs the cases against QuickJS in Node.
- `__describe` inside the sandbox, not in the host: the host cannot inspect a QuickJS function handle cheaply, and doing it in the runtime means the eval engine gets the same markers for free.

### What worked

- The injection test passed first time on both engines: the handler table is a live object in both, and a direct eval reaches it.
- The QuickJS interrupt covered `evaluate` with no extra code beyond passing `evaluateMs` to `withDeadline`.

### What didn't work

- `src/bootstrap.ts(188,30): error TS1005: ',' expected.` — my doc comment inside the `String.raw` template used backticks around `__plugin` and `__ui`, which ended the template literal. Backticks are forbidden anywhere in `BOOTSTRAP_SOURCE`, comments included; removed.
- The patch script's `assert tail.endswith("});")` on `conformance.ts` failed: the file ends with `  });\n}` (the describe closes, then the exported function). Inserted before that pair instead.
- `expect(el).toBeDisabled()` — `Property 'toBeDisabled' does not exist`: the package has no jest-dom matchers. Assert `el.disabled` directly.

### What I learned

- A closure injected from the REPL captures the REPL-time `$state` (the `+ 10` above read `{value: 0}` at injection time and always adds to 0 + 10 = 10). That is JavaScript, not a bug, and the helper text should say "read `ctx.pluginState` inside handlers, not `$state`". Added to the REPL help in Phase 6's pass.
- Under `"use strict"` a direct eval's `let`/`const` stay in the eval; the help line says to use `$plugin.scratch = …` for anything that should persist.

### What was tricky to build

- **Enter versus history.** The textarea must run on Enter, insert a newline on Shift+Enter, and walk history on ↑/↓ only when the input is empty or already showing a history entry (so arrows inside a multi-line edit still move the caret). A `cursorRef` of `-1` means "not in history"; typing anything resets it.
- **What counts as a tree or as intents.** `isUINode` checks `kind ∈ SANDBOX_UI_KINDS`; `isIntentList` requires a non-empty array whose items have a plugin/verb scope. `$event` returns intents without `instanceId` (the bootstrap adds none; the validator would), which the REPL's *apply intents* does not need.

### What warrants a second pair of eyes

- `evaluate` is the same trust as the program (guide §4.3): under eval it is a `new Function` closure with shadowed globals, nothing more. It is not offered as a tool (D7).
- `__describe` caps depth at 8 and arrays at 200; a REPL user inspecting a deep object sees `{$type: "deep"}` and has to drill with a narrower expression.

### What should be done in the future

- Phase 3: the Dispatch Timeline tile over `instances.timeline()`.

### Code review instructions

- `bootstrap.ts` (`__describe`, `evaluate`), `engines/conformance.ts` ("evaluate — the REPL's door"), then `ReplTile.tsx` (`run`, `onKeyDown`, `applyIntents`, `ResultLine`).
- `pnpm --filter @hyperslop-systems/pbui-sandbox test`; in the demo, launcher → REPL, click a program tile, type `$state`.

### Technical details

```ts
engine.evaluate({ instanceId, code: "$render({ value: 7 })", pluginState, globalState })
// → { value: { kind: "column", children: [ { kind: "text", text: "Count: 7" }, … ] } }
engine.evaluate({ instanceId, code: "() => 1", … })   // → { value: { $type: "function", $text: "() => 1" } }
```
