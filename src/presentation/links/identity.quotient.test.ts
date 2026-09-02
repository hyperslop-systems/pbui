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
