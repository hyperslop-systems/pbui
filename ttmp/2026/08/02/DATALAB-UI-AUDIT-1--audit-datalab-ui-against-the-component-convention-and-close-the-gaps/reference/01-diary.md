---
Title: Diary
Ticket: DATALAB-UI-AUDIT-1
Status: active
Topics:
    - pbui
    - frontend
    - refactoring
DocType: reference
Intent: long-term
Owners: []
RelatedFiles:
    - Path: .ttmp.yaml
      Note: Stops docmgr walking up past the repo root into agentlogic (commit 1543c9f)
    - Path: packages/datalab-ui/src/apps/tiles.stories.tsx
      Note: A story for every registered application, looked up from the registry (commit 8e71970)
    - Path: packages/datalab-ui/src/components/brand
      Note: Brand.module.css split into three per-component modules (commit 3c36b06)
    - Path: packages/datalab-ui/test/stories.test.ts
      Note: Gained the Applications/Tiles group and the tile-story coverage guard (commit 8e71970)
    - Path: repo://packages/datalab-ui/src/components/brand/PhaseRule/PhaseRule.tsx
      Note: Gained a size prop so the lockup stops styling it through descendant selectors (commit 3c36b06)
ExternalSources:
    - docs/playbooks/refactoring-a-pbui-app-into-atoms-molecules-and-organisms.md
    - ../hyperblog/ui/src/apps/tiles.stories.tsx
Summary: 'Step-by-step record of auditing datalab-ui against §8 of the refactoring playbook: verifying the compliance claim independently, closing the two real gaps (no tile stories, a shared brand stylesheet), and deciding what not to touch.'
LastUpdated: 2026-08-02T00:00:00Z
WhatFor: Reviewing the DATALAB-UI-AUDIT-1 changes, and understanding why the audit produced four commits rather than a refactor.
WhenToUse: Read alongside analysis/01-audit-result. This is the narrative; that is the checklist.
---



# Diary

## Goal

Audit `packages/datalab-ui` against §8 of
`docs/playbooks/refactoring-a-pbui-app-into-atoms-molecules-and-organisms.md`,
verify independently the claim that the package is already ~100% compliant, and
close whatever gaps that verification finds — without churning code that already
follows the convention.

---

## Step 1: Fix the docmgr root before anything else

The brief warned that `--root ttmp` might resolve somewhere unexpected, and it
did. `docmgr --root ttmp ticket create-ticket` printed `created
DATALAB-UI-AUDIT-1 at /home/manuel/workspaces/2026-07-30/transcript-agent/agentlogic/ttmp/…`
— a success message pointing at a **different repository**. The ticket for a
pbui audit landed in agentlogic.

`docmgr config show` explained it in three lines: the `--root` flag is reported
as `<not applicable>`, and the winning source is `../.ttmp.yaml` found by
walking up. `pbui` had no `.ttmp.yaml` of its own, so the walk continued past
the repository root into the workspace directory, where a stray file names
`agentlogic/ttmp` as the root for everything beneath it.

### Prompt Context

**User prompt (verbatim):** "Write a playbook on how to refactor existing apps to have the proper layout and separation of views and components (atoms, molecules, organisms, stories files...). Then Launch subagents to cleaning up datalab and agentlogic according to the same principle. Tell them to keep detailed diaries as they work using the format in the skill, and to commit at appropriate itnervals."

**Assistant interpretation:** Audit `datalab-ui` against the just-written
refactoring playbook, close whatever genuinely fails, and keep a diary. The
briefing added that the package is believed already compliant, that the known
gap is the absence of tile stories, and that a large diff is a failure.

**Inferred user intent:** Bring the family's products onto one component
convention, with `datalab-ui` as the reference the others are measured against —
so establishing precisely *where* it is and is not the reference is worth more
than making changes.

**Commit (code):** `1543c9f` — "docs: give pbui its own .ttmp.yaml so docmgr resolves to this repo"

### What I did
- Ran `docmgr --root ttmp ticket create-ticket`; it succeeded into the wrong repo.
- Ran `docmgr config show` to see the resolution order.
- Deleted the misplaced ticket directory from `agentlogic/ttmp/2026/08/02/`.
- Wrote `/pbui/.ttmp.yaml` with `root: ttmp` and `vocabulary: ttmp/vocabulary.yaml`, matching the files `agentlogic` and `hyperblog` already carry.
- Re-created the ticket; `docmgr config show` now reports `.ttmp.yaml: .ttmp.yaml (current dir)`.

