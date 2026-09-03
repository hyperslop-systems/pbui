import { describe, expect, test } from "vitest";
import type { Node } from "@hyperslop-systems/workbench-protocol";
import { layoutAnalysis, layoutBinary, panesOf, toAnalysis, type ASplit } from "./analysisTree";
import { violations } from "./propagate";
import { newRepairContext } from "./repairPass";
import {
  algoRebuild,
  algoReshape,
  applyStructuralMutation,
  emitBinary,
  hungarian,
  normalizeAnalysis,
  structuralMutationsOf,
  type StructuralConfig,
} from "./structural";
import { BOOK, randomTree, rng, skinnyCol, wideRow9 } from "./testTrees";
import type { TraceLine } from "./trace";

const CFG: StructuralConfig = {
  minInlinePx: BOOK.minW,
  minBlockPx: BOOK.minH,
  dividerPx: BOOK.gap,
  hystPx: 0,
  donorOrder: "near",
  targetAspect: 1.4,
};

function analysisOf(tree: Node) {
  return toAnalysis(tree, layoutBinary(tree, BOOK.rect, BOOK.gap), {});
}

describe("hungarian", () => {
  test("textbook §10.2 fixture: assignment [1,0,2], total 5", () => {
    const assignment = hungarian([
      [4, 1, 3],
      [2, 0, 5],
      [3, 2, 2],
    ]);
    expect(assignment).toEqual([1, 0, 2]);
  });
});

describe("mutations and normalization", () => {
  test("transpose can create same-axis nesting, which normalize flattens", () => {
    const root = analysisOf(skinnyCol()) as ASplit; // Row[BIG, Col(6)]
    const inner = root.ch[1] as ASplit;
    const mutated = applyStructuralMutation(root, { k: "transpose", id: inner.id, d: "" }) as ASplit;
    // Col(6) became Row(6) inside a Row — flattening yields one Row(7).
    expect(mutated.t).toBe("s");
    expect(mutated.axis).toBe("h");
    expect(mutated.ch).toHaveLength(7);
  });

  test("regroup wraps a run in a perpendicular sub-split", () => {
    const root = analysisOf(wideRow9()) as ASplit;
    const m = structuralMutationsOf(root).find((x) => x.k === "regroup");
    expect(m).toBeDefined();
    const mutated = applyStructuralMutation(root, m!) as ASplit;
    expect(mutated.ch.some((c) => c.t === "s" && c.axis === "v")).toBe(true);
    expect(panesOf(mutated)).toHaveLength(9); // nothing lost
  });
});

describe("RESHAPE", () => {
  test("SKINNY COL (§9.3): regrouping the impossible column reaches zero violations", () => {
    const root = analysisOf(skinnyCol());
    const ctx = newRepairContext() as ReturnType<typeof newRepairContext> & { tree?: ReturnType<typeof analysisOf> };
    const trace: TraceLine[] = [];
    for (const line of algoReshape(root, BOOK.rect, CFG, ctx, { maxMoves: 4, minGain: 0.05 })) trace.push(line);
    const result = ctx.tree!;
    expect(violations(result, BOOK.rect, CFG)).toEqual([]);
    expect(trace.some((l) => /regroup/.test(l.t))).toBe(true);
    expect(panesOf(result)).toHaveLength(7);
  });

  test("WIDE ROW 9: structurally impossible for weights, fixed by reshape", () => {
    const root = analysisOf(wideRow9());
    const ctx = newRepairContext() as ReturnType<typeof newRepairContext> & { tree?: ReturnType<typeof analysisOf> };
    for (const _ of algoReshape(root, BOOK.rect, CFG, ctx, { maxMoves: 4, minGain: 0.05 })) {
      // run to completion
    }
    expect(violations(ctx.tree!, BOOK.rect, CFG)).toEqual([]);
  });

  test("the original tree is never mutated by the search", () => {
    const root = analysisOf(skinnyCol());
    const snapshot = JSON.stringify(root);
    const ctx = newRepairContext() as ReturnType<typeof newRepairContext> & { tree?: ReturnType<typeof analysisOf> };
    for (const _ of algoReshape(root, BOOK.rect, CFG, ctx)) {
      // run to completion
    }
    expect(JSON.stringify(root)).toBe(snapshot);
  });
});

