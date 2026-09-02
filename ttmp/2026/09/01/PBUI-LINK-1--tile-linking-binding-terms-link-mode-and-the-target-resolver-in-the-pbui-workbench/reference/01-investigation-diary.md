---
Title: Investigation diary
Ticket: PBUI-LINK-1
Status: active
Topics:
    - pbui
    - design
    - architecture
    - actions
    - frontend
    - onboarding
DocType: reference
Intent: long-term
Owners: []
RelatedFiles:
    - Path: abs:///home/manuel/Downloads/PBUI-linked-tiles-research-bundle/MANIFEST.md
      Note: Inventory of the research bundle (report, diagrams, papers, prototypes, toy)
    - Path: abs:///home/manuel/code/wesen/2026-08-28--toy-actions-linked-pbui/approaches/index.html
      Note: Pointed to tickets PBUI-LINK-UI / PBUI-LINK-UI-AUDIT, which led to the research bundle
    - Path: abs:///home/manuel/code/wesen/2026-08-28--toy-actions-linked-pbui/lib/core.js
      Note: Read in full as the executable reference for the binding transitions
    - Path: repo://packages/pbui-chat/src/types.ts
      Note: Wire reference precedent that resolved the serializability question
    - Path: repo://packages/pbui-ecommerce/src/fixtures/orders.ts
      Note: Seeded order generator with the eight chat-demo anchors
    - Path: repo://packages/pbui-ecommerce/src/linking.test.tsx
      Note: Scenes 1 and 2 as DOM postconditions
    - Path: repo://packages/pbui-ecommerce/src/plots/documents.ts
      Note: Three seeded plot documents; branded ids
    - Path: repo://packages/pbui-workbench/src/verbs.ts
      Note: Largest file read; grep-then-range strategy recorded
    - Path: repo://src/chrome/useTileDrag.ts
      Note: startTileCarry recognized as the port-drag lifecycle
    - Path: repo://src/presentation/links/plan.ts
      Note: Refusal codes and explanations the badges and menus show
ExternalSources: []
Summary: 'Chronological record of the PBUI-LINK-1 investigation: where the linked-tiles research lives, how the toy and the audit were read, what was found in pbui (kernel, accept mode, document bindings, verbs, chrome, products), what was tricky, and how the design guide was produced and delivered.'
LastUpdated: 2026-09-01T16:40:00-04:00
WhatFor: Continue or review the PBUI-LINK-1 analysis without re-deriving where the evidence is.
WhenToUse: Before extending the design guide, before starting Phase 1, or when checking why a design decision cites a particular file.
---




# Diary

## Goal

Capture how the tile-linking analysis for pbui was carried out: which research artifacts were located and read, which parts of the pbui codebase were inspected as evidence, what turned out to be surprising, and how the intern guide was assembled, validated, and uploaded.

## Step 1: Locate the research, read the toy and the audit, map pbui, write the guide

The request was to study the linked-tiles toy project and the real pbui repository, then produce a docmgr ticket with a serious, intern-oriented analysis and design for adding tile linking to pbui — less intrusive than the toy, hidden behind a connect-management mode or reachable through "right click → link to". This step covers the whole investigation and the writing of the design guide, because the work was one continuous pass: evidence first, then the document.

The toy repository turned out to be a thin executable layer over a much larger body of research that lives elsewhere (two vault reports, a research bundle in Downloads with the prototypes and the P06 compiler). Finding and reading those first changed the shape of the guide: instead of re-deriving semantics from 2,300 lines of JavaScript, the guide cites the report's algebra and laws and spends its own effort on the part nobody had written yet — mapping that algebra onto pbui's actual kernel, document, verbs, and chrome.

### Prompt Context

**User prompt (verbatim):** "Study the linked actions ideas in ~/code/wesen/2026-08-28--toy-actions-linked-pbui

I want to add them to pbui, but slightly less intrusive, for example by hiding it behind a "connect management" mode a bit like in reason where you can patch the cables in the back, or activate by like a "right click -> link to" if an object matches a port or so.

ANyway, I want you to study the toy project, and the real pbui project, and create a new docmgr ticket to add tile linking, and do a serious analysis of what we have and what we can integrate and how, and in which order, and what kind of demo applications we could do, etc...

Create  a detailed analysis / design / implementation guide that is for a new intern, explaining all the parts of the system needed to understand what it is, with prose paragraphs and bullet point sand pseudocode and diagrams and api references and file references. It should be very clear and technical. Store in the ticket and the nupload to remarkable."

**Assistant interpretation:** Read the toy and the research it embodies; read the real pbui monorepo (core, workbench, protocol, products); create a docmgr ticket in pbui; write one long design/implementation guide for a new engineer that (a) explains the existing system with file references, (b) analyses what can be integrated and in which order, (c) proposes a less intrusive interaction surface (connect mode, right-click link-to), (d) lists demo applications, tests, and risks; keep a diary; validate with docmgr doctor; upload the bundle to reMarkable.

**Inferred user intent:** Have a reviewed, evidence-based plan before any linking code lands in pbui, so that the eventual implementation (possibly by someone else) reuses the kernel/document/chrome that already exist rather than porting the toy's DOM-level approach wholesale.

**Commit (code):** none — documentation only; the pbui checkout is on branch `task/add-plot-editor` with unrelated uncommitted work that was left untouched.

### What I did

- Loaded the `ticket-research-docmgr-remarkable` skill and its writing-style and deliverable-checklist references; later loaded the `diary` skill for this document.
- Read the toy: `README.md`, `lib/core.js` (all 281 lines), `app.js`, `index.html`, `approaches/index.html`, and the script of `approaches/combined.html`; listed the git history (`0070ccc` drag prototype → `6d25862` shared core → `0093676`/`4b5f9e3` audit repairs).
- Followed the toy's references to ticket `PBUI-LINK-UI`, which is not on disk in pbui; located it with `grep -rl "PBUI-LINK"` in the go-go-parc vault (two project reports dated 2026-08-27 and 2026-08-29) and in `~/Downloads/PBUI-linked-tiles-research-bundle/ttmp/` (tickets `PBUI-LINK-UI`, `PBUI-LINK-UI-AUDIT`, `PAPERS-DL`).
- Read the 2026-08-27 report by section: executive synthesis and core invariants (lines 154–194), foundations in PBUI work (§3, 310–409), the hybrid model (§6), the formal model (§7), algorithms (§8), the TypeScript API (§9), the UI spec (§10), fan-in/conflicts/lifecycle (§11), the roadmap (§14), and appendices A–B. Read the 2026-08-29 audit report in full. Read the `PBUI-LINK-UI` design doc's pattern catalogue, layer plan, invariants, and anti-patterns (lines 134–330).
- Inspected the bundle's `source_materials`: the agent-workbench JSX (`PORTS`, `ADAPTERS`, `canConnect`, the wiring model `pushBinding`/`policyOf`/`addLink`/`removeLink`/`bidiLink`/`setPolicy`, the back-side and connect-modal UI) and the P06 compiler (`README.md`, `src/types.ts`, `src/contracts.ts`).
- Mapped pbui: `README.md`, `docs/playbooks/*` headings, `ttmp` ticket list and vocabulary, the package tree; then read with line numbers: `src/presentation/types.ts`, `actions/types.ts`, `actions/index.ts`, `actions/registry.ts` (head), `actions/perform.ts`, `translators/types.ts` + `resolve.ts`, `context/types.ts`, `createPbui.tsx` (options, context value, Presentation click/keyboard handlers, status bar), `surfaces.ts` (head), `chrome/TileFrame.tsx`, `chrome/useTileDrag.ts` (carry), `chrome/LauncherShell.tsx` (head); `proto/.../workbench.proto`, `contracts/workbench/v1/valid/linked-view.json`; `packages/pbui-workbench/src/{types,tileDescriptor,document,store,apps,actions,createWorkbench,launcherRows}.ts`, `verbs.ts` (verb union, `BindingConfig`, `SplitPolicy`, `CrossWorkspace`, handlers `openView`/`replace`/`link`/`rebind`/`defaultBindings`), `components/Tile/Tile.tsx`, `components/Surface/Surface.tsx`, `stories/demoApps.tsx`, `workbench.test.ts` (head); `packages/workbench-protocol/src/client/{builders,apply}.ts` (exports/cases); `pkg/workbench/model.go`, `validate.go` (codes); `packages/datalab-ui/src/{pbui/types.ts, pbui/actions.ts, store/world.ts, store/layout.ts, apps/ChartApp, apps/InspectorApp, components/molecules/DocBar}`; `packages/pbui-chat/src/{apps/createChatApps.tsx, tools/workbenchTools.ts, tools/acceptTool.tsx}`; `packages/pbui-plotscript/src/{apps.tsx, host.ts, document.ts, PlotTile/PlotTile.tsx, ScriptTile grep}`; `packages/pbui-sandbox/src/{contracts.ts, state.ts}`; `../plot/src/interactions.ts` and `react/ResponsivePlot.tsx` (event props).
- Searched all of `~/code/wesen` for `fan-?in|lastWriter` in TS to confirm the agent-workbench prototype is not a live repository (it is only in the bundle).
- Created ticket `PBUI-LINK-1` with `docmgr ticket create-ticket`, added the design doc and this diary with `docmgr doc add`.
- Wrote the design guide in five appended chunks (front matter/summary/scope/prior work; current-state architecture; gap analysis and design; decision records/pseudocode/diagrams; phases/demos/tests/risks/references), 1,217 lines.
- Verified `remarquee status` and `remarquee cloud account --non-interactive` before writing, so the upload step would not be blocked at the end.

### Why

- The user asked for an intern-level guide: evidence-anchored file references matter more than prose volume, so most of the effort went into reading the real files with `cat -n`/`sed -n` and recording line ranges.
- The report already contains the semantics; duplicating it would bury the pbui-specific content. The guide therefore summarizes the report's algebra and laws in one section and cites it, and spends its length on the pbui map, the gap table, the decisions, and the phases.
- The user's "less intrusive" constraint reverses the earlier interaction guide's priority (gesture surface first). Recording that as a decision record (D6) with the reasoning makes it re-litigable if the user disagrees.

