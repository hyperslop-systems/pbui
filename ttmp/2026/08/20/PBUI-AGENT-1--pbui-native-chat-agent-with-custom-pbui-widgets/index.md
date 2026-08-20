---
Title: PBUI-native chat agent with custom PBUI widgets
Ticket: PBUI-AGENT-1
Status: active
Topics:
    - pbui
    - chat
    - frontend
    - backend
DocType: index
Intent: long-term
Owners: []
RelatedFiles: []
ExternalSources: []
Summary: "Ticket for designing a PBUI-native chat agent: every structured agent output is a PBUI presentation object with verbs; custom widgets are declarative documents of PBUI atoms. Contains a feature showcase, the architecture/protocol design, and the diary."
LastUpdated: 2026-08-20T10:54:07.768211318-04:00
WhatFor: "Landing page for PBUI-AGENT-1; start here to find the showcase, the design, and the diary."
WhenToUse: "When picking up or reviewing the PBUI chat agent work."
---

# PBUI-native chat agent with custom PBUI widgets

## Overview

Design a chat agent whose UI is presentation-based from the ground up: every
structured thing the agent says or does (domain objects, columns, sources,
proposals, widgets, performed verbs, the run itself) is a PBUI
`PresentationReference` with a descriptor, so it gets the object menu, accept
mode, inspector/watchlist/trace, tiles and hydration for free. "Custom widget
capability" = widgets are declarative documents of PBUI atoms with embedded
objects, validated from one vocabulary on both sides, needing no frontend
deploy per widget.

The design rides on what the workspace already has: pinocchio `chatapp`
(widget plugin, frontend/human tools), sessionstream (hydration, projections),
react-chat `chat-provider` (widget registry, extensions, adapters), geppetto
(tools, sinks), and the workbench mutation API (hyperslop-cli / datalab). It
adds one TS package (`@hyperslop-systems/pbui-chat`), one Go package
(`pbui/pkg/pbuichat`) and one command (`PbuiVerbPerformed`).

**Read in this order**

1. [design-doc/01 — Feature showcase](./design-doc/01-feature-showcase-for-a-pbui-native-chat-agent.md): 22 features with ASCII mock-ups, a demo script, build tiers.
2. [design-doc/02 — Design](./design-doc/02-design-pbui-native-chat-agent-with-custom-pbui-widgets.md): system map, contract (§5), backend (§6), frontend (§7), sequences (§8), trust (§9), placement + tiered plan (§10), open decisions (§11).
3. [reference/01 — Diary](./reference/01-diary.md): how the research went, what was verified, what is still open.

Status: research and design complete; no code written yet. Next step is Tier 0 of design §10.2.

## Key Links

- **Related Files**: See frontmatter RelatedFiles field
- **External Sources**: See frontmatter ExternalSources field

## Status

Current status: **active**

## Topics

- pbui
- chat
- frontend
- backend

## Tasks

See [tasks.md](./tasks.md) for the current task list.

## Changelog

See [changelog.md](./changelog.md) for recent changes and decisions.

## Structure

- design/ - Architecture and design documents
- reference/ - Prompt packs, API contracts, context summaries
- playbooks/ - Command sequences and test procedures
- scripts/ - Temporary code and tooling
- various/ - Working notes and research
- archive/ - Deprecated or reference-only artifacts
