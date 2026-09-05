---
Title: 'Workbench stabilization: transaction safety, headless boundary, and TypeScript-Go parity'
Ticket: PBUI-WORKBENCH-CORE-1
Status: review
Topics:
    - pbui
    - frontend
    - architecture
    - design
    - refactoring
    - onboarding
DocType: design-doc
Intent: long-term
Owners: []
RelatedFiles:
    - Path: repo://package.json
      Note: Pure link-kernel package export target
    - Path: repo://packages/workbench-core/src/apps.ts
      Note: Binding declaration and openBindings replacement target
    - Path: repo://packages/workbench-core/src/createWorkbenchCore.ts
      Note: Transaction prepare/install/publish and owned-state stabilization target
    - Path: repo://packages/workbench-core/src/sources.ts
      Note: Scheduled reconciliation, source ownership, and hydration target
    - Path: repo://packages/workbench-core/src/sync/index.ts
      Note: Bootstrap and acknowledged adoption stabilization target
    - Path: repo://pkg/workbench/model.go
      Note: Go binding-rule parity target
    - Path: repo://ttmp/2026/09/03/PBUI-WORKBENCH-CORE-1--hard-cutover-consolidation-of-the-workbench-into-a-reusable-composable-core/scripts/04-implementation-review-probes.test.ts
      Note: Executable stabilization acceptance evidence
ExternalSources: []
Summary: Implementation-ready stabilization design for making Workbench publication monotonic and exception-safe, completing the React-free package boundary, and defining document binding/source semantics shared by TypeScript and Go.
LastUpdated: 2026-09-03T17:30:00-04:00
WhatFor: Turn the first three post-cutover improvement priorities into a concrete intern-facing implementation plan with invariants, APIs, pseudocode, tests, and migration gates.
WhenToUse: Before changing Workbench execution/publication, observers, document sources, sync adoption, PBUI link-kernel packaging, application binding declarations, or Go catalog validation.
---


# Workbench stabilization: transaction safety, headless boundary, and TypeScript-Go parity

## 0. How to use this guide

PBUI-WORKBENCH-CORE-1 completed the large structural cutover. The Workbench now has a protocol layer, a semantic core, and a React shell. This document does not redesign those layers. It specifies the next stabilization pass over three related priorities:

1. make the Workbench transaction boundary safe under callback failure and reentrancy;
2. make `workbench-core` genuinely React-free in its installed dependency graph;
3. make application binding and document-source semantics agree between TypeScript and Go.

Read the documents in this order:

1. `01-intern-guide-...` for the original domain and ideal/chosen design;
2. `02-version-one-simplification-decisions.md` for first-version scope;
3. `03-post-implementation-architecture-and-code-review.md` for evidence and findings;
4. this document for the implementation program.

The pass remains a hard cutover. Do not restore old Workbench stores, verb names, shadow planning, or compatibility aliases.

## 1. Executive summary

The new architecture is sound, but three boundaries remain weaker than their public descriptions.

First, a core transaction is atomically *computed* but not safely *published*. `install` assigns state, synchronously invokes subscribers, invokes `onCommit`, and later applies link-runtime effects. A subscriber or links callback can throw after state changed. A subscriber can synchronously execute another transaction before the older receipt is published. `connectDocumentSource` does exactly that in a realistic lifecycle and produces receipt revisions `[4, 3]`.

Second, `workbench-core` has no direct React imports, but imports the root `@hyperslop-systems/pbui` entry for the pure link kernel. That root package has React peer dependencies and a React-bearing runtime bundle. The source fence therefore proves less than the package claim.

Third, strict local validation exposed that “document binding” is under-modeled. `openBindings` lets TypeScript accept undeclared bindings, while Go rejects them. `DocumentSource` uses a format as an implicit ownership token, and persisted layouts are validated before sources can hydrate missing stubs. These are not isolated bugs; they are missing semantic contracts.

The target after this pass is:

```text
protocol Mutation[]
       │
       ▼
pure prepare
  plan / apply / validate / stage effects
       │
       ▼
non-reentrant install
  owned immutable core + link runtime values
       │
       ▼
exception-isolated publication
  monotonic receipt → subscribers

@hyperslop-systems/pbui/link-kernel   (no React types/runtime)
       │
       ▼
@hyperslop-systems/workbench-core
       │
       ▼
@hyperslop-systems/pbui-workbench

shared semantic catalog fixtures
       ├── TypeScript WorkbenchAppManifest
       └── Go workbench.ApplicationDescriptor
```

## 2. Scope and non-goals

### 2.1 In scope

