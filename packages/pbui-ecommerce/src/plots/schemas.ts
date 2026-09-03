import type { FieldId, PlotData, PlotSchema } from "@hyperslop-systems/plot";
import { IDENTITY_FIELDS, type ShopHost, type TableName } from "../host";

/*
 * The plot schema of each table: what `@hyperslop-systems/plot` needs to
 * know about a column before it can put it on an axis. Field ids are
 * `field:<column>` so a plot document can name them without a lookup, and
 * every table's identity field is in its schema so marks get stable datum
 * identities (what a `datum` port emits).
 */

const field = (column: string, semanticType: "quantitative" | "nominal" | "ordinal" | "temporal", label?: string, unit?: string) => ({
  id: `field:${column}` as FieldId,
  name: column,
  column,
  semanticType,
  nullable: false,
  ...(label ? { label } : {}),
  ...(unit ? { unit } : {}),
});

export const SCHEMAS: Readonly<Record<TableName, PlotSchema>> = {
  orders: {
    fields: [field("id", "nominal", "Order"), field("customer", "nominal", "Customer"), field("placedAt", "temporal", "Placed"), field("status", "nominal", "Status"), field("items", "quantitative", "Units"), field("total", "quantitative", "Total", "USD")],
  },
  daily_sales: {
    fields: [field("id", "nominal"), field("date", "temporal", "Date"), field("categoryId", "nominal", "Category"), field("metal", "nominal", "Metal"), field("revenue", "quantitative", "Revenue", "USD"), field("units", "quantitative", "Units"), field("orders", "quantitative", "Orders")],
  },
  products: {
    fields: [field("id", "nominal", "SKU"), field("name", "nominal", "Product"), field("metal", "nominal", "Metal"), field("categoryId", "nominal", "Category"), field("qty", "quantitative", "In stock"), field("reorderAt", "quantitative", "Reorder at"), field("price", "quantitative", "Price", "USD")],
  },
  customers: {
    fields: [field("id", "nominal"), field("name", "nominal", "Customer"), field("kind", "nominal", "Kind"), field("city", "nominal", "City")],
  },
  line_items: {
    fields: [field("id", "nominal"), field("orderId", "nominal", "Order"), field("productId", "nominal", "SKU"), field("qty", "quantitative", "Qty"), field("unitPrice", "quantitative", "Unit price", "USD")],
  },
  categories: { fields: [field("id", "nominal"), field("name", "nominal", "Category")] },
  metals: { fields: [field("id", "nominal"), field("name", "nominal", "Metal"), field("spotUsd", "quantitative", "Spot", "USD")] },
};

/** The rows of one table as plot data, with its identity declared. */
export function plotDataFor(host: ShopHost, table: TableName): PlotData {
  const rows = host.rows(table) as unknown as readonly Record<string, unknown>[];
  return {
    rows,
    coverage: { kind: "complete", rowCount: rows.length },
    identity: { fields: [`field:${IDENTITY_FIELDS[table]}` as FieldId] },
  };
}
