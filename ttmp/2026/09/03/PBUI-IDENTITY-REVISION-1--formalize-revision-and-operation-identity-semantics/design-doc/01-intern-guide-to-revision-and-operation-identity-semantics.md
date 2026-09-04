---
Title: Intern guide to revision and operation identity semantics
Ticket: PBUI-IDENTITY-REVISION-1
Status: review
Topics:
    - architecture
    - pbui
    - workbench
DocType: design-doc
Intent: long-term
Owners: []
RelatedFiles:
    - Path: repo://packages/datalab-ui/scripts/consumer-smoke.mjs
      Note: Credential-free coordinated private-package consumer smoke
    - Path: repo://packages/datalab-ui/src/appkit/useRemoteWorkbench.ts
      Note: Existing pending UUID retained by content fingerprint
    - Path: repo://packages/pbui-chat/src/tools/approvalLedger.ts
      Note: Established SHA-256 Web Crypto pattern
    - Path: repo://packages/pbui-chat/src/tools/workbenchTools.ts
      Note: Uses content revision and local core revision for distinct checks
    - Path: repo://packages/pbui-workbench/MIGRATION.md
      Note: React-shell migration guidance
    - Path: repo://packages/workbench-core/README.md
      Note: Public identity and SyncClient guidance
    - Path: repo://packages/workbench-core/src/createWorkbenchCore.ts
      Note: Owns the process-local installed-state revision
    - Path: repo://packages/workbench-core/src/identity.ts
      Note: Implemented branded identity constructors and UUID minting
    - Path: repo://packages/workbench-core/src/sync/index.ts
      Note: |-
        Owns server revision and current 32-bit idempotency identity
        Implemented batch UUIDs and framed SHA-256 send identity
    - Path: repo://packages/workbench-core/src/sync/sync.test.ts
      Note: |-
        Existing retry conflict isolation and request identity scenarios
        Complete retry, rebase, isolation, ordering, and content identity laws
ExternalSources:
    - /tmp/pbui-improvements.md
Summary: Evidence-backed hard-cutover design for distinguishing Workbench local and server revisions from idempotent operation identity and replacing the sync loop's 32-bit request hash.
LastUpdated: 2026-09-03T22:25:00-04:00
WhatFor: Teach a new engineer PBUI's identity and concurrency vocabulary and provide the exact APIs, hashing contract, phases, and tests for PBUI-IDENTITY-REVISION-1.
WhenToUse: Read before changing Workbench revisions, synchronization retries, idempotency keys, or transport adapters.
---



# Intern guide to revision and operation identity semantics

## 0. Executive summary

PBUI currently uses the word “revision” for at least four different things:

```text
presentation semantic invalidation token     string | number
Workbench local installation generation      number
link runtime generation                      number
server optimistic-concurrency revision       string / bigint / uint64
```

It also uses several kinds of IDs:

```text
sync request ID       server idempotency
accept request ID     correlate one local Promise
analysis request ID   cancel/supersede computation
Chat effect ID        authorize and audit one effect
Chat event ID         identify a historical fact
PlotScript ticket     latest-run-wins epoch
```

These should not become one universal identity framework. Their laws differ.

This ticket makes one bounded correction:

1. Introduce erased branded types for Workbench `LocalRevision`, `ServerRevision`, and `OperationId`.
2. Rename sync’s broad `Revision` and `requestId` APIs to their semantic names.
3. Give every queued mutation batch a UUID `OperationId` at enqueue time.
4. Derive the HTTP idempotency key with SHA-256 over:
   - the server revision;
   - ordered batch operation IDs;
   - every canonical protobuf JSON mutation, with length framing.
5. Preserve all existing batching, conflict, invalid-isolation, replay, and retry behavior.
6. Add laws proving retry stability and distinction between separate logical operations.

No compatibility aliases are proposed. PBUI is alpha and repository search finds no external production consumer of `workbench-core/sync`’s current `Revision` alias.

---

## 1. Why the distinction matters

A type called `string` answers how a value is represented. It does not answer what equality means.

Consider:

