---
Title: 'Clean-cutover composable PBUI presentation semantics kernel: intern analysis, design, and implementation guide'
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
    - Path: repo://src/presentation/actions/registry.ts
      Note: Current fail-fast action declaration validation retained inside the compiled model
    - Path: repo://src/presentation/context/match.ts
      Note: Current shared matcher evolved into the final selector with explicit universal and nullable scope provenance
    - Path: repo://src/presentation/createPbui.tsx
      Note: Current React assembly and fresh-action boundary replaced by the strict compiled-presentation runtime API
    - Path: repo://src/presentation/links/snapshot.ts
      Note: Distinct link world and narrow dependency boundary used by the model link-context projection
    - Path: repo://src/presentation/translators/resolve.ts
      Note: Current acceptance implementation migrated from translators to canonical exposed relations
    - Path: repo://ttmp/2026/09/02/PBUI-KERNEL-1--rethinking-the-pbui-presentation-kernel-one-declaration-sibling-resolvers-and-the-runtime-that-binds-them/sources/PBUI-Composable-Kernel-Research-Report.md
      Note: Imported formal model and prototype rationale incorporated and revised by this guide
    - Path: repo://ttmp/2026/09/02/PBUI-KERNEL-1--rethinking-the-pbui-presentation-kernel-one-declaration-sibling-resolvers-and-the-runtime-that-binds-them/sources/pbui-composable-kernel.patch
      Note: Validated prototype mined for predicates, relations, model assembly, binding IR, and identity quotient designs
ExternalSources: []
Summary: 'The implementation-ready clean-cutover design for PBUI presentation semantics: one compiled declaration assembled from named fragments; distinct known, default, and active scopes; one predicate and selector substrate; canonical typed relations with explicit interpreter exposure and named composition; explicit semantic revisions; sibling action, help, acceptance, and link interpreters; kernel-only React assembly; an internal binding-program IR and static checker; identity as a quotient; coordinated migration of all PBUI consumers; and the tests, sequencing, deletion list, and review gates required to land it without permanent compatibility infrastructure.'
LastUpdated: 2026-09-02T22:30:00-04:00
WhatFor: Give an engineer new to PBUI enough architectural, semantic, API, migration, and test detail to implement the composable presentation kernel and migrate every consumer in one coordinated release.
WhenToUse: Before implementing PBUI-KERNEL-1, PBUI-FACETS-1 relation integration, or a PBUI consumer migration; when reviewing whether a proposed abstraction belongs in shared presentation semantics, a specialist interpreter, the React runtime, or the workbench link world.
---


# Clean-cutover composable PBUI presentation semantics kernel

## 0. How to use this guide

This document is the implementation guide for the final PBUI presentation-semantics architecture under one important assumption: every PBUI consumer can move in a coordinated release. That assumption lets the final package have one construction API rather than carrying a permanent old/new runtime union. It does **not** mean every change should be one commit, and it does not justify changing persisted workbench documents. The implementation should be divided into reviewable semantic steps on an integration branch; the released result should contain only the new public model.

The guide supersedes the API proposal in `design-doc/01-the-pbui-presentation-kernel-intern-analysis-design-and-implementation-guide-for-its-consolidation.md`. The first guide remains the evidence-rich map of the current system. This guide incorporates the imported research report, the imported 31-file prototype patch, an independent source review, and an independent validation run against the current PBUI checkout.

A new engineer should read in this order:

1. §1 for the outcome and the reason for it.
2. §3 and §4 for the system that exists today.
3. §5 for the concepts and invariants that must survive.
4. §6 through §13 for the target architecture and APIs.
5. §17 and §18 before changing code.
6. §19 while implementing each phase.
7. §20 before declaring the cutover complete.

The words **declaration**, **model**, **interpreter**, **snapshot**, **relation**, **binding program**, and **identity quotient** have precise meanings in this guide. The glossary in §22 is authoritative.

### 0.1 Scope after the 2026-09-02 split

On 2026-09-02 the eleven phases in §18 were split across four tickets so that each ticket ships one reviewable semantic boundary:

| Ticket | Phases from §18 | Ships |
|---|---|---|
| **PBUI-KERNEL-1** (this ticket) | 0–7 and 11 | The compiled model, fragments, predicates and selector, canonical relations with exposure, acceptance over relations, the strict runtime, every consumer migrated, link dependency projection, and the release audit. This is the "consolidation boundary worth shipping" of §24. |
| PBUI-KERNEL-2 | 8 | Binding-program IR, static checker, evaluation migration, planner integration (§12.3–§12.7). |
| PBUI-KERNEL-3 | 9 | Identity quotient API and operation-specific port compatibility (§13). |
| PBUI-KERNEL-4 | 10 | Activation function, request-identified accept machine, refusal presentation, original-query introspection with disclosure (§14.4, §14.5, §15.3–§15.5). |

The prototype patch in `sources/` already contains first versions of the KERNEL-2 and KERNEL-3 code (`links/expression.ts`, `links/check.ts`, the identity quotient). KERNEL-1 applies the patch as its starting point and keeps that code where it is green, but does not extend it; finishing it is the later tickets' work.

Two decisions that the first guide left open were confirmed by the user on 2026-09-02 and are recorded as C16 and C17 in §17: the runtime cutover is hard (no compatibility option family), and the frozen `packages/datalab-ui` is touched, mechanically, so the workspace stays green.

The consumer inventory in §3.13 was redone the same day against every repository in the workspace. It found one large external consumer (rag-ttc) the first guide did not know about and corrected the roles of the two it named. Phase 6 and §20.3 were rewritten from that inventory.

---

## 1. Executive summary

PBUI already contains strong specialist mechanisms:

- nominal presentation types and descriptors;
- deterministic, ambiguity-aware action selection;
- typed acceptance and conversion;
- contextual help accumulation;
- persistent workbench bindings and derived links;
- identity classes;
- a React runtime that maps pointer and keyboard interaction to semantic actions.

The problem is not that these mechanisms are individually unsound. The problem is that a product constructs them separately. A product can build one graph for actions and another for links, provide predicates to one registry and not another, list legal scopes in one place and active scopes in another, expose a conversion to acceptance but not linking, and invent a different revision convention at every call site. The system has several good interpreters but no single validated statement of the product's presentation semantics.

The final design introduces one immutable **compiled presentation model** built from one declaration and reusable named fragments. The declaration owns the finite type universe, known scopes, default active scopes, predicates, descriptors, action rules, relation declarations, help rules, and revision policy. Construction creates one graph, one predicate registry, one action registry, one relation system, one optional help registry, a descriptor registry, vocabulary, and diagnostics.

Actions, help, acceptance, and linking remain siblings. They share semantic assets, not terminal behavior:

- actions compete per action id and choose at most one winner;
- help accumulates every matching item;
- acceptance first uses substitutability, then selects or exposes ambiguity among applicable relations;
- links persist and interpret binding programs against a separate link world.

The imported report's canonical relation system replaces translators as the foundational arrow. A relation is a named, typed, contextual partial function. It may be exposed deliberately to acceptance, facet derivation, persistent link derivation, or several of those interpreters. Composition is finite, named, and explicit; PBUI never discovers conversion paths automatically. Link evaluation receives a controlled projection from `LinkSnapshot` to `SelectionSnapshot`, so a relation sees the same product semantics in acceptance and linking without pretending those snapshots are the same type.

The clean cutover removes migration-only APIs from the final release:

- no legacy `createPbui` option family;
- no `PresentationTranslator`;
- no `relationFromTranslator`;
- no old acceptance resolver branch;
- no old link relation callback;
- no `ContextTarget`/`matchContext` compatibility aliases;
- no undeclared-type-as-isolated-node behavior;
- no legacy `"*"` subject spelling.

The persisted `PBUI-LINK-1` binding grammar remains stable. It compiles internally into a small program representation that separates sources, relation application, held state, and broken state. Evaluation, dependency extraction, cycle checking, static type checking, and normalization operate on that internal representation. Identity remains separate from directed binding and is exposed as a quotient of compatible ports into logical cells.

The implementation should land as a sequence of coherent commits on one integration branch, migrate all in-repository and external PBUI consumers against one prerelease artifact, and release as one coordinated API cutover. The imported prototype is a valuable starting implementation, not a patch to apply wholesale.

### 1.1 The final conceptual basis

The system should be explainable with six concepts:

```text
presentation semantics
    = types
    + contextual selectors
    + named relations
    + contextual contributions
    + binding programs
    + sibling interpreters
```

Identity adds one orthogonal concept:

```text
logical cells = compatible ports / declared identity equivalence
```

### 1.2 The most important corrections to the original proposal

1. A registry's **known scopes** are not a snapshot's **active scope stack**.
2. Revisions are semantic invalidation tokens, not generic serializations of product facts.
3. Translators and persistent derivations share relation identity and evaluation semantics, but each relation must state which interpreters may discover it.
4. A relation may declare an abstract codomain, but every actual output must be a declared concrete subtype of that codomain.
5. The aggregate should be called a compiled presentation **model**, reserving “kernel” for the pure specialist interpreters.
6. Reusable declarations should be named fragments, not parallel arrays that products must spread correctly.
7. Runtime context construction should have one explicit shape, not a bare-facts-or-symbol-wrapper union.
8. Introspection must explain the original query and follow an explicit disclosure policy; it is not a new invocation.

---

## 2. Goals, assumptions, and non-goals

### 2.1 Goals

The cutover must achieve all of the following:

- A product declares its presentation semantics once.
- Shared packages contribute one atomic fragment rather than disconnected arrays.
- Every structural declaration error is reported at construction.
- Actions, help, acceptance, facets, and links use one graph and predicate service.
- Every runtime snapshot has an explicit semantic revision.
- Active scopes remain dynamic and ordered inner-to-outer.
- Relations are validated, introspectable, explicitly composable, and selectively exposed.
- Link documents retain their existing serialized terms.
- Fresh-state refusals are observable through a structured callback.
- The final public API has no migration branch.
- Every existing resolver invariant and persisted-link law remains true.
- An intern can locate each implementation boundary and test it independently.

### 2.2 Assumptions

- PBUI and all first-party consumers can coordinate branches and release timing.
- A prerelease package, workspace override, or packed tarball can be used to test consumers before publication.
- Existing workbench documents may outlive the code release; their wire grammar must remain readable.
- Product facts are immutable for the duration of one resolution.
- Predicates and relation functions are pure from PBUI's perspective.
- `onPerform` and link-verb application remain the effect boundaries.

### 2.3 Non-goals

- One universal resolver with mode flags.
- Automatic relation path search.
- A general-purpose expression or scripting language in workbench documents.
- Replacing product/store/server authorization with snapshot capabilities.
- Making `LinkSnapshot` inherit from `SelectionSnapshot`.
- Rewriting `surfaces.ts`, focus return, or input modality into the presentation model.
- Introducing asynchronous actions, help rules, or relations in this cutover.
- Supporting arbitrary multi-result relations without an explicit cardinality design.
- Migrating the persisted link grammar merely because an internal IR is cleaner.
- Solving every future introspection or provenance problem in the first kernel commit.

---

## 3. Current system: repository map

This section describes observed code on the current branch. Proposed files from the imported patch are described later and are not present in `src/` until implemented.

### 3.1 Presentation references and descriptors

`src/presentation/types.ts:4-46` defines the basic product-indexed type family:

```ts
type PresentationReference<Values> = {
  [K in keyof Values]: { type: K; value: Values[K] }
}[keyof Values];
```

The string `type` is the runtime dispatch identity. The `value` remains in the concrete product representation associated with that key. Runtime inheritance does not coerce the payload into a parent-shaped value.

A descriptor is representation policy:

- `label(value, environment)` returns a React node;
- `describe(value, environment)` optionally returns an agent/inspector description;
- `tone` optionally selects presentation styling.

