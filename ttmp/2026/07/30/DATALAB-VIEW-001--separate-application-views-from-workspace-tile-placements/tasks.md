# Tasks

## Design package

- [x] Map the current application, document, workspace, and leaf model.
- [x] Specify normalized `AppView` and placement contracts.
- [x] Define linked duplicate and independent duplicate semantics.
- [x] Define title-menu and Replace-switcher interactions.
- [x] Define phased implementation and test plans.
- [x] Validate the ticket with `docmgr doctor`.
- [x] Upload the design package to reMarkable.

## Implementation

- [x] Phase 1: introduce the view registry and convert layout leaves to placements.
- [x] Phase 2: update rendering, selectors, persistence, seeded layouts, and bundles.
- [x] Phase 3: implement the title action menu and unified Replace switcher.
- [x] Phase 4: implement linked duplicate, independent duplicate, and view lifecycle.
- [x] Phase 5: add Storybook interaction states and end-to-end regression coverage.
- [x] Phase 6a: use the shared view switcher in Launcher.
- [ ] Deferred Phase 6b: add MRU tracking and recent-view keyboard navigation when
      a concrete product workflow requires it.

## Verification

- [x] Datalab lint and TypeScript checks pass.
- [x] Datalab unit and regression suite passes: 37 files, 411 tests.
- [x] Datalab production build passes.
- [x] Storybook static build passes.
- [x] Root PBUI TypeScript and tests pass: 5 files, 26 tests.
- [x] Storybook interactions cover both title gestures, Rename, Replace, Escape
      focus restoration, linked duplicate, and independent duplicate.
- [x] The real `/ui/` workbench links an existing view through Replace and
      exposes **Close view everywhere** for the resulting placements.
- [x] Runtime implementation committed as `6cff173`.
