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

