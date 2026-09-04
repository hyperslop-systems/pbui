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
