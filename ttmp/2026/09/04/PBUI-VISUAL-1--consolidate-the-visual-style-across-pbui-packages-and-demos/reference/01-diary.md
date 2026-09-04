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

## Step 5: Phase 1, tokens

Every token the family reads now has exactly one definition site, `src/tokens.css`. The 27 names that only datalab-ui defined are promoted (with datalab's values, which were the family's anyway), the whole tone family gets core defaults, a new `--pbui-tag-wash` exists for stateless chip fills, and every inline `var(--x, fallback)` in the four global sheets is gone. datalab's tokens sheet, a byte-for-byte copy of core plus those 27, is deleted.

The visible effect in this step is small and precise: pbui-chat's grid and rule borders render outside datalab for the first time, and the sandbox's widget tone no longer depends on the chat demo being the host.

### Prompt Context

**User prompt (verbatim):** "10. global skin. 
3. never ronuded

create a proper design doc and then work on it, commit at appropriate intervals and keep a detailed diary as you work (using the diary format from the skill). Print out a brutalist work slip with the plan / different phases for the ticket. then before stsarting a phase, plrint a split about the phase, and print one when the phase is done."

**Assistant interpretation:** Lock the last two decisions, write the phase-by-phase design (doc 02), then implement phase by phase with commits, diary steps, and a thermal slip at each phase boundary.

**Inferred user intent:** A traceable consolidation the user can follow from the printed slips and the diary, and re-run later.

**Commit (code):** b1e351f — "PBUI-VISUAL-1 P1: one token definition site"

### What I did
- `src/tokens.css`: added the family block (wash, selected-wash, tag-wash, neutral, space-6, border-rule, border-grid, track-banner, shadow-hard, shadow-menu), the tones (field, source, doc, step, chart, cat, geom, traceEntry, trace, tool, proposal, widget, row, product, order, metal, message, category), type-q/n, and the generated palette block (cat-1..8, ramp) with datalab's BEGIN/END markers so `make-tokens.ts` keeps working against core.
- Stripped fallbacks with a balanced-parenthesis rewrite (a regex on `[^)]*` would have broken `rgb(… / 45%)` fallbacks) in `public/components.css`, `public/presentation-parts.css`, `public/chrome.css`, `src/styles.css`; fixed `--pbui-well` → pane-alt, `--pbui-muted` → faint, `--pbui-border-hairline` → border-hair, `--pbui-shadow` → shadow-menu.
- Deleted `packages/datalab-ui/src/styles/tokens.css`; removed its import from `styles.ts` and datalab's storybook preview; root storybook preview imports `src/tokens.css` instead.
- datalab tests `tokens.test.ts`, `brand-tokens.test.ts`, `descriptor-coverage.test.ts`, `tokens-used.test.ts` and `scripts/make-tokens.ts` now read core's sheet (the two walkers prepend it to the `src/styles` walk; the value test strips comments first).
- Chat demo `tokens.css` reduced to its one real override (`--pbui-tone-source` red); `UploadApp.tsx` dead `--pbui-tone-datum` → `--pbui-tone-source`.
- Rebuilt `dist` and re-shot the chat widget story: `various/screenshots-phases/p1/chat-widget-streaming-table-after.png` (compare `CH-016`).

### Why
- A fallback literal is a second palette that only shows when the first is missing, which is exactly when nobody is looking.
- Packages consume `dist/pbui.css`, so the tokens must ship in core, not in one product.

### What worked
- All suites green after re-pointing the three datalab tests: core 51 files, workbench 23, chat 25 + demo 3, datalab 55 (602 tests), sandbox 18, ecommerce 7, editor 2.

### What didn't work
- First test run: datalab failed in three files that read `src/styles/*.css` for declarations, and the contrast test returned NaN because core's header comment contains the literal text `--pbui-ink: …`, which its unstripped regex matched. Fixed by stripping comments and adding core's sheet to the walked list.
- First re-shoot showed the widget edge grey instead of purple: the chat storybook reads `@hyperslop-systems/pbui/styles.css`, i.e. the built `dist`, which was stale. `pnpm build` at the root fixed it. Every later phase must rebuild before screenshotting a package storybook.

### What I learned
- The chat streaming table's heavy dashed frame was an artefact of `--pbui-border-rule` being undefined; with the token defined it is the intended faint dashed rule.

### What was tricky to build
- Keeping datalab's `tokens.test.ts` honest: it must still prove the cat palette equals `@hyperslop-systems/plot`'s, but core cannot depend on plot. The hex values are copied into core and the test reads core; `make-tokens.ts` regenerates core's block from plot when the palette changes.