`src/presentation/registry.ts:16-74` compiles descriptors into exact-type lookup and supplies JSON-like fallbacks when a descriptor is absent. The descriptor registry does not perform action discovery and does not use the type graph.

### 3.2 Nominal type graph

`src/presentation/actions/typeGraph.ts:6-130` builds a finite directed acyclic graph. A definition contains an id, optional direct parents, and an `abstract` marker. Construction rejects duplicate ids, missing parents, and cycles. The graph provides:

- `has(type)`;
- `isAbstract(type)`;
- reflexive `isSubtype(type, parent)`;
- shortest ancestor `distance`;
- deterministic breadth-first `ancestors`;
- declared `types()` in declaration order.

The current graph treats an undeclared type as an isolated node in `ancestors`. That behavior exists for a legacy adapter. The clean cutover removes that open-world exception: every runtime reference type must be declared, while universal matching becomes an explicit selector.

### 3.3 Selection snapshots

`src/presentation/actions/types.ts:40-56` defines the immutable facts read by action, help, and acceptance resolution:

```ts
interface SelectionSnapshot<Facts> {
  revision: string | number;
  scopes: readonly ScopeId[];
  modes: ReadonlySet<ModeId>;
  capabilities: ReadonlySet<string>;
  product: Readonly<Facts>;
}
```

The fields have distinct roles:

- `revision` is cache/revalidation telemetry;
- `scopes` is the **active** inner-to-outer stack;
- `modes` describes transient interaction state;
- `capabilities` supports honest UI eligibility but is not authorization;
- `product` is immutable query-relevant product state.

Current products hand-build this shape. Datalab derives a `::`-joined token; the chat demo serializes a selected tuple; ecommerce combines host, document, and runtime counters. The common invariant is useful—revision changes when resolution-relevant facts change—but the computation is necessarily product-specific.

### 3.4 Conditions and predicates

`src/presentation/actions/conditions.ts:19-105` intentionally contains a small algebra:

- conjunction (`all`);
- mode on/off;
- capability present;
- named product predicate.

A predicate returns the full availability algebra rather than a Boolean, allowing actionable unavailability and non-disclosure. Conditions are pure. Unknown predicate ids fail closed.

Today action and help registries each compile predicate definitions into their own map. Acceptance receives an empty map in `src/presentation/createPbui.tsx`, so a conditional translator cannot use the product predicate declarations even though its type permits a condition.

### 3.5 Context matching

`src/presentation/context/match.ts:24-110` is the shared front half used by actions and help. It performs:

1. exact or inherited type matching;
2. nearest active scope selection;
3. condition evaluation;
4. provenance construction.

`activeScope` intersects a contribution's declared scopes with the snapshot's active stack and chooses the lowest stack index. This is why the declaration's legal scope universe cannot be substituted for runtime active scopes.

Acceptance currently implements related source, scope, and condition logic independently. The imported report promotes the common applicability record to `PresentationSelector`, while leaving interpreter-specific result behavior separate.

### 3.6 Action interpreter

The action contracts are in `src/presentation/actions/types.ts`. An action query contains a typed subject, invocation, and optional gesture. Contributions are:

- exact rules;
- inherited rules;
- runtime-expanded families.

`src/presentation/actions/registry.ts:68-258` validates declarations and constructs an `ActionRegistry`. It checks contribution identities, legal scopes, declared target types, predicate references, finite priorities/order, and guaranteed static collisions.

`src/presentation/actions/resolve.ts:65-354` implements the selection algebra:

1. collect type-reachable contributions;
2. filter invocation and active scope;
3. expand families;
4. evaluate conditions/tests;
5. remove `inapplicable` candidates while retaining unavailable and hidden overrides;
6. partition by conceptual action id;
7. select by shortest type distance;
8. then nearest scope;
9. then highest priority;
10. return ambiguity instead of using registration order;
11. bind a verb only for a unique available winner;
12. sort selected rows only for presentation.

The important distinction is that action rule id, family id, family-instance key, candidate id, action id, and display order are separate identities. The cutover must not collapse them.

`src/presentation/actions/perform.ts` performs fresh revalidation: the same candidate must still win and remain available before its fresh verb crosses `onPerform`.

### 3.7 Help interpreter

`src/presentation/help/types.ts` and `src/presentation/help/resolve.ts` define a sibling interpreter. Help rules share subject matching, scopes, conditions, predicates, and snapshots with actions, but every matching help rule contributes items. Type distance, scope, priority, and item order affect presentation order only; they do not suppress another help rule.

`src/presentation/help/registry.ts:20-102` duplicates much of the action registry's predicate and scope validation. The imported predicate registry removes the duplicate predicate compilation while preserving help-specific validation.

Help item kinds are emitted dynamically by `help(context)`. React renderer kinds are declared separately in `src/components/ContextHelp/registry.ts:20-81`. Therefore static vocabulary can list help rule declarations, but it cannot honestly infer every emitted help kind unless help declarations gain explicit `produces` metadata.

### 3.8 Acceptance and translators

`src/presentation/translators/types.ts:28-53` defines `PresentationTranslator` as a named source-to-target conversion with matching mode, scopes, condition, priority, and a partial `translate` function.

`src/presentation/translators/resolve.ts:28-104` resolves an accept request:

1. direct identity/subtyping satisfaction returns the original reference;
2. otherwise matching translators run;
3. request filters evaluate translated candidates;
4. candidates reduce by nearest scope and then priority;
5. one succeeds, zero returns `none`, and a genuine tie returns choices.

Translators currently have no registry, no cross-validation, and no static vocabulary. The relation system generalizes this exact semantic shape.

### 3.9 React assembly

`src/presentation/createPbui.tsx:54-102` currently accepts separately constructed descriptors, actions, snapshot builder, translators, optional help registry, and help renderers. The Provider owns:

- pending acceptance and chooser state;
- object-menu state;
- mouse documentation;
- help-surface machine state;
- environment and effect routing.

The runtime resolves on hover, click, keyboard activation, right-click, accept highlighting, menu opening, and fresh performance. The click ladder is duplicated between pointer and keyboard paths. The help surface is already driven by a pure state machine; acceptance still spans React state and a promise resolver ref.

A fresh action refusal is returned from `performAction` but otherwise disappears. The report's `onRefuse` addition is correct and should become mandatory or deliberately handled by every product during migration.

### 3.10 Page-wide coordination

`src/surfaces.ts` maintains the page's Escape-surface stack. `src/focus.ts` captures and returns focus. Input modality is tracked at module scope in `createPbui.tsx`. These coordinate dialogs, menus, help, launcher shells, and workbench surfaces across component ownership boundaries.

They do not belong in the compiled presentation model. Their shared page-level ownership is a different concern from type-directed presentation semantics.

### 3.11 Link world and persisted bindings

`src/presentation/links/snapshot.ts` defines `LinkSnapshot`, which contains document and runtime revisions, ports, bindings, identity classes, aliases, document slots, contexts, and lazy value readers. It is intentionally not a `SelectionSnapshot`.

`src/presentation/links/terms.ts` defines the persisted binding grammar:

```text
Ambient(context)
Constant(reference)
Follow(sourcePort, linkId)
Alias(classId)
Derived(sourceBinding, relationId, linkId)
Hold(reference, suspendedBinding)
Unresolved(diagnostic)
```

This is already an abstract syntax tree. `Derived` nests a computation around another binding; `Hold` stores both a frozen value and suspended behavior.

`src/presentation/links/evaluate.ts` interprets bindings by pull. `src/presentation/links/plan.ts` creates semantic link verbs and enforces operation-specific policy. `src/presentation/links/apply.ts` applies verbs. `src/presentation/links/invariants.ts` checks structural laws. The workbench supplies `LinkDeps`, including a graph and relation evaluator.

One shipping path currently defaults missing graph dependencies to an empty graph. Ecommerce constructs the same graph a second time for links. The target model removes both conditions: link-enabled workbenches receive graph and relation dependencies projected from the product's compiled presentation.

### 3.12 Identity

`src/presentation/links/identity.ts` compiles undirected identity declarations between compatible ports. Identity differs fundamentally from following:

- `Follow(q)` means “read from q” and creates a directed dependency;
- identity means “these ports denote one logical cell” and is symmetric and transitive.

The existing implementation already constructs classes and aliases. The report's quotient API gives this behavior the correct public terminology without changing the persisted `Alias` representation.

### 3.13 Consumers

The known in-repository consumers are:

- `packages/datalab-ui/src/pbui/`;
- `packages/pbui-chat/demo/src/pbui/`;
- `packages/pbui-ecommerce/src/presentation/`;
- `packages/pbui-workbench/src/actions.ts` and `src/links/`;
- `packages/pbui-sandbox/src/actions.ts`;
- core stories and runtime tests;
- `scripts/consumer-smoke.mjs`.

The `packages/pbui-chat` package itself is also a consumer: `createPbuiChat` takes the product's `PbuiInstance` and reads `pbui.registry` for descriptors, and the chat layer's own presentation types (conversation, widget, trace entry) are today merged into the product's `Values` by hand.

#### 3.13.1 External consumers (inventory of 2026-09-02)

Every repository in the workspace that depends on `@hyperslop-systems/pbui` was searched for presentation-layer symbols. The first guide named agentlogic and turboproof; the inventory corrects both and adds two.

| Repository | pbui version | What it uses | Exposure to this cutover |
|---|---|---|---|
| **rag-ttc** (`apps/workbench/web`) | 0.9.0 + pbui-workbench 0.3.1 + pbui-chat 0.3.1 | The full current kernel: 42-type graph with three abstract nodes, 46 rules plus the `workbenchTileContributions` spread, a facts type with a composed semantic revision, 7 unconditional translators with frozen wire ids, a help registry over the action graph, the whole `createPbui` option bag, `createPbuiChat` over the instance, and an accept bridge that calls `pbui.accept` from outside React. A vocabulary golden freezes rule, action and translator ids. No link kernel. | **The primary migration target.** Touches every symbol in §20.2. Mechanical (about five files) because it is already shaped like the target. Relation ids must equal the old translator ids; the vocabulary golden is regenerated deliberately. |
| **hyperblog** (`ui`) | 0.10.0 (current) | `createPbui` with `actions`, `snapshotFor`, and 4 translators. Its action registry is one `define.family("*")` over an **empty graph** that republishes each descriptor's `actions()` rows. | **The only consumer of the open-world exception** (§3.2, C9). Must declare its 10 types in the graph and use `anyDeclaredType`. Static revision stays. |
| **turboproof** (`ui`) | **0.6.0** | Pre-kernel descriptor `actions()` callbacks and `PresentationAction` rows, deleted in 0.8.0 (PBUI-ACTIONS-3 A1). Own tile tree, no pbui-workbench. | **Not a cutover participant.** Already two breaking releases behind. Its migration (descriptor actions to the compiled model) is a separate ticket in that repository, run once, after this cutover, straight to the final API. |
| **agentlogic** (`ui`) | 0.9.0 + pbui-workbench 0.3.1 | Components only (Text, AppBody, Callout, ...) and `createWorkbench`/`defineApp`. Tiles are plain React with store dispatches. No descriptors, verbs, or object menu. | **Indirect only**, through pbui-workbench's public entry points. If `createWorkbench` and `defineApp` keep their signatures, agentlogic needs a version bump and nothing else. |

Consequences for the design:

- pbui-workbench's `createWorkbench`/`defineApp` are a public boundary this cutover keeps stable.
- pbui-chat must export one **fragment** carrying its types, descriptors and any contributions, and must read descriptors from `pbui.presentation.descriptors` rather than a top-level `registry` alias.
- The "no unknown external consumer" exit criterion of Phase 0 is met by this table, not by a search of two named repositories.

---

## 4. What the imported research contributes

The source artifacts are:

- `sources/PBUI-Composable-Kernel-Research-Report.md`;
- `sources/pbui-composable-kernel.patch`.

