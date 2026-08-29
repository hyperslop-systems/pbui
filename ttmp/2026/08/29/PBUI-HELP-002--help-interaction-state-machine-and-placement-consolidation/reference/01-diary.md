---
Title: Diary
Ticket: PBUI-HELP-002
Status: active
Topics:
    - frontend
    - pbui
    - design
    - architecture
DocType: reference
Intent: long-term
Owners: []
RelatedFiles:
    - Path: repo://src/presentation/createPbui.tsx
      Note: Runtime rebuilt as dispatch-only adapter (commit 60717c2)
    - Path: repo://src/presentation/help/machine.test.ts
      Note: Table tests + world-model fuzz harness (commit 1814842)
    - Path: repo://src/presentation/help/machine.ts
      Note: The pure surface machine (commit 1814842)
    - Path: repo://src/presentation/help/place.ts
      Note: Pure placement geometry (commit 219c05d)
ExternalSources:
    - https://github.com/hyperslop-systems/pbui/pull/20
Summary: Implementation diary for the help surface state machine consolidation.
LastUpdated: 2026-08-29T19:10:00-04:00
WhatFor: Record the formalization and rebuild of the help hover/close/placement behavior so reviewers can follow the model and its verification.
WhenToUse: Read when reviewing PBUI-HELP-002 or continuing the machine work.
---


# Diary

## Goal

Capture the consolidation of the PBUI contextual-help surface behavior — scattered across six event-handler locations and patched through four PR #20 review rounds — into one pure, fuzz-tested state machine (`helpSurfaceStep`) plus a pure placement function (`placeHelpCard`), absorbing the two open review findings structurally.

## Step 1: Ticket, formal design doc, reMarkable

Created PBUI-HELP-002 with five tasks, wrote the intern guide (design-doc/01) end to end — system context, the seven-findings evidence table, the full formal model (3 surface states × 10-event alphabet, transition table, mermaid state diagram), placement geometry rules, five invariants, the plausible-sequence fuzz harness design, runtime wiring map, file/test/phase plans — and uploaded it to reMarkable.

### Prompt Context

**User prompt (verbatim):** "Create a new docmgr ticket and Create  a detailed analysis / design / implementation guide that is for a new intern, explaining all the parts of the system needed to understand what it is, with prose paragraphs and bullet point sand pseudocode and diagrams and api references and file references. It should be very clear and technical. Store in the ticket and the nupload to remarkable.
 to address these issues and do consolidation based around sound printciples. 

Then implement."

**Assistant interpretation:** Open PBUI-HELP-002; write an intern-grade design doc formalizing the help hover/close/placement behavior (the "step back" agreed in the preceding discussion) with prose, bullets, pseudocode, diagrams, API and file references; store it in the ticket; upload to reMarkable; then implement the consolidation.

**Inferred user intent:** Stop the drip of review-round point patches by making the interaction model explicit, verified, and teachable — then rebuild on it.

### What I did
- `docmgr ticket create PBUI-HELP-002`, five tasks (jbo1, 698v, ewpw, 5cge, 555f), design doc + this diary via `docmgr doc add`.
- Wrote design-doc/01 (~13 sections): the transition table in §4.5 is the core artifact — both open PR #20 round-4 findings appear as single cells (`menu-opened` from `armed`; placement is §5 and out of the table by design).
- `remarquee upload bundle … --remote-dir /ai/2026/08/29/PBUI-HELP-002` → "OK: uploaded PBUI-HELP-002 Help Surface State Machine.pdf".
- Printed the plan slip (5 phases) and the P1 split.

### Why
- The doc IS the spec the tests will encode: table tests named after cells, a fuzz harness asserting I1–I4 per step, placement containment as a property. Review then targets the model, not interleavings.

### What worked
- The seven prior findings mapped cleanly onto four invariants — nothing needed a special case, which is decent evidence the model is the right size.

### What didn't work
- N/A this step.

### What was tricky to build
- **Keeping the machine command-free.** Early sketches had a command vocabulary (`armTimer`, `show`, `hide`); realizing resolution is synchronous-and-pure let `deps.resolve` move INTO the step function (house precedent: `matchContext` takes its predicate map), and the single timer became effects-as-state-sync — `armed` ⟹ timer running — leaving `step` as just `(state, event, deps) → state`.

