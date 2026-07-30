import { describe, expect, test } from "vitest";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { RenderBoundary } from "../src/appkit/RenderBoundary";

const source = (path: string) =>
  readFile(fileURLToPath(new URL(`../src/${path}`, import.meta.url)), "utf8");

describe("render failure containment", () => {
  test("normalizes thrown values and reports caught errors", () => {
    const normalized = RenderBoundary.getDerivedStateFromError("broken");
    expect(normalized.error).toBeInstanceOf(Error);
    expect(normalized.error?.message).toBe("broken");

    const report: { error?: Error } = {};
    const boundary = new RenderBoundary({
      resetKey: "one",
      children: null,
      fallback: () => null,
      onError: (error) => {
        report.error = error;
      },
    });
    const failure = new Error("tile failed");
    boundary.componentDidCatch(failure, { componentStack: "at Tile" });
    expect(report.error).toBe(failure);
  });

  test("the product, embedded shell, and each tile own boundaries", async () => {
    const [workbench, embedded, tile] = await Promise.all([
      source("components/pages/Workbench/Workbench.tsx"),
      source("components/pages/WorkbenchInstance/WorkbenchInstance.tsx"),
      source("components/organisms/Tile/Tile.tsx"),
    ]);
    expect(workbench).toContain("<RenderBoundary");
    expect(embedded).toContain("<RenderBoundary");
    expect(tile).toContain("<RenderBoundary");
    expect(tile.indexOf("<RenderBoundary")).toBeLessThan(tile.indexOf("<Component placementId="));
  });
});

describe("high-level descriptor providers stay off whole slices", () => {
  test("imperative lookups read current store state without broad subscriptions", async () => {
    const [providers, tables] = await Promise.all([
      source("components/pages/Workbench/WorkbenchProviders.tsx"),
      source("apps/useTable.ts"),
    ]);
    expect(providers).not.toContain("state.world)");
    expect(tables).not.toContain("state.datadrop)");
    expect(tables).not.toContain("const world = useSelector");
    expect(providers).toContain("store.getState().world");
    expect(tables).toContain("store.getState().world");
  });
});
