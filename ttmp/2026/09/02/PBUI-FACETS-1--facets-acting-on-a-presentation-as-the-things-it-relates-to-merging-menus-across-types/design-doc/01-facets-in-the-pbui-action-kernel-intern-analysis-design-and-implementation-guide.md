---
Title: 'Facets in the pbui action kernel: intern analysis, design, and implementation guide'
Ticket: PBUI-FACETS-1
Status: active
Topics:
    - pbui
    - actions
    - design
    - architecture
    - frontend
    - onboarding
DocType: design-doc
Intent: long-term
Owners: []
RelatedFiles:
    - Path: repo://packages/pbui-ecommerce/src/presentation/relations.ts
      Note: 'lineItem.product and product.category: the edges that opt in'
    - Path: repo://packages/pbui-ecommerce/src/tiles/OrderDetail/OrderDetail.tsx
      Note: The nested product presentation the facet replaces
    - Path: repo://packages/pbui-workbench/src/links/contributions.ts
      Note: The Link to family filters targets by reachability only
    - Path: repo://src/presentation/actions/perform.ts
      Note: evaluateFresh codes; evaluateFreshFaceted adds facet-no-longer-resolves
    - Path: repo://src/presentation/actions/resolve.ts
      Note: The unchanged resolver the facet module calls once per facet
    - Path: repo://src/presentation/actions/typeGraph.ts
      Note: The nominal graph never converts payloads; why subtyping cannot merge menus
    - Path: repo://src/presentation/actions/types.ts
      Note: Query, exact vs inherited contexts (payloads never coerced), primary metadata, ResolvedAction, PerformEnvelope (gains via)
    - Path: repo://src/presentation/actions/vocabulary.ts
      Note: Agent vocabulary gains facet edges
    - Path: repo://src/presentation/createPbui.tsx
      Note: 'resolve, performAction, primaryFor, click contract, ObjectMenu: the runtime seams for sections and via'
    - Path: repo://src/presentation/links/plan.ts
      Note: planFollow refuses on type; Phase 4 offers derive through a relation
    - Path: repo://src/presentation/links/resolveShow.ts
      Note: typeDistance is graph-only; Phase 4 adds relation candidates
    - Path: repo://src/presentation/translators/resolve.ts
      Note: 'Accept resolution: the edge walk deriveFacets restricts'
    - Path: repo://src/presentation/translators/types.ts
      Note: PresentationTranslator gains the optional facet declaration
    - Path: repo://src/presentation/types.ts
      Note: PresentationReference is one type and one value; a facet must be a second reference
ExternalSources: []
Summary: 'Analysis of why one pbui presentation carries exactly one type, why the object menu cannot today merge the actions of a line item with those of its product, and a design (facets: declared relation edges that project a subject into the other references it can be acted on as) with kernel API, runtime wiring, decision records, phases, and tests.'
LastUpdated: 2026-09-02T11:30:00-04:00
WhatFor: Understand the action kernel, the translator registry and the menu path well enough to add facets, and implement them phase by phase.
WhenToUse: Before touching src/presentation/actions, translators, or createPbui's menu path for multi-type behaviour; when a product wants one presentation to offer the actions of a related object.
---


# Facets in the pbui action kernel: intern analysis, design, and implementation guide

## 0. How to read this guide

This guide is written for an engineer who is new to pbui and has been asked to make one presentation offer the actions of the things it relates to. The motivating case is the gold-coin shop's order detail: a line item row should let the user act on the line (its quantity, its price, its order) and on the catalog product behind it (inspect it, show it in a product detail, filter by its category) from one right-click, without the tile having to render a second presentation nested inside the first.

Read §1 for the answer in one page. Read §3 in full before changing code; every claim there names a file and a line range in the repository at `/home/manuel/workspaces/2026-09-01/add-plot-editor/pbui`. Read §5 to understand what is being built, §6 for why each choice was made over its alternatives, §7 for the flows as pseudocode, and §9 for the order of work. §12 lists every file cited.

Terms are defined in §14 and are used consistently: a **reference** is `{ type, value }`; a **subject** is the reference a menu was opened on; a **relation** is a declared, typed, direct conversion from one type to another (implemented as a `PresentationTranslator`); a **facet** is a reference obtained from the subject through one relation; a **faceted resolution** is the subject's resolution plus one resolution per facet.

## 1. Executive summary

**A presentation carries exactly one type, and the resolver reads exactly one subject.** `PresentationReference` is a discriminated union keyed by one type (`src/presentation/types.ts:7-15`). `resolveActions` collects candidates whose declared type is reachable from that one concrete type (`src/presentation/actions/resolve.ts:65-225`), partitions them by action id, and runs one override ladder (`:227-296`). The object menu calls it once with `invocation: "menu"` (`src/presentation/createPbui.tsx:930`). Nothing in this path consults the relations a product has declared.

**The type graph cannot merge the menus.** Runtime subtyping never coerces payloads: an inherited rule declared for `product` that matches a `lineItem` reference receives the line item's own value (`src/presentation/actions/types.ts:71-79`; `typeGraph.ts:6-14`), and an exact rule for `product` does not match at all. Declaring `lineItem` as a subtype of `product` would therefore either break every product rule that reads product fields or require the line item value to embed the product, which conflates has-a with is-a and makes every product-typed port accept line items (`src/presentation/links/plan.ts:45`).

**The product already declares the right relation, and two of pbui's three consumers already use it.** `lineItem.product` is a `PresentationTranslator` (`packages/pbui-ecommerce/src/presentation/relations.ts`), consulted by accept mode (`src/presentation/translators/resolve.ts:28-104`) and, since PBUI-LINK-1 Phase 6, by the link kernel's `Derived` term and `planDerive` (`src/presentation/links/plan.ts:198-236`). The object menu and the primary click are the consumers that do not.

**The design: facets.** A translator may opt in as a facet edge. When a menu (or an agent, or an introspection call) resolves a subject, a new pure function beside the resolver derives the subject's facets through the opted-in edges (depth one, no chaining, the same rule accept mode uses), runs the unchanged `resolveActions` once per facet, and returns the subject's rows plus one labelled section per facet. Each facet row binds against the facet reference; the perform envelope records `via: { relation, from }`; fresh revalidation re-derives the facet and refuses if the relation no longer yields. The primary click stays the subject's own unique primary. Registration order still never decides anything: ambiguity remains per (facet, action), and two relations that yield the same reference are listed twice with their labels rather than merged by a guess.

**What this does not change.** `resolveActions`, the override ladder, the availability states, the type graph, the translator registry's accept semantics, and the verb boundary (`onPerform`) are untouched. A product that declares no facet edges sees no difference.

**Build order.** Phase 0 freezes the current menu of a line item as a golden. Phase 1 adds the pure facet module and its tests to core. Phase 2 wires the React runtime: `resolve`, `performAction`, `ObjectMenu` sections, the envelope. Phase 3 extends the agent vocabulary and `explain`. Phase 4 lets the link kernel reach through relations (follow becomes derive, "Link to…" and "show" list relation targets). Phase 5 removes the nested presentation from the shop's order detail and adds stories and a real-pointer scenario. Phase 6 (optional) offers facet help cards.

## 2. Problem statement and scope

### 2.1 The problem

In the order detail tile, every line is rendered as a `<lineItem>` presentation and, inside it, a `<product>` presentation for the product name (`packages/pbui-ecommerce/src/tiles/OrderDetail/OrderDetail.tsx:84-98`). The nesting exists only so that the product's actions are reachable: right-clicking the name opens the product's menu, right-clicking the rest of the cell opens the line item's. Two consequences follow. The user must know where to click to get which menu, and the tile author must know, for every relation a value has, to render an extra presentation for it. Neither the kernel nor the agent knows that the two presentations are related.

The user's request is the general form of this: "a line item in an order can actually also be used to interact with its underlying catalog item, without having to use two different presentations, merging the actions".

### 2.2 What "merging the actions" must mean

