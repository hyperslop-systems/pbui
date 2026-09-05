import { describe, expect, it } from "vitest";
import { Direction, type Node } from "@hyperslop-systems/workbench-protocol";
import { leafNode, splitNode } from "@hyperslop-systems/workbench-protocol/client";
import { sequentialIds } from "../testing";
import { DEFAULT_REBALANCE_CONFIG, profileConfig } from "./config";
import { preservesPlacements } from "./law";
import { buildSlate } from "./slate";

/**
 * Guide §11.4 property: every proposal `buildSlate` emits satisfies the
 * rebalance law. Trees are generated from a small deterministic grammar
 * (depth, skew, orientation) rather than hand-picked, so the check covers
 * the reshape and rebuild generators as well as the weight repairs.
 */
function tree(shape: number, depth: number, ids: () => string): Node {
  if (depth === 0) return leafNode(ids(), ids);
  const bit = (shape >> depth) & 1;
  const ratio = shape % 3 === 0 ? 0.5 : shape % 3 === 1 ? 0.12 : 0.85;
  return splitNode(bit ? Direction.ROW : Direction.COLUMN, tree(shape >> 1, depth - 1, ids), tree(shape >> 2, depth - 1, ids), ratio, ids);
}

describe("the rebalance law", () => {
  it("every proposal of every generator preserves the placement→view map", () => {
    let proposals = 0;
    for (let depth = 1; depth <= 3; depth += 1) {
      for (let shape = 0; shape < 16; shape += 1) {
        const gen = sequentialIds(shape * 100 + depth);
        const ids = () => gen("n");
        const root = tree(shape, depth, ids);
        for (const config of [DEFAULT_REBALANCE_CONFIG, profileConfig("anything")]) {
          const slate = buildSlate({ tree: root, rect: { x: 0, y: 0, w: 900, h: 500 }, dividerPx: 8, labels: new Map() }, config);
          for (const proposal of slate.proposals) {
            if (proposal.apply.kind !== "set-tree") continue;
            proposals += 1;
            expect(preservesPlacements(root, proposal.apply.tree)).toBe(true);
          }
        }
      }
    }
    expect(proposals).toBeGreaterThan(0);
  });

  it("refuses a tree that drops, adds, or retargets a leaf", () => {
    const ids = sequentialIds();
    const a = leafNode("v1", ids);
    const b = leafNode("v2", ids);
    const root = splitNode(Direction.ROW, a, b, 0.5, ids);
    expect(preservesPlacements(root, splitNode(Direction.COLUMN, b, a, 0.3, ids))).toBe(true);
    expect(preservesPlacements(root, a)).toBe(false);
    expect(preservesPlacements(root, splitNode(Direction.ROW, a, leafNode("v3", ids), 0.5, ids))).toBe(false);
    const retargeted = splitNode(Direction.ROW, a, { ...b, body: { case: "leaf", value: { viewId: "v9" } } } as Node, 0.5, ids);
    expect(preservesPlacements(root, retargeted)).toBe(false);
  });
});
