import { describe, expect, test } from "vitest";
import { available, unavailable } from "../actions/availability";
import { all, capability, definePredicate, modeOn, predicate } from "../actions/conditions";
import type { ProductPredicate } from "../actions/conditions";
import { createPresentationTypeGraph } from "../actions/typeGraph";
import type { SelectionSnapshot } from "../actions/types";
import { activeScope, matchSelector, requireScoped, selectorOf } from "./selector";
import { anyDeclaredType } from "./types";

/**
 * PBUI-HELP-001 Phase 2 ("pure matcher tests"), revised by PBUI-KERNEL-1 §9:
 * the shared selector answers reachability the same way for the action, help,
 * and relation callers; universal subjects and universal scopes are explicit
 * values with nullable provenance; the type world is closed.
 */

type Values = {
  file: { id: string };
  "image-file": { id: string; format: string };
  note: { id: string };
};
type Facts = { owner: string };

const graph = createPresentationTypeGraph([
  { id: "object", abstract: true },
  { id: "document", abstract: true, parents: ["object"] },
  { id: "file", parents: ["document"] },
  { id: "image-file", parents: ["file"] },
  { id: "note", parents: ["document"] },
]);

const NO_PREDICATES = new Map<string, ProductPredicate<Values, Facts>>();

function snapshot(over: Partial<SelectionSnapshot<Facts>> = {}): SelectionSnapshot<Facts> {
  return {
    revision: 1,
    scopes: ["editor", "workbench", "global"],
    modes: new Set(),
    capabilities: new Set(),
    product: { owner: "me" },
    ...over,
  };
}

const imageFile = { type: "image-file", value: { id: "i1", format: "png" } } as const;

describe("type stage", () => {
  test("exact accepts only the concrete type", () => {
    const target = selectorOf({ subject: "image-file", match: "exact", scopes: ["global"] });
    expect(matchSelector(target, imageFile, snapshot(), graph, NO_PREDICATES).kind).toBe("matched");
    const onFile = matchSelector(
      selectorOf({ subject: "file", match: "exact", scopes: ["global"] }),
      imageFile,
      snapshot(),
      graph,
      NO_PREDICATES,
    );
    expect(onFile).toMatchObject({ kind: "rejected", stage: "type" });
  });

  test("subtypes matches through ancestors at shortest distance", () => {
    const result = matchSelector(
      selectorOf({ subject: "document", match: "subtypes", scopes: ["global"] }),
      imageFile,
      snapshot(),
      graph,
      NO_PREDICATES,
    );
    expect(result).toMatchObject({
      kind: "matched",
      match: { declaredType: "document", concreteType: "image-file", typeDistance: 2 },
    });
  });

  test("an unrelated type rejects at the type stage", () => {
    const result = matchSelector(
      selectorOf({ subject: "note", match: "subtypes", scopes: ["global"] }),
      imageFile,
      snapshot(),
      graph,
      NO_PREDICATES,
    );
    expect(result).toMatchObject({ kind: "rejected", stage: "type" });
  });

  test("the universal subject matches every declared type at distance 0 with null declaredType", () => {
    const universal = selectorOf({ subject: anyDeclaredType, match: "exact", scopes: ["global"] });
    expect(universal.subject).toEqual({ kind: "any-declared-type" });
    const result = matchSelector(universal, imageFile, snapshot(), graph, NO_PREDICATES);
    expect(result).toEqual({
      kind: "matched",
      match: {
        declaredType: null,
        concreteType: "image-file",
        typeDistance: 0,
        scope: "global",
        scopeIndex: 2,
        priority: 0,
      },
    });
  });

  test("an undeclared concrete type is an error, not an isolated node (closed world)", () => {
    const stray = { type: "stray", value: { id: "s" } } as const;
    expect(() =>
      matchSelector(
        selectorOf({ subject: anyDeclaredType, match: "exact", scopes: ["global"] }),
        stray as never,
        snapshot(),
        graph,
        NO_PREDICATES,
      ),
    ).toThrow(/"stray" is not declared/);
    expect(() =>
      matchSelector(
        selectorOf({ subject: "stray", match: "exact", scopes: ["global"] }),
        stray as never,
        snapshot(),
        graph,
        NO_PREDICATES,
      ),
    ).toThrow(/closed world/);
  });
});

