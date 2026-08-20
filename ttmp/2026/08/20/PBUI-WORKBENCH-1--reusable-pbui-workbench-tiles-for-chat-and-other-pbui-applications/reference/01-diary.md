---
Title: Diary
Ticket: PBUI-WORKBENCH-1
Status: active
Topics:
    - pbui
    - frontend
    - chat
DocType: reference
Intent: long-term
Owners: []
RelatedFiles: []
ExternalSources: []
Summary: "Diary for PBUI-WORKBENCH-1: making pbui-chat render its apps as real PBUI workbench tiles (split tree, drag/dock, resize, launcher) through a reusable package, with the analysis that precedes it."
LastUpdated: 2026-08-20T13:34:29.59477445-04:00
WhatFor: "Record how the reusable workbench shell was researched, designed and built, separately from the PBUI-AGENT-1 chat-agent work."
WhenToUse: "Read before resuming or reviewing the tiles work."
---

# Diary

## Goal

Record the work that turns the pbui-chat demo's fixed side panels into proper PBUI workbench tiles — a split tree with `TileFrame` chrome, drag-to-swap/dock, resizable splits and a launcher — packaged as `@hyperslop-systems/pbui-workbench` so any PBUI application can use it, and produce an intern-level guide to the whole workbench system. This ticket is deliberately separate from PBUI-AGENT-1 (the chat agent itself) so the two can be reviewed on their own.

## Step 1: Open the ticket, scope the work, start the analysis

The user, looking at the first browser run of pbui-chat, asked for "proper tiles like in the other one, with drag resize and all that, so that we can use it across pbui applications", pointed at datalab as the full workbench reference, and asked for this to be a separate ticket with an intern guide uploaded to reMarkable. PBUI already ships the tile *chrome* (`TileFrame`, `useTileDrag`, `LauncherShell`, shortcut routing) and a React-free document applier (`@hyperslop-systems/workbench-protocol/client`), and datalab-ui has a complete but Redux-bound workbench page. What does not exist is a reusable, server-less React shell between the two: a local `WorkbenchDocument` store, a tree renderer with resize handles, the drag/dock wiring and a launcher that any product can adopt without datalab-ui's state layer.

Two agents are running in parallel as this step closes: one building `packages/pbui-workbench` and moving the pbui-chat demo onto it, one producing a file-and-line analysis of the existing workbench (pbui chrome, workbench-protocol, datalab-ui's layout store/Tile/Workbench page, datalab's Go workbench endpoints, the DATADROP-18 and PBUI-UNIFY-001 decisions) that the guide will build on.

### Prompt Context

**User prompt (verbatim):** "use proper tiles like in the other one, with drag resize and all that, so that we can use it across pbui applications?"

**User prompt (verbatim, follow-up):** "you can look at @datalab I think for full workbench? Anyway, create a new docmgr ticket actually for this work, and Create  a detailed analysis / design / implementation guide that is for a new intern, explaining all the parts of the system needed to understand what it is, with prose paragraphs and bullet point sand pseudocode and diagrams and api references and file references. It should be very clear and technical. Store in the ticket and the nupload to remarkable.


and commit at appropriate intervals and keep a detailed diary as you work (using the diary format from the skill)

that way we can separate that from your original work.

Also before going on too far,  write a detailed project report for the obsidian vault as a deep dive technical analysis blog post using a textbook writing style (no analogies, see skill).      
 Commit and push the bsidian vault when done (go-go-parc vault).    About the first part of your work"

**Assistant interpretation:** (1) Finish and push the vault report about the chat-agent work first. (2) In a new ticket, build reusable PBUI workbench tiles (drag, dock, resize, launcher) and run the chat demo on them, using datalab(-ui) as the reference. (3) Write an intern-level analysis/design/implementation guide in that ticket, keep a diary, commit regularly, and upload the guide to reMarkable.

**Inferred user intent:** The chat agent should look and behave like the other PBUI products (tiles are the family's interaction model), the tile shell should be a shared asset rather than another per-product copy, and the knowledge should be transferable to someone new.

### What I did
- Pushed the PBUI-AGENT-1 vault report (`go-go-parc` commit `91faceb`) before starting here.
- `docmgr ticket create-ticket --ticket PBUI-WORKBENCH-1 …`; added this diary and the guide document; five tasks.
- Briefed the implementation agent: a new package `packages/pbui-workbench` (local store over `WorkbenchDocument`, `Surface` rendering the split tree with `TileFrame`/`useTileDrag`, resize handles committing `resizeSplit`+`snapRatio`, `Launcher` over `LauncherShell` with the longer-rendered-axis placement rule, verbs as data, `serialize/restore`), `createChatApps(chat)` in pbui-chat (`chat`, `inspector`, `watchlist`, `trace`, `widget` doc-bound app for "Open in tile"), the demo on tiles with localStorage persistence, and a browser check.
- Briefed the analysis agent (read-only) on the six areas above.

### Why
- Separating the ticket keeps PBUI-AGENT-1 reviewable as "the chat agent" and this one as "the tile shell", which has a different audience (every PBUI product).
- Reusing workbench-protocol's applier and pbui's chrome rather than rewriting them is the rule the playbook states ("do not write a local mutation applier").

### What worked
- Ticket creation and scaffolding.

### What didn't work
- N/A in this step.

### What I learned
- The pieces a reusable shell needs are split across three places today: chrome in pbui, the applier in workbench-protocol, and the store/tree/drag/launcher wiring inside datalab-ui's Redux layer.

### What was tricky to build
- Nothing built in this step.

### What warrants a second pair of eyes
- Whether the shell should live in pbui core (`src/workbench/`) rather than a new package; the new package avoids a pbui → workbench-protocol dependency for now.

### What should be done in the future
- Step 2: fold the analysis into the guide; Step 3: record the implementation and the browser check; Step 4: reMarkable upload.

### Code review instructions
- Nothing to review yet; see the task list.

### Technical details
- Reference files the work starts from: `pbui/src/chrome/{TileFrame.tsx,useTileDrag.ts,LauncherShell.tsx,shortcutRouting.ts}`, `pbui/packages/workbench-protocol/src/client/{apply,builders,ratios}.ts`, `pbui/packages/datalab-ui/src/{store/layout.ts,components/organisms/Tile,components/pages/Workbench,apps/LauncherApp,appkit/registry.ts}`, `datalab/pkg/server/handlers_workbenches.go`, `datalab/pkg/workbenchapp/`.
