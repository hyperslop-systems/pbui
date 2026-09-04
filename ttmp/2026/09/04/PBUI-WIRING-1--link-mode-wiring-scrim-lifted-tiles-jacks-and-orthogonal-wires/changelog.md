# Changelog

## 2026-09-04

- Initial workspace created


## 2026-09-04

P1 anchors: multi-element port registry, one wire per destination (commit e06e068)

### Related Files

- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/src/chrome/usePortCarry.ts — Port registry


## 2026-09-04

P2 jacks on the frame (commit f88bc43)

### Related Files

- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/packages/pbui-workbench/src/components/PortRail/PortRail.tsx — port-jack


## 2026-09-04

P3 orthogonal wires; surface positioned (commit d1bde68)

### Related Files

- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/packages/pbui-workbench/src/components/WireLayer/WireLayer.tsx — route()


## 2026-09-04

P4 scrim + lifted tiles, wide gutters, story fixture (commit 5b35065)

### Related Files

- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/packages/pbui-workbench/src/components/Surface/Surface.module.css — link-mode scrim


## 2026-09-04

P5 one hairline port card (commit e76278e)

### Related Files

- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/packages/pbui-ecommerce/src/ShopShell/ShopShell.tsx — renderPort block


## 2026-09-04

P6 bar binding: one label in link mode (commit a8ef47d)

### Related Files

- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/public/chrome.css — tile-badges + link-mode label


## 2026-09-04

P7 WiringLab story (commit 1bfce25)

### Related Files

- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/packages/pbui-workbench/src/stories/WiringLab.stories.tsx — The lab


## 2026-09-04

P8 obstacle-aware routing (commit 58b3b51)

### Related Files

- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/packages/pbui-workbench/src/components/WireLayer/route.ts — Grid router


## 2026-09-04

P9 scrolling rail with a jack layer; wire hit order (commit 7d9b9a9)

### Related Files

- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/packages/pbui-workbench/src/components/PortRail/PortRail.tsx — jack layer


## 2026-09-04

Added detailed intern review with 22 Playwright screenshots, resize/drag/scroll measurements, confirmed seven-pixel jack overflow, nine findings, source replay, and a phased repair design. Existing route/connect/identity tests pass (11 tests); no product code changed.

### Related Files

- /home/manuel/workspaces/2026-09-01/add-plot-editor/pbui/ttmp/2026/09/04/PBUI-WIRING-1--link-mode-wiring-scrim-lifted-tiles-jacks-and-orthogonal-wires/design-doc/03-intern-architecture-and-implementation-review-with-interactive-resize-evidence.md — Current evidence-based implementation and user-experience assessment


## 2026-09-04

Validated ticket and evidence links; generated and inspected the 29-page illustrated PDF, then uploaded successfully to reMarkable at /ai/2026/09/04/PBUI-WIRING-1 as PBUI-WIRING-1 Intern Review and Browser Evidence.


## 2026-09-04

Added section 14 to the intern review: principled constraints, graph search, final geometry contracts, incremental invalidation, temporal correctness, and accessible interaction. Archived 13 primary sources with integrity metadata, added two diagrams and a reading guide, and generated the expanded 42-page PDF. Local links, source hashes, and docmgr validation pass.


## 2026-09-04

Uploaded the expanded 42-page review as PBUI-WIRING-1 Review with Foundations to /ai/2026/09/04/PBUI-WIRING-1; recorded successful delivery and linked both PDF editions plus the source archive from the ticket index.


## 2026-09-04

Created standalone wiring refactoring design 04: surface-owned geometry, pure validated scenes, atomic connection intents, focused mode, direct API replacement, and eight implementation phases. Added four diagrams and a verified atomic Hold probe; rendered a 29-page guide and checked 50 local references. Product refactoring remains unimplemented.


## 2026-09-04

Validated and uploaded the 29-page standalone refactoring guide to /ai/2026/09/04/PBUI-WIRING-1 as PBUI-WIRING-1 Refactoring Design and Implementation Guide. Updated index and diary; confirmed 22 browser screenshots remain in the ticket and four new design diagrams are stored beside the guide.


## 2026-09-04

Refactor P0: Truthful fixtures and regression inputs (commit 1cfa1e1). Both Lab variants now contain six real relationships; semantic fixture tests and typecheck pass. Overall, start, and completion slips printed successfully.


## 2026-09-04

Refactor P1: Surface-owned geometry and exact registration lifetimes (commit c6fd94d). Introduced per-surface geometry, clipping, immutable revisions, exact disposal, and layout invalidation. Six focused tests and typecheck pass.