Three readings exist, and they lead to different designs. The design in §5 chooses the first and shows how the others follow from it.

1. **Act on the product of this line.** The menu of a line item lists, beside the line's own rows, the rows the product would offer, each labelled as the product's. Performing one acts on the product. The line item stays a line item.
2. **Treat the line item as a product.** Every rule, port, and translator that accepts a product accepts a line item. This is subtyping, and §3.3 shows why the kernel's contract makes it either unsafe or a data-model change.
3. **A value with two types.** A reference carries several typed payloads at once. This is a new reference shape that every consumer (menu, accept, ports, agent wire format, Go validator) would have to learn.

### 2.3 In scope

- A pure kernel function that derives facets and resolves them, with trace and ambiguity as data.
- Opt-in declaration on the translator registry.
- The React runtime: resolution, menu sections, perform, fresh revalidation, envelope.
- Agent vocabulary and `explain` output.
- The link kernel reaching through relations for follow, show, and the "Link to…" family.
- The shop's order detail as the first consumer; stories; a real-pointer scenario.

### 2.4 Out of scope (deliberately)

- Relation chains (line item → product → category in one step). Direct edges only, as translators already are (`translators/types.ts:11-13`).
- Changing the reference shape or the wire format.
- Facet primaries on left click.
- Help cards for facets (listed as Phase 6, optional).
- Migrating `packages/datalab-ui`; it is frozen (PBUI-LINK-1 D10).

## 3. Current-state architecture (evidence)

Every subsection ends with the fact the facet design depends on.

### 3.1 References and descriptors

A reference is one type and one value:

```ts
// src/presentation/types.ts:4-15
export type PresentationValues = object;
export type PresentationType<Values> = Extract<keyof Values, string>;
export type PresentationReference<Values, Type = PresentationType<Values>> = {
  [Key in Type]: { type: Key; value: Values[Key] };
}[Type];
```

A descriptor is representation only (`label`, `describe`, `tone`; `types.ts:26-46`). Action discovery was removed from descriptors in 0.8.0 and lives entirely in the kernel.

**Fact:** there is no place in a reference to carry a second type. A facet must be a second reference, derived or supplied, not a field.

### 3.2 The action kernel's contracts

`src/presentation/actions/types.ts`:

- `ActionQuery { subject, invocation, gesture? }` with `invocation ∈ menu | primary | agent | introspection | accept` (`:26-36`).
- `SelectionSnapshot { revision, scopes, modes, capabilities, product }`: immutable facts; the resolver never reads live stores (`:47-57`).
- `ExactRuleContext.subject` is the narrowed `{ type: Type; value: Values[Type] }`; `InheritedRuleContext.subject` is the original generic reference, with the comment "runtime subtyping never coerces payloads; a rule needing a parent-shaped view must use an explicit product projection or predicate" (`:62-79`).
- `ActionMetadata.primary` marks the action a bare left click performs, only when it is the unique available primary (`:100-111`).
- Contributions: `ExactActionRule` (`:116-137`), `InheritedActionRule` (`:139-156`), `ActionFamily` with a pure bounded `expand` (`:172-188`).
- `ResolvedAction` carries `candidateId`, `query`, `status`, optional `verb`, `snapshotRevision`, `registryVersion`, and `provenance { declaredType, concreteType, typeDistance, scope, scopeIndex, priority }` (`:197-227`).
- `PerformEnvelope { invocation, action?, candidateId?, subject?, actor? }` is what `onPerform` receives beside the verb (`:242-248`).
- `SelectionAmbiguity`, `ResolutionTraceEntry`, `ResolutionResult { actions, ambiguities, trace, snapshotRevision, registryVersion }` (`:250-288`).

**Fact:** a resolved row already records which subject it was resolved for (`query.subject`) and which declared type matched (`provenance.declaredType`). A facet row needs one more fact, the relation it came through, and the envelope needs to carry it.

### 3.3 The type graph

`src/presentation/actions/typeGraph.ts` is nominal, multi-parent, with abstract types; it answers `isSubtype`, `distance`, `ancestors` and nothing else (`:6-14`, `:31-50`). Its header states the load-bearing rule: "Runtime subtyping and TypeScript payload assignability are DIFFERENT facts … the graph never converts payloads."

Products use abstract types for shared behaviour: datalab declares `inspectable` and `watchable` with `field` and `datum` as children so that one inherited rule replaces eight per-type rules (`packages/datalab-ui/src/pbui/actions.ts:330-343`); the shop declares `inspectable` above every value type (`packages/pbui-ecommerce/src/presentation/actions.ts:13-27`).

**Fact:** an abstract supertype gives shared behaviour to several types whose rules are written against the supertype and read the value through a projection. It cannot make `product`'s exact rules, which read `ProductValue` fields, apply to a `LineItemValue`.

### 3.4 The resolver

`src/presentation/actions/resolve.ts:65-393` is one pure function:

1. For each contribution, type reachability and scope nearness come from the shared matcher `matchContext` (`context/match.ts:41-90`; `resolve.ts:80-100`); the `"*"` family is the one target it cannot express.
2. Invocation filter (`:105-115`), scope rejection (`:116-125`).
3. Rules evaluate `when` then `test` to an `Availability`; `inapplicable` leaves the competition (`:147-181`). Families expand to instances with unique keys (`:184-224`).
4. Partition by action id (`:227-233`); ladder: smallest type distance, nearest scope, highest priority, else ambiguity as data with `because: incomparable-types | equal-priority` (`:237-272`); shadowed and selected trace entries (`:273-295`).
5. Bind only the uniquely selected available candidate; hidden winners emit no row (`:297-343`); presentation sort by group, order, label, never precedence (`:346-354`).

**Fact:** the resolver is a function of (registry, query, snapshot). Calling it once per facet reference with an unchanged registry is well-defined and keeps every invariant, including permutation invariance, per call.

### 3.5 The registry

`createActionRegistry` (`registry.ts:81-258`) validates fail-fast (duplicate ids, unknown types, scopes, predicates, guaranteed collisions `:160-179`), exposes `resolve`, `explain`, `listReachable(type, scopes)` (`:220-247`), `diagnostics`, and a generated agent `vocabulary` (`:256`; `vocabulary.ts`).

**Fact:** the registry does not know the translators; they are passed to `createPbui` separately (`createPbui.tsx:82-90`, `:345`, `:371`). A facet module needs both.

### 3.6 Fresh revalidation

`evaluateFresh(stale, fresh)` (`perform.ts:25-47`) refuses with `action-became-ambiguous`, `action-no-longer-resolves`, `action-implementation-changed` (different candidate id), or `action-no-longer-available`.

**Fact:** a facet row is revalidated by re-deriving the facet and re-resolving it; if the relation no longer yields a reference, that is a fifth refusal, not a silent fallback to the subject.

### 3.7 The React runtime

`src/presentation/createPbui.tsx`:

- Options: `registry` (descriptors), `actions` + `snapshotFor`, `translators`, `onPerform(verb, envelope)`, `actor` (`:60-181`).
- `pbui.resolve(query)` builds a snapshot through `snapshotFor` and calls the action engine (`:537`).
- `performAction(stale)`: close the menu, re-resolve `stale.query` on a fresh snapshot, `evaluateFresh`, then `onPerform(freshVerb, envelope)` with the envelope built from the fresh resolution (`:538-556`).
- `Presentation`: `primaryFor()` resolves with `invocation: "primary"` and performs only the unique available primary (`:649-655`); the click contract (`:700-745`): acceptable stops and settles the accept, `activate` runs and bubbles, otherwise the menu opens; mouse-doc text `L: … R: menu` (`:657-666`, `:825-872`).
- `ObjectMenu` (`:883-993`): resolves with `invocation: "menu"` (`:930`), renders a header `<type> label` (`:961-967`), one `button[role=menuitem]` per row keyed by `candidateId`, disabled with the reason when unavailable (`:971-993`); keyboard navigation over enabled buttons (`:936-948`).

