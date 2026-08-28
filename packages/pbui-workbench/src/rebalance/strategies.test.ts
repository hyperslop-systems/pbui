import { describe, expect, test } from "vitest";
import { Direction, type Node } from "@hyperslop-systems/workbench-protocol";
import { layoutAnalysis, layoutBinary, toAnalysis, type ASplit } from "./analysisTree";
import { classify, dividerDiff, layoutStats } from "./measure";
import { newRepairContext, repairPass } from "./repairPass";
import { stratBalance, stratProject, stratRipple, stratSparse, type Strategy, type StrategyConfig } from "./strategies";
import { BOOK, chain, compound, fourDonors, pane, wideRow9 } from "./testTrees";
import type { TraceLine } from "./trace";

const CFG: StrategyConfig = {
  minInlinePx: BOOK.minW,
  minBlockPx: BOOK.minH,
  dividerPx: BOOK.gap,
  hystPx: 0,
  donorOrder: "near",
};

function analysisOf(tree: Node) {
  return toAnalysis(tree, layoutBinary(tree, BOOK.rect, BOOK.gap), {});
}

function repair(tree: Node, strategy: Strategy, cfg: StrategyConfig = CFG) {
  const root = structuredClone(analysisOf(tree));
  const ctx = newRepairContext();
  const trace: TraceLine[] = [];
  for (const line of repairPass(root, BOOK.rect, cfg, strategy, ctx)) trace.push(line);
  const widths = new Map(
    [...layoutAnalysis(root, BOOK.rect, cfg.dividerPx)].map(([id, r]) => [id, r.w] as const),
  );
  return { root, ctx, trace, widths };
}

/** Current pixel widths of FOUR DONORS' panes under the binary rendering. */
function donorsBefore() {
  const rects = layoutBinary(fourDonors(), BOOK.rect, BOOK.gap);
  return ["p-A", "p-B", "p-C", "p-D"].map((id) => rects.get(id)?.w ?? Number.NaN);
}

describe("FOUR DONORS (textbook §5.3 shape, adapted to pixel-share weights)", () => {
  test("RIPPLE: nearest donor C pays the whole deficit; A and B untouched", () => {
    const [a, b, c, d] = donorsBefore();
    const deficit = BOOK.minW - (d as number);
    const { widths, ctx } = repair(fourDonors(), stratRipple);
    expect(widths.get("p-D")).toBeCloseTo(BOOK.minW, 4);
    expect(widths.get("p-C")).toBeCloseTo((c as number) - deficit, 4);
    expect(widths.get("p-A")).toBeCloseTo(a as number, 4);
    expect(widths.get("p-B")).toBeCloseTo(b as number, 4);
    expect(ctx.infeasible).toBe(false);
  });

  test("PROJECT: D pins to the floor, every free sibling gives up deficit/3", () => {
    const [a, b, c, d] = donorsBefore();
    const deficit = BOOK.minW - (d as number);
    const { widths } = repair(fourDonors(), stratProject);
    expect(widths.get("p-D")).toBeCloseTo(BOOK.minW, 2);
    expect(widths.get("p-A")).toBeCloseTo((a as number) - deficit / 3, 1);
    expect(widths.get("p-B")).toBeCloseTo((b as number) - deficit / 3, 1);
    expect(widths.get("p-C")).toBeCloseTo((c as number) - deficit / 3, 1);
  });

  test("BALANCE: every pane 262px regardless of need (the control)", () => {
    const { widths } = repair(fourDonors(), stratBalance);
    for (const id of ["p-A", "p-B", "p-C", "p-D"]) {
      expect(widths.get(id)).toBeCloseTo((BOOK.rect.w - 3 * BOOK.gap) / 4, 4); // 262
    }
  });

  test("SPARSE agrees with RIPPLE here: one donor can pay in full", () => {
    const ripple = repair(fourDonors(), stratRipple);
    const sparse = repair(fourDonors(), stratSparse);
    for (const id of ["p-A", "p-B", "p-C", "p-D"]) {
      expect(sparse.widths.get(id)).toBeCloseTo(ripple.widths.get(id) ?? Number.NaN, 4);
    }
    expect(sparse.trace.some((l) => /single donor/.test(l.t))).toBe(true);
  });

  test("tiers are measured: RIPPLE moves one divider (W1), PROJECT moves three (W+)", () => {
    const before = analysisOf(fourDonors());
    const ripple = repair(fourDonors(), stratRipple);
    const project = repair(fourDonors(), stratProject);
    const rippleStats = layoutStats(ripple.root, BOOK.rect, CFG, layoutAnalysis(before, BOOK.rect, BOOK.gap));
    const projectStats = layoutStats(project.root, BOOK.rect, CFG, layoutAnalysis(before, BOOK.rect, BOOK.gap));
    expect(dividerDiff(before, ripple.root)).toBe(1);
    expect(classify(before, ripple.root, "weights", rippleStats).tier).toBe(1);
    expect(dividerDiff(before, project.root)).toBe(3);
    expect(classify(before, project.root, "weights", projectStats).tier).toBe(2);
  });
});

describe("escalation and infeasibility", () => {
  test("WIDE ROW 9: globally infeasible; ripple finds no donors and changes nothing", () => {
    const { ctx, trace, root } = repair(wideRow9(), stratRipple);
    expect(ctx.globalInfeasible).toBe(true);
    expect(trace.some((l) => /GLOBALLY INFEASIBLE/.test(l.t))).toBe(true);
    const stats = layoutStats(root, BOOK.rect, CFG, layoutAnalysis(analysisOf(wideRow9()), BOOK.rect, BOOK.gap));
    expect(stats.viol).toBe(9);
  });

  test("COMPOUND cascade (§4.2): three borrowings at three depths, zero violations left", () => {
    const { root, ctx, trace } = repair(compound(), stratRipple);
    const stats = layoutStats(root, BOOK.rect, CFG, null);
    expect(stats.viol).toBe(0);
    expect(ctx.infeasible).toBe(false);
    // The root satisfies the Col's AGGREGATE requirement without knowing D
    // exists; D's own shortfall is addressed only at the third level.
    expect(trace.filter((l) => /take \d+px from/.test(l.t)).length).toBe(3);
  });
});

describe("hysteresis (trigger only, never the target)", () => {
  const shortBy30 = () => chain(Direction.ROW, [pane("A"), pane("B")], [160 / 1064, 904 / 1064]);

  test("deficit below the threshold does not trigger", () => {
    const { root } = repair(shortBy30(), stratRipple, { ...CFG, hystPx: 50 });
    const widths = layoutAnalysis(root, BOOK.rect, BOOK.gap);
    expect(widths.get("p-A")?.w).toBeCloseTo(160, 1);
  });

  test("deficit above the threshold repairs to the FULL requirement", () => {
    const { root } = repair(shortBy30(), stratRipple, { ...CFG, hystPx: 10 });
    const widths = layoutAnalysis(root, BOOK.rect, BOOK.gap);
    expect(widths.get("p-A")?.w).toBeCloseTo(BOOK.minW, 1);
  });
});

describe("weight invariants", () => {
  test("every strategy returns Σw = 1", () => {
    for (const strategy of [stratRipple, stratSparse, stratProject, stratBalance]) {
      const { root } = repair(fourDonors(), strategy);
      const split = root as ASplit;
      expect(split.w.reduce((s, v) => s + v, 0)).toBeCloseTo(1, 6);
    }
  });
});
