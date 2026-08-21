---
Title: 'Intern guide: generative tiles — agent-written JS apps and actions in a reactive sandbox'
Ticket: PBUI-AGENT-3
Status: active
Topics:
    - pbui
    - chat
    - frontend
    - backend
    - onboarding
DocType: design-doc
Intent: long-term
Owners: []
RelatedFiles:
    - Path: abs:///home/manuel/code/wesen/go-go-golems/vm-system/frontend/client/src/components/WidgetRenderer.tsx
      Note: vm-system's raw-DOM renderer, replaced by a PBUI-atoms renderer (D3)
    - Path: abs:///home/manuel/code/wesen/go-go-golems/vm-system/frontend/client/src/pages/WorkbenchPage.tsx
      Note: The host loop (render all, handle event, reduce intents) that useProgramInstance runs per tile
    - Path: abs:///home/manuel/code/wesen/go-go-golems/vm-system/frontend/docs/plugin-authoring/examples.md
      Note: The worked programs the prompt and the seed library reuse
    - Path: abs:///home/manuel/code/wesen/go-go-golems/vm-system/frontend/packages/plugin-runtime/src/dispatchIntent.ts
      Note: validateDispatchIntents — ported with the verb scope
    - Path: abs:///home/manuel/code/wesen/go-go-golems/vm-system/frontend/packages/plugin-runtime/src/hostAdapter.ts
      Note: RuntimeHostAdapter — the engine-agnostic interface adopted as ProgramEngine (D2)
    - Path: abs:///home/manuel/code/wesen/go-go-golems/vm-system/frontend/packages/plugin-runtime/src/redux-adapter/store.ts
      Note: The generic reducer (state/merge, state/replace), capability grants and the projected globalState the design keeps as read-only documents/env domains
    - Path: abs:///home/manuel/code/wesen/go-go-golems/vm-system/frontend/packages/plugin-runtime/src/runtimeService.ts
      Note: The pattern's origin — BOOTSTRAP_SOURCE (definePlugin, ui.*, __pluginHost), QuickJS limits and the interrupt handler; ported into pbui-sandbox's bootstrap and engines
    - Path: abs:///home/manuel/code/wesen/go-go-golems/vm-system/frontend/packages/plugin-runtime/src/uiSchema.ts
      Note: assertUINode — the structural validator ported with the new kinds and limits
    - Path: repo://packages/pbui-chat/demo/src/chat.ts
      Note: The local handler that gains program.open, program.remove, program.pin, action.run, action.remove
    - Path: repo://packages/pbui-chat/demo/src/pbui/registry.ts
      Note: Where the demo wraps its registry with withGeneratedActions
    - Path: repo://packages/pbui-chat/demo/src/workbench.ts
      Note: Layout persistence and resetLayout(), the fact that decided the library lives apart from the layout (D5)
    - Path: repo://packages/pbui-chat/src/createPbuiChat.tsx
      Note: Where the sandbox tools register and attachSandbox re-syncs the manifest
    - Path: repo://packages/pbui-chat/src/router/createVerbRouter.ts
      Note: validateVerb gate that closes the vocabulary (D4) and the perform path generated-tile verbs travel (D10)
    - Path: repo://packages/pbui-chat/src/tools/workbenchTools.ts
      Note: 'The model for every sandbox tool: zod parameters, available(), flattened schemas, the single policy door performWithPolicy'
    - Path: repo://packages/pbui-workbench/src/apps.ts
      Note: AppDescriptor with bindings; createAppRegistry is immutable, which is why programs are documents bound to one script app (D7)
    - Path: repo://pkg/pbuichat/prompt.go
      Note: Gains the sandbox section gated on the program type; tool-name constants
    - Path: repo://pkg/pbuichat/vocabulary.go
      Note: Gains the optional sandbox block (kinds, intents) validated like widget.kinds (D12)
    - Path: repo://src/presentation/registry.ts
      Note: createPresentationRegistry's closed map; withGeneratedActions wraps the interface to append library actions (D6)
    - Path: repo://src/presentation/types.ts
      Note: PresentationAction — a verb is data, never a closure; the rule that shapes generated actions
    - Path: ws://react-chat/packages/chat-provider/src/tools/toolRegistry.ts
      Note: FrontendTool contract, provider-safe names, zod-to-JSON-Schema manifest
ExternalSources:
    - https://github.com/go-go-golems/vm-system/
Summary: 'A complete intern-level guide to letting the PBUI chat agent write small JavaScript programs — in vm-system''s definePlugin dialect: a pure render to a JSON UI tree, handlers that emit intents — that the browser runs in a sandbox and shows as workbench tiles; and to letting it define new actions on existing presentation types, persisted in localStorage and reloaded on boot. Covers the five systems involved, the reactive sandbox pattern in detail, the gaps, the design (dialect, engines, renderer, library, actions, tools, safety, decision records), a six-phase file-level implementation plan with pseudocode, sequences, failure modes, tests, and full API and file references.'
LastUpdated: 2026-08-21T12:00:00-04:00
WhatFor: Give someone new everything needed to implement "make me a tile that …" and "add an action to products that …" as chat instructions, without re-deriving the architecture from three repositories and three prior tickets.
WhenToUse: Read before touching pbui-sandbox, the sandbox_* tools in pbui-chat, the program/action presentation types, or the prompt section that teaches the model the dialect. Sections 1-4 are the analysis, 5 the design, 6-7 the implementation, 8-13 the references.
---


# Intern guide: generative tiles — agent-written JS apps and actions in a reactive sandbox

## 0 · What this guide is for, and how to read it

You are going to make these two exchanges work:

> **user:** make me a tile for [[product:2049|1oz American Gold Eagle 2024]] where I can type a number of days and it tells me whether the stock covers them, with a button that drafts a reorder if it doesn't
>
> **agent:** *(calls `sandbox_test` once, then `sandbox_create_app`)* Done — [[program:prg-7|Days of cover · 2049]] is open to the right of the chat. It reads the SKU's stock and 30-day sales, shows a meter, and the button performs the same *Draft a reorder* verb the product menu offers.

> **user:** add an action to every product called "Days of cover" that opens that tile for the product I clicked
>
> **agent:** *(calls `sandbox_define_action`)* Added. Right-click any product and you'll find *Days of cover* in its menu; it opens [[program:prg-7|Days of cover]] bound to that SKU. It's saved in this browser, so it will be there tomorrow.

Nothing in either exchange is a fixed feature of the UI. The tile is a **program** the model wrote — a few dozen lines of JavaScript in a small, documented dialect — that the browser loaded into a sandbox, rendered into PBUI atoms, and wired into the same verb router, trace and object menus everything else uses. The action is a **record** the model wrote — label, target types, what it does — appended to the product menu by a registry wrapper and stored in `localStorage`. Both survive a reload. Both are objects with menus of their own (*view source*, *pin*, *remove*, *ask the agent to fix this*). And neither touched the DOM, the network, or the store: the program's only way to affect the world is to emit **intents** the host decides what to do with. That last sentence is the whole design; the rest of this guide is what it implies.

Read it in this order:

- **§1–§4 (analysis).** The gestures, the five systems you must hold in your head at once, the reactive sandbox pattern explained from vm-system's source, and precisely what is missing. If you only read one thing, read §3 and §4's gap table.
- **§5 (design).** The dialect the model writes, the two engines, the renderer, the library, generated actions, the tool surface, the safety envelope, and fourteen decision records with the alternatives that lost.
- **§6–§7 (implementation).** Six phases with file paths, signatures and pseudocode; then the demo programs and actions and why each exists.
- **§8–§13 (reference).** Sequences, failure modes, tests, API tables, file tables, open questions, glossary.

**What you need on your machine.** The workspace at `/home/manuel/workspaces/2026-08-20/add-pbui-agent` (a `go.work` over `pbui`, `react-chat`, `pinocchio`, `sessionstream`, `geppetto`, and friends), and a checkout of vm-system at `/home/manuel/code/wesen/go-go-golems/vm-system` (this guide quotes its `frontend/` tree at commit `37bd440`). Then:

```bash
cd /home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui
pnpm install --no-frozen-lockfile --filter '!@hyperslop-systems/datalab-ui'
make chat-ui            # builds pbui, pbui-workbench, pbui-chat and the demo SPA into pkg/chatui/embed
make chat-serve         # scripted demo engine on http://127.0.0.1:8090 — no model, no credentials
devctl up               # dev profile: go run + vite on :5174 with hot reload
```

Three prior tickets are the background, and this guide assumes but does not repeat them:

- `pbui/ttmp/2026/08/20/PBUI-AGENT-1--…/design-doc/02-design-…` — the agent: the object/verb/widget contract, the Go plugin, the TypeScript package.
- `pbui/ttmp/2026/08/20/PBUI-WORKBENCH-1--…/design-doc/01-intern-guide-…` and `PBUI-WORKBENCH-2--…/design-doc/01-…` — the tiles: the workbench document, the applier, the verbs, workspaces, the tile descriptor.
- `pbui/ttmp/2026/08/20/PBUI-AGENT-2--…/design-doc/01-intern-guide-…` and **its diary** — the agent's workbench tools. **Read the diary**, not only the guide: the build deviated from the guide in ways this ticket inherits (§2.3), and its five steps record the failures you will otherwise repeat.

---

## 1 · The goal, stated as gestures

A design is easier to argue about when its acceptance is a list of things a person does. These are the gestures this ticket must make work, in the order they should start working:

| # | The user says | The agent must | New machinery |
|---|---|---|---|
| G1 | "make me a counter tile" | write a program, check it, store it, open it in a tile | `sandbox_test`, `sandbox_create_app`, the `script` app, the eval engine, the PBUI renderer |
| G2 | "make the button say *Add one* and show the total in a badge" | update the program's source; the tile re-renders; its state survives when it can | `sandbox_update_app`, versioned programs in the library |
| G3 | "make a days-of-cover tile for [[product:2049]]" | write a program that *reads a bound object* (stock, sales) and open it bound to that SKU | `bindings`, resolved documents in `globalState.shared.documents` |
| G4 | click *Draft a reorder* inside the generated tile | perform the product's existing `reorder` verb, through the router, into the trace | the `verb` intent scope, `dispatchVerb` |
| G5 | "add an action *Days of cover* to products that opens that tile" | store an action record; every product menu gains the entry; clicking it opens the program bound to the clicked product | `sandbox_define_action`, the library's `actions`, `withGeneratedActions`, `action.run` |
| G6 | reload the page | programs, actions, and the tiles that show them come back | the `localStorage` library; `view.documents.program` |
| G7 | "what have you built for me?" / right-click a program's title | list programs and actions; offer *view source*, *pin*, *remove*, *ask the agent to fix* | `sandbox_describe`, the `program` and `action` presentation types |
| G8 | the program throws, or loops | the tile shows the error and a *fix this* chip; the page does not die | error tiles; QuickJS interrupts (Phase 5) |
| G9 | "remove the counter" | refuse for a pinned program without approval; otherwise remove and close its tiles | `sandbox_remove`, the `confirm` policy via `pbui_propose` |

G1–G2 are the core loop and a long day's work once Phase 0 exists. G3–G4 are what make a generated tile part of the product instead of a toy beside it. G5–G6 are the user's second request and the reason there is a library. G7–G9 are what make it PBUI — objects with menus, and safety that is visible — rather than a code runner with a chat in front of it.

---

## 2 · Five systems, in one picture

