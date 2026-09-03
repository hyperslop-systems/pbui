import { describe, expect, it } from "vitest";
import { applyLinkVerb } from "./apply";
import { checkBinding } from "./check";
import { effectiveBinding, evaluatePort, evaluateProgram } from "./evaluate";
import { bindingOf, dependenciesOfBinding, normalizeBinding, programOf } from "./expression";
import { suspendedAfterPin } from "./plan";
import { isBinding, linkIdOf, sourcePortOf, terms, type Binding } from "./terms";
import { linkVerbs } from "./verbs";
import { CUSTOMER_ADA, deps, ORDER_1042, ORDER_1060, withBindings, world } from "./world.test-helpers";

/*
 * The binding-program laws of the KERNEL-1 guide (§19.6), held as tests
 * (PBUI-KERNEL-2 P1). The persisted grammar is the wire format products
 * store in their link documents; the program is what the kernel reasons
 * over. These laws are what makes it safe to reason over the program and
 * write back the grammar.
 */

/** Terms exactly as a link document stores them: JSON text, one per grammar production plus the nestings the planners write. */
const WIRE_FIXTURES: Record<string, string> = {
  ambient: '{"kind":"ambient","key":"workspace.order"}',
  constant: '{"kind":"constant","reference":{"type":"order","value":{"id":"1042","customer":"Ada"}}}',
  follow: '{"kind":"follow","source":"v-east/order","linkId":"L1"}',
  alias: '{"kind":"alias","classId":"σ1"}',
  derived: '{"kind":"derived","source":{"kind":"follow","source":"v-east/order","linkId":"L2"},"relationId":"order.customer","linkId":"L2"}',
  "derived over derived":
    '{"kind":"derived","source":{"kind":"derived","source":{"kind":"follow","source":"v-east/order","linkId":"L3"},"relationId":"order.self","linkId":"L3"},"relationId":"order.customer","linkId":"L4"}',
  "hold over follow": '{"kind":"hold","reference":{"type":"order","value":{"id":"1042","customer":"Ada"}},"suspended":{"kind":"follow","source":"v-east/order","linkId":"L5"}}',
  "hold over derived":
    '{"kind":"hold","reference":{"type":"customer","value":{"id":"c-ada","name":"Ada"}},"suspended":{"kind":"derived","source":{"kind":"follow","source":"v-east/order","linkId":"L6"},"relationId":"order.customer","linkId":"L6"}}',
  "hold over unresolved (unlink freeze)":
    '{"kind":"hold","reference":{"type":"order","value":{"id":"1042","customer":"Ada"}},"suspended":{"kind":"unresolved","diagnostic":{"code":"unlinked","message":"the link was cut; there is no source to resume"}}}',
  unresolved: '{"kind":"unresolved","diagnostic":{"code":"unlinked","message":"the link was cut"}}',
};

const parsed = (name: string): Binding => {
  const value: unknown = JSON.parse(WIRE_FIXTURES[name]!);
  if (!isBinding(value)) throw new Error(`fixture ${name} is not a binding`);
  return value;
};

/** A term the grammar admits but the program does not preserve: a hold UNDER a derivation. */
const NON_CANONICAL: Binding = terms.derived(terms.hold(ORDER_1042, terms.follow("v-east/order", "L7")), "order.customer", "L7");

const setsOf = (binding: Binding) => {
  const d = dependenciesOfBinding(binding);
  return { ports: [...d.ports].sort(), relations: [...d.relations].sort(), links: [...d.links].sort() };
};

describe("§19.6 wire round trip", () => {
  for (const name of Object.keys(WIRE_FIXTURES)) {
    it(`bindingOf(programOf(b)) == b for a persisted ${name} term, byte for byte`, () => {
      const binding = parsed(name);
      expect(bindingOf(programOf(binding))).toEqual(binding);
      // Key order is part of what a document stores; the lowering writes the grammar's order.
      expect(JSON.stringify(bindingOf(programOf(binding)))).toBe(WIRE_FIXTURES[name]);
    });
  }

  it("a hold under a derivation is the one grammar shape the program collapses: only the frozen value takes part", () => {
    const normalized = normalizeBinding(NON_CANONICAL);
    expect(normalized).toEqual(terms.derived(terms.constant(ORDER_1042), "order.customer", "L7"));
    expect(normalized).not.toEqual(NON_CANONICAL);
  });
});

