---
Title: Launcher implementation diary
Ticket: DATALAB-VIEW-001
Status: active
Topics:
    - frontend
    - authoring
DocType: reference
Intent: long-term
Owners: []
RelatedFiles:
    - Path: repo://packages/datalab-ui/src/appkit/AppScope.tsx
      Note: useScopedApps vs useAvailableApps, the basis of the per-workspace scope rule
    - Path: repo://packages/datalab-ui/src/appkit/useTransientSurface.ts
      Note: The Escape surface stack
    - Path: repo://packages/datalab-ui/src/components/organisms/LauncherDialog/LauncherDialog.tsx
      Note: Modal container, invocation semantics, focus restoration by placement id
    - Path: repo://packages/datalab-ui/src/components/organisms/LauncherDialog/LauncherResults.tsx
      Note: Tone edges, the active marker, and section ordering
    - Path: repo://packages/datalab-ui/src/components/organisms/ViewSwitcher/launcherIndex.logic.ts
      Note: Pure index, grouping, scoring, and the per-workspace scope rule
    - Path: repo://packages/datalab-ui/src/components/organisms/ViewSwitcher/launcherQuery.logic.ts
      Note: The + and wsN grammar
    - Path: repo://packages/datalab-ui/src/components/pages/Workbench/WorkbenchShell.tsx
      Note: Shortcut boundary and the focus-ownership rule that replaced onKeyDownCapture
    - Path: repo://packages/datalab-ui/src/components/pages/Workbench/shortcutRouting.ts
      Note: Pure Mod+K routing
    - Path: repo://packages/datalab-ui/src/components/pages/WorkbenchInstance/WorkbenchInstance.tsx
      Note: Store-per-instance boundary that removes the isolation case for a context
    - Path: repo://packages/datalab-ui/src/pbui/descriptors/tile.ts
      Note: Serialisable openReplaceView verb that rules out a React-context launcher
    - Path: repo://packages/datalab-ui/src/styles/dialogs.css
      Note: Maps the generic dialog onto the workbench tile aesthetic
    - Path: repo://src/components/Dialog/Dialog.tsx
      Note: One of three window Escape listeners the surface stack must order
    - Path: repo://src/surfaces.test.tsx
      Note: Pins the double-registration and nesting-order behaviours
    - Path: repo://src/surfaces.ts
      Note: Document-global Escape ownership, and the two constraints it carries
ExternalSources: []
Summary: Chronological implementation record for the searchable modal launcher — design-doc corrections, the pure index, the modal, active placement, and real-app verification.
LastUpdated: 2026-07-30T18:50:00-04:00
WhatFor: Review the launcher work step by step, including what failed and why decisions were changed against the shipped code.
WhenToUse: Read before reviewing or continuing the launcher implementation, or when a design-doc statement disagrees with the code.
---




# Launcher implementation diary

## Goal

Capture the implementation of the searchable modal launcher specified in
`design-doc/02-launcher-quick-search-modal-workspace-grouping-and-keyboard-routing.md`:
the corrections made to that document first, then the pure search model, the
modal, active-placement tracking and `Mod+K`, and verification in the running
application rather than only in Storybook.

## Step 1: Revise the design document against the shipped code

The launcher design was written while the normalized-views work was still
landing, and three of its statements do not survive contact with the code that
actually shipped in `6cff173`. Before writing any implementation I reviewed the
document against the tree and corrected those three points in place, keeping the
superseded reasoning visible rather than deleting it — the document is the
artefact a future reader will find, and a decision that quietly changed is worse
than one that says why.

The corrections are structural rather than cosmetic: one changes where state
lives, one changes what the search model computes, and one replaces a fix that
would not have worked. Everything else in the document — Option B, the phasing,
the query grammar, `Mod+K` navigating rather than placing — I left alone,
because reading the code made those look better rather than worse.

### Prompt Context

**User prompt (verbatim):** "update the design doc. Then implement it, testing it in the real app as well, not just storybook. Follow the pbui guidelines for the codebase / react design system decomposition. Keep a detailed diary as you work, according to the diary skill (this is mandatory), and commit at appropriate intervals."

**Assistant interpretation:** Apply the corrections identified in the preceding
review to `design-doc/02`, then implement the corrected design across its three
phases, following `packages/datalab-ui/GUIDELINES.md` for layer placement,
component packaging and stories. Verify in a running browser, not only in
Storybook. Maintain this diary per the diary skill and commit in focused
increments.

**Inferred user intent:** Ship a launcher that is actually correct in the
product, with the design document left in a state that matches what was built,
and an auditable trail of how it got there.

**Commit (docs):** pending at time of writing — recorded in Step 2.

### What I did

- Read the ticket package, `GUIDELINES.md`, and the implicated source:
  `store/layout.ts`, `ViewSwitcher/{model.ts,ViewSwitcher.tsx}`,
  `LauncherApp.tsx`, `Tile.tsx`, `WorkbenchProviders.tsx`,
  `WorkbenchInstance.tsx`, `appkit/AppScope.tsx`, `pbui/descriptors/tile.ts`,
  `src/components/Dialog/Dialog.tsx`, `test/stories.test.ts`.
- Established a green baseline before editing anything: `pnpm install` at the
  root, `pnpm build` for the root PBUI package, then in `packages/datalab-ui`
  `pnpm test` → 37 files / 416 tests passing, and `pnpm typecheck` clean.
- Rewrote §9, §10.1, §10.2, §11.5, §12, §12.1, §14, §15 Phase 2/3, §16.1, §16.3,
  §18 Decision 5, §19 question 5 and §20 of the design doc.
- Added a new §8.4, "Application scope is per row, not per query".
- Added a three-bullet summary of the corrections to the executive summary so a
  reader who stops after one page still learns the document changed.
- Extended the doc's `RelatedFiles` with the five files that drove the changes,
  and ran `docmgr doctor --ticket DATALAB-VIEW-001` → all checks passed.

### Why

**§10.1 — state ownership.** The document put the launcher invocation and
active placement in a React context, justified by "pages may contain several
embedded workbench instances." That justification does not separate the options
here: `WorkbenchInstance.tsx` builds one store per instance and its own
docstring says "the store is the instance boundary." Redux is already
per-instance.

The decisive argument is the other direction. `pbui/descriptors/tile.ts:44`
emits Replace as `{ kind: "openReplaceView", placementId }` — serialisable data
from a pure function that holds no React, resolved by `actionsForVerb`. A
descriptor cannot call a context method, so a context would have forced a second
opening path for a menu entry that already has one. `PendingImport`'s docstring
(DR-69) recorded exactly this trade-off for exactly this class of state and
chose Redux.

