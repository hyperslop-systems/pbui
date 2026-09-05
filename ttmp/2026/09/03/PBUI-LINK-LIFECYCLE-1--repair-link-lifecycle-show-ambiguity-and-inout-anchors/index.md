---
Title: Repair link lifecycle, show ambiguity, and inout anchors
Ticket: PBUI-LINK-LIFECYCLE-1
Status: complete
Topics:
    - pbui
    - frontend
    - architecture
    - refactoring
DocType: index
Intent: long-term
Owners: []
RelatedFiles:
    - Path: repo://ttmp/2026/09/03/PBUI-LINK-LIFECYCLE-1--repair-link-lifecycle-show-ambiguity-and-inout-anchors/design-doc/01-concise-design-for-pr-24-review-fixes.md
      Note: Concise implementation design
    - Path: repo://ttmp/2026/09/03/PBUI-LINK-LIFECYCLE-1--repair-link-lifecycle-show-ambiguity-and-inout-anchors/reference/01-diary.md
      Note: Implementation evidence and validation
ExternalSources:
    - https://github.com/hyperslop-systems/pbui/pull/24
Summary: Correct the four remaining PR 24 review findings through generalized removed-port lifecycle maintenance, semantic before-after runtime cleanup, unambiguous show target identities, and side-aware DOM anchors.
LastUpdated: 2026-09-03T19:17:48.07338278-04:00
WhatFor: Provide the ticket hub, design, evidence, and validation for the PR 24 review corrections.
WhenToUse: Consult when reviewing app-replacement link behavior, show target ranking, or Workbench wire anchor geometry.
---



# Repair link lifecycle, show ambiguity, and inout anchors

## Overview

The reviewed PR predated the headless Workbench-core cutover. Planning purity was already fixed there. This ticket addresses the remaining findings without restoring shell-owned semantics.

App replacement now computes removed semantic ports and applies complete durable lifecycle maintenance. Runtime cleanup is derived from before/after documents. The show resolver retains ambiguity between distinct app/port targets, and port rails register independent input and output anchors.

## Documents

- [Concise design](design-doc/01-concise-design-for-pr-24-review-fixes.md)
- [Implementation diary](reference/01-diary.md)
- [Tasks](tasks.md)
- [Changelog](changelog.md)

## Results

```text
PBUI:             48 files / 831 tests passed
Workbench core:   31 files / 243 tests passed
Workbench shell:  23 files / 116 tests passed
Workspace typecheck: passed for 12 projects
PBUI build:       passed
```

## Status

**Complete.** All remaining review scenarios have production fixes and regression coverage. The original planning-purity finding remains covered by the existing inverted test.
