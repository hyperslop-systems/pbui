---
Title: Post-implementation architecture and code review
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
    - Path: repo://packages/pbui-workbench/src/createWorkbenchShell.tsx
      Note: React-shell boundary and public integration surface
    - Path: repo://packages/workbench-core/src/createWorkbenchCore.ts
      Note: Transaction gateway and publication ordering assessed by the review
    - Path: repo://packages/workbench-core/src/planner/plan.ts
      Note: Pure sequential planning and finalization architecture
    - Path: repo://packages/workbench-core/src/sources.ts
      Note: Document-source model and reproduced reentrant receipt-order defect
    - Path: repo://packages/workbench-core/src/sync/index.ts
      Note: Batch-preserving sync and reproduced bootstrap-create defect
    - Path: repo://pkg/workbench/model.go
      Note: Go application binding contract compared with TypeScript openBindings
    - Path: repo://ttmp/2026/09/03/PBUI-WORKBENCH-CORE-1--hard-cutover-consolidation-of-the-workbench-into-a-reusable-composable-core/scripts/04-implementation-review-probes.test.ts
      Note: Executable evidence for seven review findings
ExternalSources: []
Summary: Evidence-backed review of the implemented Workbench core and React-shell cutover, including an intern-oriented system map, verified strengths, release-blocking correctness findings, remaining architecture gaps, and a phased stabilization plan.
LastUpdated: 2026-09-03T17:00:00-04:00
WhatFor: Explain what PBUI-WORKBENCH-CORE-1 actually built, assess it against the chosen design, and give a new engineer concrete review findings and next steps before release.
WhenToUse: Read before approving, extending, debugging, or releasing workbench-core; before completing external consumer migrations; and before changing transaction publication, document sources, sync, app bindings, or the PBUI link-kernel boundary.
---


# Post-implementation architecture and code review

## 1. Executive summary

PBUI-WORKBENCH-CORE-1 has produced a real architectural cutover, not a folder-only refactor. The old semantic center—`pbui-workbench/src/verbs.ts`, the mixed Workbench store, the shadow planner, imperative link handlers, and the god constructor—has been deleted. In its place, `@hyperslop-systems/workbench-core` owns manifests, policy, validation, indexing, pure command planning, protocol mutation batches, link lifecycle integration, persistence, synchronization, and pure rebalance algorithms. `@hyperslop-systems/pbui-workbench` is now recognizably a React shell over that core.

The strongest parts are the domain decomposition, generalized `view.show`, behavior goldens, explicit link effects, one raw/semantic mutation gateway, structural index, geometry-as-data boundary, rebalance preservation law, and batch-preserving sync representation. The implementation is much easier to explain and test than the system it replaces. The in-repository consumers—chat, sandbox, ecommerce, and plotscript—typecheck, test, and build on the new API.

The implementation is **not yet release-ready**, and the ticket is not complete at the review baseline. Phases 0–7 are checked, the in-repository half of Phase 8 has landed, external consumers are still being migrated, and Phase 9 remains open. More importantly, executable review probes found correctness holes at the new transaction boundary:

1. A throwing core subscriber changes state and then escapes before `onCommit`; the caller sees an exception after the change became visible, and persistence/sync can miss the commit.
2. A throwing links post-commit callback also escapes after durable state was installed.
3. `connectDocumentSource` can execute a nested commit from a core subscriber. It delivered receipts in revision order `[4, 3]`; a sync outbox can therefore queue `documentDelete` before the `viewDelete` that makes it legal.
4. Sync bootstrap against a missing server row creates the current optimistic document and then rebases the already-included outbox over it, falsely reporting the local batch as dropped.
5. `getState()` exposes mutable protobuf messages and mutable `Map` instances. A caller can change the document without the gateway, notification, validation, or revision increment.
6. `preview` consumes the shared ID generator. A preview reported placement `n-00000009-0000`, while immediate execution of the same command created `n-00000012-0000`.
7. Same-app `view.show` replacement drops an explicitly requested title and reports `{ok:true, changed:false}`.

The new document-source facility also exposed a deeper modeling problem. Some products bind host-owned resources that are not Workbench `DocumentPayload`s. Stub documents are a pragmatic bridge, but `openBindings` weakens the explicit manifest contract and has no Go counterpart. Persisted pre-source layouts are rejected before sources can repair them. This area needs a deliberate cross-language decision rather than incremental exceptions.

### Overall assessment

| Area | Assessment |
|---|---|
| Domain model and package direction | Strong |
| Planner decomposition | Strong |
| Behavior preservation | Strong, with deliberate documented differences |
| Transaction publication | Release-blocking defects |
| Link planning purity | Fixed for document/runtime state; incomplete for ID allocation |
| Validation | Good first-version structural validation; known Go parity gaps |
| Document-source model | Useful discovery, immature contract |
| Persistence | Appropriate small adapter; a few resilience edges |
| Sync | Substantially improved batching, but bootstrap/adoption correctness needs work |
| React shell | Much thinner and clearer; several API integrity/scoping gaps remain |
| In-repo migration | Green |
| External migration and release audit | In progress |

The recommendation is to **keep the architecture**, fix the transaction and sync defects before release, revisit binding/source semantics before adding more consumers, finish external migration, and then perform Phase 9 from a clean, stable tree.

## 2. Review scope, baseline, and evidence

### 2.1 Baseline

The review began at PBUI commit:

```text
9eb57f7 PBUI-WORKBENCH-CORE-1 P8: document sources in the package READMEs and the inventory
```

The implemented range from the pre-ticket baseline through Phase 7 was approximately:

```text
168 files changed
12,496 insertions
6,857 deletions
```

Large snapshot files account for much of the addition. Production TypeScript/TSX line counts are more representative:

```text
baseline pbui-workbench production source: 87 files / 11,182 lines
current pbui-workbench production source:  68 files /  5,562 lines
current workbench-core production source:  46 files /  5,997 lines
```

The total implementation is roughly the same size, but semantic code moved below an enforceable package boundary and React code was reduced by about half. This is consolidation by responsibility, not primarily by line deletion.

At the baseline, ticket state was:

```text
Phases 0–7: complete
Phase 8: in-repo consumers complete; external consumers still open
Phase 9: open
```

The external working trees were actively changing during the review. Agentlogic and hyperblog had partial uncommitted migrations; rag-ttc had dependency/lockfile changes but its source still used the old API; turboproof had not yet migrated its Redux adapter. This document assesses the stable PBUI commits and calls out external work only as incomplete migration evidence.

### 2.2 Documents and history read

The review read:

- `design-doc/01-intern-guide-to-the-pbui-workbench-core-consolidation-and-hard-cutover.md` in full;
- `design-doc/02-version-one-simplification-decisions.md` in full;
- `reference/01-investigation-diary.md`, including implementation Steps 6–15;
- `reference/02-consumer-inventory-and-public-surface.md`;
- the Phase 0 historical purity probe and implementation commit sequence;
- source and tests under `workbench-protocol`, `workbench-core`, `pbui-workbench`, and the migrated in-repository consumers;
- the Go Workbench model and validator;
- current adapter code in agentlogic, turboproof, hyperblog, and rag-ttc.

### 2.3 Commands run

Successful checks:

```text
workbench-protocol: typecheck, build, 40/40 tests
pbui-workbench:      typecheck, build, 114/114 tests
pnpm -r typecheck:   all 12 selected workspace projects passed
pbui-chat:           typecheck, build, 241/241 tests
pbui-chat-demo:      typecheck, build, 13/13 tests
pbui-sandbox:        typecheck, build, 224/224 tests
pbui-ecommerce:      typecheck, build, 35/35 tests
pbui-plotscript:     typecheck, build, 32/32 tests
GOWORK=off go test ./pkg/workbench ./pkg/workbenchapi: pass
standalone rebalance performance test: 36.7 ms median, pass
review probes: 7/7 observations reproduced
```

