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

## Step 2: Phase 2, jacks

Each port card now has a jack on the tile frame: a 12px ink-bordered square astride the 2px border, inputs on the left edge, outputs on the right, filled once the port is bound. Wires meet the jacks.

Screenshot: `various/screenshots/p2/004-completed-link-wires-and-badges.png` (jacks visible at both frames; the wire drawing itself is still Phase 3's).

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Assistant interpretation:** Phase 2 of the design.

**Inferred user intent:** Same as Step 1.

**Commit (code):** f88bc43 — "PBUI-WIRING-1 P2: jacks on the tile frame"

### What I did
- `PortRail`: `<span data-part="port-jack" data-side data-bound>` per card, absolutely positioned at `top: 50%` and `left/right: calc(-1 * space-3 - 7px)`; the card is `position: relative` and its grid drops the glyph column; the rail's overflow is visible.
- `WireLayer.anchorOf` prefers the jack inside the registered card.
- Probe (playwright evaluate) confirmed jack rectangles at x=3 (inputs, left frame) and x=789 (outputs, right frame) of the orders tile, and a jack-to-jack path `M 800.9 54.3 … 816.9 60.7` between the orders and order-detail tiles.

### What worked
- Workbench 23 green; ecommerce e2e unaffected (selectors unchanged).

### What didn't work
- Scenario 004 of the interaction script shows two wires ending at the source tile's right frame rather than at the destination jacks, while the seeded scene probes correctly. Not resolved in this step; Phase 3 replaces the path builder and the probe runs against that scenario next.

### What warrants a second pair of eyes
- A rail with more ports than height now overflows instead of scrolling (design doc calls it a follow-up).

### Code review instructions
- `git show f88bc43`; the ecommerce seeded scene with Mod+Shift+L on :6012.

## Step 3: Phase 3, orthogonal wires (and the offset bug)

Wires are Manhattan routes now, and the scenario-004 mystery from Step 2 is solved: the wire layer's absolutely positioned box was measured against the page while the anchors were measured against the surface, so every wire was drawn 22px left and 71px up. The surface needed `position: relative`.

Screenshots: `various/screenshots/p3/004-completed-link-wires-and-badges.png` (two wires in the gutter, jack to jack), `p3/002-connect-mode-acceptable-highlighted.png` (the carry band on the same route), `p3-stories/001-visual-audit--wire-layer-styles.png`.

### Prompt Context

**User prompt (verbatim):** (see Step 1) and, mid-phase: "take screenshots for the diary and for the report later on"

**Assistant interpretation:** Phase 3 of the design; keep shooting every phase into the ticket.

**Inferred user intent:** Same as Step 1.

**Commit (code):** d1bde68 — "PBUI-WIRING-1 P3: orthogonal wires, and the surface is the wire layer's box"

### What I did
- `WireLayer`: `route(a, b, channel)` (H-V-H when the destination is ahead by more than 4px, with the vertical run clamped inside the gap; a stub-out/detour/stub-in otherwise), `labelPoint` for the derived label, per-wire channel `(i - (n-1)/2) * 6`, no marker; the carry band uses the same route. Stylesheet rewritten on tokens (ink stroke, miter joins, dotted held `2 4`, cursor on the token scale).
- `Surface.module.css`: `.surface { position: relative }`.
- Probe on scene 7 before the fix: layer box at (0,0) while the root sat at (22,71); after: layer at (22,71) and paths `M 690 54 H 695 V 61 H 706` and `M 690 54 H 701 V 326 H 706`.

### What worked
- Workbench 23 green; the probe and the screenshots agree.

### What didn't work
- The first route treated a 16px jack-to-jack gap (two tiles across a 10px gutter) as "behind" because the forward threshold was two stubs (24px), producing a zigzag. The threshold is 4px now and the run is clamped inside the gap.
- My CSS edit for the sheet failed on a comment mismatch and silently wrote nothing (the helper raises before writing); the sheet was rewritten whole.

### What I learned
- An `inset: 0` layer is only as good as its containing block; the story symptom (wires ending at the source tile's frame) was the page offset in disguise.

### What warrants a second pair of eyes
- The derived wire in the Visual Audit story is hidden behind the middle tile; Phase 4 sets the stacking order (scrim, tiles, wires) explicitly.

### Code review instructions
- `git show d1bde68`; `shop-scenes--scene-7-connect-mode` on :6012.

## Step 4: Phase 4, scrim and lift

Link mode now reads as a mode: the page washes out, the tiles in the mode stand on top with only their ports showing, and the wires run in wide gutters between them. This is the step where the ecommerce scene first looks like the mock.

Screenshots: `various/screenshots/p4/004-completed-link-wires-and-badges.png` (the whole scene), `p4/002-connect-mode-acceptable-highlighted.png` (carry), `p4-stories/001-visual-audit--wire-layer-styles.png` (held dotted and derived dashed).

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Assistant interpretation:** Phase 4 of the design.

**Inferred user intent:** Same as Step 1.

**Commit (code):** 5b35065 — "PBUI-WIRING-1 P4: scrim the page, lift the tiles"

### What I did
- `Surface.module.css`: `.surface[data-link-mode]` isolates; `::before` is a fixed scrim (`color-mix(wash 82%, transparent)`); tiles get `position: relative; z-index: 1` and a pane background; split dividers get `min-width/min-height: space-6`.
- `Tile.module.css`: `.body[data-link-mode] > .app { visibility: hidden }` (it was already inert).
- `PortRail.module.css`: the rail is opaque pane (no translucency to blend with a hidden app).
- `VisualAudit.stories.tsx` WireLayer story: third tile is the many-ports app and the derived term binds its `alpha` input.

### What worked
- Workbench 23 green; scene 7 shows both wires in the gutter, jack to jack.

### What didn't work
- With a 10px gutter and two 6px channels, one wire ran 2px from the destination tile's frame and read as part of it (the crop in scratch showed it). Wider gutters in the mode fixed it; changing layout on mode toggle is a deliberate trade.
- The story's derived wire was never going to draw: it bound a counter's `count` (an output) as the destination, so there was no input jack; the dotted portal circle at the source was the tell.

### What I learned
- "Missing wire" had three different causes across three phases: a stale registry element (P1), the layer's containing block (P3), and a fixture binding an output as a destination (P4). The probe script (jack rectangles + path data) found each in one run.

### What warrants a second pair of eyes
- The fixed scrim covers the whole viewport, including any product chrome outside the workbench (masthead, status bar); that is the mock's look, but a product embedding a small workbench in a page will scrim the page too.

### Code review instructions
- `git show 5b35065`; scene 7 on :6012 and `Visual Audit/WireLayer` on :6008.

## Step 5: Phase 5, one hairline port card

The card's typography was already right after Phase 2 (name bold, type faint, binding line, doc faint); what remained was the second box a product's presentation drew around it. Ecommerce's port presentation is a block region now, and the rail gives the wrapper a div slot so a block presentation is valid markup.

Screenshot: `various/screenshots/p5/004-completed-link-wires-and-badges.png`.

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Assistant interpretation:** Phase 5 of the design.

**Inferred user intent:** Same as Step 1.

**Commit (code):** e76278e — "PBUI-WIRING-1 P5: one hairline port card"

### What I did
- `ShopShell.renderPort`: `<Presentation … inComposite block>`.
- `PortRail`: the product wrapper is a `div.slot` (grid, min-width 0) whose child is block; cards fill the column width.

### What worked
- Workbench 23 and ecommerce 7 green.

### What I learned
- The PBUI-VISUAL-1 rule "a block presentation draws nothing" pays off here without a new selector: the port presentation only needed to say it is a region.

### What warrants a second pair of eyes
- Cards now stretch to the column width (before they sized to content). It matches the mock's proportions; a product with very short port names gets wide cards.

### Code review instructions
- `git show e76278e`.

## Step 6: Phase 6, the bar binding

The last piece of the mock: in link mode a tile's title and its port badge read as one label, `ORDER DETAIL → ORDERS`, in one hairline box. Outside the mode the badge stays its own dotted chip.

Screenshots: `various/screenshots/p6/004-completed-link-wires-and-badges.png` (link mode), `p6-stories/001-shop-scenes--seeded.png` (normal mode, unchanged).

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Assistant interpretation:** Phase 6 of the design.

**Inferred user intent:** Same as Step 1.

**Commit (code):** a8ef47d — "PBUI-WIRING-1 P6: title and badges as one bar label in link mode"

### What I did
- `Tile.tsx`: badges wrapped in `<span data-part="tile-badges">` inside the title.
- `chrome.css`: `tile-title` is inline-flex with a gap; in `[data-part="workbench"][data-link-mode]` it is a hair box on the pane, the presentation and chips inside are unboxed, `tile-badges::before` is the arrow, the chip glyph is hidden.

### What worked
- Core 51, workbench 23, ecommerce 7 green.

### What I learned
- The link-mode attribute on the workbench root is the one hook every mode-dependent rule needs; the chrome sheet can key on it without the tile knowing.

### What should be done in the future
- Wire routing around tiles that sit between source and destination (the Visual Audit story's derived wire crosses the middle tile's port card); the mock routes through gutters. A next ticket: obstacle-aware routing using the tiles' rectangles.
- A rail with more ports than height overflows.
- The scrim covers any product chrome outside the workbench.

### Code review instructions
- `git show a8ef47d`; scene 7 on :6012.

## Step 7: Phase 7, the WiringLab story

The user asked for a storybook to try the wiring by hand, with different port configurations and more than one row of tiles. `Workbench/WiringLab` on :6008 is that: two rows of three tiles, four apps with number/text/any ports in both directions, five seeded links, the mode open on mount, and buttons to close, reopen and reset.

Screenshot: `various/screenshots/p7/001-workbench-wiringlab--lab.png`. It is also the Phase 8 brief: three of the seeded wires cross a tile that sits between their ends.

### Prompt Context

**User prompt (verbatim):** "Ok, continue. Also, isthere a storybook where I can test it for myself? (connecting a variety of different ports in different configurations, including having multiple rows of tiles horizontally"

**Assistant interpretation:** Keep going through the open items, and add a hand-driveable lab story with mixed ports and a two-row layout.

**Inferred user intent:** Try the wiring interactively and see it hold up in a real grid.

**Commit (code):** 1bfce25 — "PBUI-WIRING-1 P7: WiringLab story"

### What I did
- `packages/pbui-workbench/src/stories/WiringLab.stories.tsx`: four apps (`lab-source` count/label out; `lab-sink` value/anything in; `lab-transform` in→out doubling via `useEmitPort` in an effect; `lab-wide` two in, two out), a col split of two row splits, seeded `port.follow` ×4, `port.pin`, `identity.add`, `link.mode.open` on mount, a `generation` key to reset.

### What worked
- Typecheck clean; the story renders every wire style: two solid follows, a dotted held, the cross-row detour, and the bar labels read `TRANSFORM → SOURCE A · NONE`.

### What didn't work
- N/A for the story itself; what it exposes belongs to Phase 8: the H-V-H route ignores tiles between the ends.

### What warrants a second pair of eyes
- The identity between the two sinks' `value` inputs draws no wire (both ends are inputs, and the wire layer pairs out→in); the cell is shared, the badge says so.

### Code review instructions
- Open `Workbench/WiringLab` on :6008; press tick in Source A; drag `gamma` from Wide onto Sink A's `anything`.

## Step 8: Phase 8, routes through the gutters

The lab made the routing gap obvious: three seeded wires cut straight across a tile. Wires now go around: a small grid router treats every tile frame as an obstacle, prefers long straight runs, and spreads parallel wires into neighbouring lanes.

Screenshots: `various/screenshots/p8/002-workbench-wiringlab--lab.png` (all wires in gutters), `p8/001-visual-audit--wire-layer-styles.png` (the derived wire passes over the top of the middle tile), `p8-scenes/004-completed-link-wires-and-badges.png` (scene 7 unchanged).

### Prompt Context

**User prompt (verbatim):** (see Step 7)

**Assistant interpretation:** The routing follow-up from the report.

**Inferred user intent:** Wires that read like the mock in any layout.

**Commit (code):** 58b3b51 — "PBUI-WIRING-1 P8: wires route around tiles through the gutters"

### What I did
- `route.ts`: `routeAround(from, to, obstacles, lanes, { bounds, cell=6, margin=3, turn=10, occupied=8 })` → corner points or null; `Lanes` remembers used cells across wires; `toPath`. Dijkstra over (cell, heading) with a binary heap; a freed corridor out of the source jack and into the destination jack; the goal must be entered heading +x; corners squared to the jacks' y.
- `WireLayer`: tile rects from `[data-part="workbench-tile"] > [data-part="tile"]`; bounds = surface ± 18px; `pathFor` tries the router and falls back to `route()`.
- `route.test.ts`: clear field is orthogonal; a wall is passed below; a second wire takes another lane.

### What worked
- Workbench 24 test files green. The lab shows every wire in a gutter or along the outside.

### What didn't work
- The audit story's derived wire still went straight through the middle tile after the first cut: its surface is exactly the tiles' height, so there was no gutter row and no path; the router returned null and the fallback drew. Extending the field 18px beyond the surface gives the router the outside strip (the SVG overflows), and the wire now passes above the tile.

### What I learned
- "No path" is a legitimate answer in an edge-to-edge layout; the field has to include the outside, or the fallback silently reintroduces the crossing.

### What warrants a second pair of eyes
- Cost per frame: one Dijkstra per wire over ~20k cells on every tick (resize, ResizeObserver, snapshot). Fine for a handful of wires; a workbench with dozens should memoise on the tile rects.
- The outside strip draws wires up to 18px beyond the surface; a product whose surface sits flush against page chrome will see wires over that chrome.

### Code review instructions
- `git show 58b3b51 -- packages/pbui-workbench/src/components/WireLayer/route.ts`; `pnpm vitest run src/components/WireLayer` in pbui-workbench; `Workbench/WiringLab` on :6008.

## Step 9: Phase 9, the rail scrolls and the jacks stay

A tile with more ports than height now scrolls its rail columns while the jacks stay on the frame and the wires follow the scrolled cards. Getting the wire to follow took three attempts, all about ordering between the rail's commit and the wire layer's measurement.

Screenshots: `various/screenshots/p9/001-workbench-wiringlab--crowded.png` (fourteen ports, 560px tall), `p9/002-workbench-wiringlab--crowded-scrolled.png` (after scrolling the input column: the top jacks clipped away, the wire into `theta` re-routed to its new place).

### Prompt Context

**User prompt (verbatim):** (see Step 7)

**Assistant interpretation:** The rail-overflow follow-up from the report.

**Inferred user intent:** Link mode must hold up for real tiles, not only demo-sized ones.

**Commit (code):** 7d9b9a9 — "PBUI-WIRING-1 P9: the rail scrolls, the jacks stay on the frame"

### What I did
- `PortRail`: jacks rendered in a `.jacks` layer (`inset: 0; pointer-events: none; clip-path: inset(0 -20px)`), placed at each card's centre from `getBoundingClientRect` in a layout effect that re-runs on column scroll, ResizeObserver and window resize; `data-port-id` on each jack; columns `overflow-y: auto`; `pbui:jacks-placed` dispatched after the jacks commit.
- `WireLayer`: `anchorOf` finds the jack in the rail by port id and side (with an `escapeAttribute` guard, since jsdom has no `CSS.escape`); listens for scroll in the capture phase (next-frame bump) and for `pbui:jacks-placed`; wires sorted longest-first so short ones are on top; hit stroke 10px.
- `WiringLab`: `Crowded` story with a fourteen-port app; the cross-row follow lands on its `theta`.

### What worked
- Workbench 24 test files green; ecommerce e2e 9/9; the probe shows the wire's end at the jack's centre after scrolling (488.56 = 482.56 + 6).

### What didn't work
- `CSS.escape` is undefined in jsdom: three connect tests failed with "Cannot read properties of undefined (reading 'escape')". Guarded.
- The e2e "Unlink · keep the last value" right-clicked the *inspector* wire instead of the detail wire: with orthogonal routes both share the stub out of the same jack and the later, longer wire's 14px hit stroke covered the short wire's bounding-box centre (playwright's click point). Sorting wires longest-first (so short ones are hit on top) and a 10px hit stroke fixed the scenario and the real ambiguity behind it.
- The wire lagged the scrolled jack by one step twice: first because the wire layer measured during the same React batch as the jack move (fixed by measuring on the next frame), then because a passive scroll listener's setState is not flushed before the next frame either. The rail now dispatches `pbui:jacks-placed` from a layout effect keyed on its jacks, i.e. after its own commit, and the wire layer measures on that.

### What I learned
- Two components measuring the same DOM in one event need an explicit "I have committed" signal; frames and microtasks are not a contract.

### What warrants a second pair of eyes
- The custom DOM event is a private protocol between PortRail and WireLayer; it is namespaced (`pbui:`) and documented in both places.

### Code review instructions
- `git show 7d9b9a9`; `Workbench/WiringLab › Crowded` on :6008 in a short window; scroll the crowded tile's left column.
