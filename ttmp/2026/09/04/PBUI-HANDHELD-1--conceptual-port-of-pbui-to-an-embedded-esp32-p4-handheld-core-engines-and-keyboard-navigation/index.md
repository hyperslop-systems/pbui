---
Title: 'Conceptual port of pbui to an embedded ESP32-P4 handheld: core engines and keyboard navigation'
Ticket: PBUI-HANDHELD-1
Status: active
Topics:
    - pbui
    - embedded
    - architecture
    - design
    - onboarding
    - research
DocType: index
Intent: long-term
Owners: []
RelatedFiles: []
ExternalSources: []
Summary: Analysis and design for a conceptual port of pbui to a keyboard-only ESP32-P4 PicoCalc handheld - the pbui engines run as JS in native QuickJS, a new pure pbui-handheld shell package supplies caret/hints/REPL/accept-slot/tray/deck navigation over a line model, and a 0104 firmware hosts it.
LastUpdated: 2026-09-04T12:30:44.255921283-04:00
WhatFor: Landing page for PBUI-HANDHELD-1 - links the imported PBUI/HB prototype sources, the intern design guide and the diary.
WhenToUse: Start here when picking up the handheld port or when looking for the handheld prototype sources.
---

# Conceptual port of pbui to an embedded ESP32-P4 handheld: core engines and keyboard navigation

## Overview

This ticket answers: what of pbui is the *idea* (typed presentations, type-directed actions with four-state availability, typed acceptance, additive help, relations, decks of tiles) and travels to an embedded device, and what has to be built because it was never separable from the pointer.

Inputs:

- `sources/pbui-handheld.jsx` - the PBUI/HB prototype v0.3 (53x32 simulated LCD, keyboard-only, pure reducer).
- `sources/pbui-handheld-manual.md` - the owner's manual; its six tutorials are the acceptance tests of the port.
- `sources/pbui-handheld-project-report.md` - the design rationale and open questions.
- The pbui kernel (`src/presentation`), `workbench-core`, and the ESP32-P4 PicoCalc firmware tree (`/home/manuel/workspaces/2025-12-21/echo-base-documentation/esp32-s3-m5`: 0099 display+keyboard, 0101 native QuickJS, 0102 visual REPL/PicoOS, `components/`).

Deliverables:

- `design-doc/01-pbui-handheld-port-analysis-design-and-implementation-guide.md` - the intern guide: hardware and firmware evidence, the pbui tour, the prototype tour and its pbui mapping, gap analysis, design with ten decision records, pseudocode for the key flows, a nine-phase plan, test strategy, risks, references.
- `reference/01-investigation-diary.md` - how the guide was derived.

Headline decisions: run the real pbui engines as JavaScript in native QuickJS (no C port); build `packages/pbui-handheld` as a pure keyboard shell (reducer + line model + catalog contract + workbench-core deck adapter) with a browser harness and a `qjs` golden harness; add firmware `0104-esp32-p4-pbui-handheld` on the proven `picocalc_lcd` / `picocalc_keyboard` / `qjs_service` components.

Status: Phase 0 (this analysis) complete; Phase 1 (extract the reducer into the new package, tutorials as goldens) is next.

## Key Links

- **Related Files**: See frontmatter RelatedFiles field
- **External Sources**: See frontmatter ExternalSources field

## Status

Current status: **active**

## Topics

- pbui
- embedded
- architecture
- design
- onboarding
- research

## Tasks

See [tasks.md](./tasks.md) for the current task list.

## Changelog

See [changelog.md](./changelog.md) for recent changes and decisions.

## Structure

- design/ - Architecture and design documents
- reference/ - Prompt packs, API contracts, context summaries
- playbooks/ - Command sequences and test procedures
- scripts/ - Temporary code and tooling
- various/ - Working notes and research
- archive/ - Deprecated or reference-only artifacts
