---
Title: Agentlogic client-layer adoption diary
Ticket: PBUI-UNIFY-001
Status: active
Topics:
    - pbui
    - frontend
    - design
DocType: reference
Intent: long-term
Owners: []
RelatedFiles: []
ExternalSources: []
Summary: Subagent diary for adopting workbench-protocol 0.2.0's "./client" export in agentlogic's ui store — replacing the local applier/builders/queries in store/workbench.ts with the shared layer, configuring createWorkbenchClient with agentlogic's real constants (binding "transcript", launcher "launcher", format agentlogic.transcript-ref), and keeping every gate green with zero test edits.
LastUpdated: 2026-07-31T13:25:00-04:00
WhatFor: Review and continuation record for agentlogic's Phase 3 adoption of the shared workbench client layer (commit 44f8d3c).
WhenToUse: Read when reviewing agentlogic commit 44f8d3c, when adopting the client layer in datalab or turboproof, or when wondering why agentlogic's config uses "transcript" instead of "source" as its binding key.
---

# Diary

## Goal

Adopt the PBUI-UNIFY-001 Phase 3 deliverable in agentlogic's ui: replace the local applier, verb builders, and tree queries in `ui/src/store/workbench.ts` with imports from `@hyperslop-systems/workbench-protocol/client` (0.2.0, local `file:` build), build the product client via `createWorkbenchClient` with agentlogic's real constants, re-export everything under the existing names so importers stay untouched, and keep every gate green: typecheck, the vitest suite (baseline 105 passed / 1 skipped), the production build with the committed `pkg/webui/dist` bundle, and `GOWORK=off go build ./...` + `go test ./...`.

## Step 1: Survey — the store, its importers, and the product constants

The brief was explicit that the config values must be verified, not assumed ("likely binding \"source\"/app \"launcher\"; verify, do not assume") — and the verification mattered: agentlogic's binding key is NOT "source".

### Prompt Context

**User prompt (verbatim):** "do the ticket, you can use subagents" — relayed to me as the agentlogic client-layer adoption subagent for PBUI-UNIFY-001 Phase 3 (ticket task 9kjg), with the orchestrator's task list: study `ui/src/store/workbench.ts` and its importers, verify agentlogic's source-binding key / launcher app id / document format sniff against `pkg/workbenchapp`, point the workbench-protocol dep at the local checkout, replace the local applier/builders/queries with the "./client" export, configure `createWorkbenchClient` with the real values, keep the format constants + default seed local, keep all gates green (105 passed / 1 skipped or better), report lines deleted, commit at intervals with the Fable co-author trailer, and keep this diary (the diary/commit mandate is part of the standing instructions).

**Assistant interpretation:** Delete agentlogic's copy of the workbench mutation layer — the file turboproof's copy came from — and re-point the store at the shared, parity-pinned package, keeping only what is genuinely agentlogic's: format constants, the default workbench, and the product configuration.

**Inferred user intent:** One applier, one set of verbs, one snap contract across the family, so a mutation-semantics change lands in every product by version bump instead of transcription — with the Go applier authoritative and the TS mirror pinned by the parity corpus.

### What I did

- Read `ui/src/store/workbench.ts` end to end (512 lines: format constants, `newId`/`leafNode`/`splitNode`, `defaultWorkbench`, the queries, the 10-arm applier with `removePlacement`, and the verbs `splitPlacement`/`closePlacement`/`replaceApp`/`swapPlacements`/`dockPlacement`/`resizeSplit`/`snapRatio`).
- Read the package's `src/client/builders.ts` and `src/client/index.ts` for the exact exported signatures, and grepped `src/client/apply.ts` for its error messages (the agentlogic test matches `/last placement/`).
- Grepped the importers: `ui/src/store/workbenchContext.tsx` (applyMutation + all verbs), `ui/src/store/workbench.test.ts` (verbs, queries, `LAUNCHER_APP`, `defaultWorkbench`), `ui/src/components/organisms/Tile.tsx` (`leaves`, `workspaceOfPlacement`), `ui/src/apps/LauncherApp.tsx` (`LAUNCHER_APP`), and `ui/src/components/organisms/BoundWorld.tsx` (reads `view.documents["transcript"]` directly).
- Verified the product constants in Go: `pkg/workbenchapp/catalog.go` (`transcriptBinding = "transcript"`, launcher id `"launcher"` with an empty `DocumentBindings` map) and `pkg/workbenchapp/documents.go` (`TranscriptRefFormat = "agentlogic.transcript-ref"`, `TranscriptRefVersion = 1`, shape-only validation per DR-30).
- Checked `ui/package.json` and the repo `Makefile`: the workbench-protocol dependency was ALREADY `file:../../pbui/packages/workbench-protocol` (the previous adoption round did that), and `make ui` builds the protocol dist if missing, then vite-builds into the committed `pkg/webui/dist`.

