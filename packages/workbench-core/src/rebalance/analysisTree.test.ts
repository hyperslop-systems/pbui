import { describe, expect, test } from "vitest";
import { Direction, type Node } from "@hyperslop-systems/workbench-protocol";
import {
  analysisToResizes,
  layoutAnalysis,
  layoutBinary,
  panesOf,
  toAnalysis,
  type ASplit,
  type Rect,
  type SplitResize,
} from "./analysisTree";
import { BOOK, chain, compound, pane, randomTree, rng, row } from "./testTrees";

const RECT: Rect = { x: 0, y: 0, w: 1000, h: 600 };
const DIV = 10;

function analysisOf(tree: Node, rect: Rect = RECT, dividerPx = DIV) {
  return toAnalysis(tree, layoutBinary(tree, rect, dividerPx), {});
}

/** Apply a resize batch to a protocol tree (what the applier would do). */
function applyResizes(tree: Node, resizes: SplitResize[]): Node {
  const byId = new Map(resizes.map((r) => [r.splitId, r.ratio]));
  const walk = (node: Node): void => {
    if (node.body.case !== "split") return;
    const ratio = byId.get(node.id);
    if (ratio !== undefined) node.body.value.ratio = ratio;
    if (node.body.value.a) walk(node.body.value.a);
    if (node.body.value.b) walk(node.body.value.b);
  };
  const clone = structuredClone(tree);
  walk(clone);
  return clone;
}

describe("toAnalysis flattening", () => {
  test("right-leaning row chain flattens to one 3-way split", () => {
    const tree = chain(Direction.ROW, ["A", "B", "C"].map(pane));
    const split = analysisOf(tree) as ASplit;
    expect(split.t).toBe("s");
    expect(split.axis).toBe("h");
    expect(split.ch.map((c) => c.t === "p" && c.name)).toEqual(["view-A", "view-B", "view-C"]);
    expect(split.chain).toHaveLength(2);
    expect(split.chain[0]?.leftCount).toBe(1);
    expect(split.w.reduce((s, v) => s + v, 0)).toBeCloseTo(1, 9);
  });

  test("left-leaning chain records leftCount 2", () => {
    const tree = row(row(pane("A"), pane("B"), 0.5), pane("C"), 2 / 3);
    const split = analysisOf(tree) as ASplit;
    expect(split.ch).toHaveLength(3);
    expect(split.chain[0]?.leftCount).toBe(2);
  });

  test("perpendicular splits never flatten", () => {
    const split = analysisOf(compound(), BOOK.rect, BOOK.gap) as ASplit;
    expect(split.ch).toHaveLength(2);
    const inner = split.ch[1] as ASplit;
    expect(inner.axis).toBe("v");
    expect(inner.ch).toHaveLength(2);
  });

  test("weights are pixel shares: layoutAnalysis reproduces layoutBinary exactly", () => {
    const tree = chain(Direction.ROW, ["A", "B", "C"].map(pane));
    const binary = layoutBinary(tree, RECT, DIV);
    const analysis = layoutAnalysis(analysisOf(tree), RECT, DIV);
    for (const p of ["p-A", "p-B", "p-C"]) {
      expect(analysis.get(p)?.w).toBeCloseTo(binary.get(p)?.w ?? Number.NaN, 6);
      expect(analysis.get(p)?.x).toBeCloseTo(binary.get(p)?.x ?? Number.NaN, 6);
    }
    // The pixel shares are NOT the mass-ratio products: with nested dividers
    // the head child of an equal-mass chain renders wider than the tail ones.
    const binaryA = binary.get("p-A")?.w ?? 0;
    expect(binaryA).not.toBeCloseTo((RECT.w - 2 * DIV) / 3, 0);
  });
});

describe("layout parity (property)", () => {
  test("analysis rects equal binary rects for random trees", () => {
    const rand = rng(7);
    for (let round = 0; round < 40; round++) {
      const tree = randomTree(2 + Math.floor(rand() * 9), rand);
      const binary = layoutBinary(tree, RECT, DIV);
      const analysis = layoutAnalysis(analysisOf(tree), RECT, DIV);
      for (const p of panesOf(analysisOf(tree))) {
        const a = analysis.get(p.id);
        const b = binary.get(p.id);
        expect(a, `pane ${p.id} round ${round}`).toBeDefined();
        for (const key of ["x", "y", "w", "h"] as const) {
          expect(Math.abs((a?.[key] ?? 0) - (b?.[key] ?? 0)), `pane ${p.id}.${key} round ${round}`).toBeLessThan(1e-6);
        }
      }
    }
  });
});

describe("analysisToResizes write-back", () => {
  test("unchanged weights emit no resizes", () => {
    const rand = rng(11);
    for (let round = 0; round < 20; round++) {
      const tree = randomTree(2 + Math.floor(rand() * 8), rand);
      expect(analysisToResizes(analysisOf(tree), RECT, DIV)).toEqual([]);
    }
  });

  test("worked example: equalized 3-chain, then re-skewed to [.5,.25,.25]", () => {
    const tree = chain(Direction.ROW, ["A", "B", "C"].map(pane));
    const split = analysisOf(tree) as ASplit;
    split.w = [0.5, 0.25, 0.25];
    const resizes = analysisToResizes(split, RECT, DIV);
    expect(resizes.length).toBeGreaterThan(0);
    const rects = layoutBinary(applyResizes(tree, resizes), RECT, DIV);
    const avail = RECT.w - 2 * DIV;
    expect(rects.get("p-A")?.w).toBeCloseTo(0.5 * avail, 6);
    expect(rects.get("p-B")?.w).toBeCloseTo(0.25 * avail, 6);
    expect(rects.get("p-C")?.w).toBeCloseTo(0.25 * avail, 6);
  });

  test("property: repaired weights round-trip through ratios to exact pixels", () => {
    const rand = rng(23);
    for (let round = 0; round < 40; round++) {
      const tree = randomTree(2 + Math.floor(rand() * 9), rand);
      const analysis = analysisOf(tree);
      // Perturb every split's weights to a fresh random distribution.
      const perturb = (node: typeof analysis): void => {
        if (node.t === "p") return;
        const raw = node.ch.map(() => 0.05 + rand());
        const total = raw.reduce((s, v) => s + v, 0);
        node.w = raw.map((v) => v / total);
        node.ch.forEach(perturb);
      };
      perturb(analysis);
      const resizes = analysisToResizes(analysis, RECT, DIV);
      const applied = layoutBinary(applyResizes(tree, resizes), RECT, DIV);
      const wanted = layoutAnalysis(analysis, RECT, DIV);
      for (const p of panesOf(analysis)) {
        for (const key of ["x", "y", "w", "h"] as const) {
          expect(
            Math.abs((applied.get(p.id)?.[key] ?? 0) - (wanted.get(p.id)?.[key] ?? 0)),
            `pane ${p.id}.${key} round ${round}`,
          ).toBeLessThan(1e-6);
        }
      }
    }
  });
});