- core state ownership and defensive cloning/freezing;
- transaction prepare/install/publish ordering;
- subscriber and post-commit exception isolation;
- explicit reentrancy policy;
- scheduled document-source reconciliation;
- source ownership, collision, update, and hydration semantics;
- sync missing-row bootstrap and target adoption acknowledgement;
- preview ID allocation purity;
- a React-free PBUI link-kernel export and built-artifact fence;
- explicit binding rules and launcher eligibility;
- TypeScript/Go semantic catalog fixtures;
- removal or formal replacement of `openBindings`.

### 2.2 Explicit non-goals

- dependency-specific prepared-plan revisions;
- a generic Workbench plugin/module framework;
- CRDT or collaborative layout editing;
- moving application payload semantics into Workbench core;
- making all PBUI presentation APIs headless;
- generating complete Go and TypeScript application code from one DSL;
- solving Datalab migration here; that has its own ticket.

## 3. Current system primer

### 3.1 Transaction inputs and outputs

A semantic command compiles to a prepared transition:

```ts
interface PreparedTransition {
  commands: readonly WorkbenchCommand[];
  mutations: readonly Mutation[];
  session: WorkbenchSession;
  effects: readonly LocalEffect[];
  changed: boolean;
  placementId?: string;
  viewId?: string;
  workspaceId?: string;
}
```

Durable mutation application is already all-or-nothing. Essential validation runs before installation. The weakness starts after that point.

### 3.2 Current publication order

Observed in `createWorkbenchCore.ts`:

```text
state = next
notify core subscribers synchronously
onCommit(receipt), guarded only around this callback
links.afterCommit(effects), outside the guard
return success
```

Replacement similarly performs:

```text
validate
install + notify
links.afterReplace
return success
```

### 3.3 Current stores

There are several subscribable stores:

- `WorkbenchCoreState`;
- `LinkRuntimeState`;
- shell-local state;
- placement controller state;
- product stores such as Redux.

Each uses a direct loop over a `Set<listener>`. A thrown listener interrupts the loop. A listener may execute arbitrary code, including another core mutation.

### 3.4 Current dependency leak

Core production modules import `@hyperslop-systems/pbui` for:

- port declarations and contracts;
- link verbs and terms;
- type graph;
- show resolution;
- identity/link lifecycle;
- link evaluation and badges.

Those symbols are pure, mostly under `src/presentation/links`, but the package export resolves to PBUI’s root runtime bundle.

### 3.5 Current binding model

TypeScript currently derives document slots from link port declarations:

```ts
port.documentSlot === true
```

Go declares them separately:

```go
type BindingRule struct {
    Required bool
}

type ApplicationDescriptor struct {
    ID               string
    Singleton        bool
    DocumentBindings map[string]BindingRule
}
```

TypeScript added `openBindings`; Go has no equivalent. Launcher logic also treats every app with a document-slot port as impossible to launch without an explicit document, even when the binding is optional context.

## 4. Evidence and release-blocking scenarios

The executable review probe records seven cases. The highest-priority three are:

```text
SUBSCRIBER_ESCAPE
  state revision after throw = 1
  commit receipts = 0

REENTRANT_RECEIPTS
  revision order = [4, 3]
  mutation order = [documentDelete], [placementClose, viewDelete]

CREATE_BOOTSTRAP_DROP
  server create succeeded
  already-included local entry reported as dropped
```

Additional stabilization evidence:

```text
EXPOSED_STATE_MUTATION
  document changed under revision 0

PREVIEW_ID_DRIFT
  preview and immediate execute minted different placement ids

POST_COMMIT_ESCAPE
  links callback threw after revision 1 became visible
```

These cases define acceptance tests. They must be inverted in package tests before the pass is complete.

## 5. Required invariants

### 5.1 Point-of-no-return invariant

After internal state becomes current, no error may make the public operation look uncommitted:

```text
state installed ⇒ execute/apply/replace does not throw or return refusal
```

Observer failures are reported separately.

### 5.2 Monotonic publication invariant

For every receipt observer:

```text
receipt[i].revision < receipt[i+1].revision
```

No nested transaction may publish before the outer transaction finishes publication.

### 5.3 Complete-observer invariant

One observer cannot suppress another:

```text
for every registered observer O:
    attempt O exactly once per matching publication
```

Failures are collected and reported after all attempts.

### 5.4 Snapshot ownership invariant

A document/index pair cannot change under one revision:

```text
same revision ⇒ same semantic document and matching index
```

No public reference may mutate internal state.

### 5.5 Preview purity invariant

Preview may allocate symbolic identifiers internally, but may not consume the executor’s future ID sequence:

```text
execute(command) after preview(command)
≡ execute(command) without the preview
```

apart from concurrent state changes.

### 5.6 Cross-language binding invariant

For a semantic app catalog `A` and document `D`:

```text
TSValidate(D, A).primaryCodePath
== GoValidate(D, A).primaryCodePath
```

for catalog/cardinality/binding fixtures covered by the shared contract.

### 5.7 Package-boundary invariant

A clean consumer can import Workbench core without installing React:

```text
node import("@hyperslop-systems/workbench-core") succeeds
React absent from dependency graph and built runtime imports
```

## 6. Track A — transaction safety and owned state

### 6.1 Separate prepare, install, and publish

Introduce explicit internal stages:

```ts
interface StagedCommit {
  readonly state: WorkbenchCoreState;
  readonly linkState?: LinkRuntimeState;
  readonly receipt?: CommitReceipt;
  readonly result: ExecuteResult;
}
```

Conceptual flow:

```text
prepare(input)
  ├── capture current revision
  ├── plan or apply raw batch
  ├── append lifecycle maintenance
  ├── structurally apply
  ├── validate
  ├── build index/session
  └── reduce link effects into a staged value

install(staged)
  ├── set core state
  └── set link runtime state without notifying

publish(staged)
  ├── emit receipt
  ├── notify link subscribers
  ├── notify core subscribers
  └── report callback failures
```

The exact public object need not expose these stages.

### 6.2 Make observer errors data

Add one reporting hook:

```ts
interface WorkbenchObserverError {
  stage:
    | "commit-receipt"
    | "core-subscriber"
    | "link-subscriber"
    | "replacement-effects";
  revision: number;
  error: unknown;
}

interface CreateWorkbenchCoreOptions {
  onObserverError?(finding: WorkbenchObserverError): void;
}
```

Retire the narrower interpretation of `onPostCommitError`, or keep the name but widen its payload in the hard cutover.

Publication pseudocode:

```text
failures = []

for observer in snapshot(receiptObservers):
    try observer(receipt)
    catch error: failures += finding("commit-receipt", error)

for listener in snapshot(coreListeners):
    try listener()
    catch error: failures += finding("core-subscriber", error)

for finding in failures:
    try onObserverError(finding)
    catch: log last-resort error; continue
```

Never call listeners through a loop that can terminate on the first throw.

### 6.3 Choose a reentrancy rule

Three policies are possible:

1. allow immediate nested transactions;
2. synchronously reject nested mutation;
3. enqueue nested mutation until publication finishes.

Choose **reject internal reentrancy and schedule integrations externally** for version one.

Reasoning:

- queuing a synchronous `execute()` makes its return value dishonest;
- immediate nesting caused the observed receipt inversion;
- rejection catches accidental subscriber mutation immediately;
- intended reactive maintenance can schedule a microtask.

Internal state:

```ts
let phase: "idle" | "preparing" | "publishing" = "idle";
```

At every mutation door:

```text
if phase != idle:
    return {ok:false, code:"reentrant_execution", because:"..."}
```

Set `phase` in `try/finally` so an unexpected prepare exception never wedges the core.

### 6.4 Schedule document-source reconciliation

`connectDocumentSource` must coalesce core/source signals and reconcile after the current publication:

```ts
function connectDocumentSource(core, source) {
  let queued = false;
  let disposed = false;

  function request() {
    if (queued || disposed) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      if (disposed) return;
      const batch = documentSourceMutations(core.getState().document, source);
      if (batch.length) core.apply(batch);
    });
  }

  request();
  const offSource = source.subscribe?.(request);
  const offCore = core.subscribe(request);
  return () => { disposed = true; offSource?.(); offCore(); };
}
```

Required ordering test:

```text
source resource disappears while bound
→ no delete
placement closes
→ receipt N: placementClose + viewDelete
→ microtask
→ receipt N+1: documentDelete
```

### 6.5 Make core-owned snapshots truly owned

At ingress, clone protobuf messages:

```ts
const owned = clone(WorkbenchDocumentSchema, incoming);
```

Ingresses include:

- initial document;
- replacement;
- restored parse result if the parser can return shared values;
- server adoption.

At exposure, choose one of:

- deep-freeze internal values in development and document read-only ownership;
- expose selectors and serialized/cloned snapshots instead of raw state;
- clone on `getState()` (safest, potentially expensive).

Recommended first version:

```text
ingress clone
+ development deep freeze
+ selector-first API
+ no clone on every getState
```

This prevents accidental mutation in development without turning every render into a document clone. Add a production-safe `core.snapshot()` that returns a clone for untrusted integrations.

The structural index contains mutable `Map` values despite a `ReadonlyMap` type. Wrap/freeze maps in development or hide the index behind query methods for untrusted callers.

### 6.6 Stage link runtime state

Refactor `LinkRuntime.apply` and `forgetView` around a pure reducer:

```ts
reduceLinkRuntime(
  previous: LinkRuntimeState,
  effects: readonly LocalEffect[],
): LinkRuntimeState
```