```ts
const revision: string = "18";
const requestId: string = "18";
```

TypeScript permits swapping them. The server does not.

- The revision says “apply only if the server is still at state 18.”
- The operation ID says “if you have already processed this logical request, return the prior outcome rather than process it twice.”

Their laws are different:

```text
ServerRevision
  - issued by the server
  - opaque to the sync loop
  - compared for equality
  - changes when server state commits

OperationId
  - issued/derived by the client for one logical attempt
  - stable across transport retry
  - different for different logical attempts
  - does not order state
```

A content digest is different again:

```text
ContentDigest
  - derived from bytes/canonical data
  - equal content implies equal digest (modulo negligible collision risk)
  - says nothing about whether two attempts are one operation
```

Two separate “increment counter” attempts can have identical content. They still require distinct operation IDs.

---

## 2. Taxonomy

### 2.1 Local revision

Workbench core installs a new immutable state and increments a process-local number:

```ts
const revision = state.revision + 1;
state = { document, session, index, revision };
```

Meaning:

> Which committed in-memory Workbench snapshot is this observer looking at?

Laws:

```text
initial = 0
successful install: next = previous + 1
refusal/no-op: unchanged
ordering valid only within one core lifetime
not serialized
not sent as If-Match
```

Target type:

```ts
type LocalRevision = number & { readonly __localRevision: unique symbol };
```

### 2.2 Server revision

The sync server returns an opaque string. Datalab’s concrete protocol happens to encode a `uint64` as a decimal string at the Redux boundary and a `bigint` in its controller. The generic Workbench sync loop must not assume arithmetic.

Meaning:

> What server state must still be current for this mutation request to apply?

Laws:

```text
issued by client.get/create/mutate result
sent back on the next mutate
compared for equality, never incremented locally
not a content digest
```

Target type:

```ts
type ServerRevision = string & { readonly __serverRevision: unique symbol };
```

### 2.3 Operation ID

Meaning:

> Which logical mutation request is this, across delivery retries?

Laws:

```text
same logical request + same base revision => same ID
new local batch => new batch operation ID
changed grouping/base/payload => new request operation ID
collision probability must be cryptographically negligible
```

Target type:

```ts
type OperationId = string & { readonly __operationId: unique symbol };
```

### 2.4 Semantic revision

Presentation snapshots use a product-defined `string | number` token over exactly the facts read by resolution.

Examples:

```ts
revision: facts => facts.currentUserId
revision: facts => facts.locked ? "locked" : "open"
revision: JSON.stringify([conversation IDs, modes, capabilities])
```

Meaning:

> Have the facts relevant to this resolution changed?

It is drift telemetry and re-resolution identity, not optimistic concurrency. This ticket documents it but does not force a Workbench brand onto generic presentation APIs.

### 2.5 Content digest

Examples:

- Chat approval subjects use SHA-256 over canonical JSON.
- Agent workbench tools use a SHA-256 document revision to bind an effect to exact described content.
- Datalab uses a projected-work-stage fingerprint to decide whether local content is dirty.
- Link identity uses a contract fingerprint to partition compatible ports.

These all identify content/classification, but they do not all share canonicalization or security requirements. No shared `ContentDigest` API is introduced here.

### 2.6 Correlation and computation IDs

Accept request counters, analysis UUIDs, Chat event/effect IDs, and PlotScript tickets stay local to their state machines. Branding them globally would add conversions without preventing the Workbench sync defect.

---

## 3. Current Workbench sync pipeline

`packages/workbench-core/src/sync/index.ts` owns a React-free loop:

```text
core commit receipt
      │
      ▼
enqueue whole batch
      │
      ▼
outbox entry
      │ debounce / flush
      ▼
combine ordered batches
      │
      ├── mutate(serverRevision, mutations, requestId)
      │
      ├── 409: fetch + rebase whole batches
      ├── 422: drop or isolate whole batches
      ├── 404: detach
      └── transport: keep + backoff + retry
```

The core properties already established by WORKBENCH-CORE-1 are non-negotiable:

