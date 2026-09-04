---
Title: Diary
Ticket: PBUI-VISUAL-1
Status: active
Topics:
    - pbui
    - frontend
    - design
    - review
DocType: reference
Intent: long-term
Owners: []
RelatedFiles:
    - Path: repo://packages/pbui-sandbox/src/VisualAudit.stories.tsx
      Note: Four devtools tiles on one running program (I-SB exhibits)
    - Path: repo://ttmp/2026/09/04/PBUI-VISUAL-1--consolidate-the-visual-style-across-pbui-packages-and-demos/scripts/01-screenshot-storybook.mjs
      Note: The harness every sweep uses
    - Path: repo://ttmp/2026/09/04/PBUI-VISUAL-1--consolidate-the-visual-style-across-pbui-packages-and-demos/scripts/06-build-catalog.py
      Note: Generates the catalog half of the design doc
ExternalSources: []
Summary: ""
LastUpdated: 2026-09-04T11:02:49.203786789-04:00
WhatFor: ""
WhenToUse: ""
---


# Diary

## Goal

Chronological record of the PBUI-VISUAL-1 visual-consistency pass: how the screenshot corpus was collected across the eight storybooks and four demo apps, what tooling was built, what the analysis found, and what was tricky. Written so a later style pass can re-run the same procedure (a playbook will be distilled from it).

## Step 1: Ticket, servers, and the screenshot harness

The pass starts from nothing: no ticket, no way to look at 250+ stories at once. This step creates the ticket, boots every storybook and demo in one tmux session, and builds a small playwright harness that screenshots every story of a running Storybook into a numbered directory with a manifest. The harness is what makes the rest of the audit repeatable: any future style pass runs the same script against the same ports and gets a comparable corpus.

The user also named the reference look mid-step: the `pbui-agent-workbench` artifact (without its brutalist hard shadows). That screenshot is captured into the corpus so every later comparison has a fixed target.

### Prompt Context

**User prompt (verbatim):** "Let's do a pass on pbui and the various examples, especially around the demos, and let's consolidate the visual stsyle across them, sometimes we have objects that use a different visual representation, sometimes there are too many nested boxes, sometimes margins are missing.

Create a new docmgr ticket, then examine the different components in pbui/ and take screenshots and analyze the screenshots and maybe make custom storybook stories and them make me a markdown doc where I can see the different screenshots (numbered, with name, grouped by functionality and package), so I can give some feedback. Add your own notes on what is inconsistent / can be folded together / css is inconsistent (both in usage and in style and structure) in the markdown too."

Follow-ups (verbatim): "use subagents if that helps (they don't need to be full intelligence either, just collect the various screenshots and maybe make some new stories and interactions and stuff like that). I think the workbench + linking are two domains where things might be a bit off. In general, the look of https://artifacts.yolo.scapegoat.dev/view/pbui-agent-workbench without the brutalist shadows is maybe my favourite look and is what inspired a lot of pbui at the start" and "commit at appropriate intervals and keep a detailed diary as you work (using the diary format from the skill) (that way we will use it for a report and a playbook later on, since we will do style analysis / improvement passes in the future anyway)"

**Assistant interpretation:** Build a screenshot-backed visual audit of every pbui package and demo, grouped by package and function, with numbered images the user can point at, plus an analysis of visual and CSS inconsistencies and consolidation candidates. No style changes yet; this pass produces the feedback document.

**Inferred user intent:** Get a single place to see the whole family at once, give targeted feedback, and then run consolidation passes with a repeatable procedure. The diary is the raw material for a later report and playbook.

