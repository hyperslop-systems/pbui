---
Title: Diary
Ticket: PBUI-REBALANCE-1
Status: active
Topics:
    - pbui
    - frontend
    - design
    - architecture
    - onboarding
DocType: reference
Intent: long-term
Owners: []
RelatedFiles: []
ExternalSources: []
Summary: "Chronological investigation diary for the rebalancing-modal ticket: what was read, what was found, decisions taken, and what to do next."
LastUpdated: 2026-08-28T15:36:00-04:00
WhatFor: "Resume work on this ticket without re-deriving the investigation."
WhenToUse: "Read before resuming work; append an entry after every session."
---

# Diary

## 2026-08-28 — Ticket creation, source study, and the intern guide

### What was done

1. **Imported source material** from `~/Downloads` into `sources/`:
   `tiling-repair-textbook.md` (1124 lines), `repair-lab-2.html` (1483 lines),
   `tiling-lab-1.html` (1099 lines, renamed from `tiling-lab(1).html`). All three read in
   full.
2. **Studied the labs/textbook.** Key takeaways recorded in reference/02 and folded into the
   guide: n-ary tree model with weight vectors; minimum-size propagation as the keystone
   (local weight floors provably insufficient — COMPOUND example); one top-down repair pass;
   five weight strategies (ripple/sparse/project/relax/balance) + structural
   (reshape/rebuild/fold); measured invasiveness tiers 0–6; proposal slate with
   dedup-by-geometry, policy gating, and a scored recommendation; strategies written as
   generators so run/step/animate/batch share one code path.
3. **Explored the pbui workbench** to ground the design:
   - Protocol tree is **binary** (`Split{direction, ratio, a, b}`) —
     `proto/hyperslop/pbui/workbench/v1/workbench.proto`. No stack/tab node. No
     "set workspace tree" mutation; full mutation list ends at `SplitResize`.
   - Two appliers kept in parity: TS `packages/workbench-protocol/src/client/apply.ts`, Go
     `pkg/workbench/`; parity fixtures on both sides.
   - `Workbench.plan()/applyPlan()` (`packages/pbui-workbench/src/{types,actions}.ts`) is a
     shadow-store preflight producing one atomic mutation batch bound to a base document —
     ideal application path for proposals.
   - Existing constraints are split-local only: `DEFAULT_PANE_CONSTRAINTS`
     (240×160, minFraction 0.1) + `paneRatioBounds` in `packages/pbui-workbench/src/verbs.ts`
     — exactly the textbook's §1.3 anti-pattern; propagation is the missing piece.
   - `src/chrome/shortcutRouting.ts` is a pure single-shortcut router whose header explicitly
     says a route table earns its place at the second shortcut — the rebalance chord is that
     second shortcut.
   - Modal primitives exist: `src/components/Dialog/Dialog.tsx` + escape-surface stack
     `src/surfaces.ts` (one-surface-one-registration rule).
   - Settings surface fits the app model: `defineApp` singleton tile
     (`packages/pbui-workbench/src/apps.ts`); config persists as a `DocumentPayload` via
     `document_put`.
   - `snapRatio` applies only in SplitPane's drag path — programmatic `split.resize` is
     verbatim, so repair ratios won't be quantized.
4. **Wrote the main deliverable**: design-doc/01 — the intern-facing analysis/design/
   implementation guide (Parts 0–VI + appendices), including the binary⇄n-ary adapter design
   with provenance chains (`ChainStep{splitId, leftCount}`), weight→`split.resize` write-back
   math, and the structural-apply decision.

### Decisions taken (recorded in design-doc/01)

- **Weight repairs (tiers 1–2) apply as `split.resize` verb batches through
  `plan`/`applyPlan`** — no protocol change needed.
- **Structural repairs (tiers 3–5) recommend a new `WorkspaceSetTree` mutation** (Option B),
  with "clone workspace via `workspace.create` + delete" (Option C) as the no-protocol-change
  stopgap. Verb-sequence diffing (Option A) rejected.
