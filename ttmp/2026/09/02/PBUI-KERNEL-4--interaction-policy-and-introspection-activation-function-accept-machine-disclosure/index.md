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
RelatedFiles:
    - Path: repo://src/presentation/Interaction.stories.tsx
      Note: The three stories behind the screenshots
    - Path: repo://src/presentation/createPbui.tsx
      Note: The runtime as executor of the machines
    - Path: repo://src/presentation/interaction/accept.ts
      Note: The accept machine
    - Path: repo://src/presentation/interaction/activation.ts
      Note: activationOutcome
    - Path: repo://src/presentation/interaction/explain.ts
      Note: explainResolution and disclosure
    - Path: repo://src/presentation/interaction/refusal.ts
      Note: describeRefusal
ExternalSources: []
Summary: 'Phase 10 of the PBUI-KERNEL-1 clean-cutover guide: split out of PBUI-KERNEL-1; see KERNEL-1 guide §0.1'
LastUpdated: 2026-09-02T22:00:00.042619328-04:00
WhatFor: Find the scope, specification pointer, and exit criteria for this follow-up to PBUI-KERNEL-1.
WhenToUse: After PBUI-KERNEL-1 Phase 7 has landed.
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

Implementation complete on the `task/add-plot-editor` branch (pbui 2ae05e8 → P6 commit). Phases: P1 `activationOutcome` with a table test, both DOM handlers on it; P2 the accept machine (`AcceptState`/`AcceptEvent`/`AcceptEffect`, `acceptStep`) with 200 fuzzed sequences; P3 the Provider as executor, `pbui.accept` still a promise outside React, Escape dispatched by the surfaces; P4 `RefusalNotice`, `pbui.refusal`, `describeRefusal`, `onRefuse` optional with an unobserved-refusal warning; P5 `explainResolution` and `pbui.explain` with public/developer disclosure; P6 §19.8 runtime tests, the Interaction stories, seven screenshots, README. Exit criteria: pointer and keyboard call one activation function (P1); accept-machine properties hold under generated sequences (P2) and through the DOM (P6); public introspection omits hidden detail and developer explains the same rows as the menu query (P5). Evidence: [diary](./reference/01-diary.md) Steps 1–6, [screenshots](./various/screenshots/README.md), [tasks](./tasks.md).

Recorded for later: consumers can mount `RefusalNotice` and drop their `() => {}` handlers at the 0.11 release; a developer-disclosure panel in a product; the runtime does not enforce the gate around developer disclosure.

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
