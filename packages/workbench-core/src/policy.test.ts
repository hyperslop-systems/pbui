import { describe, expect, it } from "vitest";
import { compilePolicy } from "./policy";

describe("compilePolicy", () => {
  it("fills defaults: clone, row, no empty placement, requested-only bindings", () => {
    const policy = compilePolicy();
    expect(policy.split).toEqual({ minInlinePx: 240, minBlockPx: 160, minFraction: 0.1, headlessAxis: "row" });
    expect(policy.duplicate).toBe("clone");
    expect(policy.emptyPlacement).toBeNull();
    expect(policy.initialDocuments.resolve({ requested: { a: "1" } } as never)).toEqual({ kind: "bound", documents: { a: "1" } });
  });

  it("derives the empty placement from an {app} duplicate policy, and lets null switch it off", () => {
    expect(compilePolicy({ duplicate: { app: "launcher" } }).emptyPlacement).toEqual({ appId: "launcher" });
    expect(compilePolicy({ duplicate: { app: "launcher" }, emptyPlacement: null }).emptyPlacement).toBeNull();
    expect(compilePolicy({ duplicate: "link", emptyPlacement: { appId: "blank" } }).emptyPlacement).toEqual({ appId: "blank" });
  });

  it("refuses constraints the planner could not honour", () => {
    expect(() => compilePolicy({ split: { minFraction: 0.6 } })).toThrow(/minFraction/);
    expect(() => compilePolicy({ split: { minInlinePx: 0 } })).toThrow(/positive/);
    expect(() => compilePolicy({ split: { headlessAxis: "diagonal" as never } })).toThrow(/headlessAxis/);
    expect(() => compilePolicy({ emptyPlacement: { appId: "" } })).toThrow(/application id/);
  });
});
