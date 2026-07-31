/**
 * The chrome kit (PBUI-UNIFY-001 Phase 2): zone geometry, drag registry
 * hygiene, the tile frame's callbacks, and the launcher shell's keyboard loop.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { useState } from "react";
import { LauncherShell } from "./LauncherShell";
import { routeWorkbenchKey, isEditableTarget, isModKey, type ShortcutContext } from "./shortcutRouting";
import { TileFrame } from "./TileFrame";
import { registeredTileCount, useTileDrag, zoneFor } from "./useTileDrag";

afterEach(cleanup);

function box(width: number, height: number): DOMRect {
  return { left: 0, top: 0, right: width, bottom: height, width, height, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
}

describe("zoneFor (DR-U4: the banded geometry)", () => {
  test("the centre of a large tile is generous", () => {
    // 1000x800: band = min(800*0.3, 110) = 110. A point 200px from every edge
    // is centre.
    expect(zoneFor(box(1000, 800), 500, 400)).toBe("center");
    expect(zoneFor(box(1000, 800), 200, 400)).toBe("center");
  });

  test("edges stay reachable on a small tile", () => {
    // 100x100: band = 30. 10px from the left edge is left.
    expect(zoneFor(box(100, 100), 10, 50)).toBe("left");
    expect(zoneFor(box(100, 100), 90, 50)).toBe("right");
    expect(zoneFor(box(100, 100), 50, 10)).toBe("top");
    expect(zoneFor(box(100, 100), 50, 90)).toBe("bottom");
    expect(zoneFor(box(100, 100), 50, 50)).toBe("center");
  });

  test("the band caps at 110px on huge tiles", () => {
    // 2000x2000: band = 110, so 150px in from the edge is already centre.
    expect(zoneFor(box(2000, 2000), 150, 1000)).toBe("center");
    expect(zoneFor(box(2000, 2000), 100, 1000)).toBe("left");
  });
});

describe("useTileDrag registry", () => {
  test("register and unregister keep the registry clean", () => {
    function Tile({ id }: { id: string }) {
      const drag = useTileDrag({ id, onSwap: () => {}, onDock: () => {} });
      return <section ref={drag.register} data-placement-id={id} />;
    }
    const before = registeredTileCount();
    const first = render(<Tile id="drag-test-a" />);
    render(<Tile id="drag-test-b" />);
    expect(registeredTileCount()).toBe(before + 2);
    first.unmount();
    expect(registeredTileCount()).toBe(before + 1);
    cleanup();
    expect(registeredTileCount()).toBe(before);
  });
});

describe("TileFrame", () => {
  test("wires the split and close callbacks and respects canClose", () => {
    const onSplit = vi.fn();
    const onClose = vi.fn();
    render(
      <TileFrame
        placementId="p1"
        tone="var(--pbui-tone-neutral)"
        title="lean source"
        canClose={false}
        onSplit={onSplit}
        onClose={onClose}
      >
        body
      </TileFrame>,
    );
    fireEvent.click(screen.getByRole("button", { name: "split side by side" }));
    expect(onSplit).toHaveBeenCalledWith("row");
    fireEvent.click(screen.getByRole("button", { name: "split top and bottom" }));
    expect(onSplit).toHaveBeenCalledWith("col");
    const close = screen.getByRole("button", { name: "close this pane" }) as HTMLButtonElement;
    expect(close.disabled).toBe(true);
    fireEvent.click(close);
    expect(onClose).not.toHaveBeenCalled();
  });

  test("renders the drop overlay naming the outcome", () => {
    render(
      <TileFrame
        placementId="p2"
        tone="t"
        title="goals"
        canClose
        onSplit={() => {}}
        onClose={() => {}}
        dropZone="left"
      >
        body
      </TileFrame>,
    );
    expect(screen.getByText(/split-dock here/).closest('[data-part="drop-zone"]')).toBeTruthy();
  });
});

describe("LauncherShell", () => {
  function Harness({ onChoose }: { onChoose(id: string): void }) {
    const [query, setQuery] = useState("");
    return (
      <LauncherShell
        title="Open a view"
        groups={[
          { label: "OPEN VIEWS", rows: [{ id: "view:a", title: "goals" }] },
          {
            label: "NEW VIEW",
            rows: [
              { id: "app:b", title: "script" },
              { id: "app:c", title: "step", disabled: true },
            ],
          },
        ]}
        query={query}
        onQueryChange={setQuery}
        onChoose={onChoose}
        onClose={() => {}}
        enterVerb={(id) => (id?.startsWith("view:") ? "go to" : "open")}
      />
    );
  }

  test("wraps with the arrows, retains the highlight, Enter chooses", () => {
    const onChoose = vi.fn();
    render(<Harness onChoose={onChoose} />);
    const input = screen.getByRole("combobox");
    // First row is active by default.
    expect(input.getAttribute("aria-activedescendant")).toBe("view:a");
    fireEvent.keyDown(input, { key: "ArrowUp" }); // wraps to the last row
    expect(input.getAttribute("aria-activedescendant")).toBe("app:c");
    fireEvent.keyDown(input, { key: "Enter" }); // disabled row: no choice
    expect(onChoose).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChoose).toHaveBeenCalledWith("app:b");
  });

  test("names the enter verb after the ACTIVE row", () => {
    render(<Harness onChoose={() => {}} />);
    expect(screen.getByText(/Enter go to/)).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowDown" });
    expect(screen.getByText(/Enter open/)).toBeTruthy();
  });
});

describe("shortcut routing (moved verbatim from datalab-ui)", () => {
  const quiet: ShortcutContext = {
    targetIsEditable: false,
    launcherOpen: false,
    dialogOpen: false,
    objectMenuOpen: false,
    acceptingPresentation: false,
    renamingView: false,
  };
  const key = (overrides: Partial<KeyboardEvent> = {}) =>
    ({ key: "k", metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...overrides });

  test("Mod is Meta on Apple platforms and Control elsewhere", () => {
    expect(isModKey({ metaKey: true, ctrlKey: false }, "MacIntel")).toBe(true);
    expect(isModKey({ metaKey: false, ctrlKey: true }, "MacIntel")).toBe(false);
    expect(isModKey({ metaKey: false, ctrlKey: true }, "Linux x86_64")).toBe(true);
  });

  test("Mod+K opens; transient surfaces block; editable targets do not", () => {
    expect(routeWorkbenchKey(key({ ctrlKey: true }), quiet, "Linux")).toEqual({
      kind: "open-launcher",
    });
    for (const overrides of [
      { launcherOpen: true },
      { dialogOpen: true },
      { objectMenuOpen: true },
      { acceptingPresentation: true },
      { renamingView: true },
    ]) {
      expect(routeWorkbenchKey(key({ ctrlKey: true }), { ...quiet, ...overrides }, "Linux")).toEqual(
        { kind: "ignore" },
      );
    }
    expect(
      routeWorkbenchKey(key({ ctrlKey: true }), { ...quiet, targetIsEditable: true }, "Linux"),
    ).toEqual({ kind: "open-launcher" });
  });

  test("editable target detection", () => {
    expect(isEditableTarget({ tagName: "INPUT" })).toBe(true);
    expect(isEditableTarget({ tagName: "DIV", isContentEditable: true })).toBe(true);
    expect(isEditableTarget({ tagName: "DIV" })).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});
