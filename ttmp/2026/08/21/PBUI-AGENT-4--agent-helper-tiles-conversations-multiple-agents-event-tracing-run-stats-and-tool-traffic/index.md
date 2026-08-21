---
Title: 'Agent helper tiles: conversations, multiple agents, event tracing, run stats and tool traffic'
Ticket: PBUI-AGENT-4
Status: active
Topics:
    - pbui
    - chat
    - frontend
    - backend
    - onboarding
DocType: index
Intent: long-term
Owners: []
RelatedFiles:
    - Path: repo://packages/pbui-chat/src/createPbuiChat.tsx
      Note: One chat per product, one client — the assumption this ticket removes
    - Path: repo://packages/pbui-chat/src/apps/createChatApps.tsx
      Note: The chat app becomes a view of a conversation
    - Path: repo://pkg/chatserver/handlers.go
      Note: Sessions are minted uuids; the design adds a list and a title
ExternalSources:
    - https://github.com/go-go-golems/sessionstream/
    - https://github.com/go-go-golems/pinocchio/
Summary: 'Built: run several agent conversations on one PBUI workbench (a conversation registry with one chat runtime per open conversation, the chat app rebound as a view of a conversation, a "new conversation" gesture, a session-aware verb router and per-session tools, a server session index) and five helper tiles — Conversations, Events (the chat-provider debug stream), Runs (token and duration statistics), Tools (traffic and waiting-for-you), Agent context (the advertised manifest, last refs, environment, vocabulary). Contains the intern guide (with §4.10, what changed between the design and the build), tasks for six phases, and an eight-step diary.'
LastUpdated: 2026-08-21T18:40:00-04:00
WhatFor: Landing page for PBUI-AGENT-4; start here to find the guide, the phase tasks and the diary.
WhenToUse: Before implementing multi-conversation support or any agent helper tile; when a product needs more than one agent on screen.
---

# Agent helper tiles: conversations, multiple agents, event tracing, run stats and tool traffic

## Overview

Every PBUI product so far has one agent: one `<ChatProvider>` builds one store, one WebSocket and one session, and `createPbuiChat` binds one router to one client. This ticket designs the step to many conversations and the tiles that help a person work with them:

1. **A chat runtime as a value** — `createChatRuntime(config)` assembles what `ChatProvider` assembles, for a known session id, from chat-provider's exported pieces; `ChatRuntimeScope` provides its contexts so every existing pbui-chat component works unchanged inside a conversation.
2. **A conversation registry** — records (title, pins, counts) persisted; runtimes built lazily while a conversation is open; mirrors of status and run stats; *the active conversation*, set by focus, followed by singleton tiles and used by untargeted verbs.
3. **The `chat` app doc-bound to a conversation** — two chat tiles with two bindings are two agents; *new conversation* creates a session and opens a tile; a session-aware router and per-session tool descriptors keep verbs and tool calls attributed to the right session.
4. **Five helper tiles** — *Conversations* (list, new, rename, pin, archive, open, activate), *Events* (chat-provider's classified debug stream: WebSocket lifecycle, frames, tool and UI events), *Runs* (model, tokens, durations, live rate, across conversations), *Tools* (waiting-for-you and tool traffic with inputs and results), *Agent context* (the manifest last advertised, the refs and focus last sent, environment, vocabulary, engine/model).
5. **The agent's part** — a `conversation` type, five generic verb kinds, `conversation_list` and a `confirm`-gated `conversation_send` (agent-to-agent handoff), a `## Conversations` prompt section.
6. **The server's part** — a rebuildable `SessionIndex` behind `GET /api/chat/sessions` and `PATCH …/{id}` for titles; the hub stays authoritative.

**Read in this order**

1. [design-doc/01 — Intern guide](./design-doc/01-intern-guide-many-conversations-on-one-workbench-the-session-registry-and-the-agent-helper-tiles.md): scenes (§1), the system as it stands — a session end to end, what pbui-chat assumes, what the runtime records and nobody shows (§2), the gap table (§3), the design with D1–D12 (§4), six phases (§5), sequences (§6), failure modes R1–R14 (§7), testing (§8), API and file references (§9–§10), open questions (§11).
2. [reference/01 — Diary](./reference/01-diary.md): the evidence pass and the reasoning.

Background: `PBUI-AGENT-1` (the chat), `PBUI-AGENT-2` (workbench tools and policy), `PBUI-WORKBENCH-1/2` (the app model), `PBUI-SANDBOX-1` (the registry pattern reused here).

## Status

All six phases built and verified in the browser against the running Go server (diary steps 2–8, screenshots `various/01`–`10`): the conversation registry and one provider per open conversation (Phase 0), the Conversations tile and the conversation verbs (1), the Events tile (2), the Runs and Tools tiles (3), the agent-context tile with `conversation_list` and a `confirm`-gated `conversation_send` (4), and the Go session index with a `sync()` that merges (5). 207 tests in `pbui-chat`, plus the Go suite.

Mid-ticket the user gave a standing rule — everything that can be an object should be an object, and its actions belong in the right-click menu — which turned four gestures into verbs and rewrote the Conversations tile (diary step 4). The guide's §4.10 lists the seven places the build refused the design, the largest being that `createChatRuntime` cannot be written because `createToolRuntime` is unexported. See [tasks.md](./tasks.md).

## Topics

- pbui
- chat
- frontend
- backend
- onboarding

## Tasks

See [tasks.md](./tasks.md) for the current task list.

## Changelog

See [changelog.md](./changelog.md) for recent changes and decisions.

## Structure

- design-doc/ - The intern guide
- reference/ - The diary
- playbooks/ - Command sequences and test procedures
- scripts/ - Temporary code and tooling
- various/ - Working notes and research
- archive/ - Deprecated or reference-only artifacts