- committed batches remain atomic units;
- optimistic local state never rolls backward while later work is queued;
- server adoption is acknowledged only after local catalog validation;
- destructive rebalance batches conflict after server movement;
- stream refetch waits until outbox/in-flight work is idle.

Identity work must not redesign those semantics.

---

## 4. The current defect

Current request identity:

```ts
const text = `${revision}:${mutations.map(toJsonString).join("|")}:${mutations.length}`;
let hash = 2166136261;
for (...) {
  hash ^= text.charCodeAt(index);
  hash = Math.imul(hash, 16777619);
}
return `wb-${(hash >>> 0).toString(36)}-${mutations.length}`;
```

This is a 32-bit FNV-style checksum.

The birthday bound for a 32-bit space becomes material around:

$$
\sqrt{2^{32}}=2^{16}=65,536
$$

operations. A collision does not need to be adversarial to be possible over a long-lived service.

The failure mode is semantic:

```text
request A and request B differ
H32(A) = H32(B)
server sees same Idempotency-Key
server may return A's cached result for B
```

That can acknowledge a change the server never applied.

A UI cache key may tolerate rare collision. A server idempotency key may not.

---

## 5. Target identity module

Add `packages/workbench-core/src/identity.ts`:

```ts
declare const localRevisionBrand: unique symbol;
declare const serverRevisionBrand: unique symbol;
declare const operationIdBrand: unique symbol;

export type LocalRevision = number & {
  readonly [localRevisionBrand]: "LocalRevision";
};

export type ServerRevision = string & {
  readonly [serverRevisionBrand]: "ServerRevision";
};

export type OperationId = string & {
  readonly [operationIdBrand]: "OperationId";
};

export function localRevision(value: number): LocalRevision;
export function nextLocalRevision(value: LocalRevision): LocalRevision;
export function serverRevision(value: string): ServerRevision;
export function operationId(value: string): OperationId;
export function newOperationId(randomUUID?: () => string): OperationId;
```

Validation:

```text
LocalRevision: safe integer >= 0
ServerRevision: non-empty after no normalization
OperationId: non-empty after no normalization
```

Do not trim the returned server revision. It is opaque. Validation can reject an empty value without changing bytes.

Brands are erased at runtime. Constructors protect ingress and centralize validation; they do not introduce wrapper objects.

---

## 6. Sync API hard cutover

Before:

```ts
export type Revision = string;

interface SyncClient {
  mutate(revision: Revision, mutations: Mutation[], requestId: string): Promise<SyncResult>;
}
```

After:

```ts
interface SyncResult {
  document: WorkbenchDocument;
  revision: ServerRevision;
}

interface SyncClient {
  mutate(
    revision: ServerRevision,
    mutations: Mutation[],
    operationId: OperationId,
  ): Promise<SyncResult>;
}
```

`Revision` is deleted. No alias remains.

`requestId` is renamed `operationId` in:

- `SyncClient` documentation and parameter names;
- fake-server observations;
- sync tests;
- any product adapter that implements this interface.

The HTTP header can remain `Idempotency-Key`; this is transport vocabulary for the same semantic value.

---

## 7. Batch operation identity

Every enqueue creates one immutable outbox entry identity:

```ts
interface OutboxEntry {
  readonly id: OperationId;
  readonly mutations: readonly Mutation[];
  readonly destructive: boolean;
}
```

Creation:

```ts
outbox = [
  ...outbox,
  {
    id: newOperationId(options.operationIds),
    mutations: [...mutations],
    destructive: isDestructive(mutations),
  },
];
```

Add optional injection for deterministic tests:

```ts
interface SyncOptions {
  operationIds?: () => OperationId;
}
```

Default:

```ts
() => newOperationId()
```

A batch’s ID survives:

- debounce;
- transport failure/backoff;
- 409 rebase;
- 422 isolation;
- overlay/adoption bookkeeping.

A rebase may change whether the batch remains applicable, but it does not turn that local logical batch into a different batch.

---

## 8. Request operation identity

One HTTP request may contain several whole batches. Its idempotency identity must include both logical attempt identities and actual payload.

