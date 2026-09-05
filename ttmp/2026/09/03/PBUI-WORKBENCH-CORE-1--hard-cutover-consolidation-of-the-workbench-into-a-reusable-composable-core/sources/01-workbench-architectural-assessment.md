The Workbench is one of the more important architectural pieces in PBUI, but its purpose has expanded beyond what the package description currently says. After reading the protocol, `createWorkbench`, verbs, store, layout/rebalance, links, persistence, sync, and agent description paths, I would define it more sharply.

# What the Workbench is for

The Workbench should be:

> **A persistent, addressable spatial coordination environment in which applications present shared documents, may appear in multiple places, may exchange typed values, and may be manipulated consistently by humans, agents, and remote clients.**

The key word is **coordination**.

The Workbench should not know what a chart means, how a conversation works, how a theorem is checked, or how a table query executes. Those belong to applications. What it should know is that an application view exists, what durable resources that view is bound to, where it appears, how it relates to other views, and how that arrangement changes.

The durable object graph is essentially:

```text
WorkbenchDocument
│
├── Workspace
│    └── layout tree
│         └── Placement
│              └── viewId ──────────────┐
│                                        │
├── AppView ◄────────────────────────────┘
│    ├── appId ───────────────► App definition
│    ├── title
│    └── document bindings
│          └──────────────► DocumentPayload
│
└── system/product documents
     ├── pbui.links
     ├── rebalance config
     └── application documents
```

There is a crucial separation already present in the design:

$$
\text{application} \neq \text{view} \neq \text{placement} \neq \text{document}
$$

That is the foundation I would preserve.

---

# The fundamental entities

The cleanest interpretation of the current model is:

| Entity        | Mathematical role                | Meaning                                                |
| ------------- | -------------------------------- | ------------------------------------------------------ |
| Application   | type/class                       | A kind of interactive program that can be instantiated |
| `AppView`     | logical identity                 | One configured instance of an application              |
| Placement     | occurrence                       | One spatial occurrence of a logical view               |
| Document      | durable resource                 | State/content referenced by one or more views          |
| Workspace     | spatial context                  | One arrangement of placements                          |
| Link          | dependency/coordination relation | How ports of logical views obtain/share values         |
| Session state | ephemeral observer state         | What this browser is currently looking at              |

The distinction between view and placement is especially strong.

Suppose:

$$
v\in Views
$$

and:

$$
p_1\mapsto v,\qquad p_2\mapsto v
$$

Then two tiles are displaying the **same logical view**.

Changing the view title changes both.

But:

$$
p_1\neq p_2
$$

so closing one placement does not mean deleting the logical view if the second placement remains.

That is exactly the right model.

---

# A more formal model

I would document the Workbench approximately as:

$$
D=(R,V,W,L)
$$

where:

* \(R\) is the set of durable resources/documents,
* \(V\) is the set of logical application views,
* \(W\) is the set of workspace layout trees,
* \(L\) is persistent link topology.

The application catalog \(A\) is external:

$$
app:V\rightarrow A
$$

Document bindings are relations:

$$
bind\subseteq V\times Slot\times R
$$

Each workspace has a binary layout tree:

$$
T ::= Placement(v)
\mid Split(direction,ratio,T,T)
$$

and therefore each placement points at exactly one view:

$$
place:P\rightarrow V
$$

but a view may have many placements:

$$
place^{-1}(v)=\{p_1,\ldots,p_n\}
$$

This is why the complete Workbench isn't really a tree. Its **geometry** is tree-shaped, while its **semantic state** is a graph.

That distinction is important.

---

# What the Workbench should own

The present implementation is close to the right boundary.

The Workbench should own durable application-view identity, spatial layout, workspace organization, resource bindings, view duplication/linking semantics, typed inter-view coordination, persistence format, high-level commands, and synchronization of that coordination state.

It should explicitly **not** own document semantics. A `DocumentPayload` is a resource envelope from the Workbench's perspective. The application/product owns the interpretation of:

```text
datadrop.gog.document
pbui.plotscript
conversation
notebook
...
```

Likewise, the core Workbench should eventually not own React, DOM geometry, launcher-open state, dialog-open state, or focus mechanics. Those are shell concerns.

That last point is where the current implementation has started to blur.

---

# The current architecture

