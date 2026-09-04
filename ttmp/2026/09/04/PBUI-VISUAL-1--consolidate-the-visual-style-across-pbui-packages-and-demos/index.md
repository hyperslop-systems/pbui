---
Title: Consolidate the visual style across pbui packages and demos
Ticket: PBUI-VISUAL-1
Status: active
Topics:
    - pbui
    - frontend
    - design
    - review
DocType: index
Intent: long-term
Owners: []
RelatedFiles: []
ExternalSources: []
Summary: ""
LastUpdated: 2026-09-04T11:02:49.018302339-04:00
WhatFor: ""
WhenToUse: ""
---

# Consolidate the visual style across pbui packages and demos

## Overview

A screenshot-backed visual-consistency pass over every pbui package (core, workbench, chat, ecommerce, plotscript, sandbox, editor, datalab-ui) and the demo apps. Goal: one document where every component and demo state is visible, numbered and grouped by package and function, with notes on what is inconsistent (different representations of the same object, nested boxes, missing margins) and what can be folded together, at both the visual and the CSS-structure level. The reference look is the `pbui-agent-workbench` artifact without its hard shadows.

Documents:
- `design-doc/01-visual-audit-screenshots-and-inconsistency-notes.md`: the feedback document (screenshots + notes).
- `reference/01-diary.md`: chronological diary of the pass (basis for a later report and playbook).
- `various/css-inventory.md`, `various/notes-*.md`: raw collection notes from the subagents.
- `various/screenshots/<package>/`: the screenshot corpus with `manifest.json` per directory.
- `scripts/`: the playwright harness and interaction scripts, numbered in execution order.

## Key Links

- **Related Files**: See frontmatter RelatedFiles field
- **External Sources**: See frontmatter ExternalSources field

## Status

Current status: **active** — corpus collected and the feedback document written (Steps 1–3); awaiting feedback by exhibit number before the consolidation passes. Read the design doc's top section first; the catalog below it is the full numbered corpus.

## Topics

- pbui
- frontend
- design
- review

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