describe("scope stage", () => {
  test("the nearest active scope wins from the inner-to-outer stack order", () => {
    const result = matchSelector(
      selectorOf({ subject: "image-file", match: "exact", scopes: ["global", "workbench"] }),
      imageFile,
      snapshot(),
      graph,
      NO_PREDICATES,
    );
    expect(result).toMatchObject({ kind: "matched", match: { scope: "workbench", scopeIndex: 1 } });
  });

  test("unknown or inactive scopes reject at the scope stage", () => {
    const result = matchSelector(
      selectorOf({ subject: "image-file", match: "exact", scopes: ["sidebar"] }),
      imageFile,
      snapshot(),
      graph,
      NO_PREDICATES,
    );
    expect(result).toEqual({ kind: "rejected", stage: "scope", reason: "no-active-scope" });
  });

  test("an empty scope list is scope-universal: matches with null scope provenance", () => {
    const result = matchSelector(
      selectorOf({ subject: "image-file", match: "exact" }),
      imageFile,
      snapshot({ scopes: [] }),
      graph,
      NO_PREDICATES,
    );
    expect(result).toEqual({
      kind: "matched",
      match: {
        declaredType: "image-file",
        concreteType: "image-file",
        typeDistance: 0,
        scope: null,
        scopeIndex: null,
        priority: 0,
      },
    });
    expect(() => {
      if (result.kind === "matched") requireScoped(result.match, 'rule "r"');
    }).toThrow(/requires explicit scopes/);
  });

  test("activeScope picks the lowest stack index among declared scopes", () => {
    expect(activeScope(["global", "editor"], ["editor", "global"])).toEqual({
      scope: "editor",
      index: 0,
    });
    expect(activeScope(["sidebar"], ["editor", "global"])).toBeNull();
  });
});

describe("condition stage", () => {
  const isOwner = definePredicate<Values, Facts>("product.is-owner", ({ snapshot: s }) =>
    s.product.owner === "me" ? available() : unavailable("not the owner"),
  );
  const predicates = new Map([[isOwner.id, isOwner.evaluate]]);

  test("conditions and named predicates evaluate exactly as the action kernel's", () => {
    const target = selectorOf({
      subject: "image-file",
      match: "exact",
      scopes: ["global"],
      when: all(
        modeOn("editing", unavailable("enable editing first")),
        capability("can-edit", unavailable("no edit capability")),
        predicate("product.is-owner"),
      ),
    });
    const failing = matchSelector(target, imageFile, snapshot(), graph, predicates);
    // `all` fails with the FIRST non-available child, same as evaluateCondition.
    expect(failing).toEqual({ kind: "rejected", stage: "condition", reason: "enable editing first" });
    const passing = matchSelector(
      target,
      imageFile,
      snapshot({ modes: new Set(["editing"]), capabilities: new Set(["can-edit"]) }),
      graph,
      predicates,
    );
    expect(passing.kind).toBe("matched");
  });

  test("a non-unavailable failure rejects with its kind as the reason", () => {
    const gone = definePredicate<Values, Facts>("always-hidden", () => ({
      kind: "hidden",
      because: "not-disclosed",
    }));
    const result = matchSelector(
      selectorOf({
        subject: "image-file",
        match: "exact",
        scopes: ["global"],
        when: predicate("always-hidden"),
      }),
      imageFile,
      snapshot(),
      graph,
      new Map([[gone.id, gone.evaluate]]),
    );
    expect(result).toEqual({ kind: "rejected", stage: "condition", reason: "hidden" });
  });

  test("an unknown predicate throws — never defaults to available", () => {
    expect(() =>
      matchSelector(
        selectorOf({
          subject: "image-file",
          match: "exact",
          scopes: ["global"],
          when: predicate("missing"),
        }),
        imageFile,
        snapshot(),
        graph,
        NO_PREDICATES,
      ),
    ).toThrow(/unknown predicate "missing"/);
  });
});

describe("provenance", () => {
  test("a match carries full provenance including the echoed priority", () => {
    const result = matchSelector(
      selectorOf({ subject: "file", match: "subtypes", scopes: ["global"], priority: 7 }),
      imageFile,
      snapshot(),
      graph,
      NO_PREDICATES,
    );
    expect(result).toEqual({
      kind: "matched",
      match: {
        declaredType: "file",
        concreteType: "image-file",
        typeDistance: 1,
        scope: "global",
        scopeIndex: 2,
        priority: 7,
      },
    });
  });
});