Conceptually the code currently looks like:

```text
              workbench-protocol
                     │
           structural mutation algebra
                     │
                     ▼
              WorkbenchDocument
                     │
                     ▼
             WorkbenchStore
                     │
                     ▼
            createVerbHandlers
       ┌─────────────┼───────────────┐
       │             │               │
    layout         views           links
       │             │               │
       ├── geometry  │          link runtime
       │             │               │
       └─────────────┼───────────────┘
                     │
                     ▼
              createWorkbench
             /       |       \
        Surface   Launcher   Rebalance
                     │
                     ▼
                  React
```

And beside it:

```text
WorkbenchDocument
      │
      ├── local persistence
      └── sync/outbox/rebase
```

Most individual pieces are sensible.

The problem is that `createVerbHandlers` has become the point at which almost everything meets.

---

# The first thing I would change: make the semantic engine explicitly headless

`createWorkbench()` currently creates:

* the document store,
* application registry,
* link runtime,
* semantic verb handlers,
* plan/apply,
* placement controller,
* DOM root handling,
* focus behavior,
* React components.

That is too much responsibility for one construction function.

I would introduce the conceptual split:

```text
Workbench Engine
       │
       ▼
Workbench Runtime
       │
       ▼
PBUI Workbench Shell
```

The **engine** should be entirely pure/headless.

The **runtime** supplies live ephemeral state such as link values.

The **shell** supplies React, DOM geometry, focus, pointer interactions, launcher/dialog presentation, etc.

I would not necessarily create three npm packages immediately. The separation can start internally.

---

# The central Workbench abstraction should be `plan`

The repository already nearly contains the correct abstraction.

Right now a command roughly means:

$$
command + current\ state \rightarrow mutations
$$

I would formalize it as:

$$
Plan:
World\times Command
\rightarrow
Refusal+PreparedTransition
$$

where:

```ts
interface WorkbenchWorld {
  document: WorkbenchDocument;
  session: WorkbenchSession;
  links: LinkRuntimeSnapshot;
  geometry: GeometrySnapshot | null;

  apps: AppCatalog;
  policy: WorkbenchPolicy;
}
```

and:

```ts
interface PreparedTransition {
  preconditions: Preconditions;

  mutations: readonly Mutation[];
  sessionEffects: readonly SessionEffect[];
  runtimeEffects: readonly RuntimeEffect[];
  shellEffects: readonly ShellEffect[];

  explanation: string;
}
```

Then committing is separate:

$$
Commit(World,PreparedTransition)\rightarrow World'
$$

This gives you a tiny transaction engine.

---

# There is already a concrete reason to make that change

I found an important impurity in the current `plan()` implementation.

`createWorkbench.plan()` constructs a shadow `WorkbenchStore`, which is good, but then constructs shadow verb handlers using the **same link runtime** as the real Workbench:

```ts
const shadowHandlers = createVerbHandlers({
  store: shadow,
  ...
  runtime,
});
```

Some link operations generate runtime effects.

For example, identity-link creation can produce:

```ts
{ kind: "seed-class", ... }
```

and identity removal can produce:

```ts
set-emitted
forget-class
seed-class
```

`createLinkHandlers.perform()` eventually executes:

```ts
runtime.apply(result.effects);
```

Consequently, planning is not structurally guaranteed to be pure.

A sufficiently interesting link plan can affect the actual runtime even though the API promises:

> preflight against a shadow store without touching the real workbench.

That is exactly the type of bug that disappears if the planner returns runtime effects instead of interpreting them.

---

# There is a second plan-model inconsistency

`WorkbenchState` currently includes:

```text
workspaceId
activePlacementId

launcherOpen
launcherFrom

rebalanceOpen
linkModeOpen
showChooser
relationPalette
```

But `WorkbenchPlan.finalState` records only:

```text
workspaceId
activePlacementId
launcherOpen
launcherFrom
```

Yet the verb language contains commands such as:

```text
rebalance.open
rebalance.close
link.mode.open
link.mode.close
relation.palette.open
...
```

So the command algebra is broader than the plan algebra.

This is another signal that two things are being mixed:

$$
\text{Workbench semantic commands}
$$

and:

$$
\text{shell UI commands}
$$

I would separate them.

Opening the rebalance dialog is not a durable Workbench operation.

