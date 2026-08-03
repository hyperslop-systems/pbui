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

