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

## Step 3: Phase 2 — correcting the guards, without touching a consumer

Two components guarded the unavailability reason on the reason being SET rather
than on the action being disabled. Fixing both is four lines, and it corrects
fifteen live sites across three products without a single consumer changing —
because every one of those sites already sets `disabled` correctly. The
predicate was never wrong. Only its independence from the prose was.

That property is why Phase 2 exists as its own phase rather than falling out of
Phase 3's merge: the user-visible defect is gone before the breaking change
starts, so P3 can be judged on API quality rather than under pressure to fix a
live bug.

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Assistant interpretation:** Implement P2.1-P2.3 — the non-breaking guard
corrections and their regression tests.

**Inferred user intent:** Stop the bug that is currently on screen in three
products before restructuring the API that permitted it.

**Commit (code):** `85bf821` — "P2: a disabled reason belongs to a disabled action"

### What I did

- `createPbui.tsx:366-378` — both the reason span and the `title` now read
  `action.disabled` first.
- `SelectInput.tsx:110-127` — the same, for `option.disabled` / `option.reason`.
- `createPbui.test.tsx` — a `describe` block with the two directions, using a
  descriptor written the way all fifteen real sites are written.
- `SelectInput.test.tsx` — new file; the component had no tests at all.
- `FileBrowser.test.tsx:189` — an explicit 20s timeout on the windowing test
  (pre-existing flake, see below).

### Why

The fix is trivial and the reason it was needed is not. A descriptor author
knows the rule — *you cannot focus the term the cursor is already on* — and
writes it twice, once as a predicate and once as prose:

```ts
disabled: environment.cursorTerm === ref.id,
disabledReason: "the cursor is already here",
```

Two adjacent lines that a reader parses as one unit and the renderer evaluates
as two. Nothing on the page says the second is independent of the first, and
the type endorses the author's reading by declaring both as free-standing
optionals.

### What worked

**The mutation test, in the currency the user sees.** Reverting each guard
produces the exact string a person would have read on screen:

```
expected 'Focus — the cursor is already here' to be 'Focus'
expected 'JSON — needs a paid plan' to be 'JSON'
```

An assertion whose failure message is the user-visible symptom needs no comment
explaining what broke.

**Proving it against a real menu rather than a test double.** pbui's own
`Pbui.stories.tsx:30` has the defective shape, so driving its Storybook is a
live consumer check with no product linking. Opening Ada Lovelace's menu, who is
not the current user:

```json
{ "text": "Send email", "disabled": false, "title": null, "reasonSpan": false }
```

Before the fix that item read "Send email — You cannot email yourself from this
example". One of the sixteen sites, fixed and observed in a browser.

### What didn't work

**A red run I nearly explained away.** The first full-suite run after the fix
came back `1 failed | 75 passed`. The second came back green. The temptation to
call that a flake and move on is exactly the failure mode that lets a real
regression through, so I ran it four more times: `FileBrowser > windowing: 5000
siblings` failed on run 3 at **5359ms** against vitest's 5000ms default.

My first isolation attempt was wrong. I stashed the change and ran that test
FILE alone six times: 6/6 green — which proves nothing, because the flake only
appears under full-suite parallel load. Running the right comparison:

| tree | full-suite runs | failures |
|---|---|---|
| before P2 | 5 | **3** |
| with P2 | 5 | 2 |

Pre-existing, and if anything slightly better with my change, which is noise.
Not mine — but a suite that fails half the time makes every verification in
Phases 3-6 worthless, because the habit it teaches is re-running rather than
reading. Fixed with an explicit 20s timeout rather than a smaller fixture: 5000
siblings is the claim (`pageSize` exists so a 50,000-node directory costs what
a 50-node one costs), and a fixture small enough to be fast would not exercise
it. 6/6 green after.

### What I learned

`SelectInput` had **no test file at all**, which is the reason its copy of the
defect was latent rather than fixed. The component is ten months old, is used
by seven organisms across two products, and nothing asserted anything about it.
The bug was found by reading, and would have been found by writing one test.

The general form, and the one I would carry forward: *"no caller uses this
field yet"* is not a reason to skip the assertion. It is the precise condition
under which a defect survives review indefinitely — nobody sees it, so nobody
reports it, and the first caller ships it.