describe("§19.6 normalize(normalize(b)) == normalize(b)", () => {
  for (const name of Object.keys(WIRE_FIXTURES)) {
    it(`is a fixpoint on a persisted ${name} term`, () => {
      const once = normalizeBinding(parsed(name));
      expect(once).toEqual(parsed(name));
      expect(normalizeBinding(once)).toEqual(once);
    });
  }

  it("is idempotent on the non-canonical shape too: one pass reaches the fixpoint", () => {
    const once = normalizeBinding(NON_CANONICAL);
    expect(normalizeBinding(once)).toEqual(once);
    expect(normalizeBinding(normalizeBinding(once))).toEqual(once);
  });
});

describe("§19.6 normalization preserves structural dependencies", () => {
  for (const name of Object.keys(WIRE_FIXTURES)) {
    it(`ports, relations and links of a ${name} term survive normalization`, () => {
      expect(setsOf(normalizeBinding(parsed(name)))).toEqual(setsOf(parsed(name)));
    });
  }

  it("names every relation and link of a nested derivation, and the one port under them", () => {
    expect(setsOf(parsed("derived over derived"))).toEqual({
      ports: ["v-east/order"],
      relations: ["order.customer", "order.self"],
      links: ["L3", "L4"],
    });
  });

  it("a suspended wire counts unless the caller says otherwise", () => {
    const held = parsed("hold over derived");
    expect(setsOf(held).ports).toEqual(["v-east/order"]);
    expect([...dependenciesOfBinding(held, { includeSuspended: false }).ports]).toEqual([]);
    expect([...dependenciesOfBinding(held, { includeSuspended: false }).links]).toEqual([]);
  });

  it("the non-canonical collapse drops the suspended wire, which is the point of the collapse", () => {
    expect(setsOf(normalizeBinding(NON_CANONICAL))).toEqual({ ports: [], relations: ["order.customer"], links: ["L7"] });
  });
});

describe("§19.6 resume(pin(b)) == b", () => {
  const cases: Array<[string, Parameters<typeof world>[0], string]> = [
    ["follow", { bindings: { "v-a/order": terms.follow("v-east/order", "L1") }, emitted: { "v-east/order": ORDER_1042 } }, "v-a/order"],
    ["derived", { bindings: { "v-cust/customer": terms.derived(terms.follow("v-east/order", "L2"), "order.customer", "L2") }, emitted: { "v-east/order": ORDER_1042 } }, "v-cust/customer"],
    ["constant", { bindings: { "v-a/order": terms.constant(ORDER_1042) } }, "v-a/order"],
    ["ambient (explicit, not the fallback)", { bindings: { "v-insp/subject": terms.ambient("workspace.order") }, contexts: { "workspace.order": ORDER_1042 } }, "v-insp/subject"],
    ["alias (a shared cell)", { identity: [{ linkId: "I1", left: "v-east/selection", right: "v-plot/selection", mergePolicy: "prefer-left" }], classCells: { σ1: ORDER_1042 } }, "v-plot/selection"],
  ];
  for (const [name, options, port] of cases) {
    it(`holds at the term level for a ${name} term`, () => {
      const s = world(options);
      const before = effectiveBinding(port, s);
      const pinned = applyLinkVerb(linkVerbs.pin(port), s, deps);
      if (name === "constant") {
        // A constant has nothing to suspend: pin refuses, so the law is vacuous and the document untouched.
        expect(pinned).toMatchObject({ kind: "refused", plan: { code: "fixed" } });
        return;
      }
      expect(pinned.kind).toBe("ok");
      if (pinned.kind !== "ok") return;
      const heldTerm = pinned.bindings.get(port)!;
      expect(heldTerm.kind).toBe("hold");
      expect(suspendedAfterPin(heldTerm)).toEqual(before);
      const resumed = applyLinkVerb(linkVerbs.resume(port), withBindings(s, pinned.bindings), deps);
      expect(resumed.kind).toBe("ok");
      if (resumed.kind !== "ok") return;
      expect(effectiveBinding(port, withBindings(s, resumed.bindings))).toEqual(before);
      expect([...resumed.bindings.entries()]).toEqual([...s.bindings.entries()]);
    });
  }
});

