---
Title: 'PBUI type-directed action selection kernel: source-audited architecture, design, and implementation guide'
Ticket: PBUI-ACTIONS-1
Status: implementation-ready
Topics:
  - pbui
  - frontend
  - architecture
  - action-selection
  - accessibility
  - migration
DocType: design-doc
Intent: long-term
Owners: []
SourceSnapshot:
  Package: '@hyperslop-systems/pbui'
  Version: '0.6.0'
  Archive: 'pbui(1).zip'
  Reviewed: '2026-08-26'
Summary: 'A source-audited, implementation-ready design for replacing PBUI exact-type descriptor action callbacks with a small pure action-selection kernel while preserving current focus, accessibility, accept-mode, serializable-verb, workbench, chat, sandbox, and product integration contracts.'
WhatFor: 'Hand-off guide for the frontend team implementing PBUI-ACTIONS-1 across PBUI core and its in-repository consumers.'
WhenToUse: 'Before changing presentation types, descriptor actions, object-menu resolution, accept conversions, generated actions, or the Provider perform path.'
---

# PBUI type-directed action selection kernel {.unnumbered .unlisted}

## Source-audited architecture, design, and implementation guide {.unnumbered .unlisted}

**Implementation target:** `@hyperslop-systems/pbui` after version 0.6.0  
**Primary readers:** PBUI core maintainers and the in-house frontend implementation team  
**Decision status:** approved direction, implementation detail specified here

---

## 0. Reader contract, evidence, and validation status

This document is the design of record for implementing PBUI-ACTIONS-1 against the attached repository snapshot. It is not a generic action-dispatch essay. Every migration recommendation is tied to code that exists in this repository, including PBUI core, `pbui-workbench`, `datalab-ui`, `pbui-chat`, and `pbui-sandbox`.

The source audit covered the full archive structure and the concrete interaction paths listed below:

| Area | Principal source files |
|---|---|
| Core reference and descriptor contracts | `src/presentation/types.ts`, `src/presentation/registry.ts` |
| Provider, presentation gestures, menus, accept mode | `src/presentation/createPbui.tsx` |
| Focus and Escape ownership | `src/focus.ts`, `src/surfaces.ts` |
| Presentation CSS and disabled-action policy | `public/presentation-parts.css` |
| Shortcut policy | `src/chrome/shortcutRouting.ts` |
| Shared workbench contributions and execution | `packages/pbui-workbench/src/tileDescriptor.ts`, `verbs.ts`, `store.ts`, `apps.ts` |
| Datalab product descriptors | `packages/datalab-ui/src/pbui/**` |
| Live agent-generated actions | `packages/pbui-sandbox/src/actions.ts`, `library.ts` |
| Chat product descriptors and conversion | `packages/pbui-chat/demo/src/pbui/**` |
| Existing downstream effect policy | `packages/pbui-chat/src/router/createVerbRouter.ts`, `packages/pbui-chat/src/tools/agentEffectGateway.ts` |

The archive contains no installed `node_modules`, and `pnpm` is not available in the execution environment. Therefore this review is a static source audit: the guide identifies and preserves the repository's test contracts, but it does not claim that the test suite was executed during preparation.

Source references use `path:line-line`. Line numbers refer to the attached snapshot.

---

## 1. Executive decision

PBUI should keep its current semantic presentation references, representation descriptors, accessibility behavior, explicit accept mode, and serializable verb boundary. It should replace one part only: **the exact-type descriptor `actions()` lookup**.

The new center is a small pure action-selection kernel:

```text
presentation reference + action query + immutable snapshot
                         |
                         v
       validated type graph + action contributions
                         |
                         v
         applicability -> specificity -> ambiguity
                         |
                         v
       resolved actions + compact explanation trace
                         |
                         v
             fresh revalidation on perform
                         |
                         v
        existing product-owned serializable verb router
```

The implementation should adopt the following mechanisms now:

1. A validated nominal runtime type graph, used only for action reachability and specificity.
2. Independent action contributions, separate from representation descriptors.
3. Stable rule identity distinct from conceptual action identity.
4. Static action rules plus bounded, query-dependent action families.
5. An immutable, revisioned selection snapshot built at the product integration boundary.
6. Explained availability with distinct semantics for unavailable, inapplicable, and hidden.
7. A pure, registration-order-independent resolver with ambiguity returned as data.
8. A compact trace produced by the same resolution path as the menu.
9. Fresh re-resolution before an action crosses the existing `onPerform` boundary.
10. Direct typed translators after the action resolver is stable.

The implementation should explicitly defer:

- arbitrary predicate dispatch or theorem proving;
- multi-subject dispatch;
- history/statechart machinery in PBUI core;
- a generic AOP or advice framework;
- translator path search or conversion chaining;
- a scope DAG or mode lifecycle language;
- migration of the one existing workbench shortcut into a command registry.

The resulting architecture is intentionally narrower than the original research proposal. It solves the repository's concrete composition, inheritance, explanation, ambiguity, and stale-action problems without turning PBUI into a second programming language.

---

## 2. What the source already gets right

The migration must begin by protecting the current strengths. These are not incidental implementation details.

### 2.1 Semantic references preserve type-to-payload correlation

`PresentationReference` is a discriminated union derived from a product's value map (`src/presentation/types.ts:4-15`):

```ts
export type PresentationReference<
  Values extends PresentationValues,
  Type extends PresentationType<Values> = PresentationType<Values>,
> = {
  [Key in Type]: {
    type: Key;
    value: Values[Key];
  };
}[Type];
```

This is the correct representation boundary. The action kernel must dispatch on semantic reference types, never DOM tags, CSS classes, React component names, or structural guesses about values.

### 2.2 Unavailability and its explanation are one value

`PresentationAction.disabledBecause?: string` deliberately makes two invalid states impossible: unavailable without a reason, and available with a stale reason (`src/presentation/types.ts:25-112`). The renderer reads the same field for `disabled`, title text, and the visible reason (`src/presentation/createPbui.tsx:546-577`). The stylesheet states the product rule directly: disabled entries are shown, not hidden, because hiding the verb hides the rule (`public/presentation-parts.css:127-137`).

The new kernel must preserve this one-fact/one-reason contract. It should generalize the internal state model, not regress to a boolean plus optional prose.

### 2.3 Serializable verbs are already the correct effect boundary

A descriptor returns data. `PbuiProviderProps.onPerform` is required specifically so menus cannot appear operational while commands vanish (`src/presentation/createPbui.tsx:41-55`). Workbench verbs are discriminated data routed through one handler, and chat verbs are validated, dispatched, and reported as typed outcomes.

The new kernel's `bind` step must continue to return serializable data. It must never execute effects during discovery.

### 2.4 Presentation gesture and accessibility behavior is mature and subtle

`Presentation` currently implements three distinct left-click contracts through one `activate` object (`src/presentation/createPbui.tsx:66-158`):

```text
activate absent        -> Presentation opens the object menu
activate with run       -> Presentation acts; host also receives the click
activate without run    -> host owns the click; Presentation documents it
```

It also:

- gives accept mode first priority;
- marks the native click with `Symbol.for` so an outer `Presentation` ignores a click handled by an inner one while an ordinary host still receives it (`createPbui.tsx:57-65, 327-389`);
- routes Enter and Space through `.click()` so keyboard and pointer activation use the same semantics (`createPbui.tsx:391-437`);
- yields role and tab stop to a composite widget with `inComposite` (`createPbui.tsx:121-145, 439-465`);
- supports ContextMenu and Shift+F10;
- maintains mouse documentation and accessible live-region output.

The action-kernel work must not rewrite these behaviors as a side effect. Menu resolution should migrate first. Resolver-driven primary actions should be opt-in and later.

### 2.5 Focus and Escape ownership are explicit infrastructure

Object menus capture their invoker, restore focus after removal, register as an Escape surface, focus the first enabled row, support ArrowUp/ArrowDown, and close on click-away (`createPbui.tsx:469-580`). The reusable focus helper restores the exact invoker or a connected owning surface, never `body` as an undocumented fallback (`src/focus.ts:1-50`).

Escape ownership is page-global by design, StrictMode-safe, and intentionally not a general keyboard router (`src/surfaces.ts:1-131`). The new ambiguity and translator chooser surfaces must participate in this infrastructure rather than creating independent document listeners with guessed precedence.

### 2.6 Pure contextual policy already exists elsewhere

`routeWorkbenchKey` is a pure function of explicit context (`src/chrome/shortcutRouting.ts:1-70`). Its source comments explicitly reject a command registry until multiple shortcuts justify one. The action kernel should share context vocabulary with shortcut routing over time, but should not absorb this subsystem during PBUI-ACTIONS-1.

---

## 3. Current architecture and the exact seam to replace

### 3.1 Current lookup path

Representation and action discovery are currently owned by the same exact descriptor:

```text
PresentationReference
       |
       v
registry.descriptorFor(reference.type)
       |
       +---- label / describe / tone
       |
       `---- descriptor.actions(reference.value, environment)
                          |
                          v
                  PresentationAction[]
