---
Title: Diary
Ticket: PBUI-HARDEN-1
Status: active
Topics:
    - pbui
    - frontend
    - design
    - api
    - css
    - accessibility
DocType: reference
Intent: long-term
Owners: []
RelatedFiles:
    - Path: repo://src/styles.css
      Note: the orphaned fallback sheet, its own muted-text bug, and the typographic baseline (Step 1)
    - Path: repo://src/index.ts
      Note: now assembles the whole stylesheet; the import order IS the cascade (Step 1)
    - Path: repo://src/styles-wiring.test.ts
      Note: the orphan and cascade-order guard, mutation-tested both ways (Step 1)
ExternalSources: []
Summary: 'Implementation diary for PBUI-HARDEN-1 — six pbui defects reducing to two root causes, fixed in six phases.'
LastUpdated: 2026-08-03T11:31:03.293735153-04:00
WhatFor: The chronological record of what was tried, what failed, and why each decision was taken.
WhenToUse: Before resuming this ticket, or when reviewing a phase's diff.
---

# Diary

## Goal

Implementing PBUI-HARDEN-1: six pbui defects that reduce to two root causes —
a field whose meaning depends on another field, and a safety net that nothing
imports. Six phases, ordered so the non-breaking fixes for live defects land
before the breaking API changes.

## Step 1: Phase 1 — shipping the CSS that was never wired

`src/styles.css` is 100 lines of zero-specificity fallbacks for the
presentation parts, written to make a bare consumer legible, carrying a header
that explains precisely what it protects against. `src/index.ts` imported
`tokens.css` and not it, so Vite never pulled it into the module graph and none
of it reached `dist/pbui.css`. It had never shipped.

Wiring it in was one line and the smallest part of the step. The rest was
finding out what the file had been hiding, discovering that the four-stylesheet
import contract was the actual root cause, and proving that the guard I wrote
fails on the bug it exists for.

### Prompt Context

**User prompt (verbatim):** "Ok, create phases and tasks for all of these, along with a design doc, and then implement them, keeping a detailed diary as you work according to the diary format skill (MANDATORY), committing at appropriate intervals"

**Assistant interpretation:** Open a docmgr ticket with phased tasks and a
design doc for the full set of pbui defects surveyed across the last three
messages, then implement them phase by phase with a diary and periodic commits.

**Inferred user intent:** Turn a survey into landed work, with the reasoning
preserved so the next person can review it or continue it.

**Commit (code):** `7098054` — "P1: ship the stylesheet that was never wired, and the font it never applied"

### What I did

- `src/index.ts` — imports `./styles.css`, and imports the three `public/*.css`
  part files **below** the `export *` lines so they land after the component
  modules in the emitted CSS.
- `src/styles.css` — fixed a selector bug (below), replaced its parallel
  12-colour fallback palette with reads of the real tokens, added a
  `:where(:root)` typographic baseline, rewrote the header.
- `src/styles-wiring.test.ts` — new. Four assertions: the import scan works, no
  top-level stylesheet is orphaned, no `*.module.css` is orphaned, and the
  parts files stay after the modules.

```bash
pnpm run build      # dist/pbui.css 19.05 kB -> 28.51 kB
pnpm run test       # 11 files, 71 tests, all pass
pnpm exec tsc -p tsconfig.build.json --noEmit   # clean
```

### Why

The same defect had already been found one layer up. `tokens.css` was created
in 0.3.0 because pbui read forty-four design tokens and defined none, and an
undefined custom property invalidates the entire declaration at computed-value
time with no error. `styles.css` is that defect's sibling: a file written
deliberately, explaining itself in its own header, attached to nothing.

Finding the same shape twice is what turned this from "import the file" into
"why did nobody notice", and the answer is the import contract — four
stylesheets, in a documented order, with no way to detect a missing one.

### What worked

The empirical check on emitted order. I claimed in `index.ts` that putting the
part imports below the `export *` lines would place them after the component
modules, and I did not trust it — ES import hoisting versus Rollup's CSS
emission order is not something to reason about from memory. Building and
locating six markers in `dist/pbui.css` settled it:

