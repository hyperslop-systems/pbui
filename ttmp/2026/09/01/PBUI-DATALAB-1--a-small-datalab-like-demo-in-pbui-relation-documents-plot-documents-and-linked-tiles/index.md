---
Title: 'A small datalab-like demo in pbui: relation documents, plot documents and linked tiles'
Ticket: PBUI-DATALAB-1
Status: active
Topics:
    - pbui
    - datalab
    - plot
    - frontend
    - design
    - onboarding
DocType: index
Intent: long-term
Owners: []
RelatedFiles: []
ExternalSources: []
Summary: ""
LastUpdated: 2026-09-01T18:43:34.449553491-04:00
WhatFor: ""
WhenToUse: ""
---

# A small datalab-like demo in pbui: relation documents, plot documents and linked tiles

## Overview

Datalab is a grammar-of-graphics data workbench (upload data, pipeline it through DuckDB-wasm, plot it). Migrating `packages/datalab-ui` onto `pbui-workbench` in place was tried in PBUI-WORKBENCH-2 Phase 7 and does not work as planned (see that guide's §10). This ticket instead builds a **small datalab-like demo inside pbui**: a `relation` document (datalab's data half, lifted) beside a `plot` document (`@hyperslop-systems/plot`'s, verbatim), both as payloads in the workbench document, with sources/pipeline/table/plot/plot-editor/inspector tiles on `createWorkbench`, in the shape of `pbui-plotscript`. It is the testbed PBUI-LINK-1 §11.3 asks for and the reference for cleaning up `datalab/` later.

Start with `design-doc/01-…` — it is the intern guide: what datalab is, how it is built, what the migration attempt found, and the demo's design.

## Key Links

- **Related Files**: See frontmatter RelatedFiles field
- **External Sources**: See frontmatter ExternalSources field

## Status

Current status: **active**

## Topics

- pbui
- datalab
- plot
- frontend
- design
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
