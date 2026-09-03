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
    - Path: repo://src/presentation/links/compatibility.test.ts
      Note: Identity-vs-flow tests kept apart
    - Path: repo://src/presentation/links/compatibility.ts
      Note: Four predicates (Step 2)
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

## Step 2: Four predicates where there was one equality and one bare reach

`types.ts` already had the factorization the guide asks for in §13.2: `ValueContract` (value type, role, cardinality), `PortProtocol` (mode, authority, algebra, lifetime), and projections over each. What it did not have was the predicates. Every compatibility question was answered by one of two tools: `contractMismatches`, which compares all seven fields and is what identity used, and `reaches`, which compares value types and is what flow used. Neither says which question it answers, and neither can answer "do these two endpoints combine writes the same way" without also answering six other things.

`links/compatibility.ts` gives each question a name, a code and a sentence. `canFlow(from, into, graph)` is value reachability and nothing else; `canAccept(reference, into, graph)` is flow with a reference as the source; `canShareCell(left, right)` demands equality on both projections and reports the value and protocol disagreements apart; `canMergeUpdates(left, right)` reads the algebra only. The tests are deliberately organized by question, not by fixture: the same pair of contracts is asked each question and the answers differ, which is the point.

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Assistant interpretation:** Phase 2 of the plan slip: the named predicates and the separate identity-vs-flow tests.

**Inferred user intent:** Same as Step 1.

**Commit (code):** 02d85f3 — "PBUI-KERNEL-3 P2: operation-specific port compatibility (§13.2)"

### What I did
- New `src/presentation/links/compatibility.ts` and `compatibility.test.ts` (11 tests); exports added to `links/index.ts`.
- `tsc --noEmit` clean; `npx vitest run src/presentation/links` → 287 tests.

### Why
- The guide's warning: "Do not equate all compatibility with whole-contract equality by accident." A predicate with a name cannot be used by accident for the wrong question.

### What worked
- `canFlow` produces the exact `<order> does not reach <customer>` sentence the checker and the planners already use, so P3 can route the checker through it without a message change.

### What didn't work
- Two type errors on the first typecheck: the test helper's signature did not admit the bare-type shorthand `normalizeContract` accepts, and a shared `OK` constant typed as `Verdict` was not assignable to `ShareVerdict`. Both fixed in the test helper's type and by typing `OK` `as const`.

### What I learned
- Only `updateAlgebra` is consulted by `canMergeUpdates`. Authority is a different question (who may write), and a future merge policy that needs both should compose the two predicates rather than widen this one.

### What was tricky to build
- Deciding what `canFlow` should NOT check. Cardinality (`many` into `one`) and role are plausible flow constraints and would be new behavior; the predicate names the existing PBUI-LINK-1 law and leaves that change for a ticket that wants it.

### What warrants a second pair of eyes
- `canShareCell`'s `because` sentence concatenates value then protocol mismatches, which is the order `contractMismatches` produced, so identity refusals are byte-identical after P3.

### What should be done in the future
- Cardinality-aware flow, if a product needs it.

### Code review instructions
- `compatibility.ts` top comment states the four questions; `compatibility.test.ts` is grouped by question.

### Technical details

```text
canFlow(from, into)        reaches(from.valueType, into.valueType)
canAccept(ref, into)       canFlow(ref.type, into)
canShareCell(l, r)         valueMismatches(l, r) = ∅ ∧ protocolMismatches(l, r) = ∅
canMergeUpdates(l, r)      l.updateAlgebra == r.updateAlgebra
```
