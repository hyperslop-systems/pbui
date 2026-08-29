import { describe, expect, test } from "vitest";
import { available, unavailable } from "../actions/availability";
import { all, capability, definePredicate, modeOn, predicate } from "../actions/conditions";
import type { ProductPredicate } from "../actions/conditions";
import { createPresentationTypeGraph } from "../actions/typeGraph";
import type { SelectionSnapshot } from "../actions/types";
import { activeScope, matchContext } from "./match";

/**
 * PBUI-HELP-001 Phase 2 (design doc §18 "pure matcher tests"): the shared
 * matcher answers reachability the same way for the action and help callers.
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
    const target = { subject: "image-file", match: "exact", scopes: ["global"] } as const;
    expect(matchContext(target, imageFile, snapshot(), graph, NO_PREDICATES).kind).toBe("matched");
    const onFile = matchContext(
      { subject: "file", match: "exact", scopes: ["global"] },
      imageFile,
      snapshot(),
      graph,
      NO_PREDICATES,
    );
    expect(onFile).toMatchObject({ kind: "rejected", stage: "type" });
  });

  test("subtypes matches through ancestors at shortest distance", () => {
    const result = matchContext(
      { subject: "document", match: "subtypes", scopes: ["global"] },
      imageFile,
      snapshot(),
      graph,
      NO_PREDICATES,
    );
    expect(result).toMatchObject({
      kind: "matched",
      match: {
        declaredType: "document",
        concreteType: "image-file",
        typeDistance: 2,
      },
    });
  });

  test("an unrelated type rejects at the type stage", () => {
    const result = matchContext(
      { subject: "note", match: "subtypes", scopes: ["global"] },
      imageFile,
      snapshot(),
      graph,
      NO_PREDICATES,
    );
    expect(result).toMatchObject({ kind: "rejected", stage: "type" });
  });
});

describe("scope stage", () => {
  test("the nearest active scope wins from the inner-to-outer stack order", () => {
    const result = matchContext(
      { subject: "image-file", match: "exact", scopes: ["global", "workbench"] },
      imageFile,
      snapshot(),
      graph,
      NO_PREDICATES,
    );
    expect(result).toMatchObject({
      kind: "matched",
      match: { scope: "workbench", scopeIndex: 1 },
    });
  });

  test("unknown or inactive scopes reject at the scope stage", () => {
    const result = matchContext(
      { subject: "image-file", match: "exact", scopes: ["sidebar"] },
      imageFile,
      snapshot(),
      graph,
      NO_PREDICATES,
    );
    expect(result).toEqual({ kind: "rejected", stage: "scope", reason: "no-active-scope" });
  });

  test("activeScope is exported for the resolver's wildcard families", () => {
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
    const target = {
      subject: "image-file",
      match: "exact",
      scopes: ["global"],
      when: all(
        modeOn("editing", unavailable("enable editing first")),
        capability("can-edit", unavailable("no edit capability")),
        predicate("product.is-owner"),
      ),
    } as const;
    const failing = matchContext(target, imageFile, snapshot(), graph, predicates);
    // `all` fails with the FIRST non-available child, same as evaluateCondition.
    expect(failing).toEqual({
      kind: "rejected",
      stage: "condition",
      reason: "enable editing first",
    });
    const passing = matchContext(
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
    const result = matchContext(
      {
        subject: "image-file",
        match: "exact",
        scopes: ["global"],
        when: predicate("always-hidden"),
      },
      imageFile,
      snapshot(),
      graph,
      new Map([[gone.id, gone.evaluate]]),
    );
    expect(result).toEqual({ kind: "rejected", stage: "condition", reason: "hidden" });
  });

  test("an unknown predicate throws — never defaults to available", () => {
    expect(() =>
      matchContext(
        {
          subject: "image-file",
          match: "exact",
          scopes: ["global"],
          when: predicate("missing"),
        },
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
    const result = matchContext(
      {
        subject: "file",
        match: "subtypes",
        scopes: ["global"],
        priority: 7,
      },
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

  test("an undeclared concrete type still matches itself exactly (isolated node)", () => {
    const stray = { type: "stray", value: { id: "s" } } as const;
    const result = matchContext(
      { subject: "stray", match: "exact", scopes: ["global"] },
      stray as never,
      snapshot(),
      graph,
      NO_PREDICATES,
    );
    expect(result).toMatchObject({ kind: "matched", match: { typeDistance: 0 } });
  });
});
