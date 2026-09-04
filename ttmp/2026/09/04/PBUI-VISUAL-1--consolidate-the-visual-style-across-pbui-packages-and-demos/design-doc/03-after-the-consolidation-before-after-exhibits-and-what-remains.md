---
Title: 'After the consolidation: before/after exhibits and what remains'
Ticket: PBUI-VISUAL-1
Status: active
Topics:
    - pbui
    - frontend
    - design
    - review
DocType: design-doc
Intent: long-term
Owners: []
RelatedFiles: []
ExternalSources: []
Summary: "The after-corpus of PBUI-VISUAL-1 set against the before-corpus, exhibit by exhibit for the ten priorities, with what each phase changed and what is still open."
LastUpdated: 2026-09-04T13:01:50.625265064-04:00
WhatFor: "Review the consolidation result; decide the follow-up tickets."
WhenToUse: "After doc 01 (the audit) and doc 02 (the design); regenerate the exhibits with scripts/07 and 08."
---

# After the consolidation

## Executive Summary

Eight phases landed on `task/consolidate-pbui-kernel` between commits `b1e351f` (P1) and the P8 commit named in the diary. Every phase is screenshot-verified against the before-corpus of doc 01, and the whole corpus was re-shot with the same scripts into `various/screenshots-after/`. This document sets the two side by side for each of the ten priorities the user ranked, states what changed in one paragraph each, and lists what is deliberately still open.

The short version: the family now has **one token sheet, one parts sheet, one shell, one tile chrome, one chip, one notice, one mode banner, one label idiom, one tile header, one facts list, and a floor under raw controls**. What remains is product-level polish (long type lists in the accept banner, the wire layer's route through neighbouring tiles) and the playbook.

## What each phase changed

1. **Tile chrome and shell (P3).** `AppShell` in pbui-workbench is mounted by the chat demo, the plotscript demo, the ecommerce ShopShell and datalab's WorkbenchShell: dark masthead with the uppercase banner-tracked wordmark, a strip row on paper under a grid rule, the canvas on the wash, the mouse-doc status row. Every tile bar is tinted by application kind from the core tone family. Strip tabs are all boxed, the active one filled. Split dividers are visible wash gutters. A workbench nested in a tile sits in a gutter.
2. **One chip (P4).** `Chip` carries size, fill, edge, glyph and seven border-style states. PortBadge, datalab's seven badges and the workspace tab are Chip calls; four datalab modules and the PortBadge module are deleted. Interactive small boxes stay Buttons.
3. **Dialog and launcher (P2).** `components.css` is on tokens: flat dim, firm border, zero radius, inverted header in the label voice, tiny framed close, px paddings. The accept chooser and context help follow the menu recipe. datalab's `dialogs.css` override is deleted because its content is the default.
4. **Nested borders (P3, P4, P5).** Nested workbench gutter; port rail cards are single hairlines; the proposal card is one box; the chip's edge replaced hand-copied boxes.
5. **Body padding (P3).** Content goes through `AppBody` (pads by default, `flush` for tables); the workbench story apps and every migrated tile do.
6. **The tan (P1, P4).** `--pbui-tag-wash` exists for stateless fills and `Chip fill="wash"` uses it (datalab's kind tags, scope chips, type letters); in the port rail an acceptable card is the selection fill with a firm dashed border and a refused card is faint text on a line-coloured border (the tan that still appears under the pointer on a refused card is the presentation's generic hover, the same as on every object). The sandbox timeline's tan tags turned out to be filter toggles (Buttons with `selected`), where the selection meaning is right and stays. Selected and acceptable still share the tan by design: both mean "this one".
7. **One notice (P5).** `Callout` with four severities, hint and dismiss; the kernel's refusal notice draws the same recipe; chat, sandbox and plotscript failures are danger Callouts; the accept banner is the ink-and-gold mode banner like the mouse-doc line and the placing banner.
8. **Tokens (P1).** One definition site in `src/tokens.css`, no inline fallbacks anywhere in core, datalab's copy deleted, the tone family and the chart palette in core, `--pbui-border-grid`/`--pbui-border-rule` rendering in chat for the first time.
9. **Labels and structure (P6).** Every uppercase label reads `--pbui-track-label`; `TileHeader` and `KeyValueList` replace sixteen header rows and five facts grids; the ecommerce tile sheet is on the token scale; dead Surface variants removed.
10. **Native controls (P7).** A zero-specificity skin for checkbox, radio, select, bare button and bare text input in `styles.css`, opted out by any class or part.

Story hygiene (P8): package storybooks carry the family's body baseline; PhaseIcon's ink story, PhaseRule's bar stories, the Tour sections' provider, the WireLayer static story and the Composer's insert-object crash are fixed.

## Still open (proposed follow-up tickets)

- **Accept banner with a long type list.** `ACCEPTING <product | category | metal | …>` overflows the row when a product's whole vocabulary is offered (chat's Composer). The banner should elide the list ("12 types") with the full list in the hint or a title.
- **Wire routing.** In-place wires cross neighbouring tiles' chrome; the ecommerce wiring overlay dims and annotates instead. Decide which is the product's link visualisation and give the other a debug flag.
- **Header badge width.** A port badge after a long title still ellipsises the title to 3ch on narrow tiles; a maximum badge width or a second row would keep both readable.
- **`SelectInput` chevron.** The atom and the native-control floor should draw the same chevron.
- **`ErrorNotice` (datalab).** Left as the inline form-error idiom; decide whether it becomes a Callout.
- **Blank `Apps/*` stories.** The static sweep still cannot render a workbench app story without a sized host and a document; a `withHost` decorator per package is the remaining hygiene item.
- **Playbook.** Steps 1 to 12 of the diary plus `scripts/07-after-corpus.sh` are the material; write `playbooks/01-visual-audit.md` after the next style pass runs the procedure a second time.