### 8.1 Framed canonical input

Use deterministic length framing rather than separator concatenation:

```ts
function frame(value: string): string {
  return `${new TextEncoder().encode(value).byteLength}:${value}`;
}

canonical = [
  frame(serverRevision),
  frame(batchCount),
  ...batches.flatMap(batch => [
    frame(batch.id),
    frame(batch.mutations.length),
    ...batch.mutations.map(m => frame(toJsonString(MutationSchema, m))),
  ]),
].join("");
```

Length framing means no value can imitate a boundary by containing punctuation.

### 8.2 SHA-256

```ts
const bytes = new TextEncoder().encode(canonical);
const digest = await crypto.subtle.digest("SHA-256", bytes);
return operationId(
  `wb-sha256-${hex(new Uint8Array(digest))}`,
);
```

Properties:

- 256-bit collision resistance;
- deterministic for the same base revision, ordered batches, batch IDs, and mutation bytes;
- different when ordering, grouping, revision, logical batch ID, or content differs;
- no third-party dependency;
- works in target browsers and Node test/runtime versions.

### 8.3 Why include both IDs and contents

If only content is included, two separately intended identical operations at one base revision have the same idempotency identity.

If only UUIDs are included, mutation objects could theoretically be changed after enqueue without changing the key.

Including both states the full contract:

```text
which logical operations + exactly what they send + against which state
```

---

## 9. Retry and conflict semantics

### Transport retry

Same revision, entries, ordering, and payload:

$$
OperationId(request_1)=OperationId(request_2)
$$

The server can safely return the first result if it committed before the connection failed.

### New local operation

Even identical mutation bytes receive a fresh batch UUID:

$$
BatchId(A)\ne BatchId(B)
$$

Therefore request identities differ.

### 409 conflict

A 409 proves the base server revision no longer applies. The loop fetches, rebases, and sends against a new revision:

$$
r_1\ne r_2\Rightarrow RequestId(r_1,Q)\ne RequestId(r_2,Q)
$$

That is a new optimistic attempt, not a transport retry of the stale request.

### 422 isolation

The combined request and each isolated batch have distinct framed batch sets, hence distinct operation IDs. A batch remains atomic.

### Ordering

`[A,B]` differs from `[B,A]` because frames remain ordered. This matters because mutation composition is generally not commutative.

---

## 10. Local revision cutover

Change:

```ts
WorkbenchCoreState.revision: LocalRevision
CommitReceipt.revision: LocalRevision
WorkbenchDescription.revision: LocalRevision
```

Construction and installation:

```ts
revision: localRevision(0)
const revision = nextLocalRevision(state.revision)
```

A `LocalRevision` remains assignable to number for display, serialization-free diagnostics, and observer publication. A bare number is no longer accepted where a core API promises an installed-state generation.

Do not brand link runtime revision as `LocalRevision`. It advances on runtime value writes that may not install a Workbench document. The two counters may numerically coincide and still mean different things.

---

## 11. Files to change

### New

- `packages/workbench-core/src/identity.ts`
- `packages/workbench-core/src/identity.test.ts`

### Core state

- `packages/workbench-core/src/createWorkbenchCore.ts`
- `packages/workbench-core/src/describe.ts`
- `packages/workbench-core/src/index.ts`

### Sync

- `packages/workbench-core/src/sync/index.ts`
- `packages/workbench-core/src/sync/sync.test.ts`

### Documentation

- `packages/workbench-core/README.md`
- this guide and diary.

### Expected no-change boundaries

- protobuf schemas and Go workbench mutation semantics;
- Datalab’s separate remote replacement controller;
- presentation generic semantic revision;
- link runtime counter;
- Chat effect/event identities;
- PlotScript run tickets.

---

## 12. Implementation phases

### Phase 0 — inventory

- Generate identity evidence.
- Trace sync and server revision boundaries.
- Prove baseline typecheck and 243 core tests.
- Record observed versus inferred semantics.

Exit: taxonomy is evidence-backed and cutover scope is bounded.

### Phase 1 — branded Workbench types

