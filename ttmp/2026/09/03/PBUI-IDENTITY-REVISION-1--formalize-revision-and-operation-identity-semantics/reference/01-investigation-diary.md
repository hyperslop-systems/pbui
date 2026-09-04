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

## Step 4: Phase 3 — migrate consumers and public guidance

The AtomS3R HTTP endpoint recovered. I printed the previously unacknowledged `P2 START` and `P2 DONE` markers as an explicit recovered sequence, then printed `P3 START` before resuming implementation.

Repository search confirmed that no production adapter imports Workbench core sync today. I updated the core and React-shell documentation to make the three identity domains, transport decoding boundary, UUID batch semantics, SHA-256 send identity, and lack of compatibility aliases explicit.

### Prompt Context

**User prompt (verbatim):**

```text
<pi_goal_continuation goal_id="a443d2cc-9bc1-437c-9594-2cc4fe923cc3">
Continue working toward the active thread goal.

Inspect the current objective and status with get_goal (or the exposed namespaced equivalent, such as pi__get_goal) if needed.

Budget:
- Time spent pursuing goal: 8s
- Tokens used: 255K (255,032)
- Token budget: 1M (1,000,000)
- Tokens remaining: 745K (744,968)

Avoid repeating work that is already done. Choose the next concrete action toward the objective.

Before marking the goal complete, audit progress against the objective and call update_goal (or the exposed namespaced equivalent, such as pi__update_goal) with status "complete" only when every requirement is verified.
Call each goal tool by the name exposed in your available tool list. In pi that is usually get_goal, create_goal, and update_goal; in bridged MCP runs it may be a namespaced variant such as pi__get_goal, pi__create_goal, or pi__update_goal. Do not assume display, history, or transcript tool names are callable unless they appear in your tool list.
</pi_goal_continuation>
```

**Assistant interpretation:** Resume the active whole-ticket completion contract at Phase 3 and continue until every implementation, evidence, documentation, printing, validation, and delivery requirement is verified.

**Inferred user intent:** Finish the ticket rather than stopping after the type/hash implementation or reporting a partial result.

**Commit (code):** `82a994a47fa6cd5649f20d797583f961117b9e04` — "Document Workbench identity hard cutover"

### What I did

- Read the active durable goal and remaining ticket tasks.
- Searched every non-generated consumer for `createWorkbenchSync`, `SyncClient`, `Revision`, FNV constants, and `requestId`.
- Added a complete transport-adapter and identity explanation to `packages/workbench-core/README.md`.
- Updated the React shell README and migration guide.
- Reworded the last generic “request id” comment in sync.
- Ran core and React-shell typechecks, tests, and builds.
- Printed `P3 DONE` and `P4 START` after commit.

### Why

- A hard cutover is incomplete if its exported types are correct but examples teach the old mental model.
- The separate Datalab replacement controller and repository correlation IDs must be named as deliberate no-change boundaries rather than accidentally renamed.

### What worked

- No production implementation of `SyncClient` exists outside the core package.
- Core passed 249 tests; the React shell passed 116 tests.
- Both packages typechecked and built.
- The recovered phase slips returned HTTP 200 and `printed: true`.

### What didn't work

- N/A for code and documentation.
- The recovered `P2 START` marker is necessarily retrospective because the printer HTTP service was unavailable at the original phase boundary; the diary preserves that fact rather than pretending otherwise.

### What I learned

- Datalab’s `requestId` is a separate whole-document replacement UUID and is explicitly listed as an expected no-change boundary in the design.
- Root PBUI acceptance `requestId` is an in-memory correlation number, not a distributed idempotency key.

### What was tricky to build

- A broad repository grep produces legitimate `requestId` matches. The review had to follow ownership and call paths rather than performing a blind global rename.

### What warrants a second pair of eyes

- Review the `SyncClient` README example for whether the abbreviated `decodeDocument`/`encodeMutations` placeholders are sufficiently obvious as transport-specific functions.

### What should be done in the future

- Add a real production `SyncClient` only at an application transport boundary and brand the server token at decode time.

### Code review instructions

- Start with the new “Revision and operation identity” section in the core README.
- Compare the no-change statement against Datalab `useRemoteWorkbench.ts` and root presentation acceptance.
- Run the two package gates recorded above.

