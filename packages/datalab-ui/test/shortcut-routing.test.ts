import { beforeEach, describe, expect, test } from "vitest";
import {
  isEditableTarget,
  isModKey,
  routeWorkbenchKey,
  type ShortcutContext,
} from "../src/components/pages/Workbench/shortcutRouting";
import {
  popEscapeSurface,
  pushEscapeSurface,
  resetEscapeSurfaces,
  topEscapeSurface,
} from "@hyperslop-systems/pbui";
import {
  initialLayout,
  layoutSlice,
  type LayoutState,
  type Node,
  type NodeId,
} from "../src/store/layout";

/**
 * Keyboard routing and the surface stack, decided as data.
 *
 * The point of `routeWorkbenchKey` being pure is that the awkward cases —
 * a pending accept, an open object menu, a second embedded workbench — are
 * arguments rather than DOM states somebody has to reproduce by clicking.
 */

const quiet: ShortcutContext = {
  targetIsEditable: false,
  launcherOpen: false,
  dialogOpen: false,
  objectMenuOpen: false,
  acceptingPresentation: false,
};

const key = (overrides: Partial<KeyboardEvent> = {}) => ({
  key: "k",
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...overrides,
});

describe("the Mod key", () => {
  test("is Meta on Apple platforms and Control elsewhere", () => {
    expect(isModKey({ metaKey: true, ctrlKey: false }, "MacIntel")).toBe(true);
    expect(isModKey({ metaKey: false, ctrlKey: true }, "MacIntel")).toBe(false);
    expect(isModKey({ metaKey: false, ctrlKey: true }, "Linux x86_64")).toBe(true);
    expect(isModKey({ metaKey: true, ctrlKey: false }, "Linux x86_64")).toBe(false);
  });
});

describe("workbench key routing", () => {
  test("Mod+K opens the launcher", () => {
    expect(routeWorkbenchKey(key({ ctrlKey: true }), quiet, "Linux")).toEqual({
      kind: "open-launcher",
    });
  });

  test("an unmodified k is just a letter", () => {
    expect(routeWorkbenchKey(key(), quiet, "Linux")).toEqual({ kind: "ignore" });
  });

  test("Alt+Mod+K is a different chord and is left alone", () => {
    expect(routeWorkbenchKey(key({ ctrlKey: true, altKey: true }), quiet, "Linux")).toEqual({
      kind: "ignore",
    });
  });

  test("case does not matter: Shift+Mod+K still routes", () => {
    expect(
      routeWorkbenchKey(key({ key: "K", ctrlKey: true, shiftKey: true }), quiet, "Linux"),
    ).toEqual({ kind: "open-launcher" });
  });

  test("Escape is never routed here — the surface stack owns it", () => {
    expect(routeWorkbenchKey(key({ key: "Escape" }), quiet, "Linux")).toEqual({ kind: "ignore" });
  });

  test("an already-open launcher does not reopen", () => {
    expect(
      routeWorkbenchKey(key({ ctrlKey: true }), { ...quiet, launcherOpen: true }, "Linux"),
    ).toEqual({ kind: "ignore" });
  });

  test.each([
    ["a dialog", { dialogOpen: true }],
    ["the object menu", { objectMenuOpen: true }],
    ["a pending accept", { acceptingPresentation: true }],
  ])("%s owns the keyboard and blocks the shortcut", (_name, overrides) => {
    expect(routeWorkbenchKey(key({ ctrlKey: true }), { ...quiet, ...overrides }, "Linux")).toEqual({
      kind: "ignore",
    });
  });

  test("an editable target does NOT block a chord", () => {
    // Deliberate: Mod+K is not a printable key, and a user renaming a tile
    // still expects the launcher. The editable guard exists for a future
    // unmodified shortcut such as `/`.
    expect(
      routeWorkbenchKey(key({ ctrlKey: true }), { ...quiet, targetIsEditable: true }, "Linux"),
    ).toEqual({ kind: "open-launcher" });
  });
});

describe("editable targets", () => {
  test("inputs, textareas, selects and contenteditable count", () => {
    for (const tagName of ["INPUT", "TEXTAREA", "SELECT"]) {
      expect(isEditableTarget({ tagName })).toBe(true);
    }
    expect(isEditableTarget({ tagName: "DIV", isContentEditable: true })).toBe(true);
  });

  test("a plain element, a null target and a non-element do not", () => {
    expect(isEditableTarget({ tagName: "DIV" })).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
    expect(isEditableTarget({})).toBe(false);
  });
});

