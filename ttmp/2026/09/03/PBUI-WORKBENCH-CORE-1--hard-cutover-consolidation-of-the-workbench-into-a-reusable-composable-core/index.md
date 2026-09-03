---
Title: Hard-cutover consolidation of the workbench into a reusable composable core
Ticket: PBUI-WORKBENCH-CORE-1
Status: review
Topics:
    - pbui
    - frontend
    - architecture
    - design
    - refactoring
    - onboarding
DocType: index
Intent: long-term
Owners: []
RelatedFiles:
    - Path: repo://ttmp/2026/09/03/PBUI-WORKBENCH-CORE-1--hard-cutover-consolidation-of-the-workbench-into-a-reusable-composable-core/design-doc/01-intern-guide-to-the-pbui-workbench-core-consolidation-and-hard-cutover.md
      Note: Primary hard-cutover architecture and implementation guide
    - Path: repo://ttmp/2026/09/03/PBUI-WORKBENCH-CORE-1--hard-cutover-consolidation-of-the-workbench-into-a-reusable-composable-core/reference/01-investigation-diary.md
      Note: Chronological research, failures, validation, and delivery record
    - Path: repo://ttmp/2026/09/03/PBUI-WORKBENCH-CORE-1--hard-cutover-consolidation-of-the-workbench-into-a-reusable-composable-core/sources/01-workbench-architectural-assessment.md
      Note: Imported source requested by the user
ExternalSources: []
Summary: Ticket hub for the evidence-backed hard-cutover design that separates the PBUI Workbench into protocol, pure engine, transactional runtime, and React shell layers.
LastUpdated: 2026-09-03T15:00:00-04:00
WhatFor: Track the architecture, evidence, implementation plan, and delivery for consolidating PBUI’s Workbench into foundational reusable technology.
WhenToUse: Start here when implementing or reviewing PBUI-WORKBENCH-CORE-1.
---


# Hard-cutover consolidation of the workbench into a reusable composable core

## Overview

The current Workbench has grown from a split-pane React shell into PBUI’s persistent spatial identity and application-coordination system. This ticket maps the protocol, TypeScript and Go validators, store, verbs, links, rebalance, persistence, sync, React shell, and first-party consumers, then defines a coordinated alpha hard cutover.

The target has four layers: stable protocol primitives, a pure headless engine, a transactional runtime, and a thin PBUI React shell. The canonical semantic door is `plan(snapshot, command) -> PreparedTransition`, followed by a precondition-checked commit. The design deliberately removes old command names, mixed shell state, duplicate configured clients, direct DOM planning, unsafe lifecycle bypasses, and boolean-only canonical outcomes.

## Primary deliverables

- [Intern guide to the PBUI workbench core consolidation and hard cutover](design-doc/01-intern-guide-to-the-pbui-workbench-core-consolidation-and-hard-cutover.md)
- [Version one simplification decisions](design-doc/02-version-one-simplification-decisions.md)
- [Investigation diary](reference/01-investigation-diary.md)
- [Imported workbench architectural assessment](sources/01-workbench-architectural-assessment.md)
- [Planner purity probe](scripts/01-plan-purity-probe.test.ts)
- [Captured probe output](scripts/01-plan-purity-probe.output.txt)

## Key verified finding

Current `createWorkbench.plan()` shares the live link runtime with shadow handlers. Planning an identity merge leaves the document unchanged but increments the live runtime revision and creates identity class `σ1`. The probe makes this correctness issue executable and is intended to be inverted when the pure planner lands.

## Proposed outcome

```text
workbench-protocol
        ↓
workbench-core (pure planner, validation, index, modules)
        ↓
transactional runtime (revisions, commit, session, link values)
        ↓
pbui-workbench React shell (geometry, focus, controllers, components)
```

## Status

**Active; implementation queued.** Research is complete, the primary guide now separates the ideal architecture from the chosen first implementation, and `tasks.md` tracks Phases 0–9. Production implementation has not started.

## Tasks and changelog

- [Tasks](tasks.md)
- [Changelog](changelog.md)
