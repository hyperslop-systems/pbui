---
Title: 'Report: the wiring before and after, phase by phase'
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
Summary: "What link mode looked like before, the mock, and the result after each of the six phases, with the commits."
LastUpdated: 2026-09-04T14:34:13.325323098-04:00
WhatFor: "Review the wiring work at a glance."
WhenToUse: "After the ticket; regenerate the shots with PBUI-VISUAL-1 script 04."
---

# Report: the wiring before and after

## Executive Summary

Nine phases, nine commits, every one screenshot-verified on the ecommerce `Shop Scenes` (scene 7, "connect mode over an already-linked pair") and the workbench `Visual Audit/WireLayer` story. The result reads like the mock: the page washes out, the tiles in the mode stand on top with only their ports, jacks sit on the frames, wires are orthogonal ink runs in wide gutters, each port is one hairline card, and the bar reads `ORDER DETAIL → ORDERS`.

| Phase | Commit | What |
|---|---|---|
| P1 anchors | e06e068 | registry keeps every mounted element; one wire per destination |
| P2 jacks | f88bc43 | 12px squares on the frame, filled when bound |
| P3 routes | d1bde68 | orthogonal wires, channels; the surface is the layer's box |
| P4 scrim | 5b35065 | fixed wash, lifted tiles, apps hidden, 24px gutters |
| P5 cards | e76278e | block presentation around a card; one box |
| P6 label | a8ef47d | title + badges as one bar label |
| P7 lab | 1bfce25 | `Workbench/WiringLab`: 2×3 tiles, mixed ports, seeded links |
| P8 routing | 58b3b51 | grid router around tiles, lanes, outside strip |
| P9 rail | 7d9b9a9 | scrolling rail, jack layer, hit order |

## The mock

![mock](../various/screenshots/before/mock.png)

## Before

![before](../various/screenshots/before/004-completed-link-wires-and-badges.png)

## After each phase (scene 7)

**P1 anchors** — wires leave the real port instead of an off-screen ghost.
![p1](../various/screenshots/p1/004-completed-link-wires-and-badges.png)

**P2 jacks**
![p2](../various/screenshots/p2/004-completed-link-wires-and-badges.png)

**P3 orthogonal routes** (and the surface offset fix)
![p3](../various/screenshots/p3/004-completed-link-wires-and-badges.png)

**P4 scrim and lift**
![p4](../various/screenshots/p4/004-completed-link-wires-and-badges.png)

**P5 one port card**
![p5](../various/screenshots/p5/004-completed-link-wires-and-badges.png)

**P6 bar binding**
![p6](../various/screenshots/p6/004-completed-link-wires-and-badges.png)

## The lab, and routing around tiles (P7, P8)

![lab](../various/screenshots/p8/002-workbench-wiringlab--lab.png)

![story routed](../various/screenshots/p8/001-visual-audit--wire-layer-styles.png)

## A crowded tile (P9)

![crowded](../various/screenshots/p9/001-workbench-wiringlab--crowded.png)

![crowded scrolled](../various/screenshots/p9/002-workbench-wiringlab--crowded-scrolled.png)

## The carry band and the wire styles

![carry](../various/screenshots/p4/002-connect-mode-acceptable-highlighted.png)

![styles](../various/screenshots/p4-stories/001-visual-audit--wire-layer-styles.png)

## Still open

- Routing cost: one Dijkstra per wire per measurement; memoise on tile rects if a workbench has dozens of wires.
- The scrim covers product chrome outside the workbench (the mock's look; an embedded workbench may not want it).
- The offset "lifted" placement of tiles in the mock was not reproduced on purpose: tiles stay in place so the split layout is not disturbed.
