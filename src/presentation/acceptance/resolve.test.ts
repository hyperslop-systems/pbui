import { describe, expect, test } from "vitest";
import { createPresentationTypeGraph } from "../actions/typeGraph";
import type { SelectionSnapshot } from "../actions/types";
import { createRelationSystem } from "../relations/system";
import type { PresentationRelation } from "../relations/types";
import { resolveAcceptance } from "./resolve";

/**
 * The PBUI-ACTIONS-2 §24.7 acceptance matrix over canonical relations
 * (PBUI-KERNEL-1 §11.3, §19.3): subtype satisfaction preserves the concrete
 * reference; a supertype never satisfies a subtype request; one edge
 * settles; mismatched source/target/scope is nothing; two edges at equal
 * footing are a chooser; declaration order never chooses; only
 * acceptance-exposed relations participate; an abstract requested type
 * accepts a concrete relation output.
 */

type Values = {
  document: { id: string };
  "image-file": { id: string; format: string };
  cat: { docId: string; field: string; value: string };
  field: { docId: string; name: string };
};
type Facts = { tag: string };

const graph = createPresentationTypeGraph([
  { id: "document", abstract: true },
  { id: "image-file", parents: ["document"] },
  { id: "cat" },
  { id: "field", parents: ["document"] },
]);

const catToField: PresentationRelation<Values, Facts> = {
  id: "product.cat-to-field",
  from: "cat",
  to: "field",
  match: "exact",
  exposure: { acceptance: true },
  apply: (reference) => {
    if (reference.type !== "cat") return undefined;
    return { type: "field", value: { docId: reference.value.docId, name: reference.value.field } };
  },
};

function snapshot(over: Partial<SelectionSnapshot<Facts>> = {}): SelectionSnapshot<Facts> {
  return {
    revision: 1,
    scopes: ["editor", "global"],
    modes: new Set(),
    capabilities: new Set(),
    product: { tag: "t" },
    ...over,
  };
}

function resolve(
  relations: PresentationRelation<Values, Facts>[],
  types: keyof Values | readonly (keyof Values)[],
  reference: Parameters<typeof resolveAcceptance<Values, Facts>>[2],
  over: Partial<SelectionSnapshot<Facts>> = {},
  filter?: (reference: Parameters<typeof resolveAcceptance<Values, Facts>>[2]) => boolean,
) {
  const system = createRelationSystem<Values, Facts>({ graph, scopes: ["editor", "global"], relations });
  return resolveAcceptance<Values, Facts>(
    { relations: system },
    { types: types as never, prompt: "?", ...(filter ? { filter } : {}) },
    reference,
    snapshot(over),
  );
}

const image = { type: "image-file", value: { id: "img", format: "png" } } as const;
const cat = { type: "cat", value: { docId: "d1", field: "region", value: "north" } } as const;

describe("resolveAcceptance", () => {
  test("a subtype satisfies a supertype request with the ORIGINAL reference", () => {
    expect(resolve([], "document", image)).toEqual({
      kind: "accepted",
      option: { relation: null, result: image },
    });
  });

  test("a supertype never satisfies a subtype request", () => {
    // `document` is abstract: it cannot be a runtime reference, so ask with a
    // concrete sibling instead.
    const field = { type: "field", value: { docId: "d", name: "n" } } as const;
    expect(resolve([], "image-file", field)).toEqual({ kind: "none" });
  });

  test("one direct relation settles; source/target mismatches are nothing", () => {
    expect(resolve([catToField], "field", cat)).toEqual({
      kind: "accepted",
      option: {
        relation: "product.cat-to-field",
        result: { type: "field", value: { docId: "d1", name: "region" } },
      },
    });
    expect(resolve([catToField], "field", image)).toEqual({ kind: "none" });
    expect(resolve([catToField], "cat", image)).toEqual({ kind: "none" });
  });

  test("an abstract requested type accepts a concrete relation output", () => {
    expect(resolve([catToField], "document", cat)).toMatchObject({
      kind: "accepted",
      option: { relation: "product.cat-to-field", result: { type: "field" } },
    });
  });

  test("only acceptance-exposed relations participate", () => {
    const facetOnly = { ...catToField, exposure: { facet: true } };
    expect(resolve([facetOnly], "field", cat)).toEqual({ kind: "none" });
    const both = { ...catToField, exposure: { facet: true, acceptance: true } };
    expect(resolve([both], "field", cat).kind).toBe("accepted");
  });

  test("an inactive declared scope removes the edge", () => {
    const scoped = { ...catToField, scopes: ["editor"] };
    expect(resolve([scoped], "field", cat).kind).toBe("accepted");
    expect(resolve([scoped], "field", cat, { scopes: ["global"] })).toEqual({ kind: "none" });
  });

  test("the request filter applies to the RELATED result", () => {
    const result = resolve([catToField], "field", cat, {}, (reference) =>
      reference.type === "field" && reference.value.name !== "region",
    );
    expect(result).toEqual({ kind: "none" });
  });

  test("two edges at equal footing are a CHOOSER, in stable id order, never first-wins", () => {
    const rival: PresentationRelation<Values, Facts> = {
      ...catToField,
      id: "plugin.cat-to-field",
      apply: (reference) =>
        reference.type === "cat"
          ? { type: "field", value: { docId: reference.value.docId, name: `${reference.value.field}!` } }
          : undefined,
    };
    const forward = resolve([catToField, rival], "field", cat);
    const backward = resolve([rival, catToField], "field", cat);
    expect(forward.kind).toBe("ambiguous");
    expect(forward).toEqual(backward);
    if (forward.kind === "ambiguous") {
      expect(forward.options.map((option) => option.relation)).toEqual([
        "plugin.cat-to-field",
        "product.cat-to-field",
      ]);
    }
  });

  test("nearer scope, then priority, break ties before the chooser; universal ranks last", () => {
    const editorEdge = { ...catToField, id: "editor.edge", scopes: ["editor"] };
    const globalEdge = { ...catToField, id: "global.edge", scopes: ["global"] };
    const byScope = resolve([globalEdge, editorEdge], "field", cat);
    expect(byScope.kind).toBe("accepted");
    if (byScope.kind === "accepted") expect(byScope.option.relation).toBe("editor.edge");

    const universal = { ...catToField, id: "universal.edge" };
    const scopedWins = resolve([universal, globalEdge], "field", cat);
    expect(scopedWins.kind).toBe("accepted");
    if (scopedWins.kind === "accepted") expect(scopedWins.option.relation).toBe("global.edge");

    const strong = { ...catToField, id: "strong.edge", priority: 5 };
    const byPriority = resolve([catToField, strong], "field", cat);
    expect(byPriority.kind).toBe("accepted");
    if (byPriority.kind === "accepted") expect(byPriority.option.relation).toBe("strong.edge");
  });
});
