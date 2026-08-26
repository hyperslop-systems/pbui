---
Title: 'Intern guide: giving the PBUI chat agent tools to build and rearrange workspaces'
Ticket: PBUI-AGENT-2
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
    - Path: repo://packages/pbui-workbench/src/verbs.ts
      Note: The tile verbs as data and their handlers; where the workspace verbs must be added
    - Path: repo://packages/pbui-workbench/src/document.ts
      Note: layout()/tile()/split() build a document through the protocol; must be refactored to also emit mutations into an existing document
    - Path: repo://packages/pbui-workbench/src/store.ts
      Note: The local document store, its workspaceId, and mutate()'s all-or-nothing batch policy
    - Path: repo://packages/pbui-chat/src/tools/acceptTool.tsx
      Note: The pattern every new browser-side tool follows (schema, registration, result shape)
    - Path: repo://packages/pbui-chat/src/createPbuiChat.tsx
      Note: Where the chat extension is assembled and where attachWorkbench binds the workbench
    - Path: repo://packages/pbui-chat/src/router/createVerbRouter.ts
      Note: Verb families, validation, and the POST that writes the trace; agent layout verbs must go through it
    - Path: repo://proto/hyperslop/pbui/workbench/v1/workbench.proto
      Note: The mutation vocabulary the whole design is a projection of
    - Path: repo://pkg/pbuichat/prompt.go
      Note: The generated system-prompt section that must learn to describe the workbench
    - Path: ws://react-chat/packages/chat-provider/src/tools/toolRuntime.ts
      Note: The browser executor that runs a frontend tool and posts its result
    - Path: ws://pinocchio/pkg/chatapp/frontendtools/bridge.go
      Note: RegisterManifestTools and BridgeExecutor, the seam that makes a browser tool visible to the model
ExternalSources: []
Summary: 'A complete intern-level guide to giving the PBUI chat agent tools that build and rearrange the user workspace: how the presentation protocol, the workbench document and the three chat tool channels fit together, what is missing today, the design of the workbench tool surface (declarative layouts, verbs as data, raw mutation batches), a step-by-step implementation plan, four demo tile types, sequences, failure modes, and full API and file references.'
LastUpdated: 2026-08-20T17:43:11.206944073-04:00
WhatFor: Give someone new everything needed to implement "create a new workspace with a chat, an inventory and two SKU tiles" as a chat instruction, without re-deriving the architecture from five repositories.
WhenToUse: Read before touching pbui-workbench verbs, pbui-chat tools, the chat vocabulary, or anything that lets an agent change what the user sees on screen. Sections 1-4 are the analysis, 5 the design, 6-7 the implementation, 8-11 the references.
---

# Intern guide: giving the PBUI chat agent tools to build and rearrange workspaces

## 0 · What this guide is for, and how to read it

You are going to make this work:

> **user:** make me a workspace called "Gold desk" with the chat on the left, the inventory below a metals board on the right, and open the two lowest-stock gold SKUs as their own tiles
>
> **agent:** *(calls `workbench_describe`, then `workbench_create_workspace`, then `workbench_open_tile` twice)* Done — I put the chat at 55 %, stacked the metals board over the inventory on the right, and opened [[tile:p7|2049 · 1oz American Gold Eagle]] and [[tile:p8|2051 · 1oz Krugerrand]] below it. The old workspace is still there under "Gold Coin Shop".

Nothing in that exchange is a fixed UI feature. Every part of it is a tool call the model chose, applied through the same code path a mouse gesture uses, recorded in the same trace, and undoable with the same verb machinery. That is the whole point of the design: **the agent gets no private door into the layout**.

Read it in this order:

- **§1–§4 (analysis).** What already exists, in three systems you must hold in your head at once, and precisely what is missing. If you only read one thing, read §4's gap tables.
- **§5 (design).** The tool surface, the layout dialect the model writes, the safety envelope, and the decisions with their alternatives.
- **§6–§7 (implementation).** Tier-by-tier work, with file paths, function signatures and pseudocode; then the four demo tile types and why each one exists.
- **§8–§11 (reference).** Sequences, failure modes, API tables, file tables.

**What you need on your machine.** A checkout of the workspace at `/home/manuel/workspaces/2026-08-20/add-pbui-agent` (a `go.work` over `pbui`, `react-chat`, `pinocchio`, `sessionstream`, `geppetto`, `datalab`, `coinvault`, `hyperslop-cli`). Then:

```bash
cd pbui
pnpm install --no-frozen-lockfile --filter '!@hyperslop-systems/datalab-ui'   # datalab-ui needs a GitHub Packages token you do not have
make chat-ui            # builds pbui, pbui-workbench, pbui-chat and the demo SPA into pkg/chatui/embed
make chat-serve         # scripted demo engine on http://127.0.0.1:8090 — no model, no credentials
devctl up               # dev profile: go run + vite on :5174 with hot reload
```

Two prior tickets are your background reading, and this guide assumes but does not repeat them:

- `ttmp/2026/08/20/PBUI-AGENT-1--pbui-native-chat-agent-with-custom-pbui-widgets/` — the agent itself: the object/verb/widget contract, the Go plugin, the TypeScript package, and a diary that records every failure encountered while building them.
- `ttmp/2026/08/20/PBUI-WORKBENCH-1--reusable-pbui-workbench-tiles-for-chat-and-other-pbui-applications/design-doc/01-intern-guide-…` — the tiles: the chrome kit, the workbench document, the applier, and `@hyperslop-systems/pbui-workbench`. Its §9 is the API reference for everything this guide builds on.
- `ttmp/2026/08/20/PBUI-WORKBENCH-2--unify-agentlogic-turboproof-hyperblog-and-datalab-ui-around-the-shared-pbui-workbench-package/design-doc/01-intern-guide-…` — **the unification, and this ticket's prerequisite.** Four product shells measured against the package, a 45-row feature matrix, and nine groups of core additions. Its **Phase 1 (§5.A store injection, §5.B workspaces, §5.C replace/link/rebind) must land before Tier 1 of this guide**; §6 Tier 0 below explains exactly what we consume from it and where the two designs disagreed.

---

## 1 · The goal, stated as gestures

A design is easier to argue about when its acceptance is a list of things a person does. These are the gestures this ticket must make work, in the order they should start working:

| # | The user says | The agent must | New machinery |
|---|---|---|---|
| G1 | "what's on my screen?" | answer with the workspaces, tiles, apps and sizes | `workbench_describe` |
| G2 | "open the trace panel" | place an app beside the active tile | `workbench_perform` (`app.place`) |
| G3 | "split the chat and put the inventory next to it" | split a named placement with a named app | `workbench_perform` (`tile.split`) |
| G4 | "make me a workspace called Gold desk with chat left, metals over inventory right" | create a second workspace from a declarative layout and switch to it | `workbench_create_workspace` + **workspace verbs that do not exist yet** |
| G5 | "open the two lowest-stock gold SKUs as tiles" | resolve them with an existing tool, then open two doc-bound tiles | `workbench_open_tile` + a **doc-bound demo app** |
| G6 | "that's wrong, put it back" | undo the last layout change it made | a layout snapshot and an `undoLayout` verb |
| G7 | right-click a tile → menu | show the tile's own verbs, the same ones the agent used | a `tile` **presentation type** in the vocabulary |

G1–G3 are a weekend. G4 is the interesting one, because *the workbench has no workspace verbs at all today* (§4.2). G5 is what makes the demo tile types earn their place (§7). G6 and G7 are what make it PBUI rather than a chatbot with a layout API.

---

## 2 · Three systems, in one picture

```
 ┌─ the browser ───────────────────────────────────────────────────────────────┐
 │                                                                             │
 │   PBUI presentation runtime           pbui-workbench                        │
 │   ┌───────────────────────┐           ┌──────────────────────────────┐      │
 │   │ registry: type → descr│           │ store: WorkbenchDocument     │      │
 │   │ Provider / onPerform  │◄─ verbs ─►│ verbs: split close swap dock │      │
 │   │ Presentation / menu   │           │        resize place openView │      │
 │   │ accept mode           │           │ Surface: tree → Tile|Split   │      │
 │   └───────────┬───────────┘           │ Launcher: Mod-K              │      │
 │               │                       └───────────┬──────────────────┘      │
 │               │                                   │ applyMutations           │
 │   pbui-chat   │                                   ▼                          │
 │   ┌───────────┴──────────────┐        @hyperslop-systems/workbench-protocol  │
 │   │ createPbuiChat           │        (generated from workbench.proto)       │
 │   │  extension {tools,       │                                               │
 │   │    widgets, adapters}    │                                               │
 │   │  router (families+trace) │        chat-provider (react-chat)             │
 │   │  Messages / Composer     │        ┌──────────────────────────────┐       │
 │   │  panels, PbuiWidget      │◄──────►│ ChatToolRegistry, toolRuntime│       │
 │   └──────────────────────────┘        │ WidgetOutlet, timeline store │       │
 │                                        └──────────────┬──────────────┘       │
 └───────────────────────────────────────────────────────┼──────────────────────┘
                          HTTP + one WebSocket           │
 ┌────────────────────────────────────────────────────────┼──────────────────────┐
 │  pbui/pkg/chatserver                                    ▼                     │
 │   handlers.go  /sessions /messages /tools/manifest /tools/results /verbs      │
 │   server.go    sessionstream Hub + chatapp Engine + plugins                   │
 │                                                                               │
 │  pbui/pkg/pbuichat  (a pinocchio chatapp.ChatPlugin)                          │
 │   emitter.go  pbui.refs · pbui.widget · pbui.error                            │
 │   tools.go    pbui_widget · pbui_trace · pbui_describe_types                  │
 │   prompt.go   the generated system-prompt section                             │
 │   trace.go    PbuiVerbPerformed → PbuiTraceEntry                              │
 │                                                                               │
 │  pinocchio chatapp ── frontendtools.Manager ── geppetto engine + tool loop    │
 └───────────────────────────────────────────────────────────────────────────────┘
```

Three things to internalise before reading further.

**The presentation protocol is not a widget kit.** PBUI's core (`pbui/src/presentation/types.ts`) is four types: a `PresentationReference<Values> = {type, value}`, a `PresentationDescriptor{label, describe?, actions?, tone?}`, a `PresentationAction{id, label, verb, danger?, disabledBecause?}`, and a registry mapping the first to the second. A *verb is serialisable data, never a closure* — that single rule is what lets a language model both emit verbs and receive them, and it is the reason this ticket is possible at all. The runtime (`createPbui.tsx`) adds the object menu, the mouse-doc line, and **accept mode**: `accept({types, prompt}) → Promise<reference|null>`, which reaches across tiles.

**The workbench is a document, not a component tree.** `proto/hyperslop/pbui/workbench/v1/workbench.proto` defines `WorkbenchDocument{ workspaces[], views{}, documents{}, view_order[] }`, where a `Workspace` owns a binary `Node` tree of `Leaf{view_id}` and `Split{direction, ratio, a, b}`, and an `AppView{id, app_id, documents{}, title?}` names an application plus its document bindings. Fifteen `Mutation` cases are the only legal way to change it. A TypeScript applier (`packages/workbench-protocol/src/client/apply.ts`) and a Go applier (`pkg/workbench`) implement identical semantics, checked by shared fixtures.

**The chat agent already speaks objects.** PBUI-AGENT-1 shipped a chat whose every structured output is a presentation: mentions `[[type:id|label]]` in prose resolve server-side into a `pbui.refs` entity; `pbui_widget` publishes a validated widget document; performed verbs are POSTed to `/verbs` and become a durable trace. The model's instructions are *generated* from a `vocabulary.json` that the TypeScript registry exports and the Go binary embeds (`pkg/chatserver/demo/vocabulary.json`), so adding a type or a verb changes the prompt without anyone editing prose. **This is the mechanism you extend, not one you replace.**

---

## 3 · How a tool call actually travels

You cannot design the workspace tools without knowing which of the three tool channels each one belongs to, and the three behave very differently. The name "side tools" in react-chat's tickets (`CHATOVERLAY-002 — elegant chatbot embedding API with client-side tool calling`) covers the second and third.

### 3.1 Backend tools (in-process, Go)

Registered with geppetto's `NewToolFromFunc` into a per-session `ToolRegistry`; the tool loop calls the Go closure directly.

