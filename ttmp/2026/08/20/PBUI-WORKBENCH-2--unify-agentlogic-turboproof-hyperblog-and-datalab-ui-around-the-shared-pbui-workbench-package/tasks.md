# Tasks

## TODO

- [x] Analyse the four product shells (agentlogic, turboproof, hyperblog, datalab-ui) and inventory pbui-workbench <!-- t:83a6 -->
- [x] Feature matrix: what each shell has, what the core supports, what is missing <!-- t:dl4a -->
- [x] Design the core additions (API sketches) and the per-product migration plan <!-- t:yyl8 -->
- [x] Write the intern guide and upload to reMarkable <!-- t:959u -->
- [x] Phase 1: 5.A store injection + hooks, 5.B workspaces + strip, 5.C replace/link/rebind + policy + binding <!-- t:cv5w -->
- [x] Phase 2: 5.D launcher rows slot + per-pane invocation; 5.G createTileDescriptor, linked badge, focusPlacement, divider a11y <!-- t:qg5w -->
- [x] Phase 3: agentlogic migration (6.1) <!-- t:ndab -->
- [x] Phase 4 core: 5.E placement mode + zone-aware open; 5.F local persistence + sync module <!-- t:022f -->
- [x] Phase 5: turboproof migration (6.2) <!-- t:zcmh -->
- [x] Phase 6: hyperblog migration (6.3) + 5.H seeding/scoping/parity/export <!-- t:dpm4 -->
- [ ] Phase 7: datalab-ui migration (6.4), re-planned after 3/5/6 <!-- t:0f09 -->
- [ ] BLOCKER: publish @hyperslop-systems/pbui-workbench to GitHub Packages; no product migration can install without it <!-- t:km5u -->
- [x] C1 findings not yet fixed: reset(factory?), a chrome door to per-pane launcher.open, renderTitle composing the xN badge, launcher workspace scope, document AppDescriptor.available <!-- t:4ygg -->
- [x] Re-read 6.3 (hyperblog) before C3: finding 1 invalidates its per-application split-policy assumption <!-- t:77j8 -->
- [ ] Phases 5-7 need turboproof/hyperblog/datalab-ui checked out; this workspace holds only pbui, datalab and plot <!-- t:tmxa -->
- [ ] 5.H leftovers: seedApp, registrySnapshot, exportLayout/importLayout (reset(factory) landed in Phase 4) <!-- t:bqmm -->
- [ ] SyncClient needs a replace() before C4 can express datalab-ui's whole-document PUT <!-- t:vyvh -->
- [ ] Correct guide 1.3: parseDocument IS strict, and the package now has persistence and a sync module <!-- t:vedp -->
- [ ] BLOCKER for turboproof CI: publish pbui 0.10.0 and pbui-workbench 0.4.0 (manual workflow_dispatch, CONFIRM_LATEST), then make ui-install && make ui and commit the lockfile + dist <!-- t:dqef -->
- [x] hyperblog is still not checked out; Phase 6 is blocked on the repo, not on code <!-- t:m5gg -->
- [ ] 6.4 is wrong that the codec disappears: datalab's documents live in the world slice, not the layout slice, so 'the runtime document IS the wire document' needs a world/layout merge the design does not decide <!-- t:w3fi -->
- [ ] Phase 7 measured: swapping datalab's Node for the protocol's alone produces 308 type errors across 25 files; steps 1 and 2 are NOT separable for the geometry reducers (step 1 would rewrite code step 2 deletes) <!-- t:jxsa -->
- [ ] 6.3 omits a prerequisite: hyperblog was five pbui releases behind across 0.8.0's deletion of descriptor actions(); a migration plan needs the product's package VERSION beside its feature prerequisites <!-- t:qpzx -->
- [ ] hyperblog: adopt createTileDescriptor, and wire /v1/workbenches through the 5.F sync module (it has createLocalPersistence only) <!-- t:ygdt -->
- [ ] 5.H still unbuilt: seedApp, registrySnapshot, exportLayout/importLayout <!-- t:4nu5 -->