### Technical details

```text
Production SyncClient consumers outside core: 0
Core tests: 249
React-shell tests: 116
Compatibility aliases: 0
```

## Step 5: Phase 4 — prove the complete identity-law matrix

I extended the existing scenarios so 409 rebase and 422 isolation now assert operation identity, not only document correctness. I also added a fixed UTF-8 framing/SHA-256 golden, primitive JSON round-trip coverage, and malformed runtime-ingress checks.

This phase found a small ingress weakness: the string constructors’ TypeScript signatures were safe for typed callers, but a casted malformed runtime value could pass the old length-only check. The constructors now reject non-string values before branding.

### Prompt Context

**User prompt (verbatim):** (same as Step 4)

**Assistant interpretation:** Prove every law in the ticket rather than relying on indirect existing scenarios.

**Inferred user intent:** Make operation identity behavior reviewable and resistant to regressions across retry and conflict paths.

**Commit (code):** `1f47d3ef735501c353ed0c9cba45b5f17d1a0326` — "Prove Workbench operation identity laws"

### What I did

- Added a stable hash golden containing a non-ASCII batch ID to verify UTF-8 byte framing.
- Asserted that a 409 attempt and its revision-two replay have distinct send IDs.
- Asserted that a combined 422 and its two isolated sends have three distinct IDs.
- Added JSON primitive round-trip coverage for all three brands.
- Added malformed runtime values for server revision and operation ID constructors.
- Ran core typecheck and all tests.

### Why

- Relative “not equal” checks alone do not freeze framing/encoding behavior.
- Existing rebase and isolation tests proved final documents but not the new idempotency contract.

### What worked

- All seven requested identity laws now have direct executable assertions.
- Core passed 32 files and 250 tests.
- The fixed digest is `wb-sha256-d2ce51d8d36a730e10bad3e1cba21763edf2b169446d15dfe9333a30d15a24a2`.

### What didn't work

The first ad-hoc digest probe failed because `tsx -e` emitted CommonJS and rejected top-level await:

```text
ERROR: Top-level await is currently not supported with the "cjs" output format
```

Wrapping it in an async IIFE exposed a second environment mismatch:

```text
Error [ERR_PACKAGE_PATH_NOT_EXPORTED]: No "exports" main defined in .../@hyperslop-systems/workbench-protocol/package.json
```

I did not weaken package exports. I reproduced the exact pure framing input with Node Web Crypto, captured the digest, and asserted it through the normal Vitest package environment.

### What I learned

- Runtime branding constructors need value-kind checks even when their compile-time parameter type is narrow.
- A Unicode golden protects the distinction between UTF-8 byte length and JavaScript code-unit length.

### What was tricky to build

- Rebase keeps batch identity and mutation content but changes the server revision; the test must observe both transport attempts before the fake server applies the second.
- Isolation keeps each constituent batch ID but changes request grouping; the combined and isolated sends must all differ.

### What warrants a second pair of eyes

- Review the fixed golden as a wire-identity compatibility commitment.
- Review whether an empty batch should be rejected by the exported digest helper; the sync enqueue path already refuses empty mutation arrays and never sends one.

### What should be done in the future

- If the framing algorithm changes, increment `pbui-workbench-sync-v1`; do not silently reinterpret existing idempotency keys.

### Code review instructions

- Read the first sync test, then the 409, 422, and retry scenarios.
- Run `pnpm --filter @hyperslop-systems/workbench-core typecheck && pnpm --filter @hyperslop-systems/workbench-core test`.

### Technical details

```text
Identity laws: 7/7
Core test files: 32
Core tests: 250
```

## Step 6: Phase 5 — full validation and release-evidence repair

I ran the full JavaScript/TypeScript package, repository, Storybook, packed-consumer, and Go gates while preserving raw output. All implementation gates passed. The recursive consumer run exposed a pre-existing release-check defect: Datalab’s clean consumer depended on private workspace versions being published and on registry credentials, so it could not validate the current checkout.

I repaired that smoke test to pack every private dependency needed by Datalab and install those tarballs explicitly. The final clean project deliberately ran without `NODE_AUTH_TOKEN`, typechecked, built, and preserved all package-range assertions.

