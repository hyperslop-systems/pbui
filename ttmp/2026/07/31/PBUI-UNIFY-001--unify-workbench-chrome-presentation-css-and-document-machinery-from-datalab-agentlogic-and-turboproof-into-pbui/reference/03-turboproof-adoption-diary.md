---
Title: Turboproof adoption diary
Ticket: PBUI-UNIFY-001
Status: active
Topics:
    - pbui
    - frontend
    - design
DocType: reference
Intent: long-term
Owners: []
RelatedFiles:
    - turboproof/ui/src/components/organisms/Tile.tsx
    - turboproof/ui/src/components/organisms/Chrome.tsx
    - turboproof/ui/src/components/organisms/LauncherDialog.tsx
    - turboproof/ui/src/components/pages/Workbench.tsx
    - turboproof/ui/src/styles/app.css
    - turboproof/ui/src/pbui/runtime.tsx
ExternalSources: []
Summary: Diary of the turboproof product adopting pbui 0.2.0 Phases 1+2 — the presentation-parts/chrome CSS, the instance MouseDocLine/AcceptBanner, TileFrame + useTileDrag, LauncherShell, and shortcut routing — ending with the browser geometry verification the incident demands.
LastUpdated: 2026-07-31T13:20:00-04:00
WhatFor: Review and continuation record for the turboproof leg of the PBUI-UNIFY-001 family adoption.
WhenToUse: Read when reviewing turboproof commits 603b6c5/35c5efc/7539704, when adopting the same kit in agentlogic, or when re-running the geometry e2e.
---

# Diary

## Goal

Adopt pbui 0.2.0's Phase 1+2 deliverables in turboproof/ui: import the package's presentation-parts.css and chrome.css, replace the local MouseDocLine/AcceptBanner with the instance components, rewrite TileView on TileFrame + useTileDrag, render the launcher via LauncherShell, route Mod+K through routeWorkbenchKey, delete every local copy from app.css — and prove the result in a real browser by asserting GEOMETRY (menu position, overlay containment), not presence, because presence-only assertions are what let the unpositioned-menu incident through.

## Step 1: Reading the design doc and mapping the target APIs

