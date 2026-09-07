---
Title: Visual onboarding screenshot catalogue
Ticket: PBUI-VISUAL-1
Status: active
Topics:
    - pbui
    - design
DocType: reference
Intent: long-term
Owners: []
RelatedFiles: []
ExternalSources: []
Summary: Eleven synthetic Storybook captures for visual onboarding and the forthcoming parc report.
LastUpdated: 2026-09-07T00:22:00Z
WhatFor: Preserve screenshot state, dimensions, provenance and limitations.
WhenToUse: Reviewing the styled-panel example or writing the PBUI design-system report.
---

# Visual onboarding captures — 2026-09-06 local / 2026-09-07 UTC

Saved in **PBUI-VISUAL-1** for the forthcoming parc report on PBUI visual style, widgets and the design system. These are actual Chromium captures of the compiled workbench Storybook, not image mockups. All data is synthetic; no credential or private API is involved.

## Reproduce

From the PBUI repository root:

```bash
pnpm --filter @hyperslop-systems/pbui-workbench build-storybook
# Serve that package's storybook-static directory on a local port.
```

Story prefix: `workbench-getting-started-styled-panel--`. Capture URL template:
`http://127.0.0.1:16011/iframe.html?id=workbench-getting-started-styled-panel--<suffix>&viewMode=story`.
The temporary static server used loopback 16011. Viewport was explicitly **1200×800 CSS pixels**. Plain panels were element captures; native workbench/wiring were viewport captures. The default panel host is 640×360, narrow is 280px wide, and native shell height is 640px. `manifest.json` records image dimensions, timestamps and hashes.

The computed input font stack was `"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`. Font readiness was awaited for the batch captures; this records the declared stack, not independent proof of the selected font file.

## Figure catalogue

| File | Story/state | What it demonstrates |
|---|---|---|
| `styled-workbench.png` | `native-workbench`, edited to Reviewed fixture and Inspect clicked | Real AppShell, registry/document, native title bar, labelled controlled input, facts list and explicit detail |
| `styled-workbench-wiring.png` | `native-workbench`, Wiring clicked | Native wiring mode and visible controls; this example deliberately has no declared ports/connections |
| `styled-panel-default.png` | `default` | Plain DTO/callback panel composed from shared widgets |
| `styled-panel-empty.png` | `empty` | EmptyState with explicit next action |
| `styled-panel-loading.png` | `loading` | Named loading state, disabled control and visible reason |
| `styled-panel-error.png` | `error` | Danger Callout with glyph, text and hint, not colour alone |
| `styled-panel-disabled.png` | `disabled` | Disabled Inspect with a visible explanation |
| `styled-panel-narrow.png` | `narrow-overflow` | 280px host; long identifier wraps without widening the pane |
| `styled-panel-theme-override.png` | `theme-override`, corrected host | Wash surface and token-based blue border, with the full 360px body height preserved |
| `styled-panel-details-slot.png` | `details-slot` | Application-owned plain React detail through a slot |
| `styled-panel-theme-before-host-fix.png` | earlier `theme-override` | Deliberate failure exhibit: wrapper collapsed body to ~103px; do not use as the approved theme example |

## Visual feedback and interaction receipts

The capture sweep caught a real story-host defect: an extra theme wrapper broke the bounded flex chain. The fix made that wrapper a growing flex column and added visibly effective token overrides. Recapture measured the panel at **640×360**, versus approximately 640×103 before. The corrected input computed border `rgb(122, 166, 201)` and background `rgb(247, 247, 244)`.

The narrow host and AppBody both measured 280px client/scroll width. The input internally scrolls its long text, while the detail value wraps. The native shell measured 1168×640 inside the 1200px viewport with Storybook's padding. Editing did not inspect; clicking Inspect did. The visible Wiring button and Ctrl+Shift+L from the focused input both opened wiring on Linux.

Console review found one static-server `/favicon.ico` 404 on initial navigation, not an application exception. Subsequent story renders had no reported application errors. This is not a comprehensive accessibility certification or backend/persistence test. Theme capture does not exercise portalled menu theming; native wiring capture does not prove port connections.

## Report reuse

Keep these originals in the ticket. When the later vault report is written, copy selected images into that report's dated `_assets/` directory and caption their state and limitations. Keep the before-host-fix image explicitly labeled as a failure if used; do not silently replace the approved image with it.
