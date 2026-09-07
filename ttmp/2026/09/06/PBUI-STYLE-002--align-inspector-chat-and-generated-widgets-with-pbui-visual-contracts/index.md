---
Title: Align inspector chat and generated widgets with PBUI visual contracts
Ticket: PBUI-STYLE-002
Status: complete
Topics:
    - pbui
    - frontend
    - design
DocType: index
Intent: long-term
Owners: []
RelatedFiles: []
ExternalSources: []
Summary: Three-phase visual alignment with tested commits, bounded browser fixtures, ticket-owned screenshots and physical phase receipts.
LastUpdated: 2026-09-06T21:50:53.896387173-04:00
WhatFor: ""
WhenToUse: ""
---


# Align inspector chat and generated widgets with PBUI visual contracts

## Outcome

Implemented the seven styling candidates from the source review, using the shared Turboproof/Datalab-derived visual contracts rather than copying domain runtimes. No Go/backend API, production system, or external application was changed.

| Phase | Scope | Code commit |
|---|---|---|
| P1 | Coordination inspector, sandbox inspector/REPL/timeline, shared TextArea bounds | cf4cf5a |
| P2 | Product ObjectChip references, generated danger notices, proposal/tool card composition | 5e4970e |
| P3 | Trace/runs/events/tools density and overflow, native/framed select consistency | 46e3a30 |

Source commits are local on `fix/chat-grid-contract`; no push was requested for this ticket.

## Evidence and review

- [Detailed diary](reference/01-implementation-diary.md): prompts, decisions, exact failures, commands, checks and review guidance.
- [Capture catalogue](various/screenshots/01-capture-catalog.md): 35 original screenshots, including before/after and failed intermediate states.
- [Capture manifest](various/screenshots/manifest.json): hashes, dimensions, source/build state and story URLs.
- [Changed-file inventory](various/validation/10-change-inventory.md): links to every source/document change across the three code commits.
- [Tasks](tasks.md) and [changelog](changelog.md).

Validation logs live in `various/validation/`. Root: 870 tests. Ten workspace suites: 1,609 tests. Recursive typechecks and production builds passed; core/chat/sandbox/workbench Storybooks built. The browser acceptance script checks wide/narrow rows, filtering/disclosure with exact input, native keyboard selection, forced-colors fallback, and final coordination/REPL bounds.

## Physical workflow

`various/slips/` owns the generated layouts and receipts: overall plan, P1 START/DONE, P2 START/DONE, P3 START/DONE. The skill script performs real printing; receipts, not generated YAML alone, establish success.

## Boundaries and known limits

- Synthetic local Chromium/Linux fixtures, not backend authorization/persistence or complete accessibility certification.
- Static chat stories attempt metadata PATCH requests and receive 501; favicon 404s and demo large-chunk build warnings remain documented.
- Core dist must be rebuilt before downstream Storybooks consume shared control changes.
- Explicit native SelectInput retains platform chrome. Framed matches the global select skin. Forced-colors restores the platform arrow; custom palettes may override the shared chevron token.
- The trace narrow layout uses a container query; verify older browser targets separately.

## Reproduce

Run root `pnpm typecheck && pnpm test && pnpm build`, then workspace `pnpm -r --if-present typecheck`, `test`, and `build`. Build each affected Storybook before serving it.

Load `scripts/01-browser-acceptance.js` with the Playwright tool's filename argument; it expects core/chat/sandbox/workbench static Storybooks on loopback 16014/16013/16012/16011. Run `python3 scripts/02-capture-catalog.py` to regenerate the capture index. Capture timestamps are filesystem-mtime proxies, explicitly not immutable build provenance.
