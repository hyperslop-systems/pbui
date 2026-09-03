# Changelog

## 2026-09-03

- Initial workspace created


## 2026-09-03

Imported the supplied Workbench assessment, mapped the current cross-language and cross-product architecture, and verified that identity-link planning mutates the live runtime.

### Related Files

- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/ttmp/2026/09/03/PBUI-WORKBENCH-CORE-1--hard-cutover-consolidation-of-the-workbench-into-a-reusable-composable-core/scripts/01-plan-purity-probe.test.ts — Reproduces the planner purity defect


## 2026-09-03

Authored the intern-facing hard-cutover design: protocol, headless engine, transactional runtime, React shell, module integration, intent-aware sync, phased migration, deletion list, and completion gates.

### Related Files

- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/ttmp/2026/09/03/PBUI-WORKBENCH-CORE-1--hard-cutover-consolidation-of-the-workbench-into-a-reusable-composable-core/design-doc/01-intern-guide-to-the-pbui-workbench-core-consolidation-and-hard-cutover.md — Primary design deliverable


## 2026-09-03

Validated the ticket and uploaded the four-document PBUI Workbench Core Consolidation bundle to /ai/2026/09/03/PBUI-WORKBENCH-CORE-1 on reMarkable.

### Related Files

- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/ttmp/2026/09/03/PBUI-WORKBENCH-CORE-1--hard-cutover-consolidation-of-the-workbench-into-a-reusable-composable-core/design-doc/01-intern-guide-to-the-pbui-workbench-core-consolidation-and-hard-cutover.md — Validated and delivered primary guide


## 2026-09-03

Added a living version-one simplification decision record; retained explicit effects, generalized view.show, and the comprehensive WorkbenchIndex while reducing first-pass revisions, assembly, shell state, modules, validation, sync, geometry, app-definition machinery, and result metadata.

### Related Files

- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/ttmp/2026/09/03/PBUI-WORKBENCH-CORE-1--hard-cutover-consolidation-of-the-workbench-into-a-reusable-composable-core/design-doc/02-version-one-simplification-decisions.md — First-version scope-control companion to the primary design


## 2026-09-03

Adopted the structural-index simplification, separated ideal design from the authoritative first-version implementation, rewrote Phases 0-9 and validation gates, and added matching open implementation tasks.

### Related Files

- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/ttmp/2026/09/03/PBUI-WORKBENCH-CORE-1--hard-cutover-consolidation-of-the-workbench-into-a-reusable-composable-core/design-doc/01-intern-guide-to-the-pbui-workbench-core-consolidation-and-hard-cutover.md — Now distinguishes ideal §§6-15 from chosen §16 and aligned implementation phases
- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/ttmp/2026/09/03/PBUI-WORKBENCH-CORE-1--hard-cutover-consolidation-of-the-workbench-into-a-reusable-composable-core/design-doc/02-version-one-simplification-decisions.md — Records the structural index plus on-demand query decision


## 2026-09-03

Phase 0: 44 command→transition goldens with deterministic ids, consumer inventory, workbench-core package skeleton with React/DOM fence (commit 9822ba8)

### Related Files

- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/packages/pbui-workbench/src/goldens/transitions.test.ts — The behavioural contract the core planner must reproduce
- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/packages/workbench-core/src/fence.test.ts — No React, no DOM, node environment


## 2026-09-03

Phase 1: protocol IdGenerator and createWorkbenchClient deletion; core manifests, six-map index, on-demand queries, essential validation, layout builders, structured parse (commit 54beaf4)

### Related Files

- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/packages/workbench-core/src/graph.ts — The structural index
- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/packages/workbench-core/src/validation.ts — Essential validation with Go codes


## 2026-09-03

Phase 2: policy, slot-aware initial document policy, session repair, createWorkbenchCore with validated apply/replace gateway, defineWorkbenchApp (commit dfab835)

### Related Files

- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/packages/pbui-workbench/src/app.ts — One declaration, two projections
- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/packages/workbench-core/src/createWorkbenchCore.ts — State, the raw-batch gateway, validated replacement


## 2026-09-03