**§8.4 — scope.** `buildViewSwitcherModel` filters existing views through
`allowedExistingApps`, built from `useAvailableApps()` = instance ∩ *current*
stage ∩ *current* workspace. That is the right question while every result is a
candidate for the current placement. Once rows are grouped across workspaces it
is the wrong one, and wrong silently: `ws8 yield` would hide a view legitimately
placed in ws8 whenever ws8's allow-list differs from the current workspace's.

**§11.5 — Escape.** The document proposed `event.stopPropagation()` in the
Dialog handler. `Dialog.tsx`, `WorkbenchShell`'s full-frame exit and
`ViewSwitcher`'s replace mode all register on `window` in the bubble phase.
`stopPropagation` does not affect listeners on the node that calls it, and
`stopImmediatePropagation` only suppresses those registered later, which makes
correctness a mount-order race between three `useEffect`s.

### What worked

- The baseline came up green once I noticed the root package needed building
  first, so any red from here is mine.
- `docmgr doctor` passed on the first run after the frontmatter edit.
- Reading `test/stories.test.ts` before writing §12's file layout changed the
  layout: it requires a directory `X/` to contain `X.tsx` and `index.ts`, so
  `LauncherDialog` has to be its own organism directory rather than extra files
  inside `ViewSwitcher/`. That is now stated in the doc with the reason.

### What didn't work

- First `pnpm test` in `packages/datalab-ui` failed with `sh: 1: vitest: not
  found` and `WARN Local package.json exists, but node_modules missing`.
  Fixed by `pnpm install` at the workspace root.
- Second attempt failed five suites, all with the same error:

  ```text
  FAIL  test/descriptor-coverage.test.ts [ test/descriptor-coverage.test.ts ]
  Error: Failed to resolve entry for package "@hyperslop-systems/pbui".
  The package may have incorrect main/module/exports specified in its package.json.
   ❯ src/pbui/registry.ts:1:1
  ```

  The workspace dependency resolves to `dist/`, which is gitignored and not
  built by install. `pnpm build` at the repo root fixed it: 37 files / 416
  tests. Worth knowing for CI and for anyone starting from a fresh clone.

### What I learned

- The store-per-instance boundary is the single most load-bearing fact in this
  codebase for deciding where state goes, and it is documented only in a
  component docstring. It inverts the usual "context for instance-local state"
  instinct.
- `persist.save()` enumerates the layout fields it writes rather than passing
  the slice whole. That is what makes adding a transient field safe by default,
  and it is why the correct move for launcher state was Redux rather than
  context — transience is already an enforced property, not a hope.
- `useScopedApps()` (instance only) and `useAvailableApps()` (instance ∩ stage ∩
  workspace) both exist, and `AppScope.tsx` says the former "is exported chiefly
  so that the difference has a name." The launcher index needs the former plus
  the raw allow-lists, which is the first real consumer of that distinction.

### What was tricky to build

Nothing was built in this step, but §8.4 was hard to state correctly and is the
part most likely to be got wrong later.

The underlying cause is that "scope" silently meant two things that were the
same value until now: *what may this placement show* and *what may be shown in
this workspace*. With one workspace's worth of results those are the same
question. Grouping across workspaces separates them, and neither answer is right
for both modes — navigate mode concerns a row where it already is, place mode
concerns where the row is going.

The symptom to watch for is an absence, which is why it needs a test rather than
review: a missing row looks identical to a row that legitimately does not match
the query. I settled on one sentence — *a row is scoped by the workspace it
concerns* — and a three-row table, then wrote the disagreement case out
explicitly as a worked example so a reader can check an implementation against
it. Both readings coincide in the case that exists today, which is why the
current code is correct and why the bug is invisible until `wsN` ships.

### What warrants a second pair of eyes

- **§8.4's disabled-row recommendation.** A view listed in navigate mode but
  disabled in place mode is a new interaction state. I argued from DR-95 that
  greying is right here because the list is short and specific, unlike the
  twenty-two-of-twenty-five case that motivated hiding. Someone who lived
  through DR-95 should confirm that reading.
- **Deleting `replacingId`.** Phase 2 now removes it, its reducer, the
  `Tile.tsx` body branch and `ViewSwitcher`'s `mode="replace"` path. It is never
  persisted so there is no migration, but it is currently covered by tests and
  stories that will need to move rather than be deleted.
- Whether the surface stack should live in the layout slice at all, given that
  full-frame state lives in `WorkbenchInstance`'s React state rather than Redux.
  I think the stack still belongs in the slice because three of its four
  registrants are already there; the fourth would push an id from an effect.

### What should be done in the future

- Decide whether PBUI's own `ObjectMenu` and accept-banner Escape handling
  should eventually join the surface stack. This ticket explicitly does not
  reach into the generic package to do it.
- The deferred items are unchanged and still deferred: MRU, command
  registration, stable aliases, `/` as a second opener, stage prefixes.

### Code review instructions

- Start at the executive summary's three correction bullets, then read §8.4,
  §10.1 and §11.5 in that order — they are the whole of the change.
- Cross-check each against the code it claims to describe:
  `pbui/descriptors/tile.ts` (the verb), `appkit/AppScope.tsx` (the two scope
  hooks), `components/pages/WorkbenchInstance/WorkbenchInstance.tsx` (the store
  boundary), and the three `window.addEventListener("keydown"` sites.
- Validate with `docmgr doctor --ticket DATALAB-VIEW-001`.

### Technical details

Baseline, from a fresh clone:

```bash
pnpm install                       # workspace root
pnpm build                         # root PBUI package — datalab-ui resolves to its dist/
cd packages/datalab-ui
pnpm test                          # 37 files, 416 tests
pnpm typecheck
```

The three Escape registrations that §11.5 has to order:

| File | Line | Registration |
|---|---|---|
| `src/components/Dialog/Dialog.tsx` | 66 | `window.addEventListener("keydown", handleKey)` |
| `packages/datalab-ui/src/components/pages/Workbench/WorkbenchShell.tsx` | 203 | `window.addEventListener("keydown", onKey)` |
| `packages/datalab-ui/src/components/organisms/ViewSwitcher/ViewSwitcher.tsx` | 69 | `window.addEventListener("keydown", handleEscape)` |

The scope disagreement §8.4 exists to prevent:

```text
ws2 (explore) offers { chart, table }        ← current workspace
ws8 (compare) offers { chart, table, encoding }

query: "ws8 yield"
  wrong:  "Yield encoding" hidden — `encoding` is not offered by ws2
  right:  "Yield encoding" listed — it is placed in ws8, which offers it
```

## Step 2: The pure search model

Phase 1 is the whole of the search semantics with no React, no store and no
registry global: a query parser and an index that walks every workspace tree
into grouped rows. Keeping it pure is not tidiness — it is what let §6 to §8 be
pinned down by 38 tests in an afternoon, including the cases that are painful to
reach by clicking, like a linked view placed twice in one workspace and once in
another.

