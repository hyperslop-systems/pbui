import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { leaves } from "@hyperslop-systems/workbench-protocol/client";
import { createWorkbench } from "../../createWorkbench";
import { layout, singleTile, split, tile } from "../../document";
import { demoApps } from "../../stories/demoApps";

afterEach(cleanup);

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
