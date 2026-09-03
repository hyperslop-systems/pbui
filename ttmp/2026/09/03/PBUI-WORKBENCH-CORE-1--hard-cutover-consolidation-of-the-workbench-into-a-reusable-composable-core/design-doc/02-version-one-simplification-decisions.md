---
Title: Version one simplification decisions
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
    - Path: repo://packages/pbui-workbench/src/apps.ts
      Note: Current mixed app declaration motivating the small manifest and presentation projections
    - Path: repo://packages/pbui-workbench/src/createWorkbench.tsx
      Note: Current assembly and plan API simplified by the first-version constructor and fresh execution decisions
    - Path: repo://packages/pbui-workbench/src/sync.ts
      Note: Current sync implementation constrained to preserve complete batches in the first pass
    - Path: repo://packages/pbui-workbench/src/types.ts
      Note: Current plan, effect-adjacent, and result surface being reduced
    - Path: repo://ttmp/2026/09/03/PBUI-WORKBENCH-CORE-1--hard-cutover-consolidation-of-the-workbench-into-a-reusable-composable-core/design-doc/01-intern-guide-to-the-pbui-workbench-core-consolidation-and-hard-cutover.md
      Note: Full design whose first-version scope this companion document constrains
ExternalSources: []
Summary: Living record of which parts of the full Workbench consolidation design are retained, simplified, explicitly not simplified, or deferred for the first implementation.
LastUpdated: 2026-09-03T18:45:00-04:00
WhatFor: Prevent first-version scope decisions from being lost while the larger Workbench architecture is discussed and revised.
WhenToUse: Read beside design-doc/01 before implementing or reviewing PBUI-WORKBENCH-CORE-1; update this document whenever a simplification is accepted, rejected, or revisited.
---


# Version one simplification decisions

## Purpose

The primary design describes a robust long-term Workbench architecture. This document tracks the deliberately smaller first implementation. It is the scope-control companion to `01-intern-guide-to-the-pbui-workbench-core-consolidation-and-hard-cutover.md`.

The first version should preserve architectural boundaries that prevent known failures while deferring precision, extensibility, and concurrency machinery that current usage has not justified.

## Status vocabulary

- **Keep** — required in the first implementation.
- **Simplify** — retain the capability with a smaller first-version design.
- **Do not simplify** — retain the fuller design despite other reductions.
- **Deferred** — make no architectural commitment yet.

## Keep

- Distinct application, view, placement, document, and workspace identities.
- Protocol → headless core → React shell dependency direction.
- A React-free and DOM-free core.
- Pure internal planning.
- Atomic protocol mutation batches.
- One execution/commit gateway for durable changes, cleanup, maintenance, validation, persistence, and sync observation.
- Durable/core state separate from transient shell state.
- Semantic app manifests separate from React presentation entries.
- Explicit `viewCardinality: "one" | "many"`.
- Explicit `duplicatePlacement: "clone" | "link"`.
- Initial document binding over all declared document slots rather than one privileged `source` key.
- Semantic `placement.*` terminology; UI may continue saying “tile.”
- Protocol validity distinct from current-viewport feasibility.
- Rebalance preservation of the complete `placementId → viewId` mapping.
- Hard API cutover without permanent aliases or compatibility modes.

## Simplify for version one

### S1 — Coarse revisions

- Use one local semantic revision.
- Use one server document revision.
- Do not initially implement entity fingerprints, geometry revisions, catalog revisions, policy revisions, per-module revisions, or dependency-specific preconditions.

### S2 — Execute fresh instead of committing old plans

- Normal API: `core.execute(command)`.
- Advisory API: `core.preview(command)`.
- A preview is not a commit handle.
- Accepting a preview executes or replans the command against current state.

### S3 — One public core constructor

```ts
const core = createWorkbenchCore({ initial, apps, policy, links });
const shell = createWorkbenchShell({ core, apps: presentations });
```

- Pure planner and stateful executor remain separate internally.
- Callers do not assemble definition, engine, and runtime objects separately.

### S4 — Shell reacts to receipts

- Focus and announcements are not planned semantic intents.
- The shell reacts after successful execution using returned ids and outcome data.

### S5 — One shell-local store

- Launcher, rebalance modal, link mode, chooser, and palette use one shell-local state store.
- Keep placement mode separate because its asynchronous aiming lifecycle is materially different.
- Focus remains a shell helper.

### S6 — Explicit links integration, not a general module framework

- The first core accepts a concrete optional links collaborator.
- Do not introduce a generic extension API covering arbitrary command handlers, runtime reducers, document formats, lifecycle maintenance, replacement hooks, and descriptions.
- Revisit generalization only when a second subsystem needs the same lifecycle integration.

Provisional shape:

```ts
const core = createWorkbenchCore({
  initial,
  apps,
  policy,
  links: createWorkbenchLinks({ presentation }),
});
```

### S7 — Essential local validation

Initially validate:

- format and schema version;
- workspace and tree shape;
- globally unique node ids;
- leaf-to-view references;
- view map and `viewOrder` agreement;
- registered applications and cardinality;
- declared document slots and referenced document ids.

Initially defer:

- exact byte-limit parity;
- local credential-shaped-field scanning;
- complete product payload validation;
- generated browser/Go catalogs;
- exact diagnostic-text parity.

