---
Title: Investigation diary
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
    - Path: repo://packages/workbench-core/src/identity.test.ts
      Note: Runtime and compile-time identity laws
    - Path: repo://packages/workbench-core/src/identity.ts
      Note: Branded identity constructors from commit 6d14f0f
    - Path: repo://packages/workbench-core/src/sync/index.ts
      Note: UUID batches and framed SHA-256 request identities from commit 4f98d7c
    - Path: repo://packages/workbench-core/src/sync/sync.test.ts
      Note: Retry distinction and ordering laws
    - Path: repo://ttmp/2026/09/03/PBUI-IDENTITY-REVISION-1--formalize-revision-and-operation-identity-semantics/design-doc/01-intern-guide-to-revision-and-operation-identity-semantics.md
      Note: Authoritative design and hard-cutover contract
    - Path: repo://ttmp/2026/09/03/PBUI-IDENTITY-REVISION-1--formalize-revision-and-operation-identity-semantics/reference/02-identity-semantics-inventory.json
      Note: Generated seven-category repository evidence
    - Path: repo://ttmp/2026/09/03/PBUI-IDENTITY-REVISION-1--formalize-revision-and-operation-identity-semantics/scripts/01-inventory-identity-semantics.mjs
      Note: Reproducible identity vocabulary inventory
ExternalSources:
    - /tmp/pbui-improvements.md
Summary: Chronological evidence, failures, decisions, commits, tests, and printed phase boundaries for Workbench revision and operation identity semantics.
LastUpdated: 2026-09-03T22:25:00-04:00
WhatFor: Make the identity hard cutover reproducible and reviewable by an engineer unfamiliar with PBUI's concurrency models.
WhenToUse: Read before implementing, reviewing, or continuing PBUI-IDENTITY-REVISION-1.
---



# Diary

## Goal

Separate the identities PBUI uses for local change observation, server concurrency, idempotent operations, content equality, event correlation, and computation supersession—then hard-cutover the Workbench sync loop away from its 32-bit request hash.

## Step 1: Phase 0 — inventory identity meanings and bound the cutover

I created `PBUI-IDENTITY-REVISION-1` after completing repository dependency-DAG enforcement. The repository inventory confirms the older assessment’s diagnosis: “revision” and “request ID” name several distinct jobs, but those jobs do not all need shared code.

The current correctness defect is narrow and concrete. Workbench sync computes `Idempotency-Key` from the server revision and protobuf JSON with a 32-bit FNV-style hash. A collision can make two different mutation requests appear to be the same retry. The hard cutover will brand Workbench’s local/server/operation identities and replace that hash with SHA-256 over the full ordered request identity.

### Prompt Context

**User prompt (verbatim):** "continue

[REMINDER] Output a <summary>...</summary> block at the VERY END of your response. This is mandatory."

**Assistant interpretation:** Continue the prioritized repository program with the next planned identity/revision ticket, including the same implementation, diary, commit, print, validation, and delivery discipline.

**Inferred user intent:** Keep executing the remaining PBUI improvements rather than stop after dependency-DAG enforcement.

### What I did

- Created the ticket, intern-guide and diary documents, and seven implementation tasks.
- Printed the overall six-phase plan and `P0 START` slips.
- Added a reproducible repository identity inventory script and JSON output.
- Inspected Workbench core state revisions, sync revisions and request hashing, Datalab remote revision/UUID handling, presentation semantic revisions, Chat content digests/effect IDs/events, analysis generations, and PlotScript tickets.
- Ran the Workbench core baseline: 31 files / 243 tests and typecheck passed.

### Why

- Branding every string in the repository would be excessive universalization.
- The cutover should target identities that cross Workbench transaction and transport boundaries, where interchange creates real bugs.

### What worked

- The inventory found distinct evidence for seven semantic categories.
- No external production consumer imports Workbench core’s current `Revision` alias, so its rename can be a clean hard cutover.
- Modern browser and Node runtimes already provide `crypto.subtle.digest` and `crypto.randomUUID`; no dependency is needed.

### What didn't work

The first inventory-script run failed before scanning:

```text
SyntaxError: Invalid regular expression: ... Unmatched ')'
```

Command:

```bash
node <ticket>/scripts/01-inventory-identity-semantics.mjs . <ticket>/reference/02-identity-semantics-inventory.json
```

I escaped the closing parenthesis in the semantic-revision pattern and reran successfully.

### What I learned

- Presentation’s `string | number` revision is a product-defined semantic invalidation token, not server concurrency state.
- Workbench core’s numeric revision is a monotonic process-local installation generation.
- Workbench sync’s server revision is opaque and equality-compared.
- Datalab remote replacement already mints a UUID once per pending content fingerprint and reuses it on retry.
- Analysis request IDs and PlotScript tickets identify/cancel computations; Chat effect/event IDs correlate durable or auditable facts.

