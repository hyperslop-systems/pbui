---
Title: 'Audit result: datalab-ui against the definition of done'
Ticket: DATALAB-UI-AUDIT-1
Status: active
Topics:
    - pbui
    - frontend
    - refactoring
DocType: analysis
Intent: long-term
Owners: []
RelatedFiles:
    - Path: packages/datalab-ui/src/apps
      Note: 27 registered tiles; had zero stories before this ticket (§2.4)
    - Path: packages/datalab-ui/src/components
      Note: 73 component folders across atoms/molecules/organisms/pages/brand — the subject of §2.1 and §2.2
    - Path: packages/datalab-ui/src/styles
      Note: Six global sheets, 575 lines, zero class selectors (§2.3)
    - Path: packages/datalab-ui/test/layers.test.ts
      Note: The layer graph, with stories deliberately exempt (§5)
    - Path: packages/datalab-ui/test/no-raw-controls.test.ts
      Note: Forbids hand-rolled controls outside atoms; four reasoned exemptions (§2.7)
    - Path: packages/datalab-ui/test/stories.test.ts
      Note: Enforces story coverage; gained the tile-story guard (§3.2)
    - Path: packages/datalab-ui/test/tokens-used.test.ts
      Note: The token check the playbook says everything else is downstream of (§2.5)
    - Path: repo://packages/datalab-ui/src/components/brand
      Note: The one genuine convention violation, now split into three modules (§3.3)
ExternalSources:
    - docs/playbooks/refactoring-a-pbui-app-into-atoms-molecules-and-organisms.md
    - docs/playbooks/building-a-new-hyperslop-systems-app-on-pbui.md
    - ../hyperblog/ui/src/apps/tiles.stories.tsx
Summary: datalab-ui measured against §8 of the refactoring playbook. Six of the eight properties held before this ticket; the two that did not were a shared brand stylesheet and the complete absence of tile stories. Both are now closed. The package needed no refactor — it needed two gaps filled and one measurement corrected.
LastUpdated: 2026-08-02T00:00:00Z
WhatFor: The evidence behind the claim that datalab-ui is the family's reference implementation, and the precise places where that claim was not true.
WhenToUse: Before auditing another PBUI product, to see what a passing audit looks like and which checks are worth copying. Also read §5 before assuming a rule is being followed because a test exists — the loop that produced the original claim checked less than it appeared to.
---


# Audit result: datalab-ui against the definition of done

## 1 · The headline

**The compliance claim held, with two exceptions and one wrong number.**

`datalab-ui` was described to me as "essentially 100% compliant" with the
component convention, on the strength of a loop that found no component folder
missing a `.tsx`, a `.stories.tsx` or an `index.ts`. That loop was right about
what it measured. It did not measure the `.module.css`, it did not look at
`src/apps/`, and its component count was wrong.

| Claim | Verdict |
|---|---|
| Every one of `atoms/molecules/organisms/pages/brand` is a folder of components | **True** |
| Every component folder holds all four files | **False as stated.** 35 of 73 hold three: they own no `.module.css`. This is a *documented and correct* decision — see §2.2 — but it is not what the claim said. |
| 184 components, 70 stories | **Wrong on the first number.** 73 components; 70 story files holding 297 story states. 184 counts every `.tsx` under `components/`, stories included, or something similar. |
| The four-file loop prints nothing | **True**, because the loop does not test for the CSS module. Adding that test prints 35 lines. |
| No tile in `src/apps/` has a story | **True**, and it was the real gap. |

Two §8 properties out of eight failed. Both are now closed, and the package
builds, typechecks, lints and passes 517 tests after every commit.

## 2 · The §8 checklist, marked honestly

### 2.1 · `find src/components -mindepth 2 -maxdepth 2 -type f` prints nothing

**Was: FAIL (6 files). Now: FAIL (5 files), and the remaining five are right.**

Before this ticket:

```
src/components/atoms/index.ts          layer barrel — prescribed by §4
src/components/molecules/index.ts      layer barrel — prescribed by §4
src/components/organisms/index.ts      layer barrel — prescribed by §4
src/components/brand/index.ts          layer barrel — prescribed by §4
src/components/brand/phases.ts         shared vocabulary, not a component
src/components/brand/Brand.module.css  ← the genuine violation
```

