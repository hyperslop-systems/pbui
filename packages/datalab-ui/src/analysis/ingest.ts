import type { FieldSymbol } from "../model/graphic";
import type { Table } from "../model/table";
import { duckDBType, quoteIdentifier } from "./quote";

export interface SerializedTable {
  text: string;
  bytes: number;
}

export function serializeTableNDJSON(table: Table): SerializedTable {
  const lines = table.rows.map((row, rowIndex) => {
    const normalized: Record<string, null | boolean | number | string> = {};
    for (const field of table.fields) {
      const value = row[field.name];
      if (value === null || value === undefined) {
        normalized[field.name] = null;
      } else if (
        typeof value === "boolean" ||
        typeof value === "string" ||
        (typeof value === "number" && Number.isFinite(value))
      ) {
        normalized[field.name] = value;
      } else {
        throw new Error(
          `row ${rowIndex + 1} field ${field.name} is not a supported scalar JSON value`,
        );
      }
    }
    return JSON.stringify(normalized);
  });
  const text = lines.length > 0 ? `${lines.join("\n")}\n` : "";
  return { text, bytes: new TextEncoder().encode(text).byteLength };
}

export function createEmptyRelationSQL(relationName: string, fields: FieldSymbol[]): string {
  const columns = fields.map((field) => {
    if (field.provenance.kind !== "source") {
      throw new Error(`source registration field ${field.id} has non-source provenance`);
    }
    const sqlType = duckDBType(field.valueType.physical);
    if (!sqlType)
      throw new Error(`source field ${field.name} has unsupported unknown physical type`);
    return `${quoteIdentifier(field.provenance.path)} ${sqlType}${field.valueType.nullable ? "" : " NOT NULL"}`;
  });
  return `CREATE TABLE ${quoteIdentifier(relationName)} (${columns.join(", ")})`;
}
