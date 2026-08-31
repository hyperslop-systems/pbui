import { describe, expect, test } from "vitest";
import {
  draftToTransform,
  newTransformDraft,
  transformToDraft,
} from "../src/model/transformEditor";
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

describe("nominal and boolean filter operands", () => {
  const withNominal: Field[] = [
    ...fields,
    { name: "station", type: "n", inferred_from: "schema" },
    { name: "ok", type: "n", inferred_from: "schema" },
  ];

  test("a nominal filter compares through a string cast", () => {
    const transform = draftToTransform(
      { id: "filter-ok", kind: "filter", enabled: true, field: "ok", op: "=", value: "true" },
      withNominal,
    );
    if (transform.kind !== "core:filter" || transform.predicate?.kind !== "call") {
      throw new Error("expected a filter call");
    }
    // The cast is what makes the predicate valid in BOTH physical phases:
    // boolean once rows are on screen, string while the table is empty.
    expect(transform.predicate.arguments[0]).toEqual({
      kind: "cast",
      expression: {
        kind: "field",
        field: { fieldId: "field:source:root:ok", name: "ok" },
      },
      to: { kind: "string" },
      onFailure: "null",
    });
    expect(transform.predicate.arguments[1]).toMatchObject({ kind: "literal", value: "true" });
  });

  test("quantitative and temporal operands stay bare field references", () => {
    for (const [name, value] of [
      ["temperature", "21.5"],
      ["observed_at", "2026-07-27T12:00:00Z"],
    ] as const) {
      const transform = draftToTransform(
        { id: `filter-${name}`, kind: "filter", enabled: true, field: name, op: "=", value },
        withNominal,
      );
      if (transform.kind !== "core:filter" || transform.predicate?.kind !== "call") {
        throw new Error("expected a filter call");
      }
      expect(transform.predicate.arguments[0]).toEqual({
        kind: "field",
        field: { fieldId: `field:source:root:${name}`, name },
      });
    }
  });

  test("the cast form round-trips: the draft keeps its field, op, and value", () => {
    const draft = {
      id: "filter-roundtrip",
      kind: "filter",
      enabled: true,
      field: "ok",
      op: "=",
      value: "true",
    } as const;
    const rebuilt = transformToDraft(draftToTransform(draft, withNominal));
    expect(rebuilt).toMatchObject({ kind: "filter", field: "ok", op: "=", value: "true" });
  });
});
