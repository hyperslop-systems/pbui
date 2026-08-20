---
Title: Diary
Ticket: PBUI-WORKBENCH-2
Status: active
Topics:
    - pbui
    - frontend
    - refactoring
DocType: reference
Intent: long-term
Owners: []
RelatedFiles: []
ExternalSources: []
Summary: "Diary for PBUI-WORKBENCH-2: the analysis of the four product shells (agentlogic, turboproof, hyperblog, datalab-ui), the gap analysis against @hyperslop-systems/pbui-workbench, the core additions and the migration plan."
LastUpdated: 2026-08-20T14:29:03.657935947-04:00
WhatFor: "Record how the unification analysis was made and what was decided, so the migrations can be executed and reviewed per product."
WhenToUse: "Read before migrating any product onto pbui-workbench or extending the package."
---

# Diary

## Goal

Record the work of PBUI-WORKBENCH-2: understand how agentlogic, turboproof, hyperblog and datalab-ui each implement their workbench shell today, measure each against the new shared package `@hyperslop-systems/pbui-workbench` (PBUI-WORKBENCH-1), decide which product features belong in the shared core, design their APIs, and plan the four migrations — all written up as an intern guide and uploaded to reMarkable.

## Step 1: Establish the starting point — shared chrome, copied shells

The question that opened this ticket was whether `pbui-workbench` duplicated something that already existed. A read-only survey of `~/code/wesen/hyperslop-systems/{agentlogic,turboproof,hyperblog}` and of `datalab-ui` answered it precisely. Two layers were already shared: the tile chrome in `@hyperslop-systems/pbui` (`TileFrame`, `useTileDrag`, `DropZoneOverlay`, `LauncherShell`, `splitDirectionFor`, the Mod-K router) and the document applier and gesture builders in `@hyperslop-systems/workbench-protocol/client`. The layer between them — holding the document, rendering the split tree with resize handles, wiring drag to swap/dock, the active placement, the launcher policy, persistence — was copied four times in four shapes: agentlogic (≈510 lines, protocol-native, `TileFrame`+`useTileDrag`), turboproof (≈1 190 lines, Redux slice, protocol-native, also `LauncherShell`+`splitDirectionFor`), hyperblog (≈560 lines, its own tree in `model/layout.ts`, no protocol client), and datalab-ui (its own Redux layout store and tree type, only `useTileDrag`/`DropZoneOverlay` from the chrome). That middle layer is what `pbui-workbench` extracts, and it is what PBUI-UNIFY-001's DR-U5 deferred "until a third consumer makes it real".

This also corrected a sentence in the PBUI-WORKBENCH-1 guide: `TileFrame` and `LauncherShell` had no consumer *inside the pbui repository*, but three products outside it do consume them. The accurate statement is "the chrome is shared; the shell is not".

### Prompt Context

**User prompt (verbatim):** "Can you create a new docmgr ticket in pbui in order to unify all the existing applications to unite around a workbench package, and analyze in depth what things could be integrated into the shared core that are good features t have that it might not yet support.

Create  a detailed analysis / design / implementation guide that is for a new intern, explaining all the parts of the system needed to understand what it is, with prose paragraphs and bullet point sand pseudocode and diagrams and api references and file references. It should be very clear and technical. Store in the ticket and the nupload to remarkable."

**Assistant interpretation:** Open PBUI-WORKBENCH-2; analyse every product's shell in depth; find the features worth lifting into the shared core; design them; plan the migrations; write it all as an intern guide; upload to reMarkable.

**Inferred user intent:** One workbench implementation across the family, with the best features of each product available to all, and a plan a newcomer can execute.

### What I did
- `docmgr ticket create-ticket --ticket PBUI-WORKBENCH-2 …`; diary, guide document, four tasks.
- Launched four read-only analysis agents: agentlogic, turboproof, hyperblog (architecture, state, feature list with file references, product policy vs generic behaviour, gap list both ways, migration sketch) and an exact inventory of `pbui-workbench` (API, state, verb behaviour, components, explicit unsupported list, tests). The datalab-ui analysis from PBUI-WORKBENCH-1 is reused.

### Why
- A gap analysis is only as good as its baseline; the package inventory is read from source rather than from the previous ticket's brief.
- The external products are analysed but not modified: the ticket lives in pbui, and the migrations are planned here and executed per product.

### What worked
- The line counts and import surveys gave a quantified picture in two commands (`grep -rhoE` over each `ui/src`).

### What didn't work
- zsh expanded `--include=*.ts` as a glob and printed `no matches found`; the flags must be quoted (`--include='*.ts'`).

### What I learned
- agentlogic already builds on the protocol builders (`splitPlacement` ×14, `closePlacement` ×11, `applyMutation` ×7) — it is the closest to a drop-in; hyperblog uses none of them and owns `findLeaf/leaves/removeLeaf`; turboproof is protocol-native inside a Redux slice.

### What was tricky to build
- N/A (analysis step).

### What warrants a second pair of eyes
- Whether datalab-ui should be in scope for the first unification round at all; its store carries stages and audiences that no other product has.

### What should be done in the future
- Step 2: fold the four reports into the guide (per-product analysis, feature matrix, core additions, migrations).

### Code review instructions
- N/A yet.

### Technical details
- Shell sizes measured: agentlogic `store/workbench.ts` 169 + `TileTree.tsx` 200 + `Workbench.tsx` 81 + `LauncherPanel.tsx` 61; turboproof `store/workbench.ts` 510 + `Workbench.tsx` 353 + `Tile.tsx` 143 + `LauncherDialog.tsx` 186; hyperblog `model/layout.ts` 183 + `Workbench.tsx` 378; datalab-ui `store/layout.ts` 1 162 + `Tile.tsx` 271 + `WorkbenchShell.tsx` 391 + `LauncherDialog.tsx` 506.