```

`createPresentationRegistry` is a closed partial map (`src/presentation/registry.ts:30-79`). `actionsFor` performs one exact lookup and returns that descriptor's callback output (`registry.ts:69-72`). `ObjectMenu` calls it each render (`createPbui.tsx:506-510`).

This is deterministic and cheap, but it conflates four ownership models:

- representation normally has one owner per concrete type;
- actions may have many independent contributors;
- inherited behavior belongs to semantic type relationships;
- live generated actions may be created after the descriptor map was closed.

### 3.2 Existing products already work around the closed map

The shared workbench descriptor accepts `extra?(tile)` and concatenates the product's contributions last (`packages/pbui-workbench/src/tileDescriptor.ts:28-33, 50-126`). That seam proves actions need open composition even when representation remains closed.

The sandbox goes further. `withGeneratedActions` wraps an entire registry, reads a live program library when `actionsFor` is called, filters by exact type, and appends agent-created actions without re-registration (`packages/pbui-sandbox/src/actions.ts:5-70`). The chat demo depends on that behavior (`packages/pbui-chat/demo/src/pbui/registry.ts:80-89`).

The new action registry must replace both patterns:

- no `extra()` callback on a shared descriptor;
- no registry wrapper that reinstates array-order semantics;
- live actions still appear on the next resolution.

### 3.3 Existing product adapters manufacture unstable IDs

Datalab and the chat demo adapt product actions with IDs such as:

```ts
id: `${descriptor.ptype}:${index}:${action.label}`
```

See `packages/datalab-ui/src/pbui/registry.ts:59-89` and `packages/pbui-chat/demo/src/pbui/registry.ts:39-55`.

These IDs are unsuitable for an override system:

- a label edit changes identity;
- inserting a row changes every later index;
- they do not distinguish declaration identity from conceptual action identity;
- they cannot support stable traces or fresh revalidation.

Migration must assign deliberate IDs.

### 3.4 Dynamic action lists are a real requirement

A one-rule/one-action API alone is not enough for this repository.

Datalab's `<datum>` descriptor examines query-local schema and emits two filter actions per categorical field, capped at four fields (`packages/datalab-ui/src/pbui/descriptors/datum.ts:29-64`). The set and labels vary with the row and current schema.

The sandbox library holds runtime `ActionRecord`s with user/agent-created IDs, target types, behavior, danger, and description (`packages/pbui-sandbox/src/library.ts:43-60`). The wrapper emits them from live library state.

The kernel therefore needs two contribution forms:

- **ActionRule** - declares exactly one conceptual action.
- **ActionFamily** - expands into a finite set of stable action instances for one query and snapshot.

Families are not an escape back to unstructured descriptor callbacks. Their outputs must have stable IDs and enter the same applicability, override, ambiguity, trace, and revalidation pipeline as static rules.

### 3.5 Current accept conversion is exact and ordered

`acceptedReference` first checks exact target membership, then runs conversion callbacks in array order, stopping at the first success (`src/presentation/createPbui.tsx:187-202`). Datalab registers one `cat -> field` conversion (`packages/datalab-ui/src/pbui/runtime.tsx:19-32`); the chat demo registers `row -> product` (`packages/pbui-chat/demo/src/pbui/runtime.tsx:6-31`).

This is useful and explicit, but currently lacks subtype acceptance, typed edge metadata, explanation, and ambiguity handling. It should be migrated after the core resolver.

### 3.6 Existing downstream effect policy must remain downstream

PBUI core currently closes the menu and delegates the verb (`createPbui.tsx:254-270`). That is intentionally small.

The workbench mutation layer preflights and applies protocol mutations, reports handler refusal, commits atomically, and separates document state from local shell state. Chat's verb router validates the vocabulary, dispatches by family, catches rejection, serializes reports, and records the outcome (`packages/pbui-chat/src/router/createVerbRouter.ts:109-119, 136-250`). The agent effect gateway additionally owns approval reservation/finalization, idempotency, revision envelopes, and a durable trace outbox (`packages/pbui-chat/src/tools/agentEffectGateway.ts:136-176, 203-312`).

PBUI core should add **fresh action revalidation** before delegation. It should not duplicate authorization, transactions, approvals, idempotency, or telemetry with a generic AOP stack.

---

## 4. Problem statement

The exact descriptor callback cannot express the next required behavior without ad hoc seams:

| Requirement | Why the current exact callback is insufficient |
|---|---|
| Inherited actions | A child type sees only its own descriptor callback. Base actions must be copied. |
| Specific overrides | There is no conceptual action identity by which `image.open` can replace generic `document.open`. |
| Independent contributions | A closed descriptor map needs a merge owner, `extra`, or a wrapper. |
| Contextual explanation | A callback can produce a disabled row, but the framework cannot explain why a rule was not discovered or which fact it read. |
| Ambiguity diagnosis | Concatenated arrays silently accept collisions; order becomes behavior. |
| Stable introspection | Label/index-derived IDs are not stable identities. |
| Fresh execution check | The menu stores a verb, and `perform` delegates it without re-resolving. |
| Typed acceptance | Conversions are ordered callbacks with no source/target/scope metadata or ambiguity result. |
| Agent-safe discovery | An agent cannot ask which rules could apply without running product callbacks and reconstructing their meaning. |

The design must solve these while preserving current render, focus, keyboard, accept-mode, and effect boundaries.

---

## 5. Requirements and non-requirements

### 5.1 Functional requirements

The implementation must:

1. Preserve `PresentationReference` as the semantic object identity and payload carrier.
2. Keep representation descriptors exact and independently owned.
3. Support independent action contributions without descriptor mutation.
4. Support nominal runtime subtype inheritance for actions.
5. Preserve the original concrete reference when a parent rule applies.
6. Distinguish declaration identity from conceptual action identity.
7. Support static action rules and bounded dynamic action families.
8. Evaluate action discovery from an explicit immutable snapshot.
9. Preserve visible unavailable rows with exactly one actionable reason.
10. Distinguish non-relevance from policy non-disclosure.
11. Choose overrides from declared specificity, scope, and explicit priority only.
12. Return unresolved conflicts as ambiguity data.
13. Produce compact provenance and trace data from the resolver path itself.
14. Bind only a selected available contribution to a serializable verb.
15. Re-resolve against fresh state before delegation to `onPerform`.
16. Preserve existing menu focus, Escape, keyboard, nested-presentation, and composite behavior.
17. Preserve live sandbox-generated actions without registry reconstruction.
18. Keep current product routers and handlers as the effect/security boundary.
19. Later replace ordered accept conversions with direct typed translators and explicit ambiguity.

### 5.2 Quality requirements

The implementation must be:

- deterministic for the same registry, query, and snapshot;
- invariant under contribution registration order;
- fail-fast on invalid graph, duplicate IDs, or unknown declared references;
- fail-closed on unknown condition operations and predicate IDs;
- testable without React, a DOM, or product stores;
- SSR-compatible;
- bounded for ordinary unary menu queries;
- explicit about where product-specific facts enter;
- observable without executing effects;
- compatible with React 18 and 19, Node 20+, and the repository's strict TypeScript settings.

### 5.3 Non-requirements for this implementation

The first implementation will not include:

- arbitrary logical implication between host-language predicates;
- multi-subject actions or tuple dispatch;
- automatic conversion through multiple translator edges;
- core-owned history logs, counters, statecharts, or workflow reducers;
- generic before/around/after advice;
- runtime JavaScript supplied as portable action code;
- automatic authorization derived from `danger` metadata;
- replacement of workbench verb routing, chat routing, or the agent effect gateway;
- a generalized shortcut or command registry;
- inherited label, description, or tone policy.

---

## 6. Target architecture

### 6.1 Component boundaries

```text
+-------------------------------------------------------------------+
| Product / application                                             |
|                                                                   |
| domain stores -> Environment (representation)                     |
|               -> snapshotFor(query, environment) -> Snapshot      |
|                                                                   |
| descriptors: label / describe / tone                              |
| action contributions: rules / families / predicates               |
| onPerform(serializable verb) -> existing routers and handlers      |
+----------------------------+--------------------------------------+
                             |
                             v
+-------------------------------------------------------------------+
| PBUI presentation runtime                                         |
|                                                                   |
| Presentation -> semantic reference                                |
| ObjectMenu -> ActionQuery                                         |
| AcceptBanner / MouseDoc / focus / Escape surfaces                 |
+----------------------------+--------------------------------------+
                             |
                             v
+-------------------------------------------------------------------+
| Pure action-selection kernel                                      |
|                                                                   |
| type graph | contribution registry | condition evaluator           |
| resolver   | compact trace         | ambiguity diagnostics         |
| perform revalidation coordinator                                  |
+-------------------------------------------------------------------+
```

### 6.2 Separation of representation and behavior

After migration:

```ts
interface PresentationDescriptor<Value, Environment> {
  label(value: Value, environment: Environment): ReactNode;
  describe?(value: Value, environment: Environment): unknown;
  tone?: PresentationTone;
}
```

Actions move to an independent registry. Labels, descriptions, and tones remain exact-type representation policy. There is no requirement for a generic document label to be inherited by an image reference.

### 6.3 Environment and selection snapshot are not the same object

The current `Environment` is useful and should remain. Datalab deliberately separates cheap schema access from expensive table evaluation (`packages/datalab-ui/src/pbui/types.ts:191-230`). Representation rendering may call `fieldsFor`, while menu/description paths may afford `tableFor`.

The resolver must not receive the live environment object as if it were immutable state. Instead, `createPbui` receives a product callback:

```ts
snapshotFor(
  query: ActionQuery<Values>,
  environment: Environment,
): SelectionSnapshot<ProductFacts>;
```

This callback runs only at action-resolution boundaries: menu resolution, optional primary-action resolution, introspection, and perform revalidation. It captures query-relevant, immutable facts and a revision. It must not return live store getters or mutable maps whose contents can change without the revision changing.

The product remains responsible for causing React to render when resolution-relevant state changes. The kernel does not subscribe to arbitrary stores.

---

## 7. Stable vocabulary and identity model

### 7.1 Runtime type ID

A runtime type ID names a semantic action-inheritance node. It may be concrete (`file`, `image-file`) or abstract (`object`, `document`, `selectable`).

Concrete presentation references remain restricted to keys of `PresentationValues`. Abstract runtime nodes need no dummy payload entry.

### 7.2 Rule ID

A rule ID names one declaration contributed by one package:

```text
workbench.tile.close
images.open-preview
chat.product.reorder
```

Rule IDs are globally unique within one action registry and appear in traces and diagnostics.

### 7.3 Family ID and candidate ID

A family ID names one dynamic contribution source:

```text
datalab.datum.filters
sandbox.generated-actions
```

Each emitted instance has a stable key. The resolver forms a candidate ID from the family ID and key:

```text
datalab.datum.filters/keep:region
sandbox.generated-actions/act-17
```

Keys must be deterministic for the same query and snapshot and unique within that expansion. Array index and label are forbidden as identity.

### 7.4 Action ID

An action ID names the conceptual operation used for override and deduplication:

```text
presentation.open
object.inspect
file.delete
chart.mapping.x
datum.keep.region
```

Several rules may implement one action ID. They then compete. Different action IDs accumulate.

A rule ID must not be reused as an action ID by convention. The distinction is load-bearing:

```text
rule:   docs.open-default
rule:   files.open-editor
rule:   images.open-preview

