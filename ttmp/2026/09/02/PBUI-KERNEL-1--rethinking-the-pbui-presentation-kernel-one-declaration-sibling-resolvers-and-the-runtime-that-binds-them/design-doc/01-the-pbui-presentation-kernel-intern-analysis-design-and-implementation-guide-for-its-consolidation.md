---
Title: 'The pbui presentation kernel: intern analysis, design, and implementation guide for its consolidation'
Ticket: PBUI-KERNEL-1
Status: active
Topics:
    - pbui
    - actions
    - design
    - architecture
    - frontend
    - onboarding
    - refactoring
DocType: design-doc
Intent: long-term
Owners: []
RelatedFiles:
    - Path: repo://docs/playbooks/building-a-new-hyperslop-systems-app-on-pbui.md
      Note: Stale kernel wiring sections to rewrite in Phase 6
    - Path: repo://packages/datalab-ui/src/pbui/runtime.tsx
      Note: Frozen consumer whose three call sites change mechanically (D7)
    - Path: repo://packages/pbui-chat/demo/src/pbui/actions.ts
      Note: 'Scopes stated twice and a JSON.stringify revision: the duplication evidence'
    - Path: repo://packages/pbui-ecommerce/src/createShop.ts
      Note: Builds the type graph a second time for the link kernel
    - Path: repo://packages/pbui-workbench/src/links/handlers.ts
      Note: Empty-graph fallback that makes every type isolated
    - Path: repo://src/presentation/actions/registry.ts
      Note: The only registry that validates a declaration against the graph; the kernel object builds on it
    - Path: repo://src/presentation/actions/vocabulary.ts
      Note: The agent view; gains edges and help kinds
    - Path: repo://src/presentation/context/match.ts
      Note: The shared front half every resolver rides on
    - Path: repo://src/presentation/createPbui.tsx
      Note: 'The runtime: options, context value, accept flow, click ladder, ObjectMenu; becomes a kernel consumer with onRefuse'
    - Path: repo://src/presentation/help/machine.ts
      Note: The model for runtime policy as a pure machine (D9)
    - Path: repo://src/presentation/help/registry.ts
      Note: Repeats the action registry's validation with its own code; fed the same graph twice
    - Path: repo://src/presentation/links/snapshot.ts
      Note: LinkDeps graph and relations, to be sourced from the kernel object (D6)
    - Path: repo://src/presentation/translators/types.ts
      Note: 'Translators: the typed contribution with no registry'
    - Path: repo://src/surfaces.ts
      Note: The page protocol left outside the kernel (D8)
ExternalSources: []
Summary: 'A map of the pbui presentation kernel as it exists (references, descriptors, type graph, scopes, predicates, the action resolver, translators, the help kernel, the link kernel, and the createPbui runtime), the evidence of how six consumers wire it and what they duplicate, the backlog three prior tickets left open, and a consolidation design: one product declaration that builds every registry with cross-validation, a snapshot helper that owns scopes and revision, one condition system, sibling resolvers kept distinct, and a runtime that surfaces refusals and explains itself.'
LastUpdated: 2026-09-02T14:30:00-04:00
WhatFor: Understand every part of the presentation kernel and the seams between them well enough to consolidate the product-facing declaration without changing resolution semantics.
WhenToUse: Before adding a fourth registry, a fifth snapshot convention, or a new consumer; when a product's kernel wiring is being written or reviewed; when PBUI-FACETS-1 or PBUI-ACTIONS-3 Phase C items are scheduled.
---


# The pbui presentation kernel: intern analysis, design, and implementation guide for its consolidation

> [!NOTE]
> This document remains the evidence-rich map of the current system and the first consolidation proposal. Its proposed API and implementation phases are superseded by `02-clean-cutover-composable-pbui-presentation-semantics-kernel-intern-analysis-design-and-implementation-guide.md`, which incorporates the imported composable-kernel research and the decision to coordinate a clean cutover across all PBUI consumers.

## 0. How to read this guide

The pbui presentation kernel is the part of `@hyperslop-systems/pbui` that decides what a typed value on screen is, what can be done with it, what it can be converted into, what help it carries, and how it binds to other values. It is spread over `src/presentation/` (about 13,000 lines including tests) and two page-wide coordination modules, `src/surfaces.ts` and `src/focus.ts`. It was built in four tickets over five weeks (PBUI-ACTIONS-1/2/3, PBUI-HELP-001/002, PBUI-LINK-1), each adding a sibling resolver beside the last. The resolvers are sound and tested. What has not been designed as a whole is the product-facing declaration: every product builds the same graph, the same scope list, the same registries, and the same snapshot conventions by hand, in slightly different ways, and three prior tickets recorded the consolidation items they did not have a puller for.

This guide is for an engineer who has to understand the whole kernel before changing any part of it. §1 is the answer in one page. §3 is the map, with file and line references into the repository at `/home/manuel/workspaces/2026-09-01/add-plot-editor/pbui`; read it before §5. §4 is the evidence of what consumers repeat and what prior tickets left open. §5 is the design, §6 the decisions with their alternatives, §7 the flows as pseudocode, §9 the phases, §10 the tests, §12 the file list.

Terms used throughout: a **reference** is `{ type, value }`; a **kernel** here means a pure resolver over an immutable snapshot (there are four: actions, acceptance, help, links); the **declaration** is everything a product hands the kernels (graph, scopes, predicates, descriptors, contributions, translators, help rules); the **runtime** is `createPbui`, the React layer that turns clicks into queries and verbs into `onPerform` calls.

## 1. Executive summary

**The kernel is four pure resolvers over one set of facts, and one React runtime.** The action resolver competes rules per action id and selects one (`src/presentation/actions/resolve.ts`). The acceptance resolver walks typed translator edges and returns a choice, never a guess (`translators/resolve.ts`). The help resolver accumulates every matching rule (`help/resolve.ts`). The link kernel evaluates binding terms, plans and applies link verbs, and ranks show targets (`links/`). All four read the same nominal type graph, the same scope stack, the same condition algebra, and the same `SelectionSnapshot`; the front half of matching is one shared function (`context/match.ts`). `createPbui` binds them to the DOM: it builds snapshots through the product's `snapshotFor`, resolves on hover, click and right-click, revalidates before performing, and hands a verb plus an envelope to the product's `onPerform` (`createPbui.tsx:334-1270`).

**What is missing is the declaration layer.** The registries are constructed separately and validated separately. The action registry validates contributions against the graph, scopes and predicates (`actions/registry.ts:81-179`); the help registry repeats the same validation with its own copy (`help/registry.ts:39-102`); translators are an array on `createPbui` validated by nobody (`createPbui.tsx:90`); the link kernel is handed a graph and a relation list a second time by the product (`packages/pbui-ecommerce/src/createShop.ts:46-51`). Predicates are accepted by two registries and declared by no product, and the acceptance path hardcodes an empty predicate map (`createPbui.tsx:357, 371`). Every product states its scope list twice (once to the registry, once inside `snapshotFor`) and computes its snapshot revision by hand in a different way (§4.1).

**The consolidation.** One declaration, `createPresentationKernel`, takes the graph definitions, scopes, predicates, descriptors, action contributions, translators and help rules, builds every registry, and cross-validates them once. One snapshot helper owns the scope list and derives the revision. One predicate map serves actions, translators and help. `createPbui` takes the kernel rather than seven options, gains an `onRefuse` callback so fresh-revalidation refusals reach a product, an introspection row that explains a menu, and a vocabulary that covers types, actions, edges and help kinds. The link kernel takes its graph and relations from the kernel object instead of a second copy. The four resolvers do not change: actions still compete, help still accumulates, acceptance still chooses, links still plan; every existing resolver test passes unchanged, which is the acceptance criterion.

**What this deliberately does not do.** It does not merge the resolvers into one (they answer different questions; §6 D2). It does not move `surfaces.ts`, `focus.ts` or input modality into the kernel; PBUI-HELP-002 set the rule that those converge on a shared protocol only when a third state machine makes the shape undeniable, and no third machine exists yet. It does not add condition operators, change the override ladder, or touch the workbench document protocol.

**Build order.** Phase 0 freezes menus, acceptance, help and vocabulary as goldens for every consumer. Phase 1 builds the kernel object with cross-validation and the shared predicate map. Phase 2 adds the snapshot helper. Phase 3 changes `createPbui` to take the kernel, adds `onRefuse`, and extracts the click ladder as a pure function. Phase 4 adds the introspection row and the extended vocabulary. Phase 5 aligns the link kernel. Phase 6 cuts the consumers over and rewrites the stale playbook sections. Phase 7 is the parked backlog (per-type order on inherited rules).

