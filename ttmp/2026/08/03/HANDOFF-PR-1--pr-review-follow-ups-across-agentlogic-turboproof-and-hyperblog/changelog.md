# Changelog

## 2026-08-03

- Initial workspace created


## 2026-08-03

Handoff written for the three open product PRs: 21 review findings and the CI failures, each with file, symbol, mechanism and how to verify. Architecture sections cover PBUI's presentation protocol, the workbench shell, product layering and the token contract.

### Related Files

- /home/manuel/workspaces/2026-07-30/transcript-agent/pbui/src/presentation/createPbui.tsx — The protocol every product's descriptors bind to — read before any UI finding


## 2026-08-03

Step 1: turboproof T1/T6/T7/T10 — per-path locks make Write an actual compare-and-swap, the fingerprint streams under the cap, the file route gets JSON headroom, G302 gets a scoped nosec (turboproof commit 2f4bc82)

### Related Files

- /home/manuel/workspaces/2026-07-30/transcript-agent/turboproof/pkg/filestore/store.go — pathLocks, readBounded, fingerprintAt
- /home/manuel/workspaces/2026-07-30/transcript-agent/turboproof/pkg/server/server.go — jsonEnvelope and bodyLimitFor


## 2026-08-03

Step 2: turboproof T2/T3/T4/T5/T8/T9 — verbs addressed by placement, rename as a prefix rewrite re-read after the await, a refused batch isolated instead of discarded, a failed root fetch no longer cached, and a Windows root that is not a hostname (turboproof commits c798f7c, e9de793)

### Related Files

- /home/manuel/workspaces/2026-07-30/transcript-agent/turboproof/ui/src/state/fileRoots.ts — successes cached, failures retried (T8)
- /home/manuel/workspaces/2026-07-30/transcript-agent/turboproof/ui/src/state/filesTile.ts — the placement-keyed handler map (T2)
- /home/manuel/workspaces/2026-07-30/transcript-agent/turboproof/ui/src/store/renameBinding.ts — re-read after the await, move every displaced document (T3, T4)
- /home/manuel/workspaces/2026-07-30/transcript-agent/turboproof/ui/src/store/slice.ts — rejected keeps the batch and isolates (T5)


## 2026-08-03

Step 3: hyperblog H1-H9 — per-placement post bindings, a launcher that works, a 0600 database, a tier check on read-marks, an atomic OIDC provider, bounded token TTLs, and an honest session list. Plus a finding nobody had made: the pbui Provider had no onPerform, so every object-menu entry in the product did nothing (hyperblog commits aa684a8, d4a073d)

### Related Files

- /home/manuel/workspaces/2026-07-30/transcript-agent/hyperblog/pkg/server/server.go — atomic.Pointer for the OIDC provider (H5)
- /home/manuel/workspaces/2026-07-30/transcript-agent/hyperblog/pkg/store/store.go — precreatePrivate — the database is owner-only (H3)
- /home/manuel/workspaces/2026-07-30/transcript-agent/hyperblog/ui/src/App.tsx — the provider had no onPerform — the tenth finding
- /home/manuel/workspaces/2026-07-30/transcript-agent/hyperblog/ui/src/model/paneTree.ts — the layout tree, extracted so H1/H7/H8 could be asserted


## 2026-08-03

Step 4: agentlogic A1/A2/A3, X1 verified as already done, and H10 — provisioned the missing Vault policy and role, which then revealed two real lint failures, a gosec that could not type-check anything, and a CodeQL job failing at checkout for want of contents:read. All four repositories green (agentlogic d6c0e91; hyperblog 6801103, e622489)

### Related Files

- /home/manuel/workspaces/2026-07-30/transcript-agent/agentlogic/ui/src/components/pages/SourcePicker/SourcePicker.tsx — the row's own project (A1)
- /home/manuel/workspaces/2026-07-30/transcript-agent/hyperblog/.github/workflows/dependency-scanning.yml — ported from turboproof — private-go on both scanning jobs (H10)

