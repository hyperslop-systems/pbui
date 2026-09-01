# Changelog

## 2026-08-20

- Initial workspace created


## 2026-08-20

Intern guide written (acdeae1) and uploaded to reMarkable /ai/2026/08/20/PBUI-WORKBENCH-2 with the diary


## 2026-08-20

Phase 1 built (8200d59, cd1e7d7, ccd02f8, cd13915): 5.A store injection with onMutate/onRejected; 5.B buildLayout/workspaces() plus five workspace verbs and a WorkspaceStrip; 5.C tile.replace/tile.link/view.rebind with a split policy and a binding config; MutationError.detail restored for TS-Go parity. 38 new package tests (67 total); the pbui-chat demo meets the phase's acceptance gesture in a browser and persists the selected workspace across reloads.


## 2026-08-20

Phase 2 built (0dfd1bb): 5.D launcher rows slot, per-pane invocation, group/blurb/available on the descriptor, view.goTo; 5.G createTileDescriptor (pure, no workbench), the xN linked badge, focusPlacement, divider aria-valuetext/Home/End/double-click. 26 new tests (93 total). Two thirds of the phase's acceptance gesture verified in a browser; the 'right-click a tile' third needs a product <tile> presentation (PBUI-AGENT-2 B2), so per-pane invocation currently has no user-facing door.


## 2026-08-20

C1 (agentlogic) migrated: net -232 lines in its ui/, TileTree and LauncherPanel deleted, product policy reduced to a 147-line shell; it gained Mod-K, launcher search, per-tile error boundaries, keyboard dividers, the linked badge and focus restoration. Its eight core findings are in diary Step 5; three were defects and are fixed in 5e4d592 (splitPolicy vs singletons, unbound tiles from split/place, silently dropped mutation hooks). Surfaced a hard blocker: pbui-workbench is unpublished, so no product migration can install it.


## 2026-09-01

Phase 4 built (7d89732, 6e906be, 1fb6f8c, 19d7c32, 7e67f9d, 2db8675): the five C1 findings closed (reset(factory), a TileFrame actions slot carrying the per-pane launcher door, renderTitle composing the xN badge, Launcher scope, available's contract); 5.E view.open with at:{placementId,zone} and wb.placement.begin() over pbui's carry, with the Surface drawing the banner and per-tile labels; 5.F readWorkbenchSnapshot + createLocalPersistence, and a React-free sync entry point (3.5 kB) with a 409 rebase that is deliberately NOT atomic. 49 new tests (243 in the package). The pbui-chat demo adopted the persistence and deleted three hand-written pieces; a browser pass confirmed one write per burst, a reload landing back in the switched-to workspace, and reset(factory) escaping the stored layout. Phases 5-7 are migrations in repos not checked out here.


## 2026-09-01

Phase 5 built (d0347df, 8ba3cbf, 2b91ccd, a92bc97, c5e3f3e, d503dd0, 7265f98, f573fe6): turboproof renders on the package. A WorkbenchStore adapter over its Redux slice keeps both atomicity stories (the shell's batch is all-or-nothing, the slice's perform stays per-mutation for the rebase path); placement.ts, NodeView, Tile and the .tp-split CSS are deleted; six interpreter arms became six verb translations. Net ui/: +711 / -968. Package side: emptyPaneApp (aiming at an empty pane fills it — the rule all three launcher-policy products had by hand), the three PR #23 review findings (a server response could drop a queued edit; request ids collided across payloads; a linked view vanished from a scoped launcher), and three CSS tokens the package read that nobody defines, caught by turboproof's ui-token-check and now guarded by a test. Browser pass against the real Go server: every zone lands where aimed, followSourceDocument intact, mutate 200 with zero 422s, reload restores. BLOCKED on publishing pbui 0.10.0 / pbui-workbench 0.4.0 before turboproof's CI can install.


## 2026-09-01

Rebalance added to agentlogic (51a5df6) and turboproof (b6feaf8): the Mod+Shift+K dialog, the always-on detect badge, and rebalance-settings as a placeable tile in both registries, both fixtures and both Go catalogs. Verified by repairing a real squeeze in each (6 tiles under minimum in turboproof, 3 in agentlogic at a 760px window) rather than by booting. Package side: wb.RebalanceBadge (465365d), because the bare export throws outside the Surface subtree, which is where a status bar is. agentlogic's renderTitle workaround deleted — the C1 finding-1 and finding-4 fixes made it dead. Phase 7 surveyed and NOT started: 6.4's premise that the codec disappears is wrong (datalab's documents live in the world slice), and swapping the tree type alone is 308 type errors across 25 files.


## 2026-09-01

Phase 6 built (c08d22e, 624164d): hyperblog renders on the package. Its blocker was one 6.3 never mentions — five pbui releases behind, across 0.8.0's deletion of the descriptor actions() callback — so the action kernel had to land first (54 type errors to 0, using turboproof's wildcard-family bridge). Then model/paneTree.ts and 300 lines of Workbench.tsx went: net ui/ +538 / -731. hyperblog gains resize (its divider was an inert div), Mod-K, per-tile error boundaries, persistence, the GLOBAL launcher and swapTilesByAccept — the last two emitted by descriptors since they were written and handled by nothing. The seven paneTree behaviours are rewritten against the shell and hold; the per-application split policy works only because C1 finding 1 was fixed (task 77j8 closed). Also fixed: pbui 0.10 boxes every presentation, and hyperblog already boxed them, so every object in the index had two borders.


## 2026-09-01

Design doc gains §10, 'What this plan got wrong': the corrections three migrations produced (§1.3's absences, §5.G's signature, §2.1's split claim), the prerequisite §6.3 omitted (a product's package VERSION, not only its feature prerequisites — hyperblog was blocked by pbui 0.8.0's deletion of descriptor actions()), the Go-catalog rule a package-shipped tile implies, and why §6.4 is not executable as written: the remote 'codec' is a stage- and reachability-filtered projection of TWO slices, not a type converter, and its two steps are not separable (measured: 308 type errors from the type swap alone). §10.5 states the decision §6.4 assumed away, with a recommendation.