The one place where the design changed the *behaviour* rather than the
presentation is §8.4, application scope. Everything else in this step is the
document, implemented.

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Assistant interpretation:** Implement design-doc/02 Phase 1 — `parseLauncherQuery`,
workspace-grouped index, deterministic scoring — as pure modules with unit tests.

**Inferred user intent:** A search model that can be trusted before any of it is
wired to a modal.

**Commit (code):** `74f4d0d` — "feat(launcher): pure query parser, workspace-grouped index, and scoring"

### What I did

- Added `ViewSwitcher/launcherQuery.logic.ts`: the `+` and `wsN` grammar.
- Added `ViewSwitcher/launcherIndex.logic.ts`: `buildLauncherIndex`,
  `searchLauncherIndex`, `scoreRow`, `preferredPlacement`.
- Exported both through the existing `ViewSwitcher` barrel.
- Added `test/launcher-index.test.ts`: 38 tests.

### Why

The files live in `ViewSwitcher/` rather than in the `LauncherDialog/` directory
the design sketched, and that is a deliberate departure. `test/stories.test.ts`
requires a component directory `X/` to contain `X.tsx` and `index.ts`, so
creating `LauncherDialog/` in Phase 1 would have meant either a placeholder
component or a red test between two commits. `model.ts` — the existing pure
selection policy — already lives in `ViewSwitcher/`, so the new pure modules sit
beside their sibling and the modal imports them in Phase 2. The design doc's own
§12 note says to "add the modal around the model" rather than rename the
organism, which is what this does.

### What worked

- The grammar tests caught two cases I would not have written the code for
  first: `ws8x` must be text rather than workspace 8 followed by "x", and `ws0`
  must be text because ordinals are one-based. Both come free from anchoring the
  token with `\b` and `[1-9]\d*`.
- Scoring as a ladder of explicit rules rather than a weighted sum meant every
  ordering test reads as a sentence: a word-prefix beats a bare substring.

### What didn't work

- `import type { DocId } from "../../../store/layout"` failed:

  ```text
  error TS2459: Module '"../../../store/layout"' declares 'DocId' locally, but it is not exported.
  ```

  `layout.ts` imports `DocId` from `pbui/types` and re-exports only the
  layout-tree types. Fixed by importing from `../../../pbui/types` directly.

- Biome flagged `doc && doc.startsWith(query)` and offered an *unsafe* optional
  chain fix that would have changed the semantics. Rewrote as
  `[app, appId, doc].some((field) => field.startsWith(query))`, which is
  correct because `query` is non-empty past the early return, so an absent
  document — the empty string — cannot prefix-match.

### What I learned

- The `apps` argument is the whole of §8.4 in one parameter. Documenting *which*
  hook fills it (`useScopedApps`, not `useAvailableApps`) inside the interface
  is the only place a future caller will look.

### What was tricky to build

Getting the ordering right without an explicit multi-key sort.

The design asks for: score, then current workspace, then current stage, then
workspace order, then `viewOrder`. Implemented literally that is a five-key
comparator, and every one of those keys is a chance to invert a sign.

Instead the *construction* encodes four of the five: groups are built in
current-stage-then-other-stage order, rows are built by walking `viewOrder`, and
the current workspace is moved to the front by one stable sort on a boolean. A
stable sort on score alone then preserves the rest, because that is what stable
means. The comparator is `(a, b) => b.score - a.score` and the tests for
"current workspace first" and "viewOrder as the tie-break" both pass without a
line that mentions either.

### What warrants a second pair of eyes

- `scoreRow` returns `1` for an empty query so that everything matches and the
  stable sort preserves construction order. It is correct but subtle: a reader
  could reasonably expect `0`, which means "omit".
- The empty-query caps are a *rendering* limit and must never change scope.
  `searchLauncherIndex` applies them after filtering, which is right, but there
  is no test that would fail if someone moved them before it.

### What should be done in the future

- N/A for this step.

### Code review instructions

- Read `launcherQuery.logic.ts` first — it is 90 lines and fixes the vocabulary.
- Then `LauncherIndexInput.apps` in `launcherIndex.logic.ts`, which is §8.4.
- `pnpm vitest run test/launcher-index.test.ts`.

### Technical details

The scope intersection, mirroring `appkit/AppScope.tsx`:

```ts
function scopeFor(workspace, stages, instanceApps) {
  const stage = stages.find((candidate) => candidate.id === workspace.stageId);
  const narrow = (allowed, list) =>
    list == null ? allowed : new Set([...allowed].filter((id) => list.includes(id)));
  return narrow(narrow(instanceApps, stage?.apps), workspace.apps);
}
```

## Step 3: The modal, and deleting `replacingId`

Phase 2 turns Launcher and Replace into one modal. The interesting part is not
the dialog — it is that `pbui/descriptors/tile.ts` did not change at all. The
tile menu still emits `{ kind: "openReplaceView", placementId }`; only its
resolution moved, from `beginReplace` to `openLauncher`. That is the §10.1
argument paying off in the diff.

`replacingId` is gone, along with the tile-body takeover it described and
`ViewSwitcher`'s `mode="replace"` and its `window` Escape listener — so one of
the four Escape handlers disappeared rather than needing to be ordered.

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Assistant interpretation:** Implement Phase 2 — the modal, its entry points,
the surface stack — following GUIDELINES for layer and packaging.

**Inferred user intent:** A launcher that works from the tile and the menu, in
the product.

**Commit (code):** `88663a0` — "feat(launcher): modal launcher, Replace entry point, and the Escape stack";
`a91c32d` — "fix(launcher): do not offer the target's own view in place mode"

### What I did

- Layout slice: `LauncherInvocation`, `launcher`, `transientSurfaces`,
  `openLauncher` / `closeLauncher` / `pushSurface` / `popSurface`, `topSurface`.
- `appkit/useTransientSurface.ts`: register an open surface, answer "am I on top".
- `organisms/LauncherDialog/`: container, results, module CSS, stories, barrel.
- `LauncherApp` became an empty state; `Tile` lost the `replacing` branch and
  gained `data-placement-id`.
- `WorkbenchShell` mounts the modal and guards full-frame Escape with the stack.
- `test/store.test.ts`: a test that no transient layout field reaches storage.

### Why

The surface stack exists because §11.5's original fix could not work, which
Step 1 established. What Step 2 added is the observation that it also supplies
`ShortcutContext.dialogOpen` in §11.1 — which had no source of truth, since
`usePbui()` exposes `accepting` and `menu` but nothing knows about dialogs. One
eight-line reducer answers both.

### What worked

- Driving the real workbench found a defect no story would have: Replace on the
  pipeline tile offered `pipeline` as something to replace it with. The old
  `buildViewSwitcherModel` had always excluded the current view; the new index
  did not. Fixed in `a91c32d` by excluding the target's view *by id*, so all of
  its rows across workspaces go at once, while navigate mode keeps them.