### What was tricky to build

The `title` correction has a subtlety the reason span does not. The old code was
`title={action.disabledReason ?? action.description}`, so a `disabledReason`
suppressed the description **even on an enabled action** — the useful tooltip
replaced by an inapplicable one. The fix has to preserve three behaviours at
once: disabled with a reason shows the reason, disabled without one falls back
to the description, and enabled always shows the description regardless of what
`disabledReason` holds. Written as a conditional rather than a chain of `&&`/
`||`, because the `||` form types as `boolean | string | undefined` and reads
as though it might be doing something clever:

```tsx
title={action.disabled ? (action.disabledReason ?? action.description) : action.description}
```

### What warrants a second pair of eyes

The `SelectOption` title on an enabled option is now `undefined` rather than
the reason. `SelectOption` has no `description` field, so there is nothing to
fall back to — an enabled option simply has no tooltip, which is correct but is
a behaviour change if any caller was using `reason` as a general annotation.
None does today.

### What should be done in the future

- The FileBrowser windowing test is slow because jsdom mounts 5001 real nodes.
  If the suite gets slower, that test wants a different strategy rather than a
  larger timeout.

### Code review instructions

Start at `createPbui.tsx:366-378` — the comment there is the whole argument.

```bash
cd pbui && pnpm run test
# each guard must fail on its own defect:
sed -i 's/{action.disabled && action.disabledReason && (/{action.disabledReason \&\& (/' src/presentation/createPbui.tsx
pnpm vitest run src/presentation/createPbui.test.tsx; git checkout src/presentation/createPbui.tsx
```
For the live check: `pnpm exec storybook dev -p 6021`, open
`presentation-pbui-protocol--default`, right-click Ada Lovelace. "Send email"
must carry no em-dash suffix.

## Step 4: Phase 3 — merging five pairs, and the compiler hole underneath them

Five prop pairs became five single fields. The merges themselves were
mechanical; what was not mechanical was discovering, partway through, that
deleting the old fields would have been **worse than leaving the bug alone** —
because TypeScript does not check what I assumed it checks.

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Assistant interpretation:** Implement P3.1-P3.6 — merge the pairs, migrate
every consumer.

**Inferred user intent:** Make the illegal states unrepresentable, as designed,
without breaking the four products that depend on them.

**Commit (code):** `f5e22f2` (the `disabledBecause` family), `92ea3a5`
(`activate` and `rename`), `6ce8d7a` (turboproof)

### What I did

```
PresentationAction   disabled + disabledReason         ->  disabledBecause
SelectOption         disabled + reason                 ->  disabledBecause
FileDropZone         disabled + disabledReason         ->  disabledBecause
Presentation         onActivate + activateDoc          ->  activate { run, doc }
FileBrowser          renamingId + onRenameStateChange   ->  rename { id, onChange }
```

Consumers migrated: datalab-ui (2 files), turboproof (14 files), pbui's own
stories and tests. Added three tests for `activate.doc`, which had none.

### Why

Recorded in the design doc §3.1: absence already means "not disabled", so one
optional field expresses everything the pair did, and both illegal states —
a reason on an available action, and a disabled action with no explanation —
become unwritable rather than merely discouraged.

### What worked

**The design doc's prediction about datalab-ui held exactly.** It said the
adapter would collapse to a passthrough and the six descriptor files would not
change. They did not:

```
 M packages/datalab-ui/src/components/organisms/UploadPanel/UploadPanel.tsx
 M packages/datalab-ui/src/pbui/registry.ts
```

Two lines left `registry.ts`, and the product that had merged this pair on its
own — years before the library — stopped paying for the privilege.

**turboproof's tombstone errors told the true story.** 18 compile errors, and
the one at `shared.ts:27` proved the product had its own `ActionSpec`, so five
descriptor call sites migrated by changing one type.

### What didn't work

**The merge alone did not do what I said it would.** After merging
`PresentationAction`, `Pbui.stories.tsx` still wrote `disabled` and
`disabledReason` — and `tsc` reported **nothing**. I checked with a property
named `totallyBogusProperty`; also nothing.