Two full core runs failed only the timing assertion:

```text
slate build median over 12 tiles: 53.6ms; expected < 50ms
slate build median over 12 tiles: 72.4ms; expected < 50ms
```

The same test passed alone at 36.7 ms. This confirms the diary’s flake report and is itself a test-design finding.

`make protocol-check` regenerated protocol outputs without a generated diff, then the workspace Go invocation failed because `go.work` declares `go 1.26` while several modules require patch-specific versions such as `1.26.6`. The installed tool reports `go1.26.0`. Running the two relevant packages with `GOWORK=off` passed. Phase 9 must either normalize the workspace directive/toolchain or document the required invocation.

### 2.4 Executable review evidence

The review added:

```text
scripts/04-implementation-review-probes.test.ts
scripts/04-implementation-review-probes.output.txt
```

The probes intentionally assert the **observed problematic behavior**, so they pass while preserving evidence. They are not proposed production regression tests in their current polarity. Each should become a failing-then-fixed package test during stabilization.

## 3. Intern primer: what the Workbench is

### 3.1 Five identities

A Workbench is not a React component and not just a split tree. It coordinates five durable concepts:

```text
Application manifest
    defines the kind of view and its ports/binding policy

AppView
    one logical application instance, title, and document bindings

Placement
    one leaf in a workspace tree that points to an AppView

Workspace
    one named binary layout tree

DocumentPayload
    an opaque durable resource an application may bind
```

The essential distinction is:

```text
application != view != placement != workspace != document
```

One view can have multiple placements:

```text
workspace A                       workspace B
┌────────────────────┐            ┌────────────────────┐
│ placement p1 ──────┼────┐       │ placement p2 ──────┼────┐
└────────────────────┘    │       └────────────────────┘    │
                          └──────────── view v ──────────────┘
                                         │
                                         ├─ appId: "orders"
                                         └─ documents: { source: "orders-2026" }
```

Closing `p1` must not delete `v` while `p2` remains. Renaming `v` affects both placements. Cloning a placement may create a new view or link the existing view depending on manifest and product policy.

### 3.2 Durable, session, runtime, and shell lifetimes

The implementation now separates four lifetimes:

| Lifetime | Examples | Owner |
|---|---|---|
| Durable | views, workspace trees, app documents, links document | Workbench protocol document |
| Semantic session | selected workspace, active placement | Workbench core |
| Semantic runtime | emitted port values, attended values, contexts, identity cells | links runtime |
| Shell-local | launcher, chooser, relation palette, connect mode, rebalance dialog | React shell store |

This separation is one of the cutover’s main successes. The old `WorkbenchState` mixed all four.

### 3.3 Three package layers

The implemented dependency direction is:

```text
@hyperslop-systems/workbench-protocol
  protobuf types
  primitive structural apply
  primitive mutation builders
             │
             ▼
@hyperslop-systems/workbench-core
  app manifests and policy
  validation and structural index
  pure command planner
  transactional state owner
  links collaborator/runtime
  persistence, sync, rebalance
             │
             ▼
@hyperslop-systems/pbui-workbench
  React app presentations
  DOM measurement
  focus and placement mode
  Surface, Tile, Launcher, Rebalance, link UI
```

The direction is conceptually correct. Section 9 explains why the core’s transitive dependency on the PBUI root means the runtime dependency graph does not yet fully enforce the first arrow.

## 4. Current implementation map

### 4.1 Protocol layer

`packages/workbench-protocol/src/client` remains policy-neutral. It applies `Mutation[]` structurally and builds primitive nodes/mutations. Phase 1 removed the unused configured `createWorkbenchClient`, eliminating a second high-level policy implementation. Builders now accept an `IdGenerator`, which enabled deterministic goldens.

The Go side remains authoritative for complete validation:

```text
pkg/workbench/model.go
pkg/workbench/mutation.go
pkg/workbench/validate.go
pkg/workbench/links.go
```

The TypeScript core intentionally implements essential local checks rather than byte/security/product-payload parity.

### 4.2 Manifests and presentations

The semantic declaration is `WorkbenchAppManifest` in `workbench-core/src/apps.ts`:

```ts
interface WorkbenchAppManifest {
  id: string;
  viewCardinality: "one" | "many";
  duplicatePlacement: "clone" | "link";
  ports?: readonly PortDeclaration[];
  openBindings: boolean;
}
```

The React declaration is `AppPresentation` in `pbui-workbench/src/app.ts`:

```ts
interface AppPresentation {
  id: string;
  title: string;
  tone: string;
  titleFor?(view: AppView): string;
  available?(context: AppAvailability): boolean;
  Component: ComponentType<AppProps>;
}
```

`defineWorkbenchApp({manifest, presentation})` derives both from one id. This is simpler and safer than the old mixed `AppDescriptor`.

### 4.3 Structural index and queries

`workbench-core/src/graph.ts` builds the chosen six maps:

```text
workspaceById
nodeById
workspaceByNodeId
viewByPlacementId
placementsByViewId
viewsByAppId
```

`queries.ts` centralizes less-common scans:

```text
viewsUsingDocument
documentsWithFormat
orphanViewIds
firstPlacementOfView
workspaceOfView
canClose
sameBindings
```

The implementation follows simplification S13 exactly: rebuild the small index after every document identity change; scan document-centric relationships on demand.

### 4.4 Validation

`validation.ts` checks:

- format and schema version;
- workspace/tree shape and count/depth limits;
- global node ids;
- leaf-to-view references;
- view map / `viewOrder` bijection;
- application existence and singleton cardinality;
- declared bindings and referenced document ids;
- document key/id consistency and body presence.

It intentionally does not duplicate Go’s byte limits, UTF-8/text limits, credential-key scan, required-binding rules, or host document validators. Codes and paths mostly follow `pkg/workbench/validate.go`.

### 4.5 Policy and initial bindings

`policy.ts` compiles pane constraints, headless split axis, duplicate behavior, empty-placement behavior, and an initial-document policy. `binding.ts` implements exact requested bindings and `followTheCrowd` over all declared slots.

This removes the old global `source` convention. The later `openBindings` addition is a sign that “declared port slot,” “optional resource narrowing,” and “launcher can open unbound” are still conflated.

### 4.6 Command algebra and planner

`commands.ts` defines semantic commands. The most important normal form is:

```ts
{
  kind: "view.show",
  view: ViewRequest,
  placement: PlacementRequest,
}
```

Identity and space are independent:

```text
resolveView(world, viewRequest)
    ↓
ResolvedView

resolvePlacement(world, placementRequest, resolvedView)
    ↓
ResolvedPlacement

materialize(world, resolvedView, resolvedPlacement)
    ↓
Mutation[] + session patch + result ids
```

`planner/plan.ts` executes a command sequence over local draft values:

```text
for each command:
    plan one fragment
    structurally apply fragment to local draft
    rebuild local index
    patch local session

sweep only newly-created orphans once
append one links-maintenance mutation
return one PreparedTransition
```

Nothing in this loop writes the core or link runtime. That directly fixes the original shadow-planner defect.

### 4.7 Core execution gateway

`createWorkbenchCore.ts` owns:

```ts
interface WorkbenchCoreState {
  document: WorkbenchDocument;
  session: WorkbenchSession;
  index: WorkbenchIndex;
  revision: number;
}
```

Public durable doors are:

```text
execute(command | command[])
apply(raw Mutation[])
replaceDocument(document)
restore(json)
reset(factory?)
```

Command execution is:

```text
capture revision
plan fresh
check coarse revision
apply complete mutation batch
validate resulting document
install document/session/index
notify
emit commit receipt
apply links runtime effects
return small ExecuteResult
```

