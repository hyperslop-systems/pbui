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
RelatedFiles: []
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