### What warrants a second pair of eyes
- §4.5's `focus` row allows re-resolving on an already-open anchor (fresh facts on refocus) — confirm that's wanted rather than a stay-put.
- The decision to keep blur from disarming a pointer arm (current code cancels; the table deliberately doesn't) — documented in the table's blur row.

### What should be done in the future
- §13 records the deferred items: close-on-scroll, click-ladder and accept-flow machines, transient-surface protocol convergence, datalab shortcut table validation.

### Code review instructions
- Read design-doc/01 §§4–7 (model), then §8 (wiring) against `createPbui.tsx` as it is today.

### Technical details
- reMarkable path: `/ai/2026/08/29/PBUI-HELP-002/PBUI-HELP-002 Help Surface State Machine.pdf`.

## Step 2: P2 — the pure machine and its fuzz harness

Implemented `helpSurfaceStep` exactly as specified — three surface states, ten-event alphabet, `menuOpen` input, deps-injected lazy resolution — with 13 table-cell tests and the world-model fuzz harness. Everything passed on the first full run.

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Assistant interpretation:** Phase 2 of the spec: the machine, table tests, and the fuzzed invariants, green before any runtime change.

**Inferred user intent:** Prove the model before betting the runtime on it.

**Commit (code):** 1814842 — "PBUI-HELP-002: pure help surface machine + fuzzed invariants (P2)"

### What I did
- `src/presentation/help/machine.ts` (~230 lines): state/event/deps types, `initialHelpSurfaceState`, `helpSurfaceStep` with referential no-ops for unchanged states.
- `machine.test.ts`: one test per non-trivial table cell (including the PR #20 round-4 timer cell: `enter → menu-opened → timer-fired` stays idle), plus the fuzz — 400 seeded sequences × 60 steps (~24k transitions/run), mulberry32 PRNG, world model with 4 anchors.
- Later in P4 added referential no-op guards to `menu-opened`/`menu-closed` so the provider's mirror effect cannot cause render churn.

### Why
- The fuzz harness is the reviewer's job automated: only physically plausible sequences (compound gestures — a focus move dispatches blur first; menu open moves focus; unmount fires neither leave nor blur, which is exactly the round-3 bug shape), invariants I1–I4 asserted after every single step, failing trails printed as ready-made regressions.

### What worked
- The machine passed the fuzz on the first run — the table was already consistent, which is what writing the spec first buys.

### What didn't work
- N/A this step.

### What was tricky to build
- **Faithful event generation.** A naive generator emits impossible sequences (focus at B while A never blurred) and then either misses real bugs or reports fake ones. The world model routes all pointer/focus movement through `movePointer`/`moveFocus` helpers that emit the browser's actual event pairs, and menu close optionally emits a `restoring: true` focus — the exact shape of the round-2 findings.

### What warrants a second pair of eyes
- One deliberate spec deviation, synced back into the doc's table: `pointer-leave` closes only pointer-triggered cards; a focus-opened card is governed by blur (I2), not by a pointer that may never have been over it.

### What should be done in the future
- If a finding ever survives the fuzz, extend the WORLD first, then the table.

### Code review instructions
- Read `machine.ts` against the intern guide §4.5; run `pnpm vitest run src/presentation/help/machine.test.ts`.

### Technical details
- I4 (laziness) is asserted by counting `deps.resolve` calls per step and requiring the event be `timer-fired` or `focus` whenever the count moved.

## Step 3: P3 — placement geometry

`placeHelpCard` in `src/presentation/help/place.ts`: flush-below by preference, flip-above when it wins, `HELP_MIN_CARD` scrolling sliver at the pathological bottom, horizontal clamp. Rule examples plus a 2000-case containment property (I5).

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Assistant interpretation:** Phase 3: the pure geometry that replaces the flat clamps.

**Inferred user intent:** Fix the viewport-overflow review finding properly, not with a third clamp tweak.

**Commit (code):** 219c05d — "PBUI-HELP-002: pure placement geometry (P3)"

### What I did
- `place.ts` (rules of intern guide §5), `place.test.ts` (4 rule examples + seeded property: card inside viewport, flush edge whenever adjacency is possible).

### Why / What worked
- Property passed over 2000 random viewport/anchor/card combinations on the first run after one syntax fix.

### What didn't work
- Wrote `rng(0xp1ace)` — not a hex literal at all (`TS1124`-adjacent nonsense); replaced with `0x91ace`.

### What was tricky to build
- Stating when flushness may be violated: only the pathological bottom-anchor case trades adjacency for reachability, and the property encodes exactly that carve-out (`side === "below" && maxHeight > HELP_MIN_CARD ⟹ top === anchor.bottom`).

### What warrants a second pair of eyes
- The `MIN_CARD = 48` floor means the card can overlap its anchor in the extreme case — reachability beats adjacency there; confirm visually.

### What should be done in the future
- N/A.

### Code review instructions
- `place.ts` is 70 lines; the property test's failure label prints the full case for reproduction.

### Technical details
- `HELP_VIEWPORT_MARGIN = 8` applies to viewport edges only, never between anchor and card (flushness is load-bearing).

## Step 4: P4/P5 — runtime on the machine; PR #20 round 4 closed

Rebuilt `createPbui`'s help runtime as a dispatch-only adapter over the machine, with one provider-owned timer synced to `armed`, a menu mirror effect, and layout-effect placement. All 15 pre-existing runtime help tests passed unchanged; added the two round-4 regressions. Replied on and resolved both round-4 threads, requested a fresh Codex review with a note pointing at the machine.

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Assistant interpretation:** Phases 4–5: integrate, keep the external contract, absorb and close the open review findings.

**Inferred user intent:** The consolidation actually shipping, not sitting beside the old code.

**Commit (code):** 60717c2 — "PBUI-HELP-002: runtime rebuilt on the machine (P4)"

### What I did
- Context API: `openHelp`/`closeHelp` → one `helpDispatch(event)`; `help` is now a view derived from the machine's `open` state inside the value memo.
- Provider: `helpDepsRef` (current environment flows into the pure step), `useState` + stable dispatch, timer effect synced to `armed` (cleanup = disarm), menu mirror `useEffect` on `menu !== null` — every menu-closing path (`closeMenu`, `perform`, `performAction`, `accept`) covered without touching any of them.
- Presentation: per-instance timer machinery deleted; the four handlers classify (`relatedTarget` → `into`, modality flags stamped) and dispatch; unmount cleanup dispatches `unmounted`.
- ContextHelp: dispatches `escape`/`card-leave`; positions via `placeHelpCard` in a pre-paint `useLayoutEffect` (renders at 0,0, never visibly).
- Machine gained referential no-op guards on the menu events so the mirror can fire idempotently.
- New tests: armed-timer-over-menu (enter → contextmenu inside the window → advance 1000ms → no tooltip, zero resolves) and a placement smoke (`data-side` stamped, maxHeight set).
- Gates: core 271 + typecheck + build; datalab 536 + 1 pre-existing baseline; pushed.
- Replied with fixing commits on threads 3887884619/3887884621, resolved both (isResolved true), posted `@codex review` with a consolidation note (issuecomment-5465445133). Checked tasks 5cge and 555f.

### Why
- §3's principles: policy is data; one owner per fact (500 grid cells previously meant 500 potential timers for a domain with exactly one armed state); effects are state sync.

### What worked
- **The 15 pre-existing runtime tests passed unchanged on the first run after the rewire.** That was the phase's definition of success: same external contract, different engine.

### What didn't work
- One missing `useLayoutEffect` import (TS2304), caught by typecheck immediately.

### What was tricky to build
- **The environment-to-machine seam.** `deps.resolve` must see the CURRENT environment, but the dispatch callback must stay stable. A `helpDepsRef` reassigned every render gives the pure step fresh deps without changing dispatch identity — the moral equivalent of how `useReducer` handles changing reducers, made explicit.
- **Menu mirroring as an effect, not instrumentation.** Dispatching `menu-opened` inside `openMenu` would have missed `perform`/`performAction`/`accept` closing the menu; mirroring `menu !== null` in an effect covers every path, at the cost of the machine needing idempotent menu transitions (hence the no-op guards).

### What warrants a second pair of eyes
- The timer effect keys on the `armed` surface object; entering a different anchor re-arms via cleanup+restart — confirm no restart storm under rapid scrubbing (each restart is one clearTimeout/setTimeout pair, and machine no-ops keep state identity for repeated enters on the open anchor).
- `PbuiHelpState` remains the public view type; products see no API change beyond `openHelp`/`closeHelp` leaving the context (nothing in-repo consumed them directly).

### What should be done in the future
- Intern guide §13's deferred list: close-on-scroll event, click-ladder and accept-flow machines, transient-surface protocol convergence, datalab shortcut table.

### Code review instructions
- Read `machine.ts` first (the policy), then the createPbui diff as pure deletion-of-policy: handlers, provider block, ContextHelp.
- Validate: `pnpm test` (271) / `typecheck` / `build`; datalab suite; the fuzz alone: `pnpm vitest run src/presentation/help/machine.test.ts`.

### Technical details
- PBUI-HELP-002 commits: a468ac4 (P1 doc), 1814842 (P2 machine), 219c05d (P3 placement), 60717c2 (P4 runtime). PR #20 threads through round 4 all resolved; review re-requested at issuecomment-5465445133.
