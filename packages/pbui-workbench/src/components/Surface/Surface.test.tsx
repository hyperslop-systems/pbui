import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { leaves } from "@hyperslop-systems/workbench-protocol/client";
import { createWorkbench } from "../../createWorkbench";
import { layout, singleTile, split, tile } from "../../document";
import { demoApps } from "../../stories/demoApps";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Surface", () => {
  test("renders one TileFrame per leaf, and a split container per split", () => {
    const wb = createWorkbench({
      apps: demoApps,
      initial: layout(split("row", 0.6, tile("counter"), split("col", 0.5, tile("notes"), tile("counter")))),
    });
    const { container } = render(<wb.Surface />);
    expect(container.querySelectorAll('[data-part="tile"]')).toHaveLength(3);
    expect(container.querySelectorAll('[data-part="split"]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-part="split-divider"]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-part="counter-app"]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-part="notes-app"]')).toHaveLength(1);
    // The tree re-renders from the store: a split button adds a tile.
    act(() => {
      fireEvent.click(container.querySelector('[aria-label="split side by side"]')!);
    });
    expect(container.querySelectorAll('[data-part="tile"]')).toHaveLength(4);
  });

  test("the last tile's close button is disabled, and clicking it changes nothing", () => {
    const wb = createWorkbench({ apps: demoApps, initial: singleTile("counter") });
    const { container } = render(<wb.Surface />);
    const close = container.querySelector<HTMLButtonElement>('[aria-label="close this pane"]')!;
    expect(close.disabled).toBe(true);
    fireEvent.click(close);
    expect(container.querySelectorAll('[data-part="tile"]')).toHaveLength(1);
    expect(leaves(wb.store.getState().document.workspaces[0]?.tree)).toHaveLength(1);
  });

  test("an unknown application renders an empty state instead of crashing", () => {
    const wb = createWorkbench({ apps: demoApps, initial: singleTile("retired") });
    const { container } = render(<wb.Surface />);
    expect(container.querySelector('[data-part="tile-body"]')?.textContent).toContain("no application called “retired”");
  });

  test("renderTitle replaces the plain label", () => {
    const wb = createWorkbench({ apps: demoApps, initial: singleTile("notes") });
    const { container } = render(<wb.Surface renderTitle={(view, placement) => <b data-part="custom-title">{`${placement.label}:${view.appId}`}</b>} />);
    expect(container.querySelector('[data-part="custom-title"]')?.textContent).toBe("notes:notes");
  });

  test("pointer-down on a tile makes it the active placement", () => {
    const wb = createWorkbench({ apps: demoApps, initial: layout(split("row", 0.5, tile("counter"), tile("notes"))) });
    const { container } = render(<wb.Surface />);
    const tiles = container.querySelectorAll('[data-part="tile"]');
    fireEvent.pointerDown(tiles[1]!);
    expect(wb.activePlacementId()).toBe(tiles[1]!.getAttribute("data-placement-id"));
  });
});

