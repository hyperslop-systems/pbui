---
Title: Launcher Quick Search Modal Workspace Grouping and Keyboard Routing
Ticket: DATALAB-VIEW-001
Status: review
Topics:
    - frontend
    - authoring
DocType: design-doc
Intent: long-term
Owners: []
RelatedFiles:
    - Path: repo://packages/datalab-ui/src/apps/LauncherApp/LauncherApp.tsx
      Note: Current launcher tile entry point
    - Path: repo://packages/datalab-ui/src/components/organisms/Tile/Tile.tsx
      Note: Placement boundary and candidate active-tile focus source
    - Path: repo://packages/datalab-ui/src/components/organisms/ViewSwitcher/ViewSwitcher.tsx
      Note: Current shared Launcher and Replace rendering and selection behavior
    - Path: repo://packages/datalab-ui/src/components/organisms/ViewSwitcher/model.ts
      Note: Pure scoped existing-view and new-application option policy to extend
    - Path: repo://packages/datalab-ui/src/components/pages/Workbench/WorkbenchProviders.tsx
      Note: Per-workbench provider seam for shortcut routing
    - Path: repo://packages/datalab-ui/src/store/layout.ts
      Note: Workspace placement and transient interaction state contracts
    - Path: repo://src/components/Dialog/Dialog.tsx
      Note: Existing accessible modal focus trap and Escape behavior
ExternalSources: []
Summary: Pragmatic design options and a staged recommendation for a searchable modal launcher, workspace-grouped views, query shortcuts, active-tile tracking, and workbench-scoped keyboard routing.
LastUpdated: 2026-07-30T16:44:00-04:00
WhatFor: Decide how PBUI should search, navigate, create, and place application views without prematurely building a general command system or desktop window manager.
WhenToUse: Read before changing LauncherApp, ViewSwitcher, tile focus behavior, modal navigation, workspace aliases, or workbench keyboard shortcuts.
---


# Launcher quick-search modal, workspace grouping, and keyboard routing

## Executive summary

PBUI should evolve the existing Launcher and Replace switcher into a searchable
modal, but it should not begin with a generic command palette, persisted focus
state, keybinding configuration, or MRU system.

The recommended design is a staged version of **Option B** in this document:

1. Keep one pure launcher index and query parser.
2. Render that index in the existing tile for a compact fallback and in an
   accessible modal for the main interaction.
3. Group existing views by workspace.
4. Add two small query prefixes:
   - `+chart` searches only applications that can create a new view;
   - `ws8 temp` searches only existing views in workspace 8.
5. Add one workbench-scoped shortcut, `Mod+K`, after the modal works from
   explicit Launcher and Replace entry points.
6. Track an **active placement** in a React context. This is the tile that last
   contained DOM focus or received a pointer press. It is transient UI state,
   not persisted layout state and not a synchronized property of an `AppView`.

The key boundary is that opening and navigating are not the same operation:

- A modal opened from a Launcher tile or Replace action has an explicit target
  placement. Selecting a result changes what that placement shows.
- A modal opened with `Mod+K` is initially a navigation surface. Selecting an
  existing placement switches to its workspace and focuses it.
- In global navigation mode, new-view results are available only when the active
  placement is already a Launcher tile. The first release must not silently
  split or replace a working tile merely because the user typed `+chart`.

This provides immediate value while leaving clean seams for later MRU behavior.
It also avoids the main overengineering risks: a command registry, a query
language, a focus graph, cross-stage stable aliases, and a generalized keyboard
event bus.

## 1. Current implementation

The current implementation already has most of the domain model required for a
better launcher.

### 1.1 Views and placements are separate

`packages/datalab-ui/src/store/layout.ts` stores:

```ts
interface AppView {
  id: ViewId;
  appId: AppId;
  documents: Record<string, DocId>;
  title?: string;
}

type TilePlacement = {
  id: NodeId;
  type: "leaf";
  viewId: ViewId;
};
```

A workspace owns placement geometry. `LayoutState.views` owns logical views.
The same view may consequently occur in several workspaces. This is exactly the
identity needed to group and navigate launcher results.

### 1.2 Launcher and Replace already share a model

`LauncherApp.tsx` renders `ViewSwitcher` in `mode="launcher"`. `Tile.tsx`
renders the same switcher in `mode="replace"`. The pure
`buildViewSwitcherModel` function already:

- applies instance, stage, and workspace application scope;
- excludes the current view;
- permits existing singleton views while preventing a second logical singleton;
- returns existing views separately from applications that can create a view;
- ranks views in the current workspace before unplaced and elsewhere views.

The design should extend this model rather than replace it with a second search
implementation.

### 1.3 There is no active-tile model

DOM elements are focusable, but the application does not store which tile is
the user's current interaction target. `LayoutState` has transient state for
Replace, rename, import, and notices, but not focus.

This is an important distinction:

```text
DOM focus
    the actual browser focus target: input, button, tile title, splitter, etc.

active placement
    the tile context a workbench shortcut should use

selected view
    not proposed; selecting a logical view globally would add a new product
    concept with no current behavior
```

The term **active placement** is preferable to “focused tile.” It prevents
confusion with browser focus and preserves the view/placement distinction.

### 1.4 Keyboard handling is currently local and layered informally

The code has several independent keyboard listeners:

- `Presentation` handles Enter, Space, Context Menu, and Shift-F10.
- `ObjectMenu` handles Escape and arrow navigation.
- `Dialog` traps Tab and handles Escape.
- the PBUI accept banner handles Escape.
- full-frame workbench mode handles Escape.
- `ViewSwitcher` handles Escape in Replace mode.
- split dividers handle directional arrow keys.

There is no routing system. Adding another unconditional `window.keydown`
listener would increase ambiguity, especially for Escape and for pages
containing several embedded workbenches.

### 1.5 The existing Dialog is sufficient

`src/components/Dialog/Dialog.tsx` already provides:

- `role="dialog"` and `aria-modal="true"`;
- automatic focus of the first control in the body;
- Tab containment;
- Escape dismissal;
- theme variables inherited from PBUI.

The launcher modal should reuse it. A new modal framework is unnecessary.

## 2. Goals and non-goals

### 2.1 Goals

The design must:

1. make large view sets searchable;
2. show where a view is placed;
3. group results by workspace without confusing view identity with placement
   identity;
4. let users restrict a query to a workspace with a short token such as
   `ws8`;
5. let users request only new-view choices with `+`;
6. preserve the current stage/workspace application-scope rules;
7. work from Launcher and Replace before requiring a global shortcut;
8. establish one active-placement concept suitable for later keyboard
   navigation;
9. isolate shortcuts to the workbench that owns browser focus;
10. remain usable with pointer, keyboard, and assistive technology.

### 2.2 Non-goals

The first implementation should not:

- implement Alt-Tab or MRU ordering;
- register arbitrary commands from applications;
- add user-configurable keybindings;
- persist active placement, query text, highlighted result, or modal state;
- synchronize focus or launcher state between clients;
- expose keyboard focus through the backend or CRDT design;
- create stable human workspace aliases in the durable object model;
- add a general parser with quoting, Boolean expressions, or nested filters;
- silently split a tile when a global `+` search is selected;
- search documents, fields, marks, sources, or commands;
- replace PBUI's existing object-menu or accept protocols.

## 3. Vocabulary

| Term | Meaning |
|---|---|
| Launcher tile | A placement whose current view has `appId === "launcher"` |
| Launcher modal | The searchable modal surface described here |
| Invocation | Why the modal opened and what selecting a result means |
| Active placement | The last tile that contained focus or received a pointer press |
| View row | One logical `AppView`, grouped by the workspaces where it is placed |
| Workspace alias | A transient ordinal such as `ws8`, derived from visible workspace order |
| New-view row | An application descriptor that can create an `AppView` |
| Navigate | Switch workspace and focus an existing placement |
| Place | Assign an existing or new view to an explicit target placement |

## 4. Interaction options

### Option A: Search inside the tile only

The current embedded switcher gains an input and workspace group headings.
Launcher and Replace remain constrained to the tile body.

```text
┌─ new tile ────────────────────────────────────────┐
│ Search views or type + for a new view             │
│ ┌───────────────────────────────────────────────┐ │
│ │ temp                                          │ │
│ └───────────────────────────────────────────────┘ │
│                                                  │
│ WS1 · BUILD                                      │
│  Temperature by station       chart · α          │
│  Temperature table            table · α          │
│                                                  │
│ WS3 · EXPLORE                                    │
│  Temperature histogram        chart · β          │
│                                                  │
│ NEW VIEW                                         │
│  Chart    Table    Pipeline    Encoding           │
└──────────────────────────────────────────────────┘
```

Advantages:

- smallest code change;
- no active-placement concept;
- no global shortcut conflicts;
- preserves the existing explicit target;
- works well in a large tile.

Disadvantages:

- poor in narrow or short Launcher tiles;
- list geometry changes with every workspace layout;
- no consistent place to search from;
- cannot become a useful view navigator without another surface;
- the user may have to create or locate a Launcher tile before searching.

Assessment: suitable as a fallback, insufficient as the main interaction.

### Option B: Modal launcher with an active placement

Launcher and Replace open one centered modal. Later, `Mod+K` opens the same
modal in navigation mode. The modal snapshots its invocation and active
placement when it opens.

```text
                         DATALAB
        ┌──────────────────────────────────────────────┐
        │ QUICK LAUNCHER                         Esc ✕ │
        │ ┌──────────────────────────────────────────┐ │
        │ │ temp                                     │ │
        │ └──────────────────────────────────────────┘ │
        │ Target: ws1 build · new tile                │
        │                                              │
        │ WS1 · BUILD                            here   │
        │ ▸ Temperature by station    chart · α        │
        │   Temperature table         table · α        │
        │                                              │
        │ WS3 · EXPLORE                                │
        │   Temperature histogram      chart · β       │
        │                                              │
        │ NOT SHOWN                                    │
        │   Temperature scratch        chart · α       │
        │                                              │
        │ NEW VIEW                              type +  │
        │   Chart   Table   Pipeline   Encoding         │
        │                                              │
        │ ↑↓ choose   Enter place   Esc close           │
        └──────────────────────────────────────────────┘
```

Advantages:

- stable geometry independent of tile size;
- enough space for workspace, application, document, and linked-placement
  metadata;
- one component supports Launcher, Replace, and navigation;
- gives `Mod+K` a clear destination;
- active placement is a small, useful foundation for later shortcuts;
- reuses the existing Dialog and view model.