The shape is right. The ordering and failure isolation inside the final four steps are not yet safe; see CR-01 and CR-02.

### 4.8 Explicit links collaborator

`links/collaborator.ts` is the chosen narrow subsystem instead of a generic plugin API. It owns:

- link command planning as data;
- `pbui.links` document mutation construction;
- view-delete/app-replace/view-clone maintenance;
- link snapshots;
- transient runtime values;
- post-commit effects and replacement cleanup.

The planner can call `plan`, `snapshot`, and `maintenance`; only the core executor calls `afterCommit`/`afterReplace`. This is a good version-one boundary.

### 4.9 Geometry and rebalance

The shell measures DOM into `GeometrySnapshot` in `pbui-workbench/src/geometry.ts`. Core geometry functions consume rectangles, divider widths, and policy values without touching a DOM.

Pure rebalance files moved to `workbench-core/rebalance`. `law.ts` and `law.test.ts` assert:

```text
Map(before placementId → viewId)
    ==
Map(after placementId → viewId)
```

This is the right invariant: rebalance can rearrange but cannot silently add, drop, or retarget a tile.

### 4.10 React shell

`createWorkbenchShell.tsx` joins a `WorkbenchCore` to presentation entries, a shell-local store, placement controller, DOM root, focus helper, description adapter, and bound components.

Components now call:

```text
workbench.execute(command)  // semantic state
workbench.dispatch(action)  // shell-local state
workbench.perform(verb)     // route either kind
```

This is much clearer than `workbench.verbs.*` plus a mixed store.

### 4.11 Persistence and sync

`workbench-core/persistence` stores document plus selected workspace. It subscribes to core state because replacements and session workspace changes are not commit receipts.

`workbench-core/sync` queues:

```ts
interface OutboxEntry {
  id: string;
  mutations: readonly Mutation[];
  destructive: boolean;
}
```

A network request may concatenate several entries, but conflict rebase and 422 isolation operate per complete entry. This corrects the old mutation-level batch splitting.

### 4.12 Document sources

Phase 8 added `DocumentSource`:

```ts
interface DocumentSource {
  format: string;
  schemaVersion?: number;
  list(): readonly { id: string; body?: JsonObject }[];
  subscribe?(listener: () => void): () => void;
}
```

`connectDocumentSource` mirrors host-owned resource identities into `document.documents` as stubs. It solved immediate `unknown_document` refusals in chat, sandbox, and demos. It also introduced a synchronous subscriber/reentrancy defect and raised unresolved ownership/parity questions.

## 5. End-to-end flows

### 5.1 UI or agent command

```text
button / object menu / agent tool
        │
        ▼
WorkbenchCommand
        │
        ├─ shell measures geometry only for relevant kinds
        ▼
core.execute
        │
        ├─ plan(world, commands)
        ├─ apply protocol mutations to a local draft
        ├─ orphan finalization
        ├─ links maintenance
        ├─ essential validation
        ▼
install one core state
        │
        ├─ subscribers
        ├─ onCommit → persistence/sync integration
        └─ links runtime effects
```

The upper two-thirds are good. The publication tail needs one explicit transaction protocol so callbacks cannot reorder or interrupt it.

### 5.2 Raw product batch

```text
product creates Mutation[]
        │
        ▼
core.apply
        ├─ links.maintenance(before, batch)
        ├─ append maintenance mutation
        ├─ apply whole batch
        ├─ validate
        ├─ install once
        └─ forget runtime values for deleted views
```

Door-equivalence tests prove a command close and raw close produce the same committed link maintenance.

### 5.3 Replacement

```text
restore / reset / sync adoption
        │
        ▼
replaceDocument
        ├─ validate incoming document
        ├─ rebuild index
        ├─ repair session
        ├─ install/notify
        └─ links.afterReplace forgets vanished view values
```

`afterReplace` currently runs after notification and is not exception-isolated.

### 5.4 Source reconciliation

Current behavior:

```text
source event OR core notification
        │
        ▼
documentSourceMutations(core.document, source)
        │
        ▼
core.apply(stub puts/deletes)
```

Because core notifications are synchronous, this may call `core.apply` while another `install` is still notifying. The outer commit then resumes and emits an older receipt after the nested receipt.

### 5.5 Server synchronization

```text
core onCommit(receipt)
        │
        ▼
sync.enqueue(receipt.mutations) as one entry
        │
        ▼
mutate(serverRevision, concatenated complete entries, requestId)
        ├─ success: adopt response + overlay newly queued entries
        ├─ 409: fetch, whole-entry rebase; conflict destructive entries
        ├─ 422: drop request or isolate by entry
        └─ transport: retry with stable request content id
```

The representation is sound. Bootstrap-create and replacement rejection need correction before relying on it as a durable outbox.

## 6. What went well

### 6.1 The implementation followed the chosen design rather than the ideal by accident

The code matches the simplification record:

- one coarse core revision;
- fresh `execute`, advisory `preview`;
- one public core constructor;
- one shell-local store;
- one explicit links collaborator;
- essential local validation;
- imported orphans accepted, newly-created orphans cleaned;
- complete sync batches;
- execution-time geometry;
- small app and result APIs;
- six structural index maps plus scans.

This consistency is unusually good for a large cutover.

### 6.2 Behavior was frozen before extraction

Phase 0 captured 44 old command scenarios. Phase 3 replayed 45 through the core. The diary records only three deliberate behavior changes, including activation after replacement. This made the cutover reviewable and prevented “clean architecture” from silently changing user behavior.

The pattern is worth preserving:

```text
old behavior golden
→ new implementation golden
→ normalized snapshot diff
→ explicit decision for every difference
```

### 6.3 `view.show` is the correct semantic center

The old commands repeatedly mixed identity and space. The new model makes those axes explicit and composes them. It handles:

- singleton reuse;
- exact-binding reuse;
- fresh view creation;
- existing-view linking;
- cross-workspace navigation;
- split/replace/auto placement;
- empty-placement filling;
- geometry feasibility.

This is both simpler and more extensible than separate `app.place`, `view.open`, `tile.replace`, and `tile.link` planners.

### 6.4 Planning no longer mutates the live links runtime

The original verified defect was fixed. Link operations return `Mutation` and `LocalEffect` data. The inverted identity probe confirms that preview leaves the document, session, link runtime, and subscribers untouched. ID allocation is the remaining purity caveat, not a recurrence of live runtime writes.

### 6.5 The raw-batch gateway handles links consistently

`gateway.test.ts` compares committed batches for semantic close and raw close. This is better evidence than testing internal method calls. It demonstrates that product-authored document writes no longer bypass link lifecycle maintenance.

### 6.6 Structural indexing is appropriately modest

At current protocol limits, six rebuilt maps are easy to audit and fast. The Phase 9 baseline measured a 12-tile index rebuild at roughly `0.014 ms`. The simplification avoided incremental cache invalidation without falling back to scattered traversals.

### 6.7 Geometry moved to the right side of the boundary

Semantic code no longer queries DOM nodes or CSS. The shell supplies measurements, and headless callers use deterministic fallbacks. The split-specific measurement path avoids measuring every tile during pointer movement.

### 6.8 Rebalance retained its mathematical structure

The implementation moved the algorithms rather than rewriting them. The preservation law adds a semantic guard around powerful whole-tree mutations. This is exactly the “consolidate integration, not distinct algorithms” recommendation from the design.

### 6.9 Sync now respects local transaction boundaries

The outbox’s unit is a committed batch. A 422 isolation can separate entries but never split one entry into mutations. A stale destructive tree replacement conflicts after 409 instead of silently overwriting another layout. This is a meaningful correctness improvement even though sync remains non-collaborative.

### 6.10 The React package is now comprehensible