## Before and after, by priority

Left: the before-corpus (Step 2). Right: the after-corpus (Step 12), same story or scenario, matched by id. Missing halves are noted.

### 1 · One tile chrome, one shell

**shop-initial**  
| before | after |
|---|---|
| ![before](../various/screenshots/demos/pbui-chat/001-shop-initial.png) | ![after](../various/screenshots-after/demos/pbui-chat/001-shop-initial.png) |

**workspace-initial**  
| before | after |
|---|---|
| ![before](../various/screenshots/demos/pbui-plotscript/001-workspace-initial.png) | ![after](../various/screenshots-after/demos/pbui-plotscript/001-workspace-initial.png) |

**shop-initial**  
| before | after |
|---|---|
| ![before](../various/screenshots/demos/pbui-ecommerce/001-shop-initial.png) | ![after](../various/screenshots-after/demos/pbui-ecommerce/001-shop-initial.png) |

**workbench-initial**  
| before | after |
|---|---|
| ![before](../various/screenshots/demos/datalab-ui/004-workbench-initial.png) | ![after](../various/screenshots-after/demos/datalab-ui/004-workbench-initial.png) |

**visual-audit--tile-header-variants**  
| before | after |
|---|---|
| ![before](../various/screenshots/workbench-audit/011-visual-audit--tile-header-variants.png) | ![after](../various/screenshots-after/pbui-workbench/011-visual-audit--tile-header-variants.png) |

### 2 · One chip

**visual-audit--port-badge-gallery**  
| before | after |
|---|---|
| ![before](../various/screenshots/workbench-audit/003-visual-audit--port-badge-gallery.png) | ![after](../various/screenshots-after/pbui-workbench/003-visual-audit--port-badge-gallery.png) |

**visual-audit--port-rail-counts**  
| before | after |
|---|---|
| ![before](../various/screenshots/workbench-audit/004-visual-audit--port-rail-counts.png) | ![after](../various/screenshots-after/pbui-workbench/004-visual-audit--port-rail-counts.png) |

**design-system-atoms-chip--states**  
| before | after |
|---|---|
| ![before](../various/screenshots/core/089-design-system-atoms-chip--states.png) | ![after](../various/screenshots-after/core/094-design-system-atoms-chip--states.png) |

**design-system-atoms-typebadge--the-three-types**  
| before | after |
|---|---|
| ![before](../various/screenshots/datalab-ui/301-design-system-atoms-typebadge--the-three-types.png) | ![after](../various/screenshots-after/datalab-ui/301-design-system-atoms-typebadge--the-three-types.png) |

