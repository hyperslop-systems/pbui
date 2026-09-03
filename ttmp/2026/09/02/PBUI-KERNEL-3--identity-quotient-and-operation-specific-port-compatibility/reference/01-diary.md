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

## Step 3: Every caller names the question it asks

With the predicates in place, this step moved each compatibility decision in the kernel and the workbench onto the one that matches its operation. `compatibilityOf` in `identity.ts`, which `planIdentityAdd` and `compileIdentity` both use, is now `canShareCell`; its `Compatibility` result keeps its shape and its sentence, so the refusals in the identity tests are unchanged byte for byte. The checker's destination check is `canFlow`, which also produces the `<from> does not reach <into>` sentence, so the KERNEL-2 parity tests still pass. `legalRelations` asks `canFlow` on the relation's codomain. `resolveShow`'s filter of ports a subject may be shown in, and the workbench "Link to…" family's target filter, are `canAccept`.

One `reaches` call stays on purpose in both `check.ts` and `plan.ts`: matching an input type against a relation's declared source type. That is a question about a relation's domain, not about a port, and there is no port contract to ask `canFlow` about.

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Assistant interpretation:** Phase 3 of the plan slip: planners and checker on the predicates.

**Inferred user intent:** Same as Step 1.

**Commit (code):** 7650690 — "PBUI-KERNEL-3 P3: callers say which compatibility question they ask"

### What I did
- `identity.ts`: `compatibilityOf` over `canShareCell`; its private `FIELD_WORDS` table deleted (it lives in `compatibility.ts`).
- `check.ts`: destination check through `canFlow`; the context-naming message kept.
- `plan.ts`: `legalRelations` codomain check through `canFlow`.
- `resolveShow.ts` and `packages/pbui-workbench/src/links/contributions.ts`: `canAccept`.
- `tsc` clean; `npx vitest run src` → 42 files, 590 tests; `pnpm build`; pbui-workbench typecheck clean and 31 files, 281 tests.

### Why
- §13.2: "Do not equate all compatibility with whole-contract equality by accident." A caller that names `canFlow` cannot be reading protocol fields it should not.

### What worked
- No refusal sentence changed. The identity tests assert `different authority domain: orders vs daily_sales` and pass through the new path.

### What didn't work
- One type error: `BindingCheckDiagnostic.code` is a closed union and `Verdict.code` is a string; the checker writes the literal `"type"` rather than forwarding the verdict's code.

### What I learned
- The `"Link to…"` family's pre-filter was the only place outside the kernel that asked a compatibility question directly; everything else goes through the planners.

### What was tricky to build
- Keeping `Compatibility`'s `mismatches` order: value fields then protocol fields, which is what `contractMismatches` produced from `CONTRACT_IDENTITY_FIELDS`, so the concatenation `[...value, ...protocol]` reproduces it exactly.

### What warrants a second pair of eyes
- `resolveShow`'s second `reaches` (line ~182) compares a subject type against a spawnable app's `valueType`, which is not a contract; it stays as `reaches`. If apps ever declare contracts for spawn, it becomes `canAccept`.

### What should be done in the future
- N/A.

### Code review instructions
- Diff of this commit; every removed `reaches`/`contractMismatches` call should have a named predicate in its place.

### Technical details
- Who asks what, after this step:

```text
compileIdentity / planIdentityAdd     canShareCell
checkBinding (destination)            canFlow
legalRelations (codomain)             canFlow
resolveShow (existing ports)          canAccept
workbench "Link to…" targets          canAccept
relation domain (check, legalRelations)  reaches   (a relation, not a port)
```

## Step 4: The quotient as the thing a snapshot exposes

Guide §13.1 asks that identity be exposed as a quotient of ports into logical cells, backed by the compiled classes and alias map that already exist, with `Alias(classId)` kept as the wire representation and new reasoning phrased in cells. The prototype had `compileIdentityQuotient` (compile then view) and `logicalCellOf` (look a port up in a quotient). What was missing was the view over a SNAPSHOT, which is what planners and instruments hold: `quotientOf(s)` returns the snapshot's classes as cells and its aliases as `cellByPort`; lineage is empty because a snapshot does not persist the compile that produced its classes, and diagnostics come from a fresh compile over the snapshot's declarations and ports. `cellOf(port, s)` names a member's cell or returns null.

The three planners that refuse a shared destination now read the cell through `cellOf` and say "leave the cell first"; before, the sentence said "shares the σ1 cell; leave the class first", using both words for one thing.

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Assistant interpretation:** Phase 4 of the plan slip: the snapshot-level quotient view and logical-cell wording.

**Inferred user intent:** Same as Step 1.

**Commit (code):** b5907c9 — "PBUI-KERNEL-3 P4: quotient view of a snapshot; planners read cells"

### What I did
- `identity.ts`: `quotientOf`, `cellOf`; exported from `links/index.ts`.
- `plan.ts`: `planFollow`, `planBind`, `planDerive` "shared" refusals through `cellOf`, one word.
- `identity.quotient.test.ts`: a test over the world fixture with one admitted and one incompatible declaration.
- `tsc` clean; links suite 287.

### Why
- A planner that reads `s.aliases` and `s.classes` separately can hold an alias to a class the snapshot does not carry; `cellOf` returns null in that case, which is what the invariants checker would flag.

### What worked
- No test asserted the old "leave the class first" wording; only the PortBadge story mentions "shares the … cell", which is unchanged.

### What didn't work
- N/A.

### What I learned
- A snapshot carries classes for id stability but not lineage; a UI that wants to show "merged"/"split" must read the `CompiledIdentity` from the apply step, not the snapshot.

### What was tricky to build
- Deciding not to add lineage to the snapshot. It would mean persisting it or recomputing it on every snapshot build; the apply step already returns it once, at the moment it is true.

### What warrants a second pair of eyes
- `quotientOf` recompiles to obtain diagnostics; on a large workspace that is a union-find over the declarations per call. Callers on a hot path should use `cellOf`.

### What should be done in the future
- The identity screenshots (P5) need an inout pair; the demo apps have none, so P5 adds an IdentityLab story.

### Code review instructions
- `identity.ts` tail; the three `cellOf` lines in `plan.ts`.
