---
Title: 'CSS structure inventory'
Ticket: PBUI-VISUAL-1
Status: active
Topics:
    - pbui
    - frontend
    - design
    - review
DocType: reference
Intent: short-term
Owners: []
RelatedFiles: []
ExternalSources: []
Summary: "Raw working material for the visual audit; the design doc is the curated view."
LastUpdated: 2026-09-04T11:41:19.797959-04:00
WhatFor: ""
WhenToUse: ""
---

# CSS Structure Inventory — PBUI-VISUAL-1

Read-only audit of styling mechanisms, tokens, hardcoded values, recurring patterns, box nesting, and
spacing conventions across the pbui monorepo: core (`src/`, `public/`) and packages `pbui-workbench`,
`workbench-core`, `pbui-chat`, `pbui-ecommerce`, `pbui-plotscript`, `pbui-sandbox`, `pbui-editor`,
`datalab-ui`, plus their demo apps. `node_modules`, `dist*`, `storybook-static`, `pkg/` excluded.

All file paths are relative to `/home/manuel/workspaces/2026-09-01/add-plot-editor/pbui` unless a
package path is already given in full.

---

## 1. Styling mechanisms in use

Five mechanisms recur everywhere: **CSS module** (`X.module.css` + `styles.foo`), **global class/attribute
sheet** (`public/*.css`, package `styles.css`, all keyed by `[data-part="…"]`/`[data-pbui-component="…"]`
attribute selectors — there are effectively **no bare `.pbui-*` classes** anywhere in the repo's global
sheets), **inline `style={{…}}`** (almost always a computed/dynamic value or a `var(--pbui-*)` string, rarely
a literal), **pure composition** (a component with zero CSS of its own, entirely built from other styled
primitives), and **hardcoded value embedded directly** (bypasses the token system).

### Core (`src/`, `public/`)