### What warrants a second pair of eyes
- The tone assignments for names that had two definitions: core takes datalab's green for `tone-source` and the chat demo overrides it red locally.

### What should be done in the future
- N/A

### Code review instructions
- `git show b1e351f -- src/tokens.css public/ src/styles.css`; run `pnpm -s vitest run` at the root and in `packages/datalab-ui`.

### Technical details
- The rewrite: find `var(--pbui-x,`, walk forward counting parentheses to the matching close, replace the whole call with `var(--pbui-x)`.

## Step 6: Phase 2, parts files

The presentation parts had two definitions (a zero-specificity block in `src/styles.css` and the real sheet in `public/presentation-parts.css`), and the three attribute-styled components lived in a rem-and-slate sheet of their own. After this step there is one sheet per concern and every floating surface (menu, chooser, context help, dialog) is the same recipe.

The Dialog is the visible win: the launcher (`C-002`/`I-C-008`) went from a rounded, shadowed, sans-titled card on a blurred dim to a firm-bordered square panel with the ink header bar, exactly the object menu at dialog size.

### Prompt Context

**User prompt (verbatim):** (see Step 5)

**Assistant interpretation:** Phase 2 of doc 02.

**Inferred user intent:** Same as Step 5.

**Commit (code):** 10e1bc1 — "PBUI-VISUAL-1 P2: one definition of the parts, Dialog on the menu recipe"

### What I did
- `src/styles.css` → typography baseline only.
- `public/presentation-parts.css`: base presentation box (hair border, pane, ink-on-pane, context-menu cursor, space-1/space-3 padding), menu-item reset (border 0, font/color inherit, pointer), shared focus ring, `[data-danger]` colour, placeholder `div[data-part="menu-item"]` faint; accept chooser rewritten on the menu recipe (firm border, inverted tracked header, dotted separators, selected hover, font inherited); help title on the label idiom; help notice edge on `--pbui-tone-edge`.
- `public/components.css` rewritten: Dialog (flat dim, firm border, radius token, inverted header, tiny framed close, px paddings, hair footer rule), JsonBlock (pane-alt, grid border, font inherit, fs-small/lh-prose), InspectorPanel (space tokens, tracked faint title).
- Deleted `packages/datalab-ui/src/styles/dialogs.css`; `styles.ts` and the datalab storybook preview drop `components.css`/`presentation-parts.css`/`chrome.css` imports.
- Rebuilt dist; core 51 files and datalab 55 files green; shot launcher, JsonBlock, InspectorPanel, protocol menu, accept chooser. Screenshots in `various/screenshots-phases/p2/`: `launcher-after.png` (compare `C-002`), `json-block-after.png`, `inspector-panel-after.png`, `object-menu-after.png`, `accept-chooser-open-after.png` (compare `I-C-004`), and `chooser-closed-first-cut-lost-chip-border.png` (the regression described below, kept as evidence).

### Why
- Two definitions of a part is how the "sometimes plain header, sometimes inverted" class of inconsistency appears; the second definition only shows up when the first is missing, which is when nobody is looking.

### What worked
- `instanceChrome.test.tsx` still finds `position: fixed` and `z-index: 100` after the `[data-part="menu"]` split, and the hover/acceptable selectors.

### What didn't work
- First cut lost the presentation's base border: the hair box lived only in the deleted `:where` block, and the parts sheet had only cursor/display for `[data-part="presentation"]`. Caught on the chooser screenshot (bare text where chips should be). Same for the menu-item button reset. Both moved into the parts sheet.
- My first regex replacement of the presentation rule silently matched nothing because the real block contains a comment line; the second used a DOTALL block match and printed the replacement count. Print the count.

### What I learned
- A zero-specificity "fallback" block that always loses is still load-bearing when the winner never defined the property. Deleting the loser reveals every property the winner forgot.

### What was tricky to build
- The dialog close button sits on the ink header, so it is framed in paper, not ink; hover inverts it. The tile bar's close button is on a tinted bar and stays ink-framed. Same control, two grounds, two colours, one shape.

### What warrants a second pair of eyes
- Products that relied on the Dialog's old 680px fixed width: the panel is now `width: auto; min-width: min(380px, 100%); max-width: min(52rem, 100%)` (datalab's override value), so a dialog with narrow content is narrower than before.

### What should be done in the future
- N/A

### Code review instructions
- `git show 10e1bc1 -- src/styles.css public/presentation-parts.css public/components.css`; root vitest; open `chrome-kit--launcher` and `presentation-interaction-kernel-4--accept-chooser-and-banner` in the root storybook.

