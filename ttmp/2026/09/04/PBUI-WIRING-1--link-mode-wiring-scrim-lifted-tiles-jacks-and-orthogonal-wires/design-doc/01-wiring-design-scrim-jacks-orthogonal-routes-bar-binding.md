---
Title: 'Wiring design: scrim, jacks, orthogonal routes, bar binding'
Ticket: PBUI-WIRING-1
Status: active
Topics:
    - pbui
    - workbench
    - frontend
    - design
DocType: design-doc
Intent: long-term
Owners: []
RelatedFiles: []
ExternalSources: []
Summary: "Make link mode look like the reference wiring mock: scrim the page, lift the tiles, put jacks on the frame, route wires orthogonally, one hairline port card, the binding in the bar. Six phases."
LastUpdated: 2026-09-04T14:12:28.929170692-04:00
WhatFor: "The spec each phase implements; the diary records how it went."
WhenToUse: "Before touching PortRail, WireLayer, or the link-mode chrome."
---

# Wiring design

## Executive Summary

Link mode (Mod+Shift+L) today overlays a translucent rail of port cards on each tile and draws bezier wires with arrowheads between cards whose positions it measures from a one-element-per-port registry. Against the reference mock the differences are: the page is not scrimmed, the tiles are not lifted, ports have no jacks on the frame, wires are curved and sometimes anchored to a stale element, port cards are boxed twice under a product's presentation wrapper, and the bar shows title and badge as two boxes.

Six phases, each independently shippable and screenshot-verified on the pbui-workbench `LinkLab` stories and the ecommerce `Shop Scenes`:

1. **Anchors.** The port registry keeps every mounted element per port and side; the wire layer draws one wire per link per destination element from the nearest source element. Ends the off-screen wire.
2. **Jacks.** Each port card gets a 12px square on the tile frame's edge (inputs left, outputs right) at the card's centre line; the wire layer anchors to jacks.
3. **Orthogonal routes.** Wires are 2px ink polylines with right-angle bends, no arrowheads, square joins; parallel wires take separate channels; held stays dotted, derived dashed, identity double.
4. **Scrim and lift.** In link mode the whole page washes out under a fixed scrim; tiles in the mode paint above it with their application hidden, so the rail is the body; the bar keeps its tint.
5. **Port cards.** One hairline box: name bold, `<type>` faint, the binding line when bound, the doc faint; no glyph column (the jack is the glyph). A product's presentation around a card is `block`, so it draws nothing.
6. **Bar binding.** Title and badges sit in one `tile-label` box; in link mode it reads `ORDERS → ORDERS · NONE` as a single label.

Selectors tests and e2e rely on and that stay: `[data-part="port-rail"]`, `[data-part="port-rail-port"][data-side][data-port-id]`, `[data-part="workbench-wires"]`, `[data-part="wire"][data-term]`, `[data-part="wire-cursor"]`, `[data-part="port-badge"][data-state]`.

## Phase 1: Anchors

`src/chrome/usePortCarry.ts`: `PORTS` becomes `Map<id, Record<side, Set<HTMLElement>>>`; `registerPort` adds/removes; `portElement(id, side)` returns the first **connected** element; new `portElements(id, side)` returns all connected ones. `WireLayer`: for each link, for each destination element, pick the source element minimising the distance between the two anchors, draw one wire; a link whose destination or source has no mounted element draws the dotted portal circle as today.

## Phase 2: Jacks

`PortRail`: each card renders `<span data-part="port-jack" data-side>` positioned absolutely at the card's vertical centre on the tile frame edge: the rail is `inset: 0` inside the tile body and pads `space-3`, so a jack at `left: calc(-1 * var(--pbui-space-3) - 7px)` (inputs) or the mirror (outputs) straddles the 2px frame. 12×12, pane fill, hair border, zero radius; filled ink when the port is bound; the rail's `overflow` becomes `visible` (a rail with more ports than height is a follow-up). Anchor: the wire layer looks for the jack inside a registered card and falls back to the card's edge.

## Phase 3: Orthogonal routes

`WireLayer`: `route(from, to, channel)` returns `M x1 y1 H mx V y2 H x2` when `x2 - x1 ≥ 24` (mx is the midpoint shifted by the channel offset), otherwise a five-segment detour `M x1 y1 H x1+12 V my H x2-12 V y2 H x2` (my is the midpoint of the ys shifted by the channel). Channel offset per wire: `(index - (n-1)/2) * 6`px. Stroke 2px, `stroke-linejoin: miter`, no marker. The carry band uses the same route to the pointer. The derived label sits on the vertical segment.

## Phase 4: Scrim and lift

`[data-part="workbench"][data-link-mode]` gets `isolation: isolate` and a `::before` that is `position: fixed; inset: 0; background: color-mix(in srgb, var(--pbui-wash) 78%, transparent)`; `[data-part="workbench-tile"]` in the mode gets `position: relative; z-index: 1` so tiles paint above the scrim. The application under the rail is `visibility: hidden` (it is already `inert`), so the rail's translucent wash goes; the rail is the tile body on the pane. The split dividers and the wire layer sit above the scrim too.

## Phase 5: Port cards

`PortRail.module.css`: the card is a two-column grid (name + type on one line, binding line, doc), hair border, `space-2 space-3` padding; the `◂/▸` glyph column goes. Binding line: the badge's glyph and text in bold `fs-tiny`. Ecommerce `ShopShell.renderPort` passes `block` to its Presentation so the card is the only box.

## Phase 6: Bar binding

`Tile.tsx` wraps title and badges in `<span data-part="tile-label">`; `chrome.css` styles it as one inline-flex label; in link mode (`[data-link-mode]` on the workbench) the label draws one hair box, the title and badge lose their own, and a `→` separator is inserted by CSS between them (`[data-part="port-badge"]::before`), so the bar reads `ORDERS → ORDERS · NONE`.

## Verification

After each phase: `pnpm -s build` at the root (packages read `dist`), `pnpm --filter pbui-workbench build`, workbench and ecommerce tests, the LinkLab and Visual Audit wire stories on :6008, and the ecommerce scenes via `scripts/04-screenshot-workbench-interactions.mjs` of PBUI-VISUAL-1 into this ticket's `various/screenshots/pN/`.
