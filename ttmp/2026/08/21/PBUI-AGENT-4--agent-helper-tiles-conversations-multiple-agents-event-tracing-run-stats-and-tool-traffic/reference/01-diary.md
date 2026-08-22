---
Title: Diary
Ticket: PBUI-AGENT-4
Status: active
Topics:
    - pbui
    - chat
    - frontend
    - backend
    - onboarding
DocType: reference
Intent: long-term
Owners: []
RelatedFiles:
    - Path: repo://packages/pbui-chat/README.md
      Note: The package's own docs, written at the close-out (commit ad6c6cc)
    - Path: repo://packages/pbui-chat/src/conversations/ContextTile/ContextTile.tsx
      Note: What the model was told; why the tools list reads the registry (commit 4855631)
    - Path: repo://packages/pbui-chat/src/conversations/ConversationHost.tsx
      Note: One ChatProvider per open conversation; why a runtime is captured, not constructed (commit a5d6d79)
    - Path: repo://packages/pbui-chat/src/conversations/ConversationsTile/ConversationsTile.tsx
      Note: The list of every agent, and which gestures are verbs (commit 324d335)
    - Path: repo://packages/pbui-chat/src/conversations/EventsTile/EventsTile.tsx
      Note: The wire log as a list; rows are chatEvent objects (commit 4a83e0e)
    - Path: repo://packages/pbui-chat/src/conversations/registry.ts
      Note: The conversation registry — records, lazy runtimes, mirrors, the active conversation (commit a5d6d79)
    - Path: repo://packages/pbui-chat/src/conversations/selectors.ts
      Note: The three memos that make cross-conversation joins cheap and correct (commit ba6613d)
    - Path: repo://packages/pbui-chat/src/conversations/verbs.ts
      Note: The five conversation verbs and their one dispatcher (commit 324d335)
    - Path: repo://packages/pbui-chat/src/createPbuiChat.tsx
      Note: |-
        pending, chatClientRef, Binder — one client per product today
        Per-conversation pending, tools and extensions; one router binding (commit a5d6d79)
    - Path: repo://packages/pbui-chat/src/router/createVerbRouter.ts
      Note: PerformOptions.conversationId and the session-aware binding (commit a5d6d79)
    - Path: repo://packages/pbui-chat/src/tools/conversationTools.ts
      Note: conversation_list and the confirm-gated conversation_send (commit 4855631)
    - Path: repo://pkg/chatserver/handlers.go
      Note: HandleCreateSession mints a uuid; no list endpoint
    - Path: repo://pkg/chatserver/scripted/scenarios.go
      Note: 'The scripted handoff: list, propose the exact message, send (commit 4855631)'
    - Path: repo://pkg/chatserver/sessions.go
      Note: The session index — a list the server can rebuild or lose (commit ad6c6cc)
    - Path: repo://pkg/pbuichat/prompt.go
      Note: 'The ## Conversations section, gated on the conversation type (commit 324d335)'
    - Path: repo://pkg/pbuichat/trace.go
      Note: The server re-validates a verb against its EMBEDDED vocabulary; a stale binary rejects a verb the browser performed
ExternalSources: []
Summary: ""
LastUpdated: 2026-08-21T16:01:43.842023888-04:00
WhatFor: ""
WhenToUse: ""
---







# Diary

## Goal

Record the design of `PBUI-AGENT-4` — many conversations on one workbench, and the tiles that help a person work with several agents — and, when the user asks for it, the implementation phase by phase.

## Step 1: Evidence, the session model, and the guide