### What worked

- `grep -rl "PBUI-LINK" ~/code/wesen` found the vault reports immediately; `find ~/code/wesen -iname "*PBUI-LINK*"` found nothing because the tickets live in the Downloads bundle. Reading the audit report's "Files to read first" section gave the reading order for the toy.
- Reading `verbs.ts` by grep first (`grep -n "^export\|kind: \""`) then by targeted ranges kept a 1,231-line file manageable and surfaced `tile.link`, `view.rebind`, `BindingConfig`, and `CrossWorkspace: "link"` — the existing "binding" vocabulary the design had to respect.
- The workbench's own precedents (`rebalance/configDocument.ts`, `pbui-plotscript/src/document.ts`) settled the persistence decision (D3) without inventing anything.
- `startTileCarry` in `useTileDrag.ts` is almost exactly the lifecycle a port-to-port drag needs (capture-phase pointerdown, one exit, Escape/blur cancel), which made the connect-mode design concrete.

### What didn't work

- The first `cat -n` of four workbench files exceeded the tool's output limit (`Output too large (31.5KB)`); the content was persisted to a scratch file and read back in two `sed -n` ranges. Later reads were split per file.
- A shell pipeline that echoed `====` headings inside a `cd … ; cat … ; echo ==== …` sequence produced `(eval):1: === not found` under zsh because a bare `====` was parsed as a redirection; quoting the heading strings fixed it.
- `find ~/code/wesen -iname "*PBUI-LINK*"` and `ls ~/code/wesen/hyperslop-systems/pbui/ttmp/... | grep -i link` both returned nothing; the tickets referenced by the toy's index page exist only in `~/Downloads/PBUI-linked-tiles-research-bundle/ttmp/`. The guide records both locations.

### What I learned

- pbui already has the report's "identity at document granularity": two views bound to one `DocumentPayload` id, plus linked views (`placementCount > 1`). The design must layer value ports beside this rather than replace it (D2).
- The accept mode's `resolveAcceptance` is used for both highlighting and clicking so they cannot disagree; the same rule (one planner for the badge's acceptable state and for the drop) carries over to `planFollow`.
- The action kernel's `evaluateFresh` refusal codes (`action-became-ambiguous`, `action-no-longer-resolves`, `action-implementation-changed`, `action-no-longer-available`) are the exact shape the report's §8.10 fresh revalidation needs for show candidates.
- The plot package already emits typed `PlotEvent`s (`activate`, `hover`, `focus`, `brush`, `view-change`) with datum identities; nothing consumes them as ports yet — the plotscript demo is therefore cheap.
- datalab's `inspectable`/`watchable` abstract types are a working example of "send to ⟨port⟩" by type reachability through the graph.

### What was tricky to build

- **Reconciling three vocabularies.** The report says `Follow/Alias/Derived/Hold`; the agent-workbench prototype says `links/bind/policy/fanin/onclose`; pbui says `documents/bindings/docBound/link/rebind`. The guide keeps the report's terms for the kernel, maps the prototype's ideas to them in a table (§3.5), and gives pbui's existing words a precise meaning in the term algebra (a document slot is `Constant`, a linked view is shared content, `tile.link` is a placement operation, not a binding). Getting this table right took several passes because "link" means three different things across the sources.
- **Deciding where the kernel lives.** The report says "sibling kernel"; the type graph and translators are in pbui core, but the document and DOM are in pbui-workbench. The split chosen (pure terms/evaluate/plan/resolve in `pbui/src/presentation/links/`, document/runtime/verbs/hooks/UI in `pbui-workbench/src/links/`) mirrors how `actions/` and `workbenchTileContributions()` already relate, which is the argument recorded in D1.
- **Serializability of held values.** The toy holds order ids; pbui values are arbitrary objects. This only surfaced when writing the `Hold` term as JSON in the document; the pbui-chat wire reference (`{type,id,value?}`) gave a precedent and D4 records the codec approach and the visible "Pin unavailable" consequence.
- **Keeping the design less intrusive without losing the audit's semantics.** The toy's drop-zones and pie menu were dropped; everything they offered was re-homed in the object menu and connect mode. D6 records this so the reduction is deliberate, not an omission.

### What warrants a second pair of eyes

- Decision D2's precedence rule (explicit term → document slot → fallback → unresolved) and its interaction with `replace`'s retarget-vs-mint logic for linked views.
- Decision D5 (pull evaluation): confirm the memo keyed by `(PortId, documentRevision, runtimeRevision)` is enough for the `usePort` hook under React's `useSyncExternalStore` without tearing across two stores.
- The `resolveShow` ranking tuple and the "held port is inapplicable to a generic route" rule; a product may want a held detail to be *replaceable* by default.
- Whether extending the `WorkbenchVerb` union with ~15 link verbs is acceptable to the agent tool's `workbench_perform` schema and to `describeWorkbenchVerb`'s wording budget.

### What should be done in the future

- Confirm D6 (instrument priority) with the user before Phase 3.
- Start Phase 0/1 in a branch; port the audit's 17 scenarios to the LinkLab story as the first Playwright suite.
- Open a follow-up ticket for a `pbui-workbench` plan history (undo) if products want topology undo without owning a history stack.

### Code review instructions

- Start with the design guide's §4 (current state) and check each `path:line` citation against the workspace; then §5 (gap table) and §7 (decisions).
- Validate the ticket with `docmgr doctor --ticket PBUI-LINK-1 --stale-after 30` and the reMarkable listing with `remarquee cloud ls /ai/2026/09/01/PBUI-LINK-1 --long --non-interactive`.
- No code changed; there is nothing to run.

### Technical details

Commands that located the research:

```bash
grep -rl "PBUI-LINK" ~/code/wesen --include="*.md" --include="*.html" | grep -v node_modules
ls ~/Downloads/PBUI-linked-tiles-research-bundle/ttmp/2026/08/*/
grep -n "^#" "…/PROJECT REPORT - PBUI Linked Tiles - Interaction Models….md"
```

Commands that mapped pbui:

```bash
find src packages pkg cmd plugins contracts proto -maxdepth 3 -type d | grep -v node_modules
find packages/pbui-workbench/src src/presentation src/chrome -type f | xargs wc -l | sort -k2
grep -n "^export\|kind: \"" packages/pbui-workbench/src/verbs.ts
rg -n "view\.documents\[|documents\.(primary|source|product)" packages/*/src
rg -l "fan-?in|lastWriter|last-writer|firstWriter" ~/code/wesen --glob '*.ts' --glob '*.tsx' --glob '!node_modules'
```

Ticket creation:

```bash
docmgr ticket create-ticket --ticket PBUI-LINK-1 \
  --title "Tile linking: binding terms, link mode, and the target resolver in the pbui workbench" \
  --topics pbui,design,architecture,actions,frontend,onboarding
docmgr doc add --ticket PBUI-LINK-1 --doc-type design-doc --title "Tile linking in pbui: intern analysis, design, and implementation guide"
docmgr doc add --ticket PBUI-LINK-1 --doc-type reference --title "Investigation diary"
```

## Step 2: Validate and deliver

The ticket was validated and the two documents were bundled into one PDF with a table of contents and uploaded to the reMarkable cloud. This closes the documentation deliverable; the implementation phases remain open tasks on the ticket.

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Assistant interpretation:** Finish the deliverable per the ticket-research workflow: doctor, dry-run upload, real upload, verification.

**Inferred user intent:** Read the guide on the reMarkable and have the ticket in a state where implementation can start.

### What I did

- `docmgr task` entries for the investigation, the guide, the diary, bookkeeping, the upload, the D6 confirmation, and Phases 0–7; checked the completed ones.
- `docmgr doc relate` with 44 file notes on the guide and 6 on the diary; `docmgr changelog update` twice.
- `docmgr doctor --ticket PBUI-LINK-1 --stale-after 30` → `All checks passed`.
- `remarquee upload bundle --dry-run …` then the real upload with `--toc-depth 2` to `/ai/2026/09/01/PBUI-LINK-1`; `remarquee cloud ls … --long` shows `[f] PBUI-LINK-1 Tile Linking in pbui — Intern Guide`.

### What worked

- Doctor passed on the first run because the ticket topics were chosen from `ttmp/vocabulary.yaml` at creation time (`pbui, design, architecture, actions, frontend, onboarding`).
- The bundle's ASCII diagrams and fenced pseudocode render through pandoc without a mermaid step, which is why the guide uses text diagrams rather than mermaid fences.

### What didn't work

- N/A

### What I learned

- `remarquee upload bundle` takes the document titles from file names; the guide's H1 is what appears inside the PDF.

### What was tricky to build

- N/A (delivery only).

### What warrants a second pair of eyes

- The reMarkable rendering of the wide tables in §5 and §12.4; if they clip, re-upload with `--toc-depth 2` and a narrower table layout.

### What should be done in the future

- Confirm D6 with the user; then start Phase 0 on a branch.

### Code review instructions

- `docmgr doctor --ticket PBUI-LINK-1 --stale-after 30` and `remarquee cloud ls /ai/2026/09/01/PBUI-LINK-1 --long --non-interactive`.

### Technical details

```bash
remarquee upload bundle --dry-run <guide.md> <diary.md> --name "PBUI-LINK-1 Tile Linking in pbui — Intern Guide" --remote-dir "/ai/2026/09/01/PBUI-LINK-1" --toc-depth 2
remarquee upload bundle          <guide.md> <diary.md> --name "PBUI-LINK-1 Tile Linking in pbui — Intern Guide" --remote-dir "/ai/2026/09/01/PBUI-LINK-1" --toc-depth 2
remarquee cloud ls /ai/2026/09/01/PBUI-LINK-1 --long --non-interactive
```

