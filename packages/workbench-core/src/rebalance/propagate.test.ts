import { describe, expect, test } from "vitest";
import { layoutBinary, toAnalysis } from "./analysisTree";
import { diagnose, propagate, violations } from "./propagate";
import { BOOK, compound, healthy, skinnyCol, wideRow9 } from "./testTrees";
import type { Node } from "@hyperslop-systems/workbench-protocol";

/**
 * Fixtures use the textbook's reference configuration (§1.10): 1072×656,
 * min 190×130, gap 8 — so the expected numbers below are the book's numbers.
 */
const CFG = { minInlinePx: BOOK.minW, minBlockPx: BOOK.minH, dividerPx: BOOK.gap };

function analysisOf(tree: Node) {
  return toAnalysis(tree, layoutBinary(tree, BOOK.rect, BOOK.gap), {});
}

describe("propagate (textbook numbers)", () => {
  test("COMPOUND needs 586×268 and fits", () => {
    const need = propagate(analysisOf(compound()), CFG, new Map());
    expect(Math.round(need.w)).toBe(586);
    expect(Math.round(need.h)).toBe(268);
  });

  test("SKINNY COL needs 388×820 — impossible in height", () => {
    const need = propagate(analysisOf(skinnyCol()), CFG, new Map());
    expect(Math.round(need.w)).toBe(388);
    expect(Math.round(need.h)).toBe(820); // 6·130 + 5·8
  });

  test("WIDE ROW 9 needs 1774×130 — impossible in width", () => {
    const need = propagate(analysisOf(wideRow9()), CFG, new Map());
    expect(Math.round(need.w)).toBe(1774); // 9·190 + 8·8
    expect(Math.round(need.h)).toBe(130);
  });
});

describe("violations (textbook numbers)", () => {
  test("COMPOUND: C and D are starved, D worst by ~129px", () => {
    const v = violations(analysisOf(compound()), BOOK.rect, CFG);
    expect(v.map((x) => x.id).sort()).toEqual(["p-C", "p-D"]);
    const d = v.find((x) => x.id === "p-D");
    expect(Math.round(d?.dw ?? 0)).toBe(129); // 190 − 61.44
    expect(Math.round(d?.dh ?? 0)).toBe(33); // 130 − 97.2
    const c = v.find((x) => x.id === "p-C");
    expect(Math.round(c?.dw ?? 0)).toBe(47); // 190 − 143.36
  });

  test("HEALTHY has none", () => {
    expect(violations(analysisOf(healthy()), BOOK.rect, CFG)).toEqual([]);
  });
});

describe("diagnose", () => {
  test("global feasibility distinguishes fixable from impossible", () => {
    expect(diagnose(analysisOf(compound()), BOOK.rect, CFG).fits).toBe(true);
    expect(diagnose(analysisOf(skinnyCol()), BOOK.rect, CFG).fits).toBe(false);
    expect(diagnose(analysisOf(wideRow9()), BOOK.rect, CFG).fits).toBe(false);
  });

  test("capacity at the reference config is 5×4 = 20 (textbook §11.1, minus tabH)", () => {
    const d = diagnose(analysisOf(healthy()), BOOK.rect, CFG);
    expect(d.capacity.cols).toBe(5);
    expect(d.capacity.rows).toBe(4);
    expect(d.capacity.cap).toBe(20);
    expect(d.capacity.overflow).toBe(false);
  });

  test("worst shortfall on COMPOUND is 129px", () => {
    expect(diagnose(analysisOf(compound()), BOOK.rect, CFG).worstShortfallPx).toBe(129);
  });
});
