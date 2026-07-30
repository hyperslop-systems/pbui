import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { DocId } from "../pbui/types";
import type { ImportTarget } from "../pbui/verbs";
import {
  cloneTree as cloneLayoutTree,
  countLeaves,
  findLeaf,
  leaf as createLeaf,
  removeLeaf,
  removeViewLeaves,
  SNAP_RATIOS,
  SNAP_TOLERANCE,
  snapRatio,
  split as createSplit,
  updateNode,
} from "./layoutTree";
import type { AppId, Node, NodeId, ViewId } from "./layoutTree";
import { newId } from "./world";

export {
  countLeaves,
  findLeaf,
  removeLeaf,
  removeViewLeaves,
  SNAP_RATIOS,
  SNAP_TOLERANCE,
  snapRatio,
  updateNode,
};
export type { AppId, Node, NodeId, ViewId } from "./layoutTree";

/**
 * The window manager's state: workspaces, each a binary split tree.
 *
 * Ported from pbui-gog.jsx:1126-1152. The tree operations are pure functions
 * with no React in sight, which is what lets them be tested exhaustively —
 * `removeLeaf` promoting a sibling and `cloneTree` sharing no nodes are exactly
 * the kind of thing that is easy to get subtly wrong and invisible until a tile
 * disappears.
 */

export type StageId = string;

export type DocumentBindings = Record<string, DocId>;

/**
 * One logical open application, independent of every workspace rectangle that
 * presents it.
 *
 * The first implementation intentionally carries only the fields PBUI already
 * has: application, primary document and optional title. `documents` is named
 * rather than an array so a later two-document application can add meaningful
 * roles without changing the identity model.
 */
export interface AppView {
  id: ViewId;
  appId: AppId;
  documents: DocumentBindings;
  title?: string;
}

export interface LayoutBuilder {
  readonly views: Record<ViewId, AppView>;
  readonly viewOrder: ViewId[];
  leaf(appId: AppId, docId?: DocId | null, title?: string): Node;
  singleton(appId: AppId): Node;
}

/**
 * Build seeded layouts while registering logical views separately from their
 * placements. `singleton` reuses one logical view for every placement of a
 * world-scoped application.
 */
export function createLayoutBuilder(): LayoutBuilder {
  const views: Record<ViewId, AppView> = {};
  const viewOrder: ViewId[] = [];
  const singletons = new Map<AppId, ViewId>();

  const place = (viewId: ViewId): Node => createLeaf(viewId, newId);

  return {
    views,
    viewOrder,
    leaf(appId: AppId, docId: DocId | null = null, title?: string): Node {
      const id = newId();
      views[id] = {
        id,
        appId,
        documents: docId ? { primary: docId } : {},
        ...(title ? { title } : {}),
      };
      viewOrder.push(id);
      return place(id);
    },
    singleton(appId: AppId): Node {
      const existing = singletons.get(appId);
      if (existing) return place(existing);
      const id = newId();
      views[id] = { id, appId, documents: {} };
      viewOrder.push(id);
      singletons.set(appId, id);
      return place(id);
    },
  };
}

export function primaryDocId(view: AppView | undefined): DocId | null {
  return view?.documents.primary ?? null;
}

function appView(id: ViewId, appId: AppId, docId: DocId | null = null, title?: string): AppView {
  return {
    id,
    appId,
    documents: docId ? { primary: docId } : {},
    ...(title ? { title } : {}),
  };
}

/**
 * A leaf's optional user-chosen name (DATADROP-8 DR-62).
 *
 * Absent for every tile nobody has renamed, and the derived title —
 * `chart · α` — stays right for those, because it is already doing the
 * disambiguation four identical tiles would need. The rename exists for the
 * case the derivation cannot reach: two tables on the *same* document showing
 * different pipeline stages, or the tile whose meaning is "the one I keep the
 * raw feed in".
 */
/**
 * Which parts of the shell chrome a stage shows (DATADROP-8 DR-59).
 *
 * Three booleans rather than a variant name, because the three are chosen
 * independently: the sign-in stage wants a masthead and neither of the other
 * two, while an embedded tour panel wants the workspace strip and no masthead.
 */
export interface StageChrome {
  /** The DATALAB wordmark. */
  masthead: boolean;
  /** The workspace strip. False for a stage that has exactly one workspace. */
  workspaces: boolean;
  /** The stage switcher in the top right. Almost always true. */
  stageBar: boolean;
}

/**
 * A stage: a named set of workspaces, an application allow-list, and chrome.
 *
 * The layer the interface was missing (DR-58). `ws-welcome` and `ws-account`
 * used to be *workspaces* that the application had to force the current pointer
 * to — twice, from `Workbench.tsx` — because there was no layer at which "which
 * part of the product am I in" could be expressed. That forcing is the evidence
 * they were always stages wearing a workspace's clothes.
 */
