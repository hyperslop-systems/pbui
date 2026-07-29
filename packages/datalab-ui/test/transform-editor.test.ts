import { describe, expect, test } from "vitest";
import { draftToTransform, newTransformDraft } from "../src/model/transformEditor";
import type { Field } from "../src/model/table";

const fields: Field[] = [
  { name: "temperature", type: "q", inferred_from: "schema" },
  { name: "observed_at", type: "t", inferred_from: "schema" },
];

describe("filter authoring", () => {
  test("a newly added blank filter is inactive instead of filtering for zero", () => {
    const draft = newTransformDraft("filter", fields);
    expect(draft).toMatchObject({ kind: "filter", enabled: false, value: "" });

    const transform = draftToTransform(draft, fields);
    expect(transform.enabled).toBe(false);
  });

  test("temporal filter literals carry the timestamp physical type", () => {
    const transform = draftToTransform(
      {
        id: "filter-time",
        kind: "filter",
        enabled: true,
        field: "observed_at",
        op: "=",
        value: "2026-07-27T12:00:00Z",
      },
      fields,
    );
    expect(transform.kind).toBe("core:filter");
    if (transform.kind !== "core:filter" || transform.predicate?.kind !== "call") {
      throw new Error("expected a filter call");
    }
    expect(transform.predicate.arguments[1]).toEqual({
      kind: "literal",
      value: "2026-07-27T12:00:00Z",
      valueType: { kind: "timestamp", unit: "ms", timezone: "UTC" },
    });
  });
});
