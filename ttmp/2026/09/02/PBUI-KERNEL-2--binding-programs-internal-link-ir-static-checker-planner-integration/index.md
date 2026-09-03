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
RelatedFiles:
    - Path: repo://src/presentation/links/candidate.ts
      Note: 'candidateTermOf: the term a verb persists'
    - Path: repo://src/presentation/links/check.ts
      Note: Static checker and the one dependency walk
    - Path: repo://src/presentation/links/expression.ts
      Note: The binding-program IR the ticket promotes to the one authority
    - Path: repo://src/presentation/links/laws.test.ts
      Note: §19.6 laws, checker coverage, parity
    - Path: repo://src/presentation/links/plan.ts
      Note: Planners reduced to operation policy
ExternalSources: []
Summary: 'Phase 8 of the PBUI-KERNEL-1 clean-cutover guide: split out of PBUI-KERNEL-1; see KERNEL-1 guide §0.1'
LastUpdated: 2026-09-02T21:05:00-04:00
WhatFor: Find the scope, specification pointer, and exit criteria for this follow-up to PBUI-KERNEL-1.
WhenToUse: After PBUI-KERNEL-1 Phase 7 has landed.
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

Implementation complete on the `task/add-plot-editor` branch (pbui 3f55488 → P5 commit). Phases: P1 laws and checker coverage as tests; P2 one dependency walk and titled diagnostics; P3 `candidateTermOf` shared by planners and apply; P4 the planners' duplicate type/cycle/context checks deleted after parity, IR constructors internal; P5 cross-package verification and screenshots. Exit criteria: wire round-trip fixtures unchanged (byte for byte); `normalize(normalize(b)) == normalize(b)`; `resume(pin(b)) == b` for follow/derived/ambient/alias; cycle and type diagnostics unchanged or improved (the checker names tiles and contexts). Evidence: [diary](./reference/01-diary.md) Steps 1–5, [screenshots](./various/screenshots/README.md), [tasks](./tasks.md).

Not in scope, recorded for later: narrowed return types on `linkVerbs.*` to drop the `TermVerb` casts; whether a hold under a derivation should compile to a `broken` program rather than folding silently.

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
