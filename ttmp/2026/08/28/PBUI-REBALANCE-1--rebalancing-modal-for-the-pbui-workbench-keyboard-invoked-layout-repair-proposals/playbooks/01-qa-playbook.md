---
Title: Rebalance QA Playbook
Ticket: PBUI-REBALANCE-1
Status: active
Topics:
    - frontend
    - pbui
DocType: playbook
Intent: long-term
Owners: []
RelatedFiles:
    - Path: /home/manuel/workspaces/2026-08-24/use-optkit/pbui/packages/pbui-workbench/src/components/RebalanceDialog/RebalanceDialog.tsx
      Note: The dialog under test
    - Path: /home/manuel/workspaces/2026-08-24/use-optkit/pbui/packages/pbui-workbench/src/stories/RebalanceLab.stories.tsx
      Note: The broken-layout presets this script drives
ExternalSources: []
Summary: Manual QA script for the rebalance dialog, badge, preview, RELAX, and settings, driven from the Storybook Rebalance Lab.
LastUpdated: 2026-08-29T14:05:00-04:00
WhatFor: Verify a rebalance change by hand before release.
WhenToUse: After touching anything under packages/pbui-workbench/src/rebalance or the Rebalance components.
---

# Rebalance QA Playbook

Run Storybook (`pnpm --dir packages/pbui-workbench storybook`) and open
**Workbench/RebalanceLab**. Each numbered step states what MUST be true;
anything else is a finding.

## 1. Healthy is silent

Pick **HEALTHY**. The status badge (Workbench/RebalanceBadge → Healthy story)
renders nothing. Open the dialog (Ctrl/Cmd+Shift+K): the header says every
tile clears its minimum, LEAVE AS IS is first and PICKed, BALANCE and RELAX
(if enabled) are the only cards proposing change.

## 2. Every failure mode produces an honest slate

For each preset — SLIVER, FOUR DONORS, COMPOUND, SKINNY COL, WIDE ROW 9,
TOO MANY:

- the header states the violation count and worst shortfall;
- cards are ordered by tier; out-of-policy cards are greyed WITH a reason,
  never hidden;
- on SLIVER, the weight strategies merge into one card ("+N agree");
- on SKINNY COL, no weights card claims "all fit" (topology is required);
- on TOO MANY, the capacity warning names the number that fits.

## 3. Preview never mutates

Arrow across cards: the dashed outline overlay tracks the selection on the
real Surface behind the modal, one labelled box per tile. Press Escape.
Nothing changed — no undo entry, identical layout.

## 4. Apply and Undo

Shift+click a repair card: it applies, the dialog stays open, the status
line arms Undo. Press U: the layout is restored byte-identically (verify by
the status "Restored the previous layout"). Plain click on a card applies
and closes.

## 5. Keyboard chord discipline

With the object menu open, Ctrl/Cmd+Shift+K must NOT open the dialog. Same
while a presentation-accept surface is active. With nothing open, the chord
opens it; Escape closes; ←/→ move the selection; Enter accepts.

## 6. RELAX behaves like the textbook

In settings, enable the `relax` generator (or pick the TIDY profile). On
FOUR DONORS with γ=0, RELAX's card shows near donors paying more than far
ones (compare its thumbnail with PROJECT's). Set γ=4: RELAX now proposes a
change even on HEALTHY — and its card says so rather than hiding it.

## 7. Settings persist and gate

Flip a profile: the generator checkboxes and budgets follow. Edit a number
field and blur: the profile flips to "custom". Reload (or remount the
story): the config survives via the workbench document. Disable a generator:
its card disappears from the next slate.

## 8. Cost stays interactive

`pnpm exec vitest run src/rebalance/slate.perf.test.ts` prints the median
12-tile slate build; it must stay far under 50ms (lab reference ≈9ms).
