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

## Step 4: Phase 3 — The modal, the shortcut, and the atomic apply path

The feature became visible: `Mod+Shift+K` now opens a `WorkbenchRebalance` dialog showing the
proposal slate as cards — tier chip, merged "+n agree", an SVG thumbnail with per-tile
identity hues and dashed ghost-outlines + trails for the biggest movers, a why-line, and the
numbers row — over a diagnosis header and a collapsible trace panel. Apply routes through
`plan`/`applyPlan` (atomic, staleness-checked), and a single-level Undo restores the
pre-apply document. The shortcut router grew into the two-row route table its own header
comment promised at the second shortcut.

One deliberate deviation from design-doc/01 §4.1/§4.6: Apply keeps the dialog OPEN (the
lab's behaviour) instead of closing it. Closing on accept would leave Undo with no home —
the modal unmounts and the ref holding the previous document dies with it. The lab's
apply-inspect-undo loop is also simply better for a feature whose whole point is trying
repairs safely; Escape closes when the user is done, and Dialog's focus-return puts the
keyboard back where it was.

### Prompt Context

**User prompt (verbatim):** (see Step 2)

**Assistant interpretation:** Continue phase-by-phase implementation with commits, diary steps, and slips.

**Inferred user intent:** (see Step 2)

**Commit (code):** 0784a5c — "pbui + pbui-workbench: rebalance dialog, Mod+Shift+K route table, rebalance verbs (PBUI-REBALANCE-1 P3)"

### What I did
- `src/chrome/shortcutRouting.ts`: `ShortcutDecision` gains `open-rebalance`; a static two-row `ROUTES` table (`k`+shift discriminator) replaces the single hard-coded key check; guard block unchanged and shared. Header comment updated to say the promised table has arrived.
- `src/chrome/chrome.test.tsx`: two new tests — shift discriminates the chords (both platforms; Shift+K without Mod is typing), and the rebalance chord shares the full guard block (all five blocked contexts + editable-target pass-through).
- `packages/pbui-workbench/src/store.ts`: `WorkbenchState.rebalanceOpen` (browser-local, never serialised — same doc'd rationale as `launcherOpen`).
- `packages/pbui-workbench/src/verbs.ts`: `rebalance.open`/`rebalance.close` verbs — union, factories (`openRebalance`/`closeRebalance`), `isWorkbenchVerb`, `describeWorkbenchVerb` ("propose layout repairs for this workspace"), handlers interface + implementations, `performWorkbenchVerb` dispatch.
- `components/RebalanceDialog/` (folder-per-component with index, story, test, CSS module): `WorkbenchRebalance` (launcher-mirrored window listener: focus-ownership rule, `useAnyEscapeSurface`, route → `verbs.openRebalance()`), `RebalanceModal` (rect via `wb.root()` + ResizeObserver with a 1024×640 headless fallback; dividerPx measured from `[data-part="split-divider"]` → `--pbui-space-4` token → `DEFAULT_DIVIDER_PX`; labels from views/app registry; slate in `useMemo` keyed on doc/rect/config), `ProposalCard`, `Thumbnail` (top-4 movers get ghost+trail; identity hue = reading-order index mod 7).
- `RebalanceDialog.module.css`: all colours are tokens or `color-mix(in srgb, token, token)` — the package's no-hex test forbids literals; seven identity hues derive from existing family tokens knocked back toward paper.
- `slate.ts`: `Proposal.beforeRects` (shared reference to the current geometry) so thumbnails can draw ghosts without a second computation.
- `createWorkbench.tsx` + `types.ts` + `index.ts`: `wb.Rebalance` bound component, `RebalanceProps`, and public exports for the whole rebalance engine (buildSlate/diagnose/config/adapter/measure) so products and agents can use the logic without the dialog.
- Tests: 4 component tests — chord opens the dialog and cards render with PICK + diagnosis; Apply commits the resize batch (root ratio 0.95 → less), arms Undo, Undo restores 0.95 exactly; verbs round-trip; healthy layout collapses to a recommended LEAVE AS IS.

### Why
- Mirroring the Launcher's listener/ownership/verb wiring keeps the second transient surface boring — every rule (focus ownership, surface-stack suppression, verb-as-door) already had a tested precedent one file away.
- Exporting the pure engine from the package index makes the agent door (describeWorkbench-style diagnosis) and the settings tile (Phase 5) trivial consumers.

### What worked
- Full workbench suite 165/165 and root pbui suite 174/174 green; workbench typecheck clean.
- The jsdom fallbacks (rect 1024×640, divider 10px) made the component tests deterministic with zero mocking — the same code path stories use.

### What didn't work
- `tsc` first run: `Node` type imported from `/client` (it lives on the protocol root), route-kind comparison failed against a STALE `@hyperslop-systems/pbui` dist (rebuild the root package after editing `src/chrome/*` — workspace links resolve against `dist/`), and `Button variant="plain"` does not exist (`bare | framed | raised`). All three fixed in one pass.
- Root `pnpm --filter @hyperslop-systems/pbui typecheck` fails on this branch in `src/presentation/actions/vocabulary.test.ts` (`Property 'reference' does not exist on type 'PresentationReference<Values>'`) — verified PRE-EXISTING by stashing my changes and re-running. Not addressed here; flagged for the branch owner.

### What I learned
- The package's hygiene tests actively shaped the component: no raw `<button>`/`<input>` (pbui atoms only), no colour literals anywhere including CSS modules (hence the color-mix identity palette — `color-mix(` is not on the forbidden-function list, and deriving hues from family tokens is arguably better than the lab's hex palette), and folder-per-component with a REQUIRED story.
- `plan()`'s shadow `resize` clamps to the fraction fallback ([0.1, 0.9]) when headless — fine for realistic repairs, but a repair ratio below 0.1 (very deep chains) would be clamped; noted as a Phase 4/6 check.

### What was tricky to build
- **Escape ownership.** The dialog must NOT call `useEscapeSurface` itself (Dialog registers; a second registration makes Dialog think it is not topmost and Escape dies — surfaces.ts invariant 1). The shortcut listener instead consults `useAnyEscapeSurface()` for its `dialogOpen` guard, exactly as the Launcher does.
- **Stable identity hues.** Hues must key on the CURRENT tree's reading order (not each proposal's), or a reorder-class proposal would recolor every tile and the ghost-pairing would lie. The thumbnail derives order once from the live document and indexes both fills and strokes off it.
- **Undo across recomputes.** `useDocument()` re-renders on apply, the slate rebuilds, and the selected card id may vanish (a repaired layout has different proposals). Selection falls back id → recommended → first; the undo ref holds the immutable pre-apply document (a reference, not a clone — protobuf documents are treated as immutable) and `store.replaceDocument` restores it.