- Mutation-checking the persistence test: temporarily adding
  `launcher: layout.launcher` to `save()` turned it red, then green on revert.
  Worth doing for a test that guards a silent failure.

### What didn't work

- `pnpm test` failed immediately on a fresh clone:

  ```text
  Error: Failed to resolve entry for package "@hyperslop-systems/pbui".
  ```

  The workspace dependency resolves to a gitignored `dist/`. `pnpm build` at the
  repo root first.

- Biome's `useSemanticElements`, `useFocusableInteractive` and
  `useKeyWithClickEvents` all fire on the combobox pattern, and my first
  suppressions did nothing — reported as `suppressions/unused`. The cause is
  that a `biome-ignore` directive must be the **last** comment line before the
  node; my explanations wrapped onto continuation lines, so the adjacent comment
  was prose rather than a directive. Fixed by putting the reasoning in a block
  comment above and a one-line `biome-ignore … : see above` immediately before
  the element.

### What I learned

- The combobox/`aria-activedescendant` pattern is exactly the case those three
  a11y rules are wrong about: options must **not** be focusable and must **not**
  carry key handlers, because DOM focus never leaves the input. Suppressing them
  is correct here and the comment has to say why, or the next reader "fixes" it.

### What was tricky to build

Focus restoration, which the design specified as a stored `HTMLElement`.

The symptom that made me change it: a Replace can re-render the tile it targets,
and `createViewInPlacement` replaces the tile's whole subtree. An element
captured when the modal opened may be detached by the time it closes, and
`.focus()` on a detached node does nothing at all — no error, no warning.

So the modal restores focus **by placement id**: `Tile` carries
`data-placement-id`, and `focusPlacement` queries for it a frame later and
focuses the `[data-ptype="tile"]` inside. One frame is needed because a navigate
result may have just switched workspace, so the target does not exist when the
reducer returns. This is the same query and the same `requestAnimationFrame`
that `Tile.restoreTitleFocus` already used, so it is the existing mechanism
addressed differently rather than a new one.

### What warrants a second pair of eyes

- `LauncherDialog` keys `LauncherModal` by invocation, so query text and the
  highlighted row reset per open. Deliberate, but it means an invocation that
  changes identity mid-flight remounts and clears the query.
- The full-frame surface id is a constant, `"workbench:full-frame"`, while the
  launcher's is derived from `useId`. Two instances both in full frame would
  therefore share one stack entry. Harmless today, because full frame is an
  embedded-instance feature and only one can cover the window — but it is a
  latent duplicate.

### What should be done in the future

- Consider registering PBUI's `ObjectMenu` and accept banner in the surface
  stack. Out of scope here: they live in the generic package.

### Code review instructions

- `store/layout.ts` `LauncherInvocation` for the state argument.
- `store/applyLayoutVerb.ts` for the one-line verb re-resolution.
- `appkit/useTransientSurface.ts`, then the two call sites.
- `pnpm vitest run test/store.test.ts -t transient`.

## Step 4: Active placement, `Mod+K`, and two things the design got wrong

Phase 3 adds the one shortcut. `Mod+K` opens the launcher in navigate mode:
selecting a result switches workspace and focuses a placement, and never mutates
the layout. New-view rows appear only when the active tile is already a
launcher; anywhere else `+chart` is refused with the way forward.

Both of the design's remaining mistakes surfaced here, and neither was visible
from a test — they needed a browser.

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Assistant interpretation:** Implement Phase 3 and verify the whole feature in
the running application.

**Inferred user intent:** A keyboard route into the launcher that cannot destroy
work, proven in the product rather than in Storybook.

**Commit (code):** `dca118f` — "feat(launcher): active placement and workbench-scoped Mod+K"

### What I did

- `activePlacementId` in the layout slice, with a guarded reducer; `Tile` writes
  it from `onFocusCapture` and `onPointerDownCapture` and reads a boolean.
- `shortcutRouting.ts`: pure `routeWorkbenchKey`, `isModKey`, `isEditableTarget`.
- The shortcut boundary in `WorkbenchShell`, plus `data-workbench-shell`.
- Navigate-mode execution, the launcher-tile rule, and the refusal message.
- The active-tile outline, scoped to `[data-launcher-open]`.
- `closeLeaf` clears the active placement when it closes it.
- `test/shortcut-routing.test.ts`: 19 tests.

### Why

The guarded reducer and the boolean selector are not premature optimisation.
`onFocusCapture` fires for every focusable descendant, and a tile title bar has
six controls — so tabbing across one tile would dispatch six identical actions
and wake every subscriber six times without them.

### What worked

- Multi-instance isolation, tested on the marketing page: six shells, focus
  moved into the second, `Mod+K` opened exactly one launcher — the second's.
  With focus on `<body>` and six shells, nothing opened, which is the intended
  refusal.
- Navigate end to end: `compare` → Enter switched from `build` to `gallery`,
  focused the COMPARE A/B tile, made it active, and changed no layout.
- `+chart` with a launcher tile active created a chart there and focused it.

### What didn't work

Two real bugs, both found in the browser and neither reachable from a unit test.

**1. `launcher !== null` was true before the launcher had ever been opened.**
The field is optional, so it is `undefined` until first use, and
`undefined !== null` is `true`. The shell therefore believed the launcher was
permanently open: `routeWorkbenchKey` saw `launcherOpen: true` and ignored every
`Mod+K`, and `data-launcher-open` was pinned on. No test could see it — both
consumers take booleans as arguments. Fixed to `(state.layout.launcher ?? null) !== null`.

**2. `onKeyDownCapture` on the shell root never fires.** After fixing (1),
`Mod+K` still did nothing. `document.activeElement` was `<body>`:

```js
{ activeElement: "BODY", focusInsideShell: false, activeIsBody: true }
```

`<body>` is outside the shell element, so the React handler is not on the
event's path. This is not an edge case — it is the state after every page load
and after Escape closes the object menu, which is to say most of the time.

### What I learned

- "Bind the handler where the thing lives" is a good instinct that fails when
  the thing is *focus*, because focus has a null state and the null state is
  common. The rule had to be written out rather than inherited from the DOM.
- An optional boolean-ish field in Redux wants a `?? null` at every read site,
  not just the ones that destructure it.

### What was tricky to build

Deciding what a shortcut should do when nothing owns focus.

The design's rule — "the workbench containing focus reacts" — has no answer for
it, and the two obvious repairs are both wrong. Falling back to "every workbench
reacts" opens six launchers on the landing page. Falling back to "the first
workbench reacts" picks an arbitrary one and looks like a bug from five of the
six.

The rule I settled on splits the case by whether it is ambiguous at all:

```ts
if (!ownsFocus && !(unowned && lone)) return;
```

A lone workbench claims an unowned key press, because a page with one workbench
cannot be ambiguous. Several workbenches with focus on `<body>` do nothing,
because there is genuinely no way to tell which was meant, and silence is
better than a guess. `data-workbench-shell` makes "lone" a `querySelectorAll`
rather than a registry.

### What warrants a second pair of eyes

- The `lone` check runs on every key press. It is a `querySelectorAll` over one
  attribute and the router rejects non-`k` keys first, but it is a DOM read in a
  keydown path.
- `routeWorkbenchKey` deliberately does **not** block on `targetIsEditable`:
  `Mod+K` is a chord, and a user renaming a tile still expects the launcher. The
  field exists for a future unmodified shortcut such as `/`. The test says so,
  but the asymmetry is worth a second opinion.
- Navigate mode passes `activePlacement` to `preferredPlacement`, resolving §19
  question 5. Worth confirming that preferring the tile you were already in is
  what a user expects when a linked view is placed twice in the target.

### What should be done in the future

- `/` as a second opener, MRU ranking, and stage prefixes remain deferred, and
  nothing here pre-builds them.
- The full-frame surface id is a constant; if two instances can ever be in full
  frame at once it should become per-instance.

### Code review instructions

- `shortcutRouting.ts` is 60 lines and pure — start there.
- Then the `useEffect` in `WorkbenchShell` that applies it, which is where both
  bugs were.
- `pnpm vitest run test/shortcut-routing.test.ts`.
- In a browser: `Mod+K` on `/ui/`, then again on `/` where six instances live.

### Technical details

Verified in the running application, not only in Storybook:

| Path | Result |
|---|---|
| Tile menu → Replace | modal opens, target named, tile keeps rendering behind |
| `ws2 chart` | scoped to WS2 · EXPLORE, 1 result |
| `ws9` | "No workspace ws9 in the current stage. Available: ws1–ws4." |
| `+chart` / `+` | 1 / 8 new-view rows |
| `ws2 +chart` | reported, falls back to workspace scope |
| Enter on a result | PIPELINE → TRACE, focus on the new title |
| Escape | closes, focus back on the opener |
| `Mod+K` | "Go to view", no new-view or unplaced rows |
| `Mod+K` then `compare` then Enter | switched workspace, focused the tile |
| `Mod+K` with a launcher tile active, `+chart` | created a chart there |
| `Mod+K` on the marketing page | 1 of 6 instances opened; 0 with focus on body |

## Step 5: Escape ownership moves into the generic package

Step 3 put the Escape surface stack in the layout slice, beside the other
transient fields, following DR-69. Given permission to change the generic
package, I moved it — and moving it showed the Redux version was not merely
misplaced but **wrong**. Escape is delivered to the document, so "topmost" is a
property of the page; with a stack per store, a landing page's six instances
each believed themselves topmost and one key press could close a dialog in one
instance and leave full frame in another.

PBUI owns three of the four handlers — `Dialog`, `ObjectMenu` and the accept
protocol — so it is the only layer that can see far enough to order them. The
mechanism is module state rather than a context for exactly that reason: a
per-root context cannot see the other root.

### Prompt Context

**User prompt (verbatim):** "You can fix pbui stuff. Also, how much performance intensive would it be to show a little preview of the tile when hovering above its name, to be able to see what it's like?"

**Assistant interpretation:** Permission to change the generic PBUI package, so
finish the Escape work I had scoped out; and separately, estimate the cost of
live tile previews on hover in the launcher.

**Inferred user intent:** Remove the known-incomplete bit rather than leave it
documented as a limitation, and find out whether a preview feature is affordable
before anyone designs it.

**Commit (code):** `d61094a` — "fix(pbui): move Escape ownership into the package, and order it there"

### What I did

- Added `src/surfaces.ts` to PBUI: a module-level LIFO with
  `pushEscapeSurface` / `popEscapeSurface` / `topEscapeSurface` /
  `escapeSurfaceCount`, a `useSyncExternalStore` binding in `useEscapeSurface`,
  and `useAnyEscapeSurface` for "is anything modal open".
- Wired `Dialog`, `ObjectMenu` and datalab's `AcceptBanner` to stand down when
  not on top.
- Reduced `appkit/useTransientSurface.ts` to a re-export carrying the note.
- Deleted `transientSurfaces`, `pushSurface`, `popSurface`, `topSurface` and
  `SurfaceId` from the layout slice; `dialogOpen` now comes from
  `useAnyEscapeSurface()`.
- Added `src/surfaces.test.tsx`: 8 tests including two that pin constraints.

### Why

`Dialog`'s Tab containment is deliberately **not** gated on ownership, and that
asymmetry is the interesting part. Escape is a global gesture and only one
surface should answer it; Tab containment is a property of a subtree, and a
dialog beneath another surface is still the focus trap for its own contents.
Releasing the trap because something opened above would let Tab walk out into
the page behind both.

### What worked

- Deleting state. The Redux fields, their reducers, the selector and the
  payload-coverage entries all went, and the datalab call sites got shorter.
- `useSyncExternalStore` is exactly the right primitive here: the snapshot is a
  string or a number, so it never allocates and never tears.

### What didn't work

**The refactor broke Escape entirely, and no test saw it.** After wiring
everything up, Escape stopped closing the launcher. Playwright caught it
immediately — the dialog backdrop was still intercepting pointer events:

```text
<div data-part="dialog-backdrop" data-pbui-component="dialog">…</div> intercepts pointer events
```

The cause: `LauncherDialog` still registered its own surface from Step 3, and
`Dialog` now registered one too. **Child effects run before parent effects**, so
the Dialog's entry was pushed first and the launcher's landed on top — and the
Dialog, which is the component that actually handles Escape, decided it was not
topmost and ignored the key. One surface, two registrations, and the handler
lost to its own wrapper.

Then, writing a test for nested dialogs, the same ordering rule bit again from
the other side: two dialogs mounted in one commit register bottom-up, so the
*outer* one ends up on top and closes both.

### What I learned

- "Child effects run before parent effects" is the single fact that explains
  both failures, and it means **registration order is the reverse of nesting for
  anything mounted in the same commit**. It agrees with nesting only when
  surfaces open over time, which is every real case.
- A global LIFO is the correct model for a document-level gesture even in a
  library that otherwise avoids module state. The multi-root argument that
  usually pushes state *into* a context pushes it *out* here.

### What was tricky to build

Deciding what to do about the nested-dialog case once the test exposed it.

The symptom is a two-line reproduction: render a `Dialog` inside another
`Dialog`'s body, press Escape, and both close because the outer one owns the
key. The underlying cause is that the stack orders by *when a component
registered* and React registers children first, so the stack's idea of "on top"
is inverted relative to what the user sees.

