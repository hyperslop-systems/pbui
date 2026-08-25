---
Title: 'Type-directed action selection: theoretical foundations, architecture, and implementation guide'
Ticket: PBUI-ACTIONS-1
Status: active
Topics:
    - pbui
    - frontend
    - design
    - architecture
    - research
DocType: design-doc
Intent: long-term
Owners: []
RelatedFiles:
    - Path: repo://packages/pbui-workbench/src/tileDescriptor.ts
      Note: Representative dynamic action availability and contribution seam
    - Path: repo://packages/pbui-workbench/src/verbs.ts
      Note: Serializable verbs and truthful effect routing
    - Path: repo://src/chrome/shortcutRouting.ts
      Note: Pure explicit modal context policy
    - Path: repo://src/presentation/createPbui.tsx
      Note: Current gesture, mode, conversion, object-menu, and execution mechanics
    - Path: repo://src/presentation/registry.ts
      Note: Current exact-type action discovery algorithm
    - Path: repo://src/presentation/types.ts
      Note: Current reference, action, descriptor, accept, and conversion contracts
    - Path: repo://ttmp/2026/08/25/PBUI-ACTIONS-1--a-principled-type-and-action-selection-engine-for-pbui-presentations/scripts/01-selection-kernel.mjs
      Note: Executable sketch of proposed subtype, context, ambiguity, and advice semantics
ExternalSources:
    - https://dspace.mit.edu/handle/1721.1/41161
    - https://www.lispworks.com/documentation/lw60/CLIM/html/climuser-127.htm
    - https://docs.huihoo.com/lisp/common-lisp/lispworks/7.0/CLIM/html/climuser-133.htm
    - http://metamodular.com/CLIM-spec/23-3.html
    - https://homes.cs.washington.edu/~mernst/pubs/dispatching-ecoop98.pdf
    - https://mcclim.common-lisp.dev/static/documents/guided-tour.pdf
    - https://prg.is.titech.ac.jp/papers/pdf/infosof2023.pdf
Summary: Evidence-backed proposal for evolving PBUI's exact-type descriptor callbacks into an explainable subtype-, context-, history-, scope-, conversion-, and advice-aware action-selection kernel.
LastUpdated: 2026-08-25T13:10:00-04:00
WhatFor: Guide implementation and review of richer PBUI presentation interactions without ad-hoc dispatch or hidden mode state.
WhenToUse: Read before changing presentation types, object-menu action discovery, accept/conversion behavior, gesture routing, or verb execution policy.
---


# Type-directed action selection: theoretical foundations, architecture, and implementation guide

## Executive summary

PBUI already contains the seed of a presentation-based interface in the CLIM/Genera sense. A rendered value carries a semantic `PresentationReference`; its descriptor supplies a label, description, tone, and actions; an object menu exposes serializable verbs; typed `accept` changes what clicking a presentation means; and the provider turns verb data into product effects. This is a coherent small system, not merely a context menu.

Its current selection algorithm, however, is one exact map lookup:

```text
(reference.type, environment)
        |
        v
 descriptors[reference.type]?.actions(reference.value, environment)
        |
        v
 PresentationAction[]
```

That simplicity now blocks the requested growth. There is no subtype relation, inherited action contribution, explicit command-table scope, analyzable applicability model, ambiguity diagnosis, multi-object dispatch, or common execution-advice layer. Modes and prior interactions can only be read through an unstructured product `Environment`, so dependencies are invisible and caches, diagnostics, replay, and agent introspection cannot be reliable.

The recommended design is an **action-selection kernel** with six explicit concepts:

1. **Presentation type graph** — nominal runtime types with a validated acyclic parent relation, separate from TypeScript's compile-time value map.
2. **Action rule** — a declaration that an action identity applies to source presentation type(s), in scopes, under a structured condition, and binds a serializable verb.
3. **Selection context** — an immutable snapshot of active scopes, modes, selection, capabilities, user/session facts, and a history projection.
4. **Resolver** — candidate collection, applicability evaluation, specificity/override resolution, stable ordering, and a first-class explanation trace.
5. **Translator/conversion graph** — CLIM-like source-to-target rules used for typed acceptance and argument acquisition, with cycle/ambiguity checks.
6. **Execution pipeline** — revalidation followed by named `before`, `around`, and `after` advice around the product's verb handler. Advice never changes which menu actions exist.

The design intentionally does **not** implement arbitrary predicate dispatch over JavaScript lambdas. Predicate dispatch shows why logical implication is an elegant specificity relation, but implication between arbitrary host-language functions is undecidable. PBUI should use nominal type specificity and declared scope precedence as the analyzable core, a small structured condition algebra for diagnostics/dependency tracking, and an optional pure tester as a final applicability check. A tester may reject a candidate; it must not silently establish precedence.

The key semantic contract is:

```text
resolve(query, snapshot) -> {
  actions: ResolvedAction[],
  ambiguities: SelectionAmbiguity[],
  trace: ResolutionTrace
}

perform(resolvedAction, freshSnapshot) -> ActionOutcome
```

Discovery is a query, not authorization. Every invocation re-resolves/revalidates against fresh state. Unavailable actions remain visible with one reason, preserving PBUI's existing `disabledBecause` invariant. Hidden actions are reserved for non-disclosure, irrelevant scopes, and explicit product policy—not used as a synonym for disabled.

## 1. Reader orientation: the problem has five different “selection” stages

A new implementer should not begin by adding `parents?: string[]` to `PresentationDescriptor`. “Action selection” is overloaded. The current code performs five logically different jobs:

1. **Object classification** — what semantic kind is under the pointer? Today this is `reference.type`.
2. **Action discovery** — what operations are associated with that kind? Today this is `descriptor.actions`.
3. **Applicability** — which discovered operations are usable in the current state? Today each descriptor computes `disabledBecause`.
4. **Invocation routing** — what does this gesture mean now? Today acceptable clicks, default activation, and object-menu opening are branches in `Presentation`.
5. **Execution** — what effect does the chosen verb produce? Today `Provider.onPerform` and workbench verb handlers own this boundary.

Typed acceptance adds a sixth concern: **argument acquisition/conversion**. A command may be waiting for an object of a target type; a clicked presentation either directly satisfies the request or is converted first.

A robust design preserves these distinctions. Combining them into a callback such as `selectAction(ref, event, globalState)` would be flexible but impossible to explain, validate, cache, test compositionally, or expose safely to an agent.

## 2. Current PBUI architecture

### 2.1 Static presentation references

`src/presentation/types.ts:3-14` defines a product-specific `PresentationValues` map and derives a discriminated union:

```ts
interface Values {
  person: Person;
  file: FileRef;
}

// Equivalent shape:
type PresentationReference =
  | { type: "person"; value: Person }
  | { type: "file"; value: FileRef };
```

This provides excellent compile-time correlation between the type key and value payload. It does not provide a runtime type model. TypeScript interfaces are erased, `keyof Values` has no runtime parent graph, and structural assignability cannot answer whether a `png-file` presentation should inherit `file` actions.

### 2.2 One descriptor owns representation and actions

`PresentationDescriptor` combines `label`, optional `describe`, `actions`, and `tone` (`src/presentation/types.ts:113-126`). `createPresentationRegistry` stores descriptors in a partial object map. `actionsFor` does exactly one lookup and callback (`src/presentation/registry.ts:69-72`). Consequences:

- action rules are colocated and easy to read for a small system;
- exact type lookup is deterministic and cheap;
- no base-type action is inherited;
- cross-cutting actions must be appended manually (for example, `TileDescriptorOptions.extra`);
- two packages cannot independently contribute to one type without an out-of-band merge owner;
- there is no resolver trace explaining where an action came from.

