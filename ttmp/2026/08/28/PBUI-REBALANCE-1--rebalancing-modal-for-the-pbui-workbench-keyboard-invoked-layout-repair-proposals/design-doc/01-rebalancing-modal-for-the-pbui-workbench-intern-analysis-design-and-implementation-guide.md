---
Title: 'Rebalancing modal for the pbui workbench: intern analysis, design, and implementation guide'
Ticket: PBUI-REBALANCE-1
Status: active
Topics:
    - pbui
    - frontend
    - design
    - architecture
    - onboarding
DocType: design-doc
Intent: long-term
Owners: []
RelatedFiles:
    - Path: repo://packages/pbui-workbench/src/apps.ts
      Note: AppDescriptor/defineApp — the rebalance-settings singleton tile contract
    - Path: repo://packages/pbui-workbench/src/verbs.ts
      Note: Verb types, DEFAULT_PANE_CONSTRAINTS, paneRatioBounds — the split-local constraint the feature supersedes
    - Path: repo://packages/workbench-protocol/src/client/builders.ts
      Note: leafNode/splitNode/resizeSplit helpers used by the adapter and structural emission
    - Path: repo://proto/hyperslop/pbui/workbench/v1/workbench.proto
      Note: Binary Split tree + mutation vocabulary; where WorkspaceSetTree would be added
    - Path: repo://src/chrome/shortcutRouting.ts
      Note: Pure shortcut router that grows a route table for Mod+Shift+K
    - Path: repo://src/components/Dialog/Dialog.tsx
      Note: Modal primitive the RebalanceDialog wraps (escape-surface rules)
ExternalSources:
    - sources/tiling-repair-textbook.md
    - sources/repair-lab-2.html
    - sources/tiling-lab-1.html
Summary: 'Complete analysis, design, and step-by-step implementation guide for adding a keyboard-invoked rebalancing modal to the pbui workbench: layout-repair algorithms from the tiling labs (propagate/ripple/project/sparse/relax/balance/reshape/rebuild), a binary-to-n-ary tree adapter over the workbench protocol, a proposal-slate dialog with SVG previews, and a settings tile for configuring algorithms and policies.'
LastUpdated: 2026-08-28T15:29:25-04:00
WhatFor: 'Onboard a new engineer onto the rebalancing-modal feature: everything needed to understand the existing workbench, the repair algorithms, the adapter between the two representations, and the implementation phases.'
WhenToUse: Read before writing any rebalance code; consult Part I for workbench APIs, Part II for algorithm math, Parts III–V for the design and the build order.
---


# Rebalancing Modal for the pbui Workbench

### Analysis · Design · Implementation Guide (written for a new engineer)

---

## How to read this document

You are going to build a feature: press a keyboard shortcut, and a modal opens showing
**proposals for reorganizing the current workspace's tiles** — each proposal visualized as a
small thumbnail of the resulting layout, ranked from least to most invasive, previewable on
hover, and applied atomically on accept. A second, smaller deliverable is a **configuration
surface** — a settings tile — where the user chooses which repair algorithms run, tunes their
parameters, and picks a policy profile.

Nothing in this feature is exotic, but it sits at the meeting point of two systems you have
to understand separately before you can join them:

1. **The pbui workbench** (Part I) — a protobuf-defined tiling document, a mutation applier,
   a verb layer, and a React rendering stack. It stores layouts as a **binary** split tree
   with one `ratio` per split.
2. **The tiling repair corpus** (Part II) — three imported artifacts in this ticket's
   `sources/` directory: an interactive tiling lab, a "repair lab" that generates and ranks
   repair proposals, and a textbook explaining nine repair algorithms over **n-ary** split
   trees with weight vectors.

Part III bridges the two representations (this is the intellectually interesting part of the
work). Part IV is the concrete feature design. Part V is the build order, phase by phase, with
tests. Part VI is pitfalls. Appendices hold API quick-references and a glossary.

File references are given relative to the pbui repository root
(`/home/manuel/workspaces/2026-08-28/add-rebalancing/pbui`). Source-material references like
"§4.2" refer to sections of `sources/tiling-repair-textbook.md` in this ticket.

**Before you read further, do these two things** (30 minutes, genuinely worth it):

- Open `sources/tiling-lab-1.html` and `sources/repair-lab-2.html` in a browser. Click
  around. In repair-lab-2, load the `FOUR DONORS` preset and hover the proposal cards. What
  you see in that strip of cards is, more or less, what you are going to put inside a pbui
  modal.
- Skim `sources/tiling-repair-textbook.md` §1 (the setup) and §12 (composition). You can
  return to the per-algorithm sections when you implement each one.

---

# Part 0 — The feature in one page

