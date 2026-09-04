# Changelog

## 2026-09-03

- Initial workspace created


## 2026-09-03

Phase 0: inventoried seven identity categories, isolated the Workbench 32-bit idempotency defect, bounded the branded hard cutover, and authored the intern guide.

### Related Files

- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/ttmp/2026/09/03/PBUI-IDENTITY-REVISION-1--formalize-revision-and-operation-identity-semantics/design-doc/01-intern-guide-to-revision-and-operation-identity-semantics.md — Identity taxonomy and implementation design


## 2026-09-03

Phases 1-2: branded Workbench local/server/operation identities, deleted the broad Revision/requestId API, replaced FNV with UUID-backed framed SHA-256 request identity, and passed 249 core tests (commits 6d14f0f, 4f98d7c).

### Related Files

- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/packages/workbench-core/src/sync/index.ts — Collision-resistant idempotency implementation


## 2026-09-03

Phases 3-5: documented the identity API, completed all seven operation-identity laws, passed 250 core/860 root/1,565 child tests plus all builds and Go checks, and repaired Datalab's credential-dependent packed consumer (commits 82a994a, 1f47d3e, 320c758).

### Related Files

- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/packages/datalab-ui/scripts/consumer-smoke.mjs — Self-contained clean-consumer release gate
- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/packages/workbench-core/src/sync/sync.test.ts — Complete operation identity law coverage

