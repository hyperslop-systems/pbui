---
Title: Agentlogic adoption diary
Ticket: PBUI-UNIFY-001
Status: active
Topics:
    - pbui
    - frontend
    - design
DocType: reference
Intent: long-term
Owners: []
RelatedFiles: []
ExternalSources: []
Summary: Subagent diary for adopting the Phase 1+2 pbui deliverables (presentation-parts.css, chrome.css, TileFrame, useTileDrag) in agentlogic's ui — what was swapped, what the brief assumed that the repo did not have, and the deliberate drag-behavior changes.
LastUpdated: 2026-07-31T13:20:00-04:00
WhatFor: Review and continuation record for agentlogic's adoption of the shared pbui chrome and part styles.
WhenToUse: Read when reviewing agentlogic commits 7c01978/6f2c649, when adopting the kit in another product, or when wondering why agentlogic has no MouseDocLine/AcceptBanner/launcher adoption step.
---

# Diary

## Goal

Adopt the PBUI-UNIFY-001 Phase 1+2 deliverables in agentlogic's ui: import the packaged `presentation-parts.css` and `chrome.css`, rewrite the tile chrome onto `TileFrame` + `useTileDrag`, delete the superseded local CSS and imperative drag code, and pin the incident regression (menu `position: fixed`) with a product-level test — with every gate (typecheck, vitest, vite build, go build, go test) green.

## Step 1: Survey — the brief's map vs. the repo's territory

Before touching anything I read the ticket design doc (§3–6) and then walked agentlogic's ui the way the brief directed. The survey mattered more than usual, because the repo disagreed with the brief on several load-bearing points, and the difference decided which tasks existed at all.

What the survey established: `ui/package.json` already pointed `@hyperslop-systems/pbui` at `file:../../pbui` (so task 1 reduced to refreshing a stale install); `app.css` (1228 lines) contained NO presentation/menu/mouse-doc/accept CSS — only the `alg-tile` chrome, the five `alg-tile--drop-*` preview rules, and product styling; and agentlogic has no `createPbui` runtime file, no `usePbui`, no `MouseDocLine`/`AcceptBanner` variants, no `Chrome.tsx`, and no Mod+K/`metaKey` shortcut code anywhere under `src/`. The design doc's duplication map (rows 1–2) lists agentlogic as carrying the presentation CSS in `app.css` and a MouseDocLine variant in `Chrome.tsx`; on this branch (`task/transcript-agent`, after the AGENTLOGIC-3 protocol rework) neither exists. Agentlogic consumes pbui as plain components (`Text`, `AppBody`, `IconButton`, …), not through the presentation runtime.

### Prompt Context

**User prompt (verbatim):** "do the ticket, you can use subagents" — relayed to me as the agentlogic-adoption subagent for PBUI-UNIFY-001 (Phases 1+2 adoption), with the orchestrator's task list: point the pbui dep at `file:../../pbui`, import the two packaged stylesheets in `main.tsx`, delete the superseded `app.css` blocks, rewrite `Frame` onto `TileFrame` + `useTileDrag`, adopt the runtime `MouseDocLine`/`AcceptBanner` if present, adopt `routeWorkbenchKey` if shortcut code exists, keep all gates green, add the `[data-part="menu"]` / `position: fixed` CSS-content vitest, commit at intervals with the Fable co-author trailer, and keep this diary (the diary/commit mandate is part of the standing instructions).

**Assistant interpretation:** Migrate agentlogic's ui onto the shared pbui chrome and part styles, deleting the local copies in the same commits, without browser tools — verification is tests + build + CSS-content assertions.

**Inferred user intent:** End the family's copy-paste drift: one tile chrome, one presentation stylesheet, and a product-level regression test for the invisible-menu incident, so the next pbui change lands in agentlogic by version bump instead of transcription.

### What I did
- Read the design doc §3–6 (`.../design-doc/01-intern-guide-...md`), then `ui/package.json`, `ui/src/main.tsx`, `ui/src/components/organisms/Tile.tsx`, `ui/src/store/workbench.ts`, `ui/src/store/workbenchContext.tsx`, `ui/src/styles/app.css`, `ui/src/components/organisms/Tile.tones.test.ts`, and the repo `Makefile`.
- Grepped for `createPbui|usePbui`, `MouseDoc|AcceptBanner|ACCEPT`, `metaKey|Mod+K|isModKey`, `alg-tile`, `data-part` across `ui/src`.
- Inspected pbui 0.2.0's actual surface: `dist/chrome/*.d.ts` (TileFrameProps, UseTileDragOptions), the `exports` map, and the selectors in `dist/chrome.css` / `dist/presentation-parts.css`.