```
 ┌─ the browser ────────────────────────────────────────────────────────────────────────┐
 │                                                                                      │
 │  PBUI presentation runtime            pbui-workbench                  pbui-sandbox   │
 │  ┌─────────────────────────┐          ┌─────────────────────────┐     (NEW)          │
 │  │ registry: type → descr  │◄─ verbs ─│ store: WorkbenchDocument│     ┌────────────┐ │
 │  │ Provider / onPerform    │          │ verbs: split close place│     │ engine     │ │
 │  │ Presentation / menu     │          │       openView …        │     │  eval      │ │
 │  │ accept mode             │          │ Surface: tree → Tile    │     │  quickjs   │ │
 │  └────────────┬────────────┘          │ apps: AppRegistry       │     │ renderer   │ │
 │               │                       │   chat inspector …      │     │ library    │ │
 │  pbui-chat    │                       │   inventory sku …       │     │ script app │ │
 │  ┌────────────┴──────────────┐        │   ►script◄ (NEW)       │     │ actions    │ │
 │  │ createPbuiChat            │        └──────────┬──────────────┘     └─────┬──────┘ │
 │  │  extension {tools,widgets}│                   │ applyMutations            │        │
 │  │  router (families+trace)  │        @hyperslop-systems/workbench-protocol  │        │
 │  │  workbenchTools (AGENT-2) │                                               │        │
 │  │  ►sandboxTools◄ (NEW)     │◄──────────────────────────────────────────────┘        │
 │  └────────────┬──────────────┘        chat-provider (react-chat)                       │
 │               │                       ┌──────────────────────────────┐                │
 │               └──────────────────────►│ ChatToolRegistry, toolRuntime│                │
 │                                       │ WidgetOutlet, timeline store │                │
 │                                       └──────────────┬───────────────┘                │
 └──────────────────────────────────────────────────────┼────────────────────────────────┘
                          HTTP + one WebSocket          │
 ┌──────────────────────────────────────────────────────┼────────────────────────────────┐
 │  pbui/pkg/chatserver        /sessions /messages /tools/manifest /tools/results /verbs   │
 │  pbui/pkg/pbuichat          prompt.go  ►sandbox section◄ (NEW) · vocabulary.go         │
 │  pinocchio chatapp ── frontendtools.Manager ── geppetto engine + tool loop             │
 └───────────────────────────────────────────────────────────────────────────────────────┘

 ┌─ vm-system (the pattern's origin; read, not imported) ───────────────────────────────┐
 │  frontend/packages/plugin-runtime   definePlugin · UINode · DispatchIntent · QuickJS  │
 │  frontend/client                    WidgetRenderer · the host loop · DevTools         │
 │  pkg/vmexec, pkg/vmsession (Go)     goja sessions — optional server-side dry-run      │
 └───────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.1 The PBUI presentation runtime

PBUI's core (`pbui/src/presentation/types.ts`) is four types: a `PresentationReference<Values> = {type, value}`; a `PresentationDescriptor{label, describe?, actions?, tone?}`; a `PresentationAction{id, label, verb, danger?, description?, group?, disabledBecause?}`; and a `PresentationRegistry` (`registry.ts:12-28`) mapping the first to the second with `labelFor`/`describeFor`/`actionsFor`/`toneFor`/`has`. **A verb is serialisable data, never a closure.** That rule (`types.ts:24-30`, AGENT-1 §3) is why an agent can both emit verbs and receive them, and it is the constraint that shapes generated *actions* in this ticket (§5.6). The runtime (`createPbui.tsx`) adds the object menu — which calls `registry.actionsFor(reference, environment)` **at the moment the menu opens** (`createPbui.tsx:502`), not at registration — accept mode, and the mouse-doc line.

`createPresentationRegistry(descriptors)` takes a fixed map (`registry.ts:30-41`) and `has()` is `Object.hasOwn(descriptors, type)`. There is no `add`, and nothing in the library needs one: the registry is an interface, and a wrapper that forwards four methods and extends the fifth is twenty lines.

### 2.2 The workbench

`proto/hyperslop/pbui/workbench/v1/workbench.proto` defines `WorkbenchDocument{workspaces[], views{}, documents{}, view_order[]}`; an `AppView{id, app_id, documents: map<string,string>, title?}` names an application plus its **document bindings**; a `DocumentPayload{id, format, schema_version, body: Struct}` is an arbitrary JSON blob the document can carry. Fifteen mutations are the only legal change. `@hyperslop-systems/pbui-workbench` wraps this in a local store and verbs.

Three facts matter here:

- **An application is an `AppDescriptor`** (`packages/pbui-workbench/src/apps.ts:21-70`): `{id, title, tone, singleton, duplicable?, docBound?, bindings?, titleFor?, group?, blurb?, available?, Component}`. `Component` receives `{placementId, view}` (`AppProps`, lines 9-12), and **two placements of one view receive the same `view`** — that is what keeps linked tiles in lockstep.
- **The registry is a fixed list** (`createAppRegistry`, lines 106-116): it throws on a duplicate id and exposes only `get`/`list`. Nothing adds an app after construction. So a *program* cannot be an app of its own without new machinery; it must be a *document* a single host app is bound to (D7).
- **A doc-bound app is a view OF something** named in `view.documents`. `sku` binds `product` (`demo/src/apps/SkuApp.tsx:14`), `notes` binds `note`, `widget` binds `widget` (`packages/pbui-chat/src/apps/WidgetApp.tsx:8`). `openView(appId, documents, {near, title})` with bindings identical to an existing view **goes to that tile** instead of opening a second (AGENT-2 guide §4.1). `defaultLauncherRows` deliberately skips doc-bound apps (`launcherRows.ts:104`), so they are reached through verbs and menus, not ⌘K — unless the product supplies its own `rows`.

### 2.3 The chat agent, as built

AGENT-1 shipped a chat whose structured output is presentations; AGENT-2 gave it tools over the workbench. What exists now on `task/add-pbui-agent` (HEAD `1c91964`):

- `packages/pbui-chat/src/createPbuiChat.tsx` assembles the extension: widgets, the two human tools, and `createWorkbenchTools({getWorkbench, perform})` (lines 121-132). `attachWorkbench(next)` stores the workbench and calls `client.tools.syncManifest()` (lines 255-262) — without that the tools are invisible to the model for exactly one message.
- `tools/workbenchTools.ts` is the model for every tool this ticket adds: zod `parameters` that double as the advertised JSON Schema; `available: () => getWorkbench() !== null`; a flattened recursive schema because providers reject `$ref` (lines 18-47); `DEFAULT_LIMITS`/`DEFAULT_POLICY` (56-110); **one policy door** `performWithPolicy` (236-248) with `checkPolicy` (263-276) — `allow`/`confirm`/`deny`, where `confirm` means "a `pbui_propose` id the product's `isApproved(id, verb)` recognises, spent once, only after the verb actually performed"; tool results that always carry the ids the model needs next; error strings written for a model to act on.
- `router/createVerbRouter.ts` validates every verb against the vocabulary (`perform`, line 144), dispatches to a family handler (`local`/`agent`/`tool`), and POSTs the outcome — including rejections — to `/api/chat/sessions/{id}/verbs` with `actor: "human" | "agent"`. **The tools never call `wb.verbs.*`; they perform verbs through the router** so an agent's change lands in the trace beside a human's.
- The demo (`packages/pbui-chat/demo/src/`) declares its types (`pbui/types.ts:94-110`), verbs (`pbui/verbs.ts:11-51`, a zod union), descriptors (`pbui/descriptors/*.ts`), registry (`pbui/registry.ts:51-67`), and vocabulary (`pbui/vocabulary.ts`); `pnpm --filter @hyperslop-systems/pbui-chat-demo vocab` writes `pkg/chatserver/demo/vocabulary.json`, which the Go binary embeds and validates at boot. The router's `local` handler routes every `WorkbenchVerb` through `performWorkbenchVerb` with a single `isWorkbenchVerb` branch (`demo/src/chat.ts:57-71`).
- `pkg/pbuichat/prompt.go` generates the system-prompt section from the vocabulary; `workbenchSection` (lines 74-95) is emitted only when the vocabulary declares a `tile` type. The lesson recorded there and in both prior diaries: **a complete worked example in the description is what stops a model guessing a nested schema.**

Where the build deviated from the AGENT-2 guide, and this ticket follows the build: tools emit `WorkbenchVerb`s unchanged rather than product-named verbs (diary step 2); policy is centralised (step 5); `isApproved` takes the verb (step 4); `store.mutate` separates commit from post-commit failure (step 5). The wiring of `isApproved` to proposal state — AGENT-2 Tier 4 — is **still open**, which means any `confirm`-policy verb is unperformable by the agent today. §5.8 says which sandbox tools depend on it.

### 2.4 The chat transport and tool channels

Three tool channels (AGENT-2 guide §3): **backend** (Go, `geptools.NewToolFromFunc`, in-process), **frontend** (browser, automatic: advertised in the manifest, bridged by pinocchio's `frontendtools.Manager`, executed by chat-provider's `toolRuntime`, result POSTed back), and **human** (browser, parked until a person answers). Every tool in this ticket is a **frontend** tool: the library, the engine and the workbench all live in the browser. The five facts that bite (manifest sync points; `available` honoured server-side; provider-safe names `^[a-zA-Z0-9_-]+$`; `Manager.Request` has no timeout; zod `parameters` is both validator and advertised schema) all apply unchanged; see `react-chat/packages/chat-provider/src/tools/toolRegistry.ts:20-44, 54-63, 102-110, 131-136` and `toolRuntime.ts:50-112`.

### 2.5 vm-system's plugin runtime — the pattern's origin

`vm-system` is two things. The Go half is a daemon that hosts long-lived goja sessions behind a REST API (`README.md`, `pkg/doc/vm-system-architecture.md`) — relevant here only as an optional server-side dry-run (§6 Phase 6). The half this ticket borrows is `frontend/`, the "Plugin Playground": a browser app where **plugins** — single JavaScript files calling `definePlugin()` — run inside QuickJS in a Web Worker, declare their own state, render a JSON UI tree, and communicate only through dispatch intents evaluated under a capability policy. Its docs describe it as "a miniature operating system for UI widgets: each plugin gets its own process (a sandboxed JS context), its own memory (local state), and a controlled set of system calls (dispatch intents)" (`frontend/docs/README.md`). §3 takes it apart.

---

## 3 · The reactive sandbox pattern, from the source

You cannot design on top of a pattern you have only read a summary of. This section walks vm-system's implementation file by file; every claim has a line number, and the next section's gap analysis refers back to these.

### 3.1 The loop

```
            ┌──────────────────── the program (inside the sandbox) ────────────────────┐
            │                                                                          │
            │   definePlugin(({ ui }) => ({                                            │
            │     id, title, initialState,                                             │
  load ────►│     widgets: { main: {                                                   │
            │       render({ pluginState, globalState }) → UINode   ◄── pure          │
            │       handlers: { name({ pluginState, globalState,                       │
            │                          dispatchPluginAction, dispatchSharedAction },   │
            │                        args) → void  }   ── emits intents, mutates nothing│
            │   }}}))                                                                   │
            └───────────┬───────────────────────────────────────▲──────────────────────┘
                        │ UINode (JSON)                         │ intents (JSON)
                        ▼                                       │
            ┌────────── the host (outside) ───────────────────────────────────────────┐
            │  validate tree → render with real components → user clicks a button      │
            │  → event(handler, args, state, globalState) → validate intents           │
            │  → reduce: plugin scope → new state · shared scope → policy → domain     │
            │  → record in timeline {outcome: applied|denied|ignored}                  │
            │  → re-render                                                             │
            └──────────────────────────────────────────────────────────────────────────┘
```

Four properties fall out of that shape, and every one of them is something this ticket needs:

1. **The program is pure functions over JSON.** `render` cannot have side effects because it has nothing to have them on — no DOM, no `fetch`, no host objects. The same state renders the same tree, which makes a program testable without a browser and safe to re-render at any time.
2. **Intents are the only egress.** A handler *describes* a change; the host *decides*. That is where policy lives (deny by default), where the audit trail lives (every intent gets an outcome), and — for this ticket — where a click inside a generated tile becomes a verb through the same router as every other click.
3. **State is owned by the host.** The program receives `pluginState` and returns intents about it; it never holds it. So the host can snapshot, reset, persist, or share it between two tiles showing the same view without the program knowing.
4. **Everything crosses the boundary as JSON.** `toJsLiteral` (`runtimeService.ts:153-156`) is `JSON.stringify`; `context.dump` on the way back. No object reference ever leaks in either direction, which is what makes the engine replaceable.

### 3.2 The bootstrap: what `definePlugin` actually is

`frontend/packages/plugin-runtime/src/runtimeService.ts:13-127` is a string, `BOOTSTRAP_SOURCE`, evaluated in a fresh context before the plugin's own source. It defines three things:

- `__ui` (lines 14-45): the DSL helpers. Each returns a plain object with a `kind`: `text(content) → {kind:"text", text}`, `button(label, props) → {kind:"button", props:{label, ...props}}`, `input(value, props)`, `row/column/panel(children)`, `badge(text)`, `table(rows, {headers})`. Note the coercions: `String(content)`, `Array.isArray(children) ? children : []` — the helpers are defensive so a slightly wrong call still yields a valid node.
- `definePlugin(factory)` (lines 50-55): calls `factory({ ui: __ui })` and stores the result in `__plugin`. One plugin per context.
- `globalThis.__pluginHost` (lines 57-126): the three RPC entry points the host calls by evaluating strings — `getMeta()` (validates and returns `{declaredId, title, description, initialState, widgets: Object.keys(widgets)}`), `render(widgetId, pluginState, globalState)` (finds the widget, calls `render({pluginState, globalState})`, returns whatever it returns — the *host* validates), and `event(widgetId, handlerName, args, pluginState, globalState)` (resets `__dispatchIntents`, builds the two `dispatch*` closures that push `{scope, actionType, payload}` onto it, calls the handler with `({pluginState, globalState, dispatchPluginAction, dispatchSharedAction}, args)`, returns a copy of the array).

That is the entire plugin API. There is no lifecycle, no subscriptions, no timers, no async. A program that wants to "do something later" cannot; it can only render a button and wait.

### 3.3 The host side of the RPC

`QuickJSRuntimeService` (`runtimeService.ts:257-376`) owns a `Map<instanceId, PluginVm>`. `loadPlugin(packageId, instanceId, code)` (298-321) creates a runtime+context, sets limits, evaluates the bootstrap, evaluates the code, evaluates `globalThis.__pluginHost.getMeta()`, validates the result into a `LoadedPlugin` (210-240) and keeps the VM; any failure disposes it. `render` (323-335) evaluates `__pluginHost.render(<json>, <json>, <json>)` and runs `validateUINode` on the dump. `event` (337-356) does the same with `__pluginHost.event(...)` and `validateDispatchIntents(intents, instanceId)` — which stamps the instance id onto plugin-scoped intents (`dispatchIntent.ts:20-26`) so the host never trusts a program's claim about who it is.

The limits (145-151): `memoryLimitBytes: 32 MiB`, `stackLimitBytes: 1 MiB`, `loadTimeoutMs: 1000`, `renderTimeoutMs: 100`, `eventTimeoutMs: 100`. Enforcement is `runtime.setInterruptHandler(() => Date.now() > vm.deadlineMs)` (284) with `withDeadline` (174-181) setting the deadline around each evaluation. An interrupted evaluation throws with "interrupted" in the message, which `toRuntimeError` (242-255) maps to `code: "RUNTIME_TIMEOUT"`. **This is the only part of the pattern an `eval` engine cannot have** (§5.3).

### 3.4 The contracts

- `UINode` (`uiTypes.ts:4-12`): a discriminated union over nine kinds — `panel|row|column` (with `children`), `text|badge` (with `text`), `button{label, onClick?, variant?}`, `input{value, placeholder?, onChange?}`, `counter{value, onIncrement?, onDecrement?}`, `table{headers, rows}`. `UIEventRef = {handler, args?}` names a handler by string; the renderer never receives a function.
- `assertUINode` (`uiSchema.ts:16-93`): a structural walk that throws `"root.children[2].kind 'image' is not supported"`-style messages with a path. Ninety-nine lines; port it, do not redesign it.
- `DispatchIntent` (`contracts.ts:12-18`): `{scope: "plugin"|"shared", actionType, payload?, instanceId?, domain?}`; `validateDispatchIntent` (`dispatchIntent.ts:7-39`).
- `LoadedPlugin` (`contracts.ts:20-28`): `{packageId, instanceId, declaredId?, title, description?, initialState?, widgets: string[]}`.
- `RuntimeHostAdapter` (`hostAdapter.ts:28-35`): the engine-agnostic interface — `loadPlugin({packageId, instanceId, code})`, `render({instanceId, widgetId, pluginState, globalState})`, `event({...render input, handler, args})`, `disposePlugin(id)`, `health()`, `terminate?()`. All async. `embedding.md` ("Mode C") shows wrapping the positional `QuickJSRuntimeService` and the worker `QuickJSSandboxClient` into it. **This is the interface this ticket adopts as `ProgramEngine`** (D2).
- The worker protocol (`contracts.ts:30-111`, `worker/sandboxClient.ts`, `worker/runtime.worker.ts`): request/response over `postMessage` with incrementing ids; a `QuickJSSandboxClient` that resolves pending promises by id and rejects all of them on worker error or `terminate()`.

### 3.5 The reducer and the capability model

`redux-adapter/store.ts` is vm-system's host state. For pbui the relevant parts are small:

- **The generic reducer** (`reduceGenericPlugin`, lines 262-297): `state/replace` sets the plugin's state to the payload; `state/merge` shallow-merges an object payload. The per-package reducers (`counter`, `calculator`, `greeter`, lines 176-260) exist for the playground's presets and are not part of the pattern; `examples.md` teaches custom plugins to use only the generic pair. That is all a generated program needs.
- **Grants** (`CapabilityGrants`, lines 24-28): `readShared[]`, `writeShared[]`, `systemCommands[]`; `DEFAULT_GRANTS` is empty — deny by default. A plugin sees only the shared domains it may read (`buildSharedForInstance`, 529-556) and a write to a domain without a grant is `denied` with `missing-write-grant:<domain>` (`reduceSharedScopedAction`, 320-345).
- **The projected `globalState`** (`selectGlobalStateForInstance`, 591-605): `{ self: {instanceId, packageId}, shared: {<granted domains>}, system: {metrics, plugins} }`. The shape a program's `render` receives as its second argument.
- **The timeline** (`appendDispatchTimeline`, 135-155; `MAX_TIMELINE_ENTRIES = 200`): every dispatch with its `outcome` and `reason`. pbui has a trace already; a verb intent enters it through the router (D10).

The capability model is the right mental frame for what a generated program may *read*: in this ticket the bound documents and the product environment are read-only shared domains (§5.4), and there are no writable ones in v1.

### 3.6 The renderer and the host loop

`client/src/components/WidgetRenderer.tsx:19-145` is a `switch (node.kind)` producing Tailwind-styled DOM: `panel` → a bordered `div`, `button` → `<button onClick={() => onEvent(onClick, onClick.args)}>`, `input` → `<input onChange={e => onEvent(onChange, {value: e.target.value})}>`, `table` → `<table>`. Note the two argument conventions a handler can receive: the ref's static `args` (button) or a payload the renderer constructs (`{value}` for input). pbui's renderer keeps both.

`client/src/pages/WorkbenchPage.tsx` is the host loop. `renderAll` (131-180) re-renders every loaded widget whenever plugin state or the runtime state changes, catching per-widget render errors into an errors panel; `runEditorTab` (216-244) is load → register with grants → focus; `handleEvent` (254-273) is event → intents → `dispatchPluginAction`/`dispatchSharedAction`. The "Using Without Redux" section of `embedding.md` shows the same loop with a plain variable for state — the shape pbui uses per tile (§5.5).

### 3.7 What a program looks like

From `frontend/docs/plugin-authoring/examples.md`, Example 1, verbatim — it is also the worked example the prompt will carry:

```js
definePlugin(({ ui }) => ({
  id: "minimal-counter",
  title: "Minimal Counter",
  initialState: { value: 0 },
  widgets: {
    main: {
      render({ pluginState }) {
        const value = Number(pluginState?.value ?? 0);
        return ui.column([
          ui.text("Count: " + value),
          ui.row([
            ui.button("-", { onClick: { handler: "decrement" } }),
            ui.button("+", { onClick: { handler: "increment" } }),
          ]),
        ]);
      },
      handlers: {
        increment({ dispatchPluginAction, pluginState }) {
          dispatchPluginAction("state/merge", { value: Number(pluginState?.value ?? 0) + 1 });
        },
        decrement({ dispatchPluginAction, pluginState }) {
          dispatchPluginAction("state/merge", { value: Number(pluginState?.value ?? 0) - 1 });
        },
      },
    },
  },
}));
```

Three habits the docs drill and the prompt must too: coerce everything read from state (`Number(pluginState?.value ?? 0)`), because state is JSON; keep `render` pure; use `state/merge` unless you mean to replace the whole thing.

---

## 4 · What exists, and exactly what is missing

### 4.1 Gap table

| # | Gap | Evidence | What closes it | Size |
|---|---|---|---|---|
| 1 | **No JavaScript execution surface in pbui.** Nothing evaluates model-written code; `quickjs-emscripten` is not a dependency anywhere in the workspace; vm-system's `plugin-runtime` is `"private": true` (`frontend/packages/plugin-runtime/package.json`) and reached only through a Vite alias (`@runtime`), so it cannot be installed | `pbui/package.json`, `packages/*/package.json`; vm-system `vite.config.ts:17` | a new package `@hyperslop-systems/pbui-sandbox` carrying a ported bootstrap, contracts and validators, and a `ProgramEngine` with two implementations | ~600 lines + ported tests |
| 2 | **No app can be defined at runtime.** `createAppRegistry` is a fixed list with `get`/`list`; `Workbench.apps` is that registry | `apps.ts:96-116`, `types.ts:82` | one host app `script`, doc-bound to a `program` id; programs are documents, not apps | ~150 lines, no change to pbui-workbench |
| 3 | **vm-system's UI DSL renders raw Tailwind DOM**, which pbui forbids: `no-raw-controls.test.ts` fails a raw `<button>`, `no-hex.test.ts` fails a colour literal, and `grid-columns.test.ts` polices the overflow defect | `WidgetRenderer.tsx:60-140`; `packages/pbui-chat/test/{no-raw-controls,no-hex,grid-columns}.test.ts` | a `UINodeRenderer` over pbui atoms (`Button`, `TextInput`, `SelectInput`, `Chip`, `Meter`, `Sparkline`, `Callout`, `Text`, `Stack`, `Toolbar`) plus a `ref` node that renders a `Presentation` | ~250 lines |
| 4 | **Descriptors are closed.** `createPresentationRegistry` takes a fixed map; `actions()` is a per-type closure written by the product; there is no "append an action to a type" | `src/presentation/registry.ts:30-41`; `demo/src/pbui/registry.ts:51-67` | `withGeneratedActions(registry, getActions)` — a registry wrapper whose `actionsFor` appends library actions for the reference's type | ~40 lines |
| 5 | **The verb vocabulary is closed on both sides.** An unknown `kind` is `rejected:unknown verb …` by the router before any handler, and by Go's `ValidateVerb` for chips | `createVerbRouter.ts:144`; `vocabulary.go:183-210`; `validate.ts` | five generic kinds (`program.open`, `program.remove`, `program.pin`, `action.run`, `action.remove`) declared once; generated programs and actions are **payloads**, never kinds | 5 zod entries + regenerate |
| 6 | **No persistence for generated things.** The demo persists the *layout* to `localStorage` (`WORKBENCH_STORAGE_KEY`) and `resetLayout()` replaces the whole document | `demo/src/workbench.ts:11-19, 47, 75-79` | a separate, versioned `ProgramLibrary` in `localStorage`; tiles bind by id; the layout stays layout | ~200 lines |
| 7 | **The model is not told.** `prompt.go` knows objects, widgets and the workspace; nothing about programs, the dialect, or the rules | `prompt.go:26-95` | a `sandboxSection` gated on `KnowsType("program")`, generated from a new optional `sandbox` block in `vocabulary.json` (the UI kinds and intent scopes) | ~80 lines Go + 20 TS |
| 8 | **No policy for executing generated code.** Every existing policy is about the layout; nothing says when agent-written code may run, be replaced, or be removed | `workbenchTools.ts:85-110` | a `SandboxPolicy` with the same three decisions, over `program.create/update/run/remove` and `action.define/remove`; pinned artifacts are `confirm` | ~60 lines |
| 9 | **No way for the model to try before it ships.** Every tool today mutates; a wrong program would be stored, opened, and fail in front of the user | `workbenchTools.ts` (all tools mutate or describe) | `sandbox_test`: load, render, optionally replay events, return tree/intents/error, store nothing | ~80 lines |
| 10 | **Nothing shows generated code to the human.** A tile that runs agent-authored JavaScript without a visible provenance and a *view source* is a trust problem, not a feature | — | `program` and `action` presentation types with `inspect` (source), `pin`, `remove`, `askAgent`; a "generated" chip in the tile | descriptors + vocabulary |

Nothing in `pbui-workbench`, `workbench-protocol`, `pkg/chatserver`, `pinocchio`, `sessionstream` or `geppetto` changes. Go changes are confined to `pkg/pbuichat/{prompt,vocabulary}.go`. **No new wire types.** As in AGENT-2, that is the strongest evidence the design sits on the seams that exist.

### 4.2 What the as-built code gives for free

Worth listing, because each one is a thing you would otherwise build:

- **Late-bound tools.** `available: () => getLibrary() !== null && getWorkbench() !== null` and `RegisterManifestTools` skipping unavailable descriptors — the construction-order problem is already solved (`createPbuiChat.tsx:113-125`).
- **Binding a tile to data by id.** `view.documents.program = "prg-7"` is exactly how `sku` binds a product; `openView`'s de-dup rule means "open prg-7" twice goes to the existing tile; `titleFor(view)` names it.
- **The trace.** A verb emitted from inside a generated tile travels `perform → router → /verbs`, same as a chip.
- **Approval.** `pbui_propose` + `isApproved(id, verb)` + one-shot spending is the `confirm` mechanism; nothing new.
- **Vocabulary regeneration.** Add a type and a verb in the demo's zod/`defineVocabulary`, run `pnpm vocab`, and Go's prompt, validator and `pbui_describe_types` update; `exportVocabulary.test.ts` fails if the embedded file is stale.
- **The lesson file.** AGENT-2's diary, §§ "What was tricky": the `dist`-not-source trap, the `syncManifest` on attach, the `localStorage` whole-document write and its quota hazard, `getByText` vs. presentation `aria-label`, and the `python3` heredoc/`cd` trap.

---

## 5 · Design

### 5.1 The one sentence, and the six rules it implies

> **The agent writes a program in the reactive-sandbox dialect — a pure `render` to a JSON UI tree and handlers that emit intents — the browser validates it, stores it in a local library, runs it inside a `script` tile through a swappable engine, renders its tree with PBUI atoms, and turns its intents into either program state or verbs through the existing router; a generated action is a stored record that puts a generic verb into a type's menu and, when clicked, opens a program, performs an existing verb, or asks the agent.**

Six rules follow, and every decision in the rest of §5 is one of them applied:

1. **A program is pure functions over JSON.** No DOM, no `fetch`, no timers, no host objects, no module imports. Its inputs are `pluginState` and a projected `globalState`; its outputs are a `UINode` tree and `DispatchIntent[]`. An engine that cannot enforce this (eval) still *structures* it this way, so that the engine that can (QuickJS) is a swap, not a rewrite.
2. **Intents are the only egress, and verbs are the only effect.** A program changes its own state with `state/merge`/`state/replace`, and touches the rest of the product only by emitting a verb that the router validates, performs and traces — exactly what a human click does.
3. **The vocabulary stays closed.** Generated programs and actions are data; the vocabulary gains five fixed kinds and two fixed types and never grows per artifact. Go's validator, the prompt and `pbui_describe_types` therefore need regenerating once, not per generation.
4. **Ids come from a read, never from imagination.** Program and action ids are minted by the library and returned by the tool that created them; `sandbox_describe` lists them; a mutating tool that names an unknown id gets a clear message.
5. **Every generated artifact is a presentation.** `program` and `action` are types with descriptors, so each has a menu (*view source*, *pin*, *remove*, *ask the agent to fix*), a mention (`[[program:prg-7|…]]`), and a place in accept mode.
6. **Persistence is a library, not the layout.** Programs and actions outlive any one workbench document; tiles reference them by id. Resetting the layout loses no code.

### 5.2 The dialect the model writes

The program API is vm-system's, kept byte-compatible where it costs nothing so that `examples.md` and `ui-dsl.md` remain true, and extended in three places PBUI needs. A complete program:

```js
definePlugin(({ ui }) => ({
  id: "days-of-cover",                 // the model's name; the library mints the real id
  title: "Days of cover",              // the tile's title when the view has none
  bindings: ["product"],               // optional: binding keys this program wants resolved
  initialState: { days: 30 },
  widgets: {
    main: {
      render({ pluginState, globalState }) {
        const product = globalState.shared.documents?.product;          // a resolved Reference, or null
        if (!product) return ui.callout({ variant: "warning", text: "bind this tile to a product" });
        const stock = Number(product.value?.stock ?? 0);
        const perDay = Number(product.value?.sold30d ?? 0) / 30;
        const days = Number(pluginState?.days ?? 30);
        const needed = Math.ceil(perDay * days);
        const covered = stock >= needed;
        return ui.column([
          ui.row([ ui.ref(product), ui.badge(covered ? "covered" : "short") ]),
          ui.input(String(days), { type: "number", placeholder: "days", onChange: { handler: "setDays" } }),
          ui.meter({ fraction: needed === 0 ? 1 : Math.min(1, stock / needed), value: `${stock} / ${needed}`, label: "stock vs need" }),
          ui.button("Draft a reorder", { variant: "destructive", disabled: covered, onClick: { handler: "reorder" } }),
        ]);
      },
      handlers: {
        setDays({ dispatchPluginAction }, args) {
          dispatchPluginAction("state/merge", { days: Number(args?.value ?? 0) });
        },
        reorder({ dispatchVerb, globalState }) {
          const product = globalState.shared.documents?.product;
          if (product) dispatchVerb({ kind: "reorder", productId: product.id });
        },
      },
    },
  },
}));
```

**What is unchanged from vm-system** (so the docs port verbatim): `definePlugin(factory)`; `factory({ ui })`; `id`/`title`/`description`/`initialState`/`widgets`; `render({ pluginState, globalState })`; `handlers[name](context, args)`; `dispatchPluginAction(actionType, payload)` with `state/merge` and `state/replace`; `ui.text/badge/button/input/row/column/panel/table`; `UIEventRef = { handler, args? }`; the `{ value }` payload an input's `onChange` receives; the `{ self, shared, system }` shape of `globalState`.

**What is added:**

| Addition | Why | Shape |
|---|---|---|
| `ui.ref(reference, label?)` | the bridge to the object model: a `Presentation` with the product's menu, accept behaviour and mouse-doc | `{kind:"ref", props:{reference:{type,id,value?}, label?}}` |
| `ui.meter(props)`, `ui.sparkline(props)`, `ui.callout(props)`, `ui.select(value, props)` | the atoms pbui has and a data tile wants; `select` replaces nothing but fills the most common gap after `input` | see §10.1 |
| `props.variant` on `button`: `"primary"` \| `"framed"` \| `"destructive"`; `props.disabled` | pbui's `Button` variants; `destructive` is kept for vm-system parity and maps to `tone="danger"` | |
| `props.type: "text"\|"number"` on `input` | a number field is half of every calculator | |
| `props.size`/`tone`/`strong` on `text` | `Text size="tiny" tone="faint"` is how pbui writes secondary copy | |
| `dispatchVerb(verb)` in the handler context | rule 2: the only effect | emits `{scope:"verb", verb}` |
| `bindings: string[]` on the plugin | lets `sandbox_create_app` refuse an unbound open and `describeWorkbench` report what to bind — the same field `AppDescriptor` has | |
| `globalState.shared.documents` | the resolved bindings, keyed by binding name; each is a wire `Reference` (`{type, id, value?, provenance?}`) or `null` | |
| `globalState.shared.env` | the product's descriptor environment (`{canApprove, sessionId}` in the demo), read-only | |

**What is removed:** `ui.counter` (a composite with no pbui atom; write it from `row`+`button`+`text`), `dispatchSharedAction` (no writable domains in v1; the bootstrap does not define it, so a call is a clear `ReferenceError` rather than a silently `ignored` intent — revisit in §12). Multiple widgets per program are supported by the engine and rendered stacked in the tile, in declaration order; `main` is the convention.

The rules the prompt states, and the validator enforces where it can: the source must call `definePlugin` exactly once; `render` must return a `UINode` (validated, with a path in the error); handlers must be synchronous; no `import`/`require`/`fetch`/`document`/`window`/`setTimeout` (the eval engine shadows them to `undefined`; QuickJS does not define them); verbs passed to `dispatchVerb` must be kinds the vocabulary declares (the router rejects the rest, visibly).

### 5.3 Engines

```
               ┌──────────────────────────────────────────────────────────┐
               │  interface ProgramEngine                                 │
               │    kind: "eval" | "quickjs"                              │
               │    load({instanceId, programId, source}) → LoadedProgram │
               │    render({instanceId, widgetId, pluginState, globalState}) → UINode  │
               │    event({…, handler, args}) → DispatchIntent[]          │
               │    dispose(instanceId) → boolean · health() · terminate?()│
               └──────────────┬───────────────────────────┬───────────────┘
                              │                           │
                ┌─────────────▼────────────┐  ┌───────────▼──────────────────┐
                │ createEvalEngine()        │  │ createQuickJsEngine()  (Phase 5)│
                │  new Function(bootstrap + │  │  Worker ← postMessage RPC      │
                │   source), same thread    │  │  quickjs-emscripten per instance│
                │  no isolation, no timeout │  │  32 MiB · 1 MiB · 100 ms       │
                │  zero deps, sync, easy    │  │  true isolation, interruptible │
                └──────────────────────────┘  └──────────────────────────────┘
