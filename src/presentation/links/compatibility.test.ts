import { describe, expect, it } from "vitest";
import { canAccept, canFlow, canMergeUpdates, canShareCell, protocolMismatches, valueMismatches } from "./compatibility";
import { normalizeContract, type PortContractInput } from "./types";
import { graph } from "./world.test-helpers";

/*
 * Identity and flow are different questions (KERNEL-1 guide §13.2), so they
 * are tested apart: the same pair of contracts is asked each question and
 * the answers are allowed to differ. What must never happen is that one
 * question is answered with the other's test.
 */

const c = (input: PortContractInput | string, direction: "in" | "out" | "inout" = "inout") => normalizeContract(input, direction);

const ORDERS_SELECTION = c({ valueType: "datum", semanticRole: "selection", cardinality: "many", authorityDomain: "orders" });
const SALES_SELECTION = c({ valueType: "datum", semanticRole: "selection", cardinality: "many", authorityDomain: "daily_sales" });
const ORDERS_UNION = c({ valueType: "datum", semanticRole: "selection", cardinality: "many", authorityDomain: "orders", updateAlgebra: "union" });
const ORDER_OUT = c({ valueType: "order", semanticRole: "order.current" }, "out");
const INSPECTABLE_IN = c("inspectable", "in");
const CUSTOMER_IN = c("customer", "in");

describe("flow: canFlow and canAccept ask about value reachability only", () => {
  it("a value flows into its own type, a supertype and <any>", () => {
    expect(canFlow(ORDER_OUT, INSPECTABLE_IN, graph)).toEqual({ ok: true });
    expect(canFlow("order", c("any", "in"), graph)).toEqual({ ok: true });
    expect(canFlow(ORDER_OUT, c("order", "in"), graph)).toEqual({ ok: true });
  });

  it("refuses with the <from> does not reach <into> sentence the planners used to write", () => {
    expect(canFlow(ORDER_OUT, CUSTOMER_IN, graph)).toEqual({ ok: false, code: "type", because: "<order> does not reach <customer>" });
  });

  it("ignores protocol: different authorities and algebras flow freely", () => {
    expect(canFlow(ORDERS_SELECTION, SALES_SELECTION, graph)).toEqual({ ok: true });
    expect(canFlow(ORDERS_SELECTION, ORDERS_UNION, graph)).toEqual({ ok: true });
  });

  it("canAccept is canFlow with a reference as the source", () => {
    expect(canAccept({ type: "order", value: { id: "1" } }, INSPECTABLE_IN, graph)).toEqual({ ok: true });
    expect(canAccept({ type: "customer", value: { id: "c" } }, c("order", "in"), graph)).toMatchObject({ ok: false, code: "type" });
  });
});

describe("identity: canShareCell asks for equality on both projections", () => {
  it("passes when every field agrees", () => {
    expect(canShareCell(ORDERS_SELECTION, c({ valueType: "datum", semanticRole: "selection", cardinality: "many", authorityDomain: "orders" }))).toEqual({ ok: true });
  });

  it("refuses a different authority, naming it, and files it under protocol", () => {
    const verdict = canShareCell(ORDERS_SELECTION, SALES_SELECTION);
    expect(verdict).toMatchObject({ ok: false, code: "incompatible", because: "different authority domain: orders vs daily_sales" });
    if (verdict.ok) return;
    expect(verdict.value).toEqual([]);
    expect(verdict.protocol).toEqual([{ field: "authorityDomain", left: "orders", right: "daily_sales" }]);
  });

  it("refuses a subtype that flow would accept: identity is not reachability", () => {
    expect(canFlow(ORDER_OUT, INSPECTABLE_IN, graph)).toEqual({ ok: true });
    const verdict = canShareCell(c("order"), c("inspectable"));
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.value.map((m) => m.field)).toEqual(["valueType", "semanticRole"]);
    expect(verdict.protocol).toEqual([]);
  });

  it("lists value and protocol disagreements apart and in fingerprint order", () => {
    const verdict = canShareCell(c({ valueType: "datum", semanticRole: "selection", cardinality: "one", authorityDomain: "orders", lifetime: "tile" }), ORDERS_SELECTION);
    if (verdict.ok) throw new Error("expected a refusal");
    expect(verdict.value).toEqual([{ field: "cardinality", left: "one", right: "many" }]);
    expect(verdict.protocol).toEqual([{ field: "lifetime", left: "tile", right: "workspace" }]);
    expect(verdict.because).toBe("different cardinality: one vs many; different lifetime: tile vs workspace");
  });
});

describe("update merging: canMergeUpdates consults the algebra only", () => {
  it("passes for the same algebra whatever else differs", () => {
    expect(canMergeUpdates(ORDERS_SELECTION, SALES_SELECTION)).toEqual({ ok: true });
  });

  it("refuses replace vs union, and canShareCell refuses the same pair through its protocol projection", () => {
    expect(canMergeUpdates(ORDERS_SELECTION, ORDERS_UNION)).toEqual({ ok: false, code: "update-algebra", because: "different update algebra: replace vs union" });
    const share = canShareCell(ORDERS_SELECTION, ORDERS_UNION);
    if (share.ok) throw new Error("expected a refusal");
    expect(share.value).toEqual([]);
    expect(share.protocol).toEqual([{ field: "updateAlgebra", left: "replace", right: "union" }]);
    // And flow does not care.
    expect(canFlow(ORDERS_SELECTION, ORDERS_UNION, graph)).toEqual({ ok: true });
  });
});

describe("projections", () => {
  it("valueMismatches and protocolMismatches partition the seven fields", () => {
    const a = c({ valueType: "x", semanticRole: "r", cardinality: "one", mode: "read", authorityDomain: "A", updateAlgebra: "replace", lifetime: "tile" });
    const b = c({ valueType: "y", semanticRole: "s", cardinality: "many", mode: "write", authorityDomain: "B", updateAlgebra: "union", lifetime: "persistent" });
    expect(valueMismatches(a, b).map((m) => m.field)).toEqual(["valueType", "semanticRole", "cardinality"]);
    expect(protocolMismatches(a, b).map((m) => m.field)).toEqual(["mode", "authorityDomain", "updateAlgebra", "lifetime"]);
  });
});