## 2. Problem statement and scope

### 2.1 The problem

Three things are true at once.

The resolvers are correct and deliberately narrow. Each was designed with invariants (permutation invariance, bind-only-selected, four-state availability, fresh revalidation, laziness of help resolution) and tests that hold them; PBUI-ACTIONS-3 states that it "changes what surrounds the kernel, not the kernel" and lists the pieces that are not to be touched (analysis doc `:137-142`).

The surroundings were never designed as one thing. Each ticket added its own factory beside the previous one, and each product repeats the wiring: the same five lines building a graph, a scope list and a registry appear in `packages/datalab-ui/src/pbui/actions.ts:803-806`, `packages/pbui-chat/demo/src/pbui/actions.ts:722-733`, `packages/pbui-ecommerce/src/presentation/actions.ts:57-60`, `src/presentation/Pbui.stories.tsx:48-51` and `src/components/organisms/FileBrowser/FileBrowser.stories.tsx:234-237`; the playbook prints the same shape as the thing to copy (`docs/playbooks/building-a-new-hyperslop-systems-app-on-pbui.md:719-740`).

The known consolidation items have owners but no schedule. PBUI-ACTIONS-3 Phase C lists six (one condition system, refusal surfacing, a product-definition builder, a snapshot revision helper, per-type inherited order, an introspection surface) and parks them until a consumer pulls. PBUI-FACETS-1 D9 pulls one of them (translators into the registry). PBUI-HELP-002 §13 names the click ladder and the accept flow as the next candidates for the pure-machine treatment. PBUI-ACTIONS-2 still has "team review of amendments A–D" open. PBUI-ACTIONS-PORT has three unchecked consumer migrations and exists as two ticket directories.

### 2.2 What "rethink" means here

