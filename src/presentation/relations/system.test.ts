import { describe, expect, it } from "vitest";
import { available } from "../actions/availability";
import { predicate } from "../actions/conditions";
import { createPresentationTypeGraph } from "../actions/typeGraph";
import type { SelectionSnapshot } from "../actions/types";
import { createRelationSystem } from "./system";

interface Values {
  order: { customerId: string };
  customer: { id: string; accountId: string };
  account: { id: string };
  text: string;
}
interface Facts {
  readonly customers: Readonly<Record<string, Values["customer"]>>;
}

const graph = createPresentationTypeGraph([
  { id: "order" },
  { id: "customer" },
  { id: "account" },
  { id: "text" },
]);

const snapshot: SelectionSnapshot<Facts> = {
  revision: 1,
  scopes: ["shop", "global"],
  modes: new Set(),
  capabilities: new Set(),
  product: {
    customers: { c1: { id: "c1", accountId: "a1" } },
  },
};

const declarations = [
  {
    id: "order.customer",
    from: "order",
    to: "customer",
    match: "exact" as const,
    apply(reference: { type: keyof Values; value: unknown }, current: SelectionSnapshot<Facts>) {
      if (reference.type !== "order") return undefined;
      const order = reference.value as Values["order"];
      const customer = current.product.customers[order.customerId];
      return customer ? ({ type: "customer", value: customer } as const) : undefined;
    },
  },
  {
    id: "customer.account",
    from: "customer",
    to: "account",
    match: "exact" as const,
    apply(reference: { type: keyof Values; value: unknown }) {
      if (reference.type !== "customer") return undefined;
      const customer = reference.value as Values["customer"];
      return { type: "account", value: { id: customer.accountId } } as const;
    },
  },
  {
    kind: "composition" as const,
    id: "order.account",
    steps: ["order.customer", "customer.account"],
    label: "the order's account",
  },
];

describe("RelationSystem", () => {
  it("evaluates direct and explicitly composed contextual partial functions", () => {
    const system = createRelationSystem<Values, Facts>({
      graph,
      scopes: ["shop", "global"],
      relations: declarations,
    });
    const order = { type: "order", value: { customerId: "c1" } } as const;
    expect(system.apply("order.customer", order, snapshot)).toEqual({
      type: "customer",
      value: { id: "c1", accountId: "a1" },
    });
    expect(system.apply("order.account", order, snapshot)).toEqual({
      type: "account",
      value: { id: "a1" },
    });
    expect(system.get("order.account")).toMatchObject({
      kind: "composition",
      from: "order",
      to: "account",
      steps: ["order.customer", "customer.account"],
    });
  });


  it("treats an unscoped relation as universal even in a hand-built empty scope snapshot", () => {
    const system = createRelationSystem<Values, Facts>({
      graph,
      scopes: ["shop", "global"],
      relations: declarations.slice(0, 1),
    });
    const emptyScopes = { ...snapshot, scopes: [] };
    const order = { type: "order", value: { customerId: "c1" } } as const;
    expect(system.apply("order.customer", order, emptyScopes)).toEqual({
      type: "customer",
      value: { id: "c1", accountId: "a1" },
    });
  });

  it("does not infer undeclared paths", () => {
    const directOnly = createRelationSystem<Values, Facts>({
      graph,
      scopes: ["shop", "global"],
      relations: declarations.slice(0, 2),
    });
    const order = { type: "order", value: { customerId: "c1" } } as const;
    expect(directOnly.matches(order, snapshot, ["account"])).toEqual([]);
  });

  it("evaluates selector predicates once per match query", () => {
    let predicateCalls = 0;
    let relationCalls = 0;
    const system = createRelationSystem<Values, Facts>({
      graph,
      scopes: ["shop"],
      predicates: [
        {
          id: "counted",
          evaluate: () => {
            predicateCalls += 1;
            return available();
          },
        },
      ],
      relations: [
        {
          id: "order.customer.counted",
          from: "order",
          to: "customer",
          match: "exact",
          when: predicate("counted"),
          apply(reference, current) {
            relationCalls += 1;
            if (reference.type !== "order") return undefined;
            const customer =
              current.product.customers[reference.value.customerId];
            return customer
              ? ({ type: "customer", value: customer } as const)
              : undefined;
          },
        },
      ],
    });
    const order = { type: "order", value: { customerId: "c1" } } as const;
    expect(system.matches(order, snapshot, ["customer"])).toHaveLength(1);
    expect(predicateCalls).toBe(1);
    expect(relationCalls).toBe(1);
  });

  it("gives extensionally equal results for equivalent explicit compositions", () => {
    const system = createRelationSystem<Values, Facts>({
      graph,
      scopes: ["shop", "global"],
      relations: [
        ...declarations.slice(0, 2),
        {
          kind: "composition",
          id: "order.account.left",
          steps: ["order.customer", "customer.account"],
        },
        {
          kind: "composition",
          id: "order.customer.named",
          steps: ["order.customer"],
        },
        {
          kind: "composition",
          id: "order.account.right",
          steps: ["order.customer.named", "customer.account"],
        },
      ],
    });
    const order = { type: "order", value: { customerId: "c1" } } as const;
    expect(system.apply("order.account.left", order, snapshot)).toEqual(
      system.apply("order.account.right", order, snapshot),
    );
  });

  it("rejects broken compositions and invalid result types at the boundary", () => {
    expect(() =>
      createRelationSystem<Values, Facts>({
        graph,
        scopes: ["shop"],
        relations: [
          ...declarations.slice(0, 2),
          { kind: "composition", id: "bad", steps: ["customer.account", "order.customer"] },
        ],
      }),
    ).toThrow(/cannot connect/);

    const invalid = createRelationSystem<Values, Facts>({
      graph,
      scopes: ["shop"],
      relations: [
        {
          id: "lying",
          from: "order",
          to: "account",
          match: "exact",
          apply: () => ({ type: "text", value: "not an account" }),
        },
      ],
    });
    const result = invalid.evaluate(
      "lying",
      { type: "order", value: { customerId: "c1" } },
      snapshot,
    );
    expect(result).toMatchObject({ kind: "error", code: "invalid-result-type" });
  });
});
