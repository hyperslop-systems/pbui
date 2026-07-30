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