describe("REBUILD", () => {
  test("grid over SKINNY COL: fresh topology, every tile fits, identity preserved", () => {
    const root = analysisOf(skinnyCol());
    const ctx = newRepairContext() as ReturnType<typeof newRepairContext> & { tree?: ReturnType<typeof analysisOf> };
    const trace: TraceLine[] = [];
    for (const line of algoRebuild(root, BOOK.rect, CFG, ctx, "grid")) trace.push(line);
    const result = ctx.tree!;
    expect(violations(result, BOOK.rect, CFG)).toEqual([]);
    expect(new Set(panesOf(result).map((p) => p.id))).toEqual(new Set(panesOf(root).map((p) => p.id)));
    expect(trace.some((l) => /min-cost assignment/.test(l.t))).toBe(true);
  });
});

describe("emitBinary", () => {
  test("emitted protocol tree renders the same pane rects as the analysis tree", () => {
    const rand = rng(31);
    let exactRounds = 0;
    for (let round = 0; round < 40; round++) {
      const tree = randomTree(2 + Math.floor(rand() * 8), rand);
      const analysis = normalizeAnalysis(analysisOf(tree));
      const emitted = emitBinary(analysis, BOOK.rect, BOOK.gap);
      // Exactness holds only where the server's [0.05, 0.95] ratio clamp did
      // not bite; a clamped ratio deliberately trades geometry for validity.
      let clamped = false;
      const scan = (node: Node): void => {
        if (node.body.case !== "split") return;
        const { ratio, a, b } = node.body.value;
        if (ratio === 0.05 || ratio === 0.95) clamped = true;
        if (a) scan(a);
        if (b) scan(b);
      };
      scan(emitted);
      if (clamped) continue;
      exactRounds++;
      const emittedRects = layoutBinary(emitted, BOOK.rect, BOOK.gap);
      const wanted = layoutAnalysis(analysis, BOOK.rect, BOOK.gap);
      for (const pane of panesOf(analysis)) {
        const a = emittedRects.get(pane.id);
        const b = wanted.get(pane.id);
        for (const key of ["x", "y", "w", "h"] as const) {
          expect(Math.abs((a?.[key] ?? 0) - (b?.[key] ?? 0)), `pane ${pane.id}.${key} round ${round}`).toBeLessThan(1e-6);
        }
      }
    }
    expect(exactRounds).toBeGreaterThan(10); // the property genuinely ran
  });

  test("leaf placements keep their ids and view ids; splits are minted fresh", () => {
    const analysis = analysisOf(skinnyCol());
    const emitted = emitBinary(analysis, BOOK.rect, BOOK.gap);
    const leafIds: string[] = [];
    const splitIds: string[] = [];
    const walk = (node: Node): void => {
      if (node.body.case === "leaf") leafIds.push(node.id);
      if (node.body.case === "split") {
        splitIds.push(node.id);
        if (node.body.value.a) walk(node.body.value.a);
        if (node.body.value.b) walk(node.body.value.b);
      }
    };
    walk(emitted);
    expect(new Set(leafIds)).toEqual(new Set(panesOf(analysis).map((p) => p.id)));
    for (const id of splitIds) expect(id.startsWith("n-")).toBe(true);
  });

  test("ratios stay inside the server's validation band", () => {
    // An extreme split: 2% / 98% would violate validate.go's [0.05, 0.95].
    const analysis = normalizeAnalysis(analysisOf(skinnyCol())) as ASplit;
    analysis.w = [0.02, 0.98];
    const emitted = emitBinary(analysis, BOOK.rect, BOOK.gap);
    const walk = (node: Node): void => {
      if (node.body.case !== "split") return;
      expect(node.body.value.ratio).toBeGreaterThanOrEqual(0.05);
      expect(node.body.value.ratio).toBeLessThanOrEqual(0.95);
      if (node.body.value.a) walk(node.body.value.a);
      if (node.body.value.b) walk(node.body.value.b);
    };
    walk(emitted);
  });
});