The shell’s main constructor is 218 lines rather than a constructor plus a 1,407-line semantic verb module and mixed store. Components consume core selectors and dispatch shell actions. The READMEs explain the dependency direction and normal command API.

### 6.11 In-repository migrations exercised real integration cases

Migration exposed host-owned bindings, optional contextual binding, agent policy mapping, strict replacement validation, and source lifetimes. These are valuable findings that unit tests over synthetic apps would not have produced.

## 7. Design completion assessment

| Chosen completion gate | Current evidence | Status |
|---|---|---|
| Core has no React/DOM source imports | Fence passes; core production sources contain no direct React/DOM imports | Partial: PBUI root dependency is transitively React-bearing |
| Planning/preview is pure | Document/session/link runtime unchanged in tests | Partial: shared ID stream advances |
| Fresh execute + coarse revision | Implemented in `createWorkbenchCore.ts` | Met |
| One durable gateway | Commands/raw/replacement use core paths | Partial: state references are mutable; publication reentrancy breaks ordering |
| Atomic batches + explicit effects | Planner and sync preserve batches; effects are data | Met in planning; publication not atomically observable |
| Small structured result | Implemented | Met, but documented “never throws” is false |
| Manifest/presentation split | Implemented | Met, with one-way shell registry validation |
| Slot-aware initial binding | Implemented | Met for declared slots; `openBindings` is an unresolved exception |
| Six-map structural index | Implemented/rebuilt | Met |
| On-demand document queries | Implemented | Met |
| No newly-created accidental orphans | Central finalization + goldens | Met for semantic commands |
| Generalized `view.show` | Implemented as resolve/resolve/materialize | Met, with edge-case bugs |
| Explicit links collaborator | Implemented | Met |
| Geometry as execution data | Implemented | Met |
| Rebalance mapping law | Implemented/property-tested | Met |
| Essential validation | Implemented | Met; Go parity intentionally incomplete |
| Batch-preserving sync | Implemented | Partial: bootstrap/adoption defects |
| Destructive stale batches conflict | Implemented on 409 | Partial: other adoption paths do not carry the same policy |
| Legacy APIs deleted | Deleted in PBUI and migrated in-repo | Incomplete externally |
| Small/documented exports | READMEs and subpaths exist | Mostly met; root shell remains broad |
| All consumers green | In-repo green | Incomplete externally |
| Browser smokes | No review evidence yet | Open |

## 8. Prioritized review findings

Severity vocabulary:

- **P0 / release blocker:** can lose, reorder, duplicate, or leave durable work unsynchronized; fix before release.
- **P1 / high:** violates a principal architecture contract or cross-language behavior; fix before broad adoption.
- **P2 / medium:** incorrect edge behavior, misleading API, or maintainability problem; schedule in stabilization.
- **P3 / low:** polish, performance methodology, or documentation drift.

### CR-01 — P0: publication is not exception-safe after state installation

**Evidence.** `createWorkbenchCore.ts:202-223` assigns the new state and calls `notify()` before invoking the guarded `onCommit`. `notify()` calls each subscriber without isolation. `links.afterCommit` at line 298 and line 326, and `links.afterReplace` at line 232, are outside the `onPostCommitError` guard.

The review probe produced:

```text
SUBSCRIBER_ESCAPE {"revisionAfterThrow":1,"commitReceipts":0}
POST_COMMIT_ESCAPE {"revisionAfterThrow":1}
```

**Why it matters.** The state is already changed. The caller receives a thrown exception and may retry. Persistence and sync may never receive the commit receipt. One subscriber prevents later subscribers. A link-runtime listener can make a successful durable command appear to fail.

The package migration guide currently says:

```text
execute ... never throws
```

That contract is false.

**Required correction.** Treat all work after state assignment as post-commit publication and isolate every observer. Internal collaborator errors need their own reporting path. No exception may cross `execute`, `apply`, or successful replacement after state becomes visible.

Suggested contract:

```ts
interface CoreObserverError {
  stage: "link-effects" | "commit-receipt" | "state-subscriber" | "replacement-effects";
  error: unknown;
  revision: number;
}
```

Suggested pseudocode:

```text
state = next                         // point of no return
apply internal effects safely       // collect errors, continue
emit commit receipt safely          // collect errors, continue
notify each subscriber safely       // one bad subscriber cannot stop another
report collected observer errors    // never throw through the command
return success
```

A stronger future design stages core and runtime state and publishes both after both reducers succeed.

### CR-02 — P0: synchronous document-source reconciliation reorders commits

**Evidence.** `connectDocumentSource` subscribes `sync` directly to `core.subscribe` (`sources.ts:67-75`). Core notification occurs in the middle of `install`, before the outer `onCommit` receipt. If source reconciliation calls `core.apply`, the nested transaction completes before the outer receipt.

The review scenario removed a source resource while a view still bound it, then closed the view. The connector correctly waited until the binding disappeared—but committed during the close notification:

```text
REENTRANT_RECEIPTS
[
  {"revision":4,"cases":["documentDelete"]},
  {"revision":3,"cases":["placementClose","viewDelete"]}
]
```

**Why it matters.** Wiring `onCommit` to sync queues revision 4’s `documentDelete` before revision 3’s `viewDelete`. On the server, the first batch may be rejected as `document_in_use`. Persistence can save an older receipt after a newer state. This is not merely a cosmetic revision ordering issue.

**Required correction.** Do not call core mutation methods synchronously from a core subscriber.

Small version-one fix:

```text
on core/source signal:
    if not scheduled:
        scheduled = true
        queueMicrotask:
            scheduled = false
            reconcile latest core snapshot and latest source snapshot
```

Core should also reject or queue reentrant execution while publishing. Add a package test asserting receipts are monotonic and server-applicable.

Longer-term option: source reconciliation becomes a pre-install collaborator that contributes stub maintenance to the same outer batch. That gives stronger atomicity but should not be generalized until source ownership semantics are settled.

### CR-03 — P0: sync bootstrap-create double-processes queued local work

**Evidence.** `bootstrap()` calls `client.create(target.getState().document)` and then `adopt(result)` (`sync/index.ts:247-255`). The target document already contains every queued optimistic batch. `adopt` rebases the same `outbox` over the created document.

The probe produced:

```text
CREATE_BOOTSTRAP_DROP
{"droppedCalls":1,"status":{"phase":"synced","revision":"created","queued":0,"inFlight":0}}
```

The local duplicate was included in the created document, then its batch was classified as a rebase drop because its ids already existed.

**Why it matters.** Products can display a false “your change was dropped” warning on first synchronization. Idempotent batches may instead be sent again. The outbox’s relationship to the full snapshot used for create is undefined.

**Required correction.** Snapshot which entries are covered by create:

```text
covered = outbox
outbox = []
snapshot = target.document
result = await create(snapshot)
revision = result.revision
ack covered without replay or drop
rebase only entries queued after snapshot capture over result.document
replace target with result + newer entries
```

Add tests for:

- queued create-view/split before attach to an absent row;
- another local commit while `create` is in flight;
- no `onDropped` for changes included in the create snapshot;
- no redundant `mutate` request after successful create.

### CR-04 — P0/P1: exposed mutable state bypasses the “one gateway” invariant

**Evidence.** `getState()` returns the internal `WorkbenchCoreState`. Protobuf messages, arrays, records, and JavaScript `Map`s are mutable at runtime even when typed `readonly`/`ReadonlyMap`. `initial` and replacement documents are installed by reference.

The probe performed:

```ts
core.getState().document.name = "mutated outside the gateway";
```

and observed:

```text
EXPOSED_STATE_MUTATION
{"name":"mutated outside the gateway","revision":0}
```

No validation, index rebuild, subscriber notification, revision, link maintenance, persistence, or sync receipt occurred.

**Why it matters.** The new architecture claims every durable change crosses one gateway, but the public state object is another writable door. Mutation also invalidates the document-identity link snapshot cache and may make the index disagree with the document.

