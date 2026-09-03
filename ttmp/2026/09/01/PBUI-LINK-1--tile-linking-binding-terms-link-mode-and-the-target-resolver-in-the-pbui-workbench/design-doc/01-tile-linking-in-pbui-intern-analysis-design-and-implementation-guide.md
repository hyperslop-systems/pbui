---
Title: 'Tile linking in pbui: intern analysis, design, and implementation guide'
Ticket: PBUI-LINK-1
Status: active
Topics:
    - pbui
    - design
    - architecture
    - actions
    - frontend
    - onboarding
DocType: design-doc
Intent: long-term
Owners: []
RelatedFiles:
    - Path: abs:///home/manuel/Downloads/PBUI-linked-tiles-research-bundle/source_materials/p06-extracted/src/contracts.ts
      Note: Identity compatibility on normalized contract fields
    - Path: abs:///home/manuel/Downloads/PBUI-linked-tiles-research-bundle/source_materials/pbui-agent-workbench(3).jsx
      Note: Typed ports, adapters, fan-in/on-close policies, back side, connect modal
    - Path: abs:///home/manuel/Downloads/PBUI-linked-tiles-research-bundle/ttmp/2026/08/28/PBUI-LINK-UI--pbui-linked-tiles-linking-interaction-design-and-implementation-guide/design-doc/01-linking-interaction-design-and-implementation-guide.md
      Note: Ten interaction patterns, layer plan, invariants, anti-patterns
    - Path: abs:///home/manuel/code/wesen/2026-08-28--toy-actions-linked-pbui/app.js
      Note: Original multi-scene toy with the centered routing modal (anti-pattern)
    - Path: abs:///home/manuel/code/wesen/2026-08-28--toy-actions-linked-pbui/approaches/combined.html
      Note: Substrate + gesture + pointer composed on one workspace
    - Path: abs:///home/manuel/code/wesen/2026-08-28--toy-actions-linked-pbui/lib/core.js
      Note: 'Shared binding core: state, route, pinToggle, merge, commitDerived, unlink, relations'
    - Path: repo://contracts/workbench/v1/valid/linked-view.json
      Note: A linked view placed in two workspaces
    - Path: repo://packages/datalab-ui/src/apps/InspectorApp/InspectorApp.tsx
      Note: Singleton reading world.inspected; becomes a subject in-port
    - Path: repo://packages/datalab-ui/src/components/molecules/DocBar/DocBar.tsx
      Note: Per-tile document picker (Constant editing today)
    - Path: repo://packages/datalab-ui/src/pbui/actions.ts
      Note: 'inspectable/watchable abstract types: send-to-port by type reachability'
    - Path: repo://packages/datalab-ui/src/store/world.ts
      Note: 'activeDocId and inspected: product globals that become contexts'
    - Path: repo://packages/pbui-chat/src/tools/acceptTool.tsx
      Note: 'pbui_accept: agent-driven accept mode'
    - Path: repo://packages/pbui-chat/src/tools/workbenchTools.ts
      Note: workbench_describe/perform/apply agent tools that carry link verbs unchanged
    - Path: repo://packages/pbui-chat/src/types.ts
      Note: Wire reference shape reused for serializable references (D4)
    - Path: repo://packages/pbui-plotscript/src/apps.tsx
      Note: 'Two doc-bound apps sharing the plot slot: document-level identity today'
    - Path: repo://packages/pbui-plotscript/src/document.ts
      Note: Payload read/write precedent for pbui.links
    - Path: repo://packages/pbui-sandbox/src/state.ts
      Note: Runtime store keyed by view id, the LinkRuntime pattern
    - Path: repo://packages/pbui-workbench/src/actions.ts
      Note: workbenchTileContributions pattern for workbenchLinkContributions; type definitions tile/workspace
    - Path: repo://packages/pbui-workbench/src/apps.ts
      Note: AppDescriptor (docBound, bindings) that gains ports; AppProps keyed by view
    - Path: repo://packages/pbui-workbench/src/components/Surface/Surface.tsx
      Note: Where the WireLayer mounts
    - Path: repo://packages/pbui-workbench/src/components/Tile/Tile.tsx
      Note: Where badges, the port rail, and the linked ×N marker render
    - Path: repo://packages/pbui-workbench/src/createWorkbench.tsx
      Note: CreateWorkbenchOptions gains links; verb handlers get the runtime
    - Path: repo://packages/pbui-workbench/src/describe.ts
      Note: describeWorkbench gains ports, links, contexts
    - Path: repo://packages/pbui-workbench/src/rebalance/configDocument.ts
      Note: Precedent for a DocumentPayload format owned by the shell (pbui.links follows it)
    - Path: repo://packages/pbui-workbench/src/store.ts
      Note: Browser-local WorkbenchState; linkModeOpen goes beside rebalanceOpen
    - Path: repo://packages/pbui-workbench/src/stories/demoApps.tsx
      Note: Demo apps that gain ports in Phase 1; LinkLab story lives beside
    - Path: repo://packages/pbui-workbench/src/tileDescriptor.ts
      Note: TileRef shape; PortRef follows it
    - Path: repo://packages/pbui-workbench/src/types.ts
      Note: Workbench interface (plan/applyPlan/perform), TilePlacementInfo, SurfaceProps.renderTitle
    - Path: repo://packages/pbui-workbench/src/verbs.ts
      Note: WorkbenchVerb union (tile.link, view.rebind, view.open), BindingConfig, SplitPolicy, CrossWorkspace, handlers openView/replace/link/rebind
    - Path: repo://packages/pbui-workbench/src/workbench.test.ts
      Note: Test conventions (threeTiles, leafIds, box) the link tests follow
    - Path: repo://pkg/workbench/model.go
      Note: Go ApplicationDescriptor.DocumentBindings and limits; pbui.links validator hook (Phase 7)
    - Path: repo://proto/hyperslop/pbui/workbench/v1/workbench.proto
      Note: 'Workbench document: views vs placements, AppView.documents slots, DocumentPayload, mutations'
    - Path: repo://src/chrome/LauncherShell.tsx
      Note: Grouped searchable modal reused for the show chooser and the relation palette
    - Path: repo://src/chrome/TileFrame.tsx
      Note: Tile chrome with the title slot where the binding badge goes
    - Path: repo://src/chrome/useTileDrag.ts
      Note: Tile registry, banded zones, and startTileCarry (placement mode) reused for the port carry
    - Path: repo://src/presentation/actions/perform.ts
      Note: evaluateFresh refusal codes reused for show-candidate revalidation
    - Path: repo://src/presentation/actions/registry.ts
      Note: Fail-fast registry shape; listReachable and vocabulary the link kernel extends
    - Path: repo://src/presentation/actions/types.ts
      Note: Action kernel contracts (query, snapshot, rules, families, resolved actions, ambiguity, trace) the link kernel mirrors
    - Path: repo://src/presentation/createPbui.tsx
      Note: Accept mode API (accept/isAcceptable/satisfyAccept/acceptChooser), Presentation click contract, status bar ACCEPT MODE
    - Path: repo://src/presentation/translators/resolve.ts
      Note: One resolver for highlighting and clicking; the same rule applies to planFollow
    - Path: repo://src/presentation/translators/types.ts
      Note: PresentationTranslator is the direct relation registry Derived reuses (D7)
    - Path: repo://src/presentation/types.ts
      Note: PresentationReference, PresentationDescriptor, AcceptRequest
    - Path: repo://src/surfaces.ts
      Note: Escape-surface stack that connect mode and the palette register with exactly once
    - Path: repo://ttmp/2026/09/01/PBUI-DATALAB-1--a-small-datalab-like-demo-in-pbui-relation-documents-plot-documents-and-linked-tiles/design-doc/01-datalab-in-pbui-intern-analysis-and-design-guide-for-a-relation-and-plot-workbench-demo.md
      Note: Why datalab-ui is frozen (§6) and the host/port shapes pbui-datalab will share (§7.4, §7.6)
    - Path: ws://datalab/ui/package.json
      Note: The only consumer of datalab-ui; the eventual dependency switch happens here
    - Path: ws://plot/src/interactions.ts
      Note: 'PlotEvent activate/hover/brush: out ports waiting to be declared'
ExternalSources: []
Summary: Evidence-based analysis of the linked-tiles research (binding algebra, toy model, audited interaction patterns, agent-workbench prototype, P06 identity compiler) against the real pbui codebase (action kernel, accept mode, workbench document, verbs, chrome, product integrations), followed by a design for ports, binding terms, a link kernel, an unobtrusive interaction surface (badge, "link to" menu, connect-management mode, target resolver), a phased implementation plan, a self-contained e-commerce demo package as the first consumer, and a test strategy. Amended 2026-09-01 after the PBUI-DATALAB-1 review - hard cutover for new packages, datalab-ui frozen, kernel in core plus glue in pbui-workbench (D9, D10).
LastUpdated: 2026-09-01T19:30:00-04:00
WhatFor: Read this before implementing tile linking in pbui. It tells a new engineer what already exists, what the research recommends, what to integrate first, and exactly which files to touch.
WhenToUse: When adding ports, links, binding badges, connect mode, or a "show in" target resolver to pbui-workbench or to a product built on it.
---



# Tile linking in pbui: intern analysis, design, and implementation guide

## 0. How to read this guide

This document is written for an engineer who is new to pbui and has been asked to add **tile linking**: the ability for one tile in a pbui workbench to feed, follow, share, or derive its content from another tile, with a visible and inspectable representation of that coupling.

It has four parts:

1. **What was researched** (§3). Three research artifacts already exist outside the pbui repository: a formal report on linked-tile semantics, an executable toy model with ten audited interaction patterns, and two older prototypes (an agent workbench with typed ports, and the P06 identity compiler). You need to know what they concluded, because this design reuses their vocabulary verbatim.
2. **What exists in pbui today** (§4). The real codebase has more of the substrate than it looks: a pure action kernel with a type graph and fresh revalidation, an accept mode with typed translators, a protobuf workbench document with document bindings and linked views, a verb layer with atomic plans, tile chrome with drag and "carry" placement, and an agent tool surface. Every claim in §4 cites a file and, where useful, a line.
3. **The design** (§5–§9). A port model, binding terms, a pure link kernel that is a *sibling* of the action kernel, a link document persisted inside the workbench document, and an interaction surface deliberately less intrusive than the toy: a tiny header badge as the always-on substrate, an object-menu "Link to…" family for the common case, and a **connect-management mode** (think of the back panel of a Reason rack, or a patch bay) for the rare case where you want to see and edit the whole wiring.
4. **How to build it** (§10–§13). Phases with file-level guidance, demo applications in order of increasing ambition, a test strategy that follows the rules the toy audit established, and the risks and open questions that remain.

Conventions used below:

- `path:line` references point into this workspace: `pbui/` is `/home/manuel/workspaces/2026-09-01/add-plot-editor/pbui`, the toy is `/home/manuel/code/wesen/2026-08-28--toy-actions-linked-pbui`, and the research bundle is `/home/manuel/Downloads/PBUI-linked-tiles-research-bundle`.
- "The report" means the research report *Linked Tiles in Presentation-Based User Interfaces* (vault note `Projects/2026/08/27/PROJECT REPORT - PBUI Linked Tiles - Interaction Models, Formal Semantics, and an Architecture for Routing, Binding, and Coordination.md`). "The audit" means the follow-up *From Plausible Demos to Verified Interaction Semantics* (vault note dated 2026-08-29).
- Binding terms are written as in the report: `Ambient(k)`, `Constant(r)`, `Follow(p)`, `Alias(c)`, `Derived(b, ρ)`, `Hold(r, b)`, `Unresolved(d)`.
- "Observed" means read from a file in this workspace. "Inferred" means a conclusion drawn from observed facts. Recommendations never rest on inference alone.

## 1. Executive summary

**Linking is six problems, not one.** The report decomposes it into routing (where does "show this" go?), binding (what does a port read?), coordination (how do several tiles stay consistent?), lifecycle (what happens on pin, unlink, close?), placement (where does a new tile go?), and explanation (how does the user see the coupling?). A single "linked" edge type collapses these and produces semantic accidents: symmetric identity becomes an unstable callback cycle, order→author becomes type laundering, and every "show" either spawns without bound or overwrites a pinned comparison.

**pbui already has half of the substrate.** Observed in this workspace:

- The action kernel (`pbui/src/presentation/actions/`) is a pure resolver over an immutable snapshot with a nominal type graph, explicit availability, ambiguity-as-data, a trace produced by the real selection path, and fresh revalidation before perform. The report's recommendation that the binding resolver be a *sibling kernel with shared vocabulary* is therefore cheap: the type graph, scopes, snapshot revisions, stable ids, and trace shapes already exist.
- Accept mode (`pbui/src/presentation/createPbui.tsx:279-297`) lets a command point at any visible typed presentation, with typed translators resolving direct conversions (`pbui/src/presentation/translators/`). This is the CLIM-style target chooser the report asks for; ports and placement zones only need to become presentations.
- The workbench document (`pbui/proto/hyperslop/pbui/workbench/v1/workbench.proto`) already separates logical views from placements, lets one view be placed twice (a *linked view*, `placementCount > 1`), and binds views to shared `DocumentPayload`s through named slots (`AppView.documents`). Two tiles bound to one document are, in the report's terms, an **identity class at document granularity**: the wire moves the pointer, not the document. The verbs `tile.link`, `view.rebind`, `view.open`, `tile.replace` and the `BindingConfig` policy (`pbui/packages/pbui-workbench/src/verbs.ts:95-120, 505-535`) are the existing topology operations.
- The chrome has a tile drag with banded drop zones and a **carry** (placement mode) that aims something not yet on screen at the tiles through capture-phase pointer events (`pbui/src/chrome/useTileDrag.ts`). Connect mode can reuse both the hit-test registry pattern and the carry lifecycle.
- The agent path (`workbench_describe`, `workbench_perform`, `workbench_apply`, `pbui_accept` in `pbui/packages/pbui-chat/src/tools/`) already serializes every workbench verb, so link verbs added to the `WorkbenchVerb` union become agent-usable for free.

