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

## 2026-07-30 - Designed searchable launcher modal and keyboard-routing foundation

Compared embedded search, a modal launcher, and a generalized command palette. Recommended a staged modal design with workspace-grouped views, + and wsN query prefixes, explicit fill/replace/navigate invocation semantics, viewer-local active placement, and one workbench-scoped Mod+K route. Deferred MRU, command registration, stable aliases, and implicit tile splitting.

### Related Files

- packages/datalab-ui/src/apps/LauncherApp/LauncherApp.tsx — Launcher tile entry point
- packages/datalab-ui/src/components/organisms/Tile/Tile.tsx — Placement DOM boundary for active-placement tracking
- packages/datalab-ui/src/components/organisms/ViewSwitcher/ViewSwitcher.tsx — Current shared selection surface the modal will wrap
- packages/datalab-ui/src/components/organisms/ViewSwitcher/model.ts — Pure scope and singleton policy the search index must preserve
- packages/datalab-ui/src/components/pages/Workbench/WorkbenchProviders.tsx — Per-instance keyboard and interaction provider seam
- src/components/Dialog/Dialog.tsx — Existing accessible modal primitive

## 2026-07-30

Validated the launcher quick-search design with strict docmgr checks and uploaded the default-layout PDF to /ai/2026/07/30/DATALAB-VIEW-001.

### Related Files

- ttmp/2026/07/30/DATALAB-VIEW-001--separate-application-views-from-workspace-tile-placements/design-doc/02-launcher-quick-search-modal-workspace-grouping-and-keyboard-routing.md — Uploaded launcher modal and keyboard-routing design
