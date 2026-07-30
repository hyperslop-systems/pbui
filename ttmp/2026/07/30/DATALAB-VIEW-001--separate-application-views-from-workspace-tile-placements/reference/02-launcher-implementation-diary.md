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
    - Path: repo://packages/datalab-ui/src/components/pages/WorkbenchInstance/WorkbenchInstance.tsx
      Note: Store-per-instance boundary that removes the isolation case for a context
    - Path: repo://packages/datalab-ui/src/pbui/descriptors/tile.ts
      Note: Serialisable openReplaceView verb that rules out a React-context launcher
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