```go
// pbui/pkg/pbuichat/tools.go
widgetTool, err := geptools.NewToolFromFunc(ToolWidget,
    "Publish a PBUI widget document in the conversation…",
    func(ctx context.Context, in WidgetToolInput) (WidgetToolOutput, error) { … })
registry.RegisterTool(widgetTool.Name, *widgetTool)
```

Fast, testable, has no idea what the browser is showing. `pbui_widget`, `pbui_trace`, `pbui_describe_types` and the demo's `shop_products` live here.

### 3.2 Frontend tools (browser, automatic) — **the channel this ticket needs**

The browser owns a `ChatToolRegistry`. Every tool in it is advertised to the server as a manifest entry `{name, description, mode, inputSchema, available}`; the server turns the manifest into ordinary geppetto tool definitions; a call is bridged back to the browser, executed there, and its result unblocks the tool loop.

```
browser                                   chatserver / pinocchio                     model
───────                                   ──────────────────────                     ─────
extension.tools ─► ChatToolRegistry
       │  installChatExtension() calls client.tools.syncManifest()
       ▼
POST /api/chat/sessions/{id}/tools/manifest {revision, tools[]}
                                    ──► frontendtools.Manager.HandleManifest
                                        (stored per session)

user sends a message ────────────────► realRuntimeFactory.promptRequest()
                                        Manager.RegisterManifestTools(sid, registry)
                                        ── available:false entries are skipped ──►  sees
                                                                                    workbench_create_workspace(…)
                                    ◄── model calls it ────────────────────────────
                                        BridgeExecutor → Manager.Request(…)
                                        publishes ChatFrontendToolCallRequested
   ws frame ◄───────────────────────────────────────────────────
   toolRuntime.executeFrontendTool(payload)
     tool = registry.get(name)                     ← unknown name ⇒ failed result
     input = parseToolInput(tool, payload.input)   ← zod; a bad shape is a failed result
     result = await tool.execute(input, {signal, toolCallId})
POST /api/chat/sessions/{id}/tools/results {toolCallId, toolName, status, result}
                                    ──► Manager.HandleResult → unblocks Request
                                                                              ──►  tool result
```

Five facts about this channel that will bite you if you forget them:

1. **The manifest is synced on `connect()`, on every `send()`, and on extension install/uninstall** (`createChatClient.ts` lines 274/286, `extensions.ts` `installChatExtension`). You do not need new wiring to publish new tools — you need them in `extension.tools`.
2. **`available` is honoured server-side.** `RegisterManifestTools` skips descriptors with `available: false`, so a tool whose workbench is not attached yet simply is not offered to the model. Use this instead of registering conditionally.
3. **Tool names must match `/^[a-zA-Z0-9_-]+$/`** (`assertProviderSafeToolName`). `workbench.create` throws at registration; `workbench_create_workspace` is fine.
4. **`Manager.Request` has no timeout.** It blocks on a channel until the browser answers or the context is cancelled. A tool whose `execute` can hang will hang the model's turn (§9, R2).
5. **`parseToolInput` uses the tool's zod `parameters`, and the same schema is exported as the JSON Schema the model sees** (`z.toJSONSchema`). One declaration, both jobs — do not hand-write `inputSchema`.

### 3.3 Human tools (browser, awaits a person)

Same transport, `mode: 'human'`: `toolRuntime` parks the call instead of executing it, the chat renders the tool's `render({input, respond, reject})` card in the timeline, and the parked call is answered when a human clicks. `pbui_accept` (pick an object on screen) and `pbui_propose` (approve/reject a consequential action) are the two that exist. `reconcileFrontendToolRequests` re-parks pending calls after a reload, so a half-answered proposal survives F5.

### 3.4 Which channel for which job

| Job | Channel | Why |
|---|---|---|
| read the current layout | frontend | the document lives in the browser's store |
| create a workspace, split, close, resize | frontend | ditto; and it must go through the same verb handlers a gesture uses |
| ask the user which SKU to open | human (`pbui_accept`, exists) | needs a person's pointer |
| get approval before deleting a workspace | human (`pbui_propose`, exists) | consequential |
| look up the two lowest-stock gold SKUs | backend (`shop_products`, exists) | data lives on the server |
| a workbench shared across devices | backend + a hosted store | §5.9 — not this ticket |

---

## 4 · What exists, and exactly what is missing

### 4.1 The verbs `pbui-workbench` has today

`packages/pbui-workbench/src/verbs.ts` declares eleven verb kinds as data and a matching handler for each. This is the door the agent will use, so know it cold:

| Verb (data) | Handler | Semantics worth remembering |
|---|---|---|
| `tile.split{placementId, direction, appId?}` | `split()` | with `appId`, opens that app; without it, duplicates the tile — a singleton or `duplicable:false` app gets a **linked placement** (same view twice on screen) rather than a second view |
| `tile.close{placementId}` | `close()` | a **no-op on the last tile**; `canClose()` is the predicate |
| `tile.swap{a, b}` | `swap()` | exchanges two placements' views |
| `tile.dock{source, target, zone}` | `dock()` | moves a tile to an edge of another; follows the view so the active id never dangles |
| `tile.activate{placementId}` | `activate()` | local state only, not in the document |
| `split.resize{splitId, ratio}` | `resize()` | clamps to `[0.1, 0.9]`, then snaps to the shared ratios unless `{snap:false}` |
| `app.place{appId, from?}` | `place()` | the launcher rule: a *placed singleton is gone to*, anything else splits the target along its **longer rendered axis** (`splitDirectionFor` reads the DOM box) |
| `view.setTitle{viewId, title}` | `setTitle()` | empty string clears the title |
| `view.open{appId, documents, near?, title?}` | `openView()` | a doc-bound app already showing **identical bindings is gone to**, not opened twice |
| `launcher.open` / `launcher.close` | | |

`performWorkbenchVerb(handlers, verb)` is the one-verb-in dispatcher. `isWorkbenchVerb` and `describeWorkbenchVerb` exist so a product router and a trace can treat them like any other verb.

### 4.2 Gap 1 — workspaces are unreachable

The protocol has `WorkspaceCreate{workspace_id, name, root_placement}`, `WorkspaceRename`, `WorkspaceDelete`; the applier implements all three with real invariants (duplicate id → `duplicate_id`; deleting the last one → `last_workspace`); the store has a `workspaceId` field and `Surface` renders exactly that workspace.

**And nothing ever changes it.** There is no verb, no handler, no UI. `layout()` creates a document whose single workspace is hard-coded `"main"`, so calling it twice cannot even produce a second workspace in the same document. G4 is blocked on roughly 80 lines of new code in `pbui-workbench`, not on anything in the agent.

**This gap is already owned.** `PBUI-WORKBENCH-2` reached it independently, from the products' side rather than the agent's: its feature matrix marks *"Multiple workspaces + switching"* as present in all four shells (agentlogic 4, turboproof 3, hyperblog 6, datalab-ui with stages) and absent from the package, and its §5.B designs the verbs with a `WorkspaceStrip` to drive them. Four consumers beat one, so **the API is theirs and the sequencing is theirs** — see §6 Tier 0.

```
protocol            pbui-workbench          the agent needs
─────────           ───────────────         ───────────────
workspaceCreate  ─►  ✗ (nothing)        ─►  workspace.create{name, layout}
workspaceRename  ─►  ✗                  ─►  workspace.rename{workspaceId, name}
workspaceDelete  ─►  ✗                  ─►  workspace.delete{workspaceId}
(local state)    ─►  workspaceId (read) ─►  workspace.select{workspaceId}
documentPut      ─►  ✗                  ─►  (used by the notes demo tile, §7.3)
documentDelete   ─►  ✗                  ─►  (ditto)
viewClone        ─►  ✗                  ─►  workspace.clone / tile.replace   (WORKBENCH-2 §5.B/§5.C)
placementReplace ─►  ✗                  ─►  tile.replace, tile.link          (WORKBENCH-2 §5.C)
viewConfigure    ─►  setTitle only      ─►  view.rebind{viewId, documents}   (WORKBENCH-2 §5.C)
```

### 4.3 Gap 2 — the layout is not describable

An agent cannot mutate what it cannot see, and every verb above is addressed by an **id it has no way of learning**: `placementId`, `viewId`, `splitId`, `appId`. `workbench.serialize()` returns the full protobuf JSON, which is correct but wasteful and hostile to a model (nested `body.case` unions, ids everywhere, no rendered sizes). There is no compact projection.

### 4.4 Gap 3 — tiles are not objects

PBUI-WORKBENCH-1 §8 already flagged this: `renderTitle` renders plain text because the vocabulary is embedded by the Go server and asserted equal on both sides, so adding a `tile` type was out of scope there. PBUI-WORKBENCH-2 §5.G then designed the fix as a package helper, `createTileDescriptor(wb, {extra?})`, scheduled in its Phase 2 — take that rather than hand-rolling one per product. The consequence for *this* ticket is bigger than cosmetics:

- the agent cannot **mention** a tile (`[[tile:p7|inventory]]`), so it cannot refer back to what it made;
- the user cannot right-click a tile and see the same verbs the agent used, which breaks the two-doors rule that the whole product is built on;
- `pbui_accept` cannot ask "which tile do you mean?", because tiles are not presentations and accept mode only matches presentations.

### 4.5 Gap 4 — agent layout changes leave no trace and cannot be undone

`createVerbRouter.perform(verb, target, {actor})` already POSTs every performed verb — including rejections — to `/api/chat/sessions/{id}/verbs`, where `pkg/pbuichat/trace.go` assigns a per-session `seq` and publishes a `PbuiTraceEntry`. Workbench verbs performed by `workbench.perform()` **bypass this entirely**: they call `performWorkbenchVerb` directly. So today a mouse-driven split is invisible to the trace too. Once an *agent* can split, invisible is not acceptable.

There is also no undo. `store.replaceDocument(doc)` exists and `reset()` uses it, but nothing snapshots.

### 4.6 Gap 5 — the model is not told any of this

`pkg/pbuichat/prompt.go`'s `SystemPromptSection` describes types, mentions, the widget dialect and the verb kinds. It says nothing about tiles, workspaces or applications, and `pbui_describe_types` answers only from `vocabulary.json`. A model handed `workbench_create_workspace` with no prose about what a workspace *is* will produce plausible nonsense; PBUI-AGENT-1's diary records exactly this failure mode for `pbui_widget` ("the model's first call guessed a schema … added a worked example to the tool description and to the generated prompt").

### 4.7 Summary of the work

| Gap | Where the fix lands | Size | Owner |
|---|---|---|---|
| workspaces unreachable | `pbui-workbench/src/{verbs,document,store}.ts` | ~150 lines + tests | **PBUI-WORKBENCH-2 Phase 1 (§5.A–5.C)** |
| layout not describable | `pbui-workbench/src/describe.ts` (new) | ~120 lines | this ticket, after Phase 1 |
| tiles are not objects | `createTileDescriptor` helper + `pbui-chat` vocabulary + demo descriptors | ~150 lines | helper: WORKBENCH-2 Phase 2 · vocabulary: this ticket |
| no trace, no undo | `pbui-chat/src/tools/workbenchTools.ts`, over WORKBENCH-2's `onMutate`/`onRejected` | ~120 lines | this ticket |
| model not told | `pkg/pbuichat/prompt.go`, tool descriptions | ~60 lines | this ticket |
| nothing to place | demo apps (§7) | ~400 lines | this ticket |

Nothing in `pkg/chatserver`, `pinocchio`, `sessionstream` or `geppetto` changes. **No new wire types.** That is the strongest evidence the design is aligned with the existing seams.

---

## 5 · Design

### 5.1 The one sentence, and the five rules it implies

> **The agent reconfigures the workspace by calling browser-side tools that are thin, validated wrappers over the same `WorkbenchVerb` handlers a mouse gesture calls, on the same local `WorkbenchDocument`, reported to the same trace.**

Five rules follow, and every decision in the rest of §5 is one of them applied:

1. **No private door.** A tool never touches `store.setState` or builds a `Mutation` by hand. It calls `workbench.verbs.*` or `workbench.perform(verb)`. If the agent can do something the UI cannot, the UI is missing a button, not the agent gaining a power.
2. **Ids come from a read, never from imagination.** Every mutating tool takes ids; the only place ids exist is `workbench_describe`'s output and the previous tool's result. The tool description says so, and an unknown id is a clear error string, not a silent no-op.
3. **Every agent change is a trace entry with `actor: "agent"`.** Same `/verbs` endpoint, same `seq`, same panel. The trace is an audit, so a *rejected* agent change is recorded too.
4. **Every agent change is undoable in one gesture.** The tool snapshots the document before applying and offers the undo as a verb chip on the widget it publishes.
5. **The vocabulary is the single source of truth.** New presentation types (`tile`, `workspace`, `app`) and new verbs are declared once in the demo's zod/`defineVocabulary`, exported to `vocabulary.json`, embedded by Go, and thereby appear in the system prompt and in `pbui_describe_types` automatically.

### 5.2 Three layers, deliberately

The instinct is to expose one tool per gesture. That produces a dozen near-identical tools and a model that gets lost. The instinct after that is to expose one tool taking raw `MutationBatch` JSON — the `hyperslop ui mutate` shape. That produces documents the applier rejects, because the model has to hand-build `placementSplit{workspaceId, placementId, direction, ratio, splitId, newPlacement{id, body:{case:"leaf", value:{viewId}}}, place}` correctly on the first try.

Take all three, at different altitudes, and let the tool descriptions steer:

```
   ALTITUDE          TOOL                         WHAT THE MODEL WRITES              WHO VALIDATES
   ────────          ────                         ─────────────────────              ─────────────
A  declarative       workbench_create_workspace   {name, layout: LayoutSpec}         zod → layoutMutations()
   "a whole screen"  workbench_open_tile          {appId, documents?, near?, title?}  zod → verbs.openView()

B  gestures          workbench_perform            {verbs: WorkbenchVerb[]}           zod discriminated union
   "one change"                                                                       → performWorkbenchVerb()

C  protocol          workbench_apply  (opt-in)    {mutations: Mutation[]}            applyMutations() only
   "the raw thing"                                                                    → MutationError to the model
```

- **Layer A is the one that answers G4/G5**, and the one the prompt pushes the model toward. `LayoutSpec` is already the demo's own vocabulary for saying "chat left at 60 %, three panels stacked right" (`document.ts`: `tile()`, `split()`); the model writing the same nested JSON a developer writes is a good sign the dialect is right.
- **Layer B is the general door**, and the only one that ever gets a *batch*, because a batch of gestures is atomic in the store (`mutate()` applies all or nothing).
- **Layer C exists for parity with `hyperslop ui mutate` and for anything the verbs cannot express** (a `viewClone`, a `placementReplace`). **Ship it disabled** behind `createWorkbenchTools({ allowRawMutations: false })` and turn it on only if a real need appears. Its failure mode — a rejected batch with a `MutationError{code, path, detail}` — is at least legible, and returning that string to the model is enough for it to retry, exactly as the widget validator's messages taught it to fix widget documents in PBUI-AGENT-1 (*"verbs[3]: verb reorder is missing productId"*).

### 5.3 The tool surface

Six tools. Names are provider-safe (`[a-zA-Z0-9_-]`), inputs are zod schemas that double as the advertised JSON Schema, results are small objects that always include enough for the model to keep going.

#### `workbench_describe` — read the screen

```ts
input:  { workspaceId?: string, includeDocument?: boolean }
output: {
  activeWorkspaceId: string,
  activePlacementId: string | null,
  apps: [{ id, title, singleton, docBound, bindings?: string[], doc?: string }],
  workspaces: [{
    id, name, active: boolean,
    tiles: [{ placementId, viewId, appId, title, documents: {…}, linkedPlacements: number,
              rect?: { x, y, w, h } }],           // rendered fractions 0..1, active workspace only
    tree: LayoutSpec,                              // the SAME dialect create_workspace accepts
    splits: [{ splitId, direction, ratio }],
  }],
  document?: object,                               // full protobuf JSON, only if includeDocument
}
```

Two design points matter here.

**`tree` is round-trippable.** Describing the layout in the dialect the model *writes* means "make the right side 30 % instead of 40 %" can be answered by re-emitting a modified `LayoutSpec`, and "copy this workspace" is a describe followed by a create. It also halves what the model has to learn.

**`rect` is rendered geometry, not document data.** Ratios do not tell a model that the chat tile is 349 px wide and the table inside it is clipped. Computing `rect` by walking the tree with the split ratios (or by reading `getBoundingClientRect()` on `[data-placement-id]` and normalising) lets the agent say "that tile is too narrow for a nine-column table; shall I widen it?" — which is the sort of thing that makes the feature feel intelligent rather than mechanical.

#### `workbench_create_workspace` — G4

```ts
input: {
  name: string,
  layout: LayoutSpec,           // §5.4
  activate?: boolean,           // default true
  workspaceId?: string,         // default: newId("ws")
}
output: { workspaceId, name, active, tiles: [{ placementId, viewId, appId, title }], undoToken }
```

#### `workbench_open_tile` — G5

```ts
input:  { appId: string, documents?: Record<string,string>, near?: string, title?: string }
output: { placementId, viewId, wentToExisting: boolean }
```

Thin over `verbs.openView`, whose "identical bindings → go to the existing tile" rule is *reported*, not hidden: `wentToExisting: true` stops the model from concluding it failed and trying again.

#### `workbench_perform` — G2/G3/G6

```ts
input:  { verbs: WorkbenchVerb[] }        // ≤ 8, the zod union of §4.1 plus the new workspace verbs
output: { applied: number, results: [{ verb, ok, placementId?, error? }] }
```

#### `workbench_switch_workspace`

```ts
input:  { workspaceId: string }
output: { activeWorkspaceId, tiles: [{ placementId, appId, title }] }
```

Separate from `workbench_perform` because switching is the single most likely thing the model wants after creating, and a dedicated tool with a dedicated description is worth one extra manifest entry.

#### `workbench_apply` — Layer C, `available: false` by default

```ts
input:  { mutations: object[] }           // protobuf JSON MutationBatch.mutations
output: { ok: boolean, error?: { code, path, detail } }
```

Note the mechanism: `available` is a function in `BaseTool`, evaluated at manifest time, and `RegisterManifestTools` skips unavailable tools. So `available: () => opts.allowRawMutations && workbench !== null` means the model is never even *told* the tool exists unless the product opts in.

### 5.4 `LayoutSpec` — the dialect the model writes

It already exists, in `packages/pbui-workbench/src/document.ts`:

```ts
type LayoutSpec =
  | { kind: "tile";  appId: string; documents?: Record<string,string>; title?: string }
  | { kind: "split"; direction: "row" | "col"; ratio: number; a: LayoutSpec; b: LayoutSpec };
```

`row` puts `a` and `b` side by side; `col` stacks them; `ratio` is `a`'s share. The demo's own default layout is one expression of it, and it is exactly what the model should learn to write:

```ts
layout(
  split("row", 0.6,
    tile("chat"),
    split("col", 0.34,
      tile("inspector"),
      split("col", 0.5, tile("watchlist"), tile("trace")))),
  { id: "pbui-chat-demo", name: "Gold Coin Shop" })
```

```
    ┌───────────────────────────┬──────────────────┐
    │                           │    inspector     │  ← split("col", 0.34, …)
    │           chat            ├──────────────────┤
    │           0.6             │    watchlist     │  ← split("col", 0.5, …)
    │                           ├──────────────────┤
    │                           │      trace       │
    └───────────────────────────┴──────────────────┘
      split("row", 0.6, chat, right-column)
```

Three rules the tool must enforce before it ever reaches the applier, with error strings written for a model to act on:

| Rule | Message on violation |
|---|---|
| every `appId` is in the registry | `unknown app "invnetory"; available: chat, inspector, watchlist, trace, widget, inventory, sku, metals, notes` |
| `0.1 ≤ ratio ≤ 0.9` | `ratio 0.05 is outside [0.1, 0.9]; use 0.1` |
| leaf count ≤ `limits.tilesPerWorkspace` (default 8), depth ≤ 4 | `layout has 11 tiles, the limit is 8` |
| a doc-bound app must bind every key it declares | `app "sku" needs a "product" binding; got {}` |

The fourth rule needs one addition to `AppDescriptor`: `bindings?: string[]`, the binding keys a doc-bound app requires. It costs one optional field and turns a silently empty tile into a validation message.

### 5.5 Feedback: what the agent sees after it acts

A tool result is the model's only perception. Return, always:

- **the ids it just minted** (`placementId`, `viewId`, `workspaceId`), because the next call will address them;
- **what actually happened** when the verb was smarter than the request (`wentToExisting`, `linkedPlacement: true` when a singleton split into a linked view, `snappedRatio: 0.5` when 0.48 snapped);
- **an `undoToken`**, the id of the snapshot taken before the change.

And publish, once per successful mutating call, a small `pbui.widget` in the transcript so the *human* sees what happened without watching tiles move:

```
┌ layout changed ──────────────────────────────────── <widget> ┐
│ new workspace  Gold desk  ·  3 tiles                         │
│   chat 0.55 │ metals 0.4                                     │
│             │ inventory                                      │
│ [ Go to workspace ]  [ Undo ]  [ Keep ]                      │
└──────────────────────────────────────────────────────────────┘
```

The chips are ordinary verbs (`switchWorkspace`, `undoLayout`) in the product's union, so they route through `createVerbRouter` and land in the trace like everything else. This is `pbui_widget`'s existing `verbs` list — no new rendering.

### 5.6 New presentation types and verbs

Add to the demo vocabulary (`packages/pbui-chat/demo/src/pbui/{types,verbs,vocabulary}.ts`):

| Type | `idHint` | Verbs | Value carries |
|---|---|---|---|
| `tile` | `placementId` | `inspect`, `closeTile`, `splitTile`, `renameTile`, `askAgent` | `{appId, viewId, title, workspaceId, canClose, linked}` |
| `workspace` | `workspaceId` | `inspect`, `switchWorkspace`, `renameWorkspace`, `deleteWorkspace` (danger), `askAgent` | `{name, tileCount, active}` |
| `app` | `appId` | `inspect`, `placeApp`, `askAgent` | `{title, singleton, docBound}` |

and to the verb union:

```ts
z.object({ kind: z.literal("closeTile"),        placementId: z.string() }),
z.object({ kind: z.literal("splitTile"),        placementId: z.string(), direction: z.enum(["row","col"]), appId: z.string().optional() }),
z.object({ kind: z.literal("renameTile"),       viewId: z.string(), title: z.string() }),
z.object({ kind: z.literal("placeApp"),         appId: z.string(), from: z.string().optional() }),
z.object({ kind: z.literal("switchWorkspace"),  workspaceId: z.string() }),
z.object({ kind: z.literal("renameWorkspace"),  workspaceId: z.string(), name: z.string() }),
z.object({ kind: z.literal("deleteWorkspace"),  workspaceId: z.string() }),   // danger: true
z.object({ kind: z.literal("undoLayout"),       token: z.string() }),
// once PBUI-WORKBENCH-2 §5.C lands, these three are free and are the most natural follow-up requests:
z.object({ kind: z.literal("replaceTile"),      placementId: z.string(), appId: z.string(), documents: z.record(z.string(), z.string()).optional() }),
z.object({ kind: z.literal("linkTile"),         placementId: z.string(), viewId: z.string() }),
z.object({ kind: z.literal("rebindTile"),       viewId: z.string(), documents: z.record(z.string(), z.string()) }),
z.object({ kind: z.literal("cloneWorkspace"),   workspaceId: z.string() }),
```

The product verbs above are the demo's own union — the model emits them, `vocabulary.json` validates them, the trace stores them. Each maps to one `WorkbenchVerb` in the `local` handler (`switchWorkspace` → `workspace.select`, `replaceTile` → `tile.replace`, …). The two namespaces are deliberately separate; see §6 Tier 0.2.

All of them are `family: "local"` in the demo's `FAMILIES` map, and the `local` handler translates each into the matching `workbench.verbs.*` call. That single indirection is what buys rule 3: the verbs travel through `createVerbRouter.perform`, which validates against the vocabulary and POSTs the outcome.

