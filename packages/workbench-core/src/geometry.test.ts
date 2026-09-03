import { describe, expect, it } from "vitest";
import { split, tile } from "./document";
import { canSplitPlacement, layoutFits, longerAxis, paneRatioBounds, splitRatioBounds, type GeometrySnapshot } from "./geometry";
import { DEFAULT_PANE_CONSTRAINTS } from "./policy";

const measured: GeometrySnapshot = {
  viewport: { x: 0, y: 0, width: 1000, height: 400 },
  divider: { inline: 10, block: 10 },
  placements: new Map([
    ["wide", { x: 0, y: 0, width: 700, height: 300 }],
    ["tall", { x: 0, y: 0, width: 250, height: 800 }],
    ["tiny", { x: 0, y: 0, width: 200, height: 100 }],
  ]),
  splits: new Map([["s", { x: 0, y: 0, width: 1000, height: 400 }]]),
};

describe("headless fallbacks are deterministic", () => {
  it("without geometry every split is feasible, the axis is the policy's, and bounds are the relative floor", () => {
    expect(canSplitPlacement(null, "anything", "row", DEFAULT_PANE_CONSTRAINTS)).toBe(true);
    expect(longerAxis(null, "anything", "col")).toBe("col");
    expect(splitRatioBounds(null, "s", "row", DEFAULT_PANE_CONSTRAINTS)).toEqual({ min: 0.1, max: 0.9 });
    expect(paneRatioBounds(null, 240, 0.1)).toEqual({ min: 0.1, max: 0.9 });
    expect(layoutFits(split("row", 0.5, tile("a"), tile("b")), null, DEFAULT_PANE_CONSTRAINTS)).toBe(true);
    expect(layoutFits(split("row", 0.05, tile("a"), tile("b")), null, DEFAULT_PANE_CONSTRAINTS)).toBe(false);
  });

  it("with geometry the rendered pixel minima decide", () => {
    expect(canSplitPlacement(measured, "wide", "row", DEFAULT_PANE_CONSTRAINTS)).toBe(true);
    expect(canSplitPlacement(measured, "tall", "row", DEFAULT_PANE_CONSTRAINTS)).toBe(false);
    expect(canSplitPlacement(measured, "tall", "col", DEFAULT_PANE_CONSTRAINTS)).toBe(true);
    expect(canSplitPlacement(measured, "tiny", "col", DEFAULT_PANE_CONSTRAINTS)).toBe(false);
    expect(canSplitPlacement(measured, "unmeasured", "row", DEFAULT_PANE_CONSTRAINTS)).toBe(true);
    expect(longerAxis(measured, "wide", "col")).toBe("row");
    expect(longerAxis(measured, "tall", "row")).toBe("col");
    expect(splitRatioBounds(measured, "s", "row", DEFAULT_PANE_CONSTRAINTS)).toEqual({ min: 240 / 990, max: 1 - 240 / 990 });
    expect(splitRatioBounds(measured, "s", "col", DEFAULT_PANE_CONSTRAINTS)).toEqual({ min: 160 / 390, max: 1 - 160 / 390 });
    expect(splitRatioBounds({ ...measured, splits: new Map([["s", { x: 0, y: 0, width: 1000, height: 300 }]]) }, "s", "col", DEFAULT_PANE_CONSTRAINTS)).toBeNull();
    // A nested layout whose second row would be a sliver at this viewport.
    expect(layoutFits(split("col", 0.5, tile("a"), split("col", 0.5, tile("b"), tile("c"))), measured, DEFAULT_PANE_CONSTRAINTS)).toBe(false);
    expect(layoutFits(split("row", 0.5, tile("a"), tile("b")), measured, DEFAULT_PANE_CONSTRAINTS)).toBe(true);
  });
});
