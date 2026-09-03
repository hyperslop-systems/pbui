import { describe, expect, it } from "vitest";
import { applyLinkVerb } from "./apply";
import { badgeOf } from "./badge";
import { effectiveBinding, evaluatePort } from "./evaluate";
import { legalRelations, planDerive } from "./plan";
import { terms } from "./terms";
import { isLinkVerb, linkVerbs } from "./verbs";
import { CUSTOMER_ADA, deps, ORDER_1042, withBindings, world } from "./world.test-helpers";

/*
 * Derived bindings (design D7, Phase 6): a named relation applied to another
 * binding, the relations being the product's translators. The palette's
 * question ("which relations are legal between these two ports?") and the
 * evaluator's ("what does the relation give now?") are both answered here.
 */

describe("planDerive", () => {
  it("lists the legal relations by type reachability and refuses when none fits", () => {
    const s = world();
    expect(legalRelations("v-east/order", "v-cust/customer", s, deps).map((r) => r.id)).toEqual(["order.customer"]);
    expect(legalRelations("v-east/order", "v-a/order", s, deps).map((r) => r.id)).toEqual(["order.self"]);
    expect(legalRelations("v-plot/datum", "v-cust/customer", s, deps)).toEqual([]);
    expect(planDerive("v-plot/datum", "v-cust/customer", undefined, s, deps)).toMatchObject({ kind: "unavailable", code: "no-relation", because: "no relation turns a <datum> into a <customer>" });
    expect(planDerive("v-east/order", "v-cust/customer", "order.self", s, deps)).toMatchObject({ kind: "unavailable", code: "relation" });
    expect(planDerive("v-a/order", "v-cust/customer", undefined, s, deps)).toMatchObject({ kind: "unavailable", code: "direction" });
  });

  it("chooses a lone legal relation, and reports several as an ambiguity", () => {
    const s = world();
    expect(planDerive("v-east/order", "v-cust/customer", undefined, s, deps)).toMatchObject({ kind: "available", verb: { kind: "port.derive", relation: "order.customer" }, explanation: "Customer · customer will derive through its customer from Orders East · order" });
    const many = { ...deps, relations: [...(deps.relations ?? []), { id: "order.customer2", from: "order", to: "customer", label: "another way" }] };
    expect(planDerive("v-east/order", "v-cust/customer", undefined, s, many)).toMatchObject({ kind: "ambiguous", options: [{ label: "its customer" }, { label: "another way" }] });
  });

  it("port.derive writes Derived(Follow(source), ρ); the value is the relation applied; the badge names the relation", () => {
    const s = world({ emitted: { "v-east/order": ORDER_1042 } });
    const derived = applyLinkVerb(linkVerbs.derive("v-east/order", "v-cust/customer", "order.customer"), s, deps, { newLinkId: () => "D1" });
    expect(derived.kind).toBe("ok");
    if (derived.kind !== "ok") return;
    expect(derived.bindings.get("v-cust/customer")).toEqual(terms.derived(terms.follow("v-east/order", "D1"), "order.customer", "D1"));
    const after = withBindings(s, derived.bindings);
    expect(evaluatePort("v-cust/customer", after, deps)).toMatchObject({ kind: "value", reference: { type: "customer", value: { name: "Ada" } } });
    expect(badgeOf(after.ports.get("v-cust/customer")!, after, deps)).toMatchObject({ state: "derived", glyph: "←", text: "customer ← its customer", explanation: expect.stringContaining("now <customer>") });
    expect(planDerive("v-east/order", "v-cust/customer", "order.customer", after, deps)).toMatchObject({ kind: "unavailable", code: "already" });
    // Pin over a derived term holds the derived value; resume restores the derivation.
    const pinned = applyLinkVerb(linkVerbs.pin("v-cust/customer"), after, deps);
    expect(pinned.kind === "ok" && pinned.bindings.get("v-cust/customer")).toMatchObject({ kind: "hold", reference: { type: "customer" }, suspended: { kind: "derived" } });
    if (pinned.kind !== "ok") return;
    const resumed = applyLinkVerb(linkVerbs.resume("v-cust/customer"), withBindings(after, pinned.bindings), deps);
    expect(resumed.kind === "ok" && resumed.bindings.get("v-cust/customer")).toEqual(derived.bindings.get("v-cust/customer"));
  });

  it("a relation that returns nothing is empty, never stale; a missing registry is a diagnostic", () => {
    const s = world({ bindings: { "v-cust/customer": terms.derived(terms.follow("v-plot/datum", "D2"), "order.customer", "D2") }, emitted: { "v-plot/datum": { type: "datum", value: { relation: "orders", identity: { id: "x" } } } } });
    expect(evaluatePort("v-cust/customer", s, deps).kind).toBe("empty");
    expect(evaluatePort("v-cust/customer", s, { graph: deps.graph })).toMatchObject({ kind: "error", diagnostic: { code: "relation-missing" } });
    expect(effectiveBinding("v-cust/customer", s).kind).toBe("derived");
    expect(isLinkVerb(linkVerbs.derive("a/x", "b/y", "r"))).toBe(true);
    expect(isLinkVerb({ kind: "port.derive", source: "a/x", destination: "b/y" })).toBe(false);
    void CUSTOMER_ADA;
  });
});