```
   1135  tokens.css
   1459  styles.css
   5328  component modules
  22318  components.css
  23288  presentation-parts.css
  26333  chrome.css        →  all present, in order
```

The bare-consumer check then proved the outcome rather than the mechanism. A
page loading nothing but `dist/pbui.css` and presentation-shaped markup:

| | before | after |
|---|---|---|
| presentation border | none | `1px solid rgb(35,38,43)` |
| menu position | static | `fixed`, z-index 100 |
| enabled menu item | — | ink |
| disabled menu item | — | faint |
| font | Times New Roman 16px | IBM Plex Mono 11.5px |

### What didn't work

**The test I planned first was not an invariant.** P1.4 was written as "every
`data-part` pbui renders has a rule in the shipped CSS". Measured before
writing it: 51 parts rendered, 33 styled by attribute selector, so 19 would
have failed on day one — because most components are styled by CSS modules and
`data-part` is a stable hook for products and tests, not a styling contract.
Checking the population before writing the assertion cost two minutes and saved
shipping a test with 19 false positives. The test became the orphan check
instead, which is the invariant that actually holds.

**My first order verification read the wrong thing.** I searched
`dist/pbui.css` for `[data-part="menu-reason"]` as the marker for
`presentation-parts.css` and found it at offset 2938 — apparently *before* the
component modules, which would have meant the ordering fix failed. It was my
own new rule in `styles.css`, which also styles `menu-reason`. A second marker
run with strings unique to one source file each showed the order was correct
all along. Two minutes of believing a fix had failed, entirely self-inflicted:
**a marker that appears in two files measures neither.**

### What I learned

Wiring in a file that never shipped is not a safe operation, and I nearly
treated it as one. `src/styles.css:97-100` read:

```css
:where([data-pbui="menu"]) button:disabled,
:where([data-pbui="menu"]) [data-part="menu-item"] { color: muted }
```

`data-part="menu-item"` is on **every** action button (`createPbui.tsx:364`),
not only on the "No actions available" div (`:357`). Shipping the file
unchanged would have greyed every entry in every object menu in every product
— a visible regression introduced by fixing a bug. Verified in the browser
rather than argued: reinstating the old rule on the bare page moved an enabled
item from `rgb(35,38,43)` to `rgb(105,110,117)`.

The general form: **dead code has not been reviewed.** It compiled, it was
committed, it read plausibly — and none of that is evidence, because nothing
ever executed it. Anything being resurrected needs reading as a fresh change,
not as an existing one.

### What was tricky to build

The font. The user noticed it mid-step — *"css seems off for the font type for
sure"* — and the diagnosis was not where I expected.

`--pbui-font` is defined in `tokens.css` and IS read, by four component modules
(`Text`, `Kbd`, `CodeLine`, `FileBrowser`), so my first instinct — a token
declared and never read — was wrong, and a sweep confirmed it: 44 tokens
defined, 0 never read. The real shape is subtler. Every presentation part says
`font: inherit`, deliberately, so a product's typography flows into the menus.
But pbui never established a document-level baseline, so there was nothing to
inherit and a bare consumer got Times New Roman at 16px with an 11.5px design
system on top of it.

The fix is a `:where(:root)` rule applying `--pbui-font`, `--pbui-fs-base` and
`--pbui-lh-tight`. What made it safe to ship was checking why no product ever
saw it: all four set the identical three declarations on `body`, from the same
three tokens, in their own `reset.css:52-56`. Zero specificity plus an
identical value means no product changes, which is the only reason this is a
Phase 1 item rather than a breaking one.

That check also surfaced a follow-up: those three lines are now redundant in
all four products, the same "restating a default" pattern removed for tokens in
0.3.0. Not touched here.

The other sharp edge was the specificity argument for import order. Two layers
tie at (0,1,0) — the component modules' hashed classes and the parts files'
plain attribute selectors — so ties break on source order and the parts must
come last. The mechanism that achieves it (ES imports evaluated in source
order, below the re-exports) is too subtle to survive a refactor as a comment,
which is why it became an assertion.

