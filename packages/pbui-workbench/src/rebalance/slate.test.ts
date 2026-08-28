import { describe, expect, test } from "vitest";
import type { Node } from "@hyperslop-systems/workbench-protocol";
import { profileConfig, type RebalanceConfig } from "./config";
import { buildSlate, type RebalanceInput } from "./slate";
import { BOOK, col, fourDonors, healthy, pane, row, skinnyCol, sliver, wideRow9 } from "./testTrees";

const ALL = ["ripple", "ripple-slack", "sparse", "project", "balance"];
const STRUCTURAL = ["reshape-1", "reshape-4", "rebuild-grid", "rebuild-master", "rebuild-columns"];

function input(tree: Node): RebalanceInput {
  return { tree, rect: BOOK.rect, dividerPx: BOOK.gap, labels: new Map() };
}

function cfg(over: Partial<RebalanceConfig> = {}): RebalanceConfig {
  return {
    ...profileConfig("anything"),
    minInlinePx: BOOK.minW,
    minBlockPx: BOOK.minH,
    enabledGenerators: ALL,
    ...over,
  };
}

describe("buildSlate", () => {
  test("HEALTHY: the no-op generators agree with LEAVE AS IS, which is recommended", () => {
    const slate = buildSlate(input(healthy()), cfg());
    const baseline = slate.proposals[0];
    expect(baseline?.baseline).toBe(true);
    expect(baseline?.recommended).toBe(true);
    expect(baseline?.agrees.join(" ")).toMatch(/RIPPLE/);
    expect(baseline?.agrees.join(" ")).toMatch(/PROJECT/);
    expect(baseline?.why).toMatch(/already clears its minimum/);
    // BALANCE always acts, so it survives as its own (unrecommended) card.
    const balance = slate.proposals.find((p) => p.agrees.some((a) => a.startsWith("BALANCE")));
    expect(balance?.baseline).toBe(false);
    expect(balance?.recommended).toBe(false);
  });

  test("SLIVER: every targeted repair lands on the same geometry and merges into one card", () => {
    const slate = buildSlate(input(sliver()), cfg());
    const merged = slate.proposals.find((p) => p.agrees.some((a) => a.startsWith("RIPPLE")));
    expect(merged).toBeDefined();
    for (const name of ["RIPPLE (nearest donor)", "RIPPLE (richest donor)", "SPARSE (fewest donors)", "PROJECT (closest in L2)"]) {
      expect(merged?.agrees).toContain(name);
    }
    expect(merged?.stats.viol).toBe(0);
    expect(merged?.recommended).toBe(true);
  });

  test("FOUR DONORS: cards are ordered by invasiveness; ripple beats project beats balance", () => {
    const slate = buildSlate(input(fourDonors()), cfg());
    const order = slate.proposals.map((p) => p.id);
    const ripple = order.indexOf("ripple");
    const project = order.indexOf("project");
    const balance = order.indexOf("balance");
    expect(ripple).toBeGreaterThan(-1);
    expect(ripple).toBeLessThan(project);
    expect(project).toBeLessThan(balance);
    const recommended = slate.proposals.find((p) => p.recommended);
    expect(recommended?.id).toBe("ripple");
    expect(recommended?.apply.kind).toBe("resize-batch");
    if (recommended?.apply.kind === "resize-batch") {
      // One divider moved → exactly one binary ratio changes.
      expect(recommended.apply.verbs).toHaveLength(1);
      expect(recommended.apply.verbs[0]?.kind).toBe("split.resize");
    }
  });

  test("WIDE ROW 9: no proposal reaches zero violations; donor-less repairs agree with the baseline", () => {
    const slate = buildSlate(input(wideRow9()), cfg());
    expect(slate.diagnosis.fits).toBe(false);
    expect(Math.min(...slate.proposals.map((p) => p.stats.viol))).toBeGreaterThan(0);
    const baseline = slate.proposals[0];
    expect(baseline?.baseline).toBe(true);
    expect(baseline?.agrees.length).toBeGreaterThan(1);
    expect(baseline?.why).toMatch(/weights alone cannot help/);
  });

  test("policy: a displacement budget greys BALANCE with the reason attached", () => {
    const slate = buildSlate(input(fourDonors()), cfg({ budget: { panesPct: 100, dispPx: 100 } }));
    const balance = slate.proposals.find((p) => p.id === "balance");
    expect(balance?.policy.ok).toBe(false);
    expect(balance?.policy.reason).toMatch(/over budget/);
    // Greyed proposals stay visible — the slate never hides restraint.
    expect(slate.proposals.some((p) => p.id === "balance")).toBe(true);
  });

  test("disabled generators do not run", () => {
    const slate = buildSlate(input(fourDonors()), cfg({ enabledGenerators: ["ripple"] }));
    expect(slate.proposals.every((p) => p.baseline || p.id === "ripple")).toBe(true);
  });

  test("SKINNY COL: only structural proposals reach zero violations, and one wins the PICK", () => {
    const slate = buildSlate(input(skinnyCol()), cfg({ enabledGenerators: [...ALL, ...STRUCTURAL] }));
    expect(slate.diagnosis.fits).toBe(false);
    const weightCards = slate.proposals.filter((p) => !p.baseline && (p.tier === 1 || p.tier === 2));
    for (const card of weightCards) expect(card.stats.viol).toBeGreaterThan(0);
    const fixed = slate.proposals.filter((p) => p.stats.viol === 0);
    expect(fixed.length).toBeGreaterThan(0);
    for (const card of fixed) expect(card.tier).toBeGreaterThanOrEqual(4);
    const recommended = slate.proposals.find((p) => p.recommended);
    expect(recommended?.stats.viol).toBe(0);
    expect(recommended?.apply.kind).toBe("set-tree");
  });

  test("CAREFUL policy greys structural repairs with the reason, and never recommends them", () => {
    const careful = {
      ...cfg({ enabledGenerators: [...ALL, ...STRUCTURAL] }),
      allow: { reorder: false, topology: false, rebuild: false, overflow: false },
    };
    const slate = buildSlate(input(skinnyCol()), careful);
    const structural = slate.proposals.filter((p) => p.tier >= 4);
    expect(structural.length).toBeGreaterThan(0);
    for (const card of structural) {
      expect(card.policy.ok).toBe(false);
      expect(card.policy.reason).toMatch(/changes the tree|rebuilds the layout/);
      expect(card.recommended).toBe(false);
    }
  });

  test("a rebuild that lands on the same geometry is measured tier 0, not declared NEW", () => {
    // A 2×2 equal grid rebuilt as a grid reproduces itself: the proposal
    // merges into LEAVE AS IS instead of claiming a rebuild happened.
    const grid = row(col(pane("A"), pane("C"), 0.5), col(pane("B"), pane("D"), 0.5), 0.5);
    const slate = buildSlate(input(grid), cfg({ enabledGenerators: ["rebuild-grid"] }));
    const baseline = slate.proposals[0];
    expect(baseline?.baseline).toBe(true);
    expect(baseline?.agrees).toContain("REBUILD (grid)");
    expect(slate.proposals.filter((p) => p.tier === 5)).toEqual([]);
  });

  test("diagnosis reaches the slate: COMPOUND-free HEALTHY reports fits + capacity", () => {
    const slate = buildSlate(input(healthy()), cfg());
    expect(slate.diagnosis.fits).toBe(true);
    expect(slate.diagnosis.capacity.cap).toBe(20);
    expect(slate.diagnosis.violations).toEqual([]);
  });
});
