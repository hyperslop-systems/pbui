import { describe, expect, test } from "vitest";
import { identityReferenceAdapter } from "./types";
import type { Reference, ReferenceAdapter } from "./types";

/**
 * The reference codec (PBUI-ACTIONS-3 / OPTKIT-024): products whose Values
 * predate the value-IS-the-wire-reference convention plug in ONE adapter.
 * The identity default must round-trip exactly (nothing changed for
 * convention-following products); a structured-values codec must round-trip
 * through its own id scheme.
 */

describe("the identity reference adapter (the default)", () => {
  const adapter = identityReferenceAdapter();

  test("toProduct wraps the wire reference as the value; fromProduct unwraps it", () => {
    const wire: Reference = {
      type: "product",
      id: "2049",
      value: { name: "Gold Eagle" },
      provenance: { source: "test" } as never,
    };
    const lifted = adapter.toProduct(wire);
    expect(lifted).toEqual({ type: "product", value: wire });
    expect(adapter.fromProduct(lifted)).toEqual(wire);
  });
});

describe("a structured-values codec (the rag-ttc shape)", () => {
  type CaseValue = { campaignId: string; caseId: string };
  type TestValues = { case: CaseValue };
  const adapter: ReferenceAdapter<TestValues> = {
    toProduct: (reference) => ({
      type: reference.type as "case",
      value: reference.value as CaseValue,
    }),
    fromProduct: (reference) => {
      const value = reference.value as CaseValue;
      return {
        type: reference.type,
        id: `${value.campaignId}/${value.caseId}`,
        value: value as never,
      };
    },
  };

  test("round-trips a structured value through the product id scheme", () => {
    const wire: Reference = {
      type: "case",
      id: "campaign:abc/q-1",
      value: { campaignId: "campaign:abc", caseId: "q-1" },
    };
    const lifted = adapter.toProduct(wire);
    // The product's rules read the STRUCTURED value directly — no .value.value.
    expect(lifted.value).toEqual({ campaignId: "campaign:abc", caseId: "q-1" });
    expect(adapter.fromProduct(lifted)).toEqual(wire);
  });
});