Representation methods and action rules have different composition needs. A value normally has one label policy per type, while many independent modules may contribute actions. Keeping both in one descriptor forced `extra()` seams such as `packages/pbui-workbench/src/tileDescriptor.ts:28-32`.

### 2.3 Availability is dynamic and explainable

`PresentationAction` carries `disabledBecause?: string` (`src/presentation/types.ts:24-76`). Presence means unavailable and contains the explanation. This deliberately makes two illegal states unrepresentable: disabled without a reason, and enabled with a disabled reason.

The object menu recomputes actions on render and reads the same field for `disabled`, title text, and visible reason (`src/presentation/createPbui.tsx:501-568`). `createTileDescriptor` derives availability from current `TileRef` facts such as `duplicable`, `placementCount`, and `canClose` (`packages/pbui-workbench/src/tileDescriptor.ts:84-123`). This is a strong baseline:

- do not store a resolved menu item as durable authorization;
- do not split availability back into boolean and prose;
- do not hide normal inapplicability—the explanation teaches the rule.

Current limitation: the environment is generic and opaque. The registry cannot say which facts a rule reads, why a rule was not discovered, whether a mode activated it, or which state changes invalidate a previous resolution.

### 2.4 Typed acceptance is one explicit interaction mode

`AcceptRequest` names one or more exact type keys, a prompt, and an optional filter (`src/presentation/types.ts:128-132`). `acceptedReference` first checks exact membership, then tries conversions in array order (`src/presentation/createPbui.tsx:186-200`). `Provider.accept` stores one pending resolver; a second request resolves to `null` (`createPbui.tsx:224-236`). While accepting, a left click satisfies the request instead of activating/opening the object menu.

This is already modal interaction with useful properties:

- the mode is explicit and visible through `AcceptBanner` and `MouseDocLine`;
- it has a lifecycle and cancellation path;
- it changes gesture meaning globally across presentations;
- it has an input type context, analogous to CLIM's `accept`.

Its limitations are exact target matching, untyped conversion declarations, first-success conversion order, no conversion trace, and a single global pending slot.

### 2.5 Serializable verbs form the correct effect boundary

Workbench operations are discriminated data (`packages/pbui-workbench/src/verbs.ts:47-123`). `performWorkbenchVerb` routes one verb to handlers and preserves whether an operation changed anything (`verbs.ts:815-889`). This separation enables tests, agent tool calls, tracing, protocol transport, logging, and future execution policy.

PBUI should preserve serializable verbs as the default result of action binding. A callback may still be appropriate for strictly local, ephemeral UI behavior, but must be explicitly classified as local and non-serializable. “AOP-style lambdas” should wrap this execution boundary, not replace verbs with opaque closures throughout discovery.

### 2.6 Context policy currently appears in three independent shapes

1. Presentation action callbacks read product `Environment` and emit `disabledBecause`.
2. Apps have `available?(AppAvailability): boolean` scoped only by workspace (`packages/pbui-workbench/src/apps.ts:62-84`).
3. Shortcut routing uses a pure `ShortcutContext` with explicit modal booleans (`src/chrome/shortcutRouting.ts:16-69`).

The shortcut implementation demonstrates the right testing style—awkward state is a pure input, not read from the DOM—but each subsystem invents its own context vocabulary and boolean result. The proposed kernel does not need to replace all three immediately. It should establish shared concepts (`SelectionSnapshot`, `Availability`, `ScopeId`, named modes) that these policies can converge on.

## 3. Theoretical foundations

### 3.1 Ciccarelli: a presentation is a semantic relation, not a styled component

Eugene C. Ciccarelli's 1981 MIT working paper defines a presentation as a display form conveying information about a domain object. It separates domain objects, abstract display forms, and device realization (`sources/01-presentation-based-user-interfaces.txt:205-227`). A presentation may contain subpresentations; visual template parts are not necessarily semantic content.

Three lessons matter to PBUI:

- **Semantic identity survives rendering.** The action system should dispatch on a typed reference, not CSS classes, DOM tags, or component names.
- **Nested semantic objects are expected.** Resolution must define whether pointer location chooses the innermost presentation and how ancestor presentations participate.
- **The system itself can be presented.** Ciccarelli explicitly includes history, current activity, future plans, and command documentation (`sources/01-presentation-based-user-interfaces.txt:570-599`). Resolution traces, mode indicators, and disabled reasons are therefore first-class interface material, not debug leftovers.

The paper also highlights interaction ambiguity: editing a directory-listing line might mean delete the file or merely remove it from view (`sources/01-presentation-based-user-interfaces.txt:524-542`). The lesson is not “pick a clever default.” It is to model target, action, scope, and consequence separately enough to expose ambiguity and choose conservatively.

### 3.2 CLIM: presentations, input contexts, translators, gestures, and command tables

CLIM operationalizes many of these ideas. A presentation translator maps a source presentation type to a target presentation type in an input context. A presentation-to-command translator lets one gesture both select an object and supply a command argument (`sources/05-clim-translators-overview.md`). Sensitivity depends on:

- the input context's expected type;
- the presentation under the pointer;
- pointer/modifier gesture;
- accessible translators;
- type parameters and tester predicates.

CLIM's documented matching order is particularly useful (`sources/06-clim-translator-applicability.md`):

1. start from translators accessible through the active command table;
2. require the presented type to be a subtype of the translator's source type;
3. require the translator target type to be a subtype of the input context type;
4. match the gesture;
5. validate parameterized source type and tester;
6. validate the produced target where needed;
7. choose among matches by priority;
8. for nesting, prefer the smallest presentation matching the innermost context.

PBUI should adopt the *pipeline and explicit relations*, not copy every CLIM surface API. In particular:

- command tables inspire composable action scopes;
- presentation subtype matching replaces exact-key only matching;
- typed translators generalize today's untyped conversion array;
- pointer documentation inspires `ResolutionTrace` and current mouse documentation;
- the expected target type belongs in the query, not in global mutable state.

CLIM uses explicit priority to resolve translator ties. PBUI should support priority only as a deliberate final tie-breaker inside the same extension boundary; nominal specificity should resolve normal subtype overrides, and unresolved cross-package ties should be diagnostics.

### 3.3 CLOS method combination and AOP: composition is different from selection

CLOS generic functions first determine applicable methods, order them by specializer specificity, then form an effective method. Standard method combination has primary, `:before`, `:after`, and `:around` methods. Aspect-oriented programming uses corresponding vocabulary: a join point is an execution location, a pointcut selects join points, advice contributes behavior, and weaving composes advice with the base operation.

For PBUI the safe join point is **execution of a resolved verb**, not arbitrary React render/click sites. Proposed mapping:

```text
CLOS / AOP                     PBUI
----------------------------   ------------------------------------
generic function               perform verb
applicable primary method      resolved action binding + handler
specializer                    verb kind / source type / scope
:before advice                 audit/telemetry preparation
:around + call-next-method     authorization, transaction, retry
:after advice                  outcome event, refresh, notification
pointcut                       structured match over action/verb metadata
```

This supports “AOP-style lambdas” while keeping their power bounded. Advice is registered by stable ID and phase. An `around` function receives `proceed`; before/after receive immutable invocation/outcome data. Ordering is explicit. The selected action and serializable verb remain inspectable.

Advice must not be used to smuggle discovery policy into execution. If an action should be unavailable in review mode, its availability rule should say so and render the reason. Authorization advice rechecks security at execution because state can change, but it does not substitute for menu feedback.

