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
    - Path: repo://packages/pbui-workbench/src/verbs.ts
      Note: Largest file read; grep-then-range strategy recorded
    - Path: repo://src/chrome/useTileDrag.ts
      Note: startTileCarry recognized as the port-drag lifecycle
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