**component-library-organisms-workspacestrip--default**  
| before | after |
|---|---|
| ![before](../various/screenshots/datalab-ui/281-component-library-organisms-workspacestrip--default.png) | ![after](../various/screenshots-after/datalab-ui/281-component-library-organisms-workspacestrip--default.png) |

### 3 · Dialog and launcher on the menu recipe

**chrome-kit--launcher**  
| before | after |
|---|---|
| ![before](../various/screenshots/core/002-chrome-kit--launcher.png) | ![after](../various/screenshots-after/core/002-chrome-kit--launcher.png) |

**launcher-filtered-query**  
| before | after |
|---|---|
| ![before](../various/screenshots/interactions/core/008-launcher-filtered-query.png) | ![after](../various/screenshots-after/interactions/core/008-launcher-filtered-query.png) |

**accept-chooser-open**  
| before | after |
|---|---|
| ![before](../various/screenshots/interactions/core/004-accept-chooser-open.png) | ![after](../various/screenshots-after/interactions/core/004-accept-chooser-open.png) |

**workbench-rebalancedialog--broken**  
| before | after |
|---|---|
| ![before](../various/screenshots/pbui-workbench/013-workbench-rebalancedialog--broken.png) | ![after](../various/screenshots-after/pbui-workbench/027-workbench-rebalancedialog--broken.png) |

**launcher-open**  
| before | after |
|---|---|
| ![before](../various/screenshots/demos/pbui-chat/005-launcher-open.png) | ![after](../various/screenshots-after/demos/pbui-chat/005-launcher-open.png) |

### 4 · No nested double borders

**visual-audit--tile-header-variants**  
| before | after |
|---|---|
| ![before](../various/screenshots/workbench-audit/011-visual-audit--tile-header-variants.png) | ![after](../various/screenshots-after/pbui-workbench/011-visual-audit--tile-header-variants.png) |

**connect-mode-acceptable-highlighted**  
| before | after |
|---|---|
| ![before](../various/screenshots/workbench-interactions/002-connect-mode-acceptable-highlighted.png) | ![after](../various/screenshots-after/workbench-interactions/002-connect-mode-acceptable-highlighted.png) |

**pbui-chat-proposalcard--pending**  
| before | after |
|---|---|
| ![before](../various/screenshots/pbui-chat/018-pbui-chat-proposalcard--pending.png) | ![after](../various/screenshots-after/pbui-chat/018-pbui-chat-proposalcard--pending.png) |

### 5 · Body padding on tiles

**visual-audit--surface-variants**  
| before | after |
|---|---|
| ![before](../various/screenshots/workbench-audit/010-visual-audit--surface-variants.png) | ![after](../various/screenshots-after/pbui-workbench/010-visual-audit--surface-variants.png) |

**workbench-tile--title-slot**  
| before | after |
|---|---|
| ![before](../various/screenshots/pbui-workbench/026-workbench-tile--title-slot.png) | ![after](../various/screenshots-after/pbui-workbench/040-workbench-tile--title-slot.png) |

### 6 · The selection tan un-overloaded

**accept-mode-banner**  
| before | after |
|---|---|
| ![before](../various/screenshots/interactions/core/003-accept-mode-banner.png) | ![after](../various/screenshots-after/interactions/core/003-accept-mode-banner.png) |

**timeline-with-entries**  
| before | after |
|---|---|
| ![before](../various/screenshots/interactions/pbui-sandbox/004-timeline-with-entries.png) | ![after](../various/screenshots-after/interactions/pbui-sandbox/004-timeline-with-entries.png) |

### 7 · One notice grammar

**component-library-molecules-callout--variants-survive-greyscale**  
| before | after |
|---|---|
| ![before](../various/screenshots/core/006-component-library-molecules-callout--variants-survive-greyscale.png) | ![after](../various/screenshots-after/core/006-component-library-molecules-callout--variants-survive-greyscale.png) |

**refusal-notice**  
| before | after |
|---|---|
| ![before](../various/screenshots/interactions/core/006-refusal-notice.png) | ![after](../various/screenshots-after/interactions/core/006-refusal-notice.png) |