### What was tricky to build

- Grep terms overlap heavily: a fingerprint may be a content equality key, a contract classification key, or a pending-request cache key. The inventory intentionally records evidence by category without asserting that all “fingerprints” share one type.
- Server protocol revisions are generated `uint64`, converted to decimal strings in RTK Query, and converted to `bigint` inside Datalab. Workbench core sync is transport-generic and correctly treats its server revision as opaque string data.

### What warrants a second pair of eyes

- Review the choice to brand only Workbench local revision, server revision, and sync operation ID in version one.
- Review whether SHA-256 request identity should include both immutable outbox-entry UUIDs and canonical mutation JSON. The proposed design includes both.

### What should be done in the future

- Consider separate follow-up tickets for a repository-wide concurrency vocabulary document and for Datalab API brands if misuse appears there.
- Do not unify event IDs, effect IDs, and computation epochs merely because all are currently strings or numbers.

### Code review instructions

- Start at `packages/workbench-core/src/sync/index.ts:41-75` and `:222-230`.
- Compare Datalab’s `useRemoteWorkbench.ts:233-253`, where a UUID is retained with the pending content fingerprint.
- Review `reference/02-identity-semantics-inventory.json` by category.
- Validate the baseline with:

  ```bash
  pnpm --filter @hyperslop-systems/workbench-core typecheck
  pnpm --filter @hyperslop-systems/workbench-core test
  ```

### Technical details

```text
semantic revision: product-defined invalidation token
local revision: monotonic in-process installed-state generation
server revision: opaque optimistic-concurrency precondition
content digest: equality/integrity identity of bytes or canonical JSON
operation ID: identity of one idempotent effect attempt across retries
event ID: identity of a historical fact
computation epoch: ordering/supersession token for async work

Baseline: 31 Workbench core test files / 243 tests
Current sync request key: 32-bit FNV-style hash
Target: SHA-256 over server revision + ordered batch operation IDs + canonical mutations
```

## Step 2: Phase 1 — brand Workbench transaction and transport identities

I added erased, validated `LocalRevision`, `ServerRevision`, and `OperationId` types. Workbench core state, commit receipts, and descriptions now expose local revision explicitly; sync results/status/client callbacks now expose opaque server revisions and operation IDs. The old broad `Revision` alias and sync `requestId` vocabulary were deleted without compatibility aliases.

The brands are intentionally limited to Workbench. Presentation semantic revision and link runtime revision retain their existing types because they obey different laws.

### Prompt Context

**User prompt (verbatim):** (same as Step 1)

**Assistant interpretation:** Continue through the first hard-cutover implementation phase with tests and a focused commit.

**Inferred user intent:** Make accidental identity interchange fail at compile time without creating a universal repository identity framework.

**Commit (code):** `6d14f0f94d1a3438c69ef267abb316e9512594d9` — "Brand Workbench revision and operation identities"

### What I did

- Added identity brands and validated constructors.
- Changed local core state, commit receipts, and descriptions to `LocalRevision`.
- Changed sync API/results/status to `ServerRevision` and `OperationId`.
- Added five constructor and compile-time type tests.
- Updated sync fixtures and the stabilization bootstrap probe.
- Updated the public export snapshot.
- Printed `P0 DONE`, `P1 START`, and `P1 DONE` slips successfully.

### Why

- These three identities cross the same package/API boundary while answering different questions.
- Runtime constructors validate ingress without wrapper allocation.

### What worked

- Typecheck passed after the hard cutover.
- Core suite increased from 243 to 248 tests and passed.
- Repository search found no production consumer requiring a compatibility alias.

### What didn't work

The first full core run correctly failed the public-surface snapshot after five new root exports:

```text
Snapshot `public surface > index, sync, persistence and rebalance entries 1` mismatched
+ "localRevision"
+ "newOperationId"
+ "nextLocalRevision"
+ "operationId"
+ "serverRevision"
```

I reviewed and updated the intentional public API snapshot.

I also mistyped one commit command:

```text
git: 'March?' is not a git command. See 'git --help'.
```

`git add` had completed before the typo; I inspected staged status and then committed normally.

### What I learned

- A brand remains assignable to its primitive for display and numeric publication, while rejecting the reverse direction at API ingress.
- Link runtime revision must not use `LocalRevision`; it can advance without a Workbench document install.

### What was tricky to build

- Test fake servers returned ordinary string literals. The hard cutover required every server boundary to acknowledge opacity explicitly with `serverRevision(...)`, which is the desired friction.
- `WorkbenchObserverError.revision` remains numeric because it may report either core publication or link-runtime publication.

