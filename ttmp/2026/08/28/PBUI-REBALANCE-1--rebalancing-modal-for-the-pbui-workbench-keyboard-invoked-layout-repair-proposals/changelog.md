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


## 2026-08-28

Fixed measureDividerPx reading a column divider's full span as the gap (inflated diagnosis + clumped thumbnails, reported from the 8-tile demo); added the Workbench/RebalanceLab story — repair-lab-2's LAYOUTS panel as a standalone test workspace (9 presets + seeded RANDOM). Browser-verified: SKINNY COL reshape applies to zero violations; demo diagnosis sane (commit f91885a)

### Related Files

- /home/manuel/workspaces/2026-08-28/add-rebalancing/pbui/packages/pbui-workbench/src/stories/RebalanceLab.stories.tsx — The standalone broken-layout test workspace (commit f91885a)


## 2026-08-28

Config storage is now product-injectable: RebalanceConfigStore contract (useConfig hook + save), createRebalanceSettingsApp({store}) factory, RebalanceProps.configStore; defaults unchanged (document payload); localStorage store shipped as alternative; 187 tests (commit 748273d)

### Related Files

- /home/manuel/workspaces/2026-08-28/add-rebalancing/pbui/packages/pbui-workbench/src/rebalance/configStore.ts — The storage seam and both stock implementations (commit 748273d)


## 2026-08-28

Gesture change: card click applies + closes, Shift+click applies + stays open (undoable), new Apply + close button; 189 tests

### Related Files

- /home/manuel/workspaces/2026-08-28/add-rebalancing/pbui/packages/pbui-workbench/src/components/RebalanceDialog/RebalanceDialog.tsx — Click-to-commit gesture and footer buttons


## 2026-08-28

Alt-drag replace: DragZone 'replace' with live Alt reclassification in chrome (opt-in via onReplace), replacePlacement protocol builder, tile.replaceWith verb wired into the workbench Tile; 48+177+192 tests green; browser-verified in the lab (commits 6b0963e, 4805c0f, 32ee733)

### Related Files

- /home/manuel/workspaces/2026-08-28/add-rebalancing/pbui/src/chrome/useTileDrag.ts — Alt-held reclassification and the replace commit path (commit 4805c0f)


## 2026-08-28

Launcher placement mode: app choices carry over the workspace (edges dock before/after, centre splits longer side, Alt replaces in place), Enter = old default, Esc cancels, refused drops re-arm; chrome startTileCarry + app.placeAt verb; 181+196 tests green, live-verified (commits 8465d9c, dbf5890, 2da05e4)

### Related Files

- /home/manuel/workspaces/2026-08-28/add-rebalancing/pbui/packages/pbui-workbench/src/components/Launcher/Launcher.tsx — beginCarry placement mode and hint bar (commit dbf5890)


## 2026-08-28

PR #19 review fixes: repair batches apply as raw splitResize mutations (no stale rendered-bounds clamp), Undo restores via workspace.setTree so onMutate persistence fires, carry Enter stops propagation; 3 regression tests; replied inline on the PR (commit e1810d8)

### Related Files

- /home/manuel/workspaces/2026-08-28/add-rebalancing/pbui/packages/pbui-workbench/src/components/RebalanceDialog/RebalanceDialog.tsx — Raw-mutation apply path and mutation-path undo (commit e1810d8)


## 2026-08-29

P1 of the finish pass: chord audit clean — no k-chord handlers in datalab/ui, turboproof/ui, or agentlogic/ui (only a DataTable column key); rag-ttc verified live in RAG-TTC-REBALANCE-001. Both labs run in a browser; textbook sections 7 (RELAX) and 12 (composition) read as the Phase 6 spec.


## 2026-08-29

Phase 6 complete: status-bar diagnosis badge (detectOnly, silent when healthy), RELAX strategy (projected gradient, opt-in, TIDY gamma 1) with settings block, live preview overlay on the real Surface (document identity pinned), perf guard (12-tile slate under budget), QA playbook. Commits 64d10fb, ad907be, 752b468, f1dda25, 80283c0.


## 2026-08-29

Ticket closed