- Add identity brands and validated constructors.
- Change core state, commit receipts, and descriptions to `LocalRevision`.
- Rename sync `Revision` to `ServerRevision`.
- Add constructor/type tests.

Exit: bare server revision/local revision interchange fails typechecking.

### Phase 2 — collision-resistant operation IDs

- Assign UUID operation IDs at enqueue.
- Implement framed SHA-256 request identity.
- Rename `requestId` to `operationId` throughout sync.
- Delete FNV code completely.

Exit: no 32-bit request hash remains.

### Phase 3 — consumer migration

- Update fake server and any production `SyncClient` implementation.
- Update README/API examples.
- Search for old `Revision` and sync `requestId` vocabulary.
- Add no-compatibility grep assertions where useful.

Exit: no compatibility alias or stale API consumer remains.

### Phase 4 — laws

Prove:

```text
same request retry             => same operation ID
same bytes, new batch UUID     => different operation ID
changed mutation payload       => different operation ID
changed server revision        => different operation ID
changed batch order            => different operation ID
409 rebase                     => new request identity
422 isolation                  => per-isolated request identity
```

Preserve all existing sync tests.

### Phase 5 — validation and delivery

Run:

```bash
pnpm --filter @hyperslop-systems/workbench-core typecheck
pnpm --filter @hyperslop-systems/workbench-core test
pnpm --filter @hyperslop-systems/workbench-core build
pnpm --filter @hyperslop-systems/workbench-core boundary
pnpm typecheck
pnpm test
pnpm -r typecheck
pnpm -r test
pnpm -r build
```

Then update docmgr, run doctor, dry-run/upload the bundle, and close the ticket.

---

## 13. Test design

### Constructor tests

```ts
expect(localRevision(0)).toBe(0)
expect(() => localRevision(-1)).toThrow()
expect(() => localRevision(1.5)).toThrow()
expect(serverRevision("42")).toBe("42")
expect(() => serverRevision("")).toThrow()
expect(operationId("abc")).toBe("abc")
expect(newOperationId(() => FIXED_UUID)).toBe(FIXED_UUID)
```

### Compile-time brand tests

Use `expectTypeOf`:

```ts
expectTypeOf<LocalRevision>().not.toEqualTypeOf<ServerRevision>()
expectTypeOf<OperationId>().not.toEqualTypeOf<ServerRevision>()
```

Runtime tests do not prove brand separation by themselves.

### Digest tests

Use deterministic IDs and mutations. Assert:

```text
prefix: wb-sha256-
hex length: 64
same input: equal
one changed field: unequal
```

Do not snapshot one digest unless the framing format is intentionally a wire contract. The semantic laws matter more than coupling tests to one encoding.

### Existing scenario tests

Rename fake-server `seen.requestId` to `seen.operationId`, preserve behavior assertions, and extend the current retry test.

---

## 14. Decisions

### D1 — bounded branding

- **Context:** Seven identity categories exist; a universal brand migration would touch unrelated state machines.
- **Options:** Brand nothing; brand every ID; brand Workbench transaction/transport identities.
- **Decision:** Brand `LocalRevision`, `ServerRevision`, and `OperationId` in Workbench core.
- **Rationale:** These cross one API boundary and are currently represented by interchangeable primitives.
- **Consequences:** Other identities remain locally typed and documented.
- **Status:** accepted.

### D2 — hard API cutover

- **Context:** Sync exports `Revision` and names idempotency identity `requestId`.
- **Options:** aliases/deprecations; immediate semantic rename.
- **Decision:** Delete `Revision`; expose `ServerRevision`; rename parameter vocabulary to `operationId`.
- **Rationale:** Alpha repository, no external production consumer found, and aliases preserve ambiguity.
- **Consequences:** Tests and future adapters construct branded ingress values explicitly.
- **Status:** accepted.

### D3 — UUID per local batch

- **Context:** Identical bytes may represent two separately intended operations.
- **Options:** content identity only; monotonic counter; UUID.
- **Decision:** Mint one UUID `OperationId` at enqueue, injectable for tests.
- **Rationale:** It identifies logical occurrence without process-global coordination or collision-prone counters.
- **Consequences:** Outbox entries expose UUIDs rather than `tx-N` labels.
- **Status:** accepted.

