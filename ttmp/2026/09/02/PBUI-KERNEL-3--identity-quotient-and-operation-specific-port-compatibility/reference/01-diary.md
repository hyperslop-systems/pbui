---
Title: Diary
Ticket: PBUI-KERNEL-3
Status: active
Topics:
    - pbui
    - design
    - architecture
DocType: reference
Intent: long-term
Owners: []
RelatedFiles:
    - Path: repo://src/presentation/links/identity.properties.test.ts
      Note: §19.7 properties (Step 1)
    - Path: repo://src/presentation/links/identity.ts
      Note: The class compiler and the quotient view under test
ExternalSources: []
Summary: 'Chronological record of PBUI-KERNEL-3: how the identity quotient was held to its definition by property tests, how port compatibility was split into four named predicates, and how the planners and checker were moved onto them.'
LastUpdated: 2026-09-02T20:33:04.514887849-04:00
WhatFor: Continue or review the identity and compatibility work without re-deriving what was tried and why the predicates are shaped as they are.
WhenToUse: Before touching links/identity.ts, links/compatibility.ts or planIdentityAdd, or when a compatibility refusal changed.
---


# Diary

## Goal

Capture how the prototype's identity quotient view (`compileIdentityQuotient`, `logicalCellOf`, landed with KERNEL-1) was held to the §19.7 properties, how `PortContract` was factored into value and protocol projections with the four operation-specific predicates the guide names, and what evidence each step left.

## Step 1: Hold the quotient to its definition with property tests

The quotient of ports by the admitted identity edges must be a function of the set of edges, not of how they were written down. The existing tests checked one three-port chain and one reversal. This step wrote `identity.properties.test.ts`: a naive reference partition (filter edges to compatible, non-output, existing ports; take connected components; drop singletons) and forty seeded random edge sets over a synthetic port map with two fibers, an output-only port and a port with a different semantic role. The compiled cells must equal the reference; flipping every edge, writing every edge twice, and permuting the edges and the port map must leave cells, `cellByPort` and lineage unchanged; incompatible edges must be diagnosed and leave no trace; an untouched cell must keep its id when edges are added elsewhere; and the five lineage fixtures (expand, contract, merge, split, new-beside-unchanged) must report the same lineage from any order.

Every property held. The one failure on the first run was in the test, not the compiler: the compiler orders cells by contract fingerprint (so the `daily_sales` fiber sorts before `orders`), the reference by first member. The partition agreed; the comparison now sorts both sides the same way.

### Prompt Context

**User prompt (verbatim):** "Do PBUI-KERNEL-2, 3. commit at appropriate intervals and keep a detailed diary as you work (using the diary format from the skill) . Print out a brutalist work slip with the plan / different phases for the ticket. then before stsarting a phase, plrint a split about the phase, and print one when the phase is done.

Keep screenshots regularly for the diary and for the report ultimately."

**Assistant interpretation:** Implement KERNEL-3 after KERNEL-2, in phases, with a commit and diary step per phase, printed slips, and screenshots for the report the user asked for after each ticket.

**Inferred user intent:** Finish the identity half of the KERNEL-1 design with the same evidence discipline, so the report can be written from the diary.

**Commit (code):** d9fc64a — "PBUI-KERNEL-3 P1: identity quotient properties (§19.7) against a reference partition"

### What I did
- Printed the KERNEL-3 plan slip (five phases) and the P1 start slip.
- Wrote `src/presentation/links/identity.properties.test.ts` (136 tests from 40 seeds and 5 fixtures): reference partition, commutativity, duplicate idempotence, permutation invariance including lineage, incompatible-never-enter (plus a per-seed "no cell mixes fingerprints" check), id retention, lineage fixtures.
- `npx vitest run src/presentation/links/identity.properties.test.ts` → 136 passed.

### Why
- §19.7 lists these properties as the exit criteria for the identity work; hand-written cases cannot cover the union-find's tie-breaking or the fiber split.

### What worked
- The seeded generator (mulberry32) makes any failing seed reproducible from the test name.

### What didn't work
- First run: 15 reference-partition cases and the incompatible-edges fixture failed on cell ORDER only. Fixed by sorting cells by first member on both sides of the comparison; the compiler's fingerprint-first order is a canonical convention, not part of the partition.

### What I learned
- `compileIdentity` is already order-independent in ids and lineage as well as in membership, because the union-find breaks equal-rank ties lexically and the components are sorted before ids are assigned.

### What was tricky to build
- The id-retention property must not let the random extra edges touch the cell under test, or the cell is legitimately "expanded"; the generator filters those edges out.

### What warrants a second pair of eyes
- The reference partition treats compatibility as JSON equality of the normalized contract, which is what `contractMismatches` over the seven fields computes today. When P2 introduces `canShareCell`, the reference must keep agreeing with it.

### What should be done in the future
- N/A beyond P2–P5.

### Code review instructions
- `identity.properties.test.ts`: `referencePartition` is the definition; everything else compares against it.
- `npx vitest run src/presentation/links`.

### Technical details
- Synthetic port map: `a1..a8` (orders selection, inout), `b1..b4` (daily_sales selection, inout), `o1` (orders selection, out), `r1` (orders, role `brush`).