The literal check in §8 is stricter than §4, which explicitly tells you to write
`components/molecules/index.ts` and re-export from it. Four of these six are
that file. `phases.ts` is `PHASES`, `PHASE_BLURB`, `phaseVar` and a `Phase`
type — the order of the four brand phases, written down once and mapped over by
three components. It is data, not a component, and giving it a folder with a
stories file would be worse rather than better.

`Brand.module.css` was the real violation, and is deleted. §3.3 covers it.

**Recommendation for the playbook:** §8's first bullet should read "…prints
nothing except the layer barrels and files that are explicitly not components",
or it will keep producing false failures in packages that follow §4.

### 2.2 · Every component folder holds exactly four files (or five, with a test)

**PASS on the convention as this package states it; FAIL on the literal text.**

73 component folders. 38 hold four or more files. 35 hold three: component,
stories, barrel — no `.module.css`.

This is not drift. `test/stories.test.ts:100` states the decision inside the
test that would otherwise enforce it:

> The CSS module is deliberately NOT required: several atoms are pure
> composition over other atoms and correctly own no styles of their own.

I checked whether that is true rather than convenient. Of the 35, **31 contain
no `style=` prop at all** — they are composition over PBUI's `Stack`, `Surface`,
`Text` and this package's own atoms, which is exactly what §3.1 wants. The other
four carry a single inline declaration each:

| Component | The declaration |
|---|---|
| `atoms/TokenChip` | `style={{ opacity: 0.7, fontSize: "var(--pbui-fs-tiny)" }}` on a badge |
| `organisms/ProfilePanel` | `style={{ paddingLeft: "var(--pbui-space-4)" }}` on an indent |
| `molecules/TruncationNotice` | one inline block |
| `organisms/WorkspaceStrip` | one inline block |

All four are token-valued, and none is a `const … : CSSProperties` — which
`no-raw-controls.test.ts` already forbids, having removed six copies of one that
had drifted between 9.5px and 10.5px. **I left them alone.** Four one-line
declarations do not justify four new stylesheets, and moving them would be
exactly the churn the brief forbids. They are worth a note, not a commit.

### 2.3 · `styles/` contains no component-scoped rule

**PASS, emphatically.** There is no `app.css` and never was one. The six global
sheets total 575 lines and contain **zero class selectors**:

| File | Lines | What is in it |
|---|---|---|
| `tokens.css` | 204 | `:root` only |
| `reset.css` | 126 | element selectors and focus rings |
| `brand.css` | 104 | `:root` only — brand aliases over the tones (DR-98) |
| `dialogs.css` | 88 | `[data-pbui-component="dialog"] [data-part="…"]` |
| `scrollbars.css` | 40 | `::-webkit-scrollbar*` |
| `pbui-extras.css` | 13 | `[data-part="menu-target"]` |

`dialogs.css` and `pbui-extras.css` reach into PBUI's published `data-part`
API. That is the *sanctioned theming seam for a package you do not own*, not a
component-scoped rule in your own namespace, and the distinction is load-bearing:
those rules cannot move into a module, because the elements they style are
rendered by a dependency.

The playbook's §6 grep — `grep -rho 'className="[a-z][a-z0-9 -]*"' src` — prints
**nothing at all**. Every className in the package comes from a CSS module.

### 2.4 · Every component has a stories file, and every state is in it

**PASS for `components/`. FAILED completely for `apps/`, which is the finding.**

`components/`: 70 story files over 73 components, 297 story states. The three
without their own file are inside families that story together
(`LauncherDialog`+`LauncherResults`, `LessonRail`+`RailHeader`,
`Workbench`+`WorkbenchShell`+`WorkbenchProviders`) — §3.3's family rule applied
correctly. `test/stories.test.ts` enforces the rule with an `@story-exempt:`
escape hatch that costs a sentence, **and nothing in the package uses it**,
which is the good outcome.

I spot-checked "every state is in it" on the four components with a single
exported story. All four use the *one story, every variant side by side*
pattern: `TokenChip`'s single `Lifecycle` story renders live, expiring and
revoked; `DocChip`'s renders active and inactive with a sentence explaining the
difference. That satisfies §4.1's intent better than four stories would.

