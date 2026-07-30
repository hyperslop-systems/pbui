---
Title: Separate application views from workspace tile placements
Ticket: DATALAB-VIEW-001
Status: review
Topics:
    - frontend
    - authoring
DocType: index
Intent: long-term
Owners: []
RelatedFiles: []
ExternalSources: []
Summary: Normalize logical application views independently from placements and design the searchable modal launcher and keyboard-navigation follow-up.
LastUpdated: 2026-07-30T16:44:00-04:00
WhatFor: Guide implementation of reusable application views, linked placements, view duplication, title actions, and the unified Replace switcher.
WhenToUse: Read before changing PBUI layout nodes, tile actions, launcher behavior, persistence, or portable bundles.
---

# Separate application views from workspace tile placements

## Overview

PBUI currently stores an application identifier, document identifier, and label
directly on each workspace leaf. That representation makes one object serve as
both the logical application view and its geometric placement. This ticket
separates those responsibilities.

The proposed model stores logical `AppView` objects independently and makes
workspace leaves reference them by `viewId`. One view can consequently appear in
several placements and several workspaces. The interaction model distinguishes
**Create linked duplicate**, which creates another placement for the same view,
from **Duplicate**, which copies the view and creates a placement for the new
copy.

The tile title opens the complete view-action menu on both left-click and
right-click. Rename becomes a menu action instead of the title's direct
left-click behavior. The application dropdown is replaced by a **Replace**
action whose switcher combines the current application choices with reusable
existing views.

## Key Links

- [Detailed implementation guide](design-doc/01-application-views-linked-tile-placements-launcher-and-replacement-switcher-implementation-guide.md)
- [Launcher quick-search and keyboard-routing design](design-doc/02-launcher-quick-search-modal-workspace-grouping-and-keyboard-routing.md)
- [Consumer migration playbook](playbook/01-migrating-datalab-consumers-to-application-views-and-tile-placements.md)
- [Investigation diary](reference/01-investigation-diary.md)
- **Related Files**: See frontmatter RelatedFiles field
- **External Sources**: See frontmatter ExternalSources field

## Status

Current status: **review**

The pragmatic first release is implemented in commit `6cff173`. Logical views
are normalized independently from placement geometry; linked and independent
duplication, title actions, shared Launcher/Replace selection, persistence,
portable bundles, regression tests, and Storybook interactions are complete.

The follow-up launcher design is ready for review. It recommends a searchable
modal grouped by workspace, a small `+`/`wsN` query grammar, and a staged
workbench-local active-placement and `Mod+K` navigation system. MRU ordering,
general command registration, persistent focus, and implicit tile splitting
remain deferred.

## Topics

- frontend
- authoring

## Tasks

See [tasks.md](./tasks.md) for the current task list.

## Changelog

See [changelog.md](./changelog.md) for recent changes and decisions.

## Structure

- design/ - Architecture and design documents
- reference/ - Prompt packs, API contracts, context summaries
- playbooks/ - Command sequences and test procedures
- scripts/ - Temporary code and tooling
- various/ - Working notes and research
- archive/ - Deprecated or reference-only artifacts