Before touching turboproof I read sections 4–6 of the intern guide (design decisions DR-U1..U6, target architecture, implementation plan) and then read the actual shipped surface of pbui 0.2.0 — the dist/*.d.ts files for the chrome kit and createPbui, the chrome.css selectors, and the TileFrame/LauncherShell sources. The brief described the API accurately, but two details only the source settled: TileFrame renders no slot for arbitrary extra attributes (the old turboproof tile carried `data-app`), and LauncherShell skips empty groups itself, so the product can always pass both groups unconditionally.

The old `data-app` attribute turned out to be write-only — `grep -rn "data-app"` found no reader in CSS or code — so dropping it was safe and is called out in the commit message.

### Prompt Context

User prompt (verbatim): "do the ticket, you can use subagents" — plus the mandate to keep a diary in diary-skill format and commit in the turboproof repo at intervals. I am the turboproof-adoption subagent of the ticket orchestrator, briefed with the pbui 0.2.0 API summary and eleven numbered tasks.

Assistant interpretation: execute Phases 1+2 adoption in turboproof exactly per the brief — dependency swap, CSS imports, component swaps, app.css deletions, green gates, browser geometry verification with screenshots, three-plus commits in turboproof only, and this diary (which the orchestrator commits, not me).

Inferred user intent: get the third family product onto the shared kit with the local copies deleted in the same commits, so the duplication map's turboproof rows close, and leave verifiable evidence (measured geometry, screenshots) rather than "it renders".

### What I did

- Read design-doc/01 sections 4–6 (DR-U1..U6, §5 target architecture, §6 plan).
- Read turboproof's package.json, main.tsx, pbui/runtime.tsx, Chrome.tsx, Tile.tsx, LauncherDialog.tsx, Workbench.tsx, app.css (644 lines).
- Read pbui dist type declarations for the chrome kit (TileFrameProps, UseTileDragOptions, LauncherShellProps, ShortcutContext) and the createPbui return (MouseDocLine/AcceptBanner members confirmed), plus chrome.css's data-part selector list.
- Grepped for consumers of the classes I would delete: only tiles.stories.tsx outside the three organisms; test files touch none of the markup.

### Why

The brief is a second-hand description of the API; the dist/*.d.ts is the API. Verifying before rewriting avoided building on a stale assumption, and the grep-for-consumers pass is what made the app.css deletion list safe.

### What worked

Everything in the brief checked out against the shipped types — no drift between the orchestrator's summary and pbui 0.2.0's dist.

### What didn't work

Nothing failed in this step.

### What I learned

- The shell renders group labels only for non-empty groups, so the adapter needs no emptiness logic.
- `ShortcutContext` has six fields; turboproof genuinely has no object-menu-open flag or inline rename, so two are constant false (the brief pre-authorized this).

### What was tricky to build

Nothing yet — this was reconnaissance.

### What warrants a second pair of eyes

The decision to drop `data-app` from the tile section (TileFrame has no attribute pass-through). Nothing read it, but external tooling (e.g. a user script or e2e selector elsewhere) would not show up in the repo grep.

### What should be done in the future

If a product needs product-specific data attributes on the tile section, TileFrame could grow a `dataAttributes` prop — worth raising only when a real reader exists.

### Code review instructions

Compare the brief's API summary against `pbui/dist/chrome/*.d.ts` — the review claim is that the adapters below use the API as shipped, not as remembered.

### Technical details

- Design doc: `pbui/ttmp/2026/07/31/PBUI-UNIFY-001--*/design-doc/01-*.md` §4–6.
- Key shipped types: `TileFrameProps` (placementId, tone, title, canClose, onSplit, onClose, grip?, dropZone?, dragging?, registerElement?), `useTileDrag({id,onSwap,onDock}) → {register,onGripPointerDown,dragging,zone}`, `LauncherShellProps` (groups/query/onChoose(rowId)/status/enterVerb), `routeWorkbenchKey(event, context, platform?)`.

## Step 2: Dependency swap and the two CSS imports (commit 603b6c5)

The smallest shippable slice first: point the dependency at the local build and import the two new stylesheets in the contract order. The pbui package at `../../pbui` is 0.2.0 and pre-built, so `file:` linking gives turboproof the real dist without waiting for a registry publish.

The install needed the Vault-issued GitHub token because turboproof's OTHER registry dependency, workbench-protocol, still resolves from npm.pkg.github.com.

### Prompt Context

User prompt (verbatim): "do the ticket, you can use subagents" (see step 1 for the full mandate; this step covers brief tasks 1–2).

Assistant interpretation: `file:../../pbui` is temporary until 0.2.0 publishes and the commit message must say so; the CSS imports go immediately after components.css.

Inferred user intent: keep the product buildable against the unpublished package while making the CSS order contract explicit in main.tsx where the next reader will see it.

### What I did

- package.json: `"@hyperslop-systems/pbui": "0.1.0"` → `"file:../../pbui"`.
- `NODE_AUTH_TOKEN=$(vault kv get -field=token kv/ci/github/hyperslop-systems/datalab/packages-read-token) pnpm install` — resolved 361 packages, "- @hyperslop-systems/pbui 0.1.0 / + @hyperslop-systems/pbui 0.2.0", done in 1.1s.
- main.tsx: added `import "@hyperslop-systems/pbui/presentation-parts.css";` and `import "@hyperslop-systems/pbui/chrome.css";` between components.css and scrollbars.css.
- Committed package.json + pnpm-lock.yaml + main.tsx as 603b6c5.

### Why

Landing the imports before deleting the app.css copies means there is never a commit where the styles exist nowhere; the cascade order (package defaults before app.css) also preserves the product's right to override.

### What worked

The install swapped the package cleanly on the first try; both CSS subpath exports resolved (they are declared in pbui's `exports` map).

### What didn't work

Harmless noise only: pnpm-driven commands later print `WARN  Issue while reading ".../ui/.npmrc". Failed to replace env in config: ${NODE_AUTH_TOKEN}` when the env var is absent — pre-existing behavior, not introduced here, and irrelevant once node_modules is populated.

### What I learned

The Vault token is needed for workbench-protocol resolution even when the pbui dependency itself moves to `file:` — the brief said so and it held.

### What was tricky to build

Nothing; this is the one-liner DR-U1 promised.

### What warrants a second pair of eyes

For this window, both the app.css copies AND the package styles were loaded (identical attribute selectors, so last-wins changes nothing visible) — fine for one commit, but do not let the `file:` dependency reach main without the registry version swap.

### What should be done in the future

When pbui 0.2.0 publishes, change `file:../../pbui` back to `"0.2.0"` and re-run `pnpm install` — one line, called out in the commit message.

### Code review instructions

Check main.tsx's import order comment block against the actual order: reset → tokens → pbui styles.css → components.css → presentation-parts.css → chrome.css → scrollbars → app.css.

### Technical details

Commit 603b6c5 "PBUI-UNIFY-001: adopt pbui 0.2.0 presentation-parts.css + chrome.css" — 3 files, +8/−6.

## Step 3: Tiles, banner, footer onto the chrome kit; app.css sheds 257 lines (commit 35c5efc)

The core swap. TileView's 220 lines — half of which were the imperative drag machinery (findDropTarget with 25% quarters, paintDropZone building overlay DOM by hand, clearDropZone, classList dragging) — became a 103-line component whose drag adapter is the ten lines DR-U3 promised. Chrome.tsx dropped ~90 lines of MouseDocLine/AcceptBanner and now re-exports the instance components, so Workbench.tsx and Chrome.stories.tsx keep their import path unchanged.

app.css then shed everything the package ships: the tile chrome classes, the whole `[data-part=…]` presentation/menu section (the block whose absence caused the original unpositioned-menu incident), the launcher dialog/row classes, the drop-zone classes, and the mousedoc strip — 257 lines out, replaced by a 9-line comment pointing at the package imports.

### Prompt Context

User prompt (verbatim): "do the ticket, you can use subagents" (brief tasks 3–6).

Assistant interpretation: delete, don't deprecate — the local copies go away in the same commit that adopts the shared code; `.tp-tile-body`'s one remaining consumer (tiles.stories.tsx) moves to data-part attributes.

Inferred user intent: close turboproof's rows in the duplication map with a net-negative diff, and accept the two deliberate feel changes (banded zoneFor, banner without cancel button) as family unification.

### What I did

- runtime.tsx: `export const MouseDocLine = instance.MouseDocLine;` and `export const AcceptBanner = instance.AcceptBanner;`.
- Chrome.tsx: deleted both local implementations; `export { AcceptBanner, MouseDocLine } from "../../pbui/runtime";`; kept WorkspaceStrip; trimmed now-unused imports (Button, Surface, VisuallyHidden).
- Tile.tsx: rewrote on TileFrame + useTileDrag. Title stays the `<tile>` Presentation (passed as the title slot); onSplit/onClose/onSwap/onDock adapt to the existing serializable verbs via `pbui.perform`; the hook is called before the missing-view early return (hooks rule); the fallback renders `<section data-part="tile" data-placement-id>` so it still wears the frame look.
- tiles.stories.tsx: story wrapper `className="tp-tile"`/`tp-tile-body` → `data-part="tile"`/`data-part="tile-body"`.
- app.css: deleted .tp-tile, .tp-tile-bar, .tp-tile-grip, .tp-tile-title-text, .tp-tile-actions, the presentation+menu data-part section (with pbui-pulse keyframes and the reduced-motion rule), .tp-launcher-dialog/-results/-row/-row-title, .tp-drop-zone/-label, .tp-tile--dragging, .tp-tile-body, .tp-mousedoc/-mode/-text/-ambient. Kept `.tp-launcher` (the launcher APP's innards class — different thing from the dialog).
- Gates: `pnpm run typecheck` clean, `pnpm vitest run` 45/45, `make ui-token-check` "token check: all read tokens are defined". Commit 35c5efc.

### Why

The declarative overlay (hook reports `zone`, frame renders DropZoneOverlay) replaces the imperative paint because the shared registry makes it free (design doc §5.2's closing paragraph); deleting in the same commit is the Phase-2 rule ("Each adoption deletes the local copy in the same commit").

### What worked

Typecheck and all 45 tests passed on the first run after the rewrite — the verbs layer was untouched, and no test reached into tile markup.

### What didn't work

Nothing failed in this step.

### What I learned

- `.tp-launcher` vs `.tp-launcher-dialog` is a near-miss trap: the former is the launcher tile app's body (still used by apps/), the latter was the modal's (deleted). The deletion list must be selector-exact.
- The banner visual change is real: the instance AcceptBanner has no cancel button (Esc + banner text only, datalab's red-strip look).

### What was tricky to build

Keeping the missing-view fallback styled after `.tp-tile` was deleted — solved by using the `data-part="tile"` attribute so chrome.css picks it up without the frame's bar.

### What warrants a second pair of eyes

- The dropped `data-app` attribute (see step 1).
- The zone-geometry feel change (DR-U4): drags now classify by a 30%-of-smaller-dimension band capped at 110px instead of 25% quarters. Deliberate, but a user may notice edges are easier to hit on big tiles.
- Chrome.stories.tsx renders the instance AcceptBanner now — the story still typechecks, but its visual is the new family banner; a Storybook pass by eye is worthwhile.

### What should be done in the future

Turboproof's changelog should call out the DR-U4 feel change and the banner's lost cancel button, per the design doc's consequences notes.

### Code review instructions

Diff Tile.tsx side-by-side with the old version (git show 35c5efc^:ui/src/components/organisms/Tile.tsx): every verb the old buttons/drag dispatched must appear in the new adapters with identical payload shapes (splitTile direction, swapTiles otherPlacementId, dockTile targetPlacementId+zone, closeTile). Then grep the repo for `tp-tile|tp-mousedoc|tp-drop-zone|tp-launcher-dialog|tp-launcher-row` — only git history should match.

### Technical details

Commit 35c5efc "PBUI-UNIFY-001: tiles, banner, and footer move onto the pbui chrome kit" — 5 files, +65/−467. app.css alone: −257 lines (248 deleted net, the replacement comment is 9 lines).

## Step 4: LauncherShell and routeWorkbenchKey (commit 7539704)

The launcher swap keeps every line of policy — the invocation plumbing, launcherSearch's filterRows/flatRows model, targetViewId, globalTarget, choose() with its three modes — and deletes every line of mechanism: the Dialog markup, the combobox input, the arrow/Home/End/Enter loop with wrap, the highlight-retention effect, the local splitDirectionFor, and the hand-rolled group/row rendering. The shell's `onChoose(rowId)` hands back an id; the adapter looks the LauncherRow up in flatRows and calls the untouched choose().

LauncherShortcut in Workbench.tsx became a routeWorkbenchKey call with turboproof's context mapped in: launcherOpen from the store (used for both launcherOpen and dialogOpen — the launcher is turboproof's only dialog), acceptingPresentation from pbui.accepting, objectMenuOpen and renamingView constant false (no such state exists here), targetIsEditable via isEditableTarget.

### Prompt Context

User prompt (verbatim): "do the ticket, you can use subagents" (brief tasks 7–8).

Assistant interpretation: DR-U6's split — shell owns modal+keyboard+Escape rule, product owns rows and choose semantics; the two constant-false context fields are acceptable and noted.

Inferred user intent: the Escape-single-owner invariant and the keyboard loop live in ONE place the family shares, so the next product cannot re-learn the broken-Escape bug.

### What I did

- LauncherDialog.tsx: rewrote LauncherModal to build `shellGroups` (OPEN VIEWS from groups.views with the "appId · shown N places" detail, NEW VIEW from groups.apps with blurb) and render `<LauncherShell>` with title/query/status/enterVerb/emptyText; deleted the local splitDirectionFor (pbui's is imported and takes the same placementId), the keyboard handler, the listbox markup, and the activeId/scroll effects. 300 → 189 lines.
- Workbench.tsx: imported isEditableTarget + routeWorkbenchKey from pbui; LauncherShortcut now builds a ShortcutContext and acts only on `{kind:"open-launcher"}`; kept the capture-phase window listener and the activePlacementId ride-along.
- Gates re-run: typecheck clean, 45/45 vitest, token check green. Commit 7539704.

### Why

Behavior preservation over markup preservation: the shell's loop is datalab's, which is semantically identical to the one deleted here (same wrap, same Home/End, same highlight fallback) — verified by reading LauncherShell.tsx, not assumed.

### What worked

The adapter compiled and all tests stayed green first try; launcherSearch's model tests (the policy) still cover exactly what stayed local.

### What didn't work

Nothing failed in this step.

### What I learned

routeWorkbenchKey's editable-target rule matches the old inline comment ("a chord, so an editable target is no reason to ignore it") — the context field exists for symmetric products but does not block Mod+K, so mapping it via isEditableTarget is informative, not behavior-changing.

### What was tricky to build

enterVerb: the old code computed the verb from the active row IN the component; the shell owns the active row now, so the product gets the id back through the `enterVerb(activeRowId)` callback and re-derives kind — a small inversion that is easy to get backwards.

### What warrants a second pair of eyes

`dialogOpen = launcherOpen` assumes the launcher is the only transient dialog. True today (Dialog is otherwise unused in turboproof); if a second modal appears, that mapping silently under-blocks the chord.

### What should be done in the future

If turboproof grows an object menu open-state accessor on the pbui instance, wire objectMenuOpen properly instead of false.

### Code review instructions

Open old vs new LauncherDialog (git show 7539704^:ui/src/components/organisms/LauncherDialog.tsx): choose(), globalTarget, targetViewId, and the where/enterVerb strings must be character-identical; everything deleted must exist in pbui's LauncherShell.tsx. For the shortcut, check the six context fields against ShortcutContext's doc comments.

### Technical details

Commit 7539704 "PBUI-UNIFY-001: launcher renders via LauncherShell; Mod+K routes via pbui" — 2 files, +71/−172.

## Step 5: Full gates and the browser geometry verification

The gates: `make ui` (vite build + tsc, "✓ built in 476ms", dist embedded) and `go build ./...` clean. Then the part the incident makes non-negotiable: real-browser assertions of GEOMETRY. `devctl restart` brought the stack back (server :8666, vite :5174, storybook), and the playwright MCP browser needed one `pkill -f mcp-chrome` for the documented "already in use" error.

The measurements, against http://localhost:8666/:

- **Menu geometry (the incident's regression test)**: contextmenu dispatched on the LEAN SOURCE tile title at (64,65) → `[data-part=menu]` computed position `fixed`, z-index `100`, inline style `left: 64px; top: 65px;`, bounding rect (64,65)–(432,201), viewport 1431×1369 → at the event coordinates (Δ=0) and fully inside the viewport. Header "<tile> lean source", five verbs including the disabled-with-reason close.
- **Footer**: `[data-part=mouse-doc]` present with mode/text/ambient children; mode text "READY".
- **Tile bars**: 7 `[data-part=tile]` sections; bars carry computed tone backgrounds (rgb(124,174,155) for source, rgb(169,159,201) for goals/script).
- **Drag overlay**: grip pointerdown on tile n-ce405b5b-3c27, pointermove into the left band of n-bfdcaf2a-b8b6 → source got `data-state="dragging"`, target grew `[data-part=drop-zone]` at (636,55) 394×398 inside the target rect (634,53) 791×402 — the left half within the 2px tile border — labeled "split-dock here · the source tile closes", pointer-events none. After pointerup at (0,0): 0 overlays, 0 dragging states, still 7 tiles (no accidental dock).
- **Launcher**: synthetic Ctrl-K keydown → dialog "Open a view", the combobox INPUT focused, status "new views open beside source · open views switch workspace", groups OPEN VIEWS (15) and NEW VIEW (6), first row highlighted.

Screenshots adopt-menu-geometry.png, adopt-drag-overlay.png, adopt-launcher.png landed in the workspace root and were copied to the ticket's `various/turboproof-adoption/`; I eyeballed all three — the family look (dark menu header, dashed red overlay, centered launcher modal) renders correctly.

### Prompt Context

User prompt (verbatim): "do the ticket, you can use subagents" (brief tasks 9–10; "assert geometry, not presence" is the acceptance rule).

Assistant interpretation: computed-style and bounding-rect assertions at measured coordinates, captured in this diary as data, plus the three named screenshots in the ticket dir.

Inferred user intent: never again ship a menu that "opens" into normal flow off-screen while every presence check passes.

### What I did

See the measurements above. Mechanics: `make ui`, `go build ./...`, `devctl restart`, `pkill -f mcp-chrome`, then playwright `browser_navigate` + `browser_evaluate` (async functions with double-requestAnimationFrame settles) + `browser_take_screenshot`, and `cp` of the three PNGs into the ticket dir.

### Why

getComputedStyle plus getBoundingClientRect measured against the dispatched event's coordinates is the assertion form the design doc's §7 prescribes; the screenshots are the human visual-drift check for the adoption PR.

### What didn't work

Three real failures, verbatim:

1. First `browser_navigate`: `Error: browserBackend.callTool: Target page, context or browser has been closed`, then on retry `Error: Browser is already in use for /home/manuel/.cache/ms-playwright-mcp/mcp-chrome-5b9cea0, use --isolated to run multiple instances of the same browser` — fixed exactly as the brief predicted with one `pkill -f mcp-chrome` (exit code 144, i.e. SIGTERM'd its own match — harmless).
2. The first contextmenu attempt dispatched `new MouseEvent("contextmenu", {...})` WITHOUT `view: window` and read the menu synchronously in the same evaluate: it found a menu with header `<lean.goal> ?m.plus_n_zero.1` at rect (755,1029) — not the tile menu and not at my coordinates; `atEvent: false`. A follow-up read found no menu at all (`stillOpen: false`). The passing version dispatches with `view: window` and awaits two requestAnimationFrame ticks before reading; it returned the tile menu exactly at (64,65). Lesson: synchronous same-task reads after synthetic events race React's state flush, and an eventless read can catch a stale surface.
3. Page load logged `[ERROR] Failed to load resource: the server responded with a status of 404 (Not Found) @ http://localhost:8666/v1/workbenches/wb-281b88a4-0bf1:0` — a stale persisted workbench id after the server restart; the app recovered by creating a fresh document (sync reached "synced", 7 tiles rendered). Pre-existing recovery path, not a regression.

