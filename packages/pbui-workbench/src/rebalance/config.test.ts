import { describe, expect, test } from "vitest";
import {
  DEFAULT_RELAX,
  normalizeConfig,
  RELAX_ITERS_MAX,
  RELAX_ITERS_MIN,
} from "./config";

describe("normalizeConfig relax.iters (PR #20 review)", () => {
  test("clamps an oversized persisted count to the UI maximum", () => {
    const config = normalizeConfig({ relax: { ...DEFAULT_RELAX, iters: 1e9 } });
    expect(config.relax.iters).toBe(RELAX_ITERS_MAX);
  });

  test("raises an undersized persisted count to the UI minimum", () => {
    const config = normalizeConfig({ relax: { ...DEFAULT_RELAX, iters: 0 } });
    expect(config.relax.iters).toBe(RELAX_ITERS_MIN);
  });

  test("rounds a fractional count to an integer", () => {
    const config = normalizeConfig({ relax: { ...DEFAULT_RELAX, iters: 42.7 } });
    expect(config.relax.iters).toBe(43);
  });

  test("non-finite and non-numeric counts fall back to the default", () => {
    for (const iters of [Number.NaN, Number.POSITIVE_INFINITY, "60", null, undefined]) {
      const config = normalizeConfig({ relax: { ...DEFAULT_RELAX, iters } });
      expect(config.relax.iters, String(iters)).toBe(DEFAULT_RELAX.iters);
    }
  });

  test("in-range counts pass through unchanged", () => {
    const config = normalizeConfig({ relax: { ...DEFAULT_RELAX, iters: 120 } });
    expect(config.relax.iters).toBe(120);
  });
});