**Fact:** the menu is a flat list keyed by candidate id with a single header. Facet sections need a second header level and keys that stay unique when the same rule resolves for two facets.

### 3.8 Typed translators and accept mode

`translators/types.ts:11-53`: a `PresentationTranslator { id, from, to, match, scopes?, when?, priority?, translate(reference, snapshot) }`. Two rules are stated as load-bearing: subtyping is substitutability, not conversion (a subtype satisfies a request with the original reference); ambiguity is a choice, never a guess.

`resolveAcceptance` (`translators/resolve.ts:28-104`): direct satisfaction first (identity or graph subtype, original reference preserved), then translator edges filtered by target, source match, scope, condition, the request's filter, reduced by nearest scope then priority, then `none | accepted | ambiguous`.

**Fact:** the translator registry is already a relation registry with ids, typed endpoints, scopes, conditions, priority, and a chooser for ties. Facet derivation can be a restricted call of the same edge walk: every opted-in edge whose source matches the subject, in an active scope, whose condition holds, that yields a reference.

### 3.9 The shared context matcher and the help kernel

`context/match.ts` extracts the type → scope → condition front half of the resolver so the help kernel can reuse it (`help/resolve.ts:24-70`), which is additive: every matching rule contributes, ordered but never suppressed.

**Fact:** a facet-aware help resolver is the same fan-out over facets, and additive help needs no shadowing policy; it is a small optional phase.

### 3.10 The agent path

`vocabularyOf` generates the static vocabulary from the graph and the contributions (`vocabulary.ts:9-30`): types with parents, actions with subject, scopes, invocations, static labels; verbs and family instances are deliberately absent. `pbui_accept` (`packages/pbui-chat/src/tools/acceptTool.tsx:46-60`) enters accept mode with types and returns the picked reference. `workbench_perform` validates and performs `WorkbenchVerb`s.

**Fact:** the vocabulary has no entry for translators or relations. An agent cannot learn today that a line item can be acted on as its product; the vocabulary needs a `facets` list.

### 3.11 The link kernel's use of relations (PBUI-LINK-1)

- `RelationDefinition { id, from, to, label }` and `LinkDeps.relations` / `relation(id, ref, snapshot)` (`links/snapshot.ts`).
- `planFollow` refuses with code `type` when the source's value type does not reach the destination's (`links/plan.ts:45-46`); `planBind` and `planAmbient` do the same (`:64-65`, `:79-80`).
- `legalRelations(source, destination)` and `planDerive` (`:198-236`) find relations by reachability on both ends; several legal relations produce an ambiguous plan the palette resolves.
- `resolveShow`'s `typeDistance` is graph distance only (`links/resolveShow.ts:96-101`); the design guide had proposed +100 through a translator but it was not built.
- The "Link to…" family lists only ports whose type the subject reaches (`packages/pbui-workbench/src/links/contributions.ts:294-296`).
- The shop derives its translators and its kernel relations from one list (`packages/pbui-ecommerce/src/presentation/relations.ts`; wired in `runtime.tsx:22` and `createShop.ts`).

**Fact:** the link kernel already has the relation registry the facet module needs and already treats relations as first-class in derive; follow, show and the family do not yet reach through them. That is the link-side half of the same gap.

### 3.12 How the shop nests presentations today

`OrderDetail.tsx:84-98` renders `<Presentation lineItem inComposite>` containing `<Presentation product>`. `inComposite` yields the tab stop and role to the composite (`createPbui.tsx:261-273`). Right-click on the product name opens the product menu because the inner presentation stops propagation (`:668-672`).

**Fact:** the nesting is a workaround for the missing facet. After Phase 5 the line is one presentation and the product's rows appear as a facet section.

## 4. Gap analysis

| Wish | Mechanism today | Gap | Phase |
|---|---|---|---|
| A line item's menu shows the product's actions | nested `<product>` presentation inside `<lineItem>` (`OrderDetail.tsx:89-93`) | the kernel does not know the relation; the tile must render a second presentation per relation | 1, 2, 5 |
| Rows say which object they act on | menu header names the subject type only (`createPbui.tsx:961-967`) | no section per facet; candidate ids collide across facets for the same rule | 2 |
| Performing a product row from a line item is attributed | `PerformEnvelope { subject }` (`actions/types.ts:242-248`) | no `via`: the router cannot tell "product X from line Y" from "product X" | 2 |
| A stale product row is refused when the line no longer has that product | `evaluateFresh` codes (`perform.ts:29-45`) | no code for "the relation no longer yields" | 2 |
| Left click on a line acts on the line, never on the product by surprise | unique available primary (`createPbui.tsx:649-655`) | must be stated: facet primaries are excluded from the primary invocation | 2 |
| Ambiguity, permutation invariance, hidden/inapplicable semantics preserved | resolver invariants (`resolve.ts:23-40`) | must hold per facet; two relations to the same reference must not be merged by order | 1 |
| The agent knows a line item can act as its product | vocabulary has types and actions only (`vocabulary.ts:31-56`) | no facet edges | 3 |
| `explain` shows why a product row appeared on a line item | `describeTraceEntry` stages (`explain.ts`) | no `facet` stage | 3 |
| Drop a line item on a product-typed port | `planFollow` code `type` (`plan.ts:45-46`) | should offer `port.derive` through `lineItem.product` | 4 |
| "Show details…" on a line item reaches a product detail | `resolveShow` graph distance only (`resolveShow.ts:96-101`) | relation candidates at a higher distance | 4 |
| "Link to…" lists product-typed inputs for a line item | reachability filter (`contributions.ts:294-296`) | derived rows | 4 |
| Help for the product when hovering a line | `resolveHelp` single subject (`help/resolve.ts:24`) | optional facet fan-out | 6 |

Two observations:

1. The kernel's missing piece is small and pure: derive facets, resolve each, tag the rows. Everything else is projection (menu, envelope, vocabulary, explain) and one consistent extension of the link kernel.
2. Nothing requires a new reference shape. The wire format, the ports, the Go validator and the agent tools keep `{ type, value }`.

## 5. Design

### 5.1 Principles

1. **One type per reference, one resolver.** The resolver is called per reference; it is not taught about relations.
2. **Relations are declared once.** The translator registry is the only relation registry (PBUI-LINK-1 D7). A facet is a translator that opted in.
3. **Depth one.** A facet is reached through one edge. Chains are a later ticket if a demo needs them.
4. **Every row names its object.** A facet row carries the relation and the facet reference; the menu shows the section; the envelope carries `via`.
5. **The subject owns the click.** Only the subject's unique available primary performs on a bare left click.
6. **Registration order never decides.** Per-facet ambiguity is data; two edges yielding one reference are two sections.
7. **Refusals explain themselves.** A facet that no longer resolves at perform time refuses with a code and a sentence.

### 5.2 Declaring a facet edge

The translator gains one optional field:

```ts
// src/presentation/translators/types.ts (addition)
export interface FacetDeclaration {
  /** Section label in the menu and the agent vocabulary, e.g. "its product". Defaults to the translator id. */
  readonly label?: string;
  /** Which invocations may see this facet; absent = menu, agent, introspection (never primary or accept). */
  readonly invocations?: readonly Exclude<ActionInvocation, "primary" | "accept">[];
  /**
   * When the subject and this facet both resolve one action id:
   * "both" (default) keeps both rows in their sections;
   * "subject-wins" drops the facet's row and traces `shadowed-by-subject`.
   */
  readonly shadowing?: "both" | "subject-wins";
}

export interface PresentationTranslator<Values, ProductFacts> {
  // …existing fields…
  /** Opt this edge in as a FACET: the subject's menu also offers the target's actions. Absent ⇒ accept mode only. */
  readonly facet?: FacetDeclaration | true;
}
```

The default is off. Accept-mode coercions that should not appear as sections (a `datum → doc` lookup used only to settle a request) stay as they are. The shop opts in `lineItem.product` and `product.category`; `order.customer` stays accept-only in Phase 5 because the order detail already renders the customer as its own presentation, and the customer's actions on an order row would double the order's menu. That is a product judgement, which is why it is per edge.