`renderTitle` on the Surface then becomes the payoff of G7. Once PBUI-WORKBENCH-2 §5.G lands you register `createTileDescriptor(workbench, { extra: [askAgentAction] })` in the product registry and the value shape below comes from the helper; until then, hand-roll it:

```tsx
<workbench.Surface renderTitle={(view, placement) => (
  <chat.pbui.Presentation
    reference={{ type: "tile", value: { type: "tile", id: placement.placementId,
      value: { appId: view.appId, viewId: view.id, title: placement.label,
               workspaceId: currentWorkspaceId, canClose: placement.canClose,
               linked: placement.placementCount > 1 } } }}
    inComposite doc={`tile showing ${placement.label}`} />
)} />
```

Right-click a tile bar and the object menu offers *Close*, *Split side by side*, *Rename* — the same verbs the agent used, with `disabledBecause: "the last tile cannot be closed"` computed by the descriptor from `canClose`. Two doors, one set of verbs.

### 5.7 Safety: policy, limits, undo

The agent moving furniture around while a person is reading is the failure mode that makes users distrust the whole product. Three mechanisms, in increasing strength:

**Limits** (a plain object; refuse and return a message):

```ts
interface WorkbenchToolLimits {
  tilesPerWorkspace: number;   // 8
  workspaces: number;          // 6
  verbsPerCall: number;        // 8
  layoutDepth: number;         // 4
  mutationsPerCall: number;    // 32   (layer C only)
}
```

**Policy** — per verb kind, one of `allow` / `confirm` / `deny`:

```ts
const DEFAULT_POLICY: Record<WorkbenchVerbKind | "workspace.delete", "allow"|"confirm"|"deny"> = {
  "tile.activate": "allow", "split.resize": "allow", "app.place": "allow",
  "view.open": "allow", "view.setTitle": "allow", "tile.split": "allow",
  "tile.swap": "allow", "tile.dock": "allow",
  "workspace.create": "allow", "workspace.select": "allow", "workspace.rename": "allow",
  "workspace.clone": "allow", "tile.link": "allow", "view.rebind": "allow",
  "tile.close": "confirm",          // destroys what someone may be reading
  "tile.replace": "confirm",        // the pane's previous contents are gone
  "workspace.delete": "confirm",    // destroys several
  "launcher.open": "deny", "launcher.close": "deny",   // the launcher is the human's
};
```

`confirm` is not a new mechanism: it is `pbui_propose`, which already exists, already renders a card, already blocks the tool loop until a person clicks, and already survives reload. The tool calls it *from the browser* before applying:

```ts
if (policy[verb.kind] === "confirm") {
  const decision = await client.tools.requestHuman(PROPOSE_TOOL_NAME, {
    id: `layout-${verb.kind}-${Date.now()}`,
    title: describeWorkbenchVerb(verb),
    body: `The assistant wants to ${describeWorkbenchVerb(verb)}.`,
    danger: true,
  });
  if (decision !== "approve") return { ok: false, error: "declined by the user" };
}
```

> **Open decision D3.** `chat-provider`'s client has no browser-initiated human-tool request today; human tools are parked by *server*-initiated calls. Two exits: (a) the confirming tool is a **human tool itself** (`workbench_confirm_layout`, `mode:'human'`) that the model calls before the mutating one — no library change, one more round trip, and the model can skip it; (b) add `client.tools.requestHuman()` upstream in react-chat — clean, cross-repo. Prefer (a) for v1 and file (b). If (a), make the mutating tool *require* a `confirmationId` for `confirm`-policy verbs so skipping it is a rejection, not a bypass.

**Undo.** Snapshot before, keep a bounded ring:

```ts
const history: { token: string; document: WorkbenchDocument; at: string; label: string }[] = [];
function snapshot(label: string): string {
  const token = `undo-${history.length + 1}`;
  history.push({ token, document: workbench.store.getState().document, at: new Date().toISOString(), label });
  if (history.length > 20) history.shift();
  return token;
}
// undoLayout verb → store.replaceDocument(entry.document)
```

The document is an immutable protobuf message replaced wholesale on each `mutate`, so holding a reference *is* the snapshot; there is nothing to clone.

### 5.8 Persistence and hydration

The demo persists the document to `localStorage` on every committed batch (`demo/src/workbench.ts`) and `parseDocument` returns `null` for anything that does not parse, falling back to the default layout. Two consequences you must not get wrong:

- **An agent-created workspace survives a reload for free.** No server involvement, no session coupling. But it also *outlives the chat session*, so a workspace named after a conversation will confuse the user tomorrow. Put the creating session id in the workspace name or in `document.documents` if you care.
- **`workspaceId` and `activePlacementId` are local-only state and are never serialised** (`store.ts`). After a reload, the active workspace is `workspaces[0]`. If the agent created and switched to workspace 2, a reload silently drops the user back to workspace 1. **Fix in the same tier as the workspace verbs**: persist the active workspace id under a separate key (not in the document — it is this browser's, not the layout's), exactly as PBUI-WORKBENCH-1's §6.2 rule states.

### 5.9 The alternative: a hosted workbench

Everything above keeps the workbench in the browser. The other shape is the one `datalab` already ships and `hyperslop-cli` already drives: a server-stored `WorkbenchResource{workbench, revision}` with conditional writes.

| | Local (this design) | Hosted (`datalab`-style) |
|---|---|---|
| where the document lives | browser store, `localStorage` | server, SQLite, revisioned |
| how the agent writes | frontend tool → `verbs.*` | backend tool → `POST /v1/workbenches/{id}/mutate` with `If-Match` |
| concurrency | none needed | 428 (missing `If-Match`), 409 (`WorkbenchConflict`), idempotency keys |
| works without a browser open | no | yes |
| multi-device, shareable | no | yes |
| new code | ~500 lines in two TS packages | + a Go store, handlers, an SSE stream, and a client controller |
| validation | `applyMutations` (TS) | `pkg/workbench.ApplyMutations` (Go) with `ApplicationCatalog` + `DocumentValidator` |

Take the local one now. It answers every gesture in §1, adds no wire types, and — this is the part that makes it safe to defer — **switching later replaces `store.mutate` with apply-then-queue and changes nothing else**: not the builders, not the renderer, not the apps, not the tool schemas. PBUI-WORKBENCH-1 §6.5 states the same conclusion from the UI side. If you do go hosted, the agent's tools become *backend* tools in `pkg/pbuichat` that call the same client `hyperslop ui mutate` uses (`hyperslop-cli/pkg/client/workbenches.go`), and the browser only re-renders on the SSE `workbench.updated` event.

### 5.10 Decisions, with the alternative that lost

| # | Decision | Alternative | Why |
|---|---|---|---|
| D1 | Workspace tools are **frontend tools** | backend tools over a hosted workbench | the document is in the browser; §5.9 |
| D2 | **Three layers** (declarative / verbs / raw) | one tool per gesture; or raw only | a model needs an altitude that matches its intent; raw-only fails on first contact |
| D3 | `confirm` via a **human tool the model calls** | `client.tools.requestHuman()` upstream | no cross-repo change for v1; see the open decision in §5.7 |
| D4 | Agent verbs go through **`createVerbRouter`** | call `workbench.verbs.*` directly | trace, validation and `disabledBecause` come free; costs one indirection |
| D5 | `tile`/`workspace`/`app` become **presentation types** | keep tiles as chrome | G7; and accept mode over tiles ("which one?") needs it |
| D6 | `LayoutSpec` is the **model-facing dialect** | protobuf `Node` JSON | it is already the human-facing dialect; round-trips through `describe` |
| D7 | Layer C ships **disabled** | ship it on for CLI parity | a raw batch is the easiest way for a model to produce an unusable document |
| D8 | Undo is a **document snapshot ring** | inverse mutations | documents are immutable and replaced wholesale; inverses are error-prone for `dock` |
| D15 | **PBUI-WORKBENCH-2 Phase 1 first**; this ticket starts at Tier 1 | build the workspace verbs here and let the unification adopt them | four products need those verbs and one agent does; the API belongs to the four. Building them here would mint `workspace.switch` against their `workspace.select` and force a rename through every consumer |

---

## 6 · Implementation

Five tiers. Each ends with something you can see in a browser, and each states its acceptance as a gesture. Commit at every tier; `lefthook` runs the whole Go gate (~25 s) on each commit in `pbui`, so do not commit a half-written Go package.

### Tier 0 — workspaces become reachable — **this is PBUI-WORKBENCH-2 Phase 1, not our work**

> **Read `ttmp/2026/08/20/PBUI-WORKBENCH-2--unify-agentlogic-turboproof-hyperblog-and-datalab-ui-around-the-shared-pbui-workbench-package/design-doc/01-…` before writing a line of this tier.** That ticket analysed four product shells (agentlogic, turboproof, hyperblog, datalab-ui) against `pbui-workbench`, produced a 45-row feature matrix, and found that **all four products need workspace verbs** — the same gap §4.2 finds from the agent's side. Its §5.B designs them, its §7 Phase 1 schedules them, and **its Phase 1 acceptance gesture is stated in our demo**: *"In the pbui-chat demo, a second workspace can be created from a verb and switched by a strip."*
>
> Do not implement workspaces twice. **Sequence PBUI-WORKBENCH-2 Phase 1 first, then start this ticket at Tier 1.** The three sub-sections below record what this ticket needs from that phase and where the two designs differ; they are a consumer's requirements list, not an implementation plan.

**0.1 · What PBUI-WORKBENCH-2 Phase 1 delivers that we need.** Phase 1 is §5.A (store injection and mutation hooks), §5.B (workspaces), and §5.C (replace/link/rebind and the split policy). Every one of the three touches this ticket:

| From WORKBENCH-2 | Signature | Why the agent needs it |
|---|---|---|
| §5.A `onRejected(mutations, error)` | `createWorkbench({…, onRejected?})` | **This is our R9.** `store.mutate` currently swallows a `MutationError` into a `console.warn` and returns a bare `false`, so a refused layout reaches the model as "the workbench refused the layout" with no detail. `onRejected` hands us `{code, path, detail}` to return verbatim — the same feedback loop that taught the model to fix widget documents in PBUI-AGENT-1 |
| §5.A `onMutate(mutations, next)` | ditto | the undo snapshot ring (§5.7) and the "layout changed" widget both want a commit hook rather than a store subscription diff |
| §5.B `workspace.select / create / rename / delete / clone` | verb kinds | G4, plus `clone` — which we did not think of and which is the obvious answer to "give me the same screen but for silver" |
| §5.B `workspaces([{id, name, spec}], options?)` | document builder | the multi-workspace seed; our `buildLayout` (0.3) is the shared internal it needs |
| §5.B `<WorkspaceStrip renderWorkspace? />` | component | **the human door for G4.** Without it the agent can create a workspace the user cannot switch back from by hand, which violates rule 1 of §5.1 |
| §5.B `place({crossWorkspace: "switch" \| "link"})` | option | what "open the trace panel" should do when the trace is placed in another workspace |
| §5.C `tile.replace(placementId, appId, documents?)` | verb | "show the inventory in this tile instead" — the single most natural layout request after "open X", and we had no verb for it |
| §5.C `tile.link(placementId, viewId)` | verb | "show the same board here too" |
| §5.C `view.rebind(viewId, documents)` | verb | "point that SKU tile at 2051 instead" — far better than closing and reopening |
| §5.C `splitPolicy` | option | our `tile.split` with no `appId` duplicates; three of the four products open a launcher pane instead. The agent must not depend on the default |
| §5.D `view.open(appId, documents, {at: {placementId, zone}})` | option (Phase 4) | zone-aware open beats our `near`: "put it *below* the chat" becomes expressible |
| §5.G `createTileDescriptor(wb, {extra?})` | helper (Phase 2) | **this is our G7/D5.** WORKBENCH-2 puts the `tile` descriptor in the package as a helper rather than leaving each product to hand-roll it; take the helper and add the chat's `askAgent` through `extra` |

**0.2 · Where the two designs disagree, and who wins.**