**User story.** "My workspace has degenerated: one tile is a sliver, another hogs 80% of the
screen. I press `Mod+Shift+K`. A modal opens. It shows me 4–6 cards: 'RIPPLE — move one
divider, 2 tiles change', 'PROJECT — closest feasible layout', 'BALANCE — everything equal',
'REBUILD grid — fresh layout, tiles reseated near where they were'. Each card has a colored
thumbnail of the proposed layout with ghost outlines showing where tiles are now. I hover a
card and the workspace behind the modal previews it. I press Enter; the layout changes in one
atomic step. I press `Mod+Z`-style undo (the dialog's own undo) if I hate it."

**Configuration story.** "I open the launcher (`Mod+K`), place the 'Rebalance settings' tile.
It shows: minimum tile width/height sliders, the policy profile (CAREFUL / BALANCED / TIDY /
ANYTHING), checkboxes for which generators run, and weights for how the recommendation is
scored. These persist with the product's document store."

**What this is *not*.** It is not an auto-repairing layout daemon. Per the textbook's central
design lesson (§12.2), the system **proposes, measures, and waits**; the user disposes. The
only mutation path is the user accepting a proposal, and it goes through the workbench's
existing atomic `plan`/`applyPlan` door.

**The five engineering artifacts you will produce:**

| # | Artifact | Where it lives |
|---|---|---|
| 1 | `rebalance/` pure-logic module: adapter, propagation, strategies, slate | `packages/pbui-workbench/src/rebalance/` |
| 2 | `RebalanceDialog` React component + SVG thumbnails | `packages/pbui-workbench/src/components/RebalanceDialog/` |
| 3 | Shortcut routing growth: `Mod+K` table gains a second entry | `src/chrome/shortcutRouting.ts` |
| 4 | `rebalance-settings` app (a tile) + config persistence | `packages/pbui-workbench/src/rebalance/settingsApp.tsx` |
| 5 | (Phase 4, optional-but-designed) `WorkspaceSetTree` mutation | `proto/hyperslop/pbui/workbench/v1/workbench.proto`, TS + Go appliers |

---

# Part I — The pbui workbench as it exists today

pbui is a monorepo: a core presentation library in `src/`, and packages under `packages/`.
The one you will live in is **`packages/pbui-workbench`** — the tiling window-manager layer —
plus its protocol sibling **`packages/workbench-protocol`** and the shared chrome kit in
**`src/chrome/`**.

## 1.1 The document model: a protobuf binary split tree

The layout is not React state. It is a **protobuf document**, defined in
`proto/hyperslop/pbui/workbench/v1/workbench.proto`, generated into TypeScript at
`packages/workbench-protocol/src/generated/` and consumed through
`@hyperslop-systems/workbench-protocol`. The shapes that matter:

```protobuf
message Workspace {
  string id = 1;
  string name = 2;
  Node tree = 3;              // the placement tree
}

message Node {
  string id = 1;              // "placement id" — stable, survives resize
  oneof body {
    Leaf leaf = 2;            // Leaf { string view_id = 1; }
    Split split = 3;
  }
}

message Split {
  Direction direction = 1;    // DIRECTION_ROW (side by side) | DIRECTION_COLUMN (stacked)
  double ratio = 2;           // share of child `a`; child `b` gets 1 - ratio
  Node a = 3;
  Node b = 4;
}

message AppView {
  string id = 1;              // logical view; a view can be placed in >1 tile ("linked")
  string app_id = 2;
  map<string, string> documents = 3;   // document bindings
  optional string title = 4;
}
```

Read that `Split` message twice, because it determines a third of your work:

- **Binary.** Every split has exactly two children, `a` and `b`. A row of four tiles is a
  *chain* of three nested `Split` nodes, all `DIRECTION_ROW`.
- **One ratio.** `ratio` is the fraction given to `a`. There is no weight vector.
- **Ids are placement ids.** `Node.id` is what verbs target (`tile.close`, `split.resize`),
  what drag registries key on, and what focus restoration looks up. Your adapter must
  preserve them.

Contrast with the labs' n-ary representation (Part II). The textbook §1.1 argues n-ary is the
right *analysis* representation ("make the third pane wider" is well-posed). pbui's protocol
is binary because it is the right *mutation* representation (every split is addressable, every
drag touches one ratio). You will convert between them (Part III) rather than change either.

**A tile vs. a view vs. a placement.** Vocabulary you must keep straight (the codebase does):

- A **view** (`AppView`) is a logical instance of an application, possibly bound to documents.
- A **placement** is a leaf `Node` in some workspace tree — "this view, at this spot."
  One view may have several placements ("linked" tiles rendering the same object).
- A **tile** is the rendered placement: chrome frame + the app's component.

## 1.2 Mutations and the applier (two implementations, one contract)

All document change flows through `Mutation` messages, applied atomically in batches:

```protobuf
message Mutation {
  oneof body {
    WorkbenchRename workbench_rename = 1;
    WorkspaceCreate workspace_create = 2;    // { workspace_id, name, root_placement: Node }
    WorkspaceRename workspace_rename = 3;
    WorkspaceDelete workspace_delete = 4;
    DocumentPut document_put = 5;            // { DocumentPayload document }
    DocumentDelete document_delete = 6;
    ViewCreate view_create = 7;
    ViewConfigure view_configure = 8;
    ViewClone view_clone = 9;
    ViewDelete view_delete = 10;
    ViewClose view_close = 11;
    PlacementReplace placement_replace = 12;
    PlacementSplit placement_split = 13;     // split a leaf: direction, ratio, position
    PlacementClose placement_close = 14;
    SplitResize split_resize = 15;           // { workspace_id?, split_id, ratio }
  }
}
```

Two appliers exist and are kept in lock-step:

- **TypeScript**: `packages/workbench-protocol/src/client/apply.ts` (`applyMutations`,
  `MutationError` with `code`/`path`/`detail`).
- **Go**: `pkg/workbench/` (`mutation.go`, `validate.go`, `model.go`).

The lock-step is *tested*: `packages/workbench-protocol/src/client/applierParity.test.ts` and
`pkg/workbench/parity_fixtures_test.go` run shared fixtures through both. **If you add a
mutation (Phase 4's `WorkspaceSetTree`), you owe: proto change → `buf generate` → TS applier →
Go applier → parity fixtures.** Budget a day for that loop the first time.

Note what is **absent** from the mutation vocabulary: there is no "replace a workspace's whole
tree" mutation. Weight-only repairs decompose beautifully into `split_resize` batches
(§3.3), but structural repairs (RESHAPE/REBUILD tiers) do not decompose nicely into
`placement_*` mutations — that gap is a design decision you'll face in §3.4.

## 1.3 The verb layer, and `plan`/`applyPlan` — your application door

Products do not build mutations by hand. They speak **verbs** — plain data objects defined in
`packages/pbui-workbench/src/verbs.ts`:

```ts
export type WorkbenchVerb =
  | { kind: "tile.split"; placementId: string; direction: SplitDirection; appId?: string }
  | { kind: "tile.close"; placementId: string }
  | { kind: "tile.swap"; a: string; b: string }
  | { kind: "tile.dock"; source: string; target: string; zone: DockZone }
  | { kind: "tile.activate"; placementId: string }
  | { kind: "split.resize"; splitId: string; ratio: number }
  | { kind: "app.place"; appId: string; from?: string }
  | { kind: "view.open"; appId: string; documents: Record<string,string>; near?: string; title?: string }
  | { kind: "workspace.create"; name: string; spec?: LayoutSpec; workspaceId?: string; select?: boolean }
  // ... rename/delete/clone workspace, view.goTo, launcher.open/close, etc.
```

The `Workbench` object (`packages/pbui-workbench/src/types.ts`) exposes the doors:

```ts
interface Workbench {
  perform(verb: WorkbenchVerb): boolean;              // one verb, now
  mutate(mutations: Mutation[]): boolean;             // raw batch (rare)
  plan(verbs: readonly WorkbenchVerb[]): WorkbenchPlanResult;   // ← preflight
  applyPlan(plan: WorkbenchPlan): boolean;            // ← atomic commit
  useDocument(): WorkbenchDocument;
  useWorkbenchState<T>(sel: (s: WorkbenchState) => T): T;
  activePlacementId(): string | null;
  focusTile(placementId: string): void;
  // ...
}
```

**`plan()` is the single most important existing API for this feature.** It runs a verb
sequence against a *shadow store* without touching the real document, and returns either
`{ ok: true, plan }` — where `plan.mutations` is one atomic batch and `plan.baseDocument` is
the exact document it was derived from — or `{ ok: false, index, verb, error }` telling you
which verb refused and why. This is precisely the shape a proposal needs:

```
proposal = a verb list        →  plan(verbs)  →  preview plan's resulting tree
user accepts                  →  applyPlan(plan)  →  one atomic commit, or a clean refusal
                                                     if the document moved underneath
```

You get preflight validation, atomicity, and stale-document detection for free. Do not invent
a second application path.

## 1.4 Rendering: `Surface` → `SplitPane` → `Tile`

`packages/pbui-workbench/src/components/`:

- **`Surface/Surface.tsx`** renders the active workspace's tree recursively and registers the
  root element on the workbench (`wb.root()` / `wb.setRoot`).
- **`SplitPane/SplitPane.tsx`** renders one `Split` as a CSS grid "whose tracks ARE the
  ratio". Divider drags hold a *live* ratio in component state and **commit one
  `split.resize` on pointer-up**, snapped by `snapRatio` to the family's shared fractions
  (`packages/workbench-protocol/src/client/ratios.ts`: `[0.25, 1/3, 0.5, 2/3, 0.75]`,
  tolerance `0.022`). Note: snapping happens **only in the drag path**; a `split.resize` verb
  you issue programmatically is applied verbatim. Your repair ratios will not be corrupted by
  snapping.
- **`Tile/Tile.tsx`** wraps the app component in the shared `TileFrame` chrome.

Geometry: the DOM is the source of truth for pixel sizes. `SplitPane` measures its container
with `getBoundingClientRect()` + a `ResizeObserver`, and `verbs.ratioBounds(splitId)` (in
`packages/pbui-workbench/src/verbs.ts`/`actions.ts`) converts the rendered size plus the
divider's real thickness into `{min, max}` ratio clamps. Constant worth knowing:
`DEFAULT_DIVIDER_PX = 10` — the divider is a real track that consumes pixels, exactly like the
labs' `gap` (§1.2 of the textbook: "avail is the extent minus the gaps").

## 1.5 Constraints that already exist

`packages/pbui-workbench/src/verbs.ts`:

```ts
export interface PaneConstraints {
  minInlinePx: number;   // min width of either child in a row split
  minBlockPx: number;    // min height of either child in a column split
  minFraction: number;   // headless/relative floor when geometry is unavailable
}
export const DEFAULT_PANE_CONSTRAINTS: PaneConstraints = {
  minInlinePx: 240, minBlockPx: 160, minFraction: 0.1,
};

export function paneRatioBounds(size: number | null, minPx: number, minFraction: number)
  : { min: number; max: number } | null
```

Recognize this? It is the textbook's **§1.3 mistake, institutionalized**: a *split-local*
floor. `paneRatioBounds` clamps one divider so neither *direct child* goes under 240×160 px —
but sizes multiply down the tree, so a 240-px-wide subtree that itself contains a row of three
tiles has 240 px split three ways, and no local clamp ever notices. That is exactly the
`COMPOUND` failure the textbook opens with, and it is the reason this feature exists: pbui
today can *prevent one divider* from being dragged too far, but it cannot *detect* — let alone
repair — a globally starved layout. Your `propagate()` (Part II §2.3) is the missing
measurement, and `DEFAULT_PANE_CONSTRAINTS.minInlinePx/minBlockPx` are the natural default
values for the repair config's `minW`/`minH`.

## 1.6 Chrome: TileFrame, drag/dock, launcher, and — importantly — shortcut routing

`src/chrome/` is the family window-chrome kit (PBUI-UNIFY-001), deliberately
document-model-agnostic:

- `TileFrame.tsx` — title bar, ⠿ drag grip, split ⬌/⬍ and ✕ buttons, and `DropZoneOverlay`
  which *names the outcome before release* ("⇄ swap applications" / "split-dock here").
  Design value to copy: **label consequences before the user commits.** Your modal's cards
  should say "2 of 5 tiles move, 260 px" *on the card*, not after acceptance.
- `useTileDrag.ts` — pointer machinery, `zoneFor` (the center/edge hit test — same triangular
  scheme as the labs' `hitTest`).
- `LauncherShell.tsx` — the Mod+K launcher shell.
- **`shortcutRouting.ts`** — read this file's header comment now; it is load-bearing for you:

  > *"A pure function and one hard-coded action, not a command registry […] The first
  > shortcut system needs exactly one behaviour — open the launcher […] **A route table earns
  > its place when a second or third shortcut exists.**"*

  You are the second shortcut. The file anticipates you. `routeWorkbenchKey(event, context,
  platform)` currently returns `{kind:"ignore"} | {kind:"open-launcher"}`; you will grow the
  decision union and introduce the small route table the comment promises (§4.4). The
  `ShortcutContext` fields (`targetIsEditable`, `launcherOpen`, `dialogOpen`,
  `objectMenuOpen`, `acceptingPresentation`, `renamingView`) all apply verbatim to your
  shortcut, for the same reasons documented there — especially `renamingView`, which blocks
  because focus restoration cannot survive an `InlineRename`.

## 1.7 Dialogs and the escape-surface stack

You will build the modal from the existing primitives — do not hand-roll:

- **`src/components/Dialog/Dialog.tsx`** — a "non-destructive modal surface whose inert
  backdrop never dismisses user-entered content." Gives you: focus capture and queued focus
  return (`src/focus.ts`), initial-focus targeting into `[data-part="dialog-body"]`, and
  Escape handling that consults the surface stack.
- **`src/surfaces.ts`** — the escape-surface stack: module-level `pushEscapeSurface` /
  `popEscapeSurface` / `topEscapeSurface`, plus the `useEscapeSurface(true)` hook. Rule that
  will bite you if ignored (it is bolded in the source): **one surface, one registration** —
  `Dialog` registers itself; your `RebalanceDialog` wrapping a `Dialog` must NOT register
  again, or the Dialog stops believing it is topmost and Escape dies.
- `escapeSurfaceCount()` is how `shortcutContext().dialogOpen` gets answered — your modal
  being open automatically suppresses Mod+K, and vice versa, with zero new wiring.

## 1.8 Applications: `AppDescriptor` and the settings-tile pattern

`packages/pbui-workbench/src/apps.ts` — an application is data plus one component:

```ts
interface AppDescriptor {
  id: string;
  title: string;
  tone: string;              // CSS custom-property reference, e.g. "var(--pbui-tone-chat)"
  singleton: boolean;        // at most one logical view? (true for pure-function-of-state apps)
  duplicable?: boolean;      // may split duplicate it? default !singleton
  group?: string;            // launcher group
  blurb?: string;            // one launcher line
  available?(ctx: AppAvailability): boolean;
  Component: ComponentType<AppProps>;   // receives { placementId, view }
}
```

Your **`rebalance-settings` tile** is exactly this: `singleton: true` (it is a pure function
of shared config state — a second one renders the same pixels), a launcher `group` of
"WORKBENCH", and a component that reads/writes the rebalance config (§4.5). The launcher
offers a placed singleton as "go to" — all free.

For persistence, note `DocumentPayload` + the `document_put` mutation (§1.2): the workbench
document itself can carry arbitrary versioned JSON bodies
(`{ id, format, schema_version, body: Struct }`). The config rides in the document as
`format: "pbui.rebalance-config"` — it serializes, restores, and syncs wherever the document
does, with no second persistence mechanism (§4.5).

## 1.9 File map — where everything in Part I lives

| Concern | File |
|---|---|
| Protocol schema | `proto/hyperslop/pbui/workbench/v1/workbench.proto` |
| Generated TS types | `packages/workbench-protocol/src/generated/` |
| TS applier | `packages/workbench-protocol/src/client/apply.ts` |
| Tree builders/queries (`leafNode`, `splitNode`, `findNode`, `leaves`, `dockPlacement`, `resizeSplit`, …) | `packages/workbench-protocol/src/client/builders.ts` |
| Snap ratios | `packages/workbench-protocol/src/client/ratios.ts` |
| Go applier + validation | `pkg/workbench/{mutation,validate,model}.go` |
| Applier parity tests | `packages/workbench-protocol/src/client/applierParity.test.ts`, `pkg/workbench/parity_fixtures_test.go` |
| Verbs, constraints, `paneRatioBounds` | `packages/pbui-workbench/src/verbs.ts` |
| Verb handlers / plan machinery | `packages/pbui-workbench/src/actions.ts` |
| Store (`WorkbenchState`, `useSyncExternalStore`) | `packages/pbui-workbench/src/store.ts` |
| Workbench factory + context | `packages/pbui-workbench/src/createWorkbench.tsx`, `context.tsx` |
| Declarative layouts (`tile()`, `split()`, `buildLayout`) | `packages/pbui-workbench/src/document.ts` |
| Surface / SplitPane / Tile / Launcher / WorkspaceStrip | `packages/pbui-workbench/src/components/…` |
| App registry | `packages/pbui-workbench/src/apps.ts` |
| Agent-facing description | `packages/pbui-workbench/src/describe.ts` (`describeWorkbench`) |
| Chrome kit (TileFrame, useTileDrag, LauncherShell, shortcutRouting) | `src/chrome/` |
| Dialog + escape surfaces + focus | `src/components/Dialog/Dialog.tsx`, `src/surfaces.ts`, `src/focus.ts` |

---

# Part II — The source material: what the labs and the textbook give you

Three artifacts are imported into this ticket's `sources/` directory. They are prototypes and
a book about them — **reference implementations to port from, not code to import**. They are
DOM-coupled, mutable-global, plain-JS; your port is pure TypeScript in
`packages/pbui-workbench/src/rebalance/`.

- **`tiling-lab-1.html`** — "TILING LAB · system 1." An n-ary split-tree window manager:
  axis-sensitive insertion, multiplicative normalization, pair-preserving divider resize,
  tree-topological WASD navigation, clone→insert→remove redocking, stacks, and eight
  auto-layout generators. Read it for the *data model and the generators*.
- **`repair-lab-2.html`** — "REPAIR LAB 2 · proposals." The direct ancestor of your feature:
  the same tree model plus minimum-size propagation, five weight-repair strategies, tree
  mutation search, regeneration with Hungarian assignment, stack folding, invasiveness
  tiers, policy profiles, and **the proposal slate UI** (cards, hover-preview, accept/undo).
  Read it for *everything*; you will port most of its `<script>`'s first half nearly
  line-for-line.
- **`tiling-repair-textbook.md`** — "Repairing a Tiling Layout: a study of
  minimum-perturbation algorithms over n-ary split trees." The why behind every line of
  repair-lab-2, with worked numeric examples you will reuse as test fixtures.

## 2.1 The n-ary analysis model

```js
{t:'p', id, name}                  // pane: a window, always a leaf
{t:'s', id, axis:'h'|'v', ch, w}   // split: n children, n weights, Σw = 1
{t:'k', id, ch, active}            // stack: n children sharing one rectangle (tabs)
```

Invariants: a split's weights sum to 1; weights are **fractions of the parent's available
space** (extent minus gaps), not pixels; `normalize()` flattens same-axis nesting
(`Row⊂Row`) by multiplying weights through, and collapses single-child nodes.

pbui has **no stack node** — there is no tabbed-tile construct in the workbench protocol.
Consequences in §3.5.

## 2.2 Layout: tree → rectangles

```js
function layoutTree(node, r, out, gap){
  out[node.id] = {...r};
  if(!node.ch) return out;
  const horiz = node.axis==='h';
  const avail = (horiz ? r.w : r.h) - gap*(node.ch.length-1);
  let pos = horiz ? r.x : r.y;
  node.ch.forEach((c,i)=>{
    const sz = node.w[i]*avail;
    layoutTree(c, horiz ? {x:pos,y:r.y,w:sz,h:r.h} : {x:r.x,y:pos,w:r.w,h:sz}, out, gap);
    pos += sz + gap;
  });
  return out;
}
```

Two properties drive everything (textbook §1.2): **(a)** weights apply to `avail`, not the raw
rect, so pixel constraints must be converted against `avail`; **(b)** position accumulates, so
changing `w[0]` moves every later child — displacement is not proportional to weights changed.

## 2.3 `propagate` — minimum-size propagation (the keystone; implement first)

The problem: a per-split floor (pbui's `minFraction`, the old lab's `minW=0.10`) cannot
protect pane size because **sizes multiply down the tree** (§1.3: weights 0.2 × 0.15 × 0.3 =
0.9% of the screen, every individual weight looking healthy). The real constraint — a pixel
floor on each rendered pane — is non-local. Propagation makes it local:

```
req(pane)          = (minW, minH)
req(Row of q1..qn) = ( Σ qi.w + (n-1)·gap ,  max qi.h )
req(Col of q1..qn) = ( max qi.w           ,  Σ qi.h + (n-1)·gap )
req(Stack m1..mk)  = ( max mi.w           ,  max mi.h + tabH )      // n/a in pbui
```

**Sum along the split axis, max across it.** One bottom-up memoized pass, O(n), ~0.006 ms for
eight panes. It yields three feasibility questions you must keep distinct (§1.5):

| Scale | Question | Test |
|---|---|---|
| Split-local | Can this split fix its children by moving weights? | `Σ lowerᵢ ≤ avail` |
| Subtree | Does this subtree get enough room from its parent? | `req(node) ≤ rect(node)` |
| Global | Can *any* weights satisfy every pane? | `req(root) ≤ screen` |

If the global test fails, **no weight algorithm can succeed** and only structural change
(reshape/rebuild) or hiding panes can help. The proposal slate uses this to decide which
cards can possibly show "all fit."

## 2.4 `repairPass` — one top-down pass, strategies as generators

```js
function* repairPass(root, rect, cfg, strat, ctx){
  const memo = {};
  const need = propagate(root, cfg, memo);
  if(need.w > rect.w+0.5 || need.h > rect.h+0.5) ctx.globalInfeasible = true;
  yield* rec(root, rect, 0);

  function* rec(n, r, d){
    if(n is pane) return;
    const avail = extent(r, n.axis) - gap*(n.ch.length-1);
    const lower = n.ch.map(c => min(memo[c.id][n.axis], avail));   // px lower bounds
    const short = deficits beyond 0.5 + cfg.hyst;
    if(short.length || strat.always) n.w = yield* strat(n, avail, lower, cfg, ctx);
    for each child i, with the CORRECTED rect:  yield* rec(n.ch[i], childRect, d+1);
  }
}
```

Why one pass suffices for both axes (§1.6): propagation already crossed the axes — a Row
reports a height requirement (max of children); its parent Col satisfies that height *before*
recursing; by the time the Row runs, its cross axis is already right. And children are visited
*after* the parent's weights are corrected, so each level sees fresh rectangles — no fixpoint
iteration.

**Hysteresis** (`cfg.hyst`) lives only in the *trigger* (`deficit > 0.5 + hyst`), never the
*target* (repair goes to the full requirement). That asymmetry prevents repair loops on
one-pixel window resizes.

**Why generators.** Every algorithm is a `function*` yielding log records and returning
weights. One implementation serves four modes: run-to-completion (slate building),
single-step (the lab's STEP button / your trace panel), animation, and batch evaluation.
Port this style — TypeScript generators are fine, and the trace is your debugging lifeline.

## 2.5 The five weight strategies

All share the per-split signature
`strat(node, availPx, lowerPx[], cfg, ctx) → newWeights[]`.

### RIPPLE — local sibling borrowing (§4). *The default.*
What a human does: drag the divider next to the starved pane. For each deficit (largest
first), rank donors by distance `|j−i|`, take `min(want, slack)` from each until covered; if
donors run dry, mark local-infeasible and let the ancestor's aggregate satisfaction handle it
(escalation *is* the recursion — see the `COMPOUND` trace in §4.2: three borrowings at three
depths, root satisfying the Col's aggregate 175 px without knowing pane D exists).
`donorOrder`: `near` (fewest dividers move) | `left` | `slack` (richest pays). O(k log k)
typical; 0.12 ms on 8 panes. Fails: greedy, order-dependent, no backtracking.

### SPARSE — fewest donors (§6).
Same as RIPPLE but prefers **one donor who can pay in full** (nearest such), falling back to
largest-slack-first. Minimizes *how many* panes change size (an L0 instinct). Cheapest
(0.086 ms). Often identical to RIPPLE → the slate merges them.

### PROJECT — constrained L2 projection (§5). *The mathematically principled one.*

```
minimize ‖w′ − w‖²   s.t.  Σw′ᵢ = 1,  w′ᵢ ≥ lᵢ
```

KKT gives a one-parameter family `w′ᵢ = max(lᵢ, wᵢ + θ)`; `Σ max(lᵢ, wᵢ+θ)` is monotone in θ,
so bisect (80 iterations, branch-free):

```ts
function projectLower(w: number[], l: number[]): number[] {
  const sl = sum(l);
  if (sl >= 1 - 1e-9) return l.map(x => x / sl);   // infeasible: proportional best effort
  let lo = -1, hi = 1;
  const F = (th: number) => sum(w.map((x,i) => Math.max(l[i], x + th))) - 1;
  for (let k = 0; k < 80; k++) { const mid = (lo+hi)/2; F(mid) > 0 ? hi = mid : lo = mid; }
  const out = w.map((x,i) => Math.max(l[i], x + (lo+hi)/2));
  const s = sum(out); return out.map(x => x / s);
}
```

Verification vector (§5.2) — **make this a unit test verbatim**:
`projectLower([.5,.3,.2],[.25,.35,.10]) → [.4750,.3500,.1750]`.

Deterministic, order-independent, reused as the projection step by RELAX and as the settler
for RESHAPE. Its perceptual flaw (§5.3): L2 spreads a correction over *every* free
coordinate — on `FOUR DONORS`, PROJECT moves 4 panes / 341 px where RIPPLE moves 2 / 256 px.
The user's metric is closer to L0. That mismatch is why both exist.

### RELAX — projected gradient on a displacement energy (§7).
Optimizes *rectangles* (what users see), not weights:
`E(w) = Σ α(cᵢ−cᵢ⁰)² + β(wᵢ−wᵢ⁰)² + γ(log aspectᵢ − log A*)²/100`, with centers coupled
through the cumulative sum (so it naturally taxes panes near the damage). Solver: start from
`projectLower`, finite-difference gradient, **subtract the gradient mean** (stay on the Σw=1
plane), step, re-project; ~60 iterations. The only strategy with `always = true` alongside
BALANCE: with γ>0 it changes *healthy* splits (aspect tidying) — a feature for an explicit
"tidy" action, a hazard for anything automatic. Most expensive weight strategy (3.6 ms).
**Port it last of the five; it is optional for v1.**

### BALANCE — every split to 1/n (§8). *The baseline, and a user command — never a repair.*
`wᵢ = 1/n` everywhere, then `projectLower` if 1/n itself violates floors. On `FOUR DONORS` it
moves every pane (629 px) to fix an 85 px deficit. Keep it in the slate as the legible control
and as the explicit "make everything even" command users genuinely want. The textbook's §12.4
closing warning: **conflating Balance with Repair is why balance "ruins your layout."** Two
verbs, two labels.

## 2.6 Structural repair: RESHAPE, REBUILD, FOLD

When `req(root) > screen`, weights are provably useless; the tree must change.

### RESHAPE — greedy hill-climb over local tree mutations (§9)
Mutation set per split: `transpose` (Row↔Col), `rotate`, `reverse`, adjacent `swap`, and the
one that matters — **`regroup`**: wrap k consecutive children in a *perpendicular* sub-split,
turning an impossible strip into a feasible grid (a Col-of-6 needing 820 px becomes Col-of-5
needing 690 after regrouping two children into a Row). Each candidate is **settled with a
weight repair before scoring** (the single most important detail — unsettled candidates look
bad for irrelevant reasons), scored by
`wViol·violations + wDeficit·px/100 + wAspect·Σlog² + wMove·disp/1000`, best accepted if it
beats `minGain`, up to `maxMoves` rounds. Displacement is always measured against the
*original* layout. Cost O(rounds·candidates·n), 3.7 ms at 8 panes.

### REBUILD — regenerate + minimum-cost seating (§10)
Generate a fresh tree from a target shape (grid / master / columns / rows / bsp / dwindle —
the generators are in both labs, `TARGETS`/`BUILDERS`), then seat existing panes into slots by
the **Hungarian algorithm** (O(n³), potentials form; sanity fixture in §10.2:
`[[4,1,3],[2,0,5],[3,2,2]] → assignment [1,0,2], total 5`) over
`cost(i,j) = ‖Δcenter‖₂ + sizeCost·(|Δw|+|Δh|)`. Seating is where disruption is decided;
DFS-order seating scatters identity. Key diagnostic (§10.3): generators **do not consult
constraints** — a rebuilt master can be exactly as broken as the input; measure the result and
grey out "makes it worse."

### FOLD — surplus panes into tabbed stacks (§11)
Capacity `floor((w+gap)/(minW+gap)) × floor((h+gap)/(minH+tabH+gap))`; group panes into that
many stacks. The only guaranteed-success repair and the only one that changes the *visible*
set. **pbui has no stacks — see §3.5 for the adaptation.**

## 2.7 Measuring and classifying change (§1.8–1.9)

Per pane, matched by identity: `d = |Δcx| + |Δcy| + |Δw| + |Δh|`. Report four numbers — panes
moved (`d>1` count), Σ displacement, largest single move, dividers moved — because no single
scalar distinguishes "everything drifted" from "one window teleported."

Then classify each result into a **tier, measured from the result, never claimed by the
algorithm** (a REBUILD that lands on the same shape is reported as the weight change it turned
out to be):

| Tier | Chip | Meaning | Detection |
|---|---|---|---|
| 0 | — | nothing changed | moved == 0 |
| 1 | W1 | ≤2 dividers moved | ordered signature equal, dividerDiff ≤ 2 |
| 2 | W+ | many dividers | ordered signature equal |
| 3 | ORD | children reordered | unordered signature equal |
| 4 | STR | structure changed | else, kind ≠ rebuild |
| 5 | NEW | rebuilt | else, kind == rebuild |
| 6 | TAB | visible set changed | visible-leaf sets differ |

`sig(node, ordered)` serializes the tree with child lists sorted or not; `dividerDiff`
compares cumulative weight boundaries with tolerance 0.004.

## 2.8 The proposal slate (§12.2) — the product design you are porting

The lab **runs every enabled generator, measures each, and offers all of them** rather than
picking. Three mechanisms make the slate usable; port all three:

1. **Deduplication by geometry.** Key = rounded rects of visible panes. Identical outcomes
   merge into one card ("+3 agree"), *seeded from the do-nothing baseline* so "RIPPLE had no
   effect" reads as agreement with LEAVE AS IS rather than vanishing.
2. **Policy gating.** A profile declares allowed tiers and budgets; out-of-policy proposals
   stay **visible but greyed, with the reason attached** ("outside policy: rebuilds the
   layout") — hiding them would make the system's restraint unexplainable.

   | Profile | Allows | Budget | w.move / w.struct / w.aspect |
   |---|---|---|---|
   | CAREFUL | weights only | ≤2600 px | 1.6 / 6.0 / 0.1 |
   | BALANCED | + reorder, reshape, fold | ∞ | 1.0 / 3.0 / 0.2 |
   | TIDY | everything | ∞ | 0.25 / 0.3 / 1.6 |
   | ANYTHING | everything | ∞ | 1.0 / 1.0 / 0.6 |

3. **One recommendation.** Among in-policy proposals achieving the minimum violation count:
   `polScore = w.move·disp/1000 + w.struct·tier + w.aspect·log(worstAspect) + 12·viol`;
   lowest wins the PICK badge. The *measured tier* entering the score is what makes CAREFUL
   prefer a mediocre weight repair over an excellent restructuring without any algorithm
   knowing policies exist.

Also port the escalation dogma (§12.1): order by **invasiveness, not power** — and "do
nothing" must be a first-class, zero-cost outcome ("a repair system that rebalances a healthy
desktop is worse than no repair system", §2.1).

## 2.9 What transfers, what doesn't

| Lab concept | pbui fate |
|---|---|
| n-ary tree, `normalize` | Analysis-side only; produced by the adapter (§3.2) |
| `layoutTree`, `propagate`, `violations` | Port ~verbatim (pure functions) |
| RIPPLE / SPARSE / PROJECT / BALANCE | Port verbatim (v1) |
| RELAX | Port in v2; needs cross-axis extent plumbing (`ctx.cross`) |
| RESHAPE, REBUILD + Hungarian | Port in Phase 4, gated on the structural-apply decision (§3.4) |
| FOLD, stacks, `tabH` | **No stack node in pbui.** Adapt: "fold" → move surplus tiles to a new workspace (§3.5), or omit in v1 |
| Tiers/classify/dedup/policy/slate | Port verbatim (pure) |
| Monocle / autolayout keep-mode | Out of scope |
| Lab's DOM rendering, drag code | Not ported — pbui has its own (Surface/SplitPane/useTileDrag) |
| `gap` | pbui's divider track (`DEFAULT_DIVIDER_PX = 10`) |
| `minW`/`minH` (190×130 reference) | `PaneConstraints.minInlinePx/minBlockPx` (240×160 defaults) |
| Identity colors (PALETTE, `colorOf`) | Port — pbui tiles have `tone`, but proposal thumbnails need per-tile identity hues; derive from placement id hash or reuse app tones |

---

# Part III — The adapter: binary ratio tree ⇄ n-ary weight tree

This is the part with no prior art in either codebase. Take it slowly; everything else is
porting and React.

## 3.1 The gap, precisely

The same visual layout, two encodings:

```
  Visual                pbui protocol (binary)                 analysis (n-ary)

┌────┬────┬────┐        Split#s1 ROW ratio=1/3                 Row#s1 w=[1/3, 1/3, 1/3]
│ A  │ B  │ C  │        ├─ a: Leaf A                           ├─ A
└────┴────┴────┘        └─ b: Split#s2 ROW ratio=1/2           ├─ B      chain: [s1, s2]
                            ├─ a: Leaf B                       └─ C
                            └─ b: Leaf C
```

The binary chain `s1(1/3) → s2(1/2)` and the weight vector `[1/3, 1/3, 1/3]` describe the same
rectangles. The n-ary form is where the algorithms are well-posed (§1.1 of the textbook); the
binary form is where mutations are addressable (`split.resize s2 0.5`). The adapter must
convert **losslessly in both directions, with provenance** — because a repaired weight vector
must come back as `split.resize` verbs against the *original* split ids.

One real leak in the analogy: the labs' `gap` is uniform, but a flattened binary chain of
k+1 children contains k dividers **at chain-internal positions determined by the chain shape**
(a left-leaning chain puts them elsewhere than a right-leaning one — but since every adjacent
pair of children in the flattened order is separated by exactly one divider regardless of
chain shape, `avail = extent − k·dividerPx` holds exactly. Convince yourself of this with a
drawing before trusting it; it is true because the chain is a full binary tree over an ordered
partition, and an ordered partition of k+1 segments has exactly k cuts).

## 3.2 `toAnalysis`: flatten with provenance

```ts
// rebalance/analysisTree.ts

export type AnalysisNode = APane | ASplit;

export interface APane {
  t: "p";
  id: string;                 // = protocol placement id (Leaf Node.id)
  viewId: string;
  name: string;               // resolved tile label, for traces & thumbnails
}

export interface ASplit {
  t: "s";
  id: string;                 // = id of the TOPMOST protocol split of the chain
  axis: "h" | "v";            // ROW → 'h', COLUMN → 'v'
  ch: AnalysisNode[];
  w: number[];                // Σ = 1
  chain: ChainStep[];         // provenance: how to write weights back
}

/**
 * One protocol Split consumed while flattening this n-ary split.
 * `leftCount` = how many of the n-ary children fall under this split's `a`
 * subtree — the reverse mapping needs exactly this number and nothing else.
 */
export interface ChainStep { splitId: string; leftCount: number; }
```

Flattening is the labs' `normalize`, specialized: descend while
`child.direction === parent.direction`, multiplying ratios through:

```
flatten(Node n) → (children: AnalysisNode[], weights: number[], chain: ChainStep[]):
  if n is Leaf:  return ([pane(n)], [1], [])
  if n is Split with direction d:
    (chA, wA) = if n.a is Split with direction d then flatten(n.a) else ([convert(n.a)], [1])
    (chB, wB) = likewise for n.b
    children = chA ++ chB
    weights  = wA.map(x => x * n.ratio) ++ wB.map(x => x * (1 - n.ratio))
    chain    = [{splitId: n.id, leftCount: chA.length}] ++ chainA ++ chainB
    return (children, weights, chain)
```

A child whose direction *differs* is converted recursively into its own `ASplit` (perpendicular
splits never flatten — same as `normalize`'s axis check). Every weight vector sums to 1 by
construction (each level multiplies a partition of 1 by `r` and `1−r`).

**Property test** (Phase 1): for random protocol trees, `layoutAnalysis(toAnalysis(tree))`
rectangles == rectangles computed directly from the binary tree by SplitPane's math
(ratio · (extent − dividerPx)), within 0.5 px.

## 3.3 `fromWeights`: weights → `split.resize` batch (tiers 1–2)

Given an `ASplit` with repaired weights `w′` and its `chain`, recover each protocol split's
new ratio. The recursion mirrors flattening — a split's ratio is *the weight-mass of its `a`
subtree relative to the mass it governs*:

```
writeBack(step list, weights):
  head = first ChainStep            // topmost split of this chain
  L = weights[0 .. head.leftCount)  // masses under `a`
  R = weights[head.leftCount ..]    // masses under `b`
  ratio(head.splitId) = Σ L / (Σ L + Σ R)          // denominator is 1 at the top
  recurse into the sub-chains that flattened `a` and `b`,
    with weights L / ΣL and R / ΣR renormalized
```

For the worked example above: repaired weights `[.5, .25, .25]` give
`s1.ratio = .5`, then the b-chain `[.25,.25]` renormalizes to `[.5,.5]` giving `s2.ratio = .5`.
Emit one verb per split whose ratio moved beyond epsilon:

```ts
const verbs: WorkbenchVerb[] = changedSplits.map(({splitId, ratio}) =>
  ({ kind: "split.resize", splitId, ratio }));
const result = workbench.plan(verbs);      // → one atomic mutation batch
```

Properties worth writing down as tests:

- **Round-trip**: `fromWeights(toAnalysis(t).w) over t` produces ratios equal to the originals
  when weights are unchanged (no spurious resizes; epsilon ≈ 1e-6).
- **Exactness**: pixel error between "n-ary weights × avail" and "nested binary ratios ×
  per-level avail" — these are *not* algebraically identical, because each binary level
  subtracts its own divider before applying its ratio, while the n-ary form subtracts all k
  dividers up front. For dividerPx=10 and realistic sizes the discrepancy is sub-pixel per
  level; measure it in the property test, assert < 1 px per pane at realistic sizes, and note
  it in the module docs. (If it ever matters, `fromWeights` can solve per-level in pixels
  instead of mass fractions: compute each child's target *pixel* extent from the weights, then
  derive each binary ratio against that level's own `avail`. This is the more exact form —
  prefer it if the property test complains.)

**The clamp interaction.** `verbs.resize` clamps against `ratioBounds` (min-fraction / min-px
floors). A repair targeting exactly the pixel floor may collide with the clamp's own idea of
the floor (240 px on the *direct children*, which for a subtree child is a different quantity
than your propagated bound). Two options: (a) route proposals through `plan` with a
`skipRatioClamp` flag threaded into the resize handler — dangerous, wide blast radius; or
(b) keep the clamp and accept that a proposal's applied result can differ from its preview by
a clamped hair, then *re-measure after apply* and log if it happened. **Choose (b) for v1**;
revisit only with evidence. In practice repairs move ratios *away* from floors, so collisions
should be rare — the propagated lower bound is at least as strict as the local clamp along the
same axis (it adds the descendants' requirements), so a repaired ratio satisfies the local
clamp wherever the repair achieved feasibility. The non-feasible best-effort case
(`projectLower`'s `l/Σl` branch) is where clamping can interfere; it is also the case where
everything is broken anyway.

## 3.4 Structural results → the document (tiers 3–5)

A RESHAPE or REBUILD proposal produces a **new n-ary tree over the same panes**. The protocol
has no "set this workspace's tree" mutation (§1.2). Three candidate paths:

**Option A — express as a `tile.dock` / `tile.swap` / `split.resize` verb sequence.**
Compute a diff between the old and new trees and emit the drag-gestures a user would have
made. Rejected: tree-edit-distance over ordered trees with two node types is genuinely hard,
the intermediate states must each validate, and a 6-tile rebuild becomes a dozen verbs whose
intermediate layouts flash by. Complexity lands in the least testable place.

**Option B — add a `WorkspaceSetTree` mutation.** *(Recommended.)*

```protobuf
message WorkspaceSetTree {
  string workspace_id = 1;
  Node root_placement = 2;    // same shape WorkspaceCreate already accepts
}
```

Applier validation (both TS and Go, mirroring `WorkspaceCreate`'s existing checks): workspace
exists; tree is well-formed (every split has two children, ratio ∈ (0,1)); **every leaf
references an existing view**; node ids unique within the document. Semantics: replace
`Workspace.tree` wholesale. Views not referenced anymore are *not* deleted (the proposal
layer decides whether to also emit `view_close` — for rebalancing it never drops views, so
the leaf set before == after by construction).
Cost: the full parity loop (§1.2). Benefit: proposals stay "one verb → one mutation → one
atomic apply," previews are exact, and the mutation is generally useful (agents via
`describeWorkbench`, seeded layout editing, future layout features).
Add a verb `{ kind: "workspace.setTree", workspaceId, tree: LayoutNode }` beside it.

**Option C — `workspace.create` a sibling workspace with the rebuilt tree, then delete the
old one.** Works with zero protocol change (create accepts a `root_placement`, and
`buildLayout`'s singleton knowledge can reference existing views — see
`packages/pbui-workbench/src/document.ts`), but changes the workspace id, which breaks
anything keyed on it (persistence, `workspace.select` history, product subscriptions).
Acceptable as a **Phase-4 stopgap behind the same proposal API**, so the UI ships weight
repairs first and structural repairs don't block on the protocol change.

**Decision for the guide: implement weight tiers with `split.resize` (no protocol change);
implement structural tiers behind Option B, with Option C as the fallback if the protocol
change is deferred.** The proposal type carries this openly:

```ts
type ProposalApply =
  | { kind: "resize-batch"; verbs: WorkbenchVerb[] }          // tiers 1–2
  | { kind: "set-tree"; workspaceId: string; tree: Node }     // tiers 3–5 (Option B)
  | { kind: "none" };                                         // tier 0
```

## 3.5 No stacks: what happens to FOLD and `tabH`

pbui has no tabbed-stack node, so: drop `t:'k'` from the analysis model, drop `tabH` from
`propagate`, and drop stack handling from every strategy (this *simplifies* the port). FOLD's
*purpose* — "the screen cannot physically hold this many tiles; stop showing all of them" —
still exists and still deserves a terminal card. The pbui-native analogue is the workspace:

> **FOLD → "overflow to a new workspace"**: capacity `cols×rows` computed exactly as §11.1
> (minus `tabH`); keep the `cap` most-recently-active tiles (the store knows
> `activePlacementId`; a recency list is a small addition), move the rest to a new workspace
> named "overflow", as a grid. Apply = `workspace.create` with a spec + `placement_close`
> batch — all existing mutations, no protocol change.

Tier 6's meaning ("visible pane set changed") maps cleanly. Ship it in Phase 4 or later; the
capacity *report* ("your workspace physically cannot fit 9 tiles at 240×160 — close something
or lower the floor in settings") is cheap and belongs in the modal's header from Phase 2.

## 3.6 Constraint mapping table

| Textbook / labs | pbui | Note |
|---|---|---|
| `cfg.minW` = 190 | `PaneConstraints.minInlinePx` = 240 | config default; user-tunable in settings tile |
| `cfg.minH` = 130 | `PaneConstraints.minBlockPx` = 160 | |
| `cfg.gap` = 8 | divider track ≈ `DEFAULT_DIVIDER_PX` = 10 | measure the rendered token when a Surface is mounted, like `ratioBounds` does |
| `cfg.tabH` = 14 | — | no stacks |
| `cfg.hyst` | new config field | trigger-only, §2.4 |
| `cfg.aspect` = 1.40 | new config field | used by RELAX-γ and the policy scorer |
| screen rect | `wb.root()`-derived Surface content box | §4.8 |

---

# Part IV — Feature design

## 4.1 UX walkthrough

```
        ┌────────────────────────────────────────────────────────────────┐
        │  REBALANCE WORKSPACE                                     [✕]   │
        │  3 tiles under minimum · worst shortfall 137px ·               │
        │  tree needs 610×540 — fits            policy: BALANCED  ▾      │
        ├────────────────────────────────────────────────────────────────┤
        │ ◄ least invasive ──────────────────────────── most invasive ►  │
        │ ┌─────────┐ ┌─────────┐ ┊ ┌─────────┐ ┊ ┌─────────┐ ┌────────┐ │
        │ │W1 RIPPLE│ │W+ PROJ. │ ┊ │STR RESH.│ ┊ │NEW GRID │ │NEW MAS…│ │
        │ │ +1 agree│ │         │ ┊ │         │ ┊ │  PICK   │ │ (grey) │ │
        │ │ ▦▦▦ svg │ │ ▦▦▦ svg │ ┊ │ ▦▦▦ svg │ ┊ │ ▦▦▦ svg │ │ ▦▦▦    │ │
        │ │ thumb   │ │ thumb   │ ┊ │ thumb   │ ┊ │ thumb   │ │outside │ │
        │ │2/5·256px│ │4/5·341px│ ┊ │5/5·3.2k │ ┊ │5/5·4.3k │ │policy: │ │
        │ │ all fit │ │ all fit │ ┊ │ all fit │ ┊ │ all fit │ │rebuilds│ │
        │ └─────────┘ └─────────┘ ┊ └─────────┘ ┊ └─────────┘ └────────┘ │
        ├────────────────────────────────────────────────────────────────┤
        │ ▸ TRACE (collapsed)                                            │
        │  [Accept ⏎]  [Dismiss esc]   ←/→ select · hover previews       │
        └────────────────────────────────────────────────────────────────┘
```

Interaction contract (all lifted from repair-lab-2's `boot()` key handling and card strip):

- `Mod+Shift+K` opens the modal for the **active workspace**. Recomputes the slate on open —
  never cached across opens (the document may have changed).
- Cards ordered by `tier`, then Σ displacement; dashed separators between tier groups.
- Each card: tier chip (`W1`/`W+`/`ORD`/`STR`/`NEW`/`TAB` — green/red/inverted per tier
  class), algorithm name, "+n agree" merge count, SVG thumbnail (§4.3), a one-line "why", and
  the numbers row: `viol` ("all fit" in green / "2 bad" in red) and `moved/panes · Σpx`.
- The recommended card wears a `PICK` badge; out-of-policy cards are greyed with the reason.
- **Hover** a card → thumbnail-level preview at minimum. Stretch (Phase 6): live-preview on
  the actual Surface behind the modal by rendering the proposal's tree read-only — do NOT
  mutate the document for preview.
- **Click** selects (pins) a card and fills the trace panel with the algorithm's yielded log
  lines. **Enter** accepts the selected card; **Escape** dismisses (surface stack handles
  ordering); **←/→** move the selection; **U** undoes the last accept while the modal is open.
- Accept path: `applyPlan` (weights) or `perform(workspace.setTree)` (structural) →
  close modal → `wb.focusTile(activePlacementId)` — the same focus-restoration rule the
  launcher follows (`types.ts` documents why).
- Header always shows the DETECT summary (violations, worst shortfall, `req(root)` vs screen,
  capacity warning) — this is the free, always-useful part; even when every card is greyed
  the header explains *what is wrong*.
- If there are no violations: the slate collapses toward "LEAVE AS IS" + explicitly-invasive
  options (BALANCE, REBUILD-as-command, RELAX-aspect "tidy"). The modal doubles as the home
  of *deliberate* layout commands — which is how BALANCE stays separated from repair (§2.5).

## 4.2 The `rebalance` module — pure logic, no DOM

```
packages/pbui-workbench/src/rebalance/
├── index.ts              // public surface
├── config.ts             // RebalanceConfig type + defaults + (de)serialization
├── analysisTree.ts       // AnalysisNode, toAnalysis, fromWeights, layoutAnalysis
├── propagate.ts          // propagate, violations, feasibility
├── projectLower.ts       // the shared L2 projection
├── strategies.ts         // stratRipple, stratSparse, stratProject, stratBalance, (stratRelax)
├── repairPass.ts         // the top-down driver (generator)
├── structural.ts         // Phase 4: mutationsOf/applyMutation/scoreTree, generators, hungarian
├── measure.ts            // stats, sig, dividerDiff, classify (tiers)
├── slate.ts              // buildSlate: generators × policy → Proposal[]
└── *.test.ts             // co-located, one per module, mirroring repo convention
```

Public API (consumed by the dialog and by tests):

```ts
export interface RebalanceConfig {
  minInlinePx: number;         // default: DEFAULT_PANE_CONSTRAINTS.minInlinePx
  minBlockPx: number;
  hystPx: number;              // default 0
  targetAspect: number;        // default 1.4
  donorOrder: "near" | "left" | "slack";
  profile: "careful" | "balanced" | "tidy" | "anything" | "custom";
  allow: { reorder: boolean; topology: boolean; rebuild: boolean; overflow: boolean };
  budget: { panesPct: number; dispPx: number | null };
  weights: { move: number; struct: number; aspect: number };
  enabledGenerators: string[]; // generator ids, see GENS table §2.8
  relax?: { alpha: number; beta: number; gamma: number; iters: number; step: number };
}

export interface RebalanceInput {
  tree: Node;                  // the workspace's protocol tree
  rect: { w: number; h: number };   // Surface content box
  dividerPx: number;
  labels: Map<string, string>;      // placementId → tile label (for traces/thumbs)
}

export interface Proposal {
  id: string;
  label: string;               // "RIPPLE", "PROJECT", …
  note: string;                // "nearest donor", "grid", …
  agrees: string[];            // merged generator names (dedup by geometry)
  tier: 0|1|2|3|4|5|6;
  dividersMoved: number | null;
  stats: { viol: number; moved: number; panes: number; disp: number; dispMax: number;
           worstAspect: number };
  rects: Map<string, Rect>;    // proposed geometry, for the thumbnail
  beforeRects: Map<string, Rect>;
  policy: { ok: boolean; reason: string };
  recommended: boolean;
  why: string;                 // one human line
  trace: TraceLine[];          // the generator's yielded log
  apply: ProposalApply;        // § 3.4
}

export function analyze(input: RebalanceInput, cfg: RebalanceConfig): Diagnosis;
export function buildSlate(input: RebalanceInput, cfg: RebalanceConfig): {
  diagnosis: Diagnosis; proposals: Proposal[];
};
```

Everything below `index.ts` is pure: no React, no `document`, no workbench import except
protocol *types*. That is what makes Phase 1–2 testable in plain vitest with zero DOM, and
what keeps the module reusable by an agent-facing door later (`describeWorkbench` could grow a
`diagnosis` section for free).

Module dependency picture:

```
        workbench-protocol (types only)
                 │
   config ── analysisTree ── propagate ── projectLower
                 │               │            │
                 └────────► repairPass ◄── strategies
                                 │
        measure ◄── structural   │
           │            │        │
           └────────── slate ◄───┘
                         │
              RebalanceDialog (React)          settingsApp (React)
                         │                            │
                    Workbench.plan / applyPlan / perform
```

## 4.3 The `RebalanceDialog` component

`packages/pbui-workbench/src/components/RebalanceDialog/RebalanceDialog.tsx`, plus
`.module.css` and a `.stories.tsx` (every component here has stories — follow
`Surface.stories.tsx`'s harness pattern of a fixed-height grid container).

```tsx
export function RebalanceDialog({ onClose }: { onClose(): void }) {
  const workbench = useWorkbench();                        // context.tsx
  const doc = workbench.useDocument();
  const workspaceId = workbench.useWorkbenchState(s => s.workspaceId);
  const input = useRebalanceInput(workbench, doc, workspaceId);  // rect via wb.root()
  const cfg = useRebalanceConfig(workbench);               // §4.5
  const { diagnosis, proposals } = useMemo(
    () => buildSlate(input, cfg), [input, cfg]);
  const [selected, setSelected] = useState<Proposal | null>(
    proposals.find(p => p.recommended) ?? null);
  // Dialog handles Escape + focus; we add ←/→/Enter/U on the panel, not window.
  return (
    <Dialog title="Rebalance workspace" onClose={onClose} unstyled={false} footer={…}>
      <DiagnosisHeader diagnosis={diagnosis} profile={cfg.profile} />
      <ProposalStrip proposals={proposals} selected={selected}
                     onSelect={setSelected} onAccept={accept} />
      <TracePanel lines={selected?.trace ?? []} collapsed />
    </Dialog>
  );
}
```

Rules inherited from Part I that you must respect:

- **Do not call `useEscapeSurface` yourself** — `Dialog` already registered (§1.7).
- Key handling for ←/→/Enter/U goes on the dialog panel (it has focus), not on `window`;
  Escape stays with `Dialog`.
- Accept → `onClose()` → `workbench.focusTile(...)`; never leave focus in a dead dialog.

**Thumbnails.** Port repair-lab-2's `thumb()` nearly verbatim as a tiny React SVG component:
proposal rects scaled into a ~180-wide viewBox; per-tile identity fill from a stable palette
keyed by placement id (`colorOf`); red stroke on still-violating tiles; and for the ≤4 biggest
movers, a dashed **ghost rect at the current position plus a trail line** to the proposed one
("where this pane sits today, drawn over the proposal so the eye can pair them" — the lab's
comment; past four movers the thumbnail "turns into spaghetti", keep that cap). This
thumbnail is 70% of the feature's legibility; build it early, with stories, and reuse it in
before/after pairs in the inspect area if you add one.

**One lab lesson to carry over untouched** (comment above `renderPreview` in repair-lab-2):
*hover must not rebuild the card strip* — a DOM swap under the cursor swallows the click that
was on its way. Keep hover state out of anything that re-keys the card list.

## 4.4 The keyboard shortcut

Chosen chord: **`Mod+Shift+K`** — one modifier away from the launcher chord users already
know (`Mod+K` = "place something", `Mod+Shift+K` = "fix the placements"), no collision with
browser defaults on either platform (unlike `Mod+B`, `Mod+L`, `Mod+.` which are bookmark/URL
bar/reader-mode adjacent), and available to `routeWorkbenchKey`'s existing key filter with a
one-line change. It is a proposal default — make it a constant, expect bikeshedding.

Grow `src/chrome/shortcutRouting.ts` exactly as its header promised:

```ts
export type ShortcutDecision =
  | { kind: "ignore" }
  | { kind: "open-launcher" }
  | { kind: "open-rebalance" };

const ROUTES: ReadonlyArray<{
  key: string; shift: boolean; decision: ShortcutDecision["kind"] & string;
}> = [
  { key: "k", shift: false, decision: "open-launcher" },
  { key: "k", shift: true,  decision: "open-rebalance" },
];

export function routeWorkbenchKey(event, context, platform = ""): ShortcutDecision {
  const route = ROUTES.find(r => r.key === event.key.toLowerCase()
                              && r.shift === event.shiftKey);
  if (!route) return { kind: "ignore" };
  if (!isModKey(event, platform) || event.altKey) return { kind: "ignore" };
  // identical guard block to today's — one transient surface at a time:
  if (context.launcherOpen || context.dialogOpen) return { kind: "ignore" };
  if (context.objectMenuOpen || context.acceptingPresentation) return { kind: "ignore" };
  if (context.renamingView) return { kind: "ignore" };
  return { kind: route.decision };
}
```

Keep it a pure function; extend `chrome.test.tsx` / the routing tests with the new cases
(editable target, each blocked context, the shift discriminator both ways). Then wire the
decision where `open-launcher` is currently consumed (the `Launcher` component's window
listener — `packages/pbui-workbench/src/components/Launcher/Launcher.tsx`): the workbench
state grows `rebalanceOpen: boolean` next to `launcherOpen` in `store.ts`'s `WorkbenchState`
(browser-local, never serialized — same rationale as `launcherOpen`, documented there), plus
verbs `rebalance.open` / `rebalance.close` so products and agents get the same door the
launcher has.

## 4.5 Configuration: the settings tile and persistence

**Persistence.** `RebalanceConfig` serializes into the workbench document as a
`DocumentPayload`:

```
DocumentPut {
  document: {
    id: "rebalance-config",            // singleton, well-known id
    format: "pbui.rebalance-config",
    schema_version: 1,
    body: { …RebalanceConfig as Struct… }
  }
}
```

Reading is a `useDocument()` selector + `fromJson` guard with defaults for missing/old
versions; writing is one `document_put` mutation per settings change (debounced — the
document store subscriber persists on every commit, and you don't want a slider writing
localStorage per pixel; mirror `SplitPane`'s commit-on-release discipline for sliders).
This gives serialize/restore/multi-product/server sync for free and adds no storage system.

**The tile.** `packages/pbui-workbench/src/rebalance/settingsApp.tsx`:

```ts
export const rebalanceSettingsApp = defineApp({
  id: "rebalance-settings",
  title: "Rebalance settings",
  tone: "var(--pbui-tone-neutral)",
  singleton: true,                       // pure function of shared config
  group: "WORKBENCH",
  blurb: "Choose how layout repair proposals are generated and ranked.",
  Component: RebalanceSettings,          // { placementId, view }
});
```

Products opt in by registering it alongside their own apps. Layout of the component mirrors
repair-lab-2's sidebar panels, translated to pbui atoms (`CheckboxRow`, range inputs,
`SegmentedBar` for the profile picker):

- **CONSTRAINTS**: min width / min height / hysteresis / target aspect.
- **POLICY**: profile segmented control (CAREFUL/BALANCED/TIDY/ANYTHING); "what the layout is
  allowed to do" toggles (reorder / reshape / rebuild / overflow); budgets (panes %,
  displacement cap); recommendation weights (move/structure/aspect). Any manual deviation
  flips the profile to CUSTOM (`markCustom` in the lab).
- **GENERATORS**: checkbox per generator id, grouped by kind, with the lab's one-line notes.

The modal's header shows the active profile and deep-links to the settings tile via
`perform({ kind: "app.place", appId: "rebalance-settings" })` — two doors, one config.

## 4.6 Accept, undo, and staleness

```
sequence: user presses Enter on proposal P
  ├─ P.apply = resize-batch:
  │     plan = the WorkbenchPlan built when the slate was computed
  │     if plan.baseDocument !== store.getState().document:   // document moved
  │         rebuild slate, ask again (toast: "layout changed — proposals recomputed")
  │     else workbench.applyPlan(plan)                        // atomic
  ├─ P.apply = set-tree:
  │     workbench.perform({kind:"workspace.setTree", …})      // Phase 4
  ├─ record undo entry { previous mutations' inverse = prior tree snapshot }
  ├─ onClose(); workbench.focusTile(active placement still alive ?: first leaf)
```

Undo: the lab keeps `undoStack` of tree clones. In pbui, while the modal is open, keep the
pre-accept `WorkbenchDocument` (it is immutable protobuf data — a reference, not a deep copy)
and offer `U`/an Undo button that `plan`s a `workspace.setTree` (or the inverse resize batch,
for weight repairs — same split ids, prior ratios) back to it. Do not attempt a global undo
system; that is a product concern. Scope: last accept, while the dialog is open or via a
transient toast after close.

**Auto-apply is deliberately out of scope** for every phase. The lab supports it
(`#autoApply`); the textbook's own framing (§12: "the layout is never repaired behind your
back"), plus the workbench's multi-product reality, argue for shipping proposals-only and
revisiting with usage evidence.

## 4.7 Where geometry comes from

The slate needs the workspace's content-box in pixels and the divider thickness:

- Rect: `workbench.root()` (the Surface registers it, §1.4) →
  `getBoundingClientRect()` of the workspace region; recompute on `ResizeObserver` tick while
  the modal is open (the slate memo keys on `{w,h}` rounded to ints, so ordinary jitter
  doesn't thrash).
- Divider: measure a rendered `[data-part="divider"]` if present, else
  `DEFAULT_DIVIDER_PX` — exactly `ratioBounds`'s existing discipline (`verbs.ts`).
- Headless (tests, agent door): pass an explicit rect; nothing in `rebalance/` touches DOM.

---

# Part V — Implementation plan

Estimated shape: Phases 0–3 are the feature (order strict); 4–6 extend it (order flexible).
Ship value at the end of *every* phase.

### Phase 0 — Orientation (half a day)
1. Run both labs; work through `FOUR DONORS`, `COMPOUND`, `SKINNY COL`, `TOO MANY` in
   repair-lab-2 with the trace panel open.
2. Read textbook §1, §4, §5, §12. Skim the rest.
3. Read `verbs.ts`, `document.ts`, `SplitPane.tsx`, `shortcutRouting.ts`, `Dialog.tsx`,
   `surfaces.ts` top comments in full. They are unusually good and are the local law.

### Phase 1 — Analysis core (1–2 days)
1. `analysisTree.ts`: types, `toAnalysis`, `layoutAnalysis`, `fromWeights`.
   Tests: hand-built binary trees (single leaf; 2-way; 3-way chain both leanings; mixed
   perpendicular; deep `COMPOUND` shape), round-trip property, rect-parity property (§3.2),
   ratio-recovery worked example (§3.3).
2. `propagate.ts`: `propagate`, `violations`, `feasibility` (three scales, §2.3).
   Tests: textbook numbers — `COMPOUND` rects (A 851×656 … D 61×97 at 1072×656 with
   gap 8, min 190×130), `SKINNY COL` needs 820 px height, `WIDE ROW 9` needs 1774 px.
   (Use the textbook's reference config in fixtures, not pbui defaults, so the numbers match
   the book; a second fixture set uses pbui defaults.)
3. `config.ts` with defaults wired to `DEFAULT_PANE_CONSTRAINTS`.

**Deliverable checkpoint:** a `diagnose()` you can run in a test against any workspace tree
and get violations + feasibility. This alone is worth a status-bar badge later.

### Phase 2 — Weight strategies and the slate (2–3 days)
1. `projectLower.ts` (+ §5.2 verification test, + infeasible-branch test, + Σ=1 property).
2. `strategies.ts`: RIPPLE, SPARSE, BALANCE (with balance-then-project), PROJECT.
   `repairPass.ts` driver. Tests: `FOUR DONORS` outcomes table from §5.3 — RIPPLE
   `[314,314,229,190]`, PROJECT `[286,286,286,190]`, BALANCE `[262,262,262,262]` (±1 px);
   `SLIVER` all-agree; hysteresis trigger/target asymmetry.
3. `measure.ts`: stats, `sig`, `dividerDiff`, `classify`. Tests per tier, incl. "REBUILD onto
   same shape reports tier 1" once structural exists.
4. `slate.ts`: run enabled generators, dedup by geometry (seeded from LEAVE AS IS), policy
   gate, `polScore`, recommendation. Tests: `HEALTHY` collapses to one card; CAREFUL grays
   structural cards with reasons; recommendation flips between profiles on `SKINNY COL`.

### Phase 3 — The modal (2–3 days)
1. `Thumbnail` SVG component + stories (feed it fixture proposals — no workbench needed).
2. `RebalanceDialog` + `ProposalStrip` + `DiagnosisHeader` + `TracePanel`, stories with a
   seeded workbench (`layout()` from `document.ts` makes fixtures trivial — see
   `Surface.stories.tsx`).
3. Store field `rebalanceOpen`, verbs `rebalance.open/close`, shortcut route table growth +
   routing tests, wiring where the launcher listens.
4. Accept path for `resize-batch` via `plan`/`applyPlan`; staleness recompute; focus return;
   single-level undo.
5. A11y pass: the dialog is already labeled; cards need `role="option"`/`aria-selected`,
   the strip `role="listbox"`, tier chips need text not just color.

**Deliverable checkpoint: the feature.** Weight-only repairs (tiers 0–2) end-to-end.

### Phase 4 — Structural repairs (3–5 days, separable)
1. Decision checkpoint with the team: Option B (`WorkspaceSetTree`, recommended) vs Option C
   stopgap (§3.4).
2. If B: proto + `buf generate` + TS applier + Go applier + parity fixtures + verb.
3. `structural.ts`: mutation set (transpose/rotate/reverse/swap/**regroup**), settle-then-
   score, hill-climb; generators (grid/master/columns/rows/bsp/dwindle); `hungarian`
   (+ §10.2 fixture test); n-ary→binary tree emission (`splitNode` chains — inverse of
   `toAnalysis`, weights → nested ratios, same math as §3.3).
4. Slate integration; `SKINNY COL` regroup test (§9.3: 6 violations → 0 via `regroup 3 from
   slot 3`); "dwindle-from-dwindle is a no-op reported as tier 0/1" test (§10.3).
5. Optional: FOLD→overflow-workspace card (§3.5).

### Phase 5 — Settings tile + persistence (1–2 days)
`config` (de)serialization ↔ `DocumentPayload`; `rebalanceSettingsApp`; debounced writes;
modal↔settings deep link; restore-with-defaults test for missing/stale schema versions.

### Phase 6 — Polish
Live preview on the Surface behind the modal (read-only tree render); status-bar diagnosis
badge ("3 tiles under minimum") that opens the modal; RELAX strategy + its settings block;
perf guard (slate build under ~10 ms for 12 tiles — measure, the lab numbers say you have
head-room); docs: a `playbooks/` QA script in this ticket + a design-decision record for the
protocol change if taken.

## Testing strategy summary

| Layer | Harness | Anchor fixtures |
|---|---|---|
| projectLower | vitest unit | §5.2 vector; infeasible branch; Σ=1 property |
| adapter | vitest property | round-trip; rect parity ≤1 px; ratio recovery |
| propagate | vitest unit | COMPOUND / SKINNY COL / WIDE ROW 9 book numbers |
| strategies | vitest unit | FOUR DONORS table §5.3; SLIVER agreement; hysteresis |
| structural | vitest unit | hungarian §10.2; SKINNY COL §9.3; regroup capacity math |
| tiers/slate | vitest unit | HEALTHY one-card; policy gating; profile-flip |
| appliers | existing parity suites | + WorkspaceSetTree fixtures (Phase 4) |
| shortcut | existing routing tests | + shift discriminator, blocked contexts |
| UI | stories + component tests | dialog focus/escape; hover-doesn't-rebuild-strip |

The textbook's promise — "every number in this document was produced by the code it
describes" — is your gift: **the book is a fixture file.** When your port disagrees with a
book number, your port is wrong (or your config isn't the reference config in §1.10:
1072×656, min 190×130, gap 8, tabH 14 — remember you removed tabH, which changes the STACKS
fixture only).

---

# Part VI — Pitfalls, told in advance

1. **Memo invalidation.** `propagate` memoizes by node id; the cache must die whenever the
   tree changes shape. The lab builds a fresh memo per call — do the same; never module-cache.
2. **The divider is real pixels.** Every `avail` subtracts divider tracks. Forgetting one
   yields off-by-10px repairs that trigger re-repair next open — which the hysteresis config
   then hides, which is worse. Get §3.1's cut-counting right and property-test it.
3. **Hysteresis in the trigger only** (§2.4). In the target it makes layouts drift.
4. **Snap ratios don't apply to you** — but only because programmatic `split.resize` skips
   `snapRatio` (drag-path-only). If someone later "helpfully" moves snapping into the applier,
   your repairs quantize. Leave a test asserting a resize to 0.263 stays 0.263.
5. **Clamp collisions** (§3.3): re-measure after apply; log discrepancies; do not silently
   trust the preview.
6. **Escape double-registration** (§1.7): wrapping `Dialog` means you never call
   `useEscapeSurface`. The failure mode is "Escape mysteriously stops closing the dialog."
7. **Hover must not rebuild the strip** (§4.3) — the lab wrote the comment after the bug.
8. **StrictMode double-mount**: surfaces and any `useEffect`-driven slate computation must be
   idempotent (the escape stack already is; keep `buildSlate` in `useMemo`, not effects).
9. **Linked views**: one view, two placements. The analysis tree keys on *placement* ids, so
   linked tiles are two panes — correct for geometry. But labels repeat; disambiguate in
   traces ("CHAT (2)") using `placementCount` from `builders.ts`.
10. **Never mutate `plan.baseDocument`'s tree while previewing.** Protobuf documents in the
    store are treated as immutable; your analysis copies (`toAnalysis` output) are yours, the
    protocol `Node`s are not. Structural emission builds *fresh* nodes via
    `splitNode`/`leafNode` (`builders.ts`), reusing only leaf placement ids where the design
    says ids persist — and mint new ids for new splits with `newId("n")`.
11. **The "do nothing" card is not decoration** (§2.8). Dedup seeds from it; generators that
    achieve nothing must *visibly agree with it*; and on `HEALTHY` the entire slate should be
    that one card. Test it; it is the feature's credibility.
12. **Don't let the settings tile write per-keystroke document mutations** — debounce/commit
    on release; the persistence subscriber fires per commit (`store.ts` explains the sixty-
    times-a-second failure).

---

# Appendix A — Existing API quick reference (the ones you will actually call)

```ts
// @hyperslop-systems/workbench-protocol/client
leafNode(viewId): Node
splitNode(direction, a, b, ratio): Node
findNode(root, id): Node | null
leaves(root): Node[]                       // leaf placements, reading order
resizeSplit(doc, splitId, ratio): Mutation[]
applyMutations(doc, mutations): WorkbenchDocument   // throws MutationError
snapRatio(v): { ratio, snapped }           // drag path only — not your concern
newId(prefix): string

// @hyperslop-systems/pbui-workbench
workbench.plan(verbs) → { ok, plan } | { ok:false, index, verb, error }
workbench.applyPlan(plan): boolean
workbench.perform(verb): boolean
workbench.useDocument(): WorkbenchDocument
workbench.useWorkbenchState(sel)
workbench.activePlacementId(): string | null
workbench.focusTile(placementId): void
workbench.root(): HTMLElement | null
workbenchVerbs.resize(splitId, ratio)      // verb factories for all verbs
defineApp({...}): AppDescriptor
layout(spec, options) / tile(appId) / split(dir, ratio, a, b)   // document.ts fixtures
DEFAULT_PANE_CONSTRAINTS, paneRatioBounds, DEFAULT_DIVIDER_PX   // verbs.ts

// @hyperslop-systems/pbui
Dialog({ title, onClose, footer, returnFocus })
routeWorkbenchKey(event, context, platform): ShortcutDecision
isEditableTarget(target), isModKey(event, platform)
pushEscapeSurface / popEscapeSurface / topEscapeSurface / escapeSurfaceCount
```

# Appendix B — Glossary

- **avail** — a split's extent along its axis minus divider/gap pixels; weights and ratios
  distribute *this*, never the raw extent.
- **chain** — a maximal run of same-direction binary splits; flattens to one n-ary split.
- **DETECT / diagnosis** — propagation + violation report; measurement, never mutation.
- **displacement (d)** — per-pane `|Δcx|+|Δcy|+|Δw|+|Δh|`, identity-matched.
- **generator** (two meanings, context disambiguates) — a JS `function*` strategy; or a
  layout target shape (grid/master/…). The lab uses both; keep the collision in mind.
- **placement / view / tile** — leaf node in a workspace tree / logical app instance /
  rendered placement (§1.1).
- **plan** — a preflighted atomic verb batch bound to an exact base document (§1.3).
- **proposal** — one measured, classified, policy-checked candidate layout plus how to apply
  it.
- **settle** — run a weight repair on a structural candidate before scoring it, so topologies
  compete fairly (§2.6).
- **slate** — the full ordered card list, including LEAVE AS IS and out-of-policy entries.
- **tier** — measured invasiveness class 0–6 (§2.7).

# Appendix C — Ticket sources

| File | What it is |
|---|---|
| `sources/tiling-repair-textbook.md` | The algorithms book; §-references throughout this guide point here |
| `sources/repair-lab-2.html` | Proposal-slate lab — the feature's reference implementation |
| `sources/tiling-lab-1.html` | The earlier interactive tiling lab — data model + generators |

---

*End of guide. Questions that survive contact with the code go in this ticket's diary
(`reference/01-diary.md`), decisions that change this document go in the changelog.*

---

# Addendum — Implementation notes (2026-08-28, post-build)

Phases 1–5 shipped on branch `task/add-rebalancing` (see `reference/01-diary.md` steps 2–6
and the ticket changelog for commits). Where the built system deviates from the guide above,
the code is right and this addendum is the record:

1. **§3.2/§3.3 — weights are pixel shares, not ratio products.** Ratio products are not
   exact against pbui's per-level divider subtraction (~3px per chain level, not sub-pixel).
   The shipped adapter lays the binary tree out first and defines `w[i] = px[i]/Σpx`;
   write-back runs in pixel space. Both directions are exact (property-tested to 1e-6).
2. **§4.1/§4.6 — Apply keeps the dialog open** (the lab's behaviour), because closing on
   accept would unmount the component holding the Undo document. Escape closes.
3. **§3.4 — Option B was implemented**: `WorkspaceSetTree` (proto field 16), both appliers,
   two parity fixtures, and a `workspace.setTree` verb. Structural proposals apply through
   `plan`/`applyPlan` like resize batches.
4. **Server ratio band.** `pkg/workbench/validate.go` rejects ratios outside [0.05, 0.95];
   `emitBinary` clamps to that band (a clamped ratio trades exact geometry for validity).
5. **Not built yet** (open tasks): FOLD→overflow-workspace, RELAX, live Surface preview,
   status-bar diagnosis badge, settings deep-link from the dialog header, and
   `aria-activedescendant` on the card listbox. The root package's pre-existing
   `vocabulary.test.ts` typecheck failure on this branch is unrelated and unfixed.