Disadvantages:

- requires explicit invocation semantics;
- requires a per-workbench interaction provider;
- active placement needs a subtle visual state;
- global navigation and placement must not be conflated.

Assessment: recommended, implemented in two small phases.

### Option C: Full command palette and MRU switcher

All views, commands, workspaces, applications, documents, and actions share one
registry and query language. Results are ordered by MRU and application-defined
weights.

```text
        ┌──────────────── COMMAND CENTER ───────────────┐
        │ > ws8 temp                                    │
        ├───────────────────────────────────────────────┤
        │ VIEWS                                         │
        │   Temperature by station                      │
        │ COMMANDS                                      │
        │   Duplicate view                              │
        │ WORKSPACES                                    │
        │   8 · compare                                  │
        │ DOCUMENTS                                     │
        │   α · climate                                  │
        │ ACTIONS                                       │
        │   Create chart from current selection         │
        └───────────────────────────────────────────────┘
```

Advantages:

- one theoretical entry point for every future operation;
- applications could contribute commands;
- can eventually replace many menus.

Disadvantages:

- requires command identity, registration, authorization, ordering, conflict
  resolution, argument collection, help, and trace semantics;
- requires a product decision about whether commands replace PBUI object verbs;
- requires MRU state before there is evidence users need MRU;
- creates keyboard-routing complexity before the launcher behavior is stable;
- substantially exceeds the requested launcher problem.

Assessment: overengineered for the current product. Do not build it now.

## 5. Recommended user interface

### 5.1 Launcher tile at rest

The Launcher tile should remain useful without opening a modal automatically.
It becomes a clear empty state rather than rendering the complete view grid.

```text
┌─ new tile ───────────────────────────────────────────┐
│                                                     │
│                    OPEN A VIEW                      │
│                                                     │
│              [ Search views…  Mod+K ]               │
│                                                     │
│          + chart   + table   + pipeline             │
│                                                     │
│      Search existing views or create a new one.     │
└─────────────────────────────────────────────────────┘
```

The three quick-create buttons are optional and should come from the first
three creatable applications, not a hard-coded application list. The button
opens the modal with `+chart`, `+table`, or `+pipeline` prefilled. If this still
feels visually busy, ship only the Search button.

### 5.2 Default modal

An empty query shows useful structure rather than every view in one flat grid:

```text
┌─ QUICK LAUNCHER ─────────────────────────────────────┐
│ >                                                   │
│ place in: ws2 explore · new tile                    │
├─────────────────────────────────────────────────────┤
│ WS2 · EXPLORE                                CURRENT│
│ ▸ Yield by production line    chart · batches       │
│   Production batches          table · batches       │
│   Yield encoding              encoding · batches    │
│                                                     │
│ WS1 · BUILD                                         │
│   Climate pipeline            pipeline · climate    │
│   Climate readings            table · climate       │
│                                                     │
│ NOT SHOWN                                           │
│   Scratch comparison          chart · census        │
│                                                     │
│ NEW VIEW                                     type + │
│   Chart  Table  Pipeline  Encoding  Sources  …       │
├─────────────────────────────────────────────────────┤
│ ↑↓ choose · Enter place · Esc close                 │
└─────────────────────────────────────────────────────┘
```

Current workspace comes first. Remaining current-stage workspaces follow their
visible WorkspaceStrip order. Other-stage results should appear only when they
match non-empty search text in the first version; this avoids returning to the
large unfiltered list that motivated the relevance-ranking correction.

### 5.3 Workspace-scoped query

`ws8 temp` parses `ws8` as a scope token and searches the remaining text only
inside workspace 8:

```text
┌─ QUICK LAUNCHER ─────────────────────────────────────┐
│ > ws8 temp                                          │
│ scope: ws8 · 7·compare                         clear │
├─────────────────────────────────────────────────────┤
│ WS8 · 7·COMPARE                                     │
│ ▸ Temperature by station      chart · climate       │
│   Temperature evidence        table · climate       │
│                                                     │
│ 2 matching views                                    │
├─────────────────────────────────────────────────────┤
│ ↑↓ choose · Enter place · Esc close                 │
└─────────────────────────────────────────────────────┘
```

If workspace 8 does not exist:

```text
│ No workspace ws8 in the current stage.              │
│ Available: ws1–ws4.                                 │
```

The interface should expose the resolved workspace name next to the query.
Users should not have to remember what ordinal 8 means after typing it.

### 5.4 New-view-only query

`+chart` hides existing views and searches the application descriptors that can
create a new logical view:

```text
┌─ QUICK LAUNCHER ─────────────────────────────────────┐
│ > +chart                                            │
│ scope: new views                               clear │
├─────────────────────────────────────────────────────┤
│ NEW VIEW                                            │
│ ▸ Chart                uses active document α       │
│   Charts               saved-chart gallery          │
│                                                     │
│ Enter creates the selected view in ws2 · new tile.  │
├─────────────────────────────────────────────────────┤
│ ↑↓ choose · Enter create · Esc close                │
└─────────────────────────────────────────────────────┘
```

The product vocabulary should say **new view**, not “new tile,” inside the
modal. The placement already exists. The operation creates an `AppView` and
assigns it to that placement.

### 5.5 Global navigation mode