### 3.4 Predicate dispatch: separate applicability from overriding

Ernst, Kaplan, and Chambers' 1998 predicate-dispatch paper defines case selection as two questions:

- **Applicability:** does this case's guard hold?
- **Overriding:** which applicable case is more specific?

Their model uses logical implication: predicate `P1` overrides `P2` when `P1` implies `P2` and not vice versa (`sources/02-predicate-dispatching-ecoop98.txt:35-75`, `418-523`). It values declaration-order independence and diagnoses “not understood” and ambiguity rather than silently choosing by source order.

This gives PBUI four design requirements:

1. Keep condition evaluation separate from precedence.
2. Never make import/registration order the hidden override rule.
3. Define completeness expectations per query (an empty menu may be valid; an invoked default action may require exactly one result).
4. Return ambiguity as data and reject statically detectable ambiguity at registration.

Full logical implication is not practical for TypeScript callbacks. The paper itself treats arbitrary host expressions as black boxes and notes undecidability (`sources/02-predicate-dispatching-ecoop98.txt:636-660`). Therefore PBUI should use:

- type-subgraph specificity, computed at registration;
- explicit scope precedence and optional numeric priority;
- a structured, serializable condition language for common facts;
- optional opaque testers that affect applicability only.

This is less expressive than a research predicate-dispatch language and substantially more predictable than arbitrary lambdas plus priorities.

### 3.5 Context-oriented programming: activation and scope are separate

Context-oriented programming (COP) modularizes behavior variations in layers. Leger, Cardozo, and Masuhara distinguish **when a layer is active** from **where an active layer applies** (`sources/04-context-oriented-layer-activation.txt:199-260`). Their survey includes imperative, implicit condition-driven, and event-driven activation, with lexical/control-flow, thread/session, global, per-instance, and per-type scopes (`sources/04-context-oriented-layer-activation.txt:377-406`).

For PBUI:

- a mode is a named contextual fact, not a subtype;
- entering review mode is an activation event;
- whether review mode applies globally, to one workbench, one surface, one object, or one invocation is its scope;
- mode interactions need declared constraints (`exclusiveWith`, `requires`) rather than scattered `if` statements;
- active mode state can be projected from interaction events, but selection reads the projection, not the whole event log.

Do not create virtual presentation subtypes such as `review-mode-file` or `selected-file`. That leads to combinatorial classes (`selected-reviewed-readonly-image-file`) and conflates stable semantic kind with transient state. Type narrows candidates; context guards availability.

### 3.6 State machines and event history: previous interactions become current facts

An action rule should not scan an unbounded `history[]` during every menu render. Instead:

```text
InteractionEvent* --reduce--> InteractionProjection --snapshot--> resolver
```

Examples of projected facts:

```ts
interface InteractionProjection {
  lastAction?: { actionId: ActionId; subjectIds: string[]; outcome: "succeeded" | "failed" };
  selectedIds: ReadonlySet<string>;
  completedTours: ReadonlySet<string>;
  counters: ReadonlyMap<string, number>;
  statecharts: ReadonlyMap<string, string>;
}
```

A finite-state machine or statechart should own workflows where legal actions depend on prior transitions. For example, an approval object might move `draft -> submitted -> approved | rejected`. Action guards query the current state. The immutable event stream remains useful for audit/replay, but the action engine consumes a bounded deterministic projection.

## 4. Requirements and non-requirements

### 4.1 Functional requirements

The engine must:

- inherit action rules through nominal presentation subtyping;
- support independent action contributions without mutating descriptors;
- select actions from one or multiple subject references;
- evaluate explicit mode, scope, capability, selection, and history-projection facts;
- distinguish available, unavailable-with-reason, and intentionally hidden;
- support typed source-to-target conversions for accept/command arguments;
- resolve overrides deterministically and diagnose ambiguity;
- expose a complete explanation trace;
- bind actions to serializable verbs by default;
- compose named before/around/after execution advice;
- revalidate before execution;
- preserve nested-presentation and keyboard/accessibility semantics.

### 4.2 Quality requirements

- Pure deterministic resolution for a given registry, query, and snapshot.
- No dependence on registration order.
- Registration-time graph, ID, and conflict validation.
- Bounded query cost and indexable candidate lookup.
- Stable output ordering for menus and tests.
- SSR/test compatibility: no DOM reads inside rules.
- Agent-safe introspection without running effects.
- Security checks at the execution boundary.

### 4.3 Non-requirements for the first implementation

- General theorem proving over arbitrary predicates.
- Runtime monkey-patching of action handlers.
- Automatic conversion through arbitrary-length paths.
- User-authored remote JavaScript lambdas.
- Replacement of workbench verbs, protocol mutations, or all shortcut routing.
- Backward-compatibility shims after migration; this repository's policy is to update contracts and consumers directly.

## 5. Proposed semantic model

### 5.1 Stable vocabulary

- **Type definition:** runtime nominal type metadata and parent edges.
- **Reference:** semantic object occurrence `{ type, value, identity? }`.
- **Action identity:** conceptual operation such as `file.open`; used for overriding/deduplication.
- **Rule identity:** one declaration contributing/binding an action, such as `images.open-preview`.
- **Verb:** serializable request for an effect.
- **Scope:** named set of rules currently visible, similar to a command table/layer.
- **Mode:** contextual state that may alter applicability or invocation routing.
- **Condition:** side-effect-free test over a selection snapshot.
- **Resolved action:** one winning rule bound to concrete subject(s), status, verb, and provenance.
- **Advice:** behavior composed around execution of a resolved action.
- **Translator:** typed source-to-target reference conversion used by accept/argument acquisition.

### 5.2 Runtime type graph

Keep compile-time value correlation, but add explicit runtime definitions:

```ts
type TypeId<Values extends object> = Extract<keyof Values, string>;

interface PresentationTypeDefinition<
  Values extends object,
  T extends TypeId<Values>,
> {
  id: T;
  parents?: readonly TypeId<Values>[];
  identity?(value: Values[T]): string;
  validate?(value: unknown): value is Values[T];
}
```

Registration computes transitive ancestors and distances, rejects cycles and unknown parents, and optionally rejects ambiguous diamonds where payload coercion would be required. Multiple inheritance is acceptable for *action inheritance* because a type can semantically be both `file` and `image`. Payload adaptation should not happen implicitly; a rule sees the original concrete reference and can narrow by declared type metadata.

Example:

```text
                 object
                /      \
          document    selectable
              |          |
             file -------+
              |
          image-file
```

For `image-file`, actions declared for `image-file`, `file`, `document`, `selectable`, and `object` are candidates. Distance is the shortest parent path. If two incomparable ancestors declare the same action identity and both apply, registration/query reports ambiguity unless a concrete subtype override resolves it.

### 5.3 Selection snapshot

```ts
type ScopeId = string & { readonly __scope: unique symbol };
type ModeId = string & { readonly __mode: unique symbol };

interface SelectionSnapshot<ProductFacts = unknown> {
  revision: string | number;
  scopes: readonly ScopeId[];        // ordered inner/local -> outer/global
  modes: ReadonlySet<ModeId>;
  activeSurface?: string;
  activeWorkspace?: string;
  focused?: { type: string; identity?: string };
  selection: readonly { type: string; identity?: string }[];
  capabilities: ReadonlySet<string>;
  interaction: InteractionProjection;
  product: Readonly<ProductFacts>;
}
```

The snapshot is created once per resolution from product stores. Rules do not call `getState`, inspect React context, or query the DOM. `revision` supports stale-action detection. Facts that deserve generic composition belong in named fields; product-specific facts remain under `product` until repeated use proves a shared abstraction.

