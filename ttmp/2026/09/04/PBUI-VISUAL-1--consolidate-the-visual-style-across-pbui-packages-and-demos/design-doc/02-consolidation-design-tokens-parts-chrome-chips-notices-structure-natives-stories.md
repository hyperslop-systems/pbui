---
Title: 'Consolidation design: tokens, parts, chrome, chips, notices, structure, natives, stories'
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
RelatedFiles:
    - Path: repo://public/chrome.css
      Note: Phase 3 tile chrome
    - Path: repo://public/components.css
      Note: Phase 2 Dialog/JsonBlock/InspectorPanel rewrite
    - Path: repo://public/presentation-parts.css
      Note: Phase 2 single definition of the parts
    - Path: repo://src/components/atoms/Chip/Chip.tsx
      Note: Phase 4 the one chip
    - Path: repo://src/tokens.css
      Note: Phase 1 target
ExternalSources: []
Summary: 'Phase-by-phase design for consolidating the pbui visual style: tokens, parts files, tile chrome and shell, chip family, notices and banners, labels and structure, native controls, story hygiene. Hard cutover, no compatibility layers.'
LastUpdated: 2026-09-04T12:05:58.75678432-04:00
WhatFor: The spec each consolidation phase implements; the diary records how it went.
WhenToUse: Before touching pbui CSS or chrome; after doc 01 and its Decisions section.
---


# Consolidation design

## Executive Summary

Doc 01 measured the family against the reference (`REF-001`) and the user chose the direction: datalab's tile chrome with the dark masthead, one chip, never rounded, no nested double borders, one un-overloaded selection colour, one notice grammar, tokens fixed at the source, one label idiom, a global skin for native controls. This document turns those decisions into eight phases, each independently shippable, each verified by re-running the screenshot scripts of this ticket. Everything is a hard cutover: no aliases, no compatibility sheets, dead CSS is deleted in the same commit that replaces it.

The rule that governs every phase: **the object menu is the anchor**. Paper surface, hairline or firm ink border, zero radius, no blurred shadow, an inverted header in the tracked-uppercase label voice, px spacing from the five-step scale, monospace inherited from `body`. Anything floating, framed or labelled converges on that recipe.

## Constraints already enforced by tests (keep green)

- `src/tokens-defined.test.ts`: every `var(--pbui-*)` read without fallback in `src/` and `public/` must be defined in one of those sheets.
- `src/styles-wiring.test.ts`: every top-level sheet in `src/` and `public/` must be imported by `src/index.ts`; every component module by its component.
- `packages/pbui-workbench/test/no-phantom-tokens.test.ts`: workbench reads only tokens core defines.
- `packages/pbui-chat/test/no-hex.test.ts`: no colour literals in chat, chat demo, sandbox outside `styles/tokens.css`.
- `packages/datalab-ui/test/tokens.test.ts`: `--pbui-cat-1..8` and the ramp must equal `@hyperslop-systems/plot`'s palette; core may not depend on plot, so the hex values are copied into core and the test is re-pointed at core's sheet.
- `packages/datalab-ui/test/no-raw-controls.test.ts`: no raw `<button>`, `<select>`, `<input>` outside atoms.
- `src/presentation/instanceChrome.test.tsx`, `createPbui.help.test.tsx`: read the parts sheet for specific selectors; re-read them when merging sheets.

## Phase 1: Tokens

**Goal.** One definition site for every token the family reads; no second palette hiding in fallbacks.

