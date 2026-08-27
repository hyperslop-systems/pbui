import { describe, expect, test } from "vitest";
import { vocabulary } from "../../demo/src/pbui/vocabulary";
import { validateReference, validateVerb, validateWidgetDocument } from "./validate";

const product = { type: "product", id: "2049", value: { name: "Eagle" } };

describe("validateReference (mirrors Go)", () => {
  test("accepts string and numeric ids, rejects the rest", () => {
    expect(validateReference(product)).toBeNull();
    expect(validateReference({ type: "product", id: 2049 })).toBeNull();
    expect(validateReference(null)).toBe("reference is empty");
    expect(validateReference({ type: "9x", id: "1" })).toBe('reference type "9x" is not a valid identifier');
    expect(validateReference({ type: "product", id: "  " })).toBe("reference id is empty");
    expect(validateReference({ type: "product" })).toBe("reference has no id");
  });
});

describe("validateVerb (mirrors Go's Vocabulary.ValidateVerb)", () => {
  test("good verbs pass", () => {
    expect(validateVerb(vocabulary, { kind: "inspect", ref: product })).toBeNull();
    expect(validateVerb(vocabulary, { kind: "compareWith", left: product })).toBeNull();
    expect(validateVerb(vocabulary, { kind: "askAgent", template: "x {0}", refs: [product] })).toBeNull();
    expect(validateVerb(vocabulary, { kind: "rerunTool", toolCallId: "tc_1", args: { a: 1 } })).toBeNull();
    expect(validateVerb(vocabulary, { kind: "sortBy", tableId: "t3", field: "qty", dir: "asc" })).toBeNull();
  });

  test("bad verbs return the disabledBecause reason", () => {
    expect(validateVerb(vocabulary, null)).toBe("verb is empty");
    expect(validateVerb(vocabulary, {})).toBe("verb has no kind");
    expect(validateVerb(vocabulary, { kind: "frobnicate" })).toBe("unknown verb frobnicate");
    expect(validateVerb(vocabulary, { kind: "inspect" })).toBe("verb inspect is missing ref");
    expect(validateVerb(vocabulary, { kind: "inspect", ref: "2049" })).toBe(
      "verb inspect field ref: expected reference object, got string",
    );
    expect(validateVerb(vocabulary, { kind: "askAgent", template: "x", refs: [{ type: "product" }] })).toBe(
      "verb askAgent field refs: refs[0]: reference has no id",
    );
    expect(validateVerb(vocabulary, { kind: "sortBy", tableId: "t3", field: 3, dir: "asc" })).toBe(
      "verb sortBy field field: expected string, got float64",
    );
    // "object" means a STRUCTURED value — map or array — because the zod
    // deriver coarsens non-reference arrays (string lists) to it; a scalar
    // still fails.
    expect(validateVerb(vocabulary, { kind: "rerunTool", toolCallId: "tc", args: [] })).toBeNull();
    expect(validateVerb(vocabulary, { kind: "rerunTool", toolCallId: "tc", args: 7 })).toBe(
      "verb rerunTool field args: expected object, got float64",
    );
  });
});

const goodDocument = {
  format: "pbui.widget",
  schema_version: 1,
  title: "health",
  layout: "grid",
  children: [
    { kind: "text", text: "hello [[product:2049|Eagle]]", markdown: true },
    { kind: "meter", label: "stock", value: 12, max: 40, ref: product },
    { kind: "sparkline", label: "sales", values: [1, 2, 3] },
    { kind: "segmented", label: "mix", parts: [{ label: "a", value: 1 }] },
    { kind: "table", columns: [{ name: "sku" }], rows: [["A"]], docId: "t1" },
    { kind: "form", fields: [{ name: "q", label: "qty", input: "number" }] },
    { kind: "widget", document: { format: "pbui.widget", schema_version: 1, children: [{ kind: "callout", text: "nested" }] } },
  ],
  verbs: [{ label: "Inspect", verb: { kind: "inspect", ref: product } }],
};

function doc(patch: Record<string, unknown>): Record<string, unknown> {
  return { ...goodDocument, ...patch };
}

