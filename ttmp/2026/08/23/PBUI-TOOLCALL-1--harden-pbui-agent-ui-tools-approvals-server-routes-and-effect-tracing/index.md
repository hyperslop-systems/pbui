---
Title: 'Harden PBUI agent UI tools, approvals, server routes, and effect tracing'
Ticket: PBUI-TOOLCALL-1
Status: active
Topics: [chat, frontend, backend, onboarding]
DocType: index
Intent: long-term
Owners: []
RelatedFiles: []
ExternalSources: []
Summary: 'Implementation ticket for PBUI-owned fixes from the PBUI-AGENT-4 reviews: route authorization, approval/effect primitives, conversation state correctness, workbench semantics, and UI accessibility.'
LastUpdated: 2026-08-23T17:30:00-04:00
WhatFor: 'Landing page for the PBUI agent-to-UI hardening design, diary, tasks, evidence, and delivery.'
WhenToUse: 'Before implementing or reviewing PBUI-owned tool-call and UI-interaction fixes.'
---

# Harden PBUI agent UI tools, approvals, server routes, and effect tracing

## Start here

1. [PBUI agent-to-UI hardening design and implementation guide](./design-doc/01-pbui-agent-to-ui-hardening-architecture-security-approvals-implementation-guide.md)
2. [Diary](./reference/01-diary.md)
3. [Tasks](./tasks.md)
4. [Changelog](./changelog.md)

## Scope

This ticket owns PBUI repository changes: secure chat/session routes, one durable approval ledger, one causal effect gateway, conversation-local drafts and explicit lifecycle, title/send correctness, workbench plan/undo semantics, focus restoration, public type correction, pane constraints, and coordinated dependency integration.

Server pending-call identity belongs to `PINOCCHIO-TOOLCALL-1`. Browser invocation idempotency/executor ownership belongs to `REACT-CHAT-TOOL-RUNTIME-1`.