### What I did
- Created ticket `PBUI-VISUAL-1` (topics pbui, frontend, design, review) with a diary (`reference/01-diary.md`) and the audit design doc (`design-doc/01-visual-audit-screenshots-and-inconsistency-notes.md`).
- Inventoried the repo: 8 storybooks (root + datalab-ui, pbui-chat, pbui-workbench, pbui-sandbox, pbui-editor, pbui-plotscript, pbui-ecommerce), 3 demo apps under `packages/*/demo` plus the datalab-ui vite demo, ~150 CSS files outside dist/node_modules, and 190+ story files.
- Started everything in tmux session `pbui-visual` (12 windows). Port map: core 6006, pbui-chat 6007, pbui-workbench 6008, pbui-sandbox 6009, pbui-editor 6010, pbui-plotscript 6011, pbui-ecommerce 6012, datalab-ui 6013 (its default 6006 collides with root, so `storybook dev -p 6013`); demos datalab 5173, chat 5174, plotscript 5175, ecommerce 5176.
- Wrote `scripts/01-screenshot-storybook.mjs`: fetches `/index.json`, shoots every `type: "story"` entry at `iframe.html?id=…&viewMode=story`, 4 pages in parallel, crops to the content bounding box (min 320x120, full-page when taller than the viewport), writes `manifest.json` with id/title/name/file/size/error. Playwright 1.62 is resolved with `createRequire` from `packages/pbui-ecommerce/package.json` because that is the only workspace package depending on it.
- Wrote `scripts/02-screenshot-reference.mjs` and captured the reference artifact at 1440x900 into `various/screenshots/reference/pbui-agent-workbench.png`.
- Read `src/tokens.css` and `src/styles.css` in full (the family's token defaults and the zero-specificity presentation fallbacks).
- Fanned out five sonnet subagents: (A) static shots of all 8 storybooks, (B) demo apps with interactions, (C) new `VisualAudit.stories.tsx` for pbui-workbench plus link-flow interaction shots, (D) a CSS structure inventory (`various/css-inventory.md`), (E) interaction-state shots for core/chat/sandbox/editor/plotscript. Each writes a `various/notes-*.md` with one line per screenshot and cross-package observations.

### Why
- One corpus, one numbering scheme, one manifest per directory: the feedback doc can cite "core 041" and the number is stable and re-derivable.
- Subagents for collection only; the analysis and the consolidation proposals stay with the main session so the judgement is consistent.
- The reference screenshot pins what "consistent" should converge towards, rather than an average of the current state.

### What worked
- All 12 servers came up on the first try; `curl` returned 200 on every port except the chat demo (302, it redirects; the demo agent investigates whether it needs the Go backend under `pkg/chatui`).
- Harness smoke test on 11 core stories (Button, Callout, Dialog) rendered correctly; monospace tokens present because `.storybook/preview.ts` imports datalab-ui's `tokens.css`.

### What didn't work
- First harness version clipped to `#storybook-root`'s bounding box, which is always the full viewport width (a block element), so every crop was 1280px wide. Fixed by walking the root's descendants and using the max `right`/`bottom` edge.
- A stray typo `{ timeout: 8000 )` in the first heredoc; caught by `node --check`.
- Dialog stories screenshot as a 120px strip containing only the trigger button: static shots cannot show modal/menu states. That is why agent E exists.

### What I learned
- The storybook preview is a consumer that must import tokens itself; pbui's own `src/tokens.css` ships defaults but the root preview deliberately imports datalab-ui's copy. Two token definition sites already exist before any product is involved; the inventory agent diffs them.
- `src/tokens.css` documents in its own header that Dialog and JsonBlock used to read slate-blue fallbacks (`#0f172a`/`#e2e8f0`) and that Dialog's radius/space defaults contradicted the zero-radius family. Those are candidates to verify visually.

### What was tricky to build
- Resolving playwright from a script living under `ttmp/` (outside any package): ESM ignores `NODE_PATH`, so the script computes the repo root relative to its own path (six levels up from `ttmp/2026/09/04/<ticket>/scripts`) and uses `createRequire` on the ecommerce package.json. If the ticket directory ever moves, that relative path breaks; the script prints a usage line but not that.
- Port collisions: datalab-ui and root both default to 6006. Solved by passing `-p 6013` explicitly instead of `pnpm storybook`.

### What warrants a second pair of eyes
- The crop heuristic can cut off fixed-position elements (menus) that render outside the descendant bounds; interaction shots use full-frame captures for that reason.

### What should be done in the future
- Turn the port map + harness into a playbook (`playbooks/`) once the pass is complete.
- Consider checking a `visual-audit` npm script into the repo so the corpus can be regenerated without the ticket.

### Code review instructions
- `scripts/01-screenshot-storybook.mjs` (harness), `scripts/02-screenshot-reference.mjs`.
- Validate: `node scripts/01-screenshot-storybook.mjs http://localhost:6006 /tmp/x --filter=atoms-button` with the root storybook running.

### Technical details
```
tmux new-session -d -s pbui-visual -n root "pnpm storybook"
tmux new-window -t pbui-visual -n datalab-sb "cd packages/datalab-ui && pnpm exec storybook dev -p 6013 --no-open"
for p in pbui-chat pbui-workbench pbui-sandbox pbui-editor pbui-plotscript pbui-ecommerce; do
  tmux new-window -t pbui-visual -n sb-$p "cd packages/$p && pnpm storybook"; done
tmux new-window -t pbui-visual -n demo-datalab "cd packages/datalab-ui && pnpm dev"
for p in pbui-chat pbui-plotscript pbui-ecommerce; do
  tmux new-window -t pbui-visual -n demo-$p "cd packages/$p/demo && pnpm dev"; done
```

## Step 2: Fan-out collection, and verifying the agents' claims

Five subagents ran in parallel against the twelve servers. Four have returned (demos, workbench + linking, CSS inventory, interaction states); the static storybook sweep is still running because it shoots ~250 stories and then views every one. This step records what each produced, which of their claims I verified against the images myself, and the two claims I rejected.

The main session did its own CSS reading in parallel (tokens, styles, the three parts files, the two Surfaces, workbench Tile, import graphs) so the analysis in the design doc is not second-hand: the agents' notes are evidence, the conclusions are mine.

### Prompt Context

**User prompt (verbatim):** (see Step 1, follow-ups)

**Assistant interpretation:** Use cheap agents for collection and story authoring; keep judgement in the main session; commit as the corpus lands.

**Inferred user intent:** A broad corpus quickly, with the analysis still coherent.

**Commit (code):** 4a009db — "PBUI-VISUAL-1: visual-audit stories, interaction scripts, demo/workbench/interaction screenshot corpus and notes"

### What I did
- Agent B (demos): `scripts/03-screenshot-demos.mjs`, 9 shots per demo (36) into `various/screenshots/demos/<demo>/`, notes in `various/notes-demos.md`. It found the chat demo needs its Go backend (proxy `/api` to :8090; `conversationsReady` blocks first render) and started it in tmux window `pbui-visual:backend-pbui-chat` with `GOWORK=off go run ./cmd/pbui-chat serve --port 8090` because `go.work` pins a toolchain newer than the installed one. datalab's demo renders from fixtures without :8080.
- Agent C (workbench + linking): new `packages/pbui-workbench/src/stories/VisualAudit.stories.tsx` (12 stories: PortBadge gallery, PortRail counts, tile header variants incl. nested tile-in-tile, Surface variants, SplitPane nested, WireLayer styles, RelationPalette/ShowChooser/RebalanceDialog open, CoordinationInspector, LinkAnnouncer, RebalanceSettings). `scripts/04-screenshot-workbench-interactions.mjs` drives the ecommerce Shop Scenes and RebalanceLab: menu open, connect-mode acceptable and refused targets, completed link with wires, pinned link, ambiguity menu, rebalance proposals. Notes in `various/notes-workbench.md`. `tsc` on pbui-workbench passes.
- Agent D (CSS inventory): `various/css-inventory.md`, 791 lines, seven sections with file:line evidence and 25 consolidation candidates.
- Agent E (interaction states): `scripts/05-screenshot-interactions.mjs`, 22 shots under `various/screenshots/interactions/<pkg>/`, plus `packages/pbui-sandbox/src/VisualAudit.stories.tsx` (all four devtools tiles on one running Counter program). Notes in `various/notes-interactions.md`.
- Verified by viewing: workbench-audit 003 (PortBadge gallery), 011 (tile header variants), workbench-interactions 001/002/004, datalab-workbench 001, demos 001 of each app, interactions core 004 and 008.
- Own CSS analysis (scratch notes, folded into the design doc): fallback drift table for eleven tokens across `public/*.css`; the datalab-only tokens (`--pbui-border-grid`, `--pbui-border-rule`, `--pbui-wash`, `--pbui-track-banner`, `--pbui-space-6`, `--pbui-selected-wash`); confirmation that pbui-chat reads `--pbui-border-grid` (7 sites) and `--pbui-border-rule` (5 sites) with no fallback and no definition in its own demo tokens; the import graph (`src/index.ts` bundles all three parts files, so datalab-ui's and the root preview's separate imports are redundant).
- Committed the stories, scripts, notes, inventory and the completed screenshot sets.

### Why
- The agents' per-screenshot lines are the raw material for the numbered feedback doc; their cross-package bullets are hypotheses that I check against the images before they go in the doc.

### What worked
- Storybook dev servers picked up the new `VisualAudit.stories.tsx` files without restart; the harness `--filter=visual-audit` found them on the next `/index.json` fetch.
- The `createRequire` trick for playwright worked from every script location.
- Every claim about elevation/radius checked out: the launcher (core Dialog) is the only rounded, shadowed, backdrop-dimmed surface; the accept chooser is the only sans-serif, shadowed box.

### What didn't work
- Agent C's observation 9 ("menu header plain in I-001, inverted in I-006") is a misread: I-001 shows the inverted header too. Dropped.
- Agent C's A-012 WireLayer story drew no wires in the static composition although the same links render in the interaction shots; likely a mount-timing issue in the story, not a WireLayer defect. Left as a follow-up, not a visual finding.
- Agent E could not capture the chat Composer's insert-object accept flow: clicking "insert object…" throws `runtime type "message" is not declared in the type graph (PBUI-KERNEL-1 C9)` from `isAcceptable()` and blanks the story. That is a real bug (`Composer.tsx` passes every vocabulary type to `pbui.accept`), recorded in the design doc as out of scope.
- Agent E's first two background runs were interrupted by its own wait-for-completion loop; it needed a nudge and a foreground rerun. Cost ~10 minutes.
- The first ticket commit (`97d52c7`) swept in 241 in-progress storybook screenshots from agent A because `git add $T` ran while the sweep was writing. Harmless (the final sweep overwrites them), but a future playbook should add the screenshot directories explicitly after the sweeps finish.

### What I learned
- The object menu is the one surface that is pixel-consistent everywhere (core, FileBrowser, chat widgets, ecommerce, datalab). Whatever is consolidated next should be measured against it.
- The tan `--pbui-selected` fill carries at least three meanings (selection, acceptable target, timeline kind tag) and one more in the workbench (refused target). Colour overload is a bigger consistency problem than colour variety.
- The four demos are four shells: dark masthead + status footer (datalab, chat), bare white top row (plotscript, ecommerce); tile-header tints on all tiles (datalab), two (plotscript), one (chat, ecommerce).

### What was tricky to build
- Sub-agents doing interaction screenshots tend to block on their own background tasks; giving them a foreground `timeout` invocation up front avoids the stall.
- Storybook's `index.json` story ids do not match the sidebar path one would guess (`applications-workbench`, not `pages-workbench`); agents must read the index rather than assume.

### What warrants a second pair of eyes
- The Composer crash (agent E, observation 1). It is reproducible from the pbui-chat storybook by clicking "insert object…" in any Composer story.
- The WireLayer static-story issue (agent C, A-012).

### What should be done in the future
- File the Composer crash and the WireLayer story issue as their own tickets.
- The playbook should sequence: servers up, sweeps, THEN `git add` of screenshot dirs.

### Code review instructions
- Stories: `packages/pbui-workbench/src/stories/VisualAudit.stories.tsx`, `packages/pbui-sandbox/src/VisualAudit.stories.tsx`.
- Scripts: `scripts/03-…`, `04-…`, `05-…` in the ticket; each has a usage comment at the top.
- Validate: `cd packages/pbui-workbench && pnpm typecheck`; re-run `node scripts/01-screenshot-storybook.mjs http://localhost:6008 /tmp/x --filter=visual-audit`.

### Technical details
- Chat backend: `tmux new-window -t pbui-visual -n backend-pbui-chat "GOWORK=off go run ./cmd/pbui-chat serve --port 8090"`.
- Fallback drift (token → fallbacks seen in `public/*.css` and package CSS, count): border-firm → `1.5px solid #1f2430` ×5 vs token `2px solid #23262b`; faint → `#8b857a` ×6, `#696e75` ×2, `#918c85` ×1; selected → `#e6ecf5` ×4 vs `#fdeec6` ×2; ink → `#1f2430` ×5, `#1c1b19` ×1; line → `#cfc9bd`, `#d8d2c6` vs token `#d9d9d4`; radius → `2px` ×2 vs `0`; fs-tiny → `10px` ×6 vs `9.5px`; danger → `#c0392b` ×2 vs `#b64b37`.

## Step 3: The feedback document: analysis plus a generated catalog

With all five collections in, the deliverable is assembled: a design doc whose first half is the hand-written analysis (executive summary with the ten highest-leverage fixes, the reference constraints, eight findings sections, a consolidation plan, questions for feedback) and whose second half is a generated catalog of all 663 screenshots, numbered `CODE-NNN`, grouped by package and by story title (which is the functional grouping the storybooks already encode), each with the collector's one-line "what is visible" and "oddity".

The catalog is generated by `scripts/06-build-catalog.py` from the manifests and the four notes files, so it can be regenerated after any re-sweep without touching the analysis. Exhibit codes map back to files: `C-155` is `various/screenshots/core/155-*.png`.

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Assistant interpretation:** Produce the markdown the user asked for: numbered screenshots with names, grouped by functionality and package, with my notes on what is inconsistent, foldable, and structurally inconsistent in the CSS.

**Inferred user intent:** Review by number, then decide the consolidation passes.

### What I did
- Wrote `scripts/06-build-catalog.py`: parses `manifest.json` per corpus directory and the `NNN | name | visible | oddities` lines from `notes-storybooks.md`, `notes-workbench.md`, `notes-interactions.md`, `notes-demos.md`; emits Parts A (demos), B (workbench + linking incl. ecommerce), C (interaction states), D (core), E (chat/plotscript/sandbox/editor), F (datalab-ui). 663 images, 641 with notes.
- Wrote the analysis into `design-doc/01-visual-audit-screenshots-and-inconsistency-notes.md` and appended the catalog. Filled the frontmatter Summary/WhatFor/WhenToUse.
- Verified every exhibit code cited in the analysis against the catalog headings and the file names (one correction: `C-015` → `C-016` for the dragging drop zone).
- Verified by viewing: `C-155` (Toolbar variants: the rounded buttons are raw native `<button>`s in the story, not a Toolbar defect), `EC-001` (header badge is cramped, not garbled), `DL-231` (TablePanel's half-width is the story's fixed container), `C-005` (Callout severities identical).
- Read the CSS inventory's §4 and §7 and folded its 25 candidates into the eight-step consolidation plan.

### Why
- Analysis first, catalog second: the user reads the top and dips into exhibits by number; the long tail stays browsable.
- Generated catalog: a future pass re-runs scripts 01 to 06 and diffs the analysis against fresh images.

### What worked
- The storybook story `title` doubles as the functional grouping (e.g. "Component Library/Molecules/Callout"), so no manual taxonomy was needed.
- Exhibit codes survived: all 100+ cited codes resolve to the intended screenshot.

### What didn't work
- Three sweep-agent claims did not survive verification and were reframed: the Toolbar "pill buttons" (`C-155`), the "garbled" ecommerce badge (`EC-001`), the TablePanel "layout bug" (`DL-231`). The agent's notes remain in the catalog as written; the analysis states the corrected reading.
- The generator prints the collector's note verbatim; a handful of notes are speculative ("worth confirming"). They are labelled as the collector's view by the italics/arrow convention, not as findings.

### What I learned
- The design system is consistent at the atom level (object menu, buttons, empty states) and inconsistent at the composition level (tiles, shells, cards, badges). Consolidation should start with tokens and parts files, because those fix many exhibits without touching any package.
- The "margins missing" symptom is often a missing token definition (`--pbui-border-grid` in chat) rather than a missing padding rule.

### What was tricky to build
- Keeping exhibit numbering stable: the number is the file prefix assigned by the harness (alphabetical by story title then name), so a new story shifts the numbers after it. The catalog is therefore tied to this corpus snapshot; a future run gets a new snapshot and a new catalog, and the analysis must be re-cited. A stable id would be the story id, but story ids are long; the code+number scheme is the compromise.

### What warrants a second pair of eyes
- The ten-item priority list and the eight-step plan in the design doc: they are my judgement calls, and the "Questions for feedback" section names the decisions I could not make alone (tint-by-kind, shell default, border-style as state language, backdrop dim, wiring overlay vs in-place wires, nesting depth).

### What should be done in the future
- After feedback: open one ticket per consolidation step (tokens; parts files; tile chrome; chip family; notices/banners; labels/structure; native controls; story hygiene) and re-run the corpus after each.
- Write the playbook (task 9) from Steps 1 to 3 once the procedure has been run a second time.

### Code review instructions
- Read the design doc top to "Questions for feedback" (about 250 lines); then spot-check exhibits by code.
- Regenerate: `python3 scripts/06-build-catalog.py > various/catalog.md` and re-assemble (the doc is analysis + catalog; the analysis part is the text above the "## Screenshot catalog" heading).

### Technical details
- Corpus codes: `REF`, `D-DL/D-CH/D-PS/D-EC` (demos), `WB` (workbench storybook), `WA` (workbench VisualAudit), `WI` (workbench driven), `EC`, `CH`, `PS`, `SB`, `ED`, `DL`, `DW` (datalab page stories), `I-C/I-CH/I-SB/I-ED/I-PS` (interaction states), `C` (core).

## Step 4: Feedback round one

The user answered the ten priorities by number after reviewing the document in md-view. Nine are adopted as written; the tile chrome decision is "datalab's, with the dark masthead"; item 3 (Dialog) is to be read through the rule "never rounded, always brutalist"; two terms needed explaining ("wash", "native controls").

### Prompt Context

**User prompt (verbatim):** "1. tile chrome = datalab, dark masthead
2. one chip
3. never rounded, always in this brutalist style. I'm not sure what that means for 3. 
4. yes
5. what's a wash?
6. yes
7. yes 
8. yes
9. yes 
10. what does that mean?"

**Assistant interpretation:** Decisions on priorities 1, 2, 4, 6–9; a style rule for 3 that needs translating into a concrete Dialog spec; two clarifying questions (5, 10).

**Inferred user intent:** Lock the direction so the consolidation tickets can be opened.

### What I did
- Added a "Decisions (feedback of 2026-09-04)" section to the design doc with the answers, the Dialog translation of "brutalist", and the two explanations.

### What worked
- Reviewing by exhibit number worked: the answers map one-to-one onto the priority list.

### What should be done in the future
- Confirm items 3 (backdrop dim or none) and 10 (skin natives globally vs. use atoms), then open the consolidation tickets in the plan's order.

### Code review instructions
- Design doc, "Decisions" section.