Then core execution can compute both next values before publication:

```text
nextCore = prepareCore(...)
nextLinks = reduceLinkRuntime(currentLinks, effects)
install core + links values
publish observers
```

Do not run application callbacks while reducing.

### 6.7 Fix preview allocation

Do not let `PlanWorld.ids` point directly at a mutable global sequence during preview.

Recommended representation:

```ts
interface PlanIdAllocator {
  next(prefix: string): string;
  fork(): PlanIdAllocator;
}
```

The core holds a factory, not a shared mutable allocator:

```ts
interface CreateWorkbenchCoreOptions {
  createIds?: () => IdGenerator;
}
```

Each plan receives a fresh command-local stream. Execution commits only the plan’s generated ids; preview discards its stream. For random UUID generation, a fresh wrapper is trivial. For deterministic tests, the factory can be seeded by a transaction sequence.

Alternative: preview uses symbolic ids such as `$new-view-1`. This makes previews easier to explain but requires a normalization layer. Prefer command-local allocators first.

### 6.8 Fix known semantic edge cases during stabilization

Add focused fixes from the implementation review:

- same-app replacement must not discard an explicit title;
- description must use one captured index throughout;
- shell focus must not fall back to global `document`;
- shell construction must define whether every manifest requires a presentation;
- expanded `show` refusals must report the top-level command index;
- cheap no-op detection should avoid revision/outbox churn.

These are not separate architecture projects and are safest while transaction tests are being rewritten.

## 7. Track A — sync stabilization

### 7.1 Fix missing-row bootstrap

Current error:

```text
local core already includes outbox Q
create(core.document)
adopt(created.document)
rebase Q over created.document again
```

Correct algorithm:

```text
covered = outbox
outbox = []
snapshot = clone(target.document)
created = await client.create(snapshot)
revision = created.revision
ack covered because snapshot already contains them
candidate = overlay(created.document, outbox entries queued after capture)
require target.replaceDocument(candidate).ok
```

If create fails, restore `covered` before newer entries:

```text
outbox = covered + outbox
```

### 7.2 Make target adoption acknowledged

Change:

```ts
interface SyncTarget {
  replaceDocument(document: WorkbenchDocument): unknown;
}
```

into:

```ts
interface SyncTarget {
  replaceDocument(document: WorkbenchDocument):
    | { ok: true }
    | { ok: false; diagnostics: readonly WorkbenchDiagnostic[] };
}
```

Only advance `revision`, outbox state, and `phase` after target acceptance.

Add a phase:

```ts
type SyncPhase =
  | "local"
  | "probing"
  | "synced"
  | "pending"
  | "offline"
  | "incompatible"
  | "detached";
```

`incompatible` means the server is reachable but the local application catalog cannot accept its document. This is not “offline” and not a retryable transport failure.

### 7.3 Validate rebased candidates through the target

Protocol `applyMutations` proves structural applicability only. Before retaining a rebased entry, either:

- expose a target `prepareBatch(base, mutations)` using core validation; or
- build the candidate structurally, then call a non-installing `validateDocument` supplied by target.

Suggested port:

```ts
interface SyncTarget {
  validateDocument(document: WorkbenchDocument): ValidationResult;
  replaceDocument(document: WorkbenchDocument): ReplaceResult;
}
```

Keep batches whole.

### 7.4 Preserve optimistic overlay during 422 isolation

When several entries are isolated one at a time, adoption of the first response must overlay:

```text
remaining in-flight entries + newly queued entries
```

Otherwise the local state temporarily rolls back operations that are still pending. Track `remaining` explicitly in the isolation loop.

## 8. Track B — complete the headless package boundary

### 8.1 Target package graph

Current:

```text
workbench-core
    └── @hyperslop-systems/pbui root
            └── React-bearing presentation/runtime bundle
```

Target:

```text
@hyperslop-systems/pbui/link-kernel
    pure types, graph, terms, planning, evaluation, lifecycle
             │
             ▼
workbench-core
             │
             ▼
pbui-workbench + @hyperslop-systems/pbui root
```

### 8.2 Add a dedicated PBUI entry

Create an entry such as:

```text
src/link-kernel.ts
```

It re-exports:

- `presentation/links/index.ts`;
- runtime type ids and `PresentationTypeGraph` constructors required by links;
- no action presentation renderer, `ReactNode`, component, context provider, CSS, or browser utility.

Package export:

```json
{
  "./link-kernel": {
    "types": "./dist/link-kernel.d.ts",
    "import": "./dist/link-kernel.js"
  }
}
```

Vite entry:

```ts
entry: {
  index: "src/index.ts",
  "link-kernel": "src/link-kernel.ts",
  vite: "src/vite.ts"
}
```