A minimal repro isolated it. Excess-property checking fires only on a *fresh*
object literal assigned to a target, and freshness is lost the moment the
literal is widened into a function's **inferred** return type — which is what
`actions: (value, env) => [ … ]` produces. The array is then checked for
assignability, and assignability is structural, so extra properties are legal.

The consequence is worse than the defect being fixed. A product left on the old
shape would have compiled clean, had both fields ignored, and rendered
`disabled={undefined}` — turning every unavailable action, **including
destructive ones**, into a clickable one. "Delete the root directory" becomes
performable, silently, on upgrade.

The fix is a tombstone: keep the names, type them `never`. That converts an
ignored excess property into an ordinary type mismatch, which the inference
path does report:

```
Types of property 'disabled' are incompatible.
  Type 'boolean' is not assignable to type 'undefined'.
```

Adding them immediately surfaced **five** call sites inside pbui alone that the
compiler had been ignoring, one of which was a bare `disabled` with no
explanation at all.

**A second stale-artifact trap, twice.** datalab-ui typechecked clean against
the merged pbui — because it resolves types from `dist/`, which I had not
rebuilt. The green was meaningless. I hit it again after P3.4/P3.5 before
making "rebuild pbui, then check datalab-ui" a habit. Same shape as the marker
collision in Step 1 and the wrong Storybook port in Step 2: **the tool answered
honestly about something other than what I was asking.**

**One careless rename.** A blanket `.disabledReason` → `.disabledBecause` sweep
across datalab-ui's tests also caught `y.disabled` in a story where `y` is an
`HTMLButtonElement`, not an action. The typechecker caught it. `disabled` is a
name shared by the DOM and the domain, and a sed does not know the difference.

### What I learned

The merge is only half a migration tool. **Renaming a field in an interface
whose values arrive through an inferred return type is a silent behaviour
change unless the old name is left behind as `never`.** That is now the rule
for this codebase, written into `types.ts` where the next person renaming
something will read it.

It also reframes what the tombstones are. They are not deprecation politeness
— they are the only reason the migration is detectable at all.

### What was tricky to build

Deciding whether `activate` was worth doing. `onActivate` + `activateDoc` had
no live defect, and the merge makes six call sites wordier:

```tsx
- onActivate={() => onGeom(option)} activateDoc="use this geom"
+ activate={{ run: () => onGeom(option), doc: "use this geom" }}
```

I nearly skipped it as pattern-application for its own sake. What decided it
was that `activateDoc` alone type-checks, renders nothing, and warns nothing —
identical in shape to `disabledReason` without `disabled`, which had fifteen
live instances. "No product has written it yet" describes the condition under
which such a defect survives review indefinitely, not a reason to leave it.
The verbosity is a real cost and is recorded as one in the prop's doc comment.

The `rename` merge had a second job. `renamingId` overloaded `undefined`
(uncontrolled) against `null` (controlled, idle), which is why the
implementation had to ask `renamingId !== undefined` rather than a truth test.
Presence of the object is now the mode, so `id: null` means exactly one thing.

### What warrants a second pair of eyes

The tombstones are `?: never`, which reads oddly and will tempt someone to
delete them as noise. The comment in `types.ts` is long for that reason. They
are safe to remove only once every consumer is on 0.4.0 — hyperblog and
agentlogic are not yet.

Also: `activate` and `rename` are fresh object literals, so they change
identity every render. Neither is used as a memo dependency today.

### What should be done in the future

- hyperblog (10 sites) and agentlogic still consume 0.3.0 from the registry and
  are unaffected until P6.5 bumps them. Their migration is the same shape as
  turboproof's.
- A lint or test for the tombstone rule itself: any field removed from a
  descriptor-facing interface should leave a `never` behind for one version.

### Code review instructions

Start with `src/presentation/types.ts` — the `disabledBecause` comment is the
design, and the tombstone comment below it is the migration hazard.

```bash
cd pbui && pnpm run test && pnpm exec tsc --noEmit
pnpm run build   # REQUIRED before the next line; datalab-ui reads dist/
(cd packages/datalab-ui && pnpm exec tsc --noEmit && pnpm run test)
(cd ../turboproof/ui && pnpm exec tsc --noEmit && pnpm run test)
```