The honest fix is to order by DOM containment instead — record each surface's
element on push and compare `compareDocumentPosition`. I did not do it. It
roughly doubles the mechanism, it requires threading a ref through
`useEscapeSurface`, and the case does not arise in this product: every surface
is a sibling at the shell root, opened by a click. So the resolution was to
**state it**: a test that asserts the actual behaviour with a comment saying it
is documented rather than desired, plus a paragraph in `surfaces.ts`. If a
nested pair ever becomes real, that test is the specification to change.

I am reasonably confident this is the right call and not laziness, but it is the
judgement in this step most worth disagreeing with.

### What warrants a second pair of eyes

- **The double-registration constraint is enforced by convention.** The stack
  cannot tell that a wrapper and the `Dialog` it renders are one surface. The
  test states the consequence; nothing prevents it.
- **`resetEscapeSurfaces` is exported from the package root**, so it appears in
  the public API. It is labelled a test seam, but a consumer could call it and
  silently break every open surface's ownership.
- Whether `useAnyEscapeSurface` is the right shape for `dialogOpen`. It is true
  for an object menu as well as a dialog, which is what the shortcut router
  wants, but the name of the field in `ShortcutContext` now undersells it.

### What should be done in the future

- If nested surfaces become real, order by DOM containment.
- Consider whether `escapeSurfaceCount` and `resetEscapeSurfaces` should be on a
  narrower export path than the package root.

### Code review instructions

- `src/surfaces.ts` — the whole mechanism, including the two constraints.
- `src/surfaces.test.tsx` — read the two constraint tests first; they encode the
  failures above.
- `Dialog.tsx`: note that Escape is gated and Tab is not, and why.
- `pnpm test` at the repo root (34) and in `packages/datalab-ui` (483).
- In a browser: Escape closes the launcher; Escape closes an object menu without
  closing anything underneath.

## Step 6: Application tones, and the new-view section nobody could reach

Two changes that arrived together because the first exposed the second. Rows in
the launcher now carry their application's tone as a left edge, so a chart row
reads as the colour of a chart tile. Checking that against a real workspace
answered the other half of the question — how do you create a view that does not
exist yet — and the answer was "in principle, by scrolling past twenty-five
rows", which is not an answer.

### Prompt Context

**User prompt (verbatim):** "Use the colors of the views for the existing views. Also, how can I use the launcher to create a new view that doesn't exist yet?"

**Assistant interpretation:** Colour the launcher's existing-view rows by their
application the way tiles are coloured; and explain the path to creating a new
view.

**Inferred user intent:** The launcher looks flat and undifferentiated compared
to the workbench, and creating a new view does not feel reachable from it.

**Commit (code):** `7a9504d` — "feat(launcher): colour rows by application, and stop burying new views"

### What I did

- Added `tone` to all three row types in `launcherIndex.logic.ts`, defaulting to
  `--pbui-tone-neutral` for a view whose application this build does not
  register.
- Rendered it as a 4px left edge in `LauncherResults`, inline as a variable
  reference — `Chip`'s exact idiom.
- Moved the active-row marker from the left border to a `▸` glyph, because the
  border is now spoken for.
- Added `newViewsFirst` to `LauncherResults` and reordered both the sections and
  `rows` accordingly.
- Six new tests: tone propagation including the neutral fallback, and four for
  the ordering rule.

### Why

The measurement is the argument. With Replace open on a real workspace:

```text
totalOptions: 33
optionsBeforeNewView: 25
newSectionVisibleWithoutScrolling: false
scrollHeight: 1268   clientHeight: 350
```

Twenty-five rows and a scroll before the first new-view option. The `+` prefix
worked and was advertised in the placeholder, but a section nobody scrolls to
is a section that does not exist — and someone who opens the launcher against a
tile is as likely to want a new view as an existing one.

Ordering is in the pure model rather than the component so it is decidable from
data, and so `rows` and the rendered list cannot drift — if they did, arrow keys
would move the highlight somewhere the eye is not.

### What worked

- Putting the decision in `searchLauncherIndex` meant the "arrow keys agree with
  the eye" property became a test rather than a review note.
- The tone edge needed no new token, no new prop and no new component: `Chip`
  had already made this exact decision and `--pbui-tone-edge` already existed.

### What didn't work

- `.optionTitle` got `display: flex` from one rule and `display: block` from a
  later shared rule, so the marker column did not align. Fixed by splitting the
  ellipsis rules off onto `.optionTitle > :last-child`.
- The first attempt at colouring used the row background rather than an edge. It
  looked like a paint chart at twenty rows and buried the selection wash. The
  edge is both quieter and consistent with the rest of the system.

### What I learned

- Asking "where does this land in a real workspace" is worth more than reading
  the code: the section order was defensible in the abstract and unusable at 33
  results, and only the running app with real seeded documents showed it.
- The design's own mockups had `▸` on the active row all along. When a spec
  draws something and the implementation quietly drops it, the spec is often
  compensating for a constraint the implementer has not hit yet — here, that
  colour would eventually claim the left border.

### What was tricky to build

Choosing what "first" should mean without making it a mode-switch nobody can
predict.

The obvious rule — new views always first — is wrong for Replace with a query
typed, where a view actually named "chart" is a much better answer than the
chart application. The opposite rule is what shipped and buries creation.

The rule I settled on splits on *whether there is a query at all*, not on the
invocation: an empty query means the user has not expressed a preference, so
offer the cheapest complete answer first; any text means they have, so the
specific matches lead. Navigate mode is excluded entirely because it cannot
create. Three conditions in one line, and each has a test naming the reason.

### What warrants a second pair of eyes

- **The ordering rule is a product judgement, not a correctness one.** Someone
  who mostly reuses views will find new-views-first wrong, and the counter-fix
  is a one-line change plus four test updates.
- The neutral fallback tone means an unregistered application's row is visually
  identical to a genuinely neutral one. Acceptable, since the row also renders
  the raw `appId` as its title, but it is a small ambiguity.
- Whether the `▸` marker plus wash is enough selection affordance at a glance in
  a long list. It reads well in a screenshot; it deserves a real user.

### What should be done in the future

- The empty-query caps (§7.3) are unchanged and still allow 25 existing rows.
  With new views first that no longer hides anything, but the current
  workspace's row count is still unbounded and could get long.
- N/A otherwise.

### Code review instructions

- `launcherIndex.logic.ts`: the `tone` fields and `newViewsFirst`.
- `LauncherDialog.module.css`: the comment explaining why the left border
  carries the application and not the selection.
- `pnpm vitest run test/launcher-index.test.ts` — 46 tests.
- In a browser: open Replace on a workspace with several views; new views should
  be at the top with coloured edges, and typing `chart` should put the named
  views back on top.

### Technical details