### What warrants a second pair of eyes
- The `useMemo` dependency list for the slate (`doc, workspaceId, rect, config, workbench, tree`) — `tree` is derived from `doc` but included for the null-guard; a reviewer should confirm no re-render loop under ResizeObserver churn (rect is rounded to ints, which is the damping).
- `Undo` uses `store.replaceDocument`, which would also discard a concurrent mutation landing between apply and undo. Acceptable for a single-user dialog session; a product with server sync should review.
- The route table's `shift: false` on the launcher row means Mod+Shift+K can NEVER fall through to the launcher — intended, but it changes behaviour for anyone who was pressing Mod+Shift+K and getting the launcher (previously shiftKey was ignored). Flagged in review notes.

### What should be done in the future
- Phase 5: settings tile supplying `config` to `wb.Rebalance` + DocumentPayload persistence.
- Phase 4: structural generators; Phase 6: live preview on the Surface behind the dialog, aria-activedescendant for the listbox, and a status-bar diagnosis badge.
- Update design-doc/01 §4.1/§4.6 to record the keep-open-on-apply deviation (done in this step's docs pass? — no: deferred, tracked here).

### Code review instructions
- Start: `src/chrome/shortcutRouting.ts` (the table), then `components/RebalanceDialog/RebalanceDialog.tsx` top-to-bottom (wrapper → modal → card → thumbnail), then the small verbs/store diffs.
- Validate: `cd packages/pbui-workbench && ./node_modules/.bin/vitest run` (165) after `pnpm --include-workspace-root --filter @hyperslop-systems/pbui build`; root: `pnpm --include-workspace-root --filter @hyperslop-systems/pbui test` (174). Storybook: `pnpm --filter @hyperslop-systems/pbui-workbench storybook` → Workbench/RebalanceDialog/Broken.

### Technical details
- Chord: `Mod+Shift+K`; decision `{kind:"open-rebalance"}`; consumed by `WorkbenchRebalance`'s capture-phase window listener under the same workbench-ownership rule as the launcher.
- Headless fallbacks: rect 1024×640 when the root box is ≤8px; divider 10px when unmeasurable.

## Step 5: Phase 5 — Settings tile and config persistence

Took Phase 5 before Phase 4 (the guide marks 4–6 order-flexible; the settings tile is small
and completes the user-facing loop, while structural repairs are a separable engine
extension). The `RebalanceConfig` now persists as a `pbui.rebalance-config` DocumentPayload
inside the workbench document itself — `documentPut` on write, `normalizeConfig` on read, so
a missing, foreign, or stale-schema payload degrades to defaults field-by-field. The
`rebalance-settings` singleton tile edits it; the dialog reads the same payload when no
`config` prop is supplied. Two doors, one config, zero new storage mechanisms.

### Prompt Context

**User prompt (verbatim):** (see Step 2)

**Assistant interpretation:** Continue phase-by-phase implementation with commits, diary steps, and slips.

**Inferred user intent:** (see Step 2)

**Commit (code):** fb2db6d — "pbui-workbench: rebalance settings tile + config persistence (PBUI-REBALANCE-1 P5)"

### What I did
- `rebalance/configDocument.ts` (pure): `REBALANCE_CONFIG_DOC_ID/FORMAT/SCHEMA_VERSION`, `readRebalanceConfig` (null for absent/foreign; `normalizeConfig` otherwise), `rebalanceConfigMutation` (one idempotent `documentPut`; Struct bodies are `JsonObject`s, learned from `NotesApp`'s precedent in pbui-chat).
- `components/RebalanceSettings/` (folder, index, story, test, css module): the tile — profile buttons that seed `profileConfig(name)` while PRESERVING constraint fields (constraints describe the screen, not a repair posture), allow-flag `CheckboxRow`s, budget/weight `NumberField`s (local draft, commit on blur/Enter — one mutation per settled value, never per keystroke), generator toggles driven by the `GENERATORS` table. Any manual change flips profile to "custom". `rebalanceSettingsApp` descriptor: singleton, group WORKBENCH, `var(--pbui-tone-neutral)`.
- `RebalanceDialog.tsx`: modal resolves config as prop → persisted payload → balanced default.
- Package index: settings component/app + configDocument exports.
- Tests (6 new; 171 total): mutation round-trips through the REAL applier and back through `normalizeConfig` (deep-equal); `dispPx: null` (unbounded) survives the Struct round-trip; missing payload reads null; checkbox toggle writes the payload and flips profile to custom; profile button keeps constraints (minInlinePx 333 survives CAREFUL); and the dialog provably consumes the payload (persisted 40px floor turns a 0.9-skewed layout's diagnosis healthy where the 240px default would report violations).

### Why
- Persisting in the document (not localStorage) gives serialize/restore/multi-product/server sync for free and keeps the workbench's "the document is the state" discipline.
- Commit-on-blur mirrors SplitPane's commit-on-release: the persistence subscriber fires per commit, and a slider/keystroke stream would write storage sixty times a second (store.ts documents the failure).

### What worked
- Typecheck and all 171 tests green on the first run after one prop fix.
- The applier accepted the payload with zero protocol work — `documentPut` and the documents map existed exactly for this (their only prior caller was pbui-chat's NotesApp).

### What didn't work
- `Text` has no `muted` prop (it is `tone="faint"`) — caught by grepping the foundation component before typecheck even ran; fixed with a sed pass.

### What I learned
- `DocumentPayload.body` is generated as a plain `JsonObject` (protobuf-es Struct), so `JSON.parse(JSON.stringify(config))` is the whole serializer, and `null` is representable (the unbounded displacement cap needed that).
- The atoms constrain UI shape usefully: with no slider atom, number fields with blur-commit fell out as the natural (and mutation-frugal) design.

### What was tricky to build
- **Profile semantics.** A profile press must not clobber the user's screen constraints; `applyProfile` seeds from `profileConfig(name)` then copies the four constraint fields back. The test pins it (minInlinePx 333 survives CAREFUL).
- **The settings⇄dialog config seam.** The dialog's config resolution order (prop → payload → default) had to stay a pure derivation per render — no effect, no cached state — or a settings edit while the dialog is open would show a stale slate. Because the payload lives in the document and the modal already re-renders on `useDocument()`, editing settings while the dialog is open recomputes the slate for free.

### What warrants a second pair of eyes
- `NumberField` commit-on-blur discards invalid input silently (resets the draft). Reasonable, but a reviewer may prefer an `invalid` flag on the TextInput.
- The settings tile writes the FULL config each time (idempotent overwrite). Concurrent editors last-write-wins per field-set; fine locally, worth a thought for server-synced products.

### What should be done in the future
- Phase 4: structural generators (reshape/rebuild) + the structural-apply decision (WorkspaceSetTree vs clone-workspace stopgap).
- Phase 6 leftovers: live Surface preview, status-bar diagnosis badge, RELAX, aria-activedescendant on the card listbox.
- A "Rebalance settings" deep-link from the dialog header (`app.place rebalance-settings`) — trivial now, deferred to keep the dialog diff small.

### Code review instructions
- Start: `rebalance/configDocument.ts` (the contract), then `RebalanceSettings.tsx` (`applyProfile` and `NumberField`), then the three-line dialog resolution change.
- Validate: `cd packages/pbui-workbench && ./node_modules/.bin/vitest run` (171) and `../../node_modules/.bin/tsc -p tsconfig.json --noEmit`.

### Technical details
- Payload: `{ id: "rebalance-config", format: "pbui.rebalance-config", schema_version: 1, body: RebalanceConfig-as-JSON }` in `WorkbenchDocument.documents`.
- Config resolution in the dialog: `configProp ?? readRebalanceConfig(doc) ?? DEFAULT_REBALANCE_CONFIG`.

## Step 6: Phase 4 — Structural repairs and the WorkspaceSetTree mutation

The heavy phase: layouts whose propagated requirement exceeds the screen can now be fixed.
RESHAPE hill-climbs over local tree mutations (with REGROUP — wrapping a run of children in a
perpendicular sub-split — doing the real work of turning impossible strips into grids), and
REBUILD regenerates a target shape and seats the existing tiles by Hungarian minimum-cost
assignment. Both settle every candidate with PROJECT before scoring, per the textbook's
"single most important detail". Applying a structural result needed the protocol change the
guide recommended as Option B: a `WorkspaceSetTree` mutation, implemented in the TS and Go
appliers with parity fixtures, plus a `workspace.setTree` verb — so structural proposals ride
the same `plan`/`applyPlan` door as resize batches.

### Prompt Context

**User prompt (verbatim):** (see Step 2)

**Assistant interpretation:** Continue phase-by-phase implementation with commits, diary steps, and slips.

**Inferred user intent:** (see Step 2)

**Commit (code):** 686b923 — "protocol + pbui-workbench: WorkspaceSetTree mutation and structural rebalance proposals (PBUI-REBALANCE-1 P4)"

### What I did
- Proto: `WorkspaceSetTree { workspace_id, root_placement }`, Mutation oneof field 16; `buf generate` regenerated Go + TS.
- TS applier (`apply.ts`): `workspaceSetTree` case (rootPlacement required → `invalid_mutation`; workspace exists → `unknown_workspace`; tree cloned in). Go applier (`mutation.go`): identical semantics. Parity fixtures `workspace-set-tree.json` + `reject-workspace-set-tree-unknown-workspace.json` — both suites green (TS 46; Go full package incl. the fixture corpus, forced `-count=1`).
- Verb `workspace.setTree` end-to-end: union, `setWorkspaceTree` factory, validation, description ("replace this workspace's tile arrangement"), handler (`store.mutate` one mutation), dispatch.
- `rebalance/structural.ts`: `normalizeAnalysis` (flatten/collapse for post-mutation trees, chains cleared), `structuralMutationsOf` + `applyStructuralMutation` (transpose/rotate/reverse/swap/regroup), `scoreTree` (lab weights 10/1per100/0.6/1per1000), `algoReshape` (settle-then-score greedy, minGain stop), `REBUILD_TARGETS` (grid/master/columns/rows/bsp/dwindle), `hungarian` (O(n³) potentials), `algoRebuild` (cost = centre distance + 0.25·size; DFS-order savings traced), `emitBinary` (analysis→protocol: leaves KEEP placement ids + viewIds, splits minted via newId, right-leaning chains with pixel-space ratios clamped to the server's [0.05, 0.95] band from validate.go).
- Slate: `GeneratorSpec` became a weights|structural union; six structural generators (reshape-1/4, rebuild-grid/master/columns/dwindle); structural results apply as `{kind:"set-tree", tree}` when tier > 0; whyLine regex learned "assignment|accept". Profiles updated (balanced += reshapes; tidy += reshape-4 + rebuilds; anything += all).
- Dialog: set-tree applies as a one-verb plan (`workspace.setTree` with the modal's workspaceId); Undo unchanged.
- Tests (14 new; 185 workbench total): hungarian §10.2 fixture ([1,0,2], Σ5); transpose→flatten to Row(7); regroup preserves pane count; SKINNY COL reshape → 0 violations with "regroup" in the trace; WIDE ROW 9 reshape → 0 violations; search never mutates its input (JSON snapshot); rebuild-grid → 0 violations + identity preserved + assignment traced; emitBinary render-parity property (clamp-aware: clamped rounds skipped, >10 exact rounds asserted at 1e-6) + id/view preservation + clamp band; slate: only structural cards reach 0 viol on SKINNY COL and one wins PICK with `set-tree`; CAREFUL greys them with reasons and never recommends; grid-rebuilt-as-grid measures tier 0 and merges into LEAVE AS IS; dialog: structural Apply replaces the workspace tree wholesale and Undo restores the exact prior document reference.
- Design-doc addendum recording all build-time deviations (pixel-share weights, keep-open-on-apply, Option B, ratio band, open items).

### Why
- Option B over the clone-workspace stopgap: the workspace id survives (nothing keyed on it breaks), the mutation is generally useful, and the parity loop turned out to be cheap because the corpus infrastructure already existed on both sides.
- Emission clamps rather than erroring because a clamped ratio still renders close and VALIDATES server-side; the alternative (reject the proposal) throws away a repair over a 2% geometric compromise.

### What worked
- Both appliers accepted the new mutation with matching fixture behaviour on the first run; lefthook's pre-commit gauntlet (full go test + golangci-lint + logcopter + glazed-lint) passed clean on commit.
- SKINNY COL's §9.3 story reproduced: the hill-climb's first accepted move is a regroup that erases all six violations.

### What didn't work
- The emitBinary render-parity property failed on round 4 (12.1px on pane p-r1.h): deeply skewed random trees produce flattened pixel shares below 0.05, the server clamp bit, and the test had wrongly assumed "random ratios stay inside the band". Fixed by detecting clamped emissions and excluding them from the exactness assertion (while asserting >10 unclamped rounds so the property still has teeth).
- Editor diagnostics flagged `go.work requires go >= 1.26.6 (running go 1.25.5)` — gopls tooling only; the shell go is 1.26.6 and all Go commands pass. Not addressed.

### What I learned
- `pkg/workbench`'s global Validate (not the per-mutation applier) owns leaf-references-view and the [0.05, 0.95] ratio band; the parity corpus deliberately tests only per-mutation semantics ("which the TypeScript client does not mirror" — its own comment). So the TS `workspaceSetTree` case stays minimal, and CLIENTS must emit valid trees — which `emitBinary` guarantees by construction (existing leaves, minted split ids, clamped ratios).
- Hill-climbing needs no backtracking on the textbook's test set: WIDE ROW 9 (structurally the worst weight-only case) reaches zero violations within four greedy rounds.

### What was tricky to build
- **Keeping identity through regeneration.** Tiers, thumbnails, and ghost-pairing all key on placement ids; REBUILD builds over placeholder slots and seats REAL panes by assignment, and emitBinary re-uses pane ids for leaves while minting split ids — get either wrong and classify() reports tier 6 (visible set changed) for a pure rearrangement. The identity-preservation test pins it.
- **The GeneratorSpec union.** Weight strategies return weights for a driver to assign; structural engines own their whole run and hand back `ctx.tree`. Modeling that as a discriminated union kept buildSlate's loop to one `if` instead of a second slate path.

### What warrants a second pair of eyes
- `emitBinary`'s clamp: a proposal whose preview needed a 0.02 ratio applies at 0.05 — preview and applied geometry can differ by up to ~3% of a split's extent in that (rare, already-degenerate) case. The dialog's post-apply status does not currently call it out.
- `scoreTree`'s weights are the lab's constants, untuned for pbui's 240×160 defaults; RESHAPE acceptance choices ride on them.
- The Go global Validate enforces tree depth/node-count limits (`Limits`); a pathological reshape output is bounded by input size so it cannot exceed them, but a reviewer should confirm no product feeds giant workspaces.

### What should be done in the future
- Phase 6 (open tasks): FOLD→overflow-workspace card, RELAX strategy, live Surface preview, status-bar diagnosis badge, settings deep-link, aria-activedescendant; consider surfacing "ratio was clamped" in the apply status line.
- Consider exposing reshape maxMoves/minGain and rebuild master/dwindle ratios in the settings tile.

### Code review instructions
- Start with the protocol slice: proto diff → `apply.ts` case → `mutation.go` case → the two fixtures. Then `structural.ts` top-to-bottom against sources/repair-lab-2.html (`mutationsOf`/`applyMutation`/`algoMutate`/`TARGETS`/`hungarian`/`regenerate`) for port fidelity; `emitBinary` is the only part with no lab counterpart — read its module comment plus the three emit tests.
- Validate: `cd packages/pbui-workbench && ./node_modules/.bin/vitest run` (185); `cd packages/workbench-protocol && ./node_modules/.bin/vitest run` (46); `GOWORK=off go test ./pkg/workbench -count=1`; `buf lint`.

### Technical details
- Mutation: `workspaceSetTree { workspaceId, rootPlacement }`; errors `invalid_mutation` / `unknown_workspace`; views no longer placed are NOT deleted (rebalance never drops views by construction).
- Emission ratio at each chain step: `px[i] / (pairExtent)` where pairExtent = remaining extent − divider, clamped to [0.05, 0.95].

## Step 7: The divider-thickness bug and the Rebalance Lab

The user exercised the demo with eight tiles and sent a screenshot showing nonsense numbers
("needs 1996×1676 · only 6 tiles fit") and thumbnails that looked nothing like the layout.
Root cause: `measureDividerPx` read `.width` off the FIRST rendered `[data-part=
"split-divider"]` — but a COLUMN divider is a full-width track, so a ~700px span was measured
as the gap thickness. Every propagation number inflated, capacity collapsed, and
`layoutAnalysis` drew panes clumped between giant phantom gaps. Fix: the track's thickness is
its SMALLER dimension (`Math.min(width, height)`), regression-tested with both orientations.

The user also asked for a standalone test workspace with the repair lab's broken-layout
generators. Built `Workbench/RebalanceLab` — a story harness porting repair-lab-2's LAYOUTS
panel: nine presets (HEALTHY, SLIVER, FOUR DONORS, COMPOUND, SKINNY COL, WIDE ROW 9, MASTER
SWARM, MIXED MESS, TOO MANY 5×4) built as mass-ratio `LayoutSpec` chains, plus seeded RANDOM
skewed trees, with the dialog, launcher, and settings tile all mounted.

### Prompt Context

**User prompt (verbatim):** "The rebalance part is weird. Can you actually make a standalone workspace for testing that has similar \"broken layout controls generation\" as the attached demo lab? [screenshot] Here also I think the preview is kind of broken."

**Assistant interpretation:** Diagnose why the dialog's numbers/thumbnails looked wrong in the 8-tile demo, and build a dedicated test workspace with preset broken-layout generators like repair-lab-2's LAYOUTS panel.

**Inferred user intent:** Make the feature trustworthy and easy to exercise against every failure mode without hand-building degenerate layouts.

**Commit (code):** f91885a — "pbui-workbench: fix divider thickness measurement + rebalance lab story (PBUI-REBALANCE-1)"

### What I did
- Fixed `measureDividerPx` (min dimension = track thickness); exported it and added a three-case regression test (column divider 700×10 → 10, row divider 10×500 → 10, unmeasurable → default).
- `src/stories/RebalanceLab.stories.tsx`: the lab harness — `chain()` mass-ratio LayoutSpec builder, `grid()`, seeded `randomSpec` with skew, preset buttons, RANDOM reroll, REBALANCE button + Ctrl+Shift+K, per-preset note line. Workbench recreated per pick (nonce-keyed useMemo) so every preset starts clean.
- Browser-verified end-to-end: SKINNY COL diagnosis now reads "needs 490×1010 · exceeds the workspace" with thumbnails matching the real layout; RESHAPE (+1 agree) wears PICK, applies to zero violations ("Applied RESHAPE (one move) — structure changed, 7/7 tiles, 1916px"), workspace visibly regrouped; the demo app's diagnosis dropped from 1996×1676 to a sane 990×670; settings tile placed via Ctrl+K renders and edits.

### Why
- Stories are exempt from the folder-per-component and raw-controls rules, so the harness could stay one file; it is served by the already-running Storybook, which is what "standalone test workspace" needs in practice.

### What worked
- One-line root cause; all 186 workbench tests green after the fix; both broken symptoms (numbers and thumbnails) resolved by the same change, confirming the diagnosis.

### What didn't work
- First regression-test draft passed a bare object to `measureDividerPx`; jsdom's `getComputedStyle` rejects non-Elements (`TypeError: The provided value is not of type 'Element'`). Rewrote with real DOM elements and a stubbed `getBoundingClientRect`.

### What I learned
- `verbs.ts`'s own `dividerSize` already avoided this bug by taking `row ? width : height` — the dialog's copy diverged from the precedent it was copying. When duplicating a measurement helper, duplicate its orientation handling too (or export and share it — future cleanup).

### What was tricky to build
- Nothing structurally; the bug was subtle only because BOTH symptoms (inflated needs, clumped thumbnails) looked like adapter math errors while the adapter was exact — the corrupted input was upstream. The lab story now makes this class of regression visible in seconds.

### What warrants a second pair of eyes
- `measureDividerPx` still measures only the FIRST divider; a product with mixed divider thicknesses (none exist today) would need per-split measurement like `ratioBounds` does.
- Consider sharing one divider-measurement helper between `verbs.ts` and the dialog instead of two copies.

### What should be done in the future
- Fold the lab story's preset builders into shared test fixtures if a second consumer appears; remaining P6 items unchanged.

### Code review instructions
- Diff of `RebalanceDialog.tsx` (`measureDividerPx`) + its new test block; then `src/stories/RebalanceLab.stories.tsx`.
- Validate: `./node_modules/.bin/vitest run` (186) and open `Workbench/RebalanceLab` in Storybook: SKINNY COL → REBALANCE → the RESHAPE card should read "all fit" and apply cleanly.

## Step 8: Pluggable config storage (RebalanceConfigStore)

The user asked where settings are stored and required that the answer be the importing
product's choice. Until now the settings tile hard-wrote the `pbui.rebalance-config`
DocumentPayload. Extracted the storage into a two-method store contract —
`useConfig(host)` (a React hook, so any backend can re-render the dialog/tile on change) and
`save(host, config)` — with the document-payload behaviour as the default implementation and
a ready-made localStorage store (per-browser, cross-tab via the `storage` event) as the
shipped alternative.

### Prompt Context

**User prompt (verbatim):** "where are the settings stored?" / "(that should be configurable by the app importing the package)"

**Assistant interpretation:** Answer the storage question and turn the storage location into a product-injectable seam.

**Inferred user intent:** Products embedding pbui-workbench have their own settings backends; the package must not dictate persistence.

**Commit (code):** 748273d — "pbui-workbench: pluggable RebalanceConfigStore — the importing product chooses where settings live (PBUI-REBALANCE-1)"

### What I did
- `rebalance/configStore.ts`: `RebalanceConfigHost` (the structural slice of `Workbench` stores need — avoids a types.ts import cycle), `RebalanceConfigStore` contract, `documentRebalanceConfigStore` (default; unchanged behaviour), `createLocalStorageRebalanceConfigStore(key)` (cached snapshot keyed by raw string so `useSyncExternalStore` never loops; storage-event subscription; corrupt/blocked storage degrades to defaults). Flagged in its module comment as the ONE React-aware module under `rebalance/`.
- `createRebalanceSettingsApp({ store, id, title, tone, group, blurb })` factory; `rebalanceSettingsApp` stays as the default instance. `RebalanceSettings` takes `store` as a prop.
- `RebalanceProps.configStore` on the dialog; resolution: `config` prop (fully controlled) → store hook (called unconditionally per rules-of-hooks; store identity must stay stable, documented) → the default document store.
- Test: an in-memory store injected into both the tile factory and `<wb.Rebalance configStore>` — a checkbox toggle lands in the custom store, `document.documents` stays empty, and the dialog's diagnosis proves it read the custom config. 187 tests green; dist rebuilt.

### Why
- A hook-shaped `useConfig` is the minimal contract that keeps reactivity working for arbitrary backends (Redux selector, server subscription, localStorage) without the package prescribing any of them.

### What worked
- Everything on the first run except a forgotten re-export (`index.ts` for the component folder) — one-line fix.

### What didn't work
- N/A beyond the re-export typecheck error.

### What I learned
- The demo already persists the whole document to localStorage on every mutation (`workbench.ts` `onMutate → persistDocument`), so with the DEFAULT store the demo's rebalance settings were already durable — the seam is about products that want a different home, not about making persistence work.

### What was tricky to build
- **Hook discipline at the seam.** The dialog must call the store hook unconditionally even when a `config` prop overrides it; and `useSyncExternalStore` needs a cached snapshot (fresh objects loop the render) — cached by the raw localStorage string.

### What warrants a second pair of eyes
- The contract requires stable store identity across renders (rules of hooks); it is documented on both `RebalanceProps.configStore` and the interface, but nothing enforces it.
- `createLocalStorageRebalanceConfigStore.save` notifies listeners even when `setItem` threw (the snapshot then re-reads the old value — honest, but a reviewer may prefer surfacing the failure).

### What should be done in the future
- If a product wants per-workspace configs, the store contract already permits it (read the workspace id off the host's state); document an example when the need appears.

### Code review instructions
- `rebalance/configStore.ts` (the contract + both implementations), then the small diffs in `RebalanceSettings.tsx` (factory) and `RebalanceDialog.tsx` (resolution order), then the in-memory-store test.
- Validate: `cd packages/pbui-workbench && ./node_modules/.bin/vitest run` (187).

## Step 9: Click-to-commit gesture

Interaction change requested by the user: a plain click on a proposal card now APPLIES it and
CLOSES the dialog — the card is the choice, not a selection step. Shift+click applies but
keeps the dialog open (the inspect/compare/undo loop from the lab), and the footer gains an
explicit "Apply + close" primary button next to the stay-open "Apply". Clicking LEAVE AS IS
just closes; double-click accept was removed as subsumed.

### Prompt Context

**User prompt (verbatim):** "per default, clicking on a layout not only focuses it, but also applies it and closes the modal. It's when you shift click that it stays open. And add a button \"apply + close\" which applies and closes the modal."

**Assistant interpretation:** Invert the default card gesture from select-then-apply to apply-and-dismiss, with Shift as the hold-open modifier, plus an explicit Apply + close button.

**Inferred user intent:** One-gesture repair: the common case is "that one, do it" — the compare/undo workflow is the exception and earns the modifier.

**Commit (code):** (see git log — card click applies + closes)

### What I did
- `apply(proposal, { close })`: close-path dismisses via `verbs.closeRebalance()` after a successful commit (refusal/staleness keeps it open with the status line); `none`-kind proposals close without mutating.
- `ProposalCard.onActivate(event)` replaces onSelect/onApply; `close: !event.shiftKey`. Footer: "Apply + close" (raised), "Apply" (framed, stay-open), "Undo". Hint + card tooltips updated.
- Tests: plain click applies and closes (ratio changed, `rebalanceOpen` false); LEAVE AS IS click closes untouched; structural test rewritten to Shift+click (applies, stays open, Undo restores). 189 green; verified live in the lab story (click → dialog gone).

### What warrants a second pair of eyes
- Apply-and-close skips arming Undo (the modal unmounts with the ref) — deliberate, matches the gesture's finality; Shift+click remains the undoable path. Worth confirming this trade-off is wanted.
- Out-of-policy (greyed) cards also commit on click — the gate constrains the recommendation, not the user's explicit hand (lab precedent). Flag if greyed cards should refuse clicks instead.

### What should be done in the future
- N/A beyond the open P6 items.

### Code review instructions
- `RebalanceDialog.tsx` diff (`apply` options, footer, `onActivate`); the three gesture tests in `RebalanceDialog.test.tsx`.
- Validate: `cd packages/pbui-workbench && ./node_modules/.bin/vitest run` (189).

## Step 10: Alt-drag replaces the target tile

Added a third drag-drop outcome to the family chrome: holding Alt while dragging a tile turns
the WHOLE target into one drop zone, and releasing makes the target show the dragged tile's
view while the source tile closes — the layout loses one tile, the target's rectangle
survives, and the target's old view is deleted when nothing else places it. Built bottom-up
in three commits: the protocol mutation recipe, the chrome gesture, the workbench verb and
wiring — each layer tested before the next consumed it.

### Prompt Context

**User prompt (verbatim):** "add Alt when dragging to fully replace the target tile. commit at appropriate intervals and keep a detailed diary as you work (using the diary format from the skill)"

**Assistant interpretation:** A new drag modifier: Alt-drop fully replaces the target tile (target keeps its spot, shows the dragged app, source closes), implemented across chrome + protocol + workbench with layered commits and a diary step.

**Inferred user intent:** Complete the drag vocabulary — swap (centre), dock (edge), and now replace (Alt) — so rearranging never needs a close-then-drag two-step.

**Commit (code):** 6b0963e (protocol builder) · 4805c0f (chrome gesture) · 32ee733 (workbench verb + wiring)

### What I did
- `workbench-protocol/client/builders.ts` — `replacePlacement(doc, sourceId, targetId)`: `placementReplace` on the target, `placementClose` on the source (the source view has its NEW placement before the old one closes — dockPlacement's anti-GC ordering), `viewDelete` for the target's old view iff `placementCount === 1`. Linked twins (same view both sides) collapse to `closePlacement(source)`. Two client tests incl. the twins case (48 green).
- `src/chrome/useTileDrag.ts` — `DragZone` gains `"replace"`; optional `onReplace` callback gates the whole mode (products without it see zero behaviour change). Alt is LIVE state: the hook keeps the last pointer position and reclassifies on `pointermove` (whose own `altKey` is authoritative) AND on window `keydown`/`keyup` of Alt (preventDefault so the browser menu never steals focus mid-drag); listeners torn down through the existing single-exit `finish`. `DropZoneOverlay` gets full-rect geometry for `replace`, a `replaceLabel` default, and a `data-zone` attribute for product styling; grip tooltip mentions Alt. Three lifecycle tests: Alt near an edge classifies replace (not dock) and commits `onReplace`; pressing/releasing Alt mid-hover flips center↔replace with NO pointer move; without `onReplace` the modifier is inert (177 root tests green).
- `pbui-workbench` — `tile.replaceWith {source, target}` verb end-to-end (factory `workbenchVerbs.replaceWith`, validation, description "replace that tile with this one", handler over `replacePlacement`, dispatch); the handler moves `activePlacementId` from the closed source to the target so the active id never points at a dead tile. `Tile` supplies `onReplace` to `useTileDrag`; `replaceLabel` threads `SurfaceProps → Tile → TileFrame`. Three workbench tests: full replace (view moved, orphan deleted, active followed), self-drop/missing-placement refusals, the data door (192 green).
- Live browser check in the lab story: synthetic Alt-drag over Storybook took 3 tiles to 2 with the target showing the dragged view.

### Why
- Bottom-up layering means each commit is independently green and reviewable, and the chrome stays document-model-agnostic (DR-U3): it reports a gesture; only the workbench knows what "replace" means in mutations.
- Reusing `placementReplace`/`placementClose`/`viewDelete` means NO protocol change and no new applier semantics — the gesture is pure composition.

### What worked
- Every layer green on its first full run (one stale-dist typecheck hiccup aside); the existing single-exit `finish` teardown absorbed the two new key listeners without new lifecycle cases.

### What didn't work
- `tsc` failed with `no exported member 'replacePlacement'` until the protocol dist was rebuilt — the recurring workspace-links-resolve-against-dist lesson (steps 4, 7).
- In the live-browser probe the overlay read back `null`: the synchronous DOM read ran before React re-rendered the drop zone. The commit path itself proved out (tile count 3 → 2); overlay classification is covered by the chrome unit test instead.

### What I learned
- The lab's drag machinery had no modifier concept at all; threading one through cleanly required treating the modifier as reclassification INPUT (position + alt → zone) rather than a separate mode flag on the state — that is what makes mid-hover Alt presses work without pointer movement.

### What was tricky to build
- **Alt without movement.** `pointermove` carries `altKey`, but a user hovering still and tapping Alt generates no pointer event — so the hook stores `lastPoint` and reclassifies from key events too, while letting each pointer event's own `altKey` overwrite the flag so the two signal sources cannot disagree for long.
- **Who dies, who survives.** Replace must keep the TARGET's placement id (its rectangle, its focus identity) while transplanting the SOURCE's view — the inverse instinct (move the source placement) would rebuild geometry for no reason. The orphan-view rule then falls out of `placementCount` on the pre-mutation document.

### What warrants a second pair of eyes
- `preventDefault()` on window-level Alt keydown during a drag is deliberate (browser menu steal) but global for the drag's duration — confirm no product needs Alt+something else mid-drag.
- Cross-workspace replace is theoretically expressible via the verb (drag can't produce it; the registry only holds rendered tiles). The applier would refuse when the source is its workspace's last tile; otherwise it works. Flag if it should be explicitly refused instead.
- The replace overlay label defaults to prose with ⌥ — macOS reads Alt as Option; wording may want per-platform treatment.

### What should be done in the future
- datalab-ui/agentlogic/turboproof consume the chrome kit: they get the mode only when they pass `onReplace` — a one-line adoption each, deliberately left to their owners.
- A `data-zone="replace"` style (e.g. danger-tinted overlay) in chrome.css would make the destructive-ish outcome visually distinct; deferred as product styling.

### Code review instructions
- Read in commit order: `replacePlacement` + its two client tests; `useTileDrag.ts` diff (classify/altChange/finish) + the three Alt tests; `verbs.ts` replaceWith handler + the three workbench tests; then the mechanical label threading.
- Validate: `cd packages/workbench-protocol && ./node_modules/.bin/vitest run` (48) · root `pnpm --include-workspace-root --filter @hyperslop-systems/pbui test` (177) · `cd packages/pbui-workbench && ./node_modules/.bin/vitest run` (192). By hand: lab story → drag a grip over a tile, tap Alt — the overlay flips to "⌥ replace this tile…" and covers the whole rect; release.

### Technical details
- Mutation recipe: `[placementReplace(target ← sourceView), placementClose(source), viewDelete(oldTargetView)?]`; twins → `closePlacement(source)`.
- Zone precedence on drop: `replace` (Alt + onReplace) → `center`/edges as before.