**What is missing** is the other half: no ports over presentation values, no directed follow edges, no held/pinned bindings, no named ambient contexts (products use ad-hoc globals such as datalab's `world.activeDocId` and `world.inspected`), no identity classes over value ports, no derived bindings, no target resolver for "show X", no wires, no badge, and no inspector. Section 5 tabulates this term by term.

**The design in one paragraph.** Applications declare typed **ports** beside the document slots they already declare. A pure **link kernel** in `pbui/src/presentation/links/` (a sibling of `actions/`) defines binding terms, evaluates a port's effective value through a revisioned snapshot, checks follow compatibility and cycles, checks identity compatibility on normalized contracts, and resolves "show" targets into candidates with explanations. A **link document** (`pbui.links`, a `DocumentPayload` like the rebalance config) persists declarations inside the workbench document, so persistence, undo via `plan`/`applyPlan`, server sync, and agent tools all work unchanged. A **link runtime** store (keyed by view id, like the sandbox program state) holds emitted values and context cells. Interaction is layered from least to most intrusive: a header **binding badge** that is also a `<port>` presentation with an object menu (pin, resume, detach, follow a source, join a context, unlink); an object-menu **"Link to…" family** on any presentation that lists compatible input ports on screen and falls back to accept mode when there are many; and a **connect-management mode** toggled by keyboard or menu that flips tiles to a port-rail "back side", draws wires in one SVG layer, and supports port-to-port drag with Shift for Hold. Wires exist only in that mode. Routing for "Show details…" is a candidate resolver whose chooser reuses `LauncherShell` and whose spawn path reuses `openView`/`placeAt`.

**Build order.** Phase 1 declares ports and contracts with no behavior change. Phase 2 adds the link document, kernel, runtime, `Ambient`/`Constant`/`Follow`/`Hold`, the badge, and the "Link to…" menu. Phase 3 adds connect mode and wires. Phase 4 adds the target resolver for "show". Phase 5 adds identity classes over value ports. Phase 6 adds `Derived` over the existing translator registry with a relation palette. Phase 7 adds the coordination inspector, agent vocabulary, and Go-side validation. The first demo is a **self-contained e-commerce package** (`pbui/packages/pbui-ecommerce`: orders, customers, products, line items, a sales series, in-memory host, tables, detail tiles, plot tiles over `@hyperslop-systems/plot`) that is also the first consumer of every phase; plotscript and pbui-chat follow; PBUI-DATALAB-1 later swaps the in-memory host for relation documents and DuckDB behind the same tile contracts. `packages/datalab-ui` is frozen and never touched (D10).

## 2. Problem statement and scope

### 2.1 The problem

A pbui workbench shows several applications as tiles. Today the only ways two tiles coordinate are:

1. both are bound to the same document id in `view.documents` (observed: `pbui/packages/pbui-workbench/src/apps.ts:36-41`, datalab `ChartApp.tsx:10`, plotscript `PlotTile.tsx:31`);
2. both are placements of one logical view (`placementCount > 1`, observed: `pbui/packages/pbui-workbench/src/components/Tile/Tile.tsx:50-62`);
3. a product-specific global that one tile writes and another reads (observed: datalab `store/world.ts:67,73` `activeDocId`, `inspected`; `InspectorApp.tsx` reads `world.inspected`).

None of these can express "this detail follows *that* table", "this detail is frozen on order #1042 but can resume following", "this chart's selection *is* that table's selection", or "this author tile shows the author *of* whatever order is current". None of them is visible: a user cannot see why a tile changed, and an agent cannot describe the coupling. And "show details for this order" has no principled answer when zero, one, or three detail tiles exist.

### 2.2 The user's constraints on the interaction

The request that produced this ticket asked for the toy's ideas "slightly less intrusive": hidden behind a **connect-management mode** ("a bit like in Reason where you can patch the cables in the back"), or reachable through **"right click → link to"** when an object matches a port. This changes the priority order the earlier interaction guide (ticket `PBUI-LINK-UI`, §6.1) proposed. That guide put the gesture surface (drag-to-link with modifiers and drop zones) second, right after the ambient substrate, and the pointer surface (popover, pie, palette) last. For pbui the order becomes:

1. **Substrate**: ambient defaults and a compact header badge (unchanged: zero gestures).
2. **Pointer surface first**: the object menu, which pbui already renders for every presentation through the action kernel. "Link to…", "Show in…", "Pin", "Resume", "Unlink…" are ordinary kernel rules and families. Accept mode is the fallback chooser.
3. **Gesture surface only inside connect mode**: port-to-port drag, wires, and wire editing exist only while the mode is on. Outside the mode a workspace looks exactly as it does today, plus one badge per bound port.

Everything the toy proved about *semantics* (one core, visible postconditions, Hold retains provenance, unlink is a policy, Alias is a declaration and not two equal values) is kept. What changes is *which instrument is primary*.

### 2.3 In scope

- Ports and contracts on `AppDescriptor`.
- Binding terms `Ambient`, `Constant`, `Follow`, `Hold`, `Alias`, `Derived`, `Unresolved`.
- A pure link kernel: evaluation, follow planning (compatibility, fan-in, cycles), identity compatibility, target resolution, fresh revalidation.
- Persistence of declarations in the workbench document; runtime values in a store.
- Verbs in the `WorkbenchVerb` union; handlers producing protocol mutations; agent exposure.
- Header badge, `<port>` and `<link>` presentation types with kernel contributions, "Link to…" family, connect mode with wires and drag, the "show" resolver and chooser, unlink with split policy.
- Demo applications and tests.

### 2.4 Out of scope (deliberately)

- Bidirectional lenses, propagator/semilattice cells, multi-step relation chains, replicated topology (report §14.9: only demonstrated use cases justify them).
- Cross-workspace links beyond what `CrossWorkspace: "link"` already gives (`verbs.ts:87`); remote portals are Phase 7+.
- Touch: native drag is not a touch story; the pointer surface is the fallback (audit §16).
- Replacing `view.documents` with a general port store. Document-port constants stay there; only the *declaration* is unified into ports (Decision D2 as amended by D10).
- Migrating `packages/datalab-ui`. It is frozen (D10); the demos live in new packages.

## 3. What was researched before this ticket

### 3.1 The report: six problems, one algebra, three operators

The report (2,900 lines, 32 retrieved papers) is the semantic foundation. The parts an implementer must internalize are:

**The binding algebra** (report §7.2, appendix A.1):

```text
b ::= Ambient(k)            read a named context cell
    | Constant(r)           a concrete reference, no provenance
    | Follow(p)             the effective value of another port
    | Alias(c)              projection of a shared identity class
    | Derived(b, ρ)         a named relation applied to another binding
    | Hold(r, b)            a captured value plus the SUSPENDED binding b
    | Unresolved(d)         a diagnostic, never silently empty
```

The algebra separates *where a value comes from* from *what the value is*. An unconfigured input uses its declared fallback: `B_eff(p) = B(p)` if declared, else `Ambient(fallback(p))` (report §7.4).

**Three visual operators** (report §6.2): `A → B` follow (asymmetric, acyclic, provenance), `A ≡ B` share (symmetric, transitive, merge/split by policy), `A --ρ→ B` derive (named relation with cardinality; reverse edits need a declared lens).

**Pinning is suspension, not cutting** (report §6.3, §7.9): `pin(b) = Hold(⟦b⟧, b)`, `unpin(Hold(r, b)) = b`, `detach(Hold(r, b)) = Constant(r)`. Pin then unpin is the identity unless topology changed underneath.

**Identity compatibility is stricter than payload type** (report §7.7, P06): two ports may be identified only if their *normalized contracts* are equal on every field: value type, semantic role, cardinality, mode, authority domain, update algebra, lifetime.

**Routing is explained selection** (report §7.10, §8.9): candidates are existing compatible ports, named contexts, and spawnable (constructor, placement) pairs; each is ranked by a tuple `(typeDistance, roleDistance, dispositionDistance, scopeIndex, sourceAffinity, -priority)`; ties are ambiguity; registration order never wins; the stale candidate is never applied, it is re-resolved (report §8.10).

**Fan-in and lifecycle are contract policy, not incident** (report §11): fan-in algebras (`single-producer`, `active-source`, `last-event`, …), source-close policies (`freeze`, `clear`, `ambient`, `reroute`, `close-dependent`, `prompt`), duplication policies, and workspace-template hygiene.

**System invariants** (report §7.11) that a conforming implementation continuously tests. The ones that become unit tests in §12 of this guide: every declared port has one effective binding or one diagnostic; every alias port belongs to exactly one class; classes are contract-homogeneous; the follow/derived graph is acyclic after alias collapse; no unavailable or ambiguous routing candidate has an executable verb; every topology mutation revalidates; pin then unpin restores the suspended binding; registration order never changes winners.

**The relationship to the action kernel** (report §3.2, §14.10) is the single most important architectural instruction: *do not* implement binding as another action family, *do* share the type graph, scope stack, snapshot conventions, availability constructors, stable ids, trace shape, direct translator registry, and Escape-owned surfaces. A `presentation.show` action produces a serializable intent that the target resolver handles.

### 3.2 The toy: one core, many instruments, audited postconditions

The toy repository (`/home/manuel/code/wesen/2026-08-28--toy-actions-linked-pbui`, 2,300 lines, no dependencies) is the executable reference. It is structured exactly as the report demands:

- `lib/core.js` is the **shared binding core**. `makeState` (`core.js:45-63`) holds two independent order contexts `alpha` and `gamma`, a `held` value, a `detailMode` (`ambient | follow | hold | alias | derived`), a `suspendedMode` so Hold can resume what it interrupted, `preMerge` history for the history unlink policy, declared defaults, the current `derivedRelation`, and a list of `spawnedTiles` descriptors. The mutations are the verbs every page calls: `emitAlpha`/`emitGamma` (`:75-82`), `route(state, disposition)` (`:88-112`, follow-existing, pin-existing, spawn right as Follow, spawn below as Hold), `pinToggle(state, freezeId)` (`:123-135`), `merge(state, choice)` (`:139-152`), `commitDerived(state, relationId, target)` (`:157-164`), and `unlink(state, policy)` (`:171-191`, policies `copy | history | reset`). Relations are a small static registry with `sourceType`/`targetType` (`:36-42`).
- `approaches/01…10-*.html` are ten pages, each wiring **one** interaction instrument to the same core: drag-to-link, modifier keys at drop (Shift=Hold, Ctrl=Alias, D=Derived), anchored popover, drop-zones for spawn placement, right-click pie, relation command palette, long-press Hold on a wire, ambient attention following, wire as the editable object, unlink with split policy. `combined.html` composes substrate + gesture + pointer on one workspace.
- `index.html` + `app.js` is the original multi-scene model (overview, wiring, routing, identity conflict) with a centered routing modal that the interaction guide later classified as the anti-pattern to remove.

The **audit** (vault note 2026-08-29) is what makes the toy trustworthy. Its first pass found 7 of 17 real-pointer scenarios passing: handlers appended trace rows but did not change state (spawn added no tile, Alias left a `HOLD` label, Derived rendered the wrong relation, Ambient Pin froze the fallback value rather than the attended one, three unlink policies produced one result). The repairs (`0093676`, `4b5f9e3`) made the core stateful enough to render every promised postcondition and established working rules that this design adopts as acceptance criteria:

- a trace event is not a user-visible postcondition;
- a spawn must add a visible tile element;
- Alias must be represented as shared identity, never inferred from equal values;
- Derived must name a relation and render a value compatible with the target type;
- Hold must preserve the source it can resume;
- Ambient Pin freezes the **last value presented as attended**, even when the pointer had to leave the source to reach the control (`lastAmbientOrder`);
- unlink must declare how the split cells are initialized;
- wide invisible hit areas must not intercept other active instruments (`.drag-active .wire-hit { pointer-events: none }`);
- test native interactions with native pointer/keyboard actions, a fresh page per scenario, a fresh context after shared-script edits.

The audit's **six-step recipe** for adding an interaction (define the semantic operation; implement the shared transition without DOM; project every visible facet; bind the instrument on one page; write the real-interaction scenario; add it to the combined page) is reused as the definition of done for every phase in §10.

### 3.3 The agent-workbench prototype: ports, adapters, fan-in, back sides

`source_materials/pbui-agent-workbench(3).jsx` (5,243 lines) in the research bundle is the earlier JSX prototype the report analyses in §3.3. It is worth reading because it already *looks* like a pbui workbench and shows what ports feel like in a tiled UI:

- `PORTS` (`:1723-1747`) declares, per application, named directional typed ports with one-line documentation: `overview: [port("file","file","out","the file whose row you clicked"), …]`, `inspector: [port("subject","any","in","anything at all")]`, `plot: [port("doc","doc","inout",…), port("datum","datum","out",…)]`.
- `ADAPTERS` (`:1753-1770`) are named direct coercions between neighbouring types (`"hunk>file": { label: "its file", fn }`); `canConnect(from, to)` (`:1772`) allows equal types, `any`, or a declared adapter. The connect modal names the adapter rather than coercing silently.
- Wiring state is `{ links, bind, policy }`; `pushBinding` (`:4822-4845`) propagates a value along outgoing links with a `seen` set so a cycle settles after one pass; `policyOf` defaults to `{ fanin: "last", onclose: "freeze" }` (`:4820`); `addLink` refuses direction and type mismatches with a logged reason (`:4890-4905`); `bidiLink` is simply the pair of links (`:4925`).
- The UI has a **port rail** on each tile, a **back side** listing links with fan-in (`first`/`last`-writer) and on-close (`freeze`/`clear`) toggles (`:2038-2065`), a **connect modal** (`ConnectModal`, `:2075`), and wires.

The report's verdict (§3.3) and this design's position: keep the asymmetric directed model, the typed ports with one-line docs, the named adapters, the visible back side and per-port policy; replace "bidirectional = two arrows" with a real identity operator, replace last-writer fan-in as the *default* with `single-producer`, and keep adapters as *declared relations with ids* rather than anonymous functions.

### 3.4 P06: the identity compiler

`source_materials/p06-extracted/` is a self-contained TypeScript artifact (reference and optimized compilers, tests, benchmarks, a browser lab). Its contract shape (`src/types.ts`) is the origin of the report's `PortContract`:

```text
PortContractSpec = { contractId, semanticTag, payloadSort, mode, authorityDomain, multiplicity, updateAlgebra, lifetime }
IDENTITY_FIELDS  = [semanticTag, payloadSort, mode, authorityDomain, multiplicity, updateAlgebra, lifetime]   (contracts.ts)
```

`checkIdentityCompatibility` returns the list of mismatched fields, not a boolean; `compileIdentityPlan` partitions ports by contract fiber, unions along identity links, canonically sorts the classes, assigns *persistent* class ids independent of union-find roots, and emits lineage (`new | unchanged | expanded | contracted | merged | split`). This design does not vendor P06; Phase 5 re-implements the small subset pbui needs (compatibility check, union-find per fiber, persistent ids, merge/split policies) and cites P06 for the reference semantics and counterexamples.

### 3.5 What to keep, what to change, what to drop

| Piece | Source | Verdict for pbui |
|---|---|---|
| Binding algebra, three operators, pin-as-suspension, unlink-as-policy | report §6–7, toy `core.js` | **Keep verbatim** as the kernel's term type and laws |
| Explained routing with tuple ranking and fresh revalidation | report §8.9–8.10 | **Keep**; implement as a sibling of `resolveActions`, reuse `evaluateFresh` shape |
| Strict identity compatibility on normalized contracts | P06, report §7.7 | **Keep** for value ports (Phase 5); document-slot identity is already exact by construction |
| Typed directional ports with one-line docs; named adapters; per-port policies on a visible back side | agent-workbench jsx | **Keep the shape**; adapters become `PresentationTranslator`s (they already have ids, scopes, priorities) |
| `fanin: "last"` as default; bidirectional = two links | agent-workbench jsx | **Drop**; `single-producer` default, `≡` for identity |
| Drag-to-link as the *primary* instrument; drop-zones on every tile during drag; pie menu | toy patterns 1, 2, 4, 5 | **Demote** to connect mode (drag) and to the object menu (everything the pie offered); no drop-zones in normal mode |
| Relation command palette | toy pattern 6 | **Keep**, built on `LauncherShell` |
| Ambient attention following (hover) | toy pattern 8 | **Keep as a term**, but the *hover* instrument is a product choice per port (datalab's chart hover is a natural fit; a chat tile is not) |
| Anchored popover instead of centered modal | toy pattern 3 | **Keep the rule** (no centered routing modal); pbui's object menu and `LauncherShell` are the anchored surfaces |
| Wire as editable object; long-press Hold on a wire | toy patterns 7, 9 | **Keep inside connect mode only**; wires are `<link>` presentations with an object menu |
| Trace-only handlers, `render()` reopening modals | audit findings | **Never**; the workbench's plan/applyPlan and the audit's postcondition tests are the fence |
| Playwright real-interaction scenarios, fresh page per scenario | audit §5, §13 | **Keep** as the acceptance harness for connect mode and the badge |

## 4. Current-state architecture of pbui (the system the intern is joining)

This section is the map. Every subsection ends with the one fact about it that the link design depends on.

### 4.1 Package map

```text
pbui/                                  the monorepo (pnpm workspace + Go module)
├── src/                               @hyperslop-systems/pbui — the core library
│   ├── presentation/                  Presentation, ObjectMenu, accept mode, the kernels
│   │   ├── actions/                   PURE action-selection kernel (PBUI-ACTIONS-2)
│   │   ├── translators/               PURE typed accept translators
│   │   ├── context/                   shared ContextTarget matcher (actions + help)
│   │   ├── help/                      PURE contextual-help kernel (PBUI-HELP-001)
│   │   └── createPbui.tsx             the React runtime: Provider, Presentation, menus, accept
│   ├── chrome/                        TileFrame, useTileDrag (+ carry), LauncherShell, shortcuts
│   ├── components/                    atoms / molecules / organisms / layout
│   ├── surfaces.ts                    the Escape-surface stack
│   └── focus.ts                       focus return targets
├── proto/hyperslop/pbui/workbench/v1  the workbench document + mutation schema (protobuf)
├── packages/workbench-protocol/       generated TS + client applier/builders (mirrors pkg/workbench)
├── pkg/workbench/                     Go validator/applier for the same document
├── packages/pbui-workbench/           the tiled shell: store, verbs, Surface/Tile, launcher, rebalance
├── packages/pbui-chat/                chat layer: conversation apps, agent tools, accept tool
├── packages/pbui-sandbox/             agent-written programs in a sandbox; devtools tiles
├── packages/pbui-plotscript/          script tile beside plot tile (PBUI-PLOTSCRIPT-1)
├── packages/pbui-editor/              the JavaScript editor tile
└── packages/datalab-ui/               the datalab product UI (Redux; its own tile organism)
../plot/                               @hyperslop-systems/plot — grammar-of-graphics compiler + React host
../datalab/                            the datalab Go server
```

The dependency direction is strict: `pbui` core knows nothing of documents or tiles; `pbui-workbench` knows the document and the chrome; products know both and own their verbs, stores, and effects (`pbui/README.md:1-27`). The link kernel must respect the same split: pure terms and resolvers in core, document- and DOM-aware glue in the workbench.

### 4.2 Presentations, references, descriptors

A presentation reference is `{ type, value }` over a product-owned `Values` map (`pbui/src/presentation/types.ts:7-15`). A descriptor is **representation only** — `label`, `describe`, `tone` — since 0.8.0 (`types.ts:25-39`); action discovery lives in the kernel. `Presentation` renders a focusable element with `data-ptype`, opens the object menu on click/Enter/context-menu, performs the unique primary action if one exists, and **settles a pending accept request if the reference is acceptable** (`createPbui.tsx:723-745`).

**Fact for linking:** ports, links, contexts, and placement zones can be ordinary presentation types (`"port"`, `"link"`, `"context"`, `"tile-slot"`). They then get an object menu, accept-ability, help, and agent description for free. The report's §3.1 observation ("ports, links, contexts, and even placement zones can themselves be presentations") is directly realizable.

### 4.3 The action kernel

`pbui/src/presentation/actions/types.ts` defines the contracts:

- `ActionQuery { subject, invocation: "menu" | "primary" | "agent" | "introspection" | "accept", gesture? }` (`:26-36`).
- `SelectionSnapshot<ProductFacts> { revision, scopes (inner→outer), modes, capabilities, product }` — immutable facts; the resolver never reads live stores (`:40-57`). The product supplies `snapshotFor(query, environment)` (`createPbui.tsx:76-79`).
- Contributions: `ExactActionRule` (`:116-137`), `InheritedActionRule` (match subtypes, `:139-156`), `ActionFamily` with `expand()` returning bounded instances whose order carries no meaning (`:172-188`).
- Availability: `available | unavailable(because) | inapplicable | hidden` (`availability.ts`); `unavailable` stays visible and explains itself, `inapplicable` leaves, `hidden` suppresses generic fallbacks.
- Results: `ResolvedAction` with `status`, an optional `verb`, `snapshotRevision`, `registryVersion`, and `provenance { declaredType, concreteType, typeDistance, scope, scopeIndex, priority }` (`:197-227`); `SelectionAmbiguity` with `because: "equal-specificity" | "incomparable-types" | "equal-scope" | "equal-priority"` (`:250-254`); a `ResolutionTraceEntry` per candidate per stage (`:256-274`).
- `createActionRegistry({ graph, scopes, contributions })` is fail-fast on duplicate ids, unknown types/scopes/predicates, and guaranteed collisions (`registry.ts:15-27`); `resolve`, `explain`, `listReachable`, `diagnostics`, and an agent-facing `vocabulary`.
- Fresh revalidation: `evaluateFresh(stale, fresh)` refuses when the action became ambiguous, no longer resolves, changed implementation (different `candidateId`), or became unavailable (`perform.ts`).
- The type graph is nominal with declared parents; datalab declares abstract types `inspectable` and `watchable` and makes concrete types their children (`packages/datalab-ui/src/pbui/actions.ts:340-353`).
- Shared packages contribute rules the product spreads into its own registry: `workbenchTileContributions()` (`packages/pbui-workbench/src/actions.ts:65-182`) adds split, replace, duplicate, rename, "Shown in N tiles", close for subject `"tile"`, with a `project` option for products whose tile value is not a `TileRef`.

**Facts for linking:** (1) the link kernel copies these shapes — a query, an immutable snapshot with revision and scopes, candidates with status and provenance, ambiguity as data, a trace, `evaluateFresh`-style revalidation; (2) `workbenchLinkContributions()` will be the way port/link menus reach products; (3) an `ActionFamily` is the right vehicle for "Link to… ⟨each compatible port on screen⟩"; (4) `invocation: "accept"` already exists as a query kind, so "acceptable as a link target" can be resolved through the same snapshot.

### 4.4 Accept mode and translators

`PbuiContextValue` exposes `accepting`, `accept(request): Promise<reference | null>`, `abortAccept()`, `isAcceptable(reference)`, `satisfyAccept(reference)`, `acceptChooser`, `chooseAcceptance`, `dismissAcceptChooser` (`createPbui.tsx:279-297`). An `AcceptRequest` is `{ types, prompt, filter? }` (`types.ts:48-52`). While a request is pending the status bar reads `ACCEPT MODE … (Esc aborts)` (`createPbui.tsx:1025-1029`) and every acceptable presentation carries `data-state="acceptable"` (`:814`).

`resolveAcceptance` (`translators/resolve.ts`) is used for highlighting **and** for clicking so they cannot disagree. Sequence: direct satisfaction (equal type or graph subtype, original reference preserved) → declared translator edges filtered by source match, scope, condition → the request's filter → zero/one/many → `none | accepted | ambiguous` with ties reduced by nearest scope then priority. A `PresentationTranslator` is `{ id, from, to, match, scopes?, when?, priority?, translate(reference, snapshot) }` (`translators/types.ts:28-42`); direct edges only, no chaining.

The chat layer already drives accept mode from an agent: `pbui_accept` (`packages/pbui-chat/src/tools/acceptTool.tsx`) enters accept mode with `{ types, prompt }` and returns the picked wire reference or `{ cancelled: true }`.

**Facts for linking:** (1) "point at a port" is `pbui.accept({ types: ["port"], prompt, filter: compatibleWith(source) })` — no new modal; (2) translators are the **direct relation registry** the report asks for in Phase 5 (§14.7): they have stable ids, typed endpoints, scopes, conditions, priorities, and an ambiguity chooser; `Derived(b, ρ)` can name a translator id; (3) the report's rule "if several relations are legal, the drop opens a chooser rather than guessing" is exactly `acceptChooser`.

### 4.5 Escape surfaces and transient modes

`pbui/src/surfaces.ts` keeps a module-level stack of transient surfaces; each asks "am I on top?" before acting on Escape. `Dialog` registers itself; `LauncherShell` deliberately registers nothing because `Dialog` already did (`chrome/LauncherShell.tsx:11-16`). The object menu uses `useEscapeSurface(menu !== null)` (`createPbui.tsx:891`).

**Fact for linking:** connect mode, the relation palette, and a pending "link to" accept request are all Escape-owned surfaces and must register exactly once each. The report's accessibility rule "link mode is an explicit Escape-owned surface, not an ad hoc document listener" (§6.7) maps onto this stack.

### 4.6 The workbench document

`workbench.proto` (`pbui/proto/hyperslop/pbui/workbench/v1/workbench.proto`):

```text
WorkbenchDocument { format, schema_version, id, name,
                    repeated Workspace workspaces,          // each: id, name, Node tree
                    map<string, AppView> views,             // logical views
                    repeated string view_order,
                    map<string, DocumentPayload> documents } // shared payloads
Node   { id, oneof body { Leaf { view_id } | Split { direction, ratio, a, b } } }
AppView { id, app_id, map<string,string> documents, optional title }   // slot → document id
DocumentPayload { id, format, schema_version, google.protobuf.Struct body }
Mutation = oneof { workbench_rename | workspace_create | workspace_rename | workspace_delete
                 | document_put | document_delete | view_create | view_configure | view_clone
                 | view_delete | view_close | placement_replace | placement_split
                 | placement_close | split_resize | workspace_set_tree }
ViewConfigure { view_id, optional app_id, oneof title_change, optional DocumentBindings replace_documents }
```

Three properties matter:

1. **Views are separate from placements.** A `Leaf` names a `view_id`; one view may be placed in several leaves, across workspaces (`contracts/workbench/v1/valid/linked-view.json` places `view-chart` in two workspaces). Applications receive `{ placementId, view }` and "two placements of one view receive the same `view`, which is what keeps linked tiles in lockstep" (`apps.ts:4-12`).
2. **Views bind to documents through named slots.** `AppView.documents` maps a slot name (`"primary"`, `"plot"`, `"conversation"`, `"program"`) to a `DocumentPayload` id. `AppDescriptor.docBound` and `AppDescriptor.bindings: string[]` declare that an app is a view *of* something and which slots it needs (`apps.ts:36-51`); `describeWorkbench` reports them so an agent knows what to bind; the Go validator enforces `required_binding` and `unknown_binding` against `ApplicationDescriptor.DocumentBindings` (`pkg/workbench/model.go:28-38`, `validate.go`).
3. **Arbitrary payloads ride in the document.** The rebalance config (`pbui.rebalance-config`) and plot scripts (`pbui.plotscript`, `packages/pbui-plotscript/src/document.ts:14-24`) are `DocumentPayload`s with their own `format`/`schema_version`, written by `documentPut`, so "it serialises, restores and syncs wherever the document does, and there is no second persistence mechanism to keep in step".

**Facts for linking:** (1) `view.documents[slot] = id` **is** `Constant(documentRef)` for a port named `slot`, and two views with the same id **are** an identity class at document granularity; the design keeps this and layers value ports beside it (Decision D2); (2) link declarations belong in a `pbui.links` `DocumentPayload` (Decision D3); (3) view ids, not placement ids, are the stable identity for ports, because linked placements must share bindings.

### 4.7 The verb layer

`WorkbenchVerb` (`verbs.ts:95-120`) is a serializable union: tile split/close/swap/dock/replaceWith/activate, split.resize, app.place/placeAt, view.setTitle, **`view.open { appId, documents, near?, title? }`**, **`tile.replace { placementId, appId, documents? }`**, **`tile.link { placementId, viewId }`**, **`view.rebind { viewId, documents }`**, workspace select/create/setTree/rename/delete/clone, view.goTo, launcher open/close, rebalance open/close. `isWorkbenchVerb` validates the full shape; `describeWorkbenchVerb` narrates one for logs and agents.

The handlers (`createVerbHandlers`, `verbs.ts:537-1150`) turn verbs into protocol mutations and `store.mutate` them atomically:

- `openView` de-duplicates: an app already showing identical bindings is gone to, even across workspaces (`:830-846`); otherwise a view is minted with the requested or default bindings and split beside the target (`:848-864`).
- `replace` retargets a view in place when the pane owns it and mints a new view when the view is linked elsewhere, "because retargeting would silently change the twin as well" (`:888-935`).
- `link` points a placement at an existing view and deletes the now-unplaced old view in the same batch (`:936-955`).
- `rebind` replaces a view's document bindings wholesale (`:958-961`).
- `BindingConfig { source, defaultDocumentId?, isBindable?, unbound? }` is the policy for what a freshly placed tile binds — "follow the crowd first" (`:516-525`, `:549-568`). `SplitPolicy` is `"duplicate" | "link" | { app } | fn` (`:505-509`); `CrossWorkspace` is `"switch" | "link"` (`:87`).

`Workbench.plan(verbs)` preflights a sequence against a shadow store and `applyPlan` commits one atomic batch (`types.ts:103-129`); `WorkbenchState` holds browser-local facts (`activePlacementId`, `launcherOpen`, `launcherFrom`, `rebalanceOpen`) that are never serialized (`store.ts:11-31`).

**Facts for linking:** (1) link verbs join the union so `isWorkbenchVerb`, `describeWorkbenchVerb`, `plan`/`applyPlan`, undo, and `workbench_perform` need no second path; (2) `linkModeOpen` is browser-local state beside `rebalanceOpen`; (3) `openView`'s de-dup and `placeAt` are the spawn primitives the target resolver will call; (4) the on-close lifecycle hooks into `close`/`viewDelete` where the old view is removed.

### 4.8 The chrome: TileFrame, drag, carry, launcher

- `TileFrame` (`pbui/src/chrome/TileFrame.tsx:17-40`) is document-model-agnostic: tone bar, ⠿ grip, a `title` slot, split/close buttons, and a labeled drop-zone overlay that names the outcome before release. The product's `renderTitle(view, placement)` wraps its `<tile>` presentation in the slot (`pbui-workbench/src/types.ts:22-34`), so the object menu and the chrome buttons are "two doors to the same verbs".
- `useTileDrag` (`chrome/useTileDrag.ts`) keeps a module-level registry of tile elements, hit-tests on every pointer move, classifies banded zones (`zoneFor`, 30 % of the smaller dimension capped at 110 px), and has exactly one exit (`finish`) so a drag never survives its release.
- `startTileCarry` (placement mode, PBUI-REBALANCE-1) aims something *not yet on screen* at the tiles: pointerdown is intercepted in the **capture phase** so the click never reaches the application, Alt switches to replace, Escape/blur/outside-click cancel, Enter commits to a default (`useTileDrag.ts:~110-200`). `Tile` re-words its overlay labels while `drag.carrying` (`Tile.tsx:56-60`).
- `LauncherShell` (`chrome/LauncherShell.tsx`) is the grouped-rows searchable modal with a status line naming where a choice will land; the rows *model* stays in the product (`launcherRows.ts:16-18`: `view` rows for what is on screen, `app` rows for what could be).

**Facts for linking:** (1) connect mode's port-to-port drag reuses the carry lifecycle (capture-phase pointerdown, single exit, Escape) over a **port registry** rather than the tile registry; (2) the "show" chooser and the relation palette are `LauncherShell` instances with link-specific rows; (3) the badge lives in the `title` slot next to the linked `×N` marker (`Tile.tsx:50-62`).

### 4.9 How products coordinate tiles today

| Product | Mechanism | Report term | Evidence |
|---|---|---|---|
| datalab-ui | every doc-bound tile reads `view.documents.primary`; `DocBar` dropdown re-points a view (`layoutActions.setViewDocument`) | `Constant(doc)` per port, edited by a per-tile picker | `apps/ChartApp/ChartApp.tsx:10`, `components/molecules/DocBar/DocBar.tsx`, `store/layout.ts:730-740` |
| datalab-ui | `world.activeDocId` is what an unbound tile shows (`shown = docId ?? activeDocId`) | `Ambient("workspace.doc")` fallback | `store/world.ts:67`, `DocBar.tsx:24` |
| datalab-ui | `world.inspected` written by the `inspect` verb every descriptor offers; the singleton Inspector tile reads it | an `<any>` input port fed by an `Ambient("inspected")` cell | `store/world.ts:73,445`, `apps/InspectorApp/InspectorApp.tsx`, `store/applyVerb.ts:73-86` |
| datalab-ui | abstract types `inspectable`/`watchable` in the type graph; `object.inspect` and `watch` rules inherited by concrete types | a family of "send to ⟨port⟩" actions by type reachability | `pbui/actions.ts:340-353, 514-521` |
| pbui-chat | a `chat` tile is a view OF a conversation document; two bindings are two agents, two placements of one view are one agent seen twice | `Constant(conversation)` + linked view | `apps/createChatApps.tsx:38-58` |
| pbui-plotscript | `script` and `plot` are two apps both doc-bound to slot `plot`; the script tile writes the script with `documentPut`, the plot tile re-runs it | identity class at document granularity; the script *is* the derived relation's input | `src/apps.tsx`, `src/host.ts:38`, `ScriptTile.tsx:54`, `PlotTile.tsx:31` |
| pbui-sandbox | program state keyed by **view id** so two linked placements show one state | the runtime cell keyed by view, not placement | `src/state.ts:3-9` |
| plot (React host) | `ResponsivePlot` emits `PlotEvent`s: `activate`, `hover`, `focus`, `brush`, `view-change` with a typed `InteractionTargetRecord` (datum ids, semantic values, device bounds) | an **out port** waiting to be declared: `datum`, `selection`, `panel` | `../plot/src/interactions.ts:76-84`, `react/ResponsivePlot.tsx:29-30` |

**Inferred:** every product has re-invented one or two binding terms with a private global. The link design generalizes them without forcing migration: datalab's `activeDocId` becomes a named context that its tiles declare as fallback; `world.inspected` becomes the Inspector's `subject` input port fed by an `inspect` verb that *emits* rather than writes a global; the plot's `PlotEvent`s become out ports of any tile that hosts a plot.

### 4.10 The agent path

`packages/pbui-chat/src/tools/workbenchTools.ts` defines `workbench_describe` (read the screen), `workbench_create_workspace`, `workbench_open_tile`, `workbench_switch_workspace`, `workbench_perform` (any `WorkbenchVerb`, revalidated against an expected revision), and `workbench_apply` (raw mutations, off by default) (`:378-705`). `describeWorkbench` (`pbui-workbench/src/describe.ts`) narrates apps, their `bindings`, views, and placements.

**Fact for linking:** if ports and links are part of `describeWorkbench` and link verbs are `WorkbenchVerb`s, an agent can say "link the detail to the east table" with no new tool.

### 4.11 The Go side

`pkg/workbench` validates and applies the same document with no storage or HTTP; hosts supply an `ApplicationCatalog` (id, singleton, `DocumentBindings` with `Required`) and a `DocumentValidator` per payload format (`model.go:28-54`). Limits bound documents (128 payloads, 8 bindings per view, 512 KiB per payload; `model.go:70-82`). Error codes include `required_binding`, `unknown_binding`, `duplicate_singleton`, `unknown_document`, `invalid_document`.

**Fact for linking:** a `pbui.links` payload is validated like any other format; a host that wants server-side link validation registers a validator for it (Phase 7). Nothing in the Go side must change for Phases 1–6.

## 5. Gap analysis: the binding algebra against pbui

| Report concept | What pbui has (observed) | Gap | Phase |
|---|---|---|---|
| Typed port with contract | `AppDescriptor.bindings: string[]` document slots; `docBound` flag; Go `DocumentBindings{Required}` | No ports over presentation values; no direction; no contract fields (role, cardinality, mode, authority, algebra, lifetime); no per-port documentation | 1 |
| `Constant(r)` | `view.documents[slot] = documentId` | Only for documents; no constant binding of a presentation reference (e.g. "this detail is fixed on order #1042") | 2 |
| `Ambient(k)` | product globals (`activeDocId`, `inspected`) | No declared context cells, no fallback declaration on ports, no badge saying "ambient" | 2 |
| `Follow(p)` | nothing | No directed edges, no propagation, no provenance | 2 |
| `Hold(r, b)` | nothing | No pin/resume/detach | 2 |
| `Alias(c)` | shared document id across views (exact by construction); linked views | No identity classes over value ports; no contract compatibility check; no merge/split policy | 5 |
| `Derived(b, ρ)` | `PresentationTranslator` registry with ids, endpoints, scopes, priority, ambiguity chooser (used only by accept) | Translators are not usable as *standing* bindings; no cardinality field; no relation palette | 6 |
| `Unresolved(d)` | `EmptyState` per app when a slot is missing (`PlotTile.tsx:40-41`) | No uniform diagnostic state or badge | 2 |
| Effective evaluation, cycle check, fan-in policy | nothing | Kernel absent | 2 |
| Target/placement resolver | `openView` de-dup; launcher rows; `placeAt` carry | No candidate set over existing ports + spawnable placements; no ranking; no ambiguity; "show" is app-specific | 4 |
| Serializable topology verbs | `WorkbenchVerb` union; `plan`/`applyPlan`; `workbench_perform` | No `link.*` verbs | 2 |
| Persistence of declarations | `DocumentPayload` formats (`pbui.rebalance-config`, `pbui.plotscript`) | No `pbui.links` format | 2 |
| Header badge | `×N` linked marker in `Tile.tsx` | No binding state badge; no `<port>` presentation | 2 |
| Object/port menus | action kernel; `workbenchTileContributions()` | No `<port>`/`<link>` types; no "Link to…" family; no pin/resume/unlink rules | 2 |
| Link mode | accept mode (typed highlighting + chooser) | No compatibility highlighting of *ports*; no connect-management mode | 2 (accept), 3 (mode) |
| Wires and overlay | nothing | No SVG layer, no port geometry registry | 3 |
| Coordination inspector | `describeWorkbench` (apps, views, placements) | No ports/links/contexts in the description; no inspector tile | 7 |
| Notifications / attribution | trace panels in products | No "Detail → #1042 · from Orders East" coalesced message | 7 |
| Undo/history | `plan`/`applyPlan` batches | Link mutations are `documentPut` batches, so undo of a batch is available where the product has undo; identity merge/split need history in the payload | 5 |
| Source-close policy | `close` deletes an unplaced view (`verbs.ts:947-951`) | No `freeze/clear/ambient/reroute` on followers of a closed source | 2 |
| Agent vocabulary | `vocabularyOf(registry)`; `describeWorkbench` | Ports/links absent from both | 7 |

Two structural observations follow from the table:

1. **The document-granularity case is already solved** and must not be re-solved. Slots, `docBound`, `openView` de-dup, linked views, and server validation give `Constant(doc)` and document-level `Alias` today. The value-port layer sits *beside* it, and a port whose name equals a document slot reads its constant from `view.documents` (Decision D2).
2. **The kernel is the missing centre.** Almost every UI gap (badge, menus, link mode, wires, chooser) is a projection of state that does not exist yet. Phase 2 therefore builds the kernel, the document payload, and the runtime *before* any wire is drawn — exactly the audit's ordering (define the transition, then project every visible facet, then bind an instrument).

## 6. Design

### 6.1 Principles

1. **Sibling kernels, shared vocabulary** (report §14.10). `pbui/src/presentation/links/` is pure and React-free like `actions/`. It imports the type graph, scopes, `Availability`, id helpers, and snapshot conventions from `actions/`; it never adds graph search to the action resolver and never puts topology into action conditions.
2. **One semantic core, many instruments** (toy invariant #3, audit §3). Badge menu, "Link to…" family, accept mode, connect-mode drag, wire menus, palette, and agent tools all emit the same `LinkVerb`s. No instrument mutates state directly.
3. **Declarations are data in the document; values are runtime.** Topology (which port follows what, which ports share a class, which contexts exist, which port is held on which serialized reference) is a `pbui.links` payload. Live values (what an out port last emitted, what a context cell holds) live in a store keyed by view id and are not persisted.
4. **Visible postconditions define correctness** (audit §15). Every verb has a test that asserts the badge text, the tile content, or the tile count — never only a trace or a store field.
5. **Unobtrusive by default.** Outside connect mode the only new pixels are one small badge per bound port in the tile header and a few menu rows. No drop zones appear during ordinary drags; no wires are drawn.
6. **Ports are presentations.** `<port>`, `<link>`, `<context>`, and `<tile-slot>` are presentation types with descriptors and kernel rules, so they get menus, accept-ability, help, and description without bespoke UI.
7. **Registration order never decides** (report invariant). Candidate ranking is a declared tuple; ties are ambiguity and open a chooser.

### 6.2 Ports and contracts

An application declares ports beside its document slots:

```ts
// pbui/src/presentation/links/types.ts
export type PortDirection = "in" | "out" | "inout";
export type PortCardinality = "one" | "optional" | "many";
export type PortMode = "read" | "write" | "read-write" | "event-source" | "event-sink";
export type PortLifetime = "tile" | "workspace" | "persistent";
export type FanInPolicy = "single-producer" | "active-source" | "last-event";
export type SourceClosePolicy = "freeze" | "clear" | "ambient" | "reroute" | "prompt";

export interface PortContract {
  /** A runtime type id in the product's presentation type graph. */
  readonly valueType: RuntimeTypeId;
  /** The semantic role, e.g. "order.current", "selection", "subject". Identity requires equality. */
  readonly semanticRole: string;
  readonly cardinality: PortCardinality;          // default "one"
  readonly mode: PortMode;                        // default "read" for in, "write" for out
  readonly authorityDomain: string;               // default "workspace"
  readonly updateAlgebra: "replace" | (string & {}); // default "replace"
  readonly lifetime: PortLifetime;                // default "workspace"
}

export interface PortDeclaration {
  readonly name: string;                          // unique within the app
  readonly direction: PortDirection;
  readonly contract: PortContract;
  /** One line, shown in the badge menu, the connect-mode rail, and describeWorkbench. */
  readonly doc: string;
  /** Ambient fallback for an unbound INPUT: a context key. Absent ⇒ Unresolved("unbound"). */
  readonly fallbackContext?: string;
  readonly fanIn?: FanInPolicy;                   // default "single-producer"
  readonly onSourceClose?: SourceClosePolicy;     // default "freeze"
  /**
   * Set when this port IS a document slot (the app also lists it in `bindings`).
   * The port's Constant term is then read from `view.documents[name]`, never from
   * the link document. See Decision D2.
   */
  readonly documentSlot?: true;
}
```

`AppDescriptor` (`pbui-workbench/src/apps.ts`) gains one optional field:

```ts
export interface AppDescriptor {
  // …existing fields, MINUS `bindings` and `docBound` (D10): both are derived from ports…
  /** Typed ports (PBUI-LINK-1). Absent ⇒ the application takes part in no linking. */
  ports?: readonly PortDeclaration[];
}
// derived:  docBound(app) = app.ports?.some(p => p.documentSlot) ?? false
//           bindings(app) = app.ports?.filter(p => p.documentSlot).map(p => p.name) ?? []
```

A port is addressed by `PortId = \`${viewId}/${name}\`` — view id, not placement id, because linked placements share bindings (`apps.ts:4-12`, `pbui-sandbox/src/state.ts:3-9`). `defineApp` normalizes defaults so readers never branch on `undefined`, exactly as it does for `duplicable`/`docBound` today (`apps.ts:87-94`).

Contract normalization for identity (Phase 5) hashes the seven fields in a fixed order, as P06's `IDENTITY_FIELDS` does; `valueType` compares by nominal id, not by subtype.

### 6.3 Binding terms

```ts
// pbui/src/presentation/links/terms.ts
export type SerializableReference = { type: RuntimeTypeId; id: string; value?: Record<string, unknown> };

export type Binding =
  | { kind: "ambient"; key: string }
  | { kind: "constant"; reference: SerializableReference }
  | { kind: "follow"; source: PortId; linkId: string }
  | { kind: "alias"; classId: string }
  | { kind: "derived"; source: Binding; relationId: TranslatorId; linkId: string }
  | { kind: "hold"; reference: SerializableReference; suspended: Binding }
  | { kind: "unresolved"; diagnostic: { code: string; message: string } };
```

Two constraints follow from persisting terms in the document:

- A **constant or held reference must be serializable**. pbui-chat already spells a wire reference as `{ type, id, value?, provenance? }` (`packages/pbui-chat/src/types.ts:23-69`); the link document uses the same shape. A product whose presentation values are not serializable (a datalab `DatumRef` carrying a whole row) supplies a codec on its port contract (`toWire`/`fromWire`) or declines `Hold`/`Constant` for that port (`holdable: false`). This is Decision D4.
- `Follow` and `Derived` carry a `linkId` so a wire is addressable (menus, unlink, trace) independently of its endpoints.

Laws the kernel enforces (report §7.9, toy `pinToggle`/`unlink`):

```text
pin(port)      : b ↦ Hold(⟦b⟧, b)         requires ⟦b⟧ unique; refuses on Unresolved
resume(port)   : Hold(r, b) ↦ b            catches up to the current ⟦b⟧
detach(port)   : Hold(r, b) ↦ Constant(r)  provenance dropped on purpose
unlink(linkId, policy) — Follow/Derived: apply the port's onSourceClose or the explicit policy
                       — identity link: recompile classes, initialise split fragments by policy
```

### 6.4 The link document and the runtime

**Declarations** (persisted, `DocumentPayload` with `format: "pbui.links"`, `schemaVersion: 1`, id `pbui.links` by convention, one per workbench document):

```ts
interface LinksPayload {
  /** Explicit terms per port. Absent port ⇒ effective binding is the declared fallback. */
  bindings: Record<PortId, Binding>;
  /** Named contexts: typed cells a port may read as Ambient(key) or drive. */
  contexts: Record<string, { valueType: RuntimeTypeId; scope: "workspace" | "document"; doc: string; drivenBy?: PortId }>;
  /** Identity declarations (Phase 5). Retained, never derived from classes. */
  identity: Array<{ linkId: string; left: PortId; right: PortId; mergePolicy: "prefer-left" | "prefer-right" | "require-equal" }>;
  /** Persistent class ids and lineage (Phase 5), so undo restores exact cells. */
  classes?: Record<string, { members: PortId[]; fingerprint: string }>;
  /** Pre-merge private values for the "history" split policy (Phase 5). */
  history?: Record<PortId, SerializableReference>;
}
```

Reading and writing it follows `rebalance/configDocument.ts` and `pbui-plotscript/src/document.ts`: a `readLinks(doc)` that returns an empty payload for a missing or foreign-format document, and a `linksMutation(payload)` that returns one idempotent `documentPut`.

**Runtime** (not persisted; `pbui-workbench/src/links/runtime.ts`):

```ts
interface LinkRuntime {
  /** What each OUT/INOUT port last emitted, with a revision. */
  emitted: Map<PortId, { reference: PresentationReference; revision: number }>;
  /** Context cells. */
  contexts: Map<string, { reference: PresentationReference | null; revision: number }>;
  /** Class cells (Phase 5). */
  classes: Map<string, { reference: PresentationReference | null; revision: number }>;
  /** Attention (toy pattern 8): the last value PRESENTED as attended per port, for Pin. */
  attended: Map<PortId, PresentationReference>;
  revision: number;
  emit(port: PortId, reference: PresentationReference): void;
  setContext(key: string, reference: PresentationReference | null): void;
  subscribe(listener: () => void): () => void;
}
```

It is a `useSyncExternalStore` store like `createWorkbenchStore` and `createProgramStateStore`; `getState` returns a cached snapshot. `emit` bumps `revision`, so every consumer hook re-evaluates lazily. Values are *pull-evaluated* on read (Decision D5), with a per-revision memo keyed by `PortId` so a fan-out of ten tiles evaluates a chain once.

### 6.5 The link kernel API (pure)

```ts
// pbui/src/presentation/links/index.ts — no React, no stores, no effects
export interface LinkSnapshot<ProductFacts> extends SelectionSnapshot<ProductFacts> {
  readonly documentRevision: string | number;   // workbench document
  readonly runtimeRevision: number;             // LinkRuntime
  readonly ports: ReadonlyMap<PortId, PortDefinition>;       // declared ports of PLACED views
  readonly bindings: ReadonlyMap<PortId, Binding>;           // from the links payload
  readonly documentSlots: ReadonlyMap<PortId, SerializableReference>; // view.documents projected as Constants
  readonly contexts: ReadonlyMap<string, ContextDefinition>;
  readonly classes: ReadonlyMap<string, ClassDefinition>;
  readonly values: {                                          // runtime reads
    emitted(port: PortId): PresentationReference | undefined;
    context(key: string): PresentationReference | null | undefined;
    classCell(id: string): PresentationReference | null | undefined;
  };
  readonly placements: readonly PlacementCandidate[];         // "split right of X", "empty slot"…
}

export type Evaluation =
  | { kind: "value"; reference: PresentationReference; provenance: Binding; path: PortId[] }
  | { kind: "empty"; provenance: Binding }
  | { kind: "error"; diagnostic: { code: string; message: string }; path: PortId[] };

export function effectiveBinding(port: PortId, s: LinkSnapshot<any>): Binding;
export function evaluatePort(port: PortId, s: LinkSnapshot<any>, deps: { graph; translators; predicates }): Evaluation;

export type LinkPlan =
  | { kind: "available"; verb: LinkVerb; explanation: string }
  | { kind: "unavailable"; because: string; code: string; alternatives?: LinkVerb[] }
  | { kind: "ambiguous"; options: Array<{ verb: LinkVerb; label: string }> };

export function planFollow(source: PortId, destination: PortId, s, deps): LinkPlan;   // §8.2 of the report
export function planDerive(source: PortId, destination: PortId, s, deps): LinkPlan;   // lists legal translators
export function checkIdentityCompatibility(a: PortId, b: PortId, s): { ok: true; fingerprint: string } | { ok: false; mismatches: Array<{ field; left; right }> };
export function planPin(port: PortId, s, deps): LinkPlan;
export function planResume(port: PortId, s): LinkPlan;
export function planDetach(port: PortId, s, deps): LinkPlan;
export function planUnlink(linkId: string, policy: SplitPolicy | SourceClosePolicy, s): LinkPlan;

export interface ShowQuery { subject: PresentationReference; role?: string; disposition?: "follow" | "hold" | "ambient"; from?: PortId }
export interface ShowCandidate { candidateId: string; kind: "existing-port" | "context" | "spawn"; target: PortId | string | PlacementCandidate;
  status: Availability; rank: [number, number, number, number, number, number]; verb?: LinkVerb | WorkbenchVerb[]; explanation: string }
export function resolveShow(query: ShowQuery, s, deps): { candidates: ShowCandidate[]; ambiguities: Array<{ candidates: string[]; because: string }>; trace: LinkTraceEntry[]; snapshotRevision };
export function evaluateFreshLink(stale: ShowCandidate, fresh: ReturnType<typeof resolveShow>): FreshDecision;  // same shape as actions/perform.ts
```

`resolveShow` ranks by `(typeDistance, roleDistance, dispositionDistance, scopeIndex, sourceAffinity, -priority)` (report §7.10). `typeDistance` is the graph distance from the subject's concrete type to the port's `valueType` (0 exact, n for n subtype steps, +100 through a translator). `roleDistance` is 0 when `query.role === contract.semanticRole`, 1 otherwise. `dispositionDistance` is 0 when the port's current term already matches the requested disposition (a follower for "follow", a held port for "hold"), 1 for a free port, and **inapplicable** for a held port under a generic route (report §10.5: "pinned targets are normally inapplicable to a generic route rather than merely lower priority"). `scopeIndex` prefers the current workspace. `sourceAffinity` prefers a port already following the same source tile.

### 6.6 Verbs

Added to the `WorkbenchVerb` union (`verbs.ts:95-120`) so validation, description, planning, and the agent tools work unchanged:

```ts
| { kind: "port.follow";  source: PortId; destination: PortId; linkId?: string }
| { kind: "port.bind";    port: PortId; reference: SerializableReference }        // Constant
| { kind: "port.ambient"; port: PortId; context: string }
| { kind: "port.derive";  source: PortId; destination: PortId; relation: TranslatorId; linkId?: string }
| { kind: "port.pin";     port: PortId }      // handler evaluates and stores Hold(current, suspended)
| { kind: "port.resume";  port: PortId }
| { kind: "port.detach";  port: PortId }
| { kind: "port.unlink";  linkId: string; policy: "freeze" | "clear" | "ambient" | "copy" | "history" | "reset" }
| { kind: "port.clear";   port: PortId }      // back to declared fallback
| { kind: "context.create"; key: string; valueType: RuntimeTypeId; doc: string }
| { kind: "context.drive";  context: string; source: PortId }
| { kind: "identity.add";    left: PortId; right: PortId; mergePolicy: MergePolicy; linkId?: string }   // Phase 5
| { kind: "identity.remove"; linkId: string; splitPolicy: "copy" | "history" | "reset" }                // Phase 5
| { kind: "link.mode.open" } | { kind: "link.mode.close" }
| { kind: "show"; subject: SerializableReference; role?: string; disposition?: "follow" | "hold" | "ambient"; candidateId?: string }
```

Handlers (`pbui-workbench/src/links/verbs.ts`) read the current links payload, call the kernel's `plan*` for the refusal logic, and on `available` write one `documentPut` (plus, for `show` → spawn, the `viewCreate`/`placementSplit` mutations `openView` already builds). A refused plan returns `false` from `perform` and reports through `onRejected`, as every other verb does. `plan(verbs)`/`applyPlan` therefore preflight link changes atomically with layout changes: "spawn a detail to the right **and** make it follow Orders East" is one batch.

### 6.7 Reading and emitting ports from an application

Applications stay ignorant of terms. Two hooks in `pbui-workbench/src/links/hooks.ts`:

```ts
/** The effective value of an INPUT port of this view; re-renders when it changes. */
function usePort<T>(view: AppView, name: string): { value: T | null; state: BadgeState; explanation: string };

/** Emit into an OUT/INOUT port; also records "attended" for Pin when `attended: true`. */
function useEmitPort(view: AppView, name: string): (reference: PresentationReference, options?: { attended?: boolean }) => void;
```

A detail tile then reads `const { value: order } = usePort<OrderRef>(view, "order")` instead of a Redux selector; an orders table calls `emit({ type: "order", value: row })` on row click and `emit(row, { attended: true })` on row hover if the product wants attention following. Where a product already owns the value in its own store (datalab's Redux), the product's verb router calls `runtime.emit` from its reducer effect instead — the hook is a convenience, not the only door.

### 6.8 Interaction surfaces

#### 6.8.1 Substrate: the binding badge

Every declared port of a placed view with a non-trivial effective binding renders a badge in the tile header, after the title and the `×N` marker, through a `renderBadges(view, placement)` slot on `TileFrame`/`Tile` (or inside the product's `renderTitle`). Badge states and glyphs follow report §10.1:

| State | Badge | Meaning |
|---|---|---|
| ambient | `○ order · workspace` | reading the declared fallback context |
| following | `→ Orders East` | `Follow` of a named source tile |
| shared | `≡ selection · σ2` | member of an identity class |
| derived | `author ← order.author` | `Derived` through a named relation |
| held | `⏸ #1042` | `Hold`; hover doc adds "resume Orders East (now #1060)" |
| fixed | `• #1042` | `Constant` |
| empty | `○ order · none` | fallback context is empty |
| unresolved | `⚠ order` | conflict, cycle, missing source, missing relation |

A badge **is** a `<port>` presentation: `Presentation reference={{ type: "port", value: PortRef }}` where `PortRef = { port: PortId, viewId, name, direction, contract, state, sourceLabel?, explanation }`. Clicking it opens the object menu; the rows come from `workbenchLinkContributions()` (rules for subject `"port"`): **Pin** / **Resume** / **Detach as fixed value** / **Follow a source…** (accept mode over `port` with `direction: out` and reachable type) / **Join a context…** / **Derive through…** (palette) / **Go to source** / **Unlink…** / **Inspect**. The unavailable ones stay visible with their reason (`unavailable("not held")`), matching the kernel's presentation rules. A port with the trivial term (unbound, no fallback) shows no badge; the port is still reachable from the tile menu ("Ports…") and from connect mode.

#### 6.8.2 The common case: "Link to…" from any presentation

`workbenchLinkContributions()` also exports an `ActionFamily` for the product's linkable subject types:

```ts
linkToFamily({ subjects: ["order", "datum", "doc", …] })  // match: "subtypes"
expand({ subject, snapshot }):
  targets = snapshot.product.links.ports.filter(p => p.direction !== "out" && reachable(subject.type, p.contract.valueType))
  if targets.length <= 6: one instance per target:
     key: `link-to:${port}`, label: `Link to ${tileTitle} · ${port.name}`, description: port.doc,
     bind: () => ({ kind: "show", subject: wire(subject), role: port.contract.semanticRole, candidateId: … })
  else: one instance "Link to…" that binds { kind: "link.mode.pick", subject } → the handler enters accept mode over `port`
```

The subject of the click is a **value**, so the family's verbs are `show` intents: "show this order in *that* detail, following the source it came from". The source port is inferred when the presentation was minted inside a tile with an out port of the same type (the product's `snapshotFor` records `from: PortId` in facts — the same pattern datalab uses to make every presentation carry its owning `docId`, `pbui/types.ts:26-39`). When no source port exists (a chip in a browser), the verb binds a `Constant`. Modifiers reported in `ActionQuery.gesture.modifiers` select the disposition: Shift → hold, as in the toy.

A tile-level entry point mirrors it from the other side: the `<tile>` menu gains **Follow…** (accept mode over `out` ports of a compatible type) and **Show ports** (opens connect mode focused on that tile).

#### 6.8.3 Connect-management mode

The verb `link.mode.open` (Mod+Shift+L, or "Connect…" in the tile/workspace menu, or the badge's "Show wiring") sets `WorkbenchState.linkModeOpen = true` (browser-local, beside `rebalanceOpen`). While it is on:

- **Every tile flips to its back side.** `Tile` renders a `PortRail` overlay above the application (`position:absolute; inset:0`) listing in ports on the left edge and out ports on the right, each a `<port>` presentation with name, type glyph, current badge state, and the one-line `doc`. The application beneath is inert: the overlay intercepts pointer events, as the carry does in the capture phase. Tiles without ports show a faint "no ports" plate so the mode reads uniformly.
- **A single `WireLayer` SVG** is mounted once by `WorkbenchSurface` (`data-part="workbench-wires"`), sized to the surface, `pointer-events: none` except on wire hit paths. Wires are computed from the DOM rectangles of registered port elements (a `PortRegistry` mirroring `TILES` in `useTileDrag.ts`) with the toy's cubic path (`core.js:256`), one style per term (solid arrow follow, labeled arrow derived, double segment alias, dotted for the suspended source under a hold, red broken for unresolved). Off-workspace sources render as a portal marker on the tile edge. Geometry is explanatory only; semantics never depend on position.
- **Port-to-port drag** starts on an out port (pointerdown captured by the rail), draws a rubber-band wire to the cursor, highlights compatible in ports exactly as accept mode does (`data-state="acceptable"` computed by `planFollow(...).kind !== "unavailable"`), shows a **badge under the cursor naming the term that will be committed** (`Follow(Orders East.order)` / `Hold(#1042, resume …)` with Shift), and on release over an in port performs `port.follow` (or `port.pin` after the follow when Shift was held at release; the modifier is read live, never only at drag start). Release anywhere else cancels. The lifecycle is the carry's: one `finish`, Escape/blur cancel, capture-phase listeners.
- **Wires are `<link>` presentations** with an object menu: **Change to Hold / Follow / Derived…**, **Reverse** (only when contracts permit), **Make identity ≡** (Phase 5; opens the merge-policy popover when the cells differ), **Unlink…** (opens the split/close-policy popover inline at the wire midpoint — never a centered modal), **Go to source / target**, **Inspect**. The hit path is a wide transparent stroke that is disabled while a drag is in flight (audit §10.3).
- **Escape** closes the mode through one registered escape surface; the wire layer and rails unmount; the application regains pointer events. Nothing about the mode is serialized.

Connect mode is where the toy's gesture surface lives in pbui; it is also the "coordination inspector, lite" until Phase 7 builds a dedicated tile.

#### 6.8.4 Routing: "Show details…" and the chooser

A product declares a `presentation.show` action per showable type (or reuses the `linkToFamily`). Its verb is `{ kind: "show", subject, role }`. The handler runs `resolveShow` on a fresh snapshot:

- **one available candidate** → perform it (an existing port: `port.follow`/`port.bind`; a context: `context.set`; a spawn: `openView` + follow in one plan);
- **zero** → `unavailable("no compatible target; open one from the launcher")` with the spawn candidates still listed;
- **many or ambiguous** → open a `LauncherShell` titled `SHOW <order #1042> AS order.detail` with two groups, **Existing targets** (rows per port with its current badge state and why it ranks where it does) and **New targets** (rows per placement candidate: "split right of Orders East", "split below", "empty slot"), a status line naming the term that will be installed, and Enter committing. Choosing a placement row uses `startTileCarry` so the user aims the new tile exactly as the launcher's placement mode does today.

The chooser is anchored and searchable; it replaces the toy's centered routing modal (anti-pattern table, PBUI-LINK-UI §8).

#### 6.8.5 Relation palette (Phase 6)

"Derive through…" opens a `LauncherShell` whose rows are the translators with `to ⪯ target.valueType` and `from` reachable from the source type, grouped by scope, filtered as you type by id and label; Enter performs `port.derive`. The audit's containment rule for click-away (`palette.contains(target)`) is already how `Dialog` behaves.

#### 6.8.6 Attention following (optional per port)

A product opts a port into hover attention by emitting with `{ attended: true }`. The runtime keeps `attended[port]` as the *last value presented as attended*; `port.pin` on a port whose effective term is `Ambient` freezes `attended` when present, else the ambient value (toy `pinToggle`, audit §10.1). Nothing in the kernel depends on `mouseleave` ordering.

#### 6.8.7 Accessibility

Every badge and rail port is a focusable `Presentation` with an accessible name of the form "Order binding, following Orders East, current order 1042". Connect mode is navigable by keyboard: Tab moves between ports, Enter on an out port starts a "pending link" that Tab/Enter completes on an in port (the same `startTileCarry` `onDefault` shape), Escape cancels. State is conveyed by text and `data-state`, never colour alone. A live region announces coordination changes coalesced per target ("Order Detail → #1042 · from Orders East"), which is also the notification text of report §10.7.

### 6.9 Lifecycle

- **Source tile closes** (`close` → `viewDelete` when unplaced): the handler prunes links whose source view vanished and applies each follower's `onSourceClose`: `freeze` → `Hold(last, Unresolved("source closed"))` so resume explains itself; `clear` → `Unresolved`; `ambient` → declared fallback; `reroute` → `resolveShow` for another source, ambiguity leaves the port unresolved with the candidates in the diagnostic; `prompt` → the port is marked unresolved and the badge menu offers the choices. Default is `freeze` for detail-like ports, matching the report's recommendation and the prototype's default.
- **Duplicate tile** (`view.duplicate`, `split` with `"duplicate"`): the minted view copies the source view's terms; a `Follow` is copied as-is (two followers), a `Hold` is copied, an `Alias` membership is copied (the twin joins the class) — the report's four duplication policies collapse to "copy the terms" plus an explicit "Fork pinned copy" action that copies and then pins.
- **Linked views** share terms by construction (terms key on view id).
- **Workspace clone** (`workspace.clone`): terms referring to views inside the cloned workspace are re-keyed to the new view ids; contexts marked `scope: "workspace"` are cloned; `"document"` contexts stay shared (report §11.5 hygiene).
- **Tile replace** (`tile.replace` with a new app): terms for ports the new app does not declare are dropped in the same batch (like `pruneWiring` in the prototype), so a stale key never "reads as data".

### 6.10 Agent integration

- `describeWorkbench` gains `ports` per app (name, direction, valueType, doc, fallback) and `links` per workspace (`source → destination` with term and state), and `contexts`.
- Link verbs pass through `workbench_perform`; `describeWorkbenchVerb` narrates them ("make Order Detail.order follow Orders East.order"). The vocabulary (`vocabularyOf`) lists `port`/`link`/`context` types and their actions.
- `pbui_accept` with `types: ["port"]` lets the agent ask the user to point at a port.

### 6.11 Persistence and the server

`pbui.links` is one payload among the 128 the limits allow; its size is bounded by ports × placed views. A host that validates documents registers a validator for the format (Phase 7): declared ports exist on the catalog app, referenced views exist, no cycle in follow/derived after alias collapse, identity links contract-compatible. The client applier needs no change (it already stores any `documentPut`).

## 7. Decision records

### Decision D1: The link kernel is a sibling of the action kernel, not an action family

- **Context:** The report (§3.2, §14.10) warns against implementing topology as actions; pbui's kernel is deliberately narrow (`actions/index.ts:1-6`).
- **Options considered:** (a) ports and links as action families that bind workbench verbs; (b) a separate pure kernel in `pbui/src/presentation/links/` sharing the type graph, scopes, availability, ids, and snapshot conventions; (c) a standalone package with its own type system.
- **Decision:** (b).
- **Rationale:** Topology has state (declarations, classes, runtime cells) and lifecycle (pin, unlink, close) that a stateless action rule cannot own; but the *selection* logic (reachability, scope, ambiguity, trace, fresh revalidation) is identical in shape, and a second type graph would make the inspector incoherent. Menus for ports and links are still ordinary kernel rules — the sibling supplies the facts and verbs they bind.
- **Consequences:** `links/` may import from `actions/` but never the reverse; `LinkSnapshot` extends `SelectionSnapshot`; the product's `snapshotFor` must be able to include link facts (§10, Phase 2). Must validate: no React import in `links/` (the same `no-react-in-kernel` test shape as actions).
- **Status:** proposed.

### Decision D2: Document slots stay in `view.documents`; value ports are a new layer beside them

- **Context:** `AppView.documents` already binds views to shared payloads, with de-duplication, defaults (`BindingConfig`), linked splits, `describeWorkbench`, and Go validation built on it (§4.6–4.7, §4.9).
- **Options considered:** (a) migrate document slots into the link document as `Constant(docRef)` terms; (b) keep slots as they are and let a port declared with `documentSlot: true` *read* its constant from `view.documents[name]`, while all other terms live in the link document; (c) two unrelated systems.
- **Decision:** (b), amended by D10: the *declaration* is unified — `AppDescriptor.bindings` and `docBound` are deleted and derived from ports with `documentSlot: true` — while the *persistence* of a document port's constant stays in `view.documents`.
- **Rationale:** (a) rewrites the Go validator, the agent tools, and every `openView` de-dup path for no user-visible gain; (c) leaves "which document am I a view of" invisible to the badge and the inspector. (b) makes the existing behaviour the *first* term the badge can show (`• Mass and yield`) with zero migration, and lets a document port later accept `Follow` (a detail that follows whichever document the table shows) by writing a term for it in the link document — the term wins over the slot when present.
- **Consequences:** `effectiveBinding` has a precedence rule: explicit link-document term → `view.documents[name]` as `Constant` → declared fallback → `Unresolved`. `view.rebind` keeps working; `describeWorkbench`, `openView`'s de-dup and the Go catalog's `DocumentBindings` read the document-slot ports instead of `bindings`. Must validate: a `port.follow` onto a document port that is linked into other tiles goes through the same "retarget or mint" reasoning as `replace` (`verbs.ts:888-935`).
- **Status:** accepted (2026-09-01, with the D10 amendment).

### Decision D3: Declarations persist in a `pbui.links` DocumentPayload; values live in a runtime store

- **Context:** The workbench already persists arbitrary payloads (rebalance config, plot scripts) and syncs them to the server; `WorkbenchState` holds browser-local facts that must never reach a server (`store.ts:5-9`).
- **Options considered:** (a) extend the protobuf schema with first-class `Link`/`Port` messages; (b) a payload in `documents`; (c) a separate client-only store with its own persistence.
- **Decision:** (b) for declarations, plus a non-persisted runtime store for values.
- **Rationale:** (b) needs no schema or Go change to ship Phases 1–6, rides `plan`/`applyPlan`, `serialize`/`restore`, server sync, and `workbench_perform` unchanged, and follows two precedents in the repo. (a) is the right long-term shape if links become a server-validated contract, and can be introduced in Phase 7 with a one-way migration. (c) creates the second source of truth `store.ts:57-67` warns against. Runtime values are not persisted because they are re-derived from what tiles emit (a reload restarts programs at `initialState`, `pbui-sandbox/src/state.ts:5-6`, and a reload re-emits the table's selection); only `Hold`/`Constant` capture values, and those are serialized in the term.
- **Consequences:** Serializable references are required for held/constant values (D4). Every link verb is one `documentPut` of the whole payload; the payload must stay small (ports × views) and the handler must read-modify-write against the *current* document inside `store.mutate`'s batch. Must validate: `applyMutations` parity between the TS applier and `pkg/workbench` for a `documentPut` of this format (it is a generic payload, so parity already holds).
- **Status:** proposed.

### Decision D4: Port values are presentation references and MUST be JSON-serializable; no codecs

- **Context:** Terms in the document can only hold JSON; product presentation values are arbitrary objects (`PresentationValues = object`, `types.ts:4`). pbui-chat already defines a wire reference `{ type, id, value?, provenance? }` and a codec `toProduct`/`fromProduct` (`packages/pbui-chat/src/types.ts:80-88`).
- **Options considered:** (a) require every linkable type to be JSON-serializable; (b) a per-contract codec (`toWire`/`fromWire`) with `Hold`/`Constant` refused (`unavailable`) on ports without one; (c) store only ids and re-resolve values from the product on read.
- **Decision:** (a), superseding the codec option after the PBUI-DATALAB-1 review (D10). Every linkable presentation value is plain JSON; a datum is `{ relation, identity }` (plot's `DatumIdentity` shape), never a row object. `Hold` and `Constant` store the reference as-is.
- **Rationale:** The only product with non-serializable-looking values, datalab-ui, is frozen and never gets ports (D10); the new packages are written to the rule from the start. A codec layer for a consumer that does not exist is dead code, and it would have put an "unavailable" state in the Pin row for no reason.
- **Consequences:** `PortContract` has no `codec`; a repo test asserts `JSON.parse(JSON.stringify(v))` deep-equals `v` for every fixture value of every port type in the demo package. Must validate: identity fields are declared per fixture table so `datum` references are stable across emits.
- **Status:** accepted (2026-09-01).

### Decision D5: Pull evaluation with per-revision memo, not push propagation

- **Context:** The prototype pushes values along links with a `seen` set (`pbui-agent-workbench.jsx:4822-4845`); the report recommends evaluation over a snapshot with memoization and a dependency index (§8.1); React consumers subscribe through `useSyncExternalStore`.
- **Options considered:** (a) push on emit (write every follower's cell); (b) pull on read with a memo keyed by `(PortId, runtimeRevision, documentRevision)`; (c) a reactive graph library.
- **Decision:** (b).
- **Rationale:** Pull keeps the kernel pure (evaluation is a function of a snapshot), makes cycles a static check at link time rather than a runtime `seen` hack, and lets an unmounted follower cost nothing. Fan-out of a hot source is bounded by the memo. (a) makes fan-in and `Hold` semantics depend on write order — the report's "hidden temporal last-writer behaviour". (c) adds a dependency for a graph that is tiny.
- **Consequences:** `usePort` subscribes to both the workbench store and the runtime; the evaluator must be cheap (a chain of a few terms) and must carry a `visiting` set to report a cycle diagnostic defensively. Must validate: a benchmark story with 20 tiles following one source stays under one evaluation per tile per emit.
- **Status:** proposed.

### Decision D6: Wires and port-to-port drag exist only in connect mode; the object menu is the primary instrument

- **Context:** The user asked for a less intrusive surface than the toy ("connect management mode … like the back of a Reason rack", "right click → link to"). pbui already has an object menu on every presentation and an accept mode for pointing.
- **Options considered:** (a) the toy's gesture surface as primary (draggable ports on every tile, drop zones on every drag, wires on hover); (b) menu-first with accept mode as the chooser, and a dedicated connect mode for wires and drag; (c) menu only, no wires ever.
- **Decision:** (b).
- **Rationale:** (a) adds affordances to every tile all the time and competes with the existing tile drag (grip → swap/dock) for the same pointer; (c) leaves the coupling invisible, violating the report's invariant that hidden coupling must be inspectable somewhere. (b) keeps the everyday workspace unchanged except one badge, makes the common operation one right-click, and reserves the patch-bay for when the user wants to see the graph.
- **Consequences:** The toy's drop-zones (pattern 4) are not ported; spawn placement uses the launcher's carry. The pie menu (pattern 5) is not ported; its six slices are object-menu rows. Must validate with the audit-style Playwright suite that the badge menu, accept-mode linking, and connect-mode drag each reach visible postconditions.
- **Status:** accepted (2026-09-01; confirmed in review).

### Decision D7: `Derived` reuses `PresentationTranslator` as the direct relation registry

- **Context:** The report asks for a relation registry with ids, typed endpoints, cardinality, scopes, and an ambiguity chooser (§9.3, §14.7); translators already have all but cardinality (`translators/types.ts:28-42`).
- **Options considered:** (a) a new `Relation` interface and registry; (b) `Derived(b, translatorId)` over the existing translators, with `cardinality` defaulting to `zero-or-one` (a translator returns one reference or `undefined`) and an optional `many` extension later.
- **Decision:** (b).
- **Rationale:** One registry means accept mode ("show this order as an author") and standing bindings ("this author tile derives from that order port") agree by construction, which is the same argument `resolveAcceptance` makes for highlighting versus clicking. Translators are already pure over a snapshot.
- **Consequences:** Translators used as standing relations must be cheap and synchronous (asynchronous relations are out of scope). The palette lists translators, not a second list. Must validate: a translator that returns `undefined` yields `empty`, not a stale value.
- **Status:** proposed.

### Decision D8: Identity classes over value ports are Phase 5 and re-implement P06's subset

- **Context:** Document-granularity identity already exists; value-port identity needs contract fibers, union-find, persistent class ids, merge/split policies, and lineage (P06, report §8.4–8.6).
- **Options considered:** (a) vendor P06; (b) re-implement the subset (~300 lines) inside `links/identity.ts` citing P06's reference semantics and counterexamples; (c) skip identity and express "shared selection" as two follows.
- **Decision:** (b).
- **Rationale:** P06 carries a DSL, JSONL adapter, benchmarks, and a web lab pbui does not need; its core is small. (c) is exactly the "bidirectional = two arrows" failure the report rejects.
- **Consequences:** Phase 5 must port P06's counterexample fixtures as tests. Persistent class ids live in the payload's `classes`; the runtime allocates one cell per class.
- **Status:** proposed.

### Decision D9: The pure kernel lives in the core package; the stateful glue lives in pbui-workbench; no third package

- **Context:** The question "linking as a package, or in the core package?" was raised in review. The kernel needs the type graph and snapshot conventions (core); the glue must extend the `WorkbenchVerb` union, add `linkModeOpen` to the store, and render inside `Tile` and `Surface` (pbui-workbench).
- **Options considered:** (a) everything in `pbui-workbench`; (b) pure kernel in `pbui/src/presentation/links/` beside `actions/` and `help/`, stateful glue in `pbui-workbench/src/links/`; (c) a new `@hyperslop-systems/pbui-links` package depending on both, with pbui-workbench exposing verb-extension, badge, and overlay seams.
- **Decision:** (b).
- **Rationale:** (a) puts a React-free resolver that only needs the type graph behind a package that owns documents and DOM; the action and help kernels set the precedent for pure kernels in core. (c) would still require cutting the verb-union, store, `Tile`, and `Surface` seams into pbui-workbench for exactly one consumer; a plugin boundary for one plugin is premature. Extraction into a package is a mechanical move later if a second shell appears.
- **Consequences:** `pbui/src/presentation/index.ts` re-exports `links`; `pbui-workbench` gains `src/links/` and the chrome components; `pbui/src/chrome/usePortCarry.ts` is the one core addition on the DOM side, because it shares the hit-test helper with `useTileDrag.ts`. Must validate: the no-React test on `links/`, and that `pbui-workbench` remains the only importer of the glue.
- **Status:** accepted (2026-09-01).

### Decision D10: Hard cutover for new packages; a self-contained e-commerce demo is the first consumer; datalab-ui is frozen

- **Context:** Review confirmed that no backward compatibility is needed and that PBUI-DATALAB-1 defers migrating `packages/datalab-ui` onto pbui-workbench (the in-place migration was measured at 308 type errors across 25 files with no green intermediate; its shell, marketing, tour, and account layers are 25 000 of its 35 000 lines). `datalab-ui` is consumed only by the Go product's frontend (`datalab/ui`, pinning `@hyperslop-systems/datalab-ui`).
- **Options considered:** (a) plan the linking demos around datalab-ui through a store adapter (the guide's original §10 migration notes); (b) build the demos on PBUI-DATALAB-1's relation documents and DuckDB (a prerequisite of several weeks); (c) a self-contained `pbui/packages/pbui-ecommerce` demo with in-memory fixtures and its own tiles, written to the cutover rules from the start, with DATALAB-1 later swapping the host behind the same tile contracts.
- **Decision:** (c), plus the cutover rules: unified port declarations replace `bindings`/`docBound` (D2 amendment); all port values are JSON (D4); no product globals — contexts and ports from the first line; `datalab-ui` is frozen, keeps building and passing its tests, and is never given ports.
- **Rationale:** (a) re-creates the `activeDocId`/`inspected` globals in an adapter for a package that is being retired. (b) blocks linking on DuckDB, relation documents, and Go validator work that linking does not need; plots over bounded in-memory rows are what `@hyperslop-systems/plot` already takes. (c) merges the guide's LinkLab and datalab demos into one workspace with a realistic subject (the research toy's fixture is already orders and authors) and gives every binding term a natural home.
- **Consequences:** §11 is rewritten around the e-commerce package; the "two coordination vocabularies during migration" risk disappears; Phase 0's golden tests shrink to the workbench verbs; the interim "ports as host cells" step in PBUI-DATALAB-1 is dropped in favour of writing tiles against `usePort` once Phase 2 lands. Must validate: the e-commerce package has no dependency on `datalab-ui`, and `pbui-datalab` (DATALAB-1) can implement the same host interface.
- **Status:** accepted (2026-09-01).

### Decision D11: One world — the gold-coin shop; `pbui-ecommerce` owns it, the chat demo consumes it

- **Context:** The pbui-chat demo (`packages/pbui-chat/demo`) already contains a gold-coin shop: eight SKUs, six categories, three metals and four orders, mirrored by hand from the Go chat server's `pkg/chatserver/demo/data.go`, with `product`/`order`/`category`/`metal` presentation types and four tiles (inventory, SKU, metals, notes). §11.1 as first written specified a generic orders/customers world and did not know about it.
- **Options considered:** (a) a generic fixture in the new package, leaving two shop worlds in the repo; (b) the new package owns an EXPANDED gold-coin shop — the eight SKUs verbatim, plus twelve customers, a sixty-five order book with line items, and a derived daily sales series — and the chat demo switches to consuming it in Phase 7 (scene 8); (c) build the linking demo inside the chat demo.
- **Decision:** (b), on user review (2026-09-01: "merge both worlds, and expand the existing one to have richer data").
- **Rationale:** (a) adds a third copy of the product table; (c) makes the linking package depend on pbui-chat and on the Go server. (b) keeps the Go mirror true for the eight SKUs and the `lastOrder` ids, and gives the chat demo richer data for free once it consumes the package.
- **Consequences:** `fixtures/products.ts` is `world.ts` verbatim; the eight anchor orders (88150, 88177, 88190, 88201, 88209, 88210, 88213, 88214) keep the chat demo's customer, total, item count, date and status where it had them; customers, the other fifty-seven orders, line items and `daily_sales` are new and exist only in the package until `data.go` grows (a chat-server follow-up, not this ticket). Must validate: `fixtures.test.ts` pins the four chat-demo orders and every foreign key; scene 8 is the chat demo hosting the package's apps.
- **Status:** accepted (2026-09-01).

## 8. Pseudocode and key flows

### 8.1 Effective binding and evaluation

```text
effectiveBinding(port, s):
    if s.bindings.has(port):            return s.bindings.get(port)          # link document
    if s.documentSlots.has(port):       return Constant(s.documentSlots.get(port))   # view.documents (D2)
    def = s.ports.get(port)
    if def.fallbackContext:             return Ambient(def.fallbackContext)
    return Unresolved({ code: "unbound", message: `${def.name} is not bound` })

evaluatePort(port, s, deps, visiting = {}):
    if port in visiting:                return error("cycle", path = visiting + port)
    return evaluateBinding(effectiveBinding(port, s), s, deps, visiting + port)

evaluateBinding(b, s, deps, visiting):
    match b:
      Ambient(k):        cell = s.values.context(k);  return cell ? value(cell, b) : empty(b)
      Constant(r):       return value(fromWire(r), b)
      Follow(p, id):     if p not in s.ports: return error("source-missing")
                         if s.ports.get(p).direction == "in": return evaluatePort(p, …)      # follow a follower
                         e = s.values.emitted(p); return e ? value(e, b) : empty(b)
      Alias(c):          cell = s.values.classCell(c); return cell ? value(cell, b) : empty(b)
      Hold(r, _):        return value(fromWire(r), b)
      Derived(src, ρ):   inner = evaluateBinding(src, …); if inner.kind != "value": return inner
                         t = deps.translators.find(ρ); out = t.translate(inner.reference, s)
                         return out ? value(out, b) : empty(b)
      Unresolved(d):     return error(d)
```

`value(ref, provenance)` records the path so the badge's hover doc can say "following Orders East, current #1042".

### 8.2 Planning a follow (menu row, accept settle, or connect-mode drop)

```text
planFollow(source, dest, s, deps):
    S = s.ports.get(source); D = s.ports.get(dest)
    if !S or !D:                          return unavailable("port no longer exists", "port-missing")
    if S.direction == "in":               return unavailable(`${S.name} is an input`, "direction")
    if D.direction == "out":              return unavailable(`${D.name} is an output`, "direction")
    reach = reachability(S.contract.valueType, D.contract.valueType, deps.graph, deps.translators, s)
    if reach.kind == "none":              return unavailable(`<${S.type}> does not reach <${D.type}>`, "type")
    if reach.kind == "translator":        return ambiguousOrDerive(reach.options)     # offers port.derive rows
    if createsCycle(s.graphAfterAliasCollapse(), source → dest):
        return unavailable("this follow would create a cycle; share identity or reverse the other edge", "cycle",
                           alternatives = [identity.add(source, dest)] if compatible)
    producers = liveProducersOf(dest, s)
    if producers.length > 0 and D.fanIn == "single-producer":
        return ambiguous([{ verb: port.follow(source, dest, replace: true), label: `replace ${producers[0]}` },
                          { verb: identity.add(...), label: "share identity instead" }])
    return available(port.follow(source, dest), `${title(dest)}.${D.name} will follow ${title(source)}.${S.name}`)
```

### 8.3 The verb handler (one `documentPut`)

```text
handlers["port.follow"](verb):
    fresh   = linkSnapshot(store.getState(), runtime, deps)
    plan    = planFollow(verb.source, verb.destination, fresh, deps)
    if plan.kind != "available": onRejected(plan); return false
    payload = readLinks(fresh.document)
    payload.bindings[verb.destination] = Follow(verb.source, verb.linkId ?? newId("link"))
    return store.mutate([linksMutation(payload)])
```

Every handler has this shape: fresh snapshot → kernel plan → single mutation. The fresh snapshot is what makes a stale menu row safe (report §8.10): the row's verb is re-planned, not replayed.

### 8.4 Pin, resume, detach

```text
handlers["port.pin"](verb):
    fresh = …; b = effectiveBinding(verb.port, fresh)
    if b.kind == "hold":                        return false (already held; the menu row is unavailable)
    attended = runtime.attended(verb.port)      # toy pattern 8: the last value PRESENTED as attended
    current  = attended ?? evaluatePort(verb.port, fresh, deps)
    if current.kind != "value":                 return false ("nothing to hold")
    if !codecFor(port).toWire:                  return false ("values of this type cannot be held")   # D4
    payload.bindings[verb.port] = Hold(toWire(current.reference), suspended = b)
    mutate

handlers["port.resume"](verb):   b = explicit(verb.port); if b.kind != "hold": false
                                 payload.bindings[verb.port] = b.suspended  (delete when suspended equals the declared fallback)
handlers["port.detach"](verb):   b = explicit(verb.port); if b.kind != "hold": false
                                 payload.bindings[verb.port] = Constant(b.reference)
```

Law check (unit test): `resume(pin(port)) ≡ effectiveBinding(port)` before the pin, for every term kind.

### 8.5 Emitting from a tile and re-rendering followers

```text
OrdersTable row click:      emit(view, "order", { type: "order", value: row })
OrdersTable row hover:      emit(view, "order", ref, { attended: true })   # only if the product wants attention following

runtime.emit(port, ref, opts):
    emitted[port] = { ref, revision: ++revision }
    if opts.attended: attended[port] = ref
    if drives(port): contexts[drivenContext] = { ref, revision }
    notify()

DetailTile render:           const { value, state } = usePort(view, "order")
usePort:                     useSyncExternalStore over (workbenchStore, runtime) →
                             memo.get(port, docRev, runtimeRev) ?? evaluatePort(...)
```

### 8.6 "Show details…" end to end

```text
1. user right-clicks <order #1042> in Orders East (a Presentation minted inside the table tile);
   product's snapshotFor records facts.links.from = "v-east/order"
2. action kernel resolves rules for subject "order"; the linkToFamily expands to
   "Link to Order Detail A · order", "Link to Pinned Detail · order (held; would not be replaced)", "Link to…"
3. user picks the first; its verb is { kind:"show", subject: wire(#1042), role:"order.detail", candidateId:"existing:v-detail-a/order" }
4. pbui.performAction → evaluateFresh (action kernel) → onPerform → performWorkbenchVerb
5. handlers.show: fresh = linkSnapshot(); result = resolveShow(query, fresh)
   current = result.findByCandidateId(candidateId)
   if !current or current.status != available: onRejected("target no longer resolves"); return false
   apply current.verb:  port.follow("v-east/order", "v-detail-a/order")   (disposition follow; Shift ⇒ + port.pin)
6. Detail A's usePort re-evaluates; its badge reads "→ Orders East"; content shows #1042
7. if the family had produced "Link to…" (many targets): handler calls pbui.accept({ types:["port"], prompt:"pick the tile to show #1042 in", filter: p => planFollow(from, p.port).kind != "unavailable" })
   → badges of compatible ports light up (data-state="acceptable") → click settles → same handler with the picked port
8. if no existing target: handler opens the LauncherShell chooser with spawn rows; choosing "split right of Orders East"
   runs plan([ view.open(detailApp, {}, near: eastPlacement), port.follow(from, `${newViewId}/order`) ]) → applyPlan
```

### 8.7 Connect mode drag

```text
link.mode.open → store.setState({ linkModeOpen: true }); useEscapeSurface(true) in WireLayer
Tile renders <PortRail/> over the app; each port registers its element in PortRegistry (id = PortId)
WorkbenchSurface renders <WireLayer/> once; it draws wires for every explicit Follow/Derived/Alias/Hold term
                        from the registry's rects; re-draws on resize/mutation via requestAnimationFrame

pointerdown on an OUT port element (capture):
    startPortCarry({ from: PortId, onDrop(target: PortId, modifiers), onCancel })
    → publishes { from, over, acceptable } on every pointermove using hitTest over PortRegistry
      and planFollow(from, over) for acceptability; the rubber-band path and cursor badge read the live modifiers
pointerup over an acceptable IN port:
    finish({ drop: target }) → perform(port.follow(from, target)); if Shift: perform(port.pin(target))
pointerup elsewhere / Escape / blur:   finish(null) → onCancel
```

### 8.8 Unlink with a policy

```text
wire menu → "Unlink…" → inline popover at the wire midpoint with the legal policies for that term:
   Follow/Derived:  keep last value (freeze) · clear · fall back to ambient
   Identity (P5):   copy shared value · restore private history · reset to defaults
choose → perform(port.unlink(linkId, policy))
handler: b = termFor(linkId)
   freeze  → bindings[dest] = Hold(toWire(⟦b⟧), Unresolved("unlinked"))   # resume explains why it cannot
   clear   → bindings[dest] = Unresolved("unlinked")
   ambient → delete bindings[dest]  (falls back to the declared context)
```

## 9. Diagrams

### 9.1 Layers and ownership

```text
   ┌──────────────────────────────── products (datalab-ui, pbui-chat, plotscript, …) ───────────────────────────┐
   │ Values & type graph · translators · snapshotFor(+link facts) · verb router · apps with ports · renderTitle  │
   └───────────────┬──────────────────────────────────────────────────────────────────────────┬─────────────────┘
                   │ spreads contributions                                                    │ declares apps
   ┌───────────────▼───────────────────────────────┐          ┌─────────────────────────────▼─────────────────┐
   │ @hyperslop-systems/pbui (core, no documents)  │          │ @hyperslop-systems/pbui-workbench              │
   │ presentation/actions   PURE action kernel     │          │ links/document.ts   pbui.links payload r/w     │
   │ presentation/links     PURE link kernel  (new)│◄─────────┤ links/runtime.ts    emitted/contexts/attended  │
   │   terms · evaluate · planFollow · identity    │  imports │ links/verbs.ts      port.* handlers → documentPut│
   │   resolveShow · evaluateFreshLink · trace     │          │ links/hooks.ts      usePort · useEmitPort       │
   │ presentation/translators (relations, reused)  │          │ links/contributions workbenchLinkContributions │
   │ createPbui: Presentation · ObjectMenu · accept│          │ components/PortBadge · PortRail · WireLayer     │
   │ chrome: TileFrame · useTileDrag · carry       │          │ verbs.ts   WorkbenchVerb ∪ LinkVerb            │
   │ surfaces.ts (Escape stack)                    │          │ describe.ts (+ports, +links)                   │
   └───────────────────────────────────────────────┘          └───────────────┬───────────────────────────────┘
                                                                              │ documentPut / viewCreate / …
                                                              ┌───────────────▼───────────────────────────────┐
                                                              │ workbench-protocol applier ⇄ pkg/workbench (Go)│
                                                              │ WorkbenchDocument.documents["pbui.links"]       │
                                                              └───────────────────────────────────────────────┘
```

### 9.2 Data flow for one emit

```text
 Orders East tile                 LinkRuntime                     Order Detail tile
 ┌─────────────┐  emit(v-east/order, #1042)  ┌─────────────┐   usePort(v-detail/order)   ┌─────────────┐
 │ row click   │ ───────────────────────────►│ emitted[…]  │ ◄──────────────────────────│ evaluatePort│
 │ (Presentation<order>)                     │ revision++  │  effectiveBinding =         │  → #1042    │
 └─────────────┘                             │ notify()    │  Follow(v-east/order)       │ badge →East │
                                             └─────────────┘                             └─────────────┘
                                                    ▲                                            │
                                                    │ pin: Hold(#1042, Follow(v-east/order))     │ menu: Pin
                                             ┌──────┴──────┐  documentPut(pbui.links)             │
                                             │ links/verbs │ ◄──────────────────────────────────┘
                                             └─────────────┘
```

### 9.3 Term state machine for one input port

```text
                 port.ambient / clear                 port.follow(src)
   Unresolved ──────────────────────► Ambient(k) ──────────────────────► Follow(src)
       ▲                                  │  ▲                              │   ▲
       │ source closed (clear)            │  │ unlink(ambient)               │   │ resume
       │                                  │  └──────────────────────────────┤   │
       │                          pin     ▼                                 ▼   │
       └──────────────── Hold(r, Unresolved) ◄── unlink(freeze) ─── Hold(r, Follow(src)) ── detach ──► Constant(r)
                                                                            │
                                                                            └── port.derive(ρ) ──► Derived(Follow(src), ρ)
   identity.add(a,b)  :  any two contract-compatible ports  ──► Alias(σ)   (both)
   identity.remove    :  Alias(σ) ──(copy|history|reset)──► Constant(r) | previous term
```

### 9.4 Connect mode, what the user sees

```text
 normal mode                                   connect mode (Mod+Shift+L)
 ┌ ORDERS · EAST ───────────┐ ┌ ORDER DETAIL · A → East ─┐  ┌ ORDERS · EAST ──────────────┐   ┌ ORDER DETAIL · A ───────────┐
 │ #1042 paid   Ada  184.50 │ │ #1042  PAID              │  │ ▸ order : <order> ─────────────╮│  │╭─ ◂ order : <order>  → East │
 │ #1037 hold   Lin   78.00 │ │ author  Ada N.           │  │   "the order you clicked"      ││  ││   "the order shown"         │
 │ #1060 pend   Sam   46.20 │ │ placed  2026-08-24       │  │                                ╰┼──┼╯                            │
 └──────────────────────────┘ └──────────────────────────┘  │                                 │  │                             │
   (one badge in the header; nothing else changes)          └─────────────────────────────────┘  └─────────────────────────────┘
                                                             wires in one SVG layer; rails over inert apps; Esc leaves
```

## 10. Implementation phases

Each phase ends with the audit's definition of done: the transition exists without DOM, every visible facet projects it, one instrument drives it, a real-interaction scenario asserts a visible postcondition, and the combined story still passes. Estimates assume one engineer who has read this guide.

### Phase 0: freeze current behaviour (½ day)

- Add golden tests for what linking must not break: `openView` de-dup across workspaces, `replace` retarget-vs-mint, `link`'s old-view deletion, `BindingConfig` defaults (`packages/pbui-workbench/src/workbench.test.ts` already covers most; extend where a case is missing).
- Snapshot the `describeWorkbench` output of the `RebalanceLab` story so the Phase 7 additions are a reviewed diff.

### Phase 1: ports and contracts, no behaviour (1 day)

Files:

- `pbui/src/presentation/links/types.ts` — `PortContract`, `PortDeclaration`, `PortId`, `portId(viewId, name)`, `normalizeContract`, `contractFingerprint`.
- `pbui/src/presentation/links/index.ts`, re-exported from `pbui/src/presentation/index.ts` beside `actions` and `help`.
- `pbui/packages/pbui-workbench/src/apps.ts` — `ports?: readonly PortDeclaration[]` on `AppDescriptor`; delete `bindings` and `docBound` and derive them from `documentSlot` ports (D10); `defineApp` fills contract defaults; update every caller (`verbs.ts` `openView`/`replace`, `describe.ts`, `launcherRows.ts`, pbui-chat, pbui-plotscript, pbui-sandbox apps).
- `pbui/packages/pbui-workbench/src/describe.ts` — `ports` per described app.
- `pbui/packages/pbui-workbench/src/stories/demoApps.tsx` — give `counter` an out port `count : <number>` and `notes` an in port `subject : <any>` so the shell's own stories have something to link.
- `pbui/packages/pbui-ecommerce/` — scaffold the demo package (fixtures, host, `createEcommerceApps`, Vite demo in the plotscript shape) and declare its ports (§11.1); it is the first consumer of every later phase.
- Tests: `links/types.test.ts` (normalization, fingerprint stability, defaults), `describe.test.ts` (ports appear).

### Phase 2: kernel, document, runtime, `Ambient`/`Constant`/`Follow`/`Hold`, badge, menus (4–5 days)

Files:

- `pbui/src/presentation/links/terms.ts`, `evaluate.ts`, `plan.ts` (`planFollow`, `planPin`, `planResume`, `planDetach`, `planUnlink`, cycle check, fan-in), `snapshot.ts` (`LinkSnapshot`), `trace.ts`, `explain.ts`; tests for every law in §6.3 and every invariant in §12.2.
- `pbui/packages/pbui-workbench/src/links/document.ts` (`LINKS_FORMAT`, `readLinks`, `linksMutation`), `runtime.ts`, `snapshot.ts` (build a `LinkSnapshot` from store + runtime + apps), `verbs.ts` (handlers), `hooks.ts` (`usePort`, `useEmitPort`), `contributions.ts` (`workbenchLinkContributions`, `linkToFamily`), `portRef.ts` (`PortRef`, `portRefOf`).
- `pbui/packages/pbui-workbench/src/verbs.ts` — extend `WorkbenchVerb`, `isWorkbenchVerb`, `describeWorkbenchVerb`, `performWorkbenchVerb`; `createVerbHandlers` receives the runtime and link deps; `close`/`replace`/`clone` apply the lifecycle rules of §6.9.
- `pbui/packages/pbui-workbench/src/store.ts` — `linkModeOpen: boolean` (browser-local).
- `pbui/packages/pbui-workbench/src/actions.ts` — `workbenchTypeDefinitions` gains `{ id: "port" }`, `{ id: "link" }`, `{ id: "context" }`.
- `pbui/packages/pbui-workbench/src/components/PortBadge/` — the badge presentation; `Tile.tsx` renders badges after the `×N` marker; `TileFrame` gets an optional `badges` slot (`pbui/src/chrome/TileFrame.tsx`).
- `pbui/packages/pbui-workbench/src/createWorkbench.tsx` — `links?: { translators, graph, codecs }` option; the `Workbench` interface exposes `links.runtime` and `links.snapshot()`.
- Storybook: `stories/LinkLab.stories.tsx` in pbui-workbench with the counter/notes apps (smoke), and the e-commerce package's scene stories (§11.1) as the real exercise.
- Tests: `links/verbs.test.ts` (each verb's postcondition on the document and the badge text through RTL), `workbench.test.ts` additions (plan/applyPlan with a link verb), a `no-react-in-links-kernel` test.

### Phase 3: connect-management mode (3 days)

Files:

- `pbui/src/chrome/usePortCarry.ts` — the port registry and `startPortCarry`, extracted from the carry pattern in `useTileDrag.ts` (shared hit-test helper).
- `pbui/packages/pbui-workbench/src/components/PortRail/`, `WireLayer/` (SVG, wire styles per term, hit paths, `useEscapeSurface`), `WireMenu` rows via `contributions.ts` for subject `"link"`.
- `Surface.tsx` mounts `WireLayer` when `linkModeOpen`; `Tile.tsx` mounts `PortRail`; `Launcher`-style shortcut `Mod+Shift+L` in `createWorkbench` (mirror `RebalanceProps.shortcut`).
- `chrome.css` / `styles.css` parts: `port-rail`, `port`, `wire`, `wire-hit`, `wire-label`, `link-badge` (tokens only, no hex — `test/no-hex.test.ts` enforces it).
- Playwright scenarios (§12.3): drag Follow, Shift-drag Hold, wire menu → Unlink freeze, Escape leaves the mode with the app interactive again.

### Phase 4: the target resolver and the "show" chooser (2–3 days)

Files:

- `pbui/src/presentation/links/resolveShow.ts`, `placements.ts` (placement candidates from the tree: split right/below of a tile, empty slot), `evaluateFreshLink.ts`.
- `pbui/packages/pbui-workbench/src/links/showChooser.tsx` — `LauncherShell` with two groups and a status line; spawn rows use `startTileCarry`.
- `handlers.show` in `links/verbs.ts`; `plan([...])` for spawn+follow.
- datalab or the demo product declares `presentation.show` rules for `order` (demo) and `doc` (datalab).
- Tests: ranking tuples, ties are ambiguity, stale candidate refused, spawn adds exactly one tile and one term in one batch.

### Phase 5: identity classes over value ports (3 days)

Files: `pbui/src/presentation/links/identity.ts` (compatibility, fibers, union-find, persistent ids, lineage, merge/split policies) with P06's counterexamples as fixtures; payload `identity`/`classes`/`history`; runtime class cells; `identity.add`/`identity.remove` verbs; the merge-policy popover; the `≡` badge and double-segment wire; unlink policies `copy | history | reset` with the audit's distinct-values test.

### Phase 6: `Derived` over translators and the relation palette (2 days)

Files: `planDerive`, `Derived` evaluation, `port.derive` verb, `links/relationPalette.tsx` (`LauncherShell` rows from translators), the labeled wire, `author ← order.author` badge; target-specific filtering (`to ⪯ target.valueType`).

### Phase 7: inspector, agent vocabulary, notifications, server validation (3 days)

Files: `describe.ts` (+links, +contexts), `vocabularyOf` additions, a `CoordinationInspectorApp` singleton (table/tree of source → relation → destination → state → actions, filter by tile/type/context), coalesced live-region notifications, `pkg/workbench` validator for `pbui.links` (optional), and a `workbenchTools.test.ts` case where the agent links two tiles through `workbench_perform`.

### What happens to existing packages (D10)

- **datalab-ui**: frozen. Keeps building, keeps its 554 tests, gets no ports, is never migrated. Its product globals (`world.inspected`, `world.activeDocId`) are not carried anywhere; the e-commerce package and later `pbui-datalab` express them as contexts and ports from the start. The only future change is in `datalab/ui`, which switches its dependency once the new packages cover the core loop (a `datalab/` ticket).
- **pbui-plotscript, pbui-chat, pbui-sandbox**: mechanical Phase 1 change — `bindings: ["plot"]` / `docBound: true` become one `documentSlot` port each. Plotscript's `plot-view` additionally gains `datum`/`selection` out ports from `ResponsivePlot.onEvent` in Phase 2 (§11.2).
- **pbui-datalab (PBUI-DATALAB-1)**: implements the same host interface the e-commerce package defines, so its tiles adopt the same port declarations; it does not build the interim "ports as host cells".

## 11. Demo applications, in order

### 11.1 `pbui-ecommerce`: the gold-coin shop as the first consumer (Phases 1–6)

`pbui/packages/pbui-ecommerce` (`@hyperslop-systems/pbui-ecommerce`) is a demo product in the shape of `pbui-plotscript`: a package with apps, a Vite demo app, Storybook stories, and (from Phase 3) the audit-style Playwright suite. It depends on `pbui`, `pbui-workbench`, `workbench-protocol` and `@hyperslop-systems/plot`; never on `datalab-ui`, `pbui-chat` or DuckDB. Its world is the gold-coin shop (D11). As scaffolded in Phase 1:

```text
packages/pbui-ecommerce/
├── src/
│   ├── fixtures/         products (the chat demo's eight SKUs, categories, metals, verbatim), customers (12),
│   │                     orders (65, ids 88150–88214, eight hand-written anchors + a seeded generator) with
│   │                     line_items, daily_sales (derived per day × category; cancelled orders excluded).
│   │                     fixtures.test.ts: every row survives JSON round-trip (D4); every foreign key resolves
│   ├── host.ts           ShopHost: rows(table), primary-key lookups, the relations the demo derives through
│   │                     (orderCustomer, orderLineItems, customerOrders, productOrders), revision/subscribe
│   ├── document.ts       two payload formats in the workbench document: `hyperslop.plot` (a PlotDocument verbatim)
│   │                     and `pbui-ecommerce.table` (names one host table; the seam DATALAB-1 replaces with a relation)
│   ├── presentation/     Values (order, customer, product, lineItem, datum, category, metal, field, tile, workspace),
│   │                     descriptors, type graph with abstract `inspectable`, action registry, snapshotFor, createShopPbui
│   ├── apps.tsx          createShopApps(shop): the seven tiles below, each with `ports`
│   ├── tiles/            OrdersTable, CustomersTable, ProductCatalog, OrderDetail, CustomerDetail, Inspector, ShopPlot
│   ├── plots/            schemas per table; three seeded plots: revenue-by-day, revenue-by-category, orders-by-status
│   ├── seed.ts           seedShopDocument(): four workspaces (orders, customers, sales, catalog) + every plot and table payload
│   ├── createShop.ts     createShop() → { host, pbui, apps }; createShopWorkbench(shop)
│   ├── ShopShell/        the product shell: Provider (router = workbench), Surface with <tile> titles, launcher, menus
│   └── stories/          harness (ShopStory over a layout, DirectStory for one tile); scenes in ShopShell.stories.tsx
├── test/                 fences: component folders, no hex, no raw controls, and the D10 cutover rules
└── demo/                 Vite app (port 5176) with local persistence; Storybook on port 6012
```

| tile | document slots | ports | what it shows |
|---|---|---|---|
| `orders` | — | out `order : <order>` (role `order.current`); inout `selection : <datum[]>` (role `selection`, authority `orders`); in `filter : <category>` (role `filter`) | the order book; every id is an `<order>` presentation |
| `customers` | — | out `customer`; inout `selection` (authority `customers`) | twelve customers with their summer spend |
| `products` | — | out `product`, out `cat : <category>`; inout `selection` (authority `products`) | the eight SKUs; product, category and metal are three presentation types in one row |
| `order-detail` | — | in `order : <order>` (role `order.detail`, `fallbackContext: "workspace.order"`, `onSourceClose: "freeze"`) | one order's facts and line items; customer and products are presentations |
| `customer-detail` | — | in `customer : <customer>` (role `customer.detail`, `fallbackContext: "workspace.customer"`) | one customer and their orders |
| `inspector` | — | in `subject : <inspectable>` (`fallbackContext: "workspace.inspected"`, `onSourceClose: "clear"`) | whatever was last inspected or linked in, as JSON |
| `plot` | `plot` (a `hyperslop.plot` payload), `table` (a `pbui-ecommerce.table` payload) | inout `selection : <datum[]>` (authority `plot`, see Q7); out `datum : <datum>` (activate); out `cat : <category>` (bar or legend click) | `ResponsivePlot` over the host's rows for the named table; rows never enter the document |

Two deliberate deviations from the first draft of this table: the three table tiles carry no `table` document slot (each is bound to its table by construction, so the launcher offers them directly; DATALAB-1 adds the slot when a table becomes a relation document), and the plot's `selection` authority is the static string `plot` because a contract is declared per app while the bound table is per view (open question Q7).

Scenes, each a Storybook story and a Playwright scenario, in the order the phases land:

1. **Ambient** (Phase 2): an unbound `order-detail` shows `workspace.order`; clicking a row in `orders` drives that context; the badge reads `○ order · workspace`.
2. **Follow and Hold** (Phase 2): right-click an order → "Link to Order Detail · order"; badge `→ Orders`; Pin from the badge; keep clicking; Resume catches up; Detach fixes it.
3. **Show with routing** (Phase 4): "Show details…" on an order with two details open (one held) → the chooser lists the free one first and the held one as inapplicable; with none open → spawn beside and follow in one plan.
4. **Derived** (Phase 6): `customer-detail` derives through `order.customer` from the orders tile's `order` port; the relation palette lists `order.customer` and `order.lineItems`; badge `customer ← order.customer`.
5. **Identity** (Phase 5): the `orders` table and the "orders by status" plot share `selection ≡ σ`; brushing the plot selects rows; shift-click rows highlights marks; "Unlink · restore private history" gives each its own selection back. The "revenue by category" plot over `daily_sales` is *not* identity-compatible with `orders.selection` (different authority domain) and the menu says why.
6. **Follow versus identity** (Phase 5): clicking a category bar emits `cat`; the orders table's `filter` port follows it (`→ Revenue by category`); this is a follow, not a shared cell, and the badge shows the difference.
7. **Connect mode** (Phase 3): Mod+Shift+L over the seeded workspace shows every wire above; port-to-port drag with and without Shift; wire menu → Unlink with a policy; Escape.
8. **Agent** (Phase 7): in a pbui-chat-hosted variant, "show the order I click in a detail on the right and keep its customer beside it" becomes `view.open` + `port.follow` + `port.derive` through `workbench_perform`.

The package is also where the cutover rules are enforced by tests: no `bindings`/`docBound`, JSON-only port values, no globals outside the host and the link runtime.

### 11.2 Plot workbench: script → plot → inspector (Phase 2, then 4)

In `pbui-plotscript`'s demo: the script tile and plot tile already share the `plot` document; add an inspector tile (`subject : <any>`) and make the plot's `activate` event emit `datum`. Right-click a mark → "Link to Inspector · subject"; pin, keep clicking, resume; "Show details…" on a datum with no inspector open spawns one to the right and links it in one batch. This demonstrates the document-level identity that already exists beside the new value-level follow.

### 11.3 Real data behind the same tiles (PBUI-DATALAB-1)

`pbui-datalab` implements the e-commerce host interface over relation documents and DuckDB: the same `orders`/`plot`/`detail` tile contracts and port declarations, with `table` slots becoming `relation` document slots and `authorityDomain` becoming the relation id. Nothing in the kernel or the chrome changes; this is the proof that the port declarations are a contract and not a fixture.

### 11.4 Chat: the agent wires the workbench (Phase 7)

The pbui-chat demo hosts the e-commerce apps beside the conversation; scene 8 above runs through the approval ledger and undo is one plan.

### 11.5 Sandbox devtools: ambient selection (Phase 2)

Program Inspector, REPL, and Timeline tiles read `Ambient("sandbox.selected")`; a Playground tile's out port `program` can drive that context; pinning the Inspector on one program while the selection moves on is the Hold story in a developer-tools setting.

## 12. Test strategy

### 12.1 Kernel unit tests (vitest, `pbui/src/presentation/links/*.test.ts`)

Property-style tests over small generated worlds:

- `resume(pin(port))` restores the effective binding for every term kind; `detach(pin(port))` yields `Constant`.
- `planFollow` refuses direction mismatch, unreachable types, cycles after alias collapse, and a second producer under `single-producer`; every refusal has a code and a sentence.
- Evaluation of a chain `Follow(Follow(Follow(out)))` costs one evaluation per port per revision (memo).
- `resolveShow` ranking is order-independent: permuting registration order of ports/placements never changes winners (report invariant 11); equal tuples produce ambiguity, never a winner.
- `evaluateFreshLink` refuses when the winner changed, mirroring `perform.test.ts`.

### 12.2 Invariant checks (a `checkInvariants(snapshot)` used in tests and the inspector)

1. Every declared port of a placed view has one effective binding or one `Unresolved` diagnostic.
2. Every alias port belongs to exactly one class; every class is contract-homogeneous (Phase 5).
3. The follow/derived graph is acyclic after alias collapse.
4. No `unavailable`/`hidden`/`ambiguous` show candidate carries a verb.
5. Every term in the payload references an existing port; every `linkId` is unique.
6. `documentSlot` ports never have a `Constant` in the payload (the slot is the constant, D2).

### 12.3 Workbench tests (vitest + RTL, `packages/pbui-workbench/src/links/*.test.ts`)

Follow `workbench.test.ts`'s shape (`threeTiles()`, `leafIds`, `box(width,height)` for geometry): create a workbench with the LinkLab apps, perform a verb, and assert **the badge text and the tile content**, not only the payload. Cover: follow, pin/resume/detach, unlink with each policy, source close with each `onSourceClose`, duplicate copies terms, replace prunes terms, clone re-keys terms, `plan([view.open, port.follow])` commits atomically or not at all, `restore(serialize())` round-trips the payload.

### 12.4 Real-interaction scenarios (Playwright, per the audit)

Against the `pbui-ecommerce` scene stories in Storybook, a fresh page per scenario, native pointer/keyboard only (the LinkLab story in pbui-workbench is the smoke subset):

| Scenario | Visible postcondition |
|---|---|
| Right-click order → Link to Detail A | badge `→ Orders East`; detail shows the order |
| Same with Shift held at click | badge `⏸ #1042`; clicking another row does not change the detail; Resume catches up |
| Link to… (many targets) → accept mode → click a badge | the clicked port's badge changes; Escape aborts with no change |
| Mod+Shift+L → drag out port to in port | wire drawn; badge changes; Escape leaves the mode and the app is clickable again |
| Shift released mid-drag | cursor badge switches from Hold to Follow before release (the anti-pattern "modifier read only at dragstart") |
| Wire menu → Unlink → freeze | badge `⏸`, wire gone, Resume unavailable with reason |
| Show details… with no detail open | tile count +1; new tile's badge `→ Orders East` in one batch |
| Ambient hover then Pin (pointer leaves the table to reach the badge) | held value is the last hovered row, not the fallback |
| Merge σ with differing cells (P5) | merge-policy popover; chosen value shown in both; unlink history restores distinct values |

### 12.5 Storybook and lint fences

Stories for `PortBadge` (every state), `PortRail`, `WireLayer` (every term style), the show chooser, and the relation palette. The existing fences apply: component folders (`test/component-folders.test.ts`), no hex colours (`test/no-hex.test.ts`), no raw controls (`test/no-raw-controls.test.ts`).

## 13. Risks, alternatives, open questions

### 13.1 Risks

- **The demo host becomes a second data model.** `pbui-ecommerce`'s in-memory host must stay an interface `pbui-datalab` can implement, or the port contracts will drift into fixture-specific shapes. Mitigation: define `ShopHost` as an interface in the demo package with a conformance test, and have DATALAB-1 run that test.
- **JSON-only values (D4).** A future product with non-serializable presentation values cannot use `Hold`/`Constant` without changing its value vocabulary. Mitigation: the rule is a repo test from day one; new products are written to it.
- **Payload churn.** Every link verb rewrites the whole `pbui.links` payload; with server sync each is a revisioned mutation. Mitigation: coalesce `attended`/emit (never persisted) and keep the payload small; if churn matters, Phase 7 introduces first-class protobuf messages.
- **Contexts become disguised globals** (report §16.2). Mitigation: every context is declared with a doc string and shown in the inspector; the badge names it; `context.drive` makes the writer visible.
- **Wire overlay clutter** (report §16.7). Mitigation: wires exist only in connect mode; filter by the focused tile; bundle at contexts later.
- **Competing pointer gestures.** The tile grip drag and the port drag must not both start. Mitigation: ports are only interactive in connect mode, where the app is inert and the grip is not the drag source.
- **Accept mode reuse.** A pending "Link to…" accept request and an agent's `pbui_accept` are the same surface; only one can be pending. Mitigation: `accept()` already settles the previous request; document it.

### 13.2 Alternatives considered and rejected

- **Ship the toy's gesture surface as-is** (draggable ports on every tile in normal mode): rejected by the user's constraint and by D6.
- **Model everything as linked views** (one view, many placements): rejected because a linked view is one *content*, not one *input*; it cannot express follow, hold, or derive.
- **Push propagation with a `seen` set** (the prototype): rejected by D5.
- **A standalone "links" package with its own type system**: rejected by D1; two type graphs make explanation incoherent.

### 13.3 Open questions

1. **Instrument priority.** Resolved: D6 was confirmed in review (menu-first, connect mode second, no drop zones).
2. **Role subtyping** (report §16.9): is `semanticRole` a flat string or a small hierarchy? Flat until a demo needs otherwise.
3. **Collections** (report §16.10): `datum[]` selection ports are `cardinality: "many"`; a `many` result into a `one` port needs a selection operator. Defer until the datalab demo.
4. **Cross-workspace follow**: a follower whose source is in another workspace evaluates fine (terms key on view id) but the wire cannot be drawn; the portal marker is Phase 7. Should the badge say "Orders East · Fulfillment"? Proposed: yes.
5. **Undo granularity**: the workbench has `plan`/`applyPlan` but no history stack; products own undo. Should `pbui-workbench` gain a small history of applied plans? Out of scope here; note for a follow-up ticket.
6. **Server validation timing**: validate `pbui.links` on the server from Phase 2 (strict) or accept unknown payloads until Phase 7 (lenient)? Proposed: lenient; the client kernel refuses illegal states before they are written.

7. **Per-view contracts.** A plot tile's `selection` authority domain is the table it is bound to, which is a fact of the VIEW, while `PortContract` is declared per APP. Phase 1 declares `authorityDomain: "plot"`; Phase 5's identity check needs either a `refineContract(view)` hook on the declaration or a contract the shell computes from the document slots. Proposed: the hook, because the declaration stays the single place a reader looks.

## 17. Implementation record (2026-09-01)

All seven phases and the Phase 0 freeze were implemented on 2026-09-01 on branch `task/add-plot-editor`. The diary (`reference/01-investigation-diary.md`, steps 4–11) records each phase; this section records where the built system departs from the guide above, so a reader does not take the design text as the last word.

| Phase | Commit | What landed |
|---|---|---|
| 0 | `cc771ca` | golden tests: cross-workspace doc-bound de-dup, `describeWorkbench` snapshot |
| 1 | `4833208` | `links/types.ts`; `AppDescriptor.ports` replaces `bindings`/`docBound` in five packages; `pbui-ecommerce` scaffold on the gold-coin shop (D11) |
| 2 | `cfa91b2` | kernel (terms, evaluate, plan, apply, lifecycle, badge, invariants), `pbui.links`, runtime, verbs in the union, `usePort`, badge, port menus, "Link to…" family; shop scenes 1–2 |
| 3 | `cbcdf11` | `usePortCarry`, Mod+Shift+L, `PortRail`, `WireLayer`, wire menus; five real-pointer scenarios |
| 4 | `f9b2444` | `resolveShow`, the `show` verb, `view.open` with `viewId`, spawn + follow in one plan, `ShowChooser`; "Show details…" |
| 5 | `06b8c35` | `refineContract` per view (Q7), `identity.ts`, `LinkState`, merge/split policies as runtime effects, Ctrl-drag, double wire; shop shared selection and category filter |
| 6 | `4e73712` | relations on `LinkDeps`, `planDerive`, `port.derive`, `RelationPalette`; the shop's relations serve accept mode and derived bindings |
| 7 | `aede49f` | `describeWorkbench.links`, `CoordinationInspector`, `LinkAnnouncer`, agent test, Go `LinksDocumentValidator` |

### 17.1 Deviations from the design text

- **§6.8.1, badges for document slots.** `badgesOfView` hides a document-slot port whose only term is its slot constant (the tile title already names the document); it shows one only when an explicit term overrides the slot. The guide's `• Mass and yield` example is therefore not rendered by default.
- **§6.8.1, badge placement.** Badges render BESIDE the product's `<tile>` presentation, never inside it (user review: no nested frames).
- **§6.8.2, the family's fallback.** "Link to…" lists every compatible input on screen with no cap and no accept-mode fallback; unbound inputs have no badge to point at outside connect mode, so accept mode over `<port>` was not built. The rows bind `show` intents with candidate ids (Phase 4), as §8.6 asks.
- **§6.8.3, keyboard connect mode.** Tab/Enter navigation of the rails (§6.8.7) was not built; the rails are pointer-driven, with Escape.
- **§6.5, contexts.** Contexts come from `fallbackContext` and the new `drivesContext` declarations only; `context.create`/`context.drive` verbs and `kind: "context"` show candidates were not built.
- **§6.6, verbs.** `port.follow` has no `replace` flag; a follow onto a followed port replaces the source (the planner explains it). `port.unlink` policies are `freeze | clear | ambient`; the identity split policies are on `identity.remove` (`copy | history | reset`).
- **§6.8.3, identity instrument.** A merge-policy popover was not built: Ctrl-drag uses `prefer-left`; `planIdentityAdd` reports `cellsDiffer` for an instrument to use.
- **§11.1, table tiles.** The three table tiles carry no `table` document slot; only the plot does. The plot's `selection` authority is refined per view from its `table` slot (Q7).
- **§13.3 Q6.** Resolved lenient: the Go validator (`pkg/workbench/links.go`) checks the payload's SHAPE; semantic refusals stay in the client kernel.
- **§12.4.** The real-interaction suite is `packages/pbui-ecommerce/e2e/scenes.mjs` on the `playwright` library against Storybook (nine scenarios), not a `@playwright/test` project.

### 17.2 Kernel additions beyond the guide

- `refineContract(view)` on `PortDeclarationInput` (Q7), `drivesContext` on outputs, `LinkState` as the persisted whole (bindings, identity, classes, history), `RuntimeEffect`s returned by `applyLinkVerb`, an unbound OUT/INOUT port evaluating to its own emission, `relation.palette.open/close` browser-local verbs, `view.open { viewId }` so a plan can name a new view's ports.

### 17.3 Test inventory

- Kernel: 59 tests in `src/presentation/links/*.test.ts` (plus the no-React fence).
- pbui-workbench: 31 files, 281 tests (`links/*.test.tsx` cover follow/pin/resume, lifecycle, connect mode, show, identity, derive).
- pbui-ecommerce: 7 files, 35 tests, and 9 real-pointer scenarios.
- pbui-chat: 2 agent-linking tests; `pkg/workbench`: 3 Go tests.

## 14. File reference and reading order

Read in this order:

1. `pbui/src/presentation/actions/types.ts`, `resolve.ts`, `perform.ts` — the kernel shape the link kernel copies.
2. `pbui/src/presentation/createPbui.tsx:279-297, 590-830` — accept mode and the Presentation's click contract.
3. `pbui/src/presentation/translators/types.ts`, `resolve.ts` — the relation registry `Derived` reuses.
4. `pbui/proto/hyperslop/pbui/workbench/v1/workbench.proto` — the document; `contracts/workbench/v1/valid/linked-view.json` — a linked view.
5. `pbui/packages/pbui-workbench/src/apps.ts`, `verbs.ts` (`:87-120`, `:505-535`, `:830-961`), `store.ts`, `types.ts`, `createWorkbench.tsx` — the shell.
6. `pbui/packages/pbui-workbench/src/actions.ts`, `tileDescriptor.ts`, `components/Tile/Tile.tsx` — how a shared package contributes menus and chrome.
7. `pbui/src/chrome/TileFrame.tsx`, `useTileDrag.ts` (carry), `LauncherShell.tsx`, `pbui/src/surfaces.ts` — the chrome connect mode reuses.
8. `pbui/packages/pbui-workbench/src/rebalance/configDocument.ts`, `pbui/packages/pbui-plotscript/src/document.ts` — payload precedents for `pbui.links`.
9. `pbui/packages/pbui-sandbox/src/state.ts` — a runtime store keyed by view id.
10. `pbui/packages/pbui-chat/src/tools/workbenchTools.ts`, `acceptTool.tsx` — the agent path.
11. Toy: `lib/core.js`, `approaches/02-modifiers.html`, `06-palette.html`, `08-ambient.html`, `10-unlink.html`, `combined.html`.
12. Report §6–§8, §10–§11, appendix A–B; audit §3, §6–§11, §14, §17.
13. Bundle: `source_materials/pbui-agent-workbench(3).jsx:1723-1775, 4810-4950`; `p06-extracted/src/types.ts`, `contracts.ts`.
14. `pbui/ttmp/2026/09/01/PBUI-DATALAB-1--…/design-doc/01-datalab-in-pbui-….md` §6 (why datalab-ui is not migrated), §7.4 (the host shape `pbui-datalab` will share), §7.6 (its port table).

## 15. Glossary

- **Port**: a named, typed, directional input or output of an application view. Addressed as `viewId/name`.
- **Contract**: the seven normalized fields of a port that decide identity compatibility.
- **Binding term**: the expression that says where a port's value comes from (`Ambient`, `Constant`, `Follow`, `Alias`, `Derived`, `Hold`, `Unresolved`).
- **Effective binding**: the explicit term if declared, else the document slot as a constant, else the declared ambient fallback, else unresolved.
- **Context**: a named typed cell in a workspace that ports may read ambiently or drive.
- **Identity class (σ)**: a set of contract-compatible ports that name one shared cell.
- **Relation (ρ)**: a named direct translator from one type to another; a `Derived` term names one.
- **Hold**: a captured value plus the suspended term it interrupted; **detach** drops the suspension.
- **Link document**: the `pbui.links` payload in the workbench document holding all declarations.
- **Link runtime**: the non-persisted store of emitted values, contexts, class cells, and attended values.
- **Connect-management mode**: the transient surface in which tiles show port rails and wires and port-to-port drag is possible.
- **Show / target resolver**: the pure function that turns "show this value" into ranked candidates over existing ports, contexts, and spawnable placements.
- **Placement / view / tile**: a leaf of the split tree / a logical application instance / the rendered frame of one placement.

## 16. References

- Research report: `Projects/2026/08/27/PROJECT REPORT - PBUI Linked Tiles - Interaction Models, Formal Semantics, and an Architecture for Routing, Binding, and Coordination.md` (go-go-parc vault); bundle `report/` and `diagrams/`.
- Audit report: `Projects/2026/08/29/PROJECT REPORT - PBUI Linked Tiles - From Plausible Demos to Verified Interaction Semantics.md`; ticket `PBUI-LINK-UI-AUDIT` in the bundle's `ttmp/`.
- Interaction guide: bundle `ttmp/2026/08/28/PBUI-LINK-UI--…/design-doc/01-linking-interaction-design-and-implementation-guide.md`.
- Toy repository: `/home/manuel/code/wesen/2026-08-28--toy-actions-linked-pbui` (commits `0070ccc`, `6d25862`, `0093676`, `4b5f9e3`).
- Prototypes: bundle `source_materials/pbui-agent-workbench(3).jsx`, `P06PortBindingLab(1).jsx`, `p06-extracted/`.
- pbui tickets this design builds on: `PBUI-ACTIONS-1/2/3` (kernel), `PBUI-WORKBENCH-1` (shell), `PBUI-AGENT-2` (agent tools), `PBUI-REBALANCE-1` (carry/placement mode), `PBUI-HELP-001` (shared context matcher), `PBUI-PLOTSCRIPT-1` (document payload precedent), `PBUI-SANDBOX-1` (view-keyed runtime), `DATALAB-VIEW-001` (views vs placements).
- Literature the report grounds the operators in: CLIM presentation types; Beaudouin-Lafon's instrumental interaction; North & Shneiderman's Snap-Together Visualization; Weaver's Improvise coordination objects; Satyanarayan et al.'s declarative interaction; ThingLab/propagators; bidirectional lenses.
