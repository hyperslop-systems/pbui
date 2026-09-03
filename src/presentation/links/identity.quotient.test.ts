import { describe, expect, it } from "vitest";
import { compileIdentityQuotient, logicalCellOf } from "./identity";
import { PORTS } from "./world.test-helpers";

describe("identity quotient", () => {
  it("constructs connected components as logical cells", () => {
    const quotient = compileIdentityQuotient(
      [
        { linkId: "I1", left: "v-a/order", right: "v-b/order", mergePolicy: "prefer-left" },
        { linkId: "I2", left: "v-b/order", right: "v-c/order", mergePolicy: "prefer-left" },
      ],
      new Map(PORTS.map((port) => [port.id, port] as const)),
    );
    expect(quotient.cells).toHaveLength(1);
    expect(quotient.cells[0]?.members).toEqual([
      "v-a/order",
      "v-b/order",
      "v-c/order",
    ]);
    expect(logicalCellOf("v-b/order", quotient)?.id).toBe(quotient.cells[0]?.id);
  });

  it("is invariant under edge order and duplicate unions", () => {
    const ports = new Map(PORTS.map((port) => [port.id, port] as const));
    const forward = compileIdentityQuotient(
      [
        { linkId: "I1", left: "v-a/order", right: "v-b/order", mergePolicy: "prefer-left" },
        { linkId: "I2", left: "v-b/order", right: "v-c/order", mergePolicy: "prefer-left" },
      ],
      ports,
    );
    const reordered = compileIdentityQuotient(
      [
        { linkId: "I3", left: "v-c/order", right: "v-b/order", mergePolicy: "prefer-left" },
        { linkId: "I2", left: "v-b/order", right: "v-c/order", mergePolicy: "prefer-left" },
        { linkId: "I1", left: "v-b/order", right: "v-a/order", mergePolicy: "prefer-left" },
      ],
      new Map([...ports].reverse()),
    );
    expect(reordered.cells).toEqual(forward.cells);
    expect([...reordered.cellByPort.entries()].sort()).toEqual(
      [...forward.cellByPort.entries()].sort(),
    );
  });

});

describe("quotient view of a snapshot (PBUI-KERNEL-3 P4)", () => {
  it("quotientOf reads the snapshot's classes as cells and its aliases as cellByPort; cellOf names a member's cell", async () => {
    const { quotientOf, cellOf } = await import("./identity");
    const { world } = await import("./world.test-helpers");
    const s = world({ identity: [{ linkId: "I1", left: "v-east/selection", right: "v-plot/selection", mergePolicy: "prefer-left" }, { linkId: "I2", left: "v-east/selection", right: "v-sales/selection", mergePolicy: "prefer-left" }] });
    const q = quotientOf(s);
    expect(q.cells.map((c) => c.members)).toEqual([["v-east/selection", "v-plot/selection"]]);
    expect(q.cellByPort.get("v-plot/selection")).toBe(q.cells[0]?.id);
    expect(q.diagnostics.map((d) => `${d.linkId}:${d.code}`)).toEqual(["I2:incompatible"]);
    expect(cellOf("v-east/selection", s)?.id).toBe(q.cells[0]?.id);
    expect(cellOf("v-sales/selection", s)).toBeNull();
    expect(cellOf("v-a/order", s)).toBeNull();
  });
});
