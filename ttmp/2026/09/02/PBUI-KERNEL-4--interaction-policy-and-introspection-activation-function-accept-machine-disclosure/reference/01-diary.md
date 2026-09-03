---
Title: Diary
Ticket: PBUI-KERNEL-4
Status: active
Topics:
    - pbui
    - design
    - architecture
    - frontend
DocType: reference
Intent: long-term
Owners: []
RelatedFiles:
    - Path: repo://src/presentation/createPbui.tsx
      Note: The runtime this ticket restructures
    - Path: repo://src/presentation/interaction/activation.ts
      Note: activationOutcome (Step 1)
ExternalSources: []
Summary: 'Chronological record of PBUI-KERNEL-4: how the click ladder, the accept flow and menu explanation became pure, tested policy, how refusals got a presentation, and what evidence each step left.'
LastUpdated: 2026-09-02T21:16:26.475584895-04:00
WhatFor: Continue or review the interaction-policy work without re-deriving why the activation function, the accept machine and the disclosure rules are shaped as they are.
WhenToUse: Before touching createPbui.tsx handlers, the accept flow, RefusalNotice or explain().
---


# Diary

## Goal

Capture how PBUI-KERNEL-4 (guide Phase 10) was implemented: the pointer/keyboard ladder as one `activationOutcome` function, the accept flow as a request-identified pure state machine, refusal presentation, and original-query introspection under a disclosure policy, with the constraint that `pbui.accept` stays a promise-returning call usable outside React.

## Step 1: One activation ladder

`Presentation`'s click handler and its Enter/Space handler each spelled the same four-rung ladder: acceptable → accept; `activate` → the host's gesture; a unique primary → perform it; otherwise open the menu. The two had already diverged once (PR #9: Enter ran `activate.run` directly and never reached the host) and were re-aligned by hand. This step moves the decision into `src/presentation/interaction/activation.ts` as `activationOutcome({ acceptable, activate, primary })`, returning `attempt-accept`, `activate-host` (bubbling, carrying `run`), `perform-primary` (carrying the resolved action) or `open-menu`. Both handlers now ask it and only differ in how they carry the outcome out: a keyboard `activate-host` synthesises a bubbling click, a keyboard `open-menu` anchors at the element's box.

The primary resolution is a thunk so that it runs only when the ladder reaches it; the table test records, for every input combination, the outcome, whether the gesture stops, and whether the thunk ran. The existing click-propagation DOM tests (host sees an activated click, menu swallows, Enter reaches the host, nested presentations) pass unchanged.

### Prompt Context

**User prompt (verbatim):** "do it"

**Assistant interpretation:** Implement PBUI-KERNEL-4 with the same discipline as KERNEL-2 and -3: plan slip, phase slips, commits per phase, diary, screenshots, and the vault report the user asked for after each ticket.

**Inferred user intent:** Finish the last follow-up of the KERNEL-1 design.

**Commit (code):** 2ae05e8 — "PBUI-KERNEL-4 P1: one activation ladder for pointer and keyboard"

### What I did
- Read the ticket, guide §14.4–§14.6, §15.3–§15.5, §19.8, and `createPbui.tsx` (handlers, accept state, menu, banner, chooser, refusal type).
- Printed the plan slip (six phases) and the P1 slip; created the diary and six tasks.
- Wrote `interaction/activation.ts` and its table test (10 tests); routed `handleClick` and `handleKeyDown` through it; exported from `presentation/index.ts`.
- `tsc` clean; `npx vitest run src/presentation` → 32 files, 496 tests.

### Why
- §14.4: "extract the pointer/keyboard ladder as one pure function" with accurate naming: an acceptable click may open a chooser, so the outcome is `attempt-accept`, not `accept`.

### What worked
- The handlers' comments about propagation (which rung stops, which bubbles) moved verbatim onto the switch cases; `stopsPropagation(outcome)` states the rule once.

### What didn't work
- `stopsPropagation` was first typed over `ActivationOutcome<PresentationValues, unknown>`, which a test's `ActivationOutcome<never, string>` could not be assigned to (the subject type is invariant through `ResolvedAction`). Made generic.

### What I learned
- The mouse-doc line (`describe()`) walks the same ladder to say what a left click will do; it stays a separate reading of the same three inputs because it must not resolve the primary on every hover more than it already does.

### What was tricky to build
- Keeping the primary lazy. Resolving it per render would put menu-time work on every grid cell (the datalab cost boundary); the thunk keeps the P1 change cost-neutral.

### What warrants a second pair of eyes
- `activate` without `run` still yields `activate-host`; the pointer path then does nothing itself and lets the click bubble, which is the documented "host owns the click" state.

### What should be done in the future
- N/A beyond P2–P6.

### Code review instructions
- `interaction/activation.ts`, then the two `switch (outcome.kind)` blocks in `createPbui.tsx`.
- `npx vitest run src/presentation/interaction src/presentation/createPbui.test.tsx`.