### 5.4 Availability is a discriminated result

Preserve PBUI's one-fact/one-reason invariant:

```ts
type Availability =
  | { kind: "available" }
  | { kind: "unavailable"; because: string; code?: string }
  | { kind: "hidden"; because: "out-of-scope" | "not-disclosed" | "not-relevant" };
```

`hidden` is not rendered. It exists so traces can distinguish “not contributed” from deliberately omitted. Normal state-dependent rules return `unavailable` and a human explanation.

For migration, the renderer can derive today's shape at its edge:

```ts
const disabledBecause =
  resolved.status.kind === "unavailable" ? resolved.status.because : undefined;
```

Do not expose both `status` and writable `disabledBecause` on one rule; that recreates disagreement.

### 5.5 Structured conditions plus optional testers

Common conditions should be data:

```ts
type Condition =
  | { op: "true" }
  | { op: "all"; conditions: readonly Condition[] }
  | { op: "any"; conditions: readonly Condition[] }
  | { op: "not"; condition: Condition }
  | { op: "mode"; id: ModeId; active: boolean }
  | { op: "scope"; id: ScopeId }
  | { op: "capability"; id: string }
  | { op: "selection.count"; min?: number; max?: number }
  | { op: "history.lastAction"; actionId: ActionId; outcome?: string }
  | { op: "product"; predicateId: string };
```

Named product predicates are registered separately and return `Availability`, not a bare boolean:

```ts
predicates.define("tile.can-close", ({ subjects }) =>
  subjects[0].value.canClose
    ? { kind: "available" }
    : { kind: "unavailable", because: "a workspace keeps at least one tile" }
);
```

The structured portion supports explanation, static dependency extraction, test fixtures, and agent description. Named predicates remain an escape hatch. Inline lambdas may be accepted for local code initially, but production diagnostics should label them opaque and require an explicit availability reason on failure.

### 5.6 Action rules

```ts
interface ActionRule<Values extends object, Verb, Facts = unknown> {
  id: RuleId;                          // unique declaration ID
  action: ActionId;                    // conceptual identity for override
  subjects: readonly TypeId<Values>[]; // one => single dispatch; many => multi
  scopes: readonly ScopeId[];
  gesture?: GesturePattern;
  when?: Condition;
  test?(query: RuleQuery<Values, Facts>): Availability;
  metadata: {
    label: string | ((query: RuleQuery<Values, Facts>) => ReactNode);
    description?: string;
    group?: string;
    order?: number;
    danger?: boolean;
  };
  priority?: number;                   // explicit, uncommon tie-breaker
  bind(query: RuleQuery<Values, Facts>): Verb;
}
```

`bind` runs only for a selected visible rule. It should be pure and should create data, not perform the action. A rule may match multiple subjects, enabling operations such as compare two documents or swap two tiles without encoding tuple types into the presentation hierarchy.

### 5.7 Scopes and modes

Scopes control which declarations are candidates. Modes are facts available to conditions and gesture routing.

```ts
interface ActionScope {
  id: ScopeId;
  parents?: readonly ScopeId[];
  precedence?: number;
}

interface ModeDefinition {
  id: ModeId;
  activation: "explicit" | "condition" | "event";
  scope: "provider" | "surface" | "workspace" | "object" | "invocation";
  exclusiveWith?: readonly ModeId[];
  requires?: readonly ModeId[];
}
```

Examples:

- `global` contributes universal inspect/help actions.
- `workbench` contributes tile/workspace actions.
- `editor` contributes rename/delete actions.
- `review` is an active mode scoped to one workbench and makes destructive editor actions unavailable.
- `accepting:person` is an invocation mode whose expected target type alters click routing.

A scope stack is explicit in each query. It is not inferred from import order or component ancestry. React providers may build the stack, but the resolver only sees immutable IDs.

### 5.8 Resolved actions and traces

```ts
interface ResolvedAction<Verb> {
  id: ActionId;
  ruleId: RuleId;
  subjects: readonly PresentationReference<any>[];
  label: ReactNode;
  description?: string;
  group?: string;
  order: number;
  danger: boolean;
  status: Availability;
  verb?: Verb;                    // absent for hidden/diagnostic items
  snapshotRevision: string | number;
  provenance: {
    declaredTypes: readonly string[];
    distances: readonly number[];
    scope: ScopeId;
    conditionIds: readonly string[];
  };
}

interface ResolutionTrace {
  query: SerializableQuery;
  candidates: readonly {
    ruleId: RuleId;
    stage: "scope" | "type" | "gesture" | "condition" | "override" | "selected";
    result: "pass" | "reject" | "unavailable" | "hidden" | "shadowed";
    because?: string;
  }[];
}
```

A trace powers developer tools, agent explanations, test failures, and future command documentation. It should be produced by the same resolver path, not by a separate “debug mode” implementation.

## 6. Resolution algorithm

### 6.1 Single- and multi-subject candidate matching

For a query with subjects `S1..Sn`, a rule of arity `n` is a type candidate when every concrete subject type is a subtype of its declared subject type.

```text
distanceVector(rule, query) = [
  distance(S1.type, rule.subjects[0]),
  ...,
  distance(Sn.type, rule.subjects[n-1])
]
```

Pointwise dominance is safer than lexicographic ordering for UI actions:

```text
A more-specific-than B iff
  every A.distance[i] <= B.distance[i]
  and at least one A.distance[i] < B.distance[i]
```

If neither dominates, they are incomparable. For the same action identity, an incomparable pair that can both apply is an ambiguity unless priority or a more-specific conjunction rule resolves it.

### 6.2 Pipeline

```text
Query + Snapshot
      |
      v
[1] index by arity and reachable source types
      |
[2] filter active scopes
      |
[3] filter source type/subtype relation
      |
[4] filter target/input context and gesture (when present)
      |
[5] evaluate structured condition + tester
      |
[6] partition by ActionId
      |
[7] compute maximal rules under specificity
      |                 \
 unique maximum          multiple maxima
      |                       |
[8] bind verb          ambiguity diagnostic
      |
[9] stable group/order sort
      |
ResolvedAction[] + ResolutionTrace
```

Pseudocode:

```ts
function resolve(query, snapshot): ResolutionResult {
  const candidates = index.candidates(query.subjects.length, query.subjects.map(s => s.type));
  const applicable = [];

  for (const rule of candidates) {
    if (!scopeMatches(rule, snapshot.scopes)) reject(rule, "scope");
    else if (!typesMatch(rule, query.subjects)) reject(rule, "type");
    else if (!gestureMatches(rule, query.gesture)) reject(rule, "gesture");
    else {
      const status = evaluate(rule.when, rule.test, query, snapshot);
      if (status.kind === "hidden") traceHidden(rule, status);
      else applicable.push({ rule, status, distances: distances(rule, query) });
    }
  }

  for (const group of groupBy(applicable, x => x.rule.action)) {
    const maxima = maximalElements(group, moreSpecific);
    const winner = breakDeclaredTie(maxima); // scope precedence, then explicit priority
    if (!winner) ambiguities.push(explainAmbiguity(maxima));
    else actions.push(bindResolved(winner, query, snapshot.revision));
  }

  return { actions: stableSort(actions), ambiguities, trace };
}
```

### 6.3 Override and ordering rules

Action identity controls override. Different action IDs accumulate even if declared at the same type. Rules with the same action ID compete in this order:

1. more-specific subject type vector;
2. nearer/inner active scope if scope precedence is declared;
3. explicit numeric priority;
4. otherwise ambiguity.