### Why
A tool that reports success while writing to the wrong repository is worse than
one that fails. Every later `docmgr doc add` in this session would have gone to
agentlogic too — including the audit document that is the main deliverable.

### What worked
The one-file fix. `docmgr config show` is the diagnostic; it should be the first
command anyone runs in an unfamiliar repository.

### What didn't work
`--root ttmp`. It is documented as a configuration source and is listed first in
the precedence order, but it was reported as `<not applicable>` and a
`.ttmp.yaml` two directories up beat it. Whether that is a docmgr bug or the
flag meaning something narrower than it reads, I did not chase — the fix is
correct either way, because `pbui` should have had the file regardless.

### What I learned
The trap is not "docmgr picked the wrong root". It is that **the walk does not
stop at a repository boundary.** A `.ttmp.yaml` in a workspace directory that
happens to contain several checkouts silently governs all of them.

### What was tricky to build
Nothing; the difficulty was noticing. The success message contains the full
absolute path, which is the only reason this was caught in the first minute
rather than at the end.

### What warrants a second pair of eyes
Whether `/home/manuel/workspaces/2026-07-30/transcript-agent/.ttmp.yaml` should
exist at all. I did not touch it — another agent may be relying on it — but a
config file above three sibling repositories, naming one of them, is a trap
waiting for the next person.

### What should be done in the future
Every repository in this workspace that can host a ticket should carry its own
`.ttmp.yaml`. Two of four now do not.

### Code review instructions
`git show 1543c9f`. One file, six lines. Verify with `cd pbui && docmgr config show`.

### Technical details
```
$ docmgr config show
Configuration sources (in precedence order):
  1.   --root flag: <not applicable>
  2. ✓ .ttmp.yaml: ../.ttmp.yaml (walking up)
Active configuration:
  root: …/agentlogic/ttmp
```

---

## Step 2: Verify the compliance claim rather than accept it

The briefing said `datalab-ui` was "essentially 100% compliant", citing a loop
over `src/components/*/*/` that printed nothing. I re-ran that loop, then ran
the check it was missing. The loop tests for `Name.tsx`, `Name.stories.tsx` and
`index.ts` — but not for `Name.module.css`, which is the second of the four
files the convention names. Adding that test printed 35 folders.

That is not the scandal it looks like. `test/stories.test.ts` already says, in
prose, that the CSS module is deliberately not required because several
components are pure composition and own no styles. So the claim was right about
the package and wrong about itself: it was a check whose *name* was broader than
its *body*. I spent the rest of this step establishing which of the two it was
by measuring the 35 directly.

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Assistant interpretation:** Do not take the compliance claim on trust; audit
every §8 property independently and report anything the claim got wrong.

**Inferred user intent:** Know whether the reference implementation actually is
one, in enough detail that another product can be measured against it.

