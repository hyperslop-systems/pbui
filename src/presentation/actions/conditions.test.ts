import { describe, expect, test } from "vitest";
import { available, unavailable } from "./availability";
import {
  all,
  capability,
  evaluateCondition,
  modeOff,
  predicate,
  referencedPredicates,
} from "./conditions";
import type { ProductPredicate } from "./conditions";
import type { InheritedRuleContext, SelectionSnapshot } from "./types";

type Values = { thing: { id: string } };
type Facts = { canDelete: boolean };

function snapshot(over: Partial<SelectionSnapshot<Facts>> = {}): SelectionSnapshot<Facts> {
  return {
    revision: 1,
    scopes: ["global"],
    modes: new Set(),
    capabilities: new Set(),
    product: { canDelete: true },
    ...over,
  };
}

function context(over: Partial<SelectionSnapshot<Facts>> = {}): InheritedRuleContext<Values, Facts> {
  return { subject: { type: "thing", value: { id: "t1" } }, snapshot: snapshot(over) };
}

const canDelete: ProductPredicate<Values, Facts> = ({ snapshot: s }) =>
  s.product.canDelete ? available() : unavailable("this file is protected from deletion");

const predicates = new Map([["file.can-delete", canDelete]]);

describe("evaluateCondition", () => {
  test("all short-circuits to the FIRST non-available child — one dominating reason", () => {
    const condition = all(
      modeOff("review", unavailable("review mode is read-only")),
      capability("write", unavailable("write access is required")),
      predicate("file.can-delete"),
    );
    expect(
      evaluateCondition(condition, context({ modes: new Set(["review"]) }), predicates),
    ).toEqual(unavailable("review mode is read-only"));
    expect(evaluateCondition(condition, context(), predicates)).toEqual(
      unavailable("write access is required"),
    );
    expect(
      evaluateCondition(condition, context({ capabilities: new Set(["write"]) }), predicates),
    ).toEqual(available());
  });

  test("predicates return full availability, and read the product facts", () => {
    expect(
      evaluateCondition(
        predicate("file.can-delete"),
        context({ product: { canDelete: false }, capabilities: new Set(["write"]) }),
        predicates,
      ),
    ).toEqual(unavailable("this file is protected from deletion"));
  });

  test("an unknown predicate fails closed — it throws, never defaults to available", () => {
    expect(() => evaluateCondition(predicate("ghost"), context(), predicates)).toThrow(
      /unknown predicate "ghost"/,
    );
  });

  test("referencedPredicates walks nested trees for registration validation", () => {
    expect(
      referencedPredicates(
        all(all(predicate("a")), capability("c", unavailable("x")), predicate("b")),
      ),
    ).toEqual(["a", "b"]);
  });
});
