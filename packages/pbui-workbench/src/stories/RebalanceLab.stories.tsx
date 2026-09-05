import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo, useState } from "react";
import { Button, Text } from "@hyperslop-systems/pbui";
import { createWorkbench } from "../createWorkbenchShell";
import { layout, split, tile, type LayoutSpec } from "@hyperslop-systems/workbench-core";
import { rebalanceSettingsApp } from "../components/RebalanceSettings";
import { demoApps } from "./demoApps";

/**
 * THE REBALANCE LAB (PBUI-REBALANCE-1): a standalone test workspace with the
 * broken-layout generators of sources/repair-lab-2.html, so the rebalance
 * dialog can be exercised against every failure mode the textbook isolates —
 * wrong weight distribution (SLIVER, FOUR DONORS, COMPOUND), impossible
 * topology (SKINNY COL, WIDE ROW 9), oversubscription (TOO MANY), and random
 * skewed trees. Pick a layout, press Ctrl/Cmd+Shift+K (or the REBALANCE
 * button), and compare the proposals against the lab's.
 */

// --- LayoutSpec builders (mass-ratio chains, like the lab's SP/eqw) ---------

const T = () => tile("counter");

/** A same-direction chain whose mass ratios follow `weights` (default equal). */
function chain(direction: "row" | "col", specs: LayoutSpec[], weights?: number[]): LayoutSpec {
  const w = weights ?? specs.map(() => 1);
  const rec = (from: number): LayoutSpec => {
    if (from === specs.length - 1) return specs[from] as LayoutSpec;
    const rest = w.slice(from).reduce((s, v) => s + v, 0);
    return split(direction, (w[from] as number) / rest, specs[from] as LayoutSpec, rec(from + 1));
  };
  return rec(0);
}

function grid(cols: number, rows: number): LayoutSpec {
  const rowSpecs = Array.from({ length: rows }, () => chain("row", Array.from({ length: cols }, T)));
  return chain("col", rowSpecs);
}

interface Preset {
  key: string;
  note: string;
  make(): LayoutSpec;
}

/** The lab's presets (sources/repair-lab-2.html PRESETS), minus stacks. */
const PRESETS: Preset[] = [
  {
    key: "HEALTHY",
    note: "roomy tiles — the correct slate is one card: LEAVE AS IS",
    make: () => chain("row", [T(), T(), split("col", 0.55, T(), T())], [0.4, 0.3, 0.3]),
  },
  {
    key: "SLIVER",
    note: "one tile hogs 90%; two siblings are unusable slivers",
    make: () => chain("row", [T(), T(), T()], [0.9, 0.05, 0.05]),
  },
  {
    key: "FOUR DONORS",
    note: "30/30/30/10 — compare who pays: ripple vs sparse vs project",
    make: () => chain("row", [T(), T(), T(), T()], [0.3, 0.3, 0.3, 0.1]),
  },
  {
    key: "COMPOUND",
    note: "nested fractions multiply: .2 × .15 × .3 leaves a tile at ~1%",
    make: () => split("row", 0.8, T(), split("col", 0.85, T(), split("row", 0.7, T(), T()))),
  },
  {
    key: "SKINNY COL",
    note: "Row[big, Col of 6] — the column is structurally too tall; only RESHAPE/REBUILD fix it",
    make: () => split("row", 0.74, T(), chain("col", [T(), T(), T(), T(), T(), T()])),
  },
  {
    key: "WIDE ROW 9",
    note: "nine equal columns, each far below a usable width — weights cannot help",
    make: () => chain("row", Array.from({ length: 9 }, T)),
  },
  {
    key: "MASTER SWARM",
    note: "master at 84% plus six stragglers sharing the rest",
    make: () => split("row", 0.84, T(), chain("col", Array.from({ length: 6 }, T))),
  },
  {
    key: "MIXED MESS",
    note: "what a desktop looks like after forty manual operations",
    make: () =>
      split(
        "row",
        0.62,
        split("col", 0.72, T(), split("row", 0.86, T(), T())),
        split("col", 0.5, chain("row", [T(), T(), T()], [0.55, 0.35, 0.1]), split("col", 0.84, T(), T())),
      ),
  },
  {
    key: "TOO MANY",
    note: "a 5×4 grid of 20 — more tiles than the screen can hold at these minimums",
    make: () => grid(5, 4),
  },
];

