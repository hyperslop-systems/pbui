---
Title: 'Stabilization inventory: consumers, surface, dependency graph'
Ticket: PBUI-WORKBENCH-CORE-1
Status: review
Topics:
    - pbui
    - frontend
    - architecture
    - design
    - refactoring
    - onboarding
DocType: reference
Intent: long-term
Owners: []
RelatedFiles: []
ExternalSources: []
Summary: ""
LastUpdated: 2026-09-03T17:46:35.297688615-04:00
WhatFor: ""
WhenToUse: ""
---

# Stabilization inventory: consumers, surface, dependency graph

## Goal

<!-- What is the purpose of this reference document? -->

## Context

<!-- Provide background context needed to use this reference -->

## Quick Reference

<!-- Provide copy/paste-ready content, API contracts, or quick-look tables -->

## Usage Examples

<!-- Show how to use this reference in practice -->

## Related

<!-- Link to related documents or resources -->

# Stabilization inventory (Phase S0)

Recorded on 2026-09-03 before any stabilization change, per design doc 04 §11 Phase S0.

## Consumers of the surfaces the program changes

| Surface | In-repo | External (branch `task/add-plot-editor` unless noted) |
| --- | --- | --- |
| `connectDocumentSource` / `programDocumentSource` | pbui-sandbox `connect.ts`, `index.ts`; pbui-chat `createPbuiChat.tsx` (`connectWorkbench`), demo `workbench.ts` (world sources), `sandboxTools.test.ts` harness | hyperblog `Workbench.tsx` (corpus sources), `paneTree.test.ts` |
| `openBindings` | workbench-core `apps.ts`, `validation.ts`, `binding.ts`, `sources.test.ts`; pbui-sandbox `createScriptApp.tsx`; pbui-chat `sandboxTools.test.ts` | agentlogic `workbenchShell.tsx` (transcript binding) |
| `onPostCommitError` | workbench-core only (`createWorkbenchCore.ts`, its test) | none |
| `SyncTarget.replaceDocument` / `readWorkbenchSnapshot` | pbui-chat demo `workbench.ts` | agentlogic `workbenchContext.tsx`; turboproof `workbenchShell.ts`; rag-ttc `sync.ts`, `workbench.ts`, `test/sync.test.ts` |

## Public surface

`packages/workbench-core/src/publicSurface.test.ts` snapshots the sorted export names of the `index`, `sync`, `persistence` and `rebalance` entries (`__snapshots__/publicSurface.test.ts.snap`). Every phase that changes the surface updates it deliberately.

## Dependency graph of `@hyperslop-systems/workbench-core@0.1.0`

```text
dependencies:    @bufbuild/protobuf 2.11.0, @hyperslop-systems/pbui (workspace), @hyperslop-systems/workbench-protocol (workspace)
peerDependencies: none
devDependencies: react 19.2.8, react-dom 19.2.8 (used by nothing but fence.test.ts's wording), @types/node, typescript, vite, vitest
@hyperslop-systems/pbui: peerDependencies react ^18.3||^19, react-dom; root entry "." resolves to dist/index.js (React-bearing)
```

The core's production modules importing the PBUI root entry: `apps.ts`, `commands.ts`, `effects.ts`, `describe.ts`, `links/runtime.ts`, `links/snapshot.ts`, `links/collaborator.ts`, `links/document.ts`, `planner/links.ts`. Every imported symbol is exported by `src/presentation/links/index.ts` except `createPresentationTypeGraph` (`src/presentation/actions/typeGraph.ts`); the links directory itself imports only `../actions/ids` and `../actions/typeGraph` from outside.

## Evidence

`packages/workbench-core/src/stabilization.probes.test.ts` holds the seven probes as `it.fails` cases asserting the required behaviour; the ticket's `scripts/04-implementation-review-probes.test.ts` keeps the defect as recorded.
