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
    - Path: repo://packages/pbui-chat/src/conversations/ConversationHost.tsx
      Note: One ChatProvider per open conversation; why a runtime is captured, not constructed (commit a5d6d79)
    - Path: repo://packages/pbui-chat/src/conversations/ConversationsTile/ConversationsTile.tsx
      Note: The list of every agent, and which gestures are verbs (commit 324d335)
    - Path: repo://packages/pbui-chat/src/conversations/registry.ts
      Note: The conversation registry — records, lazy runtimes, mirrors, the active conversation (commit a5d6d79)
    - Path: repo://packages/pbui-chat/src/conversations/verbs.ts
      Note: The five conversation verbs and their one dispatcher (commit 324d335)
    - Path: repo://packages/pbui-chat/src/createPbuiChat.tsx
      Note: |-
        pending, chatClientRef, Binder — one client per product today
        Per-conversation pending, tools and extensions; one router binding (commit a5d6d79)
    - Path: repo://packages/pbui-chat/src/router/createVerbRouter.ts
      Note: PerformOptions.conversationId and the session-aware binding (commit a5d6d79)
    - Path: repo://pkg/chatserver/handlers.go
      Note: HandleCreateSession mints a uuid; no list endpoint
    - Path: repo://pkg/pbuichat/prompt.go
      Note: 'The ## Conversations section, gated on the conversation type (commit 324d335)'
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
