---
Title: Turboproof client-layer adoption diary
Ticket: PBUI-UNIFY-001
Status: active
Topics:
    - pbui
    - frontend
    - design
DocType: reference
Intent: long-term
Owners: []
RelatedFiles:
    - turboproof/ui/src/store/workbench.ts
    - turboproof/ui/src/store/slice.ts
    - turboproof/ui/package.json
    - pbui/packages/workbench-protocol/src/client/builders.ts
    - pbui/packages/workbench-protocol/src/client/apply.ts
ExternalSources: []
Summary: Diary of turboproof adopting workbench-protocol 0.2.0's "./client" export in Phase 3 — deleting the local applier, verb builders, and tree queries from store/workbench.ts (529 lines) and re-exporting the package's plain and config-bound verbs under the historical names, with all 45 UI tests passing unmodified.
LastUpdated: 2026-07-31T13:25:00-04:00
WhatFor: Review and continuation record for the turboproof leg of the PBUI-UNIFY-001 Phase 3 client-layer adoption (commit 8fa0905).
WhenToUse: Read when reviewing turboproof commit 8fa0905, when adopting the same client layer in agentlogic/datalab, or when swapping the temporary file: dependency for the published 0.2.0.
---

# Diary

## Goal

Move turboproof/ui off its local copy of the workbench mutation layer and onto `@hyperslop-systems/workbench-protocol@0.2.0`'s new `./client` export: delete the local `applyMutation`, every local verb builder, and the tree/query helpers from `store/workbench.ts`; keep the product constants and the lean-source document code; bind the product constants once through `createWorkbenchClient`; keep every consumer's import path working via re-exports; and hold all gates green (typecheck, 45 vitest tests, `make ui-token-check`, `make ui`, `go build ./...`).

## Step 1: Reading the shipped client surface and mapping the deletion

Before touching turboproof I read the actual package sources — `packages/workbench-protocol/src/client/builders.ts`, `apply.ts`, `ratios.ts`, and `index.ts` — plus turboproof's `store/workbench.ts` (688 lines), `store/slice.ts`, and `ui/package.json`, and grepped every importer of `store/workbench` (eleven files plus `slice.ts`/`sync.tsx`/`slice.test.ts` via the relative `./workbench` path).

### Prompt Context

User prompt (verbatim): "do the ticket, you can use subagents" — plus the mandate to keep a diary in diary-skill format and commit in the turboproof repo at intervals. I am the turboproof client-layer adoption subagent of the PBUI-UNIFY-001 orchestrator (ticket task 9kjg), briefed with the 0.2.0 `./client` API summary and six numbered tasks; the orchestrator commits this diary, not me.

Assistant interpretation: execute the Phase 3 adoption in turboproof exactly per the brief — repoint the dependency at the local package build, delete the local applier/builders/queries from `store/workbench.ts`, wire `createWorkbenchClient` with turboproof's constants, re-export bound and plain verbs under the existing names so no consumer changes, keep the lean-document code local, hold every gate green, note the deliberate Go-semantics changes in the commit message, and report deletion counts.

Inferred user intent: close the turboproof rows of the ticket's duplication map — one applier and one verb vocabulary for the whole product family, pinned to the authoritative Go semantics by the shared fixture corpus — without churning any consumer file.

### What I did

