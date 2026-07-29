import { describe, expect, test } from "vitest";
import { csvField, toCSV } from "../src/export/csv";
import { census } from "../src/fixtures";
import { appendTransform, createDefaultGraphic, rootView } from "../src/model/graphicAuthoring";
import { decodeSpec, encodeSpec, specFromHash } from "../src/model/permalink";
import type { Field } from "../src/model/table";

describe("csvField", () => {
  test("quotes only what RFC 4180 requires", () => {
    expect(csvField("plain")).toBe("plain");
    expect(csvField("has space")).toBe("has space");
    expect(csvField("a,b")).toBe('"a,b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField("line\nbreak")).toBe('"line\nbreak"');
  });
});

describe("toCSV", () => {
  const fields: Field[] = [
    { name: "name", type: "n", inferred_from: "values" },
    { name: "value", type: "q", inferred_from: "values" },
  ];

  test("writes a header, the rows, and a trailing newline", () => {
    const csv = toCSV(fields, [
      { name: "a", value: 1 },
      { name: "b,c", value: 2 },
    ]);
    expect(csv).toBe('name,value\na,1\n"b,c",2\n');
  });

  test("an absent value is an empty cell, not the text null", () => {
    const csv = toCSV(fields, [{ name: "a" }, { name: "b", value: null }]);
    expect(csv).toBe("name,value\na,\nb,\n");
  });
});

describe("permalink", () => {
  const spec = createDefaultGraphic("doc", "census", census);
  rootView(spec).mark = "bar";
  rootView(spec).yScale = "log";
  appendTransform(spec, {
    id: "s1",
    kind: "core:filter",
    input: { kind: "source", sourceId: "pending" },
    enabled: true,
    state: "complete",
    predicate: {
      kind: "call",
      function: "eq",
      arguments: [
        { kind: "field", field: { name: "region" } },
        { kind: "literal", value: "north" },
      ],
    },
  });

  test("round-trips a whole specification", () => {
    expect(decodeSpec(encodeSpec(spec))).toEqual(spec);
  });

  test("survives non-ASCII in a filter value", () => {
    const accented = structuredClone(spec);
    const transform = accented.transforms.s1;
    if (transform?.kind !== "core:filter" || transform.predicate?.kind !== "call") {
      throw new Error("fixture filter missing");
    }
    transform.predicate.arguments[1] = { kind: "literal", value: "Zürich — 北" };
    expect(decodeSpec(encodeSpec(accented))).toEqual(accented);
  });

  test("reads a spec out of a location hash", () => {
    expect(specFromHash(`#graphic=${encodeSpec(spec)}`)).toEqual(spec);
    expect(specFromHash("")).toBeNull();
    expect(specFromHash("#other=1")).toBeNull();
  });

  test("the former ChartSpec permalink is rejected without conversion", () => {
    const legacy = JSON.stringify({
      source: census.source,
      steps: [],
      geom: "bar",
      mapping: { x: "region", y: "population" },
    });
    const encoded = btoa(legacy).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(decodeSpec(encoded)).toBeNull();
  });

  // A hand-edited or chat-truncated fragment must open an empty workbench, not
  // a blank screen.
  test("a malformed fragment decodes to null rather than throwing", () => {
    for (const bad of ["", "!!!", "eyJ", btoa("not a spec"), btoa("[]"), btoa("{}")]) {
      expect(decodeSpec(bad)).toBeNull();
    }
  });

  test("never carries a credential", () => {
    // The spec type has no token field, and this asserts the encoded payload
    // has no such key by any name a future edit might introduce.
    const encoded = encodeSpec(spec);
    const decoded = JSON.stringify(decodeSpec(encoded));
    for (const forbidden of ["token", "authorization", "bearer", "password"]) {
      expect(decoded.toLowerCase()).not.toContain(forbidden);
    }
  });
});
