# Changelog

## 2026-08-26

- Initial workspace created


## 2026-08-26

Created ticket, imported the PBUI-ACTIONS-1 source-audited implementation guide into sources/, and audited it against current HEAD: all seams hold (exact actionsFor, render-time menu resolution, raw-verb perform, tileDescriptor extra, sandbox wrapper, unstable adapter IDs); drift is limited to required onPerform, MenuState relocation, direct pbui.perform(verb) callers, and the PBUI-TOOLCALL-1 executor runtime around the chat router.

### Related Files

- /home/manuel/workspaces/2026-08-24/use-optkit/pbui/ttmp/2026/08/26/PBUI-ACTIONS-2--type-directed-action-selection-engine-in-the-pbui-package/sources/PBUI-ACTIONS-1-source-audited-implementation-guide.md — The design of record being implemented


## 2026-08-26

Wrote the intern implementation guide: HEAD system tour, drift-audit table, kernel condensed with source-section pointers, amendments A-D (dual perform entry points, optional kernel with auto legacy adapter, workbench contribution fragments, stable IDs in PR0), file-by-file plan, PR ladder 0-7 with exit criteria, testing strategy, OPTKIT-022/023 coordination, pitfalls, glossary. Added diary steps 1-2 and PR task list.

### Related Files

- /home/manuel/workspaces/2026-08-24/use-optkit/pbui/ttmp/2026/08/26/PBUI-ACTIONS-2--type-directed-action-selection-engine-in-the-pbui-package/design-doc/01-intern-guide-implementing-the-action-selection-kernel-in-current-pbui.md — Primary implementation guide


## 2026-08-26

Committed guide/diary/tasks (44e4904) and uploaded 'PBUI-ACTIONS-2 Action Kernel Implementation Guide.pdf' (intern guide + source guide) to /ai/2026/08/26/PBUI-ACTIONS-2 on the reMarkable.


## 2026-08-26

P0 complete (fbfa492): semantic verb-derived action ids in both adapters (collision guard caught a real conversation-menu duplicate), 18 golden menu snapshots across datalab-ui/workbench/chat-demo, exported+frozen conversion arrays, sandbox liveness test. All six suites green (1119 tests).