## Step 7: Phase 3, tile chrome, tones by kind, one AppShell

The biggest phase: the four page shells become one component, every tile bar is tinted by the kind of thing it shows, and the two nesting defects (frames flush against frames, invisible split gutters) are fixed in the chrome. The demos now open on the same masthead, strip, canvas and status row, with the tile tints doing the work the reference does with them.

Screenshots for this step are in `various/screenshots-phases/p3/`: the four demos after (`demo-*-initial-after.png`, compare `D-CH-001`, `D-PS-001`, `D-EC-001`, `D-DL-004`), the datalab workbench after (`demo-datalab-ui-workbench-after.png`) and the first cut that broke it (`…-first-cut-fragment-apps-centred.png`), the ecommerce workbench with a linked order and the inspector's JsonBlock (`demo-ecommerce-linked-after.png`), the workbench tile-header gallery with the nested gutter (`workbench-tile-header-variants-after.png`, compare `WA-011`), and the new AppShell story.

### Prompt Context

**User prompt (verbatim):** (see Step 5) and, mid-phase: "btw save the screnshots for the diary, as well."

**Assistant interpretation:** Phase 3 of doc 02; keep the verification screenshots in the ticket and cite them from the diary from now on (Steps 5 and 6 were back-filled).

**Inferred user intent:** The diary should show the visual result of each phase, not only describe it.

**Commit (code):** 80fadf4 — "PBUI-VISUAL-1 P3: tile chrome, tones by kind, one AppShell"

