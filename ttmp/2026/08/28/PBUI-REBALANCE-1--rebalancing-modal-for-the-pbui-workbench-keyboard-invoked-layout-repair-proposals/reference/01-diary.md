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
