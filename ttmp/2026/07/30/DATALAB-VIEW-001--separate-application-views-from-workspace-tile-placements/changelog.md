# Changelog

## 2026-07-30

- Initial workspace created
- Documented the existing leaf-owned application/document model and its layout, persistence, bundle, and interaction consequences.
- Proposed normalized application views referenced by reusable workspace placements.
- Defined linked duplicate, independent duplicate, title-menu, and unified Replace-switcher behavior.
- Added a phased implementation and validation plan suitable for an engineer new to PBUI.

## 2026-07-30

Completed pragmatic application-view object-model analysis and phased implementation guide

### Related Files

- /home/manuel/workspaces/2026-07-28/split-datadrop/pbui/packages/datalab-ui/src/components/organisms/Tile/Tile.tsx — Current interaction surface being redesigned
- /home/manuel/workspaces/2026-07-28/split-datadrop/pbui/packages/datalab-ui/src/store/layoutTree.ts — Current representation being redesigned


## 2026-07-30

Validated documentation and uploaded the default-layout design bundle to /ai/2026/07/30/DATALAB-VIEW-001


## 2026-07-30 - Implemented normalized application views

Shipped the pragmatic first release in 6cff173: normalized AppView records and placement-only leaves, linked and independent duplication, title action menus, shared Launcher/Replace selection, clean persistence and portable schema bumps, lifecycle repair, Storybook interaction coverage, and real-workbench browser validation. MRU keyboard navigation and generalized view state remain intentionally deferred.

### Related Files

- packages/datalab-ui/src/components/organisms/Tile/Tile.stories.tsx — Title-menu, focus, duplicate, and narrow-title interactions
- packages/datalab-ui/src/components/organisms/Tile/Tile.tsx — Resolves placements to views and hosts title-menu and Replace behavior
- packages/datalab-ui/src/components/organisms/ViewSwitcher/ViewSwitcher.tsx — Shared Launcher and Replace user interface
- packages/datalab-ui/src/components/organisms/ViewSwitcher/model.ts — Pure scoped selection and singleton policy
- packages/datalab-ui/src/model/portable.ts — Version 3 normalized portable bundle schema
- packages/datalab-ui/src/store/bundles.ts — Hydrates shared view topology once per envelope
- packages/datalab-ui/src/store/layout.ts — Owns normalized views, placement reducers, duplicate semantics, and lifecycle repair
- packages/datalab-ui/src/store/persist.ts — Version 4 normalized persistence validation
- packages/datalab-ui/test/portable.test.ts — Workspace and stage shared-topology round trips
- packages/datalab-ui/test/store.test.ts — Lifecycle, duplicate, binding, and persistence regression coverage