- **No stacks in pbui** → drop `t:'k'`/`tabH` from the port; FOLD becomes
  "overflow to a new workspace" (capacity math unchanged, minus tabH).
- Shortcut proposal: **Mod+Shift+K**, routed through a grown `routeWorkbenchKey` table with
  the same guard contexts as Mod+K.
- **Proposals only, no auto-apply** in any phase (textbook §12 rationale).
- Clamp interaction: keep `ratioBounds` clamping, re-measure after apply, log discrepancies
  (guide §3.3, option b).

### Open questions

- Final chord choice (Mod+Shift+K is a proposal; check datalab/agentlogic/turboproof for
  collisions before Phase 3).
- Whether the `WorkspaceSetTree` protocol change is acceptable to the workbench owners, and
  in which release; Phase 4 is separable either way.
- Whether the settings tile should be registered by default in the family products or opt-in
  per product (guide assumes opt-in).
- Live preview on the Surface behind the modal (Phase 6 stretch): confirm a read-only render
  of a non-committed tree is feasible without forking Surface.

### Next steps

- Phase 0/1 per guide Part V: run the labs, then implement
  `rebalance/analysisTree.ts` + `propagate.ts` with the book-number fixtures.
- Relate key pbui files to this ticket (done via docmgr), keep changelog current.

## Step 2: Phase 1 — Analysis core (adapter + propagation)

Implemented the pure-logic foundation in `packages/pbui-workbench/src/rebalance/`: the
binary⇄n-ary adapter with write-back provenance, minimum-size propagation, and the diagnosis
entry point. This is the layer every later phase (strategies, slate, modal) computes on, and
it is the layer where "the preview must equal the applied result" is either won or lost — so
the main effort went into pixel-exactness rather than the textbook's simpler uniform-gap
model.

The design changed once during implementation, in a way design-doc/01 §3.3 had flagged as a
risk: the guide's original plan (weights = products of ratios down the chain) is *not* exact
against pbui's rendering, because each binary level subtracts only its own divider before
applying its ratio. The shipped adapter instead computes weights as **pixel shares** from an
exact binary layout, which makes n-ary layout parity exact (divider conservation: a chain
over k+1 children always contains exactly k divider tracks), and writes back in **pixel
space** (a chain step's ratio = its a-subtree extent, children plus internal dividers, over
the pair extent).

### Prompt Context

**User prompt (verbatim):** "ccommit at appropriate intervals and keep a detailed diary as you work (using the diary format from the skill)

sPrint out a brutalist work slip with the plan / different phases for the ticket. then before stsarting a phase, plrint a split about the phase, and print one when the phase is done."

**Assistant interpretation:** Implement the ticket's phases from design-doc/01 Part V, committing per phase, appending strict-format diary steps as work proceeds, and printing brutalist slips: one overall plan slip, then a start slip and a done slip per phase.

**Inferred user intent:** Actually build the rebalancing feature (not just the design), with a reviewable commit/diary trail and physical progress slips on the thermal printer.

**Commit (code):** 1beac56 — "pbui-workbench: rebalance analysis core — binary⇄n-ary adapter, propagation, diagnosis (PBUI-REBALANCE-1 P1)"

