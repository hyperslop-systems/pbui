---
Title: Diary
Ticket: PBUI-WIRING-1
Status: active
Topics:
    - pbui
    - workbench
    - frontend
    - design
DocType: reference
Intent: long-term
Owners: []
RelatedFiles: []
ExternalSources: []
Summary: ""
LastUpdated: 2026-09-04T14:12:28.374469849-04:00
WhatFor: ""
WhenToUse: ""
---

# Diary

## Goal

Chronological record of PBUI-WIRING-1: making link mode look like the reference wiring mock (scrim, lifted tiles, jacks on the frame, orthogonal wires, one hairline port card, the binding in the bar). Each phase has a commit, screenshots under `various/screenshots/`, and a thermal slip at start and end.

## Step 1: Ticket, design, and Phase 1 (anchors)

The ticket opens with the analysis the user asked for (target mock versus current link mode) turned into a six-phase design, then the first phase: the wire that started off-screen in the user's screenshot was a registry defect, not a drawing one.

Screenshot: `various/screenshots/p1/004-completed-link-wires-and-badges.png` (wires now leave the order card's right edge; compare PBUI-VISUAL-1 `WI-004`).

### Prompt Context

**User prompt (verbatim):** "Make the wiring look more like this [Image #12] First, analyze the image, and tell me what you would change from the current version [Image #13]" then "Ok, create a new ticket + design doc for that, then implement, take screenshots for the diary and report, commit at appropriate intervals and keep a detailed diary as you work (using the diary format from the skill). Print out a brutalist work slip with the plan / different phases for the ticket. then before stsarting a phase, plrint a split about the phase, and print one when the phase is done."

**Assistant interpretation:** Ticket PBUI-WIRING-1; design doc with the six changes from the analysis; implement phase by phase with commits, diary, screenshots and slips.

**Inferred user intent:** Link mode should read like the reference wiring mock: scrim, lifted tiles, jacks, orthogonal wires, one port card, binding in the bar.

**Commit (code):** e06e068 — "PBUI-WIRING-1 P1: wires anchor to mounted elements, one per destination"

### What I did
- Ticket, diary, design doc (`design-doc/01-…`), six tasks; plan slip and P1 start slip printed.
- `src/chrome/usePortCarry.ts`: `PORTS` keeps a `Set` of elements per port and side; `registerPort(id, side, null)` prunes elements that left the document (and clears the side if none did, which keeps the unit test's detached elements working); new `portElements(id, side)`; `portElement` is the first.
- `WireLayer`: `wireEnds(link)` draws one wire per mounted destination element from the nearest mounted source; keys are `linkId:index`; a link with no mounted destination keeps the dotted portal circle.

### Why
- A view shown in two tiles registered its ports twice and the last registration won, sometimes after unmounting: the off-screen wire. The mock shows one wire into each place a link lands.

### What worked
- Core 51, workbench 23 green; the ecommerce e2e (9 scenarios) passes against the rebuilt dist.

### What didn't work
- First cut pruned both sides on every null unregister and filtered `portElements` by `isConnected`, which broke the registry unit test (detached test elements). Pruning only the given side, with "clear the side if nothing was disconnected", satisfies both the test and React's unmount ref.

### What I learned
- React ref callbacks give no element on unmount, so a multi-element registry has to infer which one left from `isConnected`.

### What warrants a second pair of eyes
- Nearest-source choice when a view is duplicated: it is a heuristic; the mock's picture matches it, a product might want all pairs.

### Code review instructions
- `git show e06e068`; `packages/pbui-ecommerce`: `pnpm e2e` with the :6012 storybook up.
