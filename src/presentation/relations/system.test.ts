import { describe, expect, it } from "vitest";
import { available } from "../actions/availability";
import { predicate } from "../actions/conditions";
import { createPresentationTypeGraph } from "../actions/typeGraph";
import type { SelectionSnapshot } from "../actions/types";
import { createRelationSystem } from "./system";
import type { PresentationRelationDeclaration } from "./types";

/**
 * PBUI-KERNEL-1 §10 / §19.3: the canonical relation system. Direct and
 * explicitly composed partial functions; exposure-filtered discovery; abstract
 * codomains with concrete outputs; no inferred paths; predicates evaluated
 * once per candidate; detailed outcomes.
 */

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
  { id: "party", abstract: true },
  { id: "order" },
  { id: "customer", parents: ["party"] },
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

const order = { type: "order", value: { customerId: "c1" } } as const;

const orderCustomer: PresentationRelationDeclaration<Values, Facts> = {
  id: "order.customer",
  from: "order",
  to: "customer",
  match: "exact",
  exposure: { acceptance: true, derivation: { transport: "serializable" } },
  apply(reference, current) {
    if (reference.type !== "order") return undefined;
    const customer = current.product.customers[reference.value.customerId];
    return customer ? { type: "customer", value: customer } : undefined;
  },
};
const customerAccount: PresentationRelationDeclaration<Values, Facts> = {
  id: "customer.account",
  from: "customer",
  to: "account",
  match: "exact",
  exposure: { acceptance: true },
  apply(reference) {
    if (reference.type !== "customer") return undefined;
    return { type: "account", value: { id: reference.value.accountId } };
  },
};
const orderAccount: PresentationRelationDeclaration<Values, Facts> = {
  kind: "composition",
  id: "order.account",
  steps: ["order.customer", "customer.account"],
  label: "the order's account",
  exposure: { acceptance: true },
};
const declarations = [orderCustomer, customerAccount, orderAccount];

function system(relations: readonly PresentationRelationDeclaration<Values, Facts>[]) {
  return createRelationSystem<Values, Facts>({ graph, scopes: ["shop", "global"], relations });
}