### What I did
- `rebalance/config.ts`: `RebalanceConfig`, the four policy profiles (CAREFUL/BALANCED/TIDY/ANYTHING) with constraints deliberately outside profiles, `normalizeConfig` for stale persisted payloads. Defaults seeded from `DEFAULT_PANE_CONSTRAINTS` (240×160).
- `rebalance/analysisTree.ts`: `layoutBinary` (exact SplitPane math: one divider per split, ratio over the remainder), `toAnalysis` (chain flattening with `ChainStep{splitId, leftCount, ratio}` provenance; weights = pixel shares), `layoutAnalysis` (labs' uniform-gap n-ary layout), `analysisToResizes` (pixel-space write-back emitting only changed ratios), `panesOf`.
- `rebalance/propagate.ts`: `propagate` (sum-along/max-across, fresh memo per call), `violations`, `diagnose` (three-scale feasibility + capacity `cols×rows` without tabH).
- `rebalance/testTrees.ts`: textbook fixtures as protocol trees (COMPOUND, SKINNY COL, WIDE ROW 9, FOUR DONORS, SLIVER, HEALTHY-minus-stack), `chain()` mass-ratio chain builder, seeded LCG + `randomTree` for property tests.
- Tests: 16 passing (2 files) — flattening shape/leftCount, layout parity property over 40 random trees (<1e-6), write-back round-trip (unchanged weights → zero resizes), re-skew worked example, full perturb-writeback-relayout exactness property, and the book-number propagate/violation/diagnose fixtures (COMPOUND 586×268, D short 129px; SKINNY COL 820px; WIDE ROW 9 1774px; capacity 5×4=20).
- Build plumbing: `pnpm install`, built `@hyperslop-systems/pbui` and `workbench-protocol` dists (workspace links resolve against `dist/`).

### Why
- Pixel-share weights + pixel-space write-back are what make "preview equals applied result" exact instead of approximately true; everything downstream (dedup-by-geometry, displacement stats, tier classification at 0.004 divider tolerance) assumes rects it can trust.
- Provenance on the flattened split (`leftCount` per consumed binary split; a chain over m children has exactly m−1 steps) lets write-back split the step list deterministically with no id lookups.

### What worked
- All 16 new tests green on first full run after one round of fixes; package typecheck clean; full workbench suite (141 tests) unaffected.
- The textbook numbers matched exactly (COMPOUND rects/deficits, needs, capacity) — confirming the divider-conservation argument and that COMPOUND (no same-axis nesting) renders identically in both models.

### What didn't work
- `pnpm vitest` from the package dir → `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL Command "vitest" not found`; then `pnpm --filter … test` → `sh: 1: vitest: not found` (node_modules missing) and after install → `Cannot find module '@hyperslop-systems/pbui/dist/vite.js'`. Fresh clone needs: `pnpm install`, then `pnpm --include-workspace-root --filter @hyperslop-systems/pbui build`, then `pnpm --filter @hyperslop-systems/workbench-protocol build` before workbench tests run.

### What I learned
- The guide's §3.3 "sub-pixel discrepancy" claim was optimistic: ratio-product weights vs nested-divider rendering diverge by ~3px per extra chain level at 1000px/10px-divider scale. The pixel-share formulation eliminates the discrepancy entirely rather than tolerating it.
- `snapRatio` really is drag-path-only; programmatic resize ratios go through verbatim (re-confirmed while reading SplitPane).

### What was tricky to build
- **The write-back recursion's chain-splitting invariant.** Symptom risk: off-by-one when partitioning the preorder `ChainStep[]` between the a-side and b-side sub-chains. Cause: the list carries no per-side markers. Solution: rely on the theorem that a flattened chain over m children contributes exactly m−1 steps, so after the head the next `leftCount−1` steps belong to `a`; encoded that as slice arithmetic and pinned it with the perturb-writeback-relayout property test (40 random trees, exact to 1e-6).
- **Choosing what a weight means.** Mass-fraction weights (textbook) vs pixel-share weights (shipped): the switch ripples into `avail` semantics and write-back. Settled by proving pixel conservation (extent = Σ children px + k·divider) makes `avail = extent − k·divider` exact, then testing parity.

### What warrants a second pair of eyes
- `analysisToResizes` recursion recomputes child rects from *repaired* weights while walking — correct by construction but the one place where preview and applied geometry could drift if edited carelessly; the property test is the guard.
- `testTrees.pane()` spreads a protobuf message to override its id (`{...node, id}`) — fine for pure-function tests, but these fixtures must not be fed to code that re-serializes messages.

### What should be done in the future
- Phase 2: `projectLower` + RIPPLE/SPARSE/PROJECT/BALANCE + measure/tiers + slate.
- Consider exporting `diagnose` through the package index once the API stabilizes (deferred to Phase 3 wiring).

### Code review instructions
- Start: `packages/pbui-workbench/src/rebalance/analysisTree.ts` (module comment states the two exactness facts; then `flattenChain`, `writeBackChain`), then `propagate.ts`.
- Validate: `cd packages/pbui-workbench && ./node_modules/.bin/vitest run src/rebalance` (16 tests) and `pnpm --filter @hyperslop-systems/pbui-workbench typecheck`.

### Technical details
- Write-back formula: for chain head with `leftCount` L over target pixels px′: `ratio = (Σ_{i<L} px′ᵢ + (L−1)·div) / (Σ px′ + (n−2)·div)` — denominator is the pair extent, i.e. this split's `extent − div`.
- Fixture config: textbook reference 1072×656 / 190×130 / gap 8 (in `testTrees.BOOK`), NOT pbui defaults — keeps the book's worked numbers valid as assertions.

## Step 3: Phase 2 — Weight strategies and the proposal slate

Ported the repair machinery from repair-lab-2: the L2 projection, the four v1 weight
strategies as trace-yielding generators, the one-pass repair driver, the measurement/tier
layer, and `buildSlate` — dedup-by-geometry seeded from LEAVE AS IS, policy gating with
visible-but-greyed reasons, and the polScore recommendation. The slate returns `Proposal`
objects whose `apply` is already a `split.resize` verb batch, so Phase 3's accept path is a
straight `plan`/`applyPlan` call.

The interesting deviation from the book: because Phase 1 made weights *pixel shares of the
binary rendering* rather than mass-ratio products, the textbook's exact FOUR DONORS pixel
table ([314,314,229,190] etc.) does not literally hold on chain-built fixtures — the binary
nesting renders 319/316/310/103 before repair. The tests therefore assert the *behavioral*
claims (D pins to the floor; RIPPLE's single nearest donor pays all with A/B untouched;
PROJECT spreads exactly deficit/3 per free sibling; BALANCE equalizes to 262px, which IS
book-exact since avail is conserved) computed from the actual before-pixels, instead of
hardcoding numbers whose premise changed.

### Prompt Context

**User prompt (verbatim):** (see Step 2)

**Assistant interpretation:** Continue phase-by-phase implementation with commits, diary steps, and slips.

**Inferred user intent:** (see Step 2)

**Commit (code):** d6a1b30 — "pbui-workbench: rebalance weight strategies + proposal slate (PBUI-REBALANCE-1 P2)"

### What I did
- `rebalance/trace.ts`: `TraceLine` + shared formatting helpers (R0/pct/vec/sum).
- `rebalance/projectLower.ts`: KKT one-parameter family `w′ᵢ = max(lᵢ, wᵢ+θ)`, 80-step bisection, infeasible branch returns `l/Σl`.
- `rebalance/strategies.ts`: `stratRipple` (donor order near/left/slack), `stratSparse` (solo-donor preference), `stratProject`, `stratBalance` (`always = true`, balance-then-project), all `Generator<TraceLine, number[]>` over a `StrategyConfig`.
- `rebalance/repairPass.ts`: the top-down driver — propagate first, global-infeasibility banner, trigger `deficit > 0.5 + hystPx`, children recursed with corrected rects; `newRepairContext()`.
- `rebalance/measure.ts`: `layoutStats` (viol/worst/moved/disp/dispMax/worstAspect), `sig` ordered/unordered, `dividerDiff` (0.004 tolerance), `classify` → tiers 0–6 (tier 6 renamed "moved to another workspace" for the pbui FOLD adaptation), `TIERS` chips.
- `rebalance/slate.ts`: `GENERATORS` (ripple, ripple-slack, sparse, project, balance), `buildSlate` (clone → run → measure → classify → dedup → gate → recommend), `polScore`, `checkPolicy`, `whyLine`, `geometryKey` (2px rounding), `Proposal`/`RebalanceInput`/`RebalanceSlate` types. Applies as `{kind:"split.resize"}` verb lists via `analysisToResizes`.
- Tests (20 new; 36 total in rebalance/): §5.2 projection vector + idempotence property; FOUR DONORS behavioral table incl. measured tiers (RIPPLE → W1 with exactly 1 resize verb, PROJECT → W+ with 3 dividers); COMPOUND cascade (exactly 3 borrowings at 3 depths, 0 violations); WIDE ROW 9 global infeasibility; hysteresis trigger/target asymmetry; Σw=1 invariant; slate-level HEALTHY/SLIVER/ordering/policy-budget/disabled-generator/diagnosis tests.

### Why
- Generators-as-strategies keep one code path for slate building and the modal's future trace/step panel (textbook §1.7).
- Measured tiers (not declared) are what let CAREFUL/TIDY change the recommendation without any strategy knowing a policy exists.

### What worked
- All 36 rebalance tests green on the first full run; the whole workbench suite (161) stayed green.
- The dedup mechanics reproduced the lab's headline behaviors verbatim: SLIVER merges all four targeted repairs into one card; WIDE ROW 9's donor-less ripple visibly "agrees" with LEAVE AS IS and the baseline's why-line says weights cannot help.

### What didn't work
- One typecheck failure (TS6133 unused `cfg` in `stratSparse`) — renamed to `_cfg`. A first draft of the COMPOUND cascade test used a clumsy import-indirection hack; rewritten as a plain test before ever running it.
- `pnpm --filter … typecheck` run from inside `packages/pbui-workbench` produced a doubled path (`packages/pbui-workbench/packages/…`) for the subsequent `git add` — run git from the repo root.

### What I learned
- Pixel-share weights change which *numbers* the book predicts but none of the *behaviors*; writing tests against derived expectations (deficit computed from actual before-pixels) keeps them meaningful under both models.
- BALANCE's result is book-exact even on chain fixtures (avail conservation ⇒ 1/n of 1048 = 262), a nice cross-check that the adapter's avail accounting is right.

### What was tricky to build
- **Asserting tier boundaries.** RIPPLE on FOUR DONORS moves exactly one cumulative boundary (only the C|D divider), PROJECT moves all three — this dropped out of `dividerDiff` correctly, but only after being careful that `sig()` uses pane *ids* (identity), not names, so identical names can't alias two panes.
- **The baseline's why-line state machine** (three cases: healthy / agreed-with-by-failed-repairs / lone) — ported from the lab's `buildSlate` but restructured because our dedup seeds the map with the baseline before candidates arrive.

### What warrants a second pair of eyes
- `whyLine`'s regex over trace text is inherently brittle prose-scraping; if trace wording changes, cards degrade to the tier name (harmless, but silent).
- `checkPolicy`'s budget comparison uses `dispPx === null` as "unbounded" — the settings tile (Phase 5) must round-trip that null faithfully through protobuf Struct.

### What should be done in the future
- Phase 3: modal + shortcut + accept path (`plan`/`applyPlan`), store field `rebalanceOpen`, verbs `rebalance.open/close`.
- When structural generators land (Phase 4), `GeneratorSpec` grows a non-strategy runner shape — the `kind` field already anticipates it.

### Code review instructions
- Start: `slate.ts` `buildSlate` (the orchestration), then `strategies.ts` against sources/repair-lab-2.html's `stratRipple`/`stratSparse` for port fidelity.
- Validate: `cd packages/pbui-workbench && ./node_modules/.bin/vitest run src/rebalance` (36) and `pnpm --filter @hyperslop-systems/pbui-workbench test` (161).

### Technical details
- polScore = `w.move·disp/1000 + w.struct·tier + w.aspect·ln(worstAspect) + 12·viol`; recommendation restricted to policy-ok proposals achieving the slate's minimum violation count.
- Geometry dedup key: pane ids + rects rounded to 2px (`Math.round(v/2)`), DFS order.
