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

## Step 2: Analysis folded into the guide; design section written

The read-only analysis agent returned a file-and-line map of the existing workbench across four repositories, and it settled two facts that shape the design: datalab-ui does not use the protocol document as runtime state (it keeps its own tree in `store/layoutTree.ts` and converts at the remote boundary), and PBUI's `TileFrame` and `LauncherShell` had no consumer in the repository at all — datalab-ui hand-rolls both. The reusable shell is therefore the first real caller of the chrome kit, and the first React consumer of the protocol applier as runtime state.

I wrote §§0–6 of the intern guide: the presentation protocol the tiles sit on, the chrome kit (with the two `LauncherShell` invariants quoted), the document and its applier (all fifteen arms, the error vocabulary, the `placementSplit` id rule, the ten invariants), datalab-ui's Redux implementation and remote controller, the datalab server's route semantics (428/409/400, replay-before-apply, subscribe-before-snapshot), the decisions to carry forward, the responsibility table, and the design of `@hyperslop-systems/pbui-workbench` (state, verbs as data, rendering, persistence, what stays with the product).

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Assistant interpretation:** Turn the analysis into the first half of the intern guide and fix the design before the implementation report arrives.

**Inferred user intent:** A guide a newcomer can read top-down: foundations, what exists, what is being built, why.

### What I did
- Wrote `design-doc/01-intern-guide-…md` §§0–6 (≈360 lines).
- Kept the implementation agent's brief as the design of record (§6) so §7 can report deviations against it.

### Why
- Writing the analysis before the implementation lands keeps the guide honest about what was reused versus rewritten.

### What worked
- The analysis agent's responsibility table (datalab-ui Redux → shell) mapped one-to-one onto the package design; no design change was needed.

### What didn't work
- N/A.

### What I learned
- `handleMutateWorkbench` replays the idempotency key *before* comparing revisions, so a replayed request never conflicts; `If-Match` missing is 428, not 412; validation errors are 400, not the 422 the TS applier's comment mentions.
- The TS applier and the Go applier share one fixture directory; the Go side tests `applyMutation` only, not `Validate`.

### What was tricky to build
- Deciding how much of the hosted path to put in the guide. It is in §5 and §6.5 as "what changes later" so an intern does not build a server into the shell.

### What warrants a second pair of eyes
- The verb vocabulary in §6.3 (`tile.*`, `split.resize`, `view.*`) is mine; the implementation may name things differently — §7 will reconcile.

### What should be done in the future
- §7 (as built), §8 (pbui-chat on tiles), §9–10 (references) once the implementation agent reports.

### Code review instructions
- Read §3.2 against `pbui/packages/workbench-protocol/src/client/apply.ts` and §5 against `datalab/pkg/server/handlers_workbenches.go`.

### Technical details
- Guide file: `design-doc/01-intern-guide-the-pbui-workbench-tiles-and-how-pbui-chat-runs-on-them.md`.

## Step 3: The shell lands, the demo runs on tiles, and a layout bug the tiles exposed

The implementation agent delivered `@hyperslop-systems/pbui-workbench` and the chat apps; I re-ran its gates (28 + 43 tests, demo build), committed (`a6fa46e`), rebuilt the embedded binary through `devctl up --profile prod` (the corrected `build.run` now passes: `pbui-lib → ui → binary`), and drove the real-model server through the tiles UI in a browser: projected table, model widget with chips, mentions and a `[[widget:…]]` mention all rendered inside the chat tile (`various/` screenshots).

The user then reported a layout defect from their own session: with the chat tile narrowed, a table widget ran past the tile's right edge and the tile body scrolled horizontally; hovering any object made it lay out correctly. I reproduced it by narrowing the root split to 25 % (tile 349 px): the transcript, an `overflow:auto` block, measured 707 px — the table's intrinsic width — and every ancestor up to the tile body reported `scrollWidth > clientWidth`. Patching styles live in the page isolated the cause in one step: `ChatApp.module.css` declared `display: grid` with `grid-template-rows` and **no `grid-template-columns`**, so the implicit column track is `auto`, which sizes to the widest child's max-content. Setting `grid-template-columns: minmax(0, 1fr)` made the transcript 334 px and the table scroll inside its own container. The hover "fix" was a re-layout artefact, not a state difference.

### Prompt Context

**User prompt (verbatim):** "[Image #4] [Image #5] [Image #6] <- There's something weird with the layout of the table in the chat, when I hoveer another object, it's properly bound within the tile, but when I don't hover over it, it's not (and this is when hovering in another tile)."