**Required correction.** Choose and document an ownership strategy:

1. Clone incoming documents at construction/replacement and deep-freeze owned snapshots in development.
2. Do not expose mutable internal protobuf messages as a general state API; provide selectors/snapshots, or return defensive clones where mutation risk outweighs cost.
3. Ensure receipts and sync entries cannot be mutated after enqueue.
4. Add a development assertion that the document/index pair has not changed under the same revision.

At minimum:

```text
ownedInitial = clone(WorkbenchDocumentSchema, options.initial)
ownedReplacement = clone(WorkbenchDocumentSchema, incoming)
state = deepFreezeInDev({ document, index, session, revision })
```

The 2 MiB server limit bounds worst-case clone cost; measure before optimizing away ownership.

### CR-05 — P1: the headless package is source-clean but transitively React-bearing

**Evidence.** The fence scans only `workbench-core/src` import text. Production modules import the root `@hyperslop-systems/pbui` package for link-kernel declarations and operations. Built `workbench-core/dist/index.js` retains that external root import. PBUI’s runtime root includes React-bearing presentation modules. React is a `devDependency` of workbench-core so node tests can load the graph.

Direct imports include:

```text
apps.ts
commands.ts
describe.ts
planner/links.ts
links/collaborator.ts
links/document.ts
links/snapshot.ts
```

**Why it matters.** “No React, no DOM” currently means no direct source import and no DOM access, not a React-free installed dependency graph. Workers/server-side tools still resolve the PBUI root and need its peer/runtime graph. The package description overstates the boundary.

**Required correction.** Publish the link/presentation kernel under a React-free PBUI subpath or package, for example:

```text
@hyperslop-systems/pbui/link-kernel
```

Move/export only:

- port declarations and refinement;
- link verbs and planner;
- serializable references;
- identity/link state transforms;
- type graph and show resolution;
- badge facts if they remain headless.

Then add a dependency-graph test over built artifacts, not only a source regex:

```text
bundle/import workbench-core in a project with no react dependency
assert module load succeeds
assert built imports do not reference pbui root or react
```

Until then, describe the package as “React-independent source API” rather than completely React-free.

### CR-06 — P1: `openBindings` is a cross-language and conceptual escape hatch

**Evidence.** TypeScript skips `unknown_binding` when `manifest.openBindings` is true (`binding.ts:92`, `validation.ts:130`). Go’s `ApplicationDescriptor` has only explicit `DocumentBindings`; `validate.go` rejects every undeclared key. The diary explicitly records this mismatch.

The flag emerged from two different needs:

1. Sandbox programs define their own resource bindings.
2. Agentlogic accepts an optional transcript binding but wants the app available in the launcher even when no transcript is selected.

These are not the same semantic problem.

**Why it matters.** `openBindings` weakens typo detection and makes TypeScript accept documents a validating Go host rejects. It also hides a launcher-model issue: `launcherRows.ts` excludes every manifest with a document-slot port, treating “can bind a document” as “cannot be created without one.” Optional contextual binding and launcher eligibility should be separate.

**Recommended model.** Replace the boolean with explicit binding rules shared with Go:

```ts
interface BindingRule {
  required: boolean;
  formats?: readonly string[];
  role?: "primary" | "context" | "program-owned";
}

interface WorkbenchAppManifest {
  bindings: Readonly<Record<string, BindingRule>>;
  launch: "unbound" | "requires-request" | "hidden";
}
```

For the script app, prefer keeping program-owned bindings in the program document rather than copying arbitrary keys into `AppView.documents`:

```text
script view.documents = { program: "prg-1" }
program document body  = { bindings: { product: "2049", ... } }
```

If arbitrary additional bindings are genuinely required, add an explicit `additionalBindings` rule and mirror it in Go. Do not ship a TS-only bypass.

### CR-07 — P1: document sources need ownership, hydration, and migration semantics

**Evidence.** `documentSourceMutations` treats `format` as the ownership boundary. It creates only missing ids, never refreshes a body, and deletes any unbound document of that format absent from `source.list`. Existing same-id documents of another format are silently treated as present. `readWorkbenchSnapshot({apps})` validates before sources connect, so a legacy layout with bindings and no stubs is discarded.

The diary records the current behavior as a one-time fallback to the default layout.

**Risks.**

- Two source instances with one format can delete each other’s stubs.
- A source can delete a product-authored document sharing its format.
- A resource id collision with another format is not diagnosed.
- Stub metadata such as program title is stale after creation.
- Every stub becomes durable/synchronized payload, increasing document count and requiring server document validators.
- Existing user layout can be lost before repair.

**Required correction.** Specify source identity and hydration:

```ts
interface DocumentSource {
  id: string;                    // owner identity
  format: string;
  owns(payload): boolean;        // or reserved id namespace/marker
  list(): ResourceStub[];
  update: "identity-only" | "replace-body";
}
```

Provide a pre-construction repair path:

```text
read raw persisted document
→ parse structurally without app binding validation
→ reconcile configured sources into a local clone
→ validate against app catalog
→ construct core
```

Hard cutover does not require silently discarding structurally recoverable layouts.

### CR-08 — P1: sync ignores replacement refusal and rebases without core validation

**Evidence.** `SyncTarget.replaceDocument` returns `unknown`; every call in `adopt` and conflict handling ignores the result (`sync/index.ts:184-193`, around line 315). `rebase` uses protocol `applyMutations` only, not essential catalog validation.

**Failure mode.** A server document can be structurally parseable but locally invalid because an app was retired or a binding is unknown. Sync advances its server revision and phase while the core refuses replacement and keeps the old state. A structurally applicable queued batch can produce a catalog-invalid overlay, also silently rejected by the target.

**Required correction.** Make adoption acknowledgement explicit:

```ts
type ReplaceAcceptance =
  | { ok: true }
  | { ok: false; diagnostics: readonly WorkbenchDiagnostic[] };

interface SyncTarget {
  replaceDocument(document: WorkbenchDocument): ReplaceAcceptance;
  preflight?(base: WorkbenchDocument, batch: readonly Mutation[]): ReplaceAcceptance;
}
```

Do not advance to `synced` when adoption failed. Surface an `incompatible`/`refused` phase with diagnostics and preserve exportable local state.

### CR-09 — P1: core and link runtime are not atomically observable

**Evidence.** Command execution installs and notifies core state before `links.afterCommit`. A core subscriber can read the new links document with old runtime cells. Then runtime subscribers receive a second notification. Replacement similarly publishes before `afterReplace` cleanup.

**Why it matters.** The chosen design deferred the ideal “one runtime snapshot,” but it retained explicit effects and one execution gateway. Consumers can still observe an intermediate combination at the gateway boundary.

**Improvement.** Add transaction-aware publication even if stores remain separate:

```text
reduce next core state
reduce next link-runtime state without notifying
install both
publish runtime/core notifications after both values are current
emit receipt
```

If staging the PBUI link runtime is too large for version one, document the weaker consistency contract and ensure selectors do not combine the stores during commit.

### CR-10 — P2: preview mutates ID allocation state

**Evidence.** `PlanWorld` receives the core’s shared `IdGenerator`; `resolveView`, `splitBeside`, workspace creation, cloning, and link planning call it. Preview and refused plans consume ids.

Observed:

```text
PREVIEW_ID_DRIFT
{"previewPlacementId":"n-00000009-0000","executePlacementId":"n-00000012-0000"}
```

**Why it matters.** Preview is not fully pure, deterministic explanations contain ids that acceptance will not create, and tests/replay depend on whether someone previewed first. With random UUIDs this is less visible but the semantic mismatch remains.

**Improvement options.**