Array order, module import order, registration timestamp, and label are never semantic.

Menu ordering is separate from override:

```text
(group rank, metadata.order, localized label, action ID)
```

Ordering does not choose winners. Keeping these independent prevents a UI reorder from changing behavior.

### 6.4 Empty and ambiguous outcomes

An empty object menu is valid and renders “No actions available,” as today. A default gesture query may require zero-or-one action; if more than one default action is selected, it is an error and the safe fallback is to open the menu rather than execute arbitrarily.

Ambiguity should be visible in development and diagnosable in production telemetry. The production UI can omit ambiguous actions and offer a diagnostic menu row. Destructive ambiguous actions must never execute.

## 7. Typed translators and accept mode

### 7.1 Conversion contract

Replace the anonymous conversion array with declared edges:

```ts
interface PresentationTranslator<Values extends object> {
  id: TranslatorId;
  from: TypeId<Values>;
  to: TypeId<Values>;
  scopes: readonly ScopeId[];
  gesture?: GesturePattern;
  when?: Condition;
  priority?: number;
  translate(query: TranslatorQuery<Values>): PresentationReference<Values> | undefined;
}
```

Direct subtyping should satisfy an accept request without conversion. If `image-file <: file`, accepting `file` returns the original `image-file` reference unless the consumer explicitly requests normalization. This preserves concrete identity and information.

### 7.2 Path policy

Phase 1 should allow direct translation edges only. Unbounded path search introduces:

- cycles;
- multiple paths with different meaning/cost;
- surprising lossy conversions;
- repeated tester side effects if callbacks are impure.

A later phase may support bounded paths with declared cost and lossiness:

```ts
interface TranslatorCost {
  hops: number;
  lossy: boolean;
  userConfirmation: boolean;
}
```

Choose the unique least-cost path or report ambiguity. Never choose the first registered path.

### 7.3 Accept flow

```ts
async function accept(request: AcceptRequest): Promise<Reference | null> {
  const token = modes.activate({
    id: `accept:${request.id}`,
    scope: "invocation",
    expected: request.types,
  });
  try {
    return await pendingInput.wait(request);
  } finally {
    modes.deactivate(token);
  }
}

function clickPresentation(ref, gesture) {
  const acceptResult = translators.resolve({ ref, target: activeAccept.types, gesture });
  if (acceptResult.unique) return settleAccept(acceptResult.reference);
  if (acceptResult.ambiguous) return showChoice(acceptResult.paths);
  return resolveDefaultOrMenu(ref, gesture);
}
```

The visible banner and mouse documentation remain. Their text can now include the accepted supertype and conversion explanation.

## 8. Execution advice and safety

### 8.1 API

```ts
interface Invocation<Verb, Facts> {
  action: ResolvedAction<Verb>;
  verb: Verb;
  snapshot: SelectionSnapshot<Facts>;
  signal: AbortSignal;
  correlationId: string;
}

type ActionOutcome =
  | { kind: "succeeded"; changed: boolean; value?: unknown }
  | { kind: "refused"; because: string; code?: string }
  | { kind: "failed"; error: unknown };

interface ActionAdvice<Verb, Facts> {
  id: string;
  phase: "before" | "around" | "after";
  pointcut: AdvicePointcut; // action IDs, verb kinds, scopes, danger, capabilities
  order: number;
  run: BeforeAdvice | AroundAdvice | AfterAdvice;
}

type AroundAdvice = (
  invocation: Invocation<any, any>,
  proceed: () => Promise<ActionOutcome>,
) => Promise<ActionOutcome>;
```

### 8.2 Effective execution order

Use one documented order:

```text
around (low order) enter
  around (high order) enter
    before (low -> high)
      handler
    after (high -> low)
  around (high order) exit
around (low order) exit
```

Suggested standard advice:

1. correlation/trace context (`around`);
2. authorization and fresh applicability revalidation (`around`);
3. transaction/optimistic concurrency (`around`);
4. audit start (`before`);
5. product verb handler (primary);
6. outcome event/history projection (`after`);
7. telemetry/notification (`after`).

### 8.3 Revalidation and time-of-check/time-of-use

The menu's resolved action carries `snapshotRevision`, but clicking it must query a fresh snapshot. If it is now unavailable, return `refused` with the current reason and keep effects untouched. Authorization also runs in execution advice because visibility is never a security boundary.

```ts
async function perform(action) {
  const fresh = snapshots.current();
  const reResolved = resolver.resolve(action.originalQuery, fresh);
  const current = reResolved.actions.find(a => a.id === action.id);
  if (!current || current.status.kind !== "available") {
    return { kind: "refused", because: current?.status.because ?? "action no longer applies" };
  }
  return executor.invoke(current, fresh);
}
```

### 8.4 Lambdas: permitted and prohibited uses

Permitted:

- local `test` functions that are pure and return explained availability;
- local `bind` functions that construct serializable verbs;
- registered advice functions with explicit pointcuts and ordering;
- product predicate implementations behind stable IDs.

Prohibited at the portable/agent boundary:

- serializing JavaScript source for remote execution;
- closures that capture mutable stores and perform effects during discovery;
- advice that changes action identity or silently swallows refusal;
- rules whose only specificity is “whichever lambda was registered last.”

For agent-generated actions, accept a declarative condition/verb schema interpreted by trusted handlers, not raw code.

## 9. Nested presentations, gestures, and accessibility

Current `Presentation` marks native click events so an inner presentation can bubble to an ordinary host while an outer presentation ignores the handled gesture. It also yields role/tab-stop ownership inside composite widgets. These are behavioral invariants independent of the resolver.

The proposed gesture query should include:

```ts
interface GestureQuery {
  kind: "pointer" | "keyboard" | "menu" | "agent";
  gesture: "primary" | "secondary" | "context-menu" | "enter" | "space" | string;
  modifiers: ReadonlySet<"shift" | "control" | "meta" | "alt">;
  presentationPath: readonly PresentationOccurrence[]; // inner -> outer
  inputContext?: AcceptContext;
}
```

Selection policy:

1. the innermost semantic presentation under the gesture is the default subject;
2. active accept context gets first chance to consume the gesture;
3. a unique explicit default action may run;
4. otherwise open the object menu;
5. nested ancestors do not also execute;
6. keyboard activation routes through the same semantic path as pointer activation;
7. a composite host retains keyboard ownership unless it delegates explicitly.

Do not port CLIM's pointer assumptions literally. PBUI must expose the same action model through keyboard, assistive technology, touch, menus, and agent calls.

## 10. Public API sketch

```ts
const pbui = createPbui({
  types: definePresentationTypes<Values>()
    .type("object")
    .type("document", { parents: ["object"] })
    .type("file", { parents: ["document"] })
    .type("image-file", { parents: ["file"] }),

  descriptors: {
    file: {
      label: file => file.name,
      describe: file => ({ kind: "file", id: file.id, path: file.path }),
      tone: "accent",
    },
  },

  scopes: [
    { id: "global" },
    { id: "editor", parents: ["global"] },
  ],

  actions: [
    defineAction({
      id: "files.open",
      action: "file.open",
      subjects: ["file"],
      scopes: ["global"],
      metadata: { label: "Open", group: "file", order: 10 },
      bind: ({ subjects: [file] }) => ({ kind: "file.open", id: file.value.id }),
    }),
    defineAction({
      id: "files.delete",
      action: "file.delete",
      subjects: ["file"],
      scopes: ["editor"],
      when: { op: "not", condition: { op: "mode", id: "review", active: true } },
      test: ({ subjects: [file], snapshot }) =>
        snapshot.product.canDelete(file.value.id)
          ? { kind: "available" }
          : { kind: "unavailable", because: "you do not have permission to delete this file" },
      metadata: { label: "Delete", group: "file", danger: true },
      bind: ({ subjects: [file] }) => ({ kind: "file.delete", id: file.value.id }),
    }),
  ],

  translators: [
    defineTranslator({
      id: "file.to-containing-folder",
      from: "file",
      to: "folder",
      scopes: ["editor"],
      translate: ({ reference }) => folderRef(reference.value.parentId),
    }),
  ],

  advice: [auditAdvice(), authorizationAdvice()],
  snapshot: () => selectionSnapshotFromStores(),
});
```

