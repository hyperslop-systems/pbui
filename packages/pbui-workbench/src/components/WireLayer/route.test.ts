import { describe, expect, test } from "vitest";
import { Lanes, routeAround, toPath } from "./route";

const bounds = { left: 0, top: 0, right: 600, bottom: 300 };

describe("routeAround", () => {
  test("a clear field: three segments, out then over then in", () => {
    const points = routeAround({ x: 100, y: 50 }, { x: 500, y: 150 }, [], new Lanes(), { bounds });
    expect(points).not.toBeNull();
    expect(points![0]).toEqual({ x: 100, y: 50 });
    expect(points![points!.length - 1]).toEqual({ x: 500, y: 150 });
    for (let i = 1; i < points!.length; i++) {
      const a = points![i - 1]!;
      const b = points![i]!;
      expect(a.x === b.x || a.y === b.y).toBe(true);
    }
  });

  test("a tile in the way is gone around, not through", () => {
    const wall = { left: 250, top: 0, right: 350, bottom: 200 };
    const points = routeAround({ x: 100, y: 50 }, { x: 500, y: 50 }, [wall], new Lanes(), { bounds });
    expect(points).not.toBeNull();
    // Every horizontal segment crossing the wall's x-range must lie below it.
    for (let i = 1; i < points!.length; i++) {
      const a = points![i - 1]!;
      const b = points![i]!;
      if (a.y === b.y && Math.min(a.x, b.x) < 350 && Math.max(a.x, b.x) > 250) expect(a.y).toBeGreaterThan(200);
    }
  });

  test("a second wire on the same run takes another lane", () => {
    const lanes = new Lanes();
    const first = routeAround({ x: 100, y: 50 }, { x: 500, y: 250 }, [], lanes, { bounds });
    const second = routeAround({ x: 100, y: 60 }, { x: 500, y: 240 }, [], lanes, { bounds });
    expect(toPath(first!)).not.toEqual(toPath(second!));
  });
});
