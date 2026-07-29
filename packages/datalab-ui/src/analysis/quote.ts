import type { FieldId, PhysicalType } from "../model/graphic";

export function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

export function quoteStringLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

/** A deterministic target-owned alias; display names never become identity. */
export function fieldAlias(fieldId: FieldId): string {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(fieldId)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193);
  }
  return `field_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function duckDBType(type: PhysicalType): string | null {
  switch (type.kind) {
    case "boolean":
      return "BOOLEAN";
    case "int64":
      return "BIGINT";
    case "float64":
      return "DOUBLE";
    case "string":
      return "VARCHAR";
    case "timestamp":
      return type.timezone ? "TIMESTAMPTZ" : "TIMESTAMP";
    case "unknown":
      return null;
  }
}