Change every core import from:

```ts
from "@hyperslop-systems/pbui"
```

to:

```ts
from "@hyperslop-systems/pbui/link-kernel"
```

### 8.3 Keep presentation relations available without React

The link kernel depends on the semantic type graph and relation evaluator. Those abstractions are not React concerns. If their current barrel reaches React types, create a semantic kernel barrel rather than duplicating implementations:

```text
presentation-kernel
  type ids + type graph
  selector/context matching data
  relation declarations/evaluation
  links
```

Do not move UI action rows or render callbacks into the headless entry merely because they share a directory.

### 8.4 Enforce built artifacts

Source regex tests remain useful but insufficient. Add a consumer fixture:

```text
packages/workbench-core/test-consumer-no-react/
  package.json (workbench-core only)
  import.mjs
```

Validation:

```text
pack pbui + workbench-protocol + workbench-core
install into isolated temp project with --ignore-scripts
assert react is absent
node import.mjs
scan core built imports for /react|@hyperslop-systems\/pbui"/
```

Also add a package dependency-DAG test that distinguishes runtime, peer, and dev dependencies.

### 8.5 Update package claims

After the built test passes, retain “No React, no DOM.” Before then, use the narrower phrase “no direct React or DOM source dependency.” Documentation must describe what tests actually prove.

## 9. Track C — shared binding and source semantics

### 9.1 Separate four questions

The current model conflates:

1. Which binding names are legal?
2. Which legal bindings are required?
3. Which document formats may fill a binding?
4. Can the launcher create an unbound view?

Model each explicitly.

### 9.2 Proposed semantic binding declaration

```ts
interface WorkbenchBindingRule {
  readonly required: boolean;
  readonly formats?: readonly string[];
  readonly role?: "primary" | "context";
}

interface WorkbenchAppManifest {
  readonly id: string;
  readonly viewCardinality: "one" | "many";
  readonly duplicatePlacement: "clone" | "link";
  readonly bindings: Readonly<Record<string, WorkbenchBindingRule>>;
  readonly ports?: readonly PortDeclaration[];
  readonly launch: "unbound" | "requires-bindings" | "hidden";
}
```

Port declarations and binding declarations may be compiled together by `defineAppManifest`, but they are not the same fact:

- a document binding may have no link-visible port;
- a document-slot port should normally imply a legal binding;
- an optional context binding does not imply launcher exclusion;
- `launch` is product/application policy, not a server validation rule.

### 9.3 Go counterpart

Extend the existing Go rule rather than inventing a parallel model:

```go
type BindingRule struct {
    Required bool
    Formats  []string
}

type ApplicationDescriptor struct {
    ID               string
    Singleton        bool
    DocumentBindings map[string]BindingRule
}
```

Go does not need `launch`; it validates documents, not UI availability.

If additional bindings are truly required, model them explicitly:

```ts
additionalBindings?: { formats?: readonly string[] }
```

and:

```go
AdditionalBindings *BindingRule
```

Do not retain a boolean that means “accept every typo.”

### 9.4 Resolve the sandbox case

Preferred semantic shape:

```text
AppView.documents
  program → prg-1

sandbox.program payload
  bindings:
    product → 2049
    order   → order-7
```

The Workbench view is a view of one program. Program inputs belong to the program document. They should not become undeclared Workbench view bindings.

If runtime constraints prove this impossible, document why before adopting `additionalBindings`.

### 9.5 Resolve optional contextual bindings

Agentlogic’s transcript binding is legal but optional. Declare it:

```ts
bindings: {
  transcript: {
    required: false,
    formats: ["agentlogic.transcript-ref"],
    role: "context",
  },
},
launch: "unbound"
```

The launcher can offer the app with `{}`. A later policy such as `followTheCrowd` may fill the optional context.

### 9.6 Document-source ownership

Replace format-as-owner with a source identity:

```ts
interface DocumentSource {
  readonly id: string;
  readonly format: string;
  readonly schemaVersion?: number;
  readonly update: "identity-only" | "replace-body";
  list(): readonly SourceDocument[];
  subscribe?(listener: () => void): () => void;
  owns?(payload: DocumentPayload): boolean;
}
```

Every generated stub should carry ownership in a reserved, validator-approved body field or use a source-reserved id namespace. The exact wire representation must be agreed with Go document validators.

Required collision behavior:

```text
same id + owned compatible stub      → update/no-op
same id + different format           → source_collision refusal
same format + different source owner → leave untouched
missing source item + still bound    → retain
missing source item + unbound + owned→ delete
```

### 9.7 Hydrate before strict catalog validation

Persistence boot must be:

```text
parse protobuf shape
→ reconcile configured sources into a clone
→ validate app bindings and source payload formats
→ create core
```

API sketch:

```ts
readWorkbenchSnapshot(key, {
  apps,
  sources,
  migrate,
  onDiscard,
})
```

A structurally valid historical layout missing newly-required stubs should be repaired, not silently replaced by the default layout.

### 9.8 Shared semantic fixtures

Create a language-neutral fixture catalog:

```text
contracts/workbench/v1/catalogs/basic.json
contracts/workbench/v1/catalogs/open-context.json
contracts/workbench/v1/binding-valid/*.json
contracts/workbench/v1/binding-invalid/*.json
```

Fixture expectation:

```json
{
  "name": "optional transcript context",
  "catalog": "open-context",
  "document": { "...": "protobuf JSON" },
  "expected": { "ok": true }
}
```

or:

```json
{
  "expected": {
    "ok": false,
    "code": "unknown_binding",
    "path": "views[\"v1\"].documents[\"typo\"]"
  }
}
```

Both TypeScript and Go load the same catalog and document fixture. Compare stable code/path, not punctuation.

### 9.9 Source payload validation

Every source format used in a server-synchronized Workbench needs a Go document validator branch. A stub is still a `DocumentPayload`; “small” does not make it exempt from host validation.

Inventory current source formats and owner:

```text
sandbox.program
chat.conversation
chat.widget
shop.product
shop.category
shop.metal
shop.order
product-specific transcript/source references
```

Decide which are demo-only and which cross a Go host.

## 10. Decision records

### Decision A — preserve the current package architecture

- **Context:** Stabilization defects appeared after the hard cutover.
- **Options considered:** revert; merge core/shell; repair transaction internals.
- **Decision:** repair the existing protocol → core → shell architecture.
- **Rationale:** pure planning, command normalization, indexing, and shell separation are successful.
- **Consequences:** internal publication changes; no old API restoration.
- **Status:** accepted.

### Decision B — reject synchronous nested mutation during publication

- **Context:** document-source subscriptions reversed receipt order.
- **Options considered:** permit nesting; queue synchronous calls; reject and schedule integrations.
- **Decision:** reject reentrant mutation doors and make source reconciliation microtask-scheduled.
- **Rationale:** synchronous callers require an honest result; delayed hidden execution cannot provide one.
- **Consequences:** integrations must not mutate core directly from listeners.
- **Status:** proposed.

### Decision C — own incoming protobuf values

- **Context:** public references mutate core state under an unchanged revision.
- **Options considered:** trust callers; clone every read; clone ingress and freeze in development.
- **Decision:** clone ingress, freeze in development, add safe snapshots for untrusted consumers.
- **Rationale:** bounded cost and a much stronger gateway invariant.
- **Consequences:** object identity from caller to core is no longer preserved.
- **Status:** proposed.

### Decision D — publish a pure PBUI link-kernel entry

- **Context:** core’s source is clean but its package graph reaches React.
- **Options considered:** accept React peer; duplicate link code; add pure subpath/package.
- **Decision:** add a pure PBUI subpath and enforce it with a packed consumer test.
- **Rationale:** one implementation with an honest package boundary.
- **Consequences:** PBUI gets another build entry, not another semantic implementation.
- **Status:** proposed.

### Decision E — binding rules are not launcher rules

- **Context:** optional context bindings disappeared from launcher, causing `openBindings` workarounds.
- **Options considered:** keep port-derived behavior; keep `openBindings`; separate legal/required/launch facts.
- **Decision:** explicit binding rules plus separate launch policy.
- **Rationale:** matches real products and Go’s validator role.
- **Consequences:** manifest migration and shared fixtures.
- **Status:** proposed.

### Decision F — hydrate recoverable snapshots

- **Context:** strict validation discards old layouts before sources can add stubs.
- **Options considered:** accept one-time loss; weaken validation; hydrate then validate.
- **Decision:** hydrate then validate.
- **Rationale:** preserves validation without avoidable user layout loss.
- **Consequences:** persistence read accepts source definitions.
- **Status:** proposed.

## 11. Implementation phases

### Phase S0 — lock evidence

- Move each review probe into a focused package regression test with the current bad behavior asserted temporarily or marked `fails`.
- Capture current sync/source/persistence API fixtures.
- Record current built dependency graph.
- Inventory every `openBindings` and `DocumentSource` consumer.

Exit gate: every known defect has a reproducible package test.

### Phase S1 — safe observer primitive

- Add shared internal listener publication helper.
- Attempt all listeners, collect errors, report separately.
- Add core execution phase/reentrancy guard.
- Apply the helper to core and link runtime first; shell/placement stores may follow.

Exit gate: callback failure cannot escape after state installation or suppress another observer.

