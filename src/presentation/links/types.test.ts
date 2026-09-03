import { describe, expect, it } from "vitest";
import {
  contractFingerprint,
  contractMismatches,
  definePort,
  definePorts,
  documentSlotPort,
  documentSlotsOf,
  hasDocumentSlot,
  normalizeContract,
  parsePortId,
  portId,
} from "./types";

describe("port ids", () => {
  it("joins view and name with one slash and splits at the first one", () => {
    expect(portId("v-1", "order")).toBe("v-1/order");
    expect(parsePortId("v-1/order")).toEqual({ viewId: "v-1", name: "order" });
    expect(parsePortId("v-1/order.current")).toEqual({ viewId: "v-1", name: "order.current" });
  });

  it("rejects ids without a view or without a name", () => {
    expect(parsePortId("order")).toBeNull();
    expect(parsePortId("/order")).toBeNull();
    expect(parsePortId("v-1/")).toBeNull();
  });
});

describe("normalizeContract", () => {
  it("accepts a bare type id and derives the mode from the direction", () => {
    expect(normalizeContract("order", "in")).toEqual({
      valueType: "order",
      semanticRole: "order",
      cardinality: "one",
      mode: "read",
      authorityDomain: "workspace",
      updateAlgebra: "replace",
      lifetime: "workspace",
    });
    expect(normalizeContract("order", "out").mode).toBe("write");
    expect(normalizeContract("order", "inout").mode).toBe("read-write");
  });

  it("keeps every explicit field", () => {
    const contract = normalizeContract(
      { valueType: "datum", semanticRole: "selection", cardinality: "many", mode: "event-source", authorityDomain: "orders", updateAlgebra: "union", lifetime: "tile" },
      "inout",
    );
    expect(contract).toEqual({ valueType: "datum", semanticRole: "selection", cardinality: "many", mode: "event-source", authorityDomain: "orders", updateAlgebra: "union", lifetime: "tile" });
  });

  it("refuses a contract with no value type", () => {
    expect(() => normalizeContract({ valueType: "" }, "in")).toThrow(/valueType/);
  });
});

describe("fingerprints and mismatches", () => {
  const selection = (authority: string) => normalizeContract({ valueType: "datum", semanticRole: "selection", cardinality: "many", authorityDomain: authority }, "inout");

  it("is equal exactly when every identity field is equal", () => {
    expect(contractFingerprint(selection("orders"))).toBe(contractFingerprint(selection("orders")));
    expect(contractFingerprint(selection("orders"))).not.toBe(contractFingerprint(selection("daily_sales")));
  });

  it("is stable across field order in the input", () => {
    const a = normalizeContract({ valueType: "x", lifetime: "tile", semanticRole: "r" }, "in");
    const b = normalizeContract({ semanticRole: "r", valueType: "x", lifetime: "tile" }, "in");
    expect(contractFingerprint(a)).toBe(contractFingerprint(b));
    expect(contractFingerprint(a)).toBe("valueType=x|semanticRole=r|cardinality=one|mode=read|authorityDomain=workspace|updateAlgebra=replace|lifetime=tile");
  });

  it("names the fields that differ, not just that something does", () => {
    expect(contractMismatches(selection("orders"), selection("daily_sales"))).toEqual([{ field: "authorityDomain", left: "orders", right: "daily_sales" }]);
    expect(contractMismatches(selection("orders"), selection("orders"))).toEqual([]);
    // Value type compares nominally: a subtype is still a mismatch for identity.
    expect(contractMismatches(normalizeContract("order", "in"), normalizeContract("inspectable", "in")).map((m) => m.field)).toEqual(["valueType", "semanticRole"]);
  });
});

describe("definePort / definePorts", () => {
  it("fills the policies and normalizes the contract", () => {
    const port = definePort({ name: "order", direction: "in", contract: "order", doc: "the order shown" });
    expect(port).toEqual({
      name: "order",
      direction: "in",
      contract: normalizeContract("order", "in"),
      doc: "the order shown",
      fanIn: "single-producer",
      onSourceClose: "freeze",
      documentSlot: false,
    });
  });

  it("keeps a fallback context and explicit policies", () => {
    const port = definePort({ name: "subject", direction: "in", contract: "inspectable", doc: "anything", fallbackContext: "workspace.inspected", fanIn: "last-event", onSourceClose: "clear" });
    expect(port.fallbackContext).toBe("workspace.inspected");
    expect(port.fanIn).toBe("last-event");
    expect(port.onSourceClose).toBe("clear");
  });

  it("refuses names with a slash, empty docs, and duplicate names", () => {
    expect(() => definePort({ name: "a/b", direction: "in", contract: "x", doc: "d" })).toThrow(/identifier/);
    expect(() => definePort({ name: "a", direction: "in", contract: "x", doc: "" })).toThrow(/doc/);
    expect(() =>
      definePorts([
        { name: "a", direction: "in", contract: "x", doc: "d" },
        { name: "a", direction: "out", contract: "x", doc: "d" },
      ]),
    ).toThrow(/twice/);
  });
});

describe("document slots", () => {
  it("documentSlotPort is an input of the conventional document type, persistent, marked as a slot", () => {
    const port = definePort(documentSlotPort("plot"));
    expect(port.direction).toBe("in");
    expect(port.documentSlot).toBe(true);
    expect(port.contract.valueType).toBe("document");
    expect(port.contract.semanticRole).toBe("document.plot");
    expect(port.contract.lifetime).toBe("persistent");
  });

  it("documentSlotsOf and hasDocumentSlot derive the old bindings/docBound", () => {
    const ports = definePorts([documentSlotPort("plot"), { name: "datum", direction: "out", contract: "datum", doc: "the activated mark" }]);
    expect(documentSlotsOf(ports)).toEqual(["plot"]);
    expect(hasDocumentSlot(ports)).toBe(true);
    expect(documentSlotsOf(undefined)).toEqual([]);
    expect(hasDocumentSlot([])).toBe(false);
  });
});