To see the hole the tombstones cover, delete `disabled?: never` from
`PresentationAction` and add `disabled: true` to any descriptor action. It
compiles.

## Step 5: Phase 4 — the click, and the API that dissolved

The report's only S1 that was still costing correctness rather than only time.
A Presentation opened its click handler with an unconditional
`stopPropagation()`, which is right for the two cases where the Presentation
acts and wrong for the case where the HOST does — which is exactly the case
`renderRow` exists to create.

The interesting part is what did not get built. P4.3 was "give FileBrowser's
roving focus a controlled surface so renderRow can restore it", and once P4.1
landed there was nothing left to restore.

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Assistant interpretation:** Implement P4.1-P4.5 — click semantics, nesting
guard, roving focus, the story, the test.

**Inferred user intent:** Fix the defect that a product could not fix for
itself.

**Commit (code):** `538c63e` (pbui), `dae2b25` (turboproof)

### What I did

- `createPbui.tsx` — three-way click policy; a `Symbol.for` marker on the
  native event; `activate.run` made optional.
- `FileBrowser.stories.tsx` — the `WithPresentation` story stopped
  demonstrating the bug.
- `createPbui.test.tsx` — three propagation tests.
- `FileBrowser.test.tsx` — two tests through a REAL Presentation.
- turboproof `FilesApp.tsx` — deleted the re-implemented row gesture.

### Why

`renderRow` wraps a row's CONTENT, so the Presentation sits inside the row
element and a click on the label was stopped before the row's handler ran. The
tree lost three effects: `onSelect`, `onToggle`, and `setFocusedKey`. A product
could restore the first two by duplicating them in the activate handler.
`setFocusedKey` is `useState` inside `FileBrowser` with no prop and no handle,
so arrow navigation kept moving from whatever row was last focused some other
way, and no amount of product code could repair it.

### What worked

**P4.3 dissolved.** The plan was a `focus?: { id, onChange }` prop mirroring
`rename`. Once the click bubbles, the row's own handler runs and calls
`setFocusedKey` itself — the roving focus repairs itself and the new API is
unnecessary. Deleting a planned prop is a better outcome than shipping it, and
it only became visible by implementing in the right order.

**The browser check on the story that used to demonstrate the bug.** Clicking
the collapsed `Notes` label:

```
before  ▸Notes  aria-expanded=false  focused=false
after   ▾Notes  aria-expanded=true   focused=TRUE
```

Both effects the report said were lost, in one gesture.

**Both mutations failed loudly.** Reinstating the stop:
`expected '▸Mini' to contain 'lakefile.lean'` — the report's exact symptom,
reproduced by a test rather than by a person. Removing the nesting guard:
`expected [ 'inner', 'outer' ] to deeply equal [ 'inner' ]`.

### What didn't work

**My first version of the P4.5 test proved nothing.** I wrote the harness with
`renderRow={(node, children) => <span>{children}</span>}` — a stand-in for a
Presentation. It passed. It would have passed just as well with the bug
present, because a plain span stops nothing and the defect was pbui's own
handler. I noticed because the test went green before I had run a mutation
against it, which is the wrong order of events.

Rewired to a real `createPbui` instance and a real `Presentation`, and only then
did the mutation fail. **A test double that omits the mechanism under test is a
test of nothing**, and the tell was that it passed first try.

**The stale-`dist` trap for the third time.** turboproof reported `Property
'run' is missing` after I made `run` optional — because it reads pbui's
`dist/`, and I had not rebuilt. Three occurrences in one ticket; it is now in
the code-review instructions as a required step rather than a note.

### What I learned

Removing a `stopPropagation` is a breaking behaviour change in two directions,
and only one of them is obvious. Upward, hosts start seeing clicks they did not
see before — which is the fix. Downward, a Presentation nested inside another
was relying on the inner one's stop, and would now double-handle. Nothing nests
presentations in this workspace today, which is precisely why the guard had to
go in with the change rather than after someone finds out.

The marker is `Symbol.for` rather than `Symbol()` so that two copies of pbui on
one page still agree — the duplicate-React situation P6.3 covers. A private
symbol would have made the guard fail exactly when the packaging bug is
present, which is the worst time for a second bug to appear.

