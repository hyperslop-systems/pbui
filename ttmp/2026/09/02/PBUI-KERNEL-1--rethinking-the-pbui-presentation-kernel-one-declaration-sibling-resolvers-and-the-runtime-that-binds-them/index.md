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

## Status

Research and design are complete. Implementation remains planned in the phased checklist in the authoritative guide and in [tasks.md](./tasks.md).

## Ticket bookkeeping

- [Tasks](./tasks.md)
- [Changelog](./changelog.md)
