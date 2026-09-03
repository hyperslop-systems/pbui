import { describe, expect, test } from "vitest";
import { Direction, type Node } from "@hyperslop-systems/workbench-protocol";
import { buildSlate } from "./slate";
import { profileConfig } from "./config";
import { BOOK, chain, pane } from "./testTrees";

/**
 * The Phase 6 perf guard: the FULL slate — every ANYTHING-profile generator
 * including RELAX's 60-iteration gradient and the O(n³) rebuild assignment —
 * must stay comfortably interactive for a 12-tile workspace. The textbook's
 * lab numbers (§12.3) total well under 10ms; this guard uses a generous
 * multiple so CI machines never flake while a real regression (an accidental
 * O(2ⁿ) reshape, an unbounded iteration) still fails loudly.
 */

function twelveTiles(): Node {
  const rows = [0, 1, 2].map((row) =>
    chain(
      Direction.ROW,
      [0, 1, 2, 3].map((col) => pane(`${row}-${col}`)),
      [0.4, 0.3, 0.2, 0.1],
    ),
  );
  return chain(Direction.COLUMN, rows, [0.5, 0.3, 0.2]);
}

describe("slate build cost (Phase 6 guard)", () => {
  test("every generator over 12 skewed tiles stays interactive", () => {
    const cfg = profileConfig("anything");
    const input = { tree: twelveTiles(), rect: BOOK.rect, dividerPx: BOOK.gap, labels: new Map<string, string>() };
    // Warm once (module JIT, first-call allocations), then measure the
    // median of five builds — the number a keypress actually pays.
    buildSlate(input, cfg);
    const times: number[] = [];
    for (let i = 0; i < 5; i++) {
      const start = performance.now();
      const slate = buildSlate(input, cfg);
      times.push(performance.now() - start);
      expect(slate.proposals.length).toBeGreaterThan(1);
    }
    const median = times.sort((a, b) => a - b)[2] ?? Number.NaN;
    // Lab total ≈ 9ms on the reference machine; 50ms is the loud-failure
    // line, not the aspiration. Logged so a slow drift is visible in CI.
    console.info(`slate build median over 12 tiles: ${median.toFixed(1)}ms`);
    expect(median).toBeLessThan(50);
  });
});