Consumer operations:

```ts
pbui.registry.descriptorFor("image-file");
pbui.actions.resolve({ subjects: [imageRef], invocation: { kind: "menu" } });
pbui.actions.explain({ subjects: [imageRef], action: "file.delete" });
pbui.accept({ types: ["folder"], prompt: "Choose destination" });
pbui.perform(resolvedAction);
pbui.introspect.listActions({ type: "image-file", scopes: ["global", "editor"] });
```

Keep `Presentation` and `ObjectMenu` as React adapters over these pure services.

## 11. Validation rules

Registration should fail fast for:

- duplicate type, rule, translator, mode, scope, predicate, or advice IDs;
- unknown parent/source/target/scope IDs;
- cycles in type, scope, or translator graphs;
- action rules with zero subjects or unsupported arity;
- same action identity and equal specializers in overlapping scopes without explicit override;
- incomparable inherited declarations for the same action where a known concrete subtype can see both;
- duplicate advice `(phase, order, id)` inconsistencies;
- around advice without a `proceed` contract;
- a hidden status with arbitrary user prose rather than a policy code;
- unavailable status without a non-empty reason;
- binders that return non-serializable verbs in a registry marked portable.

Some predicate overlap cannot be proven. Mark those pairs “potentially ambiguous” and require an explicit priority/override declaration or a registration option acknowledging mutual exclusion.

## 12. Performance and caching

Let `R` be total rules, `A(T)` reachable ancestor types, and `C` candidates indexed for those types. A naive resolver is `O(R)`. Index rules by arity and each declared source type so normal single-subject resolution is approximately `O(A(T) + C)` plus predicate cost.

Precompute:

- type ancestors and shortest distances;
- scope ancestry/precedence;
- statically known override relations;
- rule groups by action identity;
- condition dependency keys.

Cache only pure resolution results, keyed by:

```text
(registryVersion, subject type+identity+version, active scopes, modes, snapshot revision/dependencies, invocation)
```

Start with no cross-render cache. React memoization plus indexed resolution is likely sufficient. Add caching only after profiling because stale availability is worse than a small predicate cost. Expensive product predicates should derive facts in stores/selectors before snapshot creation.

## 13. Testing strategy

### 13.1 Type graph unit tests

- direct and transitive subtype checks;
- multiple inheritance and shortest distance;
- cycle and unknown parent rejection;
- concrete payload/reference correlation;
- deterministic ancestor output independent of registration order.

### 13.2 Resolver table tests

Use data-driven cases:

```text
concrete type | scopes          | modes   | expected action | selected rule | status
image-file    | global,editor   | —       | file.open       | files.open    | available
image-file    | global,editor   | review  | file.delete     | files.delete  | unavailable
file          | global          | —       | file.delete     | —             | absent(scope)
```

Also test inherited accumulation, same-action override, incomparable ambiguity, explicit priority, stable menu ordering, multi-subject pointwise specificity, hidden traces, and opaque tester failure.

### 13.3 Translator tests

- subtype directly satisfies supertype request;
- one direct conversion succeeds;
- source/target/scope/gesture mismatch is traced;
- equal-cost paths are ambiguous;
- cycles rejected;
- translated result validated;
- nested presentations choose innermost applicable occurrence.

### 13.4 Execution tests

- fresh revalidation refuses stale actions;
- before/around/after order is exact;
- `around` advice can refuse without invoking handler;
- thrown handler errors become `failed` and still reach outcome advice as specified;
- abort signal propagation;
- authorization cannot be bypassed by agent invocation;
- outcome events update history projection only after success/refusal semantics are known.

### 13.5 React contract tests

Retain current tests for:

- menu open/perform;
- disabled reason rendering;
- accept mode and cancellation;
- click propagation/nested presentations;
- keyboard parity;
- composite-widget role/tab-stop ownership;
- Escape ownership and focus movement.

Add resolver traces to assertions without replacing behavior assertions.

### 13.6 Property tests

Useful invariants:

- adding an unrelated rule cannot change existing winners;
- permuting registry input cannot change results;
- a more-specific override affects only its subtype region;
- no selected action is both available and has an unavailable reason;
- every performed action was uniquely resolved and freshly available;
- advice ordering is deterministic under registry permutation.

## 14. Phased implementation guide

### Phase 0: Freeze current behavior

Files:

- `src/presentation/types.ts`
- `src/presentation/registry.ts`
- `src/presentation/createPbui.test.tsx`
- `src/presentation/registry.test.ts`

Tasks:

1. Add golden tests for current exact-type action order, environment changes, absent descriptors, accept conversions, and disabled reasons.
2. Add a test fixture representing a base `document` and concrete `file` before introducing inheritance.
3. Document that current conversions use first-match order, so migration can intentionally change ambiguity behavior.

Exit: no new API; current behavior is pinned.

### Phase 1: Introduce runtime type graph

Suggested new files:

```text
src/presentation/typeGraph.ts
src/presentation/typeGraph.test.ts
```

Tasks:

1. Implement type registration, parent validation, cycle detection, ancestors, `isSubtype`, and distance.
2. Keep `PresentationValues` and `PresentationReference` unchanged.
3. Allow `createPresentationRegistry` to receive validated type definitions.
4. Use subtype checks for `AcceptRequest` before conversions.

Exit: subtype acceptance works; descriptors remain exact-type representation policies.

### Phase 2: Extract action rules and pure resolver

Suggested files:

```text
src/presentation/actions/types.ts
src/presentation/actions/registry.ts
src/presentation/actions/conditions.ts
src/presentation/actions/resolve.ts
src/presentation/actions/explain.ts
```

Tasks:

1. Define IDs, `Availability`, rules, snapshots, query, result, and trace.
2. Index single-subject rules first.
3. Implement subtype accumulation and same-action specificity.
4. Reject registration-order ambiguity.
5. Adapt descriptor `actions()` sites into rules product by product; do not maintain two live discovery engines longer than one migration phase.

Exit: object menus consume `ResolvedAction[]`; output behavior remains the same.

### Phase 3: Scopes, modes, and history projection

Suggested files:

```text
src/presentation/actions/scopes.ts
src/presentation/actions/modes.ts
src/presentation/actions/history.ts
```

Tasks:

1. Add explicit active scope stack to provider snapshot.
2. Model accept mode as a mode definition while preserving current UI state.
3. Move shortcut context derivation toward the shared snapshot, without forcing shortcut rules into action registry yet.
4. Define interaction events and reducer for only the historical facts required by real rules.
5. Migrate app/tile policy opportunistically after core behavior proves stable.

Exit: at least one action is contextually unavailable by mode and one by projected prior interaction, both with trace/reason.

### Phase 4: Typed translators

Suggested files:

```text
src/presentation/translators.ts
src/presentation/translators.test.ts
```

Tasks:

1. Replace `PresentationConversion[]` with registered direct translators.
2. Implement scope/type/target/gesture/test pipeline.
3. Diagnose tie ambiguity rather than first success.
4. Keep direct paths only.
5. Update accept banner/mouse documentation with translation provenance where useful.

Exit: subtype and conversion behavior are deterministic and explained.

### Phase 5: Execution pipeline and advice

Suggested files:

```text
src/presentation/execution.ts
src/presentation/execution.test.ts
```

Tasks:

1. Define `ActionOutcome`, invocation, advice, pointcuts, and composition order.
2. Wrap `Provider.onPerform` rather than moving product handlers into PBUI.
3. Add fresh revalidation and authorization seam.
4. Emit outcome events for history projection.
5. Preserve workbench handler boolean semantics.

Exit: audit and authorization advice wrap workbench verbs with deterministic tests.

### Phase 6: Multi-subject actions and introspection

Tasks:

1. Add bounded arity and pointwise specificity.
2. Add selection-set query helpers.
3. Expose `explain`, registry listing, and schema output for agent tooling/devtools.
4. Add Storybook examples for inherited actions, review mode, ambiguity, and compare/swap actions.

Exit: richer interactions exist without ad-hoc tuple presentation types or hidden dispatch order.

## 15. Migration examples

### 15.1 Current tile close action

Current:

```ts
{
  id: "close",
  label: "Close tile",
  verb: workbenchVerbs.close(tile.placementId),
  danger: true,
  ...(tile.canClose ? {} : { disabledBecause: "a workspace keeps at least one tile" }),
}
```

Proposed:

```ts
defineAction({
  id: "workbench.tile.close",
  action: "tile.close",
  subjects: ["tile"],
  scopes: ["workbench"],
  metadata: { label: "Close tile", group: "layout", danger: true },
  test: ({ subjects: [tile] }) => tile.value.canClose
    ? available()
    : unavailable("a workspace keeps at least one tile"),
  bind: ({ subjects: [tile] }) => workbenchVerbs.close(tile.value.placementId),
});
```

The renderer still derives exactly one `disabledBecause` string. The gain is provenance, scope, inheritance, and revalidation.

### 15.2 Review mode

```ts
defineAction({
  id: "files.delete",
  action: "file.delete",
  subjects: ["file"],
  scopes: ["editor"],
  when: not(mode("review")),
  metadata: { label: "Delete", danger: true },
  // Condition evaluator supplies: unavailable("review mode is read-only")
  bind: ({ subjects: [file] }) => ({ kind: "file.delete", id: file.value.id }),
});
```

Prefer a condition node that owns its negative explanation, e.g. `modeInactive("review", "review mode is read-only")`, rather than a generic boolean AST that cannot explain failure.

### 15.3 Prior interaction

```ts
defineAction({
  id: "tutorial.show-next",
  action: "tutorial.next",
  subjects: ["tutorial-step"],
  when: historyState("tutorial", { state: "awaiting-next" }, "complete the current interaction first"),
  bind: ({ subjects: [step] }) => ({ kind: "tutorial.next", stepId: step.value.id }),
});
```

The statechart reducer derives `awaiting-next`; the action does not search raw events.

## 16. Decision records

### Decision: Keep runtime presentation types nominal and explicit

- **Context:** TypeScript types are erased and structural; action inheritance needs a runtime relation.
- **Options considered:** Infer from JS prototypes; structural value predicates; explicit nominal type DAG.
- **Decision:** Register a validated nominal DAG keyed by existing `PresentationValues` keys.
- **Rationale:** Deterministic, inspectable, serializable, and independent of rendering/value implementation.
- **Consequences:** Authors declare parent edges; compile-time payload correlation remains; cycles/diamonds require validation.
- **Status:** proposed

### Decision: Separate representation descriptors from action rules

- **Context:** Labels generally have one owner; actions need open contributions and inheritance.
- **Options considered:** Keep `actions()` on descriptors; merge descriptors; independent rule registry.
- **Decision:** Descriptors retain representation; action rules move to a dedicated registry.
- **Rationale:** Avoids manual `extra()` plumbing and permits package-level composition without descriptor mutation.
- **Consequences:** More concepts, but each has one responsibility; migration touches action call sites.
- **Status:** proposed

### Decision: Use specificity, not registration order

- **Context:** Independent subtype/scope contributions can declare the same conceptual action.
- **Options considered:** First/last registration wins; numeric priority everywhere; nominal specificity plus diagnosed ties.
- **Decision:** Type-vector specificity first, scope precedence second, explicit priority last; unresolved ties are ambiguity.
- **Rationale:** Preserves modularity and makes behavior invariant under import order, following predicate-dispatch lessons.
- **Consequences:** Some formerly implicit conflicts require explicit resolution; better registration diagnostics are mandatory.
- **Status:** proposed

### Decision: Structured conditions with named predicate escape hatches

- **Context:** Arbitrary lambdas are expressive but opaque; full implication analysis is undecidable.
- **Options considered:** Boolean callbacks only; full predicate DSL/theorem prover; small condition algebra plus named testers.
- **Decision:** Use an explainable algebra for common facts and optional pure testers that affect applicability only.
- **Rationale:** Balances composition/introspection with product-specific flexibility.
- **Consequences:** Conditions need careful vocabulary design; opaque testers limit static overlap checks.
- **Status:** proposed

### Decision: Represent availability as available, unavailable-with-reason, or hidden

- **Context:** PBUI's `disabledBecause` fixed real illegal states; richer resolution also needs deliberate omission.
- **Options considered:** boolean plus reason; optional reason only; discriminated status.
- **Decision:** Rules return a discriminated `Availability`; renderer derives one optional disabled reason.
- **Rationale:** Preserves the existing invariant while adding traceable hidden policy.
- **Consequences:** Call sites become slightly more explicit; hidden usage must be reviewed narrowly.
- **Status:** proposed

### Decision: Treat modes as scoped context, not virtual subtypes

- **Context:** Actions vary with review/edit/accept modes and prior interactions.
- **Options considered:** Dynamic subclasses; global booleans; named mode definitions and snapshots.
- **Decision:** Named modes with activation and scope metadata live in `SelectionSnapshot`.
- **Rationale:** Avoids combinatorial type hierarchies and follows COP's activation/scope distinction.
- **Consequences:** Snapshot construction is a first-class integration seam; mode conflicts need validation.
- **Status:** proposed

### Decision: Put advice around verb execution only

- **Context:** AOP-style lambdas can modularize authorization, audit, tracing, and transactions but can also hide control flow.
- **Options considered:** arbitrary UI join points; descriptor wrappers; execution-only named advice.
- **Decision:** Compose before/around/after advice around fresh-revalidated resolved verb execution.
- **Rationale:** One inspectable effect boundary already exists; discovery remains pure and explainable.
- **Consequences:** Rendering concerns are not advice; local callbacks remain separate; advice ordering is public contract.
- **Status:** proposed

### Decision: Direct translator edges before conversion path search

- **Context:** Existing conversions are ordered callbacks; generalized paths add cycles and ambiguity.
- **Options considered:** preserve first match; unrestricted graph search; direct validated edges first.
- **Decision:** Implement direct edges with unique resolution; defer bounded least-cost path search.
- **Rationale:** Captures CLIM's typed translator benefit without premature graph complexity.
- **Consequences:** Some multi-hop conversions require explicit direct rules initially.
- **Status:** proposed

### Decision: Revalidate every action at execution