### What warrants a second pair of eyes

The `:where(:root)` typographic baseline, against a product that embeds pbui in
a page it does not own. All four products in this workspace set `body`
typography and are provably unaffected; a consumer that sets neither `html` nor
`body` will now inherit monospace, which is the intent but is a visible change
for them.

Also `styles.css`'s switch from a private fallback palette to reads of the real
tokens. It is correct because `tokens.css` is bundled into the same stylesheet
and cannot be absent when these rules apply — but that is an argument from the
build, and it would break if the two files were ever split.

### What should be done in the future

- Products can drop `font-family` / `font-size` / `line-height` from their
  `reset.css` now that pbui sets the baseline (four files, three lines each).
- `--pbui-shadow-menu` is read by pbui and defined only by products. It is read
  WITH an inline fallback so it is safe, and this is the documented
  arrangement, but it is the one name where the "pbui defines every token it
  reads" claim needs the fallback caveat to stay true.

### Code review instructions

Start at `src/index.ts`; the header is the design and the import order is the
cascade. Then `src/styles.css:97-108` for the selector fix and `:55-75` for the
baseline.

```bash
cd pbui
pnpm run build && pnpm run test
# the orphan guard must fail when re-orphaned:
sed -i '/import ".\/styles.css";/d' src/index.ts && pnpm vitest run src/styles-wiring.test.ts; git checkout src/index.ts
# the bare consumer:
mkdir -p /tmp/bare && cp dist/pbui.css /tmp/bare/ && python3 -m http.server 8907 -d /tmp/bare
```
Load a `[data-pbui="presentation"]` and a `[data-pbui="menu"]` with one
enabled item, one disabled item and one `div[data-part="menu-item"]`. The
enabled item must be ink, the other two faint, and nothing may compute to
Times New Roman.

### Technical details

The cascade, which is now `src/index.ts`'s reason for existing:

| layer | file | specificity | must be |
|---|---|---|---|
| 1 | `tokens.css` | `:where(:root)` — (0,0,0) | first; cannot lose to anything |
| 2 | `styles.css` | `:where(…)` — (0,0,0) | before the parts, cannot lose |
| 3 | component modules | hashed classes — (0,1,0) | — |
| 4 | `components.css`, `presentation-parts.css`, `chrome.css` | attribute selectors — (0,1,0) | **after** 3, since ties break on order |

The granular subpath exports (`@hyperslop-systems/pbui/components.css` and
siblings) are unchanged and still resolve to the same `dist/` files, which
`public/` copies verbatim. A consumer importing all four still gets a correct
page; the rules simply appear twice, identically, which the cascade resolves to
the same result. Importing one stylesheet is now sufficient.

## Step 2: P1.5 — the product that had been reviewing itself in the wrong CSS

pbui's four-stylesheet import contract is only a hazard if somebody actually
misses one. agentlogic did, in `.storybook/preview.tsx`, and the file opened
with a comment asserting the opposite: *"The whole foundation, in dependency
order, exactly as main.tsx loads it."* It imported four; `main.tsx` imports six.

The two missing sheets were `presentation-parts.css` and `chrome.css`, which
means every story containing a tile rendered without the tile chrome — and
agentlogic's entire atoms/molecules/organisms refactor was reviewed through
Storybook.

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Assistant interpretation:** Phase 1 also covers the product-side half of the
import-contract defect.

**Inferred user intent:** Fix the live consequence, not only the library shape
that permitted it.

**Commit (code):** `c23a8af` — "P1.5: Storybook was reviewing agentlogic in the wrong CSS"

### What I did

- `agentlogic/ui/.storybook/preview.tsx` — added the two missing imports, and
  replaced the false claim with what actually happened and how long it lasted.
- `agentlogic/ui/src/styles-parity.test.ts` — new. Asserts set equality on the
  foundation stylesheets the two entry points import, excluding the ones that
  legitimately differ (`@fontsource/*`, `plex.css`, dev-only sheets).

### Why

