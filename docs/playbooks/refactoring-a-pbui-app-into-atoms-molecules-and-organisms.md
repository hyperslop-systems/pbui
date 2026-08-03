---
Title: Refactoring a PBUI app into atoms, molecules and organisms
Ticket: PBUI-REFACTOR-1
Status: active
Topics:
    - pbui
    - frontend
    - refactoring
DocType: playbook
Intent: long-term
Owners: []
RelatedFiles: []
ExternalSources: []
Summary: "How to take an existing PBUI application whose UI is flat files and a global stylesheet, and move it to the family convention — one folder per component, atoms/molecules/organisms, stories beside the component — without a big-bang rewrite and without breaking the product."
LastUpdated: 2026-08-02
WhatFor: "Retrofit a PBUI-family frontend that was built before the convention was written down, in reviewable steps, with the product working after every one."
WhenToUse: "Read the whole thing before starting. Do §2 before touching a component. Follow §4's loop for each component; §5 is the order to take them in."
---

# Refactoring a PBUI app into atoms, molecules and organisms

## What this is, and why it is needed

PBUI's own `src/components` follows a strict convention: every component is a
**folder**. No product built on PBUI followed it, because until
recently nobody had written it down. The convention is now
[`building-a-new-hyperslop-systems-app-on-pbui.md` §6a][new-app]; this document
is the other half — how to get an **existing** application there.

[new-app]: ./building-a-new-hyperslop-systems-app-on-pbui.md

The target, for every component at every level:

```
components/molecules/PostRow/
  PostRow.tsx           the component, and the doc comment that argues for it
  PostRow.module.css    its styles — ONLY IF it has any; NOT a shared sheet
  PostRow.stories.tsx   every state it has
  index.ts              export { PostRow }; export type { PostRowProps };
```

A component that composes PBUI components and passes tones has no styles of its
own and wants no stylesheet — see §1 rule 2. Roughly half of datalab-ui's are
like that, and it is the target state rather than a gap.

**This is a mechanical refactor with a judgement problem inside it.** The
mechanical part — making folders, moving files, writing barrels — is an
afternoon. The judgement is deciding *what the components are*, and that is
where the work actually is. Sections 3 and 5 are about that.

---

## 1 · The rules, restated

Six of them. Print them; you will re-read them.

1. **One folder per component, at every level.** Atom, molecule, organism,
   page. Three files always — `Name.tsx`, `Name.stories.tsx`, `index.ts` — plus
   `Name.module.css` when it has styles of its own. No exceptions for "small"
   components; small is what a folder is for.
2. **`.module.css` beside the component, never a shared stylesheet.** A global
   `app.css` with `.foo-row`, `.foo-item`, `.foo-chip` in it is a global
   namespace: renaming means grepping, deleting a component leaves its rules
   behind forever, and two components eventually collide. Product-wide *tokens*
   stay in `styles/tokens.css`; component *rules* do not.

   **A component with no styles needs no stylesheet.** The rule is "its rules
   live beside it", not "every folder has four files". Composing PBUI
   components and passing tones is the target state.

   The sharpest version of why a *shared* sheet is wrong: datalab-ui's brand
   components shared one, and it contained `.lockup_masthead .bar` — a
   descendant selector reaching from one component into another. The same
   `<PhaseRule/>` therefore drew an 8px bar in its own story and a 4px bar
   inside a masthead, and **two of its three real states could not be storied
   at all.** A cross-component selector does not just risk collision; it makes
   the component's appearance depend on who is rendering it, which is the end
   of both reuse and testability.
3. **Stories beside the component.** One `.stories.tsx` per component,
   covering every state it has. Documentation that lives away from the thing it
   documents is documentation nobody updates.
4. **Reuse before you extract.** PBUI ships about twenty-eight components. Look
   there first, then in your own `atoms/`, and only then write one.
5. **A tile is a container, not a view.** `apps/<Tile>.tsx` reads the store,
   derives, and hands down. The markup lives in `organisms/`.
6. **The product works after every commit.** This is a refactor, not a rewrite.

---

## 2 · Before you move a single file

Four things, in this order. Skipping any of them turns a safe refactor into a
long afternoon of not knowing what you broke.