The report develops a model around a finite type order, contextual selectors, typed partial relations, binding programs, identity quotients, and sibling interpreters. The patch implements a credible prototype across 31 source files.

### 4.1 Independently demonstrated properties

Against PBUI commit `f2cac0b66028a3b41e50b328d08860c4bc87b783`:

- the patch applies cleanly;
- `git diff --check` passes;
- root TypeScript typechecking passes;
- all 347 root tests pass;
- recursive workspace typechecking passes;
- package suites passed until an unrelated existing pbui-chat CSS-policy failure stopped recursive execution.

These results establish that the prototype is technically coherent enough to mine. They do not establish browser behavior, performance, external-repository compatibility, or correctness of every new semantic choice.

### 4.2 Results accepted directly

- Explicit/product-derived revision tokens.
- One shared predicate registry.
- A first-class selector and applicability provenance.
- Canonical named relations.
- Explicit named composition with no inferred paths.
- Controlled link-world-to-presentation-world projection.
- Detailed relation outcomes.
- Binding grammar compiled into an internal IR.
- Structural dependency extraction and a static binding checker.
- Identity quotient terminology.
- Fresh refusal callback.
- Preservation of persisted binding terms.

### 4.3 Results changed for the clean cutover

- Remove every compatibility branch from the final API.
- Add relation interpreter exposure rather than offering every relation everywhere.
- Permit abstract codomains while requiring concrete runtime outputs.
- Make known/default/active scope distinctions explicit in names and types.
- Remove synthetic `"__unscoped__"` provenance.
- Replace the symbol-marked facts union with one explicit context input.
- Add first-class named fragments.
- Keep binding-program internals private until an external consumer requires them.
- Use one public model constructor rather than three overlapping spellings.

### 4.4 Prototype/API mismatches to resolve

The report and patch are not identical specifications:

- the report's public sketch uses `definePresentation({...}).create()` while the patch uses `definePresentation<>().kernel({...})`;
- the report mentions `checkProgram`, while the patch publicly exports `checkBinding` and keeps program inference internal;
- the report argues for compatibility, while this ticket now assumes a clean cutover;
- the patch exposes all relations to acceptance and linking;
- the patch still names `AcceptanceOption.translator`.

This guide resolves those differences for implementation.

---

## 5. Semantic model and invariants

### 5.1 Type universe

Let `T` be the finite set of declared runtime presentation types. The directed parent graph defines a partial order `≤`, where `A ≤ B` means A is B or transitively inherits from B.

Required laws:

- Reflexivity: `A ≤ A`.
- Transitivity: `A ≤ B` and `B ≤ C` implies `A ≤ C`.
- Antisymmetry over declared ids follows from acyclicity.
- Unknown types are errors, not isolated nodes.
- Runtime payloads are never coerced by graph traversal.

Abstract types may organize behavior and relation codomains. A runtime reference must always carry a concrete declared type.

### 5.2 Context

A selection world is:

```text
Σ = revision × activeScopes × modes × capabilities × productFacts
```

`revision` answers whether prior resolution telemetry may be compared or cached. It is not state equality and not authorization.

`activeScopes` is ordered. The nearest active scope has semantic precedence. Known scopes are compile-time declaration vocabulary; default active scopes are product convenience; active scopes are per-query runtime facts.

### 5.3 Selector

A selector answers whether a declaration applies to one reference in one snapshot. It contains:

- a declared type target or an explicit universal target;
- exact or inherited matching;
- zero or more eligible scopes;
- an optional condition;
- priority metadata.

A match returns provenance rather than only `true`:

```ts
interface SelectorMatch {
  declaredType: RuntimeTypeId | null; // null for universal target
  concreteType: RuntimeTypeId;
  typeDistance: number;
  scope: ScopeId | null;              // null for scope-universal match
  scopeIndex: number | null;
  priority: number;
}
```

An empty selector scope list means scope-universal. Actions and help may continue requiring explicit scopes as a domain-specific authoring rule. Relations may be universal.

### 5.4 Availability

Preserve the existing four-state action availability semantics:

- available;
- unavailable with actionable reason;
- inapplicable, allowing a fallback;
- hidden, suppressing fallback without disclosure.

Do not flatten these into Boolean eligibility. Do not expose hidden reasons through ordinary introspection.

### 5.5 Relations

A direct relation is a named contextual partial function:

```text
relation ρ: Reference<A> × SelectionSnapshot<Facts>
          → Reference<B-subtype> | empty
```

Required laws and checks:

- relation id is unique;
- source and codomain are declared;
- source matching is exact or inherited;
- scopes and predicates are declared;
- priority is finite;
- thrown callbacks become structured errors;
- empty output is ordinary partiality, not an exception;
- output type is declared and concrete;
- output type reaches the declared codomain;
- execution occurs once per evaluated candidate;
- discovery is limited by declared interpreter exposure.

### 5.6 Explicit composition

A composition names a finite sequence of relation ids. Registration validates:

- non-empty steps;
- every step exists;
- composition declarations are acyclic;
- adjacent codomains/domains are compatible;
- the final codomain is inferred;
- the composition's own selector and exposure are valid.

No path is inferred from adjacency. Declaring `A → B` and `B → C` does not make `A → C` public. A product must name the semantic path.

Exposure controls **discovery**, not internal execution. A public composition may reference internal direct relations that are not independently offered to acceptance or links.

### 5.7 Sibling interpreter invariants

Actions:

- registration order never selects a winner;
- unavailable and hidden candidates remain in override competition;
- ambiguity is returned;
- binding occurs only for the unique available winner;
- perform uses a fresh winner and fresh verb.

Help:

- every applicable rule contributes;
- ordering never suppresses another rule;
- resolution remains lazy in the React runtime.

Acceptance:

- subtyping preserves the original reference;
- relations run only when direct satisfaction fails;
- only acceptance-exposed relations participate;
- nearest scope then highest priority reduce candidates;
- a tie is an explicit choice.

Links:

- persisted programs are declarations, not cached values;
- evaluation remains pull-based;
- plans are pure;
- apply revalidates against fresh state;
- rejected application has no effect;
- only derivation-exposed, persistence-safe relations enter link palettes.

### 5.8 Identity invariants

- Identity declarations are undirected.
- Only compatible ports enter one class.
- Edge order and duplicate declarations do not change the partition.
- Directed dependencies do not create identity.
- Persistent class lineage remains deterministic.
- A logical cell is resolved before reading aliased values.

---

## 6. Target module architecture

### 6.1 Package layout

```text
src/presentation/
├── model/
│   ├── types.ts                 declaration, fragment, compiled model
│   ├── define.ts                typed authoring helpers
│   ├── compile.ts               merge, validate, construct
│   ├── vocabulary.ts            static projections
│   ├── diagnostics.ts           structured compile diagnostics
│   ├── model.test.ts
│   └── index.ts
├── context/
│   ├── predicates.ts            one PredicateRegistry
│   ├── selector.ts              matchSelector and provenance
│   ├── types.ts
│   └── selector.test.ts
├── relations/
│   ├── types.ts                 declarations, exposure, outcomes
│   ├── define.ts                typed helpers
│   ├── system.ts                validate, prepare, evaluate, compose
│   ├── system.test.ts
│   └── index.ts
├── actions/                     existing specialist interpreter
├── help/                        existing specialist interpreter
├── acceptance/                  relation-based acceptance
├── links/
│   ├── program.ts               internal binding IR
│   ├── check.ts                 type/dependency/cycle checker
│   └── ...existing modules
├── createPbui.tsx               model-only React assembly
└── index.ts
```

Use `model` rather than `kernel` for the aggregate. Existing docs may still describe the pure action/help/link algorithms as kernels.

### 6.2 Dependency direction

```text
                         product declarations
                                  │
                                  ▼
                    model/compile.ts
                     │      │      │
                     │      │      └──────── descriptors
                     │      └─────────────── relations
                     └────────────────────── context primitives
                                  │
                ┌─────────────────┼──────────────────┐
                ▼                 ▼                  ▼
             actions            help            acceptance
                │                 │                  │
                └─────────────────┴──────────┬───────┘
                                            ▼
                                      createPbui

        model.graph + filtered model.relations
                         │
                         ▼
                   model.linkDeps
                         │
                         ▼
                    link kernel
```

The model can depend on specialist registry constructors. Specialist interpreters must not import React. Links receive narrow dependencies and do not import the whole model.

---

## 7. Public declaration and fragment API

### 7.1 Typed authoring entry point

Expose one ergonomic entry point:

```ts
const p = definePresentation<Values, Environment, Facts, Verb>();
```

It returns typed helpers and exactly one compiler method:

```ts
interface PresentationDefinitionTools<Values, Environment, Facts, Verb> {
  actions: ReturnType<typeof defineActions<Values, Facts, Verb>>;
  help: ReturnType<typeof defineHelp<Values, Facts>>;
  predicate(id, evaluate): PredicateDefinition<Values, Facts>;
  relation(input): DirectRelation<Values, Facts>;
  composition(input): ComposedRelation;
  fragment(input): PresentationFragment<Values, Environment, Facts, Verb>;
  create(input): CompiledPresentation<Values, Environment, Facts, Verb>;
}
```

`createPresentationKernel` and `.kernel(...)` should not be additional public construction paths. A lower-level internal `compilePresentation` function is fine.

### 7.2 Fragment declaration

```ts
interface PresentationFragment<Values, Environment, Facts, Verb> {
  readonly id: string;
  readonly types?: readonly PresentationTypeDefinition[];
  readonly knownScopes?: readonly ScopeId[];
  readonly predicates?: readonly PredicateDefinition<Values, Facts>[];
  readonly descriptors?: PresentationDescriptorMap<Values, Environment>;
  readonly actions?: readonly ActionContribution<Values, Facts, Verb>[];
  readonly relations?: readonly RelationDeclaration<Values, Facts>[];
  readonly help?: readonly HelpContribution<Values, Facts>[];
}
```

A product root is also a fragment plus runtime defaults:

```ts
interface PresentationDeclaration<Values, Environment, Facts, Verb>
  extends PresentationFragment<Values, Environment, Facts, Verb> {
  readonly include?: readonly PresentationFragment<Values, Environment, Facts, Verb>[];
  readonly defaultActiveScopes?: readonly ScopeId[];
  readonly revision?: (facts: Readonly<Facts>) => string | number;
  readonly version?: string | number;
}
```

Merge rules:

- preserve fragment order only for vocabulary/display projections;
- reject duplicate fragment ids;
- reject duplicate type, predicate, relation, help-rule, and contribution ids;
- reject conflicting descriptors;
- deduplicate identical known scopes while preserving first declaration order;
- retain fragment origin in every prepared declaration and diagnostic;
- run semantic resolver tests for permutation independence where ordering must not matter.

### 7.3 Example

```ts
const p = definePresentation<ShopValues, ShopEnvironment, ShopFacts, ShopVerb>();

const workbenchFragment = createWorkbenchPresentationFragment(p, {
  links: snapshot => snapshot.product.links,
});

const shopFragment = p.fragment({
  id: "shop",
  types: [
    { id: "inspectable", abstract: true },
    { id: "order", parents: ["inspectable"] },
    { id: "customer", parents: ["inspectable"] },
  ],
  knownScopes: ["shop", "global"],
  descriptors,
  actions: shopActions,
  relations: shopRelations,
});

export const shopPresentation = p.create({
  id: "shop.presentation",
  include: [workbenchFragment, shopFragment],
  defaultActiveScopes: ["shop", "workbench", "global"],
  revision: facts => facts.revision,
  version: 1,
});
```

---

## 8. Scope, snapshot, and revision API

### 8.1 Snapshot input

Use one explicit shape:

```ts
interface PresentationContextInput<Facts> {
  readonly facts: Facts;
  readonly revision?: string | number;
  readonly activeScopes?: readonly ScopeId[];
  readonly modes?: Iterable<ModeId>;
  readonly capabilities?: Iterable<string>;
}
```