**pbui-chat-pbuiwidget--invalid**  
| before | after |
|---|---|
| ![before](../various/screenshots/pbui-chat/013-pbui-chat-pbuiwidget--invalid.png) | ![after](../various/screenshots-after/pbui-chat/013-pbui-chat-pbuiwidget--invalid.png) |

**live-edit-error-diagnostic**  
| before | after |
|---|---|
| ![before](../various/screenshots/interactions/pbui-plotscript/001-live-edit-error-diagnostic.png) | ![after](../various/screenshots-after/interactions/pbui-plotscript/001-live-edit-error-diagnostic.png) |

### 8 · Tokens: fallbacks and missing definitions

**pbui-chat-pbuiwidget--streaming-table**  
| before | after |
|---|---|
| ![before](../various/screenshots/pbui-chat/016-pbui-chat-pbuiwidget--streaming-table.png) | ![after](../various/screenshots-after/pbui-chat/016-pbui-chat-pbuiwidget--streaming-table.png) |

**component-library-molecules-jsonblock--default**  
| before | after |
|---|---|
| ![before](../various/screenshots/core/020-component-library-molecules-jsonblock--default.png) | ![after](../various/screenshots-after/core/020-component-library-molecules-jsonblock--default.png) |

**component-library-organisms-inspectorpanel--default**  
| before | after |
|---|---|
| ![before](../various/screenshots/core/068-component-library-organisms-inspectorpanel--default.png) | ![after](../various/screenshots-after/core/070-component-library-organisms-inspectorpanel--default.png) |

### 9 · One label idiom

**shop-scenes--scene-1-ambient**  
| before | after |
|---|---|
| ![before](../various/screenshots/pbui-ecommerce/001-shop-scenes--scene-1-ambient.png) | ![after](../various/screenshots-after/pbui-ecommerce/001-shop-scenes--scene-1-ambient.png) |

**workbench-coordinationinspector--tile**  
| before | after |
|---|---|
| ![before](../various/screenshots/pbui-workbench/001-workbench-coordinationinspector--tile.png) | ![after](../various/screenshots-after/pbui-workbench/015-workbench-coordinationinspector--tile.png) |

### 10 · Native controls

**design-system-layout-toolbar--variants**  
| before | after |
|---|---|
| ![before](../various/screenshots/core/155-design-system-layout-toolbar--variants.png) | ![after](../various/screenshots-after/core/160-design-system-layout-toolbar--variants.png) |

**presentation-interaction-kernel-4--explain-the-menu**  
| before | after |
|---|---|
| ![before](../various/screenshots/core/157-presentation-interaction-kernel-4--explain-the-menu.png) | ![after](../various/screenshots-after/core/162-presentation-interaction-kernel-4--explain-the-menu.png) |

**devtools-initial-content**  
| before | after |
|---|---|
| ![before](../various/screenshots/interactions/pbui-sandbox/001-devtools-initial-content.png) | ![after](../various/screenshots-after/interactions/pbui-sandbox/001-devtools-initial-content.png) |

### Story hygiene

**design-system-brand-phaseicon--ink**  
| before | after |
|---|---|
| ![before](../various/screenshots/datalab-ui/312-design-system-brand-phaseicon--ink.png) | ![after](../various/screenshots-after/datalab-ui/312-design-system-brand-phaseicon--ink.png) |

**design-system-brand-phaserule--bars-only**  
| before | after |
|---|---|
| ![before](../various/screenshots/datalab-ui/316-design-system-brand-phaserule--bars-only.png) | ![after](../various/screenshots-after/datalab-ui/316-design-system-brand-phaserule--bars-only.png) |

**applications-tour-section--the-brief**  
| before | after |
|---|---|
| ![before](../various/screenshots/datalab-ui/042-applications-tour-section--the-brief.png) | ![after](../various/screenshots-after/datalab-ui/042-applications-tour-section--the-brief.png) |

**visual-audit--wire-layer-styles**  
| before | after |
|---|---|
| ![before](../various/screenshots/workbench-audit/012-visual-audit--wire-layer-styles.png) | ![after](../various/screenshots-after/pbui-workbench/012-visual-audit--wire-layer-styles.png) |

