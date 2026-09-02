# Changelog

## 2026-09-01

- Initial workspace created


## 2026-09-01

Step 1: located the linked-tiles research (vault reports, Downloads bundle with PBUI-LINK-UI tickets, prototypes, P06), read the toy core and audited approaches, mapped pbui (action kernel, accept mode, workbench document bindings, verbs, chrome carry, product integrations, agent tools, Go validator), and wrote the 1,200-line intern guide plus the diary; no code changed

### Related Files

- ttmp/2026/09/01/PBUI-LINK-1--tile-linking-binding-terms-link-mode-and-the-target-resolver-in-the-pbui-workbench/design-doc/01-tile-linking-in-pbui-intern-analysis-design-and-implementation-guide.md — The primary deliverable
- ttmp/2026/09/01/PBUI-LINK-1--tile-linking-binding-terms-link-mode-and-the-target-resolver-in-the-pbui-workbench/reference/01-investigation-diary.md — How the evidence was gathered


## 2026-09-01

Validated with docmgr doctor (all checks passed) and uploaded the guide + diary bundle to reMarkable at /ai/2026/09/01/PBUI-LINK-1 (PBUI-LINK-1 Tile Linking in pbui — Intern Guide.pdf); listing verified


## 2026-09-01

Step 3: review amendments — D2 amended (unified port declarations, bindings/docBound derived), D4 rewritten (JSON-only values, no codecs), D6 accepted, new D9 (kernel in core, glue in pbui-workbench, no third package) and D10 (hard cutover for new packages, self-contained pbui-ecommerce demo first, datalab-ui frozen); §11 rewritten around the e-commerce package; migration notes replaced

### Related Files

- ttmp/2026/09/01/PBUI-LINK-1--tile-linking-binding-terms-link-mode-and-the-target-resolver-in-the-pbui-workbench/design-doc/01-tile-linking-in-pbui-intern-analysis-design-and-implementation-guide.md — Amended guide


## 2026-09-01

Phase 0 (commit cc771ca): golden tests for cross-workspace doc-bound de-dup and a describeWorkbench snapshot; baseline 252 tests green; decision to merge the chat demo's gold-coin shop into pbui-ecommerce recorded for Phase 1

### Related Files

- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/packages/pbui-workbench/src/linkingGoldens.test.ts — Phase 0 golden tests


## 2026-09-01

Phase 1 (commit 4833208): ports and contracts in pbui core (links/types.ts); AppDescriptor.ports replaces bindings/docBound across five packages; describeWorkbench reports ports; packages/pbui-ecommerce scaffolded on the gold-coin shop (D11) with fixtures, host, seven tiles with ports, three plots, shell, stories, demo; guide gains D11, a rewritten §11.1, and Q7

### Related Files

- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/packages/pbui-ecommerce/src/apps.tsx — The seven shop tiles and their port declarations
- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/packages/pbui-ecommerce/src/host.ts — ShopHost, the interface pbui-datalab will implement
- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/packages/pbui-workbench/src/apps.ts — AppDescriptor.ports; isDocBound/documentSlots derived
- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/src/presentation/links/types.ts — Port contracts, declarations, ids, fingerprints


## 2026-09-01

Phase 2 (commit cfa91b2): pure link kernel in core (terms, evaluate, plan, applyLinkVerb, lifecycle, badge, invariants; 40 tests); pbui.links payload, LinkRuntime, link handlers with per-batch maintenance, LinkVerb in the WorkbenchVerb union, usePort/useEmitPort, PortBadge in Tile, port menus and the Link-to family in pbui-workbench (10 tests); the shop does scenes 1 and 2 (ambient, follow, pin/resume/detach, close→freeze) with stories and DOM tests (30 tests); screenshots p2-*

### Related Files

- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/packages/pbui-workbench/src/links/contributions.ts — Port menu rules and the Link-to family
- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/packages/pbui-workbench/src/links/handlers.ts — Link handlers; per-batch maintenance appended by the mutate wrapper
- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/src/presentation/links/apply.ts — applyLinkVerb, the one transition every instrument calls


## 2026-09-01

Phase 3 (commit cbcdf11): connect-management mode — usePortCarry and the Mod+Shift+L chord in core, PortRail/WireLayer/link menus/renderPort/renderWire in pbui-workbench (4 DOM tests), the shop's scene 7 and five passing real-pointer scenarios (e2e/scenes.mjs); screenshot p3-connect-mode

### Related Files

- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/packages/pbui-ecommerce/e2e/scenes.mjs — Real-pointer scenarios per the audit
- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/packages/pbui-workbench/src/components/WireLayer/WireLayer.tsx — One SVG per surface; owns Escape in the mode
- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/src/chrome/usePortCarry.ts — The port carry: registry, live modifier, one exit


## 2026-09-01

Phase 4 (commit f9b2444): resolveShow with the ranking tuple, held ports inapplicable, ties as ambiguity, fresh candidate revalidation (7 tests); show verb; view.open viewId; show handler with spawn+follow in one plan and the LauncherShell chooser (6 DOM tests); Link-to rows bind show intents; Show details… rule; shop scenes 3/3b, DOM tests, sixth e2e scenario

### Related Files

- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/packages/pbui-workbench/src/components/ShowChooser/ShowChooser.tsx — The chooser on LauncherShell
- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/src/presentation/links/resolveShow.ts — The target resolver and its ranking tuple


## 2026-09-01

Phase 5 (commit 06b8c35): identity classes — refineContract per view (Q7), identity.ts compiler with persistent ids, LinkState with identity/classes/history, Alias as derived binding, merge/split policies as runtime effects (55 kernel tests); workbench persistence, class cells, Ctrl-drag, double wire, split menus (4 DOM tests); badges beside the tile title (user request); shop shared selection, category filter, brush↔selection, scenes 5/5b/6, eight e2e scenarios

### Related Files

- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/packages/pbui-ecommerce/src/tiles/ShopPlot/ShopPlot.tsx — Brush → selection rows; external selection → highlighted marks
- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/src/presentation/links/identity.ts — The P06 subset: compatibility, fibers, union-find, persistent ids, lineage


## 2026-09-01

Phase 6 (commit 4e73712): Derived over translators — relations on LinkDeps, legalRelations/planDerive, port.derive, palette verbs (59 kernel tests); RelationPalette on LauncherShell, Derive through… and Change to Derived… menus (2 DOM tests); the shop's relations serve accept mode and derived bindings alike (D7), scenes 4/4b, ninth e2e scenario; plot render-loop fix (dc72829)

### Related Files

- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/packages/pbui-ecommerce/src/presentation/relations.ts — One relation registry for accept translators and derived bindings
- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/packages/pbui-workbench/src/components/RelationPalette/RelationPalette.tsx — The relation palette on LauncherShell


## 2026-09-01

Phase 7 (commit aede49f): describeWorkbench links/contexts, CoordinationInspector tile, LinkAnnouncer live region, agent test through workbench_perform, Go LinksDocumentValidator with tests, shop scene 8

### Related Files

- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/packages/pbui-workbench/src/components/CoordinationInspector/CoordinationInspector.tsx — The inspector tile
- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/pkg/workbench/links.go — Server-side structural validation of pbui.links

