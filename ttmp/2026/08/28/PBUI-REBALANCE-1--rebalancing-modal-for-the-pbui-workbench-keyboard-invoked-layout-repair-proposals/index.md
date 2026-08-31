---
Title: 'Rebalancing modal for the pbui workbench: keyboard-invoked layout repair proposals'
Ticket: PBUI-REBALANCE-1
Status: complete
Topics:
    - pbui
    - frontend
    - design
    - architecture
    - onboarding
DocType: index
Intent: long-term
Owners: []
RelatedFiles: []
ExternalSources:
    - sources/tiling-repair-textbook.md
    - sources/repair-lab-2.html
    - sources/tiling-lab-1.html
Summary: 'Add a keyboard-invoked rebalancing modal to the pbui workbench: layout-repair proposals (ripple/sparse/project/balance, later reshape/rebuild) computed over an n-ary analysis view of the binary workbench tree, visualized as ranked thumbnail cards, applied atomically via plan/applyPlan; plus a singleton settings tile for algorithms and policy.'
LastUpdated: 2026-08-29T14:06:16.607124063-04:00
WhatFor: Landing page for the rebalancing-modal feature ticket.
WhenToUse: Start here; the design guide in design-doc/ is the main deliverable.
---


# Rebalancing modal for the pbui workbench: keyboard-invoked layout repair proposals

## Overview

A workspace that has accumulated many manual splits degrades: slivers, hogs, unusable
aspect ratios. This ticket adds a **rebalance modal** to the pbui workbench: press a chord
(proposed: `Mod+Shift+K`) and a dialog presents measured, ranked **repair proposals** — each
a thumbnail visualization of the reorganized tiles, classified by invasiveness (weights-only →
reorder → reshape → rebuild), gated by a policy profile, previewable, and applied as one
atomic mutation batch. A companion **settings tile** (`rebalance-settings`, a singleton app)
configures constraints, enabled algorithms, and the policy.

The algorithms come from the imported tiling-repair corpus (see `sources/` and
reference/02): minimum-size propagation, RIPPLE/SPARSE/PROJECT/RELAX/BALANCE weight repairs,
RESHAPE/REBUILD structural repairs, and the proposal-slate mechanics (geometry dedup, policy
gating, scored recommendation). The central engineering problem is the representation gap:
pbui's protocol tree is binary with per-split ratios; the algorithms want n-ary splits with
weight vectors. The guide specifies a lossless adapter with write-back provenance.

## Documents

- **design-doc/01 — Intern analysis, design, and implementation guide** ← the main
  deliverable. Parts: 0 feature summary · I the workbench as-is · II the algorithms ·
  III the binary⇄n-ary adapter · IV feature design · V phased implementation plan ·
  VI pitfalls · appendices (API quick reference, glossary).
- **reference/01 — Diary** — chronological investigation log; read before resuming.
- **reference/02 — Imported source material** — map of the three `sources/` artifacts.

## Key decisions (details in design-doc/01)

- Weight repairs apply as `split.resize` batches via `plan`/`applyPlan` — no protocol change.
- Structural repairs recommend a new `WorkspaceSetTree` mutation (with a
  clone-workspace stopgap); Phase 4, separable.
- pbui has no tabbed stacks → FOLD adapts to "overflow to a new workspace".
- Proposals only — no auto-apply.

## Key Links

- **Related Files**: See frontmatter RelatedFiles field
- **External Sources**: `sources/` — tiling-repair-textbook.md, repair-lab-2.html,
  tiling-lab-1.html

## Status

Current status: **active** — design complete, implementation not started
(Phase 0 of design-doc/01 Part V is next).

## Tasks

See [tasks.md](./tasks.md) for the current task list.

## Changelog

See [changelog.md](./changelog.md) for recent changes and decisions.

## Structure

- design-doc/ - The intern guide (main deliverable)
- reference/ - Diary, source-material map
- sources/ - Imported labs + textbook
- playbooks/ - Command sequences and test procedures
- scripts/ - Temporary code and tooling
- various/ - Working notes and research
- archive/ - Deprecated or reference-only artifacts
