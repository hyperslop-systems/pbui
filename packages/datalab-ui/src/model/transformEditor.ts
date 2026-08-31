import type { AuthoringFieldRef, AuthoringTransform, Expression, RelationRef } from "./graphic";
import { sourceFieldId } from "./graphicAuthoring";
import type { Field } from "./table";

export type AggregateFunction = "mean" | "sum" | "min" | "max" | "count";
export type DeriveOperator = "+" | "-" | "*" | "/" | "log10";
export type FilterOperator = "=" | "!=" | ">" | "<";
export type TransformKind = "filter" | "derive" | "summarize" | "sort" | "limit";

export type TransformDraft =
  | {
      id: string;
      kind: "filter";
      enabled: boolean;
      field: string;
      op: FilterOperator;
      value: string;
    }
  | {
      id: string;
      kind: "derive";
      enabled: boolean;
      name: string;
      op: DeriveOperator;
      a: string;
      b: string;
    }
  | {
      id: string;
      kind: "summarize";
      enabled: boolean;
      by: string;
      fn: AggregateFunction;
      field: string;
    }
  | { id: string; kind: "sort"; enabled: boolean; field: string; dir: "asc" | "desc" }
  | { id: string; kind: "limit"; enabled: boolean; n: number };

export const AGGREGATE_FUNCTIONS: AggregateFunction[] = ["mean", "sum", "min", "max", "count"];
export const DERIVE_OPERATORS: DeriveOperator[] = ["+", "-", "*", "/", "log10"];
export const FILTER_OPERATORS: FilterOperator[] = ["=", "!=", ">", "<"];

function fieldReference(fields: readonly Field[], name: string): AuthoringFieldRef {
  const candidate = fields.find((item) => item.name === name);
  return {
    fieldId: candidate?.fieldId ?? sourceFieldId("source:root", name),
    name,
  };
}

const field = (fields: readonly Field[], name: string): Expression => ({
  kind: "field",
  field: fieldReference(fields, name),
});
const inputPlaceholder: RelationRef = { kind: "source", sourceId: "pending" };

export function newTransformDraft(kind: TransformKind, fields: Field[]): TransformDraft {
  const id = crypto.randomUUID();
  const quantitative = fields.filter((item) => item.type === "q").map((item) => item.name);
  const categorical = fields.filter((item) => item.type !== "q").map((item) => item.name);
  const first = fields[0]?.name ?? "";
  switch (kind) {
    case "filter":
      return { id, kind, enabled: false, field: first, op: "=", value: "" };
    case "derive":
      return {
        id,
        kind,
        enabled: true,
        name: "derived",
        op: "/",
        a: quantitative[0] ?? first,
        b: quantitative[1] ?? quantitative[0] ?? first,
      };
    case "summarize":
      return {
        id,
        kind,
        enabled: true,
        by: categorical[0] ?? first,
        fn: "mean",
        field: quantitative[0] ?? first,
      };
    case "sort":
      return { id, kind, enabled: true, field: first, dir: "asc" };
    case "limit":
      return { id, kind, enabled: true, n: 100 };
  }
}

export function draftToTransform(draft: TransformDraft, fields: Field[]): AuthoringTransform {
  const base = {
    id: draft.id,
    input: inputPlaceholder,
    enabled: draft.enabled,
    state: "complete" as const,
  };
  switch (draft.kind) {
    case "filter": {
      const source = fields.find((item) => item.name === draft.field);
      const value = source?.type === "q" ? Number(draft.value) : draft.value;
      const literal: Expression = {
        kind: "literal",
        value,
        ...(source?.type === "t"
          ? { valueType: { kind: "timestamp", unit: "ms" as const, timezone: "UTC" } }
          : {}),
      };
      const functions = { "=": "eq", "!=": "ne", ">": "gt", "<": "lt" } as const;
      // A nominal column compares through a string cast, not bare. The
      // field's PHYSICAL type is inferred from the rows on screen — boolean
      // once data has arrived, string while the table is still empty — so no
      // bare literal can type-check in both phases, and a boolean column
      // could not be filtered at all. The cast form is valid in both phases;
      // DuckDB renders booleans as 'true'/'false' under it, and for plain
      // string columns it is a no-op. `expressionField` reads through the
      // cast, so the round-trip keeps the field name.
      const operand: Expression =
        source?.type === "q" || source?.type === "t"
          ? field(fields, draft.field)
          : {
              kind: "cast",
              expression: field(fields, draft.field),
              to: { kind: "string" },
              onFailure: "null",
            };
      return {
        ...base,
        kind: "core:filter",
        predicate: {
          kind: "call",
          function: functions[draft.op],
          arguments: [operand, literal],
        },
      };
    }
    case "derive": {
      const functions = {
        "+": "add",
        "-": "subtract",
        "*": "multiply",
        "/": "divide",
        log10: "log10",
      } as const;
      return {
        ...base,
        kind: "core:extend",
        name: draft.name,
        semanticType: "quantitative",
        expression: {
          kind: "call",
          function: functions[draft.op],
          arguments:
            draft.op === "log10"
              ? [field(fields, draft.a)]
              : [field(fields, draft.a), field(fields, draft.b)],
        },
      };
    }
    case "summarize":
      return {
        ...base,
        kind: "core:aggregate",
        groupBy: [fieldReference(fields, draft.by)],
        measures: [
          {
            name: draft.fn === "count" ? "count" : `${draft.fn}_${draft.field}`,
            function: draft.fn === "count" ? "count_rows" : draft.fn,
            ...(draft.fn === "count" ? {} : { field: fieldReference(fields, draft.field) }),
          },
        ],
      };
    case "sort":
      return {
        ...base,
        kind: "core:sort",
        fields: [
          {
            field: fieldReference(fields, draft.field),
            direction: draft.dir,
            nulls: "last",
          },
        ],
      };
    case "limit":
      return { ...base, kind: "core:limit", count: draft.n };
  }
}