1. Give planning a forkable command-local allocator seeded by core revision/command nonce.
2. Treat preview ids as explicit placeholders and omit them from public preview.
3. Capture generated ids into a private plan only during `execute`; preview uses symbolic ids.

Do not reuse a public preview as a commit handle; that simplification remains correct.

### CR-11 — P2: same-app replacement drops an explicit title

**Evidence.** `materialize` in `planner/show.ts` returns unchanged when the current app id equals the requested app and no documents were supplied. It does not consider `view.title`.

Observed:

```text
DROPPED_REPLACE_TITLE
{"ok":true,"changed":false,...}
```

The existing title remained undefined.

**Correction.** The no-op predicate must include every requested field:

```text
same app
AND no documents requested
AND no title requested
    => unchanged
```

If title is requested, emit `viewConfigure` on the existing owned view. Add a matrix for same/different app × documents absent/present × title absent/present × linked/single placement.

### CR-12 — P2: description is not strictly one captured snapshot

**Evidence.** `describeWorkbench` captures `state` once and comments that this prevents mixed descriptions. `describeTile`, however, calls `core.getState().index` again at `describe.ts:253` to compute placement count.

**Why it matters.** Most calls are synchronous, but presentation callbacks (`titleFor`) and link labels are user code and can re-enter the core. A description can contain the old tree and new placement counts.

**Correction.** Pass the captured `state.index` into `describeTile`; never call `getState()` below the top-level snapshot capture.

### CR-13 — P2: shell catalog validation is one-directional

**Evidence.** `createWorkbenchShell` rejects a presentation with no manifest, but does not reject a core manifest with no presentation.

**Why it matters.** A headless-only app is legitimate for a core, but once a shell renders a document containing it, Tile has no component. The constructor should either require a complete presentation for every app reachable from the current document or make headless-only manifests explicit.

**Correction.** Choose one contract:

```text
strict shell: every core manifest needs a presentation
or
partial shell: caller provides renderMissingApplication and launcher excludes it
```

Do not silently accept an unrenderable registered application.

### CR-14 — P2: focus falls back outside the shell root

**Evidence.** `focusPlacement` queries `(rootElement ?? globalThis.document)`. If the shell root is not mounted, duplicate placement ids in another Workbench can receive focus.

**Correction.** Keep focus scoped. If no root exists, do nothing or return a structured `false`. The original architecture explicitly supported multiple Workbenches.

### CR-15 — P2: external state-host integration remains unresolved

**Evidence.** The new core always owns an internal document/session/index snapshot. The old turboproof adapter made Redux the sole Workbench source of truth, and several product components/selectors read that slice. The implemented `createWorkbenchCore` has no transactional host port.

**Why it matters.** Phase 8 cannot mechanically replace turboproof’s `WorkbenchStore`. Either Workbench becomes the source of truth and product selectors migrate, or the core needs an external state port. Creating a mirrored Redux copy recreates the exact dual-source problem the old adapter avoided.

**Decision required before finishing turboproof.**

- **Option A:** Core owns Workbench state; remove durable Workbench document from Redux and adapt consumers to core selectors/receipts.
- **Option B:** Add one carefully specified transactional `WorkbenchStatePort` to core.
- **Reject:** Keep both and synchronize subscriptions in both directions.

Option A is simpler if migration scope is acceptable. Option B is justified only if Redux ownership is a product invariant beyond convenience.

### CR-16 — P2: expanded link-show errors lose top-level command indexing

**Evidence.** `planShowValue` expands one top-level `show` into `view.show` plus a link command. Recursive `run(inner, base+i)` reports indices and inner commands from the expansion. In a larger input batch, indices can overlap later top-level commands.

**Why it matters.** `ExecuteResult.index` is documented as the refused command’s position in the caller’s batch. Agent tools use it to report which request failed.

**Correction.** Track a command path:

```ts
{ topLevelIndex: number; expansionIndex?: number; originalCommand; effectiveCommand }
```

The small public result may expose only `topLevelIndex` and the original command.

### CR-17 — P3: no-op detection is inconsistent

`view.configure`, workspace rename, resize, and several replacements emit mutations even when values are unchanged. `changed` therefore sometimes means “a mutation was emitted,” not “observable semantics changed.” This increases revisions, persistence writes, sync entries, and agent revision churn.

Add semantic equality checks where cheap. Document the result contract precisely.

### CR-18 — P3: wall-clock performance assertion is flaky

The full core suite failed at 53.6 ms and 72.4 ms; the isolated test passed at 36.7 ms. A correctness suite should not fail from shared-machine load.

Keep the Phase 9 benchmark artifact, but either:

- run the performance guard in a dedicated benchmark job with controlled workers and a statistical budget;
- use a much wider smoke threshold in ordinary unit CI;
- or record without asserting and evaluate regressions against historical baselines.

### CR-19 — P3: public surfaces are improved but still broad

The core root has 34 export statements and the shell root 45. The shell still exports low-level components in addition to bound components. This may be intentional for product composition, but Phase 9 should classify each symbol as supported API, subpath API, or internal. The migration inventory’s target map should be updated to the actual export map.

## 9. What implementation exposed as needing design work

### 9.1 “Document binding” has more than one meaning

Before strict validation, applications could put any id under `view.documents`. Migration revealed at least three meanings:

```text
primary document
    the view is fundamentally a viewer/editor of this payload

optional context document
    the app exists independently; the binding narrows its world

program-owned resource binding
    the app binds one program; the program itself names product/order inputs
```

One `documentSlot` boolean plus launcher inference cannot represent all three. `openBindings` is evidence of this missing vocabulary.

### 9.2 Resource identity and resource storage are separate

The Workbench needs durable ids to validate and synchronize bindings, while product registries remain authoritative for full objects. Stub documents bridge that split. The bridge needs explicit ownership, migration, format validation, and update semantics.

### 9.3 Synchronous subscriptions are part of the transaction model

A store is not “atomic” merely because state assignment is one line. Callback order, callback exceptions, and reentrant writes determine what persistence, sync, React, and extensions observe. The implementation made this latent concern executable.

### 9.4 Browser/server catalog parity cannot remain informal

`viewCardinality`, binding declarations, requiredness, and `openBindings` affect whether a document is accepted. They need fixtures or a shared/generated semantic manifest. The original decision to defer generated catalogs was reasonable; Phase 8 now provides concrete evidence that parity fixtures are no longer optional for release.

### 9.5 External state ownership is an architecture decision

The internal core is ideal for most products, but turboproof’s Redux integration proves that “core owns state” is not universally a mechanical migration. Decide ownership rather than constructing a mirrored adapter under schedule pressure.

## 10. Recommended stabilization architecture

### 10.1 Keep these decisions

Do not undo:

- the three-layer protocol/core/React split;
- generalized `view.show`;
- structural index plus scans;
- fresh execute and advisory preview;
- explicit links collaborator;
- explicit effects;
- execution-time geometry;
- batch-preserving sync;
- app manifest/presentation split;
- rebalance preservation law;
- hard-cutover command vocabulary.

The findings are implementation-boundary defects, not evidence that the overall design was wrong.

### 10.2 Introduce an explicit publication phase

Refactor the core into three internal stages:

```text
PREPARE
  pure plan / apply / validate / build next state / reduce internal effects

INSTALL
  atomically replace owned core and runtime values
  mark revision committed

PUBLISH
  emit receipt and subscriber notifications
  isolate failures
  prohibit synchronous reentrant writes or queue them after publication
```

API sketch:

```ts
interface PreparedInstall {
  nextCore: WorkbenchCoreState;
  nextLinks?: LinkRuntimeState;
  receipt?: CommitReceipt;
}

interface PublicationError {
  stage: string;
  revision: number;
  error: unknown;
}
```

The exact observer order should be documented and tested. Recommended:

```text
state values become current
→ internal runtime values become current
→ durable receipt observers
→ state/runtime subscribers
→ report isolated callback errors
```

The critical invariant is not the chosen order itself; it is that reentrant writes cannot interleave with an unfinished older publication.

### 10.3 Make source reconciliation scheduled and owned

Version-one source connector:

```ts
function connectDocumentSource(core, source) {
  let queued = false;
  const request = () => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      const mutations = reconcile(core.snapshot(), source.snapshot());
      if (mutations.length) core.apply(mutations);
    });
  };
  request();
  return combine(source.subscribe?.(request), core.subscribe(request));
}
```

Then add source identity/ownership and pre-construction hydration before considering it stable public API.

### 10.4 Make sync adoption transactional

Refactor bootstrap and adoption around explicit covered entries:

```text
bootstrap missing row:
    covered = take(outbox)
    snapshot = target.document
    created = create(snapshot)
    revision = created.revision
    acknowledge covered
    overlay only entries queued after snapshot
    require target.accept(created + overlay)

adopt existing/response:
    candidate = structurally rebase whole entries
    require target.accept(candidate)
    only then update revision/phase/outbox
```

Add a sync status for local incompatibility rather than pretending synchronized.

### 10.5 Replace `openBindings` with binding declarations

Short term, do not spread `openBindings` to more apps. Define the actual use cases and mirror any accepted behavior in Go.

Preferred direction:

```ts
bindings: {
  transcript: { required: false, role: "context", formats: ["agentlogic.transcript-ref"] },
  program:    { required: true,  role: "primary", formats: ["sandbox.program"] },
}
launch: "unbound"
```

The link port declaration can reference a binding rule rather than being the binding rule itself.

### 10.6 Finish the dependency boundary

Extract a React-free PBUI kernel entry and point core imports there. Change the fence from source-text policy to package-graph evidence.

## 11. Phased improvement plan

### Stabilization Phase A — transaction safety (release blocker)

1. Add inverted package tests for CR-01 through CR-04.
2. Isolate all state, receipt, runtime, and replacement observers.
3. Define and enforce reentrancy behavior.
4. Schedule document-source reconciliation after publication.
5. Ensure receipts are strictly increasing and server-applicable in emitted order.
6. Fix sync bootstrap-create coverage.
7. Make sync replacement acceptance explicit.

Exit gate:

```text
execute/apply/replace cannot throw after install
all observers are attempted even if one fails
receipt revisions are monotonic
source close sequence syncs in legal batch order
missing-row bootstrap produces no false drop or duplicate send
```

### Stabilization Phase B — data ownership and binding semantics

1. Clone/freeze owned snapshots or replace mutable state exposure.
2. Specify `DocumentSource` ownership and collision rules.
3. Hydrate sources before app-catalog validation of persisted layouts.
4. Replace or formally specify `openBindings`.
5. Mirror accepted binding rules in Go and parity fixtures.
6. Add server validators for every stub format used by server-backed products.

Exit gate:

```text
no public mutation can alter state under an unchanged revision
legacy persisted layouts repair without silent fallback when recoverable
TS and Go accept/reject the same binding examples
```

### Stabilization Phase C — semantic edge cases

1. Fix same-app replacement with title/doc combinations.
2. Make preview IDs symbolic or command-local.
3. Correct expanded-command result indexing.
4. Add no-op equality for configure/rename/resize.
5. Make shell manifest/presentation completeness explicit.
6. Remove global-document focus fallback.
7. Pass one captured index through description.

### Completion Phase D — consumer migration

1. Finish agentlogic migration and parity with its Go catalog.
2. Decide and execute turboproof state ownership.
3. Finish hyperblog and run its browser behavior.
4. Migrate rag-ttc’s large document/sync integration carefully; do not replace its server semantics mechanically.
5. Verify external lockfiles consume the intended workspace/package versions.
6. Search all repositories for deleted APIs and old command kinds.

### Release Phase E — Phase 9 evidence

1. Normalize Go workspace/toolchain invocation.
2. Run protocol generation check and relevant Go suites.
3. Run every package test/typecheck/build from a clean checkout.
4. Run browser smokes for the six named products.
5. Move wall-clock benchmarks to a stable benchmark mode.
6. Audit built dependency graph for React-free core.
7. Audit root/subpath exports.
8. Finalize migration guide and versions.
9. Publish protocol → core → shell in order.

## 12. Test plan to add

### 12.1 Core publication

```text
subscriber A throws; subscriber B still runs
state is installed; execute returns success, never throws
onCommit throws; every state subscriber still runs
links runtime subscriber throws; core returns success
replacement cleanup throws; replace reports applied plus observer error
subscriber attempts nested execute; behavior is deterministic and documented
```

### 12.2 Sources

```text
closing last binding emits viewDelete before source documentDelete
source event during an in-flight publication coalesces to one later reconcile
same id/different format is diagnosed
same format/different source owner is not deleted
body update policy is tested
legacy persisted binding is repaired before strict validation
```

### 12.3 Sync

```text
absent server + queued batch before attach
absent server + new batch while create is in flight
create response includes queued work; no rebase/drop/send of covered entries
replaceDocument refusal does not advance phase/revision
whole-entry rebase also passes target/core validation
422 isolation never makes optimistic local state temporarily lose unsent entries
```

### 12.4 Planner

```text
preview does not advance allocator
same command + same snapshot gives same symbolic preview
same-app replacement title/doc matrix
one-cardinality + reuse:"never" gets a planner-level refusal
expanded show refusal reports top-level input index
cross-workspace replace/dock session behavior is explicit
```

### 12.5 Package boundary

```text
consumer project imports workbench-core without react installed
built core artifact has no import from PBUI root
worker/server import smoke
shell with missing presentation either refuses construction or renders explicit fallback
```

### 12.6 Cross-language fixtures

Add fixtures for:

- optional and required bindings;
- additional/open binding behavior if retained;
- every document-source stub format used by a Go host;
- singleton/cardinality mapping;
- malformed binding names and missing source stubs.

## 13. Decisions recommended by this review

### Decision: retain the implemented layering

- **Context:** Correctness defects were found after the split.
- **Options considered:** Revert to the old shell-owned semantics; merge core and shell; stabilize the current split.
- **Decision:** Stabilize the current protocol → core → shell layering.
- **Rationale:** The defects are publication, source, and sync mechanics. The package and planner decomposition made them visible and testable.
- **Consequences:** Fix transaction internals without restoring old aliases or mixed state.
- **Status:** accepted.

### Decision: block release on monotonic publication

- **Context:** Nested source commits and callback exceptions can lose/reorder durable observations.
- **Options considered:** Document callbacks as trusted; defer; make publication explicit.
- **Decision:** No release until committed revisions are observed in monotonic order and post-install callbacks cannot escape.
- **Rationale:** Persistence and sync correctness depend on this ordering.
- **Consequences:** Core/store internals change, public command API need not.
- **Status:** proposed.

### Decision: do not normalize `openBindings` as the final model

- **Context:** It solved migration blockers but diverges from Go and combines unrelated use cases.
- **Options considered:** Mirror the boolean in Go; retain only in TS; add explicit binding/launch policy.
- **Decision:** Design explicit binding rules and launcher behavior; keep the boolean temporary and contained until then.
- **Rationale:** Schema validation should catch typos and cross-language acceptance must agree.
- **Consequences:** Manifests and Go catalogs gain a small semantic vocabulary.
- **Status:** proposed.

### Decision: source reconciliation must not mutate synchronously from state notification

- **Context:** The current connector reverses receipt order.
- **Options considered:** Change receipt order only; schedule reconciliation; make it a core collaborator.
- **Decision:** Schedule/coalesce immediately; consider collaborator integration after ownership is specified.
- **Rationale:** Small fix restores ordering without prematurely creating another general module system.
- **Consequences:** Source stubs appear one microtask later, which callers must tolerate.
- **Status:** proposed.

