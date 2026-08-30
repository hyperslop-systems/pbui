import type { Diagnostic, FieldSymbol } from "../model/graphic";
import type { AnalyticalField, FieldType, Row } from "../model/table";
import type { ArrowResultPort } from "./ports";

function visualType(symbol: FieldSymbol): FieldType {
  if (symbol.semanticType === "quantitative") return "q";
  if (symbol.semanticType === "temporal") return "t";
  return "n";
}

function normalizeScalar(
  value: unknown,
  field: FieldSymbol,
  diagnostics: Diagnostic[],
): null | boolean | number | string {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean" || typeof value === "string") return value;
  if (typeof value === "bigint") {
    return value >= BigInt(Number.MIN_SAFE_INTEGER) && value <= BigInt(Number.MAX_SAFE_INTEGER)
      ? Number(value)
      : value.toString(10);
  }
  if (typeof value === "number") {
    if (Number.isFinite(value)) return value;
    diagnostics.push({
      severity: "warning",
      code: "duckdb.non-finite",
      message: `Non-finite output in ${field.name} was normalized to null`,
      nodeId: field.id,
    });
    return null;
  }
  if (value instanceof Date) return value.toISOString();
  throw new Error(
    `output field ${field.name} has unsupported ${Object.prototype.toString.call(value)}`,
  );
}

export interface NormalizedResult {
  rows: Row[];
  fields: AnalyticalField[];
  diagnostics: Diagnostic[];
  truncated: boolean;
  bytes: number;
}

export function normalizeArrowResult(
  result: ArrowResultPort,
  output: FieldSymbol[],
  maxRows: number,
): NormalizedResult {
  const diagnostics: Diagnostic[] = [];
  const rawRows = result.toArray();
  const truncated = result.numRows > maxRows;
  const rows = rawRows.slice(0, maxRows).map((raw) => {
    const source = raw.toJSON ? raw.toJSON() : raw;
    const row: Row = {};
    for (const field of output) {
      row[field.name] = normalizeScalar(source[field.name], field, diagnostics);
    }
    return row;
  });
  const fields: AnalyticalField[] = output.map((field) => ({
    fieldId: field.id,
    name: field.name,
    type: visualType(field),
    inferred_from: "values",
  }));
  return {
    rows,
    fields,
    diagnostics,
    truncated,
    bytes: new TextEncoder().encode(JSON.stringify(rows)).byteLength,
  };
}