### 5.3 Deriving facets (pure)

```ts
// src/presentation/actions/facets.ts (new; no React, no stores)
export interface FacetReference<Values> {
  /** The translator id; the facet's identity in menus, envelopes, and revalidation. */
  readonly relation: TranslatorId;
  readonly label: string;
  readonly reference: PresentationReference<Values>;
  readonly declaration: Readonly<Required<FacetDeclaration>>;
}

export interface FacetDeps<Values, ProductFacts> {
  readonly graph: PresentationTypeGraph;
  readonly translators: readonly PresentationTranslator<Values, ProductFacts>[];
  readonly predicates: ReadonlyMap<PredicateId, ProductPredicate<Values, ProductFacts>>;
}

/** The facets of one subject under one snapshot: opted-in edges whose source matches, in an active scope, whose condition holds, that yield. */
export function deriveFacets<Values, ProductFacts>(
  deps: FacetDeps<Values, ProductFacts>,
  subject: PresentationReference<Values>,
  snapshot: SelectionSnapshot<ProductFacts>,
  invocation: ActionInvocation,
): readonly FacetReference<Values>[];
```

Rules of `deriveFacets`, each a unit test:

- An edge is considered only when `facet` is set and `invocation` is in its `invocations` (default `menu | agent | introspection`).
- Source match follows the translator's `match` (`exact` or `subtypes`), scope follows `scopes` as `resolveAcceptance` does, `when` is evaluated with the same predicate map.
- A yielded reference that deep-equals the subject is not a facet (no identity facet). The test is reference equality, not type equality: a self-edge such as `product → product` ("its replacement SKU") is a legitimate facet when it yields a different product. Deep equality is well-defined because port values are JSON (PBUI-LINK-1 D4).
- Two edges that yield the same reference produce two facets, distinguished by relation id; nothing merges them.
- No cycle detection is needed at depth one: a facet's resolution runs `resolveActions` on the facet reference and never calls `deriveFacets` again, families cannot re-enter the resolver (`expand` receives only the context), and translators are pure over a snapshot. An edge pair `lineItem → product` and `product → lineItems` simply produces a product section on a line and a line-items section on a product. If depth ever exceeds one (D2), the visited set is keyed by the deep-equal reference and the bound is a declared depth, never a discovered fixpoint. Cycles in the FOLLOW/DERIVE graph are the link kernel's concern and are already refused by `dependsOn` in `planFollow`/`planDerive` and reported by `evaluatePort`'s visiting path.
- The output is ordered by relation id; the order carries no meaning and a permutation test asserts it.
- Depth is one: facets of facets are never derived.
- The same target type reached through two edges yields two facets, distinguished by relation id.

### 5.4 Resolving with facets (pure)

```ts
export interface FacetResolution<Values, Verb> {
  readonly facet: FacetReference<Values>;
  readonly resolution: ResolutionResult<Values, Verb>;
}

export interface FacetedResolution<Values, Verb> {
  readonly subject: ResolutionResult<Values, Verb>;
  readonly facets: readonly FacetResolution<Values, Verb>[];
  /** Subject rows first, then each facet's rows tagged with `facet`; shadowing applied. */
  readonly actions: readonly FacetedAction<Values, Verb>[];
  readonly trace: readonly ResolutionTraceEntry[];   // subject + facets, facet entries carry `facet: relation`
  readonly snapshotRevision: string | number;
  readonly registryVersion: string | number;
}

/** A resolved row, plus the facet it belongs to when it is not the subject's own. */
export type FacetedAction<Values, Verb> = ResolvedAction<Values, Verb> & {
  readonly facet?: { relation: TranslatorId; label: string; reference: PresentationReference<Values> };
  /** Unique across the whole faceted result: `candidateId` for subject rows, `facet:<relation>:<candidateId>` for facet rows. */
  readonly rowId: string;
};

export function resolveWithFacets<Values, ProductFacts, Verb>(
  prepared: PreparedRegistry<Values, ProductFacts, Verb>,
  deps: FacetDeps<Values, ProductFacts>,
  query: ActionQuery<Values>,
  snapshot: SelectionSnapshot<ProductFacts>,
): FacetedResolution<Values, Verb>;
```

`resolveWithFacets` calls `resolveActions` for the subject, then `deriveFacets`, then `resolveActions` once per facet with `{ ...query, subject: facet.reference }`. It does not modify the resolver. Facets are deliberately NOT folded into `resolveActions`: the resolver partitions candidates by action id and runs one override ladder per partition, so subject and facet candidates in one call would compete on type distance and scope and the ladder would pick between two different objects (the option D6 rejects). Folding them in would require a `(facet, action)` partition key, which is this function with the bookkeeping hidden inside the resolver. Keeping the resolver single-subject also keeps its permutation, bind-only-selected and hidden/inapplicable tests untouched, and the registry does not own the translators (they are passed to `createPbui` separately, `createPbui.tsx:82-90`).

The public entry point stays one per invocation: `pbui.resolve(query)` returns the faceted result for `menu`, `agent` and `introspection` (the flat subject result is its `.subject`), and the plain `resolveActions` result for `primary` and `accept`, for which `deriveFacets` yields nothing. Facet rows whose `metadata.primary` is set are kept in the rows (they are ordinary menu rows) but `primary` is reported as `false` on the faceted row, so no consumer can mistake them for the subject's primary (§5.6).

Shadowing (`subject-wins`) is applied after both resolutions: a facet row whose action id appears among the subject's rows is dropped and a trace entry `{ stage: "facet", result: "shadowed", reasonCode: "shadowed-by-subject", related: [subjectCandidateId] }` is recorded. The default keeps both, because "inspect this line" and "inspect its product" are different operations with the same action id.

### 5.5 Fresh revalidation with facets

```ts
export function evaluateFreshFaceted<Values, Verb>(
  stale: FacetedAction<Values, Verb>,
  fresh: FacetedResolution<Values, Verb>,
): FreshDecision<Values, Verb> | { kind: "refused"; code: "facet-no-longer-resolves"; because: string } {
  if (!stale.facet) return evaluateFresh(stale, fresh.subject);
  const current = fresh.facets.find((entry) => entry.facet.relation === stale.facet.relation);
  if (!current) return { kind: "refused", code: "facet-no-longer-resolves", because: `${stale.facet.label} no longer applies to this ${stale.query.subject.type}` };
  return evaluateFresh(stale, current.resolution);
}
```

The facet is re-derived from the fresh snapshot, so a line whose product was deleted, or a relation whose condition turned false, refuses with a sentence the status bar can show.

### 5.6 The primary click

`Presentation.primaryFor()` keeps resolving with `invocation: "primary"` against the subject only (`createPbui.tsx:649-655`). `deriveFacets` never yields for `primary` (§5.2), so even a product rule marked `primary` cannot fire on a line item's bare click. A user who wants the product's primary opens the menu. This is Decision D3.

### 5.7 The menu

`ObjectMenu` calls `pbui.resolveFaceted({ subject, invocation: "menu" })` and renders:

```text
┌ <lineItem> 2 × Gold Sovereign ─────────────────────┐   header: subject type + label (unchanged)
│ Inspect                                              │   subject rows (unchanged, keyed by candidateId)
│ Show details…                                        │
│ Link to inspector · subject                          │
│ ── PRODUCT · Gold Sovereign · its product ────────── │   section header: facet type, facet label, relation label
│ Inspect                                              │   facet rows, keyed by rowId
│ Show details…                                        │
│ Link to product detail · product                     │
│ ── CATEGORY · Sovereigns · its category ───────────  │
│ Filter orders by category                            │
└──────────────────────────────────────────────────────┘
```