### Why
- The brief's tasks 5 and 6 are conditional on code that the duplication map said existed; acting on the map without checking would have meant inventing a presentation runtime agentlogic never had.
- Knowing `TileFrame`'s exact prop names (`dropZone`, `registerElement`, `grip.onPointerDown`) before rewriting avoided a guess-compile loop.

### What worked
- The greps were decisive: `createPbui` — zero hits; `MouseDoc|AcceptBanner` — zero hits outside an unrelated `ACCEPTED` comment in `model/compile.ts`; `metaKey|Mod+K` — zero hits. Tasks 5 and 6 have no targets in this repo.
- `dist/chrome/index.d.ts` confirmed every export the brief promised, plus `zoneFor` and `registeredTileCount` for tests.

### What didn't work
- A zsh quoting slip: `echo ====` in a compound command failed with `(eval):1: === not found` (zsh treats a leading `=` as a command-position expansion). Cosmetic; re-ran quoted.
- `grep -rn "createPbui" src` exiting 1 (no matches) short-circuited an `&&` chain, hiding the second command's output on the first try.

### What I learned
- The duplication map describes the family at survey time; agentlogic's AGENTLOGIC-3 rework had already deleted its presentation-CSS and Chrome.tsx copies. A subagent brief is a hypothesis about a repo, not a fact.
- pnpm does not refresh a `file:` dependency's content on its own timetable: `node_modules/@hyperslop-systems/pbui` claimed version 0.2.0 but its `dist/` predated the chrome build (no `chrome.css`, no `chrome/`). A plain `pnpm install` after the upstream rebuild did pick it up.

### What was tricky to build
- Nothing built yet in this step; the tricky part was epistemic — resisting the brief's instruction to "replace agentlogic's variants" of MouseDocLine/AcceptBanner when the grep said there were none. The cause of the mismatch is branch drift between the design-doc survey and this checkout; the symptom was every anchor file in the brief (Chrome.tsx, `pbui/runtime.tsx`) missing; the resolution was to verify with three independent greps and record the deviation rather than manufacture a runtime file whose components nothing would render.

### What warrants a second pair of eyes
- The decision to SKIP tasks 5 and 6 (runtime MouseDocLine/AcceptBanner, shortcut routing) — if agentlogic is supposed to GROW a presentation runtime as part of this ticket, that is new feature work the orchestrator should schedule explicitly, not a replace-in-place.

### What should be done in the future
- When agentlogic adopts pbui presentations (object menus over steps/files would fit its model), the runtime file should return `MouseDocLine`/`AcceptBanner` from `createPbui` on day one — the stylesheet import is already in place.

### Code review instructions
- Nothing to review for this step; it produced no diff. The survey's conclusions are checkable with: `grep -rn "createPbui\|MouseDoc\|AcceptBanner\|metaKey" ui/src` in the agentlogic repo (expect zero relevant hits).

### Technical details
- Repo state at start: branch `task/transcript-agent` at `a2420ca`, one unrelated dirty file (`ttmp/.../AGENTLOGIC-5/.../01-diary.md`) left untouched.
- pbui surface consumed: `TileFrame({placementId, tone, title, canClose, onSplit, onClose, grip?, dropZone?, dragging?, swapLabel?, dockLabel?, registerElement?, children})`, `useTileDrag({id, onSwap, onDock}) → {register, onGripPointerDown, dragging, zone}`; `chrome.css` parts: tile, tile-bar, tile-grip, tile-title, tile-actions, tile-body, drop-zone, drop-zone-label, launcher*.

## Step 2: The packaged stylesheets and the incident's product-level test (commit 7c01978)

The first commit is the safety-critical half: `main.tsx` now imports `presentation-parts.css` and `chrome.css` from the package, in the documented order (tokens first, pbui sheets, `app.css` last so the product overrides), and a new vitest reads the INSTALLED package's CSS and asserts the `[data-part="menu"]` block declares `position: fixed` — the exact rule whose silent absence caused the family's invisible-menu incident.