Rebalancing a workspace is.

Those are fundamentally different things.

---

# Reduce the core session state

I think the genuine Workbench session state is quite small:

```ts
interface WorkbenchSession {
  workspaceId: WorkspaceId;
  activePlacementId: PlacementId | null;
}
```

Possibly a little more eventually.

But:

```text
launcherOpen
rebalanceOpen
relationPalette
showChooser
linkModeOpen
```

belong to controllers for those features.

The placement subsystem already has the better architecture:

```ts
createPlacementController()
```

Launcher, rebalance, link management, and show-choice state could follow that model.

Otherwise `WorkbenchState` will continuously grow every time the shell gains another transient UI.

---

# Separate semantic commands from shell commands

I'd define approximately:

```text
WorkbenchCommand
    durable/session semantic operations

WorkbenchShellAction
    dialogs, menus, focus, transient modes
```

For example:

| Current verb            | Better semantic classification |
| ----------------------- | ------------------------------ |
| `tile.split`            | Workbench command              |
| `tile.close`            | Workbench command              |
| `view.open`             | Workbench command              |
| `workspace.delete`      | Workbench command              |
| `port.follow`           | Workbench command              |
| `workspace.select`      | Session command                |
| `tile.activate`         | Session command                |
| `launcher.open`         | Shell action                   |
| `rebalance.open`        | Shell action                   |
| `relation.palette.open` | Shell action                   |

That would make `plan()` much easier to define.

---

# Rename internal `tile.*` semantics to `placement.*`

The protocol already has the clearer terminology.

A tile is the visual thing the user sees.

A placement is the semantic thing being manipulated.

Currently:

```text
tile.close
tile.split
tile.swap
tile.dock
tile.link
tile.replace
```

all fundamentally operate on placements.

Internally I would use:

```text
placement.close
placement.split
placement.swap
placement.dock
placement.setView
```

The UI can still say:

> Close tile

This sounds cosmetic, but it prevents a major conceptual ambiguity.

A **tile** looks like it owns an application.

A **placement** explicitly does not.

It only points to a view.

---

# There are too many partially overlapping ways to “show something”

Current APIs include roughly:

```text
app.place
app.placeAt
view.open
tile.replace
tile.link
view.goTo
```

Each has legitimate UX meaning, but internally they repeatedly solve the same two problems:

### Identity resolution

Should we:

```text
reuse an existing view
link an existing view
create a fresh view
```

### Spatial resolution

Should we:

```text
go to it
split near something
dock at an edge
replace a placement
```

I would explicitly separate these axes.

Conceptually:

```ts
resolveView(request, world)
```

followed by:

```ts
placeView(view, target, world)
```

For example:

```ts
type ViewRequest =
  | { kind: "existing"; viewId: string }
  | {
      kind: "application";
      appId: string;
      documents?: Record<string, string>;
      title?: string;
      reuse: "singleton" | "same-bindings" | "never";
    };
```

and:

```ts
type PlacementRequest =
  | { kind: "near"; placementId?: string }
  | { kind: "split"; placementId: string; edge?: DockZone }
  | { kind: "replace"; placementId: string };
```

You don't necessarily need to expose these raw types publicly.

The important consolidation is internal.

Today identity policy and spatial policy are intertwined through several handlers. Separating them would eliminate a lot of subtle duplication.

---

# App descriptors should have a semantic half and rendering half

Current `AppDescriptor` contains both:

```text
singleton
duplicable
ports
```

and:

```text
tone
title
group
blurb
Component
titleFor
```

The first group affects Workbench semantics.

The second group affects presentation.

I would split:

```ts
interface AppManifest {
  id: AppId;

  viewCardinality: 1 | "many";
  clonePolicy: "independent" | "linked";

  ports: readonly PortDeclaration[];
}
```

from something like:

```ts
interface AppPresentation {
  title: string;
  tone: string;
  group?: string;
  blurb?: string;
  Component: ComponentType<AppProps>;
}
```

Then the headless Workbench engine depends only on `AppManifest`.

The React shell joins it to `AppPresentation`.

This is particularly useful for agents, workers, tests, and server-side validation.

---

# `singleton` and `duplicable` can be made more expressive

They're actually describing two different dimensions:

$$
\text{number of logical views}
$$

and:

$$
\text{what cloning a view means}
$$

