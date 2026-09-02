---
Title: 'Binding programs: internal link IR, static checker, planner integration'
Ticket: PBUI-KERNEL-2
Status: active
Topics:
    - pbui
    - design
    - architecture
    - refactoring
DocType: index
Intent: long-term
Owners: []
RelatedFiles: []
ExternalSources: []
Summary: "Phase 8 of the PBUI-KERNEL-1 clean-cutover guide: split out of PBUI-KERNEL-1; see KERNEL-1 guide §0.1"
LastUpdated: 2026-09-02T18:47:29.919972726-04:00
WhatFor: "Find the scope, specification pointer, and exit criteria for this follow-up to PBUI-KERNEL-1."
WhenToUse: "After PBUI-KERNEL-1 Phase 7 has landed."
---

# Binding programs: internal link IR, static checker, planner integration

## Overview

Phase 8 of the PBUI-KERNEL-1 clean-cutover guide: compile the persisted PBUI-LINK-1 binding grammar into an internal binding-program IR, add the static checker (sources, relation domains, destination type, cycles), migrate `links/evaluate.ts` onto the IR, centralize dependency extraction, integrate candidate checking into the planners, and delete the superseded per-verb structural checks after parity.

Split out of PBUI-KERNEL-1 on 2026-09-02 (guide §0.1) so that KERNEL-1 ships only the consolidation boundary (compiled model, relations, strict runtime, consumer cutover). Do not start this ticket before KERNEL-1 Phase 7 has landed.

## Specification

- Authoritative design: [KERNEL-1 clean-cutover guide](../PBUI-KERNEL-1--rethinking-the-pbui-presentation-kernel-one-declaration-sibling-resolvers-and-the-runtime-that-binds-them/design-doc/02-clean-cutover-composable-pbui-presentation-semantics-kernel-intern-analysis-design-and-implementation-guide.md), guide §12.3–§12.7 (IR, lowering, dependency extraction, checker, planner integration) and §19.6 (binding-program laws).
- The prototype's `src/presentation/links/expression.ts` and `links/check.ts` land with KERNEL-1's patch application and are the starting point.

## Exit criteria

- Wire round-trip fixtures unchanged.
- normalize(normalize(b)) == normalize(b).
- hold/resume law passes.
- cycle/type errors match or improve current diagnostics.

## Key Links

- **Related Files**: See frontmatter RelatedFiles field
- **External Sources**: See frontmatter ExternalSources field

## Status

Current status: **active**

## Topics

- pbui
- design
- architecture
- refactoring

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
