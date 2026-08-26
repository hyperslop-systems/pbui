import { describe, expect, test } from "vitest";
import { createPresentationTypeGraph } from "../actions/typeGraph";
import type { SelectionSnapshot } from "../actions/types";
import { resolveAcceptance } from "./resolve";
import type { PresentationTranslator } from "./types";

/**
 * The §24.7 translator matrix: subtype satisfaction preserves the concrete
 * reference; a supertype never satisfies a subtype request; one edge settles;
 * mismatched source/target/scope is nothing; two edges at equal footing are a
 * chooser; registration order never chooses.
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
  { id: "field" },
]);

const catToField: PresentationTranslator<Values, Facts> = {
  id: "product.cat-to-field",
  from: "cat",
  to: "field",
  match: "exact",
  translate: (reference) => {
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

const EMPTY = new Map<string, never>();

function resolve(
  translators: PresentationTranslator<Values, Facts>[],
  types: keyof Values | readonly (keyof Values)[],
  reference: Parameters<typeof resolveAcceptance<Values, Facts>>[2],
  over: Partial<SelectionSnapshot<Facts>> = {},
) {
  return resolveAcceptance<Values, Facts>(
    { graph, translators, predicates: EMPTY },
    { types: types as never, prompt: "?" },
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
      option: { translator: null, result: image },
    });
  });

  test("a supertype never satisfies a subtype request", () => {
    const doc = { type: "document", value: { id: "doc" } } as const;
    expect(resolve([], "image-file", doc)).toEqual({ kind: "none" });
  });

  test("one direct translator settles; source/target mismatches are nothing", () => {
    expect(resolve([catToField], "field", cat)).toEqual({
      kind: "accepted",
      option: {
        translator: "product.cat-to-field",
        result: { type: "field", value: { docId: "d1", name: "region" } },
      },
    });
    expect(resolve([catToField], "field", image)).toEqual({ kind: "none" });
    expect(resolve([catToField], "cat", image)).toEqual({ kind: "none" });
  });

  test("an inactive declared scope removes the edge", () => {
    const scoped = { ...catToField, scopes: ["editor"] };
    expect(resolve([scoped], "field", cat).kind).toBe("accepted");
    expect(resolve([scoped], "field", cat, { scopes: ["global"] })).toEqual({ kind: "none" });
  });

  test("the request filter applies to the TRANSLATED result", () => {
    const result = resolveAcceptance<Values, Facts>(
      { graph, translators: [catToField], predicates: EMPTY },
      {
        types: "field",
        prompt: "?",
        filter: (reference) => reference.type === "field" && reference.value.name !== "region",
      },
      cat,
      snapshot(),
    );
    expect(result).toEqual({ kind: "none" });
  });

  test("two edges at equal footing are a CHOOSER, in stable id order, never first-wins", () => {
    const rival: PresentationTranslator<Values, Facts> = {
      ...catToField,
      id: "plugin.cat-to-field",
      translate: (reference) =>
        reference.type === "cat"
          ? { type: "field", value: { docId: reference.value.docId, name: `${reference.value.field}!` } }
          : undefined,
    };
    const forward = resolve([catToField, rival], "field", cat);
    const backward = resolve([rival, catToField], "field", cat);
    expect(forward.kind).toBe("ambiguous");
    expect(forward).toEqual(backward);
    if (forward.kind === "ambiguous") {
      expect(forward.options.map((option) => option.translator)).toEqual([
        "plugin.cat-to-field",
        "product.cat-to-field",
      ]);
    }
  });

  test("nearer scope, then priority, break ties before the chooser", () => {
    const editorEdge = { ...catToField, id: "editor.edge", scopes: ["editor"] };
    const globalEdge = { ...catToField, id: "global.edge", scopes: ["global"] };
    const byScope = resolve([globalEdge, editorEdge], "field", cat);
    expect(byScope.kind).toBe("accepted");
    if (byScope.kind === "accepted") expect(byScope.option.translator).toBe("editor.edge");

    const strong = { ...catToField, id: "strong.edge", priority: 5 };
    const byPriority = resolve([catToField, strong], "field", cat);
    expect(byPriority.kind).toBe("accepted");
    if (byPriority.kind === "accepted") expect(byPriority.option.translator).toBe("strong.edge");
  });
});
