---
Title: A principled type and action selection engine for PBUI presentations
Ticket: PBUI-ACTIONS-1
Status: complete
Topics:
    - pbui
    - frontend
    - design
    - architecture
    - research
DocType: index
Intent: long-term
Owners: []
RelatedFiles: []
ExternalSources: []
Summary: Research and design package for a subtype-, context-, history-, scope-, translator-, and advice-aware PBUI action-selection kernel.
LastUpdated: 2026-08-25T12:23:34.628962156-04:00
WhatFor: Navigate the theoretical analysis, executable experiment, source corpus, and chronological investigation record.
WhenToUse: Start here when reviewing PBUI-ACTIONS-1 or planning implementation phases.
---


# A principled type and action selection engine for PBUI presentations

## Overview

PBUI currently discovers object-menu actions through one exact presentation-type descriptor callback. This ticket analyzes that implementation and proposes a composable action-selection kernel grounded in Ciccarelli's presentation-based interface model, Common Lisp CLIM, predicate dispatch, CLOS/AOP method composition, and context-oriented programming.

The proposed architecture separates stable type classification, action discovery, contextual applicability, specificity/override, typed translation, gesture routing, and effect execution. It preserves PBUI's strongest existing invariants: unavailable actions remain visible with one explanation, verbs are serializable data, selection is pure, and effects are revalidated at execution.

## Primary deliverables

- [Type-directed action selection: theoretical foundations, architecture, and implementation guide](./design-doc/01-type-directed-action-selection-theoretical-foundations-architecture-and-implementation-guide.md) — current-state map, theory, proposed APIs and algorithms, decision records, phased implementation, migration examples, tests, risks, and open questions.
- [Investigation diary](./reference/01-investigation-diary.md) — chronological commands, failures, evidence, commits, decisions, review instructions, and delivery record.
- [`scripts/01-selection-kernel.mjs`](./scripts/01-selection-kernel.mjs) — executable demonstration of subtype inheritance, specificity, mode/history availability, advice ordering, and ambiguity diagnosis.
- [`scripts/01-selection-kernel.output.txt`](./scripts/01-selection-kernel.output.txt) — captured expected output.
- [`sources/`](./sources/) — local PDFs, extracted text, and CLIM reference pages used by the report.

## Recommended reading order

1. Design guide Executive Summary and Sections 1–3 for terminology and foundations.
2. Sections 5–8 for the semantic model, resolver, translators, and execution advice.
3. Section 14 for the file-level phased implementation guide.
4. Section 16 for proposed decision records and Section 18 for unresolved choices.
5. Run the experiment, then read the diary for process and validation evidence.

## Status

Research, design, experiment, documentation validation, and reMarkable delivery are tracked in [tasks.md](./tasks.md). See [changelog.md](./changelog.md) for completed milestones.