### What worked

Every assertion passed on the corrected harness: fixed/100/at-coordinates/in-viewport for the menu; paint-on-target and clean-release for the drag; focused combobox for Ctrl-K.

### What I learned

- The drop overlay sits inside the tile's border box, so "exactly the left half" is true within the 2px border inset — assertion tolerances must account for it.
- devctl's restart left the playwright-managed chrome holding its profile lock; the pkill-once retry loop is the reliable sequence.

### What was tricky to build

Simulating the grip drag without playwright's high-level drag API (which would fire real pointer capture): useTileDrag listens on window for pointermove/pointerup after a grip pointerdown, so dispatching PointerEvents (grip-targeted down, window-targeted move/up) reproduced the hook's exact contract, and releasing at (0,0) — over the masthead, no tile — tested cleanup without mutating the layout.

### What warrants a second pair of eyes

The mid-drag screenshot shows the overlay over the INTERACTIVE GOALS tile; confirm by eye against datalab's overlay for the family look (design doc §7's three-image comparison).

### What should be done in the future

Turn the three evaluate blocks into a checked-in playwright e2e (the design doc's Phase 1 acceptance calls for it per product); today it lives only in this diary and the orchestrator's report.

### Code review instructions

Re-run: `make ui && devctl restart`, then in a browser console on :8666 paste the contextmenu snippet from this step and confirm position fixed/z-index 100/rect at coordinates. The screenshots are in `various/turboproof-adoption/` beside this file's parent dir.

### Technical details

- Commits: 603b6c5 (dependency+CSS), 35c5efc (chrome swap), 7539704 (launcher+shortcut). All on turboproof task/transcript-agent; nothing committed in the pbui repo.
- Gates: tsc --noEmit clean ×3 runs; vitest 8 files / 45 tests passed ×3 runs; ui-token-check green ×3; `make ui` ✓ built in 476ms; `go build ./...` clean.
- Viewport for all measurements: 1431×1369.