## Step 3: Review amendments — cutover, package split, e-commerce demo

Three review questions changed the guide: whether a hard cutover simplifies the design, where linking lives (package or core), and what to build the demos on now that PBUI-DATALAB-1 defers migrating datalab-ui. The answers became decision records D9 and D10, amended D2 and D4, a rewritten §11 around a self-contained `pbui-ecommerce` package, and a replaced "migration notes" section.

### Prompt Context

**User prompt (verbatim):** "perfect, update PBUI-LINK-1 and stop"

**Assistant interpretation:** Fold the three review outcomes (cutover rules, kernel-in-core plus glue-in-workbench, self-contained e-commerce demo with datalab-ui frozen) into the PBUI-LINK-1 guide and bookkeeping; do not re-upload or start anything else.

**Inferred user intent:** Have the ticket reflect the agreed plan before implementation starts.

### What I did

- Read PBUI-DATALAB-1's guide (§3.3 sizes, §4.4–4.6, §6 migration findings, §7 demo design incl. §7.6 ports, §11 open questions, §12 first steps) and checked that `datalab/ui/package.json` pins `@hyperslop-systems/datalab-ui` and that `packages/datalab-ui` does not depend on `pbui-workbench`.
- Edited the guide with a Python replacement script: D2 amended (unified port declarations; `bindings`/`docBound` derived), D4 rewritten (JSON-only values, no codecs), D6 marked accepted, new D9 (core kernel + workbench glue, no third package) and D10 (hard cutover, e-commerce demo first, datalab-ui frozen), §6.2 `AppDescriptor` snippet, Phase 1/2 file lists, §10 "What happens to existing packages", §11 rewritten (package layout, tile/port table, eight scenes), §12.4 target, §13.1 risks, §13.3 Q1 resolved, §2.4 scope, §14 reading list.

### Why

- The user confirmed no backward compatibility is needed; the codec layer and the adapter-based datalab migration were compat-only complexity.
- DATALAB-1's measured migration failure (308 type errors, no green intermediate) makes a self-contained demo the only way to exercise linking soon.

### What worked

- Targeted string replacement with assertions caught one drift immediately: `docmgr doc relate` had rewritten the frontmatter `Summary` from a quoted to an unquoted scalar, so the first replacement's anchor no longer matched (`AssertionError`); re-anchoring on the sentence tail fixed it.

### What didn't work

- The first run of the amendment script failed on that frontmatter anchor before touching the file (the assertion is before any write), so no partial edit occurred.

### What I learned

- `datalab-ui` is consumed only by `datalab/ui`; freezing it costs nothing for linking.

### What was tricky to build

- Keeping D2 honest: the *declaration* unifies (ports with `documentSlot`) while the *persistence* of document constants stays in `view.documents`, because `openView` de-dup, `ViewConfigure.replace_documents`, and the Go `required_binding` check all key on it.

### What warrants a second pair of eyes

- D10's claim that `pbui-datalab` can implement the e-commerce `ShopHost` interface; DATALAB-1's §7.4 host shape should be checked against it when that package starts.

### What should be done in the future

- Scaffold `pbui/packages/pbui-ecommerce` at Phase 1; update PBUI-DATALAB-1 step 6 to drop the interim host-cell ports (not done here — the user asked to update PBUI-LINK-1 only).
- Re-upload the bundle to reMarkable when implementation starts; the current PDF predates these amendments.

### Code review instructions

- Diff the guide around D2, D4, D9, D10, §10 "What happens to existing packages", and §11; run `docmgr doctor --ticket PBUI-LINK-1 --stale-after 30`.

### Technical details

- Guide length after amendment: 1,360 lines, 10 decision records.

## Step 4: Phase 0 — freeze the behaviour linking must not break