Answering the question directly — three ways to create a view that does not
exist yet, all of which now work:

| Path | What it does |
|---|---|
| Open the launcher, look at the top | NEW VIEW is the first section on an empty query |
| Type `+` | Only new-view rows |
| Type `+encoding` | Only new-view rows matching "encoding" |

Verified end to end: `+encoding` then Enter turned the target tile into
`encoding · α`, the hint read **"Enter create"** rather than "Enter place", and
the dialog closed and focused the new tile.

## Step 7: Mod+K had no new views, and the fix was to split rather than refuse

Reported from the running application: pressing `Mod+K` showed only existing
views, and it should behave like the launcher a new tile offers. It was two
faults stacked, both mine, and the second is the interesting one — I implemented
a design rule correctly and the rule's *remedy* was wrong even though the rule
itself was right.

The rule is Decision 6: `Mod+K` must never destroy a working tile. My
implementation kept that promise by refusing — hiding every new-view row unless
the active tile was already an empty launcher. Splitting keeps the same promise
without refusing anything, and that is what this step changes.

### Prompt Context

**User prompt (verbatim):** "i don't see any new view with cmd-K on http://localhost:5273/ui/, t just shows the existing ones. But it should show a list like when clicking open view in a new title."

**Assistant interpretation:** `Mod+K` should offer new-view creation the way the
launcher tile's "Open a view" modal does, rather than listing existing views only.

**Inferred user intent:** The global shortcut should be a complete launcher, not
a navigation-only subset — otherwise it is a worse version of the thing already
reachable from a tile.

**Commit (code):** `d8aeea4` — "fix(launcher): Mod+K offers new views, and splits to make room"

### What I did

- Reproduced first, and the reproduction named the cause immediately:

  ```json
  { "heading": "Go to view", "sections": ["workspace start here", "…"], "activeTile": 0 }
  ```

  `activeTile: 0` — a freshly loaded page has focused nothing, so
  `activePlacementId` is null, so the launcher-tile condition could not hold and
  every new-view row was suppressed.
- Extended `splitLeaf`'s `prepare` with optional `appId`/`docId`.
- Replaced `navigateTarget` with `newViewTarget`, which resolves the active tile
  or the first leaf in tree order, and reports `fill` or `split`.
- Selecting a new-view row in navigate mode now splits along the tile's longer
  axis, and the header names the tile: *"beside Temperature by station"*.
- Dropped the `mode === "place"` condition from `newViewsFirst`.
- Four tests: two in `store.test.ts` for the reducer, two in
  `launcher-index.test.ts` for the ordering.

### Why

Two separate mistakes, worth separating because they have different lessons.

**The bug**: the launcher-tile condition depended on `activePlacementId`, which
is null until the user interacts. I had tested `Mod+K` by *clicking a tile
first*, every time, so I never saw the state a user actually starts in. The
condition was never reachable on arrival.