So I would prefer explicit terms such as:

```ts
viewCardinality: "one" | "many";
clonePolicy: "independent" | "linked";
```

Then:

```text
one + linked
```

describes today's singleton behavior naturally.

And:

```text
many + linked
```

remains a meaningful policy if you want separately created views but splitting an existing one should link.

This is clearer than negated booleans.

---

# Default document binding should be generalized around ports

There is some architectural duplication between:

```ts
AppDescriptor.ports
```

which now declares document-slot ports, and:

```ts
BindingConfig {
  source: string;
  ...
}
```

which assumes one special binding key.

Now that applications have declared document slots, creation policy should operate over those slots.

Something closer to:

```ts
interface InitialBindingPolicy {
  resolve(
    app: AppManifest,
    slot: DocumentSlot,
    world: WorkbenchWorld,
  ): DocumentId | null;
}
```

or simply:

```ts
initialDocuments(app, world): Record<string, string>
```

would scale to applications with multiple document inputs.

The current `source` field is a remnant of the earlier “one primary document” model.

---

# Layout geometry should be supplied as data

`createVerbHandlers()` currently reaches into the DOM to answer semantic questions:

```text
Can this placement split?
What are this split's ratio bounds?
What is the longer rendered axis?
Will this layout fit?
```

Those are valid questions.

But the planner shouldn't need a DOM root.

Introduce:

```ts
interface GeometrySnapshot {
  placements: ReadonlyMap<PlacementId, Rect>;
  splits: ReadonlyMap<SplitId, SplitGeometry>;
  viewport: Rect;
  revision: number;
}
```

Then:

$$
Plan(D,S,G,c)
$$

remains pure.

The React shell's job is simply to measure:

```text
DOM → GeometrySnapshot
```

Headless callers provide no geometry and get the conservative relative constraints currently used as fallback.

This would make human, agent, test, and server planning much more consistent.

---

# Plans need explicit preconditions rather than document object identity

Currently:

```ts
if (store.getState().document !== prepared.baseDocument)
  return false;
```

This is conservative but fairly accidental.

It says:

> the JavaScript object identity of the document must still be identical.

What the operation really depends on may include:

```text
document revision
link runtime revision
geometry revision
app catalog/policy revision
```

For example, a split can be legal when planned, then the browser becomes much narrower without the document changing.

Object identity still matches.

But the geometric premise of the plan no longer does.

I would make plans contain explicit preconditions:

```ts
interface PlanPreconditions {
  documentRevision: RevisionToken;
  runtimeRevision?: number;
  geometryRevision?: number;
}
```

Possibly more targeted preconditions later.

Then freshness has actual semantics.

---

# Use a revision token inside the local store

Even without a server revision, a local store can maintain:

$$
r_{n+1}=r_n+1
$$

for each committed document mutation.

That is preferable to using object identity as the only concurrency token.

Something like:

```ts
interface WorkbenchSnapshot {
  document: WorkbenchDocument;
  revision: number;
}
```

makes planning and caching more explicit.

It also aligns local and remote mental models.

---

# The mutation layer is correctly lower-level than the command layer

I would preserve the distinction:

```text
WorkbenchCommand
      ↓
planner
      ↓
protocol Mutation[]
      ↓
structural applier
      ↓
WorkbenchDocument
```

The protobuf mutations are good as a portable primitive instruction set.

Commands should remain the richer semantic interface.

For example:

```text
view.open
```

can compile into:

```text
viewCreate
placementSplit
```

That separation is healthy.

Do not try to make every user intention a protobuf mutation.

---

# But command results need to become richer than `boolean`

This is especially important for agents.

At present:

```ts
workbench.perform(verb): boolean
```

throws away a large amount of useful information.

I'd prefer:

```ts
type CommandResult =
  | {
      kind: "applied";
      mutations: readonly Mutation[];
      explanation: string;
    }
  | {
      kind: "refused";
      code: string;
      because: string;
    }
  | {
      kind: "stale";
      because: string;
    }
  | {
      kind: "ambiguous";
      choices: readonly CommandChoice[];
    };
```

Then UI convenience methods can still return booleans.

But the canonical interface should be explanatory.

PBUI's Presentation and Link kernels are already moving toward that model.

The Workbench should too.

---

# Centralize document indexing