### Decision: choose turboproof ownership explicitly

- **Context:** The new core has no external Workbench store port; turboproof’s Redux slice is currently authoritative.
- **Options considered:** Core ownership; external state port; mirrored stores.
- **Decision:** Choose core ownership unless product constraints prove a state port necessary; never mirror bidirectionally.
- **Rationale:** One source of truth is more important than preserving an alpha adapter shape.
- **Consequences:** Turboproof may require broader selector/sync migration.
- **Status:** proposed.

## 14. Intern code-reading guide

Read in this order:

1. `proto/hyperslop/pbui/workbench/v1/workbench.proto` — durable entities and primitive mutation set.
2. `packages/workbench-protocol/src/client/apply.ts` — structural mutation semantics.
3. `pkg/workbench/validate.go` and `model.go` — authoritative server acceptance.
4. `packages/workbench-core/src/apps.ts` and `policy.ts` — semantic app and product policy.
5. `graph.ts`, `queries.ts`, `validation.ts` — the document’s derived model and local safety net.
6. `commands.ts` — caller vocabulary.
7. `planner/show.ts` — identity/space composition.
8. `planner/plan.ts` — batching, draft progression, orphan cleanup, links maintenance.
9. `links/collaborator.ts` and `links/runtime.ts` — durable topology versus transient values.
10. `createWorkbenchCore.ts` — state ownership and transaction publication; start review fixes here.
11. `sync/index.ts` and `persistence/index.ts` — durable adapters.
12. `pbui-workbench/src/createWorkbenchShell.tsx` and `types.ts` — browser adapter/public surface.
13. `components/Surface`, `Tile`, `SplitPane`, `Launcher` — rendering and gestures.
14. `workbench-core/src/rebalance/law.ts` then `slate.ts` — semantic guard and algorithm orchestration.
15. `workbench-core/src/sources.ts` — new host-resource bridge and current release blocker.
16. `pbui-chat/src/tools/workbenchTools.ts` — richest agent consumer of the command/result surface.

For each command, trace:

```text
commands builder
→ planner handler
→ protocol mutation(s)
→ essential validator
→ core install/publication
→ shell reaction
→ persistence/sync receipt
```

## 15. API reference and review notes

### Core construction

```ts
createWorkbenchCore({
  initial,
  apps,
  policy,
  links,
  ids,
  initialSession,
  onCommit,
  onRejected,
  onPostCommitError,
  onRefused,
})
```

Review note: `onPostCommitError` currently covers only `onCommit`, not subscribers or links methods.

### Command execution

```ts
core.execute(command | command[], { geometry? })
core.preview(command | command[], { geometry? })
```

Review note: preview is state/runtime-safe but consumes `ids`.

### Raw/replacement gateways

```ts
core.apply(mutations)
core.replaceDocument(document, { session? })
core.restore(json)
core.reset(factory?)
```

Review note: documents are installed by reference and replacement effects run after notification.

### React shell

```ts
createWorkbenchShell({ core, apps })
createWorkbench({ apps, initial, links, policy, ...coreOptions })
```

Review note: shell checks presentation → manifest, not manifest → presentation.

### Persistence

```ts
readWorkbenchSnapshot(key, { apps, migrate, onDiscard })
createLocalPersistence(core, { key, debounceMs, onError, onHide })
```

Review note: strict catalog validation currently precedes source hydration.

### Sync

```ts
const sync = createWorkbenchSync({ client, onInvalid, onDropped, onError });
sync.attach(core);
// core onCommit must enqueue receipt.mutations
```

Review note: create-bootstrap coverage and replacement acknowledgement are incomplete.

### Documents for external resources

```ts
connectDocumentSource(core, {
  format,
  list,
  subscribe,
});
```

Review note: currently synchronous, format-owned, and body-create-only. Treat as provisional.

## 16. Residual risks and open questions

1. Can the PBUI link kernel be published as a React-free subpath without splitting its type graph from compiled presentation semantics?
2. Should source stubs be part of synchronized durable state or a locally supplied validation namespace?
3. Does any product require arbitrary view-level bindings after program-owned bindings are modeled correctly?
4. Should requiredness come from port declarations, explicit binding rules, or a generated semantic catalog?
5. Will turboproof let the core own the document, or does it prove the need for a state port?
6. What should `ExecuteResult.changed` mean for semantically identical protocol writes?
7. Should command entry validate unknown JavaScript at the core boundary, or remain a trusted typed API with `isWorkbenchCommand` required at external boundaries?
8. How should a sync target preserve local/exportable state when the server sends a document the current app catalog cannot render?
9. Should link runtime be staged into the core transaction now, or is documented two-store consistency acceptable after callback ordering is fixed?
10. Which external browser smokes constitute the release gate, and where are their outputs archived?

## 17. Final assessment

The colleague’s implementation succeeded at the hardest structural part: it replaced an overloaded React package with a coherent semantic core and converted behavior into explicit dataflow. The old impurity was fixed, the command model is better, and the tests are substantially more meaningful. The code is not a failed rewrite that needs architectural reversal.

The remaining work is concentrated at boundaries that the new design finally made visible:

```text
inside planner:          strong
protocol mutation model: strong
core/shell separation:   strong
publication boundary:    unsafe under failure/reentrancy
resource binding model:  incomplete
sync bootstrap/adoption: incomplete
external release train:  unfinished
```

That is a productive outcome for an alpha hard cutover. The right next move is not to add compatibility wrappers or more features. It is to make transaction publication monotonic and exception-safe, make source/binding semantics explicit across TypeScript and Go, finish the external consumers without creating mirrored state, and complete Phase 9 with clean evidence.

## 18. References

### Primary implementation

- `packages/workbench-core/src/createWorkbenchCore.ts:160-340` — construction, install, execute, raw apply, replacement.
- `packages/workbench-core/src/planner/plan.ts` — sequential pure draft planning and finalization.
- `packages/workbench-core/src/planner/show.ts` — generalized identity and placement resolution.
- `packages/workbench-core/src/graph.ts` and `queries.ts` — structural index and scans.
- `packages/workbench-core/src/validation.ts` — essential local validation.
- `packages/workbench-core/src/links/collaborator.ts` — explicit links lifecycle.
- `packages/workbench-core/src/sources.ts` — host resource stubs.
- `packages/workbench-core/src/sync/index.ts:140-383` — whole-batch outbox and adoption.
- `packages/workbench-core/src/persistence/index.ts` — local envelope.
- `packages/pbui-workbench/src/createWorkbenchShell.tsx` — React adapter and convenience constructor.
- `packages/pbui-workbench/src/launcherRows.ts` — app/view launcher eligibility.
- `pkg/workbench/model.go` and `pkg/workbench/validate.go` — Go catalog/binding authority.

### Tests and evidence

- `packages/workbench-core/src/goldens/transitions.test.ts` — behavior replay.
- `packages/workbench-core/src/execute.test.ts` — pure preview and batch execution.
- `packages/workbench-core/src/gateway.test.ts` — command/raw door equivalence.
- `packages/workbench-core/src/sync/sync.test.ts` — outbox/conflict behavior.
- `packages/workbench-core/src/rebalance/law.test.ts` — preservation property.
- `scripts/04-implementation-review-probes.test.ts` — executable review findings.
- `scripts/04-implementation-review-probes.output.txt` — captured observations.

### Ticket context

- `design-doc/01-intern-guide-to-the-pbui-workbench-core-consolidation-and-hard-cutover.md` — ideal and chosen design.
- `design-doc/02-version-one-simplification-decisions.md` — first-version scope.
- `reference/01-investigation-diary.md` — implementation history.
- `reference/02-consumer-inventory-and-public-surface.md` — migration/public API inventory.
