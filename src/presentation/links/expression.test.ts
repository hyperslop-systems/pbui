import { describe, expect, it } from "vitest";
import { checkBinding } from "./check";
import {
  dependenciesOfBinding,
  normalizeBinding,
  programOf,
} from "./expression";
import { terms } from "./terms";
import { deps, ORDER_1042, world } from "./world.test-helpers";

describe("binding expression IR", () => {
  it("compiles source, computation, and control state without changing the wire format", () => {
    const binding = terms.hold(
      ORDER_1042,
      terms.derived(
        terms.follow("v-east/order", "L-source"),
        "order.customer",
        "L-derived",
      ),
    );
    expect(programOf(binding)).toMatchObject({
      kind: "held",
      suspended: {
        kind: "live",
        expression: {
          kind: "apply",
          relationId: "order.customer",
          input: { kind: "source", source: { kind: "port", port: "v-east/order" } },
        },
      },
    });
    expect(normalizeBinding(binding)).toEqual(binding);
    expect(normalizeBinding(normalizeBinding(binding))).toEqual(normalizeBinding(binding));
  });

  it("extracts every structural dependency rather than one privileged source", () => {
    const binding = terms.hold(
      ORDER_1042,
      terms.derived(
        terms.follow("v-east/order", "L-source"),
        "order.customer",
        "L-derived",
      ),
    );
    const dependencies = dependenciesOfBinding(binding);
    expect([...dependencies.ports]).toEqual(["v-east/order"]);
    expect([...dependencies.relations]).toEqual(["order.customer"]);
    expect([...dependencies.links]).toEqual(["L-derived", "L-source"]);
    expect([...dependenciesOfBinding(binding, { includeSuspended: false }).ports]).toEqual([]);
  });


  it("preserves exact relation source semantics in static checking", () => {
    const s = world();
    const exactDeps = {
      ...deps,
      relations: [
        {
          id: "inspectable.customer",
          from: "inspectable",
          to: "customer",
          match: "exact" as const,
        },
      ],
    };
    const candidate = terms.derived(
      terms.follow("v-east/order", "L-source"),
      "inspectable.customer",
      "L-derived",
    );
    expect(checkBinding(candidate, s, exactDeps, "v-cust/customer")).toMatchObject({
      kind: "invalid",
      diagnostic: { code: "relation-source" },
    });
  });

  it("typechecks candidates and rejects cycles from the expression graph", () => {
    const s = world({
      bindings: {
        "v-a/order": terms.follow("v-b/order", "L1"),
      },
    });
    expect(checkBinding(terms.follow("v-east/order", "L2"), s, deps, "v-b/order").kind).toBe("valid");
    expect(checkBinding(terms.follow("v-a/order", "L2"), s, deps, "v-b/order")).toMatchObject({
      kind: "invalid",
      diagnostic: { code: "cycle" },
    });
    expect(checkBinding(terms.constant({ type: "customer", value: { id: "c1" } }), s, deps, "v-b/order")).toMatchObject({
      kind: "invalid",
      diagnostic: { code: "type" },
    });
  });
});