### Prompt Context

**User prompt (verbatim):** (same as Step 4)

**Assistant interpretation:** Validate the entire repository, fix causes of failures, and produce auditable release evidence.

**Inferred user intent:** Do not declare completion based only on focused tests or dismiss a failing consumer check as environmental.

**Commit (code):** `320c75878862a3435d4d7c96aedbb0a391014d9b` — "Make Datalab consumer smoke self-contained"

### What I did

- Ran frozen install, Workbench protocol build, focused core gate and boundary.
- Ran root typecheck, tests, build, Storybook, and packed consumer.
- Ran recursive child typechecks, tests, builds, and consumer smoke scripts.
- Ran Datalab lint, Storybook, and a final credential-free packed consumer.
- Ran Go logcopter generation check, tests, and Glazed lint.
- Captured the complete transcript in `reference/03-full-validation-output.txt`.
- Captured source/declaration cutover searches in `reference/04-hard-cutover-audit.txt`.
- Wrote the concise command and law matrix in `reference/05-validation-summary.md`.

### Why

- The durable goal requires fresh repository-wide evidence and cause-fixing, not a partial package report.
- A packed consumer must test the checkout’s coordinated package set, not whichever private versions happen to exist remotely.

### What worked

- Frozen install passed.
- Core: 32 files / 250 tests; boundary, typecheck, and build passed.
- Root: 51 files / 860 tests; typecheck, build, Storybook, and consumer passed.
- Child packages: 12 typechecks, 12 builds, 10 suites / 1,565 tests passed.
- Datalab credential-free packed consumer passed with React 19.2.8.
- Go checks and tests, including `pkg/workbench` and `pkg/workbenchapi`, passed unchanged.

### What didn't work

The first recursive consumer attempt failed without a token:

```text
npm error 401 Unauthorized - GET https://npm.pkg.github.com/@hyperslop-systems%2fpbui-workbench
```

An authenticated retry proved publication order was the real hidden assumption:

```text
npm error ETARGET No matching version found for @hyperslop-systems/pbui-workbench@^0.6.0
```

After packing the missing workspace packages, Plot remained a private remote dependency and failed under the environment’s package-date cutoff:

```text
npm error ETARGET No matching version found for @hyperslop-systems/plot@0.3.1
```

The final repair packs PBUI, protocol, core, shell, Plot, and Datalab, removes the generated private-registry `.npmrc`, and validates entirely from local tarballs plus public npm dependencies.

My first package-script inventory command also used an unsupported pnpm option placement:

```text
ERROR Unknown options: '1', 'depth'
```

I inspected package scripts through the manifests and CI workflows instead.

### What I learned

- Datalab’s old smoke validated only PBUI and protocol from the checkout; core and shell additions had made it publication-order-dependent.
- The repository Makefile deliberately uses `GOWORK=off`, so the historical parent `go.work` patch-version mismatch does not affect the actual Go CI commands.

### What was tricky to build

- The validation harness initially continued after one recursive failure because it recorded all expensive gates in one pass. I preserved that raw failure, then reran the failed command independently with explicit exit capture until it passed.
- Tarball dependency rewriting must be checked against each workspace package’s own version, not one shared version.

### What warrants a second pair of eyes

- Review the Datalab smoke’s explicit private package list whenever a new private runtime dependency is added.
- Review the raw transcript’s expected build warnings separately from command failures; the concise summary distinguishes them.

### What should be done in the future

- Keep Datalab’s packed-consumer dependency set aligned with its private runtime dependencies, or extract a shared recursive pack helper if a second package needs the same behavior.

### Code review instructions

- Start with `reference/05-validation-summary.md`.
- Inspect `packages/datalab-ui/scripts/consumer-smoke.mjs`, especially tarball creation and rewritten-range assertions.
- Use `reference/03` only for raw output and `reference/04` for no-legacy evidence.

### Technical details

```text
Root tests: 860
Child tests: 1,565
Core tests: 250
Datalab lint: 474 files, one pre-existing warning
Final Datalab consumer: credential-free PASS
Go: logcopter-check + test + glazed-lint PASS
```
