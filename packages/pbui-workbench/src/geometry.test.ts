import { afterEach, describe, expect, it } from "vitest";
import { canSplitPlacement, longerAxis, splitRatioBounds, DEFAULT_PANE_CONSTRAINTS } from "@hyperslop-systems/workbench-core";
import { measureGeometry } from "./geometry";

function box(width: number, height: number, left = 0, top = 0): DOMRect {
  return { x: left, y: top, left, top, right: left + width, bottom: top + height, width, height, toJSON: () => ({}) } as DOMRect;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("measureGeometry", () => {
  it("returns null with no root or an empty root", () => {
    expect(measureGeometry(null)).toBeNull();
    const root = document.createElement("div");
    document.body.appendChild(root);
    expect(measureGeometry(root)).toBeNull();
  });

  it("reads placements, splits, the divider track, and the viewport relative to the root", () => {
    const root = document.createElement("div");
    root.getBoundingClientRect = () => box(1000, 600, 20, 10);
    const split = document.createElement("div");
    split.dataset.splitId = "s1";
    split.getBoundingClientRect = () => box(1000, 600, 20, 10);
    const divider = document.createElement("div");
    divider.dataset.part = "split-divider";
    divider.getBoundingClientRect = () => box(8, 600, 520, 10);
    split.appendChild(divider);
    const a = document.createElement("div");
    a.dataset.placementId = "a";
    a.getBoundingClientRect = () => box(500, 600, 20, 10);
    const b = document.createElement("div");
    b.dataset.placementId = "b";
    b.getBoundingClientRect = () => box(300, 900, 528, 10);
    root.append(split, a, b);
    document.body.appendChild(root);

    const geometry = measureGeometry(root)!;
    expect(geometry.viewport).toEqual({ x: 0, y: 0, width: 1000, height: 600 });
    expect(geometry.placements.get("a")).toEqual({ x: 0, y: 0, width: 500, height: 600 });
    expect(geometry.divider.inline).toBe(8);
    expect(geometry.splits.get("s1")?.width).toBe(1000);
    // The engine's pure math over the measured value: a's longer side is its height…
    expect(longerAxis(geometry, "a", "row")).toBe("col");
    expect(longerAxis(geometry, "b", "row")).toBe("col");
    // …a 300px-wide tile cannot split side by side under the 240px minimum, but can stack.
    expect(canSplitPlacement(geometry, "b", "row", DEFAULT_PANE_CONSTRAINTS)).toBe(false);
    expect(canSplitPlacement(geometry, "b", "col", DEFAULT_PANE_CONSTRAINTS)).toBe(true);
    expect(splitRatioBounds(geometry, "s1", "row", DEFAULT_PANE_CONSTRAINTS)).toEqual({ min: 240 / 992, max: 1 - 240 / 992 });
  });
});