export function transformDraftLabel(draft: TransformDraft): string {
  switch (draft.kind) {
    case "filter":
      return `filter ${draft.field} ${draft.op} ${draft.value || "…"}`;
    case "derive":
      return draft.op === "log10"
        ? `derive ${draft.name} = log10(${draft.a})`
        : `derive ${draft.name} = ${draft.a} ${draft.op} ${draft.b}`;
    case "summarize":
      return `group ${draft.by} → ${draft.fn === "count" ? "count" : `${draft.fn}_${draft.field}`}`;
    case "sort":
      return `sort ${draft.field} ${draft.dir === "asc" ? "↑" : "↓"}`;
    case "limit":
      return `limit ${draft.n}`;
  }
}

function callExpression(
  expression: Expression | null,
): Extract<Expression, { kind: "call" }> | null {
  return expression?.kind === "call" ? expression : null;
}

function expressionField(expression: Expression | undefined): string {
  // A comparison may wrap its field in a cast — the seeded QC filters do,
  // because a boolean column's physical type depends on whether rows have
  // arrived yet (see demo/welcome.ts:filterEq). The field underneath is
  // still what the step is about, and what its caption should name.
  if (expression?.kind === "cast") return expressionField(expression.expression);
  return expression?.kind === "field" ? expression.field.name : "";
}

export function transformToDraft(transform: AuthoringTransform): TransformDraft {
  switch (transform.kind) {
    case "core:filter": {
      const call = callExpression(transform.predicate);
      const operators = { eq: "=", ne: "!=", gt: ">", lt: "<" } as const;
      const literal = call?.arguments[1];
      return {
        id: transform.id,
        kind: "filter",
        enabled: transform.enabled,
        field: expressionField(call?.arguments[0]),
        op:
          call?.function && call.function in operators
            ? operators[call.function as keyof typeof operators]
            : "=",
        value: literal?.kind === "literal" ? String(literal.value ?? "") : "",
      };
    }
    case "core:extend": {
      const call = callExpression(transform.expression);
      const operators = {
        add: "+",
        subtract: "-",
        multiply: "*",
        divide: "/",
        log10: "log10",
      } as const;
      return {
        id: transform.id,
        kind: "derive",
        enabled: transform.enabled,
        name: transform.name,
        op:
          call?.function && call.function in operators
            ? operators[call.function as keyof typeof operators]
            : "/",
        a: expressionField(call?.arguments[0]),
        b: expressionField(call?.arguments[1]),
      };
    }
    case "core:aggregate": {
      const measure = transform.measures[0];
      return {
        id: transform.id,
        kind: "summarize",
        enabled: transform.enabled,
        by: transform.groupBy[0]?.name ?? "",
        fn: measure?.function === "count_rows" ? "count" : (measure?.function ?? "mean"),
        field: measure?.field?.name ?? "",
      };
    }
    case "core:sort":
      return {
        id: transform.id,
        kind: "sort",
        enabled: transform.enabled,
        field: transform.fields[0]?.field.name ?? "",
        dir: transform.fields[0]?.direction ?? "asc",
      };
    case "core:limit":
      return { id: transform.id, kind: "limit", enabled: transform.enabled, n: transform.count };
    case "core:project":
      throw new Error("project transforms are not editable in the MVP pipeline panel");
  }
}