- **Context:** Modes, permissions, and object state can change after a menu opens.
- **Options considered:** trust rendered action; compare revision only; re-resolve plus authorization advice.
- **Decision:** Re-resolve/recheck on perform and return explained refusal on drift.
- **Rationale:** Prevents stale UI state from becoming authority and supports agent calls safely.
- **Consequences:** Execution has resolver cost; handlers need typed outcomes rather than silent `void`.
- **Status:** proposed

## 17. Risks, alternatives, and mitigations

### Risk: framework overreach

A universal action engine can become a second programming language. Mitigation: implement only concepts required by current PBUI cases, phase features, and keep product facts/predicates as escape hatches.

### Risk: opaque predicate sprawl

If every rule uses an inline tester, structured conditions become decoration. Mitigation: diagnostics count opaque rules, code review requires named predicates for reused/cross-package policy, and introspection marks opaque dependencies.

### Risk: confusing hidden versus unavailable

Hiding can conceal discoverability and policy. Mitigation: unavailable is default; hidden accepts narrow enum reasons; developer traces always include hidden rules.

### Risk: type DAG ambiguity

Multiple inheritance can produce incomparable overrides. Mitigation: detect known conflicts at registration and require a concrete subtype rule or explicit override.

### Risk: stale snapshots and expensive re-resolution

Mitigation: immutable revisioned snapshots, fresh execution check, indexed rules, and profiling before caching.

### Risk: advice obscures execution

Mitigation: named advice registry, fixed phase/order, invocation traces, no import-side-effect registration, and no advice around arbitrary React lifecycle points.

### Alternative: keep descriptor callbacks and enrich `Environment`

This is the smallest change but leaves contributions, inheritance, ambiguity, and introspection unsolved. It is suitable only if PBUI never needs independent action packages.

### Alternative: Redux selectors for every action

Selectors help derived state and memoization, but do not define type specificity, action identity, translator matching, or advice. They can build snapshots/product predicates under the proposed model.

### Alternative: full CLIM port

CLIM's model is valuable, but PBUI runs in React/TypeScript across keyboard, touch, agents, and serializable protocol verbs. Porting stream input, command processors, and all parameterized presentation semantics would be disproportionate. Adopt the semantic decomposition and matching lessons.

### Alternative: full predicate-dispatch language

Logical implication gives powerful precedence but requires a restricted language and complex static checking. PBUI should first use nominal relationships and structured common conditions; revisit richer predicate implication only if real ambiguities demand it.

## 18. Open questions

1. Should multiple inheritance be supported in Phase 1, or should the type graph begin as single-parent and add interfaces later?
2. Should action IDs be globally namespaced (`file.open`) or scoped by subject type plus local ID? Global IDs simplify introspection and override.
3. Should unavailable inherited actions be overridable only by a more-specific rule, or can an inner scope deliberately suppress them?
4. Which snapshot facts belong in PBUI core versus a product generic parameter?
5. Should local callback verbs remain supported, and if so how are they marked non-portable/non-agent-callable?
6. What maximum multi-dispatch arity is justified? Two likely covers compare/swap/link; arbitrary arity complicates indexing and UI argument acquisition.
7. Should translated acceptance return the original concrete reference plus a target view, or only the translated reference?
8. Which action outcome semantics should replace PBUI Provider's current `void | Promise<void>` without forcing workbench APIs to change at once?
9. How should conflicting modes be presented to users, not just rejected in code?
10. Should a resolver trace be always collected or lazily enabled? Always-collected compact codes are safer; verbose prose can be materialized lazily.

## 19. Experiment

`../scripts/01-selection-kernel.mjs` is a dependency-free executable sketch. Run:

```bash
node ttmp/2026/08/25/PBUI-ACTIONS-1--a-principled-type-and-action-selection-engine-for-pbui-presentations/scripts/01-selection-kernel.mjs
```

It demonstrates:

- an `image-file` seeing actions declared on `document`, `file`, and `image-file`;
- `file.open` overriding `document.open` by type distance for the same action identity;
- review mode making delete unavailable with a reason while activating annotate;
- history projection as resolver input;
- around/before/after execution ordering over a serializable verb;
- a registration diagnostic for equal-specificity plugin rules rather than last-registration-wins.

The captured expected output is `../scripts/01-selection-kernel.output.txt`.

## 20. References

### Repository evidence

- `src/presentation/types.ts:3-14` — compile-time typed reference union.
- `src/presentation/types.ts:24-76` — action metadata and `disabledBecause` invariant.
- `src/presentation/types.ts:113-142` — descriptor, accept request, and conversion contracts.
- `src/presentation/registry.ts:30-79` — exact-key descriptor/action lookup.
- `src/presentation/createPbui.tsx:186-200` — exact acceptance plus ordered conversions.
- `src/presentation/createPbui.tsx:203-282` — provider interaction state and effect boundary.
- `src/presentation/createPbui.tsx:501-568` — object-menu resolution/render/perform path.
- `src/presentation/createPbui.test.tsx:57-107` — menu execution and typed accept behavior.
- `src/presentation/createPbui.test.tsx:367-445` — unavailable reason behavior.
- `src/chrome/shortcutRouting.ts:1-69` — explicit pure contextual shortcut routing.
- `packages/pbui-workbench/src/apps.ts:62-84` — workspace-scoped app availability predicate.
- `packages/pbui-workbench/src/tileDescriptor.ts:6-48` — current-value action decision policy.
- `packages/pbui-workbench/src/tileDescriptor.ts:50-127` — concrete action generation and extra contribution seam.
- `packages/pbui-workbench/src/verbs.ts:47-123` — serializable verb vocabulary.
- `packages/pbui-workbench/src/verbs.ts:815-889` — verb effect routing and outcome truthfulness.

### Stored research sources

1. Eugene C. Ciccarelli, *Presentation Based User Interfaces*, MIT AI Laboratory Working Paper 219, July 1981. Stored as `../sources/01-presentation-based-user-interfaces.pdf` and extracted text.
2. Michael Ernst, Craig Kaplan, and Craig Chambers, *Predicate Dispatching: A Unified Theory of Dispatch*, ECOOP 1998, pp. 186–211. Stored as `../sources/02-predicate-dispatching-ecoop98.pdf` and extracted text.
3. Ramana Rao, William M. York, Dennis Doughty; 2006 update by Clemens Fruhwirth, *A Guided Tour of CLIM*. Stored as `../sources/03-guided-tour-of-clim.pdf` and extracted text.
4. Paul Leger, Nicolás Cardozo, and Hidehiko Masuhara, *An Expressive and Modular Layer Activation Mechanism for Context-Oriented Programming*, Information and Software Technology 156 (2023) 107132. Stored as `../sources/04-context-oriented-layer-activation.pdf` and extracted text.
5. LispWorks CLIM User Guide, “Conceptual Overview of Presentation Translators.” Stored as `../sources/05-clim-translators-overview.md`.
6. LispWorks CLIM User Guide, “Applicability of CLIM Presentation Translators.” Stored as `../sources/06-clim-translator-applicability.md`.
7. CLIM 2 Specification, “Presentation Types.” Stored as `../sources/07-clim-presentation-types.md`.

## 21. Recommended conclusion

Implement the proposal incrementally, beginning with a nominal runtime type graph and an independent pure action-rule resolver. Do not begin with AOP advice or arbitrary history predicates: those features are safe only after action identity, applicability, specificity, scope, outcomes, and explanation are explicit.

The central design principle is simple:

> Type determines where to look; context determines what applies; specificity determines what overrides; scope determines where policy is visible; the resolver explains the result; and execution revalidates before effects.

That principle is faithful to PBUI's existing strengths, grounded in the presentation/CLIM/dispatch lineage, and narrow enough for a new intern to implement and test one phase at a time.