Implementation started. Before any port or term exists, the two cases the existing suite did not freeze were written down as tests: a doc-bound `openView` whose twin lives in another workspace (the handler's `goToView` branch), and the exact object `describeWorkbench` reports for a doc-bound application, as a snapshot. Phase 1 rewrites the second (ports replace `bindings`/`docBound`) and Phase 7 extends it, so the reviewed diff of that snapshot is the contract for both.

A review question also changed the demo plan: the pbui-chat demo already contains a gold-coin shop (products, orders, metals, categories, four tiles) that the guide's §11.1 did not know about. The user asked to merge the two worlds and expand the existing one, so the new package will own an expanded gold-coin shop and the chat demo will consume it later (recorded as D11 in Phase 1).

### Prompt Context

**User prompt (verbatim):** "ok, implement PBUI-LINK-1, take screenshots for the diary, make a fair amount of storybook stories, implement the ecommerce demo as you go along.

commit at appropriate intervals and keep a detailed diary as you work (using the diary format from the skill)

Print out a brutalist work slip with the plan / different phases for the ticket. then before stsarting a phase, plrint a split about the phase, and print one when the phase is done."

Follow-up mid-turn: "and update the design doc to merge both worlds, and expand the existing one to have richer data and all that"

**Assistant interpretation:** Work through Phases 0–7 of the guide in order; build `pbui-ecommerce` alongside as the first consumer, on the gold-coin shop domain the chat demo already uses, with richer fixtures; write Storybook stories generously and screenshot them for the diary; commit per phase; print a plan slip, a start slip and a done slip per phase.

**Inferred user intent:** Land tile linking in pbui as reviewable, demoable increments with a paper trail (diary, slips, screenshots) rather than one large drop.

**Commit (code):** cc771ca — "PBUI-LINK-1 Phase 0: golden tests for cross-workspace doc-bound de-dup and the describeWorkbench shape" (ticket docs committed first as 3655210).

### What I did

- Printed the plan slip (eight phases) and the P0 start slip with `work_slip.py`.
- Committed the untracked ticket workspace (`3655210`).
- Ran `pnpm test` in `packages/pbui-workbench`: 25 files, 252 tests green — the baseline.
- Read `workbench.test.ts`'s test list against the guide's Phase 0 list: replace retarget/mint (lines 874, 884), link orphan deletion (932), `BindingConfig` defaults (1027–1047) and single-workspace `openView` de-dup (361) were already covered.
- Added `packages/pbui-workbench/src/linkingGoldens.test.ts` with three tests: cross-workspace doc-bound de-dup goes to the other workspace and mints nothing; different bindings mint here; `describeWorkbench` snapshot over a three-tile layout with a doc-bound `sku` app, ids normalised to `n-*`/`v-*`.
- Printed the P0 done slip.

### Why

- The guide's Phase 0 exists so the Phase 1 cutover (deleting `bindings`/`docBound`) has a failing test to make green rather than a silent behaviour change; the snapshot is the cheapest way to make the `describeWorkbench` diff reviewable.

### What worked

- The `viewsOfApp` + `goToView` path in `openView` (verbs.ts:954–975) already handles the cross-workspace case; the new test passed first time.

### What didn't work

- The first snapshot normalisation regex `/"(n|v|s)-[a-z0-9]+"/` did not match, because `newId` mints `prefix-xxxxxxxx-xxxx` (a 13-character UUID slice with an inner hyphen). Fixed to `/"(n|v|s)-[a-z0-9]+-[a-z0-9]+"/`.
- `src/rebalance/slate.perf.test.ts` failed once in the full run (`expected 93.3 to be less than 50`) while the baseline run was still warm in memory; it passed alone. A timing guard, unrelated to this change; noted, not touched.

### What I learned

- `layout(spec, { workspaceId, workspaceName })` lets a test pin the workspace id, which keeps the snapshot free of one more minted id.

### What was tricky to build

- Nothing structural; the only friction was the id shape in the snapshot.

### What warrants a second pair of eyes

- Whether the snapshot should also cover `describeWorkbench(wb, { document: true })`; left out because the protobuf JSON is large and the Phase 7 additions land in `apps`/`workspaces`, not in the raw document.

### What should be done in the future

- Phase 1 will update the snapshot deliberately when `docBound`/`bindings` become `ports`.

### Code review instructions

- `packages/pbui-workbench/src/linkingGoldens.test.ts` and its snapshot under `src/__snapshots__/`.
- `cd packages/pbui-workbench && pnpm test`.

### Technical details

```bash
python3 ~/.pi/agent/skills/brutalist-work-slip/scripts/work_slip.py plan --task PBUI-LINK-1 --label PLAN --title "Tile Linking In pbui" --phase "P0 golden tests, baseline" ... --next "P0 golden tests"
cd packages/pbui-workbench && pnpm test      # 25 files, 252 tests (baseline), 26 files, 255 after
```

## Step 5: Phase 1 — ports on the descriptor, and the gold-coin shop package

Phase 1 puts the port vocabulary into the codebase without changing any behaviour: a pure `links/` module in pbui core defines contracts, declarations and ids; `AppDescriptor.ports` replaces `bindings` and `docBound` everywhere (design D10's hard cutover), with the two old facts derived from document-slot ports; `describeWorkbench` reports ports. The second half of the step is the first consumer, `packages/pbui-ecommerce`: the gold-coin shop from the chat demo, expanded (D11), with seven tiles that declare the ports every later phase will link through, three seeded plots, a shell, stories, and a Vite demo.

The screenshots under `various/screenshots/p1-*.png` show the seeded workbench (orders beside a waiting detail and inspector), the sales workspace with its three plots, and the order-detail tile over order 88213 rendered directly.

### Prompt Context

**User prompt (verbatim):** (see Step 4) — plus, mid-turn: "and update the design doc to merge both worlds, and expand the existing one to have richer data and all that"

**Assistant interpretation:** Do the guide's Phase 1 (ports and contracts, no behaviour), scaffold the demo package on the gold-coin shop domain with richer fixtures, and record the merge decision in the guide.

**Inferred user intent:** One world for the shop across pbui, with data rich enough for every linking scene, before any linking behaviour exists.

**Commit (code):** 4833208 — "PBUI-LINK-1 Phase 1: ports and contracts on AppDescriptor; pbui-ecommerce (gold-coin shop) scaffold"

### What I did

- `src/presentation/links/types.ts` (+ `index.ts`, re-exported from `presentation/index.ts`): `PortDirection`, `PortContract` (seven identity fields), `PortContractInput`, `PortDeclaration(Input)`, `PortId` with `portId`/`parsePortId`, `normalizeContract` (mode follows direction), `CONTRACT_IDENTITY_FIELDS`, `contractFingerprint`, `contractMismatches` (a list of fields, never a boolean), `definePort`/`definePorts` (fail-fast on `/` in names, empty docs, duplicates), `documentSlotPort`, `documentSlotsOf`, `hasDocumentSlot`. Thirteen unit tests.
- `pbui-workbench/src/apps.ts`: `ports?: readonly PortDeclaration[]` on `AppDescriptor`; `bindings` and `docBound` deleted; `isDocBound(app)` and `documentSlots(app)` exported; `defineApp` normalizes ports. Callers switched: `verbs.ts` (`openView` de-dup), `launcherRows.ts`, `describe.ts` (+ `DescribedPort`, `ports` per app, `docBound`/`bindings` kept as derived fields for agent readers), the demo `counter` (out `count:<number>`) and `notes` (in `subject:<any>`), and the tests that built widget/sku apps by hand.
- Other packages: `pbui-chat` (chat, widget, conversation-context apps; `workbenchTools.ts` reads `documentSlots(app)`; two test fixtures), `pbui-plotscript` (script, plot-view), `pbui-sandbox` (script, inspector, source), the chat demo (sku, notes). Each `docBound: true` + `bindings: [X]` pair became `ports: [documentSlotPort(X, "…")]`.
- The `describeWorkbench` golden snapshot updated deliberately: the diff is purely additive (`ports` on three apps).
- `packages/pbui-ecommerce`: package config in the plotscript shape (Storybook port 6012, demo port 5176), `fixtures/` (products verbatim from `world.ts`; twelve customers; sixty-five orders from eight hand-written anchors plus a seeded LCG, with line items; `daily_sales` derived), `host.ts` (`ShopHost` interface + fixture implementation + `useHostRevision`), `document.ts` (`hyperslop.plot` and `pbui-ecommerce.table` payloads), `presentation/` (values, descriptors, type graph with abstract `inspectable`, registry, `snapshotFor`, `createShopPbui`), `apps.tsx` (seven apps with ports), `tiles/` (OrdersTable, CustomersTable, ProductCatalog, OrderDetail, CustomerDetail, Inspector, ShopPlot), `plots/` (schemas, three plot documents), `seed.ts`, `createShop.ts`, `ShopShell/`, `stories/harness.tsx`, `test/` fences (component folders, no hex, no raw controls, D10 cutover rules), `demo/`. Twenty-five tests.
- Guide: D11 added, §11.1 rewritten around the package as built (with the two deviations), Q7 added to §13.3.
- Registered `packages/pbui-ecommerce/demo` in `pnpm-workspace.yaml`; `pnpm install --offline`.

### Why

- D10: no compatibility layer, so the descriptor loses two fields rather than gaining a third way to say the same thing; the derived helpers keep the readers (`openView`, launcher rows, agent tools) one-line changes.
- The chat demo's gold-coin shop already existed with a Go mirror; a second shop world would have been a third copy of the product table (D11).
- Fixtures are generated by a seeded LCG at module load so there is no JSON file to keep in step with the generator and every screenshot shows the same book.

### What worked

- `definePorts` in `defineApp` means every reader sees normalized declarations; no caller branches on `undefined`.
- The plotscript package was a complete template: config, Storybook, demo, test setup (the ResizeObserver stub is what lets `ResponsivePlot` render under jsdom).
- `git stash` around the plotscript test run showed its one failing test (`tiles.test.tsx`, "typing schedules a run…") fails on a clean tree too.

### What didn't work

- Downstream packages consume `dist`, so the first typecheck of pbui-plotscript/sandbox/chat reported `'ports' does not exist in type 'DefineAppInput'` until `pnpm build` ran in pbui core and then in pbui-workbench. Order matters: core build → workbench build → package typechecks.
- The plot author helpers take branded ids (`VariableId`, `LayerId`, `FieldId`, `PlotId`); the first draft of `plots/documents.ts` failed with seventeen `TS2345`/`TS2353` errors. Fixed with three one-line casters and a `variables()` helper.
- `pbui-chat`'s `test/grid-columns.test.ts` fails on a clean tree (it points at `pbui-sandbox/src/devtools/SourceTile/SourceTile.module.css`); not touched.
- The demo's typecheck ran before the package's `dist` existed and reported `Cannot find module '@hyperslop-systems/pbui-ecommerce'`; it passed after `pnpm build`.

### What I learned

- `PresentationTypeDefinition` has `abstract?: boolean`; a `subject : <inspectable>` port is one line in the graph.
- `Chip` has no free-form colour; status tones are expressed through `state` ("stale", "disabled").
- A `DocumentPayload` body is a plain JSON object in the generated TS; a `PlotDocument` stores verbatim after one `JSON.parse(JSON.stringify(…))`.

### What was tricky to build

- **Where the derived facts live.** Deleting `docBound`/`bindings` from the descriptor but keeping them in `DescribedApp` looks inconsistent until one notices the two readers differ: the descriptor is written by products (one vocabulary: ports), the description is read by agents whose prompts say "bind". Keeping `docBound`/`bindings` derived in the description avoided touching `workbenchTools.ts`'s prompt text.
- **Per-view contracts (Q7).** The plot's `selection` authority should be its bound table, but a contract is declared per app. Declared `"plot"` for now and recorded the hook proposal rather than inventing a mechanism Phase 5 may not want.
- **The order generator's anchors.** The chat demo's four orders had to keep their totals; the eight anchors are hand-written and the generator skips their ids, so a change to the seed cannot move them.

### What warrants a second pair of eyes

- The `DescribedApp` shape: `docBound`/`bindings` kept as derived fields plus `ports`. If agent prompts should speak only of ports, they can be dropped in Phase 7 with the vocabulary work.
- `plots/documents.ts`: the revenue-by-day scatter draws one point per (day, category); a line per metal needs a summary stat the author API exposes as `stat.summary`, not tried.
- The three table tiles have no `table` slot (deviation from the first §11.1); DATALAB-1 adds it.

### What should be done in the future

- Phase 2 replaces `preview` props on the detail tiles with `usePort`.
- A chat-server follow-up to grow `data.go` with customers/orders if the chat demo consumes the package (scene 8).

### Code review instructions

- Start with `src/presentation/links/types.ts` and `packages/pbui-workbench/src/apps.ts`; then `packages/pbui-ecommerce/src/apps.tsx` for the port declarations and `host.ts` for the interface.
- `pnpm build` (root) → `cd packages/pbui-workbench && pnpm build && pnpm test` → `cd ../pbui-ecommerce && pnpm typecheck && pnpm test` → `pnpm storybook` and open `Shop/Scenes/Seeded`.

### Technical details

```bash
pnpm build                                            # pbui core: dist/presentation/links/
cd packages/pbui-workbench && pnpm build && pnpm test  # 26 files, 255 tests
cd ../pbui-ecommerce && pnpm test                       # 6 files, 25 tests (fixtures, shop render, fences)
tmux new-session -d -s ecommerce-sb 'pnpm storybook'    # port 6012; screenshots via Playwright at 1400×800
```

## Step 6: Phase 2 — the kernel, the link document, the badge, and "Link to…"

Phase 2 is the centre of the design: the pure link kernel in pbui core, the `pbui.links` payload and the view-keyed runtime in pbui-workbench, the link verbs in the `WorkbenchVerb` union, the badge in every tile header, and the two menus (the `<port>` badge's own, and the "Link to…" family on any presentation). By the end of the step the gold-coin shop does scenes 1 and 2 for real: an unlinked detail follows the workspace's current order; right-clicking an order offers "Link to order detail · order" and "Link to inspector · subject"; the badge reads `→ orders`, Pin holds it (`⏸ #88213`), Resume catches up, Detach fixes it, and closing the table freezes the follower with a resume that explains itself.

The screenshots under `various/screenshots/p2-*.png`: the seeded scene 2a with the detail following the table (`→ ORDERS` in its header) and the inspector still ambient (`○ SUBJECT · NONE`), the object menu on an order with the inspector row available and the detail row disabled with its reason ("already follows orders · order"), the inspector linked through `<inspectable>`, and the badge's own menu.

### Prompt Context

**User prompt (verbatim):** (see Step 4)

**Assistant interpretation:** Implement the guide's Phase 2 end to end — kernel, document, runtime, verbs, hooks, badge, menus — in the three layers, and make scenes 1 and 2 of the shop demo work with stories and tests.

**Inferred user intent:** The first visible linking behaviour, reviewable on screen, before the patch bay (Phase 3) is built on top of it.

**Commit (code):** cfa91b2 — "PBUI-LINK-1 Phase 2: link kernel, pbui.links document, runtime, Ambient/Constant/Follow/Hold, badge, menus"

### What I did

- **Core `src/presentation/links/`** (pure, no React; the `no-react.test.ts` fence strips comments before checking): `terms.ts` (the seven terms, `isBinding` structural validation for what is read back from a document, `sourcePortOf`, `linkIdOf`), `verbs.ts` (`LinkVerb`, `linkVerbs`, `isLinkVerb`, `describeLinkVerb`), `snapshot.ts` (`LinkSnapshot`, `PortDefinition`, `LinkDeps` with `graph`, optional `label` and `relation`; `reaches()` treats `<any>` as reachable), `evaluate.ts` (`effectiveBinding` with the D2 precedence; `evaluatePort` with a `visiting` path so a cycle is a diagnostic; following a follower reads the input's evaluation; `valueToHold` prefers the attended value), `plan.ts` (`planFollow` refuses with codes `port-missing`/`self`/`direction`/`type`/`held`/`already`/`cycle`; `planBind`, `planAmbient`, `planPin`, `planResume` — a hold over `Unresolved` says why it cannot resume — `planDetach`, `planClear`, `planUnlink` per policy), `apply.ts` (`applyLinkVerb`: plan then transition on a copy of the bindings map; `resume` restores an implicit term as the ABSENCE of a term so the document ends where it started), `lifecycle.ts` (`bindingsAfterViewsRemoved` applying `onSourceClose` — freeze holds with `Unresolved("source-closed")`, clear, ambient; `bindingsAfterAppReplaced`; `bindingsAfterClone` re-keys sources and suffixes link ids), `badge.ts` (`badgeOf` with the report's glyphs; `badgesOfView` hides outputs, untouched document slots and unbound ports), `invariants.ts`. 40 kernel tests over a ten-port world (`world.test-helpers.ts`).
- **pbui-workbench `src/links/`**: `document.ts` (`pbui.links` payload, sorted keys, `linksChange` returns null when nothing changes and deletes the payload when empty), `runtime.ts` (`createLinkRuntime`: emitted/contexts/attended, `emit` also attends and drives declared contexts, `forgetView`, `sourceOf`), `snapshot.ts` (`buildLinkSnapshot` from document + apps + runtime; contexts from `fallbackContext`/`drivesContext` declarations), `handlers.ts` (`createLinkHandlers`: cached snapshot per (document identity, runtime revision); `perform` = fresh snapshot → kernel → one `documentPut`; `maintenance` scans a batch for `viewDelete`/`viewConfigure(appId)`/`viewClone` and appends ONE links mutation), `hooks.ts` (`useLinkSnapshot` over both stores, `usePort`, `useEmitPort`, `useBadges`), `portRef.ts` (`PortRef`, `createPortDescriptor`), `contributions.ts` (`workbenchLinkContributions`: rules for `"port"` — Pin, Resume, Detach, three Unlink rows, Return-to-fallback, Go to source — and the `Link to…` family per subject type, following from `sourceOf(subject)` when known, else `port.bind`).
- **Wiring**: `verbs.ts` — `WorkbenchVerb | LinkVerb`, `isWorkbenchVerb` falls through to `isLinkVerb`, `describeWorkbenchVerb` delegates, `VerbEnvironment` gains `runtime`/`linkEnvironment`/`onLinkRefused`, every `store.mutate(` inside `createVerbHandlers` became `mutate(` (a wrapper that appends the link maintenance and forgets runtime values of deleted views), `performWorkbenchVerb` routes link verbs; `store.ts` gains `linkModeOpen`; `createWorkbench` creates one runtime shared by the real and the shadow handlers and exposes `workbench.links`; `types.ts` gains `Workbench.links` and `SurfaceProps.renderBadges`; `Tile.tsx` renders badges after the ×N marker (default `PortBadge`, or the product's `renderBadges`); `Surface.tsx` passes it through. `components/PortBadge/` with a story of every state. `stories/demoApps.tsx` uses the hooks; `stories/LinkLab.stories.tsx`. `links/links.test.tsx`: 10 tests asserting badge text and tile content.
- **pbui-ecommerce**: `Values.port`, `Environment.links`, `snapshotForShop` puts `{ snapshot, deps, sourceOf }` in the facts and the two link revisions in the snapshot revision; `createShopActionRegistry` spreads the link contributions with `subjects: [INSPECTABLE]`; `createShopWorkbench` passes `links: { graph, label }`; `ShopShell` passes `links: workbench.links` in the environment and wraps each badge in a `<port>` presentation; tables emit on click, on right-click (capture phase) and as attended on hover, and the `order`/`customer` out ports declare `drivesContext`; `OrderDetail`/`CustomerDetail`/`Inspector` read `usePort`; `ShopPlot` emits `datum` on activate and `cat` on legend or category-bearing marks; the story harness gained `setup` with `presentOrder`/`followOrders`/`holdOrders`; `linking.test.tsx` covers scenes 1 and 2 through the DOM (right-click → menu row → badge; badge → Pin/Resume/Detach; serialize/restore; close → freeze).
- Printed the P2 start slip; screenshots of scene 2a, the "Link to…" menu, the linked inspector, and the badge menu.

### Why

- `applyLinkVerb` as a pure transition (rather than logic in handlers) is the toy's "one core, many instruments" invariant: the kernel tests exercise the same function the badge menu, the family, the agent and (Phase 3) the drag will call.
- One `mutate` wrapper instead of editing `close`/`replace`/`link`/`deleteWorkspace`/`cloneWorkspace` separately: the maintenance is a function of the batch, so it cannot be forgotten by a future handler, and `plan()`'s shadow store gets it for free.
- The right-click emits in the CAPTURE phase because the `Presentation` inside the row stops the bubbling `contextmenu` (it owns the menu); a row must present itself before its menu opens so "Link to…" shows that order immediately.

### What worked

- The action kernel's shapes transferred directly: `available`/`unavailable(because, code)` are the plan statuses, `defineActions().family` is the "Link to…" family, `metadata.label` as a function gives "Unfix" versus "Return to its fallback".
- `useSyncExternalStore` over two stores with one cached snapshot keyed by `(document identity, runtime revision)` — every hook in a render shares one `LinkSnapshot`.
- The Playwright accessibility snapshot showed the menu rows with their disabled reason (`menuitem "Link to order detail · order — … already follows orders · order" [disabled]`), which is the report's "unavailable stays visible and explains itself" rule working through pbui's existing menu.

### What didn't work

- `no-react.test.ts` first flagged `index.ts`, `snapshot.ts` and `types.ts`: the regex matched "document." inside comments ("the workbench document."). Fixed by stripping comments before matching.
- `restore()` in `apply.ts` failed `tsc` with `Property 'key' does not exist on type 'Binding'` inside a chained `||`; rewritten as a nested conditional that narrows per kind.
- The law test for an EXPLICIT ambient term expected the document to be byte-identical after pin/resume; the resume deliberately normalizes a redundant term to no term. The test now asserts the effective binding is identical and the document is normalized (empty) for that case.
- `pnpm test` in pbui-workbench then failed `test/no-hex.test.ts`: the badge story's `"#1042"` matches the hex-colour regex. The labels became "order 1042".
- The workbench RTL tests asserted badge text right after `wb.perform(...)`; React had not flushed. Wrapped in `act`; and `act(() => wb.perform(...))` returns a thenable, so a `performed()` helper captures the boolean.
- The shop's scene tests failed twice for real reasons: the orders app's `order` port had no `drivesContext`, so ambient never moved (fixed in `apps.tsx`); and the right-click's `onContextMenu` on the row never fired because the presentation stops propagation (moved to `onContextMenuCapture`).
- The first Phase 2 commit failed silently: the message's `"Link to…"` closed the shell's double-quoted string. Committed again with `git commit -F`.
- Storybook logged `Failed to reload /src/tiles/ShopPlot/ShopPlot.tsx` once during a multi-file write; it recovered on the next save (the served module was current).

### What I learned

- `WorkbenchVerb | LinkVerb` needs no change in `workbenchTools.ts`: the agent's `workbench_perform` validates with `isWorkbenchVerb`, which now falls through to `isLinkVerb`.
- React's `act` returns a thenable even for synchronous callbacks in React 19; capture the result in a closure.
- The Playwright right-click on a table row landed on a different row once (the story had re-rendered under HMR); the second attempt on a visible id worked.

### What was tricky to build

- **Provenance of a right-clicked value.** The family must know which out port an order came from to bind `port.follow` rather than `port.bind`. Values are flat JSON with no provenance (D4), so the runtime answers `sourceOf(reference)` by deep-equality against its attended and emitted cells — which is why hovering a row emits it as attended, and why `snapshotForShop` threads `sourceOf` into the facts.
- **Where badges get their menu.** `Tile` is in pbui-workbench and has no pbui instance; the product wraps badges through `renderBadges` (the `renderTitle` pattern). The default plain badge still explains itself through `title`/`aria-label`.
- **`resume(pin(b))` and the document.** Restoring the suspended term literally would leave an explicit `ambient(workspace.order)` where the declared fallback used to be implicit — two states that read the same. `restore()` collapses a redundant suspended term to no term, so serialize() before and after pin/resume is byte-identical (asserted).
- **Per-batch maintenance timing.** Freeze needs the follower's value BEFORE the source view disappears, so `maintenance(current, mutations)` builds the snapshot from the pre-batch document and appends its mutation to the same batch; `afterCommit` then forgets the runtime cells.

### What warrants a second pair of eyes

- `linksChange` deletes the payload when the map is empty; a server that treats `documentDelete` of a missing id as an error would refuse the batch — the client applier accepts it (`restore()` round-trip test), the Go side is Phase 7's concern.
- `badgesOfView` hides document-slot constants unless overridden (deviation from the guide's `• Mass and yield` example) to keep plot tile headers short.
- The `Link to…` family lists EVERY compatible input on screen (no cap, no accept-mode fallback yet) because unbound inputs have no badge to point at; Phase 3's port rails give accept mode something to click.
- `useEmitPort` looks up the declaration on every emit through `workbench.apps.get(view.appId)`; cheap, but a hot hover path could memoize it.

### What should be done in the future

- Phase 3: rails + wires + port carry; then the family's ">6 targets → accept mode" fallback.
- Phase 4 replaces the family's direct `port.follow`/`port.bind` with `show` intents through `resolveShow`.
- `context.create`/`context.drive` verbs (declared contexts beyond port declarations) when a product needs a context no port declares.

### Code review instructions

- Kernel: `src/presentation/links/{terms,evaluate,plan,apply,lifecycle,badge}.ts` with `kernel.test.ts` beside them (`npx vitest run src/presentation/links`).
- Shell: `packages/pbui-workbench/src/links/{handlers,hooks,contributions}.ts`, the `mutate` wrapper in `verbs.ts` (search `links.maintenance`), `Tile.tsx`; `links.test.tsx`.
- Product: `packages/pbui-ecommerce/src/{presentation/actions.ts,ShopShell/ShopShell.tsx,tiles/OrdersTable/OrdersTable.tsx,tiles/OrderDetail/OrderDetail.tsx}`; `linking.test.tsx`.
- `pnpm build` at the root, then `packages/pbui-workbench` (`pnpm test && pnpm build`), then `packages/pbui-ecommerce` (`pnpm test`); Storybook `Shop/Scenes/2a` and `Workbench/LinkLab`.

### Technical details

```bash
cd pbui && pnpm build && npx vitest run src/presentation/links     # 40 tests
cd packages/pbui-workbench && pnpm test && pnpm build              # 27 files, 265 tests
cd ../pbui-ecommerce && pnpm test && pnpm build                    # 7 files, 30 tests
# scene 2 by hand: Storybook Shop/Scenes → "2a · follow", right-click #88152, choose "Link to inspector · subject"
```

## Step 7: Phase 3 — connect-management mode

The patch bay. With Mod+Shift+L (or "Connect…" on a tile, or "Show wiring" on a badge) every tile flips to its back side: a rail listing inputs on the left and outputs on the right, over an inert application; one SVG over the surface draws a wire per declared term; dragging an output onto an input performs `port.follow`, with Shift at release adding `port.pin`; wires are `<link>` presentations with the same unlink policies as badges; Escape leaves the mode. The gold-coin shop's scene 7 opens in the mode with two wires, and five real-pointer scenarios (native mouse and keyboard through Playwright against Storybook, a fresh page each) pass. Screenshot: `various/screenshots/p3-connect-mode.png`.

### Prompt Context

**User prompt (verbatim):** (see Step 4)

**Assistant interpretation:** Build the guide's Phase 3: the gesture surface, confined to a mode (D6), reusing the carry lifecycle, with the audit's real-interaction harness.

**Inferred user intent:** The "back of the Reason rack" the ticket asked for, and proof that it does not intrude on the everyday workspace.

**Commit (code):** cbcdf11 — "PBUI-LINK-1 Phase 3: connect-management mode (port rails, wire layer, port-to-port drag)"

### What I did

- **Core**: `src/chrome/usePortCarry.ts` — a port element registry (`registerPort`, `portElement`), `startPortCarry({ from, origin, acceptable, onDrop, onCancel })` with the tile carry's lifecycle (one `finish`, capture-phase window listeners, Escape/blur/`pointercancel` cancel, a second carry cancels the first), the modifier read from every pointer and key event (a modifier-less synthetic event keeps the keyboard's last word), hit-testing by the element under the pointer (`closest("[data-port-id]")`, then `elementFromPoint`), and `usePortCarry()` over a module store. `shortcutRouting.ts` gains the `l`+Shift chord → `toggle-link-mode`.
- **pbui-workbench**: `components/PortRail` (inputs/outputs columns, `data-acceptable` from `planFollow` while a carry is in flight, `data-over`, `data-carrying`; pointerdown on an output starts the carry; `renderPort` wraps each port); `components/WireLayer` (wires from `linkRefsOf(snapshot)` between registered elements' rectangles, the toy's cubic path, `data-term` follow/held/derived styles, portal stubs when one end is unmounted, rubber band and a cursor badge naming `Follow(…)`/`Hold(…)`, re-measure on rAF/resize/ResizeObserver, `useEscapeSurface` + Escape → `link.mode.close` unless a carry is in flight, `renderWire` wraps each `<g>`); `links/linkRef.ts` (`LinkRef`, `linkRefsOf`, `createLinkDescriptor`); `contributions.ts` gains rules for subject `"link"` (three unlink policies, go to source/destination), `Show wiring` on ports and `Connect…` on tiles; `Tile` renders the rail over the app (`inert`), `Surface` mounts the layer and the chord with the launcher's focus-ownership rule, `SurfaceProps` gains `renderPort`/`renderWire`/`linkModeShortcut`. Stories for the rail and the wire styles. `links/connect.test.tsx`: four DOM tests (open/Escape/chord and inert app; drag → follow, wire, badge; Shift at release pins, Shift released mid-drag does not; wrong drops and Escape mid-drag declare nothing).
- **pbui-ecommerce**: `Values.link` + descriptor; `ShopShell` wraps rail ports as `<port>` and wires as `<link svg>` presentations; scene 7 opens in connect mode with two wires; `e2e/scenes.mjs` (plain `playwright`, five scenarios: right-click → Link to; Pin/Resume from the badge; Mod+Shift+L drag → wire + badge, Escape → app clickable again; Shift released mid-drag switches the cursor badge; wire menu → Unlink freeze → Resume unavailable with its reason) and `pnpm e2e`.
- Printed the P3 slips.

### Why

- Wires and drag exist only in the mode (D6): outside it the workspace is exactly Phase 2's — one badge per bound port.
- Hit-testing by the element under the pointer rather than by rectangles is what makes the same carry run under jsdom and in a browser; wide wire hit paths are disabled while a carry is in flight (audit §10.3) so they never become that element.
- The cursor badge names the term that WILL be committed, read live: the audit's anti-pattern was a modifier read only at drag start.

### What worked

- `startTileCarry` was a complete template; the port carry differs only in its registry and its drop predicate.
- `Presentation svg` renders a `<g>`, so a wire's `<g>` wrapped in the product's `<link>` presentation gets the object menu with no SVG-specific menu code.
- The Playwright accessibility tree names the disabled menu row with its reason, so the e2e asserts the explanation through `getByRole("menuitem", { name: /^Resume.*nothing to resume/ })`.

### What didn't work

- jsdom has no `PointerEvent`: Testing Library's `fireEvent.pointerDown` falls back to a plain `Event` with no `button`, `clientX` or `shiftKey`. The rail's `event.button !== 0` guard silently rejected every synthetic pointerdown (all four tests failed with nulls). Fixed with `button !== undefined && button !== 0`, `clientX ?? 0`, and a `shiftOf(event)` that keeps the keyboard's state when the event has no modifier; the test drives Shift through `keyDown`/`keyUp`.
- The first test's `document.querySelector("button")` found the tile bar's split button (not inert) instead of the app's; then the no-raw-controls fence flagged the raw `<button>` in the test. Now a pbui `Button`, found by text.
- `pnpm install --offline` refused `playwright@^1.62.0` (metadata for the range is not in the store) even though `playwright@1.62.0` is; `--prefer-offline` resolved it.
- Three e2e scenarios failed on assertion wording: the badge's glyph and text are separate spans (`→orders`, no space), and the disabled row's reason is in the accessible name, not the text.

### What I learned

- `useEscapeSurface(true)` in the wire layer makes connect mode a proper Escape owner; the launcher chord's `dialogOpen` guard then has to exclude the layer's own surface, or Mod+Shift+L could not close the mode it opened.
- React 19 renders `inert={true}` as the bare attribute; `closest("[inert]")` is a fine assertion.

### What was tricky to build

- **Escape with a carry in flight.** Both the carry (capture, cancels the drag) and the wire layer (bubble, closes the mode) listen on `window`; `stopPropagation` on the target node does not stop the other listener. The layer's handler ignores Escape while `carry` is non-null (the state re-renders the layer, so the closure is fresh), which the "Escape mid-drag keeps the mode open" test pins.
- **Geometry without layout.** Wire anchors come from `getBoundingClientRect` of registered elements; under jsdom every rectangle is zero, so the DOM tests assert the wire's `data-term` and existence, and the real geometry is what the e2e and the screenshot check.

### What warrants a second pair of eyes

- The chord's ownership rule duplicates the rebalance dialog's (a third copy); a shared `useWorkbenchChord` helper would remove it.
- `WireLayer` re-measures on every snapshot change with one rAF; a workspace with many wires and a resizing pane may want a throttle.
- `PortRail` renders every port's badge via `badgeOf` per render; fine for the shop, worth memoizing per (snapshot, view) in a bigger product.

### What should be done in the future

- Phase 4: the family's ">6 targets → accept mode over the rails" fallback now that unbound inputs have something to click.
- Keyboard-only connect mode (Tab between jacks, Enter to start/complete) per §6.8.7 — not built.
- A held wire's dotted style and the derived label are drawn; the identity double segment waits for Phase 5.

### Code review instructions

- `src/chrome/usePortCarry.ts`; `packages/pbui-workbench/src/components/{PortRail,WireLayer}`; `links/connect.test.tsx`.
- `pnpm --filter @hyperslop-systems/pbui-ecommerce storybook` then `pnpm --filter @hyperslop-systems/pbui-ecommerce e2e` (five scenarios); Storybook `Shop/Scenes/7`, `Workbench/PortRail`, `Workbench/WireLayer`.

### Technical details

```bash
cd packages/pbui-workbench && npx vitest run src/links/connect.test.tsx     # 4 tests
cd ../pbui-ecommerce && pnpm e2e                                           # 5 scenarios, needs Storybook on :6012
```

## Step 8: Phase 4 — the target resolver and the "show" chooser

"Show details…" now has a principled answer for zero, one or several targets. The kernel's `resolveShow` ranks existing input ports and spawnable (application, placement) pairs by the report's tuple; the workbench's `show` handler performs a lone winner, refuses when nothing can show the value, spawns a tile beside the source AND links it in one plan when nothing on screen can take it, and opens a chooser on the launcher's shell when several targets tie. The "Link to …" rows now bind show intents with a candidate id that is re-resolved fresh, never replayed. Screenshot: `various/screenshots/p4-show-details-menu.png` (scene 3: detail A held, "Show details…" beside the explicit "Link to" rows).

### Prompt Context

**User prompt (verbatim):** (see Step 4)

**Assistant interpretation:** Build the guide's Phase 4: the resolver, the show verb with fresh revalidation, spawn-plus-follow atomically, the `LauncherShell` chooser, and the shop's scene 3.

**Inferred user intent:** "Show details for this order" behaves the same whether zero, one or three details are open, and never overwrites a pinned comparison.

**Commit (code):** f9b2444 — "PBUI-LINK-1 Phase 4: the target resolver and the show chooser"

### What I did

- **Core** `links/resolveShow.ts`: `ShowQuery`, `PlacementCandidate`, `SpawnableApp`, `ShowCandidate` (existing-port | spawn), `ShowResolution` with `winners` and `ambiguous`; the tuple `(typeDistance, roleDistance, dispositionDistance, scopeIndex, sourceAffinity, placementIndex)`; a held port is `inapplicable` under a generic route; "already follows that source" is available with no verb (a no-op); spawns carry `dispositionDistance 2` and never tie among themselves; `freshCandidate(id, fresh)` refuses `target-no-longer-resolves` / `target-no-longer-available`. The `show` verb joins `LinkVerb` (validated, described; `applyLinkVerb` refuses it as shell-handled). Seven tests, including registration-order independence.
- **pbui-workbench**: `view.open` and `openView` accept `viewId` so a plan can name the new view's port in a later verb; `WorkbenchState.showChooser`; `createLinkHandlers` gains `attach({ planner, openView })` (the shell lends `plan`/`applyPlan` after construction; a shadow handler without a planner falls back to two batches), `placementsFor` (right of / below the source's tile, else the active or first tile), `spawnableFor` (every input port of every app, skipping placed singletons), `performShow` (fresh resolution → candidate by id, lone winner, refusal, or chooser state), `applyCandidate` (existing port → its verb; spawn → `[view.open(at, viewId), port.follow|bind]` as one plan); `components/ShowChooser` on `LauncherShell` (EXISTING TARGETS / NEW TARGETS, disabled rows keep their reason, Enter's verb named); `contributions.ts`: the family rows bind `show` with `candidateId`, and a `presentation.show` rule ("Show details…") per subject type; `WireLayer` stamps `data-source`/`data-destination`. Six DOM tests: one free target, held target skipped, chooser row performs, spawn in ONE batch (`onMutate` called once), role/type ranking, stale candidate refused.
- **pbui-ecommerce**: scene 3 (A held on #88213, table moved to #88201; "Show details…" goes to B) and 3b (only the table; a detail is spawned and linked), DOM tests, a sixth real-pointer scenario (tile count +1, badge → orders, the new detail shows the order).

### Why

- Fresh revalidation by candidate id is the report's §8.10: the chooser's row, the family's row and the agent all name a target; the handler re-resolves it against the current document and runtime, and applies only if it is still available.
- Spawn-plus-follow through the shell's own `plan`/`applyPlan` keeps "open a detail beside the table and make it follow" one batch — one `onMutate`, one undo — rather than a tile that might come up unlinked.

### What worked

- `LauncherShell` is exactly the chooser the guide asked for: groups, filter, status line, `enterVerb`; the toy's centered routing modal never had to be ported.
- `plan()` runs the shadow handlers, whose own link handlers rebuild the snapshot from the shadow document, so `port.follow` onto a view minted earlier IN THE SAME PLAN resolves normally.

### What didn't work

- `readonly inCurrentWorkspace?(port): boolean` is not valid TypeScript (a `readonly` method signature); the core build silently stayed stale and every downstream typecheck reported "no exported member `resolveShow`". Rewritten as a readonly function-typed property.
- The first resolver draft turned "already follows that source" into a `port.clear` verb — wrong; a target that already shows the source is a no-op success. Fixed in the resolver and the handler.
- My test expectation for spawns was wrong, not the resolver: with `typeDistance` as the first key, a spawnable exact-type detail outranks an on-screen inspector reached through `<inspectable>`. The test now documents that.
- The Phase 3 unlink e2e went flaky: scene 7 has two wires and `[data-part="wire-hit"]` picked whichever binding sorted first by random view id. Wires now carry their endpoints and the scenario selects the detail's wire.
- Four console errors during a capture were Vite HMR 404s while `pbui-workbench/dist` was being rewritten; Storybook recovered on the next request.

### What I learned

- `view.open` with a caller-supplied `viewId` is the smallest change that makes multi-step plans expressible; the applier already accepted any id.

### What was tricky to build

- **Where the planner lives.** The show handler runs inside `createVerbHandlers`, which has no `plan`/`applyPlan` (those are built in `createWorkbench` over the handlers). Injecting them afterwards through `links.attach` avoids a circular construction; the shadow handlers used by `plan()` simply have none and fall back to `openView` + `perform`.
- **Type distance versus "prefer what is on screen".** The tuple puts type first, so an exact-type spawn beats a supertype target on screen. That is the report's rule and it reads right for "Show DETAILS", but a product wanting "reuse anything already open" would reorder the tuple — which is why it is one declared array.

### What warrants a second pair of eyes

- The chooser is mounted by `Surface` unconditionally (it renders null when idle); a product mounting two Surfaces of one workbench would get two choosers.
- `spawnableFor` offers every input port of every non-placed app; a big product may want `AppDescriptor.available()` respected here too.
- The shadow-handler fallback (two batches) is untested because the workbench always attaches a planner.

### What should be done in the future

- Context candidates (`kind: "context"`) in the resolver, once `context.create`/`context.drive` verbs exist.
- Placement rows through `startTileCarry` ("aim where the new tile goes") instead of the two fixed spots.

### Code review instructions

- `src/presentation/links/resolveShow.ts` and its test; `packages/pbui-workbench/src/links/handlers.ts` (`performShow`, `applyCandidate`), `components/ShowChooser`, `links/show.test.tsx`.
- Storybook `Shop/Scenes/3` and `3b`, `Workbench/ShowChooser`; `pnpm e2e` (six scenarios).

## Step 9: Phase 5 — identity classes over value ports

The `≡` operator. Two contract-compatible ports may now share ONE cell: the declaration and its compiled class live in the link document, the cell lives in the runtime, both members read `Alias(σ)` and either member's emission writes the cell. Leaving a class initialises the fragments by policy — copy, restore private history, or reset. The compatibility check names the field that differs, which is scene 5's promise: the orders table's selection shares a cell with the orders-by-status plot but not with the revenue-by-category plot ("different authority domain: orders vs daily_sales"). Scene 6 shows the contrast with a plain follow: the orders filter follows the plot's category port. Screenshot: `various/screenshots/p5-shared-selection.png`.

Two things changed on request during this step: the user asked for no nested border squares — the badges now render BESIDE the tile's `<tile>` presentation rather than inside it — and asked whether a presentation can be both a product and a line item; answered in the conversation (one concrete type per reference; nesting, an abstract supertype, or Phase 6 relations are the three ways to "mix").

### Prompt Context

**User prompt (verbatim):** (see Step 4); mid-turn: "don't do nested border squares" (with a screenshot of the detail's badge inside the title box), "can a presentation be both a product and a line item ?", "like can we mix the actions for it?"

**Assistant interpretation:** Build Phase 5 (identity classes, P06 subset) across the three layers with scenes 5 and 6; fix the badge framing; explain the type model's answer to mixed actions.

**Inferred user intent:** Shared selection between a table and a plot done as a real identity class — not two follows — with the refusal explaining itself; and a header that reads as one row of distinct objects.

**Commit (code):** 06b8c35 — "PBUI-LINK-1 Phase 5: identity classes over value ports (P06 subset)"

### What I did

- **Core**: `types.ts` gains `refineContract(view)` on declarations and `refineDeclaration()` (Q7 resolved: the shell folds the per-view patch into the contract when it builds a `PortDefinition`); `identity.ts` — `compatibilityOf`/`checkIdentityCompatibility` (mismatches as a list with a sentence per field), `compileIdentity` (fibers by fingerprint, a small union-find with deterministic roots, classes of one dropped, persistent ids by largest overlap with the previous compile, `σN` minting, lineage new/unchanged/expanded/contracted/merged/split, diagnostics `port-missing`/`direction`/`incompatible`); `snapshot.ts` — `LinkState` (bindings, identity, classes, history), the snapshot's `identity`/`classes`/`aliases`/`history` and `values.classCell`; `evaluate.ts` — `Alias` is the derived effective binding of a member (explicit term → alias → slot → fallback), and an unbound OUT/INOUT port reads its own emission; `plan.ts` — `planIdentityAdd` (self, direction, already, bound, incompatible, `cells-differ` under `require-equal`, with `cellsDiffer` for the instrument) and `planIdentityRemove` (`no-history`); follow/bind refuse a shared port (`shared`); `apply.ts` returns the whole `LinkState` plus `RuntimeEffect`s (`seed-class`, `set-emitted`, `forget-class`); `identity.add` records each new member's pre-merge value, `identity.remove` initialises leavers by policy and forgets dissolved classes; `lifecycle.ts` `identityAfterViewsRemoved`; `invariants.ts` (class-homogeneous, alias in one class, declarations over existing ports); `verbs.ts` `identity.add`/`identity.remove`; `usePortCarry` reads Control/Meta live and passes both modifiers to `acceptable` and `onDrop`. 15 identity tests (55 kernel tests in all).
- **pbui-workbench**: `document.ts` persists `identity`/`classes`/`history` with structural validation and `stateOf(doc)`; `runtime.ts` gains class cells, `setClass`, `apply(effects)`, `emit(…, { classId })`; `snapshot.ts` refines declarations per view and recompiles classes with the persisted ones as previous; `handlers.ts` writes the state and applies the effects after the mutation, and `maintenance` drops identity of closed views and prunes history; `hooks.ts` `useEmitPort` writes a member's class cell; `PortRail` Ctrl-drag → `identity.add` (acceptability from `planIdentityAdd` while Ctrl is down); `WireLayer` draws identity as a double line without arrowhead and names `Share(… ≡ …)` under the cursor; `linkRef.ts` lists identity links; `contributions.ts` adds the three split-policy rows for identity wires (and hides the follow unlink rows on them); `Tile.tsx` renders badges after the product's title node. `links/identity.test.tsx`: add/refuse/seed/read, remove with history, Ctrl-drag, close/serialize.
- **pbui-ecommerce**: the plot's `selection` port refines `authorityDomain` from its table slot; `OrdersTable` gains Shift-click selection (`data-selected`, count in the toolbar), a category `filter` input (orders containing a product of the category, chip in the toolbar), and emits the selection as `orders` rows; `ShopPlot` keeps the outcome's interaction index, turns a brush into `selection` rows (deduplicated by identity), and draws an external selection by mapping row ids back to datum ids (`view.selection`); story setups `shareSelection`, `followCategory`; scenes 5, 5b (incompatible, opened in connect mode), 6; two DOM tests (shared cell through Shift-clicks and the refusal sentence; filter follows the catalog's category); two real-pointer scenarios (restore private values through the wire menu; Ctrl-drag refused with the field named) — eight passing.

### Why

- Alias is DERIVED, never written as a term (report §7.8): the declaration is the source of truth, the class its compilation; a term would be a second copy that could disagree.
- Effects are returned by the kernel rather than performed by it, so the transition stays pure and testable, and the shell decides when runtime cells change (after the document write commits).
- `refineContract` per view is the smallest resolution of Q7: the declaration remains the single place a reader looks, and the shell applies the view's facts when it builds the snapshot.

### What worked

- P06's shape transferred cleanly: fibers, union-find, canonical member order, persistent ids by overlap. Its counterexample "bidirectional = two arrows" is what `planFollow`'s `shared` refusal now prevents.
- The plot's `PlotOutcome.interactions` index has everything the shop needs to map brushes to rows and rows to marks; no plot-package change was needed.

### What didn't work

- `apply.ts` was refused by the Write tool ("modified since read") after my own python edit; rewritten through the shell.
- Two identity tests failed for one real reason: an INOUT port with no term evaluated as `unbound`, so a merge seeded an empty cell and "history" restored nothing. `evaluatePort` now reads an output's own emission when it has no term.
- `readonly` on a method signature (`inCurrentWorkspace?(…)`) is invalid TypeScript — fixed in Phase 4's resolver, but the duplicate-key error it masked in `apply.ts` (`{ bindings, …patch, bindings }`) only surfaced here.
- The scene test named order 88215, which does not exist (the book runs 88150–88214).
- `pnpm test` in pbui-workbench hit the pre-existing `slate.perf.test.ts` timing guard again.

### What I learned

- A `filter` on the orders table through a plain follow and a `selection` through identity in the same workspace make the two operators visibly different: the follow badge says `→ plot`, the identity badge says `≡ selection · σ1` on both ends.
- Playwright's `keyboard.down("Control")` before `mouse.move` is enough for the carry to read the modifier live; the cursor label switches on the keyup.

### What was tricky to build

- **What a class cell holds when members disagree.** The merge policy decides the seed; the kernel records each member's private value the moment it joins (not later), and only for members that were not already in a class, so a three-member class keeps three histories.
- **Which ports are "fragments" on remove.** A remove can contract a class (one leaver), dissolve it (two leavers), or split it (two smaller classes). The transition compares each port's class before and after and only initialises ports that left every class; a surviving class under a new id is re-seeded from the old cell.
- **The badge frame.** `Tile` composed badges into `defaultTitle`, so the product's `<tile>` presentation enclosed them; the fix renders the badge nodes after whatever `renderTitle` returned.

### What warrants a second pair of eyes

- `compileIdentity`'s lineage for the split case: the class that keeps the id is "contracted", the others "split"; the report's vocabulary may want "split" on all of them.
- The runtime's `apply(effects)` runs after `store.mutate` returns; a plan that commits identity and then fails a later verb would leave the cell seeded — `plan()` uses a shadow store, whose effects hit the SAME runtime. Worth moving effects behind `applyPlan`.
- `datumIdsFor` in `ShopPlot` scans every target per render; fine at 65 rows, worth an index on a real dataset.

### What should be done in the future

- Merge-policy popover when cells differ (the plan already reports `cellsDiffer`; the rail currently uses `prefer-left`).
- Phase 6: `Derived` over translators, the relation palette, and the `lineItem → product` relation the user asked about.

### Code review instructions

- `src/presentation/links/identity.ts`, `apply.ts` (the two identity cases), `identity.test.ts`; `packages/pbui-workbench/src/links/{handlers,runtime,snapshot}.ts`, `identity.test.tsx`; `packages/pbui-ecommerce/src/tiles/{OrdersTable,ShopPlot}`.
- Storybook `Shop/Scenes/5`, `5b`, `6`; `pnpm e2e` (eight scenarios).

## Step 10: Phase 6 — Derived over translators and the relation palette

The third operator. A port may now DERIVE from another through a named relation: the customer detail reads the orders table's `order` port through `order.customer` and shows the customer of whatever order the table presents, with the badge `customer ← its customer`. The relations are the product's translators (D7): one registry serves accept mode ("show this order as its customer") and standing bindings, so the two cannot disagree. The palette on `LauncherShell` lists every (source output on screen, legal relation) pair for a destination; a follow wire's menu offers "Change to Derived…" with the source fixed. This also answers the user's mid-turn question: `lineItem.product` is now a declared relation, so a line item can be shown as, or derived into, its product.

### Prompt Context

**User prompt (verbatim):** (see Step 4)

**Assistant interpretation:** Build the guide's Phase 6 — `planDerive`, `Derived` evaluation through the translator registry, the `port.derive` verb, the relation palette, the labelled wire and badge — and the shop's scene 4.

**Inferred user intent:** The derive operator as a first-class, named, inspectable relation, not a hidden callback.

**Commit (code):** 4e73712 — "PBUI-LINK-1 Phase 6: Derived over translators and the relation palette"

### What I did

- **Core**: `RelationDefinition` (id, from, to, label) and `LinkDeps.relations` beside the existing `relation(id, ref)` applier; `legalRelations(source, destination)` by type reachability on both ends; `planDerive` (self, direction, held, shared, cycle, `no-relation` naming both types, `relation` when the named one does not fit, `already`; one legal relation is chosen, several are an `ambiguous` plan with labelled options); `port.derive` verb → `Derived(Follow(source, linkId), ρ, linkId)`; the badge shows the relation's label and the current value; `relation.palette.open/close` as browser-local verbs. `derive.test.ts`: legality, ambiguity, the term written, evaluation through the relation, the badge, pin/resume over a derivation, empty-not-stale, missing registry as a diagnostic.
- **pbui-workbench**: `LinkEnvironment.relations`/`relation`; `relationPalette` state; `components/RelationPalette` (groups per source tile, rows per legal relation, Enter derives); "Derive through…" on `<port>` (inapplicable on outputs, unavailable when held/shared/no relations) and "Change to Derived…" on follow wires; the wire label reads the relation's label. `derive.test.tsx`.
- **pbui-ecommerce**: `presentation/relations.ts` (`createShopRelations(host)`: `order.customer`, `lineItem.product`, `product.category`, each applying through the host; `shopTranslators` turns them into `PresentationTranslator`s for `createPbui`); `createShopWorkbench` passes the same relations to the kernel; harness `deriveCustomer`; scenes 4 (derived beside a following detail) and 4b (the palette open); a DOM test that goes badge → "Derive through…" → palette row → badge `←` → the customer follows the table; a ninth real-pointer scenario.
- Committed the plot tile's render-loop fix separately (dc72829) after the Phase 5 capture surfaced it.

### Why

- One registry for accept and derive is the argument `resolveAcceptance` already makes for highlighting versus clicking: what the chooser offers is what the standing binding does.
- The palette is the toy's pattern 6 on the shell pbui already has; ambiguity ("two relations fit") is resolved by the user, never by registration order.

### What worked

- `Derived` evaluation, pin over a derived term and resume were already correct from Phase 2's evaluator; Phase 6 added the planner and the instrument, not new semantics.
- The nine-scenario e2e suite ran green on the first try for the derive scenario, because the palette is a `LauncherShell` the earlier scenarios had already driven.

### What didn't work

- Nothing failed in this phase's code. The Playwright MCP browser had crashed on the Phase 5 render loop and refused new tabs until closed and reopened.

### What I learned

- `LauncherShell`'s `getByRole("dialog")` scoping is what keeps the e2e click on "its customer" from hitting the same words in a tile.

### What was tricky to build

- **Relation identity across two registries.** The translator and the kernel relation must have the same id, from, to and function, or the badge could say "its customer" while accept mode converts differently. `createShopRelations` is the single source both are derived from.

### What warrants a second pair of eyes

- `planDerive` treats a follow already in place as replaceable (the derive overwrites it) — consistent with follow-replaces-follow, but "Change to Derived…" keeps the source and changes the term, which a user may read as an edit rather than a replacement.
- Relations are synchronous and cheap by contract (D7); the host's `orderCustomer` is a map lookup, but a DuckDB-backed host would need the async story the guide defers.

### What should be done in the future

- A relation whose `to` is a collection (`order.lineItems`) needs the `many`-cardinality selection operator (open question Q3).
- The user's "mix the actions" question: an abstract supertype shared by `lineItem` and `product` if a merged menu is wanted.

### Code review instructions

- `src/presentation/links/plan.ts` (`legalRelations`, `planDerive`), `derive.test.ts`; `packages/pbui-workbench/src/components/RelationPalette`, `links/derive.test.tsx`; `packages/pbui-ecommerce/src/presentation/relations.ts`.
- Storybook `Shop/Scenes/4`, `4b`, `Workbench/RelationPalette`; `pnpm e2e` (nine scenarios).
