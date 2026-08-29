---
Title: Contextual Help Kernel with Markdown and Custom Renderers
Ticket: PBUI-HELP-001
Status: review
Topics:
    - frontend
    - pbui
    - design
    - architecture
DocType: index
Intent: long-term
Owners: []
RelatedFiles: []
ExternalSources: []
Summary: Design and implementation handoff for a sibling PBUI contextual help kernel with shared action matching, Markdown, structured built-ins, custom renderers, and accessible hover/focus delivery.
LastUpdated: 2026-08-29T14:47:07.317976952-04:00
WhatFor: Give the frontend implementer one authoritative map of the reusable action machinery, proposed help APIs, runtime integration, phases, and validation criteria.
WhenToUse: Use when implementing or reviewing typed contextual help in PBUI.
---


# Contextual Help Kernel with Markdown and Custom Renderers

## Overview

PBUI-HELP-001 designs the smallest useful contextual-help sibling to the PBUI actions kernel. Help rules reuse the existing type graph, scope stack, conditions, named predicates, and immutable snapshots, then contribute additive help items rendered through built-in text/Markdown/fields/notice/actions patterns or product-defined React components. The ticket is an implementation handoff; production tasks remain open.

## Key Links

- **Related Files**: See frontmatter RelatedFiles field
- **External Sources**: See frontmatter ExternalSources field

## Status

Current status: **active**

## Topics

- frontend
- pbui
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