- Section headers are `role="presentation"` separators with `aria-label`; rows keep `role="menuitem"`; keyboard navigation over enabled buttons is unchanged.
- The disabled reason renders as today; a facet row that is unavailable still shows its section.
- `renderMenuHeader` gains an optional sibling `renderFacetHeader(facet, environment, label)` so a product can style sections; the default prints `<type> label · relation label`.
- The mouse-doc gains a count when facets exist: `L: Inspect   R: menu (+2 facets)`; the hover text is computed lazily as today (`:657-666`).
- "No actions available" is shown only when the subject and every facet resolve nothing and there are no ambiguities.

### 5.8 The envelope

```ts
export interface PerformEnvelope<Values> {
  invocation: ActionInvocation | "direct";
  action?: ActionId;
  candidateId?: CandidateId;
  subject?: PresentationReference<Values>;          // the FACET reference for a facet row
  via?: { relation: TranslatorId; label: string; from: PresentationReference<Values> };  // the row's origin
  actor?: string;
}
```

`subject` is the reference the verb was bound against, which for a facet row is the product. `via.from` is the line item the menu was opened on. Verb logs and the approval ledger print "Inspect product Gold Sovereign, via its product of line 3 of order 88213".

### 5.9 The agent

- `vocabularyOf` gains `facets: Array<{ relation, from, to, label, invocations }>` generated from the opted-in translators, so the static shape stays JSON and golden-testable (`vocabulary.ts:9-30`).
- An agent invocation (`invocation: "agent"`) resolves with facets; a chat tool that lists actions for a reference returns rows with their `facet` field so the agent can choose "the product's inspect" explicitly.
- `describeTraceEntry` gains `facet:*` stages: `derived` (which edge yielded), `rejected` (edge not applicable, with reason), `shadowed` (`shadowed-by-subject`).

### 5.10 The link kernel

The same relation registry serves the link kernel through `LinkDeps.relations`. Three consistent extensions, all in `src/presentation/links/`:

1. `planFollow(source, destination)`: when the source type does not reach the destination type but `legalRelations` is non-empty, return `{ kind: "ambiguous", options: [port.derive(source, destination, ρ) …] }` with one option per relation (a single relation is still returned as ambiguous with one option so the instrument can label it "derive through its product" rather than silently changing the verb). Code `type` stays for the no-relation case.
2. `resolveShow`: after existing-port candidates by graph reach, add candidates for input ports reachable through a facet edge at `typeDistance = graphDistance(facet.to, port.valueType) + 100`, with `verb: port.derive(from, port, ρ)` when `from` is known and `port.bind(port, facetReference)` otherwise; the explanation names the relation.
3. The "Link to…" family (`contributions.ts:283-315`) lists, after the direct targets, one row per (facet, compatible port) labelled `Link to <tile> · <port> as its product`, binding a `show` intent with the facet's candidate id.

These reuse `deriveFacets` with the kernel's `RelationDefinition` list mapped to the same edge shape; the shop already builds both from one list.

### 5.11 The shop

- `relations.ts`: `lineItem.product` and `product.category` gain `facet: { label: "its product" }` / `{ label: "its category" }` in `shopTranslators`.
- `OrderDetail.tsx:84-98`: the inner `<Presentation product>` is removed; the line is one presentation whose menu carries a PRODUCT section.
- Stories: a `Shop/Facets` story with the order detail open on order 88213 and the menu opened on a line; a `Presentation/Facets` story in core with a three-type toy world.
- A DOM test asserts the section header and that performing the facet's "Inspect" row sends the inspector the product; a real-pointer scenario right-clicks a line, chooses the PRODUCT section's "Link to product detail · product", and asserts the product detail's badge.

## 6. Decision records

### Decision D1: Facets are derived through opted-in translators, not through graph subtyping or composite references

- **Context:** Three readings of "merge the actions" (§2.2). The graph never converts payloads (`typeGraph.ts:6-14`); the reference shape is consumed by ports, the wire format, and the Go validator.
- **Options considered:** (a) declare `lineItem` a subtype of `product` and widen `LineItemValue` to embed product fields; (b) a composite reference `{ type, value, also: [...] }` minted by the tile; (c) derive facets at resolution time through translators that opt in.
- **Decision:** (c).
- **Rationale:** (a) breaks direct satisfaction in accept mode (a product port would receive the line item itself, `translators/resolve.ts:42-48`), makes every product port accept line items (`plan.ts:45`), duplicates data in every held value, and confuses selection identity. (b) is a new shape every consumer must learn, and it duplicates data the host already owns. (c) reuses the registry that D7 already made the single relation source, so menu, accept mode, and derived bindings agree by construction; a product with no opted-in edges sees no change.
- **Consequences:** `resolveActions` is unchanged; a new pure module fans out. Facet derivation costs one translator call per opted-in edge per menu open, which is bounded and lazy (menus resolve on open, `createPbui.tsx:930`). Must validate: permutation invariance across facets; no facet for `primary` or `accept` invocations.
- **Status:** proposed.

### Decision D2: Depth one, no chaining

- **Context:** Translators are direct edges only (`translators/types.ts:11-13`); `Derived` terms are one relation deep.
- **Options considered:** (a) depth one; (b) bounded chains with a per-edge `chain: true` flag; (c) transitive closure.
- **Decision:** (a).
- **Rationale:** Every demonstrated case (line → product, product → category, order → customer) is one edge. Chains multiply sections and make attribution ("via its product's category") harder to read; nothing in the shop needs them.
- **Consequences:** A product that wants product-of-line-of-order declares a direct `order → products` family instead. Must validate: a test that facets of facets are never derived.
- **Status:** proposed.

### Decision D3: The bare left click performs only the subject's primary

- **Context:** `Presentation` performs the unique available primary on click (`createPbui.tsx:649-655`, `:736-743`). A product rule marked `primary` (e.g. "open product") would otherwise fire when clicking a line.
- **Options considered:** (a) include facet primaries in the primary invocation and let uniqueness decide; (b) exclude facets from `primary`.
- **Decision:** (b).
- **Rationale:** (a) makes the click's meaning depend on which edges opted in; a line with one facet primary and no own primary would act on the product by surprise. The rule "the click acts on what you clicked" stays true.
- **Consequences:** `deriveFacets` returns nothing for `primary` and `accept`; the faceted row reports `primary: false`. Must validate: a test with a facet-only primary opens the menu.
- **Status:** proposed.

### Decision D4: A facet row's identity is (relation id, candidate id); revalidation re-derives the facet

- **Context:** `evaluateFresh` compares candidate ids within one resolution (`perform.ts:36-38`); the same rule can resolve for the subject and for a facet in one menu.
- **Options considered:** (a) prefix candidate ids per facet inside the resolver; (b) keep candidate ids as the resolver mints them and add a `rowId` and a `facet.relation` on the faceted row; revalidate by locating the fresh facet by relation id, then `evaluateFresh` within it.
- **Decision:** (b).
- **Rationale:** (a) changes the resolver and every trace consumer. (b) keeps candidate ids meaningful per resolution and makes the refusal for a vanished facet a distinct code (`facet-no-longer-resolves`).
- **Consequences:** Menus key rows by `rowId`; the envelope carries `via`. Must validate: a stale product row is refused after the line's product changes.
- **Status:** proposed.

### Decision D5: Opt in per translator; default off

- **Context:** Translators exist for accept-mode coercions that are not menu-worthy.
- **Options considered:** (a) every translator is a facet; (b) opt in per translator; (c) a separate facet registry.
- **Decision:** (b).
- **Rationale:** (a) would add sections to menus in products that never asked; (c) is a second relation registry, which D7 rejected.
- **Consequences:** One optional field on `PresentationTranslator`; the vocabulary lists only opted-in edges. Must validate: a product with no `facet` fields produces byte-identical menus (Phase 0 golden).
- **Status:** proposed.

### Decision D6: Shadowing across facets is a declared per-edge policy; the default keeps both rows