describe("Surface · linked badge, focus and the divider (5.G)", () => {
  test("a linked view is badged with the number of tiles showing it", () => {
    const wb = createWorkbench({ apps: demoApps, initial: layout(split("row", 0.5, tile("notes"), tile("counter"))) });
    const { container } = render(<wb.Surface />);
    expect(container.querySelector('[data-part="tile-linked"]')).toBeNull();
    const notes = container.querySelector('[data-part="tile"]')!.getAttribute("data-placement-id")!;
    act(() => {
      wb.verbs.split(notes, "col");
    });
    const badges = [...container.querySelectorAll('[data-part="tile-linked"]')].map((n) => n.textContent);
    expect(badges).toEqual([" ×2", " ×2"]);
  });

  test("renderTitle suppresses the default badge, because the product owns the title", () => {
    const wb = createWorkbench({ apps: demoApps, initial: layout(split("row", 0.5, tile("notes"), tile("counter"))) });
    const { container } = render(<wb.Surface renderTitle={(_view, placement) => <b>{placement.label}</b>} />);
    const notes = container.querySelector('[data-part="tile"]')!.getAttribute("data-placement-id")!;
    act(() => {
      wb.verbs.split(notes, "col");
    });
    expect(container.querySelector('[data-part="tile-linked"]')).toBeNull();
  });

  test("focusPlacement puts the keyboard in the tile cell", async () => {
    const wb = createWorkbench({ apps: demoApps, initial: layout(split("row", 0.5, tile("counter"), tile("notes"))) });
    const { container } = render(<wb.Surface />);
    const tiles = [...container.querySelectorAll('[data-part="tile"]')];
    const second = tiles[1]!.getAttribute("data-placement-id")!;
    wb.focusPlacement(second);
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    const focused = document.activeElement;
    expect(focused?.getAttribute("data-part")).toBe("workbench-tile");
    expect(focused?.contains(tiles[1]!)).toBe(true);
    // Focusing a tile also makes it the active placement, through the capture handler.
    expect(wb.activePlacementId()).toBe(second);
  });

  test("pointer dragging uses the same rendered pixel bounds as agent resize", () => {
    const wb = createWorkbench({ apps: demoApps, initial: layout(split("row", 0.5, tile("counter"), tile("notes"))) });
    const { container } = render(<wb.Surface />);
    const splitElement = container.querySelector<HTMLElement>('[data-part="split"]')!;
    vi.spyOn(splitElement, "getBoundingClientRect").mockReturnValue({
      x: 0, y: 0, left: 0, top: 0, right: 600, bottom: 400, width: 600, height: 400, toJSON: () => ({}),
    } as DOMRect);
    const divider = container.querySelector<HTMLElement>('[data-part="split-divider"]')!;
    vi.spyOn(divider, "getBoundingClientRect").mockReturnValue({
      x: 295, y: 0, left: 295, top: 0, right: 305, bottom: 400, width: 10, height: 400, toJSON: () => ({}),
    } as DOMRect);

    fireEvent.pointerDown(divider);
    const move = new Event("pointermove") as PointerEvent;
    Object.defineProperties(move, { clientX: { value: 590 }, clientY: { value: 20 } });
    fireEvent(window, move);
    expect(container.querySelector('[data-part="split-divider"]')?.getAttribute("aria-valuetext")).toBe("59 percent");
    fireEvent.pointerUp(window);
    expect(container.querySelector('[data-part="split-divider"]')?.getAttribute("aria-valuetext")).toBe("59 percent");
  });

  test("keyboard extremes use the same rendered pixel bounds as agent resize", () => {
    const wb = createWorkbench({ apps: demoApps, initial: layout(split("row", 0.5, tile("counter"), tile("notes"))) });
    const { container } = render(<wb.Surface />);
    const splitElement = container.querySelector<HTMLElement>('[data-part="split"]')!;
    vi.spyOn(splitElement, "getBoundingClientRect").mockReturnValue({
      x: 0, y: 0, left: 0, top: 0, right: 600, bottom: 400, width: 600, height: 400, toJSON: () => ({}),
    } as DOMRect);
    const divider = container.querySelector('[data-part="split-divider"]')!;
    fireEvent(window, new Event("resize"));

    fireEvent.keyDown(divider, { key: "Home" });
    expect(container.querySelector('[data-part="split-divider"]')?.getAttribute("aria-valuetext")).toBe("41 percent");
    expect(container.querySelector('[data-part="split-divider"]')?.getAttribute("aria-valuemin")).toBe("41");
    fireEvent.keyDown(divider, { key: "End" });
    expect(container.querySelector('[data-part="split-divider"]')?.getAttribute("aria-valuetext")).toBe("59 percent");
    expect(container.querySelector('[data-part="split-divider"]')?.getAttribute("aria-valuemax")).toBe("59");
  });

  test("the divider announces a unit, and Home/End/double-click move it", () => {
    const wb = createWorkbench({ apps: demoApps, initial: layout(split("row", 0.6, tile("counter"), tile("notes"))) });
    const { container } = render(<wb.Surface />);
    const divider = container.querySelector('[data-part="split-divider"]')!;
    expect(divider.getAttribute("aria-valuetext")).toBe("60 percent");
    expect(divider.getAttribute("aria-valuenow")).toBe("60");

    fireEvent.keyDown(divider, { key: "Home" });
    expect(container.querySelector('[data-part="split-divider"]')?.getAttribute("aria-valuetext")).toBe("10 percent");
    fireEvent.keyDown(divider, { key: "End" });
    expect(container.querySelector('[data-part="split-divider"]')?.getAttribute("aria-valuetext")).toBe("90 percent");
    fireEvent.doubleClick(divider);
    expect(container.querySelector('[data-part="split-divider"]')?.getAttribute("aria-valuetext")).toBe("50 percent");
  });
});