export interface Stage {
  id: StageId;
  name: string;
  /**
   * Which applications this stage offers, or null for every registered one.
   *
   * A *rendering* constraint, applied by the tile picker and the launcher —
   * never a mounting constraint (DR-61). A tile whose layout names an
   * out-of-scope application still renders it, because the alternative is a
   * seeded layout that silently loses a tile.
   */
  apps: AppId[] | null;
  chrome: StageChrome;
  /**
   * The workspace this stage was last on.
   *
   * On the stage rather than only on the layout, so switching away and back
   * returns you where you were (DR-60). `LayoutState.currentSpaceId` mirrors
   * this value for the twenty-odd read sites that predate stages; the two are
   * two views of one fact and `syncSpacePointer` is the only writer of either.
   */
  currentSpaceId: string;
  /** Defined in code: re-created on every load, cannot be deleted (DR-59). */
  pinned?: boolean;
  /**
   * Who may see this stage in the switcher (DATADROP-14 DR-94).
   *
   * Both non-default values are EXCLUSIVE, not minimum requirements: `sign in`
   * is meaningless once you are signed in, and `work` is twelve tiles of 401
   * before you are. So this is not a permission level and must not grow into
   * one — it is "which side of the door does this stage belong to".
   *
   * **Optional, and absent means `any`.** That is the half of `Workbench.tsx`'s
   * original objection to a field that still holds: a field every future stage
   * must have an opinion about is a field that gets the wrong default. A stage
   * a user made says nothing and is visible throughout.
   *
   * It is a *rendering* constraint and NOT a security boundary — the server
   * denies the data regardless (DR-31). What it buys is that a signed-out
   * visitor is never offered a route to a stage that would show them nothing.
   *
   * A definition rather than a memory, so `mergeStages` takes it from code on
   * every load — unlike `currentSpaceId` directly above, which is taken from
   * storage. The two sit next to each other and are treated oppositely, which
   * is worth knowing before editing either.
   */
  audience?: "any" | "anonymous" | "authenticated";
}

export interface Workspace {
  id: string;
  name: string;
  tree: Node;
  /**
   * The stage this workspace belongs to.
   *
   * A foreign key on a flat array rather than nesting the workspaces inside
   * `Stage`, deliberately: `persist.validate` walks the workspace array, and
   * `removeSpace` / `renameSpace` / `cloneSpace` / `setCurrentSpace` all index
   * into it. Nesting would grow a stage lookup in every one of them for no
   * gain, and it would make "move this workspace to another stage" a splice
   * between two arrays rather than a one-field write.
   */
  stageId: StageId;
  /** Narrows the stage's allow-list further, or null/absent to inherit it. */
  apps?: AppId[] | null;
  /**
   * A pinned workspace is defined in code, not by the user.
   *
   * It is re-created from source on every load, cannot be deleted, and its tree
   * replaces whatever was stored. That is what makes "hardwired" true rather
   * than aspirational: without it, a user who closed the account space in one
   * release has no account space in the next, and the only route back is
   * clearing localStorage (DR-29).
   *
   * The cost is that tiles added to a pinned space are lost on reload, which is
   * the intended meaning and is why the workspace strip marks them.
   */
  pinned?: boolean;
}

/**
 * The import dialog, while it is open (DATADROP-8 DR-69).
 *
 * In the store rather than in React state, because the flow is already
 * state-shaped and because the alternatives are worse: component state means
 * prop-drilling from the shell through three components to reach a menu, and a
 * second context beside `PbuiProvider` is a second thing doing the same job.
 *
 * **Never persisted, and `persist.save()` enumerates the layout fields it
 * writes because of this field specifically.** With the slice passed whole, the
 * 500 ms debounce writes an open dialog to localStorage; reload, and the
 * application opens with an import dialog on screen, prefilled with whatever
 * was in the clipboard an hour ago, over a tile that may no longer exist. It is
 * not a crash and no test fails.
 */
export interface PendingImport {
  target: ImportTarget;
  /** Text read from the clipboard, or "" when the read failed or was junk. */
  prefill: string;
  /** Where the prefill came from, for the line above the text area. */
  from: "clipboard" | "template" | null;
}

/**
 * Why the launcher modal is open (DATALAB-VIEW-001 design-doc/02 §9).
 *
 * Opening and navigating are not the same operation, and the modal has to know
 * which it is before the first keystroke:
 *
 *  - `fill-launcher` and `replace` have an explicit target placement, and
 *    selecting a result changes what that placement shows;
 *  - `navigate` has none. Selecting a result switches workspace and focuses an
 *    existing placement, and never mutates the layout (Decision 6).
 *
 * **In the store rather than in a React context**, for the same reason
 * `renamingId` is (DR-69) and one more: the tile's Replace entry is a
 * *serialisable verb* emitted by `pbui/descriptors/tile.ts`, which is a pure
 * function holding no React and cannot call a context method. A context would
 * have needed a second opening path for a menu entry that already has one.
 *
 * The store is also already the workbench instance boundary — `WorkbenchInstance`
 * builds one per instance — so a context would add isolation that exists.
 *
 * Transient, and `save()`'s enumeration excludes it for the reason the whole
 * group shares: reloading into an open modal over a tile that may be gone.
 */