describe("validateWidgetDocument (mirrors Go's ValidateWidgetDocument)", () => {
  test("a good document passes", () => {
    expect(validateWidgetDocument(vocabulary, goodDocument)).toBeNull();
  });

  test("format and version", () => {
    expect(validateWidgetDocument(vocabulary, null)).toBe("widget document is empty");
    expect(validateWidgetDocument(vocabulary, doc({ format: "html" }))).toBe('format must be "pbui.widget"');
    expect(validateWidgetDocument(vocabulary, doc({ schema_version: 2 }))).toBe("schema_version must be 1");
  });

  test("unknown kind, missing children, unknown layout", () => {
    expect(validateWidgetDocument(vocabulary, doc({ children: [{ kind: "hologram" }] }))).toBe(
      'children[0] has unknown kind "hologram"',
    );
    expect(validateWidgetDocument(vocabulary, doc({ children: [] }))).toBe("widget has no children");
    expect(validateWidgetDocument(vocabulary, doc({ children: ["x"] }))).toBe("children[0] is not an object");
    expect(validateWidgetDocument(vocabulary, doc({ layout: "masonry" }))).toBe('unknown layout "masonry"');
  });

  test("depth > 3 is rejected, depth 3 is fine", () => {
    const leaf = { format: "pbui.widget", schema_version: 1, children: [{ kind: "text", text: "leaf" }] };
    const nest = (inner: unknown) => ({ kind: "widget", document: { format: "pbui.widget", schema_version: 1, children: [inner] } });
    const three = doc({ children: [nest({ kind: "widget", document: leaf })] });
    expect(validateWidgetDocument(vocabulary, three)).toBeNull();
    const four = doc({ children: [nest(nest({ kind: "widget", document: leaf }))] });
    expect(validateWidgetDocument(vocabulary, four)).toBe(
      "children[0] (widget): children[0] (widget): children[0] (widget): widget nesting deeper than 3",
    );
  });

  test("per-kind rules", () => {
    expect(validateWidgetDocument(vocabulary, doc({ children: [{ kind: "table", rows: [] }] }))).toBe(
      "children[0] (table): table has no columns",
    );
    expect(validateWidgetDocument(vocabulary, doc({ children: [{ kind: "table", columns: [{ name: "a" }], rows: ["x"] }] }))).toBe(
      "children[0] (table): rows[0] is not an array",
    );
    expect(validateWidgetDocument(vocabulary, doc({ children: [{ kind: "meter", label: "m", value: "12" }] }))).toBe(
      "children[0] (meter): meter needs a numeric value",
    );
    expect(validateWidgetDocument(vocabulary, doc({ children: [{ kind: "sparkline", label: "s", values: [] }] }))).toBe(
      "children[0] (sparkline): sparkline needs values",
    );
    expect(validateWidgetDocument(vocabulary, doc({ children: [{ kind: "segmented", label: "s" }] }))).toBe(
      "children[0] (segmented): segmented needs parts",
    );
    expect(validateWidgetDocument(vocabulary, doc({ children: [{ kind: "text" }] }))).toBe("children[0] (text): text needs text");
    expect(validateWidgetDocument(vocabulary, doc({ children: [{ kind: "callout" }] }))).toBe("children[0] (callout): callout needs text");
    expect(validateWidgetDocument(vocabulary, doc({ children: [{ kind: "form", fields: [] }] }))).toBe("children[0] (form): form needs fields");
    expect(validateWidgetDocument(vocabulary, doc({ children: [{ kind: "widget" }] }))).toBe(
      "children[0] (widget): nested widget needs a document",
    );
    expect(validateWidgetDocument(vocabulary, doc({ children: [{ kind: "refs", refs: [{ type: "product" }] }] }))).toBe(
      "children[0] (refs): refs[0]: reference has no id",
    );
    expect(validateWidgetDocument(vocabulary, doc({ children: [{ kind: "stat", label: "x", value: 1, ref: { id: "1" } }] }))).toBe(
      'children[0] (stat): reference type "" is not a valid identifier',
    );
  });

  test("limits: children and table rows", () => {
    const many = Array.from({ length: 65 }, () => ({ kind: "text", text: "x" }));
    expect(validateWidgetDocument(vocabulary, doc({ children: many }))).toBe("more than 64 children");
    const rows = Array.from({ length: 501 }, () => ["a"]);
    expect(validateWidgetDocument(vocabulary, doc({ children: [{ kind: "table", columns: [{ name: "a" }], rows }] }))).toBe(
      "children[0] (table): table has 501 rows, limit 500",
    );
  });

  test("verb chips are validated against the vocabulary", () => {
    expect(validateWidgetDocument(vocabulary, doc({ verbs: [{ verb: { kind: "inspect" } }] }))).toBe("verbs[0] has no label");
    expect(validateWidgetDocument(vocabulary, doc({ verbs: [{ label: "x", verb: { kind: "nope" } }] }))).toBe(
      "verbs[0]: unknown verb nope",
    );
    expect(validateWidgetDocument(null, doc({ verbs: [{ label: "x" }] }))).toBe("verbs[0] has no verb");
    expect(validateWidgetDocument(null, doc({ verbs: [{ label: "x", verb: { kind: "anything" } }] }))).toBeNull();
  });

  test("lenient mode (what the client renders with) lets VerbChips disable a bad chip instead", () => {
    const lenient = { verbs: "lenient" as const };
    expect(validateWidgetDocument(vocabulary, doc({ verbs: [{ label: "x", verb: { kind: "nope" } }] }), undefined, lenient)).toBeNull();
    expect(validateWidgetDocument(vocabulary, doc({ verbs: [{ label: "x" }] }), undefined, lenient)).toBe("verbs[0] has no verb");
    expect(validateWidgetDocument(vocabulary, doc({ children: [{ kind: "hologram" }] }), undefined, lenient)).toBe(
      'children[0] has unknown kind "hologram"',
    );
  });
});
