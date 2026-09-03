---
Title: Identity quotient and operation-specific port compatibility
Ticket: PBUI-KERNEL-3
Status: active
Topics:
    - pbui
    - design
    - architecture
DocType: index
Intent: long-term
Owners: []
RelatedFiles: []
ExternalSources: []
Summary: "Phase 9 of the PBUI-KERNEL-1 clean-cutover guide: split out of PBUI-KERNEL-1; see KERNEL-1 guide §0.1"
LastUpdated: 2026-09-02T21:30:00-04:00
WhatFor: "Find the scope, specification pointer, and exit criteria for this follow-up to PBUI-KERNEL-1."
WhenToUse: "After PBUI-KERNEL-1 Phase 7 has landed."
---

# Identity quotient and operation-specific port compatibility

## Overview

Phase 9 of the PBUI-KERNEL-1 clean-cutover guide: expose identity as a quotient of compatible ports into logical cells (backed by the existing class compiler, `Alias` stays the wire form), add order/duplicate invariance properties, and factor `PortContract` into value and protocol projections with named operation-specific predicates (`canFlow`, `canShareCell`, `canAccept`, `canMergeUpdates`).

Split out of PBUI-KERNEL-1 on 2026-09-02 (guide §0.1) so that KERNEL-1 ships only the consolidation boundary (compiled model, relations, strict runtime, consumer cutover). Do not start this ticket before KERNEL-1 Phase 7 has landed.

## Specification

- Authoritative design: [KERNEL-1 clean-cutover guide](../PBUI-KERNEL-1--rethinking-the-pbui-presentation-kernel-one-declaration-sibling-resolvers-and-the-runtime-that-binds-them/design-doc/02-clean-cutover-composable-pbui-presentation-semantics-kernel-intern-analysis-design-and-implementation-guide.md), guide §13 (quotient model, port contract factorization) and §19.7 (identity properties).
- The prototype's quotient view in `src/presentation/links/identity.ts` lands with KERNEL-1's patch application and is the starting point.

## Exit criteria

- Existing class ids and lineage fixtures remain stable.
- quotient partition is order-independent.
- identity and flow compatibility tests are separate.

## Key Links

- **Related Files**: See frontmatter RelatedFiles field
- **External Sources**: See frontmatter ExternalSources field

## Status

Implementation complete on the `task/add-plot-editor` branch (pbui d9fc64a → P5 commit). Phases: P1 §19.7 properties as 136 seeded tests against a reference partition; P2 `links/compatibility.ts` with `canFlow`, `canAccept`, `canShareCell`, `canMergeUpdates`; P3 identity on `canShareCell`, checker and `legalRelations` on `canFlow`, `resolveShow` and the workbench "Link to…" family on `canAccept`; P4 `quotientOf(snapshot)` and `cellOf`, one word for a cell; P5 the IdentityLab story, five screenshots, README section. Exit criteria: existing class ids and lineage fixtures stable (identity.test.ts unchanged and green); the quotient partition is order-independent (P1); identity and flow compatibility tests are separate (compatibility.test.ts, grouped by question). Evidence: [diary](./reference/01-diary.md) Steps 1–5, [screenshots](./various/screenshots/README.md), [tasks](./tasks.md).

Not in scope, recorded for later: cardinality-aware flow (`many` into `one`); lineage in the snapshot; `canAccept` for spawnable apps once they declare contracts.

## Topics

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
