---
Title: 'Tile linking: binding terms, link mode, and the target resolver in the pbui workbench'
Ticket: PBUI-LINK-1
Status: active
Topics:
    - pbui
    - design
    - architecture
    - actions
    - frontend
    - onboarding
DocType: index
Intent: long-term
Owners: []
RelatedFiles: []
ExternalSources: []
Summary: 'Analysis and design for tile linking in pbui: ports, binding terms (Ambient/Constant/Follow/Alias/Derived/Hold), a pure link kernel beside the action kernel, a pbui.links document payload, a header badge, an object-menu "Link to…" family, a connect-management mode with wires, a target resolver for "show", phased plan, demos, and tests.'
LastUpdated: 2026-09-01T15:06:01.825718397-04:00
WhatFor: 'Entry point for anyone implementing or reviewing tile linking in pbui-workbench.'
WhenToUse: 'When starting Phase 0/1 of tile linking, or when a product wants to declare ports.'
---

# Tile linking: binding terms, link mode, and the target resolver in the pbui workbench

## Overview

Tile linking lets one pbui tile feed, follow, share, or derive its content from another, with a visible and inspectable representation of the coupling. This ticket studies the linked-tiles research (the formal report, the audited toy model, the agent-workbench prototype, the P06 identity compiler) against the real pbui codebase and produces one intern-level guide: what exists (action kernel, accept mode, workbench document bindings, verbs, chrome, product integrations), what is missing term by term, a design (ports and contracts on `AppDescriptor`, binding terms, a pure link kernel in `pbui/src/presentation/links/`, a `pbui.links` document payload plus a view-keyed runtime, link verbs in the `WorkbenchVerb` union), an unobtrusive interaction surface (header badge, "Link to…" object-menu family with accept mode as the chooser, a connect-management mode with wires and port-to-port drag, a `LauncherShell`-based "show" chooser), eight decision records, pseudocode, diagrams, seven implementation phases with file lists, five demo applications, a test strategy, and open questions.

Status: IMPLEMENTED. Phases 0–7 landed on 2026-09-01 (commits cc771ca … aede49f); the guide's §17 records the implementation and its deviations, the diary's steps 4–11 the work. The gold-coin shop package `packages/pbui-ecommerce` is the first consumer; nine real-pointer scenarios pass.

## Key Links

- Design guide: [design-doc/01-tile-linking-in-pbui-intern-analysis-design-and-implementation-guide.md](./design-doc/01-tile-linking-in-pbui-intern-analysis-design-and-implementation-guide.md)
- Diary: [reference/01-investigation-diary.md](./reference/01-investigation-diary.md)
- Toy model: `/home/manuel/code/wesen/2026-08-28--toy-actions-linked-pbui`
- Research bundle (report, prototypes, P06, tickets PBUI-LINK-UI and PBUI-LINK-UI-AUDIT): `/home/manuel/Downloads/PBUI-linked-tiles-research-bundle`
- Vault reports: go-go-parc `Projects/2026/08/27/PROJECT REPORT - PBUI Linked Tiles - Interaction Models, Formal Semantics, and an Architecture for Routing, Binding, and Coordination.md` and `Projects/2026/08/29/PROJECT REPORT - PBUI Linked Tiles - From Plausible Demos to Verified Interaction Semantics.md`
- **Related Files**: See frontmatter RelatedFiles field
- **External Sources**: See frontmatter ExternalSources field

## Status

Current status: **active**

## Topics

- pbui
- design
- architecture
- actions
- frontend
- onboarding

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