The compiled model exposes:

```ts
snapshot(input: PresentationContextInput<Facts>): SelectionSnapshot<Facts>;
```

Resolution order:

```text
revision = input.revision
        ?? declaration.revision?.(input.facts)
        ?? throw missing-semantic-revision

activeScopes = input.activeScopes
            ?? declaration.defaultActiveScopes
            ?? throw missing-active-scopes

validate revision is string or finite number
validate active scopes are declared and nonrepeating
materialize read-only mode/capability sets
freeze or defensively copy arrays owned by the model
return SelectionSnapshot
```

### 8.2 Why no structural serialization

Generic serialization is wrong because:

- product facts may contain functions, sets, maps, class instances, or lazy readers;
- irrelevant data can invalidate results;
- relevant external data can be omitted;
- serialization cost occurs on hover and menu resolution paths;
- serializer behavior becomes accidental cache semantics.

A product may opt into a JSON-derived revision in its own code when its facts are intentionally small and JSON-shaped. PBUI does not make that choice.

### 8.3 Scope validation

Compile-time known scopes and runtime active scopes must be named differently throughout code, errors, and docs. Tests must include:

- active subset accepted;
- active order preserved;
- undeclared active scope rejected;
- duplicate active scope rejected;
- missing active stack rejected when no default exists;
- a local scope outranks an outer scope;
- a rule in an inactive known scope does not participate.

---

## 9. Predicate and selector substrate

### 9.1 Predicate registry

Create exactly one prepared registry:

```ts
type PredicateRegistry<Values, Facts> = ReadonlyMap<
  PredicateId,
  ProductPredicate<Values, Facts>
>;
```

The model passes the same object to actions, help, and relations. Low-level registry constructors may accept a prepared predicate registry for direct unit tests, but product code should not assemble registries independently after the cutover.

### 9.2 Selector target

Replace string wildcard behavior with an explicit union:

```ts
type SelectorSubject =
  | { kind: "type"; type: RuntimeTypeId; match: "exact" | "subtypes" }
  | { kind: "any-declared-type" };

interface PresentationSelector {
  readonly subject: SelectorSubject;
  readonly scopes: readonly ScopeId[];
  readonly when?: Condition;
  readonly priority?: number;
}
```

Typed action/help helpers can continue presenting convenient `exact(type, ...)` and `inherited(type, ...)` APIs. A family that applies to every type uses `anyDeclaredType`, not `"*"`.

### 9.3 Matching pseudocode

```text
matchSelector(selector, reference, snapshot, model):
    assert model.graph.has(reference.type)

    if selector.subject is any-declared-type:
        distance = 0
        declaredType = null
    else if exact:
        reject unless reference.type == selector.subject.type
        distance = 0
        declaredType = selector.subject.type
    else:
        distance = graph.distance(reference.type, selector.subject.type)
        reject if distance is infinite
        declaredType = selector.subject.type

    if selector.scopes is empty:
        scope = null
        scopeIndex = null
    else:
        scope = nearest intersection(selector.scopes, snapshot.scopes)
        reject if none

    if selector.when exists:
        status = evaluateCondition(selector.when, reference, snapshot, predicates)
        reject or return status according to caller semantics

    return match provenance
```

Actions deliberately evaluate a failing condition as candidate status rather than selector rejection because unavailable/hidden rules participate in override. Help and relations may treat non-available condition outcomes as non-matches. The shared selector should expose enough information for the caller to preserve that distinction; it must not force one terminal interpretation.

---

## 10. Canonical relation system

### 10.1 Relation exposure

```ts
interface RelationExposure {
  readonly acceptance?: boolean;
  readonly facet?: boolean;
  readonly derivation?: {
    readonly transport: "serializable";
  };
}
```

Every public relation or composition must expose at least one use. Internal composition steps may set `exposure: {}` only when referenced by a public composition. The compiler should diagnose unreachable private relations.

### 10.2 Direct relation

```ts
interface DirectPresentationRelation<Values, Facts> {
  readonly kind?: "direct";
  readonly id: RelationId;
  readonly from: RuntimeTypeId;
  readonly to: RuntimeTypeId; // codomain; may be abstract
  readonly match: "exact" | "subtypes";
  readonly scopes?: readonly ScopeId[];
  readonly when?: Condition;
  readonly priority?: number;
  readonly label?: string;
  readonly description?: string;
  readonly exposure: RelationExposure;

  apply(
    reference: PresentationReference<Values>,
    snapshot: SelectionSnapshot<Facts>,
  ): PresentationReference<Values> | undefined;
}
```

### 10.3 Composition

```ts
interface ComposedPresentationRelation {
  readonly kind: "composition";
  readonly id: RelationId;
  readonly steps: readonly RelationId[];
  readonly scopes?: readonly ScopeId[];
  readonly when?: Condition;
  readonly priority?: number;
  readonly label?: string;
  readonly description?: string;
  readonly exposure: RelationExposure;
}
```

Prepared compositions infer `from`, `to`, and initial match discipline from their steps. Their own selector gates discovery, and each step's selector gates execution.

### 10.4 Evaluation result

```ts
type RelationEvaluation<Values> =
  | { kind: "value"; relationId: RelationId; reference: PresentationReference<Values>; provenance: RelationProvenance }
  | { kind: "empty"; relationId: RelationId; provenance: RelationProvenance }
  | { kind: "unavailable"; relationId: RelationId; code: string; because: string; provenance?: RelationProvenance }
  | { kind: "error"; relationId: RelationId; code: "relation-threw" | "invalid-result-type"; because: string; cause?: unknown; provenance?: RelationProvenance };
```

Do not collapse `empty`, `unavailable`, and `error`. A valid contextual partial relation may be empty under current facts. A failed predicate is different from a callback throwing. An invalid output is an implementation defect.

### 10.5 Runtime output validation

```text
evaluate(relation, input, snapshot):
    applicability = match relation selector once
    if not applicable:
        return unavailable(stage, explanation)

    try output = relation.apply(input, snapshot)
    catch error:
        return error(relation-threw)

    if output is undefined:
        return empty

    if output.type is undeclared:
        return error(invalid-result-type)

    if graph.isAbstract(output.type):
        return error(invalid-result-type)

    if !graph.isSubtype(output.type, relation.to):
        return error(invalid-result-type)

    return value(output, provenance)
```

### 10.6 Composition pseudocode

```text
prepareComposition(composition):
    reject empty steps
    recursively prepare named steps
    reject declaration cycles
    for each adjacent previous, next:
        require every value promised by previous.to can enter next.from
    infer from first step and codomain from last step

applyComposition(composition, input, snapshot):
    require composition selector matches
    current = input
    provenance = []
    for step in prepared steps:
        result = evaluate(step, current, snapshot)
        append result provenance
        if result is not value:
            return result with composition provenance
        current = result.reference
    return value(current)
```

### 10.7 No implicit path search

This is a permanent guardrail. Automatic path search would create:

- combinatorial candidate growth;
- surprising conversions after unrelated relation registration;
- difficult ambiguity explanations;
- implicit policy about shortest paths and path costs;
- unstable agent vocabulary.

Named composition is bounded, reviewable, versionable, and explainable.

---

## 11. Sibling interpreters over the model

### 11.1 Actions

The action resolver should receive the compiled graph, predicate registry, contributions, and snapshots exactly as today. Its terminal selection ladder does not change.

The only structural migrations are:

- prepared predicates come from the model;
- target matching uses the final selector type;
- universal families use an explicit selector;
- registry diagnostics retain fragment origin;
- products no longer call `createActionRegistry` directly.

### 11.2 Help

Help uses the same graph, predicates, selectors, and snapshots. It retains accumulation semantics and lazy runtime scheduling. Static vocabulary lists help declarations:

```ts
interface HelpVocabularyEntry {
  id: HelpRuleId;
  subject: SelectorSubject;
  scopes: readonly ScopeId[];
  priority: number;
  fragment: string;
}
```

Do not claim that emitted `HelpKind` values are statically known unless the rule API gains an explicit `produces` field.

### 11.3 Acceptance

Rename the module and public identity from translator to relation:

```ts
type AcceptanceOption<Values> = {
  relation: RelationId | null; // null means direct subtype satisfaction
  result: PresentationReference<Values>;
};
```

Pseudocode:

```text
resolveAcceptance(model, request, reference, snapshot):
    wanted = normalize requested types

    if reference.type reaches any wanted type:
        return request.filter(reference)
             ? accepted(relation=null, original reference)
             : none

    candidates = []
    for relation in model.relations exposed to acceptance:
        skip unless relation codomain reaches a wanted type
        result = evaluate relation(reference, snapshot)
        keep only value results whose concrete type reaches a wanted type
        keep only values passing request.filter
        record relation id, scope index, priority, provenance

    if zero: return none
    retain nearest scope
    retain highest priority
    if one: return accepted
    return ambiguous(options sorted by relation id for stable display)
```

Do not infer compositions. A composition participates only when declared and exposed to acceptance.

### 11.4 Facets

PBUI-FACETS-1 should consume `model.relations.exposed("facet")`. It must not introduce another translator/edge registry. Facet derivation may need metadata beyond a Boolean exposure; add it to the relation's facet exposure rather than inventing parallel ids.

If facets eventually need one-to-many output, add explicit relation cardinality rather than silently changing the direct relation return type.

### 11.5 Links

Links receive only:

- the model's graph;
- relation definitions exposed to derivation;
- a detailed relation evaluator;
- an optional label function.

They do not receive action/help registries or the complete model.

---

## 12. Link projection, binding programs, and checking

### 12.1 Link dependency projection

```ts
interface LinkDependencyOptions<Facts> {
  contextFor(linkSnapshot: LinkSnapshot): PresentationContextInput<Facts>;
  label?(reference: SerializableReference): string;
}

model.linkDeps(options): LinkDeps;
```

The projection must:

1. filter relations to `exposure.derivation`;
2. build a selection snapshot through the same model snapshot validator;
3. evaluate the relation through the canonical relation system;
4. verify the returned reference is serializable;
5. preserve `empty` versus diagnostic failure;
6. return only narrow `LinkDeps`.

### 12.2 Why snapshot projection is required

Acceptance has a selection snapshot. Links have document/runtime topology. A relation still needs product facts, scopes, modes, capabilities, and revision while evaluating a persistent `Derived` expression. The product is the only layer that can project those facts honestly.

Do not make `LinkSnapshot extends SelectionSnapshot`. Composition keeps the ownership boundary explicit and avoids placing presentation context fields into every link-kernel fixture.

### 12.3 Persisted grammar versus internal program

Keep persisted terms stable and compile them internally:

```ts
type BindingSource =
  | { kind: "context"; key: string }
  | { kind: "constant"; reference: SerializableReference }
  | { kind: "port"; port: PortId; linkId: string }
  | { kind: "cell"; classId: string }
  | { kind: "error"; diagnostic: Diagnostic };

type BindingExpression =
  | { kind: "source"; source: BindingSource }
  | { kind: "apply"; relationId: RelationId; input: BindingExpression; linkId: string };

type BindingProgram =
  | { kind: "live"; expression: BindingExpression }
  | { kind: "held"; reference: SerializableReference; suspended: BindingProgram }
  | { kind: "broken"; diagnostic: Diagnostic };
```

Initially keep these types under `links/internal/` or omit them from the package's root export surface. Public operations may expose normalized diagnostics and dependency summaries without freezing every IR constructor.

### 12.4 Compiler and lowering