| Component | Mechanism | Mixing |
|---|---|---|
| Button | CSS module | + inline `style={{background:fill}}` for `raised+fill` (Button.tsx:75) |
| CheckboxRow, IconButton, LinkAction, SelectInput, TextArea, TextInput, CodeText, Kbd, Text/SectionLabel, VisuallyHidden, AppBody, Stack, Toolbar, DiffHunk, InlineRename, FileDropZone, MoreBar, ResultLog, BackdropPanel, TransportBar | CSS module | none |
| Chip | CSS module + unstyled `data-part="chip"/"chip-label"` | + inline `style={{borderLeftColor:tone}}` (Chip.tsx:31) |
| CodeLine | CSS module (`data-op` selectors) | + inline `style={{borderLeftColor:ownerTone}}` (CodeLine.tsx:44) |
| Meter | CSS module (`data-level`) | + inline `style={{width, background:tone}}` (Meter.tsx:88-91) |
| Sparkline, RadarPanel | CSS module (SVG) | + inline `style={{stroke/fill:tone}}` |
| Swatch | CSS module | + inline `style={{background:color}}` (the atom's whole purpose) |
| KindLegend | CSS module | + inline `style={{background:k.tone}}` (:60) |
| SegmentedBar | CSS module (`data-over/pinned/dimmed`) | + inline `style={{background:segment.tone, flex}}` (:95,103,110) |
| **Callout** | **Pure composition**: `Surface`+`Stack`+`Text`+`Toolbar`; `data-part="callout"` unstyled | no CSS anywhere targets it |
| **EmptyState** | **Pure composition**: `Stack`+`Text`×2; `data-part="empty-state"` unstyled | — |
| **Legend** | **Pure composition**: `Stack`+`SectionLabel`+`Swatch`+`Text`; `data-part="legend"` unstyled | — |
| FileBrowser | CSS module + unstyled `data-pbui-component="file-browser"` + many unstyled `data-part` hooks | + inline `style={{width:depth*.875+"rem"}}` tree indent (:534) |
| **Dialog** | Global attribute sheet only — `data-pbui-component="dialog"` + `data-part="dialog-*"`, styled by `public/components.css:1-60` | no module.css exists |
| **JsonBlock** | Global attribute sheet — `data-pbui-component="json-block"` + `data-part="json-block"`, `components.css:62-78` | + inline `maxHeight` when set (:30) |
| **InspectorPanel** | Global attribute sheet — `data-part="inspector-title"/"inspector-empty"`, `components.css:80-100`; `data-part="inspector-value"` has **no rule** | mixes styled + unstyled parts |
| ContextHelp/HelpContent/builtins/markdown | Global attribute sheet — `data-part` vs `public/presentation-parts.css:279-372`; `data-part="help-action-reason"` unstyled | typography via `Text`/`CodeText` modules |
| TileFrame / DropZoneOverlay | Global attribute sheet — `data-part="tile*"` vs `public/chrome.css:13-100` | + inline `style={{background:tone}}` title bar (:106), `style={ZONE_GEOMETRY[zone]}` overlay (:73) |
| LauncherShell | Global attribute sheet — `data-part="launcher*"` vs `chrome.css:104-153`; `data-part="launcher-status"` unstyled | composed with `Dialog`/`TextInput`/`Text` |

### pbui-workbench

| Component | Mechanism | Mixing |
|---|---|---|
| Tile, Surface, WorkspaceStrip, RebalanceSettings, LinkAnnouncer | CSS module | Tile.tsx:104 passes `"var(--pbui-pane-alt)"` as a JS `tone` prop, not CSS |
| SplitPane | CSS module | + inline `style={{gridTemplateColumns/Rows}}` dynamic ratio (:146) |
| **PortBadge** | CSS module, **em-based, zero `--pbui-*` tokens** | only workbench module with no token reference |
| PortRail | CSS module, mostly raw px (18 occurrences) | one token (`--pbui-pane`) mixed with raw px |
| CoordinationInspector | CSS module, raw px throughout (12) | section headers ("PORTS"/"WIRES") are literal uppercase JSX text, not CSS transform |
| RebalanceBadge | Thin override of core `Button` | only sets `border-color`/`color` |
| RebalanceDialog | CSS module, fully tokenized | + inline computed thumbnail rects (:351-357) |
| WireLayer | CSS module (raw px SVG) | + inline cursor-badge position (:129) |
| Launcher, ShowChooser, RelationPalette | **No own CSS** — delegate to core `LauncherShell` | styled by core `[data-pbui="menu"]` rules |

`workbench-core`: **zero CSS files** — pure logic package.

### pbui-plotscript / pbui-sandbox / pbui-editor

| Component | Mechanism | Mixing |
|---|---|---|
| PlotTile | CSS module | + inline dynamic grid/sizing (`PlotTile.tsx:78,84,97`) |
| ScriptTile (plotscript) | CSS module | tone string literals passed to `Chip` (:62) |
| demo App.tsx (plotscript) | **Global bare classnames** (`className="shell"`), not modules | styled by `demo/src/styles/app.css` |
| InspectorTile, PlaygroundTile, ReplTile, SourceTile, TimelineTile, UINodeRenderer, ScriptTile (sandbox) | CSS module | InspectorTile's TreeOutline has inline computed indent (`TreeOutline.tsx:90`) |
| CodeEditor | CSS module (geometry only) | + inline custom-prop `style={{"--pbui-editor-rows":rows}}` (:155) |
| theme.ts (editor) | Pure `var(--pbui-*)` reads — **zero hardcoded colors**, contrary to the usual "CodeMirror themes hardcode syntax colors" expectation | only literal non-color geometry (`1px`, `3px`, font-weight numbers) |

### pbui-chat

CSS-module-per-component throughout (apps/ChatApp, PanelApp, WidgetApp; composer/Composer; conversations/ContextTile, ConversationsTile, EventsTile, RunsTile, ToolsTile; markdown/PbuiMarkdown; messages/MessageRow, Messages, ToolCard; panels/ChatInspectorPanel, TilesPanel, TracePanel, WatchlistPanel; tools/AcceptStatus, ProposalCard; widget/children/FormChild, StatChild, TableChild, WidgetChild; widget/PbuiWidget, VerbChips), each paired with `data-part`/`data-state`/`data-active`/`data-danger`/`data-family` attribute hooks. Package-level `src/styles.css` is a small global `[data-part="ref"]` sheet for external styling.

Notable mixing: `ContextTile.tsx:81,117`, `ConversationsTile.tsx:203`, `EventsTile.tsx:249` pass `Chip`
a `tone="var(--pbui-tone-…)"` **string prop**, including a **runtime template literal**
(`` `var(--pbui-tone-${entry.family}, var(--pbui-tone-neutral))` ``, EventsTile.tsx:249) — token name built
dynamically rather than statically referenced in CSS. `panels/TilesPanel.tsx:32` mixes a CSS-module class
(`styles.tile`) with core's `<Surface tone="pane" border="hair" padding={0}>` prop-driven box for the same
element. `widget/VerbChips` wraps core `<Button variant="framed" size="tiny">` — its "chip" is not a chip
at all.

Demo (`demo/src/`): App.module.css + 4 app CSS modules (InventoryApp, MetalsApp, NotesApp, SkuApp), plus
`styles/{app,reset,tokens}.css` — a genuine local **tokens.css** (see §2). InventoryApp and SkuApp hardcode
`letter-spacing:0.04em` instead of `var(--pbui-track-label)`.

### pbui-ecommerce

| File | Mechanism | Mixing |
|---|---|---|
| ShopShell.module.css | CSS module | `.strip` hardcodes `gap:10px; padding:4px 8px; border-bottom:1px solid color-mix(...)` — zero tokens despite rest of file being clean |
| tiles.module.css (shared by 7 tiles) | CSS module — header comment claims "Tokens only; no colour literals" | contradicted: 18 raw px, 2 em, 2 opacity, 1 line-height, 6 `color-mix()` calls, only 1 `var()` in the whole file |
| ShopPlot.tsx | consumes tiles.module.css | + inline `style={{width:"100%",height:"100%"}}` (:144) |
| apps.tsx | registration data | `tone: "var(--pbui-cat-N)"` / `"var(--pbui-selected)"` passed as plain prop strings |
| demo App.tsx | **Global bare classnames** (`className="shell"`), not modules — different mechanism from pbui-chat's demo | styled by `demo/src/styles/app.css`, which has **no local tokens.css** |

Package tests `no-hex.test.ts`/`no-raw-controls.test.ts` ban hex/rgb literals and raw `<button>`/inline
`CSSProperties` consts — but the regex doesn't catch `color-mix()`, so all 6 uses slip through, and
`ShopPlot.tsx:144`'s literal JSX `style={{}}` attribute (not a `const`) also slips through.

### datalab-ui (largest package: 45 CSS files, 424 ts/tsx)

Mechanism split is stark: **atoms mostly delegate to core `Chip`** (DocChip, FieldChip, SourceChip,
TokenChip, UserChip — zero local CSS, just `tone="var(--pbui-tone-X)"`), while **6 other atoms each
reinvent badge geometry independently** (ProvenanceBadge, RoleBadge, ScopeChip, StateGlyph, Tick,
TypeBadge — all CSS modules, no two identical, see §4). Of 21 molecules, 9 have CSS modules and 12 are
**pure composition** with zero local CSS/className (DocBar, DraftResumeList, ErrorNotice, MemberInvite,
MemberRow, ScopeChecklist, SpecSummary, StepEditor, TokenRow, TruncationNotice*, UploadItemRow,
UploadQueueList) — *except TruncationNotice, which is entirely **inline-style**, hand-rolling the chip
tone-edge idiom in a raw `style={{}}` object rather than reusing anything. Of 26 organisms, 13 have CSS
modules; **WorkspaceStrip has none at all** and is entirely inline, hand-rolling a different "chip" look
(full firm border, not tone-edge) than every other badge in the repo. `BriefChecklist.tsx:10` imports
`LessonRail.module.css` directly — one organism's stylesheet reused verbatim by a second. Of 24 apps, only
2 (ChartApp, LauncherApp) have any styling of their own; the other 22 are thin shells rendering an
already-styled organism.

Global sheets: `src/styles/tokens.css` (68 tokens, see §2), `brand.css` (a parallel `--brand-*` namespace,
mostly aliasing `--pbui-*`), `dialogs.css` (overrides core's own Dialog chrome — see §4), `plot.css`,
`reset.css`, `scrollbars.css`, `pbui-extras.css`.

---

## 2. Token definitions and overrides

### Where `--pbui-*` tokens are DEFINED

| File | Count | Scope |
|---|---|---|
| `src/tokens.css` (core) | 49 | the canonical/default set, under `:where(:root)` |
| `packages/datalab-ui/src/styles/tokens.css` | 68 | near-superset — restates all of core's tokens (byte-identical values) plus adds a full categorical palette, 9 presentation tones, `space-6`, `border-rule`/`border-grid`, `shadow-hard`/`shadow-menu`, `track-banner`, `selected-wash`, `wash` |
| `packages/pbui-chat/demo/src/styles/tokens.css` | 13 | **only** `--pbui-tone-*` — explicitly documented (file header) as "the one place a colour literal is allowed," a different 8-domain tone vocabulary than datalab's |
| `packages/datalab-ui/src/styles/brand.css` | ~20 `--brand-*` | separate namespace, mostly `var(--pbui-*)` aliases plus new literals (`--brand-fs-hero: clamp(...)`, etc.) |
| `packages/datalab-ui/src/styles/dialogs.css` | 6 `--pbui-dialog-*` | aliases core's dialog tokens + one new literal, `--pbui-dialog-backdrop: rgb(35 38 43 / 28%)` (lighter than core's own dialog backdrop) |
| `src/components/layout/Surface/Surface.module.css:30-39` | re-pointing, not new tokens | `.inverted` block (see below) |

pbui-workbench, pbui-plotscript, pbui-sandbox, pbui-editor, pbui-ecommerce define **no** local tokens.css —
they read core's (or, when hosted inside datalab-ui, datalab's) tokens only. Two exceptions are
self-contained, non-design-token custom properties: `--pbui-editor-rows` (defined and consumed within
`CodeEditor.tsx`/`.module.css`, just a numeric prop channel) and `--pbui-wash` (read with a `var(--pbui-wash,
var(--pbui-paper))` fallback in `pbui-workbench/src/components/Surface/Surface.module.css:9`, but defined
nowhere in workbench or core — only in datalab-ui's tokens.css).

### Value comparison: `src/tokens.css` (core) vs `packages/datalab-ui/src/styles/tokens.css`

All shared names have **identical values** — `paper, pane, pane-alt, ink, ink-on-pane, faint,
faint-inverted, line, selected, danger, ok, border-hair, border-firm, focus-ring, focus-offset, radius,
font, fs-micro/tiny/small/base/title, lh-tight/prose, track-label, space-1..5, tone-field, tone-neutral,
cat-3` all match byte-for-byte between the two files. Datalab-ui **adds** (not present in core at all):

- `wash: #f7f7f4`, `selected-wash: #fffdf4`
- 9 presentation tones: `tone-source:#7cae9b, tone-doc:#c2503a, tone-step:#a99fc9, tone-traceEntry:var(neutral), tone-chart:#e0b95c, tone-cat:#d59a86, tone-geom:#8fc7b0` (core only has `tone-field`/`tone-neutral`/`cat-3` of this family)
- Full categorical palette `cat-1..8` + `ramp-low`/`ramp-high` (core defines **only `cat-3`**, which happens to match datalab's `cat-3` value `#f2ad00` exactly)
- `type-q`, `type-n` (core only has `type-t`)
- `space-6: 24px` (core's scale stops at `space-5`)
- `border-rule: 1px dashed var(--pbui-line)`, `border-grid: 1px solid var(--pbui-line)` (both undefined in core)
- `shadow-hard: none`, `shadow-menu: none` (undefined in core, though core's own `public/*.css` **reads**
  `--pbui-shadow` and `--pbui-shadow-menu` — see gap list below)
- `track-banner: 0.28em` (undefined in core; core's own `public/chrome.css:57` reads `var(--pbui-track-label,
  0.06em)` with a fallback that matches *neither* core's real `track-label` value (0.08em) nor datalab's
  `track-banner`)

Because datalab-ui **restates** rather than imports+extends core's tokens, any future edit to a core value
requires a second, easy-to-miss manual edit in datalab's copy to stay in sync (currently they agree, but
nothing enforces that).

### Tone-name collision between pbui-chat and datalab-ui

Both packages invent an 8-color "domain tone" palette with **different names but overlapping hex values**,
and one name is reused for **opposite** colors:

| Hex | pbui-chat demo name | datalab-ui name |
|---|---|---|
| `#e0b95c` (gold) | `tone-product` | `tone-chart` |
| `#d59a86` | `tone-category` | `tone-cat` |
| `#a99fc9` | `tone-metal` | `tone-step` |
| `#7cae9b` | `tone-order` | **`tone-source`** |
| `#7aa6c9` | `tone-field` | `tone-field` *(same name, consistent)* |
| `#8fc7b0` | `tone-row` | `tone-geom` |
| `#c2503a` (red) | **`tone-source`** | `tone-doc` |
| `#8892a8` | `tone-neutral` | `tone-neutral` *(same name, consistent)* |

`--pbui-tone-source` means **green** (`#7cae9b`) in datalab-ui and **red** (`#c2503a`) in pbui-chat — a
direct naming collision that would render wrong if either package's CSS ever loaded inside the other's
token scope.

### Tokens READ but defined NOWHERE (real gaps, with `var()` fallback so they degrade rather than break)

| Token | Read at | Fallback given |
|---|---|---|
| `--pbui-border-hairline` | `public/presentation-parts.css:306` | `1px solid #d8d4cc` — almost certainly a typo for `--pbui-border-hair` |
| `--pbui-muted` | `public/presentation-parts.css:234` | `#6b6760` |
| `--pbui-shadow` | `public/presentation-parts.css:292` | `rgba(31,36,48,0.18)` |
| `--pbui-shadow-menu` | `src/styles.css:149` | none given at that call site (datalab defines it as `none`, core doesn't define it at all) |
| `--pbui-well` | `public/presentation-parts.css:331` | `#f1efe9` |
| `--pbui-tone-widget` | `pbui-sandbox` — 8 call sites across `createScriptApp.tsx`, `createSandboxDevtools.tsx`, `SourceTile.tsx`, `InspectorTile.tsx`×2, `TimelineTile.tsx`, `PlaygroundTile.tsx`, `ScriptTile.tsx` | **none** — passed as a bare `tone="var(--pbui-tone-widget)"` string with no CSS-level fallback; only ever defined in `pbui-chat/demo/src/styles/tokens.css`, i.e. pbui-sandbox ships components that only render a tone in a consumer that happens to define this exact name |
| `--pbui-tone-datum` | `packages/datalab-ui/src/apps/UploadApp/UploadApp.tsx:326` | **none** — a live, unresolved reference; already flagged as a known bug in a comment at `packages/datalab-ui/src/pbui/descriptors/upload.ts:7-12` ("has never existed... every upload chip rendered with no tone at all") but the fix was never propagated back to `UploadApp.tsx` |
| `--page` (not `--pbui-*`) | `packages/datalab-ui/src/styles/plot.css:9` (`--hs-plot-page: var(--page)`) | none, and `--page` is not defined anywhere in `src/` |
| `--pbui-cat-1`, `--pbui-cat-2`, `--pbui-cat-4` | `packages/pbui-ecommerce/src/apps.tsx:71,87,104,117,130,143,171` | none — resolve fine when the demo also loads datalab's tokens, but **pbui-ecommerce's own demo only imports core's `styles.css`**, which defines just `cat-3`; `cat-1/2/4` are undefined in that runtime |

Story-only gaps (referenced exclusively in `*.stories.tsx`, not shipped logic): `--pbui-cat-1/2/4/5`,
`--pbui-tone-source/doc/step/chart/danger`, `--pbui-type-q`, `--pbui-ramp-low/high` — the Foundation
story's categorical-palette demo needs 8 tones and core only ships 1.

### Fallback-value drift inside core's own `public/*.css`

The three public sheets carry `var(--x, #hex)` fallbacks "transcribed from datalab-ui" (per
`presentation-parts.css:16`) at a point in time before `tokens.css` was finalized, and several now
**disagree** with the live token:

| Token | `tokens.css` value | `public/*.css` fallback | Where |
|---|---|---|---|
| `--pbui-ink` | `#23262b` | `#1f2430` | chrome.css:22,38,39,96,141; presentation-parts.css:33,60,101 |
| `--pbui-selected` | `#fdeec6` | `#e6ecf5` | presentation-parts.css:34,42,124,140; chrome.css:140 |
| `--pbui-paper` | `#ffffff` | `#f6f4ef` | presentation-parts.css:102,200,220,256; chrome.css:95 |
| `--pbui-faint` | `#696e75` | `#8b857a` | presentation-parts.css:130,135,144,169,187; chrome.css:146 |
| `--pbui-line` | `#d9d9d4` | `#cfc9bd` (presentation-parts.css:114) / `#d8d2c6` (:147,162,170,306) — even the fallback disagrees with itself | — |
| `--pbui-track-label` | `0.08em` | `0.06em` | chrome.css:57 |

If any token ever failed to resolve, these fallback slots encode a **second, silently divergent palette**,
not the real one.

### Surface theme re-pointing (the only such block in the repo)

```css
/* src/components/layout/Surface/Surface.module.css:30-39 */
.inverted {
  background: var(--pbui-ink);
  color: var(--pbui-paper);
}
.inverted :where(*) {
  --pbui-ink: var(--pbui-paper);
  --pbui-faint: var(--pbui-faint-inverted);
  --pbui-line: var(--pbui-faint-inverted);
}
```
Deliberately excludes `--pbui-ink-on-pane` (kept out so a control painting its own pale background stays
legible on a dark bar, per `tokens.css:86-93`). No other package defines an analogous "inverted" re-point.

---

## 3. Hardcoded values that bypass tokens

| Package | Hex | rgb/rgba | Raw px (approx) | border-radius>0 | box-shadow | Notes |
|---|---|---|---|---|---|---|
| core `src/tokens.css` | 23 (expected — the definitions) | 1 (`--pbui-dialog-backdrop`) | — | — | — | correct location |
| core `public/*.css` | **60** (all `var(x,#hex)` fallbacks) | 4 | several (`chrome.css:115,123,135` literal `2px` instead of token-wrapped) | 3 (`components.css:21,46,67` — Dialog panel/close, JsonBlock, one hardcoded `0.25rem` each) | 1 blurred (`presentation-parts.css:163`, contradicts the system's own "offset, never blurred" shadow rule) | Dialog/JsonBlock/InspectorPanel are **entirely `rem`-based**, the only 3 core components off the px `--pbui-space-*` scale |
| core `src/**/*.module.css`+tsx | 0 | 0 | — | 0 | 0 | fully token-clean |
| pbui-workbench | 0 | 0 | ~53 across PortRail(18)/CoordinationInspector(12)/WireLayer(11)/RebalanceDialog(9)/SplitPane(7)/PortBadge(3)/LinkAnnouncer(2)/RebalanceSettings(1) | 2 (PortRail:39 `3px`, PortBadge:8 `2px`) | 1 token-composed (`RebalanceDialog.module.css:58`) | PortBadge uses `em` units, not tokens, throughout |
| pbui-plotscript | 0 | 0 | 1 (`ScriptTile.module.css:30 gap:2px`) | 0 | 0 | cleanest package audited |
| pbui-sandbox | 0 | 0 | ~4 (mixed literal+token in same decl, e.g. `TimelineTile.module.css:39`) | 1 (`InspectorTile.module.css:45 2px`) | 0 | `--pbui-tone-widget` string (undefined, see §2) is the dominant "looks hardcoded" issue |
| pbui-editor | 0 | 0 | ~4 (`textUnderlineOffset:"3px"`×3, one `1px` outline) | 0 | 0 | `theme.ts` is 100% token-driven, including syntax colors |
| pbui-chat | 0 | 0 | 6 (`1px`/`2px` spacing in ToolsTile/EventsTile/RunsTile/ContextTile/ConversationsTile) | 0 | 0 | 2 hardcoded `letter-spacing:0.04em` in demo (InventoryApp, SkuApp) instead of the token |
| pbui-ecommerce | 0 (test-enforced) | 0 (test-enforced) | **23** in tiles.module.css(18)+ShopShell(4)+demo app.css(3, some overlap) | 0 | 0 | **6 `color-mix()` calls** slip past the no-hex lint; file header claims "tokens only," body contradicts it |
| datalab-ui | 2 (1 live dup of `--brand-line`, 1 in a comment) | 1 (`dialogs.css:35`) | concentrated in MarketingPage.module.css (10 font-sizes: 10/12/12.5/13/14/17px) + Tick (17×17 fixed) + a handful of one-off gutters | 0 (all 3 radius decls resolve to `var(--pbui-radius)`=0) | 1 real (`MarketingPage.module.css:211`, deliberate offset-shadow CTA) | 71 padding / 46 margin / 45 gap decls vs 154 `var(--pbui-space-N)` uses — token-driven overall, hardcoding concentrated in the one "document" page |

### Most notable examples (file:line — value)

1. `public/components.css:70` — `font: 0.8125rem/1.5 ui-monospace, SFMono-Regular, Consolas, monospace;` (JsonBlock) — bypasses `--pbui-font` entirely, uses `rem`.
2. `public/chrome.css:87` — `rgba(182, 75, 55, 0.16)` drop-zone tint, no token at all.
3. `public/presentation-parts.css:163` — `box-shadow: 0 8px 24px rgb(0 0 0 / 0.12)` — a blurred shadow, contradicting the design system's stated offset-only shadow rule (Foundation.stories.tsx:66).
4. `pbui-workbench/src/components/PortRail/PortRail.module.css:12,72,88` — `font-size: 12px/14px/11px` off the 8.5/9.5/10.5/11.5/13px type scale.
5. `pbui-ecommerce/src/tiles/tiles.module.css:31-34` — `font-size:11px; letter-spacing:0.04em; text-transform:uppercase; opacity:0.7;` on `.table th`, despite the file's own "tokens only" header comment.
6. `pbui-ecommerce/src/ShopShell/ShopShell.module.css:15-17` — `.strip { gap:10px; padding:4px 8px; border-bottom:1px solid color-mix(in srgb, currentColor 15%, transparent); }` — zero tokens in a file that's otherwise clean.
7. `pbui-chat/demo/src/apps/InventoryApp/InventoryApp.module.css:56` and `SkuApp.module.css:24` — `letter-spacing: 0.04em;` instead of `var(--pbui-track-label)`.
8. `packages/datalab-ui/src/components/pages/MarketingPage/MarketingPage.module.css:353` — `color: #d9d9d4` — a hardcoded duplicate of `var(--brand-line)`/`var(--pbui-line)`, which already equals that exact hex.
9. `packages/datalab-ui/src/components/atoms/Tick/Tick.module.css:10-11` — `width:17px; height:17px` fixed square, off any scale.
10. `packages/datalab-ui/src/components/atoms/TypeBadge/TypeBadge.module.css:19` — `border: 1px solid var(--pbui-ink);` — literal `1px solid`, the only badge not using `var(--pbui-border-hair)`.

### Distinct spacing values used across the repo, vs the 5-step token scale

Declared scale (core, chat, workbench, plotscript, sandbox, editor): **2, 4, 6, 10, 16px**
(`--pbui-space-1..5`). Datalab-ui privately extends it with **`space-6: 24px`**, never promoted to core.

Distinct hardcoded px values actually observed in padding/margin/gap across the whole repo: `1, 2, 3, 4, 6,
7(fallback), 8, 9, 10, 11, 12, 14, 16, 22, 24, 26, 28, 44, 46, 58, 64, 70, 78, 96, 108, 120, 150, 188, 220,
240, 260, 280, 320, 380, 480, 544, 680, 720, 820, 900, 1200`. Below ~30px these are almost all
spacing-idiom violations concentrated in `pbui-workbench/PortRail.module.css`,
`pbui-workbench/CoordinationInspector.module.css`, `pbui-ecommerce/tiles.module.css`, and
`datalab-ui/MarketingPage.module.css`/`TourSection.module.css`; above ~60px they are mostly legitimate
component widths (dialog widths, thumbnail widths, launcher/menu min-widths, viewport breakpoints), not
spacing-rhythm values, and shouldn't be judged against the space scale at all.

---

## 4. Recurring visual patterns implemented more than once

This is the highest-value section: the same handful of visual ideas are independently re-authored in
almost every package.

### 4.1 Chips / badges / tags — the flagship duplication

At least **15 distinct implementations** of "small labeled box conveying category, state, or tone" exist,
no two with identical padding/font-size/border/background:

| Implementation | Padding | Font-size | Border | Background | Uppercase/tracking |
|---|---|---|---|---|---|
| core **Chip** (canonical) | — (module-defined) | `var(--pbui-fs-small)` | `var(--pbui-border-hair)` + 4px tone-left-edge (`border-left: var(--pbui-tone-edge) solid`) | pane | no |
| workbench **PortBadge** | `0 0.4em` (em-based!) | `0.85em` | `1px solid currentColor`; state via border-**style** (double/dashed/dotted) | transparent | `letter-spacing:0.02em`, no uppercase |
| workbench **RebalanceBadge** | inherited from `Button` | inherited | overrides only `border-color`/`color` on `Button[variant=framed,size=tiny]` | inherited | — |
| chat **VerbChips** | inherited from `Button` | inherited | `Button[variant=framed,size=tiny]` — not a chip at all | inherited | — |
| datalab **ProvenanceBadge** | none (`<abbr>`) | `fs-micro` (8.5px) | `border-bottom:1px dotted var(--pbui-faint)` | none | uppercase + `track-label` |
| datalab **RoleBadge** | `0 0.25em` | `fs-tiny` (9.5px) | `var(--pbui-border-hair)` | transparent | no |
| datalab **ScopeChip** | `0 var(--pbui-space-2)` | `fs-tiny` | `border-grid` (privileged: `border-hair`) | `pane-alt` | no |
| datalab **StateGlyph** | none | `fs-small` | none | none | no — glyph carries meaning, color is reinforcement only |
| datalab **Tick** | none (fixed box) | `fs-tiny` | `border-firm` (2px) | state-dependent | no — fixed **17×17px**, only literal-px badge in the family |
| datalab **TypeBadge** | `0 2px` | `fs-micro` | **literal `1px solid var(--pbui-ink)`** (not the token) | inline dynamic tone | no |
| datalab **StepRow `.kind`** | `0 space-3` | `fs-tiny` | hairline + 4px tone-left-edge (hand-copied Chip geometry) | pane | uppercase |
| datalab **TruncationNotice** (inline, no CSS module) | `space-2 space-3` | inherited | hairline + 4px tone-left-edge (hand-copied a 3rd time, in a raw `style={{}}` object) | pane-alt | no |
| datalab **TracePanel `.kind`** | `0 space-2` | `fs-micro` | hairline (hand-copied a 4th time) | inline dynamic tone | no |
| datalab **TemplateTable `.kind`/`.app`** | `0 space-3` | inherited | hairline (hand-copied a 5th time, "same geometry as TracePanel, deliberately" per comment — but copy-pasted CSS, not shared) | pane (app only) | no |
| datalab **WorkspaceStrip** (inline, no CSS module) | `0 space-4` | `fs-small` | **full `border-firm`**, not tone-edge at all — the one outlier | selected/pane-alt toggle | no — signals active via `font-weight:700` instead |

Five of these (StepRow, TruncationNotice, TracePanel, TemplateTable ×2) are independent hand-copies of
*the same* "hairline box + 4px tone-left-edge" idea that core's `Chip` already implements once, correctly,
as a component.

### 4.2 Uppercase tracked labels

The canonical pairing is `text-transform:uppercase` + `letter-spacing:var(--pbui-track-label)` (0.08em),
defined once in `src/components/foundation/Text/Text.module.css:58-64` (SectionLabel). At least **5
different tracking values** are in live use for what is visually the same idiom:

- **0.08em** (the token, correct): SectionLabel; datalab's ModuleCard, StepRow, LauncherDialog, SignUpPanel, ProvenanceBadge, Lockup, Tile.tsx:87 (inline).
- **0.04em** (hardcoded, not the token — appears independently in 6+ files, suggesting it predates the token or was copied before rounding): `public/presentation-parts.css:309-312` (help-title), `pbui-workbench/CoordinationInspector.module.css:36-37`, `pbui-sandbox/UINodeRenderer.module.css:65-66`, `pbui-chat/demo/InventoryApp.module.css:56`, `pbui-chat/demo/SkuApp.module.css:24`, `pbui-ecommerce/tiles.module.css:32,75`.
- **0.02em**: `pbui-workbench/PortBadge.module.css:11`, `PortRail.module.css:90` (state text — tracking without uppercase).
- **No letter-spacing at all** despite `text-transform:uppercase`: `pbui-chat/composer/Composer.module.css:16-21` (`.type`), `pbui-chat/panels/WatchlistPanel.module.css:17-22` (`.type`).
- **0.1em**, **0.14em** (`--brand-track-eyebrow`), **0.28em** (`--pbui-track-banner`, masthead-only by design): all three confined to `datalab-ui/MarketingPage.module.css`/`brand.css`/`Workbench.module.css` — the one place a 3rd/4th/5th tracking value is *intentionally* distinct, but nothing prevents it from being confused with the other 4.
- **`public/components.css:90-96`** (`[data-part="inspector-title"]`): a fully independent 6th uppercase-label rule, hardcoded `font-size:0.75rem` (off the px scale) + `letter-spacing:0.08em` (matches the token's *value* but not by reference).
- **`public/chrome.css:53-58`** (`[data-part="tile-title"]`): a 7th, whose fallback `var(--pbui-track-label, 0.06em)` doesn't match either the real token (0.08em) or any of the other hardcoded values above.

### 4.3 Hairline-bordered header/toolbar bars

Core's `Toolbar.module.css:12-13` (`.bordered { border-bottom: var(--pbui-border-hair) }`) is the intended
shared primitive, and it *is* reused consistently as `Toolbar[tight]` for every tile header across
pbui-ecommerce (7 tiles), pbui-sandbox (5 devtools tiles), pbui-plotscript (2 tiles), and pbui-workbench's
CoordinationInspector. But several packages independently re-declare the same visual bar instead of using
it:

- `src/components/molecules/DiffHunk/DiffHunk.module.css:13-22` — own `.header` (border-bottom hairline + `pane-alt` background).
- `src/components/organisms/TransportBar/TransportBar.module.css:8-15` — own `.transport`, same shape again.
- `public/chrome.css:32-40` `[data-part="tile-bar"]` — a **firmer** 2px border, one level heavier than the Toolbar hairline.
- `pbui-chat/panels/TilesPanel/TilesPanel.module.css:13-21` — own `.head` (hairline + `pane-alt` + space tokens) — correctly token-driven, but a 4th independent hand-authored bar rather than `Toolbar`.
- `pbui-ecommerce/ShopShell/ShopShell.module.css:12-18` — own `.strip`, built from **raw px + `color-mix()`**, not tokens at all — the least consistent of the group.
- `datalab-ui/Workbench.module.css` `.chrome`/`.header` — uses `var(--pbui-border-grid)`, a token that **doesn't exist in core** (only in datalab's tokens.css) — so this bar renders differently by definition outside datalab.

### 4.4 Tile header rows (title + status)

`Toolbar[tight]` + title `Text[strong]` + `<span className={styles.spacer}/>` + faint status `Text` is
copy-pasted **verbatim** across all 7 pbui-ecommerce tiles (CustomerDetail:31, CustomersTable:21,
Inspector:31, OrderDetail:42, OrdersTable:54, ProductCatalog:30, ShopPlot:124) and reproduced with the same
shape in every pbui-sandbox devtools tile and both pbui-plotscript tiles. datalab-ui's `organisms/Tile`
does *not* draw this bar itself (the bar belongs to `TileFrame` in pbui-workbench's own chrome) — it only
contributes the title text (`Tile.tsx:22-106`) with an inline `textTransform:uppercase;
letterSpacing:var(--pbui-track-label)` (a further, 8th instance of the uppercase-label pattern from §4.2).

### 4.5 Empty-state text

The one genuinely unified pattern: core `<EmptyState message hint>` is reused as-is by ecommerce (4
tiles), chat (ChatInspectorPanel, ConversationsTile, EventsTile, WidgetApp), workbench (Tile, Surface),
plotscript (PlotTile), sandbox (InspectorTile), and 10 datalab-ui files (ModulesApp, BriefApp, LessonsApp,
CheatApp, TemplateTable, ProfilePanel, TokensPanel, SourcePanel, UploadQueueList, MemberPanel) — with zero
local CSS overrides anywhere. The one crack: core's **own** `public/components.css:98-100`
(`[data-part="inspector-empty"] { color:#64748b }`) is a **second, independent** empty-state treatment
inside core itself, hardcoding a grey that doesn't match `var(--pbui-faint)` (`#696e75`) used by the real
`EmptyState` component.

### 4.6 Key/value rows

At least 7 near-identical grids, none sharing a component:

- `public/presentation-parts.css:335-349` `[data-part="help-fields"]` — grid `max-content 1fr`, `gap:0 var(--pbui-space-3, 7px)` (the off-scale fallback from §3).
- `pbui-chat/conversations/ContextTile/ContextTile.module.css:37-49` `.facts` — grid `max-content minmax(0,1fr)`, token gap.
- `pbui-ecommerce/tiles/tiles.module.css:63-80` `.facts` — same grid shape, but **raw px** `column-gap:12px; row-gap:3px` instead of tokens.
- `pbui-sandbox/devtools/InspectorTile/InspectorTile.module.css:87-88` `.facts` — same grid shape again.
- `datalab-ui/molecules/ModuleCard/ModuleCard.module.css` — `<dl>` grid, needs a local `.label{margin:0}`/`.value{margin:0}` fix-up because `reset.css` zeroes `dl`/`dd` margins but not `dt`.
- `datalab-ui/molecules/CheatCard/CheatCard.module.css` — flex-based (not grid) key/value, fixed `.term{width:108px}` gutter.
- `datalab-ui/molecules/SpecDiff/SpecDiff.module.css` — two fixed gutters (`.key:78px`, `.value:min-width 150px`) for a 3-column diff.

### 4.7 Code / JSON blocks

Core `JsonBlock` (itself off-token, `rem`-based per §3) is reused correctly by `pbui-ecommerce/Inspector.tsx:44`
and `pbui-chat/ContextTile.tsx:148,158`. But `pbui-chat/markdown/PbuiMarkdown/PbuiMarkdown.module.css:31-38`
independently reimplements a bordered code block (`.pre { border:border-grid; background:pane-alt }`)
rather than reusing JsonBlock. `pbui-editor`'s CodeMirror `CodeEditor` (100% token-driven, per §1) is
correctly reused by `pbui-plotscript/ScriptTile.tsx:88` and `pbui-sandbox/SourceTile.tsx` (read-only
variant). **datalab-ui has no code-block styling at all** — `reset.css:91-96` only sets
`code,pre,kbd,samp{font-family:inherit}`; there is no shared "code block" primitive across the whole repo
even though 3 different packages need one.

### 4.8 List rows with hover state

- core: `FileBrowser.module.css:37-40` and `public/presentation-parts.css:122-125` (`menu-item:hover`) both use `var(--pbui-selected)` — consistent within core.
- `pbui-chat/conversations/ConversationsTile/ConversationsTile.module.css:46-48` — `[data-active="true"] { background: var(--pbui-pane-alt) }` — a **different token** (`pane-alt`, not `selected`) for what is conceptually the same affordance.
- `pbui-ecommerce/tiles/tiles.module.css:100-111` — `color-mix(in srgb, currentColor 5%, transparent)` hover / `12%` selected — bypasses both tokens entirely.
- `pbui-workbench/SplitPane.module.css:43-46` — divider hover, `var(--pbui-pane-alt)` again.
- datalab-ui explicitly does **not** style row hover locally in any of TablePanel/MemberRow/StepRow/ChannelRow — delegated to core's `Presentation`/`data-part` system in the consuming app (only 5 files in the whole package even contain `:hover`).

Net: three different tokens (`selected`, `pane-alt`, `color-mix()`) used for what is visually meant to be
one state.

### 4.9 Dialogs

Core `Dialog` + `public/components.css` (rem-based, per §3) is the shared base, correctly reused by
`pbui-workbench/RebalanceDialog` and `pbui-ecommerce`'s implicit dialogs. But **datalab-ui overrides core's
own Dialog chrome wholesale** via `src/styles/dialogs.css`, whose header comment explicitly states the
override exists "to match the workbench's hairline-square idiom" — i.e., core's own default Dialog styling
does not match core's own design language closely enough for datalab to use it unmodified.
`BundleDialog.module.css` and `LauncherDialog.module.css` layer further package-specific rules on top
(sticky group headers, `[data-active]`/`[data-disabled]` state selectors).

### 4.10 Inspector panels

Five+ independent implementations share no base beyond the generic (and itself off-token, per §3) core
`InspectorPanel`: `pbui-workbench/CoordinationInspector` (raw-px `<table>` sections for ports/wires/contexts/
violations, literal-uppercase JSX text instead of CSS transform), `pbui-sandbox/InspectorTile` +
`StatePane` + `TreeOutline` (tabbed, token-clean), `pbui-ecommerce/Inspector` (delegates entirely to core
`JsonBlock` — the cleanest reuse of the group), `pbui-chat/ChatInspectorPanel` (minimal, 3 rules),
`datalab-ui/TracePanel` + `EncodingPanel` (distinct, token-based, unrelated to each other's markup shape).

### 4.11 Scroll containers

The single most repeated raw declaration in the entire repo: `flex:1 (or 1 1 auto); min-height:0;
overflow:auto` (sometimes `overflow-y:auto`). Present 12+ times in core alone (`AppBody`, `FileBrowser`,
`ResultLog`, `DiffHunk`, `chrome.css` tile-body/launcher-results, `components.css` dialog-panel/json-block/
inspector-panel, `presentation-parts.css` menu/context-help/help-markdown-code), and re-declared locally in
essentially every tile across every package (every pbui-sandbox devtools tile, both plotscript tiles, every
pbui-chat panel, every pbui-ecommerce tile body, datalab's LauncherDialog/LessonRail/ModuleRack). Core's
`AppBody` component already exists specifically to package this pairing plus padding, but most
packages don't reach for it — they hand-copy the two-line CSS rule into their own module instead. Datalab
adds a global `scrollbars.css` (thin, `pane`/`line`-colored thumb) that applies universally, independent of
which container sets `overflow`.

---

## 5. Nesting / box structure

Legend: properties shown are the ones that actually paint (border/background/padding); pure layout
properties (display/flex/grid template) are abbreviated.

### Core primitives — the intended layering

```
TileFrame            <section data-part="tile">                    [chrome.css:15-24]
                        border: var(--pbui-border-firm)  (2px)
                        background: var(--pbui-pane)
  ├─ <header data-part="tile-bar">                                  [chrome.css:32-40]
  │    background: <inline, product-supplied tone>  (TileFrame.tsx:106)
  │    border-bottom: var(--pbui-border-firm)
  │    padding: var(--pbui-space-1) var(--pbui-space-3)
  │    └─ [data-part="tile-title"]  uppercase, ellipsis
  └─ <div data-part="tile-body">                                    [chrome.css:71-77]
       flex:1; overflow:auto — NO border/background of its own
       └─ <product content>, typically:

Surface   <div class="surface [tone] [border] [pad-N]">             [Surface.module.css:2-7]
            background: var(--pbui-pane) (or .alt/.selected/.inverted)
            border: none by default; .hair=1px / .firm=2px          (opt-in)
            padding: 0 by default                                    (opt-in via pad-N)

AppBody   <div class="body [flush]">                                [AppBody.module.css:9-18]
            padding: var(--pbui-space-3) var(--pbui-space-4)  (6px 10px); .flush → 0
            NO border, NO background — scroll+padding only, relies on an ancestor Surface

Stack     <div class="stack [gap-N]">                                [Stack.module.css:8-12]
            NO border, NO background, NO padding — ever. gap only.

Toolbar   <div class="toolbar [bordered] [tight]">                   [Toolbar.module.css:2-17]
            padding: 6px 10px (.tight → 2px 6px); .bordered → border-bottom hairline only
            NO background of its own, ever.
```

**Net rule in core**: border + background live on `Surface`/`TileFrame`; padding lives on
`AppBody`/`Toolbar`/`Surface.pad-N`; `Stack` never paints anything. This rule is *not* consistently
followed once you leave core — see below.

### pbui-workbench Tile / Surface / SplitPane

```
Tile → div.cell [data-part=workbench-tile]
  <TileFrame> (core, draws the bordered chrome — see above)
    div.body
      div.app  (consumer content, no padding of its own)
      | div.empty          padding: var(--pbui-space-4)
      <PortRail> (link mode)   position:absolute; inset:0

Surface → div.surface [data-part=workbench]
  background: var(--pbui-wash, var(--pbui-paper))   ← undefined token, falls back to paper outside datalab
  <SplitPane> or <Tile>  (recursive)
  div.placing [data-part=workbench-placing]  position:fixed
    background: var(--pbui-ink); padding: var(--pbui-space-2) var(--pbui-space-4)

SplitPane → div.split [data-part=split]
  div.pane (no border/background)
  div.divider [role=separator]   background:transparent by default
    :hover/:focus-visible → background: var(--pbui-pane-alt)
    [data-state=dragging]  → background: var(--pbui-selected)
    [data-state=snapped]   → background: var(--pbui-ok)
    span.grip   border-{left|top}: 2px dotted var(--pbui-line)
  div.pane
```

### pbui-plotscript PlotTile / ScriptTile

```
PlotTile → div.app [data-part=plot-view]
  <Toolbar tight>  title / Chip(stale) / spacer / row-count
  <AppBody flush>.body   padding: var(--pbui-space-2); overflow:hidden
    <ResponsivePlot>.plot  (single-plot)
    | div.grid [data-part=plot-grid]   gap: var(--pbui-space-2)
        div.cell (×N)   border: var(--pbui-border-hair); padding: var(--pbui-space-1)

ScriptTile → div.app [data-part=plot-script]
  <Toolbar tight>
  <AppBody flush>.body   grid-rows: 1fr auto
    div.editor   padding: var(--pbui-space-2)
      <CodeEditor>
    div.output [data-part=plot-script-output]
      gap:2px (hardcoded); max-height:8em; overflow:auto
      padding: var(--pbui-space-1) var(--pbui-space-2)
      border-top: var(--pbui-border-hair)
```

### pbui-sandbox tiles (all 5 devtools tiles share this shape)

```
div.app [data-part=…]
  padding: var(--pbui-space-2)              ← identical outer padding on every tile
  gap: var(--pbui-space-2)                   ← self-pads AND gap-spaces, simultaneously
  <Toolbar tight>.header
    Chip[tone=var(--pbui-tone-widget)]  (undefined token, §2), status controls, spacer, tabs
  div.body|.split|.log|.list|.versions
    flex:1; overflow:auto            ← identical scroll shape on every tile
    rows: border-top/bottom hairline, own gap: var(--pbui-space-1|2)
```
InspectorTile specifically: `.body` (scroll) → `.outline` (`<ul>` reset) → `.row` (`<li>`, `padding:1px
var(--pbui-space-1); border-radius:2px` — the package's one hardcoded radius) → inline children.

### pbui-chat TilesPanel / ContextTile / ConversationsTile / EventsTile

```
TilesPanel  [data-part="tiles"] .tiles              gap: var(--pbui-space-3)
  └─ <Surface tone=pane border=hair padding=0> .tile
       ├─ .head    border-bottom:hair; bg:pane-alt; padding: space-1 space-3
       └─ .body    padding: var(--pbui-space-3)

ContextTile [data-part="conversation-context"] .app  gap:space-2; padding:space-2  (both, at once)
  ├─ Toolbar.header
  └─ section[data-part="context-section"] .section    border-top:hair; padding-top:space-1
       └─ dl.facts (grid) or ol.tools (list-none)
            └─ li[data-part="manifest-tool"] .tool     padding: 1px 0

ConversationsTile [data-part="conversations"] .app     gap:space-2; padding:space-2
  ├─ Toolbar.header
  └─ ol.list   overflow:auto; flex:1 1 auto
       └─ li[data-part="conversation-row"][data-active] .row
            gap:2px; padding:space-1; border-bottom:hair
          └─ div.meta → Chip[tone="var(--pbui-tone-…)"]

EventsTile [data-part="chat-events"] .app              gap:space-2; padding:space-2
  ├─ Toolbar.header, [role=group] Toolbar.families
  └─ ol.list  overflow:auto
       └─ li[data-part="event-row"] .row   grid; padding:2px space-1; border-bottom:hair
```

### pbui-ecommerce ShopShell + tiles

```
ShopShell [data-part="shop-shell"] .shell    grid-rows: auto minmax(0,1fr)
  ├─ .strip   gap:10px; padding:4px 8px; border-bottom:1px solid color-mix(…15%…)
  │     Text(title) / workbench.WorkspaceStrip / .spacer / Text(hint)
  └─ .surface
        └─ workbench.Surface  (external tile layout engine)

<Tile>  [data-part="…"] .app    grid-rows: auto minmax(0,1fr)
  ├─ Toolbar.tight (core, no local CSS)  title / [Chip] / .spacer / status Text
  └─ AppBody[flush] .body   overflow:auto — ZERO padding
        .detail   padding:10px 12px; grid; gap:10px         (re-introduces padding one level down)
          .big  font-size:22px; weight:600
          dl.facts  col-gap:12px; row-gap:3px   (raw px, not tokens)
          table.table   collapse; font-size:12px
            th  sticky; padding:6px 8px; border-bottom:1px solid color-mix(…20%…)
            td  padding:4px 8px; border-bottom:1px solid color-mix(…8%…)
        OR table.table directly, tr[data-selected].row (hover→color-mix 5%, selected→12%)
        OR .empty  grid place-items:center; padding:12px
        OR .plot   100%×100%
```

### datalab-ui organisms/Tile, pages/Workbench, pages/WorkbenchInstance, WorkspaceStrip

```
TileFrame  [EXTERNAL — pbui-workbench chrome, border/background/padding not visible here]
 ├─ [title-bar slot] → TileTitle
 │    Presentation .viewTitle  overflow:hidden
 │      span .viewTitleText (inline: uppercase; letter-spacing:track-label)
 │        Text[strong] label + span[data-part="tile-linked"] "×N"
 └─ [action-group slot] → IconButton[framed,tiny]  (core, no local style)

Workbench (+ WorkbenchShell)
 div.app   height:100vh
  div.shell   background: var(--pbui-paper)
   ├─ Surface[tone=inverted]  (masthead)
   │    Toolbar[tight] → .wordmark (track-banner) / .tagline (track-label) / StageBar
   ├─ div.chrome   border-bottom: var(--pbui-border-grid)   ← token undefined outside datalab
   │    WorkspaceStrip / .chromeSpacer / .chromeAction(padding:space-1 space-3)
   ├─ div.canvas   padding: var(--pbui-space-3)
   │    → workbench.shell.Surface  [EXTERNAL]  → [tiles]
   └─ (siblings) BundleDialog / LauncherDialog / Dialog / ObjectMenu / ContextHelp

WorkbenchInstance
 div.root  (+ .expanded → position:fixed; padding:space-3; background:wash)
   div.instance   border: var(--pbui-border-firm); background: var(--pbui-paper)
     WorkbenchShell (chromeless)  → same tree as above

WorkspaceStrip  — NO border/background of its own container
 Toolbar[tight]
   SectionLabel "Workspaces"
   Stack[row,gap=2,wrap]
     per-space: Presentation → span (inline)
        border: var(--pbui-border-firm)  (full, not tone-edge — see §4.1)
        background: current? selected : pane-alt
        padding: 0 space-4; font-weight: current? 700 : 400
     Button[raised, fill="var(--pbui-tone-source)"]  "+ workspace"
```
Note: WorkspaceStrip's visual "strip" separation is entirely the *parent* `.chrome{border-bottom}` rule in
`Workbench.module.css` — the component itself has no box of its own, unlike every sibling that owns its own
border.

---

## 6. Spacing / margin conventions

### Cross-cutting rule

The dominant, mostly-followed convention across the whole repo is **zero self-margin, spacing via parent
`gap`**, with padding pushed down to leaf/content containers (`AppBody`, `Toolbar`, `Surface.pad-N`,
individual rows) while structural wrappers (`Stack`, bare `Surface`, tile frame/body) stay at zero padding.
`Stack` is structurally incapable of margin or padding — it only ever sets `gap`.

### Components that set their own outer margin (deviating from pure gap-reliance)

- `src/components/foundation/Divider/Divider.module.css:1-4` — margin **is** Divider's entire job (`.space-2/3/4` set `margin: var(--pbui-space-N) 0`); the intended exception.
- `src/components/molecules/MoreBar/MoreBar.module.css:9-12` — `margin-top: var(--pbui-space-1)` on top of whatever gap the parent `Stack` already applies — compounds spacing.
- `public/presentation-parts.css:303-307` `[data-part="help-item"] + [data-part="help-item"]` — margin-top + padding-top + border-top all combined for one separator.
- `pbui-workbench/Tile.module.css:44` `.retry { margin-top: var(--pbui-space-3) }` — self-margin inside a `.empty` padded box (not a gapped flex), so this one is *not* double-spacing.
- `pbui-workbench/CoordinationInspector.module.css:30` `.table { margin-top: 4px }` — hardcoded px, **and** the parent `.pad` grid already has `gap:12px` — a genuine double-spacing case.
- `pbui-workbench/PortBadge.module.css:5` `margin-inline-start: 0.6em` — necessary because PortBadge is rendered inline after a title text node, with no gapped-flex parent to rely on.
- `pbui-chat/ContextTile.module.css:85` `.refs { margin-top: 2px }` — a bare micro-nudge below the smallest defined space token.
- `datalab-ui`: `RoleBadge.module.css:5` (`margin-left:space-2`, appended inline after arbitrary text), `GoalItem.module.css:5` (`margin-bottom:space-3`, raw `<ul>` block-flow, not a `Stack`), `CheatCard.module.css:41`, `PredictPrompt.module.css:5`, `LessonStep.module.css:74`, `ChartApp.module.css:11` — these cluster in components whose comments cite extraction from a pre-`Stack` prototype ("pbui-gog.jsx" refactors) rather than being authored fresh against `Stack`.

### Components that both self-pad AND gap their children (the common "self-contained tile" idiom)

- Every pbui-sandbox devtools tile's `.app`: `padding: var(--pbui-space-2); gap: var(--pbui-space-2)` in one rule (InspectorTile, PlaygroundTile, ReplTile, SourceTile, TimelineTile, sandbox ScriptTile).
- `pbui-chat/ContextTile.module.css:1-10` — `.app` has both `padding:space-2` and `gap:space-2` between Toolbar/Section children.
- `pbui-chat/FormChild.module.css:1-8` — border-boxed, self-padded, and internally gap-spaced simultaneously.
- `pbui-ecommerce/tiles.module.css:56-61` `.detail { padding:10px 12px; gap:10px }` — same idiom, raw px instead of tokens.
- `datalab-ui/LauncherDialog.module.css` `.body{gap:space-2}` plus per-child `padding`/`padding-left:calc(1ch + space-2)` — a layered gap+padding case rather than gap+margin.

### Containers with zero padding where children touch the border

- `Surface`'s `padding` prop defaults to `0` (`Surface.tsx:17`); `.pad-0` is even declared explicitly as a way to *state* the zero.
- `TileFrame`'s `[data-part="tile-body"]` — no padding; whatever renders inside must supply its own (typically `AppBody`).
- `pbui-workbench/Tile.module.css` `.cell`/`.body`/`.app` — no padding at all; content is flush against the tile frame border.
- `pbui-ecommerce` every tile's `<AppBody flush>` — explicitly zero-padding; the `<table>` or `.detail`/`.empty` child re-introduces padding one level down (the general repo-wide pattern: padding is deferred, never absent for long).
- `datalab-ui/LessonRail.module.css` and `ModuleRack.module.css` — both carry an explicit comment ("No border, no shadow, no header — the tile draws the frame") documenting this as a deliberate, twice-repeated architectural choice, not an oversight; all real padding lives in inner regions (`.wedge`, `.groups`, `.detail`, `.steps`, `.goals`).
- `pbui-workbench/PortRail.module.css` and `render/UINodeRenderer.module.css` (`.panel`/`.row`/`.column`) — `min-width:0` only, no padding, delegating entirely to whatever core atom is rendered inside.

### Reset-driven margin gaps

`datalab-ui/reset.css:28-44` zeroes margin on `body, h1-h6, p, figure, blockquote, dl, dd, ol, ul, pre` —
**not** `dt` or bare `span`/`div`. The one component using `<dt>` (`ModuleCard`) has to re-zero it locally
(`ModuleCard.module.css:29`), and its parallel `.value{margin:0}` rule on `<dd>` is technically redundant
with the global reset but kept for symmetry. No equivalent reset exists in core or any other package — each
package that touches raw `<dl>`/`<dt>` elements (chat's ContextTile, ecommerce's tiles.module.css) has to
handle this itself, ad hoc, rather than relying on a shared reset.

---

## 7. Consolidation candidates

Each item references the evidence bullets above.

1. **Unify the "small labeled tone box" idiom into one Chip-family primitive.** Fifteen-plus independent
   implementations exist (§4.1: core Chip, workbench PortBadge/RebalanceBadge, chat VerbChips, datalab
   ProvenanceBadge/RoleBadge/ScopeChip/StateGlyph/Tick/TypeBadge/StepRow.kind/TruncationNotice/TracePanel.kind/
   TemplateTable.kind-app/WorkspaceStrip). Extend core `Chip` with variant props (dotted-underline, glyph-only,
   fixed-size, firm-border) to absorb at least the 5 hairline+tone-edge hand-copies; delete their local CSS.

2. **Standardize uppercase-tracked-label tracking to `var(--pbui-track-label)` everywhere.** §4.2 lists 9
   sites hardcoding `0.04em` (`public/presentation-parts.css:309-312`,
   `pbui-workbench/CoordinationInspector.module.css:36-37`, `pbui-sandbox/UINodeRenderer.module.css:65-66`,
   `pbui-chat/demo/InventoryApp.module.css:56`, `SkuApp.module.css:24`, `pbui-ecommerce/tiles.module.css:32,75`)
   plus 2 sites using uppercase with no tracking at all (`pbui-chat/Composer.module.css:16-21`,
   `WatchlistPanel.module.css:17-22`). Fix `public/chrome.css:57`'s stale `0.06em` fallback in the same pass.

3. **Fix the 60-hex fallback drift in core's own `public/*.css`** (§2 drift table) — `--pbui-ink`,
   `--pbui-selected`, `--pbui-paper`, `--pbui-faint`, `--pbui-line` all carry fallback hexes that disagree
   with the live token values; these are landmines that only fire on token-resolution failure but currently
   encode a wrong second palette.

4. **Migrate Dialog/JsonBlock/InspectorPanel off the `rem` unit system** (`public/components.css`, §1, §3) —
   the only 3 core components not on the shared px `--pbui-space-*`/`--pbui-fs-*` scale, including a
   hardcoded `border-radius:0.25rem` that violates the system's own `--pbui-radius:0` rule.

5. **Give core's InspectorPanel empty-state the same `var(--pbui-faint)` as `EmptyState`** —
   `public/components.css:98-100` hardcodes `#64748b`, a second, off-token empty-state grey inside core
   itself (§4.5).

6. **Define `--pbui-tone-widget` in core's tokens.css** — pbui-sandbox has 8 call sites (§2) that currently
   only resolve in a downstream consumer (pbui-chat's demo) that happens to define it.

7. **Fix the dead `--pbui-tone-datum` reference** in `packages/datalab-ui/src/apps/UploadApp/UploadApp.tsx:326`
   — already fixed in `descriptors/upload.ts:7-12` but never propagated; a one-line change.

8. **Fix the `--pbui-border-hairline` typo** in `public/presentation-parts.css:306` (almost certainly meant
   `--pbui-border-hair`).

9. **Promote datalab-ui's full categorical palette (`--pbui-cat-1..8` + `ramp-low/high`) into core
   tokens.css.** Core only defines `cat-3`; `pbui-ecommerce/src/apps.tsx:71,87,104,117,130,143,171` references
   `cat-1/2/4` but the ecommerce demo only imports core's stylesheet, so those categories render unstyled in
   that runtime today (§2).

10. **Resolve the `tone-source` naming collision** between pbui-chat's demo tokens (`#c2503a`, red) and
    datalab-ui's tokens (`#7cae9b`, green) — same token name, opposite meaning (§2 table). Rename one, or
    establish a shared tone-vocabulary doc that both packages draw from.

11. **Extract a shared `ToneTag`/left-edge primitive** for the "hairline box + 4px tone-edge" idiom that's
    hand-copied 3–5 times inside datalab-ui alone (StepRow.kind, TruncationNotice inline, TracePanel.kind,
    TemplateTable.kind/.app) — or simply route them all through core `Chip`.

12. **Replace `color-mix(in srgb, currentColor N%, transparent)` in pbui-ecommerce** (6 uses in
    `tiles.module.css`, 1 in `ShopShell.module.css`) with token reads (`--pbui-pane-alt`, `--pbui-selected`,
    or new dedicated hover/selected tokens) — these currently bypass the package's own `no-hex.test.ts`
    lint (§1, §3).

13. **Rewrite or re-lint `pbui-ecommerce/tiles.module.css`** so its header comment ("Tokens only; no colour
    literals") is actually true — currently contradicted by 18 raw px, 2 em, 2 opacity, 1 line-height values
    in the same file (§3).

14. **Extract a shared `KeyValueRow`/`FactsList` component.** Seven near-identical `<dl>`/grid
    implementations exist with no shared code (§4.6: core help-fields, chat ContextTile.facts, ecommerce
    tiles.facts [raw px gaps], sandbox InspectorTile.facts, datalab ModuleCard/CheatCard/SpecDiff) —
    consolidating would also close the `dt` margin-reset gap noted in §6.

15. **Introduce a shared "scroll-body" utility** for the `flex:1; min-height:0; overflow:auto` pairing that
    recurs 12+ times in core alone and again in nearly every tile in every other package (§4.11) — either a
    utility class alongside `tokens.css`, or push every workbench/plotscript/sandbox/chat/ecommerce tile to
    actually use core's existing `AppBody` instead of hand-copying the two-line rule.

16. **Reconcile core Dialog's default chrome with datalab-ui's `dialogs.css` override.** datalab explicitly
    overrides core's own Dialog styling "to match the workbench's hairline-square idiom" (§4.9) — meaning
    core's shipped default doesn't match core's own design language. Either fix core's Dialog defaults or
    promote datalab's override sheet into core so every consumer gets the corrected chrome by default.

17. **Extract a shared `TileHeader` component** for the `Toolbar[tight]` + title + spacer + status pattern
    copy-pasted verbatim across all 7 pbui-ecommerce tiles and every workbench/sandbox/plotscript tile
    (§4.4) — reduces 15+ near-identical JSX blocks to one.

18. **Standardize list-row hover/active background to one token.** Currently `var(--pbui-selected)` (core
    FileBrowser, menu-item), `var(--pbui-pane-alt)` (chat ConversationsTile, workbench SplitPane divider),
    and `color-mix(...)` (ecommerce) all express the same affordance (§4.8) — pick one token + one
    hover-vs-active state model.

19. **Bring datalab-ui's WorkspaceStrip in line with the rest of the badge family** — it's the one
    implementation using a full firm border instead of the tone-edge idiom (§4.1, §5), and has no CSS
    module at all (hand-inline styled).

20. **Fix `TypeBadge`'s literal `1px solid var(--pbui-ink)`** (`packages/datalab-ui/src/components/atoms/TypeBadge/TypeBadge.module.css:19`)
    to `var(--pbui-border-hair)` like every sibling badge.

21. **Promote `--pbui-space-6: 24px` from datalab-ui into core's tokens.css** — datalab already needed a
    6th step (§2, §3); packages outside datalab that need spacing beyond 16px currently have nowhere to
    reach except a raw literal.

22. **Replace datalab-ui's full restatement of core's 49 shared tokens with an actual import+extend.**
    Currently `packages/datalab-ui/src/styles/tokens.css` byte-copies every core value (§2) rather than
    building on `src/tokens.css` — any future core token edit requires a second, easy-to-miss manual edit to
    stay in sync.

23. **Promote `--pbui-wash` from datalab-ui's tokens.css into core's tokens.css.** `pbui-workbench/Surface.module.css:9`
    reads it with a fallback to `--pbui-paper` (§2), so workbench's `Surface` currently renders a visibly
    different background depending on whether it happens to be hosted inside datalab-ui or not.

24. **Fix the `--pbui-track-label` fallback mismatch inside core's own `chrome.css:57`** —
    `var(--pbui-track-label, 0.06em)` doesn't match the real token value (0.08em), a second instance of the
    fallback-drift bug (§2, §3) confined to a single file.

25. **Document pbui-editor's `theme.ts` as the reference pattern for 100%-token-driven styling** (§1, §4.7)
    and use it as the template for giving datalab-ui an actual code-block treatment — currently datalab has
    none, relying entirely on `reset.css`'s inert `font-family:inherit` default for `<code>`/`<pre>`.
