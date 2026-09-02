---
Title: 'Interaction policy and introspection: activation function, accept machine, disclosure'
Ticket: PBUI-KERNEL-4
Status: active
Topics:
    - pbui
    - design
    - architecture
    - frontend
DocType: index
Intent: long-term
Owners: []
RelatedFiles: []
ExternalSources: []
Summary: "Phase 10 of the PBUI-KERNEL-1 clean-cutover guide: split out of PBUI-KERNEL-1; see KERNEL-1 guide §0.1"
LastUpdated: 2026-09-02T18:47:30.042619328-04:00
WhatFor: "Find the scope, specification pointer, and exit criteria for this follow-up to PBUI-KERNEL-1."
WhenToUse: "After PBUI-KERNEL-1 Phase 7 has landed."
---

# Interaction policy and introspection: activation function, accept machine, disclosure

## Overview

Phase 10 of the PBUI-KERNEL-1 clean-cutover guide: extract the pointer/keyboard click ladder as one table-tested `activationOutcome` function, replace the accept flow's React state plus promise ref with a request-identified pure state machine, add refusal presentation, and add original-query introspection under an explicit public/developer disclosure policy.

Split out of PBUI-KERNEL-1 on 2026-09-02 (guide §0.1) so that KERNEL-1 ships only the consolidation boundary (compiled model, relations, strict runtime, consumer cutover). Do not start this ticket before KERNEL-1 Phase 7 has landed.

## Specification

- Authoritative design: [KERNEL-1 clean-cutover guide](../PBUI-KERNEL-1--rethinking-the-pbui-presentation-kernel-one-declaration-sibling-resolvers-and-the-runtime-that-binds-them/design-doc/02-clean-cutover-composable-pbui-presentation-semantics-kernel-intern-analysis-design-and-implementation-guide.md), guide §14.4, §14.5, §15.3–§15.5 and §19.8 (runtime DOM tests).
- Constraint from guide §3.13.1: `pbui.accept` must stay a promise-returning call usable outside React (rag-ttc's accept bridge late-binds it from its verb sink).

## Exit criteria

- Pointer and keyboard paths call the same activation function.
- accept-machine properties hold under generated event sequences.
- public introspection omits hidden detail.
- developer introspection explains the same rows as the menu query.

## Key Links

- **Related Files**: See frontmatter RelatedFiles field
- **External Sources**: See frontmatter ExternalSources field

## Status

Current status: **active**

## Topics

- pbui
- design
- architecture
- frontend

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