Not a new theory. The theory (Ciccarelli's presentation model, CLIM presentation types and translators, predicate dispatch, context-oriented programming) is in PBUI-ACTIONS-1 and has been validated by implementation. The rethink is about the shape a product sees and the seams between the four resolvers: one declaration instead of seven options, one validation pass, one snapshot convention, one condition system, one vocabulary, and a runtime whose remaining implicit policy (the click ladder, the accept flow) is written down as pure functions the way the help surface already is.

### 2.3 In scope

- A map of every part of the kernel with its contract and its tests.
- Evidence of consumer wiring and duplication.
- The consolidation design: kernel object, snapshot helper, shared predicates, runtime changes, link-kernel alignment, vocabulary, introspection.
- Decision records, phases, tests, risks.
- The consumer cutover, including the mechanical adaptation of frozen `datalab-ui`.
- The playbook rewrite and the ticket hygiene items found on the way.

### 2.4 Out of scope

- Changing the override ladder, the availability quartet, ambiguity-as-data, fresh revalidation semantics, or the link kernel's terms and laws.
- Merging `surfaces.ts`, `focus.ts` and input modality into a shared protocol (deferred by rule; §6 D8).
- Multi-subject queries (compare, swap, link between two selections; PBUI-ACTIONS-1 §18 Q6).
- Asynchronous rules, translators or help (PBUI-HELP-001 deferred list).
- Facets themselves (PBUI-FACETS-1 builds on the kernel object this ticket produces; §5.9 records the seam).

## 3. Current-state architecture (evidence)

Each subsection ends with the fact the consolidation depends on.

### 3.1 References and descriptors

`src/presentation/types.ts:4-15` defines `PresentationValues` as any object type, `PresentationType` as its string keys, and `PresentationReference` as the discriminated union `{ type: Key; value: Values[Key] }`. A descriptor is representation only: `label(value, environment)`, optional `describe`, optional `tone` (`:26-46`). `createPresentationRegistry(descriptors)` (`registry.ts:29-74`) answers `descriptorFor`, `labelFor` (with a JSON fallback for undeclared types), `describeFor`, `toneFor`, `has`. Exact type only, no graph.

**Fact:** the descriptor registry is the one registry that does not take the graph, and it is the one whose fallback tolerates an undeclared type. Cross-validation can warn when a concrete graph type has no descriptor, which today produces a JSON label at runtime.

### 3.2 The type graph

`actions/typeGraph.ts:51-130`: `createPresentationTypeGraph(definitions)` with `{ id, parents?, abstract? }`, fail-fast on duplicates, unknown parents and cycles; BFS ancestor lists cached per type; an undeclared type is an isolated node at distance 0 (`:94-97`), documented as existing for the legacy adapter (`:43-44`). The header (`:6-14`) states the rule every later design depends on: the graph answers reachability and distance and never converts payloads.

Consumers: datalab declares 17 nodes with two abstract (`packages/datalab-ui/src/pbui/actions.ts:339-358`); the chat demo 19 concrete and no abstract (`packages/pbui-chat/demo/src/pbui/actions.ts:723-731`); the shop composes the workbench's two, the link kernel's three, one abstract and eight concrete (`packages/pbui-ecommerce/src/presentation/actions.ts:15-27`). The shop then builds a **second graph object** from the same definitions for the link kernel (`createShop.ts:48`, comment at `:46`). The workbench's link handlers fall back to an **empty graph** when the environment supplies none (`packages/pbui-workbench/src/links/handlers.ts:90`), which makes every type isolated and every reachability check degrade to equality.

**Fact:** the graph is the shared object of the whole kernel, and it is currently constructed up to twice per product and defaulted to empty in one shipping path.

### 3.3 Scopes, modes, capabilities, predicates: the facts

`SelectionSnapshot { revision, scopes, modes, capabilities, product }` (`actions/types.ts:47-57`) is the only state a resolver reads. Scopes are ordered inner to outer; a contribution's nearest active scope is its `scopeIndex` (`context/match.ts:29-40`). Modes and capabilities are sets tested by conditions. The condition algebra is four operations (`all`, `mode`, `capability`, `predicate`; `conditions.ts:19-40`), and named predicates are the only nodes that read `snapshot.product`, returning a full `Availability` (`:45-60`).

Consumers declare scopes twice: to the registry and inside `snapshotFor` (datalab `actions.ts:805` and `:101`; chat demo `:732` and `:116`); only the shop factors the list into a constant (`SHOP_SCOPES`, `actions.ts:29`, used at `:49` and `:59`). Nothing checks the two lists agree. No product declares a predicate; `predicates` is an accepted option of two registries with zero call sites, and the acceptance path passes `EMPTY_PREDICATES` (`createPbui.tsx:357, 371`), the deferral PBUI-ACTIONS-3 C1 names.

Revisions are computed five ways: a `::`-joined string of derived facts (datalab `:95-100`), `JSON.stringify` of a tuple including per-record timestamps (chat demo `:109-115`), three concatenated counters (shop `:48`), a constant (`FileBrowser.stories.tsx:296`), a single field (`Pbui.stories.tsx:82`). Each carries a hand-written "moves iff facts move" comment.

**Fact:** the facts layer has one type and no constructor. Scopes, revision and the empty sets are conventions each product re-implements.

### 3.4 The action kernel

Contracts in `actions/types.ts`: query with five invocations (`:26-36`), exact context narrowed and inherited context raw (`:62-79`), metadata with `primary` (`:88-111`), three contribution shapes (`:116-188`), `ResolvedAction` with provenance (`:197-227`), `PerformEnvelope` (`:242-248`), ambiguity, trace and result (`:250-288`). The resolver (`resolve.ts:65-354`): collect through `matchContext`, invocation and scope filters, status evaluation, family expansion, partition by action id, the ladder (distance, scope, priority, else ambiguity), bind only the unique available winner, presentation sort. The registry (`registry.ts:81-258`): validation (`:85-158`), guaranteed-collision rejection (`:160-179`), `diagnostics`, `listReachable`, `vocabulary`. Fresh revalidation (`perform.ts:25-47`) with four refusal codes. Five identities (PBUI-ACTIONS-2 §4.2): runtime type id, rule id, family id plus instance key, action id, and menu order as metadata only.

Shared-package contributions are exported fragments a product spreads: `workbenchTileContributions()` with `workbenchTypeDefinitions` and `workbenchScopes` (`packages/pbui-workbench/src/actions.ts:46-70`), `workbenchLinkContributions()` with `linkTypeDefinitions` (`links/contributions.ts:54, 74`), and the sandbox's `createGeneratedActionsFamily` with `subject: "*"` (`packages/pbui-sandbox/src/actions.ts:60-96`), the only `"*"` family in the repository, admitted by `registry.ts:119-127`.

Tests: `resolve.test.ts` (498 lines, the resolver table and permutation invariance), `resolve.freeze.test.ts`, `registry.test.ts`, `perform.test.ts`, `conditions.test.ts`, `typeGraph.test.ts`, `vocabulary.test.ts`.

**Fact:** the action registry is the only place that validates a declaration against the graph, and it validates only its own contributions.

### 3.5 Translators and acceptance

`translators/types.ts:11-53`: `PresentationTranslator { id, from, to, match, scopes?, when?, priority?, translate }`; two load-bearing rules (subtyping is substitutability with the original reference; ambiguity is a choice). `resolveAcceptance` (`resolve.ts:28-104`): direct satisfaction, then edges filtered by target, source, scope, condition and the request's filter, reduced by scope then priority. The runtime uses one function for highlighting and clicking (`createPbui.tsx:473-495`) and shows a chooser on a tie.

Translators are an array option on `createPbui` (`:90`, `:345`), never validated against the graph, absent from the vocabulary. Two products carry a "frozen conversion plus typed translator saying the same thing twice" pair (datalab `runtime.tsx:28-55`, chat demo `runtime.tsx:12-42`), both labelled as awaiting replacement.

**Fact:** translators are the one typed contribution with no registry, which is what PBUI-FACETS-1 D9 pulls.

### 3.6 The shared matcher and the help kernel

`context/match.ts:41-110` is the type → scope → condition front half extracted so the help kernel could reuse it without duplicating the resolver (PBUI-HELP-001 §6.2 "preserve action behavior byte-for-byte"). `resolveHelp` (`help/resolve.ts:24-141`) accumulates every matching rule's items with provenance, ordered but never suppressed; duplicate item ids throw. `createHelpRegistry` (`help/registry.ts:39-102`) takes `graph`, `scopes`, `predicates`, `contributions` and repeats the action registry's duplicate-id, unknown-scope and unknown-predicate checks with its own code. The help surface's open/close/arm policy is one pure machine (`help/machine.ts`, invariants I1–I4 fuzz-tested), placement is pure (`help/place.ts`, I5), and the React layer only translates DOM facts into events (`createPbui.tsx:300-315`, `:421-435`).

Only `datalab-ui` wires help (`packages/datalab-ui/src/pbui/help.tsx:92-102`).

**Fact:** the help registry is a second copy of the declaration-validation code, fed the same graph and scopes a second time; its machine is the model for the runtime's remaining implicit policy.

### 3.7 The link kernel

`links/` (PBUI-LINK-1): ports and contracts (`types.ts`), the seven binding terms (`terms.ts`), `LinkSnapshot` and `LinkDeps { graph, relations?, relation?, label? }` (`snapshot.ts`), evaluation, planning, the transition, identity classes, the show resolver, lifecycle, badges, invariants. It is a sibling of the action kernel in the sense of PBUI-ACTIONS-1 §14.10: same graph, same availability shapes, ambiguity as data, fresh revalidation by candidate id. Its `LinkSnapshot` is its own type (document revision, runtime revision, ports, bindings, identity, values); it does not extend `SelectionSnapshot`, although the PBUI-LINK-1 guide's §6.5 sketched it that way. The workbench hands it the graph and relations through `LinkEnvironment`, which the product fills by hand (`createShop.ts:42-51`).

**Fact:** the link kernel already consumes exactly the objects the kernel object would own (graph, relations); it needs a source, not a change.

### 3.8 The runtime: `createPbui`

Options (`createPbui.tsx:54-102`): `registry`, `defaultEnvironment`, `renderMenuHeader?`, `actions` (required since 0.8.0), `snapshotFor` (required), `translators?`, `help?`, `helpRenderers?`. The Provider (`:378-`) owns accept state, the chooser, the menu, the mouse-doc, and the help machine, and exposes `PbuiContextValue` (`:279-332`): accept/abort/isAcceptable/satisfyAccept, openMenu/closeMenu, chooser, mouseDoc, help dispatch, `perform(verb)` for chrome-built verbs, `resolve(query)`, `performAction(action)` with fresh revalidation and the envelope built from the fresh resolution (`:538-556`). `createPbui` returns `Provider`, `Presentation`, `ObjectMenu`, `MouseDocLine`, `AcceptBanner`, `AcceptChooser`, `ContextHelp`, `usePbui`, `registry` (`:1259-1269`).

`Presentation` (`:587-`) implements the click ladder inline: acceptable → settle and stop; `activate` → run and let bubble; unique available primary → `performAction`; else open the menu (`:700-745`, keyboard at `:780-800`), with a `PRESENTATION_HANDLED` mark against nested double handling (`:191`). The mouse-doc is computed lazily (`:657-666`). `ObjectMenu` (`:883-993`) resolves once with `invocation: "menu"` and renders a flat list keyed by candidate id.

Refusals from `performAction` are returned to the caller as `PerformResult` (`:538-556`) and delivered nowhere else; a menu row that refuses after revalidation is silent to the user (PBUI-ACTIONS-3 C2).

**Fact:** the runtime's policy is in three places: the help machine (pure, tested), the click ladder (inline in `Presentation`), and the accept flow (inline in the Provider). Only the first is written down as a transition function.

### 3.9 Page-wide coordination

`src/surfaces.ts` is a module-level Escape-surface stack (`useEscapeSurface(open)` answers "am I on top", `:106`); `src/focus.ts` captures and queues focus return (`:10, 31, 52`); `createPbui.tsx:121-130` tracks input modality globally. All three are module globals by design so that dialogs, menus, launcher shells, connect mode and the help card, mounted by different packages, share one stack.

**Fact:** these are the page protocol, not the kernel; PBUI-HELP-002 §13 defers their convergence until a third machine exists.

### 3.10 The agent view

`vocabularyOf(graph, contributions, version)` (`actions/vocabulary.ts:62-108`) emits types with direct parents and actions with subject, scopes, invocations and static labels; no verbs, no family instances, no translators, no help kinds. pbui-chat consumes a product's `PbuiInstance` (`packages/pbui-chat/src/createPbuiChat.tsx:50-52`) and routes verbs through a router (`:457-459`); `pbui_accept` enters accept mode from the agent (`tools/acceptTool.tsx:46-60`).

**Fact:** the vocabulary is generated from two of the four contribution kinds.

### 3.11 The consumers, summarized

| Package | Graph | Scopes | Predicates | Translators | Help | `snapshotFor.product` | `onPerform` |
|---|---|---|---|---|---|---|---|
| datalab-ui (`pbui/actions.ts:803-819`, `runtime.tsx:57-83`) | 17 nodes, 2 abstract | `["datalab","global"]` twice | none | 1 (+ frozen conversion) | yes (`help.tsx:92-102`) | environment + derived doc/field facts; revision `::`-joined | Redux dispatch loop via `actionsForVerb` (`WorkbenchProviders.tsx:54-66`) |
| pbui-chat demo (`demo/src/pbui/actions.ts:722-734`, `runtime.tsx:44-57`) | 19 concrete, 0 abstract | `["shop","workbench","global"]` twice | none | 1 (+ frozen conversion) | no | conversation, program, generated actions; revision `JSON.stringify` | `createVerbRouter` families of switches (`chat.ts:190-329`) |
| pbui-ecommerce (`presentation/actions.ts:15-66`, `runtime.tsx:16-28`) | workbench + link + 1 abstract + 8 | `SHOP_SCOPES` once | none | 3 from relations | no | host revision + link facts; revision three counters | guarded pass-through to `workbench.perform` (`ShopShell.tsx:26-28`) |
| pbui-workbench | exports fragments only (`actions.ts:46-70`, `links/contributions.ts:54,74`) | `["workbench"]` fragment | — | — | — | — | — |
| pbui-sandbox | contributes one `"*"` family (`actions.ts:60-96`) | `["global"]` | — | — | — | requires `generatedActions`/`generatedPrograms` in `product` | — |
| pbui-plotscript, pbui-editor | no kernel wiring | | | | | | |
| core stories (`Pbui.stories.tsx:48-88`, `FileBrowser.stories.tsx:234-302`) | 2 and 1 types | `["global"]` | none | none | one story | constant or single field | verb log |

**Fact:** the only wiring that differs by product is the type list, the contributions, and how `product` facts and `onPerform` are built. Everything else is the same shape repeated with different literals.

## 4. Gap analysis

### 4.1 Duplication across consumers (observed)

1. The graph, scopes and registry triple, five times (§2.1).
2. The scope list stated twice per product, unchecked for agreement (§3.3).
3. The revision computed five ways with the same comment (§3.3).
4. `modes: new Set()` and `capabilities: new Set()` filler in every product except the chat demo.
5. The runtime re-export block (`Provider`, `Presentation`, `ObjectMenu`, `MouseDocLine`, `AcceptBanner`, `usePbui`) repeated per product (datalab `runtime.tsx:85-91`, chat demo `:59-64`), prescribed by the playbook (`:337-342`).
6. The frozen-conversion plus translator pair, twice (§3.5).
7. Predicates declared by nobody, empty map hardcoded in acceptance (§3.3).
8. Two graph objects in the shop; an empty graph fallback in the workbench link handlers (§3.2).

### 4.2 Backlog left by prior tickets

| Item | Source | Status | This ticket |
|---|---|---|---|
| C1 one condition system (predicates shared by rules, translators, help) | ACTIONS-3 `:107-111` | open, "first conditional translator pulls" | Phase 1 |
| C2 refusal surfacing (`onRefuse`) | ACTIONS-3 `:113-115` | open, "codes exist since P2; delivered nowhere" | Phase 3 |
| C3 product-definition builder | ACTIONS-3 `:117-120` | open, "saves an afternoon per product" | Phase 1 as the kernel object |
| C4 snapshot helper with derived revision | ACTIONS-3 `:122-124` | open | Phase 2 |
| C5 per-type order on inherited rules | ACTIONS-3 `:126-130` | open | Phase 7, parked |
| C6 introspection surface ("why?") | ACTIONS-3 `:132-135` | open; `invocation: "introspection"` reserved | Phase 4 |
| translators into the registry | FACETS-1 D9 | proposed | Phase 1 |
| click ladder and accept flow as pure machines | HELP-002 §13 | recorded | Phase 3 (click ladder as a function; accept flow as a machine) |
| surfaces/focus/modality shared protocol | HELP-002 §13 | "when a third machine makes the shape undeniable" | not done (D8) |
| team review of amendments A–D | ACTIONS-2 `tasks.md:13` | open | closed by this guide's D1/D3 (§6) |
| turboproof PR0/PR1, agentlogic bump | ACTIONS-PORT | all open | Phase 6 names them; the kernel object makes turboproof's migration shorter |
| stale playbook §6 (0.6.0 signature, `disabledBecause`, "legacy engine still functions") | playbook `:333-336, 351-372, 775-777` | wrong at HEAD | Phase 6 |
| ACTIONS-PORT ticket in two directories; HELP-001 index says "tasks remain open" with all checked; ACTIONS-3 and HELP-002 index overviews are template stubs | ticket hygiene | | Phase 6 |
| ACTIONS-PORT design doc claims `createWorkbench` owns `createPbui` (`:74-80`) | factual error at HEAD | | Phase 6 corrects |

### 4.3 What must not change

From PBUI-ACTIONS-3 (`:137-142`) and PBUI-ACTIONS-1 §13.6: the resolver ladder; the availability quartet; ambiguity as data; fresh revalidation ("same action and same candidate must win, and the fresh verb is delegated"); serializable verbs; `onPerform` as the only effect boundary; adding an unrelated rule cannot change existing winners; permuting registry input cannot change results; no selected action is both available and has a reason; every performed action was uniquely resolved and freshly available. From PBUI-HELP-002: I1–I5 and structural laziness. From PBUI-LINK-1: the binding laws and D1–D11.

## 5. Design

### 5.1 Principles

1. **One declaration, one validation pass.** A product describes its presentation world once; every registry is built from that description and cross-checked against the others.
2. **Sibling resolvers stay siblings.** Actions compete, help accumulates, acceptance chooses, links plan. The shared part is the front half (`matchContext`) and the facts; the back halves are not merged.
3. **Facts have a constructor.** Scopes come from the declaration; the revision is derived unless the product supplies a cheaper one; the empty sets are defaults.
4. **Fail closed at construction, explain at resolution.** Every declaration error throws when the kernel is built; every runtime refusal reaches the product with a code and a sentence.
5. **The runtime holds no policy it cannot show.** What the help machine did for the card, a pure function does for the click ladder and a machine does for the accept flow.
6. **The agent reads the same declaration.** The vocabulary covers every contribution kind that is static.
7. **No compatibility layer.** Consumers are adapted (PBUI-ACTIONS-3's standing ruling); the frozen `datalab-ui` receives the mechanical call-site change and nothing else.

### 5.2 The kernel object

```ts
// src/presentation/kernel.ts (new)
export interface PresentationKernelDeclaration<Values, Environment, Facts, Verb> {
  readonly types: readonly PresentationTypeDefinition[];
  readonly scopes: readonly ScopeId[];
  readonly predicates?: readonly PredicateDefinition<Values, Facts>[];
  readonly descriptors: PresentationDescriptorMap<Values, Environment>;
  readonly actions: readonly ActionContribution<Values, Facts, Verb>[];
  readonly translators?: readonly PresentationTranslator<Values, Facts>[];
  readonly help?: readonly HelpContribution<Values, Facts>[];
  readonly version?: string | number;
}

export interface PresentationKernel<Values, Environment, Facts, Verb> {
  readonly graph: PresentationTypeGraph;
  readonly scopes: readonly ScopeId[];
  readonly predicates: ReadonlyMap<PredicateId, ProductPredicate<Values, Facts>>;
  readonly descriptors: PresentationDescriptorRegistry<Values, Environment>;
  readonly actions: ActionRegistry<Values, Facts, Verb>;
  readonly translators: readonly PresentationTranslator<Values, Facts>[];
  readonly help: HelpRegistry<Values, Facts> | null;
  /** The link kernel's view of the same declaration: graph, relations, applier. */
  readonly links: { graph: PresentationTypeGraph; relations: readonly RelationDefinition[]; relation(id, reference, snapshot): SerializableReference | undefined };
  /** Facts → snapshot, with the kernel's scopes and a derived revision (§5.3). */
  snapshot(facts: Facts, options?: SnapshotOptions): SelectionSnapshot<Facts>;
  /** Types, actions, edges, help kinds: everything static. */
  vocabulary(): PresentationVocabulary;
  diagnostics(): readonly KernelDiagnostic[];
  readonly version: string | number;
}

export function createPresentationKernel<Values, Environment, Facts, Verb>(
  declaration: PresentationKernelDeclaration<Values, Environment, Facts, Verb>,
): PresentationKernel<Values, Environment, Facts, Verb>;

/** Pre-typed factories, so the four generics are threaded once (ACTIONS-3 C3). */
export function definePresentation<Values, Environment, Facts, Verb>(): {
  actions: ReturnType<typeof defineActions<Values, Facts, Verb>>;
  help: ReturnType<typeof defineHelp<Values, Facts>>;
  predicate: typeof definePredicate<Values, Facts>;
  translator(t: PresentationTranslator<Values, Facts>): PresentationTranslator<Values, Facts>;
  kernel(declaration: PresentationKernelDeclaration<Values, Environment, Facts, Verb>): PresentationKernel<Values, Environment, Facts, Verb>;
};
```

`createPresentationKernel` builds the graph, then the predicate map (once), then the action registry and the help registry with the same graph, scopes and predicates, then validates the translators and the descriptors against the graph. The existing factories (`createActionRegistry`, `createHelpRegistry`, `createPresentationRegistry`) stay as the building blocks and keep their tests; the kernel calls them and adds the cross-checks.

Cross-validation, all fail-fast unless marked as diagnostics:

- Translator ids unique; `from` and `to` declared in the graph; `scopes` declared; `when` references known predicates; a translator whose `to` is abstract is rejected (a translation yields a concrete reference).
- A `facet` (PBUI-FACETS-1) on an edge whose `to` has no reachable contribution: diagnostic.
- A concrete, non-abstract graph type with no descriptor: diagnostic (`label` would fall back to JSON).
- A descriptor for a type not in the graph: error (a typo in one of the two lists).
- Help rules and action rules validated by their registries as today; the kernel guarantees both saw the same graph, scopes and predicates by constructing them.
- The link view's `relations` are derived from the translators (id, from, to, label); `relation()` applies the translator's `translate` with a snapshot built by `kernel.snapshot`.

### 5.3 The snapshot helper

```ts
export interface SnapshotOptions {
  readonly modes?: Iterable<ModeId>;
  readonly capabilities?: Iterable<string>;
  /** A cheap revision the product already tracks; absent ⇒ derived from `facts`. */
  readonly revision?: string | number;
}

kernel.snapshot(facts, options):
    revision = options.revision ?? stableSerialize(facts)      // sorted keys, no functions, throws on cycles
    return { revision, scopes: kernel.scopes, modes: new Set(options.modes ?? []), capabilities: new Set(options.capabilities ?? []), product: facts }
```

The derived revision makes "moves iff facts move" structural (ACTIONS-3 C4). The override exists because facts can be large: the shop's three counters and datalab's derived string are cheaper than serializing a host, and a product that tracks its own revision keeps it. A product's `snapshotFor(query, environment)` becomes one line: derive facts from the environment, call `kernel.snapshot`. The `Facts` type must be serializable when no `revision` is given; `stableSerialize` throws on a function or a cycle, which is the fail-closed rule applied to facts.

### 5.4 One condition system

The predicate map built in §5.2 is passed to the action registry, the help registry, and `resolveAcceptance`; `EMPTY_PREDICATES` in `createPbui.tsx:357` is deleted. A translator's `when` therefore evaluates against the product's predicates, which closes ACTIONS-3 C1 without a new mechanism. The condition algebra is unchanged (D5).

### 5.5 The runtime takes the kernel

```ts
export interface CreatePbuiOptions<Values, Environment, Facts, Verb> {
  readonly kernel: PresentationKernel<Values, Environment, Facts, Verb>;
  readonly defaultEnvironment: Environment;
  /** Facts for a query, from the environment; the kernel turns them into the snapshot. */
  factsFor(query: ActionQuery<Values>, environment: Environment): Facts | { facts: Facts; options?: SnapshotOptions };
  readonly renderMenuHeader?: …;
  readonly helpRenderers?: HelpRendererRegistry;
}

export interface PbuiProviderProps<Values, Environment, Verb> {
  environment?; onPerform(verb, envelope); onAccept?; actor?;
  /** Fresh-revalidation and facet refusals, with code and sentence (ACTIONS-3 C2). Absent ⇒ silent, as today. */
  onRefuse?(refusal: { code: string; because?: string; action?: ActionId; candidateId?: CandidateId; subject?: PresentationReference<Values> }): void;
}
```

`registry`, `actions`, `snapshotFor`, `translators` and `help` disappear as separate options; they are fields of the kernel. `snapshotFor` becomes `factsFor` because the kernel owns scopes and revision. The returned instance gains `kernel` beside `registry` (kept as an alias of `kernel.descriptors` for one release, then removed; D7).

`performAction` calls `onRefuse` before returning a refusal, with the fresh resolution's provenance. The status bar (`MouseDocLine`) shows the sentence for a few seconds by default, since a silent refusal was the C2 complaint.

### 5.6 The click ladder as a function, the accept flow as a machine

The click ladder in `Presentation` (`:700-745`, `:780-800`) becomes one pure function used by both the pointer and the keyboard paths:

```ts
export type ClickOutcome = { kind: "settle-accept" } | { kind: "activate"; bubble: true } | { kind: "perform"; action: ResolvedAction } | { kind: "open-menu" };
export function clickOutcome(input: { acceptable: boolean; activate: boolean; primary: ResolvedAction | null }): ClickOutcome;
```

The accept flow (pending request, chooser, settle, abort, a second request refused while one is pending, menu closes on request) becomes a machine in the shape of `help/machine.ts`:

```ts
export type AcceptSurface<Values> =
  | { kind: "idle" }
  | { kind: "pending"; request: AcceptRequest<Values> }
  | { kind: "choosing"; request: AcceptRequest<Values>; options: readonly AcceptanceOption<Values>[] };
export type AcceptEvent<Values> =
  | { type: "request"; request } | { type: "point"; resolution: AcceptanceResolution<Values> } | { type: "choose"; option } | { type: "dismiss-chooser" } | { type: "abort" } | { type: "escape" };
export function acceptStep(state, event): { state; effects: readonly AcceptEffect[] };   // effects: settle(reference) | resolve-null | close-menu
```

Invariants, fuzz-tested like I1–I4: one pending request at most; a chooser exists only under a pending request; `settle` is emitted exactly once per request; Escape with a chooser dismisses the chooser and keeps the request (today's behaviour, `createPbui.tsx:296`). The Provider's `accept`, `isAcceptable`, `satisfyAccept`, `abortAccept`, `chooseAcceptance`, `dismissAcceptChooser` become event dispatches.

### 5.7 Introspection

A dev-mode row at the end of every menu, "Why these actions?", bound to `invocation: "introspection"` (reserved since ACTIONS-2, never used). It renders the same-branch trace through `describeTraceEntry` (`explain.ts`) in a `ContextHelp`-style surface: which rules were reachable, which were shadowed by whom, which condition failed, which facet derived what (after PBUI-FACETS-1). It is gated by a Provider prop `introspection: boolean` so products ship it off. The trace is already emitted by the same branches that select (`resolve.ts:23-40`); this is a renderer, not a second resolver (C6).

### 5.8 The vocabulary

`kernel.vocabulary()` returns `{ version, types, actions, edges, helpKinds }`: the existing `vocabularyOf` output plus `edges` (translator id, from, to, label, facet flag) and `helpKinds` (the kinds help rules may emit, with the renderer registry's known kinds). Golden-tested per product as today.

### 5.9 The link kernel takes its deps from the kernel

`LinkEnvironment.graph` and `.relations`/`.relation` are filled from `kernel.links`; the shop's hand-mapping (`createShop.ts:42-51`) and the second graph object go away. The workbench's empty-graph fallback (`handlers.ts:90`) is removed: a workbench that links needs a graph, and a missing one is an error at construction, not an isolated-node world at runtime. `LinkSnapshot` stays its own type (D6), with `documentRevision` and `runtimeRevision` as today; the PBUI-LINK-1 guide's §6.5 sketch is corrected in its §17.

### 5.10 The shared fragments

`workbenchTypeDefinitions`, `workbenchScopes`, `workbenchTileContributions`, `linkTypeDefinitions`, `workbenchLinkContributions`, and the sandbox family stay exported fragments (ACTIONS-2 Amendment C). The kernel object gives them a home to be spread into once, and its diagnostics can report a fragment that was declared without its type definitions (a `tile` rule with no `tile` type), which today surfaces as a registry error naming the rule but not the missing fragment.

### 5.11 Consumers after the change

```ts
// packages/pbui-ecommerce/src/presentation/kernel.ts (after Phase 6)
const shop = definePresentation<Values, Environment, ShopFacts, ShopVerb>();
export const kernel = shop.kernel({
  types: [...workbenchTypeDefinitions, ...linkTypeDefinitions, { id: INSPECTABLE, abstract: true }, …],
  scopes: ["shop", ...workbenchScopes, "global"],
  descriptors,
  actions: [...workbenchTileContributions(), ...workbenchLinkContributions({ … }), ...shopRules],
  translators: shopTranslators(createShopRelations(host), host),
});
// runtime.tsx
createPbui({ kernel, defaultEnvironment, factsFor: (_q, env) => ({ facts: { hostRevision: env.host.revision(), links }, options: { revision: `${…}` } }) });
// createShop.ts
createWorkbench({ …, links: { environment: kernel.links } });
```

datalab-ui: `actions.ts:803-819` and `help.tsx:92-102` collapse into one kernel; `runtime.tsx:57-83` passes it; `snapshotForDatalab` returns facts and its existing `::` revision through `options.revision`. The chat demo likewise. No product's rules, descriptors, verbs or `onPerform` change.

## 6. Decision records

### Decision D1: One kernel object built from one declaration, over the existing factories

- **Context:** Seven separately constructed options (§3.8), the same wiring repeated five times (§4.1), two registries validating the same facts with separate code (§3.6), translators validated nowhere (§3.5), ACTIONS-3 C3.
- **Options considered:** (a) a `defineProduct` ergonomic builder that only threads generics (C3 as written); (b) a kernel object that builds and cross-validates every registry and owns scopes, predicates and the link view; (c) a single merged registry type replacing `ActionRegistry`, `HelpRegistry` and the descriptor registry.
- **Decision:** (b).
- **Rationale:** (a) removes the generic threading but leaves the validation gap and the two-graph problem. (c) would make every existing registry test and every consumer of `ActionRegistry` (pbui-chat's tools, the workbench's fragments) change for no semantic gain. (b) keeps the factories and their tests, adds the checks that only exist across registries, and gives the link kernel and the facet module a source.
- **Consequences:** `createPresentationKernel` and `definePresentation` in core; `createPbui` takes the kernel (D3). Must validate: every registry test unchanged; a cross-validation test per rule in §5.2.
- **Status:** proposed.

### Decision D2: The four resolvers are not merged

- **Context:** They share the matcher and the facts; they differ in what happens after a match (compete, accumulate, choose, plan).
- **Options considered:** (a) one resolver with a mode flag; (b) keep four back halves over one front half.
- **Decision:** (b), which is the ACTIONS-1 §14.10 and HELP-001 §6 position restated.
- **Rationale:** Competition needs a partition and a ladder; accumulation forbids suppression; acceptance returns options, not rows; planning returns verbs with refusal codes. A mode flag would make each invariant conditional. The cost of four back halves is small (`resolve.ts` 393 lines, `help/resolve.ts` 141, `translators/resolve.ts` 104).
- **Consequences:** The kernel object exposes four resolve entry points; nothing about their outputs changes. Must validate: the resolver tests are untouched by the ticket.
- **Status:** proposed.

### Decision D3: `createPbui` takes the kernel and a `factsFor`; hard cutover

- **Context:** ACTIONS-3's ruling of no compatibility; ACTIONS-2 Amendment A's precedent that entry points are added rather than signatures bent; three products and two stories call `createPbui` today.
- **Options considered:** (a) accept both the old option bag and the kernel; (b) kernel only, adapt every caller in one commit; (c) a second factory `createPbuiFromKernel` beside the old one.
- **Decision:** (b).
- **Rationale:** (a) and (c) are the two-action-models failure mode ACTIONS-2 §9 warns about, applied to construction. The callers are five and mechanical.
- **Consequences:** `snapshotFor` becomes `factsFor`; `translators`, `help`, `actions`, `registry` options deleted; the instance keeps `registry` as an alias for one release. `datalab-ui` receives the call-site change although frozen (D7). Must validate: Phase 0 goldens byte-identical after the cutover.
- **Status:** proposed.

### Decision D4: The snapshot revision is derived by default and overridable

- **Context:** Five hand-written revision conventions (§3.3); ACTIONS-3 C4; facts that can be large (a host, a conversation).
- **Options considered:** (a) always derive by stable serialization; (b) always require the product's revision; (c) derive unless overridden.
- **Decision:** (c).
- **Rationale:** (a) serializes a host on every hover; (b) keeps the convention that C4 exists to remove. (c) makes the structural rule the default and leaves cheap counters to products that have them.
- **Consequences:** `stableSerialize` in core with a cycle and function guard; a test that two snapshots of equal facts share a revision and unequal facts do not. Must validate: the shop keeps its counters and datalab its string, byte-identical.
- **Status:** proposed.

### Decision D5: One predicate map; no new condition operators

- **Context:** ACTIONS-3 C1; two registries accept predicates and none are declared; acceptance hardcodes an empty map; ACTIONS-2 §9 forbids speculative operators.
- **Options considered:** (a) share the map across actions, translators, help; (b) also add `any`/`not`.
- **Decision:** (a).
- **Rationale:** Sharing removes a documented deferral; operators are added only when a repository interaction needs them (invariant 18 in the condition module's header).
- **Consequences:** `EMPTY_PREDICATES` deleted; a translator `when` test. Must validate: `conditions.test.ts` unchanged.
- **Status:** proposed.

### Decision D6: `LinkSnapshot` stays a separate type; the link kernel takes graph and relations from the kernel object

- **Context:** The PBUI-LINK-1 guide sketched `LinkSnapshot extends SelectionSnapshot` (§6.5) but the implementation kept it separate (documentRevision, runtimeRevision, ports, bindings); the product hands the link kernel a second graph.
- **Options considered:** (a) unify the two snapshot types; (b) keep them separate and unify the deps (graph, relations).
- **Decision:** (b).
- **Rationale:** The link kernel's facts are the workbench document and the runtime, which the action snapshot does not have and should not carry; what they share is the graph and the relations, which the kernel object owns.
- **Consequences:** `kernel.links` as the `LinkEnvironment` source; the empty-graph fallback removed; the LINK-1 guide's §17 corrected. Must validate: the link kernel's 59 tests unchanged; the shop's linking tests unchanged.
- **Status:** proposed.

### Decision D7: `datalab-ui` receives the mechanical call-site change and nothing else

- **Context:** PBUI-LINK-1 D10 froze `datalab-ui` ("keeps building and passing its tests, never given ports"). D3 changes `createPbui`'s options.
- **Options considered:** (a) keep a compatibility path for `datalab-ui` alone; (b) change its three call sites (`actions.ts:803-819`, `help.tsx:92-102`, `runtime.tsx:57-83`) to build one kernel and pass it, with no other change.
- **Decision:** (b).
- **Rationale:** "Frozen" was defined as no new features; a compile fix that keeps its goldens byte-identical is maintenance the freeze allows. A single-consumer compatibility path is the pattern ACTIONS-3 deleted.
- **Consequences:** datalab's menu, acceptance and help goldens are the Phase 0 fence for the change. Must validate: `datalab-ui` tests green, no other file touched. This decision should be confirmed by the user before Phase 6.
- **Status:** proposed.

### Decision D8: `surfaces.ts`, `focus.ts` and input modality stay module-global and outside the kernel

- **Context:** HELP-002 §13 defers a shared transient-surface protocol until a third machine exists.
- **Options considered:** (a) fold them into the kernel object now; (b) leave them as the page protocol and document them.
- **Decision:** (b).
- **Rationale:** They coordinate across packages (dialogs, launcher, connect mode, help) and are correct; the accept machine of §5.6 is the second machine, not the third.
- **Consequences:** The guide documents them in §3.9 and stops there. Revisit when the accept machine lands and a third appears.
- **Status:** proposed.

### Decision D9: The click ladder becomes a pure function; the accept flow becomes a machine

- **Context:** HELP-002 §13 names both as the next candidates; the ladder is duplicated for pointer and keyboard (`createPbui.tsx:700-745, 780-800`); the accept flow's states are spread over four `useState`/`useRef` cells.
- **Options considered:** (a) leave as is; (b) function for the ladder, machine for accept; (c) machines for both.
- **Decision:** (b).
- **Rationale:** The ladder has no state of its own; a function with a table test is the right size. The accept flow has state and a chooser, which is the help machine's shape.
- **Consequences:** `clickOutcome` and `acceptStep` in core with tests; `Presentation` and the Provider become dispatchers. Must validate: every `createPbui.test.tsx` and `createPbui.actions.test.tsx` case unchanged.
- **Status:** proposed.

## 7. Pseudocode and key flows

### 7.1 Building the kernel

```text
createPresentationKernel(decl):
    graph      = createPresentationTypeGraph(decl.types)                 # throws: duplicate, unknown parent, cycle
    predicates = mapOf(decl.predicates)                                   # throws: duplicate id
    for t in decl.translators:
        assert unique(t.id); assert graph.has(t.from) and graph.has(t.to); assert !graph.isAbstract(t.to)
        assert every scope in t.scopes ∈ decl.scopes; assert referencedPredicates(t.when) ⊆ predicates
    for type in graph.types(): if !graph.isAbstract(type) and !decl.descriptors[type]: diagnostics.push(no-descriptor)
    for type in keys(decl.descriptors): if !graph.has(type): throw unknown-descriptor-type
    actions = createActionRegistry({ graph, scopes: decl.scopes, predicates: decl.predicates, contributions: decl.actions, version })
    help    = decl.help ? createHelpRegistry({ graph, scopes: decl.scopes, predicates: decl.predicates, contributions: decl.help, version }) : null
    descriptors = createPresentationRegistry(decl.descriptors)
    links   = { graph, relations: decl.translators.map(({id, from, to, facet}) => ({ id, from, to, label: facet?.label ?? id })),
                relation: (id, ref, snapshot) => decl.translators.find(t => t.id == id)?.translate(ref, snapshot) }
    return { graph, scopes, predicates, descriptors, actions, translators, help, links, snapshot, vocabulary, diagnostics, version }
```

### 7.2 One hover, one click, one right-click

```text
Presentation hover:      facts = factsFor(query, env); s = kernel.snapshot(facts); primary = actions.resolve({subject, invocation: primary}, s) → mouse-doc
Presentation click:      outcome = clickOutcome({ acceptable: acceptStep-derived isAcceptable(subject), activate: !!props.activate, primary })
                         settle-accept → dispatch(accept, { type: point, resolution })
                         activate      → props.activate.run(); bubble
                         perform       → performAction(primary)
                         open-menu     → openMenu(subject)
ObjectMenu open:         rows = actions.resolve({subject, invocation: menu}, s)          # or the faceted resolution after PBUI-FACETS-1
menu row click:          performAction(row)
performAction(stale):    fresh = actions.resolve(stale.query, kernel.snapshot(factsFor(stale.query, env)))
                         decision = evaluateFresh(stale, fresh)
                         if refused: onRefuse?({ code, because, action, candidateId, subject }); statusBar.flash(because); return decision
                         onPerform(decision.verb, envelope(fresh))
```

### 7.3 The accept machine

```text
acceptStep(state, event):
    idle      + request         → pending(request), effects [close-menu]
    pending   + request         → pending (unchanged), effects [resolve-null(new request)]     # one at a time, as today
    pending   + point(accepted) → idle, effects [settle(result)]
    pending   + point(ambiguous)→ choosing(options)
    pending   + point(none)     → pending
    choosing  + choose(option)  → idle, effects [settle(option.result)]
    choosing  + dismiss-chooser → pending
    choosing  + escape          → pending                                                       # chooser closes, request stays
    pending   + escape | abort  → idle, effects [resolve-null]
    idle      + anything else   → idle
```

### 7.4 Introspection

```text
"Why these actions?" row (invocation: introspection, shown when Provider.introspection):
    resolution = actions.explain(query, snapshot)          # same function as resolve; the trace is already there
    lines = resolution.trace.map(describeTraceEntry)       # grouped by action id; shadowed/ambiguous/unavailable with codes
    open ContextHelp-style surface anchored at the menu with the lines and the snapshot's revision and scopes
```

## 8. Diagrams

### 8.1 The kernel as it is and as it will be

```text
 TODAY                                                        AFTER
 product ─┬─ createPresentationTypeGraph(types)               product ─ definePresentation().kernel({ types, scopes, predicates,
          ├─ createActionRegistry({graph, scopes, preds, rules})          descriptors, actions, translators, help })
          ├─ createHelpRegistry({graph, scopes, preds, help})                 │
          ├─ createPresentationRegistry(descriptors)                          ▼
          ├─ translators[]  (validated nowhere)               ┌─────────────────────────────────────────────┐
          ├─ snapshotFor: scopes again, revision by hand      │ PresentationKernel                          │
          ├─ createPbui({registry, actions, snapshotFor,      │  graph · scopes · predicates · descriptors  │
          │             translators, help, helpRenderers})    │  actions (compete) · help (accumulate)      │
          └─ links: { graph AGAIN, relations mapped by hand } │  translators (choose) · links (plan)        │
                                                              │  snapshot(facts) · vocabulary() · diagnostics│
                                                              └──────────────┬──────────────────────────────┘
                                                                             │
                                                           createPbui({ kernel, factsFor, helpRenderers })   createWorkbench({ links: kernel.links })
```

### 8.2 One front half, four back halves

```text
                       matchContext(target, subject, snapshot, graph, predicates)
                                  type → scope → condition
            ┌──────────────────┬─────────────────┬──────────────────┬───────────────────┐
            ▼                  ▼                 ▼                  ▼                   ▼
   resolveActions        resolveHelp      resolveAcceptance     deriveFacets        planFollow / planDerive / resolveShow
   partition by action   accumulate       direct or edges       (FACETS-1)          reaches() + dependsOn() + ranking tuple
   ladder → one winner   order only       scope → priority      one per edge        refusal codes, ambiguity as options
   or ambiguity          never suppress   or chooser
```

### 8.3 Runtime policy, where it lives after Phase 3

```text
 help card      helpSurfaceStep (pure, I1–I4)           ← today
 accept flow    acceptStep (pure, one pending)           ← Phase 3
 click ladder   clickOutcome (pure function)             ← Phase 3
 page protocol  surfaces.ts · focus.ts · modality        ← unchanged (D8)
 React layer    translates DOM facts → events; renders state; holds no policy
```

## 9. Implementation phases

### Phase 0: freeze every consumer (1 day)

- Golden fixtures per product and story: resolved menu rows for each declared type on a representative snapshot (`action`, `candidateId`, `status`, `label`), acceptance results for each translator, help resolution where wired (datalab), `vocabulary()` JSON. Products: datalab-ui, chat demo, ecommerce, `Pbui.stories`, `FileBrowser.stories`.
- The ACTIONS-3 golden-fence rule applies: after every later phase the only accepted diff is additive (`edges`, `helpKinds` in the vocabulary).

### Phase 1: the kernel object (2 days)

- `src/presentation/kernel.ts`: `createPresentationKernel`, `definePresentation`, cross-validation (§7.1), `links` view, `diagnostics`; `kernel.test.ts` with one test per validation rule and a "no diagnostics on the shop's declaration" test.
- `translators` validated here; `PBUI-FACETS-1` D9 is satisfied by this phase.
- The predicate map shared (D5): `resolveAcceptance` receives `kernel.predicates`; `EMPTY_PREDICATES` deleted; a conditional-translator test.
- Exports in `presentation/index.ts`.

### Phase 2: the snapshot helper (½ day)

- `kernel.snapshot(facts, options)`; `stableSerialize` with guards; tests (equal facts share a revision; a function in facts throws; override respected).

### Phase 3: the runtime (2 days)

- `createPbui({ kernel, defaultEnvironment, factsFor, renderMenuHeader?, helpRenderers? })`; `PbuiProviderProps.onRefuse`; status-bar flash on refusal.
- `clickOutcome` function and `acceptStep` machine with table and fuzz tests; `Presentation` and the Provider become dispatchers.
- Existing runtime tests unchanged (`createPbui.test.tsx`, `.actions.test.tsx`, `.help.test.tsx`).

### Phase 4: introspection and vocabulary (1 day)

- The "Why these actions?" row and surface; `kernel.vocabulary()` with `edges` and `helpKinds`; goldens updated deliberately.

### Phase 5: the link kernel (½ day)

- `LinkEnvironment` from `kernel.links`; remove the empty-graph fallback in `packages/pbui-workbench/src/links/handlers.ts:90` (throw at `createWorkbench` when links are configured without a graph); correct the LINK-1 guide's §17.

### Phase 6: consumers and documentation (1–2 days)

- ecommerce: `presentation/kernel.ts`, `runtime.tsx`, `createShop.ts` (§5.11); delete the second graph.
- chat demo: `actions.ts`, `runtime.tsx`; delete the frozen conversion.
- datalab-ui: the three call sites only (D7); delete the frozen conversion.
- core stories: `Pbui.stories.tsx`, `FileBrowser.stories.tsx`.
- pbui-workbench and pbui-sandbox: no change (fragments); pbui-chat: `PbuiInstance` type gains `kernel`.
- Playbook: rewrite §6 (`:333-372`) and the tail of the kernel section (`:775-777`) to the kernel object; document `help`/`helpRenderers`, `onRefuse`, `introspection`.
- Ticket hygiene: merge the two PBUI-ACTIONS-PORT directories; correct its design doc's claim that `createWorkbench` owns `createPbui`; close PBUI-HELP-001's index status; fill the ACTIONS-3 and HELP-002 index overviews; check ACTIONS-2's "review amendments A–D" task with a pointer to D1/D3 here.
- ACTIONS-PORT's turboproof PR0/PR1 and the agentlogic bump are listed as the next consumers; they are not done here.

### Phase 7 (parked): per-type order on inherited rules (ACTIONS-3 C5)

- `order: number | (subjectType) => number`; pulled when a product needs a flat inherited menu to reorder per type.

## 10. Test strategy

- **Resolver tests are the fence.** `resolve.test.ts`, `resolve.freeze.test.ts`, `registry.test.ts`, `perform.test.ts`, `conditions.test.ts`, `typeGraph.test.ts`, `vocabulary.test.ts`, `translators/resolve.test.ts`, `help/*.test.ts`, `links/*.test.ts` are not modified by this ticket; a CI check diffs them against `main`.
- **Kernel construction tests.** One per cross-validation rule; permutation of the declaration's arrays does not change `diagnostics()` or `vocabulary()`.
- **Snapshot tests.** Revision derivation, override, guards.
- **Runtime machines.** `clickOutcome` table test over the eight input combinations; `acceptStep` fuzz over random event sequences holding: at most one pending request, chooser only under pending, exactly one settle or resolve-null per request.
- **Goldens.** Phase 0 fixtures byte-identical through Phase 6, additive-only in Phase 4.
- **DOM tests.** `onRefuse` receives the code after a forced revalidation refusal; the status bar shows the sentence; the introspection row renders trace lines.
- **Fences.** The no-React fence covers `kernel.ts`, `clickOutcome`, `acceptStep`.

## 11. Risks, alternatives, open questions

### 11.1 Risks

- **A large declaration object hides errors in one stack trace.** Mitigation: every validation error names the offending id and the field, and `diagnostics()` is a list, not a throw.
- **Deriving revisions from facts that were never meant to be serialized.** Mitigation: `stableSerialize` throws on functions and cycles; the override is documented as the escape for large facts; the shop and datalab keep theirs.
- **The cutover touches five callers in one commit.** Mitigation: Phase 0 goldens; each caller's change is mechanical; the workbench and sandbox fragments are untouched.
- **`datalab-ui` "frozen" is read as "untouchable".** Mitigation: D7 states the exception and asks for confirmation.
- **Introspection leaks non-disclosure reasons.** Mitigation: `hidden` entries are omitted from the surface unless `introspection: "full"`, matching `explain.ts`'s caveat that callers gate access.

### 11.2 Alternatives considered and rejected

- **One merged registry type** (D1c): rejected; every consumer of `ActionRegistry` would change for no semantic gain.
- **Compatibility options on `createPbui`** (D3a/c): rejected by the standing no-compatibility ruling and the two-models warning.
- **Always-derived revision** (D4a): rejected on cost.
- **A shared transient-surface protocol now** (D8a): rejected by the HELP-002 rule.
- **Machines for both click and accept** (D9c): the click ladder is stateless; a function suffices.

### 11.3 Open questions

1. **Confirm D7** (the mechanical change to `datalab-ui`) with the user before Phase 6.
2. **`factsFor` shape.** Returning `Facts` or `{ facts, options }`: the union keeps the common case one line; a product with modes needs the object. Alternative: two callbacks. Decide in Phase 3.
3. **Introspection gating.** A Provider prop, an environment flag, or a build-time constant? Proposed: Provider prop, so a story can show it.
4. **Should `kernel.vocabulary()` include ports?** Ports are declared on workbench applications, not on presentation types; proposed no, the workbench's `describeWorkbench` already reports them.
5. **PBUI-FACETS-1 sequencing.** Facets read `kernel.translators` and `kernel.predicates`; building facets after Phase 1 avoids a second `FacetDeps` shape. Proposed: FACETS-1 Phase 1 starts after KERNEL-1 Phase 1.
6. **Multi-subject queries** (ACTIONS-1 §18 Q6) remain out of scope; the kernel object does not preclude a two-subject query later, since `ActionQuery` is the only type that would change.

## 12. File reference and reading order

1. `src/presentation/types.ts:4-46`; `registry.ts:16-74`.
2. `src/presentation/actions/typeGraph.ts:6-50, 51-130`; `context/match.ts:29-110`; `context/types.ts`.
3. `src/presentation/actions/types.ts:26-111, 197-288`; `conditions.ts:19-60`; `availability.ts`.
4. `src/presentation/actions/resolve.ts:23-40, 65-354`; `registry.ts:68-258`; `perform.ts:25-47`; `vocabulary.ts:9-108`; `explain.ts`.
5. `src/presentation/translators/types.ts:11-53`; `translators/resolve.ts:28-104`.
6. `src/presentation/help/types.ts`, `registry.ts:20-102`, `resolve.ts:24-141`, `machine.ts:1-90`, `place.ts`.
7. `src/presentation/links/index.ts` (the export list), `snapshot.ts`, `plan.ts:38-58`, `resolveShow.ts:1-30`.
8. `src/presentation/createPbui.tsx:54-102` (options), `:121-130` (modality), `:191-278` (`Presentation` props and the nested-handling mark), `:279-332` (context value), `:334-375` (engine construction), `:378-560` (Provider state, accept, performAction), `:587-880` (`Presentation`), `:883-993` (`ObjectMenu`), `:1259-1269` (returned instance).
9. `src/surfaces.ts`; `src/focus.ts`.
10. Consumers: `packages/datalab-ui/src/pbui/{actions.ts:66-113, 339-358, 803-819; runtime.tsx:28-91; help.tsx:92-102}`, `src/store/applyVerb.ts:44-56`, `WorkbenchProviders.tsx:54-69`; `packages/pbui-chat/demo/src/pbui/{actions.ts:67-128, 722-734; runtime.tsx:12-64}`, `demo/src/chat.ts:190-329`, `packages/pbui-chat/src/createPbuiChat.tsx:50-52, 452-464`; `packages/pbui-ecommerce/src/presentation/{actions.ts:15-66; runtime.tsx:16-28}`, `createShop.ts:42-51`, `ShopShell/ShopShell.tsx:26-28`; `packages/pbui-workbench/src/actions.ts:25-70`, `links/contributions.ts:54, 74, 264-317`, `links/handlers.ts:90`; `packages/pbui-sandbox/src/actions.ts:44-96`.
11. Stories: `src/presentation/Pbui.stories.tsx:34-93, 172-232`; `src/components/organisms/FileBrowser/FileBrowser.stories.tsx:232-319`; `packages/datalab-ui/.storybook/withPbui.tsx:9-54`.
12. Playbook: `docs/playbooks/building-a-new-hyperslop-systems-app-on-pbui.md:333-378, 697-777`.
13. Prior tickets: PBUI-ACTIONS-1 design doc `:64-71, 87, 925-941, 1022-1029, 1309-1360`; PBUI-ACTIONS-2 guide `:252-266, 353-432, 557-598`; PBUI-ACTIONS-3 analysis `:23-32, 38-142`; PBUI-ACTIONS-PORT design doc `:65-91, 555-597`; PBUI-HELP-001 design doc `:52-64, 181-193, 979-1041`; PBUI-HELP-002 design doc `:335-355, 479-495`; PBUI-HARDEN-1 design doc `:41-63, 289-300`; PBUI-LINK-1 guide §6.5, §7, §17; PBUI-FACETS-1 guide D9.

## 13. Glossary

- **Kernel (a)**: one of the four pure resolvers. **Kernel (b)**: the `PresentationKernel` object this ticket introduces, which holds all four and the facts they share.
- **Declaration**: the product's types, scopes, predicates, descriptors, action contributions, translators and help rules.
- **Facts**: the product-owned immutable object a snapshot carries as `product`.
- **Snapshot**: `{ revision, scopes, modes, capabilities, product }`; the only state a resolver reads.
- **Front half**: type → scope → condition matching (`matchContext`). **Back half**: what a resolver does after a match.
- **Fragment**: a shared package's exported type definitions, scopes and contributions a product spreads into its declaration.
- **Envelope**: what `onPerform` receives beside the verb. **Refusal**: a perform that did not reach `onPerform`, with a code.
- **Machine**: a pure transition function over a small state, with fuzz-tested invariants; the help surface has one, the accept flow gets one.
- **Page protocol**: the module-global Escape stack, focus return and input modality that every transient surface shares.

## 14. References

- PBUI-ACTIONS-1 (theory and validation rules), PBUI-ACTIONS-2 (kernel implementation, amendments A–D, pitfalls), PBUI-ACTIONS-3 (post-legacy backlog, the no-compatibility ruling), PBUI-ACTIONS-PORT (consumer states), PBUI-HELP-001/002 (sibling kernel, machine and invariants), PBUI-HARDEN-1 (illegal states unrepresentable; `activate`, `disabledBecause`), PBUI-LINK-1 (the link kernel; D7 relations, D10 freeze), PBUI-FACETS-1 (facets; D9 translators in the registry).
- Ciccarelli, presentation-based user interfaces; CLIM presentation types and translators; predicate dispatch; context-oriented programming, as surveyed in PBUI-ACTIONS-1.