### Phase S2 — staged core/link commit

- Add pure link-runtime reducer.
- Stage core and link values before installation.
- Publish only after both values are current.
- Define receipt/subscriber ordering in README.
- Fix replacement cleanup through the same path.

Exit gate: mixed core/link selectors cannot observe a new durable link program with old staged runtime effects.

### Phase S3 — source and sync ordering

- Schedule/coalesce source reconciliation.
- Fix missing-row bootstrap covered entries.
- Require target adoption acknowledgement.
- Overlay remaining in-flight entries during isolation.
- Add monotonic receipt/outbox integration test.

Exit gate: the close-bound-source scenario reaches a fake Go-like server in valid order.

### Phase S4 — state ownership and planner cleanup

- Clone documents at ingress.
- Add development deep freeze or equivalent invariant guard.
- Add safe `snapshot()` if needed.
- Give preview a non-consuming ID allocator.
- Fix replacement title, description capture, focus scoping, expanded result index, and no-op checks.

Exit gate: all seven review probes are inverted and green.

### Phase S5 — pure PBUI kernel entry

- Add `link-kernel` entry/export.
- Repoint core imports.
- Remove React from core dev/runtime requirements where possible.
- Add packed no-React consumer and built-import scan.
- Update package docs.

Exit gate: core imports in an isolated project with no React installation.

### Phase S6 — binding/source semantic cutover

- Introduce binding rules and launch policy.
- Migrate manifests.
- Remove `openBindings` or replace with typed additional-binding policy.
- Add source identity/ownership/update policy.
- Add persistence hydration.
- Update Go descriptor/validator.
- Add shared fixtures.

Exit gate: TS and Go pass all catalog/binding/source fixtures.

### Phase S7 — product verification

Run:

- PBUI root, protocol, core, and shell tests/typecheck/build;
- chat, sandbox, ecommerce, plotscript;
- agentlogic, turboproof, hyperblog, rag-ttc;
- Go Workbench/workbenchapi and relevant host catalogs;
- browser smokes for source hydration, links, persistence, and sync.

## 12. Test matrix

### 12.1 Publication

```text
subscriber throws                    state committed; result success; others run
onCommit throws                      state committed; subscribers run; error reported
link subscriber throws               core result success; error reported
subscriber calls execute             reentrant_execution; outer receipt first
replacement effect throws            replacement remains applied; error reported
```

### 12.2 Ownership

```text
mutate original initial after create core     no core change
mutate replacement after acceptance           no core change
mutate getState document in dev               immediate frozen-object failure
same revision                                 index/document invariant holds
```

### 12.3 Sources

```text
source initial hydration              one put batch
source signal burst                   one coalesced reconcile
resource removed while bound          retained
view then removed                     outer lifecycle receipt before source delete
id collision/different format         source_collision
other source ownership                untouched
body replace policy                   deterministic update
```

### 12.4 Sync

```text
missing row + queued work              create includes work; no later replay/drop
work queued during create              overlaid then sent once
server document locally incompatible   phase=incompatible; revision not advanced
409 destructive entry                  conflict whole
422 isolation                          no mutation splitting or optimistic rollback
```

### 12.5 Binding parity

```text
known optional binding                 accept TS/Go
missing required binding               required_binding TS/Go
unknown key                            unknown_binding TS/Go
wrong format                           invalid_binding_format TS/Go
missing document                       unknown_document TS/Go
additional binding policy              same decision TS/Go
```

### 12.6 Package boundary

```text
source import scan                     no root PBUI/React imports in core
built import scan                      only link-kernel + protocol externals
packed consumer without React          imports core successfully
worker smoke                           imports and plans command
```

## 13. Migration notes

### 13.1 Application manifests

Before:

```ts
manifest: {
  id: "script",
  ports: [documentSlotPort("program")],
  openBindings: true,
}
```

After:

```ts
manifest: {
  id: "script",
  bindings: {
    program: { required: true, formats: ["sandbox.program"], role: "primary" },
  },
  ports: [documentSlotPort("program")],
  launch: "requires-bindings",
}
```

Program-owned inputs remain in the program payload.

### 13.2 Source boot

Before:

```text
read strict snapshot
→ invalid missing stubs
→ default layout
→ connect sources too late
```

After:

```text
read structural snapshot
→ hydrate sources
→ strict validate
→ construct core
→ connect live source subscriptions
```

### 13.3 Callback integrations

Any integration currently mutating inside `core.subscribe` must switch to:

- receipt handling that does not mutate core; or
- scheduled/coalesced reconciliation.

## 14. Risks and mitigations

### Risk: staged link runtime becomes the ideal unified runtime by accident

Mitigation: add only a pure reducer plus deferred notification. Do not introduce module registries or rich prepared-plan APIs.

