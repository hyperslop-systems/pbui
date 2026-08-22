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
Summary: 'Built and reviewed: several agent conversations on one PBUI workbench, a session-aware router and per-session tools, a weak server session index, and five helper tiles. The ticket now contains three full intern-oriented architecture/code reviews — PBUI core, the JavaScript workbench/protocol interaction API, and the agent framework plus tiles — backed by automated tests, release builds and live browser evidence. The review found a critical shared-draft defect plus lifecycle, title-sync, approval, accessibility and API-contract gaps.'
LastUpdated: 2026-08-22T18:45:00-04:00
WhatFor: Landing page for PBUI-AGENT-4; start here for the three-part review, original design/self-review, evidence, tasks and diary.
WhenToUse: Before reviewing or changing PBUI core, the workbench JavaScript API, multi-conversation support or any agent helper tile.
---

# Agent helper tiles: conversations, multiple agents, event tracing, run stats and tool traffic

## Overview

Every PBUI product so far has one agent: one `<ChatProvider>` builds one store, one WebSocket and one session, and `createPbuiChat` binds one router to one client. This ticket designs the step to many conversations and the tiles that help a person work with them:

1. **A chat runtime as a captured value** — chat-provider 0.5.0 does not export the tool-runtime factory needed for direct construction, so `ConversationHost` renders one `ChatProvider` per open conversation and captures its runtime; `ChatRuntimeScope` re-provides that graph inside a conversation tile.
2. **A conversation registry** — records (title, pins, counts) persisted; runtimes built lazily while a conversation is open; mirrors of status and run stats; *the active conversation*, set by focus, followed by singleton tiles and used by untargeted verbs.
3. **The `chat` app doc-bound to a conversation** — two chat tiles with two bindings are two agents; *new conversation* creates a session and opens a tile; a session-aware router and per-session tool descriptors keep verbs and tool calls attributed to the right session.
4. **Five helper tiles** — *Conversations* (list, new, rename, pin, archive, open, activate), *Events* (chat-provider's classified debug stream: WebSocket lifecycle, frames, tool and UI events), *Runs* (model, tokens, durations, live rate, across conversations), *Tools* (waiting-for-you and tool traffic with inputs and results), *Agent context* (the manifest last advertised, the refs and focus last sent, environment, vocabulary, engine/model).
5. **The agent's part** — a `conversation` type, five generic verb kinds, `conversation_list` and a `confirm`-gated `conversation_send` (agent-to-agent handoff), a `## Conversations` prompt section.
6. **The server's part** — a rebuildable `SessionIndex` behind `GET /api/chat/sessions` and `PATCH …/{id}` for titles; the hub stays authoritative.

**Read in this order**

1. [design-doc/03 — PBUI itself](./design-doc/03-pbui-itself-core-presentation-system-components-chrome-accessibility-and-design-system-code-review.md): typed presentations, descriptors, object menus, accept mode, components/chrome, tokens and accessibility review (C1–C8).
2. [design-doc/04 — PBUI JavaScript API and interaction](./design-doc/04-pbui-javascript-api-and-interaction-workbench-protocol-verbs-state-and-integration-code-review.md): protobuf document model, pure applier, external store, apps, high-level verbs, rendering and integration review (J1–J11).
3. [design-doc/05 — Agent framework and tiles](./design-doc/05-agent-framework-and-tiles-multi-conversation-runtime-routing-tools-server-and-helper-tile-code-review.md): runtimes, registry/scopes, router, tools/handoff, server and all five helper tiles (A1–A16).
4. [design-doc/01 — Original intern guide](./design-doc/01-intern-guide-many-conversations-on-one-workbench-the-session-registry-and-the-agent-helper-tiles.md): the original design, phases, sequences and failure modes, including §4.10 on design-versus-build changes.
5. [design-doc/02 — Original author self-review](./design-doc/02-code-review-guide-what-to-audit-in-the-multi-agent-workbench-and-what-i-already-know-is-wrong.md): known shortcuts and dependency defects that seeded the fresh audit.
6. [reference/01 — Diary](./reference/01-diary.md): chronological evidence, exact commands/failures, browser probes, drafting and delivery.

Background: `PBUI-AGENT-1` (the chat), `PBUI-AGENT-2` (workbench tools and policy), `PBUI-WORKBENCH-1/2` (the app model), `PBUI-SANDBOX-1` (the registry pattern reused here).

## Status

All six implementation phases remain built. The fresh review reran 96 PBUI tests, 44 protocol tests, 115 workbench tests, 103 sandbox tests, 208 pbui-chat tests, Go package tests, all relevant typechecks, `make chat-ui`, `make ci-check`, `make protocol-check`, three Storybook production builds, package packing and a clean-consumer smoke.

Live browser review found behavior not covered by those green suites: two conversation composers share one draft (A1, Critical); explicitly closing an active mounted conversation leaves chat and trace tiles stuck on `opening conversation…` (A2); and a human rename never calls the server PATCH, so a second browser cannot receive it (A3). Core review also proved Dialog and ObjectMenu lose invocation focus on Escape (C1). Evidence is stored in `various/11`–`32`; see the three review documents for remediation designs.

The corrected three-document bundle (all seven Mermaid diagrams renderer-checked) is uploaded as **PBUI-AGENT-4 Three Part Architecture Review** under `/ai/2026/08/22/PBUI-AGENT-4` on reMarkable. Delivery evidence is `various/32-remarkable-delivery.md`.

Mid-ticket the user gave a standing rule — everything that can be an object should be an object, and its actions belong in the right-click menu — which turned four gestures into verbs and rewrote the Conversations tile (diary step 4). The original guide's §4.10 lists seven places the build refused the design; the fresh review extends that inventory with source- and browser-backed findings. See [tasks.md](./tasks.md).

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

- design-doc/ - Original design/self-review plus the three full review documents
- reference/ - The frequently updated investigation diary
- playbooks/ - Command sequences and test procedures
- scripts/ - Reproducible inventory and document-quality audit scripts
- various/ - Screenshots, accessibility snapshots, network/runtime probes and audit outputs
- archive/ - Deprecated or reference-only artifacts
