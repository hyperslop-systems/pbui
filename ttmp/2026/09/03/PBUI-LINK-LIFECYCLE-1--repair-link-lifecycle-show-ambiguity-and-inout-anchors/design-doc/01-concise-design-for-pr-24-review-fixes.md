---
Title: Concise design for PR 24 review fixes
Ticket: PBUI-LINK-LIFECYCLE-1
Status: active
Topics:
    - pbui
    - frontend
    - architecture
    - refactoring
DocType: design-doc
Intent: long-term
Owners: []
RelatedFiles:
    - Path: repo://packages/pbui-workbench/src/components/PortRail/PortRail.tsx
      Note: Registers each rendered port side
    - Path: repo://packages/pbui-workbench/src/components/WireLayer/WireLayer.tsx
      Note: Reads source and destination anchors by side
    - Path: repo://packages/workbench-core/src/effects.ts
      Note: Semantic before-after runtime cleanup
    - Path: repo://packages/workbench-core/src/links/collaborator.ts
      Note: Catalog-aware removed-port derivation
    - Path: repo://src/chrome/usePortCarry.ts
      Note: Side-aware DOM port anchors
    - Path: repo://src/presentation/links/lifecycle.ts
      Note: Generalized removed-port durable lifecycle
    - Path: repo://src/presentation/links/resolveShow.ts
      Note: Distinct spawn target ambiguity
ExternalSources:
    - https://github.com/hyperslop-systems/pbui/pull/24
Summary: Repair the remaining PR 24 findings by treating app replacement as removed-port lifecycle, retaining ambiguity between distinct show targets, and distinguishing the two DOM anchors of an inout port.
LastUpdated: 2026-09-03T19:15:00-04:00
WhatFor: Define the smallest coherent correction for the remaining PR 24 review findings after the Workbench-core stabilization made the planning-purity finding obsolete.
WhenToUse: Use while implementing or reviewing link maintenance, show candidate ranking, or Workbench port-rail geometry.
---


# Concise design for PR 24 review fixes

## Executive summary

PR 24 received five findings. The subsequent Workbench-core cutover already fixed planning purity by making plans return data and staging runtime effects at commit. The four remaining symptoms require three changes:

1. treat application replacement as a **removed-port lifecycle transition** rather than merely deleting terms owned by the replaced view;
2. retain ties between distinct spawn targets while selecting the preferred placement for each target;
3. key DOM port anchors by semantic port and visual side.

No compatibility layer is required. These are corrections to alpha APIs.

## Invariants

```text
preview(command) does not mutate runtime                         already true
removed source port ⇒ every dependent applies onSourceClose      to fix
removed port ⇒ identity/class/history cannot retain that port    to fix
changed app ⇒ old view runtime values are forgotten at commit    to fix
distinct equal show targets ⇒ ambiguous                          to fix
one target + several placements ⇒ preferred placement wins       keep
inout port ⇒ separate input and output DOM anchors               to fix
```

## 1. Removed-port lifecycle

### Problem

`bindingsAfterAppReplaced()` removes terms whose destination belongs to a port omitted by the new app. It does not handle another view following the removed source, and replacement does not clear the old app’s emitted/attended runtime values. Identity declarations touching removed ports also need the same cleanup.

### Design

Generalize view deletion into port removal:

```ts
interface RemovedPortLifecycle {
  bindings: ReadonlyMap<PortId, Binding>;
  identity: readonly IdentityDeclaration[];
  classes: readonly IdentityClass[];
  history: ReadonlyMap<PortId, SerializableReference | null>;
}

linksAfterPortsRemoved(removedPortIds, snapshot, deps)
```

The transition:

```text
for every binding:
  if destination is removed:
    drop it
  else if its source is removed:
    apply destination.onSourceClose using the pre-change snapshot
  else:
    retain it

drop identity declarations touching removed ports
recompile identity classes using remaining ports
retain history only for surviving class members
```

The collaborator derives removed ports from:

- every old port of a deleted view;
- old ports absent from an app-changing `viewConfigure` target manifest.

Runtime cleanup is derived from the before/after document, not individual mutation spelling:

```ts
for each old view:
  if view is absent OR after.views[id].appId !== old.appId:
    emit forget-view-values(id)
```

This handles semantic commands and raw mutation batches consistently, including a batch whose intermediate mutations cancel out.

## 2. Show ambiguity

A spawn target is `(appId, portName)`; placement is a location choice for that target. Candidate identity must include all three values:

```ts
spawnCandidateId(appId, portName, placementId)
```

Placement index remains the final rank component, so only the preferred placement of each target reaches the winning rank. Do not collapse all spawn winners. Equal-ranked distinct app/port targets remain ambiguous and open the chooser.

## 3. Side-aware port anchors

A semantic inout port is one link endpoint but renders twice. Change only the DOM registry:

```ts
type PortAnchorSide = "in" | "out";
registerPort(portId, side, element)
portElement(portId, side)
```

`WireLayer` requests the output anchor for sources and input anchor for destinations. Hit testing continues returning the semantic `data-port-id`; link semantics do not gain a side field.

## Implementation plan

1. Add kernel tests for source-close and identity cleanup after arbitrary port removal.
2. Update core link maintenance to compute removed ports.
3. Derive runtime-forget effects from before/after documents in both execute and raw apply.
4. Add an app-replacement integration test proving follower policy and stale runtime cleanup.
5. Correct spawn IDs and winner handling; add equal-app and equal-port ambiguity tests.
6. Make the port registry side-aware and add registry plus rendered inout-anchor tests.
7. Run PBUI, Workbench core, and shell suites and typechecks.

## Risks

- Source-close `freeze` must evaluate against the **old** snapshot, while the value still exists.
- Identity classes must be recompiled after removed ports are filtered; retaining old classes can leave aliases to nonexistent ports.
- Runtime effects must remain staged data so preview purity is not regressed.
- Candidate IDs are intentionally changed; persisted chooser rows are not a supported API.

## Completion gates

- All four remaining review scenarios have regression tests.
- Existing planning-purity tests remain green.
- Raw apply and semantic execute produce equivalent replacement cleanup.
- No React or browser concepts enter the link kernel or Workbench core.

## References

- `src/presentation/links/lifecycle.ts`
- `src/presentation/links/resolveShow.ts`
- `src/chrome/usePortCarry.ts`
- `packages/workbench-core/src/links/collaborator.ts`
- `packages/workbench-core/src/planner/plan.ts`
- `packages/workbench-core/src/createWorkbenchCore.ts`
- `packages/pbui-workbench/src/components/PortRail/PortRail.tsx`
- `packages/pbui-workbench/src/components/WireLayer/WireLayer.tsx`