The install itself was the only real motion: `node_modules` held a stale pbui copy (version said 0.2.0, `dist/` had no chrome.css). `NODE_AUTH_TOKEN=$(vault kv get -field=token kv/ci/github/hyperslop-systems/datalab/packages-read-token) pnpm install` refreshed the `file:` dependency in 1.7s with no lockfile delta.

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Assistant interpretation:** Tasks 1, 2, and the test half of task 7: refresh the dep, add the two imports after `components.css`, and write the CSS-content regression test.

**Inferred user intent:** Make the incident structurally unrepeatable in this product: the rule ships in the package, the import is one line, and a test fails if either goes missing.

**Commit (code):** 7c01978 — "PBUI-UNIFY-001: import pbui's packaged part styles, and pin them with a test"

### What I did
- `ui/src/main.tsx`: added `import "@hyperslop-systems/pbui/presentation-parts.css";` and `import "@hyperslop-systems/pbui/chrome.css";` immediately after the `components.css` import, with a comment explaining what each carries and why `app.css` still comes last.
- Added `ui/src/styles/packagedParts.test.ts`: reads `node_modules/@hyperslop-systems/pbui/dist/presentation-parts.css` via a cwd-relative path (vitest runs with `ui/` as cwd), asserts a `[data-part="menu"] { … }` block exists and contains `position: fixed` (block-scoped match, not a whole-file substring), and asserts `chrome.css` ships the tile/tile-bar/tile-grip/tile-body/drop-zone parts this product's frame relies on.
- Ran `pnpm typecheck` and `pnpm test`: clean; 105 passed, 1 skipped (the two new tests included).
- Committed `main.tsx` + the test as 7c01978, noting in the message that the `file:../../pbui` specifier is temporary until pbui 0.2.0 publishes.

### Why
- The brief marks the geometry/CSS assertion "non-negotiable" (design doc Phase 1, step 3); without a browser, the honest product-level equivalent is asserting the file the bundler inlines.
- `presentation-parts.css` is imported even though agentlogic renders no presentations today: the import is the family checklist's day-one line, and it means the first future presentation gets a positioned menu instead of re-running the incident.

### What worked
- Everything, first try: typecheck clean, 105/1 skipped, and the block-scoped regex caught exactly the minified and unminified forms I checked it against.

### What didn't work
- N/A — this step had no failures.

### What I learned
- The `exports` map in pbui 0.2.0 already names both stylesheets (`"./presentation-parts.css": "./dist/presentation-parts.css"`), so Vite resolves the bare-specifier CSS imports with no aliasing.

### What was tricky to build
- Only the test's strictness calibration: a whole-file `toContain("position: fixed")` would pass even if the declaration migrated to a different selector, so the test extracts the `[data-part="menu"]\s*\{[^}]*\}` block first and asserts inside it. The `[^}]*` approach relies on the menu block containing no nested braces, which is true of the shipped file and will stay true for a flat rule block.

### What warrants a second pair of eyes
- Whether reading `node_modules` in a test is acceptable repo policy (it is deliberate here: the point is to test the INSTALLED artifact, and the file: install makes it hermetic in CI via `make ui-install`).

### What should be done in the future
- When pbui 0.2.0 publishes to GitHub Packages, flip `"@hyperslop-systems/pbui": "file:../../pbui"` to the version specifier and drop the Makefile's checkout-next-door requirement.

### Code review instructions
- Start with `/home/manuel/workspaces/2026-07-30/transcript-agent/agentlogic/ui/src/main.tsx` (the import order comment) and `/home/manuel/workspaces/2026-07-30/transcript-agent/agentlogic/ui/src/styles/packagedParts.test.ts`.
- Validate: `cd agentlogic/ui && pnpm install && pnpm test -- packagedParts`.

### Technical details
- Install command (token per the brief): `NODE_AUTH_TOKEN=$(vault kv get -field=token kv/ci/github/hyperslop-systems/datalab/packages-read-token) pnpm install`.
- The menu block in the shipped file: `[data-part="menu"] { position: fixed; z-index: 100; min-width: 260px; … }` (dist/presentation-parts.css:86).

## Step 3: The chrome swap — Frame becomes a ten-line adapter (commit 6f2c649)

