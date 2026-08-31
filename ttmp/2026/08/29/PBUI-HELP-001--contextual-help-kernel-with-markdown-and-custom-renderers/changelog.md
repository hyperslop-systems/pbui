# Changelog

## 2026-08-29

- Initial workspace created


## 2026-08-29

Created an implementation-ready contextual help kernel guide: shared action/help matching, additive exact/inherited rules, Markdown and structured built-ins, typed custom renderers, lazy hover/focus runtime, accessibility, tests, and Datalab proof.

### Related Files

- /home/manuel/workspaces/2026-08-24/use-optkit/pbui/src/presentation/actions/resolve.ts — Existing selection path that grounds the shared matcher design
- /home/manuel/workspaces/2026-08-24/use-optkit/pbui/src/presentation/createPbui.tsx — Runtime integration and compatibility boundary


## 2026-08-29

Validated the intern guide and diary, corrected a literal-backslash PDF rendering failure, uploaded PBUI-HELP-001 Contextual Help Kernel, and verified it at /ai/2026/08/29/PBUI-HELP-001.


## 2026-08-29

Phase 1: freeze fixtures for resolver front-half (when-conditions, nearest scope, trace shape); fixed pre-existing vocabulary.test.ts type error (commit f9f6b83)

### Related Files

- /home/manuel/workspaces/2026-08-24/use-optkit/pbui/src/presentation/actions/resolve.freeze.test.ts — New freeze fixtures


## 2026-08-29

Phase 2: extracted matchContext into src/presentation/context/; action resolver refactored with traces byte-identical; task adx6 done (commit 9ae5bb9)

### Related Files

- /home/manuel/workspaces/2026-08-24/use-optkit/pbui/src/presentation/context/match.ts — New shared matcher


## 2026-08-29

Phase 3: pure help kernel — defineHelp, createHelpRegistry, additive resolveHelp with ordering + duplicate-id errors; task w3lr done (commit 2125f11)

### Related Files

- /home/manuel/workspaces/2026-08-24/use-optkit/pbui/src/presentation/help/resolve.ts — New additive resolver


## 2026-08-29

Phase 4: renderer registry, bounded markdown, five built-ins, HelpContent; task gq7b done (commit f57ed5a)

### Related Files

- /home/manuel/workspaces/2026-08-24/use-optkit/pbui/src/components/ContextHelp/builtins.tsx — Built-in renderers


## 2026-08-29

Phase 5: optional runtime surface — lazy openHelp/closeHelp, 350ms hover delay, instant focus, aria-describedby, Escape, menu supersedes help, parts CSS (commit bcd9c2c)

### Related Files

- /home/manuel/workspaces/2026-08-24/use-optkit/pbui/src/presentation/createPbui.tsx — Runtime integration


## 2026-08-29

Phase 6: datalab field help + custom renderer + action-parity test, workbench mount, core story, consumer smoke modernized, README authoring rules; tasks cshp+6xny done, ticket to review (commit 12f5e4d)

### Related Files

- /home/manuel/workspaces/2026-08-24/use-optkit/pbui/packages/datalab-ui/src/pbui/help.tsx — Product proof


## 2026-08-29

Fix round: focus opens help only under keyboard modality (menu focus-return no longer reopens the card), Chip's implicit label title dropped (native tooltip dueled the help card), PR #20 review fix box-sizing on rebalance previewPane (commits 360c52e, b36270a)

### Related Files

- /home/manuel/workspaces/2026-08-24/use-optkit/pbui/src/presentation/createPbui.tsx — Input-modality tracking for focus help


## 2026-08-29

PR #20 review round 2: isRestoringFocus mark in focus.ts stops keyboard menu dismissal reopening help; card overflow reachable (pointer-events auto, hover-into-card, PageDown/PageUp for focus-opened help) (commit d0af22b)

### Related Files

- /home/manuel/workspaces/2026-08-24/use-optkit/pbui/src/focus.ts — isRestoringFocus mark around focus-return dispatch


## 2026-08-29

PR #20 round 3: help card flush against anchor (4px dead gap gone), unmount closes open card (ref survives null detach), Chip title default restored with per-call-site silencing in FieldChip; threads replied+resolved, review re-requested (commit 89d1afa)

### Related Files

- /home/manuel/workspaces/2026-08-24/use-optkit/pbui/src/components/atoms/Chip/Chip.tsx — Title default restored per review

