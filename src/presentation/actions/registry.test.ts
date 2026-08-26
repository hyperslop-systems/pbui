import { describe, expect, test } from "vitest";
import { available, unavailable } from "./availability";
import { definePredicate, predicate } from "./conditions";
import { defineActions } from "./define";
import { createActionRegistry } from "./registry";
import { createPresentationTypeGraph } from "./typeGraph";
import type { ActionContribution } from "./types";

type Values = { file: { id: string } };
type Facts = { ok: boolean };
type Verb = { kind: string };

const graph = createPresentationTypeGraph([
  { id: "object", abstract: true },
  { id: "file", parents: ["object"] },
]);
const define = defineActions<Values, Facts, Verb>();

function rule(id: string, over: Partial<Parameters<typeof define.exact>[1]> = {}) {
  return define.exact("file", {
    id,
    action: "file.open",
    scopes: ["global"],
    metadata: { label: "Open" },
    bind: () => ({ kind: "open" }),
    ...over,
  });
}

function build(contributions: readonly ActionContribution<Values, Facts, Verb>[], extra = {}) {
  return createActionRegistry<Values, Facts, Verb>({
    graph,
    scopes: ["global", "editor"],
    contributions,
    ...extra,
  });
}

describe("createActionRegistry validation is fail-fast", () => {
  test("duplicate contribution ids", () => {
    expect(() => build([rule("a"), rule("a", { action: "file.close" })])).toThrow(
      /duplicate contribution id "a"/,
    );
  });

  test("duplicate predicate ids", () => {
    const p = definePredicate<Values, Facts>("p", () => available());
    expect(() => build([], { predicates: [p, p] })).toThrow(/duplicate predicate id "p"/);
  });

  test("empty scopes", () => {
    expect(() => build([rule("a", { scopes: [] })])).toThrow(/declares no scopes/);
  });

  test("unknown scope", () => {
    expect(() => build([rule("a", { scopes: ["ghost"] })])).toThrow(/unknown scope "ghost"/);
  });

  test("subject type absent from the graph", () => {
    const stray = define.inherited("ghost-type", {
      id: "stray",
      action: "x.y",
      scopes: ["global"],
      metadata: { label: "?" },
      bind: () => ({ kind: "x" }),
    });
    expect(() => build([stray])).toThrow(/not in the type graph/);
  });

  test('"*" is families-only, and family ids may not contain the candidate separator', () => {
    const starRule = define.inherited("object", {
      id: "star",
      action: "x.y",
      scopes: ["global"],
      metadata: { label: "?" },
      bind: () => ({ kind: "x" }),
    });
    expect(() => build([{ ...starRule, subject: "*" }])).toThrow(/only families/);
    const slashed = define.family("file", {
      id: "bad/id",
      scopes: ["global"],
      expand: () => [],
    });
    expect(() => build([slashed])).toThrow(/reserved as the candidate-id separator/);
  });

  test("a rule id must not double as its action id — the distinction is load-bearing", () => {
    expect(() => build([rule("file.open")])).toThrow(/reuses its rule id/);
  });

  test("unknown predicate reference", () => {
    expect(() => build([rule("a", { when: predicate("ghost") })])).toThrow(
      /unknown predicate "ghost"/,
    );
  });

  test("non-finite priority and menu order", () => {
    expect(() => build([rule("a", { priority: Number.NaN })])).toThrow(/non-finite priority/);
    expect(() =>
      build([
        rule("a", { metadata: { label: "Open", order: Number.POSITIVE_INFINITY } }),
      ]),
    ).toThrow(/non-finite menu order/);
  });

  test("two unconditional twins that MUST tie are rejected at construction", () => {
    expect(() => build([rule("plugin-a.open"), rule("plugin-b.open")])).toThrow(
      /guaranteed to collide/,
    );
    // A condition on either side defers the question to resolution.
    expect(() =>
      build([rule("plugin-a.open"), rule("plugin-b.open", { test: () => available() })]),
    ).not.toThrow();
  });
});

describe("diagnostics and reachability", () => {
  test("conditional overlaps surface as potential conflicts, opaque testers are flagged", () => {
    const registry = build([
      rule("plugin-a.open"),
      rule("plugin-b.open", { test: () => unavailable("x") }),
    ]);
    const codes = registry.diagnostics().map((diagnostic) => diagnostic.code);
    expect(codes).toContain("potential-conflict");
    expect(codes).toContain("opaque-tester");
  });

  test("listReachable reports rules and families by declared type, distance, and scope", () => {
    const family = define.family("object", {
      id: "generated",
      match: "subtypes",
      scopes: ["editor"],
      expand: () => [],
    });
    const registry = build([rule("files.open"), family]);
    expect(registry.listReachable("file", ["editor", "global"])).toEqual([
      {
        contributionId: "files.open",
        kind: "rule",
        action: "file.open",
        declaredType: "file",
        distance: 0,
      },
      { contributionId: "generated", kind: "family", declaredType: "object", distance: 1 },
    ]);
    // Scope filtering applies.
    expect(registry.listReachable("file", ["global"]).map((entry) => entry.contributionId)).toEqual([
      "files.open",
    ]);
  });
});