shared conceptual action: presentation.open
```

### 7.5 Ordering metadata

Menu placement is not dispatch. A resolved action carries group and order metadata. Sorting may use:

```text
(group rank, order, localized label, action ID)
```

Changing menu order must never change which rule wins.

---

## 8. Runtime type graph

### 8.1 Public shape

```ts
export type RuntimeTypeId = string;

export interface PresentationTypeDefinition {
  id: RuntimeTypeId;
  parents?: readonly RuntimeTypeId[];
  abstract?: boolean;
}

export interface PresentationTypeGraph {
  isSubtype(type: RuntimeTypeId, supertype: RuntimeTypeId): boolean;
  distance(type: RuntimeTypeId, supertype: RuntimeTypeId): number;
  ancestors(type: RuntimeTypeId): readonly {
    type: RuntimeTypeId;
    distance: number;
  }[];
}
```

Concrete values still use `PresentationReference<Values>`. The runtime graph only answers reachability and shortest-path distance.

### 8.2 Validation

Registration must throw for:

- duplicate type IDs;
- unknown parents;
- cycles;
- a concrete presentation type used by a rule but absent from the graph;
- a descriptor concrete type absent from the graph once strict coverage is enabled.

The executable lab collected graph problems but continued. Production must not. All resolver guarantees assume a valid graph.

### 8.3 Distance and specificity

For each type, precompute shortest ancestor distance by breadth-first search:

```text
image-file -> image-file  0
image-file -> file        1
image-file -> document    2
image-file -> object      3
```

Within one action ID, a smaller distance is more specific.

Multiple inheritance is acceptable for action inheritance. It must not imply payload coercion.

### 8.4 Payload contract

Runtime subtyping and TypeScript payload assignability are different facts. A rule declared for abstract `document` may receive an `image-file` reference whose concrete payload is `Values["image-file"]`; it must not pretend that payload is `Values["document"]`.

The public API should make this distinction visible with two factories:

```ts
const actions = defineActions<Values, ProductFacts, Verb>();

// Exact: receives a correctly narrowed concrete reference and payload.
actions.exact("file", { /* ... */ });

// Inherited: receives the original generic concrete reference.
actions.inherited("document", { /* ... */ });
```

An inherited rule may use reference identity, type, and snapshot services. If it needs a parent-shaped view, the product must supply an explicit named projection or predicate. The graph never converts payloads.

---

## 9. Selection snapshot

### 9.1 Required core fields

```ts
export interface SelectionSnapshot<ProductFacts> {
  /** Changes whenever any fact that can affect resolution changes. */
  revision: string | number;

  /** Ordered inner/local to outer/global. */
  scopes: readonly ScopeId[];

  /** Transient contextual facts, not virtual presentation types. */
  modes: ReadonlySet<ModeId>;

  /** UI feedback facts, never the sole security boundary. */
  capabilities: ReadonlySet<string>;

  /** Product-owned immutable facts derived for this query. */
  product: Readonly<ProductFacts>;
}
```

Selection, focus, active surface, or other facts should be added only when real rules need them. Do not begin with a universal context object.

### 9.2 Revision contract

The revision advances whenever a fact used by action resolution can change:

- product state read by a named predicate;
- active scopes;
- active modes;
- capabilities;
- live generated action definitions;
- any object state used by binding or availability.

Purely presentational changes such as hover do not advance it.

A revision is not itself an authorization token. It exists to identify the state used for a result and quantify drift. Perform always re-resolves.

### 9.3 Immutability contract

The snapshot must be stable after creation. Copying a `Set` while leaving `product.files` as a live mutable object does not meet the contract.

Products have three acceptable strategies:

1. Return immutable state objects from their store.
2. Copy the small query-local facts required by rules.
3. Return versioned immutable selectors whose referents are not mutated in place.

Do not deep-clone large tables as a default. Datalab should derive the small schema/type/target facts required for one reference.

### 9.4 Example: Datalab field facts

```ts
interface FieldActionFacts {
  targetDocId: string | null;
  targetName: string;
  fieldType: FieldType | null;
}

function snapshotForField(
  query: ActionQuery<PresentationValues>,
  env: PbuiEnvironment,
  revision: number,
): SelectionSnapshot<FieldActionFacts> {
  const ref = expectExact(query.subject, "field");
  const field = env.fieldsFor(ref.value.docId)
    .find((candidate) => candidate.name === ref.value.name);
  const targetDocId = ref.value.docId ?? env.activeDocId;
  return {
    revision,
    scopes: ["datalab", "global"],
    modes: EMPTY_MODES,
    capabilities: EMPTY_CAPABILITIES,
    product: {
      targetDocId,
      targetName: env.nameOf(targetDocId),
      fieldType: field?.type ?? null,
    },
  };
}
```

The menu path remains allowed to evaluate richer data where needed, but rule dependencies become explicit values rather than hidden store reads.

---

## 10. Availability and applicability

### 10.1 Internal state model

The UI still effectively has enabled, disabled, and absent rows. Internally the resolver needs four states because absence has two different override meanings:

```ts
export type Availability =
  | { kind: "available" }
  | {
      kind: "unavailable";
      because: string;
      code?: string;
    }
  | {
      kind: "inapplicable";
      because: "not-relevant" | "not-applicable";
    }
  | {
      kind: "hidden";
      because: "not-disclosed" | "policy";
    };
```

### 10.2 Resolver semantics

- `available`: participates in override; selected row is enabled and may bind a verb.
- `unavailable`: participates in override; selected row is visible and disabled with one reason.
- `inapplicable`: removed before override; a less-specific implementation may be selected.
- `hidden`: participates in override; if selected, no user-visible row is emitted, and less-specific fallbacks remain suppressed.

The distinction prevents a serious policy bug. If a specific `secret-file.open` rule is hidden for non-disclosure, dropping it before override would allow generic `document.open` to leak through. Conversely, a `restore` rule on a live file is simply not relevant and should not suppress a genuinely different fallback if one exists.

### 10.3 Unavailable specific rules suppress generic fallback

A more-specific unavailable rule normally wins over a generic available rule:

```text
generic document.delete          available
a specific protected.delete      unavailable("protected")
```

Falling back to the generic delete would bypass the specific policy. If a product wants fallback behavior, it must express that explicitly as `inapplicable`, use a different action ID, or register a deliberate fallback rule.

### 10.4 Hidden trace disclosure

Developer traces may contain hidden rule IDs and policy codes. User-facing menus and ordinary agent introspection must not expose non-disclosed rule details by default. The trace API should support an access-controlled or development-only verbose materializer.

---

## 11. Structured conditions and named predicates

### 11.1 Minimal condition algebra

The first implementation should support only the common, explainable cases already required by the repository:

```ts
export type Failure = Exclude<Availability, { kind: "available" }>;

export type Condition =
  | { op: "all"; conditions: readonly Condition[] }
  | { op: "mode"; id: ModeId; active: boolean; onFail: Failure }
  | { op: "capability"; id: string; onFail: Failure }
  | { op: "predicate"; id: PredicateId };
```

Factory functions keep rule declarations readable:

```ts
all(
  modeOff("review", unavailable("review mode is read-only")),
  capability("write", unavailable("write access is required")),
  predicate("file.can-delete"),
)
```

Do not add generic `not`, arbitrary `any`, expressions, or embedded JavaScript syntax in phase 1. Named predicates are the escape hatch.

### 11.2 Short-circuit explanation

`all` returns the first non-available child. This enforces one dominating reason rather than a condition dump. Rule authors should place the most actionable reason first.

### 11.3 Predicate registry

```ts
export type ProductPredicate<Values, ProductFacts> = (
  context: PredicateContext<Values, ProductFacts>,
) => Availability;

