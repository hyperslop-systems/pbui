---
Title: PBUI identity and revision completion audit
Ticket: PBUI-IDENTITY-REVISION-1
Status: active
Topics:
    - architecture
    - pbui
    - workbench
DocType: reference
Intent: long-term
Owners: []
RelatedFiles:
    - Path: repo://packages/datalab-ui/scripts/consumer-smoke.mjs
      Note: Resolved packed-consumer evidence
    - Path: repo://packages/workbench-core/src/identity.ts
      Note: |-
        Identity taxonomy implementation
        Outcome and type-separation evidence
    - Path: repo://packages/workbench-core/src/sync/index.ts
      Note: |-
        Collision-resistant operation identity implementation
        Hashing and retry identity implementation evidence
    - Path: repo://packages/workbench-core/src/sync/sync.test.ts
      Note: Identity law evidence
    - Path: repo://ttmp/2026/09/03/PBUI-IDENTITY-REVISION-1--formalize-revision-and-operation-identity-semantics/reference/03-full-validation-output.txt
      Note: Raw validation evidence
    - Path: repo://ttmp/2026/09/03/PBUI-IDENTITY-REVISION-1--formalize-revision-and-operation-identity-semantics/reference/06-remarkable-upload-output.txt
      Note: Dry-run and successful reMarkable upload receipt
ExternalSources: []
Summary: Requirement-by-requirement evidence audit for closing PBUI-IDENTITY-REVISION-1 and its durable pi goal.
LastUpdated: 2026-09-03T23:20:00-04:00
WhatFor: Prevent ticket or durable-goal completion while any requested outcome remains unverified.
WhenToUse: Read immediately before closing PBUI-IDENTITY-REVISION-1 or marking pi goal a443d2cc-9bc1-437c-9594-2cc4fe923cc3 complete.
---


# Completion audit

## Audit rule

No item is satisfied by probability, scope narrowing, or a passing test that does not exercise the requirement. Each row points to a file, command transcript, commit, printed receipt, or upload receipt.

## Outcome requirements

| Requirement | Evidence | Result |
|---|---|---:|
| Complete the entire ticket as a hard cutover | All seven `tasks.md` items checked after delivery; implementation commits `6d14f0f`, `4f98d7c`, `82a994a`, `1f47d3e`; no alias layer | PASS |
| Distinguish local, server, and operation identity | `identity.ts`; compile-time inequality assertions in `identity.test.ts`; built declarations in `reference/04` | PASS |
| Remove broad `Revision` and sync `requestId` vocabulary | No-legacy searches in `reference/04`; public-surface snapshot; migration docs explicitly state no aliases | PASS |
| Replace collision-prone request hashing | `syncRequestOperationId`; no FNV constants in `reference/04`; fixed SHA-256 golden | PASS |
| Migrate every affected implementation/test/export/consumer/example/document | Core state, description, sync, stabilization probe, fake server, package export snapshot, core README, shell README/MIGRATION; consumer inventory in `reference/04` | PASS |
| Preserve unrelated identity domains | Inventory and guide §§2, 11, 14; global classified search in `reference/04`; no Datalab analysis/presentation/PlotScript rename | PASS |
| Preserve atomic batches and optimistic synchronization | Existing batch/order, 409, 422, in-flight, bootstrap, stream, and conflict tests all remain in 250-test green core suite | PASS |
| Preserve headless boundary | Packed `workbench-core boundary` passed; source fence remains in core suite | PASS |
| Preserve protocol and Go behavior | No schema/Go diff; protocol build and all Go tests/checks passed | PASS |

## Identity-law requirements

| Requirement | Evidence | Result |
|---|---|---:|
| Constructor and malformed-ingress behavior | `identity.test.ts` local safe-integer, overflow, empty, and wrong-kind cases | PASS |
| Compile-time type separation | `expectTypeOf` inequalities among all three brands | PASS |
| Same retry has same ID | timeout/retry scenario records equal IDs | PASS |
| Same content as a new logical batch has different ID | direct digest law changes only batch UUID | PASS |
| Changed payload has different ID | direct digest law | PASS |
| Changed server revision has different ID | direct digest law | PASS |
| Changed ordering has different ID | direct digest law | PASS |
| 409 rebase has new send identity | fake server records revisions `1`, `2` and unequal IDs | PASS |
| 422 isolation has per-send identity | combined/two isolated attempts produce three unique IDs | PASS |
| Serialization is stable | JSON primitive round trip and Unicode framed SHA-256 golden | PASS |
| No legacy regression | source search, declaration audit, and public export snapshot | PASS |

## Verification requirements

| Gate | Fresh evidence | Result |
|---|---|---:|
| Focused core typecheck/test/build/boundary | `reference/03`, 32 files / 250 tests | PASS |
| Root typecheck/test/build/Storybook/consumer | `reference/03`, 51 files / 860 tests | PASS |
| Recursive child typechecks/tests/builds | `reference/03`, 12 typechecks, 10 suites / 1,565 tests, 12 builds | PASS |
| Datalab lint/Storybook/consumer | `reference/03`; final consumer explicitly credential-free | PASS |
| Go local CI parity | `make logcopter-check`, `make test`, `make glazed-lint` in `reference/03` | PASS |
| Frozen lockfile | `pnpm install --frozen-lockfile` in `reference/03` | PASS |
| Source/declaration searches | `reference/04` | PASS |
| Diff hygiene | `git diff --check`; changed-file inventory reviewed against pre-ticket commit `a7c5f7a` | PASS |
| No task-introduced TODO/shim/dead compatibility code | changed-production-file search plus no-legacy audit | PASS |
| Documentation | guide §20, diary Steps 1–7, validation summary, tasks, changelog, RelatedFiles | PASS |
| docmgr health | final `docmgr doctor --ticket PBUI-IDENTITY-REVISION-1 --stale-after 30` reports all checks passed | PASS |
| Thermal slips | Overall plan and P0–P4 start/done plus P5 start printed; P2 recovery chronology disclosed in diary; final P5 done receipt is the last closure action | PENDING FINAL PRINT |
| reMarkable | `reference/06`: dry run plus `OK: uploaded PBUI Identity Revision Implementation.pdf -> /ai/2026/09/03/PBUI-IDENTITY-REVISION-1` | PASS |

## Failure-resolution audit

- The Web Crypto fake-timer mismatch was fixed by explicitly awaiting the active flush; no timing delay or skipped assertion was introduced.
- Public-surface snapshot changes were reviewed and updated rather than blindly accepted.
- The Datalab consumer’s 401/ETARGET failures were traced to private registry/publication-order assumptions. The check now packs the current coordinated private dependency set and passes without credentials.
- Ad-hoc `tsx` probe failures did not weaken ESM exports; the digest golden is exercised in Vitest.
- AtomS3R HTTP unavailability was not hidden. It recovered, retrospective P2 markers were printed explicitly, and subsequent phase slips returned `printed: true`.

## Constraint audit

- No user changes were overwritten.
- No compatibility shim or deprecated alias was added.
- No TODO placeholder, disabled test, skipped validation, fake success, or swallowed command failure remains.
- No protobuf or Go source was changed.
- No React/DOM import entered workbench-core.
- The only additional production-adjacent change is the Datalab release smoke itself; it changes validation infrastructure, not runtime behavior, and directly resolves a discovered mandatory consumer gate failure.

## Final condition

After the final closure metadata and `P5 DONE` print receipt are committed, rerun the concise core/root/docmgr/no-legacy/git-status audit. Mark the durable pi goal complete only if those fresh checks pass and the working tree is clean.
