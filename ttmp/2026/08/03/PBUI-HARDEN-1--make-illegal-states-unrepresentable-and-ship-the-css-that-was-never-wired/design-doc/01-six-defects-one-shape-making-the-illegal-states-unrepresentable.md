---
Title: 'Six defects, one shape: making the illegal states unrepresentable'
Ticket: PBUI-HARDEN-1
Status: active
Topics:
    - pbui
    - frontend
    - design
    - api
    - css
    - accessibility
DocType: design-doc
Intent: long-term
Owners: []
RelatedFiles:
    - Path: repo://src/presentation/types.ts
      Note: PresentationAction — the disabled/disabledReason pair that started this
    - Path: repo://src/presentation/createPbui.tsx
      Note: the wrong guard (P2.1), the unconditional stopPropagation (P4.1), role=button (P6.2)
    - Path: repo://src/components/atoms/SelectInput/SelectInput.tsx
      Note: the same wrong guard, latent (P2.2); label is aria-only (P5.2)
    - Path: repo://src/components/molecules/FileDropZone/FileDropZone.tsx
      Note: the third copy of the pair, guarded correctly but typed loosely (P3.3)
    - Path: repo://src/components/organisms/FileBrowser/FileBrowser.tsx
      Note: renamingId/onRenameStateChange (P3.5), roving focus (P4.3), onCreate (P6.1), trees/emptyState (P6.4)
    - Path: repo://src/styles.css
      Note: 100 lines of zero-specificity fallbacks that no module imports, so they never ship (P1.1)
    - Path: repo://src/index.ts
      Note: imports tokens.css and not styles.css — the one-line cause of P1.1
    - Path: repo://packages/datalab-ui/src/pbui/verbs.ts
      Note: disabledBecause — the merged field this ticket adopts upstream, already proven in a product
ExternalSources: []
Summary: 'Six pbui defects that reduce to two root causes: a field whose meaning depends on another field is a separate field, and a safety net that nothing imports does not ship. Phases, the type designs, the migration cost per consumer, and what each phase must prove before the next starts.'
LastUpdated: 2026-08-03T11:31:02.994666051-04:00
WhatFor: The design of record for PBUI-HARDEN-1 — read before implementing any phase.
WhenToUse: When implementing a phase, when reviewing the diff, or when a seventh instance of either root cause turns up.
---

# Six defects, one shape

## 1 · What this ticket is

Six defects in pbui, found across three separate investigations — the
turboproof filebrowser build, the agentlogic atoms/molecules/organisms
refactor, and a survey done while reviewing the first two. They are grouped
into one ticket because they reduce to two root causes, and fixing them one at
a time would mean discovering both causes three more times.

**Root cause A — a field whose meaning depends on another field's value should
not be a separate field.** Every instance produces the same failure: a
consumer writes correct-looking code, the types accept it, the tests pass, and
the feature silently does something adjacent to what was intended. Nothing
warns, because from the compiler's position nothing is wrong.

**Root cause B — a safety net that nothing imports does not ship.** pbui has
now built this twice: `tokens.css`, fixed in 0.3.0, and `styles.css`, still
broken. Both were written deliberately, both carry a header explaining what
they protect against, and both were absent from the bundle.

The two causes are related by their failure signature rather than their
mechanism. Neither produces an error. Both are found only when a human looks
at a screen and notices something is off, which is why all six survived
multiple reviews.

## 2 · The evidence, per defect

| # | Defect | Root cause | Live? | Phase |
|---|---|---|---|---|
| A1 | `PresentationAction.disabled` / `disabledReason` disagree | A | **15 sites in 3 products** | P2.1, P3.1 |
| A2 | `SelectOption.disabled` / `reason` — the identical wrong guard | A | latent (no caller yet) | P2.2, P3.2 |
| A3 | `FileDropZone.disabled` / `disabledReason` — typed loosely | A | latent | P3.3 |
| A4 | `Presentation.onActivate` / `activateDoc` | A | latent | P3.4 |
| A5 | `FileBrowser.renamingId` / `onRenameStateChange` | A | latent | P3.5 |
| B1 | `src/styles.css` imported by nothing | B | **yes** | P1.1 |
| B2 | Four stylesheets, ordered, undetectable if missing | B | **agentlogic drifted** | P1.3, P1.5 |

Plus four carried from the turboproof report and the agentlogic refactor:
`Presentation` swallowing the host's click (P4), `label` meaning `aria-label`
in twelve components (P5), `onCreate` declared and never called (P6.1),
`role="button"` inside `role="treeitem"` (P6.2), and the duplicate-React trap
(P6.3).

### 2.1 · The count that decides the design

The `disabled` + explanation pair appears **three times** in pbui, written
three times by hand:

```tsx
// createPbui.tsx:371 — WRONG. Guards on the reason existing.
{action.disabledReason && <span data-part="menu-reason"> — {action.disabledReason}</span>}

// SelectInput.tsx:114 — WRONG, identically, down to the em dash.
{option.reason ? `${option.label} — ${option.reason}` : option.label}

// FileDropZone.tsx:81 — RIGHT.
{disabled ? (disabledReason ?? label) : label}
```

Two of three are wrong. Meanwhile `datalab-ui`, which merged the concept into
one field, wrote it twice and got it right both times
(`verbs.ts:146`, `LauncherResults.tsx:87`):

```ts
disabledBecause?: string;   // present ⇔ unavailable, and this is why
```

That asymmetry is the argument for this ticket. It is not that the two-field
API invites a mistake — it is that pbui has no shared representation of
"unavailable, and why", so every component re-derives one, and the
re-derivations are wrong more often than they are right.

## 3 · The designs

### 3.1 · One field, not a union

An earlier draft proposed a discriminated union on `disabled`:

```ts
type PresentationAction<V> =
  | { …; disabled?: false }
  | { …; disabled: true; disabledReason: string };
```

That makes the illegal states unrepresentable, but it forces every call site
into a conditional spread, because `disabled: someBoolean` no longer
type-checks against either arm:

```ts
...(tile.canClose ? {} : { disabled: true, disabledReason: "…" }),
```

which is the exact workaround shape this ticket exists to delete. **The merged
single field is strictly better**, because absence already means "not
disabled":

```ts
/** Present ⇔ unavailable, and the string is why. */
disabledBecause?: string;
```

```ts
// the call site becomes one expression over one field
disabledBecause: tile.canClose ? undefined : "the last tile in a workspace cannot close",
```