```text
programOf(binding):
    Ambient(k)          -> Live(Source(Context(k)))
    Constant(r)         -> Live(Source(Constant(r)))
    Follow(p, l)        -> Live(Source(Port(p, l)))
    Alias(c)            -> Live(Source(Cell(c)))
    Derived(b, rho, l)  -> Live(Apply(rho, expressionOf(b), l))
    Hold(r, suspended)  -> Held(r, programOf(suspended))
    Unresolved(d)       -> Broken(d)

bindingOf(program):
    inverse mapping into the stable persisted grammar

normalize(binding):
    bindingOf(programOf(binding))
```

Required property:

```text
normalize(normalize(binding)) == normalize(binding)
```

### 12.5 Dependency extraction

Extract separate finite sets:

```ts
interface BindingDependencies {
  ports: ReadonlySet<PortId>;
  relations: ReadonlySet<RelationId>;
  links: ReadonlySet<string>;
}
```

Suspended dependencies matter for resume safety and inspection but are not currently read. Every caller must state whether suspended dependencies are included.

### 12.6 Static checker

The checker establishes structural admissibility, not current relation totality:

- sources exist;
- relation ids exist;
- relation domains accept inferred input types;
- inferred result reaches destination type;
- contexts and identity cells exist;
- dependencies do not create a cycle;
- broken terms remain explicit.

```text
checkBinding(candidate, destination, linkSnapshot, deps):
    program = compile candidate
    inferredType = infer program
    dependencies = extract program dependencies

    reject missing source/context/cell/relation
    reject relation-domain mismatch
    reject destination type mismatch
    reject dependency cycle

    return valid(program, inferredType, dependencies)
```

A statically valid relation may still return `empty` in the current world. Do not convert partiality into a static error.

### 12.7 Planner integration

Planners should construct the exact candidate term they propose to persist, pass it to the checker, then apply operation-specific policy:

- document slots cannot be rebound by ordinary link verbs;
- held bindings require resume/detach decisions;
- directionality remains operation-specific;
- identity membership remains separate;
- already-linked explanations remain planner concerns.

Once parity tests prove the checker covers old structural checks, delete duplicated planner logic rather than running both forever.

---

## 13. Identity quotient and port contracts

### 13.1 Quotient model

Given compatible ports `P` and admitted undirected identity edges, let `~` be their reflexive, symmetric, transitive closure. Logical cells are the quotient `P / ~`.

Expose:

```ts
interface IdentityQuotient {
  cells: readonly LogicalCell[];
  cellByPort: ReadonlyMap<PortId, string>;
  lineage: ReadonlyMap<string, ClassLineage>;
  diagnostics: readonly IdentityDiagnostic[];
}
```

The existing compiled classes and alias map can back this view. `Alias(classId)` remains a wire representation; new reasoning should use logical-cell terminology.

### 13.2 Port contract factorization

The report separates:

```text
ValueContract = valueType × semanticRole × cardinality
PortProtocol  = mode × authorityDomain × updateAlgebra × lifetime
PortContract  = ValueContract × PortProtocol
```

This is useful because operations need different compatibility:

- flow primarily needs value reachability and direction;
- acceptance needs a target value type;
- shared-cell identity needs value and protocol compatibility;
- update merging needs algebra compatibility.

Retain the existing `PortContract` shape during this ticket, but add named projections and operation-specific predicates in a separate reviewable commit:

```ts
canFlow(source, destination)
canShareCell(left, right)
canAccept(reference, port)
canMergeUpdates(left, right)
```

Do not equate all compatibility with whole-contract equality by accident.

---

## 14. React runtime after the cutover

### 14.1 Strict construction API

```ts
interface CreatePbuiOptions<Values, Environment, Facts, Verb> {
  readonly presentation: CompiledPresentation<Values, Environment, Facts, Verb>;
  readonly defaultEnvironment: Environment;
  readonly contextFor: (
    query: ActionQuery<Values>,
    environment: Environment,
  ) => PresentationContextInput<Facts>;
  readonly renderMenuHeader?: (...args) => ReactNode;
  readonly helpRenderers?: HelpRendererRegistry;
}
```

There is no legacy option union. `createPbui` calls `presentation.snapshot(contextFor(...))` for actions, help, acceptance, and introspection.

The returned instance always exposes `presentation`; it does not conditionally expose `kernel`, and it does not retain a one-release descriptor alias.

### 14.2 Provider effect API

```ts
interface PbuiProviderProps<Values, Environment, Verb> {
  children: ReactNode;
  environment?: Environment;
  actor?: string;
  onPerform(verb: Verb, envelope: PerformEnvelope<Values>): void | Promise<void>;
  onAccept?(reference: PresentationReference<Values> | null): void;
  onRefuse(refusal: PbuiRefusal<Values>): void;
}
```

During migration, every product must choose a refusal behavior deliberately:

- user-visible status line;
- toast/banner;
- telemetry only plus status line;
- agent-visible structured error.

Making the callback required avoids recreating silent failure by omission. A product may explicitly pass `() => {}` only with a documented reason.

### 14.3 Fresh action performance

```text
performAction(staleAction):
    freshSnapshot = presentation.snapshot(contextFor(staleAction.query, environment))
    freshResult = presentation.actions.resolve(staleAction.query, freshSnapshot)
    decision = evaluateFresh(staleAction, freshResult)

    if refused:
        onRefuse(code, because, stale identity, fresh provenance)
        return refused

    try:
        await onPerform(fresh verb, envelope from fresh action)
        return delegated
    catch error:
        return failed(error)
```

A displayed row is a proposal, not authority.

### 14.4 Click policy

Extract the pointer/keyboard ladder as one pure function. Use accurate naming: an acceptable click may open a chooser rather than settle immediately.

```ts
type ActivationOutcome<Values, Verb> =
  | { kind: "attempt-accept" }
  | { kind: "activate-host"; bubble: true }
  | { kind: "perform-primary"; action: ResolvedAction<Values, Verb> }
  | { kind: "open-menu" };
```

### 14.5 Accept state machine

The machine must carry request identity so promise effects can be correlated exactly once:

```ts
type AcceptState<Values> =
  | { kind: "idle" }
  | { kind: "pending"; requestId: number; request: AcceptRequest<Values> }
  | { kind: "choosing"; requestId: number; request: AcceptRequest<Values>; options: readonly AcceptanceOption<Values>[] };

type AcceptEffect<Values> =
  | { kind: "close-menu" }
  | { kind: "settle"; requestId: number; reference: PresentationReference<Values> }
  | { kind: "resolve-null"; requestId: number };
```

Required invariants:

- at most one pending request;
- chooser implies a pending request;
- each request emits exactly one terminal settle or resolve-null;
- a second request is rejected without disturbing the first;
- chooser Escape dismisses choices but keeps the request;
- pending Escape aborts the request;
- React components dispatch events and execute effects; transition policy stays pure.

### 14.6 What remains outside

- Escape stack;
- focus return;
- global input modality;
- product effect routing;
- authorization;
- renderer registries.

The useful principle is “stateful interaction policy is explicit and testable,” not the broader claim that every runtime policy must be directly displayable.

---

## 15. Vocabulary, diagnostics, and introspection

### 15.1 Static vocabulary

The model can statically emit:

```ts
interface PresentationVocabulary {
  version: string | number;
  types: readonly VocabularyTypeEntry[];
  actions: readonly VocabularyActionEntry[];
  relations: readonly VocabularyRelationEntry[];
  help: readonly VocabularyHelpRuleEntry[];
  fragments: readonly VocabularyFragmentEntry[];
}
```

Relation vocabulary includes:

- id;
- direct/composition kind;
- source and codomain;
- steps;
- scopes;
- priority;
- label and description;
- interpreter exposure.

It does not contain runtime values, verbs, family instances, dynamic labels, or dynamically emitted help kinds.

### 15.2 Diagnostics

Separate severity and timing:

```ts
type ModelDiagnostic = {
  severity: "error" | "warning";
  code: string;
  message: string;
  ownerId?: string;
  fragmentId?: string;
  path?: string;
};
```

Structural errors prevent construction. Advisory conditions are returned by `diagnostics()`:

- potential conditional action conflict;
- intentionally opaque tester;
- unused private relation;
- declared fragment with no contributions;
- optional descriptor fallback if strict descriptor completeness is disabled for a test fixture.

Production declarations should use strict descriptor completeness. Abstract graph nodes do not need descriptors; concrete nodes do.

### 15.3 Introspection query

An introspection surface explains the exact query the user is looking at:

```text
menu query -> explain(menu query, same snapshot, disclosure policy)
primary query -> explain(primary query, same snapshot, disclosure policy)
```

Do not change invocation to `"introspection"` to explain a menu. Invocation is an input to action discovery. A different invocation can produce a different candidate set.

### 15.4 Disclosure

Define at least:

```ts
type IntrospectionDisclosure = "public" | "developer";
```

Public mode omits hidden/non-disclosure reasons and sensitive predicate detail. Developer mode may expose full trace data behind a deliberate product gate. Never assume dev mode is safe merely because a Provider prop is false by default.

### 15.5 Provenance direction

The current action trace is sufficient for selection debugging but not yet a universal provenance tree. Relation composition, derived links, follows, and acceptance choices will need nested provenance. Do not block the clean kernel on a perfect generic `Decision` algebra; do ensure new relation outcomes retain enough structured provenance to build one later.

---

## 16. Architecture diagrams

### 16.1 Current versus target assembly

```text
CURRENT PRODUCT                              TARGET PRODUCT

create graph ───────────────┐                named fragments ───────────┐
create action registry ─────┤                product fragment ──────────┤
create help registry ───────┤                                          ▼
create descriptor registry ─┤                              definePresentation().create
translator array ───────────┤                                          │
snapshotFor ────────────────┤                         ┌────────────────┴───────────────┐
createPbui option bag ──────┤                         │ CompiledPresentation           │
second graph for links ─────┤                         │ graph · scopes · predicates    │
manual link relation map ───┘                         │ descriptors · actions · help   │
                                                     │ relations · vocabulary         │
                                                     │ snapshot · diagnostics         │
                                                     └──────────┬──────────────┬──────┘
                                                                │              │
                                                          createPbui       linkDeps
```

### 16.2 Shared substrate and sibling semantics

```text
                  graph + predicates + selector + snapshot
                                  │
             ┌────────────────────┼─────────────────────┐
             ▼                    ▼                     ▼
       action matches        help matches        relation matches
             │                    │                     │
       compete by id          accumulate          ┌─────┴────────┐
       override ladder        order only           ▼              ▼
             │                                   accept          links
             ▼                               choose/ambiguity  store/evaluate
       serializable verb
```

### 16.3 Link evaluation

```text
persisted Binding
       │ programOf
       ▼
BindingProgram ───── dependencies ───── cycle checker
       │
       ├──────────── type inference ─── destination checker
       │
       └ evaluate against LinkSnapshot
                    │
                    ├ source port/context/cell/constant
                    └ relation application
                              │
                              ▼
                    model.linkDeps projection
                              │
                              ▼
                     SelectionSnapshot<Facts>
```

### 16.4 Identity and dependency

```text
DIRECTED VALUE FLOW                       SHARED IDENTITY

port A ──Follow──▶ port B                 port A ── identity ── port B
       dependency edge                           undirected edge

cycles are illegal                        closure forms one logical cell
order matters                             declaration order does not
```

### 16.5 Runtime fresh-state boundary

```text
render under snapshot r1
       │
       ▼
user selects candidate C
       │
       ▼
rebuild snapshot r2
       │
       ▼
resolve same query
       │
       ├ C still unique + available ──▶ bind fresh verb ──▶ onPerform
       │
       └ changed/refused ─────────────▶ onRefuse ─────────▶ no effect
```

---

## 17. Decision records

### Decision C1: Compile one model from one declaration and named fragments

- **Context:** Products separately construct graph, predicates, descriptors, actions, help, translators, snapshots, and link dependencies.
- **Options considered:** Keep manual assembly; one flat declaration; one declaration composed from named fragments; merge all registries into one universal registry.
- **Decision:** One compiled model assembled from named fragments over existing specialist registries.
- **Rationale:** It removes drift and omission while retaining domain-specific resolver contracts. Fragment identity makes reusable package contributions atomic and diagnostics actionable.
- **Consequences:** Product code stops calling specialist registry constructors. Shared packages export fragment factories. The compiler becomes a strict construction boundary.
- **Status:** accepted for implementation.

