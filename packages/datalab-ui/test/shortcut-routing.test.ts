import { beforeEach, describe, expect, test } from "vitest";
import {
  isEditableTarget,
  isModKey,
  routeWorkbenchKey,
  type ShortcutContext,
} from "@hyperslop-systems/pbui";
import {
  popEscapeSurface,
  pushEscapeSurface,
  resetEscapeSurfaces,
  topEscapeSurface,
} from "@hyperslop-systems/pbui";

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
  renamingView: false,
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

  test("Shift+Mod+K routes to rebalancing regardless of key case", () => {
    expect(
      routeWorkbenchKey(key({ key: "K", ctrlKey: true, shiftKey: true }), quiet, "Linux"),
    ).toEqual({ kind: "open-rebalance" });
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
    ["an inline rename", { renamingView: true }],
  ])("%s owns the keyboard and blocks the shortcut", (_name, overrides) => {
    expect(routeWorkbenchKey(key({ ctrlKey: true }), { ...quiet, ...overrides }, "Linux")).toEqual({
      kind: "ignore",
    });
  });

  test("an editable target does NOT block a chord", () => {
    // Deliberate: Mod+K is not a printable key, and a user typing in a search
    // box still expects the launcher. The editable guard exists for a future
    // unmodified shortcut such as `/`. An inline RENAME is blocked separately,
    // above — not because it is editable, but because it would lose work.
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