### S8 — Do not reject imported orphan views yet

- Core-generated commands should not create new accidental orphan views.
- Commands should clean up views they make unreachable.
- Existing imported unplaced views remain legal until their intended meaning is known.

### S9 — Batch-preserving synchronization

- Store each committed `Mutation[]` as one outbox entry.
- Retry or reject the entire batch on conflict.
- Never isolate and send individual mutations from an atomic local batch.
- Dangerous wholesale tree replacements conflict rather than replay automatically.
- Defer command storage, intent replanning, entity merge policies, and collaborative concurrency.

### S10 — Geometry supplied at execution time

- The shell measures geometry immediately before executing a geometry-dependent command.
- Do not initially maintain geometry revision preconditions.
- Headless callers use a deterministic fallback policy.

### S11 — Small app-definition API

- Keep separate semantic manifest and React presentation projections.
- Provide one convenience helper that defines both.
- Do not initially add declaration fragments, definition revisions, plugin compilation, generated cross-language manifests, or several competing constructors.

```ts
const app = defineWorkbenchApp({
  manifest: {
    id: "orders",
    viewCardinality: "many",
    duplicatePlacement: "clone",
    ports,
  },
  presentation: {
    title: "Orders",
    tone: "var(--pbui-tone-orders)",
    Component: OrdersTile,
  },
});
```

### S12 — Small structured execution result

Use one compact success/refusal shape:

```ts
type ExecuteResult =
  | {
      ok: true;
      changed: boolean;
      createdPlacementId?: string;
      selectedWorkspaceId?: string;
    }
  | {
      ok: false;
      code: string;
      because: string;
      choices?: readonly Choice[];
    };
```

- Keep a stable refusal code and explanation.
- Return only immediate data demonstrated by callers.
- Defer affected-entity inventories, provenance graphs, detailed stale-precondition reports, and generic receipt metadata.

### S13 — Structural index plus on-demand document queries

Precompute the relationships used by nearly every placement/view command:

```ts
interface WorkbenchIndex {
  workspaceById: ReadonlyMap<WorkspaceId, Workspace>;
  nodeById: ReadonlyMap<NodeId, Node>;
  workspaceByNodeId: ReadonlyMap<NodeId, WorkspaceId>;
  viewByPlacementId: ReadonlyMap<PlacementId, ViewId>;
  placementsByViewId: ReadonlyMap<ViewId, readonly PlacementRef[]>;
  viewsByAppId: ReadonlyMap<AppId, readonly ViewId[]>;
}
```

Do not initially materialize:

- `viewsByDocumentId`;
- `documentsByFormat`;
- `orphanViewIds`.

Provide centralized on-demand query functions for those less-common questions. Rebuild the structural index wholesale after each document revision; do not maintain it incrementally.

## Do not simplify

### K1 — Explicit transition effects

Do not reduce planning to only `mutations + sessionPatch`.

Retain an explicit effect representation for non-durable semantic consequences. The exact split between a unified `localEffects` algebra and separate session/runtime effect collections remains to be finalized after link-cell semantics are settled.

Shell intents remain excluded; the shell reacts to successful execution results.

### K2 — Generalized `view.show`

Keep one composable normal form:

```ts
{
  kind: "view.show",
  view: ViewRequest,
  placement: PlacementRequest,
}
```

Resolve the independent axes explicitly:

```text
resolveView(...)
resolvePlacement(...)
materialize(...)
```

Convenience command builders may cover common operations, but they compile to this representation.

## Deferred

- Persistence semantics for identity-class cell values and `seed-class`-related behavior.
- Exact effect representation after link-cell semantics are decided.
- Exact narrow interface between core and links.
- Whether persistence and sync live at the core root or explicit subpaths.
- Deterministic headless direction for automatic placement.
- Whether no-op success is `{ ok: true, changed: false }` or a distinct result.
- Whether unplaced views eventually become invalid, background views, or restorable views.

## Lean first-version shape

```text
workbench-protocol
  protobuf document
  primitive mutations
  structural applier

workbench-core
  app manifests
  essential validation
  structural immutable index plus on-demand document queries
  generalized view.show planner
  pure internal planning
  document/session execution
  explicit non-durable effects
  concrete optional links integration
  batch-preserving persistence/sync

pbui-workbench
  React app presentations
  shell-local state
  DOM measurement at execution time
  focus and placement mode
  Surface, tile, launcher, links, and rebalance UI
```

## Change log

### 2026-09-03 — Initial simplification pass

- Replaced fine-grained plan preconditions with coarse revisions and fresh execution.
- Reduced public assembly to one core constructor and one shell constructor.
- Removed planned shell intents in favor of execution results.
- Chose one shell-local store over a controller per transient feature.
- Deferred a generic Workbench module framework.
- Reduced first-version validation and synchronization ambitions.
- Retained explicit effects and generalized `view.show`.
- Deferred identity-cell persistence and `seed-class` semantics.

### 2026-09-03 — Structural index simplification confirmed

- Moved the comprehensive materialized index to the ideal-design reference only.
- Chose six structural maps for version one.
- Kept document-binding, format, and orphan behavior through centralized on-demand query functions.
- Kept whole-index rebuilds per document revision; incremental maintenance remains deferred.