### Decision C2: Keep specialist interpreters separate

- **Context:** Actions, help, acceptance, and links share context but produce different result algebras.
- **Options considered:** Universal resolver with a mode flag; generic fold framework; explicit sibling interpreters.
- **Decision:** Explicit siblings over shared graph, predicates, selectors, and relations.
- **Rationale:** Competition, accumulation, choice, and program interpretation have different invariants. A universal resolver would make those invariants conditional and obscure.
- **Consequences:** Some small loops remain separate. Shared code stops at stable semantic primitives.
- **Status:** accepted.

### Decision C3: Distinguish known, default, and active scopes

- **Context:** Registry scopes are legal identifiers; snapshot scopes are ordered active context.
- **Options considered:** Use one fixed list; allow an optional override over the fixed list; model three concepts explicitly.
- **Decision:** `knownScopes`, optional `defaultActiveScopes`, and per-snapshot `activeScopes`.
- **Rationale:** Current fixed consumers are not proof that runtime context can never vary.
- **Consequences:** More precise names and validation; dynamic nested contexts remain expressible.
- **Status:** accepted.

### Decision C4: Require semantic revision identity

- **Context:** Arbitrary fact serialization is expensive and semantically inaccurate.
- **Options considered:** Always serialize; serialize unless overridden; require snapshot token or declaration revision function.
- **Decision:** Explicit token or product revision function; no PBUI serializer default.
- **Rationale:** Products know which state invalidates presentation decisions.
- **Consequences:** Every production migration must document its revision inputs.
- **Status:** accepted.

### Decision C5: Replace translators with canonical relations

- **Context:** Acceptance translators, facets, and link derivations need the same named typed partial-function concept.
- **Options considered:** Keep adapters permanently; use translators as the canonical type; introduce relations and migrate all consumers.
- **Decision:** Relations are canonical; translator types and adapters are deleted in the final release.
- **Rationale:** “Translator” describes one interpreter's use, while relation describes the semantic arrow itself.
- **Consequences:** Acceptance option identity changes from `translator` to `relation`. Product declarations migrate mechanically, then may add metadata/compositions.
- **Status:** accepted.

### Decision C6: Relations declare interpreter exposure

- **Context:** Not every contextual relation is safe or useful for acceptance, facets, and persistent derivation.
- **Options considered:** Expose all relations everywhere; separate registries; one registry with explicit exposure.
- **Decision:** One relation system with per-relation exposure metadata.
- **Rationale:** Shared identity/evaluation stays canonical without leaking runtime-only arrows into persistent link palettes.
- **Consequences:** Compiler validates exposure and persistence safety. Discovery filters before evaluation.
- **Status:** accepted.

### Decision C7: Composition is explicit and named

- **Context:** Relation edges can form paths, but automatic search introduces unstable behavior.
- **Options considered:** No composition; implicit shortest path; bounded path search; named finite compositions.
- **Decision:** Named finite compositions only.
- **Rationale:** Explicit paths are bounded, inspectable, intentional, and vocabulary-stable.
- **Consequences:** Products write one declaration for every semantic compound conversion they want to expose.
- **Status:** accepted.

### Decision C8: Abstract codomains are legal; abstract outputs are not

- **Context:** The report rejects abstract relation targets, but abstract types are useful contracts for families of concrete results.
- **Options considered:** Concrete codomains only; abstract codomains and abstract outputs; abstract codomains with concrete subtype outputs.
- **Decision:** The third option.
- **Rationale:** A relation can promise `inspectable` while returning a concrete `customer`; runtime references still need descriptor-bearing concrete types.
- **Consequences:** Registration permits abstract `to`; execution checks output is concrete and reaches `to`.
- **Status:** accepted.

### Decision C9: Use a closed runtime type world

- **Context:** Current graph behavior tolerates undeclared isolated references for legacy paths.
- **Options considered:** Preserve open world; strict closed world; configurable modes.
- **Decision:** Strict closed world for the new model.
- **Rationale:** One validated declaration cannot guarantee consistency while unknown runtime types silently enter resolution.
- **Consequences:** Universal families receive an explicit selector. Every concrete type and descriptor is declared. Unknown references fail visibly.
- **Status:** accepted.

### Decision C10: Keep link snapshots separate and project context

- **Context:** Link worlds contain topology and live-value readers absent from selection snapshots.
- **Options considered:** Inherit/merge snapshots; duplicate relation callbacks; project a selection context at the model boundary.
- **Decision:** Controlled projection through `model.linkDeps`.
- **Rationale:** It shares relation semantics without merging ownership domains.
- **Consequences:** Products provide one link-context projection and semantic revision.
- **Status:** accepted.

### Decision C11: Preserve link wire terms; introduce internal IR

- **Context:** Existing documents persist recursive binding terms, while evaluation/checking benefit from normalized source/computation/control forms.
- **Options considered:** Rewrite wire format; continue direct ad hoc interpretation; compile to internal IR and lower back.
- **Decision:** Internal IR with stable wire grammar.
- **Rationale:** Persistence stability and compiler clarity are compatible.
- **Consequences:** Add round-trip and normalization laws. Do not expose all IR constructors prematurely.
- **Status:** accepted.

### Decision C12: Identity is a quotient, not a binding source semantics

- **Context:** Directed following and shared logical storage obey different laws.
- **Options considered:** Treat Alias as another directed source; expose classes only; expose the quotient while retaining Alias on the wire.
- **Decision:** Quotient API backed by existing classes; Alias remains persistence projection.
- **Rationale:** The API should reflect symmetric/transitive identity rather than only its serialized representation.
- **Consequences:** New inspectors and algorithms use logical-cell terminology.
- **Status:** accepted.

### Decision C13: Final runtime supports only compiled presentation

- **Context:** The imported patch supports legacy and model option bags simultaneously.
- **Options considered:** Permanent union; one-release compatibility; coordinated strict cutover.
- **Decision:** Strict final API, using integration branches/prerelease artifacts for coordination.
- **Rationale:** The user explicitly permits a clean cutover across all consumers.
- **Consequences:** All callers, tests, stories, and external repos migrate before release. No compatibility code ships.
- **Status:** accepted.

### Decision C14: Stateful UI policy is pure and testable

- **Context:** Help already uses a machine; click behavior is duplicated; acceptance has meaningful state and promise effects.
- **Options considered:** Leave inline; machines for everything; stateless function for click and state machine for acceptance.
- **Decision:** Function for activation ladder, request-identified machine for acceptance.
- **Rationale:** Use the smallest explicit model matching each problem's statefulness.
- **Consequences:** React becomes an event/effect adapter. Table and property tests cover policy.
- **Status:** accepted.

### Decision C15: Introspection explains the original query under disclosure policy

- **Context:** Re-resolving with a synthetic invocation can change the answer, and hidden reasons may be sensitive.
- **Options considered:** Introspection invocation; render raw trace; explain original query with public/developer disclosure.
- **Decision:** Explain the original query and snapshot under an explicit disclosure level.
- **Rationale:** An explanation must describe the result the user actually saw.
- **Consequences:** Relation/action provenance must retain structured data. Full generic provenance can evolve later.
- **Status:** accepted.

### Decision C16: The runtime cutover is hard (confirms the first guide's open D3)

- **Context:** The first guide asked whether `createPbui` should carry the old option family for one release.
- **Options considered:** One-release union; permanent union; hard cutover.
- **Decision:** Hard cutover. `createPbui` accepts only `{ presentation, defaultEnvironment, contextFor, ... }`.
- **Rationale:** Confirmed by the user on 2026-09-02. The §3.13.1 inventory shows every in-scope consumer is either in this repository or in a sibling workspace checkout that can be migrated in the same sitting.
- **Consequences:** Same as C13. Turboproof stays on 0.6.0 until its own ticket.
- **Status:** accepted.

### Decision C17: The frozen datalab-ui is touched, mechanically (confirms D7)

- **Context:** PBUI-DATALAB-1 (2026-09-01) froze `packages/datalab-ui`; the datalab demo is being rebuilt on pbui-workbench instead. But datalab-ui is a workspace package and the recursive typecheck/test gate includes it.
- **Options considered:** Pin datalab-ui to an old pbui; drop it from the workspace gates; migrate its pbui integration mechanically.
- **Decision:** Mechanical migration of `packages/datalab-ui/src/pbui/` (five source files, three tests). No feature work.
- **Rationale:** Confirmed by the user on 2026-09-02. The edit is smaller than either alternative's bookkeeping, and it keeps one workspace-wide green.
- **Consequences:** datalab-ui's menu/help/descriptor goldens are regenerated where field names change. The freeze otherwise stands.
- **Status:** accepted.

### Decision C18: pbui-chat contributes a fragment and reads descriptors from the model

- **Context:** `createPbuiChat` reads `pbui.registry`, and products merge the chat layer's presentation types into their `Values` by hand. Under the fragment model that is exactly the "parallel arrays a product must spread correctly" §1.2 item 6 forbids.
- **Options considered:** Keep a `registry` alias on the instance; have pbui-chat build its own compiled presentation; export a chat fragment and read `pbui.presentation.descriptors`.
- **Decision:** The third option. pbui-chat exports `createChatPresentationFragment(p)`; `createPbuiChat` reads `options.registry ?? pbui.presentation.descriptors`.
- **Rationale:** A second compiled presentation would be a second graph, the assembly C1 exists to prevent. A fragment keeps the chat types, descriptors and any chat contributions atomic and origin-tagged in diagnostics.
- **Consequences:** rag-ttc and the chat demo include the chat fragment instead of hand-merging types. `PbuiInstance.registry` is deleted with the rest of the option bag.
- **Status:** accepted.

---

## 18. Clean-cutover implementation plan

Implement on one integration branch, but preserve the following commit/PR boundaries. Each phase must compile and test in its intended integration environment.

### Phase 0: Baseline inventory and characterization

**Files:** existing tests, package smoke scripts, ticket fixtures.

Actions:

- Search every repository for legacy APIs.
- Record package versions and consumer lockfiles.
- Fix or explicitly baseline the pbui-chat CSS-policy failure before judging this work.
- Capture representative action rows, ambiguities, acceptance outcomes, help items, vocabulary, link plans, link evaluation, and persisted binding round trips.
- Record revision formulas for each product.
- Save representative persisted workbench documents.

Commands:

```bash
rg -n "createPbui|PresentationTranslator|resolveAcceptance|createActionRegistry|createHelpRegistry|createPresentationTypeGraph|LinkDeps" .
pnpm typecheck
pnpm test
pnpm -r typecheck
pnpm -r test
pnpm build
pnpm consumer:smoke
```

Exit criteria:

- Complete consumer matrix.
- Green or explicitly understood baseline.
- Golden fixtures committed.
- No unknown external PBUI consumer.

### Phase 1: Shared predicates and selector

Phase 1 begins by applying `sources/pbui-composable-kernel.patch` on the integration branch (it applies cleanly and is green, §4.1). Everything after that in Phases 1–7 is a delta on the applied prototype toward this guide: renames (`kernel` → `model`, `translator` → `relation`), additions (fragments, exposure, abstract codomains, explicit universal subject, one context input), and deletions (every compatibility branch, §20.2). Rewriting the 31 files from prose would cost more and prove less.

**Files:**

- `src/presentation/context/predicates.ts` (new);
- `src/presentation/context/selector.ts` (rename/evolve matcher);
- `src/presentation/context/types.ts`;
- action/help registry internals and tests.

Actions:

- Introduce one predicate registry.
- Add prepared-registry injection internally.
- Introduce explicit universal subject.
- Replace synthetic universal scope with nullable provenance.
- Preserve action condition status semantics.
- Migrate action/help internals to final names; do not add compatibility aliases.

Exit criteria:

- Existing action/help behavior unchanged.
- One predicate object shared in model fixture tests.
- Selector tests cover scope-universal and type-universal matching.

### Phase 2: Canonical relation system

**Files:**

- `src/presentation/relations/types.ts`;
- `define.ts`;
- `system.ts`;
- `system.test.ts`.

Actions:

- Implement direct relations, exposure metadata, detailed outcomes, and output validation.
- Implement named composition and registration checks.
- Permit abstract codomains but reject abstract runtime output.
- Add relation vocabulary projection.
- Add property/scenario tests.

Exit criteria:

- No inferred path behavior.
- Predicate evaluated once per candidate.
- Composition errors are construction-time failures.
- Interpreter exposure filters correctly.

### Phase 3: Compiled model and fragments

**Files:**

- `src/presentation/model/*`;
- `src/presentation/index.ts`;
- fragment definitions in workbench/sandbox.

Actions:

- Implement fragment merge with origin tracking.
- Construct graph, predicates, descriptors, actions, relations, and help once.
- Implement strict closed-world cross-validation.
- Implement explicit snapshots and revisions.
- Implement static vocabulary and diagnostics.

Exit criteria:

- A complete ecommerce declaration constructs with no warnings.
- Omitted fragment companions fail with fragment-aware messages.
- Active scope subsets work.
- Missing semantic revision fails.

### Phase 4: Acceptance migration

**Files:**

- rename/evolve `src/presentation/translators/` to `acceptance/`;
- product relation declarations;
- acceptance tests.

Actions:

- Resolve only through relation system.
- Rename `translator` result identity to `relation`.
- Migrate all translator declarations to relations.
- Delete translator types and adapters.

Exit criteria:

- Existing acceptance goldens unchanged except field name.
- Conditional relation uses shared predicates.
- Abstract requested types accept concrete relation outputs.

### Phase 5: Runtime strict cutover

**Files:**

- `src/presentation/createPbui.tsx`;
- all runtime tests and stories;
- product runtime modules.

Actions:

- Replace option bag with `presentation + contextFor`.
- Make `onRefuse` deliberate at each product boundary.
- Return `presentation` on every instance.
- Migrate help and acceptance through the model.
- Delete old construction code in the same integration change.

Exit criteria:

- No old option-family types.
- Every in-repo runtime compiles.
- Forced stale-row tests report refusal and produce no effect.

### Phase 6: Consumer and fragment cutover

Order: in-repo packages first (they gate the workspace build), then the two external consumers from the sibling checkouts in the same workspace, using a `file:`/workspace link to the local pbui build.

**Workbench (`packages/pbui-workbench`):**

- export one fragment factory `createWorkbenchPresentationFragment(p, options)` replacing the `workbenchScopes` + `workbenchTileContributions` pair;
- keep `createWorkbench`/`defineApp` signatures stable (agentlogic depends on them, §3.13.1);
- require link dependencies when links are enabled;
- remove the empty-graph fallback.

**pbui-chat (`packages/pbui-chat`, C18):**

- export `createChatPresentationFragment(p)` carrying the chat layer's types and descriptors;
- read `options.registry ?? pbui.presentation.descriptors`;
- migrate the demo: combine declarations and the generated-action fragment, retain revisions for conversation/program/generated action state, replace conversion pairs with relations.

**Ecommerce:**

- make shop relations canonical model relations;
- remove `shopTranslators`;
- remove the second graph;
- build workbench link dependencies through `shopPresentation.linkDeps`.

**Sandbox:**

- export one fragment;
- replace legacy `"*"` family subject with explicit any-declared-type.

**Datalab (`packages/datalab-ui`, C17, mechanical only):**

- combine descriptor, action, help, predicate, and `cat → field` relation declarations;
- retain the current semantic revision components;
- provide explicit active scopes;
- choose a refusal behavior (status line);
- regenerate goldens where field names changed; no feature work.

**rag-ttc (`../rag-ttc/apps/workbench/web`, primary external target):**

- one `definePresentation` root including the workbench and chat fragments plus a `ragttc` fragment built from the existing type definitions, contributions, help rules and descriptors;
- translators become relations with `exposure: { acceptance: true }` and **unchanged ids** (frozen wire names);
- `createSnapshotFor` becomes the declaration's `revision` function plus `defaultActiveScopes`;
- `createPbui({ presentation, defaultEnvironment, contextFor })`; `onRefuse` writes to the trace;
- `createPbuiChat` unchanged at the call site;
- regenerate the vocabulary golden deliberately and bump the agent-facing vocabulary version;
- run that repository's typecheck, tests and build.

**hyperblog (`../hyperblog/ui`, open-world consumer):**

- declare the ten types in the graph; the descriptor-bridge family uses `anyDeclaredType`;
- translators become acceptance-exposed relations;
- static revision stays;
- run that repository's typecheck, tests and build.

**turboproof and agentlogic:** not part of this phase (§3.13.1). Agentlogic gets a version bump once pbui-workbench is released; turboproof gets its own ticket.

Exit criteria:

```bash
rg -n "PresentationTranslator|relationFromTranslator|LegacyCreatePbuiOptions|snapshotFor:|translators:|matchContext|ContextTarget|workbenchTileContributions|pbui\.registry" \
  pbui/ rag-ttc/apps/workbench/web/ hyperblog/ui/ --glob '!node_modules/**' --glob '!ttmp/**'
```

returns no semantic legacy usage.

### Phase 7: Link projection and dependency cleanup

**Files:**

- `src/presentation/links/snapshot.ts`;
- workbench link environment construction;
- ecommerce shop construction.

Actions:

- add detailed relation evaluation only;
- filter by derivation exposure;
- validate serializable outputs;
- remove legacy value-or-undefined relation callback;
- remove duplicate graph/relation assembly.

Exit criteria:

- Current link tests and ecommerce scene tests pass.
- Acceptance-only relations never enter link palettes.
- Nonserializable relation output becomes a diagnostic and no persisted mutation occurs.

### Phase 8: Binding-program compiler and checker — moved to PBUI-KERNEL-2

Specification: §12.3–§12.7 and §19.6. The prototype's `links/expression.ts` and `links/check.ts` land with the patch in Phase 1 and stay as-is; KERNEL-2 migrates evaluation onto the IR, centralizes dependency extraction, integrates candidate checking into the planners, and deletes the superseded per-verb structural checks after parity.

Exit criteria (for KERNEL-2): wire round-trip fixtures unchanged; normalization idempotence; hold/resume law; cycle/type errors match or improve current diagnostics.

### Phase 9: Identity and operation compatibility — moved to PBUI-KERNEL-3

Specification: §13 and §19.7. The prototype's quotient view lands with the patch; KERNEL-3 adds the order/duplicate invariance properties, the value/protocol projections, and the named `canFlow`/`canShareCell` policies.

Exit criteria (for KERNEL-3): existing class ids and lineage fixtures stable; quotient partition order-independent; identity and flow compatibility tests separate.

### Phase 10: Interaction policy and introspection — moved to PBUI-KERNEL-4