### 2.1 · Get a green baseline and write the numbers down

```bash
make ui-test        # typecheck + unit tests
make ui             # a real build
make ui-token-check # see §2.2 — this is the one that surprises people
```

Record the counts you will be judged against later:

```bash
find ui/src/components -name '*.tsx' | wc -l   # components today
find ui/src -name '*.stories.tsx' | wc -l      # stories today
wc -l ui/src/styles/app.css                    # the global sheet
grep -c '^\.' ui/src/styles/app.css            # how many global classes
```

### 2.2 · Check the tokens FIRST

**Do this before you touch a component, and do not skip it because the app
"looks fine".**

PBUI ships components that read design tokens and defines none of them. An
undefined custom property makes the declaration invalid at *computed-value*
time — `border: var(--pbui-border-hair)` becomes **no border** — with no build
error and no console warning.

```bash
C=$(ls pkg/webui/dist/assets/*.css)
comm -23 <(grep -oh -- 'var(--pbui-[a-z0-9-]*)' $C | sed -e 's/var(//' -e 's/)$//' | sort -u) \
         <(grep -oh -- '--pbui-[a-z0-9-]*:' $C | sed 's/:$//' | sort -u)
```

Anything it prints is read and undefined. **Fix that before refactoring
anything**, for a reason that is not obvious:

> If PBUI's components render bare, a raw `<button>` genuinely looks better
> than `<Button>`, and you will "reuse" nothing because reuse looks like a
> downgrade. A CSS defect becomes a component-adoption decision. This is
> exactly how `agentlogic` ended up using 6 of PBUI's ~28 components, and how
> `hyperblog` hand-rolled a chip, a button and an input in its first draft.

Two specific things to check while you are here:

- **The token NAMES are the family's**, not ones you invented. The contract
  uses semantic `--pbui-tone-*` names. `hyperblog` aliased `--pbui-blue` and
  five siblings from a design sketch; none of them existed, so every chip's
  left edge silently fell back to ink.
- **Since pbui 0.3.0 this check should print nothing**, because pbui now ships
  a default for every token it reads. It still catches the other half of the
  failure: a token *you* invented that pbui never reads. hyperblog aliased
  `--pbui-blue` and five siblings from a design sketch; none of those names
  exist, and the check is what found it.
- The nine `JsonBlock`/`Dialog` tokens are read WITH inline fallbacks, so they
  never rendered as nothing — they rendered in a slate-blue palette from no
  family product. pbui now defines them on-system.

### 2.3 · Take an inventory, and a screenshot of every tile

> **If the app has no screenshot baseline and you are not adding one**, say so
> and substitute something real — the datalab-ui audit rendered all 34 tile
> stories in headless Chromium and diffed 23 before/after brand screenshots
> instead. "I verified it in a browser" is a legitimate substitute; "it
> typechecks" is not.

You are about to move code that no test covers. **A screenshot is the test.**

```bash
make ui-storybook
# and/or run the app and photograph each tile
```

Put them somewhere you can diff against later. A refactor that changes rendering
is a bug, and without a before-picture you will not notice a 2px shift or a
chip that lost its tone.

### 2.4 · Set up the ticket and the diary

This work is long, mechanical, and easy to lose the thread of. A diary with a
step per component is what lets somebody else finish it — or you, on Monday.

```bash
docmgr --root ttmp ticket create-ticket --ticket APP-REFACTOR-1 \
  --title "Refactor the UI into atoms, molecules and organisms" \
  --topics pbui,frontend,refactoring
docmgr --root ttmp doc add --ticket APP-REFACTOR-1 --doc-type reference --title "Diary"
```

---

## 3 · Deciding what the components ARE

The hard half. Three questions, applied to each candidate.

### 3.1 · Is it already in PBUI?

Check before you extract anything:

```
atoms       Button CheckboxRow Chip CodeLine IconButton LinkAction Meter
            SelectInput Sparkline Swatch TextArea TextInput
molecules   Callout DiffHunk EmptyState FileDropZone InlineRename KindLegend
            Legend MoreBar ResultLog SegmentedBar
layout      Stack Surface Toolbar AppBody
foundation  Text SectionLabel Divider VisuallyHidden Kbd CodeText
other       JsonBlock Dialog InspectorPanel TileFrame useTileDrag LauncherShell
```