- **Context:** The subject and a facet often share action ids (`object.inspect`, `presentation.show`, the "Link to…" family).
- **Options considered:** (a) merge into one partition and let the ladder decide (type distance would favour whichever declared type is nearer, which is meaningless across two references); (b) keep both, sectioned; (c) per-edge `subject-wins`.
- **Decision:** (b) by default, (c) available.
- **Rationale:** (a) reintroduces a hidden precedence between different objects. (b) is honest: two rows, two objects. (c) exists for edges where the product wants a compact menu.
- **Consequences:** A trace entry `shadowed-by-subject` when (c) applies. Must validate: with the default, both "Inspect" rows perform on their own reference.
- **Status:** proposed.

### Decision D7: The facet module lives in core beside the resolver; the React runtime and the link kernel consume it

- **Context:** The resolver, translators, and the link kernel are all in `src/presentation`; the React runtime is `createPbui.tsx`.
- **Options considered:** (a) `actions/facets.ts` in core; (b) inside `createPbui.tsx`; (c) in `pbui-workbench`.
- **Decision:** (a).
- **Rationale:** The fan-out is pure and must be testable without React (the no-React fence applies); the link kernel needs it too and lives in core.
- **Consequences:** `actions/index.ts` exports `deriveFacets`, `resolveWithFacets`, `evaluateFreshFaceted`, the types; `createPbui` gains `resolveFaceted`. Must validate: the no-React test covers the new file.
- **Status:** proposed.

### Decision D8: The link kernel reaches through relations in a separate phase, using the same edges

- **Context:** `planFollow` refuses on `type` (`plan.ts:45-46`) while `planDerive` already knows relations (`:198-236`).
- **Options considered:** (a) leave follow strict and rely on the palette; (b) let follow return an ambiguous plan offering derive through each legal relation; (c) auto-derive silently.
- **Decision:** (b).
- **Rationale:** (c) hides a relation behind a follow, which the badge would then misreport. (b) keeps the choice visible and reuses the palette's option shape; the drop's cursor badge can name `Derive(… through its product)`.
- **Consequences:** `usePortCarry`'s acceptability treats an ambiguous plan as acceptable and the drop opens the palette when more than one option exists. Must validate: e2e drop of a line-item output onto a product input.
- **Status:** proposed.

### Decision D9: Translators move into the action registry; `createPbui` and the link kernel read them from there

- **Context:** The same edges are handed to three consumers in three shapes: `createPbui({ translators })` for accept mode (`createPbui.tsx:82-90, 345, 371`), the shop's hand-mapped `RelationDefinition`s and `relation()` applier for the link kernel (`packages/pbui-ecommerce/src/createShop.ts:42-51`), and the proposed `FacetDeps.translators`. The registry validates contributions against the graph fail-fast (`registry.ts:81-179`) but never sees the translators, so an edge naming an unknown type is not caught at construction and the vocabulary cannot list edges.
- **Options considered:** (a) keep translators as a `createPbui` option and pass them to the facet module and the link kernel separately; (b) `createActionRegistry({ …, translators })` owns and validates them; `createPbui` reads `actions.translators`; `deriveFacets` reads `prepared.translators`; the link kernel is handed `relationsOf(registry)` / `applyRelation(registry, id, reference, snapshot)`; the `translators` option on `createPbui` is deleted (hard cutover).
- **Decision:** (b).
- **Rationale:** One validation point (duplicate ids, unknown `from`/`to`, unknown scopes and predicates, a `facet` on an edge whose target has no contributions as a `diagnostics` warning), one vocabulary (types, actions, edges), one source for accept, facets and derive, and `explain` can name the edge behind a facet or an acceptance from the same prepared registry. ACTIONS-2 introduced translators last (P6) to keep the first kernel PR small, not because they belong outside the registry.
- **Consequences:** `PreparedRegistry` gains `translators`; `vocabularyOf` gains `facets` from the registry rather than a second argument; `createShop.ts` and `runtime.tsx` drop their two mappings; pbui-chat, plotscript and sandbox declare no translators and are untouched. Must validate: `resolveAcceptance` behaviour is byte-identical (its tests move their fixtures to the registry); the link kernel's `LinkDeps.relations` is derived, not hand-built.
- **Status:** proposed.

## 7. Pseudocode and key flows

### 7.1 Deriving facets

```text
deriveFacets(deps, subject, snapshot, invocation):
    if invocation in {primary, accept}: return []
    out = []
    for t in deps.translators where t.facet:
        decl = normalize(t.facet)                       # label ← t.id, invocations ← [menu, agent, introspection], shadowing ← both
        if invocation not in decl.invocations: continue
        if t.to == subject.type: continue               # no identity facet
        if !sourceMatches(t, subject, deps.graph): continue      # exact or subtypes, as resolveAcceptance
        if t.scopes and none active in snapshot.scopes: continue
        if t.when and evaluateCondition(t.when, {subject, snapshot}, deps.predicates).kind != available: continue
        ref = t.translate(subject, snapshot)
        if !ref or ref.type != t.to: continue           # a translator that yields the wrong type is dropped, never trusted
        out.push({ relation: t.id, label: decl.label, reference: ref, declaration: decl })
    return sortBy(out, relation)                        # order carries no meaning
```

### 7.2 Resolving with facets

```text
resolveWithFacets(prepared, deps, query, snapshot):
    subject   = resolveActions(prepared, query, snapshot)
    facets    = deriveFacets(deps, query.subject, snapshot, query.invocation)
    resolved  = facets.map(f => ({ facet: f, resolution: resolveActions(prepared, { ...query, subject: f.reference }, snapshot) }))
    rows      = subject.actions.map(a => ({ ...a, rowId: a.candidateId }))
    subjectActionIds = set(subject.actions.map(a => a.action))
    trace     = [...subject.trace]
    for { facet, resolution } in resolved:
        trace.push({ stage: "facet", result: "derived", contributionId: facet.relation, candidateId: facet.relation })
        for a in resolution.actions:
            if facet.declaration.shadowing == "subject-wins" and a.action in subjectActionIds:
                trace.push({ stage: "facet", result: "shadowed", candidateId: a.candidateId, reasonCode: "shadowed-by-subject", related: [...] })
                continue
            rows.push({ ...a, primary: false, facet: { relation: facet.relation, label: facet.label, reference: facet.reference },
                        rowId: `facet:${facet.relation}:${a.candidateId}` })
        trace.push(...resolution.trace.map(e => ({ ...e, facet: facet.relation })))
    return { subject, facets: resolved, actions: rows, trace, snapshotRevision: snapshot.revision, registryVersion: prepared.version }
```

### 7.3 Opening the menu

```text
ObjectMenu:
    faceted = pbui.resolveFaceted({ subject: reference, invocation: "menu" })
    header(reference)
    for row in faceted.actions where !row.facet: menuitem(row)
    for { facet, resolution } in faceted.facets:
        rows = faceted.actions.filter(r => r.facet?.relation == facet.relation)
        if rows.length == 0 and resolution.ambiguities.length == 0: continue     # an empty facet shows nothing
        sectionHeader(`<${facet.reference.type}> ${labelFor(facet.reference)} · ${facet.label}`)
        for row in rows: menuitem(row)                  # disabled with reason when unavailable, as today
    if nothing rendered: "No actions available"
```

### 7.4 Performing a row

```text
pbui.performAction(stale: FacetedAction):
    setMenu(null)
    fresh    = resolveWithFacets(prepared, deps, stale.query, snapshotOf(stale.query, environment))
    decision = evaluateFreshFaceted(stale, fresh)
    if decision.kind != "proceed": return decision       # incl. facet-no-longer-resolves
    onPerform(decision.verb, {
        invocation: stale.query.invocation,
        action: decision.action.action,
        candidateId: decision.action.candidateId,
        subject: decision.action.query.subject,           # the facet reference for a facet row
        via: stale.facet ? { relation, label, from: stale.query.subject } : undefined,
        actor })
```

Note the `stale.query` for a facet row is the query the facet resolution ran with, whose `subject` is the facet reference; the ORIGINAL subject is kept on the faceted row as `facet.reference`'s counterpart, `origin`. The implementation stores `origin: query.subject` on every faceted row so `via.from` does not depend on the caller.

