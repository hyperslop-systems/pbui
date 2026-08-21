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
    - Path: repo://packages/pbui-chat/src/createPbuiChat.tsx
      Note: pending, chatClientRef, Binder — one client per product today
    - Path: repo://pkg/chatserver/handlers.go
      Note: HandleCreateSession mints a uuid; no list endpoint
ExternalSources: []
Summary: ""
LastUpdated: 2026-08-21T16:01:43.842023888-04:00
WhatFor: ""
WhenToUse: ""
---


# Diary

## Goal

<!-- What is the purpose of this reference document? -->

## Context

<!-- Provide background context needed to use this reference -->

## Quick Reference

<!-- Provide copy/paste-ready content, API contracts, or quick-look tables -->

## Usage Examples

<!-- Show how to use this reference in practice -->

## Related

<!-- Link to related documents or resources -->

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
