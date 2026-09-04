---
Title: Enforce the PBUI repository dependency DAG
Ticket: PBUI-DEPENDENCY-DAG-1
Status: active
Topics:
    - pbui
    - architecture
    - refactoring
    - onboarding
DocType: index
Intent: long-term
Owners: []
RelatedFiles:
    - Path: repo://ttmp/2026/09/03/PBUI-DEPENDENCY-DAG-1--enforce-the-pbui-repository-dependency-dag/design-doc/01-intern-guide-to-enforcing-pbui-dependency-boundaries.md
      Note: Primary intern implementation guide
    - Path: repo://ttmp/2026/09/03/PBUI-DEPENDENCY-DAG-1--enforce-the-pbui-repository-dependency-dag/reference/01-investigation-diary.md
      Note: Chronological implementation diary
ExternalSources:
    - /tmp/pbui-improvements.md
Summary: Ticket hub for making PBUI's 13-package architecture and stable root source layers executable as tests, correcting manifest drift, and preventing undeclared, extraneous, forbidden, or cyclic internal edges.
LastUpdated: 2026-09-03T21:50:00-04:00
WhatFor: Track evidence, design, implementation, validation, and delivery of repository dependency-DAG enforcement.
WhenToUse: Start here before implementing or reviewing PBUI-DEPENDENCY-DAG-1 or changing internal package boundaries.
---


# Enforce the PBUI repository dependency DAG

## Overview

PBUI’s package graph is currently acyclic but mostly conventional. This ticket makes its intended edges executable through ordinary Vitest tests, following Datalab’s successful internal-layer precedent without adding a new lint framework.

The baseline inventory found 13 package manifests, 48 internal declared-or-imported edges, one unused runtime declaration, and one undeclared direct import. The cutover corrects both defects and makes recurrence fail in CI.

## Deliverables

- [Intern implementation guide](design-doc/01-intern-guide-to-enforcing-pbui-dependency-boundaries.md)
- [Investigation diary](reference/01-investigation-diary.md)
- [Package graph inventory](reference/02-package-graph-inventory.json)
- [Root layer inventory](reference/03-root-layer-inventory.json)
- [Tasks](tasks.md)
- [Changelog](changelog.md)

## Phase sequence

```text
P0 evidence
→ P1 manifest corrections
→ P2 package scanner/policy
→ P3 graph laws
→ P4 root source layers
→ P5 CI, docs, and full validation
```

## Related audit

`PBUI-RELATIONS-CUTOVER-1` records that the presentation relation hard cutover proposed by the older improvement list had already been completed by PBUI-KERNEL-1. This ticket is the next actual unimplemented recommendation.

## Status

**Active.** Design and baseline evidence are complete; implementation is proceeding as a coordinated hard cutover.