`Mod+K` opens the modal without a replacement target:

```text
┌─ GO TO VIEW ─────────────────────────────────────────┐
│ > yield                                             │
│ active tile: ws2 explore · chart                    │
├─────────────────────────────────────────────────────┤
│ WS2 · EXPLORE                                CURRENT│
│ ▸ Yield by production line    chart · batches       │
│                                                     │
│ WS4 · GALLERY                                       │
│   Yield snapshot              charts                │
├─────────────────────────────────────────────────────┤
│ ↑↓ choose · Enter go to · Esc close                 │
└─────────────────────────────────────────────────────┘
```

Selecting a row in navigation mode:

1. switches to the row's workspace if necessary;
2. focuses one placement of that view in the workspace;
3. does not replace or split any tile.

If the active placement is a Launcher tile, `+` results may also be shown and
created there. If it is not a Launcher tile, `+chart` returns:

```text
│ New views need a new tile. Focus a Launcher tile,   │
│ or use Split right / Split below first.             │
```

This refusal is preferable to an implicit split direction or destructive
replacement.

## 6. Query grammar

The first grammar should be deliberately small.

```text
query          := whitespace? prefix* search-text whitespace?
prefix         := new-prefix | workspace-prefix
new-prefix     := "+"
workspace-prefix := "ws" positive-integer whitespace+
search-text    := remaining Unicode text
```

Examples:

| Input | Meaning |
|---|---|
| `temp` | Search existing views and eligible new applications |
| `+` | Show all eligible new applications |
| `+chart` | Search only new applications for `chart` |
| `ws8` | Show views in workspace 8 |
| `ws8 temp` | Search `temp` in workspace 8 |
| `WS8 TEMP` | Same as `ws8 temp`; tokens are case-insensitive |
| `ws99` | Show a workspace-not-found explanation |
| `ws8 +chart` | Invalid in v1: new views do not belong to a workspace yet |

Only recognize a workspace token at the start of the query. A view titled
“ws8 report” should remain searchable by entering part of its title after
ordinary text.

Pseudocode:

```ts
interface ParsedLauncherQuery {
  kind: "all" | "new" | "workspace";
  text: string;
  workspaceOrdinal?: number;
  error?: "workspace-and-new-are-incompatible";
}

function parseLauncherQuery(raw: string): ParsedLauncherQuery {
  let rest = raw.trimStart();
  let workspaceOrdinal: number | undefined;
  let onlyNew = false;

  const workspace = /^ws([1-9]\d*)\b\s*/i.exec(rest);
  if (workspace) {
    workspaceOrdinal = Number(workspace[1]);
    rest = rest.slice(workspace[0].length);
  }

  if (rest.startsWith("+")) {
    onlyNew = true;
    rest = rest.slice(1).trimStart();
  }

  if (workspaceOrdinal && onlyNew) {
    return {
      kind: "workspace",
      workspaceOrdinal,
      text: rest,
      error: "workspace-and-new-are-incompatible",
    };
  }

  if (onlyNew) return { kind: "new", text: rest };
  if (workspaceOrdinal) return { kind: "workspace", workspaceOrdinal, text: rest };
  return { kind: "all", text: rest };
}
```

Do not add quoted phrases, negation, `type:`, `app:`, `stage:`, or Boolean
operators until real result sets show a need.

## 7. Search behavior

### 7.1 Search fields

Existing view rows should search:

- resolved view title;
- application title and application ID;
- bound document names;
- workspace name;
- transient workspace alias such as `ws8`.

New-view rows should search:

- application title;
- application ID.

Do not search arbitrary document contents, table columns, or PBUI presentation
text.

### 7.2 Ranking without a dependency

The first version does not need a fuzzy-search package. Use a deterministic
token score:

```text
exact normalized title match                 100
title starts with query                       80
any title word starts with query              60
title contains query                          40
application or document starts with query     30
workspace name contains query                 20
all query tokens occur somewhere              10
otherwise                                      no match
```

Normalize with lowercase and collapsed whitespace. Preserve original strings
for display.

Ordering after score:

1. higher score;
2. current workspace;
3. current stage;
4. workspace order;
5. existing `viewOrder`.

This is testable and sufficient for dozens of views. Typo tolerance can be
added later if observed queries justify it.

### 7.3 Empty-query limits

An empty query should not render every view across every stage.

Recommended default:

- all rows from the current workspace;
- up to three rows from each other workspace in the current stage;
- up to five unplaced views;
- the first eight new-view applications;
- no other-stage rows.

Typing any ordinary search text removes those presentation limits and searches
all eligible rows. This is a rendering limit only; it must not alter scope or
selection semantics.

## 8. Workspace grouping and linked views

### 8.1 Build groups from placements

The view registry alone cannot answer “which workspace?” The launcher index
must walk each workspace tree.

```ts
interface PlacementOccurrence {
  workspaceId: string;
  placementId: NodeId;
  viewId: ViewId;
}

interface WorkspaceViewRow {
  viewId: ViewId;
  workspaceId: string;
  placementIds: NodeId[];
  totalPlacementCount: number;
}
```

Within one workspace, a linked view appears once even if it has two placements.
`placementIds` records both occurrences. Across workspaces, the view appears
once under each workspace because the location is meaningful in navigation
mode.

Example:

```text
View V is placed twice in ws2 and once in ws8.

WS2 · EXPLORE
  Yield chart     linked · 2 here · 3 total

WS8 · COMPARE
  Yield chart     linked · 1 here · 3 total
```

In place mode, both rows assign the same `viewId`; the workspace grouping is
context. In navigation mode, the selected row identifies which workspace and
occurrence to focus.

### 8.2 Unplaced views

A view with no placements belongs to the `NOT SHOWN` group. Selecting it in
Launcher or Replace assigns it to the target placement. Selecting it in global
navigation mode has nowhere to navigate.

For v1, global navigation should omit unplaced views unless the active
placement is a Launcher tile. Later behavior could offer “show in active tile,”
but that is a placement command, not navigation, and should be explicit.

### 8.3 Workspace ordinals

`ws8` should be a transient alias, not a stored ID.

Recommended rule:

```ts
const visibleWorkspaces = layout.spaces.filter(
  (workspace) => workspace.stageId === layout.currentStageId,
);

// User-facing ordinals are one-based.
const alias = `ws${index + 1}`;
```

The alias therefore matches the WorkspaceStrip order in the current stage.

Consequences:

- inserting, deleting, or reordering workspaces can change an ordinal;
- the alias is suitable for a quick query, not for scripts, persistence, or
  agent APIs;
- the modal must display `ws8 · 7·compare`, never only `ws8`;
- the WorkspaceStrip should eventually show small `1`, `2`, … hints if users
  rely on numeric queries.

Alternative global ordinals over `layout.spaces` were rejected because
authentication changes which stages are visible and because a number unrelated
to the visible strip cannot be learned from the interface.

## 9. Invocation and selection semantics

The modal must know why it was opened.

```ts
type LauncherInvocation =
  | {
      kind: "fill-launcher";
      placementId: NodeId;
      returnFocusTo: HTMLElement | null;
    }
  | {
      kind: "replace";
      placementId: NodeId;
      returnFocusTo: HTMLElement | null;
    }
  | {
      kind: "navigate";
      activePlacementId: NodeId | null;
      returnFocusTo: HTMLElement | null;
    };
```

The DOM element should not be stored in Redux. It belongs to the modal's React
lifetime.

Execution table:

| Invocation | Existing placed view | Unplaced view | New application |
|---|---|---|---|
| `fill-launcher` | assign `viewId` to target | assign `viewId` | create view in target |
| `replace` | assign `viewId` to target | assign `viewId` | create view in target |
| `navigate` | switch workspace and focus occurrence | hidden initially | allowed only if active tile is Launcher |

Pseudocode:

```ts
function executeLauncherResult(invocation, result) {
  if (invocation.kind === "navigate" && result.kind === "placed-view") {
    dispatch(layoutActions.setCurrentSpace(result.workspaceId));
    requestAnimationFrame(() => focusPlacement(result.preferredPlacementId));
    close();
    return;
  }

  if (invocation.kind !== "navigate" && result.kind === "view") {
    dispatch(
      layoutActions.replacePlacementWithView({
        nodeId: invocation.placementId,
        viewId: result.viewId,
      }),
    );
    closeAndRestoreFocus();
    return;
  }

  if (result.kind === "new-app" && hasWritableLauncherTarget(invocation)) {
    dispatch(
      layoutActions.createViewInPlacement({
        nodeId: targetPlacementId(invocation),
        appId: result.appId,
        docId: result.docBound ? activeDocId : null,
      }),
    );
    closeAndFocusTarget();
  }
}
```

## 10. Active placement

### 10.1 State ownership

Active placement is viewer-local interaction state and should live in a React
context under one workbench instance:

```ts
interface WorkbenchInteractionValue {
  activePlacementId: NodeId | null;
  markPlacementActive(placementId: NodeId): void;
  launcher: LauncherInvocation | null;
  openLauncher(invocation: LauncherInvocation): void;
  closeLauncher(): void;
}
```

It should not be added to:

- `AppView`;
- workspace persistence;
- portable bundles;
- backend workspace APIs;
- CRDT documents;
- the PBUI generic package.

The context is a good boundary because pages may contain several embedded
workbench instances. Each instance gets its own active placement and modal.

### 10.2 How a tile becomes active

`Tile` should add `data-placement-id={node.id}` and mark itself active on:

- `onFocusCapture`, when any focusable descendant receives DOM focus;
- `onPointerDownCapture`, before a button or drag grip handles the pointer.

```tsx
<section
  data-placement-id={node.id}
  data-active={activePlacementId === node.id || undefined}
  onFocusCapture={() => markPlacementActive(node.id)}
  onPointerDownCapture={() => markPlacementActive(node.id)}
>
```

Do not move DOM focus on an ordinary pointer press. Marking interaction context
must not steal focus from an input or button.

### 10.3 Visual treatment

The active tile needs a subtle indication only when it matters:

- while the global launcher is open;
- optionally while a workbench keyboard-help overlay is visible.

An always-on selected border would imply that the view itself is selected.
Prefer a temporary outline:

```css
[data-launcher-open] [data-placement-id][data-active] {
  outline: 1px solid var(--pbui-focus);
  outline-offset: -1px;
}
```

### 10.4 Repair rules

- When a workspace switch makes the active placement unavailable, clear it.
- When a reducer closes the active placement, clear it on the next layout
  observation.