Specification: §14.4, §14.5, §15.3–§15.5, §19.8. KERNEL-4 adds the table-tested `activationOutcome` function, the request-identified accept machine, refusal presentation, and original-query introspection with disclosure. Constraint from §3.13.1: `pbui.accept` stays a promise-returning call usable outside React (rag-ttc's accept bridge).

Exit criteria (for KERNEL-4): pointer and keyboard paths call one activation function; accept-machine properties hold under generated event sequences; public introspection omits hidden detail; developer introspection explains the same rows as the menu query.

### Phase 11: Release and deletion audit

Actions:

- build every workspace package;
- run Storybook builds and browser checks;
- pack PBUI and run smoke consumers;
- run external repo CI against final package;
- update README/playbook/API docs;
- publish coordinated breaking release;
- remove integration-only adapters or TODOs.

Exit criteria are listed in §20.

---

## 19. Test strategy

### 19.1 Existing tests are behavioral fences

Do not forbid edits to test files. Preserve behavior, not byte identity. Tests may need imports and field names updated, and new laws should be added. Existing resolver fixtures must still demonstrate the same semantic outcomes.

### 19.2 Model construction tests

Test every structural rule:

- duplicate fragment/type/scope/predicate/contribution/relation/help ids;
- unknown parents and cycles;
- unknown scope/predicate/type references;
- concrete type lacking descriptor;
- descriptor for undeclared type;
- unknown relation step;
- relation composition cycle;
- incompatible composition endpoints;
- relation with no exposure;
- derivation exposure without serializable transport contract;
- missing revision policy;
- missing/default/invalid active scopes.

### 19.3 Relation tests

Scenario tests:

- exact and inherited source matching;
- direct value and ordinary empty result;
- unavailable predicate;
- thrown relation;
- undeclared output;
- abstract output;
- concrete subtype output for abstract codomain;
- explicit composition;
- no inferred path;
- exposure filtering;
- stable ambiguity display.

Properties:

- declaration permutation does not change applicability truth;
- predicates evaluate once per candidate;
- equivalent explicit composition is extensionally equal where defined;
- output always reaches declared codomain;
- adding an unexposed relation does not change acceptance or link discovery.

### 19.4 Action/help regression tests

Preserve:

- action permutation invariance;
- fresh-revalidation laws;
- unavailable/hidden fallback behavior;
- unique binding only;
- help accumulation and laziness;
- help machine invariants;
- no React runtime import in pure interpreter modules.

### 19.5 Snapshot tests

- explicit revision accepted;
- declaration revision function accepted;
- absent revision rejected;
- NaN/infinite revision rejected;
- active scopes ordered and validated;
- modes/capabilities copied into read-only sets;
- mutable input arrays cannot mutate compiled model state.

### 19.6 Binding-program laws

```text
bindingOf(programOf(canonicalBinding)) == canonicalBinding
normalize(normalize(binding)) == normalize(binding)
resume(pin(binding)) == binding
held value is independent of upstream changes
normalization preserves structural dependencies
```

Checker tests cover missing sources, contexts, cells, relations, domain mismatch, destination mismatch, direct and transitive cycles, held dependencies, and partial-but-well-typed relations.

### 19.7 Identity properties

- `union(a,b)` and `union(b,a)` yield the same partition;
- duplicate edges are idempotent;
- edge permutations preserve cells;
- incompatible declarations never enter the quotient;
- unchanged components retain class ids;
- lineage remains deterministic across merge/split/expand/contract fixtures.

### 19.8 Runtime DOM tests

- pointer and keyboard activation parity;
- acceptable direct reference settles;
- ambiguous acceptance opens chooser;
- second request resolves null without replacing first;
- chooser Escape versus request Escape;
- stale action invokes `onRefuse` and not `onPerform`;
- effect exceptions return failed result;
- help remains lazy;
- introspection uses menu invocation and disclosure rules.

### 19.9 Consumer tests

For each product:

- declaration compiles with zero errors;
- representative menu golden;
- acceptance relation golden;
- help golden if used;
- vocabulary golden;
- semantic revision movement test;
- build/typecheck/test;
- package smoke test;
- Storybook build where applicable.

### 19.10 Validation commands

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm consumer:smoke
pnpm -r typecheck
pnpm -r test
pnpm -r build
pnpm --filter @hyperslop-systems/datalab-ui build-storybook
pnpm --filter @hyperslop-systems/pbui-workbench build-storybook
pnpm --filter @hyperslop-systems/pbui-ecommerce build-storybook
```

Run consumer-native commands in external repositories as well. A PBUI-only green suite is necessary but not sufficient.

---

## 20. Completion and release checklist

### 20.1 Architecture

- [ ] One compiled presentation constructor is public.
- [ ] Named fragments replace parallel reusable arrays.
- [ ] Known/default/active scopes are distinct.
- [ ] One predicate registry is shared.
- [ ] Relations replace translators.
- [ ] Relation exposure is explicit.
- [ ] Relation composition is explicit only.
- [ ] Runtime type world is closed.
- [ ] Revisions are semantic and explicit.
- [ ] Link snapshot projection is product-owned.
- [ ] Persisted link grammar is unchanged.
- [ ] Identity quotient is separate from directed dependencies.

### 20.2 Deletions

- [ ] No legacy `createPbui` branch.
- [ ] No `PresentationTranslator` or adapter.
- [ ] No translator acceptance branch.
- [ ] No `AcceptanceOption.translator` field.
- [ ] No old link relation callback.
- [ ] No empty-graph fallback.
- [ ] No second product graph.
- [ ] No `ContextTarget`/`matchContext` compatibility alias.
- [ ] No undeclared-isolated type behavior.
- [ ] No legacy `"*"` subject.

### 20.3 Verification

- [ ] Root typecheck, tests, and build pass.
- [ ] Recursive workspace typecheck, tests, and builds pass.
- [ ] Consumer smoke tests pass.
- [ ] Storybook/browser tests pass.
- [ ] rag-ttc `apps/workbench/web` typecheck, tests and build pass against the local pbui build; vocabulary golden regenerated deliberately.
- [ ] hyperblog `ui` typecheck, tests and build pass against the local pbui build.
- [ ] agentlogic needs only a version bump (pbui-workbench entry points unchanged).
- [ ] Persisted document fixtures round-trip.
- [ ] No-effect-on-refusal laws pass.
- [ ] Performance benchmarks show no hover/menu regression.
- [ ] Package exports and generated declarations contain only final APIs.

### 20.4 Documentation

- [ ] README uses the compiled presentation model.
- [ ] Product playbook uses fragments and relations.
- [ ] Link docs describe context projection and binding IR.
- [ ] Facet docs reference canonical relations.
- [ ] Migration notes list every removed symbol.
- [ ] Original KERNEL-1 guide is marked superseded by this document.

---

## 21. Risks, performance, security, and operational concerns

### 21.1 Large declarations becoming monoliths

**Risk:** One declaration becomes one enormous product file.

**Mitigation:** Named fragments, fragment factories, origin-aware diagnostics, and one thin product root. “One declaration” means one semantic source after composition, not one physical file.

### 21.2 Relation overexposure

**Risk:** A convenient acceptance conversion becomes a persistent link operator unexpectedly.

**Mitigation:** Explicit exposure with fail-closed defaults; derivation requires an explicit serializable transport declaration.

### 21.3 Revision under-invalidation

**Risk:** A product revision does not move when relation/action facts change.

**Mitigation:** Product-specific tests mutate each relevant fact and assert revision movement. Fresh effect-side checks remain mandatory; revision is telemetry, not authorization.

### 21.4 Revision over-invalidation

**Risk:** A global counter invalidates every menu excessively.

**Mitigation:** Start correct with monotonic counters; profile before introducing query-specific tokens. The API permits composite/local revisions without requiring them.

### 21.5 Relation execution cost

Relation discovery is linear in the finite relation registry. Explicit composition is linear in its declared steps. For current product-sized declarations this is appropriate. If relation counts reach thousands, index prepared relations by source ancestry, target, and exposure without changing public semantics.

### 21.6 Binding analysis cost

Compilation, lowering, dependency extraction, and inference are linear in program size. Cycle checking traverses the affected dependency graph. Workbenches are currently small; revision-indexed dependency caches can be added later if measurement justifies them.

### 21.7 Predicate purity

PBUI cannot prove callbacks are pure. It can avoid duplicate evaluation, document purity as a contract, retain opaque-tester diagnostics, and property-test deterministic declarations. Side-effecting predicates are product defects.

### 21.8 Authorization

Capabilities and predicates express UI eligibility. They are not security boundaries. `onPerform`, link application, stores, and servers revalidate authorization against fresh authoritative state.

### 21.9 Hidden information

Hidden action reasons may encode sensitive existence or permission facts. Public introspection omits them. Developer introspection requires an explicit product-controlled gate and must not be exposed to untrusted agents by default.

### 21.10 Partial relations in persistent links

A structurally valid derived link may become empty as product facts change. That is expected partiality. UI diagnostics should distinguish empty current result from malformed relation, missing relation, thrown callback, and incompatible output.

### 21.11 Public IR lock-in

Exporting every binding-program constructor would make future normalization changes breaking. Keep the IR internal until a real extension needs public construction; expose stable analysis results first.

---

## 22. Glossary

- **Presentation reference:** A typed `{ type, value }` pair.
- **Runtime type:** A declared nominal identifier in the presentation graph.
- **Abstract type:** A graph node used as a supertype contract; it cannot appear as an actual runtime reference after the cutover.
- **Descriptor:** Exact-type representation policy for label, description, and tone.
- **Known scopes:** Every scope identifier declarations may name.
- **Default active scopes:** Product convenience stack used when a query does not provide one.
- **Active scopes:** The ordered inner-to-outer stack for one resolution.
- **Selection snapshot:** Revisioned immutable context read by actions, help, acceptance, and relations.
- **Predicate:** Named pure product callback returning availability.
- **Selector:** Type/scope/condition applicability declaration.
- **Relation:** Named contextual typed partial function from one presentation reference to another.
- **Exposure:** Which interpreters may discover a relation.
- **Composition:** Explicit named finite sequence of relations.
- **Contribution:** Action or help declaration matched contextually.
- **Interpreter:** Pure subsystem applying its own result algebra to shared semantic assets.
- **Compiled presentation:** Immutable validated aggregate produced from fragments and the product declaration.
- **Binding:** Stable persisted PBUI-LINK-1 term.
- **Binding program:** Internal normalized representation separating source, computation, and control state.
- **Dependency:** Directed port read induced by a live binding program.
- **Identity declaration:** Undirected statement that compatible ports share logical storage.
- **Identity quotient:** Partition of ports into logical cells induced by valid identity declarations.
- **Plan:** Pure proposed semantic operation.
- **Fresh revalidation:** Recompute against current state immediately before crossing an effect boundary.
- **Vocabulary:** Static serializable projection of declared semantic capabilities.
- **Provenance:** Structured account of how a result was matched, selected, derived, or refused.

---

## 23. Intern reading order and file references

### 23.1 Read the current system first

1. `src/presentation/types.ts` — references, descriptors, accept request.
2. `src/presentation/registry.ts` — exact descriptor lookup and fallbacks.
3. `src/presentation/actions/typeGraph.ts` — nominal reachability and distance.
4. `src/presentation/actions/types.ts` — query, snapshot, contribution, result contracts.
5. `src/presentation/actions/conditions.ts` — condition and availability evaluation.
6. `src/presentation/context/match.ts` — current selector front half.
7. `src/presentation/actions/registry.ts` — construction validation.
8. `src/presentation/actions/resolve.ts` — action selection ladder.
9. `src/presentation/actions/perform.ts` — fresh revalidation.
10. `src/presentation/help/types.ts`, `registry.ts`, `resolve.ts`, `machine.ts`.
11. `src/presentation/translators/types.ts`, `resolve.ts`.
12. `src/presentation/links/terms.ts`, `snapshot.ts`, `evaluate.ts`, `plan.ts`, `apply.ts`, `identity.ts`, `invariants.ts`.
13. `src/presentation/createPbui.tsx`.
14. `src/surfaces.ts` and `src/focus.ts`.

### 23.2 Read consumers

1. `packages/pbui-ecommerce/src/presentation/actions.ts`.
2. `packages/pbui-ecommerce/src/presentation/relations.ts`.
3. `packages/pbui-ecommerce/src/presentation/runtime.tsx`.
4. `packages/pbui-ecommerce/src/createShop.ts`.
5. `packages/datalab-ui/src/pbui/actions.ts`, `help.tsx`, `registry.ts`, `runtime.tsx`.
6. `packages/pbui-chat/demo/src/pbui/actions.ts`, `registry.ts`, `runtime.tsx`.
7. `packages/pbui-workbench/src/actions.ts` and `src/links/`.
8. `packages/pbui-sandbox/src/actions.ts`.
9. Core stories and `scripts/consumer-smoke.mjs`.

### 23.3 Read research sources

1. `sources/PBUI-Composable-Kernel-Research-Report.md`:
   - “Problem statement”;
   - “Formal model”;
   - “System architecture”;
   - “Link-program implementation”;
   - “Compatibility and migration”;
   - “Design decisions reconsidered”;
   - “Selected design cautions.”
2. `sources/pbui-composable-kernel.patch`, in this order:
   - `relations/types.ts` and `relations/system.ts`;
   - `kernel/types.ts` and `kernel/create.ts`;
   - acceptance changes;
   - `links/expression.ts` and `links/check.ts`;
   - `createPbui.tsx`;
   - identity and port-contract changes.
3. `design-doc/01-the-pbui-presentation-kernel-intern-analysis-design-and-implementation-guide-for-its-consolidation.md` for the original evidence map.
4. `reference/01-investigation-diary.md` for commands, failures, validation, and decision history.

---

## 24. Final implementation guidance

The imported research is most valuable where it reduces primitive concepts without weakening laws: one predicate registry, one selector notion, one canonical relation system, one binding-program interpretation, and one explicit identity model. The clean cutover should be stricter than the prototype around public API and type closure, but more expressive around relation exposure and abstract codomains.

Do not judge success by the number of registries deleted. Judge it by whether impossible or drifting assemblies disappear:

- actions and help cannot see different predicates;
- links cannot see a different graph;
- a relation cannot silently appear in a persistent palette;
- an undeclared type cannot enter runtime resolution;
- a snapshot cannot omit semantic revision identity;
- a reusable fragment cannot omit its companion type declarations;
- a stale row cannot produce an unobserved no-op;
- a link plan cannot persist a structurally invalid program;
- identity cannot be mistaken for directed following.

That is the consolidation boundary worth shipping.

---

## 25. References

### Ticket documents

- `design-doc/01-the-pbui-presentation-kernel-intern-analysis-design-and-implementation-guide-for-its-consolidation.md` — original architecture map and proposal.
- `reference/01-investigation-diary.md` — chronological investigation and validation evidence.
- `sources/PBUI-Composable-Kernel-Research-Report.md` — formal research report and prototype rationale.
- `sources/pbui-composable-kernel.patch` — 31-file prototype implementation, imported but not applied to the active branch.

### Prior PBUI design history

- PBUI-ACTIONS-1 — theoretical model and resolver laws.
- PBUI-ACTIONS-2 — action kernel implementation and identity distinctions.
- PBUI-ACTIONS-3 — post-legacy consolidation backlog.
- PBUI-HELP-001/002 — additive help sibling and pure interaction machine.
- PBUI-LINK-1 — persistent bindings, pull evaluation, planning, identity, and workbench integration.
- PBUI-FACETS-1 — relation/facet pressure that motivates canonical edges.
- PBUI-HARDEN-1 — illegal-state and API-shape hardening principles.

### Research references carried by the imported report

- Cardelli and Wegner, “On Understanding Types, Data Abstraction, and Polymorphism.”
- Liskov and Wing, “A Behavioral Notion of Subtyping.”
- Reynolds, “Definitional Interpreters for Higher-Order Programming Languages.”
- Parnas, “On the Criteria To Be Used in Decomposing Systems into Modules.”
- Lampson, “Hints for Computer System Design.”
- Elliott and Hudak, “Functional Reactive Animation.”
- Kahn, “The Semantics of a Simple Language for Parallel Programming.”
- Tarjan, “Efficiency of a Good But Not Linear Set Union Algorithm.”
- Kung and Robinson, “On Optimistic Methods for Concurrency Control.”
- Cousot and Cousot, “Abstract Interpretation: A Unified Lattice Model for Static Analysis.”
