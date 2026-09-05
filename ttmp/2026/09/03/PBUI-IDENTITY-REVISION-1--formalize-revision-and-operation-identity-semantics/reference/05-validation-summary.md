---
Title: PBUI identity and revision hard-cutover validation summary
Ticket: PBUI-IDENTITY-REVISION-1
Status: complete
Topics:
    - architecture
    - pbui
    - workbench
DocType: reference
Intent: long-term
Owners: []
RelatedFiles:
    - Path: repo://packages/datalab-ui/scripts/consumer-smoke.mjs
      Note: |-
        Credential-free packed-consumer validation repaired during this run
        Packed consumer failure triage and repair
    - Path: repo://packages/workbench-core/src/identity.test.ts
      Note: Compile-time, runtime ingress, overflow, and wire round-trip evidence
    - Path: repo://packages/workbench-core/src/identity.ts
      Note: Branded identity definitions validated by this run
    - Path: repo://packages/workbench-core/src/sync/index.ts
      Note: UUID batch and framed SHA-256 send identity validated by this run
    - Path: repo://packages/workbench-core/src/sync/sync.test.ts
      Note: |-
        Retry, rebase, isolation, ordering, and content identity laws
        Executable identity-law matrix
ExternalSources: []
Summary: Command-by-command evidence and failure triage for the completed Workbench identity hard cutover.
LastUpdated: 2026-09-03T23:15:00-04:00
WhatFor: Review the release evidence without reading the complete terminal transcript.
WhenToUse: Use before approving or releasing PBUI-IDENTITY-REVISION-1; consult reference/03 for raw output and reference/04 for the cutover search audit.
---


# Validation summary

## Result

The Workbench identity hard cutover passes its focused package gate, the repository JavaScript/TypeScript release gate, packed-consumer checks, Storybook builds, and Go CI parity. The complete terminal transcript is in `reference/03-full-validation-output.txt`; the source/declaration search is in `reference/04-hard-cutover-audit.txt`.

## Command evidence

| Gate | Result | Evidence |
|---|---:|---|
| Frozen install | PASS | `pnpm install --frozen-lockfile` |
| Workbench protocol build | PASS | `pnpm --filter @hyperslop-systems/workbench-protocol build` |
| Workbench core typecheck | PASS | `pnpm --filter @hyperslop-systems/workbench-core typecheck` |
| Workbench core tests | PASS | 32 files, 250 tests |
| Workbench core build | PASS | Vite bundle plus declaration emission |
| Headless packed boundary | PASS | `pnpm --filter @hyperslop-systems/workbench-core boundary` |
| Root typecheck | PASS | `pnpm typecheck` |
| Root tests | PASS | 51 files, 860 tests, including 29 dependency-architecture tests |
| Root build | PASS | Vite bundle plus declarations |
| Root Storybook | PASS | static Storybook build |
| Root packed consumer | PASS | clean project, React 19.2.8 |
| Recursive typecheck | PASS | all 12 child projects that define the script |
| Recursive tests | PASS | 10 child suites, 1,565 tests |
| Recursive builds | PASS | all 12 child projects that define the script |
| Datalab lint | PASS | 474 files; one pre-existing non-blocking optional-chain warning |
| Datalab Storybook | PASS | static Storybook build |
| Datalab packed consumer | PASS | clean credential-free project after validation repair |
| Go log generation check | PASS | `make logcopter-check` with repository-enforced `GOWORK=off` |
| Go tests | PASS | `make test`, including `pkg/workbench` and `pkg/workbenchapi` |
| Go Glazed lint | PASS | `make glazed-lint` |
| Legacy FNV search | PASS | no offset, prime, or hash loop remains in Workbench core |
| Legacy sync API search | PASS | no `Revision` export, `requestId`, or `requestIdOf` remains in Workbench core TypeScript |
| Built declarations | PASS | distinct `LocalRevision`, `ServerRevision`, and `OperationId`; `SyncClient.mutate(..., operationId)` |

## Identity-law matrix

| Law | Executable evidence |
|---|---|
| Same request retry keeps the same operation ID | transport timeout scenario records equal operation IDs |
| Same bytes in a new logical batch differ | direct digest test changes only the batch UUID |
| Changed mutation payload differs | direct digest test changes title mutation content |
| Changed server revision differs | direct digest test changes the opaque revision token |
| Changed batch ordering differs | direct digest test reverses two ordered batches |
| 409 rebase differs | fake server records revision 1 and 2 attempts with different operation IDs |
| 422 isolation differs | combined and two isolated attempts have three unique operation IDs |
| Wire representation is stable | UTF-8 framing has a fixed SHA-256 golden; brands JSON-round-trip as primitives |

## Failure triage

### 1. Initial Datalab packed-consumer run had no registry credential

The recursive consumer command first failed with:

```text
npm error 401 Unauthorized ... @hyperslop-systems/pbui-workbench
```

Supplying the available GitHub credential exposed the deeper defect instead of resolving it:

```text
npm error ETARGET No matching version found for @hyperslop-systems/pbui-workbench@^0.6.0
```

The smoke packed PBUI and workbench-protocol but expected unpublished workbench-core and pbui-workbench workspace versions from the private registry. It therefore tested registry publication order rather than the current checkout.

The repair packs all private dependencies needed by the consumer—PBUI, workbench-protocol, workbench-core, pbui-workbench, and the installed Plot package—and installs them through explicit `file:` dependencies. It also verifies every packed workspace range and the Plot version. The final run deliberately removed `NODE_AUTH_TOKEN` and passed typecheck and production build in a clean temporary project.

### 2. Digest probe command mistakes

A one-line `tsx` probe first used unsupported top-level await in CJS eval mode, then hit the protocol package’s ESM-only export boundary. I did not weaken package exports. I derived the framing golden with a plain Node Web Crypto script and asserted it in the package’s normal Vitest environment.

### 3. Expected warnings

- Datalab Biome reports one existing `useOptionalChain` warning in `LauncherDialog.tsx`; lint exits successfully and the identity change does not touch that component.
- Vite reports existing large-chunk and ineffective-dynamic-import advisories in demo/Datalab builds.
- npm reports inherited pnpm configuration deprecation warnings in temporary consumer directories.

None suppresses a failed command or changes the hard-cutover result.

## Boundary conclusions

- No React or DOM dependency entered workbench-core.
- No protobuf schema or Go behavior changed.
- Datalab’s separate whole-document replacement request ID remains intentionally separate from Workbench sync operation identity.
- PBUI presentation acceptance request IDs, Datalab analysis correlation IDs, and PlotScript computation tickets remain in their owning domains.
- Atomic mutation batches, optimistic conflict handling, 409 replay, 422 batch isolation, and transport retry behavior remain covered and green.