### What was tricky to build

`activate.run` becoming optional was not in the plan and is the subtle part.
After P4.1, turboproof's wrapper had to stop duplicating select-and-toggle or
every directory would toggle twice and cancel out. But it still wanted a left
click to mean "the default verb" rather than "open the menu", and still wanted
the mouse doc to say "expand or collapse". With `run` required, the only way to
express that was `run: () => {}` — an empty function that lies about what
happens.

So `activate` now encodes three states rather than two:

| | left click |
|---|---|
| `activate` absent | opens the menu, like right click |
| `activate` with `run` | this element acts, and the host also sees the click |
| `activate` without `run` | the host owns it; this only names it |

That third row is what a `renderRow` wrapper wants, and it did not exist before
this phase.

### What warrants a second pair of eyes

Hosts that relied on the swallow. I audited every `Presentation` call site in
datalab-ui and turboproof for a clickable ancestor and found none — the
`onClick`s near them are on sibling controls, not parents — but that audit is
by reading, and a product outside this workspace could differ. The escape hatch
if one turns up is a `stopPropagation` option on `activate`.

### What should be done in the future

- P4.3's controlled-focus prop is deliberately NOT built. If a product ever
  needs to drive the roving focus from outside (a "reveal in tree" verb, say),
  that is when to add it — with a use, rather than in anticipation of one.

### Code review instructions

```bash
cd pbui && pnpm run test && pnpm run build   # build BEFORE checking consumers
(cd packages/datalab-ui && pnpm exec tsc --noEmit && pnpm run test)
(cd ../turboproof/ui && pnpm exec tsc --noEmit && pnpm run test)
```
Then the mutation that matters: put `event.stopPropagation()` back in the
`activate` branch of `handleClick` and run `FileBrowser.test.tsx`. Two tests
must fail. In a browser, open `component-library-organisms-filebrowser--with-presentation`
and click a collapsed directory's LABEL — it must expand.

## Step 6: Phases 5 and 6 — a rename that fought back, and four small fixes

Phase 5 was supposed to be the mechanical one and produced the worst mistakes
of the ticket. Phase 6 was four unrelated leftovers and went cleanly.

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Assistant interpretation:** Finish P5 and P6.

**Inferred user intent:** Land the whole ticket.

**Commit (code):** `38fff9a` (P5.1), `9563813` (turboproof P5.1), `96912a0`
(P6.1-P6.4), `25b7e4a` (turboproof P6)

### What I did

- **P5.1** — `label` → `accessibleName` on the eleven components where it was
  only ever an `aria-label`. 125 attributes across pbui, datalab-ui and
  turboproof.
- **P6.1** — deleted `FileBrowser.onCreate`.
- **P6.2** — `Presentation.inComposite`, so a presentation inside a tree or
  grid yields role and tab stop to the container.
- **P6.3** — `@hyperslop-systems/pbui/vite` exporting `pbuiVite()`.
- **P6.4** — `RootState`, so a failed root says why instead of loading forever.

### What didn't work

**Two reverted attempts at the same rename, both from the same wrong
assumption: that `label` meant one thing.** It does not. `label` is also a
real, VISIBLE prop on `Chip`, `SelectOption`, `Segment` and
`ResultLogSegment` — often in the same file, sometimes on the same line:

```tsx
<Chip label={segment.label} tone={segment.tone} />
```

Attempt one was a textual sweep over the eleven component files. It renamed
`SelectOption.label` — an option's visible text — because the declaration
looks identical to the prop being renamed.

Attempt two was compiler-driven, patching the first `label` on each line tsc
reported. Worse: tsc reports `Type '{...}' is not assignable` at the ELEMENT's
position, not the attribute's, so "the first `label` on that line" was the
`Chip` above, and every `{ id, weight, tone, label }` segment literal in the
story fixtures. I only caught it by reading the diff of what the script had
produced rather than trusting the error count going down.

The version that works matches `<Component` by tag name and walks its
attribute list with a depth counter over braces and quotes, so a `label`
inside a nested expression is never mistaken for the tag's own. Its correctness
is visible in the output:

```tsx
<SelectInput
  accessibleName="drop"                                        ← renamed
  options={writableDrops.map((d) => ({ value: d, label: d }))}  ← untouched
```

**A third failure mode in the same phase.** My first brace-matching script
aborted on an assertion at the seventh of eleven files, so four components got
their destructure renamed and their interface left alone. The error was
printed, I read the *next* command's output instead of it, and only noticed
when `KindLegendProps` still declared `label`. Aborting loops need their exit
status checked, not their tail.

### What I learned

**The compiler is a good oracle for "is something wrong" and a bad one for
"what exactly".** Its position information points at the assignment, which for
JSX is the element, not the property. Three attempts converged on the rule:
when a rename is ambiguous by name, disambiguate by STRUCTURE — the tag it is
attached to — not by proximity to an error.

Also: I reverted twice, and both reverts were cheap because the work was
committed at phase boundaries. A single "P5" commit at the end would have made
the second revert a manual untangle.

### What was tricky to build

P5.2 — the visible label — is **deliberately not done**, and deciding that took
longer than the rename. Making `label` render on the four form controls would
turn 44 existing call sites from "no visible text" into "visible text", which
is a layout change imposed on three products rather than a fix. The right shape
is a `Field` molecule, and every design I tried recreates an illegal state:

- `Field` wraps the control in a `<label>`, so `accessibleName` becomes
  optional — and a control can then end up with no name at all.
- `Field` renders a `<span>` and the control keeps a required `accessibleName`
  — but then clicking the visible text does not focus the control.
- `Field` clones the child to inject an id — fragile, and it breaks any
  wrapper between `Field` and the control.

Shipping any of those inside a ticket about making illegal states
unrepresentable would have been the wrong joke to land. The trap it was meant
to fix is already gone: nothing named `label` is silently invisible now, and a
product that wants visible text writes it, which is what they all did before.

The other genuinely tricky call was P6.3's runtime guard, which the report
ranked as the most valuable of its four suggestions. It cannot be written from
inside pbui: pbui holds a handle to exactly one React — whichever its own
`import` resolved — and has no visibility of the consumer's. Detecting the
duplicate needs both sides to register on a shared global, which is more
coordination than the preset it would be protecting. `src/vite.ts` says so
explicitly rather than leaving the omission to look like an oversight.

### What warrants a second pair of eyes

`inComposite` renders `role="none"`. That is correct for a `<span>` inside a
`treeitem`, and I have not checked every composite role — a `gridcell` may want
different treatment.

`RootState`'s absent-key-means-loading is two ways to spell one state, which is
the smell this ticket exists to remove. It is deliberate: products build the map
incrementally, and requiring an explicit `{ status: "loading" }` per root before
the first response is friction with no safety in return. Worth re-reading with
fresh eyes.

### What should be done in the future

- **P5.2, the visible label**, with a `Field` design that does not recreate an
  illegal state. It is the one item in this ticket that is not done.
- turboproof's `useFileTree` keeps one global error string, so its `RootState`
  adapter can produce `ready` and `loading` but never `failed`. Per-root
  failure needs a `Record<string, string>` of errors in the hook.
- hyperblog and agentlogic still consume 0.3.0 and have not migrated.

### Code review instructions

```bash
cd pbui && pnpm run test && pnpm run build
(cd packages/datalab-ui && pnpm exec tsc --noEmit && pnpm run test)
(cd ../turboproof/ui && pnpm exec tsc --noEmit && pnpm run test && pnpm run build)
```
For P5.1 the thing to check is what was NOT renamed:
```bash
grep -rn 'label' pbui/src/components/atoms/SelectInput/SelectInput.tsx
```
`SelectOption.label` must still be `label` — it is the option's visible text.

## Step 7: The documentation, and a broken gate found while surveying it

Asked which documentation needed updating, I grepped for every changed
identifier before answering — and found something more urgent than any doc:
`pnpm consumer:smoke` was broken, and it is the pre-publish gate.

### Prompt Context

**User prompt (verbatim):** "ok, update all the documentation"

**Assistant interpretation:** Update every live document that the 0.4.0 changes
made wrong.

**Inferred user intent:** Leave the family's prescriptive docs correct, so the
next product does not follow instructions that are now traps.

