import { describe, expect, it } from "vitest";
import { available, unavailable } from "../actions/availability";
import { predicate } from "../actions/conditions";
import { definePresentation } from "./define";
import { SNAPSHOT_INPUT } from "./types";

interface Values {
  order: { id: string; customerId: string };
  customer: { id: string };
}
interface Environment {
  readonly locale: string;
}
interface Facts {
  readonly revision: number;
  readonly customers: Readonly<Record<string, Values["customer"]>>;
  readonly readable: boolean;
}
type Verb = { readonly kind: "open"; readonly id: string };

const p = definePresentation<Values, Environment, Facts, Verb>();
const canRead = p.predicate("can-read", ({ snapshot }) =>
  snapshot.product.readable
    ? available()
    : unavailable("customer access is unavailable", "not-readable"),
);
const open = p.actions.exact("order", {
  id: "shop.order.open.rule",
  action: "shop.order.open",
  scopes: ["shop"],
  when: predicate("can-read"),
  metadata: { label: "Open order" },
  bind: ({ subject }) => ({ kind: "open", id: subject.value.id }),
});
const help = p.help.exact("order", {
  id: "shop.order.help",
  scopes: ["shop"],
  when: predicate("can-read"),
  help: ({ subject }) => [
    { id: "order.summary", kind: "text", payload: subject.value.id },
  ],
});
const customer = p.relations.direct({
  id: "order.customer",
  label: "customer",
  from: "order",
  to: "customer",
  match: "exact",
  when: predicate("can-read"),
  apply(reference, snapshot) {
    if (reference.type !== "order") return undefined;
    const value = snapshot.product.customers[reference.value.customerId];
    return value ? { type: "customer", value } : undefined;
  },
});

function makeKernel() {
  return p.kernel({
    types: [{ id: "order" }, { id: "customer" }],
    scopes: ["shop", "global"],
    predicates: [canRead],
    descriptors: {
      order: { label: (value) => `Order ${value.id}` },
      customer: { label: (value) => `Customer ${value.id}` },
    },
    actions: [open],
    relations: [customer],
    help: [help],
    revision: (facts) => facts.revision,
    version: "research-1",
  });
}

describe("PresentationKernel", () => {
  it("constructs sibling interpreters from one declaration and one predicate table", () => {
    const kernel = makeKernel();
    const snapshot = kernel.snapshot({
      revision: 7,
      customers: { c1: { id: "c1" } },
      readable: true,
    });
    const order = { type: "order", value: { id: "o1", customerId: "c1" } } as const;

    expect(snapshot).toMatchObject({ revision: 7, scopes: ["shop", "global"] });
    expect(kernel.actions.resolve({ subject: order, invocation: "menu" }, snapshot).actions).toHaveLength(1);
    expect(kernel.help?.resolve(order, snapshot).items).toHaveLength(1);
    expect(kernel.accept({ types: "customer", prompt: "choose" }, order, snapshot)).toEqual({
      kind: "accepted",
      option: {
        translator: "order.customer",
        result: { type: "customer", value: { id: "c1" } },
      },
    });
    expect(kernel.relations.predicates).toBe(kernel.predicates);
    expect(kernel.vocabulary()).toMatchObject({
      version: "research-1",
      relations: [{ id: "order.customer", from: "order", to: "customer" }],
      help: [{ id: "shop.order.help" }],
    });
  });


  it("supports an explicit active scope stack and a collision-free facts wrapper", () => {
    const kernel = makeKernel();
    const facts = {
      revision: 8,
      customers: {},
      readable: true,
    };
    const snapshot = kernel.snapshot(facts, { scopes: ["global"] });
    expect(snapshot.scopes).toEqual(["global"]);
    expect(kernel.actions.resolve(
      {
        subject: { type: "order", value: { id: "o1", customerId: "c1" } },
        invocation: "menu",
      },
      snapshot,
    ).actions).toHaveLength(0);
    const input = p.snapshotInput(facts);
    expect(input).toMatchObject({ facts, options: {} });
    expect(input[SNAPSHOT_INPUT]).toBe(true);
    expect(() => kernel.snapshot(facts, { scopes: ["undeclared"] })).toThrow(
      /undeclared scope/,
    );
  });

  it("fails closed when no semantic revision policy is supplied", () => {
    const kernel = makeKernel();
    expect(() =>
      kernel.snapshot(
        { revision: 1, customers: {}, readable: true },
        { revision: Number.NaN },
      ),
    ).toThrow(/finite number/);
  });

  it("cross-validates descriptors and relation endpoints", () => {
    expect(() =>
      p.kernel({
        types: [{ id: "order" }],
        scopes: ["shop"],
        descriptors: {
          order: { label: (value) => value.id },
          customer: { label: (value) => value.id },
        },
        actions: [],
        relations: [],
        revision: () => 1,
      }),
    ).toThrow(/descriptor for type "customer"/);
  });
});