| Topic | This guide said | WORKBENCH-2 says | Resolution |
|---|---|---|---|
| the switch verb | `workspace.switch` | `workspace.select` | **`workspace.select`** — it is the one with four product consumers. Rename everywhere below |
| create signature | `createWorkspace(name, spec, {workspaceId?, activate?})` | `workspace.create{workspaceId?, name, spec?}`, `spec` defaulting to `singleTile(launcherAppId ?? first app)` | **WORKBENCH-2's.** Our `activate?` has no analogue there; ask for it in Phase 1 review, or select explicitly afterwards |
| clone | absent | `workspace.clone{workspaceId, newId?}` | adopt; expose it as a tool (§5.3 gains `workbench_clone_workspace`, or just reach it through `workbench_perform`) |
| refused batches | "extend `mutate` to return the error" | `onRejected` callback | **`onRejected`** |
| tile descriptor | product declares it | `createTileDescriptor` helper in the package | **the helper** |
| `describeWorkbench` | ours (§0.3 below) | not designed | **ours** — it is agent-specific, and nothing in WORKBENCH-2 needs it. Land it in this ticket, in `pbui-workbench`, after Phase 1 |

Note the namespace distinction, because it will confuse you once: `workspace.select` is a **`WorkbenchVerb`** (the package's own union, performed by `performWorkbenchVerb`); `switchWorkspace` is a **product verb** in the demo's zod union (validated against `vocabulary.json`, routed by `createVerbRouter`, recorded in the trace). The product verb is what the model emits and what the trace stores; the workbench verb is what the product's `local` handler calls. Keeping them distinct is D4 — it is the indirection that buys the trace.

**0.3 · What this ticket still owns in `pbui-workbench`: introspection.**

The agent cannot mutate what it cannot see, and every verb is addressed by an id — `placementId`, `viewId`, `splitId`, `appId` — that only a read can supply. `workbench.serialize()` returns the full protobuf JSON: correct, wasteful, and hostile to a model. Add, after Phase 1 lands:

```ts
// packages/pbui-workbench/src/describe.ts   (new; this ticket, not WORKBENCH-2)
export interface WorkbenchDescription { activeWorkspaceId; activePlacementId; apps; workspaces; }
export function describeWorkbench(wb: Workbench, options?: { workspaceId?: string; geometry?: boolean }): WorkbenchDescription;

export interface BuiltLayout { mutations: Mutation[]; tree: Node; views: { viewId; appId; title? }[] }
export function buildLayout(spec: LayoutSpec): BuiltLayout;                 // the reusable half of layout(); WORKBENCH-2's `workspaces()` wants it too
export function specOf(doc: WorkbenchDocument, node: Node): LayoutSpec;     // the inverse, so describe() round-trips into create()
```

`geometry` walks `[data-placement-id]` under `wb.root()` and normalises `getBoundingClientRect()` against the root box; keep it opt-in (D12), because it is the only part that needs a mounted DOM, so tests and stories can call `describeWorkbench(wb)` without one.

**0.4 · One thing to hand to Phase 1 as a requirement.** `workspaceId` and `activePlacementId` are local-only state and are never serialised (`store.ts`). After a reload the active workspace is `workspaces[0]`, so an agent-created workspace the user was switched to is silently abandoned on F5. Fix it *inside* Phase 1 (it is a shared bug, not an agent bug): persist the selected workspace under a separate key — not in the document, because it is this browser's, not the layout's. WORKBENCH-2 §5.F designs `createLocalPersistence(wb, {key, version, debounceMs?, migrate?})` in Phase 4; the selected-workspace key belongs there, but the demo needs a two-line stopgap in Phase 1 or its acceptance gesture does not survive a refresh.

**Acceptance (Tier 0).** Not ours to claim: it is WORKBENCH-2 Phase 1's gesture, *plus* `describeWorkbench(layout(spec))` round-trips (`specOf` deep-equals `spec` modulo generated ids) and reports every app in the registry.

### Tier 1 — the tools (`pbui-chat`)  ·  *starts once WORKBENCH-2 Phase 1 has landed*

**1.1 · New module `packages/pbui-chat/src/tools/workbenchTools.ts`.** It is a *factory*, because the tools need the workbench and the workbench needs the chat (`createChatApps(chat)`), so neither can be constructed first:

```ts
export interface WorkbenchToolsOptions {
  getWorkbench(): Workbench | null;      // createPbuiChat's mutable `workbench`
  perform(verb: VerbLike): Promise<Outcome>;   // the product router, so the trace records it
  limits?: Partial<WorkbenchToolLimits>;
  policy?: Partial<WorkbenchPolicy>;
  allowRawMutations?: boolean;
}

export function createWorkbenchTools(options: WorkbenchToolsOptions): ToolDefinition[];
```

Each tool follows the shape `acceptTool.tsx` established — a zod schema, a description written for a model, a result schema:

```ts
const CreateWorkspaceInput = z.object({
  name: z.string().min(1).describe("what to call the workspace, e.g. 'Gold desk'"),
  layout: LayoutSpecSchema.describe(
    "the tiles. A tile is {kind:'tile', appId, documents?, title?}; a split is " +
    "{kind:'split', direction:'row'|'col', ratio, a, b} where ratio is a's share of the space " +
    "and 'row' places a and b side by side. Example: " +
    "{kind:'split',direction:'row',ratio:0.55,a:{kind:'tile',appId:'chat'}," +
    "b:{kind:'split',direction:'col',ratio:0.4,a:{kind:'tile',appId:'metals'},b:{kind:'tile',appId:'inventory'}}}"),
  activate: z.boolean().optional(),
});

const createWorkspaceTool: FrontendTool<CreateWorkspaceInput, CreateWorkspaceResult> = {
  name: "workbench_create_workspace",
  mode: "frontend",
  description:
    "Create a new workspace of tiles and switch to it. Call workbench_describe first to learn the " +
    "application ids. Applications you may place are listed there; never invent one.",
  parameters: CreateWorkspaceInput,
  available: () => options.getWorkbench() !== null,
  async execute(input) {
    const wb = options.getWorkbench();
    if (!wb) return fail("no workbench is attached to this chat");
    const problem = validateLayout(input.layout, wb.apps, limits);      // §5.4, model-facing messages
    if (problem) return fail(problem);
    const undoToken = snapshot(`create workspace ${input.name}`);
    const outcome = await options.perform({ kind: "createWorkspace", name: input.name,
                                            layout: input.layout, activate: input.activate ?? true });
    if (outcome !== "performed") return fail(outcome.replace(/^rejected:/, ""));
    return { ok: true, ...describeNewWorkspace(wb), undoToken };
  },
};
```

Note what `execute` does *not* do: it never calls `wb.verbs.createWorkspace` itself. It performs a **product verb** through the router, and the product's `local` handler is the one line that reaches the workbench. That is D4, and it is why the trace gets the entry for free.

> **Pitfall.** `LayoutSpecSchema` must be a `z.lazy` recursive schema, and `z.toJSONSchema` emits `$ref`/`$defs` for it. Providers differ in their tolerance for `$ref` in a tool schema. If yours objects, flatten to a fixed depth (`SpecDepth3 = tile | split{a: SpecDepth2, b: SpecDepth2}`) — ugly, but the depth limit is 4 anyway, and a schema the provider rejects is a tool the model never sees.

**1.2 · Register them.** In `createPbuiChat.tsx`, the extension is built at construction while `workbench` is assigned later by `attachWorkbench`. Because `available` is a *function*, that is fine:

```ts
const extension: ChatExtension = defineChatExtensions({
  name: "pbui-chat",
  widgets: pbuiWidgets,
  tools: [pbuiAcceptTool, pbuiProposeTool, ...createWorkbenchTools({
    getWorkbench: () => workbench,
    perform: (verb) => router.perform(verb as VerbLike, undefined, { actor: "agent" }),
    ...(options.workbenchTools ?? {}),
  })],
  timelineAdapters: [traceAdapter],
});

attachWorkbench(next) {
  workbench = next;
  void client?.tools.syncManifest();     // re-advertise: `available` flipped to true
}
```

The `syncManifest()` call is the one easy thing to forget. Without it the manifest the server holds still says `available: false` until the next `send()` — which in practice hides the tools for exactly one message, an extremely confusing bug.

**1.3 · Product wiring.** In `demo/src/chat.ts`, add the new verb kinds to `FAMILIES` as `local` and implement them:

```ts
local: (verb, ctx) => {
  const wb = chat.workbench();
  switch (verb.kind) {
    case "createWorkspace": {
      if (!wb) throw new Error("no workbench");
      const id = wb.verbs.createWorkspace(verb.name, verb.layout, { activate: verb.activate });
      if (!id) throw new Error("the workbench refused the layout");
      return;
    }
    case "switchWorkspace":  if (!wb?.verbs.switchWorkspace(verb.workspaceId)) throw new Error(`no workspace ${verb.workspaceId}`); return;
    case "closeTile":        if (!wb?.verbs.close(verb.placementId)) throw new Error("the last tile cannot be closed"); return;
    case "splitTile":        wb?.verbs.split(verb.placementId, verb.direction, verb.appId); return;
    case "renameTile":       wb?.verbs.setTitle(verb.viewId, verb.title); return;
    case "placeApp":         wb?.verbs.place(verb.appId, verb.from ? { from: verb.from } : {}); return;
    case "undoLayout":       restoreSnapshot(verb.token); return;
    …
  }
}
```

Throwing is the contract: `createVerbRouter` catches and records `rejected:<message>`, and the tool turns that into the model's error string. One error path, three consumers.

**Acceptance (Tier 1).** With `devctl up` and a real profile: "what's on my screen?" produces a `workbench_describe` call whose result names four tiles; "open the trace panel" adds a fifth; the trace panel shows both as `actor: agent`.

### Tier 2 — the model is told (prompt and vocabulary)

**2.1 · Vocabulary.** Add the `tile`, `workspace` and `app` types and the eight verbs of §5.6 to `demo/src/pbui/{types,verbs,vocabulary}.ts`, write descriptors for them under `demo/src/pbui/descriptors/`, then regenerate:

```bash
pnpm --filter @hyperslop-systems/pbui-chat-demo vocab      # writes pkg/chatserver/demo/vocabulary.json
```

`exportVocabulary()` is asserted deep-equal to the embedded file by `packages/pbui-chat/src/vocabulary/exportVocabulary.test.ts`; a stale file is a red test, not a runtime surprise. The Go side validates it at boot (`ParseVocabulary` → `Validate`), so a verb field with an unknown coarse type fails the binary immediately.

**2.2 · The prompt section.** `pkg/pbuichat/prompt.go` gains a workbench paragraph, generated from the vocabulary the same way the rest is:

```go
if v.KnowsType("tile") {
    b.WriteString("## The workspace\n")
    b.WriteString("The user's screen is a workbench: one or more workspaces, each a tree of tiles. " +
        "A tile shows one application. Call workbench_describe before changing anything — it returns " +
        "the application ids, the placement ids and the current tree; never invent an id. " +
        "To build a whole screen call workbench_create_workspace with a layout: a tile is " +
        "{kind:'tile',appId}, a split is {kind:'split',direction:'row'|'col',ratio,a,b} and 'row' means " +
        "side by side. For a single change call workbench_perform with one or two verbs. " +
        "Closing a tile or deleting a workspace destroys something the user may be reading: propose it, " +
        "do not do it.\n")
}
```

The `KnowsType` guard matters: a product that does not declare `tile` gets no workbench prose and no confusion.

**2.3 · Worked examples in the tool descriptions.** PBUI-AGENT-1's diary is explicit that this is what fixed `pbui_widget` ("*the model's first `pbui_widget` call guessed a schema … added a worked example to the tool description and to the generated prompt; subsequent runs produced valid documents within one retry*"). Put a complete, valid `layout` value in `CreateWorkspaceInput`'s `.describe()`, not a grammar.

**Acceptance (Tier 2).** `GOWORK=off go run ./cmd/pbui-chat prompt` prints the workbench section; a real run answers G4 in one call with no retry.

### Tier 3 — demo tile types (§7)

Four apps in `packages/pbui-chat/demo/src/apps/`, registered beside `createChatApps(chat)`:

```ts
export const workbench = createWorkbench({
  apps: [...createChatApps(chat), inventoryApp, skuApp, metalsApp, notesApp],
  initial: parseDocument(storage()?.getItem(WORKBENCH_STORAGE_KEY)) ?? defaultLayout(),
});
```

### Tier 4 — the scripted demo, so this works without a model

`pkg/chatserver/scripted/scenarios.go` answers eight intents today by driving the *same* emission and bridge paths the real runtime uses. Add a ninth. A frontend tool is requested exactly like a human tool, with the auto mode instead:

```go
func (e *Engine) workspaceScenario(t *turn) error {
    if !t.hasHumanTool("workbench_describe") {           // the check is "did the browser advertise it"
        return t.say("This client did not advertise the workbench tools.")
    }
    if err := t.say("Let me look at your screen first."); err != nil { return err }
    desc, _, err := t.frontendTool("workbench_describe", map[string]any{})
    if err != nil { return err }
    if err := t.say(fmt.Sprintf("You have %d tiles. Building a second workspace…", tileCount(desc))); err != nil { return err }
    _, _, err = t.frontendTool("workbench_create_workspace", map[string]any{
        "name": "Gold desk",
        "layout": map[string]any{"kind": "split", "direction": "row", "ratio": 0.55,
            "a": map[string]any{"kind": "tile", "appId": "chat"},
            "b": map[string]any{"kind": "split", "direction": "col", "ratio": 0.4,
                "a": map[string]any{"kind": "tile", "appId": "metals"},
                "b": map[string]any{"kind": "tile", "appId": "inventory"}}},
    })
    if err != nil { return err }
    return t.say("Done — I switched you to [[workspace:ws-2|Gold desk]].")
}
```

`t.frontendTool` is `t.humanTool` with `Mode: TOOL_EXECUTION_MODE_FRONTEND_AUTO` (the default `Manager.Request` fills in). Add it beside `humanTool` in `scripted/engine.go`; five lines.

**Acceptance (Tier 4).** `make chat-serve` with no credentials; type "make me a gold desk workspace"; the tiles rearrange. This is also the CI fixture: an end-to-end test in `pkg/chatserver/server_test.go` that answers the bridged call from a fake browser and asserts the trace entry.

### 6.6 · Tests that must exist

| Level | Test | Where |
|---|---|---|
| unit (TS) | workspace create/switch/rename/delete against the protocol types | `packages/pbui-workbench/src/workbench.test.ts` |
| unit (TS) | `specOf(layout(spec))` round-trips | ditto |
| unit (TS) | `validateLayout` rejects unknown app, bad ratio, too many tiles, missing binding — one test per message | `packages/pbui-chat/src/tools/workbenchTools.test.ts` |
| unit (TS) | a `confirm`-policy verb without a confirmation is rejected | ditto |
| unit (TS) | `exportVocabulary()` deep-equals `pkg/chatserver/demo/vocabulary.json` | `vocabulary/exportVocabulary.test.ts` (exists; will fail until 2.1 is done) |
| unit (Go) | the prompt section names every workbench tool and no undeclared type | `pkg/pbuichat/prompt_test.go` |
| e2e (Go) | bridged `workbench_create_workspace`: fake browser answers `/tools/results`, snapshot shows the trace entry with `actor: agent` | `pkg/chatserver/server_test.go` |
| structural | every new `display: grid` rule has a column template | `packages/pbui-chat/test/grid-columns.test.ts` (exists) |
| browser | Playwright: two workspaces, switch, undo, reload keeps the active one | manual, screenshot into `various/` |

---

## 7 · The demo tile types

The chat's own apps (`chat`, `inspector`, `watchlist`, `trace`, `widget`) are all agent machinery. If they are the only things the agent can place, "create a workspace with tiles X" degenerates into rearranging the debugger. Four demo applications fix that, and each one is chosen because it **exercises a mechanism nothing else exercises**:

| App | `singleton` | `docBound` | Bindings | The mechanism it proves |
|---|---|---|---|---|
| `inventory` | no | no | — | an ordinary, duplicable data tile; rows are `product` presentations, so accept mode reaches into a tile the agent placed |
| `sku` | no | **yes** | `product` | doc-bound tiles: `openView` with bindings, "identical bindings → go to", `titleFor(view)` |
| `metals` | **yes** | no | — | singletons: the launcher offers "go to", and a split makes a **linked placement** |
| `notes` | no | **yes** | `note` | `documentPut`/`documentDelete` — the `WorkbenchDocument.documents` map, which nothing in the product uses today |

### 7.1 `inventory` — the eight-SKU table

```
┌ inventory ─────────────────────────────────────── [◧][✕] ┐
│ metal  ▾all   category ▾all              8 SKUs          │
│ ┌──────┬──────────────────────────┬─────┬───────┬──────┐ │
│ │ sku  │ name                     │ qty │ floor │ cost │ │
│ ├──────┼──────────────────────────┼─────┼───────┼──────┤ │
│ │ 2049 │ 1oz American Gold Eagle  │   3 │    12 │ 2412 │ │  ← <product>, right-click → menu
│ │ 2051 │ 1oz Krugerrand           │   7 │    12 │ 2388 │ │
│ │ 3120 │ 1oz Silver Maple         │ 240 │   100 │   31 │ │
│ └──────┴──────────────────────────┴─────┴───────┴──────┘ │
└──────────────────────────────────────────────────────────┘
```

Reads the demo world through the existing HTTP surface (or, simplest, imports the same fixture the Go `pkg/chatserver/demo` package serves — keep one source and generate the TS copy if you must). Every cell in the `sku` column is `<chat.pbui.Presentation reference={{type:"product", value:…}} inComposite />`, which is the entire trick: a tile the *agent* placed immediately participates in accept mode, the object menu, and the mouse-doc line, with no extra code.

Build it from pbui atoms only (`Surface`, `Toolbar`, `SelectInput`, `Text`, `Chip`) — `packages/pbui-chat/test/no-raw-controls.test.ts`'s sibling in `pbui-workbench` fails a raw `<button>`, and the same rule should hold here.

### 7.2 `sku` — the doc-bound detail tile

```
┌ 2049 · 1oz American Gold Eagle ─────────────────── [◧][✕] ┐
│ stock   ▇▇▇░░░░░░░░░░░░░░░  3 / 12                        │
│ 30-day  ▁▂▁▃▅▃▂▁▂▄▆▇▅▃▂▁▂▃▄▂  sold 41                     │
│ cost 2412.00   ·   metal <gold>   ·   category <7>        │
│ [ Watch ]  [ Draft a reorder ]                            │
└───────────────────────────────────────────────────────────┘
```

```ts
export const SKU_BINDING = "product";
export const skuApp = defineApp({
  id: "sku", title: "SKU", tone: "var(--pbui-tone-product)",
  singleton: false, docBound: true, duplicable: false,
  bindings: [SKU_BINDING],                                   // the new field from §5.4
  titleFor: (view) => view.title || `SKU ${view.documents[SKU_BINDING] ?? ""}`.trim(),
  Component: ({ view }) => <SkuTile productId={view.documents[SKU_BINDING]} />,
});
```

This is the app that makes G5 real, and it is the one that teaches the doc-bound rule: `openView("sku", {product: "2049"})` twice **goes to the existing tile** rather than opening a second, and the tool result says `wentToExisting: true` so the model does not retry. `duplicable: false` means the tile's own split button links a second placement of the same view rather than minting a second detail tile — the same behaviour the panels have.

The `Meter` and `Sparkline` atoms already exist in `pbui/src/components/atoms`; use them rather than drawing.

### 7.3 `notes` — the one that uses `documents`

```
┌ notes · gold desk ──────────────────────────────── [◧][✕] ┐
│ ▏reorder 2049 before Friday                               │
│ ▏ask supplier about Krugerrand lead time                   │
│ ▏                                                          │
│                                       saved 14:22 · 2 lines│
└───────────────────────────────────────────────────────────┘
```

`WorkbenchDocument.documents` is a `map<string, DocumentPayload>` where a payload is `{id, format, schema_version, body: Struct}`, and `AppView.documents` binds a name to a payload id. **No application in the workspace uses it.** The notes tile is the cheapest way to prove the whole document half of the protocol works end to end:

```ts
// on edit, debounced:
wb.mutate([mutation({ case: "documentPut", value: { document: create(DocumentPayloadSchema, {
  id: view.documents[NOTE_BINDING], format: "pbui.note", schemaVersion: 1,
  body: structFrom({ text, updatedAt: nowIso }) }) } })]);
```

and it gives the agent something genuinely useful to do: `workbench_open_tile{appId:"notes", documents:{note:"n-gold-desk"}}` after a research answer, with the answer already in it. It also exposes the applier's `document_in_use` guard: `documentDelete` refuses while any view binds the payload, which is the right error to surface in the tool result.

> Persisting note text in `localStorage` under the layout key means a long note is written on every keystroke-debounce. Keep the debounce at ~500 ms and cap the body; `parseDocument` returning `null` on a corrupt entry means a broken note silently resets the whole layout, which is a bad trade. Consider a size check in the persist callback.

### 7.4 `metals` — the singleton board

```
┌ metals ─────────────────────────────────────────── [◧][✕] ┐
│ gold      2 412.10  ▲0.4 %   ████████████████░░░░          │
│ silver       31.02  ▼1.1 %   ███████░░░░░░░░░░░░░          │
│ platinum    985.40  ▲0.2 %   ███████████░░░░░░░░░          │
│ palladium 1 004.75  ─         ████████████░░░░░░░          │
└───────────────────────────────────────────────────────────┘
```

`singleton: true`. Place it twice from the launcher and the second attempt *goes to* the first; split its tile and you get a **linked placement** — the same `AppView` rendered in two rectangles, staying in lockstep because both tiles hand the app one object. It is the cheapest visual proof of a rule that is otherwise invisible, and it gives the agent a legitimate answer to "put the prices somewhere I can see them" that does not multiply tiles.

Rows are `<metal>` presentations, so `[[metal:gold|gold]]` in the agent's prose and the board's first row are the *same object* with the same menu.

### 7.5 Where they live, and the `--demo-apps` question

Put them in `packages/pbui-chat/demo/src/apps/`, not in the `pbui-chat` package. They are product code: they know about SKUs and metals, and `pbui-chat` must stay domain-neutral (README: "the package intentionally does not depend on … Datadrop model types"). If a second product wants an inventory tile it will want a different one.

The exception worth arguing about is a `pbui-workbench` **story-only** set: `stories/demoApps.tsx` already ships `counter` and `notes` fakes for Storybook. Extend those rather than importing product apps into tests.

---

## 8 · Sequences

### 8.1 "Make me a Gold desk workspace" (the whole G4 path)

```
browser                          chatserver / pinocchio / geppetto            model
───────                          ────────────────────────────────            ─────
composer send ─► client.send()
  syncToolManifest()  ──────────► Manager.HandleManifest {revision, tools[…]}
  POST /messages {prompt, refs}
                                 chatapp.Engine.Start
                                   realRuntimeFactory.promptRequest()
                                     plugin.RegisterTools(registry, sid)      pbui_widget, pbui_trace, …
                                     Manager.RegisterManifestTools(sid, reg)  workbench_describe, …
                                     systemPrompt += SystemPromptSection(v)   "## The workspace …"
                                                                        ────► turn
                                                                        ◄──── tool_call workbench_describe {}
                                   BridgeExecutor → Manager.Request(…)
                                   publish ChatFrontendToolCallRequested
  ws frame ◄──────────────────────
  toolRuntime.executeFrontendTool
    describeWorkbench(wb, {geometry:true})
  POST /tools/results {status:"success", result:{…}}
                                 ──► Manager.HandleResult → unblocks
                                                                        ────► tool_result {apps:[…], workspaces:[…]}
                                                                        ◄──── tool_call workbench_create_workspace
                                                                              {name:"Gold desk", layout:{…}}
  (same bridge round trip)
    validateLayout(spec, wb.apps, limits)        ← unknown app / bad ratio ⇒ a message, not a crash
    snapshot("create workspace Gold desk")       ← undo token
    router.perform({kind:"createWorkspace",…}, undefined, {actor:"agent"})
      validateVerb(vocabulary, verb)             ← rejected ⇒ outcome "rejected:…"
      local handler → wb.verbs.createWorkspace(name, spec)
        buildLayout(spec) → viewCreate × 3 + workspaceCreate
        store.mutate([…])  → applyMutations → new document (all or nothing)
        switchWorkspace(id) → setState({workspaceId, activePlacementId:null})
      POST /api/chat/sessions/{id}/verbs {actor:"agent", verb, outcome:"performed"}
                                 ──► pbuichat trace.go: seq++, PbuiTraceEntry ──► trace panel
  Surface re-renders: three tiles
  POST /tools/results {status:"success", result:{workspaceId, tiles:[…], undoToken}}
                                                                        ────► tool_result
                                                                        ◄──── pbui_widget {layout summary + Undo chip}
                                   plugin.EmitWidget → ChatWidgetInstance pbui.widget
  WidgetOutlet renders the card    ◄──────────────────────────────────
                                                                        ◄──── assistant text with [[workspace:ws-2|Gold desk]]
                                   refsSink → EmitRefsForText → pbui.refs
  mentions become live objects     ◄──────────────────────────────────
```

### 8.2 "Open the two lowest-stock gold SKUs" (backend read, frontend write)

```
◄── tool_call shop_products {metal:"gold", low_stock:true}        (backend, Go, in-process)
──► rows                       → plugin projects them into a table widget automatically
◄── tool_call workbench_open_tile {appId:"sku", documents:{product:"2049"}, title:"2049 · Gold Eagle"}
    → verbs.openView("sku", {product:"2049"}, {near: active, title})
      docBound + no view with identical bindings ⇒ viewCreate + placementSplit(longer axis)
──► {placementId:"n-7", viewId:"v-9", wentToExisting:false}
◄── tool_call workbench_open_tile {appId:"sku", documents:{product:"2049"}}      ← the model repeats itself
    → a view with identical bindings exists ⇒ goTo(existing)
──► {placementId:"n-7", viewId:"v-9", wentToExisting:true}       ← the model stops, instead of stacking tiles
```

### 8.3 A `confirm`-policy verb (close a tile)

```
◄── tool_call workbench_perform {verbs:[{kind:"tile.close", placementId:"n-3"}]}
    policy["tile.close"] === "confirm"  and no confirmationId in the input
──► {ok:false, error:"closing a tile needs the user's approval; call pbui_propose first and pass its id as confirmationId"}
◄── tool_call pbui_propose {id:"close-n-3", title:"Close the inventory tile", danger:true}
    (human tool: parked, ProposalCard renders, user clicks Approve)
    ProposalCard → router.perform({kind:"resolveProposal", id, decision:"approve"})   ← trace, actor human
──► {decision:"approve", id:"close-n-3"}
◄── tool_call workbench_perform {verbs:[{kind:"tile.close", placementId:"n-3"}], confirmationId:"close-n-3"}
──► {applied:1, results:[{ok:true}]}
```

### 8.4 Undo

```
user  right-clicks the "layout changed" widget → menu → "Undo"
   → router.perform({kind:"undoLayout", token:"undo-4"})      family: local, actor: human
   → history.find(token) → wb.store.replaceDocument(entry.document)
   → POST /verbs {actor:"human", verb:{kind:"undoLayout"}, outcome:"performed"}   ← trace #12
   (the agent can read it back with pbui_trace and say "I see you undid that; want the panels stacked instead?")
```

---

## 9 · Failure modes, and how you will recognise them

These are the ones you will actually hit. Several are recorded verbatim in PBUI-AGENT-1's diary and PBUI-WORKBENCH-1's §7.5, which is why they are here rather than waiting to surprise you.

| # | Symptom | Cause | Fix |
|---|---|---|---|
| R1 | The model never calls the workbench tools; `pbui_widget` works | the manifest was synced before `attachWorkbench`, so `available:false` was recorded | call `client.tools.syncManifest()` inside `attachWorkbench` (§6 1.2) |
| R2 | The whole turn hangs after a tool call; no error | `Manager.Request` has **no timeout**; the browser threw before `submitToolResult` | wrap every `execute` body in try/catch and always return a result object; never let it throw past `toolRuntime` (it does catch, but a hung promise is not a throw) |
| R3 | Registration throws `frontend tool name "workbench.create" is not provider-safe` | `assertProviderSafeToolName` forbids dots | underscores only |
| R4 | The provider rejects the tool schema | `z.toJSONSchema` emitted `$ref`/`$defs` for the recursive `LayoutSpec` | flatten to a fixed depth (§6 1.1 pitfall) |
| R5 | The layout is right but the tile is empty | the app id is not in the registry | `Surface` renders `EmptyState` naming the id — read it; and `validateLayout` should have caught it first |
| R6 | A wide table inside an agent-placed tile overflows the tile | the app root is a grid with `grid-template-rows` and **no `grid-template-columns`**; an implicit `auto` track sizes to max-content | `minmax(0, 1fr)` on both axes; `grid-columns.test.ts` fails the omission |
| R7 | After a reload the user is back in workspace 1 | `workspaceId` is local-only and is never serialised | persist it separately (§5.8, §6 0.4) |
| R8 | A verb is silently ignored | the vocabulary does not declare its kind, so `validateVerb` rejects it before any handler runs | the outcome is `rejected:unknown verb X` in the trace — look there first, always |
| R9 | `workbench_create_workspace` returns "the workbench refused the layout" with no detail | `store.mutate` swallows a `MutationError` into a `console.warn` and returns `false` | pass `onRejected(mutations, error)` to `createWorkbench` (PBUI-WORKBENCH-2 §5.A) and return its `{code, path, detail}` to the model verbatim |
| R10 | Two workspaces both called "main" and only one renders | `layout()` hard-codes `workspaceId: "main"`; a second `workspaceCreate` with the same id throws `duplicate_id` | `newId("ws")` in `workspace.create`; use `workspaces([…])` for a multi-workspace seed |
| R11 | The demo shows old behaviour after a source edit | the demo consumes `pbui-workbench`/`pbui-chat` through their `dist` | rebuild the libraries before the demo; `make chat-ui` already does |
| R12 | A source edit to a Go package blocks an unrelated commit | `lefthook` runs the full Go gate on every commit in `pbui` | finish the package, or `--no-verify` deliberately and re-run `make ci-check` |

**Debugging order that works.** (1) The trace panel — every attempted verb is there with its outcome, including rejections. (2) The hydrated snapshot: `curl localhost:8090/api/chat/sessions/$SID | jq '.entities[] | select(.kind=="ChatFrontendToolCall")'` shows what the model asked for and what the browser answered. (3) `GOWORK=off go run ./cmd/pbui-chat prompt` shows exactly what the model was told. (4) The browser console — `pbui-workbench: dropped a mutation batch — …` is the applier refusing.

---

## 10 · API reference

### 10.1 New — `@hyperslop-systems/pbui-workbench`

**From PBUI-WORKBENCH-2 Phase 1–2 (consumed, not written here):**

| Export | Signature | Notes |
|---|---|---|
| `createWorkbench` options | `{…, store?, onMutate?(ms, next), onRejected?(ms, err), splitPolicy?, binding?}` | §5.A/§5.C; `onRejected` is our R9 fix |
| `workspaces` | `([{id, name, spec}], options?) => WorkbenchDocument` | the multi-workspace seed |
| `WorkbenchVerb` | `+ workspace.select \| workspace.create \| workspace.rename \| workspace.delete \| workspace.clone` | §5.B |
| `WorkbenchVerb` | `+ tile.replace \| tile.link \| view.rebind` | §5.C — all three are natural agent requests |
| `WorkspaceStrip` | `<WorkspaceStrip renderWorkspace? />` | the human door for G4 |
| `createTileDescriptor` | `(wb, {extra?}) => PresentationDescriptor<TileRef>` | §5.G, Phase 2 — our G7 |
| `view.open` | `+ {at?: {placementId, zone}}` | §5.D, Phase 4 — zone-aware open, better than `near` |

**This ticket's own additions:**

| Export | Signature | Notes |
|---|---|---|
| `buildLayout` | `(spec: LayoutSpec) => {mutations: Mutation[], tree: Node, views: {viewId, appId, title?}[]}` | the reusable half of `layout()`; `workspaces()` wants it too |
| `specOf` | `(doc: WorkbenchDocument, node: Node) => LayoutSpec` | the inverse; makes `describe` round-trip into `create` |
| `describeWorkbench` | `(wb: Workbench, opts?: {workspaceId?, geometry?}) => WorkbenchDescription` | `geometry` needs a mounted `wb.root()` |
| `AppDescriptor.bindings` | `string[]?` | binding keys a doc-bound app requires (propose it into WORKBENCH-2 §5.C's `binding` config) |

### 10.2 Existing — `@hyperslop-systems/pbui-workbench` (unchanged, you will use all of it)

| Export | Signature |
|---|---|
| `defineApp` | `({id, title, tone, singleton, duplicable?, docBound?, titleFor?, Component}) => AppDescriptor` |
| `createAppRegistry` | `(apps) => {get(id), list()}` |
| `tile` / `split` / `layout` / `singleTile` | document builders |
| `serializeDocument` / `parseDocument` | protobuf JSON; `parseDocument` returns `null`, never throws |
| `createWorkbench` | `({apps, initial}) => Workbench` |
| `Workbench` | `.store .verbs .apps .useDocument() .useWorkbenchState(sel) .mutate(muts) .perform(verb) .serialize() .restore(json) .reset() .activePlacementId() .root() .Surface .Launcher` |
| `WorkbenchStore` | `.getState() .subscribe(fn) .setState(patch) .mutate(muts): boolean .replaceDocument(doc)` |
| `workbenchVerbs.*` / `performWorkbenchVerb` / `isWorkbenchVerb` / `describeWorkbenchVerb` | verbs as data |
| `canClose` / `clampRatio` / `placementCount` | predicates |

### 10.3 New — `@hyperslop-systems/pbui-chat`

| Export | Signature |
|---|---|
| `createWorkbenchTools` | `(opts: WorkbenchToolsOptions) => ToolDefinition[]` |
| `WorkbenchToolsOptions` | `{getWorkbench(), perform(verb), limits?, policy?, allowRawMutations?}` |
| `LayoutSpecSchema` | zod schema for the model-facing dialect |
| `validateLayout` | `(spec, apps, limits) => string \| null` — a model-facing message |
| `WorkbenchToolLimits` | `{tilesPerWorkspace, workspaces, verbsPerCall, layoutDepth, mutationsPerCall}` |
| `createPbuiChat({workbenchTools?})` | forwards options to the factory |

### 10.4 The tools, as the model sees them

| Tool | Mode | Input | Output |
|---|---|---|---|
| `workbench_describe` | frontend | `{workspaceId?, includeDocument?}` | `{activeWorkspaceId, activePlacementId, apps[], workspaces[]}` |
| `workbench_create_workspace` | frontend | `{name, layout, activate?, workspaceId?}` | `{workspaceId, tiles[], undoToken}` |
| `workbench_open_tile` | frontend | `{appId, documents?, near?, title?}` | `{placementId, viewId, wentToExisting}` |
| `workbench_perform` | frontend | `{verbs[], confirmationId?}` | `{applied, results[]}` |
| `workbench_switch_workspace` | frontend | `{workspaceId}` | `{activeWorkspaceId, tiles[]}` |
| `workbench_apply` | frontend, `available:false` | `{mutations[]}` | `{ok, error?{code,path,detail}}` |
| `pbui_accept` | human, exists | `{types[], prompt}` | `{reference} \| {cancelled:true}` |
| `pbui_propose` | human, exists | `{id, title, body, danger?, fields?}` | `{decision, id}` |
| `pbui_widget` | backend, exists | `{document}` | `{widget_id, status, error?}` |
| `pbui_trace` | backend, exists | `{since_seq?, limit?}` | `{entries[]}` |
| `pbui_describe_types` | backend, exists | `{types?}` | `{types{}, verbs{}}` |

### 10.5 Workbench protocol (`@hyperslop-systems/workbench-protocol`)

| Export | Signature | Notes |
|---|---|---|
| `applyMutation` / `applyMutations` | `(doc, mutation(s)) => WorkbenchDocument` | clones first; throws `MutationError{code, path, detail}` |
| `newId`, `leafNode`, `splitNode` | construction | |
| `findNode`, `leaves`, `viewsOfApp`, `placementCount`, `workspaceOfPlacement`, `workspaceTree`, `boundDocumentId` | queries | |
| `splitPlacement`, `closePlacement`, `swapPlacements`, `dockPlacement`, `resizeSplit` | `(doc, …) => Mutation[]` | |
| `snapRatio`, `SNAP_RATIOS`, `SNAP_TOLERANCE` | ratio snapping | |
| Go mirror `pbui/pkg/workbench` | `ApplyMutations(ctx, doc, muts, deps, limits)`, `Validate`, `Clone`, `Limits`, `ApplicationCatalog`, `DocumentValidator`, `ValidationError{Code,Path,Detail}` | fixture-checked parity with the TS applier |

Mutation cases: `workbenchRename`, `workspaceCreate`, `workspaceRename`, `workspaceDelete`, `documentPut`, `documentDelete`, `viewCreate`, `viewConfigure`, `viewClone`, `viewDelete`, `viewClose`, `placementReplace`, `placementSplit`, `placementClose`, `splitResize`.

Error codes you will meet: `invalid_mutation`, `duplicate_id`, `unknown_workspace`, `unknown_view`, `unknown_document`, `document_in_use`, `last_workspace`.

### 10.6 Chat transport (`pbui/pkg/chatserver`, unchanged)

```
POST /api/chat/sessions                       -> {sessionId}
POST /api/chat/sessions/{id}/messages         {prompt, refs?, focus?}
POST /api/chat/sessions/{id}/stop
GET  /api/chat/sessions/{id}                  hydrated snapshot
POST /api/chat/sessions/{id}/tools/manifest   {revision, tools[{name, mode, inputSchema, available}]}
POST /api/chat/sessions/{id}/tools/results    {toolCallId, toolName, result, status}
POST /api/chat/sessions/{id}/verbs            {clientSeq, actor, verb, target?, outcome}
GET  /api/pbui/vocabulary                     vocabulary.json
GET  /api/chat/ws                             sessionstream websocket (snapshot, then live)
```

### 10.7 chat-provider (react-chat), the parts you touch

| Export | Notes |
|---|---|
| `FrontendTool<TIn,TOut>` | `{name, description?, mode:'frontend', parameters: ZodType, resultSchema?, available?, execute(input, {signal, toolCallId})}` |
| `HumanTool<TIn,TOut>` | `{…, mode:'human', render({toolCallId, input, status, respond, reject})}` |
| `defineChatExtensions` | `{name?, tools?, widgets?, timelineAdapters?, install?(runtime)}` |
| `ChatClient.tools` | `{register, get, manifest, revision, syncManifest, submitResult}` — **no `requestHuman` yet** (§5.7 D3) |
| `createToolRuntime` | `{cancelActiveFrontendTools, handleFrontendToolUIEvent, reconcileFrontendToolRequests, isPendingHumanTool, respondToHumanTool}` |
| `assertProviderSafeToolName` | `/^[a-zA-Z0-9_-]+$/` |

### 10.8 pinocchio bridge (Go), the parts you must not break

| Symbol | Notes |
|---|---|
| `frontendtools.Manager.HandleManifest / HandleResult` | session-scoped manifest and result routing |
| `Manager.RegisterManifestTools(sid, registry)` | **skips `available:false`**; collides loudly on provider-name clashes |
| `Manager.Request(ctx, sid, pub, Request{MessageID, ToolCallID, ToolName, Mode, Input})` | blocks until the browser answers or ctx is done; **no timeout** |
| `Manager.HasAvailableTool(sid, name)` | what the scripted engine checks |
| `NewBridgeExecutor(manager, fallback)` | the `geptools.ToolExecutor` the composed runtime uses |
| `ToolExecutionMode` | `FRONTEND_AUTO` (frontend tools) vs the human mode (`pbui_accept`/`pbui_propose`) |

---

## 11 · File reference

| Area | Path | What you do to it |
|---|---|---|
| workbench verbs | `pbui/packages/pbui-workbench/src/verbs.ts` | read — **PBUI-WORKBENCH-2 Phase 1 edits this**, not us |
| layout builders | `pbui/packages/pbui-workbench/src/document.ts` | **edit**: extract `buildLayout`, add `specOf` (coordinate with Phase 1's `workspaces()`) |
| store | `pbui/packages/pbui-workbench/src/store.ts` | read — Phase 1 adds `onMutate`/`onRejected` (R9) |
| introspection | `pbui/packages/pbui-workbench/src/describe.ts` | **new** |
| app contract | `pbui/packages/pbui-workbench/src/apps.ts` | **edit**: `bindings?: string[]` |
| tile surface | `pbui/packages/pbui-workbench/src/components/{Surface,Tile,SplitPane,Launcher}/` | read |
| workbench tests | `pbui/packages/pbui-workbench/src/workbench.test.ts` | **edit** |
| the tools | `pbui/packages/pbui-chat/src/tools/workbenchTools.ts` | **new** |
| tool exports | `pbui/packages/pbui-chat/src/tools/index.ts`, `src/index.ts` | **edit** |
| chat assembly | `pbui/packages/pbui-chat/src/createPbuiChat.tsx` | **edit**: register tools, `syncManifest` in `attachWorkbench` |
| verb router | `pbui/packages/pbui-chat/src/router/createVerbRouter.ts` | read (the `actor` option already exists) |
| chat apps | `pbui/packages/pbui-chat/src/apps/createChatApps.tsx` | read |
| vocabulary (TS) | `pbui/packages/pbui-chat/src/vocabulary/{schemas,defineVocabulary,validate}.ts` | read |
| demo verbs/types | `pbui/packages/pbui-chat/demo/src/pbui/{verbs,types,vocabulary,registry}.ts` | **edit**: 3 types, 8 verbs |
| demo descriptors | `pbui/packages/pbui-chat/demo/src/pbui/descriptors/{tile,workspace,app}.ts` | **new** |
| demo router | `pbui/packages/pbui-chat/demo/src/chat.ts` | **edit**: families + local handlers |
| demo workbench | `pbui/packages/pbui-chat/demo/src/workbench.ts` | **edit**: register demo apps, persist the active workspace |
| demo shell | `pbui/packages/pbui-chat/demo/src/App.tsx` | **edit**: `renderTitle` → a `<tile>` Presentation |
| demo apps | `pbui/packages/pbui-chat/demo/src/apps/{inventory,sku,metals,notes}/` | **new** |
| vocabulary (JSON) | `pbui/pkg/chatserver/demo/vocabulary.json` | **regenerate** (`pnpm --filter @hyperslop-systems/pbui-chat-demo vocab`) |
| prompt | `pbui/pkg/pbuichat/prompt.go` | **edit**: the workspace paragraph |
| plugin / tools (Go) | `pbui/pkg/pbuichat/{plugin,tools,emitter,trace,vocabulary,widgetdoc}.go` | read |
| server wiring | `pbui/pkg/chatserver/{server,handlers,real_runtime}.go` | read |
| scripted demo | `pbui/pkg/chatserver/scripted/{engine,scenarios}.go` | **edit**: `frontendTool` helper + one scenario |
| e2e tests (Go) | `pbui/pkg/chatserver/server_test.go` | **edit** |
| protocol schema | `pbui/proto/hyperslop/pbui/workbench/v1/workbench.proto` | read — **do not change** |
| protocol TS | `pbui/packages/workbench-protocol/src/client/{apply,builders,ratios}.ts` | read |
| protocol Go | `pbui/pkg/workbench/*.go` | read |
| chat-provider | `react-chat/packages/chat-provider/src/{tools,core}/` | read; D3 may add `requestHuman` |
| pinocchio bridge | `pinocchio/pkg/chatapp/frontendtools/{manager,bridge}.go` | read |
| agent CLI (parity) | `hyperslop-cli/pkg/cli/uicmd/*`, `hyperslop-cli/pkg/client/workbenches.go` | read — the shape Layer C mirrors |
| hosted reference | `datalab/pkg/server/handlers_workbenches.go` | read if you take §5.9 |
| prior tickets | `pbui/ttmp/2026/08/20/PBUI-AGENT-1--…/`, `pbui/ttmp/2026/08/20/PBUI-WORKBENCH-1--…/` | read first |
| **prerequisite ticket** | `pbui/ttmp/2026/08/20/PBUI-WORKBENCH-2--…/design-doc/01-…` | **§5.A–5.C and §7 Phase 1 must land before Tier 1** |
| completed extraction | `pbui/ttmp/2026/07/31/PBUI-UNIFY-001--…/` | the chrome/CSS/protocol extraction WORKBENCH-1 and -2 build on; all phases done |

---

## 12 · Work breakdown and acceptance

| Tier | Work | Acceptance (a gesture) |
|---|---|---|
| **–** | **PBUI-WORKBENCH-2 Phase 1** (§5.A store injection + hooks, §5.B workspaces, §5.C replace/link/rebind + split policy) | **prerequisite, not ours**: in the pbui-chat demo a second workspace is created from a verb and switched by a strip |
| 0 | `buildLayout`/`specOf`/`describeWorkbench` on top of Phase 1; selected-workspace persistence handed to Phase 1 | `describeWorkbench(layout(spec))` round-trips and names every registered app |
| 1 | `createWorkbenchTools`, registration, `syncManifest` on attach, demo router families | "what's on my screen?" and "open the trace panel" work against a real profile |
| 2 | `tile`/`workspace`/`app` types, 8 verbs, descriptors, regenerated `vocabulary.json`, prompt section | "make me a Gold desk workspace" works in one call; right-clicking a tile bar shows its verbs |
| 3 | four demo apps | "open the two lowest-stock gold SKUs as tiles" produces two `sku` tiles; the second identical call goes to the first |
| 4 | scripted scenario, e2e test, undo widget, confirm policy | `make chat-serve` with no credentials demonstrates the whole thing; closing a tile asks first |

---

## 13 · Open decisions

| # | Question | Options | Recommendation |
|---|---|---|---|
| D3 | how does the browser get a human confirmation it initiated? | (a) a `mode:'human'` `workbench_confirm_layout` tool the model must call first, enforced by requiring `confirmationId`; (b) add `client.tools.requestHuman()` to chat-provider | (a) now, file (b) upstream |
| D9 | does `workspaceDelete` orphan its views? | leave them; or cascade `viewDelete` for views no other workspace references | cascade, and test it — orphans accumulate across a long session |
| D10 | should `workbench_apply` (Layer C) ship at all? | ship disabled; ship enabled; drop | ship disabled (D7); revisit when a verb is genuinely missing |
| D11 | do agent-created workspaces belong to the session? | outlive it (today); name them with the session; delete on session end | name them, do not auto-delete — silently removing a user's screen is worse than clutter |
| D12 | should `describe` include rendered geometry by default? | always; opt-in | opt-in (`geometry:true`); it is the only DOM-dependent part |
| D13 | one `pbui.layout` widget kind, or reuse `text`+`refs` for the summary card? | a new widget child kind is a closed-set change on both sides | reuse the existing kinds for v1; a `layout` kind is a nice-to-have that costs a Go/TS parity change |
| D14 | should the *human* tile gestures also report to the trace? | yes (consistency); no (noise) | yes — otherwise "who moved this?" is unanswerable, and the agent's `pbui_trace` view of the session is a lie |

---

## 14 · Glossary

| Term | Meaning |
|---|---|
| **presentation reference** | `{type, value}` — a typed object PBUI can render, menu and accept |
| **descriptor** | what a type means: `label`, `describe`, `actions → verbs`, `tone` |
| **verb** | a serialisable action object (`{kind, …fields}`); never a closure |
| **accept mode** | `accept({types, prompt})` — the user clicks any matching presentation anywhere |
| **workbench document** | the protobuf `WorkbenchDocument`: workspaces, views, documents |
| **workspace** | one named split tree of placements inside a document |
| **placement** | a `Node` in the tree; a leaf placement is a tile. `placementId` is the node id |
| **view** | an `AppView{id, app_id, documents{}, title?}` — *what* a tile shows; two placements may share one |
| **linked placement** | the same view rendered in two tiles, in lockstep |
| **doc-bound app** | an app that is a view *of* something named in `view.documents` |
| **mutation** | one of fifteen protocol operations; the only legal change |
| **frontend tool** | a browser-executed tool the model calls through the bridge |
| **human tool** | a browser tool that parks until a person answers |
| **trace** | the durable, per-session record of every performed and rejected verb |
| **vocabulary** | `vocabulary.json` — the types, verbs and widget kinds both sides agree on |