### D4 — SHA-256 request identity

- **Context:** One HTTP request can combine multiple operation-bearing batches and needs stable idempotency identity.
- **Options:** random request UUID state machine; 32-bit FNV; SHA-256 over canonical framed request.
- **Decision:** SHA-256 over base revision, ordered batch IDs, and canonical mutation JSON.
- **Rationale:** Minimal code change, deterministic retry behavior, negligible collision probability, no dependency.
- **Consequences:** Request-ID calculation becomes asynchronous.
- **Status:** accepted.

### D5 — preserve batching

- **Context:** Sending one batch per request would make batch UUID equal request ID but change network and isolation behavior.
- **Options:** stop coalescing; retain coalescing with derived request identity.
- **Decision:** Retain ordered multi-batch requests.
- **Rationale:** Identity repair should not redesign proven sync behavior.
- **Consequences:** Batch operation IDs and request operation IDs are distinct levels of identity with the same brand because both are valid idempotent operation identifiers.
- **Status:** accepted.

### D6 — no Go/protobuf change

- **Context:** Server revision is already an explicit generated `uint64`; idempotency key is an HTTP concern outside protocol documents.
- **Options:** add operation ID to protobuf; keep transport header.
- **Decision:** Keep protocol and Go semantics unchanged.
- **Rationale:** The defect is client request-key derivation; protocol payload does not need another durable field.
- **Consequences:** Future server implementations continue reading `Idempotency-Key`.
- **Status:** accepted.

---

## 15. Risks

### Web Crypto availability

PBUI targets modern browsers and Node 20+. Both provide Web Crypto. Tests run under Node 24. If a non-browser runtime adopts sync, it must provide standards-compatible `globalThis.crypto`, which is already implied by UUID generation.

### Mutable protobuf mutation objects

Outbox currently shallow-copies the mutation array, not every protobuf message. Hashing actual payload at send time guarantees key/payload agreement, but caller mutation after enqueue could still change intended semantics. Core-generated commit receipts do not mutate them. Deep ownership can be a separate hardening change if a probe demonstrates bypass.

### Combined retries with newly queued work

Current transport recovery may coalesce previously in-flight and newly queued batches on the next pump. Because the grouping/payload changes, the derived request ID changes. A server that committed the first request will reject the stale base revision and trigger rebase. This ticket preserves that behavior rather than introduce an in-flight request state machine.

### Brand escape

Type assertions can bypass erased brands. Constructors and API signatures prevent accidental interchange, not malicious casting.

### Digest canonicalization

`toJsonString(MutationSchema, mutation)` is deterministic for generated protobuf messages in current Buf runtime. Length framing eliminates separator ambiguity. Shared cross-runtime canonical mutation bytes are not required because this ID is generated and consumed as an opaque HTTP key by the TypeScript client/server boundary.

---

## 16. Alternatives rejected

### Keep FNV because collisions are rare

Rejected. Idempotency correctness is exactly where a 32-bit collision budget is unjustified.

### Random UUID for every HTTP call

Rejected. A transport retry after unknown server outcome must carry the same identity.

### One UUID from mutation contents

Rejected. Separate logical occurrences with identical content need separate identities.

### Send one batch per HTTP request

Rejected for this ticket. It would simplify identity at the cost of changing coalescing and 422 isolation behavior.

### Brand all repository IDs

Rejected. Semantic revisions, event IDs, effect IDs, and computation tickets have different owners and laws.

### Put operation ID in protobuf

Rejected. It is transport/idempotency metadata, not persistent Workbench document semantics.

---

## 17. Review checklist