predicates.define("file.can-delete", ({ snapshot }) =>
  snapshot.product.canDelete
    ? available()
    : unavailable("this file is protected from deletion"),
);
```

Predicates:

- are registered by stable ID;
- are pure;
- return full `Availability`, not boolean;
- are the only condition nodes that read `snapshot.product`;
- may be reused by several rules;
- are validated before resolution.

An unknown predicate ID is a registration error. An impossible unknown operation at runtime must throw or fail closed; it must never default to available.

### 11.4 Optional opaque testers

A local pure `test` function may remain as an escape hatch for one-off product logic. It returns `Availability` and may affect applicability only. It cannot establish precedence. Diagnostics should mark rules using opaque testers because static conflict analysis is necessarily limited.

---

## 12. Action contributions

### 12.1 Common metadata

```ts
export interface ActionMetadata<Values, ProductFacts> {
  label:
    | string
    | ((context: SelectedActionContext<Values, ProductFacts>) => ReactNode);
  description?: string;
  group?: string;
  order?: number;
  danger?: boolean;
}
```

`danger` is presentation metadata only. It may affect styling or confirmation UX. It must not imply a capability, permission, authorization rule, or security policy.

### 12.2 Static exact rule

```ts
export interface ExactActionRule<
  Values extends PresentationValues,
  Type extends PresentationType<Values>,
  ProductFacts,
  Verb,
> {
  kind: "rule";
  id: RuleId;
  action: ActionId;
  subject: Type;
  match: "exact";
  scopes: readonly ScopeId[];
  invocations?: readonly ActionInvocation[];
  when?: Condition;
  test?(context: ExactRuleContext<Values, Type, ProductFacts>): Availability;
  metadata: ActionMetadata<Values, ProductFacts>;
  priority?: number;
  bind(context: ExactRuleContext<Values, Type, ProductFacts>): Verb;
}
```

Use exact rules as the default migration target. They preserve current payload typing and current exact action coverage.

### 12.3 Static inherited rule

```ts
export interface InheritedActionRule<Values, ProductFacts, Verb> {
  kind: "rule";
  id: RuleId;
  action: ActionId;
  subject: RuntimeTypeId;
  match: "subtypes";
  scopes: readonly ScopeId[];
  invocations?: readonly ActionInvocation[];
  when?: Condition;
  test?(context: InheritedRuleContext<Values, ProductFacts>): Availability;
  metadata: ActionMetadata<Values, ProductFacts>;
  priority?: number;
  bind(context: InheritedRuleContext<Values, ProductFacts>): Verb;
}
```

The inherited context contains the original concrete reference. It does not expose a falsely narrowed parent payload.

### 12.4 Action family

```ts
export interface ActionFamily<Values, ProductFacts, Verb> {
  kind: "family";
  id: FamilyId;
  subject: RuntimeTypeId;
  match: "exact" | "subtypes";
  scopes: readonly ScopeId[];
  invocations?: readonly ActionInvocation[];
  priority?: number;
  expand(
    context: FamilyContext<Values, ProductFacts>,
  ): readonly ActionFamilyInstance<Values, ProductFacts, Verb>[];
}

export interface ActionFamilyInstance<Values, ProductFacts, Verb> {
  /** Stable and unique within this family's result. */
  key: string;
  action: ActionId;
  status?: Availability;
  metadata: ActionMetadata<Values, ProductFacts>;
  bind(context: FamilyContext<Values, ProductFacts>): Verb;
}
```

Family constraints:

- expansion is pure and bounded;
- output order has no override meaning;
- every key and action ID is stable for the same semantic instance;
- duplicate keys from one expansion are errors;
- emitted candidates use the family's type distance, scope, invocation set, and priority;
- status and bind still obey the selected-only rules;
- query-time ambiguity diagnostics apply exactly as for static rules.

### 12.5 Why families are not legacy callbacks

A descriptor callback returns final menu rows. A family returns candidate declarations that still pass through:

```text
scope -> type -> applicability -> action partition -> specificity
      -> explicit tie-break -> ambiguity -> selected binding -> menu order
```

This is the key architectural constraint. Dynamic generation remains composable and explainable.

---

## 13. Action registry and validation

### 13.1 Registry shape

```ts
export interface ActionRegistry<Values, ProductFacts, Verb> {
  readonly version: string | number;
  readonly graph: PresentationTypeGraph;
  resolve(
    query: ActionQuery<Values>,
    snapshot: SelectionSnapshot<ProductFacts>,
  ): ResolutionResult<Values, Verb>;
  explain(
    query: ActionQuery<Values>,
    snapshot: SelectionSnapshot<ProductFacts>,
  ): ResolutionResult<Values, Verb>;
  listReachable(type: RuntimeTypeId, scopes: readonly ScopeId[]): ReachableContribution[];
  diagnostics(): readonly RegistryDiagnostic[];
}
```

`resolve` always returns compact trace codes. `explain` may materialize verbose text or request expanded trace detail. Both use the same selection path.

### 13.2 Registration failures

Fail immediately for:

- duplicate rule, family, predicate, or type IDs;
- unknown type or scope references;
- invalid graph;
- static rule with empty scope list;
- unsupported invocation kind;
- malformed condition or unknown predicate;
- missing action ID;
- non-finite priority/order;
- a portable registry binder known to return a non-serializable value, where runtime validation is configured;
- equal static declarations that are guaranteed to collide in overlapping scopes at equal priority.

### 13.3 Potential diagnostics

Some conflicts cannot be proven at registration because families and opaque testers are query-dependent. Return non-fatal diagnostics for:

- same action and same declared type in overlapping scopes with opaque mutually exclusive tests;
- family/static overlap at equal specificity;
- an inherited action reachable through incomparable parents;
- a family whose outputs have not yet been observed with stable keys in development validation.

Resolution remains authoritative and returns ambiguity rather than guessing.

---

## 14. Action query

The initial resolver is unary. Keep the query extensible without implementing tuple dispatch:

```ts
export type ActionInvocation = "menu" | "primary" | "agent" | "introspection";

export interface ActionQuery<Values extends PresentationValues> {
  subject: PresentationReference<Values>;
  invocation: ActionInvocation;
  gesture?: {
    kind: "pointer" | "keyboard" | "programmatic";
    name?: string;
    modifiers?: ReadonlySet<"shift" | "control" | "meta" | "alt">;
  };
}
```

For initial object-menu migration:

```ts
{ subject: reference, invocation: "menu" }
```

The query should not contain mutable environment or store references.

---

## 15. Resolver algorithm

### 15.1 Pipeline

For one query and snapshot:

```text
[1] Validate query subject type exists in graph
[2] Collect rules/families indexed by reachable declared type and invocation
[3] Reject contributions with no active declared scope
[4] Compute shortest type distance; reject unrelated declarations
[5] Expand surviving families; validate stable unique instance keys
[6] Evaluate structured condition, predicate, tester, or instance status
[7] Remove inapplicable candidates; retain available/unavailable/hidden
[8] Partition candidates by conceptual action ID
[9] Select smallest type distance in each partition
[10] Among equal maxima, select nearest active scope
[11] Among remaining ties, select highest explicit priority
[12] If still tied, return ambiguity; select nothing
[13] Bind only a selected available candidate
[14] Omit selected hidden actions from the public menu result
[15] Stable-sort visible actions by presentation metadata
[16] Return actions, ambiguities, compact trace, and snapshot revision
```

### 15.2 Scope index

The snapshot contains an inner-to-outer scope stack. A contribution's scope index is the nearest declared scope present in that stack. No active scope means it is not a candidate.

No scope hierarchy is required initially. React or the product constructs the stack explicitly.

### 15.3 Precedence ladder

Within one action ID:

1. Smallest type distance.
2. Smallest active scope index.
3. Highest explicit numeric priority.
4. Ambiguity.

Registration order, module import order, array order, timestamp, label, group, and menu order are never tie-breakers.

### 15.4 Hidden and inapplicable placement

Status evaluation occurs before action partitioning because inapplicable candidates must leave the competition, while hidden candidates must remain to suppress unsafe generic fallback.

### 15.5 Binding

A binder runs only for the unique selected candidate and only when status is `available`. It is pure and returns verb data.

Do not bind every candidate while collecting them. Binding may be more expensive than checking availability, and unselected bindings would create misleading audit values.

### 15.6 Ambiguity result

```ts
export interface SelectionAmbiguity {
  action: ActionId;
  candidates: readonly CandidateId[];
  because:
    | "equal-specificity"
    | "incomparable-types"
    | "equal-scope"
    | "equal-priority";
}
```

The menu renders a non-executable diagnostic row in development and may omit or summarize it in production according to product policy. A destructive ambiguous action must never execute.

### 15.7 Registration-order invariant

A resolver test must permute or reverse the contribution registry and require identical:

- selected candidate IDs;
- statuses;
- ambiguity sets;
- public ordering after metadata sorting;
- trace semantic codes, ignoring storage-order fields if any.

---

## 16. Resolved action and trace contracts

### 16.1 Resolved action

```ts
export interface ResolvedAction<Values, Verb> {
  action: ActionId;
  candidateId: CandidateId;
  contributionId: RuleId | FamilyId;
  query: ActionQuery<Values>;

  label: ReactNode;
  description?: string;
  group?: string;
  order: number;
  danger: boolean;

  status:
    | { kind: "available" }
    | { kind: "unavailable"; because: string; code?: string };

  verb?: Verb;
  snapshotRevision: string | number;
  registryVersion: string | number;

