import { describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { documentSlotPort } from "../../../../../../src/index.ts";
import { defineAppManifest } from "../../../../../../packages/workbench-core/src/apps.ts";
import { commands } from "../../../../../../packages/workbench-core/src/commands.ts";
import { createWorkbenchCore } from "../../../../../../packages/workbench-core/src/createWorkbenchCore.ts";
import { layout, split, tile } from "../../../../../../packages/workbench-core/src/document.ts";
import { buildWorkbenchIndex } from "../../../../../../packages/workbench-core/src/graph.ts";
import { createWorkbenchLinks } from "../../../../../../packages/workbench-core/src/links/collaborator.ts";
import { buildSlate } from "../../../../../../packages/workbench-core/src/rebalance/slate.ts";
import { profileConfig } from "../../../../../../packages/workbench-core/src/rebalance/config.ts";

/**
 * Phase 9 performance baselines (guide §17 Phase 9): index build, plan,
 * commit, link snapshot and rebalance slate over a 12-tile workspace with
 * links between every out and in port. Medians of 25 runs after a warm-up;
 * written to `05-perf-baselines.output.txt` beside this file so the numbers
 * are archived with the ticket, not asserted — a baseline, not a guard.
 */

const apps = [
  defineAppManifest({ id: "orders", ports: [{ name: "order", direction: "out", contract: "order", doc: "the clicked order" }] }),
  defineAppManifest({ id: "detail", ports: [{ name: "order", direction: "in", contract: "order", doc: "the order shown" }, documentSlotPort("product")] }),
  defineAppManifest({ id: "notes" }),
];

function twelveTiles() {
  const row = (r: number) => split("row", 0.4, tile(r % 2 ? "orders" : "detail"), split("row", 0.5, tile("notes"), split("row", 0.5, tile("orders"), tile("detail"))));
  return layout(split("col", 0.5, row(0), split("col", 0.4, row(1), row(2))), { id: "w", name: "twelve" });
}

function median(times: number[]): number {
  const sorted = [...times].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? Number.NaN;
}

function measure(label: string, runs: number, body: () => void): string {
  body();
  const times: number[] = [];
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    body();
    times.push(performance.now() - start);
  }
  return `${label.padEnd(44)} median ${median(times).toFixed(3)}ms  (min ${Math.min(...times).toFixed(3)}, max ${Math.max(...times).toFixed(3)}, n=${runs})`;
}

describe("Phase 9 performance baselines", () => {
  it("records index build, plan, commit, link snapshot and slate over 12 tiles", () => {
    const links = createWorkbenchLinks();
    const core = createWorkbenchCore({ initial: twelveTiles(), apps, links });
    // Link every orders tile to every detail tile (12 follows).
    const state = core.getState();
    const placements = [...state.index.viewByPlacementId.keys()];
    const by = (appId: string) => placements.filter((p) => state.document.views[state.index.viewByPlacementId.get(p)!]?.appId === appId);
    const viewOf = (p: string) => state.index.viewByPlacementId.get(p)!;
    for (const source of by("orders")) for (const target of by("detail")) {
      const linked = core.execute({ kind: "port.follow", source: `${viewOf(source)}/order`, destination: `${viewOf(target)}/order` });
      if (!linked.ok) throw new Error(`${linked.code}: ${linked.because}`);
    }
    const doc = core.getState().document;
    const tree = doc.workspaces[0]!.tree;
    const lines = [
      `# Phase 9 baselines — ${new Date().toISOString()} — node ${process.version}`,
      `# 12 tiles, 3 apps, ${by("orders").length * by("detail").length} links`,
      measure("buildWorkbenchIndex (12 tiles)", 25, () => buildWorkbenchIndex(doc)),
      measure("preview placement.duplicate (plan only)", 25, () => core.preview(commands.duplicate(placements[0]!, "row"))),
      measure("preview view.show auto (plan only)", 25, () => core.preview(commands.open("notes", {}))),
      measure("execute duplicate + close (plan + commit ×2)", 25, () => {
        const made = core.execute(commands.duplicate(placements[0]!, "row"));
        if (made.ok && made.placementId) core.execute(commands.close(made.placementId));
      }),
      measure("links.snapshot (12 tiles, 12 links)", 25, () => links.snapshot(core.getState().document)),
      measure("buildSlate anything-profile (12 tiles)", 5, () => buildSlate({ tree: tree!, rect: { x: 0, y: 0, w: 1440, h: 900 }, dividerPx: 10, labels: new Map() }, profileConfig("anything"))),
    ];
    const text = lines.join("\n") + "\n";
    console.info("\n" + text);
    writeFileSync(path.join(__dirname, "05-perf-baselines.output.txt"), text);
    expect(lines).toHaveLength(8);
  });
});