**Commit (code):** `4edc7a8` (smoke fix), `a59c7ce` (pbui docs), `4e011fa`
(TURBOPROOF-5), `7d9ab38` (AGENTLOGIC-UI-2)

### What I did

- Fixed `scripts/consumer-smoke.mjs`, broken by P5.1's rename.
- `building-a-new-hyperslop-systems-app-on-pbui.md`: §3 version and imports,
  a new React-resolution subsection, §4 token history and typography, §6's
  third descriptor rule, four new checklist items.
- `refactoring-a-pbui-app-into-atoms-molecules-and-organisms.md`: the 0.4.0
  bump as the first commit of a retrofit, and the delete-restated-tokens rule.
- `README.md`: the single import, `pbuiVite`, and the `./vite` name collision.
- `TURBOPROOF-5`'s defect report: a §8 resolution note.
- `AGENTLOGIC-UI-2`: three re-scoped tasks and a changelog entry.

### What worked

**Grepping the docs before answering.** The question was "which documentation
needs updating", and the honest way to answer it is a search for every changed
identifier rather than a list from memory. That is what turned up the smoke
test — which is not documentation at all, but is the only check in the
repository that compiles against the PUBLISHED package shape rather than
`src/`. Every other check would have stayed green through a broken release.

Its passing is also an independent confirmation of P1.3: the smoke imports only
`styles.css` and `components.css`, so one stylesheet import really is enough
for a consumer who knows nothing about the ordering contract.

### What didn't work

**I broke the smoke test a second time while fixing it.** The comment I added
explaining that a mark's `label` is visible text used backticks around the
identifiers — and the JSX in that script lives inside a TEMPLATE LITERAL, so
the backticks terminated it. The failure was `SyntaxError: missing ) after
argument list`, eleven frames deep in the ESM loader, with no mention of the
line I had touched.

Also, earlier in the session, a commit message written with `-m "…"` containing
backticks had them executed by the shell — four `command not found` lines and a
mangled message that needed amending. Twice in one session, the same character,
two different mechanisms. **Backticks in generated text are a hazard in every
layer that reads them.**

### What I learned

Which documents are live and which are history is the whole question, and it
has a clean answer: **prescriptive documents get corrected; records get
appended to.** The two playbooks and the README tell someone what to do, so a
stale instruction there is an active trap and gets rewritten. The ten ticket
docs across agentlogic and datalab that still say `disabledReason` are diaries
and design docs recording what was true when written — rewriting those would
destroy the only account of why decisions were made, to fix a reference nobody
will follow.

The defect report sits between the two, and gets both treatments: the body is
untouched, and a §8 records what landed. Its diagnosis is worth preserving
exactly as reasoned, including the parts implementation proved wrong.

### What was tricky to build

Writing §8 of the defect report honestly. Three of its recommendations did not
survive contact:

- the discriminated union would have FORCED the workaround it was replacing
- the roving-focus API became unnecessary once the click fix landed
- the dev-time React guard cannot be written from inside pbui at all

Saying so plainly, next to the parts that held, is more useful than a note that
says "all five resolved" — the report's §7 correctly identified the organising
idea for the entire ticket, and a reader should be able to see both. I also had
to correct its §6 against my own migration: it lists two workaround sites and
there were five.

### What warrants a second pair of eyes

The new §3 subsection in the new-app playbook states the duplicate-React
mechanism from the report plus my own reading of Vite's symlink resolution. It
is right for the `link:` case measured here; I have not verified the claim that
a registry install can never hit it on every package manager.

### What should be done in the future

- The remaining sequence is unchanged: publish 0.4.0, bump hyperblog and
  agentlogic, then P5.2.
- `pnpm consumer:smoke` should run in the publish workflow if it does not
  already — it is the only check that would have caught this.

### Code review instructions

```bash
cd pbui && pnpm consumer:smoke     # the gate; must print "smoke passed"
grep -rn 'components\.css\|presentation-parts\.css' docs/playbooks/
```
The only surviving mentions must be the ones explaining that the four-import
form is historical. Same for `disabledReason`, which survives once, marked
`DON'T`, beside the shape that replaced it.