  provenance: {
    declaredType: RuntimeTypeId;
    concreteType: RuntimeTypeId;
    typeDistance: number;
    scope: ScopeId;
    scopeIndex: number;
    priority: number;
  };
}
```

Hidden actions are not in `actions`. Their selection remains visible in the trace to authorized tooling. Inapplicable candidates appear only in trace.

### 16.2 Compact trace

```ts
export interface ResolutionTraceEntry {
  candidateId: CandidateId;
  contributionId: string;
  action?: ActionId;
  stage: "scope" | "type" | "expand" | "condition" | "override" | "selected";
  result:
    | "pass"
    | "reject"
    | "unavailable"
    | "inapplicable"
    | "hidden"
    | "shadowed"
    | "ambiguous"
    | "selected";
  reasonCode?: string;
  distance?: number;
  scopeIndex?: number;
  related?: readonly CandidateId[];
}
```

Store codes and IDs, not large prose strings, for routine resolution. `describeTraceEntry` can materialize human text for developer tools and tests.

### 16.3 Trace trustworthiness

The trace must be emitted by the same branches that select the menu. Do not build a second debug resolver or reconstruct an explanation from the final list.

---

## 17. React integration

### 17.1 `createPbui` options

The target shape should be approximately:

```ts
export interface CreatePbuiOptions<Values, Environment, ProductFacts, Verb> {
  descriptors: PresentationDescriptorRegistry<Values, Environment>;
  actions: ActionRegistry<Values, ProductFacts, Verb>;
  defaultEnvironment: Environment;

  snapshotFor(
    query: ActionQuery<Values>,
    environment: Environment,
  ): SelectionSnapshot<ProductFacts>;

  translators?: TranslatorRegistry<Values, ProductFacts>;

  renderMenuHeader?: (
    reference: PresentationReference<Values>,
    environment: Environment,
    label: ReactNode,
  ) => ReactNode;
}
```

During migration, `registry` may remain as an alias for the descriptor registry, and a legacy action adapter may populate `actions`.

### 17.2 Provider context

The context should expose semantic operations rather than raw verb execution from menu code:

```ts
interface PbuiContextValue<Values, Environment, ProductFacts, Verb> {
  environment: Environment;
  accepting: AcceptRequest<Values> | null;
  menu: MenuState<Values> | null;

  resolve(query: ActionQuery<Values>): ResolutionResult<Values, Verb>;
  perform(action: ResolvedAction<Values, Verb>): Promise<PerformResult>;

  // Existing accept/menu/mouse-doc operations remain.
}
```

### 17.3 Menu state

Keep menu state lightweight:

```ts
interface MenuState<Values> {
  query: ActionQuery<Values>;
  x: number;
  y: number;
  returnFocus: FocusReturnTarget;
}
```

Do not store resolved actions or verbs as durable authority. `ObjectMenu` resolves the query from the current environment/snapshot on render, preserving current behavior where descriptor actions are recomputed.

### 17.4 ObjectMenu rendering

The menu maps `ResolvedAction` rather than `PresentationAction`:

```tsx
const result = pbui.resolve(menu.query);

result.actions.map((action) => (
  <button
    key={action.candidateId}
    disabled={action.status.kind === "unavailable"}
    title={
      action.status.kind === "unavailable"
        ? action.status.because
        : action.description
    }
    onClick={() => void pbui.perform(action)}
  >
    {action.label}
    {action.status.kind === "unavailable" && (
      <span data-part="menu-reason"> - {action.status.because}</span>
    )}
  </button>
));
```

Keep all existing focus, ArrowUp/ArrowDown, click-away, Escape-surface, focus-return, menu positioning, roles, and data-part hooks.

Add a distinct non-button ambiguity row or disabled diagnostic row with a dedicated `data-part="menu-ambiguity"`. It must never call `perform`.

### 17.5 Preserve `activate` in the first migration

Do not globally replace `Presentation.activate` with resolver-driven primary gestures during the descriptor migration. Existing products use its host-bubbling and composite semantics.

After menu migration is stable, add an opt-in such as:

```ts
<Presentation
  reference={ref}
  defaultAction="resolver"
>
```

Precedence would then be:

```text
active accept -> explicit local activate -> unique resolver primary action
              -> safe fallback to menu
```

Zero, unavailable, hidden, or ambiguous primary results open the menu or do nothing according to an explicit product policy; they never execute arbitrarily.

### 17.6 React reactivity contract

The resolver is pure and does not subscribe to stores. A product must rerender the Provider or the menu when its action revision changes. Existing integrations already pass environments or store-derived values through Providers; the migration should make the action revision explicit.

For sandbox-generated actions, opening the menu triggers a render and `snapshotFor` reads the latest library snapshot. If a product requires an already-open menu to update live, it must subscribe to the library and propagate its revision.

---

## 18. Fresh revalidation and execution

### 18.1 Core perform algorithm

```ts
async function perform(stale: ResolvedAction<Values, Verb>): Promise<PerformResult> {
  const freshSnapshot = snapshotFor(stale.query, environment);
  const fresh = actions.resolve(stale.query, freshSnapshot);
  const current = fresh.actions.find((candidate) => candidate.action === stale.action);

  if (!current) {
    return refused("action-no-longer-resolves");
  }
  if (current.candidateId !== stale.candidateId) {
    return refused("action-implementation-changed");
  }
  if (current.status.kind !== "available" || current.verb === undefined) {
    return refused(
      "action-no-longer-available",
      current.status.kind === "unavailable" ? current.status.because : undefined,
    );
  }

  try {
    await onPerform(current.verb);
    return { kind: "delegated" };
  } catch (error) {
    return { kind: "failed", error };
  }
}
```

The fresh verb is used. The stale verb is never delegated.

### 18.2 Require the same implementation to remain selected

Matching only the action ID would permit a newly loaded plugin or more-specific rule to change semantics after the user chose a row. Require both conceptual action and candidate identity to match. If the winner changed, refuse and require the user to reopen the menu.

Dynamic family candidate IDs must therefore be stable.

### 18.3 Core outcome scope

```ts
export type PerformResult =
  | { kind: "delegated" }
  | { kind: "refused"; code: string; because?: string }
  | { kind: "failed"; error: unknown };
