import { describe, expect, test } from "vitest";
import { projectLower } from "./projectLower";
import { rng } from "./testTrees";

describe("projectLower", () => {
  test("textbook §5.2 verification vector", () => {
    const out = projectLower([0.5, 0.3, 0.2], [0.25, 0.35, 0.1]);
    expect(out[0]).toBeCloseTo(0.475, 4);
    expect(out[1]).toBeCloseTo(0.35, 4); // pinned to its floor
    expect(out[2]).toBeCloseTo(0.175, 4);
    expect(out.reduce((s, v) => s + v, 0)).toBeCloseTo(1, 9);
  });

  test("infeasible floors return the floors proportionally scaled", () => {
    const out = projectLower([0.5, 0.5], [0.8, 0.6]);
    expect(out[0]).toBeCloseTo(0.8 / 1.4, 6);
    expect(out[1]).toBeCloseTo(0.6 / 1.4, 6);
  });

  test("property: sums to 1, respects floors, idempotent", () => {
    const rand = rng(3);
    for (let round = 0; round < 200; round++) {
      const n = 2 + Math.floor(rand() * 6);
      const raw = Array.from({ length: n }, () => 0.01 + rand());
      const total = raw.reduce((s, v) => s + v, 0);
      const w = raw.map((v) => v / total);
      const l = w.map(() => (rand() * 0.9) / n);
      const out = projectLower(w, l);
      expect(out.reduce((s, v) => s + v, 0)).toBeCloseTo(1, 6);
      out.forEach((x, i) => expect(x).toBeGreaterThanOrEqual((l[i] ?? 0) - 1e-9));
      const again = projectLower(out, l);
      again.forEach((x, i) => expect(x).toBeCloseTo(out[i] ?? Number.NaN, 6));
    }
  });
});