If you are about to write a `<button>` with an inline style, a `<div>` with
`display:flex; gap:…`, or a "nothing here" message, the answer is already
shipped. **Deleting your copy is the best possible outcome of this refactor.**

Signals you are re-implementing something:

| You have | Use instead |
|---|---|
| `.foo-button`, a styled `<button>` | `Button` (`bare` / `framed` / `raised`) |
| `.foo-row` / `.foo-col`, a flex div | `Stack` |
| `.foo-empty` + a hint | `EmptyState` |
| `.foo-meta`, faint small text | `Text size="tiny" tone="faint"` |
| an uppercase section heading | `SectionLabel` |
| `<pre>{JSON.stringify(x, null, 2)}</pre>` | `JsonBlock` |
| a styled `<input>` / `<textarea>` | `TextInput` / `TextArea` |
| a progress bar built from two divs | `Meter` |
| the tile's title bar and split buttons | `TileFrame` |

### 3.2 · Which layer is it?

The test that actually works — **what does it know?**

- **Atom** — knows nothing about the domain. It takes a label and a tone. The
  exception in a PBUI product is the **presentation-bound atom**: a thin
  wrapper that binds a pbui atom to one of *your* presentation types. PBUI
  cannot ship these, because it does not know your types.
- **Molecule** — knows about one small domain thing, or composes two or three
  atoms into a shape that recurs. `PostRow` knows what a post is.
- **Organism** — a whole panel. Props in, pixels out. **It does not fetch and
  it does not dispatch.** Every interaction is a callback the container gives
  it.
- **Page** — the shell, the front door, the workbench frame.
- **App (tile)** — a *container*: reads the store, derives, renders one
  organism. If your tile is 300 lines of JSX, its organism has not been
  extracted yet.

### 3.3 · Is it one component or a family?

Seven near-identical fifteen-line wrappers that differ only in a tone do **not**
want seven folders. They are one family: one folder, one `index.ts` exporting
all of them, one stories file showing them side by side.

Precedent exists in PBUI: `foundation/Text` exports both `Text` and
`SectionLabel`. `hyperblog` has `atoms/PresentationChip` exporting seven chips.

**The test:** would you ever want one without the others? If not, it is a
family.

---

## 4 · The loop, per component

Do **one component at a time**, all the way through, and commit. Do not move
twelve files and then start writing stories; you will lose the thread and the
diff will be unreviewable.

```bash
# 1. make the folder and move the file
mkdir -p ui/src/components/molecules/PostRow
git mv ui/src/components/molecules/PostRow.tsx \
       ui/src/components/molecules/PostRow/PostRow.tsx
```

```ts
// 2. the barrel — ui/src/components/molecules/PostRow/index.ts
export { PostRow } from "./PostRow";
export type { PostRowProps } from "./PostRow";
```

```bash
# 3. move ITS rules out of the global sheet into PostRow.module.css,
#    renaming .foo-post-row -> .row, .foo-post-row-title -> .title, etc.
#    The class names get shorter because the module scopes them.
```

```tsx
// 4. in the component: import styles, and swap the class strings
import styles from "./PostRow.module.css";
//  className="foo-post-row"                        →  className={styles.row}
//  className={`foo-post-row ${isRead ? "is-read" : ""}`}
//                                                  →
//  className={[styles.row, isRead ? styles.read : ""].filter(Boolean).join(" ")}
```

```bash
# 5. fix the import depth — you went one level deeper
#    "../../model/x"  ->  "../../../model/x"
# 6. write the stories (§4.1)
# 7. verify
make ui-test
# 8. commit ONE component
git add ui/src/components/molecules/PostRow ui/src/styles/app.css
git commit -m "ui: extract PostRow into its own folder"
```

Then update the barrel one level up, and switch callers to it:

```ts
// ui/src/components/molecules/index.ts
export * from "./PostRow";
```

```diff
- import { PostRow } from "../components/molecules/PostRow";
+ import { PostRow } from "../components/molecules";
```

### 4.1 · What a stories file must cover