```

`delegated` means PBUI successfully crossed its boundary. It does not claim the domain mutation was accepted. Existing routers may return or record richer product outcomes.

### 18.4 Revalidation is not authorization

Capabilities in the snapshot exist for accurate UI feedback and ordinary policy. Security and authorization remain in the product's execution boundary because:

- state can change after revalidation;
- agent calls may bypass menus;
- the chat gateway already owns approvals and idempotency;
- workbench mutation handlers already own domain preflight;
- `danger` is a visual signal, not a security declaration.

### 18.5 Provenance handoff

Where the downstream router supports provenance, include:

```json
{
  "pbuiAction": {
    "actionId": "file.delete",
    "candidateId": "files.delete",
    "menuRevision": 41,
    "performRevision": 43,
    "registryVersion": 7
  }
}
```

Chat's `PerformOptions.provenance` already provides a seam (`packages/pbui-chat/src/router/createVerbRouter.ts:75-95`). Do not require every product to adopt this in the first core PR.

---

## 19. Typed accept and direct translators

Implement this only after menu resolution and revalidation are stable.

### 19.1 Translator declaration

```ts
export interface PresentationTranslator<Values, ProductFacts> {
  id: TranslatorId;
  from: RuntimeTypeId;
  to: RuntimeTypeId;
  match: "exact" | "subtypes";
  scopes: readonly ScopeId[];
  when?: Condition;
  priority?: number;
  translate(
    reference: PresentationReference<Values>,
    snapshot: SelectionSnapshot<ProductFacts>,
  ): PresentationReference<Values> | undefined;
}
```

### 19.2 Resolution sequence

1. If the concrete reference type is a subtype of an accepted target, satisfy directly with the original reference.
2. Otherwise evaluate direct translator edges whose source, target, scope, and condition match.
3. Apply the request filter to direct or translated results.
4. Zero results: reject the click but keep accept mode pending.
5. One result: settle.
6. More than one result: open an explicit chooser.

Do not chain translators in phase 1.

### 19.3 Preserve the concrete reference

If `image-file <: document`, accepting `document` returns the original `image-file` reference. Subtyping is substitutability, not conversion. Downstream code may still dispatch on the concrete type.

### 19.4 One resolver for highlighting and clicking

Current `isAcceptable` and `satisfyAccept` both call the same `acceptedReference`, which is good. Preserve that property. Do not implement a simplified highlight check that ignores translator conditions or ambiguity.

For ambiguity, an object can be marked as "acceptable with choice" using a distinct state and mouse documentation.

### 19.5 Chooser accessibility

The translator chooser is a transient surface. It must:

- use `useEscapeSurface`;
- capture and restore focus;
- focus its first option;
- be keyboard operable;
- keep the original accept pending until a choice or explicit abort;
- never choose the first registered edge.

---

## 20. Consumer migration designs

### 20.1 Shared workbench tile actions

Current source: `packages/pbui-workbench/src/tileDescriptor.ts:28-126`.

Keep `TileRef`, label, description, and tone in the descriptor. Move each action to an exact rule.

Example:

```ts
const tileClose = actions.exact("tile", {
  id: "workbench.tile.close",
  action: "tile.close",
  scopes: ["workbench"],
  metadata: {
    label: "Close tile",
    group: "layout",
    order: 90,
    danger: true,
  },
  test: ({ subject }) =>
    subject.value.canClose
      ? available()
      : unavailable("a workspace keeps at least one tile"),
  bind: ({ subject }) => workbenchVerbs.close(subject.value.placementId),
});
```

Replace `TileDescriptorOptions.extra` with independent product contributions for subject `tile`. This removes the shared package's need to know which products append actions.

The current "Shown in N tiles" row is descriptive rather than executable and is modeled as a disabled action. Preserve it during behavior migration. A later UI enhancement may introduce an explicit informational menu-row type; do not mix that cleanup into the kernel PR.

### 20.2 Datalab field actions

Current source: `packages/datalab-ui/src/pbui/descriptors/field.ts:114-164`.

The channel set is static. Generate one static exact rule per channel at registry construction:

```ts
const mappingRules = CHANNELS.map((channel) =>
  actions.exact("field", {
    id: `datalab.field.map.${channel}`,
    action: `chart.mapping.${channel}`,
    scopes: ["datalab"],
    metadata: {
      label: ({ snapshot }) =>
        `Map to ${channel}  (chart ${snapshot.product.targetName})`,
      group: "mapping",
      order: channelOrder(channel),
    },
    test: ({ snapshot }) => mappingAvailability(channel, snapshot.product.fieldType),
    bind: ({ subject, snapshot }) => ({
      kind: "setMapping",
      docId: snapshot.product.targetDocId,
      channel,
      field: subject.value.name,
    }),
  }),
);
```

`Group by + count` becomes an exact rule that returns `inapplicable("not-relevant")` for quantitative fields. `Filter`, `Sort`, `Inspect`, and `Watch` become stable exact rules initially.

Do not introduce abstract `inspectable` inheritance until the exact migration is complete and tests prove identical menus.

### 20.3 Datalab datum filter family

Current source: `packages/datalab-ui/src/pbui/descriptors/datum.ts:29-64`.

```ts
const datumFilters = actions.family("datum", {
  id: "datalab.datum.filters",
  match: "exact",
  scopes: ["datalab"],
  expand: ({ subject, snapshot }) =>
    snapshot.product.categoricalFields.slice(0, 4).flatMap((field, index) => {
      const value = asText(subject.value.row[field]);
      const encoded = stableActionSegment(field);
      return [
        {
          key: `keep:${encoded}`,
          action: `datum.keep.${encoded}`,
          metadata: {
            label: `Keep only ${field} = ${value}  (chart ${snapshot.product.targetName})`,
            group: "filter",
            order: index * 2,
          },
          bind: () => ({
            kind: "addFilter",
            docId: snapshot.product.targetDocId,
            field,
            op: "=",
            value,
          }),
        },
        {
          key: `exclude:${encoded}`,
          action: `datum.exclude.${encoded}`,
          metadata: {
            label: `Exclude ${field} = ${value}`,
            group: "filter",
            order: index * 2 + 1,
          },
          bind: () => ({
            kind: "addFilter",
            docId: snapshot.product.targetDocId,
            field,
            op: "!=",
            value,
          }),
        },
      ];
    }),
});
```

The stable segment encoder must be deterministic and collision-safe. Do not use label or array index as identity.

### 20.4 Conditional Datalab actions

`docDescriptor` conditionally includes "Make the ACTIVE chart" (`packages/datalab-ui/src/pbui/descriptors/doc.ts:29-47`). Express it as `inapplicable` while already active, not hidden and not unavailable.

`stageDescriptor` similarly makes "Switch to it" inapplicable for the current stage (`stage.ts:31-39`).

Unavailable rows such as incompatible field-to-channel mappings remain visible with reasons.

### 20.5 Sandbox generated actions

Current source: `packages/pbui-sandbox/src/actions.ts:31-70`.

Replace the registry wrapper with one action family. The product snapshot includes an immutable list of `ActionRecord`s and a set of existing program IDs. The family:

- filters records by the concrete reference type;
- uses `generated:<record.id>` as action ID and candidate key;
- marks a missing `openProgram` target unavailable with the current reason;
- binds through the existing `toVerb` adapter;
- preserves group, danger, description, and by/provenance metadata.

Because the library mints stable `act-N` IDs (`packages/pbui-sandbox/src/library.ts:48-60, 223-225`), it already provides the identity required by fresh revalidation.

### 20.6 Chat product actions

Current source: `packages/pbui-chat/demo/src/pbui/registry.ts`.

Move the 19 representation descriptors to an exact descriptor registry with no actions. Migrate their actions to exact rules/families. Replace generated label/index IDs with deliberate package IDs.

Keep the chat verb router and gateway unchanged. PBUI performs fresh action revalidation and delegates the fresh verb. Chat continues to validate the vocabulary, select the family handler, report rejection/performed outcomes, and attach approval/effect metadata.

### 20.7 Current conversions

Migrate the two observed conversions as direct translators:

```text
datalab.cat-to-field
chat.row-to-product
```

Preserve current behavior before adding inheritance. Add trace and ambiguity handling only after translator tests are in place.

---

## 21. Public API sketch

The following is a target direction, not a requirement to copy every generic parameter exactly. The team should keep ergonomics under strict TypeScript and emitted declaration quality in view.

```ts
const graph = createPresentationTypeGraph([
  { id: "object", abstract: true },
  { id: "document", abstract: true, parents: ["object"] },
  { id: "selectable", abstract: true, parents: ["object"] },
  { id: "file", parents: ["document", "selectable"] },
  { id: "image-file", parents: ["file"] },
] as const);

const define = defineActions<Values, ProductFacts, Verb>();

const actionRegistry = createActionRegistry({
  graph,
  scopes: ["global", "workbench", "editor"],
  predicates: [fileCanDelete],
  contributions: [
    define.inherited("object", {
      id: "core.inspect",
      action: "object.inspect",
      scopes: ["global"],
      metadata: { label: "Inspect", group: "meta", order: 10 },
      bind: ({ subject }) => ({ kind: "inspect", ref: subject }),
    }),

    define.exact("file", {
      id: "files.delete",
      action: "file.delete",
      scopes: ["editor"],
      when: all(
        modeOff("review", unavailable("review mode is read-only")),
        capability("write", unavailable("write access is required")),
        predicate("file.can-delete"),
      ),
      metadata: { label: "Delete", group: "file", order: 30, danger: true },
      bind: ({ subject }) => ({ kind: "file.delete", id: subject.value.id }),
    }),

    generatedActionsFamily,
  ],
});

const descriptors = createPresentationRegistry<Values, Environment>({
  file: {
    label: (file) => file.name,
    describe: describeFile,
    tone: "accent",
  },
  "image-file": {
    label: (file) => file.name,
    describe: describeImage,
    tone: "accent",
  },
});