The comment was the mechanism, not an innocent bystander. A sentence claiming
two files agree cannot check itself against the file next to it, and it stops
anyone else from checking either — it reads as though the work has been done.
Replacing a false comment with a true comment would leave the same failure mode
in place, so the invariant became a test and the comment became a history note.

### What worked

The A/B, which is the only thing that says how much this mattered. Same story,
same browser, only the two imports differing:

| `[data-part]` | Storybook before | Storybook after | product |
|---|---|---|---|
| `tile` border | `0px none` | `2px solid rgb(35,38,43)` | `2px solid` |
| `tile` background | `rgba(0,0,0,0)` | `rgb(255,255,255)` | white |
| `tile-bar` padding | `0px` | `2px 6px` | `2px 6px` |
| `tile-grip` cursor | `auto` | `grab` | `grab` |
| `tile-grip` width | `auto` | `7.7px` | `7.7px` |

Four tiles in that one story, none of them bordered. The tile frame's defining
visual — a 2px ink border on white — was absent from every story that drew a
tile, and the drag grip did not read as draggable.

Mutation-tested the guard by re-introducing the exact original drift:
`AssertionError: the product loads these and Storybook does not: expected [ …(2) ] to deeply equal []`.

### What didn't work

Two dead ends, both mine, both from assuming rather than checking.

I first probed `chrome-kit--two-tiles-with-drag`, which does not exist in this
Storybook — I had taken the ID from a *different product's* Storybook earlier in
the session, where port 6006 was already answering. Then I probed
`tiles--conversation`, which renders tile CONTENT with no frame around it and
therefore contains no `[data-part]` at all. Only `workspaces-workbench--default`
mounts `TileFrame`.

The lesson is the same one as the marker collision in Step 1: **a probe that
returns nothing is not evidence of absence until you have confirmed you probed
the right thing.** Both times the empty result looked like a finding.

### What I learned

agentlogic imports exactly one thing from pbui's chrome — `TileFrame`, in
`TileTree.tsx:185` — and nothing from its presentation runtime. So the blast
radius was narrower than "every presentation and every tile frame", which is
what I wrote in the design doc before measuring: no agentlogic story renders a
`Presentation` or an `ObjectMenu` at all. The tile chrome is the whole of it,
and the tile chrome is on every workspace story. Worth correcting in the design
doc rather than leaving the larger claim standing.

### What was tricky to build

Deciding what "the same stylesheets" means. Set equality on the raw import
lists fails immediately and correctly: `main.tsx` loads `plex.css` from the
server's generated stylesheet and Storybook loads eleven `@fontsource` faces
for its font-picker toolbar. Those differences are the design, not drift.

The filter keeps only `@hyperslop-systems/pbui` specifiers and anything under
`src/styles/`, minus `plex.css`. That is a judgement encoded in a regex, which
is exactly the kind of thing that rots — so the test's first assertion checks
that both sides found more than three sheets, because a filter that silently
matches nothing turns the real assertion into `[] === []`.

### What warrants a second pair of eyes

`foundationOf()`'s filter. If a future product stylesheet lives outside
`src/styles/`, this test will not notice it going missing from one side.

### What should be done in the future

- The same parity test belongs in hyperblog, turboproof and datalab-ui. All
  three currently import all four sheets in both entry points, so it would pass
  today — which is the argument for adding it while that is true.
- Once agentlogic bumps to 0.4.0, the three granular pbui imports collapse to
  one and the parity test gets easier, not harder.

### Code review instructions

```bash
cd agentlogic/ui && pnpm run test          # 12 files, 113 tests
# the guard must fail on the original drift:
python3 - <<'EOF'
p='.storybook/preview.tsx'; s=open(p).read()
open(p,'w').write(s.replace('import "@hyperslop-systems/pbui/presentation-parts.css";\nimport "@hyperslop-systems/pbui/chrome.css";\n',''))
EOF
pnpm vitest run src/styles-parity.test.ts; git checkout .storybook/preview.tsx
```
Then open `workspaces-workbench--default` and confirm the four tiles have a 2px
ink border on white.