**Changes.**
1. `src/tokens.css` gains, with datalab's values: `--pbui-wash` #f7f7f4, `--pbui-selected-wash` #fffdf4, `--pbui-neutral` #f3f3ef, `--pbui-space-6` 24px, `--pbui-border-rule` (1px dashed line), `--pbui-border-grid` (1px solid line), `--pbui-track-banner` 0.28em, `--pbui-shadow-hard` none, `--pbui-shadow-menu` none, `--pbui-cat-1..8`, `--pbui-ramp-low/high`, `--pbui-type-q/n`, and the tone family: `field, source, doc, step, chart, cat, geom, neutral, traceEntry` (datalab) plus `tool, proposal, widget, row, product, order, metal, message, category` (chat demo, ecommerce, sandbox) assigned from the same pastel set. New: `--pbui-tag-wash: var(--pbui-pane-alt)` for chip and tag fills that carry no state.
2. Every inline fallback in `public/components.css`, `public/presentation-parts.css`, `public/chrome.css` and `src/styles.css` is removed. The tokens sheet is in the same bundle; a fallback is a second palette.
3. `packages/datalab-ui/src/styles/tokens.css` becomes overrides-only (currently a byte-copy of core plus additions). After step 1 it contains nothing, so it is deleted and its import removed; `tokens.test.ts` and `brand-tokens.test.ts` re-point at `src/tokens.css` where they read family tokens.
4. `packages/pbui-chat/demo/src/styles/tokens.css` keeps only the demo's own tone overrides.
5. `--pbui-tone-source` collision: core takes datalab's green; the chat demo overrides it locally if it wants red.

**Verification.** Core, workbench, chat, datalab tests; chat storybook `CH-*` shows the grid lines that `--pbui-border-grid` draws; `pbui-sandbox` widget tone renders without the chat demo.

## Phase 2: Parts files

**Goal.** One definition of the presentation parts, and the Dialog/JsonBlock/InspectorPanel on the system.