**`apps/` had no stories at all.** 27 registered applications, 24 folders, zero
`.stories.tsx`. This is the gap worth the whole ticket, and the reason for it is
structural rather than lazy: DATADROP-6 extracted the panels into
`components/organisms/`, gave each a story, and the extraction was thorough
enough that it looked finished. But an organism story proves the *panel* draws.
It proves nothing about the container above it — and the container is where the
hooks, the derivations, the `if (!me?.authenticated)` branch and the "no
document" branch live. `AboutApp`'s own doc comment says "it is the one
application with no story", which was true only in the sense that the other
twenty-six had a story for their *panel*.

Closed by `src/apps/tiles.stories.tsx`. See §3.1.

### 2.5 · `make ui-token-check` passes

**PASS.** There is no such Makefile target — the repository Makefile is Go-side
only — but the check exists as `test/tokens-used.test.ts`, which is stronger
than the shell pipeline in §2.2 of the playbook because it runs in CI and reads
`src/` rather than a built bundle. It asserts every `var(--pbui-…)` anywhere
under `src/` names a token declared under `src/styles/`, and it deliberately
still checks references that carry a fallback, on the argument that a fallback
covering for an undefined name is the same defect with a nicer failure mode.

`test/brand-tokens.test.ts` and `test/tokens.test.ts` sit beside it. All pass.

**This is the check the playbook says surprises people, and it is why this
package does not have the adoption problem §2.2 describes.** The tokens were
right from the start, so PBUI's components never rendered bare, so nobody ever
preferred a raw `<button>` — and §2.7's count is a consequence of that rather
than of discipline.

### 2.6 · No tile is over ~150 lines, and none contains a panel's markup

**Split verdict: FAIL on the line count for two tiles, PASS on the property the
line count is a proxy for.**

Two of 29 tile files exceed 150 lines:

- `apps/UploadApp/UploadApp.tsx` — **331 lines**. Its JSX is one
  `<UploadPanel …/>` plus a four-line signed-out branch. The other ~290 lines
  are the staged upload protocol: open a draft, hash, HEAD the blob store to
  skip bytes the server already holds, PUT the rest through a concurrency pool,
  commit. That is a driver, not markup.
- `apps/TemplatesApp/TemplatesApp.tsx` — **173 lines**. Its JSX is one
  `<TemplateTable …/>`. The rest is import/export/quota logic.

Across all 29 tile files `grep` finds **three** raw HTML elements in total:
`LauncherApp`'s two layout divs (it owns a `.module.css`) and `ChartApp`'s
`<div ref={container}>`, which is the mount point the plot library requires.

So §8's actual requirement — "none of them contains a panel's markup" — holds
for every tile. The 150-line figure is a proxy that mis-measures a container
whose bulk is protocol. **I did not extract a `useUpload` hook from
`UploadApp`**: it would be a genuine improvement, it changes no rendering, and
it is therefore exactly what §7 says to write down and do separately. Filed as
a follow-up.

### 2.7 · Zero hand-rolled controls duplicating a PBUI component

**PASS, and enforced.** `test/no-raw-controls.test.ts` forbids `<button`,
`<select`, `<input` and `const … : CSSProperties` outside four allowlisted
prefixes, each carrying a written sentence for why. It also asserts every
allowlist entry still matches a file, so an exemption cannot outlive its reason.

The four exemptions are all defensible:

- `components/atoms/` — the atoms *are* the wrappers.
- `organisms/SplitView/` — a `<button role="separator">` resize handle carrying
  `aria-orientation` and `aria-valuenow`. Giving it `Button`'s appearance would
  be actively wrong.
- `pages/MarketingPage/` — the marketing page is a document, not an interface;
  it is on `brand.css`'s type scale, not `tokens.css`'s.
- `pbui/` — menu items are `<button role="menuitem">`, and the layer graph
  forbids `pbui → atoms` anyway.

The test header records what it was worth: DATADROP-6 removed **42 `<button>`,
9 `<select>` and 12 `<input>`**. This test is what stopped the forty-third.

### 2.8 · The screenshots match