export type LauncherInvocation =
  | { kind: "fill-launcher"; placementId: NodeId }
  | { kind: "replace"; placementId: NodeId }
  | { kind: "navigate"; activePlacementId: NodeId | null };

/**
 * An open transient surface, for deciding who owns Escape (§11.5).
 *
 * The workbench has four independent Escape handlers — the dialog, the launcher,
 * full-frame, and PBUI's own menu — and three of them are `window` listeners.
 * `stopPropagation` cannot order listeners on one node, and
 * `stopImmediatePropagation` orders them by mount order, which is a race
 * between `useEffect`s rather than a rule.
 *
 * So: an explicit stack, oldest first, and one question each handler can ask —
 * *am I on top?* It is not a keyboard routing system and must not grow into
 * one; it answers the single question every one of those handlers is otherwise
 * answering by guessing.
 */
export type SurfaceId = string;

export interface LayoutState {
  stages: Stage[];
  currentStageId: StageId;
  /** Every workspace across every stage, flat, each naming its owner. */
  spaces: Workspace[];
  /** Mirrors the current stage's `currentSpaceId`. See `Stage.currentSpaceId`. */
  currentSpaceId: string;
  /** Logical application views; workspace leaves reference these by id. */
  views: Record<ViewId, AppView>;
  /** Stable ordering for launcher and Replace results. */
  viewOrder: ViewId[];
  /** Non-null while an import dialog is open. Never persisted. */
  pendingImport?: PendingImport | null;
  /**
   * Why the launcher modal is open, or null. Never persisted.
   *
   * Replaces `replacingId`, which could say only "this placement's body is the
   * switcher" and could not distinguish Replace from an empty launcher tile,
   * let alone from global navigation.
   */
  launcher?: LauncherInvocation | null;
  /** Open transient surfaces, oldest first. The last owns Escape. Never persisted. */
  transientSurfaces?: SurfaceId[];
  /**
   * The tile a workbench shortcut acts on: the last to hold focus or take a
   * pointer press. Never persisted.
   *
   * Called *active placement* rather than "focused tile" on purpose. It is not
   * DOM focus — focus is on a button or an input inside the tile, and often on
   * nothing at all — and it is not a selected view, which would be a new
   * product concept with no behaviour behind it. It names the tile a keyboard
   * operation should use as context, and nothing more.
   */
  activePlacementId?: NodeId | null;
  /**
   * The result of the last export, until it is dismissed. Never persisted.
   *
   * An export ends in a promise against a browser API that can refuse, so it
   * has to *report*. `navigator.clipboard?.writeText(x)` — the one clipboard
   * write that existed before this ticket — reports nothing at all, so a user
   * whose browser refused is told the copy worked and pastes an empty clipboard
   * into a chat message.
   */
  notice?: { ok: boolean; title: string; body: string } | null;
  /**
   * The tile placement or workspace whose name is being edited, or null.
   *
   * In the store rather than in the component, because the *menu* has to be
   * able to start a rename and a menu entry is a serialisable verb — it cannot
   * reach into a `useState` three components away. Transient, so `save()`'s
   * enumeration excludes it for the same reason it excludes `pendingImport`
   * (DR-69): reloading into a half-typed rename over a tile that may be gone.
   */
  renamingId?: string | null;
  /**
   * This browser has just completed a first sign-in. Never persisted.
   *
   * The signal behind `?first=1`, which the server appends to the callback's
   * return exactly once (DATADROP-14 DR-96). `Workbench` is the ONE consumer of
   * the query parameter — it reads it, strips it from the URL, and records it
   * here; the sign-up tile reads this. Two components racing to consume and
   * rewrite one parameter means exactly one wins and the loser has already
   * acted on a value that is then erased.
   *
   * Transient, and `save()`'s enumeration excludes it for the same reason it
   * excludes `pendingImport` and `renamingId`: it is true for about thirty
   * seconds, and restoring it a week later greets a returning user as though
   * they had just signed up.
   */
  justSignedUp?: boolean;
}

/** Create a placement for an already-registered logical view. */
export const leaf = (viewId: ViewId): Node => createLeaf(viewId, newId);

export const split = (dir: "row" | "col", a: Node, b: Node, ratio = 0.5): Node =>
  createSplit(dir, a, b, ratio, newId);

/** Deep copy with entirely fresh ids, for duplicating a workspace. */
export const cloneTree = (node: Node): Node => cloneLayoutTree(node, newId);

/**
 * A one-stage, one-workspace layout.
 *
 * Only used where a real layout is unavailable — `layoutSlice`'s declared
 * initial state, and a test that wants the smallest legal shape. The product
 * and every store built without a preload get `defaultLayout()` from
 * `store/stages.ts`.
 */
export const initialLayout = (): LayoutState => {
  const builder = createLayoutBuilder();
  const stageId = newId();
  const space: Workspace = {
    id: newId(),
    name: "build",
    tree: builder.leaf("launcher"),
    stageId,
  };
  return {
    stages: [
      {
        id: stageId,
        name: "work",
        apps: null,
        chrome: { masthead: true, workspaces: true, stageBar: true },
        currentSpaceId: space.id,
      },
    ],
    currentStageId: stageId,
    spaces: [space],
    currentSpaceId: space.id,
    views: builder.views,
    viewOrder: builder.viewOrder,
  };
};