describe("RelationSystem", () => {
  it("evaluates direct and explicitly composed contextual partial functions", () => {
    const relations = system(declarations);
    expect(relations.apply("order.customer", order, snapshot)).toEqual({
      type: "customer",
      value: { id: "c1", accountId: "a1" },
    });
    expect(relations.apply("order.account", order, snapshot)).toEqual({
      type: "account",
      value: { id: "a1" },
    });
    expect(relations.get("order.account")).toMatchObject({
      kind: "composition",
      from: "order",
      to: "account",
      steps: ["order.customer", "customer.account"],
      exposure: { acceptance: true },
    });
  });

  it("treats an unscoped relation as universal, with null scope provenance", () => {
    const relations = system([orderCustomer]);
    const emptyScopes = { ...snapshot, scopes: [] };
    expect(relations.apply("order.customer", order, emptyScopes)).toEqual({
      type: "customer",
      value: { id: "c1", accountId: "a1" },
    });
    expect(relations.evaluate("order.customer", order, emptyScopes)).toMatchObject({
      kind: "value",
      match: { scope: null, scopeIndex: null },
    });
  });

  it("does not infer undeclared paths", () => {
    const directOnly = system([orderCustomer, customerAccount]);
    expect(directOnly.matches(order, snapshot, { targets: ["account"] })).toEqual([]);
  });

  it("evaluates selector predicates once per match query", () => {
    let predicateCalls = 0;
    let relationCalls = 0;
    const relations = createRelationSystem<Values, Facts>({
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
          exposure: { acceptance: true },
          apply(reference, current) {
            relationCalls += 1;
            if (reference.type !== "order") return undefined;
            const customer = current.product.customers[reference.value.customerId];
            return customer ? { type: "customer", value: customer } : undefined;
          },
        },
      ],
    });
    expect(relations.matches(order, snapshot, { targets: ["customer"] })).toHaveLength(1);
    expect(predicateCalls).toBe(1);
    expect(relationCalls).toBe(1);
  });

  it("gives extensionally equal results for equivalent explicit compositions", () => {
    const relations = system([
      orderCustomer,
      customerAccount,
      { kind: "composition", id: "order.account.left", steps: ["order.customer", "customer.account"], exposure: { acceptance: true } },
      { kind: "composition", id: "order.customer.named", steps: ["order.customer"], exposure: {} },
      { kind: "composition", id: "order.account.right", steps: ["order.customer.named", "customer.account"], exposure: { acceptance: true } },
    ]);
    expect(relations.apply("order.account.left", order, snapshot)).toEqual(
      relations.apply("order.account.right", order, snapshot),
    );
  });

  it("rejects broken compositions at construction", () => {
    expect(() =>
      system([
        orderCustomer,
        customerAccount,
        { kind: "composition", id: "bad", steps: ["customer.account", "order.customer"], exposure: { acceptance: true } },
      ]),
    ).toThrow(/cannot connect/);
    expect(() =>
      system([
        { kind: "composition", id: "loop.a", steps: ["loop.b"], exposure: { acceptance: true } },
        { kind: "composition", id: "loop.b", steps: ["loop.a"], exposure: { acceptance: true } },
      ]),
    ).toThrow(/composition cycle/);
    expect(() =>
      system([{ kind: "composition", id: "empty", steps: [], exposure: { acceptance: true } }]),
    ).toThrow(/declares no steps/);
  });

  describe("exposure (C6)", () => {
    it("is required, and derivation requires the serializable transport", () => {
      expect(() =>
        system([{ ...orderCustomer, exposure: undefined as never }]),
      ).toThrow(/declares no exposure/);
      expect(() =>
        system([{ ...orderCustomer, exposure: { derivation: { transport: "binary" as never } } }]),
      ).toThrow(/serializable transport/);
    });

    it("filters discovery per interpreter before any relation runs", () => {
      let ran = 0;
      const relations = system([
        {
          id: "order.customer.private",
          from: "order",
          to: "customer",
          match: "exact",
          exposure: { facet: true },
          apply() {
            ran += 1;
            return { type: "customer", value: { id: "c1", accountId: "a1" } };
          },
        },
        orderCustomer,
      ]);
      expect(relations.exposed("acceptance").map((r) => r.id)).toEqual(["order.customer"]);
      expect(relations.exposed("facet").map((r) => r.id)).toEqual(["order.customer.private"]);
      expect(relations.exposed("derivation").map((r) => r.id)).toEqual(["order.customer"]);
      const found = relations.matches(order, snapshot, { exposedTo: "acceptance" });
      expect(found.map((m) => m.relation.id)).toEqual(["order.customer"]);
      expect(ran).toBe(0);
      expect(relations.matches(order, snapshot).map((m) => m.relation.id)).toEqual([
        "order.customer.private",
        "order.customer",
      ]);
    });

    it("lets a public composition run private steps, and reports an unreachable private relation", () => {
      const relations = system([
        { ...orderCustomer, exposure: {} },
        { ...customerAccount, exposure: {} },
        orderAccount,
        { ...customerAccount, id: "customer.account.orphan", exposure: {} },
      ]);
      expect(relations.apply("order.account", order, snapshot)).toEqual({
        type: "account",
        value: { id: "a1" },
      });
      expect(relations.exposed("acceptance").map((r) => r.id)).toEqual(["order.account"]);
      expect(relations.diagnostics()).toEqual([
        expect.objectContaining({
          code: "unreachable-private-relation",
          relationId: "customer.account.orphan",
        }),
      ]);
    });

    it("adding an unexposed relation does not change acceptance discovery", () => {
      const before = system([orderCustomer]).matches(order, snapshot, { exposedTo: "acceptance" });
      const after = system([
        orderCustomer,
        { ...orderCustomer, id: "order.customer.shadow", exposure: {} },
      ]).matches(order, snapshot, { exposedTo: "acceptance" });
      expect(after.map((m) => m.relation.id)).toEqual(before.map((m) => m.relation.id));
    });
  });

  describe("codomains and outputs (C8)", () => {
    it("permits an abstract codomain when the output is a declared concrete subtype", () => {
      const relations = system([{ ...orderCustomer, id: "order.party", to: "party" }]);
      expect(relations.evaluate("order.party", order, snapshot)).toMatchObject({
        kind: "value",
        reference: { type: "customer" },
      });
      expect(relations.matches(order, snapshot, { targets: ["party"] })).toHaveLength(1);
    });

    it("rejects an abstract output even under an abstract codomain", () => {
      const relations = system([
        {
          ...orderCustomer,
          id: "order.party.abstract",
          to: "party",
          apply: () => ({ type: "party", value: {} }) as never,
        },
      ]);
      expect(relations.evaluate("order.party.abstract", order, snapshot)).toMatchObject({
        kind: "error",
        code: "invalid-result-type",
        because: expect.stringContaining("abstract type <party>"),
      });
    });

    it("rejects undeclared and non-reaching outputs; distinguishes empty, unavailable, and thrown", () => {
      const relations = system([
        { ...orderCustomer, id: "undeclared", apply: () => ({ type: "ghost", value: {} }) as never },
        {
          ...orderCustomer,
          id: "lying",
          to: "account",
          apply: () => ({ type: "text", value: "not an account" }),
        },
        { ...orderCustomer, id: "empty", apply: () => undefined },
        { ...orderCustomer, id: "scoped", scopes: ["shop"] },
        {
          ...orderCustomer,
          id: "throws",
          apply: () => {
            throw new Error("boom");
          },
        },
      ]);
      expect(relations.evaluate("undeclared", order, snapshot)).toMatchObject({
        kind: "error",
        code: "invalid-result-type",
        because: expect.stringContaining("undeclared type <ghost>"),
      });
      expect(relations.evaluate("lying", order, snapshot)).toMatchObject({
        kind: "error",
        code: "invalid-result-type",
      });
      expect(relations.evaluate("empty", order, snapshot)).toMatchObject({ kind: "empty" });
      expect(relations.evaluate("scoped", order, { ...snapshot, scopes: ["global"] })).toMatchObject({
        kind: "unavailable",
        code: "scope",
      });
      expect(relations.evaluate("missing", order, snapshot)).toMatchObject({
        kind: "unavailable",
        code: "relation-missing",
      });
      expect(relations.evaluate("throws", order, snapshot)).toMatchObject({
        kind: "error",
        code: "relation-threw",
      });
    });
  });

  it("projects a serializable vocabulary that includes exposure", () => {
    expect(system(declarations).definitions()).toEqual([
      expect.objectContaining({
        id: "order.customer",
        kind: "direct",
        from: "order",
        to: "customer",
        exposure: { acceptance: true, derivation: { transport: "serializable" } },
      }),
      expect.objectContaining({ id: "customer.account", exposure: { acceptance: true } }),
      expect.objectContaining({
        id: "order.account",
        kind: "composition",
        from: "order",
        to: "account",
        steps: ["order.customer", "customer.account"],
        label: "the order's account",
      }),
    ]);
  });
});
