# Changelog

## 2026-08-28

- Initial workspace created


## 2026-08-28

Created ticket; imported tiling-lab-1.html, repair-lab-2.html, tiling-repair-textbook.md into sources/; studied labs+textbook and the pbui workbench; wrote the intern analysis/design/implementation guide (design-doc/01) covering the binary-to-n-ary adapter, split.resize write-back, WorkspaceSetTree recommendation, RebalanceDialog design, Mod+Shift+K routing, and the rebalance-settings tile; added diary, source map, and phased tasks.

### Related Files

- /home/manuel/workspaces/2026-08-28/add-rebalancing/pbui/packages/pbui-workbench/src/verbs.ts — Application path (plan/applyPlan) and existing constraints the design builds on


## 2026-08-28

Phase 1: rebalance analysis core — pixel-exact binary⇄n-ary adapter with ChainStep provenance, propagate/violations/diagnose with textbook fixtures; 16 tests green (commit 1beac56)

### Related Files

- /home/manuel/workspaces/2026-08-28/add-rebalancing/pbui/packages/pbui-workbench/src/rebalance/analysisTree.ts — Adapter with pixel-share weights and pixel-space write-back (commit 1beac56)


## 2026-08-28

Phase 2: weight strategies (ripple/sparse/project/balance), repair driver, tiers, and buildSlate with dedup/policy/recommendation; 36 rebalance tests green (commit d6a1b30)

### Related Files

- /home/manuel/workspaces/2026-08-28/add-rebalancing/pbui/packages/pbui-workbench/src/rebalance/slate.ts — Slate orchestration: dedup, policy gate, polScore recommendation (commit d6a1b30)


## 2026-08-28

Phase 3: RebalanceDialog + Mod+Shift+K route table + rebalance verbs/store field; apply via plan/applyPlan with single-level undo; engine exported from package index; 165 workbench + 174 root tests green (commit 0784a5c). Deviation: Apply keeps the dialog open so Undo has a home.

### Related Files

- /home/manuel/workspaces/2026-08-28/add-rebalancing/pbui/packages/pbui-workbench/src/components/RebalanceDialog/RebalanceDialog.tsx — The dialog, cards, and thumbnails (commit 0784a5c)


## 2026-08-28

Phase 5: rebalance-settings singleton tile + pbui.rebalance-config DocumentPayload persistence; dialog reads the payload; 171 workbench tests green (commit fb2db6d)

### Related Files

- /home/manuel/workspaces/2026-08-28/add-rebalancing/pbui/packages/pbui-workbench/src/rebalance/configDocument.ts — Config persistence contract (commit fb2db6d)


## 2026-08-28

Phase 4: WorkspaceSetTree mutation (proto+TS+Go+parity fixtures), workspace.setTree verb, RESHAPE/REBUILD structural generators with Hungarian seating and pixel-space binary emission (server ratio band clamped); slate + dialog integration; 185 workbench / 46 protocol / Go suites green (commit 686b923). Design-doc addendum records build-time deviations.

### Related Files

- /home/manuel/workspaces/2026-08-28/add-rebalancing/pbui/packages/pbui-workbench/src/rebalance/structural.ts — Reshape/rebuild engines and emitBinary (commit 686b923)


## 2026-08-28

Wired the rebalance dialog + settings tile into the pbui-chat demo (the family reference product) and verified end-to-end in the browser: Broken story diagnosis/apply/undo loop and Ctrl+Shift+K in the Gold Coin Shop; demo tests 13/13

### Related Files

- /home/manuel/workspaces/2026-08-28/add-rebalancing/pbui/packages/pbui-chat/demo/src/App.tsx — Rebalance dialog mounted beside the launcher

