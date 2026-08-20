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