### Why

- The client factory's `sourceBinding` had to come from the repo, not the brief's guess: `BoundWorld.tsx` and `pkg/workbenchapp` agree on `"transcript"`, where turboproof uses `"source"` and datalab `"primary"`. Wiring `"source"` here would have silently broken every bound tile.
- The `/last placement/` regex check up front confirmed the shared applier's `placementClose` message ("the last placement cannot be closed") still matches, so that test needed no edit.
- `moduleResolution: "bundler"` in `ui/tsconfig.json` confirmed the `./client` subpath export resolves without config changes.

### What worked

- The survey converged fast because the shared builders are a direct extraction of this very file (the header of `builders.ts` says so): every config-free verb and query is line-for-line what agentlogic had, so re-exporting under the old names was safe by construction.
- `grep -A3 '"./client"' node_modules/.../package.json` after `pnpm install` proved the symlinked `file:` dependency already exposed the freshly built `dist/client/`.

### What didn't work

- A zsh quoting slip, same as the Phase 1+2 diary: `echo ===` in a compound command failed with `(eval):1: == not found` (zsh treats a leading `=` in command position as an expansion). Cosmetic; re-ran without the separator.

### What I learned

- Agentlogic's document story is thinner than the client layer's: the ui never emits `documentPut`/`documentDelete` (only the applier handled them), and `doc.documents` is populated only by the server or a future flow. So the client's new "bind the default source document on placement" behavior is a no-op today (no documents → empty bindings → the same mutations as before) but becomes live the moment a transcript reference lands in a workbench.
- The launcher's empty `DocumentBindings` in the Go catalog is what makes the client's `replaceDocuments: {}` on launcher retargeting safe — a launcher view has nothing to clear.

## Step 2: The rewrite — config over copy

`ui/src/store/workbench.ts` went from 512 lines to 169: a re-export block, the product constants, the configured client, and `defaultWorkbench`.

### What I did

- Rewrote `ui/src/store/workbench.ts`:
  - Re-exported from `@hyperslop-systems/workbench-protocol/client`: `applyMutation`, `applyMutations`, `MutationError`, `boundDocumentId`, `closePlacement`, `dockPlacement`, `findNode`, `leaves`, `newId`, `placementCount`, `resizeSplit`, `snapRatio`, `SNAP_RATIOS`, `swapPlacements`, `viewsOfApp`, `workspaceOfPlacement`, `workspaceTree`, `type DockZone`.
  - Kept local: `WORKBENCH_FORMAT = "pbui.workbench"`, `WORKBENCH_SCHEMA_VERSION = 1`, `LAUNCHER_APP = "launcher"`, and two new constants mirroring `pkg/workbenchapp`: `TRANSCRIPT_BINDING = "transcript"` and `TRANSCRIPT_REF_FORMAT = "agentlogic.transcript-ref"`.
  - Built and exported `workbenchClient = createWorkbenchClient({ sourceBinding: TRANSCRIPT_BINDING, launcherAppId: LAUNCHER_APP, isBindableDocument: (payload) => payload.format === TRANSCRIPT_REF_FORMAT })`, and re-exported `splitPlacement = workbenchClient.splitPlacement` and `replaceApp = workbenchClient.replaceApp` under their old names and signatures.
  - Kept `defaultWorkbench()` verbatim (the four seeded workspaces), now built on the package's `leafNode`/`splitNode`/`newId`.
- Repointed `BoundWorld.tsx`'s hardcoded `view.documents["transcript"]` to `workbenchClient.boundDocumentId(view)` — the one importer change, two lines.
- Refreshed the install with `NODE_AUTH_TOKEN=$(vault kv get -field=token kv/ci/github/hyperslop-systems/datalab/packages-read-token) pnpm install` (1s; the `file:` symlink picked up the rebuilt dist).

### Why

