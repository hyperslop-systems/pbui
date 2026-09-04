---
Title: 'Link-mode wiring: scrim, lifted tiles, jacks and orthogonal wires'
Ticket: PBUI-WIRING-1
Status: active
Topics:
    - pbui
    - workbench
    - frontend
    - design
DocType: index
Intent: long-term
Owners: []
RelatedFiles: []
ExternalSources: []
Summary: ""
LastUpdated: 2026-09-04T14:12:27.825712562-04:00
WhatFor: ""
WhenToUse: ""
---

# Link-mode wiring: scrim, lifted tiles, jacks and orthogonal wires

## Overview

Nine implementation phases introduced link-mode rails, frame jacks, orthogonal routing, and scrolling. A subsequent browser-based review found outstanding routing, live-resize, overflow, visibility, and usability defects; the checked implementation tasks are historical phase completion, not final UX acceptance.

Read the [intern architecture and implementation review](design-doc/03-intern-architecture-and-implementation-review-with-interactive-resize-evidence.md) for the current assessment, measured evidence, and proposed repair sequence. Its adjacent `review-assets/` directory contains 22 browser screenshots, five diagrams, and raw geometry records. Product source was not modified by the review.

The [illustrated PDF](<design-doc/review-assets/PBUI-WIRING-1 Intern Review and Browser Evidence.pdf>) is 29 pages. It was uploaded to reMarkable as **PBUI-WIRING-1 Intern Review and Browser Evidence** under `/ai/2026/09/04/PBUI-WIRING-1`.

The expanded [review with foundations PDF](<design-doc/review-assets/PBUI-WIRING-1 Review with Foundations.pdf>) is 42 pages and was uploaded as **PBUI-WIRING-1 Review with Foundations** to the same reMarkable folder. Section 14 adds constraints, algorithms, geometry contracts, incremental computation, temporal correctness, interaction principles, and an annotated reading guide. Its [source archive](sources/foundations/README.txt) contains 13 downloaded primary references with provenance and integrity hashes in the [manifest](sources/foundations/manifest.json).

## Key Links

- **Refactoring design:** [Wiring scene architecture and intern implementation guide](design-doc/04-wiring-scene-refactoring-architecture-and-intern-implementation-guide.md). A separate proposal with 15 sections, four new diagrams, 30 current source/API references, and eight implementation phases. It assumes direct replacement with no migrations, shims, or compatibility adapters. The phases remain future implementation work.
- **Refactoring PDF:** [Design and implementation guide](<design-doc/refactor-assets/PBUI-WIRING-1 Refactoring Design and Implementation Guide.pdf>), 29 pages. Uploaded to reMarkable as **PBUI-WIRING-1 Refactoring Design and Implementation Guide** under `/ai/2026/09/04/PBUI-WIRING-1`.
- **Verified existing capability:** [Atomic Follow-plus-Pin probe](design-doc/refactor-assets/atomic-hold-probe.json), covering empty-source refusal without partial binding and successful held capture with one core publication.

- **Related Files**: See frontmatter RelatedFiles field
- **External Sources**: See frontmatter ExternalSources field

## Status

Current status: **active**

## Topics

- pbui
- workbench
- frontend
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
