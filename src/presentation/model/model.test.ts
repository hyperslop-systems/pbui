import { describe, expect, it } from "vitest";
import { available, unavailable } from "../actions/availability";
import { predicate } from "../actions/conditions";
import { anyDeclaredType } from "../context/types";
import { definePresentation } from "./define";
import type { PresentationFragment } from "./types";

/**
 * PBUI-KERNEL-1 §19.2 (model construction), §19.5 (snapshots), §15 (vocabulary
 * and diagnostics): one compiled model from one declaration and named
 * fragments, with fragment-aware structural errors.
 */

interface Values {
  order: { id: string; customerId: string };
  customer: { id: string };
  tile: { placementId: string };
}
interface Environment {
  readonly locale: string;
}
interface Facts {
  readonly revision: number;
  readonly customers: Readonly<Record<string, Values["customer"]>>;
  readonly readable: boolean;
}
type Verb = { readonly kind: "open"; readonly id: string } | { readonly kind: "close"; readonly placementId: string };

const p = definePresentation<Values, Environment, Facts, Verb>();

const canRead = p.predicate("can-read", ({ snapshot }) =>
  snapshot.product.readable ? available() : unavailable("customer access is unavailable", "not-readable"),
);

/** A reusable fragment the way a shared package would export one. */
const workbenchFragment: PresentationFragment<Values, Environment, Facts, Verb> = p.fragment({
  id: "workbench",
  types: [{ id: "tile" }],
  knownScopes: ["workbench", "global"],
  descriptors: { tile: { label: (value) => `Tile ${value.placementId}` } },
  actions: [
    p.actions.exact("tile", {
      id: "workbench.tile.close",
      action: "workbench.close-tile",
      scopes: ["workbench"],
      metadata: { label: "Close tile" },
      bind: ({ subject }) => ({ kind: "close", placementId: subject.value.placementId }),
    }),
  ],
});

const shopFragment = p.fragment({
  id: "shop",
  types: [
    { id: "inspectable", abstract: true },
    { id: "party", abstract: true, parents: ["inspectable"] },
    { id: "order", parents: ["inspectable"] },
    { id: "customer", parents: ["party"] },
  ],
  knownScopes: ["shop", "global"],
  predicates: [canRead],
  descriptors: {
    order: { label: (value) => `Order ${value.id}` },
    customer: { label: (value) => `Customer ${value.id}` },
  },
  actions: [
    p.actions.exact("order", {
      id: "shop.order.open.rule",
      action: "shop.order.open",
      scopes: ["shop"],
      when: predicate("can-read"),
      metadata: { label: "Open order" },
      bind: ({ subject }) => ({ kind: "open", id: subject.value.id }),
    }),
  ],
  relations: [
    p.relation({
      id: "order.customer",
      label: "customer",
      from: "order",
      to: "party",
      match: "exact",
      when: predicate("can-read"),
      exposure: { acceptance: true, derivation: { transport: "serializable" } },
      apply(reference, snapshot) {
        if (reference.type !== "order") return undefined;
        const value = snapshot.product.customers[reference.value.customerId];
        return value ? { type: "customer", value } : undefined;
      },
    }),
  ],
  help: [
    p.help.exact("order", {
      id: "shop.order.help",
      scopes: ["shop"],
      when: predicate("can-read"),
      help: ({ subject }) => [{ id: "order.summary", kind: "text", payload: subject.value.id }],
    }),
  ],
});

function makeModel() {
  return p.create({
    id: "shop.presentation",
    include: [workbenchFragment, shopFragment],
    defaultActiveScopes: ["shop", "workbench", "global"],
    revision: (facts) => facts.revision,
    version: "research-1",
  });
}

const facts: Facts = { revision: 7, customers: { c1: { id: "c1" } }, readable: true };
const order = { type: "order", value: { id: "o1", customerId: "c1" } } as const;