```

The interface is vm-system's `RuntimeHostAdapter` (`hostAdapter.ts:28-35`) with the names pbui uses (`load`/`dispose`, `programId` for `packageId`). Both engines evaluate the **same bootstrap string** — vm-system's `BOOTSTRAP_SOURCE` with the §5.2 additions — so a program behaves identically on either, barring what the sandbox prevents.

**The eval engine** (v1, per the user's instruction). Per instance:

```ts
const factory = new Function(
  // shadowed names: a speed bump for accidents, NOT a security boundary
  "window", "document", "globalThis", "self", "fetch", "XMLHttpRequest", "localStorage",
  "sessionStorage", "indexedDB", "setTimeout", "setInterval", "requestAnimationFrame", "importScripts",
  `"use strict";\n${BOOTSTRAP_SOURCE}\n${source}\n;return __pluginHost;`,
);
const host = factory(undefined, undefined, undefined, /* … */);   // one call: evaluates bootstrap + source
// host.getMeta(), host.render(widgetId, state, global), host.event(widgetId, handler, args, state, global)
```

Arguments are passed **by value through `structuredClone`** on the way in and `JSON.parse(JSON.stringify(…))` on the way out, to keep the JSON boundary of §3.1 even though the same heap is shared; otherwise a program could mutate the host's `pluginState` object in place and the purity the host loop relies on would be a fiction.

What eval gives up, stated plainly because the guide will be read by someone deciding whether to ship it: **no isolation** (`(0, eval)("this")`, `Function("return this")()`, and `new.target` tricks reach the real global; a program can read `localStorage`, call `fetch`, and touch the DOM if it wants to); **no timeouts** (a `while (true) {}` in `render` freezes the tab — the host cannot interrupt synchronous code on its own thread); **no memory limit**. What it gives: no wasm, no worker, no new dependency, synchronous `render` (simpler hook), stack traces that point at the source, and a working demo in a day. The recommendation (D2): eval in the demo and for development; QuickJS before any product where the model sees data a user cares about, because model output is an untrusted input and prompt injection through a tool result is a realistic path to a program that exfiltrates.

**The QuickJS engine** (Phase 5) is vm-system's `QuickJSRuntimeService` + `QuickJSSandboxClient` + `runtime.worker.ts`, ported into `pbui-sandbox/src/engines/quickjs/` with the new bootstrap, the dependency `quickjs-emscripten@0.23.0` (the version vm-system pins), and Vite's `worker: { format: "es" }`. Timeouts come for free; `RUNTIME_TIMEOUT` is surfaced in the tile and the tool result. One context per program *instance*, disposed when the tile closes or the program is removed.

A CSP note that decides deployments: `new Function` needs `script-src 'unsafe-eval'`; QuickJS needs `'wasm-unsafe-eval'`. A product with a strict CSP cannot run the eval engine at all — another reason the interface exists.

### 5.4 The host state a program sees

`globalState` keeps vm-system's three-part shape so the docs stay true, and fills it from pbui:

```ts
interface ProgramGlobalState {
  self:   { instanceId: string; programId: string; viewId: string; placementId: string };
  shared: {
    documents: Record<string, Reference | null>;   // the view's bindings, resolved: { product: {type:"product", id:"2049", value:{…}} }
    env: Record<string, unknown>;                  // the product's descriptor environment, e.g. { canApprove: true }
  };
  system: { engine: "eval" | "quickjs"; version: number /* program version */ };
}
```

`documents` is the capability model of §3.5 with a single read grant: a program may read exactly the objects its view is bound to, resolved by a **product-supplied resolver** `resolve(key, id) → Reference | null`. In the demo that is `world.ts`'s builders (`productReference(productById(id))`); in a chat-backed product it is the reference index (`useReferenceIndex`, `packages/pbui-chat/src/refs/referenceIndex.ts:49`) falling back to an `unresolved` reference. There are **no writable domains in v1** — a program cannot push into the watchlist or the inspector except by emitting the `watch`/`inspect` verbs, which is the correct door.

Program **state** is owned by the host and keyed by **view id**, not placement id, so that two linked placements of one view show one state — the same invariant `AppProps` documents (`apps.ts:4-12`). It lives in a `ProgramStateStore` (a `Map<viewId, unknown>` behind `useSyncExternalStore`) and is **not persisted** in v1 (D11); a reload restarts every program at `initialState`, which the tile's header says.

### 5.5 The host loop, per tile

```
 ScriptApp({ placementId, view })
   programId = view.documents.program
   program   = library.useProgram(programId)            ← re-renders the tile when the source changes
   instance  = useProgramInstance(engine, program, {
                 instanceId: `${view.id}:${program.version}`,
                 globalState: () => ({ self, shared: { documents: resolveAll(view.documents), env }, system }),
                 state: states.for(view.id),            ← shared by linked placements
               })
   ├─ load    when (programId, program.version) changes: dispose old, engine.load(), keep meta
   │           if the previous state renders under the new version → keep it; else → initialState + warning
   ├─ render  when (state, documents, env) change: engine.render() per widget → trees | error
   └─ event   UINodeRenderer onEvent(ref, payload) → engine.event(handler, payload ?? ref.args, state, global)
                → for each intent:
                     plugin  state/merge | state/replace → states.set(view.id, next)      (re-render follows)
                     verb    → perform(verb, { actor: "human", provenance: { programId } }) (router → trace)
                → an unknown scope/actionType → recorded as ignored in the tile's own small log
