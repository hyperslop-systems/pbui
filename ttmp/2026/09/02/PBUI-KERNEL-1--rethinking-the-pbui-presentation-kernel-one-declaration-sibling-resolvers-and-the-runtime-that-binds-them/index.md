---
Title: 'Rethinking the pbui presentation kernel: one declaration, sibling resolvers, and the runtime that binds them'
Ticket: PBUI-KERNEL-1
Status: active
Topics:
    - pbui
    - actions
    - design
    - architecture
    - frontend
    - onboarding
    - refactoring
DocType: index
Intent: long-term
Owners: []
RelatedFiles: []
ExternalSources: []
Summary: 'Research and implementation planning for a clean-cutover PBUI presentation-semantics model: one declaration composed from named fragments, canonical relations, sibling interpreters, explicit snapshots, link-program analysis, and coordinated migration of every PBUI consumer.'
LastUpdated: 2026-09-02T22:40:00-04:00
WhatFor: 'Find the authoritative clean-cutover design, its current-system evidence, imported research artifacts, investigation history, implementation tasks, and delivery status.'
WhenToUse: 'When implementing or reviewing PBUI-KERNEL-1, migrating a PBUI consumer, or deciding whether behavior belongs in shared semantics, a specialist interpreter, the React runtime, or the workbench link kernel.'
---

# Rethinking the PBUI presentation kernel

## Overview

PBUI has sound specialist interpreters for actions, contextual help, acceptance, and persistent workbench linking, but products assemble their shared graph, scopes, predicates, descriptors, conversions, snapshots, and runtime dependencies separately. This ticket maps the existing architecture and defines a coordinated clean cutover to one compiled presentation model while preserving the distinct laws of each interpreter.

The original guide remains the detailed evidence map. The authoritative implementation proposal is the clean-cutover guide, which incorporates the imported composable-kernel research report, the validated prototype patch, and the decision that all first-party PBUI consumers can migrate together without permanent compatibility infrastructure.

## Authoritative design

- [Clean-cutover composable PBUI presentation semantics kernel](./design-doc/02-clean-cutover-composable-pbui-presentation-semantics-kernel-intern-analysis-design-and-implementation-guide.md) — final analysis, API design, decisions, migration plan, tests, and release checklist.

## Supporting documents

- [Original kernel analysis and consolidation proposal](./design-doc/01-the-pbui-presentation-kernel-intern-analysis-design-and-implementation-guide-for-its-consolidation.md) — current-system architecture and initial proposal; its API/phases are superseded by the clean-cutover guide.
- [Investigation diary](./reference/01-investigation-diary.md) — chronological evidence, commands, validation results, failures, and delivery history.
- [Composable Kernel Research Report](./sources/PBUI-Composable-Kernel-Research-Report.md) — imported formal research report.
- [Composable Kernel prototype patch](./sources/pbui-composable-kernel.patch) — imported 31-file implementation prototype; preserved as source evidence, not applied to the active branch.

## Current decisions

- One compiled presentation model is assembled from one product declaration and named fragments.
- Actions, help, acceptance, and links remain sibling interpreters.
- Translators are replaced by canonical typed relations with explicit interpreter exposure.
- Revisions are product-defined semantic tokens; PBUI does not serialize arbitrary facts by default.
- Known, default, and active scopes are separate concepts.
- The final runtime has one strict model-based construction path.
- Persisted link terms remain stable and compile to an internal binding-program representation.
- Identity is exposed as a quotient of compatible ports, separate from directed value flow.

## Scope split (2026-09-02)

This ticket ships guide §18 Phases 0–7 and 11. The rest moved to follow-up tickets (guide §0.1):

- PBUI-KERNEL-2 — binding programs: internal link IR, static checker, planner integration (Phase 8).
- PBUI-KERNEL-3 — identity quotient and operation-specific port compatibility (Phase 9).
- PBUI-KERNEL-4 — interaction policy and introspection (Phase 10).

Confirmed decisions: hard runtime cutover (C16), mechanical migration of the frozen datalab-ui (C17), pbui-chat as a fragment (C18). Consumer inventory: guide §3.13.1 (rag-ttc is the primary external target; hyperblog the open-world consumer; turboproof and agentlogic out of scope).

## Status

Implementation of Phases 0–7 and 11 is complete on the `task/add-plot-editor` workspace branch (pbui d2ee0c2 → HEAD; rag-ttc 4658ef77; hyperblog 6b5c58f). The release steps that remain are listed in guide §20.5; the split-out work is PBUI-KERNEL-2/3/4. Evidence: [tasks.md](./tasks.md), the [diary](./reference/01-investigation-diary.md) Steps 4–12, and [screenshots](./various/screenshots/README.md).

## Ticket bookkeeping

- [Tasks](./tasks.md)
- [Changelog](./changelog.md)
