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