```

Two things are deliberate. **The instance id includes the version**, so a `sandbox_update_app` is a fresh load rather than a re-evaluation in a dirty context — `loadPlugin` refuses a duplicate id anyway (`runtimeService.ts:299-301`). **Verbs from a generated tile are performed as `actor: "human"`**, because a human clicked; the program id travels as provenance so the trace can answer "which generated thing did this" (D10).

### 5.6 Generated actions

A generated action is a **record**, not code:

```ts
interface ActionRecord {
  id: string;                                  // "act-3", minted by the library
  label: string;                               // "Days of cover"
  types: string[];                             // presentation types it applies to: ["product"]
  behaviour:
    | { kind: "openProgram"; programId: string; bind?: string /* binding key; default: the reference's type */; near?: "active" }
    | { kind: "verb"; verb: VerbLike /* a declared verb with "$ref" / "$ref.id" placeholders */ }
    | { kind: "askAgent"; template: string /* "{0}" is the reference */ };
  danger?: boolean;
  description?: string;                        // one line for the menu and the mouse-doc
  by: "agent" | "human";
  pinned: boolean;
  createdAt: string; updatedAt: string;
}
```

Why three behaviours and no closure: PBUI's rule that a verb is data is not aesthetic — it is what lets the same action be offered in a menu, validated against the vocabulary, recorded in the trace, and *described to the model*. If an action needs logic, the logic is a program (`openProgram`), and the program already has the sandbox, the renderer and the error handling. The three behaviours cover what the agent actually asks for: "open my tile for this", "do the existing thing to this", "ask me about this".

How an action reaches a menu — `withGeneratedActions` in `pbui-sandbox/src/actions.ts`:

```ts
export function withGeneratedActions<Values, Env, Verb>(
  base: PresentationRegistry<Values, Env, Verb>,
  getActions: () => readonly ActionRecord[],
  toVerb: (action: ActionRecord, reference: PresentationReference<Values>) => Verb,   // builds {kind:"action.run", actionId, ref}
): PresentationRegistry<Values, Env, Verb> {
  return {
    ...base,
    actionsFor(reference, environment) {
      const own = base.actionsFor(reference, environment);
      const generated = getActions()
        .filter((a) => a.types.includes(reference.type))
        .map((a) => ({
          id: `generated:${a.id}`,
          label: a.label,
          group: "generated",
          verb: toVerb(a, reference),
          ...(a.danger ? { danger: true } : {}),
          description: a.description ?? `added by the ${a.by}`,
          disabledBecause: a.behaviour.kind === "openProgram" && !programExists(a.behaviour.programId)
            ? `program ${a.behaviour.programId} is no longer in the library` : undefined,
        }));
      return [...own, ...generated];
    },
  };
}
```

Because `ObjectMenu` calls `actionsFor` when it opens, a newly defined action appears in the next menu with no re-registration. The demo wraps its registry once (`pbui/registry.ts`), and `createPbui` is none the wiser.

How an action performs — the product router's `local` handler gains one case:

```ts
case "action.run": {
  const action = library.getState().actions[verb.actionId];
  if (!action) throw new Error(`no generated action ${verb.actionId}`);
  const ref = verb.ref;
  switch (action.behaviour.kind) {
    case "openProgram":
      return ctx.perform({ kind: "program.open", programId: action.behaviour.programId,
                           documents: { [action.behaviour.bind ?? ref.type]: ref.id }, near: "active" }, ref);
    case "verb":
      return ctx.perform(substituteRef(action.behaviour.verb, ref), ref);      // "$ref" → ref, "$ref.id" → ref.id
    case "askAgent":
      return ctx.sendToAgent(action.behaviour.template, [ref]);
  }
}
```

`ctx.perform` re-enters the router, so the trace records both the `action.run` and the verb it expanded to — an audit can see that a generated action, not a menu the product shipped, caused the reorder.

### 5.7 The library

```ts
interface ProgramRecord {
  id: string;                 // "prg-7"
  title: string;
  source: string;             // the definePlugin source, verbatim
  version: number;            // bumped by every update; part of the instance id
  bindings: string[];         // from the plugin's `bindings`, or the tool's argument
  meta: { declaredId?: string; widgets: string[] };   // from getMeta() at store time
  by: "agent" | "human";
  pinned: boolean;
  lastError?: { phase: "load" | "render" | "event"; message: string; at: string };
  createdAt: string; updatedAt: string;
}

interface LibrarySnapshot { schema_version: 1; programs: Record<string, ProgramRecord>; actions: Record<string, ActionRecord> }

interface ProgramLibrary {
  getState(): LibrarySnapshot;
  subscribe(listener: () => void): () => void;
  putProgram(input: Omit<ProgramRecord, "id" | "version" | "createdAt" | "updatedAt"> & { id?: string }): ProgramRecord;  // id present ⇒ update, version++
  removeProgram(id: string): boolean;
  putAction(input: Omit<ActionRecord, "id" | "createdAt" | "updatedAt"> & { id?: string }): ActionRecord;
  removeAction(id: string): boolean;
  setPinned(kind: "program" | "action", id: string, pinned: boolean): boolean;
  recordError(programId: string, error: ProgramRecord["lastError"]): void;
  export(): LibrarySnapshot;
  import(snapshot: LibrarySnapshot, mode: "replace" | "merge"): void;
}
```

`createProgramLibrary({ key, storage?, limits?, onRejected? })` backs it with `localStorage` under `pbui-chat-demo.generated.v1`, written **debounced (300 ms)** and **only on a change to programs or actions** (never on reads), read once at construction, and refreshed from the `storage` event so two tabs converge. Three lessons from AGENT-2's notes tile apply and are designed in rather than discovered: **cap sizes at the door** (`limits.sourceBytes` 64 KiB, `programs` 64, `actions` 64, `totalBytes` 1 MiB — a `putProgram` over the limit throws a message the tool returns verbatim, and nothing is written); **never silently reset on a parse failure** (a corrupt entry is copied to `<key>.corrupt-<timestamp>` and the library starts empty with a visible warning, instead of the `parseDocument → null → default` pattern that costs a user their layout); **debounce so writes scale with edits, not keystrokes**.

What is *not* in the library: program state (D11), the tiles (those are the layout's), the engine (a process, not data).

### 5.8 The tool surface

Seven frontend tools, built by `createSandboxTools(options)` in `packages/pbui-chat/src/tools/sandboxTools.ts` and registered beside the workbench tools. Names are provider-safe; inputs are zod; results always carry the ids the model needs next and an `ok` flag; every error string is written for a model to act on.

| Tool | Input | Output | Policy key |
|---|---|---|---|
| `sandbox_describe` | `{}` | `{ engine, limits, dsl: {kinds[], intents[], globals}, programs: [{id, title, version, bindings, pinned, lastError?, openIn: placementId[]}], actions: [{id, label, types, behaviour, pinned}] }` | — |
| `sandbox_test` | `{ source, documents?: Record<string,string>, state?, events?: [{handler, args?}] }` | `{ ok, meta, tree, intents[], state, error?: {phase, message} }` — loads in a scratch instance, renders, replays events reducing state, disposes; **stores nothing** | — |
| `sandbox_create_app` | `{ title, source, bindings?, documents?, open?: boolean (default true), near?, programId? }` | `{ ok, programId, version, placementId?, viewId?, warnings[] }` | `program.create` (allow), then `program.open` |
| `sandbox_update_app` | `{ programId, source, title? }` | `{ ok, version, warnings[] }` (`"state was reset: initialState keys changed"`) | `program.update` (allow; `confirm` if pinned) |
| `sandbox_define_action` | `{ label, types[], behaviour, danger?, description?, actionId? }` | `{ ok, actionId }` | `action.define` (allow) |
| `sandbox_remove` | `{ programId? \| actionId?, confirmationId? }` | `{ ok, closedTiles: placementId[] }` | `program.remove` / `action.remove` (allow if unpinned and `by: "agent"`; `confirm` otherwise) |
| `sandbox_open` | `{ programId, documents?, near?, title? }` | `{ placementId, viewId, wentToExisting }` | `program.open` (allow) |

`sandbox_create_app`'s validation, in order, each failure returning `{ok:false, phase, error}` with nothing stored: size (`limits.sourceBytes`); `engine.load` in a scratch instance (a `SyntaxError` comes back with line and column from the engine); `getMeta` (at least one widget; `bindings` a string array); a dry `render` of every widget with `initialState` and the given `documents` resolved (an unbound required binding renders the program's own warning, which is fine; a thrown error is not); the `UINode` validator. Only then `library.putProgram`, and only then — if `open` — `perform({kind:"program.open", …})` through the router. The result says which step failed so the model fixes that step.

`sandbox_test` is the model's REPL and the single most valuable tool here. Both prior diaries record the model guessing a nested schema on its first call; a tool that *runs the program and hands back the rendered tree and the intents a click would emit* turns that guess into a loop the model can close on its own, without the user watching a broken tile appear.

The `confirm` decisions depend on the product wiring `isApproved(id, verb)` — AGENT-2's open Tier 4. Until it lands, a pinned program cannot be removed by the agent *at all*, which is the safe failure (the user can, from the menu).

### 5.9 New presentation types and verbs

Added to the demo vocabulary (`demo/src/pbui/{types,verbs,vocabulary}.ts`, descriptors under `demo/src/pbui/descriptors/{program,action}.ts`):

| Type | `idHint` | Verbs | Value carries |
|---|---|---|---|
| `program` | `programId, from sandbox_describe` | `program.open`, `inspect`, `program.pin`, `program.remove` (danger), `askAgent` | `{title, version, bindings, by, pinned, lastError?}` |
| `action` | `actionId, from sandbox_describe` | `inspect`, `action.remove` (danger), `askAgent` | `{label, types, behaviour, by, pinned}` |

and five verb kinds in the zod union, all `family: "local"`:

```ts
z.object({ kind: z.literal("program.open"),   programId: z.string(), documents: z.record(z.string(), z.string()).optional(), near: z.string().optional(), title: z.string().optional() }),
z.object({ kind: z.literal("program.remove"), programId: z.string() }),                       // danger
z.object({ kind: z.literal("program.pin"),    programId: z.string(), pinned: z.boolean() }),
z.object({ kind: z.literal("action.run"),     actionId: z.string(), ref: ReferenceSchema }),
z.object({ kind: z.literal("action.remove"),  actionId: z.string() }),                        // danger
```

`inspect` on a program opens the inspector on `describe()`, which includes the **source** — that is the *view source* door, and it costs nothing because `ChatInspectorPanel` already renders `describe()` output. `program.open` is what `sandbox_open`, `action.run`'s `openProgram` and the launcher rows all perform; its handler is one line: `wb.verbs.openView("script", { program: programId, ...documents }, { near, title })`.

The vocabulary also gains an optional `sandbox` block so the Go prompt is generated from the same declaration (D12):

```jsonc
"sandbox": { "schema_version": 1, "kinds": ["panel","row","column","text","badge","button","input","select","table","meter","sparkline","callout","ref"],
             "intents": ["state/merge","state/replace","verb"] }
