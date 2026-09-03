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
    - Path: repo://ttmp/2026/09/03/PBUI-WORKBENCH-CORE-1--hard-cutover-consolidation-of-the-workbench-into-a-reusable-composable-core/design-doc/03-post-implementation-architecture-and-code-review.md
      Note: Current implementation assessment and stabilization priorities
    - Path: repo://ttmp/2026/09/03/PBUI-WORKBENCH-CORE-1--hard-cutover-consolidation-of-the-workbench-into-a-reusable-composable-core/reference/01-investigation-diary.md
      Note: Chronological research, failures, validation, and delivery record
    - Path: repo://ttmp/2026/09/03/PBUI-WORKBENCH-CORE-1--hard-cutover-consolidation-of-the-workbench-into-a-reusable-composable-core/reference/02-consumer-inventory-and-public-surface.md
      Note: Phase 8 migration and final public surface inventory
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

The implemented first version has three package layers: stable protocol primitives, a headless semantic core with internal pure planning and fresh execution, and a thin PBUI React shell. It deliberately removes old command names, mixed shell state, the duplicate configured client, direct DOM planning, and boolean-only canonical outcomes. The ideal four-layer prepared-transition architecture remains documented separately from this chosen implementation.

## Primary deliverables

- [Intern guide to the PBUI workbench core consolidation and hard cutover](design-doc/01-intern-guide-to-the-pbui-workbench-core-consolidation-and-hard-cutover.md)
- [Version one simplification decisions](design-doc/02-version-one-simplification-decisions.md)
- [Post-implementation architecture and code review](design-doc/03-post-implementation-architecture-and-code-review.md)
- [Investigation diary](reference/01-investigation-diary.md)
- [Consumer inventory and public surface](reference/02-consumer-inventory-and-public-surface.md)
- [Imported workbench architectural assessment](sources/01-workbench-architectural-assessment.md)
- [Historical planner purity probe](scripts/01-plan-purity-probe.historical.ts)
- [Core purity probe](scripts/02-plan-purity-probe-core.test.ts)
- [Implementation review probes](scripts/04-implementation-review-probes.test.ts)
- [Captured review-probe output](scripts/04-implementation-review-probes.output.txt)

## Key verified findings

The original shadow-planner impurity is fixed: core preview no longer changes the durable document or live link runtime. The post-implementation review found new release blockers at the transaction boundary: subscriber/effect exceptions can escape after state installation, synchronous document-source reconciliation can reverse commit receipt order, and missing-row sync bootstrap reprocesses work already included in the created snapshot. See design doc 03 and its executable probes.

## Proposed outcome

```text
workbench-protocol
        ↓
workbench-core
  manifests + validation + structural index
  pure internal planner + fresh execute gateway
  explicit links collaborator + persistence/sync/rebalance
        ↓
pbui-workbench React shell
  presentations + geometry + focus + shell-local state + components
```

## Status

**Active; stabilization and external migration required.** Phases 0–7 and the in-repository half of Phase 8 are implemented. External consumer migration and Phase 9 remain open. The post-implementation review records transaction/sync/source defects that should block release until corrected.

## Tasks and changelog

- [Tasks](tasks.md)
- [Changelog](changelog.md)