### What I did
- `public/chrome.css`: `tile-title` is `flex: 0 1 auto; min-width: 3ch` so a port badge after it survives narrowing; `[data-part="tile-body"] [data-part="workbench"]` gets `space-2` padding on the wash (the nested gutter).
- `pbui-workbench`: new `components/AppShell` (masthead with uppercase banner-tracked wordmark, optional tagline and actions; `banner` slot; strip row on paper under a grid rule; canvas on the wash as a one-cell grid; status row) with a story; exported. `WorkspaceStrip` frames every tab and marks the active one `selected`; the add button is framed and labelled. `SplitPane` divider is a wash gutter with faint grip dots and a selected-wash hover. `Tile.module.css` `.app` is a flex column, and a one-cell grid only when the app has a single root (`:not(:has(> * + *))`). `Surface.module.css` reads `--pbui-wash` without fallback.
- Tones: ecommerce (orders/order detail → order, customers/customer detail → row, catalog → product, inspector → tool, plot → chart), plotscript (script → step, plot → chart), chat app defaults (conversation → message, inspector → tool, watchlist → row), workbench stories (counter → step, notes → cat, audit apps → source/field/cat, identity lab → chart). `--pbui-tone-tool` lightened to #b9bec7 because a tile bar must carry ink text.
- Core `AppBody` spreads HTML attributes; the workbench story apps render through it.
- Shell migrations: chat demo `App.tsx` (strip moved into a `Strip` component, accept banner in the banner slot, `App.module.css` deleted), plotscript demo, ecommerce `ShopShell` (new `mastheadActions` prop; the demo's top bar folds into it; `ShopShell.module.css` deleted; launcher and menu mount beside the shell), datalab `WorkbenchShell` (masthead, StageBar, AcceptBanner, strip, full-frame toggle and MouseDocLine mapped onto the slots; `Workbench.module.css` reduced to the launcher-open active ring). datalab's inline strip tab: hair border, pane/selected.
- datalab `styles.ts` and its storybook preview import `@hyperslop-systems/pbui-workbench/styles.css`.
- Demo script accepts `OUT_ROOT` so re-shoots go to scratch instead of overwriting the before-corpus.

### Why
- One shell component is the only way four products stop drifting; the slots are the product's, the geometry is the shell's.
- Tints by kind are the reference's device for telling tiles apart at a glance; chart-palette colours on bars read as decoration.

### What worked
- Typecheck clean in workbench, ecommerce (+demo), chat demo, plotscript demo, datalab after rebuilding the package dists; workbench 23, datalab 55, chat demo 3, ecommerce 7 test files green.
- The `:has()` split between single-root and fragment apps kept ecommerce/chat (single root, committed cell) and datalab (fragments) both correct without touching any app.

### What didn't work
- First typecheck: `Surface as="header"` is not in Surface's element union; used `section`.
- The other packages typechecked against pbui-workbench's stale `dist` ("no exported member AppShell"); every cross-package change needs `pnpm -r build` before typecheck and screenshots. The plotscript and chat demos also showed old tones until their own packages were rebuilt.
- datalab's first re-shoot came out with the doc bar centred in the middle of each tile: importing the workbench stylesheet for the first time applied `.app`'s one-cell grid to apps that render fragments, so the first child took the 1fr row. Fixed with the `:has()` rule above. The screenshot is kept in `screenshots-phases/p3/`.
- `packages/pbui-plotscript` `tiles.test.tsx` failed once ("expected null not to be null" on the plot svg after an error) and passed on the next two runs and on the pre-change tree: a timing flake, not this change.
- pbui-workbench's `component-folders.test.ts` requires a story per component folder; added `AppShell.stories.tsx`.

### What I learned
- datalab had never loaded pbui-workbench's module CSS; its layout worked by accident of block flow. Importing the sheet exposed the fragment-app assumption immediately.
- The dark grey that works as a chip edge (`tone-tool`) does not work as a bar tint; the tone family needs to be light enough for ink text everywhere it can land.

### What was tricky to build
- Where fixed-position parts go: the ecommerce shell rendered the launcher, object menu and accept banner inside its grid; in a one-cell canvas they would have become implicit rows. The banner goes in the `banner` slot, the launcher and menu mount as siblings of the shell inside the provider.
- The chat demo's strip was rendered inside its `Workbench` component together with the surface; splitting it out into a `Strip` component was a regex over the JSX block bounded by two markers, with the block reinserted as a new function.

### What warrants a second pair of eyes
- The `:has()` selector in `Tile.module.css`: supported by every current browser, but it is the first `:has()` in the repo.
- `WorkspaceStrip`'s add button now reads "+ workspace" instead of "+"; the ecommerce e2e and chat demo tests did not depend on it, but a product test elsewhere might.

### What should be done in the future
- Phase 4 replaces the port badge and datalab's strip tab (still an inline-styled span) with `Chip`.

### Code review instructions
- `git show 80fadf4 --stat`; read `packages/pbui-workbench/src/components/AppShell/AppShell.tsx` and the four call sites; open the demos on :5173–:5176 and the `Workbench/AppShell` story on :6008.
- Validate: `pnpm -r --filter '!@hyperslop-systems/datalab-ui' --filter '!./packages/*/demo' build`, then typecheck and vitest in the packages listed above.

## Step 8: Phase 5, notices and the mode banner (landed before Phase 4's datalab half)

Phase 4's datalab migration is running in a subagent, so Phase 5 was written in parallel on files the agent does not touch and committed first; the Phase 4 commit follows when the agent reports. The P5 start slip was printed late for the same reason.

Screenshots: `various/screenshots-phases/p5/`: `callout-variants-after.png` (compare `C-006`), `accept-banner-mode-after.png` (compare `I-C-003`), `chat-widget-invalid-after.png` (compare `CH-013`), `chat-proposal-card-after.png` (compare `CH-017`).

### Prompt Context

**User prompt (verbatim):** (see Step 5)

**Assistant interpretation:** Phase 5 of doc 02.

**Inferred user intent:** Same as Step 5.

**Commit (code):** 87caa13 — "PBUI-VISUAL-1 P5: one notice, one mode banner"

### What I did
- Core `Callout`: new module CSS (paper, hair border, 4px `--callout-tone` edge, radius token, space-2/space-3 padding), `variant` gains `danger`, new `hint` and `onDismiss`; `role="alert"` for danger, `status` otherwise; the story's "why there is no danger variant" note replaced by the role split.
- `presentation-parts.css`: refusal notice on the Callout recipe; accept banner ink/paper with a gold `accept-banner-mode` span (added in `createPbui.tsx`) and a faint-inverted hint; workbench placing banner's bold word gold.
- Severity: chat invalid document, widget error, failed run; sandbox program error; workbench tile "could not render" → danger. plotscript `RunPane` wraps the diagnostic in a danger Callout with a title that says whether the script threw or returned something undrawable.
- ProposalCard: inner box gets paper + hair border + edge; the outer Surface loses its firm border (it drew a box around the box).

### Why
- One recipe for "something to know" and one for "the system is in a mode" is decision 7; the edge is already the family's tone idiom.

### What worked
- Core 51, workbench 23, chat 25, sandbox 18, plotscript 5 test files green.

### What didn't work
- First ProposalCard cut was a hair box inside a firm box: the card's Surface already had a border. Removed the outer one; screenshot re-taken.

### What I learned
- The refusal notice was already on the right recipe; only its paddings differed. Consistency problems are often one property away.

### What was tricky to build
- Nothing beyond keeping the commit paths separate from the running agent's.

### What warrants a second pair of eyes
- Announcing chat's failed run as `role="alert"` instead of status: correct for a failure, but noisier for screen readers in a busy transcript.

### What should be done in the future
- datalab's `ErrorNotice` (an inline glyph + red text, not a box) is left as the inline form-error idiom; if it should become a Callout, that is a one-line change per call site.

### Code review instructions
- `git show 87caa13 -- src/components/molecules/Callout public/presentation-parts.css`; the `Component Library/Molecules/Callout` stories on :6006.

## Step 9: Phase 4, one Chip

The fifteen chip implementations become one component with five knobs. The core `Chip` grew the variants the family actually uses; the workbench's port badge became a tiny edgeless chip; a subagent folded datalab's badges onto it. Interactive small boxes stay buttons, which is now written into the Chip's doc comment.

Screenshots: `various/screenshots-phases/p4/`: `chip-states.png` and `chip-sizes-fills-edges.png` (the new core stories), `port-badge-gallery-after.png` (compare `WA-003`), `port-rail-after.png` (compare `WA-004`).

### Prompt Context

**User prompt (verbatim):** (see Step 5)

**Assistant interpretation:** Phase 4 of doc 02.

**Inferred user intent:** Same as Step 5.

**Commit (code):** d4021ce — "PBUI-VISUAL-1 P4: one Chip"

### What I did
- `Chip`: `size`, `fill`, `edge`, `glyph`, states `empty | unresolved | held | revoked` beside `active | stale | disabled`, `...rest` passthrough; `--chip-tone` custom property carries the tone to the edge or the fill. Stories: States (eight), "sizes, fills, edges" (with the port-badge row). `index.ts` exports the new types.
- `PortBadge` → Chip (`size="tiny" edge={false}`, glyph from the kernel, state mapped: ambient/empty → empty, unresolved, held); `data-part/data-state/data-port` kept for the ecommerce e2e. `PortRail.module.css` rewritten on tokens (one hairline per card, acceptable = firm dashed + selected fill, refused = faint on line; `font: inherit` on the cards).
- datalab (subagent): RoleBadge, ScopeChip, TypeBadge, StepRow.kind, TracePanel.kind, TemplateTable.kind/app, WorkspaceStrip tab → Chip; four modules deleted; TokenChip revoked state; TruncationNotice → Callout warning (a sentence, not a tag); an unused part id removed. FieldChip/SourceChip/UserChip/DocChip already wrapped Chip correctly. StateGlyph and Tick stay.
- ecommerce's status pills were already core Chips (default / hold → stale / cancelled → disabled); nothing to migrate.

### Why
- Decision 2. Border style as the one state language is what keeps a badge, a pill and a tag legible in greyscale and identical across products.

### What worked
- Core 51, workbench 23, datalab 55 (602 tests) green; the ecommerce e2e selectors still resolve.

### What didn't work
- `ChipState` was not exported because the Chip folder's `index.ts` listed only `Chip` and `ChipProps`; workbench typecheck caught it.
- The port rail's text renders in Storybook's own sans font in the package storybooks: Storybook's preview stylesheet sets a body font at higher specificity than the zero-specificity baseline, and only the root storybook has a `base.css` that sets the family font on `body`. Not a product defect; fixed in Phase 8 by giving every package preview the same base.

### What I learned
- The chip's state vocabulary (dashed = not really there, dotted = cannot be found, double = pinned) covers ports, tokens, fields and status pills without a colour per state.

### What was tricky to build
- Keeping `data-state` meaningful twice: the Chip sets it to the chip state, the PortBadge overrides it with the kernel's badge state (what the e2e waits on) while the chip's classes still come from the mapped state. Attribute passthrough spreads last, so the override is a one-liner rather than a fork.

### What warrants a second pair of eyes
- `ScopeChip` and `TracePanel`'s kind tag got `edge={false}` by the agent's judgement (neither names a presentation type). Reasonable; flagging it.

### What should be done in the future
- datalab's `ModuleCard`/`CheatCard` key/value grids are Phase 6 material and were left alone here to avoid two agents in one package.

### Code review instructions
- `git show d4021ce -- src/components/atoms/Chip packages/pbui-workbench/src/components/PortBadge`; the `Design System/Atoms/Chip` stories on :6006 and `Visual Audit/port badge gallery` on :6008.

## Step 10: Phase 7, the native-control skin

The last raw elements in the family (a story's plain buttons, a sandboxed program's − and +, the kernel's radios, a demo's checkbox) now take the family's shape without anyone wrapping them. It is one block in `src/styles.css`, zero-specificity, opted out by any class or `data-part`.

Screenshots: `various/screenshots-phases/p7/raw-buttons-in-toolbar-after.png` (compare `C-155`), `raw-radios-after.png` (compare `I-C-005`); the sandbox program's buttons were checked on the `Visual Audit/Sandbox Devtools` story (compare `I-SB-001`).

### Prompt Context

**User prompt (verbatim):** (see Step 5)

**Assistant interpretation:** Phase 7 of doc 02, decision 10 (global skin first, atoms second).

**Inferred user intent:** Same as Step 5.

**Commit (code):** 2fdc172 — "PBUI-VISUAL-1 P7: a zero-specificity skin for native controls"

### What I did
- `src/styles.css`: `:where(input[type=checkbox|radio])` square/circle, ink when checked (inset paper ring); `:where(select)` hairline box with an inline-SVG ink chevron; `:where(button)` framed tiny look with hover and disabled; bare text inputs; one focus ring. All guarded by `:not([class]):not([data-part])`.
- Verified on the Toolbar variants story, the explain-the-menu radios, the sandbox devtools story and datalab's workbench story.

### Why
- Decision 10: the floor first, so every product improves at once; atoms remain the recommendation.

### What worked
- Core 51 test files green; no product test depends on native control geometry.

### What didn't work
- N/A

### What I learned
- The guard matters more than the rules: without `:not([class])` the skin would have fought the atoms' modules on every button; with it, the skin only ever touches an element nobody styled.

### What was tricky to build
- A `<select>` cannot carry a pseudo-element, so the chevron is a data-URI SVG background with the ink colour literal inside the SVG (a token cannot be read inside a URL). If `--pbui-ink` changes, this one literal has to follow; it is commented.

### What warrants a second pair of eyes
- A product that renders an unclassed `<button>` on purpose as a text link now gets a framed box. None found in the repo; a consumer outside it might.

### What should be done in the future
- Give `SelectInput` the same chevron so the atom and the floor are identical.

### Code review instructions
- `git show 2fdc172 -- src/styles.css`; the `Design System/Layout/Toolbar` "variants" story on :6006 renders three raw buttons.

## Step 11: Phase 6, labels, TileHeader, KeyValueList

The structural duplications the inventory counted (seven uppercase-label idioms, fifteen hand-written tile header rows, seven facts grids, the ecommerce sheet full of literals) collapse onto two new core components and one token. A subagent did the package migrations against the built core; datalab's ModuleCard I did by hand since the chip agent had just left that package.

No new screenshots for this step: the header row and the facts grid look as before by design; the after-corpus in Step 12 is the evidence.

### Prompt Context

**User prompt (verbatim):** (see Step 5)

**Assistant interpretation:** Phase 6 of doc 02.

**Inferred user intent:** Same as Step 5.

**Commit (code):** 5d72e5f — "PBUI-VISUAL-1 P6: one label idiom, TileHeader, KeyValueList"

### What I did
- Core: `organisms/TileHeader` (Toolbar as header, tight, bordered; title strong tiny; children; spacer; faint status; actions) and `molecules/KeyValueList` (dl grid, keys faint uppercase tracked, `dense`), each with a story; exported. Dead `.raised`/`.floating` removed from Surface's module.
- Tracking literals in SkuApp, InventoryApp (chat demo), UINodeRenderer (sandbox), CoordinationInspector (workbench), ecommerce tiles → `var(--pbui-track-label)`. Ecommerce `tiles.module.css`: fs/space/border/colour tokens replace 12px/11px/px paddings/color-mix/opacity; `.facts` and `.spacer` deleted.
- Subagent migrations: ecommerce 7 TileHeaders + 2 KeyValueLists; sandbox 5 TileHeaders + 1 KeyValueList (ReplTile and TimelineTile keep their control toolbars, which are not headers); plotscript 2 TileHeaders (run/auto as actions, status chip as children); workbench CoordinationInspector 1; chat ContextTile 1 + 1 dense list. Tests updated to the new `data-part`s rather than weakened.
- datalab `ModuleCard` → KeyValueList; its rows CSS deleted. `CheatCard` keeps its flex layout on purpose (its comment explains why a grid reads worse for that card).

### Why
- Decision 9 and the inventory's §4.2/4.4/4.6: the same three-part header and the same two-column grid should not be re-authored per package.

### What worked
- Build of every library package, typecheck of eight targets, and tests: ecommerce 35, sandbox 224, plotscript 32, workbench 116, chat 241, chat demo 13, datalab 602.

### What didn't work
- Giving plotscript's ScriptTile a real title (TileHeader requires one) put the script's name on screen twice (script tile and plot tile), which broke an unscoped `getByText` in `tiles.test.tsx`; the assertion is now scoped to the plot view. Both titles are correct.
- `ShopPlot`'s title lost a `truncate` prop that TileHeader does not have; the toolbar wraps, so it is inert. Flagged.

### What I learned
- A required `title` on a shared header is a useful lint: two tiles had been rendering without one.

### What was tricky to build
- Deciding which toolbars are headers: a row that is title + status + actions is; a row of controls (REPL, timeline filters) is not, and forcing it through TileHeader would have faked a title.

### What warrants a second pair of eyes
- The ecommerce table header's colour moved from `opacity: 0.7` on ink to `--pbui-faint`; the faint token is the same idea, but the exact grey differs.

### What should be done in the future
- `TilesPanel.head` in chat (title + close button) could take TileHeader's `actions`; left as is since it is not a status row.

### Code review instructions
- `git show 5d72e5f --stat`; `src/components/organisms/TileHeader`, `src/components/molecules/KeyValueList`; the ecommerce `Shop Scenes` stories on :6012.

## Step 12: Phase 8, story hygiene and the after-corpus

The last phase fixes the stories that lied about the components and re-shoots the whole corpus with the same scripts and port map. Doc 03 sets the before-corpus and the after-corpus side by side for the ten priorities (38 paired exhibits, matched by story id or scenario slug so renumbering between sweeps does not matter) and lists what remains open.

Screenshots: `various/screenshots-after/` (the full after-corpus: core 167, chat 19, workbench 44, sandbox 3, editor 5, plotscript 4, ecommerce 29, datalab 332, demos 36, workbench interactions 7, interactions 21) and `various/screenshots-phases/p8/` (PhaseIcon ink, PhaseRule bars, Tour section, WireLayer story, Composer insert-object after).

### Prompt Context

**User prompt (verbatim):** (see Step 5)

**Assistant interpretation:** Phase 8 of doc 02, then the after-corpus and the comparison document.

**Inferred user intent:** See the result of the whole pass in one place, in the same form as the audit that started it.

**Commit (code):** 8004224 — "PBUI-VISUAL-1 P8: story hygiene"

### What I did
- `.storybook/base.css` + import in the six package previews (chat, workbench, sandbox, editor, plotscript, ecommerce); datalab's preview imports `brand.css`.
- datalab: PhaseIcon "Ink" story gets `color: paper`; TourSection stories wrap in `AnalysisProvider` like TutorialBand's.
- workbench: the WireLayer audit story performs `linkVerbs.openMode()` in a `useEffect` after mount.
- chat: `Composer.insertObject` filters the vocabulary's types through `chat.registry.has`; verified in the storybook with a playwright click (no page errors, the accept banner appears).
- `scripts/07-after-corpus.sh`: waits for the twelve ports, runs scripts 01 (×8), 03, 04, 05 into `screenshots-after/`. `scripts/08-build-after-doc.py`: builds doc 03's exhibits from the two corpora.
- Rebuilt every library, restarted the eight storybooks, ran `pnpm -r test` (ten packages green as of writing; root reported green in every phase).

### Why
- A story that renders blank or black-on-black is a false negative in every future audit; the after-corpus is only comparable if the stories are honest.

### What worked
- The id-matched pairing: 38 of 38 exhibits found both halves after two id corrections (the guessed `typebadge--all-types` and `workbench-tile--default` did not exist; the manifests gave the real ids).

### What didn't work
- Storybook's index reported "Could not parse import/exports with acorn" for the two story files I had just edited; it was a stale indexing failure from a mid-write read and cleared on `touch`. Recorded because it looks like a syntax error and is not one.
- Playwright's first Composer probe targeted a story id that does not exist (`composer--default`); the index lists `composer--empty`.

### What I learned
- Storybook's preview stylesheet is a consumer like any product: it sets `body`'s font at class specificity, so the library's zero-specificity baseline never reaches a package storybook without a base sheet. The root storybook had one since the audit began; the packages did not, which is why their inherited text looked sans in the before-corpus.

### What was tricky to build
- Keeping the before-corpus intact: scripts 03/04/05 defaulted to the before directories; 03 got an `OUT_ROOT` override in Phase 3 and 04/05 already took an argument. Script 07 passes all three.

### What warrants a second pair of eyes
- Doc 03's "still open" list is my judgement of what is polish versus what is a decision; the accept banner's long type list and the wire routing are the two that need one.

### What should be done in the future
- Write `playbooks/01-visual-audit.md` from Steps 1, 2 and 12 plus script 07 after the next pass; open the follow-up tickets listed in doc 03.

### Code review instructions
- Read doc 03 top to bottom (the exhibits are images; the prose is 60 lines); then `git log --oneline b1e351f^..HEAD` for the eight phase commits.
- Regenerate: `bash scripts/07-after-corpus.sh && python3 scripts/08-build-after-doc.py > various/before-after.md`.

## Step 13: Feedback round two: the presentation is a chip

Reviewing the storybooks, the user pointed at four things: a nested box around the header port badge, order presentations without a coloured edge, the chat PanelApp story's misplaced status bar and doubled product boxes, and prose mentions that were not proper presentations. All four are one defect: the presentation element drew a plain box while the Chip drew the family's edged box, and products patched the gap per type.

Screenshots: `various/screenshots-phases/feedback-1/`: `ecommerce-seeded-after.png`, `chat-panelapp-after.png`, `chat-widget-health-after.png`, `chat-markdown-mentions-after.png`.

### Prompt Context

**User prompt (verbatim):** "more things to adjust: [Image #2] in http://localhost:6012/?path=/story/shop-scenes--seeded (shouldn't have nested border box around the port, keep the dotted border
. [Image #3]

order presentations don't seem to have a colored line on the left?

---

On http://localhost:6007/?path=/story/apps-panelapp--the-panels-as-tiles

[Image #4]

status bar is badly placed.
double border on the products. 
product on the left (1oz america gone gold) different from on the right
Unclear status bar and not a normal tile it seems like (doesn't need t). Also [the Eagle] and [pricing policy $3] on the left are not proper presentations.

[Image #6]"

**Assistant interpretation:** Make the kernel's presentation element render as the family's chip (hair box + type edge), stop wrapping chips in a second box, and fix the story layout.

**Inferred user intent:** Objects should look the same wherever they appear, without per-product CSS.

**Commit (code):** 20ec2d2 — "PBUI-VISUAL-1 feedback 1: every presentation carries its type's edge; a chip is the box"

### What I did
- `createPbui.tsx`: `presentationToneVar(tone, type)` → `var(--pbui-tone-<type>, <semantic>)` (accent → cat-2, positive → ok, warning → cat-3, danger → danger, a `var(...)` tone as is, else neutral), set as `--pbui-presentation-tone` inline on the element.
- `presentation-parts.css`: base presentation gets `border-left: var(--pbui-tone-edge) solid var(--pbui-presentation-tone, …)`; `[role="none"]` (inComposite) keeps a plain hairline; `:has(> [data-part="chip"])` removes the presentation's box/padding/background and moves hover onto the chip.
- `Chip.module.css`: `--chip-tone` defaults to the inherited presentation tone.
- chat: `.mention` loses its forced neutral edge; the demo's eleven `[data-ptype]` edge rules are deleted; PanelApp story cells are `minmax(0,1fr)` with `overflow: auto`.
- Verified by DOM probe: order cells resolve to `4px solid rgb(124,174,155)` (the order tone); mentions to product gold and source red.

### What worked
- Core 51, chat 25, ecommerce 7, workbench 23 test files green.

### What didn't work
- My react-import rewrite in `createPbui.tsx` produced `, type CSSProperties }` on its own line (the regex assumed a single-line import); TS1003 at line 14, fixed by hand.
- The failed build left the package storybooks with a half-built dist in their Vite cache: chips rendered with no box at all in the next shots. Restarting the two storybooks with `node_modules/.cache` removed fixed it. Rule: after a failed core build, restart the package storybooks before trusting a screenshot.
- The first DOM probe on the mentions returned widget children instead (same `data-part`); filtering by text found the mentions and showed the chat markdown module overriding the edge at (0,1,0).

### What I learned
- The chat demo's per-type edge rules were the product-side workaround for exactly this kernel gap; deleting them without the kernel change would have removed the only edges the demo had.

### What was tricky to build
- Deciding what a composite-owned presentation looks like: a tile title wrapped in a presentation would have grown an edge too; `role="none"` is the attribute the kernel already sets for `inComposite`, so it doubles as the style hook.

### What warrants a second pair of eyes
- `:has()` is now load-bearing in the parts sheet (and in Tile.module.css since P3).
- Semantic tone mapping (accent → cat-2) is a guess at intent; the ecommerce descriptors use `accent` for orders and customers, which the type token now overrides anyway.

### What should be done in the future
- The chat inspector's subject box (RefPresentation of a long label) wraps to two lines inside a wide box; a `Chip` with ellipsis would match the watchlist row.

### Code review instructions
- `git show 20ec2d2 -- src/presentation/createPbui.tsx public/presentation-parts.css`; `shop-scenes--seeded` on :6012, `pbui-chat-pbuimarkdown--resolved` on :6007.