describe("§19.6 a held value is independent of upstream changes", () => {
  it("evaluates the same program to the same value against any snapshot", () => {
    const program = programOf(terms.hold(ORDER_1042, terms.follow("v-east/order", "L1")));
    const quiet = world();
    const moved = world({ emitted: { "v-east/order": ORDER_1060 } });
    const gone = world({ without: ["v-east"] });
    for (const s of [quiet, moved, gone]) {
      expect(evaluateProgram(program, s, deps, ["v-a/order"])).toMatchObject({ kind: "value", reference: ORDER_1042 });
    }
  });

  it("at the port: the source emits something else, the held port does not follow", () => {
    const s = world({ bindings: { "v-a/order": terms.follow("v-east/order", "L1") }, emitted: { "v-east/order": ORDER_1042 } });
    const pinned = applyLinkVerb(linkVerbs.pin("v-a/order"), s, deps);
    if (pinned.kind !== "ok") throw new Error("pin refused");
    const later = withBindings(world({ emitted: { "v-east/order": ORDER_1060 } }), pinned.bindings);
    expect(evaluatePort("v-a/order", later, deps)).toMatchObject({ kind: "value", reference: ORDER_1042 });
    expect(evaluatePort("v-east/order", later, deps)).toMatchObject({ kind: "value", reference: ORDER_1060 });
  });
});