Many Workbench operations repeatedly derive:

```text
placement → workspace
placement → view
view → placements
app → views
document → bound views
node ID → node
```

from the full document.

For small layouts, performance isn't the main problem.

The architectural issue is duplicated graph knowledge.

I would introduce a derived immutable index:

```ts
interface WorkbenchIndex {
  workspaceById: ...
  nodeById: ...
  workspaceOfPlacement: ...
  viewOfPlacement: ...
  placementsOfView: ...
  viewsOfApp: ...
  viewsUsingDocument: ...
}
```

constructed from one document snapshot.

Conceptually this is a materialized projection:

$$
Index(D)
$$

It could be cached by document revision.

Then all planners reason through one canonical graph view.

---

# Decide what an unplaced `AppView` means

This is currently slightly inconsistent.

The Go validator allows a `View` that is present in `document.views` but has no placement.

But several Workbench verbs contain explicit cleanup because otherwise unplaced views:

> accumulate forever.

That means the architecture has not completely decided whether an unplaced view is meaningful.

There are two defensible designs.

Either:

$$
\forall v\in Views,\quad |placements(v)|\ge1
$$

after every completed transaction.

Or an unplaced view is a legitimate durable concept, analogous to a hidden tab/background application.

I suspect the first is what the current Workbench actually wants.

If so, make it an invariant of the complete graph. A batch may temporarily create a view before placing it, but after the batch:

$$
placements(v)\neq\varnothing
$$

Then garbage collection stops being scattered across handlers.

If hidden views are needed later, model them intentionally.

---

# Rebalance should have a formal preservation law

The current `workspaceSetTree` mutation is deliberately general.

But rebalance specifically intends to rearrange existing placements, not add or remove them.

That should be expressed as a law.

If:

$$
T\rightarrow T'
$$

is a rebalance, then:

$$
Leaves(T)=Leaves(T')
$$

more strongly, by placement identity:

$$
\{id(p)\mid p\in Leaves(T)\}
=
\{id(p)\mid p\in Leaves(T')\}
$$

and each placement should still reference the same logical view.

Thus rebalance changes only:

```text
split topology
split direction
split ratio
split identifiers where appropriate
```

not semantic membership.

I'd encode and property-test that invariant directly.

---

# The rebalancer itself is architecturally good

I would not consolidate its algorithms merely for uniformity.

It contains two genuinely different problems.

Minimum-size propagation is a tree dynamic program:

$$
row:
\begin{cases}
w=\sum_iw_i+gaps\\
h=\max_i h_i
\end{cases}
$$

and:

$$
column:
\begin{cases}
w=\max_i w_i\\
h=\sum_i h_i+gaps
\end{cases}
$$

Ratio repair is a convex projection:

$$
\min_{w'}
\frac12\|w'-w\|^2
$$

subject to:

$$
w'_i\ge l_i,\qquad \sum_iw'_i=1
$$

Structural rearrangement is combinatorial.

Those should remain separate algorithms under one rebalance façade.

---

# Links fit the Workbench, but through an extension boundary

Links make conceptual sense in the Workbench because they describe coordination between **views placed in the Workbench**.

However, the implementation correctly stores topology in a `pbui.links` `DocumentPayload` instead of modifying the protocol every time link semantics evolve.

I think that pattern can be generalized.

Something like:

```ts
interface WorkbenchExtension<State> {
  id: string;
  read(document: WorkbenchDocument): State;

  maintain?(
    before: WorkbenchDocument,
    mutations: readonly Mutation[],
    state: State,
  ): Mutation | null;

  describe?(state: State): unknown;
}
```

Then:

```text
links
rebalance configuration
future coordination systems
```

can use one extension mechanism.

Today link maintenance is special-cased directly inside `createVerbHandlers()`.

That will become increasingly awkward as more Workbench-level metadata appears.

---

# Links should consume the canonical Presentation Kernel

After the presentation refactor, I'd also stop configuring Workbench links through an independent:

```text
graph
relations
relation(...)
label(...)
```

bundle.

The Workbench should receive the relevant Presentation semantics/kernel and derive link relation semantics from it.

Conceptually:

```ts
createWorkbench({
  presentation,
  ...
})
```

not another parallel link semantic registry.

That continues the consolidation we started in `PBUI-KERNEL-1`.

---

# Sync has one important semantic weakness

The synchronization design is sensible for optimistic persistence:

```text
local mutations
    ↓
outbox
    ↓
server revision
    ↓
409
    ↓
fetch new document
    ↓
replay local mutations
```

But replay currently decides whether a queued operation remains valid by asking essentially:

> Does the structural mutation applier still accept this mutation?

That is weaker than:

> Does this mutation still mean what the user intended?

For example, consider a stale:

```text
workspaceSetTree
```

After another client has changed the workspace, the stale tree can still be structurally valid.

Replaying it can overwrite the other layout.

Similarly:

```text
viewConfigure
splitResize
placementReplace
```

can remain syntactically applicable while being semantically stale.

So current rebase is not a CRDT and isn't really semantic merging.

That's fine, provided its intended scope is clear:

> **The current Workbench sync is optimistic single-user/multi-client persistence, not collaborative concurrent editing.**

For stronger concurrency, mutations need preconditions or rebase policies.

For example:

```ts
rebasePolicy:
  | "replay"
  | "conditional"
  | "conflict"
```

A `workspaceSetTree` should probably conflict if the source tree changed.

A unique `viewCreate` may be freely replayable.

This can be added incrementally without adopting CRDT machinery.

---

# The Workbench should expose structural validity separately from ergonomic feasibility

There are currently two valid notions of correctness.

The protocol allows split ratios roughly in the structural range:

$$
0.05\le r\le0.95
$$

while the browser Workbench imposes stronger current-viewport constraints based on:

```text
minimum pixels
minimum fraction
divider size
```

That's correct.

I would explicitly name them:

```text
protocol validity
```

versus:

```text
layout feasibility
```

A saved layout can be structurally valid even when the current phone-sized viewport cannot render it ergonomically.

Then rebalancing is a response to lost feasibility rather than invalid data.

That is a cleaner model.

---

# A target architecture

I would aim for this:

```text
┌─────────────────────────────────────────────────┐
│              PBUI Workbench Shell               │
│                                                 │
│ React rendering · drag · focus · launcher       │
│ placement mode · dialogs · geometry measurement │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│              Workbench Runtime                  │
│                                                 │
│ session · link values · controllers             │
│ geometry snapshot · runtime revisions           │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│              Workbench Engine                   │
│                                                 │
│ queries/index                                   │
│ command planning                                │
│ app/view reuse policy                           │
│ placement semantics                             │
│ link topology                                   │
│ validation/refusals                             │
│ prepared transitions                            │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│            Workbench Protocol                   │
│                                                 │
│ WorkbenchDocument · Mutation · structural       │
│ applier · protobuf · cross-language fixtures    │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
                 persistence/sync
```

The fundamental semantic function would be:

$$
\boxed{
plan(World,Command)\rightarrow Result<PreparedTransition>
}
$$

Everything else becomes an interpreter or adapter around it.

---

# What this buys PBUI

This is not abstraction for its own sake.

It would make the Workbench usable headlessly by agents without pretending a DOM exists. It would make planning genuinely side-effect-free. It would make React one renderer rather than part of the semantic engine. It would make link runtime changes transactional with layout changes. It would give stale-plan detection actual semantics. It would remove a lot of duplicated logic among `place`, `open`, `replace`, and `link`. It would give Datalab a clean semantic Workbench to consume rather than a reason to maintain its own parallel workspace system.

And most importantly, it would make the purpose of the Workbench extremely precise:

$$
\boxed{
\text{Workbench}
=
\text{persistent spatial identity}
+
\text{application coordination}
+
\text{transactional manipulation}
}
$$

not:

$$
\text{Workbench}=\text{a collection of split-pane React components}
$$

The current implementation is already substantially more than the latter; the architecture and API should now acknowledge that.

My implementation order would be: **(1)** make `plan` genuinely pure and include runtime/session effects, **(2)** separate shell actions from Workbench commands, **(3)** extract DOM geometry behind a snapshot interface, **(4)** introduce the document index and headless planner, **(5)** consolidate view-resolution/placement-resolution internally, **(6)** split app manifests from renderers, **(7)** generalize system-document extensions, and **(8)** strengthen sync with mutation-specific rebase semantics. That sequence fixes correctness issues first and only then reorganizes the public architecture.

