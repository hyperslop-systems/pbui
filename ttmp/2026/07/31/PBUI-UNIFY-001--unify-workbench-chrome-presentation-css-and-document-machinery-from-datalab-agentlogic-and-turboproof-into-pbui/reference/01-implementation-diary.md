---
Title: Implementation diary
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
Summary: Chronological implementation diary for the family unification — the orchestrator's record; subagent phases keep their own diaries beside this one.
LastUpdated: 2026-07-31T13:00:00-04:00
WhatFor: Review and continuation record for the PBUI-UNIFY-001 implementation.
WhenToUse: Read before continuing or reviewing the extraction; see also the per-phase subagent diaries (02-, 03-, 04-).
---

# Diary

## Goal

Record the implementation of PBUI-UNIFY-001: extracting the presentation-parts CSS, the chrome kit, and the workbench mutation layer out of the three products into the pbui and workbench-protocol packages, then migrating the products onto the shared modules. Work is split between this orchestrator (Phases 1, 2, datalab-ui adoption, integration) and subagents (Phase 3, turboproof and agentlogic adoption), each keeping its own diary in this ticket's reference/ directory.

## Step 1: Phase 1 — the safety-critical CSS and the two instance strips

The smallest and most dangerous duplication first (design doc §6 Phase 1): the presentation-parts stylesheet whose absence shipped turboproof with an invisible object menu, and the two chrome strips (MouseDocLine, AcceptBanner) that are pure functions of pbui instance state.

### Prompt Context

**User prompt (verbatim):** "do the ticket, you can use subagents" — followed mid-turn by "Goal set: do the ticket, you can use subagents. Everyone should keep a detailed diary according to the diary format skill, and commit at appropriate intervals. This is MANDATORY"

**Assistant interpretation:** Implement PBUI-UNIFY-001 across the four repositories per the ticket's phased plan, parallelizing with subagents, with diary discipline for every worker and commits at intervals.

**Inferred user intent:** The extraction actually lands — packages changed, products migrated, copies deleted — not a design that waits for hands.

**Commit (code):** cf85eda — "PBUI-UNIFY-001 Phase 1: presentation-parts.css + MouseDocLine/AcceptBanner from createPbui"

### What I did

- Found the static-CSS pipeline: `dist/components.css` is not built from source — it is `public/components.css`, copied by vite's public-dir handling. `presentation-parts.css` therefore lives in `public/` and ships via a new package export.
- Wrote `public/presentation-parts.css`: datalab-ui's `pbui.module.css` attribute-selector rules (presentation hover, acceptable pulse + reduced-motion, the fixed z-100 menu, item states) plus parts for the two new components (`accept-banner`, `mouse-doc-*`), every value a `--pbui-*` token WITH a fallback, matching components.css's convention — pbui defines no token values.
- Extended `createPbui` to return `MouseDocLine` and `AcceptBanner` (DR-U2), both closing over the instance's `usePbui` exactly as `ObjectMenu` does. AcceptBanner keeps datalab's escape-surface participation (`useEscapeSurface`) so a dialog opening above a pending accept does not lose the accept to a stray Escape.
- Bumped the package to 0.2.0; added the `"./presentation-parts.css"` export.
- Tests (`instanceChrome.test.tsx`): mouse-doc modes (READY/ACCEPT MODE, hover doc, ambient), banner lifecycle including Escape-abort resolving the accept promise with null, and a css-content assertion that `[data-part="menu"]` carries `position: fixed` + `z-index: 100` — the incident's regression test at the package level.

### Why

- Fallback-bearing tokens rather than bare `var()` reads: the file must render sanely in a product that has not defined a token yet, and components.css already established the convention.

### What worked

- 10/10 presentation tests, typecheck, build; `dist/presentation-parts.css` emitted by the existing pipeline with zero build-config change.

### What didn't work

- `new URL("../../public/…", import.meta.url)` in the test threw `TypeError: The URL must be of scheme file` — the same vitest quirk the workbench-protocol tests hit earlier; cwd-relative `readFileSync` is the established fix.

### What I learned

- The package's static CSS ships from `public/`, untouched by vite's lib build — the zero-config home for shared stylesheets.

### What was tricky to build