```

### 5.10 The model is told

`pkg/pbuichat/prompt.go` gains `sandboxSection(v)`, emitted only when `v.KnowsType("program")` and `v.Sandbox != nil`. In prose, with one complete program (the §3.7 counter, because it is short and the docs' own), the kinds from `v.Sandbox.Kinds`, the intents, the `globalState` shape, the seven rules, and the workflow: *call `sandbox_test` first; create only a program whose test rendered; bind objects through `documents`, never by copying their fields into the source; perform product verbs with `dispatchVerb` using only the kinds listed above; mention what you made.* The tool names are Go constants beside the workbench ones (`prompt.go:15-21`) so the prompt and the browser cannot disagree by a typo.

### 5.11 Safety: limits, policy, trust

**Limits** (a plain object, refuse and explain):

```ts
interface SandboxLimits {
  sourceBytes: number;        // 65_536
  programs: number;           // 64
  actions: number;            // 64
  libraryBytes: number;       // 1_048_576
  treeNodes: number;          // 2_000   (UINode validator counts)
  treeDepth: number;          // 16
  textChars: number;          // 4_096 per text/badge node
  tableRows: number;          // 500
  intentsPerEvent: number;    // 16
  // QuickJS only:
  memoryBytes: number;        // 32 MiB
  stackBytes: number;         // 1 MiB
  loadMs: number;             // 1000
  renderMs: number;           // 100
  eventMs: number;            // 100
}
```

**Policy** — the same three decisions as the workbench tools, over capabilities rather than tool names (AGENT-2 diary step 5: "policy must wrap capabilities, not tool names"):

```ts
const DEFAULT_SANDBOX_POLICY = {
  "program.create": "allow",
  "program.update": "allow",          // "confirm" when the program is pinned
  "program.open":   "allow",
  "program.run":    "allow",          // set to "confirm" to require approval before agent code first executes (recommended under eval in a product)
  "program.remove": "allow",          // "confirm" when pinned or by:"human"
  "action.define":  "allow",
  "action.remove":  "allow",          // "confirm" when pinned or by:"human"
};
```

A `confirm` is `pbui_propose` + `isApproved(id, verb)` + one-shot spending, unchanged. When `program.run` is `confirm`, the proposal's body is the source in a code fence, so the human sees exactly what will execute.

**Trust boundary**, per engine:

| | eval (v1) | QuickJS (Phase 5) |
|---|---|---|
| can reach the DOM / `fetch` / storage | yes, if it tries (shadowing is a speed bump) | no |
| can hang the tab | yes (`while(true)` in render) | no — `RUNTIME_TIMEOUT` after 100 ms |
| can exhaust memory | yes | no — 32 MiB |
| can leak host objects | no (cloned at the boundary) | no |
| can perform a verb the vocabulary does not declare | no (router rejects) | no |
| can perform a `danger` verb without a human | no (router/policy) | no |
| visible provenance | `by: agent`, version, *view source* | same |

The honest summary for the prompt-injection case: with eval, a program the model was tricked into writing can read `localStorage` (which holds the chat session id and the layout) and post it anywhere; with QuickJS it can render a misleading tile and emit verbs the router will refuse or trace. That is the difference between "a demo" and "a product", and it is why D2 sequences the engines the way it does.

### 5.12 Decision records

#### Decision: D1 — the dialect is vm-system's `definePlugin`, not React/JSX and not a widget-document extension

- **Context:** The model has to write *something* that becomes an interactive tile. Three candidates: let it write React/JSX compiled in the browser; extend the `pbui.widget` document with a `script` child; adopt vm-system's `definePlugin` program.
- **Options considered:** React/JSX (maximal power; needs a compiler in the browser, gives the model the DOM, un-sandboxable without an iframe, untestable without rendering); widget-document extension (keeps one dialect, but the widget document is declarative and has no state or handlers — adding them turns it into a programming language by accident); `definePlugin` (pure render + intents, documented, with worked examples, already sandboxed in its origin, engine-agnostic).
- **Decision:** `definePlugin`, byte-compatible with vm-system where free, extended with `ref`, a few atoms, `dispatchVerb`, `bindings` and the `documents`/`env` domains.
- **Rationale:** The pattern's four properties (§3.1) are exactly the properties an untrusted, model-written program must have; its docs can be handed to the model nearly verbatim; and the engine can be swapped under it.
- **Consequences:** Programs cannot do async work, timers or network — by design; anything that needs data asks for it through bindings. The renderer must cover the DSL with PBUI atoms. Must validate: the model reliably writes this dialect from the prompt's one example (AGENT-2's experience says yes for nested JSON; `sandbox_test` is the safety net).
- **Status:** accepted.

#### Decision: D2 — an `eval` engine first, QuickJS-in-a-worker second, behind one `ProgramEngine` interface

- **Context:** The user said "if that makes it easier you can also just use eval()". QuickJS costs a wasm dependency, a worker, async render and a Vite config; eval costs isolation and timeouts.
- **Options considered:** QuickJS only (correct, slower to first demo); eval only (fast, unshippable to a product); both, behind vm-system's `RuntimeHostAdapter` shape.
- **Decision:** Both. Phase 0 ships `createEvalEngine()`; Phase 5 ships `createQuickJsEngine()`; the demo defaults to eval and the option is one line.
- **Rationale:** The interface already exists in the pattern's origin, the bootstrap is one string shared by both, and the host loop is written against the async interface from day one so that switching engines changes no component.
- **Consequences:** The guide must state eval's trust boundary without softening (§5.11). The host loop is async even when the engine is sync. CSP decides which engine a deployment can use. Must validate: the same test programs pass on both engines (the engine conformance suite, §9).
- **Status:** accepted.

#### Decision: D3 — render the UI tree with PBUI atoms, not a port of vm-system's renderer

- **Context:** vm-system's `WidgetRenderer` emits Tailwind-styled raw DOM; pbui's structural tests forbid raw controls and colour literals, and the tile overflow defect (WORKBENCH-1 §7.5) is a grid-columns rule.
- **Options considered:** port the renderer and exempt it from the tests; write a new renderer over pbui atoms.
- **Decision:** A new `UINodeRenderer` over `Button`, `TextInput`, `SelectInput`, `Chip`, `Meter`, `Sparkline`, `Callout`, `Text`, `Stack`, `Toolbar`, with `ref` → `Presentation`, a `min-width: 0` scroll container for tables, and `data-part` names.
- **Rationale:** A generated tile must be indistinguishable in chrome, tokens, keyboard behaviour and object menus from a shipped one; that is what makes it part of the product.
- **Consequences:** Kinds are limited to what pbui has atoms for; new kinds are a closed-set change in the bootstrap, the validator, the renderer and the vocabulary's `sandbox.kinds`. Must validate: `no-raw-controls` and `no-hex` extended to `pbui-sandbox`.
- **Status:** accepted.

#### Decision: D4 — the vocabulary stays closed; generated things are payloads of five fixed verb kinds

- **Context:** Every verb is validated against `vocabulary.json` on both sides; a per-program or per-action verb kind would require regenerating and re-embedding the vocabulary at runtime, which is impossible by construction (the Go binary embeds it).
- **Options considered:** runtime-extensible vocabulary (a second validation path, server and client); generic kinds with the artifact id as a field.
- **Decision:** `program.open`, `program.remove`, `program.pin`, `action.run`, `action.remove`, declared once.
- **Rationale:** Keeps the single source of truth rule; the prompt, `pbui_describe_types` and the Go validator need one regeneration.
- **Consequences:** The trace records `action.run{actionId}` plus the expanded verb (two entries); descriptions of generated actions come from the library, not the vocabulary. Must validate: `exportVocabulary()` round-trips through Go's `ParseVocabulary` with the new `sandbox` block.
- **Status:** accepted.

#### Decision: D5 — persistence is a separate `localStorage` library; tiles bind by id

- **Context:** Programs could live in `WorkbenchDocument.documents` (`DocumentPayload{format:"pbui.program"}`), already persisted with the layout and written through `documentPut` (the notes tile proves it), or in their own store.
- **Options considered:** in the document (one persistence path, travels with a hosted workbench later, `document_in_use` guard for free); a separate library (outlives layouts, can be exported alone, smaller writes).
- **Decision:** A separate library; `view.documents.program` carries the id, the same way `sku` carries a product.
- **Rationale:** `resetLayout()` (`demo/src/workbench.ts:75-79`) replaces the whole document — a program stored there would vanish with a layout reset, which is the wrong thing to lose. The library also holds *actions*, which belong to no view. And the whole-document write on every change (AGENT-2 diary step 1) argues against making the document larger.
- **Consequences:** A tile whose program was removed shows an empty state; there is no `document_in_use` guard, so `sandbox_remove` closes bound tiles itself and reports them. A hosted library later is a store adapter, not a redesign. Must validate: reload restores programs, actions and the tiles showing them; `reset layout` keeps the library.
- **Status:** accepted.

#### Decision: D6 — a generated action is data with three behaviours, never a closure in a descriptor

- **Context:** "Allow creating new actions for certain types" could be read as installing model-written functions into `actions()`.
- **Options considered:** JS closures in descriptors (breaks *verbs are data*, untraceable, unvalidatable, unprompteable); records with `openProgram` / `verb` / `askAgent`.
- **Decision:** Records; logic lives in programs.
- **Rationale:** Every consumer of an action — menu, trace, vocabulary, prompt, accept mode — already handles data and cannot handle closures.
- **Consequences:** An action that needs a computation opens a program, which costs a tile; a future `{kind:"program-verb"}` behaviour could run a program's handler without a tile if a need appears. Must validate: a defined action shows in the next menu, performs through the router, and disables itself when its program is gone.
- **Status:** accepted.

#### Decision: D7 — one host app `script`, doc-bound to `program`, rather than one `AppDescriptor` per program

- **Context:** `createAppRegistry` is immutable.
- **Options considered:** a mutable registry in `pbui-workbench` (new API, a second way to register, invalidation of `describeWorkbench`); one doc-bound app.
- **Decision:** One app; programs are documents; `titleFor` reads the program's title; launcher rows for programs come from the product's `rows`.
- **Rationale:** Zero change to `pbui-workbench`; the binding mechanism, de-dup rule and `describeWorkbench` work unchanged; "open prg-7 twice" goes to the existing tile.
- **Consequences:** `workbench_describe` lists one `script` app and the programs are found through `sandbox_describe` — the prompt must say so. Must validate: `openView("script", {program:"prg-7"})` twice yields `wentToExisting`.
- **Status:** accepted.

#### Decision: D8 — a new package `@hyperslop-systems/pbui-sandbox`, not code inside `pbui-chat`

- **Context:** The engine, renderer, library and script app are useful to a PBUI product with no chat (datalab-ui, agentlogic) and must stay domain-neutral.
- **Options considered:** inside `pbui-chat` (fewer packages, but `pbui-chat` would own an engine); inside `pbui-workbench` (it is not about layout); a new package.
- **Decision:** `packages/pbui-sandbox`, depending on `@hyperslop-systems/pbui` and (for the script app) `pbui-workbench`; `pbui-chat` depends on it for the tools.
- **Rationale:** Mirrors how `pbui-workbench` was split from `pbui-chat` in WORKBENCH-1; the tests (`no-raw-controls`, `no-hex`, `component-folders`) apply per package.
- **Consequences:** One more `publish-*.yml`, one more `dist` the demo consumes (the `dist`-not-source trap applies). Must validate: `make chat-ui` builds it before `pbui-chat`.
- **Status:** accepted.

#### Decision: D9 — `sandbox_test` exists and the prompt tells the model to call it first

- **Context:** Every AGENT-1/2 tool mutates; the model's first call to a new tool tends to guess.
- **Options considered:** rely on `create`'s validation and retries (the user watches failures); a dry-run tool.
- **Decision:** `sandbox_test` — load, render, replay events, return tree/intents/state/error, store nothing.
- **Rationale:** It closes the model's loop without a user in it, and it is cheap: the same code path `create` runs, minus the store.
- **Consequences:** One more manifest entry; tree output is pruned (depth, node count) so a tool result stays small. Must validate: the scripted scenario exercises it.
- **Status:** accepted.

#### Decision: D10 — verbs emitted from a generated tile are performed as `actor: "human"` with program provenance

- **Context:** A click inside a generated tile is a human act on agent-written UI.
- **Options considered:** `actor: "agent"` (wrong: the agent did not click); `actor: "human"` with provenance.
- **Decision:** `human`, plus `provenance: { programId }` on the reported verb.
- **Rationale:** The trace's actor answers "who decided"; the provenance answers "through what".
- **Consequences:** `createVerbRouter.perform` gains an optional `provenance` in `PerformOptions`, carried into the POST body (`VerbPerformedCommand.verb` is a `Struct`, so it rides inside the verb as `_provenance` without a proto change). Must validate: the trace entry for a generated-tile reorder shows the program.
- **Status:** proposed (the `PerformOptions` extension touches `pbui-chat`'s public API).

#### Decision: D11 — program state is host-owned, keyed by view id, not persisted in v1

- **Context:** Where does a counter's count live, and does it survive reload?
- **Options considered:** in the library (persisted, but a program update would have to migrate it); in the layout document (no: layout is layout); in memory keyed by view id.
- **Decision:** In memory, keyed by view id (linked placements share), reset to `initialState` on reload and on an incompatible update; an opt-in `persistState` later.
- **Rationale:** vm-system keeps state host-side and ephemeral; persistence invites stale-state bugs that are invisible until a program changes shape.
- **Consequences:** The tile header says "state resets on reload"; `sandbox_update_app` returns a warning when it reset state. Must validate: two linked placements of one program tile share a count.
- **Status:** accepted.

#### Decision: D12 — the UI kinds and intents are declared in `vocabulary.json` (`sandbox` block), so Go's prompt is generated, not hand-written

- **Context:** The prompt must list the kinds; hard-coding them in Go means two lists.
- **Options considered:** hard-code in `prompt.go`; add an optional `sandbox` block to the vocabulary.
- **Decision:** The block; `Vocabulary.Sandbox *SandboxVocabulary` validated against the kinds Go knows (as `Widget.Kinds` is).
- **Rationale:** The vocabulary is already the single source of truth and already has a precedent (`widget.kinds`).
- **Consequences:** A new kind is a four-place change (bootstrap, validator, renderer, `sandbox.kinds`) caught by the round-trip test. Must validate: `TestSandboxPromptSectionIsGatedOnTheProgramType`.
- **Status:** accepted.

#### Decision: D13 — no server-side execution in v1; a goja dry-run is an optional Phase 6

- **Context:** vm-system's Go half can evaluate the same bootstrap in goja; a backend `pbui_sandbox_check` could lint a program before it reaches the browser.
- **Options considered:** validate only in the browser; validate on the server too (vm-system daemon over REST, or `dop251/goja` in-process).
- **Decision:** Browser only in v1; Phase 6 optional.
- **Rationale:** `sandbox_test` already gives the model a full run; a server check adds a dependency and a second bootstrap copy for a partial benefit (syntax and `getMeta`, not rendering with real bindings).
- **Consequences:** Programs never cross the Go side in v1, so the Go limits do not apply to them. Must validate: nothing; revisit if programs are ever stored server-side.
- **Status:** accepted.

#### Decision: D14 — `dispatchSharedAction` is not exposed in v1

- **Context:** vm-system's shared domains let plugins talk to each other under grants.
- **Options considered:** expose it with zero writable domains (every call `ignored`); omit it.
- **Decision:** Omit; a call is a `ReferenceError` the model sees at `sandbox_test` time.
- **Rationale:** An intent that is always ignored teaches the model a door that goes nowhere.
- **Consequences:** Program-to-program communication waits for a real use (§12). Status: accepted.

---

## 6 · Implementation

Six phases. Each ends with something you can see in a browser, and each states its acceptance as a gesture. Commit at every phase; `lefthook` runs the Go gate only for commits touching `*.go` (`lefthook.yml`: `glob: "*.go"`), so TypeScript-only phases commit fast and Phase 2's Go edits should be finished before their commit.

### Phase 0 — the package and the eval engine

**0.1 · Scaffold `packages/pbui-sandbox`.** Copy `packages/pbui-workbench/{package.json,tsconfig.json,tsconfig.build.json,vite.config.ts}` and rename: name `@hyperslop-systems/pbui-sandbox`, description "A reactive sandbox for agent-written programs: the definePlugin dialect, a swappable engine, a PBUI renderer, a local library", port 6009 for Storybook. Dependencies: `@hyperslop-systems/pbui: workspace:^`, `@hyperslop-systems/pbui-workbench: workspace:^`, `zod`. Add it to `pnpm-workspace.yaml` (already `packages/*`), to the `chat-ui` Makefile target **before** `pbui-chat`, and to `.github/workflows/publish-pbui-sandbox.yml` (copy the workbench one).

**0.2 · `src/contracts.ts`** — the types, ported from vm-system `contracts.ts` + `uiTypes.ts` with the §5.2 additions:

```ts
export type UIEventRef = { handler: string; args?: unknown };
export type UINode =
  | { kind: "panel" | "row" | "column"; props?: { title?: string; gap?: 1 | 2 | 3 }; children?: UINode[] }
  | { kind: "text";   text: string; props?: { size?: "tiny" | "small" | "body" | "title"; tone?: "faint" | "default"; strong?: boolean } }
  | { kind: "badge";  text: string; props?: { tone?: string } }
  | { kind: "button"; props: { label: string; onClick?: UIEventRef; variant?: "primary" | "framed" | "destructive"; disabled?: boolean } }
  | { kind: "input";  props: { value: string; placeholder?: string; type?: "text" | "number"; onChange?: UIEventRef } }
  | { kind: "select"; props: { value: string; options: { value: string; label: string }[]; onChange?: UIEventRef } }
  | { kind: "table";  props: { headers: string[]; rows: unknown[][] } }
  | { kind: "meter";  props: { fraction: number; label?: string; value?: string } }
  | { kind: "sparkline"; props: { points: number[]; label?: string } }
  | { kind: "callout"; props: { variant?: "neutral" | "warning" | "positive" | "danger"; title?: string; text: string } }
  | { kind: "ref";    props: { reference: { type: string; id: string; value?: Record<string, unknown> }; label?: string } };

export type DispatchIntent =
  | { scope: "plugin"; actionType: "state/merge" | "state/replace" | (string & {}); payload?: unknown; instanceId?: string }
  | { scope: "verb"; verb: { kind: string } & Record<string, unknown>; instanceId?: string };

export interface LoadedProgram { programId: string; instanceId: string; declaredId?: string; title: string; description?: string; initialState?: unknown; bindings: string[]; widgets: string[] }
export interface ProgramErrorPayload { code: "RUNTIME_ERROR" | "RUNTIME_TIMEOUT" | "VALIDATION_ERROR" | "UNKNOWN_ERROR"; message: string; phase?: "load" | "render" | "event" }
```

**0.3 · `src/bootstrap.ts`** — `BOOTSTRAP_SOURCE`, vm-system's string (`runtimeService.ts:13-127`) with: `__ui.counter` removed; `__ui.select/meter/sparkline/callout/ref` added; `getMeta()` also returning `bindings` (a string array or `[]`); `event()` building `dispatchVerb` instead of `dispatchSharedAction`:

```js
const dispatchVerb = (verb) => {
  if (!verb || typeof verb !== "object" || typeof verb.kind !== "string") throw new Error("dispatchVerb needs an object with a string kind");
  __dispatchIntents.push({ scope: "verb", verb });
};
```

Keep it a string literal so both engines evaluate exactly the same text; export a `BOOTSTRAP_VERSION` constant and include it in `sandbox_describe`.

**0.4 · `src/validate/{uiSchema,intents}.ts`** — port `assertUINode` (`uiSchema.ts:16-93`) with the new kinds and the node/depth/text/rows counters from `SandboxLimits`; port `validateDispatchIntents` (`dispatchIntent.ts:7-47`) with the `verb` scope and `intentsPerEvent`. Keep the error style: `root.children[2].props.onClick.handler must be a non-empty string`.

**0.5 · `src/engine.ts`** — the interface (§5.3) and `toProgramError(error, phase)` (port of `toRuntimeError`, `runtimeService.ts:242-255`).

**0.6 · `src/engines/evalEngine.ts`:**

```ts
export function createEvalEngine(limits: SandboxLimits = DEFAULT_LIMITS): ProgramEngine {
  const hosts = new Map<string, { programId: string; host: PluginHost }>();
  return {
    kind: "eval",
    async load({ instanceId, programId, source }) {
      if (hosts.has(instanceId)) throw new Error(`program instance already exists: ${instanceId}`);
      if (byteLength(source) > limits.sourceBytes) throw new Error(`source is ${byteLength(source)} bytes, limit ${limits.sourceBytes}`);
      const factory = new Function(...SHADOWED, `"use strict";\n${BOOTSTRAP_SOURCE}\n${source}\n;return __pluginHost;`);
      const host = factory(...SHADOWED.map(() => undefined)) as PluginHost;          // evaluates bootstrap + source
      const meta = validateLoadedProgramMeta(programId, instanceId, host.getMeta());  // port of runtimeService.ts:210-240
      hosts.set(instanceId, { programId, host });
      return meta;
    },
    async render({ instanceId, widgetId, pluginState, globalState }) {
      const { host } = get(instanceId);
      const tree = host.render(widgetId, clone(pluginState), clone(globalState));
      return validateUINode(clone(tree), limits);
    },
    async event({ instanceId, widgetId, handler, args, pluginState, globalState }) {
      const { host } = get(instanceId);
      const intents = host.event(widgetId, handler, clone(args), clone(pluginState), clone(globalState));
      return validateDispatchIntents(clone(intents), instanceId, limits);
    },
    async dispose(instanceId) { return hosts.delete(instanceId); },
    async health() { return { ready: true, instances: [...hosts.keys()] }; },
  };
}
```

`clone` is `structuredClone` with a `JSON.parse(JSON.stringify())` fallback; it is what keeps the boundary honest on a shared heap.

**0.7 · Tests** — port `uiSchema.test.ts`, `dispatchIntent.test.ts`, and `runtimeService.integration.test.ts` (the counter and column plugins) as `evalEngine.test.ts`; write them against `ProgramEngine` so Phase 5 reruns them unchanged (`describe.each([evalEngine, quickjsEngine])`). Add: `dispatchVerb` emits a `verb` intent; a `ref` node validates; a 3-deep `panel` tree over `treeNodes` is refused with the path; `document` is `undefined` inside a program.

**Acceptance (Phase 0).** `pnpm --filter @hyperslop-systems/pbui-sandbox test` passes; `createEvalEngine().load(…)` on the §3.7 counter returns `{ title: "Minimal Counter", widgets: ["main"] }`, `render` returns the column tree, `event("increment")` returns one `state/merge` intent.

### Phase 1 — the renderer, the library, the host loop, the tile

**1.1 · `src/render/UINodeRenderer.tsx`:**

```tsx
export interface UINodeRendererProps {
  tree: UINode | null;
  onEvent(ref: UIEventRef, payload?: unknown): void;
  /** How a `ref` node becomes a presentation — the product's `<Presentation>`; the renderer stays pbui-instance-agnostic. */
  renderReference(reference: { type: string; id: string; value?: Record<string, unknown> }, label: string): ReactNode;
}
// kind → atom
// panel   → <Surface tone="pane" border="soft"><Stack gap>…</Stack></Surface>   (props.title → a <Text size="small" strong> header)
// row     → <Toolbar tight> (wraps)          column → <Stack gap={props.gap ?? 2}>
// text    → <Text size tone strong>          badge  → <Chip tone>
// button  → <Button variant tone={variant==="destructive" ? "danger" : undefined} disabled onClick={() => onEvent(onClick, onClick.args)}>
// input   → <TextInput value type placeholder onValueChange={(v) => onEvent(onChange, { value: v })}>
// select  → <SelectInput value options onValueChange={(v) => onEvent(onChange, { value: v })}>
// table   → <div data-part="sandbox-table" className={styles.scroll}><table>…</table></div>   (min-width:0 chain; the R6 rule)
// meter   → <Meter fraction value accessibleName={label}>   sparkline → <Sparkline points accessibleName={label}>
// callout → <Callout variant title>{text}</Callout>
// ref     → renderReference(props.reference, props.label ?? "")
```

The module's CSS states `grid-template-columns`/`min-width: 0` explicitly (`grid-columns.test.ts`), uses only `var(--pbui-*)` tokens (`no-hex`), and renders no raw `<button>`/`<input>` (`no-raw-controls`). Add `packages/pbui-sandbox` to the three structural tests' scan roots.

**1.2 · `src/library.ts`** — `createProgramLibrary` per §5.7 and a `useLibrary(library, selector)` over `useSyncExternalStore` (same shape as `useWorkbenchStore`, `store.ts:151-157`). Id minting: `prg-<n>`/`act-<n>` from a counter stored in the snapshot, so ids are stable and short for a model. Persistence:

```ts
function persist() { clearTimeout(timer); timer = setTimeout(() => storage.setItem(key, JSON.stringify(state)), 300); }
function restore(): LibrarySnapshot {
  const raw = storage.getItem(key);
  if (!raw) return EMPTY;
  try { return migrate(JSON.parse(raw)); }
  catch (error) { storage.setItem(`${key}.corrupt-${Date.now()}`, raw); onRejected?.("restore", error); return EMPTY; }
}
window.addEventListener("storage", (e) => { if (e.key === key) { state = restore(); emit(); } });
```

**1.3 · `src/state.ts`** — `createProgramStateStore()`: `get(viewId)`, `set(viewId, next)`, `reset(viewId)`, `subscribe`, keyed by view id (D11).

**1.4 · `src/host/useProgramInstance.ts`** — the loop of §5.5 as a hook. Pseudocode of the reducer half, because it is where intents become effects:

```ts
async function onEvent(widgetId: string, ref: UIEventRef, payload?: unknown) {
  let intents: DispatchIntent[];
  try { intents = await engine.event({ instanceId, widgetId, handler: ref.handler, args: payload ?? ref.args, pluginState: states.get(viewId), globalState: globalState() }); }
  catch (error) { setError(toProgramError(error, "event")); library.recordError(programId, …); return; }
  for (const intent of intents) {
    if (intent.scope === "plugin") {
      const current = states.get(viewId);
      if (intent.actionType === "state/replace") states.set(viewId, intent.payload ?? {});
      else if (intent.actionType === "state/merge" && isRecord(intent.payload)) states.set(viewId, { ...asRecord(current), ...intent.payload });
      else log({ intent, outcome: "ignored", reason: "no-local-reducer-match" });      // vm-system's wording
    } else if (intent.scope === "verb") {
      const outcome = await options.perform(intent.verb, { provenance: { programId } });   // router: validates, performs, traces
      log({ intent, outcome: outcome === "performed" ? "applied" : "denied", reason: outcome });
    }
  }
}
```

`log` is a bounded per-instance ring (50 entries) shown in the tile's *details* disclosure — vm-system's timeline, scaled down to one program.

**1.5 · `src/ScriptApp.tsx`** — `createScriptApp(options)`:

```ts
export interface ScriptAppOptions {
  library: ProgramLibrary; engine: ProgramEngine; states: ProgramStateStore;
  resolve(key: string, id: string): Reference | null;            // bindings → references (product-owned)
  env(): Record<string, unknown>;                                 // globalState.shared.env
  perform(verb: VerbLike, options?: { provenance?: { programId: string } }): Promise<Outcome>;
  renderReference: UINodeRendererProps["renderReference"];
  policy?: Pick<SandboxPolicy, "program.run">; isApproved?(id: string, verb: VerbLike): boolean;
}
export const PROGRAM_BINDING = "program";
export function createScriptApp(o: ScriptAppOptions): AppDescriptor {
  return defineApp({
    id: "script", title: "program", tone: "var(--pbui-tone-widget)",
    singleton: false, docBound: true, duplicable: false, bindings: [PROGRAM_BINDING],
    group: "GENERATED", blurb: "a program the agent wrote, running in the sandbox",
    titleFor: (view) => view.title || o.library.getState().programs[view.documents[PROGRAM_BINDING] ?? ""]?.title || `program ${view.documents[PROGRAM_BINDING] ?? ""}`,
    Component: (props) => <ScriptTile {...props} options={o} />,
  });
}
```

`ScriptTile` renders: a header row (`<Chip>` "generated · v3 · by agent", the *details* toggle), the widgets' trees through `UINodeRenderer` (or a `Callout` for a load/render error with an *Ask the agent to fix* `Button` that performs `askAgent` with the error and `[[program:id]]`), and an `EmptyState` when the program id is missing from the library ("this program was removed; close the tile or ask the agent to recreate it").

**1.6 · Demo registration** (`demo/src/workbench.ts`):

```ts
export const library = createProgramLibrary({ key: "pbui-chat-demo.generated.v1" });
export const engine = createEvalEngine();
export const programStates = createProgramStateStore();
export const workbench = createWorkbench({
  apps: [...createChatApps(chat), ...createDemoApps(), createScriptApp({
    library, engine, states: programStates,
    resolve: resolveDemoBinding,                       // "product" → productReference(productById(id)), "metal" → …, else reference index / unresolved
    env: () => ({ canApprove: currentEnvironment().canApprove }),
    perform: (verb, o) => router.perform(verb as Verb, undefined, { actor: "human", ...o }),
    renderReference: (reference, label) => <chat.pbui.Presentation reference={toPresentationReference(reference)} inComposite>{label || chat.labelFor(reference)}</chat.pbui.Presentation>,
  })],
  …
});
```

and a `rows` for the launcher that lists programs under a GENERATED group, choosing one performing `program.open`.

**Acceptance (Phase 1).** With a program put into the library by hand from the console (`library.putProgram({title:"Counter", source: COUNTER, bindings: [], by:"human", pinned:false, meta:{widgets:["main"]}})`) and `workbench.verbs.openView("script", {program: "prg-1"})`, a tile shows the counter, `+` increments, a second linked placement shows the same count, a reload shows the tile again at 0.

### Phase 2 — the model can do it: tools, vocabulary, prompt

**2.1 · `packages/pbui-chat/src/tools/sandboxTools.ts`** — `createSandboxTools(options)` with

```ts
export interface SandboxToolsOptions {
  getLibrary(): ProgramLibrary | null; getEngine(): ProgramEngine | null; getWorkbench(): Workbench | null;
  perform(verb: VerbLike): Promise<Outcome>;                      // the router, actor "agent"
  resolve(key: string, id: string): Reference | null;             // to dry-render with real bindings
  limits?: Partial<SandboxLimits>; policy?: Partial<SandboxPolicy>;
  isApproved?(confirmationId: string, verb: VerbLike): boolean;
}
```

and the seven tools of §5.8. The shared validation path:

```ts
async function check(source: string, documents: Record<string, string>, state?: unknown, events: {handler; args?}[] = []): Promise<CheckResult> {
  const engine = options.getEngine()!; const instanceId = `check-${++n}`;
  try {
    const meta = await engine.load({ instanceId, programId: "check", source });             // phase: load  (SyntaxError, no definePlugin, bad widgets)
    const globalState = { self: {…}, shared: { documents: resolveAll(documents), env: {} }, system: { engine: engine.kind, version: 0 } };
    let pluginState = meta.initialState ?? {};
    const trees: Record<string, UINode> = {};
    for (const w of meta.widgets) trees[w] = await engine.render({ instanceId, widgetId: w, pluginState, globalState });   // phase: render
    const intents: DispatchIntent[] = [];
    for (const e of events) {
      const out = await engine.event({ instanceId, widgetId: meta.widgets[0]!, handler: e.handler, args: e.args, pluginState, globalState }); // phase: event
      intents.push(...out); pluginState = reduce(pluginState, out);
    }
    return { ok: true, meta, trees: prune(trees), intents, state: pluginState };
  } catch (error) { return { ok: false, ...toProgramError(error) }; }
  finally { await engine.dispose(instanceId); }
}
```

`sandbox_create_app.execute` = policy(`program.create`) → `check(source, documents)` → `library.putProgram` → (if `open`) `performWithPolicy({kind:"program.open", programId, documents, near})` → diff tiles before/after to report `placementId`/`viewId` (the pattern from `workbenchTools.ts:490-547`). Reuse `performWithPolicy`/`checkPolicy` by extracting them from `workbenchTools.ts` into `tools/policy.ts` — the AGENT-2 diary's "one policy door" should not become two files.

**2.2 · Register** in `createPbuiChat.tsx`: `options.sandbox?: { getLibrary, getEngine, resolve, … }`; tools spread into `extension.tools`; `attachSandbox(library, engine)` that sets the refs and calls `syncManifest()` — the same shape as `attachWorkbench`.

**2.3 · Vocabulary.** `demo/src/pbui/types.ts`: `ProgramValue`, `ActionValue`, `Values.program`, `Values.action`, `TONES`. `verbs.ts`: the five kinds + `VERB_DOCS`. `descriptors/{program,action}.ts`. `registry.ts`: wrap with `withGeneratedActions(base, () => Object.values(library.getState().actions), (a, ref) => ({ kind: "action.run", actionId: a.id, ref: fromPresentationReference(ref) }))`. `vocabulary.ts`: `sandbox: { kinds: SANDBOX_UI_KINDS, intents: ["state/merge","state/replace","verb"] }` (export `SANDBOX_UI_KINDS` from `pbui-sandbox`). `chat.ts`: `FAMILIES` entries and the `local` cases (`program.open` → `openView("script", …)`; `program.remove` → `library.removeProgram` + close bound tiles; `program.pin`; `action.run` per §5.6; `action.remove`). Then `pnpm --filter @hyperslop-systems/pbui-chat-demo vocab`.

**2.4 · Go.** `vocabulary.go`: `Sandbox *SandboxVocabulary{SchemaVersion int; Kinds, Intents []string}` with `knownSandboxKinds` validated in `Validate()`. `prompt.go`: constants `ToolSandboxDescribe…ToolSandboxOpen`; `sandboxSection(v)` gated on `KnowsType("program") && v.Sandbox != nil`; appended after `workbenchSection`. Tests beside `TestWorkbenchPromptSectionIsGatedOnTheTileType` (`pbuichat_test.go:342`): gated positive/negative, names every sandbox tool, lists every kind in `v.Sandbox.Kinds`.

**Acceptance (Phase 2).** `GOWORK=off go run ./cmd/pbui-chat prompt` prints the sandbox section; with `devctl up` and a real profile, "make me a counter tile" produces a `sandbox_test` then a `sandbox_create_app`, and the tile appears; the trace shows `program.open` with `actor: agent`.

### Phase 3 — generated actions

**3.1** `sandbox_define_action` validation: every `types[]` entry is a vocabulary type; `openProgram.programId` exists; a `verb` behaviour's verb, with `"$ref"` substituted by a dummy reference of the first type, passes `validateVerb`; an `askAgent.template` contains `{0}`. **3.2** `withGeneratedActions` wiring (Phase 2.3 already placed it; this phase tests it). **3.3** The `action` descriptor: *Inspect* (shows the record), *Remove* (danger), *Ask the agent to change this*. **3.4** `program.pin`/`action.remove` as human verbs from the menus.

**Acceptance (Phase 3).** "add an action *Days of cover* to products that opens the days-of-cover tile" → `sandbox_define_action`; right-click any product in the inventory tile → *Days of cover* under a *generated* group → a `script` tile bound to that product opens; the trace shows `action.run` then `program.open`; reload; the action is still there.

### Phase 4 — without a model, and when things break

**4.1** `pkg/chatserver/scripted/scenarios.go`: a `programScenario` on "make me a … tile"/"counter"/"calculator" that calls `sandbox_test` then `sandbox_create_app` with a canned program through `t.frontendTool` (AGENT-2 Tier 4's helper — add it beside `humanTool`, `engine.go:264`, with the frontend-auto mode). **4.2** `pkg/chatserver/server_test.go`: a bridged `sandbox_create_app` answered by a fake browser; assert the tool-call entity and the trace entry. **4.3** Error tiles: a program whose `render` throws shows the message and the *fix* chip; `sandbox_update_app` with a bad source returns the error and leaves the old version running (the tile never flickers to broken). **4.4** Limits tests: a 65 KiB source, a 2001-node tree, 17 intents, 65 programs — each refused with its message.

**Acceptance (Phase 4).** `make chat-serve` with no credentials; type "make me a counter tile"; the tile appears; type "break it"; the scenario updates it with a throwing render; the tile shows the error; clicking *fix* sends the error to the (scripted) agent, which restores it.

### Phase 5 — QuickJS

**5.1** `src/quickjs/{runtimeService,protocol,worker,workerEngine,directEngine}.ts` ported from vm-system with the shared bootstrap and `ProgramEngine` names, behind a second package entry `@hyperslop-systems/pbui-sandbox/quickjs` so eval-only consumers never import the wasm (`quickjs-emscripten` is externalised in the library build). **As built, the worker is created by the consumer**: the library ships the worker *body* (`installQuickJsWorker()`), the consumer ships a one-line worker *file* (`demo/src/sandbox.worker.ts`) and passes `new Worker(new URL("./sandbox.worker.ts", import.meta.url), { type: "module" })` to `createQuickJsEngine({ worker })` — only the consumer's bundler knows the final asset layout. **5.2** Vite: `worker: { format: "es" }` in the demo and in consumers. **5.3** The engine conformance suite is a shared `describeEngineConformance(name, make)`; `engines/conformance.test.ts` runs it on eval, `quickjs/conformance.test.ts` (`@vitest-environment node`, for the wasm) on `createQuickJsDirectEngine`, plus two QuickJS-only tests: a `while(true){}` render is interrupted with `RUNTIME_TIMEOUT`, and `globalThis.localStorage` is not there to read. **5.4** The runaway-render check ran in the browser against the worker engine (`various/07-…png`) rather than as a Playwright spec — the demo has no Playwright configuration, and adding one is its own change; the engine-level behaviour is pinned by the vitest test. **5.5** The demo runs QuickJS by default with `?engine=eval` (or `localStorage["pbui-chat-demo.generated.v1.engine"] = "eval"`) as the same-thread fallback for debugging with real stack traces.

**Acceptance (Phase 5).** The QuickJS conformance run passes; `sandbox_describe` reports `engine: "quickjs"`; a runaway render shows `RUNTIME_TIMEOUT` in its tile while the page and the other tiles stay responsive; every Phase 2–4 gesture still works.

### Phase 6 (optional) — a server-side dry-run with goja

A backend tool `pbui_sandbox_check{source}` that evaluates `BOOTSTRAP_SOURCE + source` and `__pluginHost.getMeta()` in `dop251/goja` (already a dependency of vm-system; `go-go-goja` registrable modules are not needed) and returns the same `{ok, meta | error}` shape as `sandbox_test`'s load phase. Or, reusing vm-system as a service: a template whose startup file is the bootstrap, a session per check, `exec repl '__pluginHost.getMeta()'`, read the events — which is the daemon's exact use case ("execute JavaScript through REPL snippets … as a queryable event stream"). Value: catches syntax errors before a browser round trip, and works when no browser is connected (batch generation). Not in v1 (D13).

### 6.6 · Tests that must exist

| Level | Test | Where |
|---|---|---|
| unit (TS) | engine conformance: counter/column/days-of-cover programs load, render, event on every engine | `packages/pbui-sandbox/src/engines/conformance.test.ts` |
| unit (TS) | `assertUINode` accepts every kind, rejects unknown kinds and over-limit trees with a path | `validate/uiSchema.test.ts` |
| unit (TS) | intents: `verb` scope validated; `instanceId` stamped; over `intentsPerEvent` refused | `validate/intents.test.ts` |
| unit (TS) | renderer: every kind renders the expected atom; `ref` calls `renderReference`; input `onChange` yields `{value}`; table scrolls inside its container | `render/UINodeRenderer.test.tsx` |
| unit (TS) | library: round trip through storage; debounce; corrupt entry preserved and library empty; limits; `storage` event reload; version bump on update | `library.test.ts` |
| unit (TS) | host loop: `state/merge`/`replace`; verb intent calls `perform` with provenance; state kept across a compatible update and reset across an incompatible one; linked placements share | `host/useProgramInstance.test.tsx` |
| unit (TS) | `withGeneratedActions`: actions appear for matching types only; `disabledBecause` when the program is gone | `actions.test.ts` |
| unit (TS) | tools: `create` stores only after a clean check and reports the failing phase; `test` stores nothing; `update` keeps the old version on failure; `define_action` validates types/verb/template; `remove` honours pinned/`by` policy | `packages/pbui-chat/src/tools/sandboxTools.test.ts` |
| unit (TS) | `exportVocabulary()` deep-equals the embedded file, `sandbox` block included | `vocabulary/exportVocabulary.test.ts` (exists) |
| structural | no raw controls, no hex, grid columns, component folders — over `packages/pbui-sandbox` | `packages/pbui-chat/test/*.test.ts` (extend roots) |
| unit (Go) | sandbox prompt section gated on `program`; names every tool; lists every kind; vocabulary with a `sandbox` block parses and validates | `pkg/pbuichat/pbuichat_test.go` |
| e2e (Go) | bridged `sandbox_create_app`: fake browser answers; trace has `program.open` with `actor: agent` | `pkg/chatserver/server_test.go` |
| browser | Playwright: runaway render interrupted (QuickJS); reload restores programs, actions and tiles | `packages/pbui-chat/demo/tests/` |

---

## 7 · The demo programs and actions

The chat's agent can write any program; the demo ships three hand-written ones (in `demo/src/generated/`) seeded into an empty library on first boot, each chosen because it exercises a mechanism nothing else does:

| Program | Bindings | Mechanism it proves |
|---|---|---|
| `counter` | — | the loop: state, `state/merge`, two buttons, a badge |
| `days-of-cover` | `product` | a bound object read through `globalState.shared.documents`; `ui.ref` putting the product's menu inside a generated tile; `dispatchVerb({kind:"reorder"})` going through the router and the `canApprove` rule (the button is disabled when `env.canApprove` is false, mirroring `productDescriptor`'s `disabledBecause`) |
| `margin-table` | `category` | `ui.table` with the R6 overflow rule; `ui.select` switching the sort; `ui.sparkline` per row from `sold30d` |

And two actions:

| Action | Types | Behaviour |
|---|---|---|
| *Days of cover* | `product` | `openProgram` → `days-of-cover` bound to the clicked product |
| *Margins for this category* | `category` | `openProgram` → `margin-table` |

Seeding is a one-time `library.import(SEED, "merge")` guarded by a `seeded` flag in the snapshot, so a user who removes them is not re-seeded. The seed sources are also the fixtures for the conformance suite and the scripted scenario — one source, three uses.

---

## 8 · Sequences

### 8.1 "Make me a days-of-cover tile for [[product:2049]]" (G3 + G4)

```
browser                                  chatserver / pinocchio / geppetto                 model
───────                                  ────────────────────────────────                 ─────
composer send ─► client.send()
  syncToolManifest() ─────────────────► Manager.HandleManifest {tools: …, sandbox_*}
  POST /messages {prompt, refs:[product:2049]}
                                        systemPrompt += SystemPromptSection  (## Programs …)
                                                                                  ────► turn
                                                                                  ◄──── tool_call sandbox_test {source, documents:{product:"2049"}}
                                        BridgeExecutor → Manager.Request → ws frame
  toolRuntime.executeFrontendTool
    check(): engine.load (scratch) → getMeta → render(main, initialState, {documents:{product: resolve("product","2049")}}) → dispose
  POST /tools/results {ok:true, meta:{widgets:["main"], bindings:["product"]}, trees:{main:{kind:"column",…}}, intents:[]}
                                                                                  ────► tool_result
                                                                                  ◄──── tool_call sandbox_create_app {title, source, documents:{product:"2049"}}
    check() again → library.putProgram → prg-7 v1
    performWithPolicy({kind:"program.open", programId:"prg-7", documents:{product:"2049"}, near:"n-1"})
      router.perform(actor: agent) → validateVerb → local: wb.verbs.openView("script", {program:"prg-7", product:"2049"}, {near})
      POST /verbs {actor:"agent", verb:{kind:"program.open",…}, outcome:"performed"} ──► trace #31
  ScriptTile mounts: library.useProgram("prg-7") → engine.load(`v-9:1`) → render → UINodeRenderer
  POST /tools/results {ok:true, programId:"prg-7", version:1, placementId:"n-7", viewId:"v-9"}
                                                                                  ────► tool_result
                                                                                  ◄──── "Done — [[program:prg-7|Days of cover · 2049]] is open …"
  user types 45 → onChange → engine.event("setDays", {value:"45"}) → [{scope:"plugin", actionType:"state/merge", payload:{days:45}}] → states.set(v-9) → re-render
  user clicks Draft a reorder → engine.event("reorder") → [{scope:"verb", verb:{kind:"reorder", productId:"2049"}}]
      → perform(verb, {actor:"human", provenance:{programId:"prg-7"}}) → router → agent family → sendToAgent("draft a reorder for {0} …")
      POST /verbs {actor:"human", verb:{kind:"reorder", productId:"2049", _provenance:{programId:"prg-7"}}, outcome:"performed"} ──► trace #32
```

### 8.2 "Add an action to products that opens that tile" (G5), then a click

```
◄── tool_call sandbox_define_action {label:"Days of cover", types:["product"], behaviour:{kind:"openProgram", programId:"prg-7"}}
    validate: "product" ∈ vocabulary.types; prg-7 ∈ library.programs
    library.putAction → act-3   (persisted 300 ms later)
──► {ok:true, actionId:"act-3"}
◄── "Added. Right-click any product …"

user right-clicks <product 2051> in the inventory tile
  ObjectMenu → registry.actionsFor(ref)  = productDescriptor.actions(…) + [{label:"Days of cover", group:"generated", verb:{kind:"action.run", actionId:"act-3", ref}}]
  click → pbui.perform → router.perform(action.run)  → trace #40 (actor human)
    local: action = library.actions["act-3"] → ctx.perform({kind:"program.open", programId:"prg-7", documents:{product:"2051"}, near:"active"}, ref) → trace #41
      openView("script", {program:"prg-7", product:"2051"}) → a NEW view (different bindings from v-9) → tile n-8
```

### 8.3 Reload (G6)

```
boot: library = createProgramLibrary(...)  → restore() parses pbui-chat-demo.generated.v1 → {programs:{prg-7}, actions:{act-3}}
      workbench = createWorkbench({ initial: parseDocument(WORKBENCH_STORAGE_KEY) ?? defaultLayout() })   ← views v-9, v-10 still bind program:"prg-7"
      registry = withGeneratedActions(base, () => library.actions)                                        ← act-3 in menus
mount: ScriptTile(v-9) → library.programs["prg-7"] ✓ → engine.load("v-9:1") → render with initialState   ← state is NOT restored (D11); header says so
```

### 8.4 A broken update, and the fix loop (G8)

```
◄── sandbox_update_app {programId:"prg-7", source: <render now reads product.value.sold.reduce(...)>}
    check(): load ✓ → render ✗  TypeError: Cannot read properties of undefined (reading 'reduce')
──► {ok:false, phase:"render", error:"TypeError: Cannot read properties of undefined (reading 'reduce') — render(main) with documents {product:2049}"}
    (library untouched; the tile still runs v1)
◄── sandbox_test {source: <fixed>} → {ok:true, …}
◄── sandbox_update_app {programId:"prg-7", source: <fixed>} → {ok:true, version:2, warnings:[]}
    library.putProgram → v2 → every ScriptTile bound to prg-7 re-loads as "v-9:2"; the state {days:45} renders under v2 → kept
```

### 8.5 Remove a pinned program (G9)

```
◄── sandbox_remove {programId:"prg-7"}
    policy: pinned ⇒ confirm; no confirmationId
──► {ok:false, error:"program.remove needs the user's approval: call pbui_propose first, describing exactly this change, and pass the id you used as confirmationId"}
◄── pbui_propose {id:"rm-prg-7", title:"Remove the Days of cover program", body:"It is pinned and open in 2 tiles.", danger:true}
    (human tool parked; ProposalCard; user approves → resolveProposal → trace)
◄── sandbox_remove {programId:"prg-7", confirmationId:"rm-prg-7"}
    isApproved("rm-prg-7", {kind:"program.remove", programId:"prg-7"}) ✓ → performWithPolicy → local: library.removeProgram; close tiles n-7, n-8 → spend
──► {ok:true, closedTiles:["n-7","n-8"]}
```

---

## 9 · Failure modes, and how you will recognise them

| # | Symptom | Cause | Fix |
|---|---|---|---|
| R1 | A tile shows "this program was removed" after a reload | the library key was cleared (or the corrupt-fallback fired) while the layout still binds the id | check `localStorage` for `…generated.v1.corrupt-*`; the Callout names it; `sandbox_describe` lists what exists |
| R2 | The tab freezes | a `while(true)` or unbounded recursion under the **eval** engine; nothing can interrupt synchronous code on the main thread | Phase 5; until then, `sandbox_test` runs the same code first (it freezes the same tab — `sandbox_test` is not a safety net for loops) |
| R3 | `ReferenceError: document is not defined` / `fetch is not defined` in the tool result | the model wrote DOM or network code; the engine shadows (eval) or lacks (QuickJS) those names | the prompt's rule list; the error string already says what was reached for |
| R4 | `SyntaxError: Unexpected token '<'` at load | JSX | same |
| R5 | The provider rejects the manifest | the `behaviour` union or a recursive schema emitted `$ref`/`$defs` | flatten as `LayoutSpecSchema` does (`workbenchTools.ts:18-47`); a test pins "no `$ref`" |
| R6 | A generated table pushes the tile past its splitter | the renderer's table container lacks the `min-width: 0` chain | `grid-columns.test.ts` over `pbui-sandbox`; see AGENT-2 diary step 1 tricky #6 |
| R7 | `rejected:unknown verb show_margin` in the trace; the button does nothing | the program's `dispatchVerb` used a kind the vocabulary does not declare | the tile's details log shows `denied`; the prompt lists the kinds; `sandbox_test` with an `events` entry would have shown the intent |
| R8 | The model never calls `sandbox_*`; `workbench_*` works | `attachSandbox` ran after the manifest sync, or not at all | `syncManifest()` inside `attachSandbox`, as `attachWorkbench` does (`createPbuiChat.tsx:255-262`) |
| R9 | `sandbox_create_app` returns `library full` | 64 programs, or 1 MiB | `sandbox_remove` unpinned agent programs; the message lists the oldest unpinned ids |
| R10 | The tile's state vanished after "make the button green" | `initialState` keys changed ⇒ incompatible update ⇒ reset (D11) | the tool result's `warnings` says so; the model can tell the user |
| R11 | Two tabs disagree about which programs exist | the `storage` listener is missing or the debounce dropped a write on unload | `flush()` on `beforeunload`; the listener test |
| R12 | The demo shows old sandbox behaviour after a source edit | the demo consumes `pbui-sandbox` through `dist` | rebuild before the demo; `make chat-ui` orders it |
| R13 | `new Function` throws `EvalError` in a product | CSP without `'unsafe-eval'` | QuickJS needs `'wasm-unsafe-eval'` instead; the engine option is one line |
| R14 | `getByText("gold")` finds two nodes in a test over a generated tile | `ref` renders a `Presentation` whose `aria-label` equals the child text | `getAllByText`/`getByRole` (AGENT-2 diary step 1) |
| R15 | A generated action is in the menu but greyed out | its program was removed | the `disabledBecause` says which; remove or redefine the action |
| R16 | A Go commit blocks on an unrelated change | `lefthook` runs the Go gate for `*.go` | finish `prompt.go`/`vocabulary.go` together; TS-only commits are unaffected |
| R17 | The browser performs `program.open`/`action.run` but the trace shows `✗ unknown verb action.run` | `vocabulary.json` is `go:embed`ed into `pbui-chat serve`; a server started before `pnpm vocab` validates the trace against the old vocabulary while the browser validates against the new one | restart the server after regenerating the vocabulary (seen in the Phase 3 browser check; the rejection is D4 working as designed) |
| R18 | The demo tab freezes the moment a program tile mounts | a hook effect depending on a caller's inline callback re-runs every render, and `setTrees` allocated a new object each time | `useProgramInstance` holds callbacks in refs and keeps an unchanged tree's identity; the regression test counts engine renders under unstable callbacks (diary step 4) |

**Debugging order that works.** (1) The tile's *details* disclosure: the last error and the intent log with outcomes. (2) The trace panel: every `program.open`/`action.run`/verb with its outcome, including rejections. (3) `sandbox_describe` (or `library.getState()` in the console): what exists, which version, `lastError`. (4) `GOWORK=off go run ./cmd/pbui-chat prompt`: what the model was told. (5) The hydrated snapshot: `curl localhost:8090/api/chat/sessions/$SID | jq '.entities[] | select(.kind=="ChatFrontendToolCall")'` for what the model sent and what the browser answered.

---

## 10 · API reference

### 10.1 New — `@hyperslop-systems/pbui-sandbox`

| Export | Signature | Notes |
|---|---|---|
| `BOOTSTRAP_SOURCE`, `BOOTSTRAP_VERSION` | `string`, `number` | the `definePlugin` shim both engines evaluate |
| `UINode`, `UIEventRef`, `DispatchIntent`, `LoadedProgram`, `ProgramErrorPayload` | types | §6 Phase 0.2 |
| `SANDBOX_UI_KINDS`, `SANDBOX_INTENTS` | `readonly string[]` | exported for the vocabulary's `sandbox` block |
| `validateUINode`, `assertUINode` | `(value, limits?) => UINode` | path-qualified errors |
| `validateDispatchIntents` | `(value, instanceId, limits?) => DispatchIntent[]` | stamps `instanceId` |
| `ProgramEngine` | `{kind, load, render, event, dispose, health, terminate?}` | §5.3 |
| `createEvalEngine` | `(limits?) => ProgramEngine` | Phase 0 |
| `createQuickJsEngine` | `({ worker, limits? }) => ProgramEngine` from `…/quickjs` | Phase 5 — the consumer creates the worker from its own one-line entry (`installQuickJsWorker()`), because a `new Worker(new URL(…))` inside a published library does not survive a second bundling |
| `createQuickJsDirectEngine` | `(limits?) => ProgramEngine` from `…/quickjs` | Phase 5 — QuickJS on the calling thread; the conformance suite runs it under vitest (`@vitest-environment node`) |
| `installQuickJsWorker` | `(scope?) => void` from `…/quickjs` | Phase 5 — the worker body |
| `QuickJSRuntimeService` | class from `…/quickjs` | the port of vm-system's service onto the shared bootstrap |
| `toProgramError` | `(error, phase?) => ProgramErrorPayload` | |
| `ProgramGlobalState` | `{self, shared:{documents, env}, system}` | §5.4 |
| `createProgramLibrary` | `({key, storage?, limits?, onRejected?}) => ProgramLibrary` | §5.7 |
| `ProgramLibrary`, `ProgramRecord`, `ActionRecord`, `LibrarySnapshot` | types | |
| `useLibrary` | `(library, selector) => T` | `useSyncExternalStore` |
| `createProgramStateStore` | `() => ProgramStateStore` | keyed by view id |
| `useProgramInstance` | `(engine, program, options) => {status, trees, error, log, onEvent}` | §5.5 |
| `UINodeRenderer` | `({tree, onEvent, renderReference})` | §6 Phase 1.1 |
| `createScriptApp`, `PROGRAM_BINDING` | `(options) => AppDescriptor`, `"program"` | §6 Phase 1.5 |
| `withGeneratedActions` | `(registry, getActions, toVerb) => PresentationRegistry` | §5.6 |
| `substituteRef` | `(verb, ref) => verb` | `"$ref"` → ref, `"$ref.id"` → id |
| `DEFAULT_LIMITS`, `SandboxLimits` | | §5.11 |

The ui helpers, as the model sees them (and as `sandbox_describe.dsl` lists them):

```
ui.text(content, props?)            ui.badge(text, props?)          ui.button(label, {onClick?, variant?, disabled?})
ui.input(value, {placeholder?, type?, onChange?})                   ui.select(value, {options, onChange?})
ui.row(children?)  ui.column(children?)  ui.panel(children?, {title?})                  ui.table(rows, {headers})
ui.meter({fraction, label?, value?})  ui.sparkline({points, label?})  ui.callout({variant?, title?, text})
ui.ref(reference, label?)
handler context: { pluginState, globalState, dispatchPluginAction(actionType, payload?), dispatchVerb(verb) }
```

### 10.2 New — `@hyperslop-systems/pbui-chat`

| Export | Signature |
|---|---|
| `createSandboxTools` | `(options: SandboxToolsOptions) => { tools: ToolDefinition[] }` |
| `SandboxToolsOptions` | `{getLibrary, getEngine, getWorkbench, perform, resolve, limits?, policy?, isApproved?}` |
| `SandboxPolicy`, `DEFAULT_SANDBOX_POLICY` | `Record<"program.create"\|"program.update"\|"program.open"\|"program.run"\|"program.remove"\|"action.define"\|"action.remove", PolicyDecision>` |
| `createPbuiChat({ sandbox? })`, `chat.attachSandbox(library, engine)` | forwards options; re-syncs the manifest |
| `performWithPolicy`, `checkPolicy` | moved to `tools/policy.ts`, shared with the workbench tools |
| `PerformOptions.provenance?` | `{ programId }` — D10 |

### 10.3 The tools, as the model sees them

| Tool | Mode | Input | Output |
|---|---|---|---|
| `sandbox_describe` | frontend | `{}` | `{engine, limits, dsl, programs[], actions[]}` |
| `sandbox_test` | frontend | `{source, documents?, state?, events?}` | `{ok, meta, trees, intents, state} \| {ok:false, phase, error}` |
| `sandbox_create_app` | frontend | `{title, source, bindings?, documents?, open?, near?, programId?}` | `{ok, programId, version, placementId?, viewId?, warnings}` |
| `sandbox_update_app` | frontend | `{programId, source, title?, confirmationId?}` | `{ok, version, warnings}` |
| `sandbox_open` | frontend | `{programId, documents?, near?, title?}` | `{ok, placementId, viewId, wentToExisting}` |
| `sandbox_define_action` | frontend | `{label, types, behaviour, danger?, description?, actionId?}` | `{ok, actionId}` |
| `sandbox_remove` | frontend | `{programId? \| actionId?, confirmationId?}` | `{ok, closedTiles}` |
| `workbench_*`, `pbui_*` | existing | see AGENT-2 §10.4 | |

### 10.4 Vocabulary additions (demo)

Types `program`, `action`; verbs `program.open{programId, documents?, near?, title?}`, `program.remove{programId}` (danger), `program.pin{programId, pinned}`, `action.run{actionId, ref}`, `action.remove{actionId}` (danger); block `sandbox{schema_version, kinds[], intents[]}`. Go: `Vocabulary.Sandbox *SandboxVocabulary`; `knownSandboxKinds`; prompt constants `ToolSandboxDescribe`, `ToolSandboxTest`, `ToolSandboxCreateApp`, `ToolSandboxUpdateApp`, `ToolSandboxOpen`, `ToolSandboxDefineAction`, `ToolSandboxRemove`.

### 10.5 Existing — what you will use unchanged

`AppDescriptor`/`defineApp`/`AppProps` (`pbui-workbench/src/apps.ts`); `Workbench.verbs.openView(appId, documents, {near, title})`; `describeWorkbench`; `createVerbRouter` (`perform(verb, target?, {actor})`, `RouterContext.perform/sendToAgent/accept/labelFor/openTile`); `FrontendTool`/`HumanTool`/`assertProviderSafeToolName` (chat-provider); `pbuiProposeTool`; `defineVocabulary`/`verbSpecsFromSchema`/`exportVocabulary`; `ReferenceSchema`, `Reference`, `toPresentationReference`/`fromPresentationReference` (`pbui-chat/src/types.ts`); `createPresentationRegistry`, `PresentationRegistry`, `PresentationAction` (`pbui/src/presentation`); `Button, TextInput, SelectInput, Chip, Meter, Sparkline, Callout, Text, Stack, Toolbar, Surface, EmptyState` (`pbui/src/components`).

### 10.6 vm-system — what was ported, from where

| pbui-sandbox file | vm-system source | Change |
|---|---|---|
| `bootstrap.ts` | `frontend/packages/plugin-runtime/src/runtimeService.ts:13-127` | `ui.counter` out; `ui.select/meter/sparkline/callout/ref` in; `dispatchVerb` replaces `dispatchSharedAction`; `getMeta` returns `bindings` |
| `contracts.ts` | `contracts.ts`, `uiTypes.ts` | new kinds; `verb` intent scope; `LoadedProgram` |
| `validate/uiSchema.ts` | `uiSchema.ts` | new kinds; limits |
| `validate/intents.ts` | `dispatchIntent.ts` | `verb` scope; limit |
| `engine.ts` | `hostAdapter.ts` | renamed; `kind` |
| `engines/evalEngine.ts` | — (new; `runtimeService.ts:210-255` for meta validation and error mapping) | |
| `engines/quickjs/*` | `runtimeService.ts`, `worker/sandboxClient.ts`, `worker/runtime.worker.ts` | names; shared bootstrap |
| `host/useProgramInstance.ts` | `client/src/pages/WorkbenchPage.tsx:131-273`, `docs/runtime/embedding.md` "Using Without Redux" | per-tile; `verb` → router |
| `render/UINodeRenderer.tsx` | `client/src/components/WidgetRenderer.tsx` | PBUI atoms (D3) |
| (not ported) | `redux-adapter/store.ts` | the generic reducer is four lines in the hook; grants become `documents`/`env` |

---

## 11 · File reference

| Area | Path | What you do to it |
|---|---|---|
| **new package** | `pbui/packages/pbui-sandbox/` | **new** — §6 Phase 0–1, 5 |
| the tools | `pbui/packages/pbui-chat/src/tools/sandboxTools.ts`, `tools/policy.ts` | **new**; `policy.ts` extracted from `workbenchTools.ts` |
| tool registration | `pbui/packages/pbui-chat/src/createPbuiChat.tsx` | **edit**: `sandbox` option, `attachSandbox`, tools in the extension |
| router options | `pbui/packages/pbui-chat/src/router/createVerbRouter.ts` | **edit**: `PerformOptions.provenance` (D10) |
| tool exports | `pbui/packages/pbui-chat/src/tools/index.ts`, `src/index.ts` | **edit** |
| demo types/verbs/vocab | `pbui/packages/pbui-chat/demo/src/pbui/{types,verbs,vocabulary}.ts` | **edit**: 2 types, 5 verbs, `sandbox` block |
| demo descriptors | `pbui/packages/pbui-chat/demo/src/pbui/descriptors/{program,action}.ts` | **new** |
| demo registry | `pbui/packages/pbui-chat/demo/src/pbui/registry.ts` | **edit**: `withGeneratedActions` |
| demo router | `pbui/packages/pbui-chat/demo/src/chat.ts` | **edit**: families + 5 local cases |
| demo workbench | `pbui/packages/pbui-chat/demo/src/workbench.ts` | **edit**: library, engine, states, `createScriptApp`, launcher rows, `attachSandbox` |
| demo seeds | `pbui/packages/pbui-chat/demo/src/generated/{counter,daysOfCover,marginTable}.js.ts`, `seed.ts` | **new** (§7) |
| demo shell | `pbui/packages/pbui-chat/demo/src/App.tsx` | **edit**: `rows` for the launcher |
| vocabulary (JSON) | `pbui/pkg/chatserver/demo/vocabulary.json` | **regenerate** |
| prompt | `pbui/pkg/pbuichat/prompt.go` | **edit**: constants + `sandboxSection` |
| vocabulary (Go) | `pbui/pkg/pbuichat/vocabulary.go` | **edit**: `Sandbox` block + validation |
| Go tests | `pbui/pkg/pbuichat/pbuichat_test.go`, `pbui/pkg/chatserver/server_test.go` | **edit** |
| scripted demo | `pbui/pkg/chatserver/scripted/{engine,scenarios}.go` | **edit**: `frontendTool` helper + `programScenario` |
| structural tests | `pbui/packages/pbui-chat/test/{no-raw-controls,no-hex,grid-columns,component-folders}.test.ts` | **edit**: add the sandbox package root |
| build | `pbui/Makefile` (`chat-ui`), `.github/workflows/publish-pbui-sandbox.yml` | **edit/new** |
| workbench (read) | `pbui/packages/pbui-workbench/src/{apps,types,store,describe,launcherRows}.ts` | read — **unchanged** |
| protocol (read) | `pbui/proto/hyperslop/pbui/workbench/v1/workbench.proto` | read — **do not change** |
| chat-provider (read) | `react-chat/packages/chat-provider/src/tools/{toolRegistry,toolRuntime}.ts` | read |
| pinocchio bridge (read) | `pinocchio/pkg/chatapp/frontendtools/{manager,bridge}.go` | read |
| the pattern (read) | `vm-system/frontend/packages/plugin-runtime/src/*`, `frontend/docs/**`, `frontend/client/src/{components/WidgetRenderer.tsx,pages/WorkbenchPage.tsx}` | read; port per §10.6 |
| prior tickets | `pbui/ttmp/2026/08/20/PBUI-AGENT-{1,2}--…/`, `PBUI-WORKBENCH-{1,2}--…/` | read first; AGENT-2's diary especially |

---

## 12 · Open questions

| # | Question | Options | Recommendation |
|---|---|---|---|
| Q1 | Should `program.run` default to `confirm` in the demo under the eval engine? | allow (smooth demo); confirm (the user sees the source before it runs) | allow in the demo, **confirm in any product on eval**, allow again on QuickJS |
| Q2 | Should program state persist? | never; opt-in per program (`persistState: true`); always | opt-in later; D11 |
| Q3 | Shared domains for programs (selection, watchlist, the inventory table's filters) | none; read-only domains; read/write with grants | add read-only `watchlist` when a program wants it; writable never without a grant UI |
| Q4 | Program-to-program communication | none; shared domains; verbs | none until a gesture needs it |
| Q5 | Where does a product keep the library when it has a server? | `localStorage` only; a hosted `ProgramLibrary` adapter over `/v1/programs`; `WorkbenchDocument.documents` | an adapter; the interface is already a store (D5) |
| Q6 | Should the model be allowed to *read* other programs' sources (to compose)? | `sandbox_describe` lists titles only; `sandbox_source{programId}` | add `sandbox_source`; sources are not secret |
| Q7 | Export/import | console only; a *Library* tile with export/import; a verb | a small `library` app (singleton) in Phase 4 if time allows |
| Q8 | Does AGENT-2 Tier 4 (`isApproved` wiring) land before Phase 3? | yes; no (pinned removals stay human-only) | no blocker either way; say so in the demo |
| Q9 | `ui.ref` with a reference the product cannot resolve | render `<unresolved>` (pbui-chat's fallback); refuse at validation | render unresolved; the menu offers *ask the agent what this is* |
| Q10 | A QuickJS worker per program or one worker for all | one worker, one context per instance (vm-system's shape) | vm-system's shape; a crash takes all programs down, which `terminate()` + reload handles |

---

## 13 · Glossary

| Term | Meaning |
|---|---|
| **program** | a JavaScript source in the `definePlugin` dialect, stored in the library with an id, a title, a version and bindings |
| **instance** | one loaded copy of a program inside an engine, keyed `${viewId}:${version}` |
| **widget** | one `render`/`handlers` pair inside a program; `main` by convention; a program may have several |
| **UINode** | a JSON node `{kind, props?, children?, text?}`; the only thing `render` may return |
| **intent** | `{scope:"plugin"|"verb", …}` — a handler's request; the host decides the outcome |
| **engine** | what evaluates programs: `eval` (same thread, no isolation) or `quickjs` (worker, isolated, interruptible) |
| **bootstrap** | the shim that defines `definePlugin`, `ui.*` and `__pluginHost`; identical for both engines |
| **host loop** | load → render → event → reduce → re-render, run per tile by `useProgramInstance` |
| **library** | the `localStorage`-backed store of programs and actions, separate from the layout |
| **binding** | a key in `view.documents` naming what a tile is a view OF; `program` names the program, other keys name objects |
| **generated action** | a stored record `{label, types, behaviour}` appended to matching types' menus as `action.run` |
| **behaviour** | what an action does: `openProgram`, `verb` (with `$ref`), or `askAgent` |
| **provenance** | `{programId}` carried on a verb performed from inside a generated tile |
| **`script`** | the one host app every program tile runs in; doc-bound to `program` |
| **policy** | `allow`/`confirm`/`deny` per capability; `confirm` is `pbui_propose` + `isApproved` + one-shot spending |
