---
Title: Consolidate Datalab workspace semantics onto workbench-core
Ticket: PBUI-DATALAB-WORKBENCH-1
Status: review
Topics:
    - pbui
    - datalab
    - frontend
    - architecture
    - refactoring
    - onboarding
DocType: index
Intent: long-term
Owners: []
RelatedFiles:
    - Path: repo://ttmp/2026/09/03/PBUI-DATALAB-WORKBENCH-1--consolidate-datalab-workspace-semantics-onto-workbench-core/design-doc/01-intern-guide-to-consolidating-datalab-onto-workbench-core.md
      Note: Primary architecture and implementation guide
    - Path: repo://ttmp/2026/09/03/PBUI-DATALAB-WORKBENCH-1--consolidate-datalab-workspace-semantics-onto-workbench-core/reference/01-investigation-diary.md
      Note: Chronological evidence and design decisions
    - Path: repo://ttmp/2026/09/03/PBUI-WORKBENCH-CORE-1--hard-cutover-consolidation-of-the-workbench-into-a-reusable-composable-core/design-doc/04-workbench-stabilization-transaction-safety-headless-boundary-and-typescript-go-parity.md
      Note: Prerequisite foundation stabilization design
ExternalSources: []
Summary: Ticket hub for replacing Datalab UI's duplicate workspace, view, placement, and split-tree implementation with workbench-core while preserving Stage, analytical, launcher, bundle, persistence, and remote projection semantics.
LastUpdated: 2026-09-03T17:45:00-04:00
WhatFor: Track the evidence, design, implementation phases, and validation of Datalab's hard cutover to the canonical Workbench core.
WhenToUse: Start here before changing Datalab layout state, Workbench rendering, stage/workspace ownership, portable bundles, persistence, or remote Workbench synchronization.
---



# Consolidate Datalab workspace semantics onto workbench-core

## Overview

Datalab UI currently implements its own workspace/view/placement/split-tree language in Redux and converts it to `WorkbenchDocument` at persistence and server boundaries. PBUI now has a reusable `workbench-core` and React shell implementing the same spatial domain.

This ticket makes Workbench core the only owner of spatial state. Datalab retains what is genuinely product-specific: Stages, audiences, pinned definitions, app scoping, analytical `GraphicDocument`s, rich launcher behavior, portable bundles, templates, auth routing, and the remote policy that sends only the work stage.

## Primary deliverables

- [Intern guide to consolidating Datalab onto workbench-core](design-doc/01-intern-guide-to-consolidating-datalab-onto-workbench-core.md)
- [Investigation diary](reference/01-investigation-diary.md)
- [Tasks](tasks.md)
- [Changelog](changelog.md)

## Baseline

```text
Datalab typecheck: pass
49 test files / 554 tests: pass
store/layout.ts: 1,162 lines
37 files import store/layout
52 production layoutActions uses
0 workbench-core imports
```

A previous direct local-Node-to-protobuf experiment produced 308 errors across 25 files. This design therefore uses additive adapters and behavior goldens, followed by one coordinated reducer/renderer cutover rather than an intermediate duplicate protocol-shaped Redux model.

## Target ownership

```text
workbench-core       owns workspaces, views, placements, trees and session
Datalab Stage store  owns audience, pinned/chrome/app-scope/navigation metadata
Datalab world        owns full analytical GraphicDocuments and analysis state
Datalab projection   owns which subgraph crosses the remote boundary
```

## Dependency

Implementation should begin after [PBUI-WORKBENCH-CORE-1 design doc 04](../PBUI-WORKBENCH-CORE-1--hard-cutover-consolidation-of-the-workbench-into-a-reusable-composable-core/design-doc/04-workbench-stabilization-transaction-safety-headless-boundary-and-typescript-go-parity.md) completes, especially source ownership/hydration and TypeScript-Go binding parity.

## Status

**Review.** Design and tasks are ready; production migration has not started.