const pbui = createPbui({
  descriptors,
  actions: actionRegistry,
  defaultEnvironment,
  snapshotFor,
  translators,
  renderMenuHeader,
});
```

Consumer operations:

```ts
pbui.actions.resolve({ subject: fileRef, invocation: "menu" }, snapshot);
pbui.actions.explain({ subject: fileRef, invocation: "menu" }, snapshot);
pbui.actions.listReachable("image-file", ["editor", "workbench", "global"]);
pbui.accept({ types: ["folder"], prompt: "Choose a destination" });
await pbui.perform(resolvedAction);
```

---

## 22. File-by-file implementation plan

### 22.1 New pure-kernel files

Create:

```text
src/presentation/actions/ids.ts
src/presentation/actions/types.ts
src/presentation/actions/typeGraph.ts
src/presentation/actions/typeGraph.test.ts
src/presentation/actions/availability.ts
src/presentation/actions/conditions.ts
src/presentation/actions/conditions.test.ts
src/presentation/actions/registry.ts
src/presentation/actions/registry.test.ts
src/presentation/actions/resolve.ts
src/presentation/actions/resolve.test.ts
src/presentation/actions/explain.ts
src/presentation/actions/legacy.ts
src/presentation/actions/perform.ts
src/presentation/actions/perform.test.ts
src/presentation/actions/index.ts
```

Later:

```text
src/presentation/translators/types.ts
src/presentation/translators/registry.ts
src/presentation/translators/resolve.ts
src/presentation/translators/resolve.test.ts
src/presentation/translators/index.ts
```

### 22.2 `src/presentation/types.ts`

- Keep `PresentationValues`, `PresentationType`, `PresentationReference`, and `PresentationTone` unchanged initially.
- Deprecate `PresentationAction` only after a legacy adapter exists.
- Deprecate `PresentationDescriptor.actions` and remove its `Verb` generic in the final cleanup release.
- Deprecate `PresentationConversion` after typed translator integration.
- Keep tombstones for removed fields because this repository intentionally uses `never` to catch structurally inferred excess properties.

### 22.3 `src/presentation/registry.ts`

- Reframe it as the exact representation registry.
- Keep fallback label, description, tone, and `has` behavior.
- Remove `actionsFor` after migration.
- Consider renaming the public interface to `PresentationDescriptorRegistry`, with `PresentationRegistry` as a deprecated alias for one release.

### 22.4 `src/presentation/createPbui.tsx`

Make the smallest safe change first:

- add action registry and `snapshotFor` to options;
- store `ActionQuery` in menu state;
- resolve menu actions through the kernel;
- change context `perform` to accept `ResolvedAction` and revalidate;
- leave `Presentation`, focus, Escape, accept banner, and mouse-doc code structurally intact;
- add ambiguity row rendering;
- add async error/busy handling only if separately specified; do not silently expand scope.

After behavior is stable, split this 679-line module by responsibility if desired. Do not combine the architectural kernel migration with a large React file move in the same review unless tooling makes the diff mechanically verifiable.

### 22.5 `src/presentation/index.ts` and root exports

Export the new graph, registry, factories, availability helpers, resolution types, and translator APIs. Preserve existing subpath behavior and CSS assembly.

### 22.6 CSS

Keep current selectors. Add only narrowly scoped hooks:

```css
[data-part="menu-ambiguity"] { /* diagnostic, non-executable */ }
[data-part="menu-item"][data-state="busy"] { /* only if busy state is implemented */ }
```

Unavailable reasons continue to use `menu-reason`.

### 22.7 Consumer files

Migrate in this order:

1. `packages/pbui-workbench/src/tileDescriptor.ts`
2. `packages/datalab-ui/src/pbui/registry.ts` and descriptor action callbacks
3. `packages/pbui-sandbox/src/actions.ts`
4. `packages/pbui-chat/demo/src/pbui/registry.ts` and descriptor action callbacks
5. current conversion arrays in the two runtimes

The workbench, Datalab, and chat verb handlers should not move.

---

## 23. Migration adapter

### 23.1 Purpose

A legacy adapter lets ObjectMenu use the new resolver before every product action is rewritten. It should exist for one migration window, not as a permanent second action model.

### 23.2 Behavior

```ts
legacyDescriptorFamily({
  id: "legacy.descriptor-actions",
  descriptors: oldRegistry,
  actionId: (reference, action) => `legacy.${reference.type}.${action.id}`,
});
```

The adapter:

- matches exact concrete type only;
- calls the current descriptor action callback once for the query;
- maps `disabledBecause` to `unavailable`;
- uses stable existing `action.id` values;
- emits one family instance per row;
- preserves current array order through metadata order only;
- does not provide inheritance or cross-package override.

Datalab/chat adapters currently generate label/index IDs. Before using the legacy adapter for them, change those adapters to provide deliberate stable IDs or supply an explicit migration ID map. Do not fossilize label/index IDs into traces.

### 23.3 Exit criterion

Delete the adapter after all in-repository consumers have no descriptor `actions()` callbacks. Do not keep both a descriptor action path and a rule registry as equal first-class mechanisms.

---

## 24. Testing strategy

### 24.1 Preserve existing PBUI behavior tests

Retain and adapt every current contract in `src/presentation/createPbui.test.tsx` and `instanceChrome.test.tsx`, including:

- Provider environment isolation;
- menu opens and delegates a serializable verb;
- focus restoration after action, Escape, and click-away;
- fallback focus when the action removes the invoker;
- typed accept resolution and cancellation;
- standalone button/tab-stop semantics;
- `inComposite` role/tab-stop ownership;
- host click bubbling for `activate` with and without `run`;
- menu-opening click propagation suppression;
- keyboard/pointer parity;
- nested presentation ownership;
- nested control key ownership;
- mouse-doc wording;
- enabled descriptions and disabled reasons;
- ObjectMenu fixed-position and Escape-surface behavior.

These tests are the migration fence. Kernel work is not complete if they are replaced with resolver unit tests rather than preserved.

### 24.2 Type graph tests

Test:

- reflexive, direct, and transitive subtype checks;
- multiple inheritance;
- shortest distance through diamonds;
- unknown parent rejection;
- cycle rejection;
- deterministic ancestor ordering;
- abstract and concrete node coexistence.

### 24.3 Resolver table tests

Cover at least:

| Concrete type | Candidate declarations | Expected result |
|---|---|---|
| image-file | document/open, file/open, image/open | image rule selected; others shadowed |
| protected file | generic delete available, specific delete unavailable | specific unavailable row selected |
| live file | restore inapplicable | restore absent; no blocked fallback |
| secret file | generic open available, specific open hidden | no visible open; generic suppressed |
| equal exact plugin rules | same scope and priority | ambiguity; no action |
| equal type, inner vs outer scope | editor vs global | editor wins |
| equal type/scope, priority differs | 0 vs 10 | priority 10 wins |
| reversed registry | same inputs | identical semantic result |

### 24.4 Family tests

Test:

- deterministic candidate IDs for the same snapshot;
- duplicate keys rejected;
- family outputs participate in static-rule override and ambiguity;
- sandbox action appears on the next resolution without rebuilding the registry;
- missing generated program is unavailable with the existing reason;
- Datalab datum family caps at four categorical fields and emits two actions per field;
- label changes do not change candidate identity.

### 24.5 Availability tests

Test the critical distinctions:

- unavailable is visible and suppresses less-specific fallback;
- inapplicable is absent and permits fallback;
- hidden is absent and suppresses fallback;
- unknown predicate or operator never enables an action;
- `all` returns one first failure reason;
- an unavailable action never has a bound verb.

### 24.6 Revalidation tests

Test:

- unchanged state delegates a freshly bound verb;
- stale menu revision with same winner may delegate and reports drift metadata;
- mode/capability/product change makes the action unavailable and refuses with the current reason;
- winner changed to a different candidate and is refused;
- action became ambiguous and is refused;
- action became hidden or inapplicable and is refused;
- `onPerform` is never called on refusal;
- `onPerform` rejection becomes `failed` without pretending the domain accepted the verb.

### 24.7 Translator tests

When implemented:

- subtype directly satisfies a supertype request and preserves the concrete reference;
- a supertype never satisfies a subtype request;
- one direct translator succeeds;
- scope/condition/source/target mismatch is traced;
- two direct translators produce chooser ambiguity;
- registry order does not choose a translator;
- highlight and click use the same resolution;
- rejected click leaves accept pending;
- chooser focus and Escape behavior use shared surface infrastructure.

### 24.8 Consumer contract tests

Preserve existing workbench tile descriptor assertions during migration. Add golden menu snapshots for each migrated product type before deleting callbacks.

Specific regression tests:

- Datalab does not call expensive `tableFor` during ordinary `Presentation` render.
- Datalab field mapping disabled reasons remain exact.
- Workbench product tile contributions no longer require `extra` and sort identically.
- Chat generated actions are live and type-filtered.
- Chat router and effect gateway receive the same verbs as before.
- Current `cat -> field` and `row -> product` acceptance behavior remains unchanged before ambiguity features are enabled.

### 24.9 Property-style invariants without a new dependency

Use deterministic permutations/table loops if the team does not want `fast-check`:

- permuting contributions does not change winners;
- adding an unrelated action ID does not change existing winners;
- adding a more-specific rule changes only its subtype region;
- every visible unavailable action has non-empty reason text;
- no selected hidden or unavailable action has a verb;
- every delegated action was uniquely selected and freshly available.

---

## 25. Performance and caching

### 25.1 Expected complexity

For unary queries, index contributions by declared runtime type and invocation. Resolution cost is approximately:

```text
O(number of ancestors + reachable contributions + predicate cost + family output)
```

The type graph is small and distances are precomputed.

### 25.2 Expansion order

Do not expand every family globally. Filter by invocation, scope, and type reachability first. Then expand only relevant families.

### 25.3 No cross-render cache initially

Start without a resolver result cache. The current system already recomputes action callbacks on menu render. Indexed pure resolution should be cheap, and stale availability is more harmful than a small computation.

Add caching only after profiling. A correct key would need at least:

```text
registry version + concrete type + reference identity/version
+ invocation + active scopes + modes + capabilities
+ product dependency revision
```

### 25.4 Trace allocation

Always collect compact codes and IDs. Materialize verbose prose only for developer tools, explicit `explain`, or test failures.

### 25.5 Product fact cost

Snapshot creation must respect existing product performance boundaries. In Datalab, schema-only facts should remain schema-only. Expensive row evaluation belongs only in menu or inspector operations that actually need rows.

---

## 26. Security and safety

1. A menu result is never authorization.
2. `danger` never selects authorization policy.
3. Product execution handlers continue to validate capability, approval, identity, revision, and domain constraints.
4. Generated actions are data interpreted by trusted handlers; do not serialize or execute user-provided JavaScript as an action binder.
5. Binders and conditions are pure and run no effects.
6. Hidden non-disclosure details are not exposed in ordinary user or agent traces.
7. Ambiguous destructive actions never execute.
8. Unknown condition operations/predicates fail closed.
9. Fresh revalidation uses the same resolver, not duplicated checks.
10. The original concrete reference is preserved through subtype acceptance; no implicit payload laundering occurs.

---

## 27. Rollout as reviewable pull requests

### PR 0 - Freeze current behavior

- Add/confirm golden action lists for representative core, workbench, Datalab, and chat types.
- Add explicit generated-action liveness test.
- Add current conversion ordering tests.
- Record current labels, order, disabled reasons, and verbs.
- No public API change.

**Exit:** a behavior migration can be reviewed as equivalence rather than intuition.

### PR 1 - Pure kernel, unused by React

- Implement IDs, type graph, availability, condition registry, static rules, families, resolver, trace, diagnostics.
- Add exhaustive pure tests and registry permutation tests.
- Export only under an experimental/internal subpath if desired.

**Exit:** pure resolver contract is stable and independent of UI.

### PR 2 - Legacy adapter and ObjectMenu integration

- Add `snapshotFor` and action registry to `createPbui`.
- Route existing descriptor actions through the legacy family.
- Store query in menu state.
- Add fresh revalidation before current `onPerform`.
- Preserve all current presentation/focus/accessibility tests.

**Exit:** one live menu-selection engine; visible behavior is unchanged.

### PR 3 - Shared workbench and Datalab migration

- Move workbench tile actions to rules; remove `extra` from product use sites.
- Migrate Datalab descriptors, including datum family and stable IDs.
- Keep representation descriptors.
- Delete Datalab action adapters.

**Exit:** two materially different consumer styles prove the API.

### PR 4 - Chat and sandbox migration

- Replace chat descriptor actions with rules/families.
- Replace `withGeneratedActions` wrapper with generated action family.
- Propagate optional PBUI provenance into chat router reports.
- Keep router/gateway behavior unchanged.

**Exit:** dynamic live contributions work through the kernel.

### PR 5 - Subtype inheritance, scopes, and deliberate overrides

- Introduce real abstract runtime nodes only for demonstrated reuse.
- Convert common inspect/watch/open behaviors where safe.
- Add active scope stacks and minimal named modes to snapshots.
- Resolve and document any discovered ambiguities.

**Exit:** inheritance and override deliver value beyond exact migration.

### PR 6 - Typed direct translators

- Replace ordered conversion arrays.
- Add direct subtype satisfaction, translator registry, trace, and chooser.
- Preserve accept banner, focus, Escape, and mouse-doc behavior.

**Exit:** accept is typed, deterministic, and explained.

### PR 7 - Cleanup and API stabilization

- Remove descriptor `actions`, legacy adapter, registry wrapper, and old conversion callbacks.
- Remove deprecated aliases/tombstones according to package version policy.
- Update playbooks, Storybook, and consumer examples.
- Publish the stable action API.

---

## 28. Risks and mitigations

### Risk: the kernel becomes a second language

**Mitigation:** keep the condition vocabulary small, require real use cases for new nodes, and use named product predicates rather than growing a universal DSL.

### Risk: family callbacks recreate opaque descriptor arrays

**Mitigation:** families emit stable candidate declarations, not final menu rows; all outputs enter the common resolver and trace. Add development validation for duplicate/unstable keys.

### Risk: runtime inheritance breaks TypeScript payload safety

**Mitigation:** exact and inherited factories have different contexts. Inherited rules receive the original generic reference; payload adaptation is explicit.

### Risk: hidden policy leaks through generic fallback

**Mitigation:** hidden candidates remain in precedence. Inapplicable is a separate state for ordinary non-relevance.

### Risk: stale snapshots or mutable product facts

**Mitigation:** explicit revision contract, immutable query-local facts, development freezing where practical, and unconditional fresh re-resolution on perform.

### Risk: traces become expensive

**Mitigation:** compact codes always; verbose prose on demand.

### Risk: existing accessibility behavior regresses during React changes

**Mitigation:** preserve the current integration tests and avoid rewriting `Presentation` gesture logic in the first menu migration.

### Risk: duplicate security architecture

**Mitigation:** core revalidates selection only; existing routers, appliers, approval ledgers, and gateways remain authoritative for effects.

### Risk: registration diagnostics overpromise static certainty

**Mitigation:** distinguish guaranteed conflicts from potential conflicts. Query-time ambiguity remains authoritative.

### Risk: product snapshots become giant copied state trees

**Mitigation:** snapshot builders derive query-local facts and revisions; no default deep clone.

---

## 29. Definition of done

PBUI-ACTIONS-1 is complete when all of the following hold:

### Core semantics

- The runtime type graph fails registration on unknown parents or cycles.
- Exact and inherited rule payload contracts are distinct and documented.
- Static rules and dynamic families use stable identities.
- Registration order cannot change semantic resolution.
- Unavailable, inapplicable, and hidden semantics are covered by tests.
- Equal declared facts produce ambiguity, not first/last-wins behavior.
- Selected available actions bind serializable verbs; other statuses do not.
- Every resolution returns compact provenance and trace data.
- Perform always re-resolves and delegates only the fresh verb from the same selected candidate.

### UI behavior

- Current object-menu focus, Escape, click-away, arrow navigation, role, and focus-return behavior remains intact.
- Current disabled reason presentation remains intact.
- Ambiguities are non-executable and visibly diagnosable in development.
- Existing `Presentation.activate`, nested presentation, composite, and keyboard behavior remains intact.
- Accept mode still advertises its global gesture change.

### Consumer migration

- `PresentationDescriptor.actions` has no in-repository production users.
- Workbench tile product actions no longer use `extra`.
- Datalab uses stable action/rule IDs and a bounded datum family.
- Sandbox generated actions no longer wrap `PresentationRegistry`.
- Chat generated actions remain live and product routers receive unchanged domain verbs.
- Ordered conversion arrays are removed after typed translators land.

### Verification

- Core, workbench, Datalab, sandbox, and chat test suites pass.
- Registry permutation tests pass.
- Typecheck and package build pass under the repository's supported React/TypeScript range.
- Storybook demonstrates inheritance, unavailable vs hidden/inapplicable, ambiguity, live generated actions, stale revalidation, and translator choice.
- Consumer smoke packaging continues to resolve one React instance and all public declarations.

---

## 30. Invariants to keep as the long-term contract

1. A presentation reference is semantic data, not a rendering artifact.
2. Representation descriptors and action contributions have separate ownership.
3. Runtime type relationships are nominal declarations.
4. Type inheritance never implies payload coercion.
5. Rule identity names a declaration; action identity names a conceptual operation.
6. Registration order is never semantic.
7. Menu order is never precedence.
8. Unavailable actions carry exactly one reason.
9. Inapplicable permits fallback; hidden suppresses fallback.
10. Ambiguity is data and never an arbitrary execution choice.
11. Resolution is pure for a registry, query, and snapshot.
12. The trace is emitted by the resolver path that produced the result.
13. Binders construct serializable intent and do not cause effects.
14. A rendered menu is not durable authority.
15. Every perform uses a fresh snapshot and the fresh winning binder.
16. PBUI revalidation does not replace product authorization.
17. Focus, keyboard, nested-presentation, and composite semantics remain centralized in `Presentation` and shared surface infrastructure.
18. New generalized machinery must be justified by at least one real repository interaction, not by theoretical completeness.

---

## Appendix A. Source evidence index

| Claim | Source evidence |
|---|---|
| Reference type preserves key-to-payload correlation | `src/presentation/types.ts:4-15` |
| `disabledBecause` is the one-field invariant | `src/presentation/types.ts:25-112` |
| Descriptor combines representation and actions | `src/presentation/types.ts:114-127` |
| Accept and conversion contracts are exact/untyped | `src/presentation/types.ts:129-144` |
| Registry action discovery is one exact lookup | `src/presentation/registry.ts:12-28, 30-79` |
| Provider delegates raw verbs without revalidation | `src/presentation/createPbui.tsx:254-270` |
| Current acceptance checks exact target then conversions in array order | `src/presentation/createPbui.tsx:187-202` |
| Presentation click/keyboard/composite contracts | `src/presentation/createPbui.tsx:57-158, 294-465` |
| ObjectMenu focus/Escape/render/perform path | `src/presentation/createPbui.tsx:469-580` |
| Focus return infrastructure | `src/focus.ts:1-50` |
| Page-global Escape ownership | `src/surfaces.ts:1-131` |
| Disabled rows are shown, not hidden | `public/presentation-parts.css:127-137` |
| Shortcut policy is deliberately pure and not a registry | `src/chrome/shortcutRouting.ts:1-70` |
| Workbench descriptor has product `extra` seam | `packages/pbui-workbench/src/tileDescriptor.ts:28-33, 50-126` |
| Datalab environment separates cheap schema from expensive table | `packages/datalab-ui/src/pbui/types.ts:191-230` |
| Datalab adapter uses label/index-derived IDs | `packages/datalab-ui/src/pbui/registry.ts:59-89` |
| Datalab datum emits query-dependent action families | `packages/datalab-ui/src/pbui/descriptors/datum.ts:29-64` |
| Datalab field emits explained disabled mappings | `packages/datalab-ui/src/pbui/descriptors/field.ts:114-164` |
| Datalab conditional document action | `packages/datalab-ui/src/pbui/descriptors/doc.ts:29-47` |
| Sandbox wrapper appends live generated actions | `packages/pbui-sandbox/src/actions.ts:5-70` |
| Generated action records have stable library IDs and type sets | `packages/pbui-sandbox/src/library.ts:43-60, 223-225` |
| Chat registry depends on generated-action wrapper | `packages/pbui-chat/demo/src/pbui/registry.ts:80-89` |
| Datalab and chat current conversions | `packages/datalab-ui/src/pbui/runtime.tsx:19-32`; `packages/pbui-chat/demo/src/pbui/runtime.tsx:6-31` |
| Chat router owns validation, dispatch, outcome, and reporting | `packages/pbui-chat/src/router/createVerbRouter.ts:109-119, 136-250` |
| Effect gateway owns approval, idempotency, revisions, and trace outbox | `packages/pbui-chat/src/tools/agentEffectGateway.ts:136-176, 203-312` |

---

## Appendix B. Recommended action-ID conventions

Use lowercase dot-separated conceptual names:

```text
object.inspect
presentation.open
file.rename
file.delete
tile.close
workspace.delete
chart.mapping.x
chart.mapping.y
datum.keep.region
datum.exclude.region
approval.publish
```

Use package-qualified rule/family IDs:

```text
core.object.inspect
workbench.tile.close
datalab.field.map.x
datalab.datum.filters
chat.product.reorder
sandbox.generated-actions
```

Rules:

- IDs are code/API identities, not localized labels.
- Do not include array positions.
- Encode dynamic semantic keys deterministically.
- A label change does not change identity.
- A different implementation of the same conceptual operation keeps the action ID and changes rule ID.
- Two operations that may legitimately coexist need different action IDs even if their labels are similar.

---

## Appendix C. Review checklist for each migrated action

For every current menu row, reviewers should be able to answer:

1. What is the stable rule or family candidate ID?
2. What is the conceptual action ID?
3. Is the subject match exact or inherited?
4. Which active scopes make it a candidate?
5. Which snapshot facts affect its availability?
6. Is failure unavailable, inapplicable, or hidden?
7. Does one more-specific unavailable/hidden rule need to suppress a fallback?
8. Is the binder pure and serializable?
9. Does fresh revalidation require the same candidate to remain selected?
10. Is menu order metadata separate from precedence?
11. Is any security decision incorrectly inferred from `danger`?
12. Does the migration preserve the exact current verb and user-visible reason?

---

## Appendix D. Final implementation principle

```text
Type determines which declarations are reachable.
Context determines which declarations apply now.
Action identity determines which declarations compete.
Specificity and explicit scope determine which declaration wins.
Ambiguity remains visible when the declarations do not decide.
The resolver explains the result.
Execution revalidates and then delegates serializable intent to the existing product boundary.
```