- [x] `Revision` alias deleted from Workbench sync.
- [x] Sync API says `ServerRevision` and `OperationId`.
- [x] Core state/receipt/description use `LocalRevision`.
- [x] New outbox batches receive UUID operation IDs exactly once.
- [x] FNV constants and 32-bit hash loop are gone.
- [x] Request identity includes base revision, ordered batch IDs, and all mutations.
- [x] Retry identity is stable.
- [x] Different logical identical batches remain distinct.
- [x] 409/422/batching tests remain green.
- [x] No React/DOM enters Workbench core.
- [x] Full validation and packed boundary pass.
- [ ] Ticket doctor and reMarkable upload pass.

---

## 18. File references

- `packages/workbench-core/src/identity.ts` — branded constructors and UUID minting.
- `packages/workbench-core/src/identity.test.ts` — compile-time separation, ingress checks, overflow, and wire round-trip.
- `packages/workbench-core/src/createWorkbenchCore.ts` — local revision lifecycle and commit receipt.
- `packages/workbench-core/src/sync/index.ts` — branded sync API, UUID outbox entries, framed SHA-256 send identity, pump, retry, conflict, and isolation.
- `packages/workbench-core/src/sync/sync.test.ts` — fake server and the complete identity-law matrix.
- `packages/workbench-core/README.md` — public API and transport-adapter guidance.
- `packages/datalab-ui/src/appkit/useRemoteWorkbench.ts:65-75,233-253` — existing UUID retained by content fingerprint.
- `packages/datalab-ui/src/api/workbenchProtocol.ts:10-30` — uint64 revision converted to decimal string for Redux.
- `packages/pbui-chat/src/tools/approvalLedger.ts:56-68` — established SHA-256 Web Crypto pattern.
- `packages/pbui-chat/src/tools/workbenchTools.ts:55,217-244` — content revision versus local core revision used together but differently.
- `src/presentation/actions/types.ts:44-50` — generic presentation semantic revision.
- `packages/pbui-plotscript/src/runner.ts:72,110-122` — latest-run computation ticket.
- `reference/02-identity-semantics-inventory.json` — generated repository evidence.

---

## 19. Final recommendation

Make the Workbench boundary say what each identity means, delete the compatibility vocabulary, and replace the 32-bit hash without redesigning synchronization.

The key principle is:

```text
revision answers “which state?”
operation ID answers “which attempt?”
digest answers “which content?”
epoch answers “which computation wins?”
```

Those concepts should share terminology, not a universal implementation.

---

## 20. Implementation outcome

The hard cutover landed in five reviewable implementation commits:

| Commit | Outcome |
|---|---|
| `6d14f0f` | Brand local revision, server revision, and operation ID; migrate core and sync APIs |
| `4f98d7c` | Replace `tx-N` and the 32-bit FNV-style key with UUID batches and framed SHA-256 |
| `82a994a` | Teach the new boundary in Workbench core and React-shell documentation |
| `1f47d3e` | Complete retry, rebase, isolation, ordering, serialization, and malformed-ingress laws |
| `320c758` | Make the Datalab packed-consumer release check independent of private publication order and credentials |

The implemented framing order is:

```text
frame("pbui-workbench-sync-v1")
frame(serverRevision)
frame(batchCount)
for batch in order:
  frame(batch.operationId)
  frame(mutationCount)
  for mutation in order:
    frame(canonicalProtobufJSON(mutation))
```

`frame(text)` is `<utf8-byte-length>:<text>`. SHA-256 is computed over the UTF-8 encoding of the concatenated frames, and the transport identity is `wb-sha256-<lowercase hex>`. The version frame permits a future coordinated algorithm change without silently sharing an idempotency namespace.

The final focused core result is 32 files and 250 tests. Repository validation additionally passed 860 root tests, 1,565 recursive child tests, all typechecks/builds, static Storybooks, the headless packed boundary, root and Datalab clean-consumer builds, and Go CI parity. See:

- `reference/03-full-validation-output.txt` for raw command output;
- `reference/04-hard-cutover-audit.txt` for source and built-declaration searches;
- `reference/05-validation-summary.md` for the command matrix and failure triage.

No protobuf/Go migration was needed. The Go validator and workbench API tests pass unchanged. Datalab’s whole-document replacement UUID is still a separate request identity, while Workbench core sync now owns its explicitly typed operation identity.
