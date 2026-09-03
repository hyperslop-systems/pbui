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