Phase 3: command algebra, pure planner with generalized view.show, execute/preview, links planned as data; goldens replay identically; purity probe inverted for the core (commit 98d34a6)

### Related Files

- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/packages/workbench-core/src/planner/plan.ts — Sequential drafts, orphan sweep, links maintenance
- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/packages/workbench-core/src/planner/show.ts — resolveView / resolvePlacement / materialize
- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/ttmp/2026/09/03/PBUI-WORKBENCH-CORE-1--hard-cutover-consolidation-of-the-workbench-into-a-reusable-composable-core/scripts/02-plan-purity-probe-core.test.ts — The inverted probe


## 2026-09-03

Phase 4: raw batches and replacement pass links maintenance and runtime cleanup; door-equivalence test (commit 93724d5)

### Related Files

- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/packages/workbench-core/src/gateway.test.ts — Command and raw doors commit identical batches


## 2026-09-03

Phase 5: rebalance engine moved to workbench-core/rebalance with the preservation law and property test; measureGeometry and createShellStore in the shell (commit f909b1e)

### Related Files

- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/packages/pbui-workbench/src/geometry.ts — DOM to GeometrySnapshot at execution time
- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/packages/pbui-workbench/src/shellState.ts — One shell-local store
- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/packages/workbench-core/src/rebalance/law.ts — The placement→view preservation law


## 2026-09-03

Phase 6: React shell cut over to the core (createWorkbenchShell/createWorkbench, shell store, commands everywhere); old assembly/store/verbs/links handlers deleted; describe, persistence, sync in the core; READMEs (commit 4fa53f1)

### Related Files

- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/packages/pbui-workbench/src/createWorkbenchShell.tsx — The shell over the core and the convenience constructor
- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/packages/workbench-core/src/describe.ts — Agent-facing description with presentations and geometry as inputs


## 2026-09-03

Phase 7: batch-preserving sync outbox (whole entries, per-batch rebase and isolation, destructive-batch conflicts) with tests (commit 580f1a9)

### Related Files

- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/packages/workbench-core/src/sync/index.ts — The batch-preserving outbox


## 2026-09-03

Phase 8 (in-repo): sandbox, plotscript, ecommerce, chat and the chat demo on workbench-core; connectDocumentSource and openBindings for host-owned bindings (commits cc19b38, d2a182c)

### Related Files

- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/packages/pbui-chat/src/tools/workbenchTools.ts — The agent tools on the command vocabulary
- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/packages/workbench-core/src/sources.ts — Stub documents for host-owned resources


## 2026-09-03

Added an evidence-backed post-implementation architecture/code review with an intern system guide, completion audit, nineteen prioritized findings, seven executable probes, and a phased stabilization plan.

### Related Files

- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/ttmp/2026/09/03/PBUI-WORKBENCH-CORE-1--hard-cutover-consolidation-of-the-workbench-into-a-reusable-composable-core/design-doc/03-post-implementation-architecture-and-code-review.md — Primary post-implementation assessment
- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/ttmp/2026/09/03/PBUI-WORKBENCH-CORE-1--hard-cutover-consolidation-of-the-workbench-into-a-reusable-composable-core/scripts/04-implementation-review-probes.test.ts — Executable evidence for transaction, source, sync, state, preview, and view.show findings


## 2026-09-03

Validated the post-implementation review ticket cleanly and refreshed the nine-document PBUI Workbench Core Consolidation bundle on reMarkable.

### Related Files

- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/ttmp/2026/09/03/PBUI-WORKBENCH-CORE-1--hard-cutover-consolidation-of-the-workbench-into-a-reusable-composable-core/design-doc/03-post-implementation-architecture-and-code-review.md — Reviewed document delivered in the refreshed bundle


## 2026-09-03

Phase 8 (external): hyperblog 6358676, agentlogic e3b69e0, turboproof 68ed102, rag-ttc bdfb04f+50db0fc migrated by parallel agents; createPbuiChat conversationDocuments option (commit 7fdbe1e)

### Related Files

- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/packages/pbui-chat/src/createPbuiChat.tsx — Conversation stubs configurable or off

