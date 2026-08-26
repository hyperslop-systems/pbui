---
Title: Type-Directed Action Selection Engine in the PBUI Package
Ticket: PBUI-ACTIONS-2
Status: active
Topics:
    - pbui
    - frontend
    - architecture
    - design
DocType: index
Intent: long-term
Owners: []
RelatedFiles: []
ExternalSources: []
Summary: Implement the PBUI-ACTIONS-1 type-directed action-selection kernel in the current pbui package, replacing exact-type descriptor actions() with a pure resolver (type graph, rules/families, availability states, ambiguity, fresh revalidation).
LastUpdated: 2026-08-26T17:38:38.975516721-04:00
WhatFor: Give actions open composition, inheritance, explanation, and stale-action safety without touching representation descriptors, focus/accessibility behavior, or product verb routers.
WhenToUse: Read before changing presentation actions, object-menu resolution, accept conversions, or the Provider perform path.
---

# Type-Directed Action Selection Engine in the PBUI Package

## Overview

The PBUI-ACTIONS-1 research ticket produced a source-audited implementation
guide (imported into `sources/` here) against the 0.6.0 snapshot. This ticket
carries the actual implementation against current HEAD.

Drift audit (2026-08-26, HEAD after the agent-packages release and the
P-series review fixes): the guide's seams all still hold — exact `actionsFor`
lookup (`src/presentation/registry.ts:69-72`), menu resolution at render
(`createPbui.tsx:509`), raw-verb `perform` without revalidation
(`createPbui.tsx:267-270`), the `extra` seam
(`pbui-workbench/src/tileDescriptor.ts:30,125`), the sandbox registry wrapper
(`pbui-sandbox/src/actions.ts`), and the unstable `${ptype}:${index}:${label}`
adapter IDs in datalab-ui and the chat demo. Known drift: `onPerform` is now
required, `MenuState` moved into `types.ts`, chrome/toolbars call
`pbui.perform(verb)` directly (signature must be preserved), and pbui-chat
gained the executor-aware tool runtime (PBUI-TOOLCALL-1) around — not in —
the verb router/gateway seam.

- [Source guide (imported)](sources/PBUI-ACTIONS-1-source-audited-implementation-guide.md)

## Key Links

- **Related Files**: See frontmatter RelatedFiles field
- **External Sources**: See frontmatter ExternalSources field

## Status

Current status: **active**

## Topics

- pbui
- frontend
- architecture
- design

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