### What I did
- Re-ran the briefing's loop: printed nothing, as claimed.
- Ran `find src/components -mindepth 2 -maxdepth 2 -type f`: **6 files** — four layer barrels, `brand/phases.ts`, and `brand/Brand.module.css`.
- Added the missing `.module.css` test to the loop: **35 folders** lack one.
- Counted properly: `find src/components -name '*.tsx' ! -name '*.stories.tsx' | wc -l` → **73**, not 184. Story files: 70. Exported story states: 297.
- Grepped the 35 CSS-less folders for `style=`: **31 have none**; 4 have a single token-valued inline declaration.
- Listed every selector in `src/styles/*.css`: **zero class selectors** across 575 lines.
- Ran the playbook's §6 grep for plain-string classNames: **no output**.
- Searched for `index.tsx` barrels (§7's trap): **none**.
- Searched for `@story-exempt`: **none used**.
- Read `test/stories.test.ts`, `test/no-raw-controls.test.ts`, `test/layers.test.ts`, `test/apps.test.ts`, `test/tokens-used.test.ts`.
- Green baseline: `pnpm typecheck` clean, `pnpm test` → 44 files, 514 tests, all passing.

### Why
§8 is a set of properties that are either true or not. The only way to report
them honestly is to run each one, and the only way to know a "pass" means
anything is to read the test that produces it.

### What worked
Reading the tests before trusting them. Two of them turned out to state a
deliberate deviation from the playbook *inside the test that would otherwise
enforce it* — which is the best possible place for that sentence to be, and
which I would have mis-reported as drift if I had only run the suite.

### What didn't work
Nothing failed here. The one thing I could not do was §8's last bullet: there is
no §2.3 screenshot baseline, because there was no prior refactor to take one
for. I substituted a stronger check later (Step 3, Step 4).

### What I learned
- **The tokens were right from the start, and that explains everything else.** §2.2 of the playbook argues that undefined tokens make PBUI's components render bare, which makes a raw `<button>` look *better*, which is how a product ends up using 6 of 28 components. This package has `test/tokens-used.test.ts` in CI, so that never happened — and its raw-control count is a consequence rather than a display of discipline.
- **`src/styles/` has zero class selectors.** Not "few". The two files that reach outside `:root` do so through PBUI's published `[data-part]` API, which is the theming seam for a package you do not own — those rules *cannot* move into a module, because a dependency renders the elements.
- The four component-layer barrels at depth 2 make §8's first bullet fail *for following §4*. The playbook contradicts itself and should be amended.

### What was tricky to build
N/A — measurement only.

### What warrants a second pair of eyes
The judgement in §2.2 of the audit document: that 35 components without a CSS
module is compliance rather than drift. My evidence is that 31 have no `style=`
at all. If a reviewer disagrees, the fix is 35 files, 31 of them empty, and I
think that is worse.

### What should be done in the future
The briefing's loop should grow the fourth test, or stop being cited as evidence
for a four-file claim.

### Code review instructions
Nothing to review. The numbers are reproduced in `analysis/01-audit-result…§2`,
each beside the command that produced it.

### Technical details
```bash
# what the claim checked
for d in src/components/*/*/; do n=$(basename "$d"); \
  [ -f "$d$n.tsx" ] && [ -f "$d$n.stories.tsx" ] && [ -f "$d/index.ts" ] || echo "$n"; done
# → nothing

# what it did not
for d in src/components/*/*/; do n=$(basename "$d"); \
  [ -f "$d$n.module.css" ] || echo "$n"; done | wc -l
# → 35
```

---

## Step 3: A story for every registered tile, from the registry

The real gap, and the one the briefing already knew about. 27 registered
applications, zero stories. `hyperblog/ui/src/apps/tiles.stories.tsx` is the
pattern and it does fit here — the registry shape is nearly identical
(`appFor`/`allApps` against `tile`/`allTiles`) — but three things had to change,
and each is about what makes a *datalab* tile interesting rather than a
hyperblog one.

The one I care about most is the store. `.storybook/withPbui` supplies a PBUI
context whose `onPerform` pushes verbs into a visible log. That is exactly right
for an atom: you can see the verb a chip emits. It is wrong for a tile, because
a tile's interesting behaviour is what its verbs *do to the world*. So these
stories set `pbui: false` and mount the product's own `WorkbenchProviders`,
whose `perform` runs `actionsForVerb` against a real store. Right-clicking a
chip in one of these stories dispatches.

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Assistant interpretation:** Decide whether hyperblog's registry-driven tile
story pattern fits datalab-ui, and if so implement it.

**Inferred user intent:** Make "every tile has a story" true by construction, so
it stays true.

**Commit (code):** `8e71970` — "datalab-ui: a story for every registered tile, rendered from the registry"

### What I did
- Read `hyperblog/ui/src/apps/tiles.stories.tsx`, `appkit/registry.ts`, `AppScope.tsx`, `TourContent.tsx`, `WorkbenchProviders.tsx`, `WorkbenchInstance.tsx`, `store/index.ts`, `store/stages.ts`, `.storybook/{preview,decorators,withPbui}.tsx`.
- Wrote `src/apps/tiles.stories.tsx`: a `Stage` that builds one store per story and mounts `Provider → AnalysisProvider → AppScope → WorkbenchProviders → TourContentProvider → the tile`.
- 34 stories: one per registered application, plus `ChartWithNoDocument`, `LauncherScoped`, the three tour tiles in and out of a tour, and `AllTiles`.
- Added `"Applications/Tiles"` to the sidebar-group whitelist in `test/stories.test.ts`, and a new `describe("tile story coverage")` asserting every `registerApp` id appears in a `renderTile("id"` call.
- `pnpm typecheck`, `pnpm lint`, `pnpm test` (517 passing), `pnpm build-storybook`.

### Why
An organism story proves the panel draws. It proves nothing about the container
above it, and the container is where the hooks, the derivations, the
`if (!me?.authenticated)` branch and the "no document" branch live. Those are
states of the product, and none of them had been looked at outside a running
workbench.

### What worked
- The registry lookup. `renderTile(id)` returns a named `EmptyState` when `appFor(id)` is null, so an application that stops registering itself breaks loudly. This matters more here than in hyperblog: `apps/all.ts` populates the registry through **27 side-effect imports**, and a tool that prunes an "unused" import empties a launcher slot in silence.
- `AllTiles` from `allApps()`. The contact sheet grows on its own, so "every tile has a story" is true by construction.
- The new test firing on its first run: `expected [ 'Design System/Foundation', …(10) ] to include 'Applications/Tiles'`. A guard that fails when you first do the thing it guards is a guard that works.

### What didn't work
Two false alarms in the browser verification, both mine:

- Every doc-bound tile "failed" with `TypeError: Failed to execute 'compile' on 'WebAssembly': Incorrect response MIME type. Expected 'application/wasm'.` My throwaway static server had no `.wasm` entry in its content-type map. duckdb-wasm was fine.
- `launcher-scoped` rendered **0 characters**, which looked like a real defect. It was the browser dying from the accumulated duckdb instances of the previous 14 stories — the next `page.goto` threw `Target page, context or browser has been closed`. Relaunching Chromium per story fixed it and `launcher-scoped` renders 319 characters.

### What I learned
- **`makeStore` seeds a document by default**, and that default would have silently deleted the `ChartWithNoDocument` story. `seed: !empty` is the whole fix, and it is the kind of thing you only find by looking at the rendered output rather than at whether the story throws.
- **The account tiles are the ones that pay.** With no server they render their signed-out branch — "not signed in", "sign in to publish a dataset" — which is precisely the state a first visitor sees and precisely the state a story is the only cheap way to reach.
- The layer graph in `test/layers.test.ts` **exempts stories deliberately**, with a paragraph explaining why: a story is a review surface, not shipped code, and its job is to compose whatever demonstrates the thing. That is what lets `apps/tiles.stories.tsx` import `components/pages/Workbench/WorkbenchProviders`, which production code in `apps/` may not.

### What was tricky to build
**The view, and it is the one thing in this file I would defend hardest.**

The obvious implementation synthesises an `AppView` literal: `{ id, appId,
documents: { primary: docId } }`. It renders identically. It is also a lie, and
the symptom would appear only to someone clicking: the document bar re-points a
view **in the layout slice**, by view id. A view the store has never heard of
makes that control a silent no-op — so the story would teach that the document
bar is broken, in a package where the document bar is the mechanism the whole
tiling model rests on.

The fix is to seed the placement and the view through `singleStageLayout("story",
(builder) => builder.leaf(id, docId))` — the same builder the product's stages
use — and then read the placement id and the view back out of the layout it
returns. Four extra lines, and the tile is a real tile in a real (one-leaf)
workspace.

### What warrants a second pair of eyes
- The `Stage`'s provider order. I matched `WorkbenchInstance` (`Provider → AnalysisProvider → AppScope → WorkbenchProviders`) rather than `Workbench` (which puts `AnalysisProvider` lower). If a tile turns out to need the shell's ordering, the symptom will be a hook throwing "must be used inside AnalysisProvider".
- Whether one store per *story* is right, or whether it should be one per *render*. StrictMode double-invokes; I used the `useRef` null-check that `WorkbenchInstance` documents for exactly this, so I believe it is right, but it is the kind of thing that fails intermittently if it is wrong.

### What should be done in the future
Point a Storybook test-runner at `Applications/Tiles`. The a11y addon is
configured `test: "error"` but nothing runs it — `vitest` here is
node-environment only — so 34 new stories over real providers are an a11y
surface nobody is checking.

### Code review instructions
- Start at `src/apps/tiles.stories.tsx`, at `Stage` and `renderTile`. Everything else in the file is a one-line story.
- The claim "no story reaches the network" is checkable: `makeStore({ fixtures: FIXTURES })` and nothing else. If a story ever needs `msw`, DR-48 has failed.
- Validate: `pnpm test` (the two new blocks in `test/stories.test.ts`), then `pnpm build-storybook` and open `Applications/Tiles/AllTiles`.

### Technical details
The verification harness (throwaway, not committed) served `storybook-static`
over plain `http`, launched Chromium per story, read `#storybook-root`'s
`innerText`, and failed on empty output, on "No application is registered", or
on any console error not matching `/Failed to load resource|\/v1\//`. Result:

```
34 tile stories
ok   applications-tiles--table     (21342) "DOC\nα · active\nα · lab\n＋\n№…"
ok   applications-tiles--all-tiles (17721) "new tile#launcher · world-scoped…"
…
ALL GOOD
```

---

## Step 4: Split the brand's shared stylesheet, and prove nothing moved

The only genuine convention violation inside `components/`:
`components/brand/Brand.module.css`, one sheet styling four components. It is a
CSS module rather than a global, so it does not have the namespace-collision
problem §1.2 leads with — but it has the other half of that argument, and it had
produced a concrete defect.

Three rules in it selected from one component into another:
`.lockup_masthead .bar`, `.lockup_footer .bar`, and a `gap: 0` on
`.lockup_*  .rule`. `.bar` and `.rule` are `PhaseRule`'s; `.lockup_*` is
`Lockup`'s. So **the same `<PhaseRule />` drew 8px bars in its own story and 4px
bars inside a masthead**, and two of its three appearances could not be storied
at all. That is the shared sheet costing something, not just offending a rule.

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Assistant interpretation:** Close the real gaps found by the audit, without
churning compliant code.

**Inferred user intent:** A small, defensible diff.

**Commit (code):** `3c36b06` — "datalab-ui: split brand's shared stylesheet into three modules"

### What I did
- Screenshotted all 23 stories under `Design System/Brand` and `Applications/Marketing` at 1100×900 into a before/ directory.
- Split `Brand.module.css` into `Wordmark/Wordmark.module.css`, `PhaseRule/PhaseRule.module.css` and `Lockup/Lockup.module.css`; deleted the original.
- Gave `PhaseRule` a `size?: "hero" | "masthead" | "footer"` prop, defaulting to `hero` (the previous rendering), owning both reduced bar heights and the `gap: 0` in its own module as `.rule_masthead` / `.rule_footer`.
- `Lockup` passes its own `size` down instead of styling through descendant selectors.
- Deleted `.claimRule .phaseLabel { color: inherit }` and the `className` that carried it.
- Added a `Sizes` story showing all three.
- Rebuilt, re-screenshotted, `cmp`'d every pair.

### Why
Rule 2 of the playbook: styles beside the component, never a shared sheet. The
reason it is a rule, stated concretely here: deleting `Wordmark/` would have
left `.wordmark`, `.hero`, `.masthead` and `.footer` behind forever, and there
was no way to tell from the folder which rules were still reached.

### What worked
**All 23 before/after screenshot pairs are byte-identical.** Not "look the
same" — `cmp` reports no difference. The only new image is the new `Sizes`
story. That is the check §6 of the playbook asks for, and it is the reason I was
willing to touch this at all.

### What didn't work
Nothing failed. The near-miss is worth recording: I nearly moved
`.claimRule .phaseLabel` into `Lockup.module.css` rather than reading it. It was
**dead**. `PhaseRule` with `on="ink"` sets the label colour as an *inline style*,
which wins against any class, so the rule had had no effect since the day that
prop was added. Moving it would have carried a dead rule into a new file and
made it look load-bearing.

### What I learned
A CSS module does not prevent the coupling a shared sheet invites. It prevents
*collisions*. `.lockup_masthead .bar` is a perfectly valid module selector and a
perfectly bad design — the module system had nothing to say about it, and the
only signal was that `PhaseRule`'s story could not show two of its three states.
**A component whose stories cannot reach a state it has is the symptom to watch
for.**

### What was tricky to build
Deciding whether to do it at all. The brief's non-negotiable is "do not churn
compliant code", and this is 8 files for a rendering change of zero. I did it
because (a) it is the single §8 failure in `components/`, (b) it is bounded — 4
components, 178 lines of CSS — and (c) the screenshot harness from Step 3 made
"prove nothing moved" cheap. Without (c) I would have written it up as a
follow-up instead. **Byte-identical screenshots are what turned a risky refactor
into a safe one**, and that is worth generalising: take the pictures first, and
the judgement call gets easier rather than braver.

### What warrants a second pair of eyes
- The `PhaseRule` default. I chose `size = "hero"`, which reproduces the old bare `<PhaseRule />`. Every existing call site is either bare (→ hero, unchanged) or inside `Lockup` (→ now explicit). If a *new* call site forgets the prop it gets 8px bars, which is the loud failure rather than the quiet one — but it is a default, and defaults are where this class of change goes wrong.
- The deleted `.claimRule` rule. My reasoning is that an inline style beats a class; if a reviewer disagrees, `Lockup/Lockup.stories.tsx`'s `Claim` story is the one to look at, and its screenshot is unchanged.

### What should be done in the future
N/A for this step.

### Code review instructions
- `git show 3c36b06`. Read `PhaseRule.tsx` first — the `size` prop and its doc comment are the change; the three CSS files are a move.
- The claim to check is that no selector in any of the three new modules names a class from another component. `grep -n '\.' src/components/brand/*/*.module.css` and look for a descendant combinator crossing a component boundary. There are none.
- Validate: `pnpm test && pnpm build-storybook`, then compare `Design System/Brand/PhaseRule/Sizes` against a lockup at each size.

### Technical details
```
identical  applications-marketing-page--default.png
identical  design-system-brand-lockup--claim.png
identical  design-system-brand-lockup--footer.png
…23 pairs…
new        design-system-brand-phaserule--sizes.png
```

---

## Step 5: Write the audit up as the deliverable

With two gaps closed and six properties passing, the main artifact is the
checklist itself: which §8 properties hold, which do not, what the evidence is,
and — the part that took longest to get right — what was deliberately left
alone and why.

The three "leave it alone" decisions are the ones a reviewer will push on: 35
components without a CSS module, `UploadApp` at 331 lines, and the four layer
barrels at depth 2. Each is written up with the measurement behind it rather
than the conclusion.

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Assistant interpretation:** Write the audit result as a proper analysis
document in the ticket, with each §8 item marked honestly.

**Inferred user intent:** A durable answer to "is datalab-ui really the
reference?", usable when auditing the next product.

### What I did
- `docmgr doc add --ticket DATALAB-UI-AUDIT-1 --doc-type analysis --title "Audit result: datalab-ui against the definition of done"`.
- Wrote §1 (the claim vs. reality), §2 (the eight properties), §3 (what changed), §4 (what was left alone), §5 (what to copy), §6 (follow-ups).
- Filled `Summary`, `WhatFor`, `WhenToUse` and `RelatedFiles` in the frontmatter.

### Why
The brief says this is the main deliverable if the code turns out to need little
work. It did.

### What worked
Marking §2.6 as a **split verdict** rather than pass or fail. `UploadApp` is 331
lines and fails the letter of "no tile over ~150 lines"; it contains one
`<UploadPanel/>` and passes the property that number is a proxy for. Forcing it
into a binary would have meant either hiding a real number or manufacturing a
refactor.

### What didn't work
N/A.

### What I learned
Writing §5 ("what another product should copy") surfaced the pattern shared by
all four of this package's guard tests: **an escape hatch that costs a
sentence**. Every one can be opted out of, every opt-out is a written
justification, and a stale justification fails its own test. That is why they are
still true a ticket after they were written, and it is the transferable idea.

### What was tricky to build
Being honest about the original claim without being unfair to it. "184
components, 70 stories, the loop prints nothing" is wrong on the first number
and incomplete on the third — but the *conclusion* it supported was right, and
the deviation it missed is documented inside the test that would enforce it. The
write-up says both.

### What warrants a second pair of eyes
§4's table. If a reviewer thinks any of those seven should have been changed,
that is the conversation, and the table is where to have it.

### What should be done in the future
Four follow-ups, in §6 of the audit: extract `useUpload`; amend §8's first
bullet in the playbook so it stops contradicting §4; run a Storybook test-runner
over the new tile stories for a11y; revisit the four inline `style=` props only
if one of those components grows a second rule.

### Code review instructions
Read `analysis/01-audit-result-datalab-ui-against-the-definition-of-done.md`
§2 top to bottom; every claim in it names the command that produced it.

### Technical details
Final state: 44 test files, 517 tests, all passing. `pnpm typecheck` clean,
`pnpm lint` clean over 450 files, `pnpm build-storybook` succeeds. Four commits:
`1543c9f`, `8e71970`, `3c36b06`, plus the documentation commit for this ticket.
