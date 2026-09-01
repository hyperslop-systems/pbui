---
Title: The JavaScript editor tile and the plot sandbox shim
Ticket: PBUI-PLOTKIT-1
Status: active
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
LastUpdated: 2026-09-01T13:15:40.982115252-04:00
WhatFor: ""
WhenToUse: ""
---

# The JavaScript editor tile and the plot sandbox shim

## Overview

Two pieces of enabling infrastructure, neither user-visible on its own:

1. **`@hyperslop-systems/pbui-editor`** — a new peer package carrying CodeMirror
   6, exporting a `CodeEditor` component whose API mirrors pbui's `TextArea`,
   themed from pbui tokens. A new package rather than a core component because
   `@hyperslop-systems/pbui` deliberately has zero runtime dependencies.
2. **The plot sandbox shim** — `packages/pbui-sandbox/src/plot/`: the
   `@hyperslop-systems/plot` authoring API reproduced as injectable source, the
   `ScriptResult` contract, and `checkScriptResult`. It works because every
   authoring function is a pure object constructor over branded types that erase
   at runtime, so a sandboxed program can build a real `PlotDocument` with no
   module loader. A parity test against the real package keeps it honest.

Both are proven on real call sites in the same ticket: `PlaygroundTile` and
`SourceTile` in `pbui-sandbox` migrate onto `CodeEditor`.

## Consumer

**PBUI-PLOTSCRIPT-1** (`ttmp/2026/09/01/PBUI-PLOTSCRIPT-1--*/`) puts them
together into a runnable editor-beside-plot example.

## Main deliverable

- [`design-doc/01-the-editor-tile-and-the-plot-sandbox-shim-intern-architecture-and-implementation-guide.md`](./design-doc/01-the-editor-tile-and-the-plot-sandbox-shim-intern-architecture-and-implementation-guide.md)
  — a 12-section intern guide: pbui's zero-dependency rule and stylesheet
  cascade, the workbench app model, the sandbox engines and their JSON-only
  rule, the plot authoring API and its erasing brands; then five decision
  records, the `CodeEditor` API and React bridge, the full shim source, the
  parity test, and a five-phase plan.

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