**N/A as written — there was no §2.3 baseline, because there was no refactor to
take one for. Replaced with something stronger where it mattered.**

Two verifications were done in headless Chromium against a real Storybook build:

1. **All 34 tile stories were rendered and their text read back.** Every one
   produces real content, none reports "no application is registered", and the
   only console errors are the expected `/v1` 404s. The table tile renders
   21,342 characters of real fixture rows; the contact sheet renders 17,721.
2. **The brand refactor was pixel-verified.** All 23 stories under
   `Design System/Brand` and `Applications/Marketing` were screenshotted at
   1100×900 before and after. **Every pair is byte-identical.**

## 3 · What was changed

### 3.1 · `src/apps/tiles.stories.tsx` — a story for every registered tile

Modelled on `hyperblog/ui/src/apps/tiles.stories.tsx`, which was the right
pattern to copy. Applications are looked up **by id** through `appFor`, never
imported, which buys three things:

1. A story renders exactly what a tile renders — same descriptor, same
   `AppProps`, same providers.
2. An application that stops registering itself fails loudly with a named
   `EmptyState` instead of vanishing. This matters more here than in hyperblog:
   `apps/all.ts` populates the registry through 27 side-effect imports, and a
   tool that prunes an "unused" import empties a launcher slot in silence.
3. `AllTiles` is generated from `allApps()`, so an application added without a
   story is impossible — the contact sheet grows on its own.

Three decisions differ from hyperblog's, and each is about this package:

- **The stage is assembled, not borrowed.** `.storybook/withPbui` supplies a
  *display-only* PBUI context that collects verbs into a visible log. That is
  right for an atom and wrong for a tile, whose interesting behaviour is what
  its verbs do to the world. These stories set `pbui: false` and mount the
  product's own `WorkbenchProviders`, whose `perform` runs `actionsForVerb`
  against a real store — so right-clicking a chip in one of these stories
  actually dispatches.
- **The placement and view are seeded through `singleStageLayout`,** not
  synthesised as an `AppView` literal. They render identically, and the literal
  lies about one thing: the document bar re-points a view *in the layout slice*,
  so a view the store has never heard of makes that control a silent no-op and
  the story teaches that it is broken.
- **`seed: !empty`.** `makeStore` gives a document-less world a document by
  default, which is right for the product and would have silently deleted the
  `ChartWithNoDocument` story.

No story touches the network: `makeStore({ fixtures })` answers the base query
from the committed tables (DR-48). The account tiles have no fixture equivalent
— `/v1/me` genuinely is a server call — so they render their **signed-out**
branch, which is the correct default: it is what a first visitor sees, and the
state nobody had looked at.

34 stories: one per registered application, plus second states where they are
cheap and meaningful (a chart with no document, a scoped launcher, each tour
tile inside and outside a tour), plus the contact sheet.

### 3.2 · `test/stories.test.ts` — the guard that stops it reopening

Two additions:

- `"Applications/Tiles"` added to the sidebar-group whitelist. **This guard
  fired on the first run**, which is a small proof that it works.
- A new `describe("tile story coverage")` block: every id parsed out of a
  `registerApp({ … })` literal must appear in a `renderTile("id"` call. So a
  twenty-eighth application whose author never opened Storybook fails in CI
  rather than shipping unseen. Parsed rather than imported, for the reason
  `apps.test.ts` gives — importing `apps/all` turns a 20 ms test into a bundling
  exercise.

### 3.3 · `components/brand/Brand.module.css` split into three

The one genuine convention violation in `components/`. One sheet styled four
components, and — the part that actually cost something — it let one component
select into another:

```css
.lockup_masthead .bar { height: 4px; }
.lockup_footer   .bar { height: 3px; }
.lockup_masthead .rule, .lockup_footer .rule { gap: 0; }
```

`.bar` and `.rule` belong to `PhaseRule`; `.lockup_*` belongs to `Lockup`. The
consequence was concrete: **the same `<PhaseRule />` drew 8px bars in its own
story and 4px bars inside a masthead, and neither the component nor its story
said so.** Two of its three appearances could not be storied at all.

The fix makes the size travel as data. `PhaseRule` gains
`size?: "hero" | "masthead" | "footer"` (default `hero`, the previous
rendering), owns both heights in its own module, and `Lockup` passes its own
size down. A `Sizes` story now shows all three.

