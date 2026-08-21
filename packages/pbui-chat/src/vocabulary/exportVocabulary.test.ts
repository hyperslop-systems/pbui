import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { vocabulary } from "../../demo/src/pbui/vocabulary";
import { defineVocabulary, exportVocabulary, verbSpecsFromSchema } from "./defineVocabulary";
import { VocabularySchema } from "./schemas";
import { z } from "zod";
import { ReferenceSchema } from "./schemas";

const VOCABULARY_JSON = path.resolve(import.meta.dirname, "../../../../pkg/chatserver/demo/vocabulary.json");

describe("exportVocabulary", () => {
  test("the demo's TS declaration and the embedded JSON agree", () => {
    const onDisk = JSON.parse(readFileSync(VOCABULARY_JSON, "utf8"));
    expect(exportVocabulary(vocabulary)).toEqual(onDisk);
  });

  test("the exported document parses as a vocabulary with Go's key order", () => {
    const exported = exportVocabulary(vocabulary);
    expect(VocabularySchema.safeParse(exported).success).toBe(true);
    expect(Object.keys(exported)).toEqual(["schema_version", "product", "types", "verbs", "widget", "conversions", "sandbox"]);
    expect(Object.keys(exported.sandbox!)).toEqual(["schema_version", "kinds", "intents"]);
    expect(Object.keys(exported.types.product!)).toEqual(["doc", "idHint", "tone", "verbs", "example"]);
    expect(Object.keys(exported.widget)).toEqual(["schema_version", "kinds", "layouts"]);
  });

  test("omitempty: empty optionals are dropped", () => {
    const minimal = defineVocabulary({
      product: "",
      types: { thing: { doc: "a thing" } },
      verbs: { poke: { doc: "poke it", fields: {} } },
      widgetKinds: ["text"],
    });
    const exported = exportVocabulary(minimal) as Record<string, unknown>;
    expect(exported).toEqual({
      schema_version: 1,
      types: { thing: { doc: "a thing" } },
      verbs: { poke: { doc: "poke it", fields: {} } },
      widget: { schema_version: 1, kinds: ["text"], layouts: ["stack", "row", "grid"] },
    });
  });

  test("defineVocabulary rejects what Go's Validate rejects", () => {
    expect(() =>
      defineVocabulary({ product: "x", types: { a: { doc: "a", verbs: ["nope"] } }, verbs: {}, widgetKinds: ["text"] }),
    ).toThrow('type "a" lists unknown verb "nope"');
    expect(() =>
      defineVocabulary({ product: "x", types: { a: { doc: "a" } }, verbs: {}, widgetKinds: ["text"], conversions: [{ from: "a", to: "b" }] }),
    ).toThrow('conversion to unknown type "b"');
    expect(() =>
      defineVocabulary({ product: "x", types: { a: { doc: "a" } }, verbs: {}, widgetKinds: ["text"], sandbox: { kinds: ["image"], intents: [] } }),
    ).toThrow('sandbox kind "image" is not known');
  });
});

describe("verbSpecsFromSchema", () => {
  test("coarsens zod field types and marks optionals with ?", () => {
    const schema = z.discriminatedUnion("kind", [
      z.object({
        kind: z.literal("demo"),
        ref: ReferenceSchema,
        refs: z.array(ReferenceSchema),
        name: z.string(),
        dir: z.enum(["asc", "desc"]),
        count: z.number().optional(),
        on: z.boolean(),
        args: z.record(z.string(), z.unknown()).optional(),
        list: z.array(z.string()),
      }),
    ]);
    expect(verbSpecsFromSchema(schema, { demo: { doc: "demo", danger: true } })).toEqual({
      demo: {
        doc: "demo",
        danger: true,
        fields: {
          ref: "ref",
          refs: "refs",
          name: "string",
          dir: "string",
          "count?": "number",
          on: "boolean",
          "args?": "object",
          list: "object",
        },
      },
    });
  });
});