Both illegal states vanish — a reason without a disable, and a disable without
a reason — and the second is the more valuable one. A greyed action with no
explanation was always a defect; `presentation-parts.css:126-127` states the
policy in prose ("Disabled entries are shown, not hidden: hiding a verb hides
the rule that makes it unavailable"), and this makes the type carry it.

**Name.** `disabledBecause`, taken from datalab-ui rather than invented. The
reason is concrete: datalab-ui's six descriptor files and its `LauncherResults`
already use it, so adopting the name upstream migrates that product with a
zero-line diff and collapses its adapter (`registry.ts:71-72`) to a passthrough.

**The downstream test for whether a merge is real:** the guards disappear
rather than multiply. After the merge, `disabled={action.disabledBecause !==
undefined}` needs no separate condition, and `title={action.disabledBecause ??
action.description}` is correct with no guard at all, because the field being
set now *means* disabled.

### 3.2 · The same shape, generalised

Three more pairs take the same treatment. The mechanical rule:

> If prop B is only read inside a branch that tests prop A, then B belongs
> inside A — as A's payload, or as an object A owns.

```ts
// Presentation: activateDoc is read only inside the `onActivate ?` branch
- onActivate?: () => void;
- activateDoc?: string;
+ activate?: { run(): void; doc?: string };

// FileBrowser: the doc comment says "Provide both or neither", which is the tell
- renamingId?: string | null;          // undefined = uncontrolled, null = controlled-none
- onRenameStateChange?(id: string | null): void;
+ rename?: { id: string | null; onChange(id: string | null): void };
```

`rename` also retires an overload: `renamingId` currently means three things
(`undefined` uncontrolled, `null` controlled-and-idle, `"x"` controlled-and-
renaming). Presence of the object is the mode, so `undefined` and `null` stop
competing.

### 3.3 · What good already looks like

`SegmentedBar.total` is the counter-example and is deliberately left alone.
One optional number selects between two readings of the bar, and headroom, the
OVER badge and the summary all derive from that single value
(`SegmentedBar.tsx:70-76`). There is no second field to disagree with it. The
mode *is* the value — which is what every merge above is trying to reach.

### 3.4 · Root cause B: shipping the CSS

`src/styles.css` is 100 lines of `:where()` fallbacks for the presentation
parts. Its own header states the purpose: *"so a bare consumer sees something
legible before it styles anything."* `src/index.ts` imports `./tokens.css` and
not `./styles.css`, so Vite never pulls it into the module graph and it is
absent from `dist/pbui.css`.

The deeper problem is what made that invisible. pbui exports four stylesheets
as separate subpaths that must all be imported, in a documented order:

```
styles.css → components.css → presentation-parts.css → chrome.css
```

Miss one and there is no error — just a component rendering bare. agentlogic
already missed two, in the file where it matters most:

| | stylesheets imported |
|---|---|
| `agentlogic/ui/src/main.tsx:52-64` | styles, components, **presentation-parts**, **chrome** |
| `agentlogic/ui/.storybook/preview.tsx:12-13` | styles, components |

So agentlogic's Storybook renders the tile chrome unlike its own product — and
Storybook is what its entire component refactor was verified through.
hyperblog, turboproof and datalab-ui import all four in both places.

Measured after the fix rather than assumed: agentlogic imports exactly one
thing from pbui's chrome (`TileFrame`, `TileTree.tsx:185`) and nothing from its
presentation runtime, so no agentlogic story renders a `Presentation` or an
`ObjectMenu`. The blast radius is the tile frame alone — but the tile frame is
on every workspace story, and it lost its 2px border and its white background
in all of them.

**The fix has two halves.** Wire `styles.css` into the module graph so it
ships (P1.1); and make the `styles.css` export self-sufficient, so importing
one stylesheet is enough and the ordering contract stops being the consumer's
problem (P1.3). The granular subpaths stay for anyone who wants them.

### 3.5 · The label trap

Twelve components take a prop named `label` and render it only as
`aria-label`. For the graphics and regions — `Meter`, `Sparkline`,
`ResultLog`, `KindLegend`, `SegmentedBar`, `BackdropPanel` — an accessible
name is the right thing, and only the name is wrong.

For the four form controls — `TextInput`, `TextArea`, `SelectInput`,
`InlineRename` — it is a trap, because every other React component library
renders a visible `<label>` for that prop. It has already cost real text:
replacing nine raw `<select>` elements with `SelectInput` in agentlogic
deleted nine visible words, silently, with the types accepting every line.

- Graphics and regions: rename to `accessibleName`. Unmistakable, and the
  compiler finds every call site.
- Form controls: `label` renders a real `<label>`; `accessibleName` stays
  available for the genuinely label-less case.

## 4 · Phases, and what each must prove

Ordered so that value lands before breakage. Phases 1 and 2 are
non-breaking and fix live defects; 3 through 5 are the API changes; 6 is the
remainder and the release.

| Phase | Content | Breaking | Must prove before the next starts |
|---|---|---|---|
| P1 | Ship the CSS; fix agentlogic's Storybook | no | A bare consumer renders a styled Presentation; agentlogic's Storybook and app resolve the same rules |
| P2 | Correct the two wrong guards | no | An enabled action with a reason shows its description and no reason text — in a test |
| P3 | Merge the five pairs; migrate consumers | **yes** | Every product typechecks and tests green against the merged API |
| P4 | Presentation click semantics; roving focus | **yes** | Clicking a directory label through a Presentation toggles it *and* moves the tree's focus |
| P5 | `label` → `accessibleName`; visible labels | **yes** | No product lost visible text; the compiler found every site |
| P6 | onCreate, ARIA, React guard, FileBrowser states; publish 0.4.0 | mixed | 0.4.0 published; four products bumped and green |

**P2 before P3 is deliberate.** The guard fix corrects all 15 live sites
without touching a single consumer, because every one of them already sets
`disabled` correctly — the predicate was never wrong, only its independence
from the prose. That means the user-visible defect is gone before the breaking
change starts, and P3 can be judged on API quality alone rather than under
pressure to fix a live bug.

## 5 · Migration cost

| Consumer | A1 sites | Other | Notes |
|---|---|---|---|
| datalab-ui | 6 descriptor files | adapter | **zero-line diff** on descriptors; `registry.ts:71-72` collapses to a passthrough |
| hyperblog | 10 | — | `term.ts`, `post.ts` ×2, `paragraph.ts` ×3, `rest.ts` ×4 |
| turboproof | 5 | `renderRow`, `vite.config.ts` | 2 in `file.ts` carry a workaround to delete; 3 in `rest.ts` never got one |
| agentlogic | 0 | Storybook imports, `SelectInput` labels | no object-menu reasons; hit by P1.5 and P5 instead |

turboproof is the instructive one. The person who diagnosed A1, wrote up the
mechanism and applied the conditional-spread workaround applied it in one file
and missed three sites in another. A workaround that its own discoverer
applies inconsistently is not a viable answer, and that single fact is worth
more than the rest of this section.

## 6 · What this ticket does not do

- **`SegmentedBar.total`** — already the right shape (§3.3).
- **A lint for the "declared, never called" class.** A sweep of every props
  interface in `src/` found exactly one instance (`FileBrowser.onCreate`). A
  population of one gets a fix, not machinery. The 30-line sweep is kept as a
  test so the population stays at zero.
- **datalab-ui's own token restatement.** Real, tracked elsewhere, unrelated
  to either root cause here.
- **A `Pressable` primitive, an activatable `Chip`, non-string `SelectInput`
  values, `MoreBar` direction.** Feature gaps the agentlogic refactor asked
  for; they are additive and do not belong in a hardening ticket.