/** Seeded LCG so RANDOM is reproducible per seed. */
function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function randomSpec(n: number, skew: number, rand: () => number): LayoutSpec {
  const build = (count: number, direction: "row" | "col"): LayoutSpec => {
    if (count === 1) return T();
    const left = 1 + Math.floor(rand() * (count - 1));
    const next: "row" | "col" = rand() < 0.6 ? (direction === "row" ? "col" : "row") : direction;
    // Skewed ratios are what make random trees interesting to repair.
    const ratio = Math.min(0.93, Math.max(0.07, Math.pow(rand(), 1 + skew * 3)));
    return split(direction, ratio, build(left, next), build(count - left, next));
  };
  return build(n, rand() < 0.5 ? "row" : "col");
}

// --- the harness ------------------------------------------------------------

function RebalanceLab() {
  const [selection, setSelection] = useState<{ preset: number; nonce: number; note: string }>({
    preset: 1, // start on SLIVER: something visibly wrong
    nonce: 0,
    note: PRESETS[1]?.note ?? "",
  });
  const [seed, setSeed] = useState(7);

  const wb = useMemo(() => {
    const preset = PRESETS[selection.preset];
    const spec = preset ? preset.make() : randomSpec(8, 0.55, rng(seed));
    const workbench = createWorkbench({
      apps: [...demoApps, rebalanceSettingsApp],
      initial: layout(spec),
    });
    return workbench;
    // nonce forces a fresh workbench when the same preset is re-picked.
  }, [selection.preset, selection.nonce, seed]);

  const pick = (index: number) =>
    setSelection((s) => ({ preset: index, nonce: s.nonce + 1, note: PRESETS[index]?.note ?? "" }));
  const random = () => {
    setSeed((s) => (s * 7 + Date.now()) >>> 0);
    setSelection((s) => ({ preset: -1, nonce: s.nonce + 1, note: "a random skewed tree — reroll until something ugly appears" }));
  };

  return (
    <div style={{ display: "grid", gridTemplateRows: "auto auto minmax(0, 1fr)", gap: 8, height: "100vh", padding: 8, boxSizing: "border-box" }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <Text size="small" strong>
          LAYOUTS
        </Text>
        {PRESETS.map((preset, index) => (
          <Button
            key={preset.key}
            size="tiny"
            variant={selection.preset === index ? "raised" : "framed"}
            onClick={() => pick(index)}
          >
            {preset.key}
          </Button>
        ))}
        <Button size="tiny" variant={selection.preset === -1 ? "raised" : "framed"} onClick={random}>
          RANDOM
        </Button>
        <span style={{ flex: 1 }} />
        <Button size="tiny" variant="framed" onClick={() => wb.dispatch({ kind: "rebalance.open" })}>
          REBALANCE · Ctrl+Shift+K
        </Button>
      </div>
      <Text size="tiny" tone="faint">
        {selection.note} — open the rebalance dialog and compare the cards against sources/repair-lab-2.html; place the
        “Rebalance settings” tile (Ctrl+K) to change the policy.
      </Text>
      <div style={{ minHeight: 0, display: "grid", gridTemplateRows: "minmax(0, 1fr)" }}>
        <wb.Surface />
      </div>
      <wb.Rebalance />
      <wb.Launcher />
    </div>
  );
}

const meta: Meta<typeof RebalanceLab> = {
  title: "Workbench/RebalanceLab",
  component: RebalanceLab,
  parameters: { layout: "fullscreen" },
};
export default meta;

type Story = StoryObj<typeof RebalanceLab>;

export const Lab: Story = {};