Not "a default story". **Every state the component has**, which is usually
between four and eight:

- the ordinary case
- every boolean prop, on
- every enum value
- the **empty** case
- the **error / locked / disabled** case, if it has one
- the case that used to be broken, if you are fixing one

Two rules specific to PBUI products:

- **Wrap presentation-bound components in the real provider.** A story that
  renders a chip bare will look correct and prove nothing — right-clicking it
  does nothing without a `PbuiProvider`. Write one shared `StoryFrame` in
  `fixtures/` and decorate with it.
- **Use real captured data, not hand-written objects.** Capture actual server
  responses into `fixtures/`. A hand-written fixture drifts from the wire
  format, and then a story looks right while the product is wrong.

### 4.2 · The CSS-module gotchas

- **A kebab class becomes a camel property.** `.post-row` is
  `styles["post-row"]`. Rename to `.row` while you are moving it — the module
  is the namespace now, so the prefix is redundant.
- **`composes:` only works in a module**, and only from another module. If two
  components genuinely share a rule, that rule belongs on a shared component,
  not in a shared class.
- **Global tokens stay global.** `var(--pbui-*)` and your `--app-*` aliases
  live in `styles/tokens.css` and are referenced from every module. Only
  *rules* move.
- **A `:global()` escape hatch exists.** Almost every use of it is a component
  that has not been extracted yet.

---

## 5 · The order to take them in

Bottom-up. Each step makes the next one smaller.

**Step 0 — tokens.** §2.2. Everything else is wrong until this is right.

**Step 1 — delete what PBUI already ships.** The biggest single win, and it
*shrinks* the codebase. Replace hand-rolled buttons, inputs, empty states, flex
rows and faint text with the imports from §3.1. Expect the global stylesheet to
lose a third of its lines here, before you have extracted anything.

**Step 2 — atoms.** Usually the presentation-bound chips. Small, high-traffic,
and they unblock every molecule.

**Step 3 — molecules.** Take the *most duplicated* first. Grep for repeated
markup: if five tiles write the same three-line `<div>`, that is a molecule and
extracting it removes five copies.

**Step 4 — organisms, by pulling markup OUT of tiles.** This is where the
judgement is. For each tile over ~150 lines, ask what the *panel* is, and move
that markup into `organisms/<Panel>/` with props for everything it used to read
from the store. The tile shrinks to a container.

**Step 5 — pages.** The shell, the landing page, the front door. Same treatment.

**Step 6 — the global stylesheet's last stand.** What remains should be
genuinely product-wide: the shell layout, the split tree, tokens, a prose
grammar. If a class in there names a component, that component is not done.

### 5.1 · A worked example of step 4

`hyperblog`'s `TermApp` before: 190 lines, all markup, reading the store
throughout. After: a 60-line container plus `organisms/TermPanel/`.

```tsx
// apps/TermApp.tsx — the container, after
export function TermApp(): ReactNode {
  const world = useWorld();
  const term = world.corpus.termById.get(world.cursor.termId);

  const related = useMemo(() => (term ? neighbours(world.corpus, term.id) : []), …);
  const mentions = useMemo(() => …, [world.corpus, term]);

  if (!term) return <AppBody><EmptyState message="No term is focused." … /></AppBody>;

  return (
    <AppBody>
      <TermPanel
        term={term}
        related={related}
        mentions={mentions}
        onFocusTerm={(id) => world.setTerm(id, "term-tile")}
        onOpenPost={(id, p) => world.openPost(id, p)}
      />
    </AppBody>
  );
}
```

Everything the panel needs arrives as a prop, and every action leaves as a
callback. The panel can now be storied in six states with no provider and no
store — which is the entire point.

---

## 6 · Verifying you did not break it

After **every** component, and again at the end:

```bash
make ui-test           # typecheck + tests
make ui                # a real build
make ui-token-check    # ← the one that catches a lost class
make ui-storybook      # and LOOK at it
```

**Look at the screenshots.** Compare against §2.3. The failure mode of a CSS
module migration is not an error — it is a class that silently stopped
applying, because you renamed `.foo-item` to `.item` in the CSS and left
`className="foo-item"` in the TSX. TypeScript will not catch it. The build will
not catch it. The bundle will contain a rule nothing uses and an element with a
class nothing defines.