- Read `src/client/builders.ts` in full: plain `splitPlacement(doc, placementId, direction, appId)` (the brief flagged the signature — the plain form takes the app id; the CLIENT's bound form is `splitPlacement(doc, placementId, direction)` with the launcher baked in), `closePlacement`, `swapPlacements`, `dockPlacement`+`DockZone`, `resizeSplit`, the queries (`findNode`, `leaves`, `viewsOfApp`, `placementCount`, `workspaceOfPlacement`, `workspaceTree`, two-arg `boundDocumentId(view, binding)`), `newId`/`leafNode`/`splitNode`, and `createWorkbenchClient(config)` returning `boundDocumentId(view)`, `defaultSourceDocumentId`, `splitPlacement`, `replaceApp`, `linkViewIntoPlacement`, `splitWithApp`.
- Read `src/client/apply.ts`: `applyMutation`/`applyMutations` over all 15 arms, throwing typed `MutationError` (stable `code` + `path`, mirroring pkg/workbench's ValidationError). `snapRatio`/`SNAP_RATIOS` live in `ratios.ts` with the same 0.022 tolerance and the same five ratios turboproof had.
- Diffed the package verbs against turboproof's local copies line by line: the builders are extracted from turboproof's own superset, so `closePlacement`, `swapPlacements`, `dockPlacement`, `resizeSplit`, `replaceApp`, `linkViewIntoPlacement`, `splitWithApp`, and `defaultSourceDocumentId` are semantically identical once the config carries `SOURCE_BINDING`/`LAUNCHER_APP`. The one product-specific bit inside a deleted function was `defaultSourceDocumentId`'s `leanSourceOf` sniff — exactly what the config's `isBindableDocument` hook exists for.
- Mapped every named import across the 14 consumer files to confirm the planned re-export list covers them all (leaves, placementCount, workspaceOfPlacement, resizeSplit, snapRatio, closePlacement, dockPlacement, swapPlacements, splitPlacement, replaceApp, linkViewIntoPlacement, splitWithApp, boundDocumentId, applyMutation, plus the kept locals DEMO_*, SOURCE_BINDING, LAUNCHER_APP, defaultWorkbench, leanSourceOf, putLeanSource, LeanSourceRef).

### Why

The brief is a second-hand description of the API; the source is the API. The signature-drift warning (plain `splitPlacement` grew an `appId` parameter) was real and decided the approach: re-export the CLIENT's bound `splitPlacement` so `Workbench.tsx` and `slice.test.ts` keep calling it with three arguments.

### What worked

Every symbol any consumer imports maps to either a package re-export or a kept local — no consumer file needed to change at all, not even `slice.ts` (its `import { applyMutation } from "./workbench"` resolves through the re-export).

### What didn't work

Nothing failed in this step. One tooling footnote: a `zsh` compound command separated by bare `====` died with `(eval):1: === not found` (zsh's `=word` expansion) — quoted separators fixed it.

### What I learned

- The package applier is stricter than turboproof's local copy in four deliberate ways (Go is authoritative): name/title/appId trimming, `PLACEMENT_POSITION_UNSPECIFIED` rejected instead of read as AFTER, `documentDelete` validating unknown/in-use documents, `documentPut` cloning the payload. None of turboproof's verbs emit an UNSPECIFIED position or a documentDelete, and no test asserts untrimmed names, so the strictness rides in silently.
- Rejections become typed `MutationError` instead of plain `Error`; the slice's `try/catch`-and-drop logic is exception-type-agnostic, so `perform`/`rebased` work unchanged.

### What was tricky to build

Nothing structural — the extraction was designed from turboproof's superset, so this leg is almost pure deletion.

## Step 2: The swap — dependency, rewrite, gates, commit

The mechanical leg: repoint the dependency, rewrite `store/workbench.ts` around the package, and run every gate.

### What I did

- `ui/package.json`: `"@hyperslop-systems/workbench-protocol": "file:../../pbui/packages/workbench-protocol"` (temporary until 0.2.0 publishes — said so in the commit message). Installed with `NODE_AUTH_TOKEN=$(vault kv get -field=token kv/ci/github/hyperslop-systems/datalab/packages-read-token) pnpm install` — pnpm reported `- 0.1.0 / + 0.2.0`, done in 991ms.
- Rewrote `ui/src/store/workbench.ts` (688 → 272 lines; `git diff --numstat` says 529 deleted / 113 added):
  - DELETED: local `applyMutation` + `removePlacement` + private `workspaceTree`, all ten local verbs, all six query helpers, local `boundDocumentId`, `newId`/`leafNode`/`splitNode`.
  - KEPT: `WORKBENCH_FORMAT`/`WORKBENCH_SCHEMA_VERSION`, `LAUNCHER_APP`, `SOURCE_BINDING`, `DEMO_DOC_ID`/`DEMO_URI`, `defaultWorkbench`, `LEAN_SOURCE_FORMAT`/`LEAN_SOURCE_VERSION`, `LeanSourceRef`, `leanSourceOf`, `putLeanSource` (with its private `mutation()` helper).
  - ADDED: a block re-export of the plain surface (`applyMutation`, `applyMutations`, `MutationError`, `newId`, `leafNode`, `splitNode`, `findNode`, `leaves`, `viewsOfApp`, `placementCount`, `workspaceOfPlacement`, `workspaceTree`, `closePlacement`, `swapPlacements`, `dockPlacement`, `resizeSplit`, `snapRatio`, `type DockZone`); a factored `leanSourceRefOf(payload)` so `leanSourceOf` and the client's `isBindableDocument` share one sniff (format === "turboproof.lean-source" AND a non-empty string `uri` — the exact truthiness the old `defaultSourceDocumentId` used); `const client = createWorkbenchClient({ sourceBinding: SOURCE_BINDING, launcherAppId: LAUNCHER_APP, isBindableDocument: (payload) => leanSourceRefOf(payload) !== null })`; and typed const re-exports of the bound verbs under the historical names (`boundDocumentId`, `defaultSourceDocumentId`, `splitPlacement`, `replaceApp`, `linkViewIntoPlacement`, `splitWithApp`).
- `store/slice.ts`: untouched. Its `applyMutation` import resolves through the re-export; the outbox/coalescing logic and the `try/catch` drop paths in `perform`/`rebased` behave identically with `MutationError`.
- Gates, all on the first run:
  - `pnpm run typecheck` — clean.
  - `pnpm vitest run` — `Test Files 8 passed (8) / Tests 45 passed (45)`. Zero test updates needed: no test relied on untrimmed names, UNSPECIFIED tolerance, unvalidated documentDelete, or documentPut aliasing.
  - `make ui-token-check` — "token check: all read tokens are defined".
  - `make ui` — vite build + embed into `pkg/webui/dist` succeeded (pre-existing >500kB chunk warning only).
  - `go build ./...` — clean.
- Committed in turboproof (only): `8fa0905` "PBUI-UNIFY-001: workbench verbs/applier move onto workbench-protocol/client", listing the four deliberate Go-semantics changes plus the MutationError typing and the temporary file: dependency.

### Why

Re-exporting under the historical names (rather than repointing fourteen consumer imports at the package) keeps this commit a pure deletion at the product layer and preserves `store/workbench.ts` as the single seam where turboproof policy meets the shared vocabulary — the same shape `createWorkbenchClient` was designed around.

### What worked

The whole swap landed in one commit with every gate green on the first attempt — the extraction really was turboproof's own code coming back with the constants parameterized.

### What didn't work

Nothing failed. (Recorded verbatim for completeness: pnpm prints `WARN Issue while reading ".npmrc". Failed to replace env in config: ${NODE_AUTH_TOKEN}` when the env var is unset — pre-existing, harmless for local file: resolution, and the token-bearing install succeeded.)

### What I learned

- `pnpm install` against a `file:` dependency links the package's on-disk `dist/`, so the package must be built before the swap — it was (`dist/client/*.js` present).
- The 45-test suite exercises the applier through the store (`slice.test.ts` replays splits and DocumentPuts through `perform`/`rebased`), so it genuinely pins the swap, not just the imports.

### What was tricky to build

Keeping `defaultWorkbench` local while its `leafNode`/`splitNode`/`newId` helpers moved to the package — solved by importing them for local use AND block-re-exporting them (TypeScript allows the same names in an `import` and an `export ... from` of one module).

### What warrants a second pair of eyes

- The `isBindableDocument` sniff requires a non-empty `uri` (full `leanSourceOf` truthiness), matching the OLD `defaultSourceDocumentId` exactly; a looser format-only check would have made a uri-less lean-source payload newly bindable.
- The behavior deltas that ride in with the shared applier (trimming, UNSPECIFIED rejection, documentDelete validation) are unexercised by turboproof's verbs today but WILL surface if a future verb emits those shapes — the server would have rejected them anyway, which is the point.

### What should be done in the future

- Swap `file:../../pbui/packages/workbench-protocol` for the registry `0.2.0` the moment it publishes (the commit message flags this).
- Consider repointing heavy query users (`Tile.tsx`, `Chrome.tsx`) directly at `@hyperslop-systems/workbench-protocol/client` once the family settles, leaving `store/workbench` to policy only.