### What warrants a second pair of eyes

- Review the public root exports and the decision to expose constructors from the package root while sync-only request hashing remains under `./sync`.

### What should be done in the future

- Migrate any future sync client at its transport decoding boundary with `serverRevision(...)`; do not cast throughout business logic.

### Code review instructions

- Review `identity.ts` and its tests first, then the type-only changes in core/sync.
- Run `pnpm --filter @hyperslop-systems/workbench-core typecheck && pnpm --filter @hyperslop-systems/workbench-core test`.

### Technical details

```text
LocalRevision: non-negative safe integer
ServerRevision: non-empty opaque string
OperationId: non-empty opaque string
Core result: 32 files / 248 tests
```

## Step 3: Phase 2 — replace the 32-bit request hash

I removed the FNV-style checksum and assigned a UUID operation identity to each queued batch. A concrete transport request now receives `wb-sha256-<64 hex>` derived from length-framed server revision, ordered batch IDs, and canonical protobuf JSON mutations.

The request digest is asynchronous but does not alter batching or conflict behavior. Tests prove stability for identical retry input and distinction across revision, batch identity, mutation content, and batch ordering.

### Prompt Context

**User prompt (verbatim):** (same as Step 1)

**Assistant interpretation:** Replace collision-prone idempotency identity while preserving the established sync state machine.

**Inferred user intent:** Remove a distributed-systems correctness risk with practical tests rather than redesign synchronization.

**Commit (code):** `4f98d7ca1e153f509d61850a1f4b135d8f7eed1e` — "Use collision-resistant Workbench operation IDs"

### What I did

- Added injectable UUID operation-ID generation at enqueue.
- Added length framing and SHA-256 request identity.
- Deleted the FNV offset/prime loop and local `tx-N` counter.
- Added direct identity-law assertions.
- Proved operation IDs are minted once per enqueue and retained through retry.
- Ran typecheck and all 249 core tests.

### Why

- A 32-bit key has an inappropriate collision budget for server idempotency.
- Batch UUID plus exact payload distinguishes logical occurrence from content equality.

### What worked

- SHA-256 output has the expected 64 lowercase hexadecimal digits.
- Same framed request produces the same operation ID.
- Changed base revision, batch UUID, payload, or ordering produces a different operation ID.
- Existing 409, 422, batching, and retry scenarios remain green.

### What didn't work

The first targeted run after adding Web Crypto failed one fake-timer assertion:

```text
expected 'pending' to be 'synced'
Expected: "synced"
Received: "pending"
```

`crypto.subtle.digest` adds an asynchronous step after the retry timer fires. The test now calls `await sync.flush()` after advancing the timer, explicitly awaiting the in-progress retry rather than assuming timer drainage also drains Web Crypto.

The full suite then failed the public-surface snapshot because `syncRequestOperationId` is a new `./sync` export. I reviewed and updated that snapshot.

Thermal printing became unavailable at this phase boundary. Three remote `P2 START` attempts and one local direct attempt timed out; the printer still answered ICMP but its HTTP server did not answer `/`, `/health`, `/api/status`, or bitmap-print requests. The remote service itself remained healthy. A later `P2 DONE` attempt also timed out. No success is claimed for those slips.

### What I learned

- Fake timer completion does not imply completion of Web Crypto promises.
- The printer failure is isolated to the AtomS3R HTTP endpoint, not Almanach rendering or the remote service.

### What was tricky to build

- Length framing uses UTF-8 byte length, not JavaScript UTF-16 code-unit length, so arbitrary revision/JSON text cannot imitate frame boundaries.
- Batch IDs and contents are both included: either alone would leave a semantic hole.

### What warrants a second pair of eyes

- Review the framing order as a versioned wire-identity contract.
- Review whether future sync persistence should serialize outbox UUIDs across page reloads; current outbox is memory-only, as before.

### What should be done in the future

- Resume Phase 3 only after the thermal printer is restarted or its HTTP service recovers, then print the outstanding `P2 START`, `P2 DONE`, and `P3 START` slips as an explicit recovered sequence.
- Consider an in-flight request object only if a probe demonstrates incorrect coalescing after unknown transport outcomes.

### Code review instructions

- Start at `syncRequestOperationId(...)`, then read enqueue and the new first sync test.
- Confirm the old constants are absent:

  ```bash
  rg '2166136261|16777619|requestIdOf|type Revision = string' packages/workbench-core/src
  ```

### Technical details

```text
Batch identity: random UUID, minted once at enqueue
Request identity: wb-sha256- + 64 hex characters
Digest input: version + server revision + ordered batch IDs + canonical mutations
Core result: 32 files / 249 tests
Printer blocker: AtomS3R HTTP endpoint times out while ICMP responds
```
