---
Title: Scientific plot provenance, mapping guidance, and encoding normalization
Ticket: DATALAB-PLOT-002
Status: active
Topics:
    - frontend
    - plotting
    - authoring
DocType: index
Intent: long-term
Owners: []
RelatedFiles: []
ExternalSources: []
Summary: Phased frontend work to expose statistical provenance, guide incompatible recipe mappings, and prevent redundant color/facet encodings.
LastUpdated: 2026-07-30T13:28:28.917290218-04:00
WhatFor: Track the design and future implementation of trustworthy scientific plot authoring in PBUI.
WhenToUse: Start here before implementing or reviewing the next plot-authoring phases.
---

# Scientific plot provenance, mapping guidance, and encoding normalization

## Overview

PBUI already renders its grammar-of-graphics authoring model through
`@hyperslop-systems/plot`. This ticket makes that workflow inspectable and
correctable: executed statistical metadata and diagnostics become visible in
Inspector, recipe requirements become actionable mapping guidance, and facet
prevents an identical redundant color encoding.

The work is frontend-only. The persisted graphic document remains the source of
authoring intent; compatibility, effective mappings, diagnostics, and statistics
are derived from the current pipeline and plot outcome.

## Key Links

- [Implementation guide](design-doc/01-scientific-plot-provenance-and-guided-authoring-implementation-guide.md)
- [Investigation diary](reference/01-investigation-diary.md)
- **Related Files**: See frontmatter RelatedFiles field
- **External Sources**: See frontmatter ExternalSources field

## Status

Current status: **active**

## Topics

- frontend
- plotting
- authoring

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