export function stageOf(state: LayoutState): Stage | undefined {
  return state.stages.find((s) => s.id === state.currentStageId) ?? state.stages[0];
}

/** The workspaces belonging to one stage, in layout order. */
export function spacesOfStage(state: LayoutState, stageId: StageId): Workspace[] {
  return state.spaces.filter((s) => s.stageId === stageId);
}

/**
 * The transient surface that owns Escape, or null when none is open.
 *
 * A selector rather than a field so there is one definition of "topmost" and
 * the stack stays the only writable state. Callers compare their own id to it;
 * a handler that is not on top does nothing at all for that key press.
 */
export function topSurface(state: LayoutState): SurfaceId | null {
  const stack = state.transientSurfaces ?? [];
  return stack.length > 0 ? (stack[stack.length - 1] as SurfaceId) : null;
}

/**
 * Write the space pointer in BOTH places, always.
 *
 * The mirror between `LayoutState.currentSpaceId` and the current stage's own
 * `currentSpaceId` is a correctness hazard that grows with every new reducer
 * (DR-60), so no reducer assigns either field directly — they all come through
 * here, and `test/stages.test.ts` walks every reducer in the slice and fails if
 * one desynchronises them.
 */
function syncSpacePointer(state: LayoutState, spaceId: string): void {
  state.currentSpaceId = spaceId;
  const stage = stageOf(state);
  if (stage) stage.currentSpaceId = spaceId;
}

function current(state: LayoutState): Workspace | undefined {
  return state.spaces.find((s) => s.id === state.currentSpaceId) ?? state.spaces[0];
}

function mutateTree(state: LayoutState, fn: (tree: Node) => Node) {
  const space = current(state);
  if (space) space.tree = fn(space.tree);
}

function addView(state: LayoutState, view: AppView): void {
  state.views[view.id] = view;
  state.viewOrder.push(view.id);
}

function viewForPlacement(state: LayoutState, nodeId: NodeId): AppView | undefined {
  const space = current(state);
  if (!space) return undefined;
  const node = findLeaf(space.tree, nodeId);
  return node?.type === "leaf" ? state.views[node.viewId] : undefined;
}