### 7.5 Follow through a relation (link kernel)

```text
planFollow(source, dest, s, deps):
    …existing checks…
    if !reaches(S.type, D.type):
        legal = legalRelations(source, dest, s, deps)    # relations whose from ⊇ S.type and to ⊆ D.type
        if legal.empty: return unavailable(`<S.type> does not reach <D.type>`, "type")
        return ambiguous(legal.map(ρ => ({ verb: linkVerbs.derive(source, dest, ρ.id), label: `derive through ${ρ.label}` })))
```

### 7.6 Show through a relation (link kernel)

```text
resolveShow(query, s, deps, options):
    …existing candidates by graph reach…
    for facet in deriveRelationFacets(deps.relations, query.subject, s):      # the kernel's RelationDefinition list, same rule as §7.1 minus scopes/conditions
        for port in inputs reachable from facet.reference.type:
            rank = [graphDistance(facet.type, port.type) + 100, roleDistance, dispositionDistance, scopeIndex, sourceAffinity, 0]
            verb = from ? port.derive(from, port.id, facet.relation) : port.bind(port.id, facet.reference)
            push candidate { candidateId: `existing:${port.id}:via:${facet.relation}`, explanation: `${title} shows ${facet.label} of ${subjectLabel}` }
```

## 8. Diagrams

### 8.1 Data flow for one right-click on a line item

```text
 OrderDetail tile                     createPbui                             actions/ (pure)                      translators
 ┌──────────────────┐ contextmenu  ┌────────────────────┐ resolveFaceted   ┌──────────────────────┐             ┌──────────────┐
 │ <lineItem #3>    │ ───────────► │ ObjectMenu         │ ───────────────► │ resolveWithFacets    │ deriveFacets│ lineItem.    │
 │ 2 × Gold Sov.    │              │ snapshotFor(query) │                  │  ├ resolveActions(li)│ ──────────► │  product ✓   │
 └──────────────────┘              └────────────────────┘                  │  ├ deriveFacets      │ ◄────────── │ product.     │
                                            ▲                              │  └ resolveActions(pr)│  {product}  │  category ✓  │
        ┌───────────────────────────────────┴───────────┐                  └──────────┬───────────┘             │ order.       │
        │ menu: subject rows · PRODUCT section · CATEGORY│ ◄───────────────────────────┘ rows + trace           │  customer  ✗ │
        └───────────────────────────────────┬───────────┘                                                       └──────────────┘
                                            │ click "Inspect" in PRODUCT
                                            ▼
                                   performAction(row) → resolveWithFacets (fresh) → evaluateFreshFaceted
                                            │ proceed
                                            ▼
                                   onPerform(verb, { subject: <product>, via: { relation: "lineItem.product", from: <lineItem #3> } })
```

### 8.2 Row identity across one faceted resolution

```text
FacetedResolution
├── subject: ResolutionResult  (rows keyed by candidateId, e.g. "shop.inspect")
├── facets[0]: { facet: { relation: "lineItem.product", reference: <product> }, resolution: ResolutionResult }
│       rows keyed by candidateId "shop.inspect" again  →  rowId "facet:lineItem.product:shop.inspect"
└── facets[1]: { facet: { relation: "product.category", … } }
```

### 8.3 Where the relation registry is read

```text
            PresentationTranslator[] (product declares once)
                 │                │                 │
       accept mode (today)   facets (new)     LinkDeps.relations (LINK-1)
       resolveAcceptance     deriveFacets     planDerive · (new) planFollow/resolveShow/Link-to via relation
```

## 9. Implementation phases

Each phase ends with a visible postcondition test, following the PBUI-LINK-1 working rule that a store field is not a postcondition.

### Phase 0: freeze the current menus (½ day)

- Add a golden test in `packages/pbui-ecommerce/src/` that snapshots the resolved rows (`action`, `candidateId`, `status.kind`, `label`) for a `lineItem` and for a `product` subject on the seeded shop.
- Add a golden in core (`src/presentation/actions/`) for a three-type toy registry (the `file`/`image-file`/`note` world of `resolve.test.ts:12-45`), so Phase 1 can prove no change without facets.

### Phase 1: the pure facet module (1–2 days)

- `src/presentation/translators/types.ts`: `FacetDeclaration`, `facet?` on `PresentationTranslator`.
- `src/presentation/actions/registry.ts`: `translators` in `CreateActionRegistryOptions` and `PreparedRegistry`, validated fail-fast (D9); `createPbui.tsx` reads `actions.translators` and drops its own option; `packages/pbui-ecommerce/src/createShop.ts` and `runtime.tsx` drop their mappings; the link kernel's `relations`/`relation` come from `relationsOf(registry)`.
- `src/presentation/actions/facets.ts`: `deriveFacets`, `resolveWithFacets`, `evaluateFreshFaceted`, `FacetReference`, `FacetedAction`, `FacetedResolution`; `ResolutionTraceEntry.stage` gains `"facet"`; `explain.ts` gains the `facet:*` cases.
- `actions/index.ts` exports; the no-React fence covers the file.
- Tests (`facets.test.ts`): no facets ⇒ byte-identical to `resolveActions`; opt-in only; invocation filter (`primary`/`accept` yield none); exact vs subtypes source match; scope and condition; wrong-type yield dropped; no identity facet; depth one; permutation invariance across translator order; two edges to one type ⇒ two facets; shadowing default vs `subject-wins` with the trace entry; `evaluateFreshFaceted` codes including `facet-no-longer-resolves`.

### Phase 2: the runtime and the menu (1–2 days)

- `createPbui.tsx`: `resolveFaceted(query)` on the context value; `performAction` accepts a `FacetedAction` (a plain `ResolvedAction` still works: no `facet`); the envelope's `via`; `ObjectMenu` sections, `renderFacetHeader`, keys by `rowId`; the mouse-doc facet count; `primaryFor` unchanged.
- `PerformEnvelope.via` in `actions/types.ts`.
- Stories: `Presentation/Facets` in core over a toy world (a `note` with an `author` facet) showing one section, two sections, an unavailable facet row, and `subject-wins`.
- DOM tests in `src/presentation/*.test.tsx`: sections render; a facet row performs with `via`; a facet-only primary opens the menu; a stale facet row refuses.

### Phase 3: agent vocabulary and explain (½ day)

- `vocabulary.ts`: `facets` entries; golden updated deliberately.
- `describeTraceEntry` cases; a test that a facet row's trace reads "derived through lineItem.product".
- pbui-chat: the tool that lists a reference's actions (or `workbench_describe`, whichever a product exposes) returns `facet` on rows; one test.

### Phase 4: the link kernel through relations (1–2 days)

- `links/plan.ts`: `planFollow` and `planBind` return an ambiguous derive plan when a relation bridges the types (§7.5).
- `links/resolveShow.ts`: relation candidates (§7.6); registration-order test extended.
- `pbui-workbench/src/links/contributions.ts`: derived "Link to…" rows.
- `usePortCarry` / `PortRail`: an ambiguous plan is acceptable; the drop opens the relation palette when more than one option exists; the cursor badge names `Derive(… through …)`.
- Tests: kernel (`derive.test.ts` additions), workbench DOM (`derive.test.tsx`), one real-pointer scenario (drag a line item's `product`-typed emission… see §11 Q3).

### Phase 5: the shop (1 day)

- `relations.ts`: `facet` labels on `lineItem.product` and `product.category`.
- `OrderDetail.tsx`: remove the nested product presentation.
- `Shop/Facets` story; `linking.test.tsx` addition; `e2e/scenes.mjs` tenth scenario: right-click a line → PRODUCT section → "Link to product detail · product" → the product detail's badge reads `→ order detail`… (the row binds a `show` intent, so the badge reads the source tile's title).
- Screenshot for the diary.

### Phase 6 (optional): facet help (½ day)