**User prompt (verbatim, follow-up):** "what packages did you create? is the chat stuff going to be reusable across say datalab or agentlogic or so?"

**Assistant interpretation:** Diagnose and fix the overflow; explain the package layout and its reusability across PBUI products.

**Inferred user intent:** A chat tile that behaves like every other tile, and confidence that the new packages are shared infrastructure rather than a one-off demo.

**Commit (code):** a6fa46e — "pbui-workbench: reusable PBUI workbench tiles; pbui-chat apps and demo on tiles"; 83a5325 — "pbui-chat: fix chat tile overflow (implicit grid column), guard grids, fix UI build order"

### What I did
- Verified and committed the tiles package, the chat apps and the demo; kept the browser screenshot in `various/01-browser-tiles-open-in-tile.png`; added `.devctl/` to `.gitignore`.
- Reproduced the overflow with Playwright: narrowed the split by dispatching `ArrowLeft` keydowns on the `role="separator"` divider (the hook handles one step per frame, so six dispatches with a frame between each), then walked the ancestor chain reporting `clientWidth/scrollWidth/overflow-x/min-width` and tried four candidate fixes as inline styles; only the grid column template changed the result.
- Fixed `ChatApp.module.css`; added `packages/pbui-chat/test/grid-columns.test.ts`, which scans every CSS module in pbui-chat and pbui-workbench and fails on a `display: grid` rule without a column template (a `/* grid-columns: inline */` marker opts out a rule whose template is computed at runtime — the split pane). The test immediately flagged the split rule, which is the intended behaviour.
- Found that the first rebuild did not ship the fix: the demo consumes `@hyperslop-systems/pbui-chat` through its `dist`, so the library must be rebuilt first. `make chat-ui` and the devctl `build.run` now build `pbui-workbench` and `pbui-chat` before the demo.
- Re-verified on a fresh scripted server: tile 349 px → transcript 334 px, table scrolls inside `.scroll` (293/554), no tile-body overflow beyond a 3 px rounding residue from the mouse-doc line's `nowrap` text.

### Why
- A structural CSS test is the only cheap guard for this class of defect; jsdom cannot measure layout.
- The build-order fix belongs in the Makefile and the devctl plugin, not in memory.

### What worked
- Live style patching in the page was faster than reasoning about grid sizing rules; the first candidate (`minmax(0, 1fr)` on the app grid) was conclusive.

### What didn't work
- Pressing `ArrowLeft` through Playwright's keyboard after clicking the divider did not resize (focus did not land on the divider); dispatching `KeyboardEvent`s on the element did, one step per animation frame.
- `grep -c "grid-template-columns:minmax(0,1fr);…"` against the prod bundle returned 0 after the devctl rebuild even though the served page had the rule; the minifier's property order differs between builds — do not use byte-exact greps on minified CSS as a check.

### What I learned
- An implicit grid track is `auto`, and `auto` sizes to max-content; `minmax(0, 1fr)` on *both* axes is the rule for any container that may hold a wide widget.
- The demo's Vite build resolves workspace packages through their `exports` → `dist`; a source edit in a library is invisible to the demo until that library is rebuilt.

### What was tricky to build
- Distinguishing "the fix is wrong" from "the fix did not ship": the computed `grid-template-columns` on the live element (`722px` vs `348.5px`) and the shipped rule text answered it.

### What warrants a second pair of eyes
- The one-time anomaly the implementation agent reported (an extra unbound `widget` tile seen once, never persisted, not reproduced).
- The mouse-doc line's long text still overflows by a few pixels in a very narrow tile.

### What should be done in the future
- A `tile` presentation type in the chat vocabulary so tile titles carry the tile descriptor's verbs.
- Hosted workbench mode (§6.5 of the guide).

### Code review instructions
- `packages/pbui-chat/src/apps/ChatApp/ChatApp.module.css`, `packages/pbui-chat/test/grid-columns.test.ts`, `Makefile` (`chat-ui`), `plugins/devctl_pbui_chat.py` (`build_steps`).
- Reproduce: `devctl up --profile prod`, open http://127.0.0.1:8090/, ask "which gold eagles are low on stock?", drag the root divider left until the chat tile is ~350 px wide.

### Technical details
- Measurements before the fix (tile 349 px): `transcript=707 chatApp=349/722 tileBody=349/722`; after: `transcript=334 chatApp=349/352 tableScroll=293/554 (scrolls inside the widget)`.