export const layoutSlice = createSlice({
  name: "layout",
  initialState: initialLayout(),
  reducers: {
    setRatio(state, action: PayloadAction<{ nodeId: NodeId; ratio: number }>) {
      mutateTree(state, (tree) =>
        updateNode(tree, action.payload.nodeId, (node) =>
          node.type === "split" ? { ...node, ratio: action.payload.ratio } : node,
        ),
      );
    },

    splitLeaf: {
      reducer(
        state,
        action: PayloadAction<{
          nodeId: NodeId;
          dir: "row" | "col";
          view: AppView;
          placementId: NodeId;
          splitId: NodeId;
        }>,
      ) {
        addView(state, action.payload.view);
        mutateTree(state, (tree) =>
          updateNode(tree, action.payload.nodeId, (node) => ({
            id: action.payload.splitId,
            type: "split",
            dir: action.payload.dir,
            a: node,
            b: { id: action.payload.placementId, type: "leaf", viewId: action.payload.view.id },
            ratio: 0.5,
          })),
        );
      },
      prepare(input: { nodeId: NodeId; dir: "row" | "col" }) {
        const viewId = newId();
        return {
          payload: {
            ...input,
            view: appView(viewId, "launcher"),
            placementId: newId(),
            splitId: newId(),
          },
        };
      },
    },

    closeLeaf(state, action: PayloadAction<NodeId>) {
      const space = current(state);
      // The last tile cannot be closed: an empty workspace has no way back.
      if (!space || countLeaves(space.tree) < 2) return;
      space.tree = removeLeaf(space.tree, action.payload);
      // A closed tile cannot be the shortcut target. Cleared rather than moved
      // to a neighbour: nothing should become active because something else
      // stopped existing (§10.4).
      if (state.activePlacementId === action.payload) state.activePlacementId = null;
    },

    closeView: {
      reducer(state, action: PayloadAction<{ viewId: ViewId; fallbackView: AppView }>) {
        if (!state.views[action.payload.viewId]) return;
        const repaired = state.spaces.map((space) => ({
          space,
          tree: removeViewLeaves(space.tree, action.payload.viewId),
        }));
        let fallbackId: ViewId | undefined;
        if (repaired.some(({ tree }) => tree === null)) {
          fallbackId = state.viewOrder.find(
            (id) => id !== action.payload.viewId && state.views[id]?.appId === "launcher",
          );
          if (!fallbackId) {
            addView(state, action.payload.fallbackView);
            fallbackId = action.payload.fallbackView.id;
          }
        }

        for (const item of repaired) {
          item.space.tree = item.tree ?? {
            id: item.space.tree.id,
            type: "leaf",
            viewId: fallbackId as ViewId,
          };
        }
        delete state.views[action.payload.viewId];
        state.viewOrder = state.viewOrder.filter((id) => id !== action.payload.viewId);
        state.renamingId = null;
        state.launcher = null;
      },
      prepare(viewId: ViewId) {
        const fallbackId = newId();
        return {
          payload: { viewId, fallbackView: appView(fallbackId, "launcher") },
        };
      },
    },

    createViewInPlacement: {
      reducer(
        state,
        action: PayloadAction<{
          nodeId: NodeId;
          view: AppView;
        }>,
      ) {
        const space = current(state);
        if (!space) return;
        const placement = findLeaf(space.tree, action.payload.nodeId);
        if (placement?.type !== "leaf") return;
        addView(state, action.payload.view);
        space.tree = updateNode(space.tree, action.payload.nodeId, (node) =>
          node.type === "leaf" ? { ...node, viewId: action.payload.view.id } : node,
        );
      },
      prepare(input: { nodeId: NodeId; appId: AppId; docId?: DocId | null; title?: string }) {
        const id = newId();
        return {
          payload: {
            nodeId: input.nodeId,
            view: appView(id, input.appId, input.docId ?? null, input.title),
          },
        };
      },
    },

    replacePlacementWithView(state, action: PayloadAction<{ nodeId: NodeId; viewId: ViewId }>) {
      if (!state.views[action.payload.viewId]) return;
      const space = current(state);
      if (!space) return;
      const placement = findLeaf(space.tree, action.payload.nodeId);
      if (placement?.type !== "leaf") return;
      space.tree = updateNode(space.tree, action.payload.nodeId, (node) =>
        node.type === "leaf" ? { ...node, viewId: action.payload.viewId } : node,
      );
    },

    /**
     * Name a tile, or clear the name back to the derived title.
     *
     * An empty string is how the rename control reports "the user cleared the
     * field and pressed Enter", and it must mean *go back to the derived
     * title*, not *render an empty title bar*. Normalised to `undefined` here
     * so there is exactly one representation of "no label" in state, and read
     * with `??` rather than `||` at the other end.
     */
    renameView(state, action: PayloadAction<{ viewId: ViewId; title: string }>) {
      state.renamingId = null;
      const view = state.views[action.payload.viewId];
      if (!view) return;
      const title = action.payload.title.trim();
      if (title) view.title = title;
      else delete view.title;
    },

    /**
     * A second tile on the same application, the same document and a copied
     * label.
     *
     * The SAME document, not a copy of it: two tiles on one document stay in
     * lockstep because they read one object rather than two copies, and that
     * is very often what "let me see this two ways" means. A user who wants a
     * second document duplicates the document — `duplicateDoc` already exists
     * as a verb and is in the document's own menu.
     *
     * `dir` defaults to "row" and the caller may override. The tile knows its
     * own rendered aspect ratio and the reducer does not, so a caller that
     * wants the closest-to-square split measures in `Tile` and passes it. A
     * getBoundingClientRect does not belong in a reducer.
     */
    duplicateView: {
      reducer(
        state,
        action: PayloadAction<{
          nodeId: NodeId;
          viewId: ViewId;
          placementId: NodeId;
          splitId: NodeId;
          dir: "row" | "col";
        }>,
      ) {
        const sourceView = viewForPlacement(state, action.payload.nodeId);
        if (!sourceView) return;
        addView(state, {
          ...sourceView,
          id: action.payload.viewId,
          documents: { ...sourceView.documents },
          ...(sourceView.title ? { title: `${sourceView.title} (copy)` } : {}),
        });
        mutateTree(state, (tree) =>
          updateNode(tree, action.payload.nodeId, (node) => {
            if (node.type !== "leaf") return node;
            const copy: Node = {
              id: action.payload.placementId,
              type: "leaf",
              viewId: action.payload.viewId,
            };
            return {
              id: action.payload.splitId,
              type: "split",
              dir: action.payload.dir,
              a: node,
              b: copy,
              ratio: 0.5,
            };
          }),
        );
      },
      prepare(nodeId: NodeId, dir: "row" | "col" = "row") {
        return {
          payload: {
            nodeId,
            viewId: newId(),
            placementId: newId(),
            splitId: newId(),
            dir,
          },
        };
      },
    },

    createLinkedDuplicate: {
      reducer(
        state,
        action: PayloadAction<{
          nodeId: NodeId;
          placementId: NodeId;
          splitId: NodeId;
          dir: "row" | "col";
        }>,
      ) {
        mutateTree(state, (tree) =>
          updateNode(tree, action.payload.nodeId, (node) => {
            if (node.type !== "leaf") return node;
            const linked: Node = {
              id: action.payload.placementId,
              type: "leaf",
              viewId: node.viewId,
            };
            return {
              id: action.payload.splitId,
              type: "split",
              dir: action.payload.dir,
              a: node,
              b: linked,
              ratio: 0.5,
            };
          }),
        );
      },
      prepare(nodeId: NodeId, dir: "row" | "col" = "row") {
        return {
          payload: { nodeId, placementId: newId(), splitId: newId(), dir },
        };
      },
    },

    setViewDocument(
      state,
      action: PayloadAction<{ viewId: ViewId; role?: string; docId: DocId | null }>,
    ) {
      const view = state.views[action.payload.viewId];
      if (!view) return;
      const role = action.payload.role ?? "primary";
      if (action.payload.docId) view.documents[role] = action.payload.docId;
      else delete view.documents[role];
    },

    /**
     * Exchange two tiles' views while their geometric ids stay put.
     *
     * `app`, `docId` and `label` are one user-visible view payload. The label
     * used to be left behind, attached to the rectangle, so dragging a renamed
     * "yield by line" chart onto another tile moved the chart and abandoned
     * its name. Edge docking already moves the complete source leaf; centre
     * swapping must preserve the same identity rule.
     *
     * The ids stay put because they address geometry in the split tree and are
     * also React keys and drag hit-test targets.
     */
    swapTiles(state, action: PayloadAction<{ a: NodeId; b: NodeId }>) {
      const space = current(state);
      if (!space) return;
      const first = findLeaf(space.tree, action.payload.a);
      const second = findLeaf(space.tree, action.payload.b);
      if (!first || !second || first.type !== "leaf" || second.type !== "leaf") return;
      space.tree = updateNode(
        updateNode(space.tree, action.payload.a, (n) =>
          n.type === "leaf" ? { ...n, viewId: second.viewId } : n,
        ),
        action.payload.b,
        (n) => (n.type === "leaf" ? { ...n, viewId: first.viewId } : n),
      );
    },

    /** Move a tile to an edge of another, splitting it. The source closes. */
    dockTile(
      state,
      action: PayloadAction<{
        from: NodeId;
        to: NodeId;
        zone: "left" | "right" | "top" | "bottom";
      }>,
    ) {
      const space = current(state);
      if (!space || action.payload.from === action.payload.to) return;
      const source = findLeaf(space.tree, action.payload.from);
      if (!source || !findLeaf(space.tree, action.payload.to)) return;

      const without = removeLeaf(space.tree, action.payload.from);
      // If the source survived the removal the tree is not what we thought;
      // bail rather than producing a tree with the same leaf in two places.
      if (findLeaf(without, action.payload.from)) return;

      const dir = action.payload.zone === "left" || action.payload.zone === "right" ? "row" : "col";
      const before = action.payload.zone === "left" || action.payload.zone === "top";
      space.tree = updateNode(without, action.payload.to, (node) =>
        before ? split(dir, source, node) : split(dir, node, source),
      );
    },

    addSpace: {
      reducer(
        state,
        action: PayloadAction<{ id: string; name: string; stageId?: StageId; view: AppView }>,
      ) {
        const stageId = action.payload.stageId ?? state.currentStageId;
        addView(state, action.payload.view);
        state.spaces.push({
          id: action.payload.id,
          name: action.payload.name,
          tree: leaf(action.payload.view.id),
          stageId,
        });
        // A new workspace in ANOTHER stage does not steal the pointer: the user
        // is still where they were, and jumping them somewhere else on an
        // "import a workspace" would lose their place.
        if (stageId === state.currentStageId) syncSpacePointer(state, action.payload.id);
      },
      prepare(name?: string, stageId?: StageId) {
        const viewId = newId();
        return {
          payload: {
            id: newId(),
            name: name ?? "workspace",
            stageId,
            view: appView(viewId, "launcher"),
          },
        };
      },
    },

    removeSpace(state, action: PayloadAction<string>) {
      const space = state.spaces.find((s) => s.id === action.payload);
      if (!space || space.pinned) return;
      // At least one workspace per STAGE, not per layout (DR-72). The old
      // per-layout count was wrong in the permissive direction: a stage holding
      // one workspace inside a layout holding twelve would let you delete it,
      // leaving a stage whose canvas is empty with no way back.
      if (spacesOfStage(state, space.stageId).length < 2) return;
      state.spaces = state.spaces.filter((s) => s.id !== action.payload);
      if (state.currentSpaceId === action.payload) {
        syncSpacePointer(state, spacesOfStage(state, state.currentStageId)[0]?.id ?? "");
      }
      // The deleted space may have been another stage's remembered place.
      for (const stage of state.stages) {
        if (stage.currentSpaceId === action.payload) {
          stage.currentSpaceId = spacesOfStage(state, stage.id)[0]?.id ?? "";
        }
      }
    },

    renameSpace(state, action: PayloadAction<{ spaceId: string; name: string }>) {
      state.renamingId = null;
      const space = state.spaces.find((s) => s.id === action.payload.spaceId);
      if (space && !space.pinned && action.payload.name) space.name = action.payload.name;
    },

    cloneSpace: {
      reducer(state, action: PayloadAction<{ spaceId: string; id: string }>) {
        const space = state.spaces.find((s) => s.id === action.payload.spaceId);
        if (!space) return;
        const copy: Workspace = {
          id: action.payload.id,
          name: `${space.name}′`,
          tree: cloneTree(space.tree),
          stageId: space.stageId,
          // A copy is the user's, never code-defined, however it was made.
          ...(space.apps ? { apps: [...space.apps] } : {}),
        };
        state.spaces.push(copy);
        if (copy.stageId === state.currentStageId) syncSpacePointer(state, copy.id);
      },
      prepare(spaceId: string) {
        // The id is minted by the caller for the same reason `duplicateDoc`'s
        // is: a reducer that calls crypto.randomUUID() is not a pure function
        // of its inputs, and a state tree that changes when you replay it is
        // not replayable.
        return { payload: { spaceId, id: newId() } };
      },
    },

    setCurrentSpace(state, action: PayloadAction<string>) {
      const space = state.spaces.find((s) => s.id === action.payload);
      if (!space) return;
      // Switching to a workspace in another stage switches the stage too. The
      // alternative — refusing — makes "load this template into the account
      // stage and show me" impossible to express as one verb.
      if (space.stageId !== state.currentStageId) {
        if (state.stages.some((s) => s.id === space.stageId)) state.currentStageId = space.stageId;
      }
      syncSpacePointer(state, space.id);
    },

    /** Narrow (or, with null, un-narrow) one workspace's application list. */
    setSpaceApps(state, action: PayloadAction<{ spaceId: string; apps: readonly AppId[] | null }>) {
      const space = state.spaces.find((s) => s.id === action.payload.spaceId);
      if (!space) return;
      space.apps = action.payload.apps === null ? null : [...action.payload.apps];
    },

    /* ------------------------------------------------------------ stages -- */

    addStage: {
      reducer(
        state,
        action: PayloadAction<{
          id: StageId;
          spaceId: string;
          name: string;
          apps: AppId[] | null;
          chrome: StageChrome;
          view: AppView;
        }>,
      ) {
        const { id, spaceId, name, apps, chrome, view } = action.payload;
        addView(state, view);
        state.spaces.push({ id: spaceId, name: "build", tree: leaf(view.id), stageId: id });
        state.stages.push({ id, name, apps, chrome, currentSpaceId: spaceId });
        state.currentStageId = id;
        syncSpacePointer(state, spaceId);
      },
      prepare(name: string, apps: readonly AppId[] | null = null, chrome?: StageChrome) {
        const viewId = newId();
        return {
          payload: {
            id: newId(),
            spaceId: newId(),
            name,
            apps: apps === null ? null : [...apps],
            chrome: chrome ?? { masthead: true, workspaces: true, stageBar: true },
            view: appView(viewId, "launcher"),
          },
        };
      },
    },

    removeStage(state, action: PayloadAction<StageId>) {
      const stage = state.stages.find((s) => s.id === action.payload);
      // A code-defined stage never goes, and neither does the last one: a
      // layout with no stage renders nothing and has no route back (DR-72).
      if (!stage || stage.pinned) return;
      if (state.stages.length < 2) return;
      state.stages = state.stages.filter((s) => s.id !== action.payload);
      state.spaces = state.spaces.filter((s) => s.stageId !== action.payload);
      if (state.currentStageId === action.payload) {
        const next = state.stages[0] as Stage;
        state.currentStageId = next.id;
        syncSpacePointer(
          state,
          next.currentSpaceId || (spacesOfStage(state, next.id)[0]?.id ?? ""),
        );
      }
    },

    renameStage(state, action: PayloadAction<{ stageId: StageId; name: string }>) {
      const stage = state.stages.find((s) => s.id === action.payload.stageId);
      // Same rule the workspace strip already states for pinned spaces: the
      // name comes from code and would be overwritten on the next load, so
      // offering the edit would be a lie.
      if (stage && !stage.pinned && action.payload.name) stage.name = action.payload.name;
    },

    setCurrentStage(state, action: PayloadAction<StageId>) {
      const stage = state.stages.find((s) => s.id === action.payload);
      if (!stage) return;
      state.currentStageId = stage.id;
      // The stage's remembered workspace, repaired if it named one that is gone
      // — otherwise the canvas renders nothing and the strip has no selection.
      const remembered = state.spaces.find(
        (s) => s.id === stage.currentSpaceId && s.stageId === stage.id,
      );
      syncSpacePointer(state, remembered?.id ?? spacesOfStage(state, stage.id)[0]?.id ?? "");
    },

    moveSpaceToStage(state, action: PayloadAction<{ spaceId: string; stageId: StageId }>) {
      const space = state.spaces.find((s) => s.id === action.payload.spaceId);
      const stage = state.stages.find((s) => s.id === action.payload.stageId);
      if (!space || !stage || space.pinned) return;
      // Do not strand the stage it is leaving with no workspaces at all.
      if (spacesOfStage(state, space.stageId).length < 2) return;
      space.stageId = stage.id;
      for (const other of state.stages) {
        if (other.currentSpaceId === space.id && other.id !== stage.id) {
          other.currentSpaceId = spacesOfStage(state, other.id)[0]?.id ?? "";
        }
      }
      if (state.currentSpaceId === space.id) {
        syncSpacePointer(state, spacesOfStage(state, state.currentStageId)[0]?.id ?? "");
      }
    },

    /* ------------------------------------------------------- importing -- */

    /** Start (or, with null, stop) editing a tile's or workspace's name. */
    beginRename(state, action: PayloadAction<string | null>) {
      state.renamingId = action.payload;
    },

    /* -------------------------------------------------------- launcher -- */

    openLauncher(state, action: PayloadAction<LauncherInvocation>) {
      state.launcher = action.payload;
    },

    /**
     * Record the tile a shortcut should act on. Ignores a no-op write.
     *
     * The guard is not a micro-optimisation. `onFocusCapture` fires for every
     * focusable descendant, so tabbing across one tile's six title controls
     * would otherwise dispatch six identical actions and wake every subscriber
     * six times.
     */
    setActivePlacement(state, action: PayloadAction<NodeId | null>) {
      if (state.activePlacementId === action.payload) return;
      state.activePlacementId = action.payload;
    },

    closeLauncher(state) {
      state.launcher = null;
    },

    /**
     * Push an open transient surface. Idempotent.
     *
     * Idempotent because React 18's StrictMode double-invokes effects in
     * development: a naive push would seat one dialog twice, and the matching
     * single pop would leave it on the stack owning Escape forever.
     */
    pushSurface(state, action: PayloadAction<SurfaceId>) {
      const stack = state.transientSurfaces ?? [];
      state.transientSurfaces = stack.includes(action.payload) ? stack : [...stack, action.payload];
    },

    popSurface(state, action: PayloadAction<SurfaceId>) {
      state.transientSurfaces = (state.transientSurfaces ?? []).filter(
        (id) => id !== action.payload,
      );
    },

    /** Record that this browser has just completed a first sign-in (DR-96). */
    setJustSignedUp(state, action: PayloadAction<boolean>) {
      state.justSignedUp = action.payload;
    },

    showNotice(state, action: PayloadAction<{ ok: boolean; title: string; body: string }>) {
      state.notice = action.payload;
    },

    dismissNotice(state) {
      state.notice = null;
    },

    openImport(state, action: PayloadAction<PendingImport>) {
      state.pendingImport = action.payload;
    },

    closeImport(state) {
      state.pendingImport = null;
    },

    /**
     * Replace one tile from a bundle. The caller supplies the hydrated leaf.
     *
     * The conversion lives in `store/bundles.ts` and the ids it consumed were
     * minted by the caller, so this reducer is a pure function of its payload —
     * the same rule `duplicateDoc` follows, and for the same reason: a state
     * tree that changes when you replay it is not replayable.
     */
    replaceLeafFromBundle(
      state,
      action: PayloadAction<{
        nodeId: NodeId;
        leaf: Extract<Node, { type: "leaf" }>;
        views: Record<ViewId, AppView>;
        viewOrder: ViewId[];
      }>,
    ) {
      for (const id of action.payload.viewOrder) {
        const view = action.payload.views[id];
        if (view) addView(state, view);
      }
      mutateTree(state, (tree) =>
        updateNode(tree, action.payload.nodeId, (node) =>
          // The TARGET's id is kept, not the hydrated leaf's. The tile stays the
          // same tile — it is being re-pointed, not replaced — so a drag in
          // flight, a focus, and anything else holding the node id stays valid.
          node.type === "leaf" ? { ...action.payload.leaf, id: node.id } : node,
        ),
      );
      state.pendingImport = null;
    },

    insertWorkspaceFromBundle(
      state,
      action: PayloadAction<{
        space: Workspace;
        views: Record<ViewId, AppView>;
        viewOrder: ViewId[];
      }>,
    ) {
      const space = action.payload.space;
      if (!state.stages.some((s) => s.id === space.stageId)) return;
      for (const id of action.payload.viewOrder) {
        const view = action.payload.views[id];
        if (view) addView(state, view);
      }
      state.spaces.push(space);
      if (space.stageId === state.currentStageId) syncSpacePointer(state, space.id);
      state.pendingImport = null;
    },

    insertStageFromBundle(
      state,
      action: PayloadAction<{
        stage: Stage;
        spaces: Workspace[];
        views: Record<ViewId, AppView>;
        viewOrder: ViewId[];
      }>,
    ) {
      const { stage, spaces } = action.payload;
      if (spaces.length === 0) return;
      for (const id of action.payload.viewOrder) {
        const view = action.payload.views[id];
        if (view) addView(state, view);
      }
      state.stages.push({ ...stage, currentSpaceId: (spaces[0] as Workspace).id });
      state.spaces.push(...spaces);
      state.currentStageId = stage.id;
      syncSpacePointer(state, (spaces[0] as Workspace).id);
      state.pendingImport = null;
    },

    /** Replace the whole layout — used by restoration. */
    replaceLayout(_state, action: PayloadAction<LayoutState>) {
      return action.payload;
    },
  },
});

export const layoutActions = layoutSlice.actions;