A cheap grep that catches most of it:

```bash
# every class still referenced as a plain string in TSX
grep -rho 'className="[a-z][a-z0-9 -]*"' ui/src --include='*.tsx' \
  | sort -u
# each one should be either a global (shell, layout) or a bug
```

---

## 7 · The traps

- **Do not move twelve files and then start writing stories.** One component,
  all the way through, commit. The diff stays reviewable and a bisect stays
  useful.
- **Do not "improve" the component while you move it.** A refactor that also
  changes behaviour is a refactor nobody can review. Note the improvement in
  the diary and do it in a separate commit.
- **Watch the import depth.** Moving `X.tsx` into `X/X.tsx` breaks every
  relative import by one level. It is the single most common failure in this
  work and TypeScript catches all of it — so run `typecheck` per component, not
  per session.
- **A barrel that re-exports a barrel is fine; a cycle is not.** If
  `molecules/index.ts` imports from `organisms/`, you have layered something
  wrong.
- **`index.ts`, not `index.tsx`.** A barrel has no JSX. If yours does, it is a
  component that has not been given its own folder — `agentlogic`'s
  `components/molecules/index.tsx` holds *thirteen* components and is exactly
  this.
- **Do not let the global stylesheet grow while you shrink it.** If you find
  yourself adding a class to `app.css` during this work, stop: it belongs in a
  module.
- **Storybook overrides `base` and `outDir`.** If it does not, a Storybook
  build writes over the embedded workbench in `pkg/webui/dist`.

---

## 8 · Definition of done

Not a checklist of activities — a set of properties that are either true or
not:

- [ ] Every entry two levels down in `components/` is a **folder or a layer
      barrel**:

      ```bash
      find ui/src/components -mindepth 2 -maxdepth 2 -type f \
        -not -name 'index.ts'
      ```

      It should print nothing. **Note the `-not -name index.ts`:** §4 tells you
      to write a barrel per layer (`molecules/index.ts`), so a check that
      forbids every file at that depth contradicts the instructions. An earlier
      draft of this section did exactly that, and the datalab-ui audit caught
      it. A non-component data module (`phases.ts` beside the brand components)
      is a legitimate second exception — decide it deliberately and say so.

- [ ] Every component folder holds `Name.tsx`, `Name.stories.tsx` and
      `index.ts`, **plus `Name.module.css` if and only if it has styles.**

      Do not create empty stylesheets to satisfy a count. In datalab-ui, 35 of
      73 components have no `.module.css` because they have no styles at all —
      31 of those have no `style=` attribute either. They compose PBUI
      components and pass tones, which is the target state, not a gap. A
      component that *does* style itself and keeps those rules in a shared
      sheet is the violation; a component with nothing to style is done.
- [ ] `ui/src/styles/app.css` contains **no** component-scoped rule. Every
      class left in it is the shell, the layout, or a token.
- [ ] Every component has a stories file, and every state is in it.
- [ ] `make ui-token-check` passes.
- [ ] No tile is over ~150 lines, and none of them contains a panel's markup.
- [ ] The count of hand-rolled controls that duplicate a PBUI component is
      **zero**. Grep for `<button`, `<input`, `<textarea` outside `atoms/`.
- [ ] The screenshots match §2.3.

Consider adding the guard PBUI carries — `test/no-raw-controls.test.ts` forbids
a raw `<textarea>` outside `atoms/`. A product-side equivalent is twenty lines
and stops the drift coming back.

---

## 9 · Write it down

A diary, in the `diary` skill's format, with **a step per meaningful chunk** —
not per file. Each step should say what moved, what was deleted in favour of a
PBUI component, what you decided about layering and why, and anything that
looked wrong in a screenshot.

The two things that will matter to the next person:

- **The layering decisions.** "Why is this a molecule and not an organism" is
  the question a reviewer will actually ask, and the answer is not in the diff.
- **What you found while you were in there.** A refactor is the most thorough
  read of a codebase anybody will do that year. The dead code, the duplicated
  logic, the component nobody renders — write them down as follow-ups rather
  than fixing them inline.