- `help/resolve.ts`: `resolveHelpWithFacets` fans out with `deriveFacets(…, "introspection")`; the hover card shows facet items under a section. Additive help needs no shadowing.

### What happens to existing packages

No package is required to change. `pbui-chat`, `pbui-plotscript`, `pbui-sandbox` declare no facet edges and keep their menus. `datalab-ui` is frozen.

## 10. Test strategy

### 10.1 Kernel unit tests (vitest, `src/presentation/actions/facets.test.ts`)

Listed under Phase 1. Two invariants deserve emphasis:

- **Permutation invariance.** Shuffle the translator array and the contribution array; the set of rows, their statuses, their `rowId`s, and the ambiguities are identical.
- **No change without opt-in.** With no `facet` fields, `resolveWithFacets(...).actions` deep-equals `resolveActions(...).actions` with `rowId = candidateId` added, and the trace is the subject's trace.

### 10.2 Runtime tests (vitest + RTL)

- Section headers by `data-part="menu-section"`; rows by `role="menuitem"` within the section.
- `onPerform` receives `via` for a facet row and no `via` for a subject row.
- A product rule with `primary: true` and a line item with no own primary: bare click opens the menu (D3).
- Changing the host between render and click so the line's product vanishes: the click refuses with `facet-no-longer-resolves` and the status bar shows the sentence.

### 10.3 Real-interaction scenario (Playwright, the shop's suite)

- Right-click a line in the order detail; the accessibility tree shows a `menu` with a section labelled `product · Gold Sovereign · its product`; click its `Link to product detail · product`; assert the product detail tile shows the product and its badge.

### 10.4 Fences and goldens

- The no-React fence over `actions/facets.ts`.
- Phase 0 goldens must be byte-identical after Phase 1 and change only in Phase 5 (the shop opts in), with the diff reviewed.
- The vocabulary golden changes in Phase 3 only by the added `facets` array.

## 11. Risks, alternatives, open questions

### 11.1 Risks

- **Menu growth.** Two facets with ten rows each triple a menu. Mitigation: opt-in per edge, `subject-wins` for edges whose rows duplicate the subject's, and sections that collapse when empty. If a product needs it, a later `collapsed: true` on the declaration renders a submenu row instead of an inline section.
- **Translator cost on menu open.** Facet derivation calls each opted-in translator once per menu open. Translators are pure over a snapshot and, in the shop, map lookups. A translator that does I/O is already disallowed by D7's "cheap and synchronous" rule.
- **Two rows, one action id.** Under the default policy an agent that performs "inspect" by action id on a line item must say which row; the tool must accept a `rowId` or a `via` and refuse a bare action id when both exist. Mitigation: the agent tool resolves and returns `rowId`s; a bare id that matches two rows is an ambiguity refusal.
- **Provenance in the envelope grows.** `via` is optional and only present for facet rows; routers that ignore it keep working.

### 11.2 Alternatives considered and rejected

- **Graph subtyping with widened values** (D1a): rejected for accept-mode and port reasons; usable as a one-product stopgap, not as the model.
- **Composite references** (D1b): rejected; a new shape for every consumer.
- **Rules declared "via" a relation** (a `via: "lineItem.product"` field on a product rule so it also appears on line items): rejected as the primary mechanism because every product rule would need the annotation; the resolver-side fan-out gives the whole product menu at once. It may return later as sugar for a single rule that should appear on a related type without opting the whole edge in.
- **Nesting presentations** (today's workaround): kept as a legitimate rendering choice when the product wants two click targets, no longer required for reachability.

### 11.3 Open questions

1. **Sections or submenus?** Inline sections are proposed (one keyboard model, no hover-to-open). A product with five facets may want a submenu row per facet; `collapsed` is the proposed switch. Decide after the shop story exists.
2. **Facet order.** By relation id (deterministic, meaningless). Should a declaration carry `order` for presentation, like `ActionMetadata.order`? Proposed: yes, presentation only, never precedence.
3. **What emits a line item?** The order detail tile currently has no output port for line items; the Phase 4 real-pointer scenario needs a source. Proposed: an `out lineItem` port on the order detail (the row you clicked), which also gives "Link to…" a `from`.
4. **Facets for `accept`?** Excluded by D3's sibling rule (accept mode already has translators). A product that wants "this line item is acceptable as a product" has it today through the translator without `facet`.
5. **Help.** Phase 6 is optional; confirm whether hover cards should show facet help or stay subject-only.
6. **Agent tool surface.** Which chat tool lists a reference's actions today? If none does, Phase 3 adds `pbui_actions(reference)` returning faceted rows; confirm with the pbui-chat owners.

## 12. File reference and reading order

1. `src/presentation/types.ts:4-46` — references and descriptors.
2. `src/presentation/actions/types.ts:26-111, 197-288` — query, contexts, primary, results, envelope.
3. `src/presentation/actions/typeGraph.ts:6-50` — the nominal graph and its "never converts payloads" rule.
4. `src/presentation/actions/resolve.ts:65-354` — the resolver; `context/match.ts:41-90` — the shared matcher.
5. `src/presentation/actions/registry.ts:81-258` — validation, `listReachable`, `vocabulary`.
6. `src/presentation/actions/perform.ts:25-47` — fresh revalidation.
7. `src/presentation/translators/types.ts:11-53`, `translators/resolve.ts:28-104` — translators and accept resolution.
8. `src/presentation/createPbui.tsx:60-181` (options), `:537-556` (resolve, performAction), `:649-666` (primary, mouse-doc), `:700-745` (click contract), `:883-993` (ObjectMenu).
9. `src/presentation/actions/vocabulary.ts:9-70`, `explain.ts` — the agent's static view and trace prose.
10. `src/presentation/help/resolve.ts:24-70` — the additive resolver over the same matcher.
11. `src/presentation/links/snapshot.ts` (`RelationDefinition`, `LinkDeps`), `links/plan.ts:38-58, 198-236`, `links/resolveShow.ts:96-101`, `packages/pbui-workbench/src/links/contributions.ts:264-317` — where the link kernel reads relations today.
12. `packages/pbui-ecommerce/src/presentation/{types,actions,relations}.ts`, `runtime.tsx:11-23`, `tiles/OrderDetail/OrderDetail.tsx:14-30, 84-98` — the first consumer.
13. `packages/datalab-ui/src/pbui/actions.ts:330-343` — abstract types as shared behaviour.
14. `src/presentation/actions/resolve.test.ts:1-60` — the test world and helpers to copy.
15. PBUI-ACTIONS-2 guide (`ttmp/2026/08/26/PBUI-ACTIONS-2--…/design-doc/01-…md`) §4 for the kernel's five identities and §7 for its test strategy; PBUI-LINK-1 guide §7 D7 and §17 for the relation registry decision and the implemented link kernel.

## 13. Glossary

- **Reference**: `{ type, value }`, one concrete type.
- **Subject**: the reference a query is about; for a menu, the presentation right-clicked.
- **Relation**: a declared direct conversion between two types with an id, endpoints, scopes, condition, priority: a `PresentationTranslator`.
- **Facet edge**: a relation that opted in with `facet`.
- **Facet**: the reference a facet edge yields for a subject under a snapshot, with the relation's id and label.
- **Faceted resolution**: the subject's resolution plus one resolution per facet, flattened into rows with `rowId` and `facet`.
- **Section**: the menu group for one facet.
- **Via**: the envelope field naming the relation and the origin subject of a facet row.
- **Shadowing**: dropping a facet row whose action id the subject already resolved; per edge, default off.

## 14. References

- PBUI-ACTIONS-1 and -2 (the kernel's foundations and implementation), PBUI-ACTIONS-3 (post-legacy unification: envelope, vocabulary), PBUI-HELP-001 (shared matcher), PBUI-LINK-1 (relations as the link kernel's derive registry; D7, D10).
- CLIM presentation types (presentation translators as the origin of "show X as Y"), cited in the PBUI-LINK-1 research report §16.