- When a modal closes, restore DOM focus to its origin if connected.
- When navigation selects a result, focus the target tile title after the
  workspace renders.
- Do not automatically pick the first tile merely because no tile is active.

## 11. Minimal keyboard routing

### 11.1 Do not build a command registry yet

The first shortcut system needs one action: open the launcher. A registry with
dynamic priorities, application contributions, user remapping, and command
metadata is premature.

Start with a pure routing function and one workbench component:

```ts
interface ShortcutContext {
  targetIsEditable: boolean;
  launcherOpen: boolean;
  dialogOpen: boolean;
  objectMenuOpen: boolean;
  acceptingPresentation: boolean;
}

type ShortcutDecision =
  | { kind: "ignore" }
  | { kind: "open-launcher"; query: string };

function routeWorkbenchKey(
  event: Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey">,
  context: ShortcutContext,
): ShortcutDecision;
```

Add a route table only when a second or third shortcut requires it.

### 11.2 Event boundary

Handle shortcuts with `onKeyDownCapture` on the workbench root, not another
unconditional window listener.

Benefits:

- only the workbench containing focus receives the shortcut;
- embedded tutorial workbenches do not all open;
- browser and page inputs outside the workbench are unaffected;
- the component can inspect local PBUI menu/accept state.

`WorkbenchProviders` is the appropriate provider seam because it is already
instantiated per workbench and sits inside the PBUI provider.

### 11.3 Initial keys

Recommended first keys:

| Key | Behavior |
|---|---|
| `Mod+K` | Open or focus the workbench launcher modal |
| `/` | Open launcher with search focused, only from non-editable workbench chrome/canvas |
| `Escape` | Not routed globally; the topmost Dialog or PBUI surface owns it |
| `ArrowUp/ArrowDown` | Change active result while search input retains focus |
| `Enter` | Execute active result |
| `Home/End` | First/last result |

`Mod` means Meta on macOS and Control elsewhere. Do not intercept `Mod+K` when
focus is outside the workbench.

The `/` shortcut is optional in the first implementation. `Mod+K` is sufficient
and less likely to interfere with typing.

### 11.4 Editable-target guard

Unmodified printable keys must not be intercepted from:

```text
input
textarea
select
[contenteditable="true"]
```

The modal's own search input consumes its navigation keys before the workbench
router sees them. If the object menu, accept mode, or another modal is active,
the router ignores the launcher shortcut.

### 11.5 Escape ownership

The current code has several independent Escape listeners. This design does not
attempt a wholesale rewrite, but the launcher must follow one rule:

> The topmost transient surface handles Escape and stops further workbench
> behavior for that event.

The Dialog handler should call `event.stopPropagation()` in addition to
`preventDefault()` if browser testing confirms full-frame Escape also fires.
That is a focused fix, not a general routing system.

## 12. Component and model design

Recommended decomposition:

```text
LauncherApp
  └── LauncherEmptyState
        └── openLauncher({ kind: "fill-launcher", placementId })

Tile title menu / Replace
  └── openLauncher({ kind: "replace", placementId })

WorkbenchInteractionProvider
  ├── activePlacementId
  ├── LauncherDialog
  │     ├── LauncherSearchInput
  │     └── LauncherResults
  └── WorkbenchShortcutBoundary

Pure model
  ├── parseLauncherQuery
  ├── buildLauncherIndex
  ├── filterLauncherIndex
  └── resolveLauncherAction
```

Suggested source layout:

```text
components/organisms/ViewSwitcher/
  ViewSwitcher.tsx          compact embedded fallback
  LauncherDialog.tsx        modal container
  LauncherResults.tsx       shared grouped results
  model.ts                  index, grouping, filtering, scoring
  query.ts                  tiny parser
  *.stories.tsx

components/pages/Workbench/
  WorkbenchInteractionProvider.tsx
  shortcutRouting.ts
```

Do not rename the whole organism in the first patch. `ViewSwitcher` is already
exported and tested. Add the modal around the model, then decide whether
`Launcher` is a better eventual component name.

### 12.1 Pure index API

```ts
interface LauncherIndexInput {
  apps: readonly AppDescriptor[];
  views: Readonly<Record<ViewId, AppView>>;
  viewOrder: readonly ViewId[];
  workspaces: readonly Workspace[];
  currentStageId: StageId;
  currentWorkspaceId: string;
  documents: Readonly<Record<DocId, GraphicDocument>>;
}

interface LauncherIndex {
  currentStageGroups: WorkspaceGroup[];
  otherStageGroups: StageGroup[];
  unplacedViews: ViewOption[];
  newApplications: AppOption[];
  workspaceAliases: Map<number, string>;
}

function buildLauncherIndex(input: LauncherIndexInput): LauncherIndex;

function searchLauncherIndex(
  index: LauncherIndex,
  query: ParsedLauncherQuery,
  invocation: LauncherInvocation,
): LauncherResults;
```

Keep React, dispatch, and registry globals outside these functions.

### 12.2 Result identity

React keys and keyboard active IDs must include the result's group:

```ts
type LauncherResultId =
  | `placed:${workspaceId}:${viewId}`
  | `unplaced:${viewId}`
  | `new:${appId}`;
```

One linked view may legitimately have two placed result IDs because the user
can navigate to either workspace.