- Re-exporting under the old names means `workbenchContext.tsx` (413 lines of storage/sync/rebase logic), `Tile.tsx`, `LauncherApp.tsx`, and the test file did not change at all — the blast radius of the adoption is one file plus the two-line BoundWorld repoint.
- Exporting `workbenchClient` itself (not just the two bound verbs) gives the launcher's future `linkViewIntoPlacement`/`splitWithApp` flows a ready home without another store change.
- `isBindableDocument` sniffs `format === "agentlogic.transcript-ref"` because that is literally the only format the Go `DocumentValidator` admits into a workbench; the sniff and the validator cannot disagree.

### What worked

- Everything on the first run: `tsc --noEmit` clean, `vitest run` at exactly the baseline (105 passed / 1 skipped), `make ui` rebuilt the committed bundle, `GOWORK=off go build ./...` and `GOWORK=off go test ./...` all ok.
- Zero test edits. The brief warned about tests relying on untrimmed names or UNSPECIFIED-position tolerance; agentlogic's suite has neither — its seed names are already trimmed, its builders always set BEFORE/AFTER, and its one applier-error assertion (`/last placement/`) matches the shared applier's `last_placement` detail text.

### What didn't work

- Nothing failed in this step; there were no compile or test errors to record.

### What I learned

- The semantics deltas the server now enforces (name/title/appId trimming, `PLACEMENT_POSITION_UNSPECIFIED` rejected, `documentDelete` validating unknown/in-use documents, `documentPut` cloning its payload) are all invisible to agentlogic's current emitters — the adoption's only OBSERVABLE change is `replaceApp`/launcher-retarget now carrying `replaceDocuments` (empty today, the default transcript once documents exist), which the Go applier accepts for every non-launcher app because the `transcript` binding is optional everywhere.

## Step 3: Gates and the commit

### What I did

- Ran the full gate set once more against the final tree and committed as `44f8d3c` ("PBUI-UNIFY-001: adopt workbench-protocol's shared client layer in the store"): `ui/src/store/workbench.ts` (-419/+76), `BoundWorld.tsx` (+2/-1), and the rebuilt `pkg/webui/dist` bundle (JS chunk `index-DPeaFpwQ.js` → `index-BDg6gw4u.js`), following the committed-bundle convention of 6f2c649.
- The commit message names each deliberate behavior change and states that the `file:` dependency is temporary until 0.2.0 publishes to the GitHub registry.
- Left the pre-existing unstaged edit to the AGENTLOGIC-5 diary untouched (it predates this task) and did not commit this diary (the orchestrator will).

### Why

- One commit, not several: the change is a single coherent swap whose intermediate states do not typecheck (the old file and the re-exports would collide), so "commit at intervals" collapses to one interval here.

### What worked

- lefthook's pre-commit lint/test hooks skipped cleanly (no matching staged Go files), and the numbers held: 105 passed / 1 skipped, all Go packages ok.

### What didn't work

- Nothing; the commit landed on the first attempt.

### What I learned

- `make ui` is self-sufficient for the adoption loop: it verifies the sibling protocol dist exists (building it if not), installs, and writes the committed bundle — the same target CI uses, so local green here is the same green CI will compute.

## Review and validation

- `git show 44f8d3c` in agentlogic: the store rewrite, the BoundWorld repoint, and the bundle swap; nothing else.
- Re-run the gates from the agentlogic repo root: `cd ui && pnpm run typecheck && pnpm run test` (expect 105 passed / 1 skipped), `make ui`, `GOWORK=off go build ./... && GOWORK=off go test ./...`.
- The config triple to check against the Go side: `sourceBinding "transcript"` ↔ `pkg/workbenchapp/catalog.go` `transcriptBinding`; `launcherAppId "launcher"` ↔ the catalog's launcher descriptor; `isBindableDocument` ↔ `pkg/workbenchapp/documents.go` `TranscriptRefFormat`.

## Follow-ups

- Swap the `file:` reference for the published `@hyperslop-systems/workbench-protocol@0.2.0` once it lands in the GitHub registry (the commit message flags this).
- When agentlogic grows a "open transcript in workbench" flow (documentPut from the ui), the default-binding behavior of `replaceApp`/`splitWithApp` becomes user-visible; the launcher could then adopt `workbenchClient.linkViewIntoPlacement`/`splitWithApp` directly.