describe("the escape surface stack", () => {
  // Module state in the generic package, not this store: Escape is delivered to
  // the document, so "topmost" is a property of the page. A landing page with
  // six workbench instances has six stores and one Escape key.
  beforeEach(resetEscapeSurfaces);

  test("the last surface pushed owns Escape", () => {
    expect(topEscapeSurface()).toBeNull();
    pushEscapeSurface("full-frame");
    expect(topEscapeSurface()).toBe("full-frame");
    pushEscapeSurface("launcher");
    expect(topEscapeSurface()).toBe("launcher");
    popEscapeSurface("launcher");
    expect(topEscapeSurface()).toBe("full-frame");
  });

  test("pushing twice seats a surface once", () => {
    // StrictMode double-invokes effects in development. Without idempotence the
    // matching single pop would leave a closed surface owning Escape forever.
    pushEscapeSurface("launcher");
    pushEscapeSurface("launcher");
    popEscapeSurface("launcher");
    expect(topEscapeSurface()).toBeNull();
  });

  test("popping out of order leaves the rest intact", () => {
    pushEscapeSurface("a");
    pushEscapeSurface("b");
    popEscapeSurface("a");
    expect(topEscapeSurface()).toBe("b");
  });

  test("surfaces from different instances share one order", () => {
    // The property the per-store version got wrong: a dialog in instance A and
    // an expanded panel in instance B are not each independently topmost.
    pushEscapeSurface("instance-a:full-frame");
    pushEscapeSurface("instance-b:dialog");
    expect(topEscapeSurface()).toBe("instance-b:dialog");
  });
});

describe("active placement", () => {
  const reduce = (state: LayoutState, action: { type: string; payload?: unknown }) =>
    layoutSlice.reducer(state, action as never);

  /** Every leaf of the current workspace, in tree order. */
  const leaves = (state: LayoutState): NodeId[] => {
    const space = state.spaces.find((candidate) => candidate.id === state.currentSpaceId);
    const out: NodeId[] = [];
    const walk = (node: Node) => {
      if (node.type === "leaf") out.push(node.id);
      else {
        walk(node.a);
        walk(node.b);
      }
    };
    if (space) walk(space.tree);
    return out;
  };

  /** A current workspace holding at least two tiles, whatever the seed is. */
  const twoTiles = (): { state: LayoutState; first: NodeId; second: NodeId } => {
    let state = initialLayout();
    while (leaves(state).length < 2) {
      const target = leaves(state)[0];
      if (!target) throw new Error("the seeded workspace has no tiles at all");
      state = reduce(state, layoutSlice.actions.splitLeaf({ nodeId: target, dir: "row" }));
    }
    const [first, second] = leaves(state);
    if (!first || !second) throw new Error("expected two tiles");
    return { state, first, second };
  };

  test("a repeat write is ignored, so subscribers do not wake", () => {
    let state = initialLayout();
    state = reduce(state, layoutSlice.actions.setActivePlacement("n1"));
    const after = reduce(state, layoutSlice.actions.setActivePlacement("n1"));
    // Identity, not equality: this is the property that stops six identical
    // dispatches when focus crosses a tile's six title controls.
    expect(after).toBe(state);
  });

  test("closing the active tile clears it rather than moving it", () => {
    const { state: seeded, first } = twoTiles();
    let state = reduce(seeded, layoutSlice.actions.setActivePlacement(first));
    state = reduce(state, layoutSlice.actions.closeLeaf(first));
    // Cleared, not handed to a neighbour: nothing should become the keyboard
    // target because something else stopped existing.
    expect(state.activePlacementId).toBeNull();
    expect(leaves(state)).not.toContain(first);
  });

  test("closing another tile leaves it alone", () => {
    const { state: seeded, first, second } = twoTiles();
    let state = reduce(seeded, layoutSlice.actions.setActivePlacement(first));
    state = reduce(state, layoutSlice.actions.closeLeaf(second));
    expect(state.activePlacementId).toBe(first);
  });
});