## 13. Accessibility

The recommended modal uses the combobox-with-listbox pattern:

- the search input has `role="combobox"`;
- it owns `aria-controls` for the result list;
- it keeps DOM focus while arrows change the active result;
- it sets `aria-activedescendant` to the highlighted option;
- workspace containers use `role="group"` with labeled headings;
- results use `role="option"` and expose title plus metadata;
- a polite live region reports result count and parse errors;
- pointer hover may update the active result but must not be required;
- Escape closes the Dialog and restores focus;
- the empty state explains valid prefixes in text, not only placeholders.

Accessible option text should include:

```text
Temperature by station, Chart on climate, workspace 8 7 compare,
shown in 3 places, linked
```

The visual row may remain compact.

## 14. State and persistence

No durable schema change is required.

React context owns:

- active placement;
- modal invocation;
- current query;
- highlighted result;
- return-focus element.

Redux reducers continue to own only the resulting domain/layout actions:

- set current workspace;
- replace placement with view;
- create view in placement.

Persistence continues to exclude all launcher interaction state. Portable
bundles are unchanged. Backend APIs are unchanged.

This also establishes the correct future collaboration boundary: remote
workspace/view changes may update the result index, while active placement and
query remain local to each connected viewer.

## 15. Implementation phases

### Phase 1: Pure search and grouping

Tasks:

1. Add `parseLauncherQuery`.
2. Walk workspace trees into grouped view rows.
3. Add deterministic scoring.
4. Preserve existing scope and singleton rules.
5. Add unit tests for aliases, linked views, unplaced views, `+`, and `wsN`.

Exit criteria:

- no React or keyboard listener is needed to test all search semantics;
- a linked view is represented once per workspace;
- `+chart` returns only new applications;
- `ws8 temp` returns only matching views from resolved workspace 8;
- invalid prefixes yield explanatory model states.

### Phase 2: Modal from explicit entry points

Tasks:

1. Add `LauncherDialog` using the existing `Dialog`.
2. Replace the full Launcher tile grid with an empty-state button.
3. Make Launcher open `fill-launcher` mode.
4. Make title-menu Replace open `replace` mode.
5. Implement combobox/listbox keyboard behavior and focus restoration.
6. Keep the compact embedded renderer temporarily for stories and fallback.

Exit criteria:

- the target placement is explicit in the modal header;
- selecting existing and new rows reproduces current reducer behavior;
- tile size does not affect result geometry;
- keyboard and pointer paths are equivalent;
- Escape returns focus to the opener.

This phase ships useful work without a global shortcut or active-placement
system.

### Phase 3: Active placement and `Mod+K`

Tasks:

1. Add `WorkbenchInteractionProvider`.
2. Mark active placement from tile focus and pointer capture.
3. Add a workbench-root shortcut boundary.
4. Open `navigate` mode with `Mod+K`.
5. Switch workspace and focus the selected placement.
6. Permit new-app results only when the active placement is Launcher.
7. Add multi-instance isolation tests.

Exit criteria:

- one embedded workbench cannot open another's launcher;
- typing in an input is not intercepted;
- navigation does not alter layout;
- new-view creation never replaces or splits a working tile implicitly;
- active placement is cleared when its placement disappears.

### Phase 4: Observe before extending

After real use, decide whether to add:

- `/` as a second opening shortcut;
- MRU ranking;
- an explicit “show in active tile” action for unplaced views;
- stable user-assigned workspace aliases;
- stage prefixes;
- search over documents or PBUI commands.

None should be pre-built in Phases 1–3.

## 16. Testing plan

### 16.1 Pure tests

Test:

- parser whitespace and case handling;
- `+`, `+chart`, `ws8`, and `ws8 temp`;
- invalid `ws8 +chart`;
- missing workspace ordinal;
- current-stage ordinal derivation;
- match-score ordering;
- exact/prefix/substring behavior;
- current workspace precedence after equal scores;
- one linked row per workspace;
- several placements of one view within a workspace;
- unplaced view grouping;
- other-stage empty-query suppression;
- application scope and singleton behavior.

### 16.2 Interaction tests

Storybook scenarios:

- Launcher tile at rest;
- modal with no views;
- modal with eight workspaces;
- linked view across two workspaces;
- `ws8` query;
- `+chart` query;
- workspace-not-found state;
- Replace target header;
- global navigate header;
- narrow underlying tile;
- light and dark inherited themes.

Play functions should verify:

- search autofocus;
- ArrowDown and ArrowUp;
- Home and End;
- Enter selection;
- Escape restoration;
- pointer selection;
- active option accessibility;
- no new-view rows in navigation mode without a Launcher target.

### 16.3 Routing tests

Test:

- `Mod+K` inside the active workbench;
- `Mod+K` outside every workbench;
- two embedded workbenches;
- editable input guard;
- open object menu;
- active PBUI accept;
- open Dialog;
- full-frame Escape interaction;
- closed active placement;
- workspace switch before scheduled focus.

### 16.4 Browser screenshots

Capture at minimum:

1. empty query with workspace groups;
2. `ws8 temp`;
3. `+chart`;
4. a linked view shown under two workspaces;
5. missing workspace;
6. modal over a narrow Launcher tile;
7. active-tile outline while the global modal is open.