describe("compiled presentation", () => {
  it("constructs sibling interpreters from one declaration and one predicate table", () => {
    const model = makeModel();
    const snapshot = model.snapshot({ facts });

    expect(snapshot).toMatchObject({ revision: 7, scopes: ["shop", "workbench", "global"] });
    expect(model.actions.resolve({ subject: order, invocation: "menu" }, snapshot).actions).toHaveLength(1);
    expect(model.help?.resolve(order, snapshot).items).toHaveLength(1);
    // Subtyping first: an order IS inspectable, so that request settles with
    // the original reference and no relation runs.
    expect(model.accept({ types: "inspectable", prompt: "choose" }, order, snapshot)).toEqual({
      kind: "accepted",
      option: { translator: null, result: order },
    });
    // The relation promises the abstract `party`; a request for that codomain
    // is satisfied by the concrete customer it returns (C8, §11.3).
    expect(model.accept({ types: "party", prompt: "choose" }, order, snapshot)).toEqual({
      kind: "accepted",
      option: { translator: "order.customer", result: { type: "customer", value: { id: "c1" } } },
    });
    // Discovery is by DECLARED codomain: a request for `customer` does not
    // find a relation that only promises `party` (§11.3 "skip unless
    // relation codomain reaches a wanted type").
    expect(model.accept({ types: "customer", prompt: "choose" }, order, snapshot)).toEqual({ kind: "none" });
    expect(model.relations.predicates).toBe(model.predicates);
    expect(model.fragments).toEqual(["workbench", "shop", "shop.presentation"]);
    expect(model.originOf("action", "workbench.tile.close")).toBe("workbench");
    expect(model.originOf("relation", "order.customer")).toBe("shop");
    expect(model.originOf("type", "ghost")).toBeNull();
    expect(model.knownScopes).toEqual(["workbench", "global", "shop"]);
    expect(model.diagnostics()).toEqual([]);
  });

  it("projects a static vocabulary tagged with fragment origins", () => {
    const vocabulary = makeModel().vocabulary();
    expect(vocabulary).toMatchObject({
      version: "research-1",
      relations: [
        { id: "order.customer", from: "order", to: "party", fragment: "shop", exposure: { acceptance: true } },
      ],
      help: [{ id: "shop.order.help", subject: { kind: "type", type: "order", match: "exact" }, fragment: "shop" }],
      fragments: [
        { id: "workbench", types: 1, actions: 1, relations: 0, help: 0 },
        { id: "shop", types: 4, actions: 1, relations: 1, help: 1 },
        { id: "shop.presentation", types: 0, actions: 0, relations: 0, help: 0 },
      ],
    });
    expect(vocabulary.actions.find((entry) => entry.id === "workbench.tile.close")?.fragment).toBe("workbench");
    expect(JSON.parse(JSON.stringify(vocabulary))).toEqual(vocabulary);
  });

  describe("snapshot (§8.1, §19.5)", () => {
    it("uses an explicit revision over the declaration's function, and rejects a missing or non-finite one", () => {
      const model = makeModel();
      expect(model.snapshot({ facts, revision: "explicit" }).revision).toBe("explicit");
      expect(() => model.snapshot({ facts, revision: Number.NaN })).toThrow(/finite number/);
      const noPolicy = p.create({
        id: "no-policy",
        include: [shopFragment],
        defaultActiveScopes: ["shop"],
      });
      expect(() => noPolicy.snapshot({ facts })).toThrow(/no semantic revision/);
      expect(noPolicy.snapshot({ facts, revision: 3 }).revision).toBe(3);
    });

    it("accepts an ordered active subset, rejects undeclared or repeated scopes, and needs some stack", () => {
      const model = makeModel();
      expect(model.snapshot({ facts, activeScopes: ["global"] }).scopes).toEqual(["global"]);
      expect(model.snapshot({ facts, activeScopes: ["workbench", "shop"] }).scopes).toEqual(["workbench", "shop"]);
      expect(() => model.snapshot({ facts, activeScopes: ["sidebar"] })).toThrow(/undeclared scope "sidebar"/);
      expect(() => model.snapshot({ facts, activeScopes: ["shop", "shop"] })).toThrow(/repeats active scope/);
      const noDefault = p.create({ id: "no-default", include: [shopFragment], revision: () => 1 });
      expect(() => noDefault.snapshot({ facts })).toThrow(/no active scopes/);
      expect(noDefault.defaultActiveScopes).toBeNull();
    });

    it("a rule in an inactive known scope does not participate; a local scope outranks an outer one", () => {
      const model = makeModel();
      const inactive = model.snapshot({ facts, activeScopes: ["global"] });
      expect(model.actions.resolve({ subject: order, invocation: "menu" }, inactive).actions).toHaveLength(0);
      const stacked = model.snapshot({ facts, activeScopes: ["shop", "global"] });
      expect(model.actions.resolve({ subject: order, invocation: "menu" }, stacked).actions[0]).toMatchObject({
        provenance: expect.objectContaining({ scope: "shop" }),
      });
    });

    it("copies modes/capabilities into read-only sets and does not alias the input arrays", () => {
      const model = makeModel();
      const activeScopes = ["shop"];
      const snapshot = model.snapshot({ facts, activeScopes, modes: ["editing"], capabilities: ["seal"] });
      activeScopes.push("global");
      expect(snapshot.scopes).toEqual(["shop"]);
      expect(snapshot.modes.has("editing")).toBe(true);
      expect(snapshot.capabilities.has("seal")).toBe(true);
      expect(() => model.snapshot(undefined as never)).toThrow(/facts field/);
    });
  });

  describe("structural rules (§19.2)", () => {
    it("rejects duplicate fragment ids and cross-fragment duplicate declarations with both fragments named", () => {
      expect(() =>
        p.create({ id: "dup", include: [shopFragment, { ...shopFragment }], defaultActiveScopes: ["shop"], revision: () => 1 }),
      ).toThrow(/duplicate presentation fragment id "shop"/);
      expect(() =>
        p.create({
          id: "dup-type",
          include: [shopFragment, { id: "other", types: [{ id: "order" }] }],
          defaultActiveScopes: ["shop"],
          revision: () => 1,
        }),
      ).toThrow(/runtime type "order" is declared by both fragment "shop" and fragment "other"/);
      expect(() =>
        p.create({
          id: "dup-descriptor",
          include: [shopFragment],
          descriptors: { order: { label: () => "again" } },
          defaultActiveScopes: ["shop"],
          revision: () => 1,
        }),
      ).toThrow(/descriptor for type "order" is declared by fragment "dup-descriptor"/);
      expect(() =>
        p.create({
          id: "dup-relation",
          include: [shopFragment, { id: "other", relations: [{ ...shopFragment.relations![0]! }] }],
          defaultActiveScopes: ["shop"],
          revision: () => 1,
        }),
      ).toThrow(/relation "order.customer" is declared by both/);
    });

    it("enforces the closed world across fragments: descriptors, abstract nodes, actions, relations", () => {
      expect(() =>
        p.create({
          id: "stray-descriptor",
          include: [shopFragment],
          descriptors: { tile: { label: () => "?" } },
          defaultActiveScopes: ["shop"],
          revision: () => 1,
        }),
      ).toThrow(/descriptor for type "tile" has no node/);
      expect(() =>
        p.create({
          id: "abstract-descriptor",
          include: [shopFragment],
          descriptors: { inspectable: { label: () => "?" } } as never,
          defaultActiveScopes: ["shop"],
          revision: () => 1,
        }),
      ).toThrow(/descriptor for abstract type "inspectable"/);
      expect(() =>
        p.create({
          id: "missing-descriptor",
          types: [{ id: "order" }],
          knownScopes: ["shop"],
          defaultActiveScopes: ["shop"],
          revision: () => 1,
        }),
      ).toThrow(/concrete type "order" has no descriptor/);
      expect(() =>
        p.create({
          id: "no-scopes",
          types: [{ id: "order" }],
          descriptors: { order: { label: () => "o" } },
          revision: () => 1,
        }),
      ).toThrow(/declares no known scopes/);
      expect(() =>
        p.create({
          id: "bad-default",
          include: [shopFragment],
          defaultActiveScopes: ["shop", "sidebar"],
          revision: () => 1,
        }),
      ).toThrow(/defaultActiveScopes names undeclared scope "sidebar"/);
    });

    it("an omitted fragment companion fails with a fragment-aware message", () => {
      // The workbench actions without the workbench types: the very drift
      // fragments exist to prevent, caught at construction.
      expect(() =>
        p.create({
          id: "half",
          include: [shopFragment],
          knownScopes: ["workbench"],
          actions: workbenchFragment.actions,
          defaultActiveScopes: ["shop"],
          revision: () => 1,
        }),
      ).toThrow(/contribution "workbench.tile.close" targets type "tile" which is not in the type graph/);
    });

    it("relaxes descriptor completeness only when a fixture asks, as a warning with origin", () => {
      const model = p.create({
        id: "fixture",
        types: [{ id: "order" }],
        knownScopes: ["shop"],
        defaultActiveScopes: ["shop"],
        revision: () => 1,
        strictDescriptors: false,
      });
      expect(model.diagnostics()).toEqual([
        expect.objectContaining({ severity: "warning", code: "missing-descriptor", ownerId: "order", fragmentId: "fixture" }),
      ]);
    });

    it("reports an included fragment that contributes nothing, and an orphan private relation, with origins", () => {
      const model = p.create({
        id: "advisory",
        include: [shopFragment, { id: "nothing" }, { id: "orphans", relations: [{ ...shopFragment.relations![0]!, id: "orphan", exposure: {} }] }],
        defaultActiveScopes: ["shop"],
        revision: () => 1,
      });
      expect(model.diagnostics()).toEqual([
        expect.objectContaining({ code: "unreachable-private-relation", ownerId: "orphan", fragmentId: "orphans" }),
        expect.objectContaining({ code: "empty-fragment", fragmentId: "nothing" }),
      ]);
    });

    it("accepts a universal family only over declared types", () => {
      const model = p.create({
        id: "universal",
        include: [shopFragment],
        actions: [
          p.actions.family(anyDeclaredType, {
            id: "everything.inspect",
            scopes: ["global"],
            expand: () => [{ key: "i", action: "inspect", metadata: { label: "Inspect" }, bind: () => ({ kind: "open", id: "x" }) }],
          }),
        ],
        knownScopes: ["global"],
        defaultActiveScopes: ["shop", "global"],
        revision: () => 1,
      });
      const snapshot = model.snapshot({ facts });
      const rows = model.actions.resolve({ subject: order, invocation: "menu" }, snapshot).actions.map((a) => a.action);
      expect(rows).toHaveLength(2);
      expect(rows).toEqual(expect.arrayContaining(["shop.order.open", "inspect"]));
      expect(() =>
        model.actions.resolve({ subject: { type: "ghost", value: {} } as never, invocation: "menu" }, snapshot),
      ).toThrow(/"ghost" is not declared/);
    });
  });

  describe("link dependency projection (§12.1)", () => {
    it("offers only derivation-exposed relations and evaluates through the model snapshot", () => {
      const model = p.create({
        id: "links",
        include: [shopFragment],
        relations: [
          p.relation({
            id: "order.customer.accept-only",
            from: "order",
            to: "customer",
            match: "exact",
            exposure: { acceptance: true },
            apply: () => ({ type: "customer", value: { id: "c1" } }),
          }),
        ],
        defaultActiveScopes: ["shop"],
        revision: (f) => f.revision,
      });
      const deps = model.linkDeps({ contextFor: () => ({ facts }) });
      expect(deps.relations?.map((r) => r.id)).toEqual(["order.customer"]);
      const linkSnapshot = {} as never;
      expect(deps.relationEvaluation?.("order.customer", order, linkSnapshot)).toEqual({
        kind: "value",
        reference: { type: "customer", value: { id: "c1" } },
      });
      expect(
        deps.relationEvaluation?.("order.customer", { type: "order", value: { id: "o2", customerId: "nobody" } }, linkSnapshot),
      ).toEqual({ kind: "empty" });
      const unreadable = model.linkDeps({ contextFor: () => ({ facts: { ...facts, readable: false } }) });
      expect(unreadable.relationEvaluation?.("order.customer", order, linkSnapshot)).toMatchObject({
        kind: "error",
        diagnostic: { code: "condition" },
      });
    });
  });
});