- Locating the CSS pipeline at all: no build step references components.css, and dist/ is gitignored, so the source had to be traced to `public/` by elimination (grep for its selectors across src, scripts, configs).

### What warrants a second pair of eyes

- The fallback hex values are datalab's palette approximations; a product with very different tokens gets those fallbacks only when it forgot to define tokens — acceptable, but sanity-check them once against the family tokens file.

### What should be done in the future

- N/A (the products' adoption is later steps).

### Code review instructions

- `git show cf85eda`; run `pnpm vitest run src/presentation && pnpm build && ls dist/presentation-parts.css`.

### Technical details

- Part names verified against what the components emit (`menu`, `menu-header`, `menu-item`, `menu-reason`, `presentation`, `presentation-svg`); datalab's `menu-target` name has no emitter and was dropped.

## Step 2: Phase 2 — the chrome kit

The document-model-agnostic chrome (design doc DR-U3): `useTileDrag`, `TileFrame` + `DropZoneOverlay`, `LauncherShell`, and `shortcutRouting`, in a new `src/chrome/` module exported from the package root, with `chrome.css` as its data-part stylesheet.

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Assistant interpretation / intent:** (see Step 1)

**Commit (code):** 8f99e8a — "PBUI-UNIFY-001 Phase 2: the chrome kit — TileFrame, useTileDrag, LauncherShell, shortcut routing"

### What I did

- `useTileDrag`: datalab's `useDrag` with the Redux dispatch replaced by `onSwap`/`onDock` callbacks; the module-level `TILES` registry, `isConnected` eviction, and the DR-U4 banded `zoneFor` (30 % of the smaller dimension, capped 110 px) kept verbatim, now exported and unit-tested. `registeredTileCount()` is exported for the hygiene test.
- `TileFrame`/`DropZoneOverlay`: the family frame per design §5.2 — tone-as-title-bar, optional grip, title SLOT (the product wraps its `<tile>` Presentation there, keeping menu and buttons two doors to one verb set), split/close IconButtons, and the declarative overlay (the hook reports `zone` per tile; each tile renders its own overlay — turboproof's imperative classList variant existed only because it lacked the shared registry).
- `LauncherShell` (DR-U6): Dialog + combobox TextInput + the keyboard loop with wrap and highlight retention; grouped rows injected; `splitDirectionFor` exported for the products' choose() handlers; the two invariants (single Escape owner; never destroy a working tile) documented at the extraction point.
- `shortcutRouting.ts` moved verbatim from datalab-ui; the pure halves of its test suite came along (the escape-surface and layout-store halves stay in datalab-ui where those subjects live).
- `public/chrome.css` with the tile/drop-zone/launcher data-part styles; `"./chrome.css"` export.

### Why

- Callbacks instead of dispatch keep the kit store-free (DR-U3): datalab adapts with `layoutActions`, the protocol products with verb `perform` calls — ten lines each.

### What worked

- 11 new tests; whole-package run 49/49; build emits both stylesheets.

### What didn't work

- `CSS.escape` is undefined under this jsdom: `TypeError: Cannot read properties of undefined (reading 'escape')` from the highlight-scrolling effect. Fixed with `ownerDocument.getElementById` (row ids are product-minted and may contain any character anyway) plus a guarded `scrollIntoView?.()`; `splitDirectionFor` got a feature-tested escape fallback.

### What I learned

- jsdom's missing `CSS.escape` is a portability landmine for any selector built from product-minted ids; `getElementById` sidesteps the whole class of bug.

### What was tricky to build

- The overlay's home: imperative painting (turboproof) vs per-tile declarative rendering (datalab). Declarative wins once the registry is shared — the hook already knows the target — and keeps the label inside React where a product can re-word it.

### What warrants a second pair of eyes

- The module-level drag registry is global to the bundle: two independent workbenches on one page share it. Placement ids are unique per store today; if two stores ever collide, the registry needs an instance scope (the same caveat datalab's original carries).

### What should be done in the future

- Storybook stories for the kit in this package (the products' stories stop duplicating them) — deferred to the closure phase.

### Code review instructions

- `git show 8f99e8a`; diff `src/chrome/useTileDrag.ts` against `packages/datalab-ui/src/components/organisms/Tile/useDrag.ts` (the deltas should be exactly: callbacks for dispatch, the exported test hook).
- Validate: `pnpm vitest run src/chrome && pnpm build`.

## Step 3: Phase 3 integrated, and datalab-ui's adoption

Two threads landed while the product-adoption subagents ran. The Phase-3 subagent delivered `workbench-protocol/client` with the TS↔Go parity corpus (its own diary: reference/02); I reviewed and committed it, then performed the datalab-ui adoption myself — datalab-ui consumes pbui as `workspace:^`, so it adopts the unpublished 0.2.0 with no dependency gymnastics and serves as the first real consumer of the extracted modules.

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Assistant interpretation / intent:** (see Step 1)

**Commit (code):** f3d8134 (Phase 3, subagent work reviewed+committed), ed9b1f6 (datalab-ui adoption)

### What I did

- Reviewed and committed Phase 3: all 15 mutation arms in the TS applier (the products' copies had 9), the `ClientConfig` factory for product-flavored builders, 26 protojson fixtures generated deterministically through the TS applier and asserted from BOTH appliers (TS 43/43; Go `TestApplierParityFixtures` 26/26; gofmt clean). The agent surfaced four genuine TS↔Go divergences and resolved all toward Go per the brief: name/title trimming, `PLACEMENT_POSITION_UNSPECIFIED` rejection (the product copies silently treated it as AFTER), `documentDelete` unknown/in-use guards, and `documentPut` cloning.
- datalab-ui adoption: package CSS imports into `styles.ts`; `MouseDocLine`/`AcceptBanner` become the instance's own (locals deleted); `pbui.module.css` shrinks from 183 lines to the one part this product itself emits (`menu-target`, from `renderMenuHeader`) and moves to `styles/pbui-extras.css` as a global sheet — its only importers were the deleted components, so as a module it would have silently stopped loading; `Tile` swaps `useDrag` for the package `useTileDrag` (dispatch adapters) and renders the shared `DropZoneOverlay`; `shortcutRouting` deleted locally and imported from the package (test repointed). typecheck, 509/509 tests, build.
- Deliberately deferred: datalab's `TileFrame`/`LauncherShell` adoption. Its Tile and LauncherDialog are the policy-rich references (InlineRename in the title slot, active-placement capture props, the query language); DR-U6 explicitly scopes the shell to not export that policy, and rewriting the reference implementation for cosmetic sameness is churn without risk reduction. Recorded as follow-up.

### Why

- Committing the subagent's work myself: two workers sharing one repository index is how commits get corrupted; the brief told the agent not to touch git, and the review-then-commit step is where its work got read.

### What worked

- The parity corpus did exactly what §5.3 promised on day one: it FOUND drift (four divergences) instead of documenting the hope that there is none.

### What didn't work

- N/A in this step (the subagent's failures are recorded verbatim in its own diary).

### What I learned

- The products' appliers were not just duplicated — they were WRONG relative to the server on four behaviors, quietly: a mutation trimmed by the server but not locally leaves the outbox document diverging from the acknowledged one until the next rebase. The unification is a correctness fix, not only hygiene.

### What was tricky to build

- The datalab `pbui.module.css` unwind: deleting the two component importers would have silently unloaded the surviving product-specific rule — the same failure class as the original incident, one level down. Caught by asking "who still imports this file" before moving on.

### What warrants a second pair of eyes

- The Go parity test reads the fixture directory from the npm package path by relative path; fixtures are not in the npm tarball (files: ["dist"]) — fine for a monorepo test, but a packaging reviewer should confirm that is intended.
- The trimming divergence becomes a visible behavior change for agentlogic/turboproof when they adopt `client/` (their local appliers do not trim today).

### What should be done in the future

- Products adopt `client/` (task 9kjg) — scheduled after the chrome adoptions land.
- A CI regenerate-and-diff check for the fixture corpus (the generator is deterministic).

### Code review instructions

- `git show f3d8134` (start at `packages/workbench-protocol/src/client/apply.ts` against `pkg/workbench`'s applier; then the fixtures and both parity tests), `git show ed9b1f6`.
- Validate: `cd packages/workbench-protocol && pnpm vitest run && pnpm build`; `go test ./pkg/workbench/...`; `cd packages/datalab-ui && pnpm test`.