`.claimRule .phaseLabel { color: inherit }` was **deleted rather than moved**.
It had been dead since `on="ink"` was added: that sets the label colour as an
inline style, and an inline style wins against any class. `ClaimBlock` no longer
passes a `className` at all.

Rendering is unchanged and that is checked, not asserted — 23 byte-identical
screenshot pairs (§2.8).

### 3.4 · `/.ttmp.yaml` at the pbui repository root

Not a UI change, but it cost the first twenty minutes and would cost the next
person the same. `pbui` had no `.ttmp.yaml`, so `docmgr` walked up past the
repository root, found `../.ttmp.yaml` in the workspace directory, and resolved
`root` to **`agentlogic/ttmp`**. The `--root ttmp` flag does not override it —
`docmgr config show` reports the flag as `<not applicable>` — so
`docmgr --root ttmp ticket create-ticket` printed success and wrote the ticket
into the neighbouring repository.

## 4 · What was deliberately left alone, and why

| Thing | Why |
|---|---|
| The 35 folders with no `.module.css` | 31 own no styles at all; 4 carry one token-valued inline declaration. Adding 35 files, 31 of them empty, to satisfy a literal reading is churn. The decision is already stated in the test that would enforce it. |
| `UploadApp` at 331 lines | Its JSX is one organism. The bulk is the staged upload protocol. Extracting a `useUpload` hook is a real improvement and a separate commit — §7 says so explicitly. |
| `components/brand/phases.ts` | Shared vocabulary, not a component. A folder and a stories file for `PHASES = [...]` would be worse. |
| The four layer barrels at depth 2 | §4 of the playbook tells you to write them. §8's first bullet contradicts §4 and should be amended. |
| Missing `index.ts` in 19 of 24 `apps/` folders | §6a governs `components/**`. `apps/all.ts` imports the module path directly and deliberately, for the side effect; a barrel would be a second thing to keep in step. Not a gap. |
| `apps/tutorials/` as five flat files | A family of four tutorial tiles plus their shared frame — §3.3's family rule, correctly applied. |
| The four inline `style=` props | Token-valued, one line each, and none is the `CSSProperties` constant the existing test already forbids. |

## 5 · What another PBUI product should copy from here

Four tests, none longer than 140 lines, each of which converts a written-down
convention into a failure someone will actually see:

| Test | What it makes impossible |
|---|---|
| `test/tokens-used.test.ts` | A `var(--pbui-typo)` that silently voids its declaration. **Run this one first** — §2.2 of the playbook is right that everything else is downstream of it. |
| `test/no-raw-controls.test.ts` | The forty-third hand-rolled `<button>`. Each allowlist entry costs a sentence, and a stale entry fails. |
| `test/stories.test.ts` | A component — and now an application — that nobody has ever looked at. |
| `test/layers.test.ts` | An import that crosses the dependency graph the wrong way, with stories deliberately exempt, because a story's job is to compose whatever demonstrates the thing. |

The pattern they share is worth naming: **an escape hatch that costs a
sentence**. Every one of them can be opted out of, and every opt-out is a string
someone had to write down, which fails when it stops applying. That is why they
are still true a ticket later.

The other lesson is about this audit rather than about the package. The claim
"every component folder has all four files" was produced by a loop that tested
for three of them. It was not dishonest; it was a check whose *name* was broader
than its *body*, which is the same failure mode the four tests above exist to
prevent — and it is why §2.2 and §2.4 of this document report what was measured
rather than what was concluded.

## 6 · Follow-ups

1. **Extract a `useUpload` hook from `UploadApp`.** ~290 lines of staged-upload
   protocol inside a container. No rendering change; own commit.
2. **Amend §8's first bullet in the refactoring playbook** so it does not
   contradict §4's layer barrels.
3. **Consider pointing a Storybook test-runner at `Applications/Tiles`.** The
   a11y addon is configured to `test: "error"`, but nothing runs it in CI —
   `vitest` here is node-environment only. 34 new stories over real providers is
   a meaningful surface for it.
4. **The four inline `style=` props** could move into modules if any of those
   components ever grows a second rule. Not before.