The screenshots should verify stable modal dimensions, compact typography, and
no underlying layout shift.

## 17. Risks and mitigations

### Risk: `ws8` changes when workspaces change

Mitigation: treat it as a transient ordinal, always show the resolved workspace
name, and never persist or expose it through APIs.

### Risk: linked views appear duplicated

Mitigation: group once per workspace, show a linked/total count, and document
that each row is a navigation destination for the same view.

### Risk: global search destroys a working tile

Mitigation: global mode navigates only. New-app rows require an active Launcher
placement.

### Risk: keyboard listeners conflict

Mitigation: bind at the workbench root, ignore editable targets and active
transient surfaces, and leave Escape to the topmost component.

### Risk: the result model repeats tree walks

Mitigation: build the index with `useMemo` from `spaces`, `views`, `viewOrder`,
documents, and app scope. Current workspaces contain small trees; do not add a
cache or Redux selector layer until profiling shows a problem.

### Risk: other-stage views recreate the original huge list

Mitigation: omit other-stage results for an empty query and include them only
when ordinary search text matches. Stage-specific prefixes can wait.

### Risk: active placement looks like selected domain state

Mitigation: use the term active placement and show its outline only while a
keyboard operation needs a target.

## 18. Decisions

### Decision 1: Use a modal as the primary launcher surface

- **Choice:** Option B.
- **Reason:** stable geometry, sufficient metadata space, and a shared route for
  Launcher, Replace, and later navigation.
- **Boundary:** keep a compact tile fallback; do not create a new modal system.

### Decision 2: Group by workspace membership, not view ownership

- **Choice:** derive groups by walking placements.
- **Reason:** views do not belong to workspaces; they are merely shown there.
- **Consequence:** one linked view may appear in several groups.

### Decision 3: Keep the query language tiny

- **Choice:** plain search plus `+` and leading `wsN`.
- **Reason:** these cover the requested high-value restrictions and are easy to
  explain and test.
- **Consequence:** no general filter parser.

### Decision 4: Derive workspace ordinals per current stage

- **Choice:** `ws1` is the first WorkspaceStrip entry in the current stage.
- **Reason:** the alias corresponds to something visible.
- **Consequence:** ordinals are conveniences, not stable identifiers.

### Decision 5: Track active placement in React context

- **Choice:** per-workbench transient context.
- **Reason:** focus is viewer-local and instance-local.
- **Consequence:** no persistence, bundle, backend, or CRDT change.

### Decision 6: Global invocation navigates by default

- **Choice:** `Mod+K` selects where to go; it does not replace a working tile.
- **Reason:** navigation is reversible and non-destructive.
- **Consequence:** creating a new view globally requires an active Launcher tile.

### Decision 7: Start routing with one hard-coded action

- **Choice:** a pure shortcut decision function plus one root boundary.
- **Reason:** one shortcut does not justify a command registry.
- **Consequence:** general registration is reconsidered only when more shortcuts
  exist.

## 19. Open product questions

These do not block the recommended first two phases:

1. Should the Launcher tile retain quick-create buttons, or only one Search
   button?
2. Should `Mod+K` ship in Phase 3, or should the team observe modal use first?
3. Should another-stage matches be shown under stage headings or one
   “Other stages” group?
4. Should WorkspaceStrip display numeric hints permanently, only while the modal
   is open, or not at all?
5. When a linked view has two placements in one workspace, should navigation
   focus the last-active occurrence or the first tree-order occurrence?
6. Should global `+chart` eventually offer an explicit “split active tile and
   create” follow-up? If so, it must ask for split direction rather than choose
   silently.

Recommended defaults:

- one Search button in the Launcher tile;
- implement modal entry points before `Mod+K`;
- group other-stage matches by stage only for non-empty queries;
- display numeric hints in the modal first;
- use first tree-order occurrence until per-placement activity exists;
- do not split from global `+` in the first release.

## 20. Implementation review guide

An engineer new to the system should read files in this order:

1. `store/layout.ts` for view, placement, workspace, and transient-state
   boundaries.
2. `ViewSwitcher/model.ts` for current scope and singleton policy.
3. `ViewSwitcher/ViewSwitcher.tsx` for current selection effects.
4. `LauncherApp/LauncherApp.tsx` for the empty-placement entry point.
5. `Tile/Tile.tsx` for placement DOM and focus restoration.
6. `WorkbenchProviders.tsx` for per-instance context composition.
7. `src/components/Dialog/Dialog.tsx` for modal focus and Escape behavior.
8. `test/view-switcher.test.ts` and the ViewSwitcher stories for the existing
   regression boundary.

Before implementation, preserve these invariants:

- selecting an existing view never mutates the view;
- creating a view does not copy a domain document;
- application scope is identical between Launcher and Replace;
- singleton means one logical view, not one placement;
- workspace ordinals never enter persisted state;
- active placement never enters persisted state;
- global navigation never performs an implicit layout mutation.

## Conclusion

The useful next step is not a general keyboard system. It is a searchable modal
with a precise target and a pure workspace-aware result model. Once that modal
is reliable, one workbench-scoped `Mod+K` route and one transient active
placement provide a safe starting point for keyboard navigation.

This sequence ships immediate value, retains the normalized view architecture,
and leaves MRU, command registration, stable aliases, and broader search as
evidence-driven follow-ups.