The user asked for a ticket with an intern guide designing "tiles that would be good helpers for the agent (conversation management, event tracing, etc.)", plus a *new conversation* gesture and the ability to open several agents at once; and then to stop at the design and tasks. The evidence pass read the chat-provider package as installed (`react/ChatProvider.js`, `core/createChatClient.{d.ts,js}`, `store/{overlaySlice,runStatsSlice,timelineTypes}.d.ts`, `ws/wsManager.d.ts`, `debug/*.d.ts`, the package's `exports` map and `tools/toolRegistry.d.ts`), pbui-chat's `createPbuiChat.tsx`, `createChatApps.tsx`, `ChatApp.tsx`, `Messages.tsx`, `context.tsx`, the trace adapter and types, the demo's `App.tsx`/`chat.ts`, and the Go side (`server.go` routes, `handlers.go` create/submit/stop/snapshot, `go doc` for `sessionstream.Hub`, `Session`, `HydrationStore`, `Snapshot`, `chatapp.Service`, `serverkit`).

Three facts decided the design. One `<ChatProvider>` builds one Redux store, one WebSocket manager and one client, and the overlay slice holds exactly one session id — a provider is a session by construction; but every piece it assembles is exported from the package's subpaths, including both React contexts, so a runtime can be built as a value outside React and scoped with the same contexts (D1). `createPbuiChat` keeps one `pending`, one `chatClientRef` and one router binding, all of which assume one client (D4, D5, 4.5). And the server mints session uuids and remembers nothing — there is no list — while the hub and hydration store remain authoritative, so a session index can be a rebuildable convenience the browser merges rather than trusts (D10). The helper tiles mostly *show* state the runtime already records and nobody renders: the debug event stream and its classified store (keyed by conversation id already), the run-stats slice, `tool_call` entities and the parked human tools, and the manifest the browser syncs.

### Prompt Context

**User prompt (verbatim):** "THen create a new ticket and make a similar design doc where you design out the tiles that would be good helpers for the agent (conversation management, event tracing, etc...). Also the agent should have a "new conversation" and I should be able to open multiple agents at the same time. 

Create  a detailed analysis / design / implementation guide that is for a new intern, explaining all the parts of the system needed to understand what it is, with prose paragraphs and bullet point sand pseudocode and diagrams and api references and file references. It should be very clear and technical. Store in the ticket and the nupload to remarkable."

**Mid-turn:** "Stop when the design doc and the tasks have been written, don't carry on with implementing."

**Assistant interpretation:** Open `PBUI-AGENT-4`; design the multi-conversation model (registry, runtime-as-value, doc-bound chat app, session-aware router and tools, the server's list) and five helper tiles (Conversations, Events, Runs, Tools, Agent context); write the guide and the tasks; upload; do not implement.

**Inferred user intent:** Work with more than one agent on the same workbench, start fresh conversations at will, and see what the agents are doing — events, cost, tool calls, what they were told — without reading logs.

**Commit (code):** none — design only.

### What I did

- `docmgr ticket create-ticket --ticket PBUI-AGENT-4 …`; the guide (design-doc) and this diary.
- Wrote the guide: §1 five scenes, §2 the system as it stands (a session end to end, what pbui-chat assumes, what the runtime records and nobody shows, the registry pattern to reuse), §3 the gap table, §4 the design — runtime as a value, the conversation registry with a state diagram, the session-aware router, per-runtime tools, pbui-chat under many runtimes, the five tiles, the agent's `conversation` type/verbs/tools, the server's index — with D1–D12, §5 six phases, §6 sequences, §7 R1–R14, §8 testing, §9–§10 references, §11 open questions, §12 glossary.
- Seven tasks (phases 0–5 and the slips).

### Why

- The design had to start from how a session is built in the browser; everything else follows from "a runtime is a value, not a provider".
- The helper tiles are cheap once the registry exists because the data is already there; the guide says which slice or store each reads so an intern does not invent a second record of it.

### What worked

- chat-provider's subpath exports (`/core`, `/store`, `/tools`, `/ws`, `/debug`) contain everything `ChatProvider.js` uses, so no fork and no slice changes are needed.
- The debug store is keyed by conversation id already and ships a classifier — the Events tile is presentation only.

### What didn't work

- N/A (no code). One evidence note: `go doc` for `chatapp.Service` and `sessionstream.Hub` needed `GOWORK=off`, as every Go command in this repo does.

### What I learned

- `ToolExecutionContext` carries only `signal` and `toolCallId`; a tool cannot learn its session from the runtime, which is why descriptors must be instantiated per session (D5).
- `client.reset()` exists and clears the three slices and the persisted id — the one-conversation "new conversation" door — but it is the wrong primitive for many conversations because it destroys the runtime it is called on.

### What was tricky to build

- Choosing where the runtime lives. A `ChatProvider` per chat tile is the obvious design and loses the socket and transcript whenever the tile unmounts; the registry owning runtimes above the workbench, with tiles *scoping* to them, is the design that survives layout changes (D2).
- Attributing verbs and tools to a session with one product-wide router. The binding resolves a target per call (`conversationId`, default the active conversation) rather than holding one client (D4).

### What warrants a second pair of eyes

- D1's dependency on chat-provider subpath exports; an upstream `createChatRuntime` would be cleaner (Q1).
- R9: `conversation_send` between agents under `confirm`; a product may want `deny`.
- Q5: N sockets for N open conversations.

### What should be done in the future

- Implementation, Phase 0 first, with the plan slip and start/end slips per phase — when the user asks.

### Code review instructions

- Read the guide §2.1–§2.2 first (the constraint), then §4.1–§4.5 (the design), then §5 Phase 0.
- `docmgr doctor --ticket PBUI-AGENT-4 --stale-after 30` must be clean.

### Technical details

- chat-provider `0.5.0`; pbui commit `240ffc6` for line anchors.


## Step 2: Phase 0 — the runtime as a value, the registry, the scoped chat

Phase 0 is the whole of the multi-agent change; the five helper tiles that follow are views over what it builds. It turns a chat runtime into something a plain object can hold several of, gives the product a registry that owns those runtimes and remembers the conversations behind them, rebinds the `chat` application to a `conversation` document, and threads a conversation id through the verb router so a trace lands in the session the verb came from.

The design's first move — `createChatRuntime(config)`, assembled from chat-provider's exported pieces — turned out to be unbuildable, and the substitute is the interesting part of this step. Everything else went as designed.

### Prompt Context

**User prompt (verbatim):** "Go ahead. commit at appropriate intervals and keep a detailed diary as you work (using the diary format from the skill)"

**Assistant interpretation:** Implement the phases listed in the previous turn, starting at Phase 0, committing per phase and keeping a diary step per phase in the skill's format.

**Inferred user intent:** Get the multi-conversation workbench actually built, with the reasoning and the failures recorded as they happen rather than reconstructed afterwards.

**Commit (code):** `a5d6d79` — "PBUI-AGENT-4 Phase 0: many conversations on one workbench"

### What I did

- `packages/pbui-chat/src/conversations/runtime.ts` — the `ChatRuntime` value (session id, store, client, the runtime context, `lastManifest`, `lastSend`, `syncManifest`) and `chatRuntimeOf`, which wraps a captured chat-provider graph.
- `packages/pbui-chat/src/conversations/ConversationHost.tsx` — one `<ChatProvider>` per open conversation, rendered at the product root; a `Capture` child dispatches `overlaySlice.actions.setSessionId(id)`, reports the runtime to the registry, connects it, and on unmount detaches and calls `client.reset()`. Plus `ChatRuntimeScope`, which re-provides the two contexts `ChatProvider` provides.
- `packages/pbui-chat/src/conversations/registry.ts` — `createConversationRegistry`: records in storage, a debounced write, a corrupt-entry sidestep, lazy runtimes, one store subscription per open runtime mirroring `runStatus`/`wsStatus`/`error`/`streaming`/`stats`/`waiting`, derived message counts and auto titles, `create` (POST `/api/chat/sessions`), `adopt`, `open`, `close`, `rename`, `pin`, `archive`, `forget`, `activate`, `configFor`, `forEachOpen`, `flush`, `useConversations`.
- `packages/pbui-chat/src/conversations/ConversationScope.tsx` and `ActiveConversationScope.tsx` — what a tile showing one conversation, and a singleton following the active one, wrap their content in.
- `packages/pbui-chat/src/createPbuiChat.tsx` — `pending` became a `Map` keyed by conversation; `chatClientRef` is gone; the agent's tools are built per conversation by `toolsFor(id)`; `extensionFor(id)`; the registry is constructed here from a `conversations` option; `sendTo(conversationId, body)`; `syncAllManifests()` on `attachWorkbench`/`attachSandbox`; the Binder binds the router once for the product and renders `<ConversationHost>`.
- `packages/pbui-chat/src/router/createVerbRouter.ts` — `PerformOptions.conversationId`, `RouterBinding.conversation(id?)`, `RouterContext.conversationId`/`client`/`runtimeFor`, `sendToAgent(template, refs, target?)`, and a `report` that takes the resolved session id.
- `packages/pbui-chat/src/apps/createChatApps.tsx` and `ChatApp.tsx` — `chat` is `docBound` on `bindings: ["conversation"]`, `duplicable`, titled from the registry; the component wraps `ChatSurface` in a `ConversationScope` and says so when a tile carries no binding. The `trace` tile is wrapped in an `ActiveConversationScope`.
- Demo — `chat.ts` declares the conversations key; `workbench.ts` gained `bootstrapConversations()` (legacy session id → first record, else the newest record, else `create()`), `bindLooseChatTiles()`, a `resetLayout` that rebinds, and a console door `__pbuiDemo.conversations`; `main.tsx` awaits the bootstrap before the first render; `App.tsx` dropped `<ChatProvider>` and reads the active conversation for the environment and the masthead status.
- Tests — `registry.test.ts` (13) and `conversations.test.tsx` (7).
- `packages/pbui-chat/package.json` — `react-redux` is now a declared dependency (see below).

Commands: `pnpm --filter @hyperslop-systems/pbui-chat typecheck`, `… test`, `… build`, `pnpm --filter @hyperslop-systems/pbui-chat-demo typecheck`, `make chat-ui`, `tmux new-session -d -s pbui-chat "make chat-serve"`, then Playwright against `http://localhost:8090/`.

### Why

A `<ChatProvider>` is a session by construction: one store, one WebSocket manager, one client, one `overlay.sessionId`. Anything that wants two agents on one screen has to break that one-to-one, and the only two places it can break are "one provider, many sessions" (a rewrite of chat-provider's slices) or "many providers, one product". The second is what this phase builds.

The registry rather than a React context, because the helper tiles that follow are SIBLINGS of the chat tiles in a workbench layout, not descendants — the same argument that put the selected sandbox in `createInstanceRegistry` rather than in a provider above the script tiles.

### What didn't work

**`createChatRuntime` cannot be written from the package's exports.** The guide's §4.1 sketch imports `createToolRuntime` from `@go-go-golems/chat-provider/tools`. It is not there:

```
$ cat node_modules/@go-go-golems/chat-provider/tools/index.d.ts
export { defineTool, defineToolUI, createToolRegistry, ChatToolRegistry } from './toolRegistry';
export type { FrontendTool, HumanTool, BackendToolUI, ToolRegistry, ToolExecutionMode, ToolDefinition } from './toolRegistry';
export { useTool } from './useTool';
…
$ grep -n "createToolRuntime\|toolRuntime" index.d.ts core/index.d.ts tools/index.d.ts ws/index.d.ts
(no output)
```

and the package's `exports` map has no wildcard (`.`, `/core`, `/store`, `/tools`, `/widgets`, `/ws`, `/debug`), so `…/tools/toolRuntime` is not importable either. `createChatClient` requires a `ToolRuntime`, so the factory has no way to make one. Vendoring the 111-line implementation does not help on its own: it is built on `parseToolInput`, `parseToolResult` and `formatToolValidationError`, which are not exported from `toolRegistry` either — vendoring the runtime means vendoring the registry's input and result validation, and then two copies of the tool contract drift apart the first time chat-provider changes one.

The substitute keeps every property the design wanted from the factory and uses only public API: `ConversationHost` renders one `<ChatProvider>` per open conversation at the product root, and a capture component inside each reports the runtime graph (`useChatRuntime()`) and the store (`useChatStore()`) to the registry. The lifetime is still the conversation's rather than a tile's, because the host is mounted outside every tile; the session id is still known up front, because the capture dispatches it into the overlay before `connect()` and every runtime's `sessionPolicy` is `never`; the extensions and `sendMessageBody` are still per session, because they come from `registry.configFor(id)`. What is lost is synchronous construction: `registry.open(id)` marks a conversation open and a runtime appears one effect later, so `ConversationScope` renders "opening conversation…" for a frame. That is the whole cost, and it is visible in the tests as a `waitFor`.

`ChatProvider` has no cleanup of its own, so the host's capture calls `client.reset()` on unmount — otherwise a closed conversation's socket would stay open for the life of the page.

**`ChatRuntimeContextValue` is not exported by name.** `/core` exports the context and the hooks but not the type. `conversations/providerTypes.ts` recovers it as `ReturnType<typeof useChatRuntime>` rather than re-declaring it, so it cannot drift the day chat-provider adds a field.

**Two React copies, via an undeclared `react-redux`.** `ChatRuntimeScope` needs `react-redux`'s `Provider` to re-provide a store under `ChatReduxContext`. pbui-chat had never imported `react-redux` directly — it was in the build's externals list but not in `dependencies` — so the bare specifier resolved from the monorepo root, whose copy pulled a different React than the one react-dom had loaded:

```
TypeError: Cannot read properties of null (reading 'useMemo')
 ❯ Module.process.env.NODE_ENV.exports.useMemo ../../../../../../node_modules/react/cjs/react.development.js:1209:33
 ❯ Provider ../../../../../../node_modules/react-redux/src/components/Provider.tsx:62:29
```

This is exactly the failure `pbuiVite()` exists to prevent, arriving through a package that was used but not declared. The fix is the declaration: `"react-redux": "^9.3.0"` in `dependencies`, `pnpm install`, and it resolves beside the same React as react-dom. Five `Messages` tests went from failing to passing with no other change.

**The trace tile lost its store.** First browser load after dropping `<ChatProvider>`:

```
TypeError: Cannot destructure property 'store' of 't(...)' as it is null.
pbui-workbench: trace failed to render …
```

`TracePanel` calls `useChatSelector`, and with no provider above the workbench there is no Redux context to read. This is the design's §4.5 point arriving as a runtime error rather than as a note: the trace is per session, so the tile has to name a session. `ActiveConversationScope` is that — a singleton scoped to the active conversation, with an empty state when none is.

**The component-folders test.** `ConversationHost.tsx`, `ConversationScope.tsx` and `ActiveConversationScope.tsx` are providers, not components; they joined `createPbuiChat.tsx` and `context.tsx` in `NOT_COMPONENTS`.

### What worked

- Two chat tiles, two sessions, two transcripts. In the browser: `__pbuiDemo.conversations.create({ title: "second agent" })` then `openView("chat", { conversation: id })` put a second agent beside the first; sending a message into each produced two independent replies (2 message entities each, checked in each runtime's own store), and the masthead's status followed the active conversation.
- Titles behaved as D7 says: the first conversation's tile bar changed from "NEW CONVERSATION" to "HELLO FROM THE FIRST AGENT" the moment its first user message landed, while the second kept the human title it was created with.
- The router's targeting works both ways round: a verb performed with `conversationId: B` while A is active POSTs to `/api/chat/sessions/B/verbs`, and a verb with no conversation goes to the active one.
- A mention queued in A does not ride on B's next message — the failure that made `pending` per runtime in the first place.

### What I learned

- A package's `exports` map is part of its API surface in a way a design doc written from `.d.ts` files will miss. Checking that a *symbol* exists is not checking that it is *reachable*; the guide's §4.1 was written against `tools/toolRuntime.d.ts` being on disk, which it is, under a path no consumer can import.
- "Used but not declared" dependencies are invisible until the day the first direct import appears. pbui-chat had `react-redux` in its bundler externals for years of transitive use and no entry in `dependencies`; the moment a source file imported it, resolution walked to the wrong node_modules.
- Removing a provider from the root is a search-and-replace over every hook that reads it. `grep -ln "useChatSelector\|useChatRuntime\|useChatClient\|useChatStore"` found the four components that needed a scope; the trace tile was the only one outside a conversation.

### What was tricky to build

**Tools that know which model called them.** A frontend tool's `execute` receives `{ signal, toolCallId }` and nothing else, so one shared descriptor cannot tell which conversation's model invoked it — every verb it performed would be traced against whichever conversation happened to be active. The first attempt wrapped `execute` to pass a `conversationId` in the execution context, which does not work: `createWorkbenchTools` and `createSandboxTools` call `options.perform(verb)` from a dozen places deep inside their own closures and never see the execution context. Threading the context through all of them is a wide change for a narrow fact. Setting an ambient "current conversation" around the call is worse — `execute` awaits, so two tool calls from two conversations interleave and the ambient is wrong for one of them.

What works is to build the tool sets per conversation: `toolsFor(id)` creates a `createWorkbenchTools`/`createSandboxTools` pair whose `perform` is `router.perform(verb, undefined, { actor: "agent", conversationId: id })`, memoised per id. The knowledge lives in a closure created when the conversation was, where it is exact and cannot race. It also settles a question the design left open: each agent gets its own layout undo ring, which is what "undo what you just did" has to mean when two agents are rearranging one screen. The cost is that `chat.workbenchTools` / `chat.sandboxTools` are gone as product-level values, replaced by `chat.toolsFor(id)`; nothing outside the tools' own tests used them.

**Testing a send without a server.** The queued-mention test wants to prove that refs queued in A do not appear in B's body. Driving it through `client.send` hangs: `send` calls `ensureConnection`, the socket has nowhere to go, and the transport retries until the 5-second test timeout with a wall of `websocket error` on stderr. The test now drives the real queue (`scoped.get(A).send(...)`, not awaited — the `pending.set` is synchronous, before the first `await`) and reads it back through `configFor(id).sendMessageBody`, which is the very function the client would call next. `autoConnect: false` keeps the rest of the suite off the network; the demo turns it on.

**Bootstrapping a doc-bound chat tile.** A `chat` tile needs a conversation id, and a fresh browser has to ask the server for one, so the id is not available when the layout is built. `main.tsx` awaits `conversationsReady` before the first render, and `bootstrapConversations` covers the three cases: records in storage, the one-session build's persisted `pbui-chat-demo.session` (adopted once, then removed so it cannot resurrect as a duplicate), or a `create()`. `resetLayout` rebinds too — the default layout's `tile("chat")` carries no binding, so without that, "reset layout" would hand the user an unbound tile.

### What warrants a second pair of eyes

- The `Capture` effect in `ConversationHost` depends on `[registry, conversationId, store, context]`. `store` and `context` come from `ChatProvider`'s `useMemo` and are stable for the life of that provider, so the effect runs once per conversation; if a future chat-provider rebuilt them, the effect would re-attach and re-connect. Worth an assertion rather than an assumption.
- `client.reset()` on unmount clears the runtime's timeline as well as disconnecting. That is right today because the store is thrown away with the provider, but it is a bigger hammer than "disconnect" and would be wrong if a runtime were ever reused.
- The mirror's `sync()` runs on every store notification of every open runtime, and recomputes `countWaiting` over all `tool_call` entities each time. Fine at demo scale; a long transcript with many tool calls across several open conversations is the case to measure.
- React StrictMode double-invokes effects in development; the demo runs under it and the browser check was clean, but the attach/detach/attach sequence around `client.reset()` deserves a deliberate look.

### What should be done in the future

- Propose `createToolRuntime` (and the `parseToolInput`/`parseToolResult` helpers) as exports upstream in chat-provider, then replace `ConversationHost`'s provider-per-conversation with the `createChatRuntime` factory the guide describes. The registry API does not change; only how a runtime comes into being does.
- Phase 1 gives *new conversation* a launcher row and a button; until then the demo's console door is the only way to open a second agent.

### Code review instructions

- Start at `packages/pbui-chat/src/conversations/registry.ts` (`createConversationRegistry`, `sync`, `snapshotOf`) and `ConversationHost.tsx` (`Capture`) — between them they are the whole lifecycle.
- Then `createPbuiChat.tsx`: `toolsFor`, `sendTo`, `configFor`, and the single `router.bind` in `Binder`.
- Then `createVerbRouter.ts`: `conversation()` resolution and the `report` that follows it.
- Validate: `pnpm --filter @hyperslop-systems/pbui-chat test` (131), `… typecheck`, `pnpm --filter @hyperslop-systems/pbui-chat-demo typecheck`, then `make chat-ui` and `make chat-serve` and open two chat tiles via `__pbuiDemo.conversations.create()` + `__pbuiDemo.workbench.verbs.openView("chat", { conversation: id }, {})`.

### Technical details

The capture, which is the whole of "a runtime knows its session":

```tsx
useEffect(() => {
  store.dispatch(overlaySlice.actions.setSessionId(conversationId));
  registry.attachRuntime(conversationId, { store, context });
  if (registry.autoConnect()) void context.client.connect().catch(() => undefined);
  return () => {
    registry.detachRuntime(conversationId);
    context.client.reset();
  };
}, [registry, conversationId, store, context]);
```

`ensureSession` in `createChatClient` reads `overlay.sessionId` first and returns it if set, which is why the dispatch above `connect()` is enough to stop it minting a session or reading the URL.

The router's resolution, per call:

```ts
const conversation = binding?.conversation(performOptions?.conversationId) ?? null;
// …handler receives { ...bound, conversationId, client, sendToAgent: defaults to this conversation }
report(reportBinding, conversation?.id ?? null, actor, verb, target, outcome, provenance);
```


## Step 3: Phase 1 — the conversations tile, the gesture, the verbs

Phase 0 made several agents possible; Phase 1 makes them reachable. A person opens a `conversations` tile and sees every agent on the workbench — what each is doing, how long since it said anything, what is waiting for them — and starts another one with a button rather than a console call. The five conversation verbs land at the same time, so the same list of actions is available to a menu, to a chip and (from Phase 4) to a model.

The step also produced the first genuine design correction of this ticket: the router did not tell a handler who was asking, and D7's rule about who owns a conversation's title cannot be enforced without that.

### Prompt Context

**User prompt (verbatim):** "phase 1"

**Assistant interpretation:** Build Phase 1 as listed: the Conversations tile with its row actions, the *new conversation* gesture in the masthead and the launcher, the `conversation` type and five verb kinds with their descriptors, and the gated Go prompt section.

**Inferred user intent:** Continue the ticket phase by phase without re-negotiating the plan.

**Commit (code):** `324d335` — "PBUI-AGENT-4 Phase 1: the conversations tile, the gesture, the verbs"

### What I did

- `packages/pbui-chat/src/conversations/verbs.ts` — `ConversationVerbSchemas` (five zod objects a product splices into its union), `ConversationVerb`, `CONVERSATION_VERB_KINDS`, `CONVERSATION_VERB_DOCS`, `isConversationVerb`, `describeConversationVerb`, and `performConversationVerb(verb, ctx)` — one dispatcher for the four local kinds, throwing on every refusal.
- `packages/pbui-chat/src/conversations/ConversationsTile/` — the tile, its CSS module, its barrel and its test. Rows carry the title (renameable in place), a status chip, the connection when it is not `ready`, the message count, the age of the last activity, the token total and a pinned marker; the header carries *new conversation*, a filter and an archived toggle.
- `packages/pbui-chat/src/apps/createConversationApps.tsx` — the `conversations` singleton, in an `agent` launcher group, with a blurb.
- `packages/pbui-chat/src/router/createVerbRouter.ts` — `RouterContext.actor`.
- Demo — `ConversationValue` and `Values.conversation`; `TONES.conversation`; the five kinds spliced into `VerbSchema` and `VERB_DOCS`; `describeVerb` delegating to `describeConversationVerb`; `descriptors/conversation.ts` (label, describe, and a menu whose fourth entry is the handoff); the descriptor registered; `FAMILIES` entries (four `local`, `conversation.send` `agent`); the local handler delegating to `performConversationVerb` and the agent handler routing `conversation.send` to `sendToAgent` with a target; a `+ conversation` masthead button; launcher rows for *new conversation* and for every open conversation; `__pbuiDemo.router` and `.vocabulary` on the console door.
- Go — `ToolConversationList` / `ToolConversationSend`, `conversationsSection(v)` gated on `KnowsType("conversation")`, and `TestConversationsPromptSectionIsGatedOnTheConversationType`.
- Regenerated `pkg/chatserver/demo/vocabulary.json` with `pnpm --filter @hyperslop-systems/pbui-chat-demo vocab`.

Commands: `pnpm --filter @hyperslop-systems/pbui-chat test` (156), `… typecheck`, `… build`, `pnpm --filter @hyperslop-systems/pbui-chat-demo typecheck`, `GOWORK=off go test ./pkg/...`, `make chat-ui`, Playwright against `http://localhost:8090/`.

### Why

The verbs live in pbui-chat rather than in each product for the same reason the workbench's live in pbui-workbench: the payload shapes, the kind names and — most of all — the refusal strings should be identical everywhere, so a trace from one product reads in another and a model taught one is taught all. A product declares that it offers them (`...ConversationVerbSchemas` in its union, `...CONVERSATION_VERB_DOCS` in its docs) and its `local` handler is two lines.

Pin, archive, close and forget deliberately have no verb. They are facts about THIS browser's list — which conversations it shows, which it keeps a socket for — not about the conversation, which is a session on a server that several browsers could hold. Giving them verbs would put "the user hid a row" in a trace the agent reads.

The helper tiles are a separate factory from `createChatApps` because they are a separate decision. `createChatApps` is the conversation and the three panels every PBUI product has wanted since PBUI-AGENT-1; `createConversationApps` is what starts earning its space at the second agent. A product with one conversation leaves it out and loses nothing.

### What didn't work

**The router did not say who was asking, so every rename was the agent's.** The tile's rename test failed on its first run:

```
AssertionError: expected 'agent' to be 'human'
 ❯ src/conversations/ConversationsTile/ConversationsTile.test.tsx:106:49
```

`performConversationVerb` had `ctx.conversations.rename(id, title, "agent")` hard-coded, because a handler has no way to tell a human's verb from a model's: `RouterContext` carries the store, the vocabulary, the client and the callbacks, and the actor is known only to `perform`, which uses it for the trace and throws it away. So a person renaming a conversation in the tile recorded the title as the agent's — and D7's rule, that a human title is owned and an agent may only replace one nobody has claimed, had nothing to stand on.

The fix is one field: `RouterContext.actor`, filled from the same `performOptions.actor ?? "human"` the trace already uses. `performConversationVerb` now takes the actor too and enforces the rule in both directions — an agent may name a conversation still titled `auto` or `agent`, and is refused with *"the user named this conversation; ask them before renaming it"* once a human has. Both directions are tested.

**A `rejected:unknown verb conversation.new` in the trace that was not real.** Reading a conversation's timeline in the browser after clicking *new conversation* showed the verb rejected — while the conversation had plainly been created. It was a stale bundle: the page had been loaded before the rebuild that added the kinds to the vocabulary, so the running `validateVerb` had never heard of them, and the entry in the session's timeline was left over from that load. Re-probing on a fresh load returned `performed`, four conversations, and the new one active. The lesson is about the check, not the code: a browser check after `make chat-ui` has to start with a navigation, and a timeline read after a reload can still be showing what an older bundle posted.

**The row layout collapsed in a narrow tile.** The first version put the name and the seven action buttons in a two-column grid. In a tile a third of the screen wide the action column took nearly all of it, the title was squeezed to a few characters and the status chip rendered as an empty box. Rows are now stacked — name, meta, actions wrapping — which reads at any width and is what the screenshot in `various/02` shows.

### What worked

- The tile against the real registry and the real router: rename validates against the demo's vocabulary on the way through and lands as `titledBy: "human"`; pin re-sorts the list; archive hides the row behind a toggle that counts what it is hiding; forget drops it.
- *New conversation* from three doors — the masthead button, the tile's header, the launcher row — is the same `conversation.new` verb each time, so all three are one implementation and one trace entry.
- The launcher lists open conversations by name, which is how a person re-opens a tile they closed; the `chat` app itself stays out of the launcher, as every doc-bound app does.
- The Go prompt section is gated exactly like the workspace and programs sections, and the test proves both directions: a vocabulary without the type gets neither the heading nor the tool names.

### What I learned

- A verb's *actor* is not only trace metadata. Ownership rules — who may rename, who may delete, who may overrule whom — are exactly the rules that need it, and a router that keeps the actor to itself forces every such rule into the product's own code where it will be written differently each time.
- Splitting "the conversation and its panels" from "the tiles for working with many conversations" at the factory boundary makes the product's `apps:` array read as a series of decisions rather than a list of components.
- The launcher's skip-doc-bound-apps rule (PBUI-SANDBOX-1 met it with programs) applies verbatim to conversations, and the same shape of fix works: rows of your own, `choose` handling their prefix.

### What was tricky to build

**Which gestures deserve a verb.** The first draft routed all seven row actions through the router, which produced trace entries like "the user pinned a conversation" — noise in a log the agent reads to find out what the user did to the *product*. The split that survives is: a verb when the gesture changes what a conversation IS or where the work goes (new, open, select, rename, send), and a direct registry call when it changes what this browser shows (pin, archive, close, forget). The tile's comment says so, because the next person to add a row action will have to make the same call.

**`conversation.new` and the trace tile.** The new conversation becomes active immediately, and the verb that created it belongs to the conversation that performed it — so right after clicking *new conversation*, the trace tile (which follows the active conversation) is empty, and the entry is in the conversation you just left. That is correct: recording the creation in the new conversation would attribute it to an agent that did not do it, and the conversation had no session id when the verb started. It reads as a gap for a second, and the Conversations tile is where the change is actually visible. Left as it is, noted here because it looks like a bug.

**The descriptor as the handoff door.** The menu entry that matters — *Hand something to this agent…* — is a verb whose target is a conversation other than the one performing it, and it is the only such verb in the shop. Getting `disabledBecause` right for it took three cases rather than one: unknown to this browser, known but closed, open. All three are tested, because a menu that silently drops entries teaches the user that the menu is unreliable.

### What warrants a second pair of eyes

- `ConversationsTile.startNew` sets a `busy` flag around the network round trip, but nothing stops a second click landing after the flag clears and before the list re-renders. Two rapid clicks mint two sessions. That may be acceptable — the user asked twice — but it is untested either way.
- The tile subscribes to `registry.all()`, which changes identity whenever any mirrored field of any open conversation changes, including the token counter during streaming. With several conversations streaming at once the list re-renders on every frame. `all()` is memoised, so the cost is React's diff over a handful of rows; worth measuring before it becomes ten conversations.
- `CONVERSATION_VERB_DOCS` is spread into the demo's `VERB_DOCS` after the product's own entries. A product that spelled a verb `conversation.new` itself would be silently overridden rather than told.

### What should be done in the future

- Phase 4 adds `conversation_list` and `conversation_send`; the prompt section already names both tools, so the section is written against tools that do not exist yet. That is deliberate — the prompt is generated from the vocabulary, and the vocabulary declares the type now — but the gap should not outlive Phase 4.
- The tile shows `waiting` as part of the status chip. Once the Tools tile exists (Phase 3), the count should be a link into it rather than a number.

### Code review instructions

- Start at `packages/pbui-chat/src/conversations/verbs.ts` — the five kinds, the dispatcher, and the ownership rule in `conversation.rename`.
- Then `ConversationsTile.tsx`, particularly which actions call `chat.router.perform` and which call `registry.*`.
- Then `packages/pbui-chat/demo/src/chat.ts` — the two delegations, one per family — and `descriptors/conversation.ts`.
- Validate: `pnpm --filter @hyperslop-systems/pbui-chat test` (156), `GOWORK=off go test ./pkg/pbuichat/...`, then `make chat-ui`, reload `http://localhost:8090/`, place the `conversations` tile from the launcher (group "agent") and use every row action.

### Technical details

The ownership rule, which is the whole of D7 on the write side:

```ts
case "conversation.rename": {
  const snapshot = requireKnown(ctx, verb.conversationId);
  if (!verb.title.trim()) throw new Error("a conversation needs a name");
  if (ctx.actor === "agent" && snapshot.titledBy === "human") {
    throw new Error("the user named this conversation; ask them before renaming it");
  }
  ctx.conversations.rename(verb.conversationId, verb.title, ctx.actor === "agent" ? "agent" : "human");
  return;
}
```

The product's whole conversation integration, in the `local` handler:

```ts
if (isConversationVerb(verb)) {
  await performConversationVerb(verb as ConversationVerb, {
    actor: ctx.actor,
    conversations: chat.conversations,
    workbench: chat.workbench(),
    send: (conversationId, template, refs) => ctx.sendToAgent(template, refs, { conversationId }),
  });
  return;
}
```


## Step 4: Everything is an object

Mid-Phase-2 the user stopped the work with a correction that applies backwards and forwards: conversations should be OBJECTS, their actions should be right-click actions, and in general everything that can be made into an object should be. The conversations tile was rewritten around that, workspaces joined it, and the mouse-doc line moved out of the chat tile to the bottom of the page.

The correction is not cosmetic. An entry in an object menu is a verb or it is nothing, so four gestures Phase 1 had deliberately left OUT of the vocabulary had to go in.

### Prompt Context

**User prompt (verbatim):** "actully, before we move on. I want conversations to be bjects in the PBUI concept, and the actions olike open / activate / rename / pin etc... to be right click action. In general, everything that can be made into an object, should be made into an object. SO update the conversations view to show objects instead of writing out the actions as buttons. Keep that in mind in the future too."

**Second user prompt (verbatim):** "also make workspaces an object. Remove the status bar at the bottom on the chat window and put it at the bottom of tne entire page."

**Assistant interpretation:** Rows in list tiles are presentations, not labels with button rows; the descriptor's menu is the single door to what can be done to a thing; apply it to conversations and workspaces now and to every future tile; and the mouse-doc line is the page's, not a per-tile strip.

**Inferred user intent:** Keep the interface's one rule — objects carry their own verbs — from being eroded tile by tile, and stop the same information being drawn three times.

**Commit (code):** `ed84f22` — "PBUI-AGENT-4: conversations and workspaces are objects; one status bar"

### What I did

- Saved the rule as a durable memory (`pbui-everything-is-an-object`), because it is a standing instruction rather than a fix to this ticket.
- `conversations/verbs.ts` — added `conversation.pin`, `.archive`, `.close`, `.forget`; made `conversation.rename`'s `title` optional, where its absence means "open the editor".
- `conversations/registry.ts` — `renaming()` / `requestRename(id)`: which conversation the interface should be offering a name field for.
- `ConversationsTile` — each row is now a `RefPresentation` of a `<conversation>`; the seven per-row buttons are gone; the inline rename opens when the registry asks for it. The header keeps *new conversation* and the filter, which have no object to hang off.
- Demo — the descriptor carries all ten menu entries with their `disabledBecause` reasons; the vocabulary's `conversation` type lists the new kinds; `FAMILIES` gains four `local` entries.
- Demo `App.tsx` — `WorkspaceStrip`'s `renderWorkspace` renders each workspace as a `<workspace>` presentation with `activate` bound to `workspace.select`; the masthead's connection text is gone; a single `chat.MouseDocLine` sits in a third shell row.
- `ChatApp` — no mouse-doc line, two grid rows instead of three.

### Why

The object menu is the single door to what can be done to a thing. Two doors — a button row beside the name and a menu behind it — drift the moment one gains an action the other lacks, and a seven-button row also crowds out the name it sits beside (which is exactly what it did, see Step 3). Making the row a presentation also gets the rest for free: the mouse-doc line describes it, the focus capture makes it the session's focus so a message about it carries the reference, and the same menu appears when the agent mentions the conversation in a transcript.

Phase 1's split — "a verb when it changes what a conversation IS, a direct registry call when it changes what this browser shows" — was defensible on its own terms and wrong under this rule. `tile.close` and `workspace.delete` are verbs, and they change only this browser's layout; there was never a principle keeping `conversation.close` out, only a worry about trace noise.

### What didn't work

**The menu cannot hold a text field.** `conversation.rename` needs a name, and an object menu has nowhere to type one. pbui-workbench's precedent (`Rename…` performs `setTitle(viewId, currentTitle)` and a product's inline rename supplies the real one) leaves the connection between the menu entry and the editor unwritten.

The shape that works is the one `compareWith` already uses: a verb with a field missing is a REQUEST. `conversation.rename` without a title calls `conversations.requestRename(id)`, the registry notifies, and whatever is showing that conversation opens its editor; committing performs the same verb again, this time with the title. One verb, two meanings, both in the vocabulary — and an agent can now also ask the user to name a conversation rather than naming it itself.

**A trace that said `rejected:unknown verb conversation.pin` while the pin plainly worked.** Twice, over two builds, and only the second time was it real. `pkg/pbuichat/trace.go:134` re-validates the verb against the vocabulary the SERVER embeds and overwrites `performed` with `rejected:` when it does not recognise the kind:

```go
if err := p.vocab.ValidateVerb(payload.GetVerb().AsMap()); err != nil && outcome == traceOutcomePerformed {
    outcome = "rejected:" + err.Error()
}
```

`pkg/chatserver/demo/vocabulary.json` is embedded at compile time, and the server had been running since before `pnpm vocab` regenerated it. Worse, the `tmux kill-session` that was supposed to restart it did nothing — the process had been started from a session that no longer existed, so the ten-minute-old binary kept serving. Adding a verb kind takes three steps, not two: change the schema, `pnpm --filter @hyperslop-systems/pbui-chat-demo vocab`, and restart the server. Skip the third and the browser and the trace disagree about what happened, which is the most confusing failure this system can produce.

**A disabled menu entry has a different accessible name.** The tile test looked for `"Make it the active one"` after activating and found nothing: pbui appends the reason to a disabled entry's label (`Make it the active one — it is already the active conversation`). The test matches a regex now and asserts the reason as well, which is the better assertion anyway.

### What worked

- The rewrite deleted more than it added: the tile lost a `Row` full of button props, an `onPerform` prop drilled through it, and its `.actions` CSS.
- `WorkspaceStrip` needed no change at all. `renderWorkspace` was added for exactly this — its doc comment says "a product that wants its `<workspace>` Presentation puts it there too, so the object menu and this strip are the same verbs" — so the demo just started using it.
- One mouse-doc line instead of one per chat tile is strictly less UI and strictly more information: it now carries the active conversation and its connection status, which the masthead used to duplicate.

### What was tricky to build

**Which gestures stay buttons.** Not everything can be an object action. *New conversation* has nothing to right-click — the object does not exist yet. A filter field is not an action on anything. The Tools tile's *go to* moves the user rather than changing the tool. The rule that came out of it: a button is for a gesture with no object, or one that needs input a menu cannot collect; everything else is a verb in a menu.

**Rename ownership, again.** With `title` optional, `validateVerb` no longer rejects a rename with no title — which is correct, and it broke the test that asserted it did. The replacement asserts the two things that actually matter: a rename with no `conversationId` is refused, and `conversation.pin` without `pinned` is refused.

### What warrants a second pair of eyes

- `requestRename` is registry state, so two tiles showing the same conversation would both open an editor. Today only the conversations tile renders one; a second place (a chat tile bar) would need a rule about which one wins.
- The demo's workspace `activate` performs `workspace.select` directly rather than going through the strip's own `placement.select`, so a product that wrapped the strip differently could end up with two paths to the same verb. The strip's default button is now unreachable in the demo, which is the intent.

### What should be done in the future

- The remaining list tiles built in this ticket (events, runs, tools) were built to this rule from the start. Any future tile should be checked against it before it is written, not after.
- `createTileDescriptor`'s `Rename…` could adopt the same request shape (`view.setTitle` with no title = "ask me"), which would remove the last place where a menu entry performs a verb that changes nothing.

### Code review instructions

- `packages/pbui-chat/src/conversations/verbs.ts` — the four new kinds and the optional-title branch.
- `packages/pbui-chat/src/conversations/ConversationsTile/ConversationsTile.tsx` — what is left of the row.
- `packages/pbui-chat/demo/src/pbui/descriptors/conversation.ts` — the ten entries and their reasons.
- `packages/pbui-chat/demo/src/App.tsx` — `renderWorkspace` and the third shell row.
- Validate: `pnpm --filter @hyperslop-systems/pbui-chat test`, then `make chat-ui`, **restart the server**, and right-click a conversation row and a workspace tab.

## Step 5: Phase 2 — the events tile

Everything this tile shows was already being recorded and thrown away. chat-provider's WebSocket manager emits a debug event for every frame, every lifecycle transition, every projected UI event; `createChatDebugEventStore` classifies each one into six families, summarises it at ingest and keeps a capped ring per conversation id. No product had ever rendered it.

### Prompt Context

**User prompt (verbatim):** "Phase 2, Phase 3"

**Assistant interpretation:** Build the events tile, then the runs and tools tiles.

**Inferred user intent:** Keep moving through the plan; the helper tiles are the point of the ticket.

**Commit (code):** `4a83e0e` — "PBUI-AGENT-4 Phase 2: the events tile"

### What I did

- `conversations/EventsTile/` — the tile, its CSS module, its barrel, its test. Target selector (follow the active conversation or pin one), family chips, a text filter over type and summary, pause, clear, copy the raw frames as JSON with a textarea fallback when the clipboard is unavailable.
- `detailOf(entry)` — the second line for the frames whose detail is the point: a lifecycle transition (`hydrating → ready`), a reconnect's attempt and delay, a ui-event's tool and status, a snapshot's dropped count.
- `chatEventReference(entry, conversationId)` and the demo's `chatEvent` type, descriptor and vocabulary entry, so a row is an object with *inspect the raw frame*, *go to its conversation*, *ask the agent what it means*.
- `PbuiChatContextValue.debug`, so a tile reaches the store the way it reaches the registry.

### Why

The classifier already does the expensive part — deciding what family a frame belongs to and writing a one-line summary — at ingest, once, rather than per render. A tile over it adds no state to the runtime and cannot fall behind it. And the raw frame is one right-click away, which is the whole justification for summarising in the first place: the list shows one line, the object carries what the line left out.

### What worked

- Against a live send, the tile showed the real sequence — `ws.connecting`, `ws.subscribing`, `subscribed #0 67B`, `snapshot.applied` with `entities=4 dropped=0`, `ws.hydrating`, `ws.ready`, then the `→ ChatMessage` and `→ ChatWidgetInstance` projections — 34 events for one message.
- Pause holds a snapshot of the array rather than unsubscribing, so resuming shows everything that arrived in between rather than a gap.
- `clear` is per conversation, which the test checks by asserting the other conversation's stream is untouched.

### What didn't work

**Five columns in a narrow tile.** The first row layout was `time | family | type | summary | id` on one line. In a tile a third of a screen wide the summary — the part worth reading — was the column that collapsed. Rows are two lines now: what and when on the first, what it says on the second. The same fix the conversations rows needed in Step 3, for the same reason; it is now the default assumption for any row in this ticket.

### What I learned

- The demo's families are mostly `ws`, `timeline` and `other`, because `llm`, `tool` and `widget` come from `familyAliases` — a map from ui-event NAME to family that the classifier takes as an option and nobody passes. The chips for those three are therefore always empty in this product. Worth wiring in a later phase; noted rather than fixed, because the mapping is a product fact and this ticket has not established what it should be.

### What warrants a second pair of eyes

- `useChatDebugEntries(store, conversationId)` is called with `""` when no conversation is active. It returns an empty array, which is what the empty state renders, but the store is being subscribed to under a key that can never receive anything.
- The tile caps at 300 rendered rows out of a 1000-entry ring and says `n of m`, so the truncation is visible. The ring size is a `createPbuiChat` option nobody has tuned.

### Code review instructions

- `EventsTile.tsx` — `detailOf` and the two-line row.
- `demo/src/pbui/descriptors/chatEvent.ts` — the three menu entries.
- Validate: `pnpm --filter @hyperslop-systems/pbui-chat test`, then place the `events` tile from the launcher's "agent" group and send a message.

## Step 6: Phase 3 — the runs and tools tiles

The two cross-conversation views: what every agent has cost, and what is waiting for the user. Both are joins over several runtimes, and the phase was almost entirely about making those joins cheap and correct rather than about the tiles.

### Prompt Context

**User prompt (verbatim):** (same as Step 5)

**Commit (code):** `ba6613d` — "PBUI-AGENT-4 Phase 3: the runs and tools tiles"

### What I did

- `conversations/selectors.ts` — `toolCallsOf(runtime, title)` memoised per runtime; `selectToolTraffic(registry)` joining every open conversation, newest first; `selectWaiting`; `streamRate(stats, now)`; and the `useToolTraffic` / `useWaiting` hooks that subscribe to the registry AND to each open runtime's store.
- `RunsTile` — a row per conversation with the model, the run count, token totals, the last run's duration and stop reason, and a live output-token rate while it streams; a footer that sums across conversations; `compact()` and `formatDuration()` for numbers read at a glance.
- `ToolsTile` — *waiting for you* above the traffic, then every tool call with status, origin, duration, error and an input/result disclosure; filters by conversation and status.
- Both tiles' rows are objects (`<conversation>`, `<tool>`), per Step 4.

### What didn't work

**`Maximum update depth exceeded`.** `useConversations(registry, r => selectToolTraffic(r))` re-rendered forever. `useConversations` is `useSyncExternalStore`, which compares snapshots by IDENTITY, and the selector built a fresh array on every call — the contract its own doc comment states ("the selector must return a stable reference for an unchanged slice"), broken the first time a selector computed rather than read. The joins now memoise on the identities of their inputs: `all()` plus each runtime's `toolCallsOf` result.

**The registry does not notify on entities.** With the loop fixed, the tools tile showed nothing: a tool call arriving changes no mirrored field — the message count is the same, the run stats are the same — so the registry never notified and the tile never re-rendered. This is exactly the exception D9 named and Phase 0 had not needed yet. `useToolTraffic` subscribes to each open runtime's store as well, re-attaching only when the set of open runtimes actually changes.

**A memo that kept saying "waiting" after the user decided.** Answering a parked human tool changes nothing about the timeline entities — the result arrives later, in its own frame — so an entity-identity memo returned the stale `waiting: true`. The memo key now includes a signature of which human tools are parked, built by asking `isPendingHumanTool` about each human tool call with no result. It allocates nothing and only walks the calls that could be parked.

**A hand-built workbench document blanked the page.** While arranging four tiles for a screenshot I called `store.replaceDocument` with a document I wrote by hand; it was invalid, React threw, and the demo persisted the broken document to local storage, so reloading did not help. Clearing the two layout keys recovered it. The lesson is the one the workbench's own API already encodes: build layouts with `verbs.*` or `parseDocument`, never by hand.

**Two `chat.Provider`s in one test.** The first version of the Phase 3 test rendered the provider twice — once to get the runtimes, once with the tile — which mounted two `ConversationHost`s, re-attached both runtimes and threw away the stores the test had just dispatched into. One tree per test now, with the tile inside it.

### What worked

- The live rate is visible in the browser: the streaming conversation's row reads `1.3 tok/s` and is highlighted while it streams, and falls back to the last run's duration and stop reason when it stops.
- A parked `pbui_accept` appeared under *waiting for you* with its conversation and a *go to*, and the traffic below showed both the requested and the succeeded call.
- `formatDuration(null)` is `—` rather than `0 ms`: `updatedAt` is only set once an entity has changed, so a call that arrived and never moved has no duration rather than a duration of zero. The test pins that distinction.

### What was tricky to build

**Cheap correctness across N stores.** Three of the four failures above are the same problem seen from different sides: a cross-conversation view needs a value derived from several stores, and React needs that value to be identical when nothing changed. Every fix was a memo whose key is exactly what the value depends on — entities, title, parked set, the set of open runtimes — and the discipline that made them work was writing the key down explicitly rather than relying on a dependency array.

**Tables in a third of a screen.** The runs tile started as a seven-column grid with a header row. In a narrow tile the name — the only part that identifies the row — was crushed. It is two lines now with the units inline (`3 runs · 1.2k in · 900 out`), which reads at any width and needs no header three rows above.

### What warrants a second pair of eyes

- `useToolTraffic` re-attaches its per-runtime subscriptions inside the registry's notification, which fires often. The comparison is cheap (array identity per runtime) but it runs on every mirror change of every conversation.
- `parkedSignature` walks the entities on every `toolCallsOf` call, including the memo-hit path — it has to, since it is part of the key. For a long transcript with many tool calls this is the one unavoidable pass.
- The demo's scripted engine reports no usage, so every token column is zero. The tiles are therefore verified for layout and liveness but not against real numbers.

### What should be done in the future

- The conversations tile's `waiting` count should link into the tools tile now that it exists.
- `streamRate` uses `estimateOutputTokens(streamChars)` upstream when a provider reports no usage; the rate is honest about being an estimate only in chat-provider's code, not in the tile.

### Code review instructions

- Start at `conversations/selectors.ts` — the three memos and what each key contains.
- Then `useToolTraffic`'s subscribe callback, which is the only place in this ticket that subscribes to more than one store.
- Then the two tiles, which are presentation over those.
- Validate: `pnpm --filter @hyperslop-systems/pbui-chat test` (182), then `make chat-ui`, place `runs` and `tools` from the launcher, and send "draft a reorder" to park a human tool.


## Step 7: Phase 4 — the agent context tile and the handoff

Two things a person needs when several agents share a screen: a way to see what one of them was actually told, and a way for one to hand work to another that does not turn into a loop. This phase built both, and the browser check ran the whole handoff end to end — list, propose, approve, send, answered over there.

### Prompt Context

**User prompt (verbatim):** "phase 4"

**Assistant interpretation:** Build the agent-context tile, `conversation_list` and the `confirm`-gated `conversation_send`, and a scripted scenario that exercises the handoff.

**Inferred user intent:** Finish the model-facing half of the ticket.

**Commit (code):** `4855631` — "PBUI-AGENT-4 Phase 4: the agent-context tile and the handoff"

### What I did

- `packages/pbui-chat/src/tools/conversationTools.ts` — `conversation_list` and `conversation_send`, their policy (`conversation_send: "confirm"` by default), a `confirmationHint` the product fills in, and `isApproved`.
- `createPbuiChat` — the conversation tools join the per-session toolset; `ConversationTools` (the old name for the toolset) became `ConversationToolset` so the tools bundle could take the name.
- `packages/pbui-chat/src/conversations/ContextTile/` — the tile, its CSS, its barrel and its test; `createConversationApps` registers `conversation-context` as the only DOC-BOUND helper tile.
- `conversations/runtime.ts` — `recordSend`, an `onChange` hook, and a wrapper around the client's exposed `syncManifest`.
- `packages/pbui-chat/demo/src/chat.ts` — `approvedSend`, the exact approval check, and the `conversationTools` wiring; `descriptors/conversation.ts` gains *Show what it was told*.
- `pkg/chatserver/scripted/scenarios.go` — `handoffScenario`, and `turn.hasTool` beside the existing `hasHumanTool`.

### Why

`conversation_send` is `confirm` because a model that can start a run in another conversation unasked is a loop waiting to happen, and the loop is expensive in a way the user does not see until the bill. The browser check demonstrated the gate doing exactly that job: the receiving agent, handed a message that happened to match the handoff scenario's own keywords, immediately went to hand it BACK — and stopped at the proposal, waiting for a human. Without the gate that is an infinite exchange between two agents; with it, it is one card the user can reject.

The approval had to be checked against the message rather than the id. An `isApproved(id)` that only asks "was this proposal approved" authorises every later send equally: approve one handoff and the same id sends anything, anywhere. The demo's check reads the `pbui_propose` tool call out of the timeline, requires `result.decision === "approve"`, and compares its `to` and `message` fields against the send. Reading the timeline rather than keeping a set of approved ids also means the check survives a reload, because the session hydrates the calls.

The context tile is doc-bound while the other four helpers are singletons, because "what this agent was told" is a fact about ONE conversation and two of them side by side comparing two agents is the point.

### What didn't work

**The tile said "nothing advertised yet" while the manifest went out with every message.** `runtime.lastManifest` was set only by `runtime.syncManifest()`, so the tile showed the state of this code's own calls rather than the state of the world. Wrapping the client's exposed `client.tools.syncManifest` did not fix it either: `createChatClient`'s `connect()` and `send()` call their own internal `syncToolManifest()` closure, not the exposed alias, so the wrapper never fires on the two paths that matter.

What the tile actually wants is not "what was last sent" but "what can this model be offered", and that is the tool registry, read now. It lists `runtime.toolRegistry.manifest()` and uses `lastManifest` only for the "last advertised … · revision n" stamp when one exists. The result is the screenshot in `various/09`: seventeen tools with their modes and descriptions, and `workbench_apply` marked unavailable — which is the tile's whole reason to exist, since "the tool is missing" and "the tool is there but turned off" look identical in a transcript.

**`lastSend` was never set at all.** Phase 0's runtime factory recorded it; the capture-based replacement did not, and nothing noticed until a tile tried to read it. `sendMessageBodyFor` now calls `runtime.recordSend(prompt, body)` with the body it just built — which is the right place anyway, since that function IS the last thing to touch the message before it goes on the wire.

**Mutable runtime fields do not re-render anything.** `lastManifest` and `lastSend` are plain fields, not store state, so setting them changed nothing on screen. `chatRuntimeOf` takes an `onChange` that the registry wires to `invalidate(id)`; the snapshot's identity changes and the tile re-reads. Store state would have been the other answer, but nothing else needs these to be reducible.

**A hand-built layout blanked the page (again).** Same mistake as Phase 3, same recovery: clear the two layout keys. Recorded twice now because it is clearly a trap worth a lint.

### What worked

- The handoff, end to end, in the browser. The sender called `conversation_list` twice (once when it was alone and said so, once after a second conversation existed), mentioned the target as `[[conversation:…|pricing desk]]`, parked a proposal whose fields carried the exact target and message, and on **Approve** performed `conversation_send`. The message arrived in the other conversation and was answered there. The Tools tile showed the parked proposal under *waiting for you* with its *go to* the whole time.
- Every refusal in `conversation_send` is a sentence the model can act on, and the tests assert the wording: `conversation_list` for unknown ids, "answer the user directly instead" for talking to itself, "ask the user to open it first" for a disconnected target, and the `confirmationHint` appended to the approval refusal so a model asked for "a proposal" learns what shape the check wants.
- The scripted scenario reads as the interface's own documentation: it says out loud that sending starts a run, and it stops with a sentence rather than a retry whenever a tool it needs is not advertised.

### What was tricky to build

**Telling the model what the approval check wants.** `isApproved` belongs to the product, so the package cannot know what shape a proposal must take — but the model is the one that has to produce it, and a refusal that says only "not approved" teaches it nothing. `confirmationHint` is the seam: the package writes the general refusal, the product appends the specific requirement, and the demo's says exactly which fields the check compares. Without it the loop is: propose, refused, propose again, refused, with no information gained.

**A tool that must know which conversation it is.** `conversation_list` marks one row `isYou`, and `conversation_send` refuses to talk to itself — both need the calling session id, which a `ToolExecutionContext` does not carry. It works because Phase 0 already made the toolset per session; the conversation tools are the clearest case for that decision, and the doc comment now says so.

### What warrants a second pair of eyes

- `chatRuntimeOf` mutates `context.client.tools.syncManifest` in place. It is guarded against double-wrapping within one call, but a second `chatRuntimeOf` over the same captured context would wrap twice. Only `attachRuntime` calls it, and only once per attach, so today it cannot happen.
- `approvedSend` scans every open conversation's entities to find the proposal. The proposal is always in the SENDING conversation, so it could take the conversation id and look only there; the scan is defensive and O(entities × conversations).
- The demo's handoff scenario matches on "hand this", "other agent" and friends, which is why the receiving agent tried to hand the message back. That is a scripted-engine artifact, not a product behaviour, but it makes a good demonstration of the gate.

### What should be done in the future

- The prompt section written in Phase 1 names both tools; they exist now, so that gap is closed.
- `conversation_send` carries `refs`, but the scripted scenario does not pass any. A real handoff should forward the objects it names, and the tests cover the path — nothing exercises it end to end.

### Code review instructions

- `packages/pbui-chat/src/tools/conversationTools.ts` — the refusal ladder in `conversation_send`, in order.
- `packages/pbui-chat/demo/src/chat.ts` — `approvedSend`, and what it compares.
- `packages/pbui-chat/src/conversations/ContextTile/ContextTile.tsx` — why the tools list reads the registry.
- `pkg/chatserver/scripted/scenarios.go` — `handoffScenario`.
- Validate: `pnpm --filter @hyperslop-systems/pbui-chat test` (203), `GOWORK=off go test ./pkg/...`, then `make chat-ui`, restart the server, open two conversations and send "hand this to the other agent: …".


## Step 8: Phase 5 — the session index, the merge, and the close-out

The last phase gives the server a list it can rebuild or lose, and the browser a way to reconcile with it that never costs the user anything. Two open questions from earlier phases were folded in rather than deferred, and the documentation was brought level with what shipped.

### Prompt Context

**User prompt (verbatim):** "Phase 5"

**Assistant interpretation:** Build the Go `SessionIndex` and its two routes, `registry.sync()` as a merge, and finish the documentation; fold in the two small open questions I had offered.

**Inferred user intent:** Close the ticket.

**Commit (code):** `ad6c6cc` — "PBUI-AGENT-4 Phase 5: the session index, the merge, and the docs"

### What I did

- `pkg/chatserver/sessions.go` — `SessionIndex`, `NewMemorySessionIndex`, `NewSQLiteSessionIndex`, and a total sort (most recently active, then by id, so two sessions created in the same millisecond cannot swap places between requests).
- `pkg/chatserver/{server.go, options.go, handlers.go}` — `Options.SessionsDB`, the index wired into `NewServer` and its cleanup, `HandleListSessions`, `HandleRetitleSession`, and `Remember` / `Touch` calls in the create and submit handlers.
- `pkg/chatserver/server_test.go` — five cases: listing, ordering by activity, counting messages, the title round trip with a 404 for an unknown session, submitting to a session the index never saw, and SQLite surviving a reopen.
- `packages/pbui-chat/src/conversations/registry.ts` — `sync()`, `SyncResult`, and `serverPatch`, which is where the merge rules live.
- `ConversationsTile` — a *sync* button whose note says what changed, including what did not.
- `EventsTile` — `DEFAULT_EVENT_FAMILIES`; `createPbuiChat` passes it to the classifier and takes an `eventFamilies` override.
- `demo/src/pbui/descriptors/conversation.ts` — *Show what is waiting*, which opens the tools tile.
- `packages/pbui-chat/README.md` (new) and the guide's §4.10.

### Why

The index is a convenience, not a source of truth, and every design decision in it follows from that. `Touch` inserts a session it has never seen rather than failing, because a browser holding an id from before a restart must keep working. `Remember` failing is logged and the id still goes back, because a session works whether or not it is remembered. The table is rebuildable in principle — every field except the title is derivable from the event stream — so losing the file costs a list, not a transcript.

`sync()` merges for the same reason, and two of its rules deserve stating. A **human title is never overwritten**: the user named this conversation in this browser, and the index only ever knows what some browser told it. A **message count is taken only when the server's is higher**: this browser's count comes from a hydrated timeline it has actually seen, the index's from counting submissions — which may include another browser's, and is worth knowing, but taking a lower number would silently lose messages.

### What worked

The browser check was the exact scenario D10 exists for, and it was arranged by accident: the server had just been restarted with an empty index while the browser still held six records from earlier sessions. `sync()` adopted nothing, updated nothing, reported six the server does not list, and kept them all. The tile's footer read `6 the server does not list (kept)`, which is the whole point said in six words. A conversation created afterwards appeared in the index with its message counted, and its human title survived the sync untouched.

The SQLite implementation uses one upsert for both the insert and the update path, so a session the index never saw created is inserted with the count it is being touched for:

```sql
INSERT INTO sessions (id, created_at, last_activity_at, message_count) VALUES (?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET last_activity_at = excluded.last_activity_at,
                              message_count = sessions.message_count + ?
```

### What didn't work

**A test that asserted the old, wrong behaviour.** Adding `DEFAULT_EVENT_FAMILIES` broke `a family chip narrows the list and says so`, which had asserted that a `ChatMessage` event classifies as `timeline`. It did, and that was the bug: without a family map the classifier files every unlisted `ui-event` under `timeline`, so the `llm`, `tool` and `widget` chips were three of six filters that could never match anything. The test now asserts `llm`, and a second case pins the mapping in all three directions plus the unlisted default.

**A `Record<string, string>` inferred as `{}`.** The demo's `view.open` verb takes `documents: Record<string, string>`, and a literal `{}` in a descriptor action infers as the empty object type, which is not assignable. One annotation.

### What I learned

- An index that is allowed to be wrong is much easier to write than one that is not, and the difference shows up in every method: `Touch` inserts, `Remember` is idempotent, a failure to index is a log line. The design decision that bought all of that was made in the guide (D10) and cost nothing to honour.
- Folding the two open questions in took under an hour between them, and both were things a reader of the tiles would have noticed before a reader of the notes did. Deferring them would have been the more expensive choice.

### What was tricky to build

**Which direction each merge rule points.** There are four fields the server can offer and the browser can hold, and each has a different rule: the title defers to the human and otherwise takes the server's; the count takes the maximum; `createdAt` is taken only for a record being adopted, because an existing record's own is older or equal; `lastActivityAt` takes the later. Writing them as one "prefer the server" or one "prefer the browser" rule would have been wrong in at least two of the four cases, which is why `serverPatch` is a function with a comment rather than a spread.

### What warrants a second pair of eyes

- The index is written on create and on submit, but nothing removes a session. A long-lived server accumulates rows forever. Deleting is not obviously right — the hub may still hold the session — but a retention rule is missing.
- `Touch` is called after `HydrateTrace` and before the run starts. A submission that then fails to start is still counted. The count is a convenience, so this is defensible; it is not stated anywhere.
- `sync()` has no caller other than the tile's button. Nothing syncs on load, which is deliberate for now — a merge on every boot would adopt every session the server remembers into every browser — but the rule that should govern it has not been written.

### What should be done in the future

- A retention rule for the index, and a `DELETE` for a session a user is sure about.
- `conversation_list` could take the server's list into account for sessions this browser has never opened, which is the case a second browser hits.
- The follow-up that outlives this ticket: propose `createToolRuntime` and the tool input/result helpers as exports upstream in chat-provider, then replace `ConversationHost`'s provider-per-conversation with the factory §4.1 describes. The registry API does not change.

### Code review instructions

- `pkg/chatserver/sessions.go` — the interface's doc comment says what the index is for; the rest follows from it.
- `packages/pbui-chat/src/conversations/registry.ts` — `sync()` and `serverPatch`, four fields and four rules.
- `packages/pbui-chat/src/conversations/EventsTile/EventsTile.tsx` — `DEFAULT_EVENT_FAMILIES`.
- Validate: `pnpm --filter @hyperslop-systems/pbui-chat test` (207), `GOWORK=off go test ./pkg/...`, then `make chat-ui`, restart the server, and press *sync* in the conversations tile with records the fresh index has never seen.


## Step 9: Re-open the ticket for a three-part architecture and code review

This step began a fresh, evidence-first review rather than accepting the ticket's existing design and self-review as the conclusion. The requested deliverable was refined into three intern-facing documents — PBUI core, the JavaScript API and interaction model, and the agent framework plus tiles — so the investigation mapped those three boundaries separately before drafting.

The first browser pass found two multi-conversation defects that the previous 208-test close-out did not catch. Two simultaneously mounted composers share one product-wide draft, so typing in one immediately changes the other; explicitly closing the active conversation leaves both its chat tile and the active trace tile saying `opening conversation…` indefinitely. These are observed current behavior, not inferred risks, and screenshots/snapshots were saved with the ticket.

### Prompt Context

**User prompt (verbatim):** "Read @pbui/ttmp/2026/08/21/PBUI-AGENT-4--agent-helper-tiles-conversations-multiple-agents-event-tracing-run-stats-and-tool-traffic/design-doc/02-code-review-guide-what-to-audit-in-the-multi-agent-workbench-and-what-i-already-know-is-wrong.md  and Create  a detailed analysis / design / code review report that is for a new intern, explaining all the parts of the system needed to understand what it is, with prose paragraphs and bullet point sand pseudocode and diagrams and api references and file references. It should be very clear and technical. Store in the ticket and the nupload to remarkable.

Be sure to test things extensively, you can run the system and interact with it, save any scripts you write in the scripts/ folder of the ticket."

**Scope refinement (verbatim):** "actually structure this into three full review docs:

- PBUI itself
- PBUI JS API and interaction
- Agent framework + tiles"

**Process instruction (verbatim):** "commit at appropriate intervals and keep a detailed diary as you work (using the diary format from the skill)"

**Frequency instruction (verbatim):** "especially the diary, keep it frequently as you move along so we can retrace your steps."

**Assistant interpretation:** Audit the implementation deeply, structure the result as three full design/code-review documents for a new intern, prove findings with automated and live-browser evidence, maintain this diary continuously, commit coherent review stages, and deliver the validated bundle to reMarkable.

**Inferred user intent:** Produce a trustworthy onboarding and review package that explains the whole stack while separating foundational PBUI concerns from the interaction API and from multi-agent runtime risks, so a new engineer can understand and safely improve the system.

**Commit (code):** none — investigation and evidence capture only at this point.

### What I did

- Read the existing intern guide, reviewer guide, package README, all eight prior diary steps, ticket metadata, and the review/delivery skill references.
- Mapped the three review scopes and read their load-bearing code:
  - PBUI core: `src/presentation/{types,registry,createPbui}.tsx`, surfaces, chrome, controls, Dialog, FileBrowser, token/style wiring, Vite dedupe preset.
  - JS API/interaction: workbench store/document/app descriptors/verbs/components and the protobuf protocol's TypeScript applier/builders.
  - Agent framework: runtime capture, conversation registry/scopes/selectors/tools/router, `createPbuiChat`, helper app descriptors, demo integration, chat-provider 0.5.0 internals, and Go session routes/index.
- Added `scripts/01-review-inventory.mjs` and generated `various/11-review-inventory.md`. It records source/test/story counts, largest files, and story coverage for each of the three scopes.
- Ran fresh automated validation:
  - PBUI: 12 test files, 96 tests passed.
  - workbench-protocol: 3 files, 44 tests passed.
  - pbui-workbench: 9 files, 115 tests passed.
  - pbui-chat: 21 files, 208 tests passed.
  - `GOWORK=off go test ./pkg/... -count=1`: all packages passed.
  - Typechecks passed for PBUI, protocol, workbench, sandbox, pbui-chat, and the demo.
  - `make chat-ui`, `make ci-check`, and `make protocol-check` passed.
  - PBUI, workbench, and pbui-chat Storybook production builds passed.
- Restarted the Go demo server from the current checkout, opened the app in a real browser, sent a message, created a second conversation, and inspected the rendered accessibility tree and runtime through `window.__pbuiDemo`.
- Saved the initial browser snapshot, shared-draft screenshot and JSON probe, and closed-conversation screenshot/snapshot as `various/13`–`17`.

### Why

- Existing tests proved many local contracts but not that two live composers are isolated or that closing a runtime leaves an intelligible mounted tile. The user's request explicitly allowed running and interacting with the system, so browser evidence was required rather than optional.
- The inventory makes review claims reproducible. In particular, PBUI core has stories for all 41 TSX implementations, while the agent scope has 38 of 45 TSX implementations without stories; the five new helper tiles are in that uncovered set.

### What worked

- Every checked automated suite, typecheck, package build, Go CI target, protocol regeneration check, and Storybook build completed successfully.
- The running demo created and connected two independent server sessions. Each transcript runtime remained separate, and the first scripted reply rendered messages, references, widgets, and verb chips correctly.
- The browser probes produced deterministic evidence for both newly found defects:
  - after filling only `getByRole('textbox', {name: 'message to the agent'}).nth(1)`, both textareas held `SECOND-ONLY-DRAFT-PROBE`;
  - after `window.__pbuiDemo.conversations.close(activeId)`, the closed chat tile and the singleton trace tile both rendered `opening conversation…` after cleanup.

### What didn't work

- Two initial dependency reads used the wrong path and failed exactly as follows; pnpm's package-local symlink was the correct path:

```text
ENOENT: no such file or directory, access '/home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/node_modules/@go-go-golems/chat-provider/core/createChatClient.js'
ENOENT: no such file or directory, access '/home/manuel/workspaces/2026-08-20/add-pbui-agent/pbui/node_modules/@go-go-golems/chat-provider/react/ChatProvider.js'
```

- The first browser server on port 8090 was a stale `go run` process started the previous day. `/proc/<pid>/cwd` proved it was this checkout; it was stopped and replaced with a fresh process before browser validation.
- `make chat-ui` and pbui-chat's Storybook build passed but emitted repeated Vite warnings that QuickJS's generated Emscripten modules import browser-externalized `fs`, `path`, and `crypto`; the demo bundle also crossed Vite's 500 kB chunk warning (`745.18 kB`, gzip `222.38 kB`), and the chat Storybook emitted a `2,081.06 kB` sandbox worker.

### What I learned

- The first unlisted multi-agent defect is simpler than the known runtime problems: `Composer` reads `chat.store.draft`, and `createPbuiChat` constructs exactly one `PbuiChatStore` per product. Pending refs were made per conversation, but editable draft text was not.
- `ConversationScope` uses the same `!runtime` presentation for two different states: the one-frame attach transition and an explicitly closed runtime. Its `useEffect([registry, conversationId])` does not run again when `open` flips false, so the latter state cannot progress and should not be labeled "opening".
- The server exposes `PATCH /api/chat/sessions/{id}` and the docs say a second browser can receive titles, but `registry.rename()` performs only a local record patch; no frontend PATCH caller exists. The route is currently orphaned from the user gesture it was designed for.
- chat-provider's `connect()` and `send()` call the lexical `syncToolManifest()` closure, not the exposed `client.tools.syncManifest`; runtime monkey-patching therefore cannot observe automatic syncs. The current Context tile works around this by reading the registry live, but runtime comments still overstate what the wrapper captures.

### What was tricky to build

- Distinguishing defects from intentional layering required tracing state ownership end to end. The PBUI chat store is deliberately product-wide for inspector/watchlist/focus, while chat-provider's Redux store is deliberately per conversation; the draft was accidentally placed on the former side of that boundary. The symptom only appears when two composers are mounted at once, which is why local component tests stayed green.
- Closing a conversation is an orthogonal lifecycle gesture to closing a tile. The code intentionally keeps them separate, so the correct review finding is not "close the tile too" by assumption; it is that a mounted tile needs an explicit closed state and reopen gesture, and active-following singletons need a policy for a closed active record.

### What warrants a second pair of eyes

- Severity and remediation for shared drafts: the likely fix is per-conversation draft state, but moving all of `PbuiChatStore` per runtime would wrongly split product-wide inspector/watchlist state. The draft slice needs a keyed design or a scoped draft store, not a broad store duplication.
- Conversation title synchronization: adding PATCH to `rename()` raises failure and ownership questions (optimistic local update, retry, and agent-versus-human provenance) that need an explicit API decision.
- `close()` semantics with mounted chat/context/trace tiles: decide whether scopes auto-open, show closed with a reconnect action, or whether the close verb also closes placements. The current mix does none consistently.
- Core accessibility findings under review: Dialog and ObjectMenu do not restore focus when they unmount, and several polymorphic/structural components (`Text`, `Toolbar`) intentionally enumerate props and therefore drop `aria-*`/`data-*` attributes.

### What should be done in the future

- Draft the three review documents from this evidence, with separate severity tables and shared cross-document terminology.
- Add focused reproducible probes/tests for the highest-severity findings where a static file reference is not enough.
- Update this diary after each document/review stage and commit coherent documentation/evidence intervals.

### Code review instructions

- For the shared draft, start at `packages/pbui-chat/src/composer/Composer/Composer.tsx` (`usePbuiChatStore(chat.store, s => s.draft)`) and `createPbuiChat.tsx` (one `store` and per-conversation `pending`). Reproduce with two chat tiles and type in only one composer.
- For the closed state, read `ConversationScope.tsx` and `registry.ts` `open`/`close`; reproduce with `window.__pbuiDemo.conversations.close(window.__pbuiDemo.conversations.activeId())` while the tile remains mounted.
- For title sync, search the frontend for `PATCH`; there is no match. Compare `registry.rename` with `pkg/chatserver/handlers.go:HandleRetitleSession`.
- Validation baseline is recorded above; repeat the focused browser probes after any lifecycle or draft fix.

### Technical details

Observed shared state, using a direct nth-element fill rather than the accessibility snapshot's generated locator:

```js
const boxes = page.getByRole("textbox", { name: "message to the agent" });
await boxes.nth(1).fill("SECOND-ONLY-DRAFT-PROBE");
await boxes.evaluateAll((elements) => elements.map((element) => element.value));
// => ["SECOND-ONLY-DRAFT-PROBE", "SECOND-ONLY-DRAFT-PROBE"]
```

The ownership path responsible:

```text
createPbuiChat()
  └─ one createPbuiChatStore()
       └─ draft
            ├─ Composer in ConversationScope(A)
            └─ Composer in ConversationScope(B)
```

The desired boundary is narrower:

```text
product-wide PbuiChatStore: inspector · watchlist · focus
conversation-keyed draft state: draft[A] · draft[B]
chat-provider runtime per conversation: timeline · overlay · runStats · socket · tools
```