describe("§19.6 checker coverage", () => {
  const s = world({ emitted: { "v-east/order": ORDER_1042 } });

  it("missing source port", () => {
    expect(checkBinding(terms.follow("v-gone/order", "L"), s, deps, "v-a/order")).toMatchObject({ kind: "invalid", diagnostic: { code: "source-missing" } });
  });

  it("missing context", () => {
    expect(checkBinding(terms.ambient("workspace.nothing"), s, deps, "v-a/order")).toMatchObject({ kind: "invalid", diagnostic: { code: "context-missing" } });
  });

  it("missing identity cell", () => {
    expect(checkBinding(terms.alias("σ9"), s, deps, "v-east/selection")).toMatchObject({ kind: "invalid", diagnostic: { code: "class-missing" } });
  });

  it("an identity cell that exists types as its members do", () => {
    const shared = world({ identity: [{ linkId: "I1", left: "v-east/selection", right: "v-plot/selection", mergePolicy: "prefer-left" }] });
    const classId = shared.aliases.get("v-east/selection")!;
    expect(checkBinding(terms.alias(classId), shared, deps)).toMatchObject({ kind: "valid", resultType: "datum" });
  });

  it("missing relation", () => {
    expect(checkBinding(terms.derived(terms.follow("v-east/order", "L"), "order.nowhere", "L"), s, deps, "v-cust/customer")).toMatchObject({ kind: "invalid", diagnostic: { code: "relation-missing" } });
  });

  it("relation domain mismatch: the input type does not reach the relation's source", () => {
    expect(checkBinding(terms.derived(terms.follow("v-plot/datum", "L"), "order.customer", "L"), s, deps, "v-cust/customer")).toMatchObject({ kind: "invalid", diagnostic: { code: "relation-source" } });
  });

  it("destination mismatch: the inferred type does not reach the destination's type", () => {
    expect(checkBinding(terms.derived(terms.follow("v-east/order", "L"), "order.customer", "L"), s, deps, "v-a/order")).toMatchObject({
      kind: "invalid",
      diagnostic: { code: "type", message: "<customer> does not reach <order>" },
    });
    expect(checkBinding(terms.constant(CUSTOMER_ADA), s, deps, "v-a/order")).toMatchObject({ kind: "invalid", diagnostic: { code: "type" } });
  });

  it("direct cycle: the destination is the source", () => {
    const loop = world({ bindings: { "v-b/order": terms.follow("v-east/order", "L1") } });
    // v-a would read v-b, which reads v-east; fine. v-b reading v-a while v-a reads v-b is the loop.
    const s2 = withBindings(loop, new Map([...loop.bindings, ["v-a/order", terms.follow("v-b/order", "L2")]]));
    expect(checkBinding(terms.follow("v-a/order", "L3"), s2, deps, "v-b/order")).toMatchObject({ kind: "invalid", diagnostic: { code: "cycle" } });
  });

  it("transitive cycle: through two followers", () => {
    const chain = world({
      bindings: {
        "v-a/order": terms.follow("v-b/order", "L1"),
        "v-b/order": terms.follow("v-c/order", "L2"),
      },
    });
    expect(checkBinding(terms.follow("v-a/order", "L3"), chain, deps, "v-c/order")).toMatchObject({ kind: "invalid", diagnostic: { code: "cycle" } });
  });

  it("held dependencies count: a suspended wire that would close a loop on resume is refused now", () => {
    const held = world({ bindings: { "v-a/order": terms.hold(ORDER_1042, terms.follow("v-b/order", "L1")) } });
    expect(checkBinding(terms.follow("v-a/order", "L2"), held, deps, "v-b/order")).toMatchObject({ kind: "invalid", diagnostic: { code: "cycle" } });
  });

  it("a partial but well-typed relation is valid: emptiness is a runtime fact, not a static error", () => {
    const partial = { ...deps, relationEvaluation: () => ({ kind: "empty" as const }) };
    const candidate = terms.derived(terms.follow("v-east/order", "L"), "order.customer", "L");
    expect(checkBinding(candidate, s, partial, "v-cust/customer")).toMatchObject({ kind: "valid", resultType: "customer" });
    expect(evaluatePort("v-cust/customer", withBindings(s, new Map([["v-cust/customer", candidate]])), partial)).toMatchObject({ kind: "empty" });
  });

  it("a broken term stays explicit: it is invalid with its own diagnostic, not a crash", () => {
    expect(checkBinding(terms.unresolved("unlinked", "the link was cut"), s, deps, "v-a/order")).toMatchObject({ kind: "invalid", diagnostic: { code: "unresolved", message: "the link was cut" } });
  });

  it("a held term types as its frozen value and reports the suspended wire as a dependency", () => {
    const result = checkBinding(terms.hold(CUSTOMER_ADA, terms.follow("v-east/order", "L")), s, deps, "v-cust/customer");
    expect(result).toMatchObject({ kind: "valid", resultType: "customer" });
    if (result.kind === "valid") expect([...result.dependencies.ports]).toEqual(["v-east/order"]);
  });
});

describe("§12.5 the wire-level projections agree with the IR", () => {
  // `sourcePortOf` and `linkIdOf` stay on terms.ts for the badge and the
  // workbench's link refs, which need ONE source to name. They are
  // projections of the dependency sets, and this law says so.
  for (const name of Object.keys(WIRE_FIXTURES)) {
    it(`sourcePortOf and linkIdOf of a ${name} term are members of its dependency sets`, () => {
      const binding = parsed(name);
      const d = dependenciesOfBinding(binding);
      const source = sourcePortOf(binding);
      if (source === null) expect(d.ports.size).toBe(0);
      else {
        expect(d.ports.size).toBe(1);
        expect(d.ports.has(source)).toBe(true);
      }
      const linkId = linkIdOf(binding);
      if (linkId !== null) expect(d.links.has(linkId)).toBe(true);
    });
  }
});