**The design error**: even with the bug fixed, requiring an empty launcher tile
makes `Mod+K` strictly worse than the tile's own launcher — the global shortcut
could do less than the local one, which is backwards. The design's own §19
question 6 anticipated this ("should global `+chart` eventually offer an
explicit split?") and answered "not in the first release" partly because
choosing a split direction silently is bad. But the objection to a silent split
is the *silence*, not the default: naming the target in the header before the
user commits removes it.

### What worked

- Reproducing before reading any code. The `activeTile: 0` line took thirty
  seconds and pointed straight at the cause; reasoning from the source would
  have found the launcher-tile condition and probably stopped there, missing
  that it was unreachable rather than merely strict.
- Putting `appId`/`docId` on `splitLeaf`'s prepare rather than dispatching split
  then create. Two dispatches would render an empty launcher tile for one frame
  before the real view replaced it.

### What didn't work

- Nothing failed outright this time. The nearest miss: after the first fix,
  navigate mode still listed 36 existing rows before the new-view section — the
  same burial that Step 6 fixed for place mode. I had scoped `newViewsFirst` to
  place mode on the argument that navigate mode "is not a place to create",
  which was true when it could not create and false the moment it could. The
  condition survived the change that invalidated it.

### What I learned

- **A condition can outlive its reason silently.** `mode === "place"` was
  correct when written and wrong an hour later, and nothing in the type system
  or the tests noticed. The rewritten comment now states the *reason* rather
  than the rule, so the next person to change the capability sees what the
  condition depends on.
- Testing a keyboard shortcut by first clicking something is not testing the
  shortcut. The interesting state for a global shortcut is the one before any
  interaction, and it is the easiest to skip.

### What was tricky to build

Choosing a split direction without a dialog.

The design explicitly warned against choosing silently, and the obvious
alternatives are all worse: asking for a direction turns one keystroke into two
decisions; always splitting right gives a tall narrow tile a sliver; splitting
the workspace root changes the geometry of things the user did not name.

I settled on the tile's longer axis — a wide tile becomes two columns, a tall
one stacks — read from `getBoundingClientRect` at the moment of the click,
because the tree stores ratios and only the DOM knows the rendered geometry.
What makes that acceptable rather than silent is the header: "beside Temperature
by station" is on screen before Enter, so the outcome is predicted rather than
discovered. The direction is still a guess, but a guess about *shape*, applied
to a named target, and reversible with one undo of a split.

### What warrants a second pair of eyes

- **The fallback target when nothing is focused** is the first leaf in tree
  order, which is arbitrary in the sense that it is not "the one the user was
  looking at" — there is no such tile yet. It is deterministic and named in the
  header, which I think is enough, but a reasonable alternative is the largest
  tile.
- `splitDirectionFor` reads the DOM inside a click handler. Cheap and correct
  here, but it is a layout read in an event path and would need care if it ever
  ran per keystroke.
- Whether navigate mode should reorder at all. Putting "create a chart" above
  "the view you are looking for" is arguably backwards for a shortcut named *go
  to view*; the counter-argument, which I took, is that an empty query means no
  preference has been expressed yet.

### What should be done in the future

- The design doc's §19 question 6 and Decision 6 both need updating: the answer
  to "should global `+` split?" is now yes, with the target named. I have not
  amended them yet.
- If a workspace can ever hold zero tiles, `newViewTarget` returns null and the
  refusal message is still there to catch it. Worth confirming that state is
  actually unreachable.

### Code review instructions

- Start with `newViewTarget` in `LauncherDialog.tsx` — target resolution and the
  fill/split decision.
- Then `splitDirectionFor` beneath it, and `splitLeaf`'s `prepare` in
  `store/layout.ts`.
- `pnpm test` — 486, including the two reducer tests that prove a split with no
  application still makes an empty launcher tile.
- In a browser, the exact reported path: load `/ui/` fresh, press `Mod+K`
  without clicking anything, and confirm NEW VIEW is the first section.

### Technical details

Verified end to end from a cold load:

```text
header: "go to: start here · beside Temperature by station"
before: [Temperature by station, Yield by production line, Population by region,
         sources, Regional totals]
after:  [Temperature by station, table · α, Yield by production line,
         Population by region, sources, Regional totals]
everythingSurvived: true
```

## Step 8: Addressing the Codex review

An automated review on PR #2 left seven inline comments, three P1 and four P2. I
checked each against the code expecting to reject one or two as false positives,
and rejected none — all seven were real. The two P1s that matter most are gaps
between what `design-doc/02` §8.4 *specified* and what I *implemented*, which is
the uncomfortable kind: I wrote the rule, quoted it in a commit message, and then
did not build it.

### Prompt Context

**User prompt (verbatim):** "Address code review comments: https://github.com/hyperslop-systems/pbui/pull/2"

**Assistant interpretation:** Read the review on PR #2, judge each comment, and
fix the ones that hold.

**Inferred user intent:** Get the branch to a mergeable state with the reviewer's
objections resolved rather than argued away.

**Commit (code):** `315490b` — "fix(launcher): address Codex review — scope, audience, and four dead ends"

### What I did

| Finding | Fix |
|---|---|
| P1 target scope | `LauncherSearchContext.targetAppIds`; new rows the target forbids are hidden, placed and unplaced rows disabled with a reason |
| P1 Enter bypass | `unavailable` on the row, read by both paths via `blockedReason` |
| P1 stage audience | `LauncherIndexInput.visibleStageIds`, current stage exempt |
| P2 quick-create | optional `prefill` on `fill-launcher`; buttons pass `+<appId>` |
| P2 unplaced dead end | unplaced rows restricted to place mode |
| P2 global DOM query | `placementElement(root, id)`, scoped to the shell that owns the launcher |
| P2 rename guard | `renamingView` in `ShortcutContext`, blocks `Mod+K` |

Nine new tests, 495 total.

### Why

**The scope one is the one worth dwelling on.** §8.4 says, in a sentence I wrote:
*a row is scoped by the workspace it concerns — for a placed view in navigate
mode that is where it already is; for anything that ends in a placement that is
where it is going.* The implementation only ever computed the first half. The
tell was sitting in the code the whole time: the disabled message read
`${appTitle} is not offered in ${targetWorkspaceName}` while the condition was
`!row.inScope`, which is the *source* workspace. The message and the check
disagreed, in the same expression, and I wrote both.

**The audience one** is a smaller blast radius than it first looks — the server
denies the data regardless (DR-31) — but the user-visible failure is real: pick a
row in `work` while signed out, `setCurrentSpace` takes you there, and
`Workbench`'s gate throws you back, with the forbidden stage flashing in between.

**The unplaced dead end** is a regression I introduced in Step 7. Making
`allowNewViews` true in navigate mode also flipped `showUnplaced`, because that
condition read `mode === "place" || allowNewViews` — a disjunction that meant
something sensible when `allowNewViews` implied "the active tile is an empty
launcher" and something wrong the moment it meant "we can split".

### What worked

- Treating the review as a set of claims to verify rather than instructions to
  follow. It cost about ten minutes and it is what turns "apply the patch" into
  knowing *why* each one is right — which mattered here, because the fix for the
  first P1 is not the fix the comment proposed. Codex suggested passing the
  target scope into the index; the index is shared by navigate mode, which has
  no target, so it belongs on the search context instead.
- Verifying in the product on the sign-in stage, whose allow-list is genuinely
  `["signin", "signup", "about"]`. That is a real restricted workspace rather
  than a fixture, and it showed the fix working end to end.

### What didn't work

- Two rounds of typecheck failures from threading `visibleStageIds` and the
  `root` ref through: the test fixture, the `LauncherResults` props that became
  unused once the block moved into the model, and `RefObject` typing on the
  dialog. All mechanical, all caught by `tsc`.
- I first reached for `state.world.authenticated`, which does not exist —
  authentication comes from `useMeQuery()`, the same source `Workbench`'s gate
  uses. Worth knowing that auth is RTK Query state and not world state.

### What I learned

- **A comment that contradicts its own condition is a defect the compiler cannot
  see.** The `not offered in ${targetWorkspaceName}` message was written from the
  design and the condition from the data at hand, and nothing reconciles the two.
  Where a message names a *rule*, the rule should come from the same place the
  check does — which is what moving it into the model achieved.
- **A disjunction is where a widened capability leaks.** `mode === "place" ||
  allowNewViews` was correct under the old meaning of `allowNewViews` and wrong
  under the new one, and nothing failed. Both times a condition has gone stale in
  this ticket, it has been because the *meaning* of a term changed while the
  expression stayed valid.

### What was tricky to build

Deciding, per row kind, between hiding and disabling.

The design's §8.4 says out-of-scope rows are greyed rather than hidden, on
DR-95's argument that a short specific list teaches something a hidden one
cannot. But that argument was made about *existing views*, and it does not
transfer to new-view rows: "create a chart here, except you cannot" is not a
lesson, it is a row that exists to be refused. The switcher this replaced hid
them, via `useAvailableApps()`.

So: new rows hidden, existing rows (placed and unplaced) disabled with a reason.
The split is not arbitrary — it follows whether the row names something that
*exists* — but it is the kind of asymmetry that looks like an oversight later, so
both branches carry the reason in a comment.

### What warrants a second pair of eyes

- **`targetAppIds` is computed in the component**, duplicating the intersection
  logic that `scopeFor` already does inside the index and `intersectScopes` does
  in `AppScope`. Three implementations of "instance ∩ stage ∩ workspace" now
  exist. They agree, and I did not unify them because the three have different
  input shapes, but that is a real smell.
- **Blocking `Mod+K` during a rename** is the conservative choice; committing the
  rename and then opening would arguably be friendlier. I took the option that
  cannot lose text.
- The disabled reason says "not offered in this workspace" with a literal
  `targetName` constant rather than the workspace's name, because the pure model
  does not have it to hand. The name is in the header two lines above, so it
  reads acceptably, but it is less specific than the string it replaced.

### What should be done in the future

- Unify the three scope intersections behind one helper.
- `blockedReason` currently only ever reports scope. If a second reason appears
  (a singleton already placed, say) the field is ready for it.

### Code review instructions

- `launcherIndex.logic.ts`: `targetAppIds` and `blockFor` for the scope rule,
  `visibleStageIds` for the audience filter, and `showUnplaced`.
- `LauncherDialog.tsx`: `blockedReason` at the top of `choose`, and
  `placementElement` at the bottom.
- `pnpm vitest run test/launcher-index.test.ts` — 55 tests.
- In a browser: switch to the sign-in stage, open Replace, and confirm no chart
  is offered and cross-workspace chart rows are disabled.
