---
Title: 'Scripted plots: the full worked example in pbui, editor tile beside plot tile'
Ticket: PBUI-PLOTSCRIPT-1
Status: review
Topics:
    - frontend
    - pbui
    - plotting
    - design
    - architecture
DocType: index
Intent: long-term
Owners: []
RelatedFiles: []
ExternalSources: []
Summary: ""
LastUpdated: 2026-09-01T14:42:48.209959524-04:00
WhatFor: ""
WhenToUse: ""
---


# Scripted plots: the full worked example in pbui, editor tile beside plot tile

## Overview

A runnable pbui example: a workspace with a **JavaScript editor tile** on the
left and a **plot tile** on the right, both bound to one document. You write a
script against the `@hyperslop-systems/plot` authoring API; it runs in the
sandbox; the chart re-renders. A failing run keeps the last good plot and marks
it stale.

Delivered as a new package `@hyperslop-systems/pbui-plotscript` — the only place
`pbui`, `pbui-workbench`, `pbui-sandbox`, `pbui-editor` and `plot` all meet —
plus a `demo/` reference product following the `packages/pbui-chat/demo`
pattern.

## Dependency

**PBUI-PLOTKIT-1** (`ttmp/2026/09/01/PBUI-PLOTKIT-1--*/`) supplies the
`CodeEditor` component and the plot sandbox shim. Its phases 1–3 must be merged
first.

## History

This ticket began as `DATALAB-PLOTSCRIPT-1` in the `datalab` repository. It
moved here and the target moved with it: the example is built **in pbui, for
now**, because pbui already has `pbui-workbench` and Datalab does not.
Datalab's cutover is `DATALAB-WORKBENCH-1`; bringing these tiles into the
product is work that follows it.

## Main deliverable

- [`design-doc/01-scripted-plots-in-pbui-intern-architecture-design-research-and-implementation-guide.md`](./design-doc/01-scripted-plots-in-pbui-intern-architecture-design-research-and-implementation-guide.md)
  — a 14-section intern guide: the whole system explained (the plot compiler's
  five stages, the workbench's view/placement model, the sandbox runtime, and
  Datalab as reference), then six decision records, the run pseudocode, three
  worked example scripts checked against the real type definitions, six open
  questions, a phased plan and a testing strategy.

## Key Links

- **Related Files**: See frontmatter RelatedFiles field
- **External Sources**: See frontmatter ExternalSources field

## Status

Current status: **active**

## Topics

- frontend
- pbui
- plotting
- design
- architecture

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