### Risk: freezing protobuf messages breaks consumers

Mitigation: clone ingress first, enable deep freeze in tests/development, inventory mutations, then decide production behavior.

### Risk: another PBUI entry complicates packaging

Mitigation: one narrow semantic entry is cheaper than a second link implementation or a false headless claim. Test packed output.

### Risk: binding migration expands into a universal schema system

Mitigation: support name, requiredness, allowed formats, and optional additional-binding policy only. Product payload validation remains host-owned.

### Risk: source ownership metadata leaks into every payload

Mitigation: choose either a reserved source envelope or a strict id namespace once, then keep source handling in one module.

### Risk: TS/Go fixtures become brittle

Mitigation: compare stable code/path and normalized catalog meaning, not full error prose or map iteration order.

## 15. Intern implementation checklist

For each change ask:

- Is this before or after the point of no return?
- Can user callback code run here?
- Can this callback synchronously call a mutation door?
- If it throws, is state already visible?
- Does a receipt still reach persistence/sync?
- Does the core own this object or merely reference caller memory?
- Would TypeScript and Go accept the same document?
- Is this a binding rule, a launch rule, or both?
- Does the built package graph prove the claimed boundary?

Review files in this order:

1. `workbench-core/src/createWorkbenchCore.ts`;
2. `workbench-core/src/links/runtime.ts` and `links/collaborator.ts`;
3. `workbench-core/src/sources.ts`;
4. `workbench-core/src/sync/index.ts`;
5. `workbench-core/src/apps.ts`, `binding.ts`, `validation.ts`;
6. `pkg/workbench/model.go`, `validate.go`;
7. PBUI `presentation/links/index.ts`, root package exports, and Vite entries;
8. product source/binding declarations.

## 16. Completion gates

- [ ] No exception crosses a successful execute/apply/replace after installation.
- [ ] Every observer is attempted independently.
- [ ] Reentrant mutation is deterministically rejected.
- [ ] Receipt revisions are strictly monotonic.
- [ ] Source reconciliation cannot precede its triggering lifecycle receipt.
- [ ] Sync create does not replay or drop covered entries.
- [ ] Sync refuses incompatible server adoption explicitly.
- [ ] Core owns ingress documents and detects external mutation attempts.
- [ ] Preview does not consume execution ids.
- [ ] Core/link state is staged before publication.
- [ ] Built Workbench core imports without React installed.
- [ ] Core imports PBUI only through a pure semantic entry.
- [ ] Binding legality, requiredness, formats, and launch eligibility are separate.
- [ ] `openBindings` is removed or replaced by a cross-language typed rule.
- [ ] Source ownership and hydration are explicit.
- [ ] TypeScript and Go pass shared binding/catalog fixtures.
- [ ] All first-party consumers and browser smokes pass.

## 17. File and API references

- `packages/workbench-core/src/createWorkbenchCore.ts:202-340` — current installation/publication and all mutation doors.
- `packages/workbench-core/src/planner/plan.ts` — pure draft planning/finalization.
- `packages/workbench-core/src/links/runtime.ts` — mutable runtime reducer plus direct notification.
- `packages/workbench-core/src/links/collaborator.ts` — planned effects, maintenance, replacement cleanup.
- `packages/workbench-core/src/sources.ts:67-79` — synchronous source/core subscriptions.
- `packages/workbench-core/src/sync/index.ts:184-330` — adoption, bootstrap, conflict, isolation.
- `packages/workbench-core/src/apps.ts` — manifest and `openBindings`.
- `packages/workbench-core/src/binding.ts` and `validation.ts` — TS binding decisions.
- `packages/workbench-core/src/planner/show.ts` — ID allocation and same-app replacement.
- `packages/workbench-core/src/describe.ts:120-255` — captured-state description.
- `packages/pbui-workbench/src/createWorkbenchShell.tsx` — shell registry, focus, geometry execution.
- `src/presentation/links/index.ts` — existing pure link-kernel barrel.
- `package.json` and `vite.config.ts` — PBUI runtime exports/build entries.
- `pkg/workbench/model.go` and `validate.go` — Go catalog and required/known binding rules.
- `scripts/04-implementation-review-probes.test.ts` — executable evidence to invert.

## 18. Final recommendation

Implement Tracks A, B, and C in that order. Transaction safety is a prerequisite for every source and sync consumer. The package boundary should be completed before Datalab adopts the core. Binding/source semantics must then be shared with Go before Datalab adds another large catalog and remote persistence path.

```text
safe transaction publication
→ true headless dependency boundary
→ shared binding/source semantics
→ Datalab adoption
```

This is stabilization, not a second Workbench rewrite. Preserve the successful core and make its boundaries as strong as its planner.
