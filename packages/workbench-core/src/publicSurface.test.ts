import { describe, expect, it } from "vitest";

/**
 * The package's public surface as a golden (design doc 04 Phase S0): the
 * sorted export names of every entry. A stabilization phase that adds,
 * renames or removes a symbol updates this snapshot on purpose.
 */
describe("public surface", () => {
  it("index, sync, persistence and rebalance entries", async () => {
    const entries = {
      index: await import("./index"),
      sync: await import("./sync/index"),
      persistence: await import("./persistence/index"),
      rebalance: await import("./rebalance/index"),
    };
    const names = Object.fromEntries(Object.entries(entries).map(([entry, module]) => [entry, Object.keys(module).sort()]));
    expect(names).toMatchSnapshot();
  });
});