`Frame` in `Tile.tsx` kept its signature (`{placementId, title, tone, children}` — three call sites unchanged) and lost its body: `TileFrame` now draws the tone bar, grip, split/close buttons, and drop overlay, and `useTileDrag` owns the registry, hit test, and zone classification. The adapter maps the kit's callbacks straight onto the existing workbench verbs (`swapPlacements`, `dockPlacement`, `splitPlacement`, `closePlacement`), exactly the DR-U3 shape. Deleted outright: the `findDropTarget` `elementsFromPoint` walk, the `DROP_CLASSES` classList painting, and every `.alg-tile*` rule in `app.css`. The `alg-tile__body` content-scrolling rules were rewritten onto `[data-part="tile-body"]` since the markup they targeted is now the kit's.

Three behavior changes ride along, all deliberate family unifications and all in the commit message: DR-U4's banded drop geometry (30% of the smaller dimension, capped at 110px) replaces the fixed 25% quarters; the drop preview becomes a labeled half-tile overlay rendered declaratively by the target tile, replacing the imperative inset box-shadows; and the close button now follows the family's leaf-count rule — the last pane of a workspace no longer offers ✕ (computed as `leaves(workspaceTree).length > 1` via the store's existing helpers).

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Assistant interpretation:** Tasks 3, 4, and the gates half of task 7: rewrite the chrome onto the kit, delete the parallel styles in the same commit, and prove it with the full gate set.

**Inferred user intent:** One window chrome across the family, with agentlogic's drag/preview drift ended rather than preserved.

**Commit (code):** 6f2c649 — "PBUI-UNIFY-001: swap the hand-built tile chrome for pbui's TileFrame kit"

### What I did
- `ui/src/components/organisms/Tile.tsx`: replaced the `IconButton` import with `TileFrame, useTileDrag`; added `leaves, workspaceOfPlacement` from the store; deleted `DropTarget`, `findDropTarget`, `DROP_CLASSES`, and the imperative `onGripPointerDown`; rewrote `Frame` as the adapter described above (net −104 lines). `NodeView`/`SplitView` and the divider drag are untouched — the split renderer is explicitly deferred in the design doc (row 8 / DR-U5's deferral note).
- `ui/src/styles/app.css`: deleted the `.alg-tile__grip` block, the five `.alg-tile--drop-*` rules, and the whole tile-frame section (`.alg-tile`, `__bar`, `__title`, `__actions`, `__body`, plus their comments), leaving a short pointer comment at the seam; rewrote the two `.alg-tile__body`-scoped content rules to `[data-part="tile-body"]`. 1228 → 1140 lines (−108 deleted, +20 comment/selector lines).
- Ran the gates: `pnpm typecheck` (clean), `pnpm test` (105 passed, 1 skipped), `pnpm build` (tsc + vite; success — the >500 kB chunk warning predates this work), `GOWORK=off go build ./...` and `GOWORK=off go test ./...` at repo root (all ok, mostly cached).
- Verified the shipped bundle the way the no-browser brief demands: the rebuilt `pkg/webui/dist` CSS contains `[data-part=menu]{…position:fixed…}` and all six tile-chrome parts, and zero `alg-tile` occurrences.
- Committed `Tile.tsx` + `app.css` + the rebuilt committed bundle (`pkg/webui/dist`, per the repo's embed convention) as 6f2c649.

### Why
- Rewriting rather than keeping parallel `alg-*` styles is the brief's explicit instruction, and the kit's declarative preview makes the old "imperative on purpose" comment obsolete: the re-render cost argument dissolved because `useTileDrag` scopes state updates to the source and target tiles only.
- `canClose` from leaf count: `TileFrame` requires the prop, and the family rule (datalab's, per duplication-map row 4) is the reason the prop exists; wiring it `true` unconditionally would have adopted the API while rejecting its meaning.

### What worked
- The whole gate set passed on the first run after the rewrite — the store's exported `leaves`/`workspaceOfPlacement` helpers made `canClose` a two-liner, and the kit's `DockZone` type is structurally identical to the store's (`"left" | "right" | "top" | "bottom"`), so no mapping layer was needed.

### What didn't work
- N/A — no failures in this step. (The stale-install and zsh issues were Step 1/2 territory.)

### What I learned
- `pnpm build` writes straight into `../pkg/webui/dist` (committed, `go:embed`-ed), so a UI change is not "done" until the bundle is rebuilt and committed too — the Makefile comment warns that a running server serves the PREVIOUS bundle until the Go binary is rebuilt.
- Minified verification needs different greps: the bundle has `[data-part=menu]` (no quotes) on one line, so line-count greps and quoted-attribute greps both mislead.

### What was tricky to build
- The `canClose` scope question. The old UI always offered ✕; the protocol store would accept closing the last placement. Symptom to avoid: adopting `TileFrame` with `canClose={true}` everywhere preserves a dead-end (a user can close a workspace to empty with no affordance to refill it), while gating changes user-visible behavior in an "adoption" commit. Resolution: implement the family rule, compute it per-workspace with existing helpers (`workspaceOfPlacement` → find the workspace's tree → `leaves(tree).length > 1`), and declare the change in both the commit message and this diary rather than hiding it.
- Deleting CSS without orphaning content styles: two `app.css` rules targeted `.alg-tile__body` descendants (`kind-legend`/`segmented-bar` overflow containment). Deleting the chrome section wholesale would have silently un-fixed a real clipping bug; those rules were rewritten to the kit's `[data-part="tile-body"]` instead of deleted.

### What warrants a second pair of eyes
- The leaf-count `canClose` recomputes on every `Frame` render by walking the tree (`workspaceOfPlacement` is O(nodes) per tile). Fine at workbench scale (tens of tiles); worth a memo if tile counts grow.
- The drop-overlay look and the banded zone feel changed — a human should drag a tile around once in a real session (this subagent was barred from the browser; the drag path is covered by the kit's own unit tests upstream, not by agentlogic's suite).
- The committed bundle diff (`pkg/webui/dist/assets/index-DBbZAkbf.*`) is generated; review the sources and trust the build, or re-run `pnpm build` and diff.

### What should be done in the future
- Storybook: `Workbench.stories.tsx` renders the workbench and thus now exercises the kit chrome implicitly; a dedicated TileFrame story is the pbui package's job (design doc Phase 2, step 6), not agentlogic's.
- If agentlogic ever wants per-workspace "close the last pane" (e.g. a workspace-delete verb), that belongs in the workspace strip UI, not the tile chrome.

### Code review instructions
- Start with `/home/manuel/workspaces/2026-07-30/transcript-agent/agentlogic/ui/src/components/organisms/Tile.tsx` (`Frame`, ~60 lines including the behavior-change comment) against the pre-image (`git show 7c01978:ui/src/components/organisms/Tile.tsx`), then the `app.css` diff (`git show 6f2c649 -- ui/src/styles/app.css`).
- Validate: `cd agentlogic/ui && pnpm typecheck && pnpm test && pnpm build`, then at repo root `GOWORK=off go build ./... && GOWORK=off go test ./...`.
- Behavior spot-check without a browser: `grep -c alg-tile pkg/webui/dist/assets/index-DBbZAkbf.css` → 0; `grep -o '\[data-part=menu\]{[^}]*}' pkg/webui/dist/assets/index-DBbZAkbf.css | grep -o 'position:fixed'` → `position:fixed`.

### Technical details
- Commits (agentlogic, branch `task/transcript-agent`):
  - 7c01978 — "PBUI-UNIFY-001: import pbui's packaged part styles, and pin them with a test" (2 files, +56)
  - 6f2c649 — "PBUI-UNIFY-001: swap the hand-built tile chrome for pbui's TileFrame kit" (7 files, +80/−237 incl. bundle)
- Deviations from the brief, consolidated: task 1 was already done upstream (dep already `file:`, only the install was stale); tasks 5 and 6 skipped — agentlogic has no createPbui runtime, no MouseDocLine/AcceptBanner variants, and no shortcut/launcher code (the design doc's rows 1–2 for agentlogic describe a pre-AGENTLOGIC-3 state); no docmgr changelog was updated in agentlogic (the adoption has no agentlogic ticket; the commit messages carry it, per the brief's fallback).
- The adapter, for the next product:

```tsx
const drag = useTileDrag({
  id: placementId,
  onSwap: (sourceId, targetId) => workbench.swapPlacements(sourceId, targetId),
  onDock: (sourceId, targetId, zone) => workbench.dockPlacement(sourceId, targetId, zone),
});
const canClose = leaves(workspaceTreeOf(placementId)).length > 1;
<TileFrame placementId={…} tone={…} title={…} canClose={canClose}
  onSplit={(d) => workbench.splitPlacement(placementId, d)}
  onClose={() => workbench.closePlacement(placementId)}
  grip={{ onPointerDown: drag.onGripPointerDown }}
  dropZone={drag.zone} dragging={drag.dragging} registerElement={drag.register}>
```
