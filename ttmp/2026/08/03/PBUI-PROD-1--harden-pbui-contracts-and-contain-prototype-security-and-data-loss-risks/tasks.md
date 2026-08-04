# Tasks

## Phase 0 — Evidence and scope

- [x] Create the production-first hardening ticket and record the implementation boundary.
- [x] Re-read the live PBUI, datalab, agentlogic, hyperblog, and turboproof call sites and tests.
- [ ] Complete the intern-oriented architecture and implementation guide.

## Phase 1 — Shared PBUI and production consumers

- [ ] Make `PbuiProvider.onPerform` required and migrate every controlled provider call site without a compatibility default.
- [ ] Prevent a `Presentation` from handling Enter or Space owned by a nested interactive control.
- [ ] Add a PBUI regression test for nested-control keyboard ownership.
- [ ] Add a datalab composition test proving its real provider routes a PBUI verb into Redux state.
- [ ] Export `RootState` from both public FileBrowser barrels.
- [ ] Make the root-font-size wiring test recognize plain `html` and `:root` selectors.
- [ ] Build PBUI before validating datalab, then run PBUI, datalab, and agentlogic tests and typechecks.

## Phase 2 — Hyperblog containment

- [ ] Prevent a locked post's body from influencing search hit existence, count, paragraph, or score.
- [ ] Mark owner-scoped workbench JSON and streams private/no-store and vary on both credential transports.
- [ ] Close a question using the current local draft exactly once.
- [ ] Add regressions at the search, HTTP, and NoteEditor boundaries.
- [ ] Run hyperblog Go, frontend, and TypeScript verification.

## Phase 3 — Turboproof containment

- [ ] Require JSON and reject a foreign `Origin` before create and rename can mutate disk.
- [ ] Reject an absent or null `text` member instead of writing an empty file.
- [ ] Reject equal, nested, and symlink-aliased configured roots at startup.
- [ ] Classify a directory as `ErrIsDirectory` before streaming its fingerprint.
- [ ] Refuse a rename whose destination URI is already owned by a different open document.
- [ ] Add server, filestore, and frontend regressions and run all turboproof verification.

## Phase 4 — Delivery

- [ ] Record focused commits and exact validation evidence in the diary and changelog.
- [ ] Relate the primary implementation files and pass `docmgr doctor`.
- [ ] Dry-run and upload the final design/diary bundle to reMarkable.

## Deferred by product-lifetime decision

- [ ] PBUI FileBrowser accessibility completion: initial active descendant, reversible row IDs, sentinel focus transfer, and sentinel focus ring.
- [ ] PBUI composite-row keyboard menu design beyond the nested-control safety fix.
- [ ] Hyperblog reader-corpus, three-language verb, and per-placement `TileScope` refactors.
- [ ] Hyperblog entitlement, discovery, launcher, Markdown, and CLI polish findings.
- [ ] Turboproof symlink identity policy, synchronization state machine, and file-tree resilience findings.