**Changes.**
1. `src/styles.css` shrinks to the `body` typography rule (and, in Phase 7, the native-control skin). Its presentation and menu blocks are deleted: `public/presentation-parts.css` is the single definition, plain attribute selectors, token values, no fallbacks.
2. `presentation-parts.css`: menu keeps its look (firm border, inverted header, dotted separators) with `border-radius: var(--pbui-radius)`. Accept chooser: `font: inherit`, firm border, no shadow, header in the inverted label style like the menu, options as menu items. Context help: no shadow, radius token, firm border. Refusal notice: paper, hair border, 4px danger edge (already; keep as the Notice recipe of Phase 5). Typos fixed: `--pbui-muted` → `--pbui-faint`, `--pbui-border-hairline` → `--pbui-border-hair`, `--pbui-shadow` removed.
3. `public/components.css` rewritten in tokens: Dialog backdrop `--pbui-dialog-backdrop` (flat 28% ink, no blur); panel: pane, firm border, `border-radius: var(--pbui-radius)`, `width: auto; max-width: min(52rem, 100%)`; header: inverted (ink bg, paper text), padding space-1 space-3, title `fs-tiny` bold uppercase tracked; close: tiny framed control (hair border, paper bg, micro size); body padding space-4; footer border-top firm, padding space-2 space-3, gap space-3. JsonBlock: pane-alt, ink, `font: inherit` at fs-small/lh-prose, padding space-3, radius token, `data-failed` → danger. InspectorPanel: gap space-3, padding space-4, title = tracked label at fs-tiny, empty text faint. The `--pbui-dialog-*` tokens keep existing as the override surface; their defaults already point at family tokens.
4. `packages/datalab-ui/src/styles/dialogs.css` deleted (its content is now the default); import removed from `styles.ts` and `.storybook/preview.ts`. Root `.storybook/preview.ts` and datalab `styles.ts` stop importing `components.css`/`presentation-parts.css`/`chrome.css` separately (they are in `styles.css`'s bundle). The three `exports` entries stay for consumers who want a part in isolation but the README says they are optional.

**Verification.** `I-C-008` launcher and `WB-005`/`WB-013` dialogs flat and square; `I-C-004` chooser monospace and unshadowed; presentation tests green.

## Phase 3: Tile chrome and shell

**Goal.** Every tile tinted by kind, one shell for every product, no border touching another border.

**Changes.**
1. `public/chrome.css`: tile border firm, bar border-bottom firm (as datalab). `tile-title`: `flex: 0 1 auto; min-width: 3ch; letter-spacing: var(--pbui-track-label)`. `tile-actions`: `flex-shrink: 0`. Badges rendered after the title survive narrowing because the title shrinks first. A nested workbench inside a tile body: `[data-part="tile-body"] [data-part="workbench"] { padding: var(--pbui-space-2); background: var(--pbui-wash) }` so two frames never touch. Drop-zone label on the token scale.
2. Content padding is the app's job through `AppBody` (pads space-3/space-4 by default, `flush` for tables). The workbench stories' bare-text apps are wrapped in `AppBody`. This is a convention, enforced by a lint-style test in pbui-workbench: every `defineWorkbenchApp` render in the repo's packages must render an `AppBody`, a `Toolbar`, or a tile component as its root (checked with a grep test over `packages/*/src/**/apps*`). Keep it simple: the test lists offenders; the phase fixes them.
3. Tone by kind: `defineWorkbenchApp` requires `tone` (already a prop on the descriptor; today products pass literal vars). Core tokens (Phase 1) provide the family tones; the chat demo, plotscript demo, ecommerce and sandbox descriptors are assigned tones by object kind (conversation → message, inspector → tool, watchlist → row, trace → traceEntry, script → step, plot → chart, orders → order, customers → row, catalog → product, coordination → tool). The workbench stories use `--pbui-tone-neutral` and `--pbui-tone-step` instead of the orange.
4. `AppShell` in pbui-workbench (`components/AppShell`): `masthead` (Surface inverted, Toolbar tight, wordmark with `--pbui-track-banner`, optional tagline, actions slot), `strip` row (WorkspaceStrip + spacer + actions, border-bottom grid), `canvas` (wash bg, padding space-3), `status` (MouseDocLine). Grid rows `auto auto minmax(0,1fr) auto`, height 100vh. Migrations: chat demo `App.tsx`, plotscript demo, ecommerce `ShopShell`, datalab `WorkbenchShell` (keeps StageBar and its actions in the slots). Their hand-rolled masthead/status CSS is deleted.
5. `WorkspaceStrip` (workbench): every tab boxed (hair border), active filled with `--pbui-selected` and bold, hover `--pbui-selected-wash`, "+" as a framed tiny button. datalab's own `WorkspaceStrip` organism is replaced by the workbench one if its API covers rename/duplicate; otherwise restyled to the same module.
6. Split divider: grip dots in `--pbui-faint` on a `--pbui-wash` gutter of space-2 so the divider is a visible gutter, not an invisible line; hover fills `--pbui-selected-wash`.
7. Active tile: keep the launcher-open-only ring in workbench; datalab's always-on ring removed (one rule).

**Verification.** Demo shots `D-*-001` share one masthead/strip/status; `WA-011` nested tile shows a gutter; every tile in `D-CH-001`, `D-PS-001`, `D-EC-001` is tinted.

## Phase 4: Chip family

**Goal.** One `Chip`; fifteen implementations become calls.

**API.** `Chip({ label, tone?, badge?, glyph?, strong?, size?: "small" | "tiny" | "micro", fill?: "none" | "wash" | "tone", edge?: boolean (default true), state?: "active" | "stale" | "disabled" | "empty" | "unresolved" | "held" | "revoked", title? })`. Geometry: `padding 0 space-3` (small), `0 space-2` (tiny/micro); hair border; tone edge 4px when `edge`; `fill: wash` → `--pbui-tag-wash`; `fill: tone` → the tone colour at full strength with ink text (datalab TypeBadge look). States: active → selected fill; stale → dashed border, danger text; disabled → 0.55 opacity, pane-alt; empty → dashed border, faint text; unresolved → dotted border, bold; held → double 3px border; revoked → dashed border, faint text, line-through label. Border style is the only state language for chips; colour reinforces, never replaces.

**Migrations.** workbench `PortBadge` → `Chip` with `edge=false`, `size="tiny"`, state mapped from badge state (ambient/empty → empty, unresolved → unresolved, held → held, rest default), keeps `data-part="port-badge"`, `data-state`, `data-port` via a wrapper span; its module deleted. ecommerce status pills → `Chip` (shipped/paid default, hold → stale, cancelled → disabled). datalab: RoleBadge, ScopeChip, TypeBadge (`fill="tone"`, `size="micro"`, `edge=false`), StepRow.kind, TracePanel.kind, TemplateTable.kind/app, TruncationNotice's inline box, TokenChip (revoked), DocChip, FieldChip (stale), SourceChip, UserChip; WorkspaceStrip handled in Phase 3. StateGlyph and Tick stay (a glyph and a fixed square are not chips). VerbChips and RebalanceBadge stay `Button[framed, tiny]`: interactive things are buttons, chips are inert. This rule goes in the README.

**Verification.** `WA-003` gallery re-shot; datalab atom stories; chip-related tests.

## Phase 5: Notices and banners

**Goal.** One notice, one mode banner.

**Changes.**
1. Core `Callout` becomes the notice: paper bg, hair border, 4px left edge coloured by `severity: "info" | "ok" | "warning" | "danger"` (neutral / ok / cat-3 / danger), headline strong, body, hint faint, optional dismiss (IconButton bare). The old glyph-only variants are removed. `RefusalNotice`'s part CSS matches it exactly (it is a Callout of severity danger rendered by the kernel).
2. Consumers: chat `PbuiWidget` invalid/server-error states, `ProposalCard` danger state (chip stays, box becomes Callout), `ErrorNotice` and crash boxes in datalab, plotscript's diagnostic line, sandbox errors → `Callout`.
3. `ModeBanner` in core presentation parts: ink bg, paper text, mode word in `--pbui-cat-3`, fs-small, padding space-1 space-4. The accept banner (`data-part="accept-banner"`), the workbench placing banner and the mouse-doc line all use it; the accept banner's danger fill goes.

**Verification.** `I-C-003`, `I-C-006`, `I-CH-004`, `I-PS-001`, `CH-013` share one look.

## Phase 6: Labels and structure

**Goal.** One label idiom, shared tile header and key/value list, no hand-copied scroll bodies, two Surfaces with distinct names.

**Changes.**
1. Every uppercase label routes through `SectionLabel` or the `tile-title`/`inspector-title`/`menu-header` parts, all on `--pbui-track-label`. The hardcoded 0.02/0.04/0.06em sites (inventory §4.2) are rewritten.
2. Core organism `TileHeader({ title, status?, actions?, children? })` = `Toolbar tight bordered` + `Text strong` + spacer + `Text faint`. ecommerce (7), sandbox (5), plotscript (2), workbench CoordinationInspector use it.
3. Core molecule `KeyValueList({ items: [{ key, value }], dense? })` replaces the seven `<dl>` implementations.
4. Hand-copied `flex:1; min-height:0; overflow:auto` blocks in tiles → `AppBody` (or `AppBody flush`).
5. Core `Surface` border variants reduced to `none | hair | firm`; `raised`/`floating` deleted (no usages found). Workbench's `Surface.tsx` file renamed `WorkbenchSurface.tsx` to match its export.

**Verification.** Inventory §4.2/4.4/4.6/4.11 counts drop to one implementation each; typecheck and tests.

## Phase 7: Native controls

**Goal.** No browser-default control inside a pbui app.

**Changes.** `src/styles.css` gains zero-specificity skins: `:where(input[type="checkbox"], input[type="radio"])` → `accent-color: var(--pbui-ink)`, 12px box, ink hair border via `appearance: none` with a checked fill of ink and a paper glyph; `:where(select)` → `appearance: none`, hair border, paper bg, font inherit, fs-small, padding space-1 space-4 with an inline SVG chevron; `:where(button:not([class]))` → the bare Button look (font inherit, hair border, paper bg, zero radius, padding space-1 space-3) so a raw button in a story or a sandboxed program reads as family. Products keep using the atoms; the skin is the floor.

**Verification.** `I-SB-001`, `I-C-005`, `C-155`, `DW-001` re-shot.

## Phase 8: Story hygiene and the after-corpus

**Changes.** A `withHost` decorator (sized grid host) for every `Apps/*` and lab story that rendered blank (`CH-001..004`, `WB-001..004`, `SB-001/002`, `PS-001..004`, `ED-002/004`); datalab `PhaseIcon` ink story, `PhaseRule` blank stories, Tour stories' provider; the chat Composer crash (filter `pbui.accept` types to the declared graph); the WireLayer static story. Then re-run scripts 01 to 06 into `various/screenshots-after/` and write doc 03 with side-by-side before/after exhibits for the ten priorities.

## Order and commits

One commit per phase minimum; the diary records each with its hash. Phases 1 and 2 touch only core and the two token files; 3 touches chrome and every demo; 4 to 6 are migrations where a subagent can do datalab's share; 7 is core only; 8 closes the loop.
