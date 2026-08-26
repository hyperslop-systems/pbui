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


## 2026-08-26

P1 complete (b58e23b): pure action kernel under src/presentation/actions — type graph, availability quartet, conditions, rules/families, fail-fast registry, 16-step resolver with trace, fresh-perform evaluation, legacy family. 50 new tests; root suite 152 green.


## 2026-08-26

P2 complete (db3269e): kernel behind ObjectMenu with automatic legacy family, resolve/performAction context operations, ambiguity row, menu-ambiguity CSS hook, six integration tests. All 1219 tests green with zero product changes.


## 2026-08-26

P3 complete (e33f213): workbench contribution fragments with descriptor-parity suite; datalab field/datum/doc/stage migrated to kernel rules and a bounded family with optional descriptor callbacks; goldens re-pinned after an 82-row equivalence audit. 1226 tests green.


## 2026-08-26

P4 complete (7f528d2): createGeneratedActionsFamily replaces the sandbox wrapper; workbench fragment gains project option; all 19 chat-demo types migrate to kernel rules with no legacy family; goldens re-pinned after 19-label equivalence audit. 1228 tests green.


## 2026-08-26

P5 complete (37b51d6): inspectable/watchable abstract nodes replace eight datalab rules with two inherited declarations; stage inherits Inspect only; goldens re-pinned as pure id substitution; provenance tests pin distance-1 inheritance. Demo deliberately stays flat (per-type menu positions). 1230 tests green.

